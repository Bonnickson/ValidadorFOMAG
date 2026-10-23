import {
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

    const filasHeaders = [rawRows[0] || [], rawRows[1] || []];

    filasHeaders.forEach((fila) => {
        if (!Array.isArray(fila)) return;
        fila.forEach((celda, idx) => {
            const h = normalizarEncabezado(celda);
            if (!h) return;

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
 * Normaliza documento (mantiene el valor recortando espacios en los extremos)
 */
export function normalizarDocumentoMatriz(doc) {
    if (doc === null || doc === undefined) return "";
    return String(doc).trim();
}

/**
 * Procesa las filas crudas de la matriz a partir de la fila 3 (índice 2)
 * @param {Array<Array<any>>} rawRows 
 * @returns {Object} { pacientesPorDoc: Map, pacientesList: Array, diagnosticoGlobal: Object }
 */
export function parsearMatriz(rawRows) {
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
            alertasFila.push(`Fila ${filaExcel}: Sin paquete asignado en la matriz. Se cataloga como EVENTO.`);
        }

        // Parsear servicios
        const geriatria = parseCantidad(fila[5]); // Col F: Geriatría
        const vm = parseCantidad(fila[columnasDetectadas.VM]);
        const venf = parseCantidad(fila[columnasDetectadas.ENF_PROF]); // Col H: Paq. Enfermería Profesional (VENF)
        const enf = parseCantidad(fila[columnasDetectadas.ENF_AUX]);   // Col I: Paq. Aux Enfermeria (ENF)

        const tf = parseCantidad(fila[columnasDetectadas.TF]);
        const tr = parseCantidad(fila[columnasDetectadas.TR]);
        const trs = parseCantidad(fila[columnasDetectadas.TRS]);
        const fon = parseCantidad(fila[columnasDetectadas.FON]);
        const to = parseCantidad(fila[columnasDetectadas.TO]);
        const nut = parseCantidad(fila[columnasDetectadas.NUT]);
        const ts = parseCantidad(fila[columnasDetectadas.TS]);
        const psi = parseCantidad(fila[columnasDetectadas.PSI]);

        // Parsear datos de paquete diario y aplicación de medicamento (APL)
        const cantPaqDiario = columnasDetectadas.CANT_PAQ_DIARIO !== -1 ? parseCantidad(fila[columnasDetectadas.CANT_PAQ_DIARIO]) : 0;
        const apl1 = columnasDetectadas.APL_1_DOSIS !== -1 ? parseCantidad(fila[columnasDetectadas.APL_1_DOSIS]) : 0;
        const apl2 = columnasDetectadas.APL_2_DOSIS !== -1 ? parseCantidad(fila[columnasDetectadas.APL_2_DOSIS]) : 0;
        const apl3 = columnasDetectadas.APL_3_DOSIS !== -1 ? parseCantidad(fila[columnasDetectadas.APL_3_DOSIS]) : 0;
        const apl4 = columnasDetectadas.APL_4_DOSIS !== -1 ? parseCantidad(fila[columnasDetectadas.APL_4_DOSIS]) : 0;

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

        if (paquete && paquete !== "EVENTO" && !esPaqueteParametrizado) {
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

    const tienePaqueteEspecifico = paquete && paquete !== "auto" && paquete !== "SIN_PAQUETE";

    // 1. Si se especificó un paquete concreto, buscar coincidencia exacta doc + paquete
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
