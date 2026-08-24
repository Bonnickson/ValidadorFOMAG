import * as XLSX from "https://cdn.sheetjs.com/xlsx-0.20.3/package/xlsx.mjs";
import { REGLAS_TERAPIAS_PAQUETES } from "../config/constants.js";

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
    // Col E (4): Facturar evento (omitido)
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
 * Lee un archivo Excel (.xlsx, .xls) o CSV y devuelve el array de filas crudo
 * @param {File} file
 * @returns {Promise<Array<Array<any>>>}
 */
export async function leerArchivoMatriz(file) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = (e) => {
            try {
                const data = new Uint8Array(e.target.result);
                const xlsxLib = XLSX || window.XLSX;
                if (!xlsxLib || !xlsxLib.read) {
                    throw new Error("No se pudo inicializar la librería XLSX para procesar el archivo.");
                }
                const workbook = xlsxLib.read(data, { type: "array" });
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
 * Normaliza documento (solo caracteres alfanuméricos)
 */
export function normalizarDocumentoMatriz(doc) {
    if (doc === null || doc === undefined) return "";
    return String(doc).replace(/[^a-zA-Z0-9]/g, "").trim();
}

/**
 * Procesa las filas crudas de la matriz a partir de la fila 3 (índice 2)
 * @param {Array<Array<any>>} rawRows 
 * @returns {Object} { pacientesPorDoc: Map, pacientesList: Array, diagnosticoGlobal: Object }
 */
export function parsearMatriz(rawRows) {
    const pacientesPorDoc = new Map();
    const pacientesList = [];
    const erroresGlobales = [];

    if (!rawRows || rawRows.length < 3) {
        return {
            pacientesPorDoc,
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

    const conteoPorPaquete = {};

    for (let i = 2; i < rawRows.length; i++) {
        const fila = rawRows[i];
        if (!fila || fila.length === 0) continue;

        const filaExcel = i + 1;
        const tipoDoc = String(fila[MAPEO_COLUMNAS_MATRIZ.TIPO_DOC] || "").trim();
        const docRaw = fila[MAPEO_COLUMNAS_MATRIZ.DOCUMENTO];
        const documento = normalizarDocumentoMatriz(docRaw);
        const nombre = String(fila[MAPEO_COLUMNAS_MATRIZ.NOMBRE] || "").trim();
        const paqueteRaw = String(fila[MAPEO_COLUMNAS_MATRIZ.PAQUETE] || "").trim().toUpperCase();

        // Si la fila está completamente vacía, ignorar
        if (!documento && !nombre && !paqueteRaw) continue;

        const erroresFila = [];
        const alertasFila = [];

        if (!documento) {
            erroresFila.push(`Fila ${filaExcel}: Documento vacío.`);
        }

        // Determinar código de paquete normalizado (ej. CPF1108, CPF1109...)
        let paquete = paqueteRaw;
        const matchPaq = paqueteRaw.match(/(CPF\s*110[5689]|CPF\s*1110)/i);
        if (matchPaq) {
            paquete = matchPaq[1].replace(/\s+/g, "").toUpperCase();
        }

        if (paquete) {
            conteoPorPaquete[paquete] = (conteoPorPaquete[paquete] || 0) + 1;
        } else {
            alertasFila.push(`Fila ${filaExcel}: No tiene código de paquete asignado.`);
        }

        // Parsear servicios
        const vm = parseCantidad(fila[MAPEO_COLUMNAS_MATRIZ.VM]);
        const venf = parseCantidad(fila[MAPEO_COLUMNAS_MATRIZ.ENF_PROF]); // Col H: Paq. Enfermería Profesional (VENF)
        const enf = parseCantidad(fila[MAPEO_COLUMNAS_MATRIZ.ENF_AUX]);   // Col I: Paq. Aux Enfermeria (ENF)

        const tf = parseCantidad(fila[MAPEO_COLUMNAS_MATRIZ.TF]);
        const tr = parseCantidad(fila[MAPEO_COLUMNAS_MATRIZ.TR]);
        const trs = parseCantidad(fila[MAPEO_COLUMNAS_MATRIZ.TRS]);
        const fon = parseCantidad(fila[MAPEO_COLUMNAS_MATRIZ.FON]);
        const to = parseCantidad(fila[MAPEO_COLUMNAS_MATRIZ.TO]);
        const nut = parseCantidad(fila[MAPEO_COLUMNAS_MATRIZ.NUT]);
        const ts = parseCantidad(fila[MAPEO_COLUMNAS_MATRIZ.TS]);
        const psi = parseCantidad(fila[MAPEO_COLUMNAS_MATRIZ.PSI]);

        const servicios = {
            VM: vm,
            VENF: venf,
            ENF: enf,
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
        if (paquete && paquete.startsWith("CPF")) {
            // 1. Validar Fijos Obligatorios: exactamente 1 VM, 1 VENF y 1 ENF
            if (vm !== 1) {
                erroresFila.push(`Paquete ${paquete} requiere exactamente 1 evolución de VM (tiene ${vm}).`);
            }
            if (venf !== 1) {
                erroresFila.push(`Paquete ${paquete} requiere exactamente 1 evolución de VENF (Enfermería Profesional, tiene ${venf}).`);
            }
            if (enf !== 1) {
                erroresFila.push(`Paquete ${paquete} requiere exactamente 1 evolución de ENF (Auxiliar Enfermería, tiene ${enf}).`);
            }

            // 2. Validar A Elección: exactamente 1 entre (PSI, NUT, TS) con cantidad 1
            const opcionalesConValor = [];
            if (psi > 0) opcionalesConValor.push({ serv: "PSI", cant: psi });
            if (nut > 0) opcionalesConValor.push({ serv: "NUT", cant: nut });
            if (ts > 0) opcionalesConValor.push({ serv: "TS", cant: ts });

            if (opcionalesConValor.length === 0) {
                erroresFila.push(`Paquete ${paquete} debe incluir 1 servicio a elección entre PSI, NUT o TS.`);
            } else if (opcionalesConValor.length > 1) {
                const lista = opcionalesConValor.map(o => `${o.serv}(${o.cant})`).join(", ");
                erroresFila.push(`Paquete ${paquete} debe incluir solo 1 servicio a elección (se encontraron varios: ${lista}).`);
            } else {
                const unico = opcionalesConValor[0];
                if (unico.cant !== 1) {
                    erroresFila.push(`El servicio a elección ${unico.serv} debe tener exactamente 1 evolución (tiene ${unico.cant}).`);
                }
            }

            // 3. Validar Terapias sumadas según rango del paquete
            const regla = REGLAS_TERAPIAS_PAQUETES[paquete];
            if (regla && (regla.min > 0 || regla.max > 0)) {
                if (totalTerapias < regla.min || totalTerapias > regla.max) {
                    erroresFila.push(
                        `Paquete ${paquete} requiere entre ${regla.min} y ${regla.max} terapias sumadas (tiene ${totalTerapias}: TF:${tf}, TR:${tr}, TRS:${trs}, FON:${fon}, TO:${to}).`
                    );
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
            servicios,
            totalTerapias,
            errores: erroresFila,
            alertas: alertasFila,
            valido: erroresFila.length === 0,
        };

        if (documento) {
            if (pacientesPorDoc.has(documento)) {
                const previo = pacientesPorDoc.get(documento);
                pacienteObj.errores.push(`Documento duplicado (ya presente en Fila ${previo.filaExcel}).`);
                pacienteObj.valido = false;
            } else {
                pacientesPorDoc.set(documento, pacienteObj);
            }
        }

        pacientesList.push(pacienteObj);
    }

    const totalConErrores = pacientesList.filter((p) => !p.valido).length;

    return {
        pacientesPorDoc,
        pacientesList,
        diagnosticoGlobal: {
            valida: totalConErrores === 0 && pacientesList.length > 0,
            totalFilas: rawRows.length,
            totalPacientes: pacientesList.length,
            pacientesConErrores: totalConErrores,
            errores: erroresGlobales,
            conteoPorPaquete,
        },
    };
}
