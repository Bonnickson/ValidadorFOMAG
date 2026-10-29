import {
    FEATURE_RIESGO_JURIDICO_ACTIVO,
    REGLAS_TERAPIAS_PAQUETES,
    PAQUETES_SOPORTADOS,
    normalizarCodigoPaquete,
    CODIGOS_APLICACION,
    CODIGOS_DIARIOS,
    CODIGOS_PALIATIVOS,
    MAPEO_NUEVA_EPS_A_FOMAG,
} from "../config/constants.js";

/**
 * Mapeo de columnas esperadas
 * Fila 1: Títulos
 * Fila 2: Encabezados (índice 1 en array 0-indexed)
 * Fila 3 en adelante: Datos (índice 2 en array 0-indexed)
 */
export const MAPEO_COLUMNAS_MATRIZ = {
    TIPO_DOC: 0,       // Col A
    DOCUMENTO: 1,      // Col B
    NOMBRE: 2,         // Col C
    PAQUETE: 3,        // Col D
    FACTURAR_EVENTO: 4,// Col E: Facturar evento
    // Col F (5): Geriatria (omitido)
    VM: 6,             // Col G: Paq. Médica General
    ENF_PROF: 7,       // Col H: Paq. Enfermería Profesional
    ENF_AUX: 8,        // Col I: Paq. Aux Enfermeria
    TF: 9,             // Col J: Paq. Terapia Física
    TR: 10,            // Col K: Paq. Terapia Respiratoria
    TRS: 11,           // Col L: Paq. Terapia Respiratoria Con Succión
    FON: 12,           // Col M: Paq. Fonoaudiología
    TO: 13,            // Col N: Paq. Terapia Ocupacional
    NUT: 14,           // Col O: Paq. Nutrición
    TS: 15,            // Col P: Paq. Trabajo Social
    PSI: 16,           // Col Q: Paq. Psicología
};

/**
 * Normaliza texto de encabezado para búsqueda insensible a acentos, mayúsculas y caracteres especiales
 */
function normalizarEncabezado(str) {
    if (!str) return "";
    return String(str)
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .toLowerCase()
        .replace(/[^a-z0-9]/g, " ")
        .replace(/\s+/g, " ")
        .trim();
}

/**
 * Detecta dinámicamente las columnas de la matriz a partir de las filas de encabezado (Fila 1 y Fila 2)
 */
function detectarColumnasMatriz(rawRows) {
    const mapeo = { ...MAPEO_COLUMNAS_MATRIZ };
    let colCantDiario = -1;
    let colApl1 = -1;
    let colApl2 = -1;
    let colApl3 = -1;
    let colApl4 = -1;
    const colEvento = {
        VM: -1,
        VMRJ: -1,
        VENF: -1,
        NUT: -1,
        FON: -1,
        TF: -1,
        TR: -1,
        TRS: -1,
        TO: -1,
        TS: -1,
        PSI: -1,
        ENF6: -1,
        ENF8: -1,
        ENF12: -1,
        ENF12N: -1,
        ENF24: -1,
        CUID6: -1,
        CUID8: -1,
        CUID12: -1,
        CUID12N: -1,
        CUID24: -1,
        MED1: -1,
        MED2: -1,
        MED3: -1,
        MED4: -1,
        ESP: -1,
    };

    const filasHeaders = [rawRows[0] || [], rawRows[1] || []];

    filasHeaders.forEach((fila) => {
        if (!Array.isArray(fila)) return;
        fila.forEach((celda, idx) => {
            const h = normalizarEncabezado(celda);
            if (!h) return;

            // Detección de columnas de Evento (Eve. Médica General, Eve. Turno Enfermería..., etc.)
            if (h.includes("eve") || h.includes("evento")) {
                if (FEATURE_RIESGO_JURIDICO_ACTIVO && (h.includes("riesgo juridico") || h.includes("juridico"))) {
                    if (colEvento.VMRJ === -1) colEvento.VMRJ = idx;
                } else if (h.includes("medica general") || h.includes("medicina general") || h.includes("general 2") || (h.includes("medica") && !h.includes("especial"))) {
                    if (colEvento.VM === -1) colEvento.VM = idx;
                } else if (h.includes("enfermeria profesional") || h.includes("profesional 3")) {
                    if (colEvento.VENF === -1) colEvento.VENF = idx;
                } else if (h.includes("nutricion")) {
                    if (colEvento.NUT === -1) colEvento.NUT = idx;
                } else if (h.includes("fonoaudiologia") || h.includes("fono")) {
                    if (colEvento.FON === -1) colEvento.FON = idx;
                } else if (h.includes("terapia fisica") || h.includes("fisica")) {
                    if (colEvento.TF === -1) colEvento.TF = idx;
                } else if (h.includes("succion")) {
                    if (colEvento.TRS === -1) colEvento.TRS = idx;
                } else if (h.includes("terapia respiratoria") || h.includes("respiratoria")) {
                    if (colEvento.TR === -1) colEvento.TR = idx;
                } else if (h.includes("terapia ocupacional") || h.includes("ocupacional")) {
                    if (colEvento.TO === -1) colEvento.TO = idx;
                } else if (h.includes("trabajo social") || h.includes("social")) {
                    if (colEvento.TS === -1) colEvento.TS = idx;
                } else if (h.includes("psicologia") || h.includes("psico")) {
                    if (colEvento.PSI === -1) colEvento.PSI = idx;
                } else if (h.includes("turno enfermeria") || h.includes("enfermeria")) {
                    if (h.includes("6") || h.includes("seis")) {
                        if (colEvento.ENF6 === -1) colEvento.ENF6 = idx;
                    } else if (h.includes("8") || h.includes("ocho")) {
                        if (colEvento.ENF8 === -1) colEvento.ENF8 = idx;
                    } else if (h.includes("12") || h.includes("doce")) {
                        if (h.includes("nocturn")) {
                            if (colEvento.ENF12N === -1) colEvento.ENF12N = idx;
                        } else {
                            if (colEvento.ENF12 === -1) colEvento.ENF12 = idx;
                        }
                    } else if (h.includes("24") || h.includes("veinticuatro")) {
                        if (colEvento.ENF24 === -1) colEvento.ENF24 = idx;
                    }
                } else if (h.includes("cuidador")) {
                    if (h.includes("6") || h.includes("seis")) {
                        if (colEvento.CUID6 === -1) colEvento.CUID6 = idx;
                    } else if (h.includes("8") || h.includes("ocho")) {
                        if (colEvento.CUID8 === -1) colEvento.CUID8 = idx;
                    } else if (h.includes("12") || h.includes("doce")) {
                        if (h.includes("nocturn")) {
                            if (colEvento.CUID12N === -1) colEvento.CUID12N = idx;
                        } else {
                            if (colEvento.CUID12 === -1) colEvento.CUID12 = idx;
                        }
                    } else if (h.includes("24") || h.includes("veinticuatro")) {
                        if (colEvento.CUID24 === -1) colEvento.CUID24 = idx;
                    }
                } else if (h.includes("aplicacion") || h.includes("medicamento")) {
                    if (h.includes("1 dosis") || h.includes("1dosis")) {
                        if (colEvento.MED1 === -1) colEvento.MED1 = idx;
                    } else if (h.includes("2 dosis") || h.includes("2dosis")) {
                        if (colEvento.MED2 === -1) colEvento.MED2 = idx;
                    } else if (h.includes("3 dosis") || h.includes("3dosis")) {
                        if (colEvento.MED3 === -1) colEvento.MED3 = idx;
                    } else if (h.includes("4 dosis") || h.includes("4dosis")) {
                        if (colEvento.MED4 === -1) colEvento.MED4 = idx;
                    }
                } else if (h.includes("medicina especial") || h.includes("especial")) {
                    if (colEvento.ESP === -1) colEvento.ESP = idx;
                }
            }

            // Cant Paquete Diario
            if (
                h.includes("cant paquete diario") ||
                h.includes("cantidad paquete diario") ||
                (h.includes("paquete diario") && h.includes("cant"))
            ) {
                if (colCantDiario === -1) colCantDiario = idx;
            }

            // Paq. Aplicación Medicamento 1 Dosis
            if (
                (h.includes("aplicacion") || h.includes("medicamento")) &&
                (h.includes("1 dosis") || h.includes("1dosis") || h.includes("dosis 1"))
            ) {
                if (colApl1 === -1) colApl1 = idx;
            }

            // Paq. Aplicación Medicamento 2 Dosis
            if (
                (h.includes("aplicacion") || h.includes("medicamento")) &&
                (h.includes("2 dosis") || h.includes("2dosis") || h.includes("dosis 2"))
            ) {
                if (colApl2 === -1) colApl2 = idx;
            }

            // Paq. Aplicación Medicamento 3 Dosis
            if (
                (h.includes("aplicacion") || h.includes("medicamento")) &&
                (h.includes("3 dosis") || h.includes("3dosis") || h.includes("dosis 3"))
            ) {
                if (colApl3 === -1) colApl3 = idx;
            }

            // Paq. Aplicación Medicamento 4 Dosis
            if (
                (h.includes("aplicacion") || h.includes("medicamento")) &&
                (h.includes("4 dosis") || h.includes("4dosis") || h.includes("dosis 4"))
            ) {
                if (colApl4 === -1) colApl4 = idx;
            }
        });
    });

    return {
        ...mapeo,
        CANT_PAQ_DIARIO: colCantDiario,
        APL_1_DOSIS: colApl1,
        APL_2_DOSIS: colApl2,
        APL_3_DOSIS: colApl3,
        APL_4_DOSIS: colApl4,
        EVENTO_COLS: colEvento,
    };
}

/**
 * Obtiene la instancia de XLSX de forma segura (window.XLSX o import dinámico)
 */
async function obtenerLibreriaXLSX() {
    if (window.XLSX && window.XLSX.read) {
        return window.XLSX;
    }
    try {
        const mod = await import("https://cdn.sheetjs.com/xlsx-0.20.3/package/xlsx.mjs");
        return mod.default || mod;
    } catch (e) {
        if (window.XLSX) return window.XLSX;
        throw new Error("No se pudo cargar la librería XLSX para procesar el Excel. Verifica tu conexión a internet.");
    }
}

/**
 * Lee un archivo Excel (.xlsx, .xls) o CSV y devuelve el array de filas crudo
 * @param {File} file
 * @returns {Promise<Array<Array<any>>>}
 */
export async function leerArchivoMatriz(file) {
    const xlsxLib = await obtenerLibreriaXLSX();
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = (e) => {
            try {
                const data = new Uint8Array(e.target.result);
                const workbook = xlsxLib.read(data, { type: "array" });
                if (!workbook || !workbook.SheetNames || workbook.SheetNames.length === 0) {
                    throw new Error("El archivo Excel no contiene hojas de datos legibles.");
                }
                const firstSheetName = workbook.SheetNames[0];
                const worksheet = workbook.Sheets[firstSheetName];
                const jsonRows = xlsxLib.utils.sheet_to_json(worksheet, {
                    header: 1,
                    defval: "",
                    blankrows: false,
                });
                resolve(jsonRows);
            } catch (err) {
                reject(err);
            }
        };
        reader.onerror = (err) => reject(err);
        reader.readAsArrayBuffer(file);
    });
}

/**
 * Extrae número entero de una celda
 */
function parseCantidad(val) {
    if (val === null || val === undefined || val === "") return 0;
    if (typeof val === "number") return isNaN(val) ? 0 : Math.max(0, Math.floor(val));
    const clean = String(val).replace(/[^0-9]/g, "").trim();
    if (!clean) return 0;
    const num = parseInt(clean, 10);
    return isNaN(num) ? 0 : num;
}

/**
 * Construye una matriz virtual de una sola fila a partir de texto copiado/pegado
 * (TSV separado por tabulaciones o CSV delimitado por comas/punto y coma).
 * @param {string} textoFila
 * @returns {Array<Array<any>>} rawRows listo para ser parseado por parsearMatriz
 */
export function construirMatrizDesdeFilaPegada(textoFila) {
    if (!textoFila || typeof textoFila !== "string") {
        throw new Error("El texto de la fila no puede estar vacío.");
    }

    const lineas = textoFila.trim().split(/\r?\n/).filter(l => l.trim().length > 0);
    if (lineas.length === 0) {
        throw new Error("No se detectó ninguna línea de datos en el texto pegado.");
    }

    // Tomar la primera línea (o si pegaron encabezado + fila, la fila con datos)
    let lineaDatos = lineas[0];
    if (lineas.length > 1) {
        // Si la primera línea parece encabezado (ej. incluye 'Documento' o 'Tipo'), tomamos la segunda
        const l0Norm = normalizarEncabezado(lineas[0]);
        if (l0Norm.includes("documento") || l0Norm.includes("tipo doc") || l0Norm.includes("paciente")) {
            lineaDatos = lineas[1];
        }
    }

    // Detectar delimitador (tabulación o punto y coma o coma)
    let celdas = [];
    if (lineaDatos.includes("\t")) {
        celdas = lineaDatos.split("\t");
    } else if (lineaDatos.includes(";")) {
        celdas = lineaDatos.split(";");
    } else if (lineaDatos.includes(",")) {
        celdas = lineaDatos.split(",");
    } else {
        // Intento con múltiples espacios
        celdas = lineaDatos.split(/\s{2,}/);
    }

    // Limpiar espacios en cada celda
    celdas = celdas.map(c => String(c ?? "").trim());

    if (celdas.length < 2) {
        throw new Error("La fila pegada debe contener al menos las columnas de Tipo Doc y Documento.");
    }

    // Encabezados oficiales de la matriz
    const headerRow0 = [
        "Tipo doc",
        "Documento Paciente",
        "Nombre Completo Del Paciente",
        "Paquete",
        "Facturar por evento",
        "Cant Paquete Diario",
        "Paq. Médica General",
        "Paq. Enfermería Profesional",
        "Paq. Aux Enfermeria",
        "Paq. Terapia Física",
        "Paq. Terapia Respiratoria",
        "Paq. Terapia Respiratoria Con Succión",
        "Paq. Fonoaudiología",
        "Paq. Terapia Ocupacional",
        "Paq. Nutrición",
        "Paq. Trabajo Social",
        "Paq. Psicología",
        "Paq. Aplicación Medicamento 1 Dosis",
        "Paq. Aplicación Medicamento 2 Dosis",
        "Paq. Aplicación Medicamento 3 Dosis",
        "Paq. Aplicación Medicamento 4 Dosis",
        "Paq. Cambio de Sonda",
        "Paq. Curacion De Herida Grado III - Complejidad Alta",
        "Paq. Curacion De Herida Grado II - Complejidad Media",
        "Paq. Curacion De Herida Grado I - Complejidad Baja",
        "Eve. Médica General",
        "Eve. Médica General Riesgo Juridico",
        "Eve. Turno Enfermería 6 Horas",
        "Eve. Turno Enfermería 8 Horas",
        "Eve. Turno Enfermería 12 Horas",
        "Eve. Turno Enfermería 12 Horas Nocturno",
        "Eve. Turno Enfermería 24 Horas",
        "Eve. Turno Cuidador 6 Horas",
        "Eve. Turno Cuidador 8 Horas",
        "Eve. Turno Cuidador 12 Horas",
        "Eve. Turno Cuidador 12 Horas Nocturno",
        "Eve. Turno Cuidador 24 Horas",
        "Eve. Trabajo Social",
        "Observaciones PAD",
        "Observaciones Facturación",
        "Factura Paquete",
        "Factura Eventos",
        "Estado Paquete",
        "Estado Evento",
        "Observación Soft"
    ];

    const headerRow1 = [...headerRow0];

    // Si la fila pegada tiene menos columnas que el header, rellenamos con vacíos
    const filaCompleta = [...celdas];
    while (filaCompleta.length < headerRow0.length) {
        filaCompleta.push("");
    }

    return [headerRow0, headerRow1, filaCompleta];
}

/**
 * Normaliza documento (mantiene el valor recortando espacios en los extremos)
 */
export function normalizarDocumentoMatriz(doc) {
    if (doc === null || doc === undefined) return "";
    return String(doc).trim();
}

/**
 * Obtiene la lista de columnas detectadas con sus etiquetas de encabezado y claves de servicio
 * para permitir al usuario seleccionar cuáles columnas omitir.
 * @param {Array<Array<any>>} rawRows
 * @returns {Array<{ key: string, label: string, colIdx: number, letra: string, defaultOmitir: boolean }>}
 */
export function listarColumnasConfigurablesMatriz(rawRows) {
    if (!rawRows || rawRows.length < 2) return [];

    const headerRow0 = rawRows[0] || [];
    const headerRow1 = rawRows[1] || [];
    const maxCols = Math.max(headerRow0.length, headerRow1.length);
    const columnasDetectadas = detectarColumnasMatriz(rawRows);

    const obtenerLetraCol = (idx) => {
        let n = idx;
        let letra = "";
        while (n >= 0) {
            letra = String.fromCharCode((n % 26) + 65) + letra;
            n = Math.floor(n / 26) - 1;
        }
        return letra;
    };

    const columnas = [];
    // Mapeo inverso de índice a clave de servicio
    const idxToServicioKey = {};
    if (columnasDetectadas.VM !== undefined && columnasDetectadas.VM !== -1) idxToServicioKey[columnasDetectadas.VM] = "VM";
    if (columnasDetectadas.ENF_PROF !== undefined && columnasDetectadas.ENF_PROF !== -1) idxToServicioKey[columnasDetectadas.ENF_PROF] = "VENF";
    if (columnasDetectadas.ENF_AUX !== undefined && columnasDetectadas.ENF_AUX !== -1) idxToServicioKey[columnasDetectadas.ENF_AUX] = "ENF";
    if (columnasDetectadas.TF !== undefined && columnasDetectadas.TF !== -1) idxToServicioKey[columnasDetectadas.TF] = "TF";
    if (columnasDetectadas.TR !== undefined && columnasDetectadas.TR !== -1) idxToServicioKey[columnasDetectadas.TR] = "TR";
    if (columnasDetectadas.TRS !== undefined && columnasDetectadas.TRS !== -1) idxToServicioKey[columnasDetectadas.TRS] = "TRS";
    if (columnasDetectadas.FON !== undefined && columnasDetectadas.FON !== -1) idxToServicioKey[columnasDetectadas.FON] = "FON";
    if (columnasDetectadas.TO !== undefined && columnasDetectadas.TO !== -1) idxToServicioKey[columnasDetectadas.TO] = "TO";
    if (columnasDetectadas.NUT !== undefined && columnasDetectadas.NUT !== -1) idxToServicioKey[columnasDetectadas.NUT] = "NUT";
    if (columnasDetectadas.TS !== undefined && columnasDetectadas.TS !== -1) idxToServicioKey[columnasDetectadas.TS] = "TS";
    if (columnasDetectadas.PSI !== undefined && columnasDetectadas.PSI !== -1) idxToServicioKey[columnasDetectadas.PSI] = "PSI";

    // Columnas base fijas que no deben ser omitidas por ser identificadores principales
    const colsFijasNoOmitibles = new Set([
        columnasDetectadas.TIPO_DOC,
        columnasDetectadas.DOCUMENTO,
        columnasDetectadas.NOMBRE,
        columnasDetectadas.PAQUETE,
        columnasDetectadas.FACTURAR_EVENTO,
    ]);

    for (let c = 0; c < maxCols; c++) {
        if (colsFijasNoOmitibles.has(c)) continue;

        const h1 = String(headerRow1[c] ?? "").trim();
        const h0 = String(headerRow0[c] ?? "").trim();
        const letra = obtenerLetraCol(c);
        const label = h1 || h0 || `Columna ${letra}`;

        // Determinar clave asociada
        let key = idxToServicioKey[c];
        if (!key) {
            if (c === 5 || normalizarEncabezado(label).includes("geriatria")) {
                key = "GERIATRIA";
            } else if (c === columnasDetectadas.CANT_PAQ_DIARIO) {
                key = "CANT_PAQ_DIARIO";
            } else if (c === columnasDetectadas.APL_1_DOSIS) {
                key = "APL_1";
            } else if (c === columnasDetectadas.APL_2_DOSIS) {
                key = "APL_2";
            } else if (c === columnasDetectadas.APL_3_DOSIS) {
                key = "APL_3";
            } else if (c === columnasDetectadas.APL_4_DOSIS) {
                key = "APL_4";
            } else {
                key = `COL_${letra}_${c}`;
            }
        }

        columnas.push({
            key,
            label,
            colIdx: c,
            letra,
            defaultOmitir: key === "GERIATRIA",
        });
    }

    return columnas;
}

/**
 * Procesa las filas crudas de la matriz a partir de la fila 3 (índice 2)
 * @param {Array<Array<any>>} rawRows 
 * @param {Set<string>|Array<string>} [columnasOmitidasSet] Claves o índices de columnas a omitir (ej: 'GERIATRIA', 'PSI', 'NUT')
 * @returns {Object} { pacientesPorDoc: Map, pacientesList: Array, diagnosticoGlobal: Object }
 */
export function parsearMatriz(rawRows, columnasOmitidasSet = null) {
    const omitidas = new Set(
        columnasOmitidasSet ? Array.from(columnasOmitidasSet).map(s => String(s).toUpperCase()) : ["GERIATRIA"]
    );
    const pacientesPorDoc = new Map();
    const pacientesPorDocYPaquete = new Map();
    const pacientesList = [];
    const erroresGlobales = [];

    if (!rawRows || rawRows.length < 3) {
        return {
            pacientesPorDoc,
            pacientesPorDocYPaquete,
            pacientesList,
            diagnosticoGlobal: {
                valida: false,
                totalFilas: rawRows ? rawRows.length : 0,
                totalPacientes: 0,
                errores: ["El archivo no contiene filas de datos (debe tener al menos encabezados y datos desde la fila 3)."],
                alertas: [],
                conteoPorPaquete: {},
            },
        };
    }

    const columnasDetectadas = detectarColumnasMatriz(rawRows);
    const conteoPorPaquete = {};

    for (let i = 2; i < rawRows.length; i++) {
        const fila = rawRows[i];
        if (!fila || fila.length === 0) continue;

        const filaExcel = i + 1;
        const tipoDoc = String(fila[columnasDetectadas.TIPO_DOC] || "").trim();
        const docRaw = fila[columnasDetectadas.DOCUMENTO];
        const documento = normalizarDocumentoMatriz(docRaw);
        const nombre = String(fila[columnasDetectadas.NOMBRE] || "").trim();
        const paqueteRaw = String(fila[columnasDetectadas.PAQUETE] || "").trim().toUpperCase();
        const facturarEventoRaw = String(fila[columnasDetectadas.FACTURAR_EVENTO] || "").trim().toUpperCase();

        // Si el número de documento está vacío, ignorar completamente la fila (no procesar ni validar)
        if (!documento) continue;

        const erroresFila = [];
        const alertasFila = [];

        // Determinar código de paquete normalizado (ej. CPF1102, CPF1108, E890190, E985111, etc.)
        let paquete = paqueteRaw;
        const matchPaq =
            paqueteRaw.match(/(CPF\s*\d+|CPF[A-Za-z0-9]+|E89\d+|E98\d+|EC89\d+|AD\d+)/i) ||
            paqueteRaw.match(/^([A-Za-z0-9]+)/);
        if (matchPaq) {
            paquete = matchPaq[1].replace(/\s+/g, "").toUpperCase();
        }

        // Validar paquete o facturar por evento
        const esFacturarEventoSi = facturarEventoRaw === "SI" || facturarEventoRaw === "SÍ" || facturarEventoRaw === "YES";
        const esFacturarEventoNo = facturarEventoRaw === "NO";

        if (paquete) {
            conteoPorPaquete[paquete] = (conteoPorPaquete[paquete] || 0) + 1;
        } else {
            // Si la fila no tiene nombre de paquete, se cataloga para validación por EVENTO (solo tag informativo por ahora)
            paquete = "EVENTO";
            conteoPorPaquete["EVENTO"] = (conteoPorPaquete["EVENTO"] || 0) + 1;
        }

        const esFilaSoloEvento = paquete === "EVENTO" || (!paqueteRaw && esFacturarEventoSi);

        // Parsear servicios
        const geriatria = parseCantidad(fila[5]); // Col F: Geriatría
        const vm = omitidas.has("VM") ? 0 : parseCantidad(fila[columnasDetectadas.VM]);
        const venf = omitidas.has("VENF") ? 0 : parseCantidad(fila[columnasDetectadas.ENF_PROF]); // Col H: Paq. Enfermería Profesional (VENF)
        const enf = omitidas.has("ENF") ? 0 : parseCantidad(fila[columnasDetectadas.ENF_AUX]);   // Col I: Paq. Aux Enfermeria (ENF)

        const tf = omitidas.has("TF") ? 0 : parseCantidad(fila[columnasDetectadas.TF]);
        const tr = omitidas.has("TR") ? 0 : parseCantidad(fila[columnasDetectadas.TR]);
        const trs = omitidas.has("TRS") ? 0 : parseCantidad(fila[columnasDetectadas.TRS]);
        const fon = omitidas.has("FON") ? 0 : parseCantidad(fila[columnasDetectadas.FON]);
        const to = omitidas.has("TO") ? 0 : parseCantidad(fila[columnasDetectadas.TO]);
        const nut = omitidas.has("NUT") ? 0 : parseCantidad(fila[columnasDetectadas.NUT]);
        const ts = omitidas.has("TS") ? 0 : parseCantidad(fila[columnasDetectadas.TS]);
        const psi = omitidas.has("PSI") ? 0 : parseCantidad(fila[columnasDetectadas.PSI]);

        // Parsear datos de paquete diario y aplicación de medicamento (APL)
        const cantPaqDiario = (omitidas.has("CANT_PAQ_DIARIO") || columnasDetectadas.CANT_PAQ_DIARIO === -1)
            ? 0
            : parseCantidad(fila[columnasDetectadas.CANT_PAQ_DIARIO]);
        const apl1 = (omitidas.has("APL_1") || columnasDetectadas.APL_1_DOSIS === -1) ? 0 : parseCantidad(fila[columnasDetectadas.APL_1_DOSIS]);
        const apl2 = (omitidas.has("APL_2") || columnasDetectadas.APL_2_DOSIS === -1) ? 0 : parseCantidad(fila[columnasDetectadas.APL_2_DOSIS]);
        const apl3 = (omitidas.has("APL_3") || columnasDetectadas.APL_3_DOSIS === -1) ? 0 : parseCantidad(fila[columnasDetectadas.APL_3_DOSIS]);
        const apl4 = (omitidas.has("APL_4") || columnasDetectadas.APL_4_DOSIS === -1) ? 0 : parseCantidad(fila[columnasDetectadas.APL_4_DOSIS]);

        // Parsear columnas de evento
        const evCols = columnasDetectadas.EVENTO_COLS || {};
        const serviciosEvento = {
            VM: evCols.VM !== -1 ? parseCantidad(fila[evCols.VM]) : 0,
            VMRJ: evCols.VMRJ !== -1 ? parseCantidad(fila[evCols.VMRJ]) : 0,
            VENF: evCols.VENF !== -1 ? parseCantidad(fila[evCols.VENF]) : 0,
            NUT: evCols.NUT !== -1 ? parseCantidad(fila[evCols.NUT]) : 0,
            FON: evCols.FON !== -1 ? parseCantidad(fila[evCols.FON]) : 0,
            TF: evCols.TF !== -1 ? parseCantidad(fila[evCols.TF]) : 0,
            TR: evCols.TR !== -1 ? parseCantidad(fila[evCols.TR]) : 0,
            TRS: evCols.TRS !== -1 ? parseCantidad(fila[evCols.TRS]) : 0,
            TO: evCols.TO !== -1 ? parseCantidad(fila[evCols.TO]) : 0,
            TS: evCols.TS !== -1 ? parseCantidad(fila[evCols.TS]) : 0,
            PSI: evCols.PSI !== -1 ? parseCantidad(fila[evCols.PSI]) : 0,
            ENF6: evCols.ENF6 !== -1 ? parseCantidad(fila[evCols.ENF6]) : 0,
            ENF8: evCols.ENF8 !== -1 ? parseCantidad(fila[evCols.ENF8]) : 0,
            ENF12: evCols.ENF12 !== -1 ? parseCantidad(fila[evCols.ENF12]) : 0,
            ENF12N: evCols.ENF12N !== -1 ? parseCantidad(fila[evCols.ENF12N]) : 0,
            ENF24: evCols.ENF24 !== -1 ? parseCantidad(fila[evCols.ENF24]) : 0,
            CUID6: evCols.CUID6 !== -1 ? parseCantidad(fila[evCols.CUID6]) : 0,
            CUID8: evCols.CUID8 !== -1 ? parseCantidad(fila[evCols.CUID8]) : 0,
            CUID12: evCols.CUID12 !== -1 ? parseCantidad(fila[evCols.CUID12]) : 0,
            CUID12N: evCols.CUID12N !== -1 ? parseCantidad(fila[evCols.CUID12N]) : 0,
            CUID24: evCols.CUID24 !== -1 ? parseCantidad(fila[evCols.CUID24]) : 0,
            MED1: evCols.MED1 !== -1 ? parseCantidad(fila[evCols.MED1]) : 0,
            MED2: evCols.MED2 !== -1 ? parseCantidad(fila[evCols.MED2]) : 0,
            MED3: evCols.MED3 !== -1 ? parseCantidad(fila[evCols.MED3]) : 0,
            MED4: evCols.MED4 !== -1 ? parseCantidad(fila[evCols.MED4]) : 0,
            ESP: evCols.ESP !== -1 ? parseCantidad(fila[evCols.ESP]) : 0,
        };

        // Capturar todas las celdas de la fila tal cual vienen en el Excel
        const headerRow1 = rawRows[1] || [];
        const headerRow0 = rawRows[0] || [];
        const maxCols = Math.max(fila.length, headerRow1.length, 17);
        const celdasFila = [];
        const obtenerLetraCol = (idx) => {
            let n = idx;
            let letra = "";
            while (n >= 0) {
                letra = String.fromCharCode((n % 26) + 65) + letra;
                n = Math.floor(n / 26) - 1;
            }
            return letra;
        };
        for (let c = 0; c < maxCols; c++) {
            const h1 = String(headerRow1[c] ?? "").trim();
            const h0 = String(headerRow0[c] ?? "").trim();
            const headerLabel = h1 || h0 || `Columna ${obtenerLetraCol(c)}`;
            const valRaw = fila[c] !== undefined && fila[c] !== null ? String(fila[c]).trim() : "";
            // Omitir columnas finales vacías sin encabezado en Fila 2
            if (!h1 && !valRaw && c >= 17) continue;
            celdasFila.push({
                col: obtenerLetraCol(c),
                header: headerLabel,
                valor: valRaw,
            });
        }

        let aplEsperado = 0;
        let dosisNombre = "";

        const paqueteCanonicoPre = normalizarCodigoPaquete(paquete);
        if (paqueteCanonicoPre === "CPF1102") {
            aplEsperado = apl1;
            dosisNombre = "1 Dosis";
        } else if (paqueteCanonicoPre === "CPF1103") {
            aplEsperado = apl2 > 0 ? apl2 : apl3;
            dosisNombre = apl2 > 0 ? "2 Dosis" : (apl3 > 0 ? "3 Dosis" : "2 o 3 Dosis");
        } else if (paqueteCanonicoPre === "CPF1104") {
            aplEsperado = apl4;
            dosisNombre = "4 Dosis";
        }

        const servicios = {
            VM: vm,
            VENF: venf,
            ENF: enf,
            APL: aplEsperado,
            TF: tf,
            TR: tr,
            TRS: trs,
            SUCCION: trs,
            FON: fon,
            TO: to,
            NUT: nut,
            TS: ts,
            PSI: psi,
        };

        // Suma de terapias (TF, TR, TRS, FON, TO)
        const totalTerapias = tf + tr + trs + fon + to;

        // Pre-validar según reglas de paquetes actuales
        const paqueteCanonico = normalizarCodigoPaquete(paquete);
        const esPaqueteParametrizado = PAQUETES_SOPORTADOS.includes(paquete) || Boolean(REGLAS_TERAPIAS_PAQUETES[paquete]);
        const esPaqueteMedicamento = CODIGOS_APLICACION.has(paquete) || ["CPF1102", "CPF1103", "CPF1104"].includes(paqueteCanonico);

        if (esFilaSoloEvento) {
            // En evento no se validan reglas de paquete
        } else if (paquete && paquete !== "EVENTO" && !esPaqueteParametrizado) {
            // Si el código de paquete no está parametrizado en el sistema, solo indicar ese error y no inventar ni exigir reglas por defecto
            erroresFila.push(`Paquete ${paquete}: Código de paquete no parametrizado en el sistema.`);
        } else if (esPaqueteMedicamento) {
            // Regla específica para paquetes de medicamentos (CPF1102-1104 / E890167-169):
            // Solo requiere 1 VM, 1 ENF y APL (según dosis y Cant Paquete Diario)
            if (vm < 1) {
                erroresFila.push(`VM: Requiere 1 (tiene ${vm})`);
            } else if (vm > 1) {
                alertasFila.push(`VM: Requiere 1 (tiene ${vm})`);
            }

            if (enf < 1) {
                erroresFila.push(`ENF: Requiere 1 (tiene ${enf})`);
            } else if (enf > 1) {
                alertasFila.push(`ENF: Requiere 1 (tiene ${enf})`);
            }

            // VENF no aplica en paquetes de aplicación de medicamentos (exige ENF)
            if (venf > 0) {
                erroresFila.push(`VENF: No aplica en este paquete (tiene ${venf}, requiere 0)`);
            }

            // Validar asignación de dosis correspondiente
            if (paqueteCanonico === "CPF1102") {
                if (apl1 <= 0) {
                    erroresFila.push(`${paquete}: Debe colocar la cantidad en 'Paq. Aplicación Medicamento 1 Dosis' (tiene 0)`);
                }
                if (apl2 > 0 || apl3 > 0 || apl4 > 0) {
                    erroresFila.push(`${paquete}: Solo debe marcar 1 Dosis (tiene valores en otras dosis: 2D:${apl2}, 3D:${apl3}, 4D:${apl4})`);
                }
            } else if (paqueteCanonico === "CPF1103") {
                const tieneDosisValida = (apl2 > 0 && apl3 === 0) || (apl3 > 0 && apl2 === 0);
                if (apl2 <= 0 && apl3 <= 0) {
                    erroresFila.push(`${paquete}: Debe colocar la cantidad en 'Paq. Aplicación Medicamento 2 Dosis' o '3 Dosis' (tiene 0)`);
                } else if (!tieneDosisValida) {
                    erroresFila.push(`${paquete}: Debe elegir solo una dosis entre 2 Dosis o 3 Dosis (tiene 2D:${apl2}, 3D:${apl3})`);
                }
                if (apl1 > 0 || apl4 > 0) {
                    erroresFila.push(`${paquete}: No debe marcar 1 Dosis ni 4 Dosis (tiene 1D:${apl1}, 4D:${apl4})`);
                }
            } else if (paqueteCanonico === "CPF1104") {
                if (apl4 <= 0) {
                    erroresFila.push(`${paquete}: Debe colocar la cantidad en 'Paq. Aplicación Medicamento 4 Dosis' (tiene 0)`);
                }
                if (apl1 > 0 || apl2 > 0 || apl3 > 0) {
                    erroresFila.push(`${paquete}: Solo debe marcar 4 Dosis (tiene valores en otras dosis: 1D:${apl1}, 2D:${apl2}, 3D:${apl3})`);
                }
            }

            // Prohibir servicios complementarios (PSI, NUT, TS) en paquetes de medicamento
            if (psi > 0 || nut > 0 || ts > 0) {
                const opcs = [];
                if (psi > 0) opcs.push(`PSI:${psi}`);
                if (nut > 0) opcs.push(`NUT:${nut}`);
                if (ts > 0) opcs.push(`TS:${ts}`);
                erroresFila.push(`${paquete}: No permite servicios opcionales (tiene ${opcs.join(", ")})`);
            }

            // Prohibir terapias en paquetes de medicamento
            if (totalTerapias > 0) {
                const ter = [];
                if (tf > 0) ter.push(`TF:${tf}`);
                if (tr > 0) ter.push(`TR:${tr}`);
                if (trs > 0) ter.push(`TRS:${trs}`);
                if (fon > 0) ter.push(`FON:${fon}`);
                if (to > 0) ter.push(`TO:${to}`);
                erroresFila.push(`${paquete}: No contempla terapias (tiene ${ter.join(", ")})`);
            }
        } else if (paquete && (paquete.startsWith("CPF") || PAQUETES_SOPORTADOS.includes(paquete))) {
            // Reglas generales para el resto de paquetes (FOMAG y Nueva EPS)
            // 0. Prohibir columnas de dosis de medicamentos (APL) si no es paquete de medicamentos
            if (apl1 > 0 || apl2 > 0 || apl3 > 0 || apl4 > 0) {
                erroresFila.push(`${paquete}: No contempla servicio de aplicación de medicamentos (APL)`);
            }

            // Validar 'Cant Paquete Diario':
            // En paquetes diarios (como CPF1225 o EC890290) es válido registrar días y NO va ligado a otra columna.
            // En paquetes mensuales no debe marcarse Cant Paquete Diario.
            const esPaqueteDiario = CODIGOS_DIARIOS.has(paquete) || paqueteCanonico === "CPF1225";
            if (!esPaqueteDiario && cantPaqDiario > 0) {
                erroresFila.push(`${paquete}: Es paquete mensual, no debe registrar 'Cant Paquete Diario' (tiene ${cantPaqDiario})`);
            }

            // 1. Validar Fijos Obligatorios de Médica (VM) y Enfermería (VENF / ENF)
            if (CODIGOS_PALIATIVOS.has(paquete) || paqueteCanonico === "CPF1107") {
                // Paliativo: Debe tener 2 VM y 4 ENF
                if (vm < 2) {
                    erroresFila.push(`VM: Requiere 2 (tiene ${vm})`);
                } else if (vm > 2) {
                    alertasFila.push(`VM: Requiere 2 (tiene ${vm})`);
                }

                if (enf < 4) {
                    erroresFila.push(`ENF: Requiere 4 (tiene ${enf})`);
                } else if (enf > 4) {
                    alertasFila.push(`ENF: Requiere 4 (tiene ${enf})`);
                }

                if (venf > 0) {
                    alertasFila.push(`VENF: Requiere 0 (tiene ${venf})`);
                }
            } else if (esPaqueteDiario) {
                // Ventilación Mecánica: Debe tener 2 VM
                if (vm < 2) {
                    erroresFila.push(`VM: Requiere 2 (tiene ${vm})`);
                } else if (vm > 2) {
                    alertasFila.push(`VM: Requiere 2 (tiene ${vm})`);
                }

                if (venf === 0 && enf === 0) {
                    erroresFila.push(`VENF o ENF: Requiere al menos 1 servicio`);
                } else {
                    if (venf > 1) {
                        alertasFila.push(`VENF: Requiere 1 si aplica (tiene ${venf})`);
                    }
                    if (enf > 1) {
                        alertasFila.push(`ENF: Requiere 1 si aplica (tiene ${enf})`);
                    }
                }
            } else {
                // Resto de paquetes estándar (1 VM, y al menos 1 VENF o ENF)
                if (vm < 1) {
                    erroresFila.push(`VM: Requiere 1 (tiene ${vm})`);
                } else if (vm > 1) {
                    alertasFila.push(`VM: Requiere 1 (tiene ${vm})`);
                }

                if (venf === 0 && enf === 0) {
                    erroresFila.push(`VENF o ENF: Requiere al menos 1 servicio`);
                } else {
                    if (venf > 1) {
                        alertasFila.push(`VENF: Requiere 1 si aplica (tiene ${venf})`);
                    }
                    if (enf > 1) {
                        alertasFila.push(`ENF: Requiere 1 si aplica (tiene ${enf})`);
                    }
                }
            }

            // 2. Validar A Elección: exactamente 1 entre (PSI, NUT, TS) con cantidad 1
            const opcionalesConValor = [];
            if (psi > 0) opcionalesConValor.push({ serv: "PSI", cant: psi });
            if (nut > 0) opcionalesConValor.push({ serv: "NUT", cant: nut });
            if (ts > 0) opcionalesConValor.push({ serv: "TS", cant: ts });

            if (opcionalesConValor.length === 0) {
                erroresFila.push(`Opcional: Falta elegir 1 (PSI, NUT o TS)`);
            } else if (opcionalesConValor.length > 1) {
                const lista = opcionalesConValor.map(o => `${o.serv}:${o.cant}`).join(", ");
                alertasFila.push(`Opcional: Solo 1 permitido (tiene varios: ${lista})`);
            } else {
                const unico = opcionalesConValor[0];
                if (unico.cant > 1) {
                    alertasFila.push(`${unico.serv}: requiere 1 (tiene ${unico.cant})`);
                }
            }

            // 3. Validar Terapias según reglas específicas del paquete
            const regla = REGLAS_TERAPIAS_PAQUETES[paquete];

            // 3.1 Paquetes que NO contemplan terapias (ej: CPF1108, CPF1111, CPF1112, CPF1113)
            if (regla && regla.permiteTerapias === false) {
                if (totalTerapias > 0) {
                    const ter = [];
                    if (tf > 0) ter.push(`TF:${tf}`);
                    if (tr > 0) ter.push(`TR:${tr}`);
                    if (trs > 0) ter.push(`TRS:${trs}`);
                    if (fon > 0) ter.push(`FON:${fon}`);
                    if (to > 0) ter.push(`TO:${to}`);
                    erroresFila.push(`${paquete}: No contempla terapias y registra ${totalTerapias} (${ter.join(", ")})`);
                }
            } 
            // 3.2 Paquetes con restricción de terapias específicas (ej: CPF1107: solo TF, TR, TRS)
            else if (regla && regla.terapiasPermitidas && Array.isArray(regla.terapiasPermitidas)) {
                const noPermitidas = [];
                if (fon > 0 && !regla.terapiasPermitidas.includes("FON")) noPermitidas.push(`FON:${fon}`);
                if (to > 0 && !regla.terapiasPermitidas.includes("TO")) noPermitidas.push(`TO:${to}`);
                if (tf > 0 && !regla.terapiasPermitidas.includes("TF")) noPermitidas.push(`TF:${tf}`);
                if (tr > 0 && !regla.terapiasPermitidas.includes("TR")) noPermitidas.push(`TR:${tr}`);
                if (trs > 0 && !regla.terapiasPermitidas.includes("TRS")) noPermitidas.push(`TRS:${trs}`);

                if (noPermitidas.length > 0) {
                    erroresFila.push(`${paquete}: Solo permite ${regla.terapiasPermitidas.join(", ")}. No admite: ${noPermitidas.join(", ")}`);
                }
            } 
            // 3.3 Paquetes con rangos obligatorios de terapias (ej: CPF1105, CPF1106, CPF1109, CPF1110)
            else if (regla && regla.permiteTerapias && (regla.min > 0 || (regla.max > 0 && regla.max < 999))) {
                if (totalTerapias < regla.min || totalTerapias > regla.max) {
                    const terapiasActivas = [];
                    if (tf > 0) terapiasActivas.push(`${tf} TF`);
                    if (tr > 0) terapiasActivas.push(`${tr} TR`);
                    if (trs > 0) terapiasActivas.push(`${trs} TRS`);
                    if (fon > 0) terapiasActivas.push(`${fon} FON`);
                    if (to > 0) terapiasActivas.push(`${to} TO`);

                    const detalleStr = terapiasActivas.length > 0
                        ? ` (${terapiasActivas.join(", ")})`
                        : " (0 asignadas)";

                    const msgTerapias = `Terapias: Requiere ${regla.min}-${regla.max} sumadas (tiene ${totalTerapias}${detalleStr})`;
                    if (totalTerapias < regla.min) {
                        erroresFila.push(msgTerapias);
                    } else {
                        alertasFila.push(msgTerapias);
                    }
                }
            }
        }

        const pacienteObj = {
            filaExcel,
            tipoDoc,
            documento,
            nombre,
            paqueteRaw,
            paquete,
            facturarEventoRaw,
            esFacturarEvento: esFacturarEventoSi,
            geriatria,
            cantPaqDiario,
            aplDosis: {
                dosis1: apl1,
                dosis2: apl2,
                dosis3: apl3,
                dosis4: apl4,
                esperado: aplEsperado,
                nombre: dosisNombre,
            },
            servicios,
            serviciosEvento,
            totalTerapias,
            celdasFila,
            errores: erroresFila,
            alertas: alertasFila,
            valido: erroresFila.length === 0,
        };

        if (documento) {
            const claveDocPaq = `${documento}_${paquete || (esFacturarEventoSi ? "EVENTO" : "SIN_PAQUETE")}`;
            if (!pacientesPorDocYPaquete.has(claveDocPaq)) {
                pacientesPorDocYPaquete.set(claveDocPaq, pacienteObj);
            } else {
                const previo = pacientesPorDocYPaquete.get(claveDocPaq);
                pacienteObj.errores.push(
                    `Fila duplicada para el mismo documento y paquete (ya presente en Fila ${previo.filaExcel}).`
                );
                pacienteObj.valido = false;
            }

            if (!pacientesPorDoc.has(documento)) {
                pacientesPorDoc.set(documento, pacienteObj);
            }
        }

        pacientesList.push(pacienteObj);
    }

    const totalConErrores = pacientesList.filter((p) => !p.valido).length;
    const totalConAlertas = pacientesList.filter((p) => p.valido && p.alertas && p.alertas.length > 0).length;

    return {
        pacientesPorDoc,
        pacientesPorDocYPaquete,
        pacientesList,
        columnasOmitidas: Array.from(omitidas),
        diagnosticoGlobal: {
            valida: totalConErrores === 0 && pacientesList.length > 0,
            totalFilas: rawRows.length,
            totalPacientes: pacientesList.length,
            pacientesConErrores: totalConErrores,
            pacientesConAlertas: totalConAlertas,
            errores: erroresGlobales,
            conteoPorPaquete,
        },
    };
}

/**
 * Busca un paciente en los datos procesados de la matriz por documento y opcionalmente por paquete.
 * @param {Object} datosMatriz Objeto devuelto por parsearMatriz
 * @param {string} documento Número o clave de documento
 * @param {string} [paquete] Código de paquete (ej. CPF1105)
 * @returns {Object|null}
 */
export function buscarPacienteEnMatriz(datosMatriz, documento, paquete) {
    if (!datosMatriz || !documento) return null;
    const docNorm = normalizarDocumentoMatriz(documento);
    if (!docNorm) return null;

    const tienePaqueteEspecifico = paquete && paquete !== "auto" && paquete !== "SIN_PAQUETE" && paquete !== "EVENTO";

    // 1. Si se especificó un paquete concreto (y no EVENTO), buscar coincidencia exacta doc + paquete
    if (tienePaqueteEspecifico && datosMatriz.pacientesPorDocYPaquete) {
        const paqNorm = String(paquete).trim().toUpperCase();
        const paqCanonico = normalizarCodigoPaquete(paqNorm);
        const clave = `${docNorm}_${paqNorm}`;
        if (datosMatriz.pacientesPorDocYPaquete.has(clave)) {
            return datosMatriz.pacientesPorDocYPaquete.get(clave);
        }

        // Búsqueda flexible por dígitos pero manteniendo el paquete estricto (o su código equivalente)
        if (datosMatriz.pacientesList) {
            const docSoloDigitos = docNorm.replace(/\D/g, "");
            if (docSoloDigitos) {
                const matchConPaq = datosMatriz.pacientesList.find(
                    (p) =>
                        p.documento &&
                        p.documento.replace(/\D/g, "") === docSoloDigitos &&
                        (p.paquete === paqNorm || normalizarCodigoPaquete(p.paquete) === paqCanonico)
                );
                if (matchConPaq) return matchConPaq;
            }
        }

        // Si se especificó un paquete y no coincide con ninguno en la matriz para ese paquete, retornar null (no mezclar con otro paquete)
        return null;
    }

    // 2. Si es EVENTO o no se especificó paquete (o es "auto"), buscar por documento
    if (paquete === "EVENTO" && datosMatriz.pacientesList) {
        const docSoloDigitos = docNorm.replace(/\D/g, "");
        // Priorizar la fila que tenga servicios de evento o Facturar por evento = SI
        const matchEvento = datosMatriz.pacientesList.find(
            (p) =>
                p.documento &&
                (p.documento === docNorm || (docSoloDigitos && p.documento.replace(/\D/g, "") === docSoloDigitos)) &&
                (p.esFacturarEvento || Object.values(p.serviciosEvento || {}).some((v) => v > 0))
        );
        if (matchEvento) return matchEvento;
    }

    // 2. Si no se especificó paquete (o es "auto"), buscar por documento
    if (datosMatriz.pacientesPorDoc && datosMatriz.pacientesPorDoc.has(docNorm)) {
        return datosMatriz.pacientesPorDoc.get(docNorm);
    }

    // 3. Búsqueda flexible por subcadena de documento en la lista
    if (datosMatriz.pacientesList) {
        const docSoloDigitos = docNorm.replace(/\D/g, "");
        if (docSoloDigitos) {
            const match = datosMatriz.pacientesList.find(
                (p) => p.documento && p.documento.replace(/\D/g, "") === docSoloDigitos
            );
            if (match) return match;
        }
    }

    return null;
}
