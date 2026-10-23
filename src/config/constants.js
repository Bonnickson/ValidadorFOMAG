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
    "APL",
];

export const SERVICIOS_TERAPIA = ["TF", "TR", "SUCCION", "TO", "FON"];

export const TERAPIAS_CONTABLES = new Set(["TF", "TR", "FON", "TO", "TRS"]);

export const PAQUETES_SOPORTADOS_FOMAG = [
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

export const PAQUETES_SOPORTADOS_NUEVA_EPS = [
    "E890167",
    "E890168",
    "E890169",
    "E890190",
    "E891863",
    "E891864",
    "E891865",
    "E891866",
    "E985110",
    "E985111",
    "E985112",
    "E985113",
    "EC890290",
];

// Lista consolidada de todos los códigos de paquetes
export const PAQUETES_SOPORTADOS = [
    ...PAQUETES_SOPORTADOS_FOMAG,
    ...PAQUETES_SOPORTADOS_NUEVA_EPS,
];

// Mapeo bidireccional entre códigos FOMAG y Nueva EPS
export const MAPEO_FOMAG_A_NUEVA_EPS = {
    CPF1102: "E890167",
    CPF1103: "E890168",
    CPF1104: "E890169",
    CPF1108: "E890190",
    CPF1105: "E891863",
    CPF1111: "E891864",
    CPF1112: "E891865",
    CPF1113: "E891866",
    CPF1110: "E985110",
    CPF1109: "E985111",
    CPF1106: "E985112",
    CPF1107: "E985113",
    CPF1225: "EC890290",
};

export const MAPEO_NUEVA_EPS_A_FOMAG = {
    E890167: "CPF1102",
    E890168: "CPF1103",
    E890169: "CPF1104",
    E890190: "CPF1108",
    E891863: "CPF1105",
    E891864: "CPF1111",
    E891865: "CPF1112",
    E891866: "CPF1113",
    E985110: "CPF1110",
    E985111: "CPF1109",
    E985112: "CPF1106",
    E985113: "CPF1107",
    EC890290: "CPF1225",
};

export const CODIGOS_APLICACION = new Set([
    "CPF1102", "CPF1103", "CPF1104",
    "E890167", "E890168", "E890169",
]);

export const CODIGOS_DIARIOS = new Set([
    "CPF1225",
    "EC890290",
]);

export const CODIGOS_PALIATIVOS = new Set([
    "CPF1107",
    "E985113",
]);

/**
 * Normaliza cualquier código de paquete a su equivalente canónico FOMAG
 * para evaluar las mismas reglas de negocio (médica, enfermería, terapias, etc.)
 */
export function normalizarCodigoPaquete(codigo) {
    if (!codigo) return "";
    const c = String(codigo).trim().toUpperCase();
    return MAPEO_NUEVA_EPS_A_FOMAG[c] || c;
}

export const PAQUETES_INFO = {
    // FOMAG
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

    // NUEVA EPS
    E890167: {
        nombre: "E890167 - Atencion Integral De Paciente Agudo Baja Complejidad Programa Extension Hospitalaria (Por Dia)(12405)",
        descripcion: "Atencion Integral De Paciente Agudo Baja Complejidad Programa Extension Hospitalaria (Por Dia)(12405)",
    },
    E890168: {
        nombre: "E890168 - Atencion Integral De Paciente Agudo Mediana Complejidad Programa Extension Hospitalaria (Por Dia)(12406)",
        descripcion: "Atencion Integral De Paciente Agudo Mediana Complejidad Programa Extension Hospitalaria (Por Dia)(12406)",
    },
    E890169: {
        nombre: "E890169 - Atencion Integral De Paciente Agudo Alta Complejidad Programa Extension Hospitalaria (Por Dia)(12407)",
        descripcion: "Atencion Integral De Paciente Agudo Alta Complejidad Programa Extension Hospitalaria (Por Dia)(12407)",
    },
    E890190: {
        nombre: "E890190 - Paquete De Atencion Domiciliaria Paciente Cronico (Mensual) Intermedio(69368)",
        descripcion: "Paquete De Atencion Domiciliaria Paciente Cronico (Mensual) Intermedio(69368)",
    },
    E891863: {
        nombre: "E891863 - Paquete De Rehabilitacion Mensual Domiciliario(Paciente Neurologico Agudo)(29000)",
        descripcion: "Paquete De Rehabilitacion Mensual Domiciliario(Paciente Neurologico Agudo)(29000)",
    },
    E891864: {
        nombre: "E891864 - Atencion Integral Heridas De Alta Complejidad Mensual Domiciliaria(29001)",
        descripcion: "Atencion Integral Heridas De Alta Complejidad Mensual Domiciliaria(29001)",
    },
    E891865: {
        nombre: "E891865 - Atencion Integral Heridas De Mediana Complejidad Mensual Domiciliaria(29002)",
        descripcion: "Atencion Integral Heridas De Mediana Complejidad Mensual Domiciliaria(29002)",
    },
    E891866: {
        nombre: "E891866 - Atencion Integral Heridas De Baja Complejidad Mensual Domiciliaria(29003)",
        descripcion: "Atencion Integral Heridas De Baja Complejidad Mensual Domiciliaria(29003)",
    },
    E985110: {
        nombre: "E985110 - Paquete De Atencion Domiciliaria Paciente Cronico (Mensual)(13073)",
        descripcion: "Paquete De Atencion Domiciliaria Paciente Cronico (Mensual)(13073)",
    },
    E985111: {
        nombre: "E985111 - Paquete De Atencion Domiciliario A Paciente Cronico Con Terapias (Mensual)(13074)",
        descripcion: "Paquete De Atencion Domiciliario A Paciente Cronico Con Terapias (Mensual)(13074)",
    },
    E985112: {
        nombre: "E985112 - Paquete De Traqueostomia Mensual Domiciliario(13075)",
        descripcion: "Paquete De Traqueostomia Mensual Domiciliario(13075)",
    },
    E985113: {
        nombre: "E985113 - Paquete De Atención Domiciliaria Cronico Paliativo (Mensual)(13076)",
        descripcion: "Paquete De Atención Domiciliaria Cronico Paliativo (Mensual)(13076)",
    },
    EC890290: {
        nombre: "EC890290 - Paquete Diario De Ventilacion Mecanica Paciente Cronico",
        descripcion: "Paquete Diario De Ventilacion Mecanica Paciente Cronico",
    },

    EVENTO: {
        nombre: "EVENTO - Validación por Evento",
        descripcion: "Validación por Evento",
    },
};

export const REGLAS_TERAPIAS_PAQUETES = {
    CPF1102: { min: 0, max: 0, permiteTerapias: false, descripcion: "1 VM, 1 ENF y APL (1 Dosis = Cant Paquete Diario). Sin terapias." },
    CPF1103: { min: 0, max: 0, permiteTerapias: false, descripcion: "1 VM, 1 ENF y APL (2 o 3 Dosis = Cant Paquete Diario). Sin terapias." },
    CPF1104: { min: 0, max: 0, permiteTerapias: false, descripcion: "1 VM, 1 ENF y APL (4 Dosis = Cant Paquete Diario). Sin terapias." },
    CPF1105: { min: 12, max: 30, permiteTerapias: true, descripcion: "Entre 12 y 30 evoluciones sumadas en total (TF, TR, TRS, FON, TO)." },
    CPF1106: { min: 12, max: 30, permiteTerapias: true, descripcion: "Entre 12 y 30 evoluciones sumadas en total (TF, TR, TRS, FON, TO)." },
    CPF1107: { min: 0, max: 999, permiteTerapias: true, terapiasPermitidas: ["TF", "TR", "TRS"], descripcion: "Terapias opcionales (únicamente TF, TR y TRS/Succión)." },
    CPF1108: { min: 0, max: 0, permiteTerapias: false, descripcion: "No contempla terapias (0 terapias)." },
    CPF1109: { min: 6, max: 12, permiteTerapias: true, descripcion: "Entre 6 y 12 evoluciones sumadas en total (TF, TR, TRS, FON, TO)." },
    CPF1110: { min: 12, max: 20, permiteTerapias: true, descripcion: "Entre 12 y 20 evoluciones sumadas en total (TF, TR, TRS, FON, TO)." },
    CPF1111: { min: 0, max: 0, permiteTerapias: false, descripcion: "Heridas Alta Complejidad. No contempla terapias (0 terapias)." },
    CPF1112: { min: 0, max: 0, permiteTerapias: false, descripcion: "Heridas Mediana Complejidad. No contempla terapias (0 terapias)." },
    CPF1113: { min: 0, max: 0, permiteTerapias: false, descripcion: "Heridas Baja Complejidad. No contempla terapias (0 terapias)." },
    CPF1225: { min: 0, max: 999, permiteTerapias: true, descripcion: "Ventilación Mecánica Crónica. Contempla todas las terapias según programación." },

    // NUEVA EPS (equivalentes)
    E890167: { min: 0, max: 0, permiteTerapias: false, descripcion: "1 VM, 1 ENF y APL (1 Dosis = Cant Paquete Diario). Sin terapias." },
    E890168: { min: 0, max: 0, permiteTerapias: false, descripcion: "1 VM, 1 ENF y APL (2 o 3 Dosis = Cant Paquete Diario). Sin terapias." },
    E890169: { min: 0, max: 0, permiteTerapias: false, descripcion: "1 VM, 1 ENF y APL (4 Dosis = Cant Paquete Diario). Sin terapias." },
    E891863: { min: 12, max: 30, permiteTerapias: true, descripcion: "Entre 12 y 30 evoluciones sumadas en total (TF, TR, TRS, FON, TO)." },
    E985112: { min: 12, max: 30, permiteTerapias: true, descripcion: "Entre 12 y 30 evoluciones sumadas en total (TF, TR, TRS, FON, TO)." },
    E985113: { min: 0, max: 999, permiteTerapias: true, terapiasPermitidas: ["TF", "TR", "TRS"], descripcion: "Terapias opcionales (únicamente TF, TR y TRS/Succión)." },
    E890190: { min: 0, max: 0, permiteTerapias: false, descripcion: "No contempla terapias (0 terapias)." },
    E985111: { min: 6, max: 12, permiteTerapias: true, descripcion: "Entre 6 y 12 evoluciones sumadas en total (TF, TR, TRS, FON, TO)." },
    E985110: { min: 12, max: 20, permiteTerapias: true, descripcion: "Entre 12 y 20 evoluciones sumadas en total (TF, TR, TRS, FON, TO)." },
    E891864: { min: 0, max: 0, permiteTerapias: false, descripcion: "Heridas Alta Complejidad. No contempla terapias (0 terapias)." },
    E891865: { min: 0, max: 0, permiteTerapias: false, descripcion: "Heridas Mediana Complejidad. No contempla terapias (0 terapias)." },
    E891866: { min: 0, max: 0, permiteTerapias: false, descripcion: "Heridas Baja Complejidad. No contempla terapias (0 terapias)." },
    EC890290: { min: 0, max: 999, permiteTerapias: true, descripcion: "Ventilación Mecánica Crónica. Contempla todas las terapias según programación." },

    EVENTO: { min: 0, max: 0, descripcion: "Servicios individuales facturados y validados por evento." },
    auto: { min: 0, max: 0, descripcion: "Detección automática por carpeta para cada paciente." },
};

export const ORDEN_SERVICIOS_CLINICOS = [
    "General",
    "VM",
    "ENF",
    "APL",
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

export const TEXTOS_SERVICIOS_NUEVA_EPS = {
    TF: [
        "ATENCION (VISITA) DOMICILIARIA, POR FISIOTERAPIA",
        "FISIOTERAPIA",
        "TERAPIA FISICA",
    ],
    TR: [
        "ATENCION (VISITA) DOMICILIARIA, POR TERAPIA RESPIRATORIA",
        "TERAPIA RESPIRATORIA",
    ],
    SUCCION: ["TERAPIA SUCCION", "SUCCION"],
    TRS: [
        "Terapia respiratoria Succion",
        "TERAPIA RESPIRATORIA CON SUCCION",
        "SUCCION",
    ],
    FON: [
        "ATENCION (VISITA) DOMICILIARIA, POR FONIATRIA Y FONOAUDIOLOGIA",
        "FONOAUDIOLOGIA",
        "FONIATRIA",
    ],
    VM: [
        "ATENCION (VISITA) DOMICILIARIA, POR MEDICINA GENERAL",
        "MEDICINA GENERAL",
        "VALORACION MEDICA",
    ],
    ENF: [
        "6 HORAS POR AUXILIAR DE ENFERMERIA",
        "8 HORAS POR AUXILIAR DE ENFERMERIA",
        "12 HORAS DIURNAS POR AUX ENFERMERIA",
        "12 HORAS NOCTURNAS POR AUX ENFERMERIA",
        "24 HORAS POR AUX ENFERMERIA",
        "ATENCION (VISITA) DOMICILIARIA, POR ENFERMERIA",
        "AUXILIAR DE ENFERMERIA",
        "ENFERMERIA",
        "E890146",
        "E890128",
        "E890126",
        "E890127",
        "E890152",
    ],
    ENF12: [
        "12 HORAS DIURNAS POR AUX ENFERMERIA",
        "12 HORAS NOCTURNAS POR AUX ENFERMERIA",
        "ATENCION (VISITA) DOMICILIARIA, POR ENFERMERIA",
        "E890126",
        "E890127",
    ],
    CH: [
        "ATENCION INTEGRAL HERIDAS DE ALTA COMPLEJIDAD",
        "ATENCION INTEGRAL HERIDAS DE MEDIANA COMPLEJIDAD",
        "ATENCION INTEGRAL HERIDAS DE BAJA COMPLEJIDAD",
        "CURACION DE HERIDAS",
        "CURACION",
        "E891864",
        "E891865",
        "E891866",
    ],
    PSI: ["ATENCION (VISITA) DOMICILIARIA, POR PSICOLOGIA", "PSICOLOGIA"],
    TS: ["ATENCION (VISITA) DOMICILIARIA, POR TRABAJO SOCIAL", "TRABAJO SOCIAL"],
    TO: [
        "ATENCION (VISITA) DOMICILIARIA, POR TERAPIA OCUPACIONAL",
        "TERAPIA OCUPACIONAL",
    ],
    NUT: [
        "ATENCION (VISITA) DOMICILIARIA, POR NUTRICION Y DIETETICA",
        "NUTRICION",
    ],
    VENF: [
        "ATENCION (VISITA) DOMICILIARIA, POR ENFERMERIA",
        "ENFERMERIA PROFESIONAL",
    ],
};

/**
 * Códigos específicos de servicios y cuidadores de Nueva EPS
 */
export const SERVICIOS_CODIGOS_NUEVA_EPS = {
    ENF_6H: { codigo: "E890146", nombre: "6 Horas Por Auxiliar De Enfermeria" },
    ENF_8H: { codigo: "E890128", nombre: "8 Horas Por Auxiliar De Enfermeria" },
    ENF_12H_D: { codigo: "E890126", nombre: "12 Horas Diurnas Por Aux Enfermeria" },
    ENF_12H_N: { codigo: "E890127", nombre: "12 Horas Nocturnas Por Aux Enfermeria" },
    ENF_24H: { codigo: "E890152", nombre: "24 Horas Por Aux Enfermeria" },
    CUIDADOR_6H: { codigo: "AD0197", nombre: "Atención Por Cuidador (Cuidador 6 Horas Diurnas)" },
    CUIDADOR_8H: { codigo: "AD0198", nombre: "Atención Por Cuidador (Cuidador 8 Horas Diurnas)" },
    CUIDADOR_12H_D: { codigo: "AD0199", nombre: "Atención Por Cuidador (Cuidador 12 Horas Diurnas)" },
    CUIDADOR_12H_N: { codigo: "AD0199", nombre: "Atención Por Cuidador (Cuidador 12 Horas Nocturnas)" },
    CUIDADOR_24H: { codigo: "AD0200", nombre: "Servicio De Cuidador Por 24 Horas" },
    DEFUNCION: { codigo: "E8902001", nombre: "Paquete Autopsia Verbal En Domicilio" },
};

/**
 * Obtiene el texto estándar a buscar para un servicio en FOMAG
 */
export function obtenerTextoServicioFomag(servicio) {
    if (!servicio) return null;
    return TEXTOS_SERVICIOS_FOMAG[servicio] || null;
}

/**
 * Obtiene los textos o códigos a buscar para un servicio en Nueva EPS
 */
export function obtenerTextoServicioNuevaEps(servicio) {
    if (!servicio) return null;
    return TEXTOS_SERVICIOS_NUEVA_EPS[servicio] || null;
}

export const IGNORAR_ARCHIVOS = new Set(["desktop.ini", "thumbs.db", ".ds_store"]);

export const REGEX_SERVICIO_ARCHIVO =
    /^[2-5]\s+(vm|enf12|enf|venf|ch|tf|tr|succion|suc|trs|ts|psi|to|fon|nut|apl)\.pdf$/i;

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
    if (/^3\.pdf$/i.test(nombre)) return { icono: "📋", tipo: "ADRES (3.pdf)", reconocido: true };
    if (/^4\.pdf$/i.test(nombre)) return { icono: "✍️", tipo: "Planilla de Firmas (4.pdf)", reconocido: true };
    if (/^5\.pdf$/i.test(nombre)) return { icono: "📑", tipo: "Evolución Clínica (5.pdf)", reconocido: true };

    // Archivos con servicio: [2-5] [servicio].pdf
    const match = nombre.match(/^([2-5])\s+(vm|enf12|enf|venf|ch|tf|tr|succion|suc|trs|ts|psi|to|fon|nut|apl)\.pdf$/i);
    if (match) {
        const num = match[1];
        let s = match[2].toUpperCase();
        if (s === "SUC") s = "SUCCION";

        if (num === "2") return { icono: "📄", tipo: `Autorización ${s}`, reconocido: true };
        if (num === "3") return { icono: "📋", tipo: `ADRES ${s}`, reconocido: true };
        if (num === "4") return { icono: "✍️", tipo: `Firmas ${s}`, reconocido: true };

        // num === "5"
        const iconosServicios = {
            VM: "🩺",
            VENF: "🩺",
            ENF: "💉",
            ENF12: "💉",
            APL: "💊",
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
        let tipoDesc = s;
        if (s === "CH") tipoDesc = "Curación de Heridas (CH)";
        else if (s === "APL") tipoDesc = "Aplicación de Medicamentos (APL)";
        return { icono, tipo: `Evolución ${tipoDesc}`, reconocido: true };
    }

    return { icono: "❌", tipo: "Soporte no reconocido", reconocido: false };
}

export const SERVICIOS_NOMBRES = {
    General: "📦 Paquete",
    VM: "🩺 Valoración Médica",
    VENF: "🩺 Enfermería Profesional",
    ENF: "💉 Auxiliar de Enfermería",
    APL: "💊 Aplicación Medicamentos (APL)",
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

