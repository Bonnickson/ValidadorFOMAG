// Configuración y constantes del validador

export const DEBUG = true;

export const ALLOWED_TYPES = [
    "VM",
    "ENF",
    "ENF12",
    "TF",
    "TR",
    "SUCCION",
    "TRS",
    "TO",
    "TS",
    "PSI",
    "FON",
    "NUT",
    "VENF",
];

export const SERVICIOS_TERAPIA = ["TF", "TR", "SUCCION", "TO", "FON"];

export const TERAPIAS_CONTABLES = new Set(["TF", "TR", "FON", "TO", "TRS"]);

export const PAQUETES_SOPORTADOS = [
    "CPF1105",
    "CPF1106",
    "CPF1108",
    "CPF1109",
    "CPF1110",
];

export const PAQUETES_INFO = {
    CPF1108: { nombre: "CPF1108 - Crónico Estándar", descripcion: "Crónico Estándar" },
    CPF1109: { nombre: "CPF1109 - Crónico con Terapias", descripcion: "Crónico con Terapias" },
    CPF1110: { nombre: "CPF1110 - Paquete Intermedio", descripcion: "Paquete Intermedio" },
    CPF1105: { nombre: "CPF1105 - Neurológico Agudo", descripcion: "Neurológico Agudo" },
    CPF1106: { nombre: "CPF1106 - Traqueostomía Domiciliaria", descripcion: "Traqueostomía Domiciliaria" },
};

export const REGLAS_TERAPIAS_PAQUETES = {
    CPF1109: { min: 6, max: 12, descripcion: "Entre 6 y 12 evoluciones sumadas en total." },
    CPF1110: { min: 12, max: 20, descripcion: "Entre 12 y 20 evoluciones sumadas en total." },
    CPF1105: { min: 12, max: 30, descripcion: "Entre 12 y 30 evoluciones sumadas en total." },
    CPF1106: { min: 12, max: 30, descripcion: "Entre 12 y 30 evoluciones sumadas en total." },
    CPF1108: { min: 0, max: 0, descripcion: "Sin requisitos específicos de cantidad." },
    auto: { min: 0, max: 0, descripcion: "Detección automática por carpeta para cada paciente." },
};

export const ORDEN_SERVICIOS_CLINICOS = [
    "General",
    "VM",
    "ENF",
    "ENF12",
    "NUT",
    "TR",
    "TF",
    "SUCCION",
    "TRS",
    "FON",
    "PSI",
    "TS",
    "TO",
];

export const TEXTOS_SERVICIOS_FOMAG = {
    TF: "ATENCION (VISITA) DOMICILIARIA, POR FISIOTERAPIA",
    TR: "ATENCION (VISITA) DOMICILIARIA, POR TERAPIA RESPIRATORIA",
    SUCCION: "TERAPIA SUCCION",
    TRS: "Terapia respiratoria Succion",
    FON: "ATENCION (VISITA) DOMICILIARIA, POR FONIATRIA Y FONOAUDIOLOGIA",
    VM: "ATENCION (VISITA) DOMICILIARIA, POR MEDICINA GENERAL",
    ENF: "ATENCION (VISITA) DOMICILIARIA, POR ENFERMERIA",
    ENF12: "ATENCION (VISITA) DOMICILIARIA, POR ENFERMERIA",
    PSI: "ATENCION (VISITA) DOMICILIARIA, POR PSICOLOGIA",
    TS: "ATENCION (VISITA) DOMICILIARIA, POR TRABAJO SOCIAL",
    TO: "ATENCION (VISITA) DOMICILIARIA, POR TERAPIA OCUPACIONAL",
    NUT: "ATENCION (VISITA) DOMICILIARIA, POR NUTRICION Y DIETETICA",
    VENF: "ATENCION (VISITA) DOMICILIARIA, POR ENFERMERIA",
};

/**
 * Obtiene el texto estándar a buscar para un servicio en FOMAG
 */
export function obtenerTextoServicioFomag(servicio) {
    if (!servicio) return null;
    return TEXTOS_SERVICIOS_FOMAG[servicio] || null;
}

export const IGNORAR_ARCHIVOS = new Set(["desktop.ini", "thumbs.db", ".ds_store"]);

export const REGEX_SERVICIO_ARCHIVO =
    /^[2-5]\s+(vm|enf12|enf|venf|tf|tr|succion|suc|trs|ts|psi|to|fon|nut)\.pdf$/i;

/**
 * Obtiene el icono, tipo y estado de reconocimiento de un archivo de soporte
 */
export function obtenerInfoSoporte(nombreArchivo) {
    if (!nombreArchivo) return { icono: "❌", tipo: "Archivo no reconocido", reconocido: false };
    const nombre = nombreArchivo.trim().toLowerCase();

    // 2 PAQ / 2 paq.pdf
    if (/^2\s+paq\.pdf$/i.test(nombre)) {
        return { icono: "📦", tipo: "Autorización Paquete (2 PAQ)", reconocido: true };
    }

    // Archivos numéricos clásicos sin servicio
    if (/^2\.pdf$/i.test(nombre)) return { icono: "📄", tipo: "Autorización / Factura (2.pdf)", reconocido: true };
    if (/^3\.pdf$/i.test(nombre)) return { icono: "📋", tipo: "Epicrisis (3.pdf)", reconocido: true };
    if (/^4\.pdf$/i.test(nombre)) return { icono: "✍️", tipo: "Planilla de Firmas (4.pdf)", reconocido: true };
    if (/^5\.pdf$/i.test(nombre)) return { icono: "📑", tipo: "Evolución Clínica (5.pdf)", reconocido: true };

    // Archivos con servicio: [2-5] [servicio].pdf
    const match = nombre.match(/^([2-5])\s+(vm|enf12|enf|venf|tf|tr|succion|suc|trs|ts|psi|to|fon|nut)\.pdf$/i);
    if (match) {
        const num = match[1];
        let s = match[2].toUpperCase();
        if (s === "SUC") s = "SUCCION";

        if (num === "2") return { icono: "📄", tipo: `Autorización ${s}`, reconocido: true };
        if (num === "3") return { icono: "📋", tipo: `Epicrisis ${s}`, reconocido: true };
        if (num === "4") return { icono: "✍️", tipo: `Firmas ${s}`, reconocido: true };

        // num === "5"
        const iconosServicios = {
            VM: "🩺",
            VENF: "🩺",
            ENF: "💉",
            ENF12: "💉",
            TF: "🏃",
            TR: "🫁",
            TRS: "🫁",
            SUCCION: "🌬️",
            TO: "🧘",
            TS: "👥",
            PSI: "🧠",
            FON: "🗣️",
            NUT: "🥗",
        };
        const icono = iconosServicios[s] || "📑";
        return { icono, tipo: `Evolución ${s}`, reconocido: true };
    }

    return { icono: "❌", tipo: "Soporte no reconocido", reconocido: false };
}

export const SERVICIOS_NOMBRES = {
    General: "📦 Paquete",
    VM: "🩺 Valoración Médica",
    ENF: "💉 Enfermería",
    ENF12: "💉 Enfermería 12h",
    TF: "🏃 Terapia Física",
    TR: "🫁 Terapia Respiratoria",
    SUCCION: "🌬️ Succión",
    TRS: "🫁 Terapia Respiratoria Succión",
    TO: "🧘 Terapia Ocupacional",
    TS: "👥 Trabajo Social",
    PSI: "🧠 Psicología",
    FON: "🗣️ Fonoaudiología",
    NUT: "🥗 Nutrición",
    VENF: "🩺 Visita Enfermería (Aux)",
};

export const PDF_WORKER_URL =
    "https://cdnjs.cloudflare.com/ajax/libs/pdf.js/4.0.379/pdf.worker.min.mjs";

export const PDF_LIB_URL =
    "https://cdnjs.cloudflare.com/ajax/libs/pdf.js/4.0.379/pdf.min.mjs";

