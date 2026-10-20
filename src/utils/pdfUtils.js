import { REGEX_FECHA } from "../reglas.js";
import { normalizeForSearch } from "./textUtils.js";

let tesseractWorkerPromise = null;

/**
 * Obtiene o inicializa el worker de Tesseract reutilizable
 */
async function obtenerWorkerTesseract() {
    if (typeof window === "undefined" || !window.Tesseract) {
        return null;
    }
    if (!tesseractWorkerPromise) {
        tesseractWorkerPromise = (async () => {
            try {
                const worker = await window.Tesseract.createWorker();
                await worker.loadLanguage("spa");
                await worker.initialize("spa");
                return worker;
            } catch (err) {
                console.warn("[OCR] Error inicializando worker Tesseract:", err);
                tesseractWorkerPromise = null;
                return null;
            }
        })();
    }
    return tesseractWorkerPromise;
}

/**
 * Ejecuta OCR sobre una página de PDF.js renderizándola a un canvas
 */
export async function extraerTextoOCRPagina(page) {
    if (typeof window === "undefined" || !window.Tesseract) {
        return "";
    }
    try {
        const viewport = page.getViewport({ scale: 1.5 }); // Escala 1.5 para óptima nitidez de OCR en números pequeños
        const canvas = document.createElement("canvas");
        const ctx = canvas.getContext("2d");
        canvas.width = viewport.width;
        canvas.height = viewport.height;

        await page.render({
            canvasContext: ctx,
            viewport: viewport,
        }).promise;

        const worker = await obtenerWorkerTesseract();
        let ocrText = "";
        if (worker) {
            const ret = await worker.recognize(canvas);
            ocrText = ret?.data?.text || "";
        } else {
            const result = await window.Tesseract.recognize(canvas, "spa");
            ocrText = result?.data?.text || "";
        }

        canvas.width = 0;
        canvas.height = 0;

        return ocrText;
    } catch (e) {
        console.warn("[OCR] Error en página:", e);
        return "";
    }
}

/**
 * Determina si una cadena de texto contiene caracteres no mapeados o corruptos (típicos de fuentes Type 3 sin ToUnicode)
 */
export function tieneTextoCorrupto(texto) {
    if (!texto || texto.length < 10) return false;
    // Si contiene patrones de nombres de glifos Type 3 emitidos sin mapa ToUnicode (/0 /1 /2 /3 /i255)
    if (/\/[0-9]+\s+\/[0-9]+/i.test(texto) || /\/i255/i.test(texto)) {
        return true;
    }
    let ctrlCount = 0;
    const len = texto.length;
    for (let i = 0; i < len; i++) {
        const code = texto.charCodeAt(i);
        // Caracteres de control ASCII comunes en glifos Type 3 sin mapear (\x00-\x08, \x0E-\x1F)
        if (code < 32 && code !== 9 && code !== 10 && code !== 13) {
            ctrlCount++;
            if (ctrlCount >= 10) return true;
        }
    }
    return false;
}

/**
 * Ejecuta OCR sobre las páginas de un documento PDF.
 * Para optimizar velocidad, procesa las primeras páginas (máximo maxPages)
 * o se detiene si el texto acumulado ya satisface un criterio de búsqueda.
 */
export async function extraerTextoOCRDePDF(pdf, maxPages = 3, terminoEsperado = "", requerirFecha = false) {
    let textoOCR = "";
    const total = Math.min(pdf.numPages, maxPages);
    const esperadoNorm = terminoEsperado ? normalizeForSearch(terminoEsperado) : "";

    for (let i = 1; i <= total; i++) {
        const page = await pdf.getPage(i);
        try {
            const textoPagina = await extraerTextoOCRPagina(page);
            textoOCR += textoPagina + " ";

            // Si se busca un término y además se requieren fechas, no detenerse hasta tener ambos
            const tieneEsperado = !esperadoNorm || normalizeForSearch(textoOCR).includes(esperadoNorm);
            const tieneFecha = !requerirFecha || extraerFechas(textoOCR).length > 0;

            if (tieneEsperado && tieneFecha) {
                break;
            }
        } finally {
            if (page && page.cleanup) {
                page.cleanup();
            }
        }
    }
    return textoOCR;
}

/**
 * Extrae el texto digital de un PDF página por página.
 * NO ejecuta OCR general automático para no ralentizar el procesamiento masivo.
 */
export async function extraerTextoPDF(pdf) {
    let texto = "";

    for (let i = 1; i <= pdf.numPages; i++) {
        const page = await pdf.getPage(i);
        try {
            const content = await page.getTextContent();
            const textoPag = content.items.map((t) => t.str).join(" ").trim();
            texto += textoPag + " ";
        } finally {
            if (page && page.cleanup) {
                page.cleanup();
            }
        }
    }

    return texto;
}

/**
 * Extrae todas las fechas de un texto usando REGEX_FECHA
 */
export function extraerFechas(texto) {
    const fechas = [];
    let match;
    REGEX_FECHA.lastIndex = 0;

    while ((match = REGEX_FECHA.exec(texto)) !== null) {
        fechas.push(match[1].replace(/\s+/g, "").trim());
    }

    return fechas;
}

/**
 * Detecta los índices de las fechas que rompen el orden cronológico no decreciente (LNDS).
 * @param {string[]} fechas 
 * @returns {Set<number>} Conjunto de índices desordenados
 */
export function obtenerIndicesDesordenados(fechas) {
    if (!fechas || fechas.length <= 1) return new Set();

    const n = fechas.length;
    let yaOrdenada = true;
    for (let i = 1; i < n; i++) {
        if (fechas[i] < fechas[i - 1]) {
            yaOrdenada = false;
            break;
        }
    }
    if (yaOrdenada) return new Set();

    const timestamps = fechas.map((f) => {
        const t = new Date(f).getTime();
        return isNaN(t) ? f : t;
    });

    const dp = new Array(n).fill(1);
    const parent = new Array(n).fill(-1);

    for (let i = 0; i < n; i++) {
        for (let j = 0; j < i; j++) {
            if (fechas[j] <= fechas[i]) {
                if (dp[j] + 1 > dp[i]) {
                    dp[i] = dp[j] + 1;
                    parent[i] = j;
                } else if (dp[j] + 1 === dp[i]) {
                    const saltoActual =
                        typeof timestamps[i] === "number" &&
                        typeof timestamps[parent[i]] === "number"
                            ? Math.abs(timestamps[i] - timestamps[parent[i]])
                            : 0;
                    const saltoNuevo =
                        typeof timestamps[i] === "number" &&
                        typeof timestamps[j] === "number"
                            ? Math.abs(timestamps[i] - timestamps[j])
                            : 0;
                    if (saltoNuevo < saltoActual) {
                        parent[i] = j;
                    }
                }
            }
        }
    }

    let maxLen = 0;
    let bestEnd = -1;
    for (let i = 0; i < n; i++) {
        if (dp[i] > maxLen) {
            maxLen = dp[i];
            bestEnd = i;
        }
    }

    const indicesEnOrden = new Set();
    let curr = bestEnd;
    while (curr !== -1) {
        indicesEnOrden.add(curr);
        curr = parent[curr];
    }

    const indicesDesordenados = new Set();
    for (let i = 0; i < n; i++) {
        if (!indicesEnOrden.has(i)) {
            indicesDesordenados.add(i);
        }
    }

    return indicesDesordenados;
}

/**
 * Detecta los índices de las fechas que se encuentran duplicadas en la lista.
 * @param {string[]} fechas 
 * @returns {Set<number>} Conjunto de índices que tienen fecha duplicada
 */
export function obtenerIndicesDuplicados(fechas) {
    if (!fechas || fechas.length <= 1) return new Set();

    const conteo = {};
    for (const f of fechas) {
        conteo[f] = (conteo[f] || 0) + 1;
    }

    const indicesDuplicados = new Set();
    fechas.forEach((f, idx) => {
        if (conteo[f] > 1) {
            indicesDuplicados.add(idx);
        }
    });

    return indicesDuplicados;
}

/**
 * Valida que las fechas no estén duplicadas y estén en orden cronológico
 * @returns {Object} { duplicadas: string[], desordenadas: boolean, fechasOrdenadas: string[], fechasDesordenadas: string[], indicesDesordenados: number[], indicesDuplicados: number[] }
 */
export function validarOrdenFechas(fechas) {
    const duplicadas = [];
    const fechasVistas = new Set();

    // Detectar duplicadas
    for (const fecha of fechas) {
        if (fechasVistas.has(fecha)) {
            if (!duplicadas.includes(fecha)) {
                duplicadas.push(fecha);
            }
        }
        fechasVistas.add(fecha);
    }

    // Verificar orden cronológico
    const fechasOrdenadas = [...fechas].sort();
    const desordenadas =
        JSON.stringify(fechas) !== JSON.stringify(fechasOrdenadas);

    const indicesDesordenadosSet = obtenerIndicesDesordenados(fechas);
    const indicesDuplicadosSet = obtenerIndicesDuplicados(fechas);
    const fechasDesordenadas = [
        ...new Set([...indicesDesordenadosSet].map((idx) => fechas[idx])),
    ];

    return {
        duplicadas,
        desordenadas,
        fechasOrdenadas,
        fechasDesordenadas,
        indicesDesordenados: Array.from(indicesDesordenadosSet),
        indicesDuplicados: Array.from(indicesDuplicadosSet),
    };
}

/**
 * Lee un archivo y lo convierte en ArrayBuffer
 */
export async function leerArchivoComoBuffer(file) {
    return await file.arrayBuffer();
}
