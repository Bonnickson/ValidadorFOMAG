// Configuración y constantes del validador

export const DEBUG = true;

export const ALLOWED_TYPES = [
    "VM",
    "ENF",
    "ENF12",
    "CH",
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
    "CPF1102",
    "CPF1103",
    "CPF1104",
    "CPF1105",
    "CPF1106",
    "CPF1107",
    "CPF1108",
    "CPF1109",
    "CPF1110",
    "CPF1111",
    "CPF1112",
    "CPF1113",
    "CPF1225",
];

export const PAQUETES_INFO = {
    CPF1102: {
        nombre: "CPF1102 - Atencion Integral De Paciente Agudo Baja Complejidad Programa Extension Hospitalaria (Por Dia)",
        descripcion: "Atencion Integral De Paciente Agudo Baja Complejidad Programa Extension Hospitalaria (Por Dia)",
    },
    CPF1103: {
        nombre: "CPF1103 - Atencion Integral De Paciente Agudo Mediana Complejidad Programa Extension Hospitalaria (Por Dia)",
        descripcion: "Atencion Integral De Paciente Agudo Mediana Complejidad Programa Extension Hospitalaria (Por Dia)",
    },
    CPF1104: {
        nombre: "CPF1104 - Atencion Integral De Paciente Agudo Alta Complejidad Programa Extension Hospitalaria (Por Dia)",
        descripcion: "Atencion Integral De Paciente Agudo Alta Complejidad Programa Extension Hospitalaria (Por Dia)",
    },
    CPF1105: {
        nombre: "CPF1105 - Paquete De Rehabilitacion Mensual Domiciliario (Paciente Neurologico Agudo)",
        descripcion: "Paquete De Rehabilitacion Mensual Domiciliario (Paciente Neurologico Agudo)",
    },
    CPF1106: {
        nombre: "CPF1106 - Paquete De Traqueostomia Mensual Domiciliario",
        descripcion: "Paquete De Traqueostomia Mensual Domiciliario",
    },
    CPF1107: {
        nombre: "CPF1107 - Paquete De Atención Domiciliaria Cronico Paliativo (Mensual)(13076)",
        descripcion: "Paquete De Atención Domiciliaria Cronico Paliativo (Mensual)(13076)",
    },
    CPF1108: {
        nombre: "CPF1108 - Paquete De Atencion Domiciliaria Paciente Cronico (Mensual)",
        descripcion: "Paquete De Atencion Domiciliaria Paciente Cronico (Mensual)",
    },
    CPF1109: {
        nombre: "CPF1109 - Paquete De Atencion Domiciliario A Paciente Cronico Con Terapias (Mensual)",
        descripcion: "Paquete De Atencion Domiciliario A Paciente Cronico Con Terapias (Mensual)",
    },
    CPF1110: {
        nombre: "CPF1110 - Paquete De Atencion Domiciliaria Paciente Cronico (Mensual) (13073)",
        descripcion: "Paquete De Atencion Domiciliaria Paciente Cronico (Mensual) (13073)",
    },
    CPF1111: {
        nombre: "CPF1111 - Atencion Integral Heridas De Alta Complejidad Mensual Domiciliaria",
        descripcion: "Atencion Integral Heridas De Alta Complejidad Mensual Domiciliaria",
    },
    CPF1112: {
        nombre: "CPF1112 - Atencion Integral Heridas De Mediana Complejidad Mensual Domiciliaria",
        descripcion: "Atencion Integral Heridas De Mediana Complejidad Mensual Domiciliaria",
    },
    CPF1113: {
        nombre: "CPF1113 - Atencion Integral Heridas De Baja Complejidad Mensual Domiciliaria",
        descripcion: "Atencion Integral Heridas De Baja Complejidad Mensual Domiciliaria",
    },
    CPF1225: {
        nombre: "CPF1225 - Paquete Diario de Ventilacion Mecanica Paciente Cronico",
        descripcion: "Paquete Diario de Ventilacion Mecanica Paciente Cronico",
    },
    EVENTO: {
        nombre: "EVENTO - Validación por Evento",
        descripcion: "Validación por Evento",
    },
};

export const REGLAS_TERAPIAS_PAQUETES = {
    CPF1102: { min: 0, max: 0, descripcion: "Sin requisitos específicos de terapias." },
    CPF1103: { min: 0, max: 0, descripcion: "Sin requisitos específicos de terapias." },
    CPF1104: { min: 0, max: 0, descripcion: "Sin requisitos específicos de terapias." },
    CPF1105: { min: 12, max: 30, descripcion: "Entre 12 y 30 evoluciones sumadas en total." },
    CPF1106: { min: 12, max: 30, descripcion: "Entre 12 y 30 evoluciones sumadas en total." },
    CPF1107: { min: 0, max: 0, descripcion: "Sin requisitos específicos de terapias." },
    CPF1108: { min: 0, max: 0, descripcion: "Sin requisitos específicos de terapias." },
    CPF1109: { min: 6, max: 12, descripcion: "Entre 6 y 12 evoluciones sumadas en total." },
    CPF1110: { min: 12, max: 20, descripcion: "Entre 12 y 20 evoluciones sumadas en total." },
    CPF1111: { min: 0, max: 0, descripcion: "Atención Integral Heridas." },
    CPF1112: { min: 0, max: 0, descripcion: "Heridas Complejas." },
    CPF1113: { min: 0, max: 0, descripcion: "Heridas de Baja Complejidad." },
    CPF1225: { min: 0, max: 0, descripcion: "Ventilación Mecánica Paciente Crónico." },
    EVENTO: { min: 0, max: 0, descripcion: "Servicios individuales facturados y validados por evento." },
    auto: { min: 0, max: 0, descripcion: "Detección automática por carpeta para cada paciente." },
};

export const ORDEN_SERVICIOS_CLINICOS = [
    "General",
    "VM",
    "ENF",
    "ENF12",
    "CH",
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
    CH: "CURACION DE HERIDAS",
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
    /^[2-5]\s+(vm|enf12|enf|venf|ch|tf|tr|succion|suc|trs|ts|psi|to|fon|nut)\.pdf$/i;

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
    const match = nombre.match(/^([2-5])\s+(vm|enf12|enf|venf|ch|tf|tr|succion|suc|trs|ts|psi|to|fon|nut)\.pdf$/i);
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
            CH: "🩹",
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
        const tipoDesc = s === "CH" ? "Curación de Heridas (CH)" : s;
        return { icono, tipo: `Evolución ${tipoDesc}`, reconocido: true };
    }

    return { icono: "❌", tipo: "Soporte no reconocido", reconocido: false };
}

export const SERVICIOS_NOMBRES = {
    General: "📦 Paquete",
    VM: "🩺 Valoración Médica (1)",
    VENF: "🩺 Enfermería Profesional (1)",
    ENF: "💉 Auxiliar de Enfermería (1)",
    ENF12: "💉 Enfermería 12h",
    CH: "🩹 Curación de Heridas",
    TF: "🏃 Terapia Física",
    TR: "🫁 Terapia Respiratoria",
    SUCCION: "🌬️ Succión",
    TRS: "🫁 Terapia Respiratoria Succión",
    TO: "🧘 Terapia Ocupacional",
    TS: "👥 Trabajo Social",
    PSI: "🧠 Psicología",
    FON: "🗣️ Fonoaudiología",
    NUT: "🥗 Nutrición",
};

export const PDF_WORKER_URL =
    "https://cdnjs.cloudflare.com/ajax/libs/pdf.js/4.0.379/pdf.worker.min.mjs";

export const PDF_LIB_URL =
    "https://cdnjs.cloudflare.com/ajax/libs/pdf.js/4.0.379/pdf.min.mjs";

