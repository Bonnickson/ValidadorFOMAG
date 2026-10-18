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
    return s
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .replace(/[\u2010-\u2015\u2212\uFE58\uFE63\uFF0D\-_:.,;–—]/g, " ")
        .toUpperCase()
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
