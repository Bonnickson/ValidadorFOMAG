// Utilidades para procesamiento de texto

/**
 * Escapa caracteres especiales de RegExp
 */
export function escapeRegExp(string) {
    return string.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/**
 * Normaliza texto para búsqueda:
 * - Remueve diacríticos / tildes
 * - Reemplaza toda variedad de guiones (en-dash –, em-dash —, minus −, hyphen -) y signos por espacios
 * - Convierte a mayúsculas
 * - Colapsa múltiples espacios
 */
export function normalizeForSearch(s) {
    if (!s) return "";
    return String(s)
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .replace(/[\u2010-\u2015\u2212\uFE58\uFE63\uFF0D\-_:.,;–—]/g, " ")
        .toUpperCase()
        // Corregir codificaciones alteradas / mojibake comunes en PDFs clínicos
        .replace(/EVOLUCI[UÚÙÛ]N/g, "EVOLUCION")
        .replace(/M[EÈÉÊ]DICA/g, "MEDICA")
        .replace(/HISTORIA\s+CL[IÌÍÎ]NICA/g, "HISTORIA CLINICA")
        .replace(/PSICOLOG[IÌÍÎ]A/g, "PSICOLOGIA")
        .replace(/ENFERMER[IÌÍÎ]A/g, "ENFERMERIA")
        .replace(/NUTRICI[UÚÙÛ]N/g, "NUTRICION")
        .replace(/FONOAUDIOLOG[IÌÍÎ]A/g, "FONOAUDIOLOGIA")
        .replace(/F[IÌÍÎ]SICA/g, "FISICA")
        .replace(/ATENCI[UÚÙÛ]N/g, "ATENCION")
        .replace(/CURACI[UÚÙÛ]N/g, "CURACION")
        .replace(/\s+/g, " ")
        .trim();
}

/**
 * Formatea una fecha del formato YYYY-MM-DD
 */
export function formatearFecha(fecha) {
    const m = fecha.match(/(\d{4})-?(\d{2})-?(\d{2})/);
    if (m) return `${m[1]}-${m[2]}-${m[3]}`;
    return fecha;
}

/**
 * Formatea una fecha al formato compacto MM/DD
 */
export function formatearFechaCompacta(fecha) {
    const m = fecha.match(/(\d{4})-?(\d{2})-?(\d{2})/);
    if (m) return `${m[2]}/${m[3]}`;
    return fecha;
}

/**
 * Extrae el número que aparece inmediatamente después de un texto
 * Ejemplo: "atención domiciliaria por enfermería 8" => 8
 */
export function extraerNumeroDelTexto(texto, buscar) {
    const textoNorm = normalizeForSearch(texto);
    const buscarNorm = normalizeForSearch(buscar);

    // Buscar el texto y capturar el número que le sigue
    const regex = new RegExp(escapeRegExp(buscarNorm) + "\\s*(\\d+)", "i");
    const match = textoNorm.match(regex);

    return match ? parseInt(match[1]) : null;
}

/**
 * Extrae la cantidad autorizada desde un documento de soporte (archivo 2.pdf / 2 servicio.pdf)
 * Soporta formato FOMAG y formato tabla Nueva EPS (Código | Cantidad | Descripción Servicio).
 *
 * @param {string} texto - Texto completo extraído del PDF
 * @param {string|string[]} [textoEncontrado] - Texto o lista de textos del servicio a contrastar
 * @param {string} [servicio] - Sigla del servicio (VM, TF, ENF, etc.)
 * @param {string} [convenio] - Convenio ("nueva-eps", "fomag", etc.)
 * @returns {number|null} Cantidad autorizada detectada o null
 */
export function extraerCantidadAutorizacion(texto, textoEncontrado = "", servicio = "", convenio = "") {
    if (!texto) return null;
    const textoNorm = normalizeForSearch(texto);
    const textosBuscar = Array.isArray(textoEncontrado)
        ? textoEncontrado
        : (textoEncontrado ? [textoEncontrado] : []);

    // 1. Si tenemos textos buscados del servicio (ej: "ATENCION (VISITA) DOMICILIARIA, POR MEDICINA GENERAL" o "MEDICINA GENERAL"):
    for (const target of textosBuscar) {
        if (!target) continue;
        const targetNorm = normalizeForSearch(target);

        // A) Número ANTES de la descripción (formato tabla Nueva EPS: "890101 1 ATENCION..." o "1 ATENCION...")
        // Permite código CUPS (ej. 890101 o E890146) y prefijo opcional "ATENCION (VISITA) DOMICILIARIA POR"
        const regexAntes = new RegExp(
            `(?:\\b[A-Z]{0,2}\\d{5,7}\\s+)?\\b(\\d{1,3})\\s+(?:ATENCION(?:\\s+\\(?VISITA\\)?)?\\s+DOMICILIARIA\\s+(?:POR\\s+)?)?${escapeRegExp(targetNorm)}`,
            "i"
        );
        const matchAntes = textoNorm.match(regexAntes);
        if (matchAntes) {
            const val = parseInt(matchAntes[1], 10);
            if (val > 0) return val;
        }

        // B) Número DESPUÉS de la descripción (formato FOMAG: "ATENCION... 1")
        const regexDespues = new RegExp(`${escapeRegExp(targetNorm)}\\s+(\\d{1,3})\\b`, "i");
        const matchDespues = textoNorm.match(regexDespues);
        if (matchDespues) {
            const val = parseInt(matchDespues[1], 10);
            if (val > 0) return val;
        }
    }

    // 2. Búsqueda contextual alrededor de la columna o palabra "CANTIDAD" (autorizaciones Nueva EPS)
    const idxCantidad = textoNorm.indexOf("CANTIDAD");
    if (idxCantidad !== -1) {
        const ventana = textoNorm.substring(idxCantidad, idxCantidad + 350);

        // Caso fila con código CUPS (ej: 890101 o E890146) seguido de cantidad en la tabla:
        const matchCups = ventana.match(/\b[A-Z]{0,2}\d{5,7}\s+(\d{1,3})\b/i);
        if (matchCups) {
            const val = parseInt(matchCups[1], 10);
            if (val > 0) return val;
        }

        // Caso directo: "CANTIDAD: 1", "CANTIDAD 1", "CANTIDAD - 1"
        const matchDirecto = ventana.match(/CANTIDAD\s*[:.\-]?\s*(\d{1,3})\b/i);
        if (matchDirecto) {
            const val = parseInt(matchDirecto[1], 10);
            if (val > 0) return val;
        }

        // Caso donde la cantidad aparece inmediatamente antes de una palabra de servicio clínico:
        const matchServicioSalud = ventana.match(/\b(\d{1,3})\s+(?:ATENCION|VISITA|VALORACION|MEDICINA|FISIOTERAPIA|TERAPIA|ENFERMERIA|CURACION|PSICOLOGIA|TRABAJO|FONOAUDIOLOGIA|NUTRICION|AUXILIAR)\b/i);
        if (matchServicioSalud) {
            const val = parseInt(matchServicioSalud[1], 10);
            if (val > 0) return val;
        }

        // Caso lectura de columnas: tokens numéricos tras CANTIDAD antes de secciones posteriores
        const tokens = ventana.replace(/CANTIDAD/gi, "").trim().split(/\s+/);
        for (const token of tokens) {
            if (/^\d{1,3}$/.test(token)) {
                const val = parseInt(token, 10);
                if (val > 0) return val;
            }
            if (/^(?:AFILIADO|FIRMA|TOTAL|DIRECCION|TELEFONO|FECHA|COPAGO|MODERADOR)$/i.test(token)) {
                break;
            }
        }
    }

    // 3. Fallback: extraerNumeroDelTexto estándar si se proveyeron textos
    if (textosBuscar.length > 0) {
        for (const target of textosBuscar) {
            const num = extraerNumeroDelTexto(texto, target);
            if (num !== null && num > 0) return num;
        }
    }

    return null;
}

/**
 * Reemplaza menciones de archivos PDF (ej: 5 enf.pdf, 2 vm.pdf, 4.pdf)
 * por una versión visual estilizada con icono en vez de la extensión .pdf
 */
export function formatearErrorConIconosPDF(texto) {
    if (!texto) return "";
    return texto.replace(
        /\b([1-5](?:\s+[a-zA-Z0-9]+)?)\.pdf\b/gi,
        (match, nombreBase) => {
            const fileName = `${nombreBase}.pdf`;
            return `<button type="button" class="pdf-file-badge pdf-file-badge-clickable" onclick="window.abrirPDFModalPorNombre && window.abrirPDFModalPorNombre(event, '${fileName}', this); return false;" title="Clic para abrir y revisar ${fileName}"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="pdf-file-badge-icon"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path><polyline points="14 2 14 8 20 8"></polyline></svg>${nombreBase}</button>`;
        }
    );
}

const NOMBRES_MESES = [
    "Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio",
    "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre"
];

/**
 * Extrae el año y mes (YYYY-MM) de una fecha
 */
export function extraerAnioMes(fechaStr) {
    if (!fechaStr) return null;
    const m = String(fechaStr).match(/(\d{4})-?(\d{2})/);
    return m ? `${m[1]}-${m[2]}` : null;
}

/**
 * Valida si una fecha se encuentra dentro del rango de periodos (YYYY-MM)
 */
export function estaFechaEnPeriodo(fechaStr, periodoDesde, periodoHasta) {
    if (!periodoDesde && !periodoHasta) return true;
    const anioMes = extraerAnioMes(fechaStr);
    if (!anioMes) return true;
    if (periodoDesde && anioMes < periodoDesde) return false;
    if (periodoHasta && anioMes > periodoHasta) return false;
    return true;
}

const NOMBRES_MESES_CORTOS = [
    "Ene", "Feb", "Mar", "Abr", "May", "Jun",
    "Jul", "Ago", "Sep", "Oct", "Nov", "Dic"
];

/**
 * Formatea un rango de periodos YYYY-MM en un texto legible en español
 * Ejemplo: ("2026-06", "2026-06") => "Junio 2026"
 * Ejemplo: ("2026-05", "2026-07") => "Mayo 2026 a Julio 2026"
 */
export function formatearPeriodoLegible(desde, hasta, corto = false) {
    const listaMeses = corto ? NOMBRES_MESES_CORTOS : NOMBRES_MESES;
    const fmt = (ym) => {
        if (!ym) return "";
        const parts = ym.split("-");
        const idx = parseInt(parts[1], 10) - 1;
        return `${listaMeses[idx] || parts[1]} ${parts[0]}`;
    };
    if (!desde && !hasta) return "Todos los periodos";
    if (desde && hasta && desde === hasta) return fmt(desde);
    if (desde && hasta) return `${fmt(desde)} a ${fmt(hasta)}`;
    if (desde) return `Desde ${fmt(desde)}`;
    return `Hasta ${fmt(hasta)}`;
}

/**
 * Intenta inferir el periodo (YYYY-MM) a partir de un texto o nombre de archivo
 */
export function sugerirPeriodoDeTexto(texto) {
    if (!texto) return null;
    const t = texto.toLowerCase();
    const meses = [
        ["enero", "01"], ["febrero", "02"], ["marzo", "03"], ["abril", "04"],
        ["mayo", "05"], ["junio", "06"], ["julio", "07"], ["agosto", "08"],
        ["septiembre", "09"], ["octubre", "10"], ["noviembre", "11"], ["diciembre", "12"]
    ];
    const anioMatch = t.match(/202\d|203\d/);
    const anio = anioMatch ? anioMatch[0] : new Date().getFullYear().toString();
    for (const [nombre, num] of meses) {
        if (t.includes(nombre)) {
            return `${anio}-${num}`;
        }
    }
    return null;
}
