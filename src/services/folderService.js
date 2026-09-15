import {
    PAQUETES_SOPORTADOS,
    IGNORAR_ARCHIVOS,
} from "../config/constants.js";

/**
 * Extrae el código de paquete si existe al inicio del nombre de una carpeta (ej: CPF1108, CPF1111, etc.)
 * @param {string} nombreCarpeta
 * @returns {string|null}
 */
export function extraerCodigoPaquete(nombreCarpeta) {
    if (!nombreCarpeta) return null;
    const match = nombreCarpeta.trim().match(/^([A-Za-z0-9]+)/);
    if (!match) return null;
    const code = match[1].toUpperCase();
    return code.startsWith("CPF") || PAQUETES_SOPORTADOS.includes(code) ? code : null;
}

/**
 * Agrupa archivos detectando jerarquía de carpetas:
 * - 3+ niveles: [Raíz] / [Paquete] / [Paciente] / archivos.pdf
 * - 2 niveles: [Paquete] / [Paciente] / archivos.pdf
 * - 1 nivel: [Paciente] / archivos.pdf
 */
export function agruparArchivosInteligente(
    archivosLista,
    fallbackTipoPaquete,
    tipoValidacion
) {
    const fallbackSeguro =
        !fallbackTipoPaquete || fallbackTipoPaquete === "auto"
            ? "CPF1108"
            : fallbackTipoPaquete;

    // 1. Agrupar primero por directorio físico exacto (evita fragmentación por orden de lectura)
    const carpetasPorDir = new Map();

    for (const f of archivosLista) {
        if (IGNORAR_ARCHIVOS.has(f.name.toLowerCase())) {
            continue;
        }

        // Solo procesar archivos PDF para la validación de soportes
        if (!f.name.toLowerCase().endsWith(".pdf")) {
            continue;
        }

        const pathNormalizado = (f.webkitRelativePath || f.name).replace(
            /\\/g,
            "/"
        );
        const p = pathNormalizado.split("/").filter(Boolean);
        if (p.length < 2) {
            continue; // Archivo suelto en raíz sin carpeta de paciente
        }

        const dirPath = p.slice(0, -1).join("/");
        const carpetaPaciente = p[p.length - 2];
        let paqueteDetectado = fallbackSeguro;
        let errorPaquete = null;

        if (tipoValidacion === "paquete") {
            if (p.length >= 4) {
                // [Raíz] / [Auditor] / [Paquete] / [Paciente] / [PDFs] o [Raíz] / [Paquete] / [Paciente] / [PDFs]
                const carpetaPaquete = p[p.length - 3];
                const codigo = extraerCodigoPaquete(carpetaPaquete);
                if (codigo) {
                    paqueteDetectado = codigo;
                } else {
                    paqueteDetectado = fallbackSeguro;
                    errorPaquete = `Carpeta de paquete no reconocida: "${carpetaPaquete}" (se esperaba: ${PAQUETES_SOPORTADOS.join(", ")})`;
                }
            } else if (p.length === 3) {
                // 2 niveles: [Paquete] / [Paciente] / [PDFs]
                const carpetaPaquete = p[0];
                const codigo = extraerCodigoPaquete(carpetaPaquete);
                if (codigo) {
                    paqueteDetectado = codigo;
                } else {
                    const matchIntento = carpetaPaquete
                        .trim()
                        .match(/^([A-Za-z0-9]+)/);
                    const codigoIntento = matchIntento
                        ? matchIntento[1].toUpperCase()
                        : "";
                    if (codigoIntento.startsWith("CPF")) {
                        errorPaquete = `Código de paquete no válido: "${carpetaPaquete}" (se esperaba: ${PAQUETES_SOPORTADOS.join(", ")})`;
                    }
                    paqueteDetectado = fallbackSeguro;
                }
            } else {
                // 1 nivel: [Paciente] / [PDFs]
                paqueteDetectado = fallbackSeguro;
            }
        }

        // Detectar si hay nivel de auditor/subcarpeta superior
        let auditorDetectado = "";
        if (p.length >= 5) {
            // Si el nivel anterior al paciente es paquete, el previo es el auditor
            if (extraerCodigoPaquete(p[p.length - 3])) {
                auditorDetectado = p[p.length - 4];
            } else {
                auditorDetectado = p[1];
            }
        } else if (p.length === 4) {
            // [Auditor, Paquete, Paciente, Archivo.pdf]
            if (extraerCodigoPaquete(p[1])) {
                auditorDetectado = p[0];
            }
        }

        if (!carpetasPorDir.has(dirPath)) {
            carpetasPorDir.set(dirPath, {
                dirPath,
                carpetaNombre: carpetaPaciente,
                tipoPaquete: paqueteDetectado,
                errorPaquete: errorPaquete,
                auditor: auditorDetectado,
                rutaRelativa: pathNormalizado,
                archivos: [],
            });
        }

        const grupo = carpetasPorDir.get(dirPath);
        grupo.archivos.push(f);
        if (errorPaquete && !grupo.errorPaquete) {
            grupo.errorPaquete = errorPaquete;
        }
        if (auditorDetectado && !grupo.auditor) {
            grupo.auditor = auditorDetectado;
        }
    }

    // 2. Contar apariciones de cada carpeta de paciente para desambiguar solo cuando sea necesario
    const conteoPorPaciente = new Map();
    for (const grupo of carpetasPorDir.values()) {
        const nombre = grupo.carpetaNombre;
        conteoPorPaciente.set(nombre, (conteoPorPaciente.get(nombre) || 0) + 1);
    }

    // 3. Generar el diccionario final con nombres limpios y claves unívocas
    const carpetas = {};
    for (const grupo of carpetasPorDir.values()) {
        const nombre = grupo.carpetaNombre;
        const tieneMultiples = (conteoPorPaciente.get(nombre) || 0) > 1;

        let key = nombre;
        if (tieneMultiples) {
            if (grupo.tipoPaquete) {
                key = `${nombre} (${grupo.tipoPaquete})`;
            }
            if (carpetas[key]) {
                if (grupo.auditor) {
                    key = `${nombre} (${grupo.tipoPaquete}) [${grupo.auditor}]`;
                } else {
                    let idx = 2;
                    while (carpetas[`${key} (${idx})`]) {
                        idx++;
                    }
                    key = `${key} (${idx})`;
                }
            }
        }

        carpetas[key] = grupo;
    }

    return carpetas;
}

/**
 * Ordena las carpetas agrupadas por el orden establecido de paquetes (CPF1105 - CPF1110)
 * y de forma natural por nombre/cédula dentro del mismo paquete.
 */
export function ordenarCarpetasPorPaquete(carpetasAgrupadas) {
    const ordenPaquetes = PAQUETES_SOPORTADOS;
    return Object.keys(carpetasAgrupadas).sort((keyA, keyB) => {
        const infoA = carpetasAgrupadas[keyA];
        const infoB = carpetasAgrupadas[keyB];
        const paqA = (infoA?.tipoPaquete || "").toUpperCase();
        const paqB = (infoB?.tipoPaquete || "").toUpperCase();

        const idxA = ordenPaquetes.indexOf(paqA);
        const idxB = ordenPaquetes.indexOf(paqB);

        if (idxA !== -1 && idxB !== -1 && idxA !== idxB) {
            return idxA - idxB;
        }
        if (idxA !== -1 && idxB === -1) return -1;
        if (idxA === -1 && idxB !== -1) return 1;

        if (paqA !== paqB) return paqA.localeCompare(paqB);

        // Mismo paquete: ordenar por nombre de carpeta / documento
        return (infoA?.carpetaNombre || keyA).localeCompare(
            infoB?.carpetaNombre || keyB,
            undefined,
            { numeric: true }
        );
    });
}

/**
 * Función recursiva para recorrer carpetas con File System Access API
 */
export async function recorrerCarpetaRecursivo(handle, basePath = "") {
    const files = [];
    for await (const [name, childHandle] of handle.entries()) {
        const currentPath = basePath ? `${basePath}/${name}` : name;
        if (childHandle.kind === "directory") {
            const subFiles = await recorrerCarpetaRecursivo(
                childHandle,
                currentPath
            );
            files.push(...subFiles);
        } else if (childHandle.kind === "file") {
            const file = await childHandle.getFile();
            Object.defineProperty(file, "webkitRelativePath", {
                value: currentPath,
                writable: false,
                configurable: true,
            });
            files.push(file);
        }
    }
    return files;
}
