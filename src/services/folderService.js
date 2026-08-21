import {
    PAQUETES_SOPORTADOS,
    IGNORAR_ARCHIVOS,
} from "../config/constants.js";

/**
 * Extrae el código de paquete soportado si existe al inicio del nombre de una carpeta
 * @param {string} nombreCarpeta
 * @returns {string|null}
 */
export function extraerCodigoPaquete(nombreCarpeta) {
    if (!nombreCarpeta) return null;
    const match = nombreCarpeta.trim().match(/^([A-Za-z0-9]+)/);
    if (!match) return null;
    const code = match[1].toUpperCase();
    return PAQUETES_SOPORTADOS.includes(code) ? code : null;
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
    const carpetas = {};
    const fallbackSeguro =
        !fallbackTipoPaquete || fallbackTipoPaquete === "auto"
            ? "CPF1108"
            : fallbackTipoPaquete;

    for (const f of archivosLista) {
        if (IGNORAR_ARCHIVOS.has(f.name.toLowerCase())) {
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

        const carpetaPaciente = p[p.length - 2];
        let paqueteDetectado = fallbackSeguro;
        let errorPaquete = null;

        if (tipoValidacion === "paquete") {
            if (p.length >= 4) {
                // 3+ niveles: [Raíz] / [Paquete] / [Paciente] / [PDFs]
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

        let key = carpetaPaciente;
        if (carpetas[key] && carpetas[key].tipoPaquete !== paqueteDetectado) {
            key = `${carpetaPaciente} (${paqueteDetectado})`;
        }

        if (!carpetas[key]) {
            carpetas[key] = {
                carpetaNombre: carpetaPaciente,
                tipoPaquete: paqueteDetectado,
                errorPaquete: errorPaquete,
                archivos: [],
            };
        }
        if (errorPaquete && !carpetas[key].errorPaquete) {
            carpetas[key].errorPaquete = errorPaquete;
        }
        carpetas[key].archivos.push(f);
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
