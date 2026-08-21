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

export const PAQUETES_SOPORTADOS = [
    "CPF1105",
    "CPF1106",
    "CPF1108",
    "CPF1109",
    "CPF1110",
];

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
