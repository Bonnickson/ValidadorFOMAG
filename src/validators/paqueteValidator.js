import * as pdfjsLib from "https://cdnjs.cloudflare.com/ajax/libs/pdf.js/4.0.379/pdf.min.mjs";
import { obtenerReglasPaquete } from "../reglas.js";
import {
    DEBUG,
    SERVICIOS_TERAPIA,
    TERAPIAS_CONTABLES,
    PAQUETES_SOPORTADOS,
    REGLAS_TERAPIAS_PAQUETES,
    obtenerTextoServicioFomag,
    obtenerTextoServicioNuevaEps,
    normalizarCodigoPaquete,
    CODIGOS_APLICACION,
    CODIGOS_DIARIOS,
    CODIGOS_PALIATIVOS,
    REGEX_SERVICIO_ARCHIVO,
} from "../config/constants.js";
import {
    normalizeForSearch,
    escapeRegExp,
    extraerNumeroDelTexto,
    extraerCantidadAutorizacion,
    estaFechaEnPeriodo,
    formatearPeriodoLegible,
} from "../utils/textUtils.js";
import {
    extraerTextoPDF,
    extraerCantidadTablaNuevaEps,
    extraerTextoOCRDePDF,
    extraerFechas,
    validarOrdenFechas,
    tieneTextoCorrupto,
} from "../utils/pdfUtils.js";

// Variable para controlar debug solo en primer servicio
let primerServicioDebug = null;

/**
 * Valida que solo existan archivos permitidos en la carpeta de paquete
 * @param {File[]} archivos - Array de archivos en la carpeta
 * @param {Object} resultados - Objeto con los resultados de validación
 * @param {string} carpeta - Nombre de la carpeta
 * @param {string} convenio - Convenio seleccionado ('capital-salud' o 'fomag')
 */
export function validarArchivosPermitidosPaquete(
    archivos,
    resultados,
    carpeta,
    convenio
) {
    const archivosNoPermitidos = [];

    for (const archivo of archivos) {
        const nombreLower = archivo.name.toLowerCase();

        // Patrón válido: "2 vm.pdf", "4 enf.pdf", etc.
        const patronServicio = REGEX_SERVICIO_ARCHIVO;

        // Patrón válido solo para FOMAG y Nueva EPS: "2 paq.pdf"
        const patron2Paq = /^2\s+paq\.pdf$/i;

        // Archivo 3.pdf (ADRES): obligatorio en paquetes de Nueva EPS
        const patron3Adres = /^3\.pdf$/i;

        const esArchivoValido =
            patronServicio.test(nombreLower) ||
            ((convenio === "fomag" || convenio === "nueva-eps") && patron2Paq.test(nombreLower)) ||
            (convenio === "nueva-eps" && patron3Adres.test(nombreLower));

        if (!esArchivoValido) {
            archivosNoPermitidos.push(archivo.name);
        }
    }

    if (archivosNoPermitidos.length > 0) {
        // Agregar "General" como servicio
        resultados[carpeta].servicios.add("General");

        // Inicializar arrays para el servicio General
        resultados[carpeta].erroresPorServicio["General"] =
            resultados[carpeta].erroresPorServicio["General"] || [];
        resultados[carpeta].exitosPorServicio["General"] =
            resultados[carpeta].exitosPorServicio["General"] || [];
        resultados[carpeta].alertasPorServicio["General"] =
            resultados[carpeta].alertasPorServicio["General"] || [];
        resultados[carpeta].fechasPorServicio["General"] =
            resultados[carpeta].fechasPorServicio["General"] || [];

        // Agregar los archivos no permitidos como errores del servicio General
        archivosNoPermitidos.forEach((archivo) => {
            resultados[carpeta].erroresPorServicio["General"].push(
                `Archivo no permitido: ${archivo}`
            );
        });

        // console.log(
        //     `❌ ${carpeta} - Archivos no permitidos encontrados: ${archivosNoPermitidos.join(
        //         ", "
        //     )}`
        // );
    }
}

/**
 * Valida carpeta en modo paquete (crónico o crónico con terapias)
 */
export async function validarPorPaquete(
    carpeta,
    archivos,
    tipoPaquete,
    nroDocumento,
    resultados,
    estado,
    updateRow,
    convenio = "capital-salud",
    onProgresoArchivo = null,
    periodoPermitido = null
) {
    const nombres = archivos.map((a) => a.name);

    // Validar archivos permitidos primero
    validarArchivosPermitidosPaquete(archivos, resultados, carpeta, convenio);

    // Detectar servicios presentes
    const serviciosEncontrados = detectarServicios(nombres);

    // Si ya existe el servicio "General", preservarlo
    if (resultados[carpeta].servicios?.has("General")) {
        serviciosEncontrados.add("General");
    }

    resultados[carpeta].servicios = serviciosEncontrados;

    // Inicializar contenedores de fechas, errores, éxitos y alertas por servicio
    for (const s of serviciosEncontrados) {
        resultados[carpeta].fechasPorServicio[s] ||= [];
        resultados[carpeta].erroresPorServicio[s] ||= [];
        resultados[carpeta].exitosPorServicio[s] ||= [];
        resultados[carpeta].alertasPorServicio[s] ||= [];
    }
    
    // Asegurar también la clave "General" en caso de que sea necesario antes de los procesos finales
    if (!resultados[carpeta].servicios.has("General")) {
        resultados[carpeta].servicios.add("General");
    }
    resultados[carpeta].fechasPorServicio["General"] ||= [];
    resultados[carpeta].erroresPorServicio["General"] ||= [];
    resultados[carpeta].exitosPorServicio["General"] ||= [];
    resultados[carpeta].alertasPorServicio["General"] ||= [];

    // Asegurar URLs para archivos PDF solo si no existen
    for (const f of archivos) {
        if (f.type === "application/pdf" && !resultados[carpeta].fileUrls[f.name]) {
            resultados[carpeta].fileUrls[f.name] = URL.createObjectURL(f);
        }
    }

    // Solo validar paquetes con sus reglas si es paquete parametrizado o evento
    const esEventoValidacion = tipoPaquete === "EVENTO" || Boolean(
        resultados[carpeta]?.datosMatriz?.esFacturarEvento && !resultados[carpeta]?.datosMatriz?.paquete
    );
    const esPaqueteValido = esEventoValidacion || PAQUETES_SOPORTADOS.includes(tipoPaquete) || tipoPaquete.startsWith("CPF") || Boolean(REGLAS_TERAPIAS_PAQUETES[tipoPaquete]);
    if (esPaqueteValido) {
        validarNuevoPaquete(
            carpeta,
            nombres,
            serviciosEncontrados,
            resultados,
            archivos,
            tipoPaquete,
            convenio
        );
    }

    // Procesar "2 paq.pdf" de forma general ANTES de los servicios para tener cantidades de autorización disponibles
    const archivo2Paq = archivos.find(
        (f) => f.name.toLowerCase() === "2 paq.pdf" && (f.type === "application/pdf" || f.name.toLowerCase().endsWith(".pdf"))
    );
    if (archivo2Paq) {
        estado.textContent = `Procesando: ${carpeta} / ${archivo2Paq.name} (General)`;
        if (onProgresoArchivo) onProgresoArchivo(archivo2Paq.name);
        await validarPDFPaquete(
            archivo2Paq,
            carpeta,
            nroDocumento,
            "General",
            resultados,
            convenio,
            tipoPaquete,
            periodoPermitido
        );
    }

    // Procesar cada servicio encontrado para validar PDFs (excepto "General")
    for (const servicio of serviciosEncontrados) {
        // Saltar "General" ya que no tiene PDFs específicos para procesar
        if (servicio === "General") continue;

        const servicioLower = servicio.toLowerCase();

        // IMPORTANTE: Si es evento, procesar PRIMERO el 2 para extraer Cant Auto antes de comparar en el 5, y luego el 4
        const listaNumsAProcesar = esEventoValidacion ? ["2", "5", "4"] : ["5", "4"];
        for (const numArchivo of listaNumsAProcesar) {
            let archivoParaProcesar = null;

            // 1. Buscar el archivo específico del servicio (ej: "2 vm.pdf", "5 vm.pdf")
            const nombreEspecifico = `${numArchivo} ${servicioLower}.pdf`;
            archivoParaProcesar = archivos.find(
                (f) =>
                    f.name.toLowerCase() === nombreEspecifico &&
                    (f.type === "application/pdf" || f.name.toLowerCase().endsWith(".pdf"))
            );

            // 3. Procesar el archivo si se encontró
            if (archivoParaProcesar) {
                // Solo procesar si no está marcado como faltante
                if (
                    resultados[carpeta].pdfsPorServicio[servicio] &&
                    resultados[carpeta].pdfsPorServicio[servicio][
                    numArchivo
                    ] !== "—"
                ) {
                    estado.textContent = `Procesando: ${carpeta} / ${archivoParaProcesar.name} (${servicio})`;

                    // Actualizar barra de progreso si el callback está disponible
                    if (onProgresoArchivo) {
                        onProgresoArchivo(archivoParaProcesar.name);
                    }

                    await validarPDFPaquete(
                        archivoParaProcesar,
                        carpeta,
                        nroDocumento,
                        servicio,
                        resultados,
                        convenio,
                        tipoPaquete,
                        periodoPermitido
                    );
                }
            }
        }

        updateRow(carpeta, resultados[carpeta]);
    }

    // Procesar "3.pdf" (ADRES) si existe o si es Nueva EPS
    const archivo3 = archivos.find(
        (f) => f.name.toLowerCase() === "3.pdf" && f.type === "application/pdf"
    );
    if (archivo3) {
        estado.textContent = `Procesando: ${carpeta} / ${archivo3.name} (ADRES)`;
        if (onProgresoArchivo) onProgresoArchivo(archivo3.name);
        await validarArchivo3(
            archivo3,
            carpeta,
            nroDocumento,
            resultados,
            convenio
        );
    } else if (convenio === "nueva-eps") {
        resultados[carpeta].servicios.add("General");
        resultados[carpeta].erroresPorServicio["General"] = resultados[carpeta].erroresPorServicio["General"] || [];
        if (!resultados[carpeta].erroresPorServicio["General"].some(e => e.includes("Falta 3.pdf"))) {
            resultados[carpeta].erroresPorServicio["General"].push("Falta 3.pdf (ADRES obligatorio para Nueva EPS)");
        }
        resultados[carpeta].pdfs = resultados[carpeta].pdfs || {};
        resultados[carpeta].pdfs["3.pdf"] = "✗";
    }

    // Validaciones finales por tipo de paquete (post-procesamiento)
    // Asegurar que existe "General" en servicios y erroresPorServicio
    if (!resultados[carpeta].servicios.has("General")) {
        resultados[carpeta].servicios.add("General");
    }
    resultados[carpeta].erroresPorServicio["General"] = resultados[carpeta].erroresPorServicio["General"] || [];
    resultados[carpeta].exitosPorServicio["General"] = resultados[carpeta].exitosPorServicio["General"] || [];
    
    // Si existen datos de la matriz para este paciente, validar contra la matriz
    if (resultados[carpeta].datosMatriz) {
        const mat = resultados[carpeta].datosMatriz;
        const servMatriz = mat.servicios || {};
        const servEventoMatriz = mat.serviciosEvento || {};
        const esPacienteSoloEvento = tipoPaquete === "EVENTO" || Boolean(mat.esFacturarEvento && !mat.paquete);

        // Validar si el paquete de la carpeta coincide con el de la matriz
        const matPaqCanonico = normalizarCodigoPaquete(mat.paquete);
        const tipoPaqCanonico = normalizarCodigoPaquete(tipoPaquete);
        if (mat.paquete && tipoPaquete && tipoPaquete !== "auto" && mat.paquete !== tipoPaquete && matPaqCanonico !== tipoPaqCanonico) {
            resultados[carpeta].erroresPorServicio["General"].push(
                `Discrepancia de Paquete: La carpeta física es ${tipoPaquete}, pero en la matriz está programado como ${mat.paquete}.`
            );
        }

        // Validar todos los servicios conocidos (omitiendo aquellos marcados expresamente como omitidos en la matriz)
        const colsOmitidas = new Set(
            (mat.columnasOmitidas || resultados[carpeta].columnasOmitidasMatriz || []).map(c => String(c).toUpperCase())
        );
        const todosServicios = ["VM", "VENF", "ENF", "TF", "TR", "TRS", "FON", "TO", "NUT", "TS", "PSI", "APL"];

        for (const s of todosServicios) {
            if (colsOmitidas.has(s) || (s === "TRS" && colsOmitidas.has("SUCCION"))) {
                continue; // Servicio omitido por el usuario en la matriz
            }

            // Para pacientes por evento, tomar la cantidad programada de las columnas de evento (Eve. Médica General, etc.)
            let cantEsperada = 0;
            if (esPacienteSoloEvento) {
                if (s === "VM") {
                    cantEsperada = servEventoMatriz.VM || 0;
                } else if (s === "VENF") {
                    cantEsperada = servEventoMatriz.VENF || 0;
                } else if (s === "ENF" || s === "ENF12") {
                    // Considerar turnos de enfermería/cuidador de evento
                    cantEsperada = (servEventoMatriz.ENF6 || 0) +
                        (servEventoMatriz.ENF8 || 0) +
                        (servEventoMatriz.ENF12 || 0) +
                        (servEventoMatriz.ENF12N || 0) +
                        (servEventoMatriz.ENF24 || 0) +
                        (servEventoMatriz.CUID6 || 0) +
                        (servEventoMatriz.CUID8 || 0) +
                        (servEventoMatriz.CUID12 || 0) +
                        (servEventoMatriz.CUID12N || 0) +
                        (servEventoMatriz.CUID24 || 0);
                } else if (s === "TF") {
                    cantEsperada = servEventoMatriz.TF || 0;
                } else if (s === "TR") {
                    cantEsperada = servEventoMatriz.TR || 0;
                } else if (s === "TRS" || s === "SUCCION") {
                    cantEsperada = servEventoMatriz.TRS || 0;
                } else if (s === "FON") {
                    cantEsperada = servEventoMatriz.FON || 0;
                } else if (s === "TO") {
                    cantEsperada = servEventoMatriz.TO || 0;
                } else if (s === "NUT") {
                    cantEsperada = servEventoMatriz.NUT || 0;
                } else if (s === "TS") {
                    cantEsperada = servEventoMatriz.TS || 0;
                } else if (s === "PSI") {
                    cantEsperada = servEventoMatriz.PSI || 0;
                } else if (s === "APL") {
                    cantEsperada = (servEventoMatriz.MED1 || 0) +
                        (servEventoMatriz.MED2 || 0) +
                        (servEventoMatriz.MED3 || 0) +
                        (servEventoMatriz.MED4 || 0);
                } else {
                    cantEsperada = servMatriz[s] || 0;
                }
            } else {
                cantEsperada = servMatriz[s] || 0;
            }

            // Para TRS o SUCCION, revisar ambas claves
            const cantEncontrada = s === "TRS" || s === "SUCCION"
                ? (resultados[carpeta].fechasPorServicio?.["TRS"]?.length || resultados[carpeta].fechasPorServicio?.["SUCCION"]?.length || 0)
                : (resultados[carpeta].fechasPorServicio?.[s]?.length || 0);

            const tieneArchivo = resultados[carpeta].servicios?.has(s) || 
                (s === "TRS" && resultados[carpeta].servicios?.has("SUCCION")) ||
                (s === "SUCCION" && resultados[carpeta].servicios?.has("TRS"));

            const nombreSoporte = `5 ${s.toLowerCase()}.pdf`;

            if (cantEsperada > 0) {
                if (!tieneArchivo) {
                    resultados[carpeta].erroresPorServicio["General"].push(
                        `${s}: En la matriz está programado ${cantEsperada} atención(es), pero falta el soporte ${nombreSoporte}`
                    );
                } else if (cantEncontrada !== cantEsperada) {
                    const detalleDiff = cantEncontrada > cantEsperada 
                        ? `(sobran ${cantEncontrada - cantEsperada})`
                        : `(faltan ${cantEsperada - cantEncontrada})`;
                    resultados[carpeta].erroresPorServicio["General"].push(
                        `${s}: En la matriz está programado ${cantEsperada} atención(es), pero en el soporte ${nombreSoporte} se registraron ${cantEncontrada} ${detalleDiff}`
                    );
                } else {
                    resultados[carpeta].exitosPorServicio["General"].push(
                        `${s}: ${cantEncontrada} evoluciones en ${nombreSoporte} (coincide con matriz: ${cantEsperada}) ✓`
                    );
                }
            } else {
                // cantEsperada === 0
                if (tieneArchivo && cantEncontrada > 0) {
                    resultados[carpeta].erroresPorServicio["General"].push(
                        `${s}: El soporte ${nombreSoporte} registra ${cantEncontrada} atención(es), pero en la matriz figura 0 programadas`
                    );
                }
            }
        }
    } else if (tipoPaquete.startsWith("CPF") || PAQUETES_SOPORTADOS.includes(tipoPaquete) || Boolean(REGLAS_TERAPIAS_PAQUETES[tipoPaquete])) {
        const esPaqueteParametrizado = PAQUETES_SOPORTADOS.includes(tipoPaquete) || Boolean(REGLAS_TERAPIAS_PAQUETES[tipoPaquete]);
        if (!esPaqueteParametrizado) {
            // Si el paquete no está parametrizado, no exigir reglas por defecto
            updateRow(carpeta, resultados[carpeta]);
            return;
        }

        const paqueteCanonico = normalizarCodigoPaquete(tipoPaquete);

        // En paquete nuevo sin matriz: validaciones por defecto
        const cantVM =
            resultados[carpeta].fechasPorServicio?.["VM"]?.length || 0;
        const cantENF =
            resultados[carpeta].fechasPorServicio?.["ENF"]?.length || 0;
        const cantVENF =
            resultados[carpeta].fechasPorServicio?.["VENF"]?.length || 0;

        const vmEsperada = (CODIGOS_PALIATIVOS.has(tipoPaquete) || CODIGOS_DIARIOS.has(tipoPaquete) || paqueteCanonico === "CPF1107" || paqueteCanonico === "CPF1225") ? 2 : 1;

        if (cantVM !== vmEsperada) {
            resultados[carpeta].erroresPorServicio["General"].push(
                `Paquete ${tipoPaquete} debe tener exactamente ${vmEsperada} evolución(es) de VM (tiene ${cantVM})`
            );
        } else {
            resultados[carpeta].exitosPorServicio["General"].push(
                `VM: ${vmEsperada} evolución(es) ✓`
            );
        }

        const esPaqueteAplicacion = CODIGOS_APLICACION.has(tipoPaquete) || ["CPF1102", "CPF1103", "CPF1104"].includes(paqueteCanonico);

        if (esPaqueteAplicacion) {
            // Paquetes de medicamentos solo requieren 1 VM, 1 ENF y APL
            if (!resultados[carpeta].servicios?.has("ENF") || cantENF !== 1) {
                resultados[carpeta].erroresPorServicio["General"].push(
                    `Paquete ${tipoPaquete} debe tener exactamente 1 evolución de ENF (tiene ${cantENF})`
                );
            } else {
                resultados[carpeta].exitosPorServicio["General"].push(
                    `ENF: 1 evolución ✓`
                );
            }

            const cantAPL = resultados[carpeta].fechasPorServicio?.["APL"]?.length || 0;
            if (!resultados[carpeta].servicios?.has("APL") || cantAPL === 0) {
                resultados[carpeta].erroresPorServicio["General"].push(
                    `Paquete ${tipoPaquete} requiere soporte 5 apl.pdf con registro de evolución de APL (tiene ${cantAPL})`
                );
            } else {
                resultados[carpeta].exitosPorServicio["General"].push(
                    `APL: ${cantAPL} evolución(es) registradas ✓`
                );
            }
        } else {
            if (CODIGOS_PALIATIVOS.has(tipoPaquete) || paqueteCanonico === "CPF1107") {
                // Paliativo: Exige 4 ENF
            if (!resultados[carpeta].servicios?.has("ENF") || cantENF !== 4) {
                resultados[carpeta].erroresPorServicio["General"].push(
                    `Paquete ${tipoPaquete} debe tener exactamente 4 evoluciones de ENF (tiene ${cantENF})`
                );
            } else {
                resultados[carpeta].exitosPorServicio["General"].push(
                    `ENF: 4 evoluciones ✓`
                );
            }
            if (resultados[carpeta].servicios?.has("VENF") && cantVENF > 0) {
                resultados[carpeta].erroresPorServicio["General"].push(
                    `Paquete ${tipoPaquete} no contempla VENF (tiene ${cantVENF})`
                );
            }
        } else {
            const tieneEnf = resultados[carpeta].servicios?.has("ENF");
            const tieneVenf = resultados[carpeta].servicios?.has("VENF");

            if (!tieneEnf && !tieneVenf) {
                resultados[carpeta].erroresPorServicio["General"].push(
                    `Paquete ${tipoPaquete} debe incluir al menos un servicio de enfermería (ENF o VENF)`
                );
            } else {
                if (tieneEnf) {
                    if (cantENF !== 1) {
                        resultados[carpeta].erroresPorServicio["General"].push(
                            `Paquete ${tipoPaquete} debe tener exactamente 1 evolución de ENF (tiene ${cantENF})`
                        );
                    } else {
                        resultados[carpeta].exitosPorServicio["General"].push(
                            `ENF: 1 evolución ✓`
                        );
                    }
                }

                if (tieneVenf) {
                    if (cantVENF !== 1) {
                        resultados[carpeta].erroresPorServicio["General"].push(
                            `Paquete ${tipoPaquete} debe tener exactamente 1 evolución de VENF (tiene ${cantVENF})`
                        );
                    } else {
                        resultados[carpeta].exitosPorServicio["General"].push(
                            `VENF: 1 evolución ✓`
                        );
                    }
                }
            }
        }

            // Validar que el opcional seleccionado tenga exactamente 1 evolución
            const opcionales = ["PSI", "NUT", "TS"];
            const opcionalEncontrado = opcionales.find(s => resultados[carpeta].servicios?.has(s));
            
            if (opcionalEncontrado) {
                const cantOpcional = resultados[carpeta].fechasPorServicio?.[opcionalEncontrado]?.length || 0;
                if (cantOpcional !== 1) {
                    resultados[carpeta].erroresPorServicio["General"].push(
                        `Paquete ${tipoPaquete} debe tener exactamente 1 evolución de ${opcionalEncontrado} (tiene ${cantOpcional})`
                    );
                } else {
                    resultados[carpeta].exitosPorServicio["General"].push(
                        `${opcionalEncontrado}: 1 evolución ✓`
                    );
                }
            }

            // Validar evoluciones de terapias según paquete
            const reglaTerapias = REGLAS_TERAPIAS_PAQUETES[tipoPaquete];
            let totalTerapias = 0;
            for (const s of TERAPIAS_CONTABLES) {
                totalTerapias +=
                    resultados[carpeta].fechasPorServicio?.[s]?.length || 0;
            }

            if (reglaTerapias && reglaTerapias.permiteTerapias === false) {
                if (totalTerapias > 0) {
                    resultados[carpeta].erroresPorServicio["General"].push(
                        `Paquete ${tipoPaquete} no contempla terapias y registra ${totalTerapias} evoluciones`
                    );
                }
            } else if (reglaTerapias && reglaTerapias.terapiasPermitidas && Array.isArray(reglaTerapias.terapiasPermitidas)) {
                let tieneNoPermitidas = false;
                for (const s of TERAPIAS_CONTABLES) {
                    const cant = resultados[carpeta].fechasPorServicio?.[s]?.length || 0;
                    if (cant > 0 && !reglaTerapias.terapiasPermitidas.includes(s)) {
                        tieneNoPermitidas = true;
                        resultados[carpeta].erroresPorServicio["General"].push(
                            `Paquete ${tipoPaquete} no permite ${s} (registra ${cant} evoluciones)`
                        );
                    }
                }
                if (!tieneNoPermitidas && totalTerapias > 0) {
                    resultados[carpeta].exitosPorServicio["General"].push(
                        `Terapias opcionales válidas (${reglaTerapias.terapiasPermitidas.join(", ")}): ${totalTerapias} evoluciones ✓`
                    );
                }
            } else if (reglaTerapias && reglaTerapias.permiteTerapias && reglaTerapias.min > 0) {
                const minTerapias = reglaTerapias.min;
                const maxTerapias = reglaTerapias.max;
                if (totalTerapias < minTerapias) {
                    resultados[carpeta].erroresPorServicio["General"].push(
                        `Paquete ${tipoPaquete} debe tener mínimo ${minTerapias} terapias (tiene ${totalTerapias})`
                    );
                } else if (totalTerapias > maxTerapias) {
                    resultados[carpeta].erroresPorServicio["General"].push(
                        `Paquete ${tipoPaquete} debe tener máximo ${maxTerapias} terapias (tiene ${totalTerapias})`
                    );
                } else {
                    resultados[carpeta].exitosPorServicio["General"].push(
                        `Terapias sumadas: ${totalTerapias} (${minTerapias}-${maxTerapias}) ✓`
                    );
                }
            } else if (reglaTerapias && reglaTerapias.permiteTerapias && totalTerapias > 0) {
                resultados[carpeta].exitosPorServicio["General"].push(
                    `Terapias registradas: ${totalTerapias} evoluciones ✓`
                );
            }
        }
    }

    // Refrescar fila después de validaciones finales
    updateRow(carpeta, resultados[carpeta]);
}

/**
 * Detecta los servicios presentes en los nombres de archivos
 */
function detectarServicios(nombres) {
    const serviciosEncontrados = new Set();
    for (const nombre of nombres) {
        const nombreUpper = nombre.toUpperCase();
        const match = nombreUpper.match(
            /\d+\s+(VM|VENF|ENF12|ENF|CH|TF|TRS|TR|TS|PSI|FON|TO|NUT|APL)/
        );
        if (match) {
            let servicio = match[1];
            if (servicio === "SUC") servicio = "SUCCION";
            serviciosEncontrados.add(servicio);
        }
    }
    return serviciosEncontrados;
}

/**
 * Valida un paquete nuevo
 */
function validarNuevoPaquete(
    carpeta,
    nombres,
    serviciosEncontrados,
    resultados,
    archivos,
    tipoPaquete,
    convenio
) {
    const serviciosReales = new Set(
        [...serviciosEncontrados].filter((s) => s !== "General" && s !== "PAQ")
    );

    const esEvento = tipoPaquete === "EVENTO" || Boolean(
        resultados[carpeta]?.datosMatriz?.esFacturarEvento && !resultados[carpeta]?.datosMatriz?.paquete
    );

    const esPaqueteParametrizado = esEvento || PAQUETES_SOPORTADOS.includes(tipoPaquete) || Boolean(REGLAS_TERAPIAS_PAQUETES[tipoPaquete]);
    if (!esPaqueteParametrizado) {
        resultados[carpeta].errores.push(`Paquete ${tipoPaquete}: Código de paquete no parametrizado en el sistema.`);
        return;
    }

    const paqueteCanonico = normalizarCodigoPaquete(tipoPaquete);
    const esPaqueteAplicacion = !esEvento && (CODIGOS_APLICACION.has(tipoPaquete) || ["CPF1102", "CPF1103", "CPF1104"].includes(paqueteCanonico));

    // 1. Validar Obligatorios y Prohibiciones (solo si no hay matriz; si hay matriz se valida contra ella)
    if (!resultados[carpeta].datosMatriz && !esEvento) {
        if (!serviciosReales.has("VM")) {
            resultados[carpeta].errores.push(`Paquete ${tipoPaquete} debe incluir servicio obligatorio VM`);
        }

        if (esPaqueteAplicacion) {
            if (!serviciosReales.has("ENF")) {
                resultados[carpeta].errores.push(`Paquete ${tipoPaquete} debe incluir servicio obligatorio ENF`);
            }
            if (!serviciosReales.has("APL")) {
                resultados[carpeta].errores.push(`Paquete ${tipoPaquete} debe incluir servicio de aplicación de medicamentos (APL)`);
            }

            // Prohibir opcionales en paquetes de medicamento
            const opcionalesProhibidos = ["PSI", "NUT", "TS"].filter(s => serviciosReales.has(s));
            if (opcionalesProhibidos.length > 0) {
                resultados[carpeta].errores.push(
                    `Paquete ${tipoPaquete} no contempla servicios opcionales (encontrados: ${opcionalesProhibidos.join(", ")})`
                );
            }

            // Prohibir terapias en paquetes de medicamento
            const terapiasProhibidas = [...TERAPIAS_CONTABLES].filter(s => serviciosReales.has(s) || (s === "TRS" && serviciosReales.has("SUCCION")));
            if (terapiasProhibidas.length > 0) {
                resultados[carpeta].errores.push(
                    `Paquete ${tipoPaquete} no contempla terapias (encontradas: ${terapiasProhibidas.join(", ")})`
                );
            }
        } else {
            // Paquetes normales (no medicamento) no contemplan APL
            if (serviciosReales.has("APL")) {
                resultados[carpeta].errores.push(
                    `Paquete ${tipoPaquete} no contempla servicio de aplicación de medicamentos (APL)`
                );
            }

            if (CODIGOS_PALIATIVOS.has(tipoPaquete) || paqueteCanonico === "CPF1107") {
                if (!serviciosReales.has("ENF")) {
                    resultados[carpeta].errores.push(`Paquete ${tipoPaquete} debe incluir servicio de auxiliar de enfermería (ENF)`);
                }
                if (serviciosReales.has("VENF")) {
                    resultados[carpeta].errores.push(`Paquete ${tipoPaquete} no contempla enfermería profesional (VENF)`);
                }
            } else {
                if (!serviciosReales.has("ENF") && !serviciosReales.has("VENF")) {
                    resultados[carpeta].errores.push(`Paquete ${tipoPaquete} debe incluir al menos un servicio de enfermería (ENF o VENF)`);
                }
            }

            // 2. Validar "Uno de los siguientes" (PSI, NUT, TS)
            const opcionales = ["PSI", "NUT", "TS"];
            const opcionalesEncontrados = opcionales.filter(s => serviciosReales.has(s));
            
            if (opcionalesEncontrados.length !== 1) {
                resultados[carpeta].errores.push(
                    `Paquete ${tipoPaquete} debe incluir exactamente 1 servicio de (PSI, NUT, TS). Se encontraron: ${opcionalesEncontrados.length}`
                );
            } else {
                const opcionalSelec = opcionalesEncontrados[0];
                resultados[carpeta].alertasPorServicio[opcionalSelec] = resultados[carpeta].alertasPorServicio[opcionalSelec] || [];
            }

            // 3. Validar prohibición de terapias según paquete
            const reglaTer = REGLAS_TERAPIAS_PAQUETES[tipoPaquete];
            if (reglaTer && reglaTer.permiteTerapias === false) {
                const terEncontradas = [...TERAPIAS_CONTABLES].filter(s => serviciosReales.has(s) || (s === "TRS" && serviciosReales.has("SUCCION")));
                if (terEncontradas.length > 0) {
                    resultados[carpeta].errores.push(
                        `Paquete ${tipoPaquete} no contempla terapias (encontradas en carpeta: ${terEncontradas.join(", ")})`
                    );
                }
            } else if (reglaTer && reglaTer.terapiasPermitidas && Array.isArray(reglaTer.terapiasPermitidas)) {
                const terNoPermitidas = [...serviciosReales].filter(s => {
                    const esTerapia = TERAPIAS_CONTABLES.has(s) || s === "SUCCION";
                    if (!esTerapia) return false;
                    const sNorm = s === "SUCCION" ? "TRS" : s;
                    return !reglaTer.terapiasPermitidas.includes(sNorm);
                });
                if (terNoPermitidas.length > 0) {
                    resultados[carpeta].errores.push(
                        `Paquete ${tipoPaquete} solo permite terapias (${reglaTer.terapiasPermitidas.join(", ")}). No admite: ${terNoPermitidas.join(", ")}`
                    );
                }
            }
        }
    }

    const tienePaq = nombres.some(n => n.toLowerCase() === "2 paq.pdf");

    if (esEvento) {
        // En modo EVENTO:
        // La autorización puede ser "2 paq.pdf" general O individual "2 [servicio].pdf"
        for (const servicio of serviciosReales) {
            const servicioLower = servicio.toLowerCase();
            const num2Individual = `2 ${servicioLower}.pdf`;
            const tiene2Individual = nombres.some(n => n.toLowerCase() === num2Individual);

            if (!tienePaq && !tiene2Individual) {
                resultados[carpeta].errores.push(
                    `Falta autorización para ${servicio}: debe incluir '${num2Individual}' o '2 PAQ.pdf'`
                );
            }
        }
    } else {
        // Archivos requeridos por servicio para PAQUETE
        // Validar que NO haya "2 [servicio].pdf"
        for (const servicio of serviciosReales) {
            const servicioLower = servicio.toLowerCase();
            const num2Individual = `2 ${servicioLower}.pdf`;
            if (nombres.some(n => n.toLowerCase() === num2Individual)) {
                resultados[carpeta].errores.push(`Archivo no permitido: ${num2Individual} (Todo se valida desde el 2 PAQ)`);
            }
        }

        // Exigir que exista "2 PAQ.pdf"
        if (!tienePaq) {
            resultados[carpeta].errores.push(`Paquete ${tipoPaquete} debe incluir archivo '2 PAQ.pdf'`);
        }
    }

    // En Nueva EPS es obligatorio el archivo "3.pdf" (ADRES)
    if (convenio === "nueva-eps") {
        const tiene3 = nombres.some(n => n.toLowerCase() === "3.pdf");
        if (!tiene3) {
            resultados[carpeta].erroresPorServicio["General"] = resultados[carpeta].erroresPorServicio["General"] || [];
            resultados[carpeta].erroresPorServicio["General"].push("Falta 3.pdf (ADRES obligatorio para Nueva EPS)");
            resultados[carpeta].pdfs = resultados[carpeta].pdfs || {};
            resultados[carpeta].pdfs["3.pdf"] = "✗";
        }
    }

    // Preparar UI
    for (const servicio of serviciosReales) {
        resultados[carpeta].pdfsPorServicio[servicio] = {};
        resultados[carpeta].erroresPorServicio[servicio] ||= [];
        resultados[carpeta].exitosPorServicio[servicio] ||= [];

        // Si es evento y tiene 2 [servicio].pdf, registrar el badge del 2
        if (esEvento) {
            const existe2 = nombres.some(n => n.toLowerCase() === `2 ${servicio.toLowerCase()}.pdf`);
            if (existe2) {
                resultados[carpeta].pdfsPorServicio[servicio]["2"] = "✔";
            }
        }

        for (const num of ["4", "5"]) {
            let existe = nombres.some(n => n.toLowerCase() === `${num} ${servicio.toLowerCase()}.pdf`);
            resultados[carpeta].pdfsPorServicio[servicio][num] = existe ? "✔" : "—";
            
            if (!existe) {
                resultados[carpeta].erroresPorServicio[servicio].push(`Falta ${num}.pdf`);
            } else {
                resultados[carpeta].exitosPorServicio[servicio].push(`${num}.pdf encontrado`);
            }
        }
    }
}

/**
 * Valida contenido de un PDF en modo paquete
 */
async function validarPDFPaquete(
    file,
    carpeta,
    nroDocumento,
    servicio,
    resultados,
    convenio = "capital-salud",
    tipoPaquete = "",
    periodoPermitido = null
) {
    let pdf = null;
    try {
        pdf = await pdfjsLib.getDocument({
            data: await file.arrayBuffer(),
        }).promise;

        let texto = await extraerTextoPDF(pdf);
        let textoPlanoNorm = normalizeForSearch(texto);

        // Extraer fechas digitales iniciales
        let fechas = extraerFechas(texto);

        // Helper para reintentar con OCR si aún no se ha ejecutado o si se requiere escanear más páginas
        let paginasOcrProcesadas = 0;
        const asegurarOCR = async (terminoBuscado = "", maxPags = 2, requerirFecha = false) => {
            if (paginasOcrProcesadas < maxPags) {
                const textoOCR = await extraerTextoOCRDePDF(pdf, maxPags, terminoBuscado, requerirFecha);
                paginasOcrProcesadas = Math.max(paginasOcrProcesadas, maxPags);
                if (textoOCR && textoOCR.trim().length > 0) {
                    texto = (texto + " " + textoOCR).trim();
                    textoPlanoNorm = normalizeForSearch(texto);
                    fechas = extraerFechas(texto);
                }
            }
        };

        // Si el archivo es de evoluciones (5.pdf) y no se detectaron fechas digitales o su texto está corrupto (Type 3),
        // activar OCR de inmediato sobre las primeras páginas para rescatar las fechas clínicas
        const numArchivoInicial = file.name.match(/^(\d+) /)?.[1];
        if (numArchivoInicial === "5" && (fechas.length === 0 || tieneTextoCorrupto(texto))) {
            const pagsEscanear = Math.min(pdf.numPages, 4);
            await asegurarOCR(nroDocumento, pagsEscanear, true);
        }

        // Determinar si es archivo "2 paq.pdf" (solo para fomag, o los nuevos)
        const esPaquete = file.name.toLowerCase().includes("paq.pdf") || file.name.toLowerCase().includes("paq");
        const numArchivo = file.name.match(/^(\d+) /)?.[1];

        // Validar número de documento en archivos 2 y 5 para FOMAG y Nueva EPS
        if (
            (convenio === "fomag" || convenio === "nueva-eps") &&
            (numArchivo === "2" || numArchivo === "5") &&
            servicio !== "PAQ"
        ) {
            if (!textoPlanoNorm.includes(nroDocumento)) {
                await asegurarOCR(nroDocumento);
            }

            if (!textoPlanoNorm.includes(nroDocumento)) {
                resultados[carpeta].erroresPorServicio[servicio] =
                    resultados[carpeta].erroresPorServicio[servicio] || [];
                resultados[carpeta].erroresPorServicio[servicio].push(
                    `${file.name}: no contiene número ${nroDocumento}`
                );
                // Marcar el badge del archivo con ✗
                if (resultados[carpeta].pdfsPorServicio[servicio] && numArchivo) {
                    resultados[carpeta].pdfsPorServicio[servicio][numArchivo] = "✗";
                }
            } else {
                // Agregar mensaje de éxito cuando se encuentra el documento
                resultados[carpeta].exitosPorServicio[servicio] =
                    resultados[carpeta].exitosPorServicio[servicio] || [];
                resultados[carpeta].exitosPorServicio[servicio].push(
                    `${file.name}: contiene número ${nroDocumento}`
                );
            }
        }

        // Si es paquete CPF o Nueva EPS y es el archivo "2 PAQ.pdf"
        if (esPaquete && numArchivo === "2" && (tipoPaquete.startsWith("CPF") || PAQUETES_SOPORTADOS.includes(tipoPaquete))) {
            const codigoBuscado = tipoPaquete.toUpperCase();
            if (!textoPlanoNorm.includes(codigoBuscado)) {
                await asegurarOCR();
            }

            // Validar que el código del paquete exista en el PDF
            if (!textoPlanoNorm.includes(codigoBuscado)) {
                resultados[carpeta].erroresPorServicio["General"] = resultados[carpeta].erroresPorServicio["General"] || [];
                resultados[carpeta].erroresPorServicio["General"].push(
                    `2 PAQ.pdf: no contiene el código del paquete ${tipoPaquete}`
                );
            } else {
                resultados[carpeta].exitosPorServicio["General"] = resultados[carpeta].exitosPorServicio["General"] || [];
                resultados[carpeta].exitosPorServicio["General"].push(
                    `2 PAQ.pdf: contiene el código ${tipoPaquete}`
                );
            }
        } 
        // Si es "2 paq.pdf" de FOMAG (antiguo), procesar múltiples servicios
        else if (esPaquete && numArchivo === "2" && convenio === "fomag" && !tipoPaquete.startsWith("CPF") && !PAQUETES_SOPORTADOS.includes(tipoPaquete)) {
            await procesarArchivoPaqueteFomag(
                file,
                carpeta,
                texto,
                textoPlanoNorm,
                resultados,
                nroDocumento
            );
        } else {
            // Procesamiento normal
            resultados[carpeta].fechas.push(...fechas);

            // Guardar fechas por servicio para archivo 5
            if (numArchivo === "5" && servicio !== "PAQ") {
                const fechasServicio = servicio === "PSI" ? fechas.slice(0, 1) : fechas;
                resultados[carpeta].fechasPorServicio[servicio] = fechasServicio;

                // Validar que las fechas pertenezcan al periodo permitido (error estricto)
                if (periodoPermitido && (periodoPermitido.desde || periodoPermitido.hasta)) {
                    const fechasFuera = fechasServicio.filter(
                        (f) => !estaFechaEnPeriodo(f, periodoPermitido.desde, periodoPermitido.hasta)
                    );
                    const periodoTextoCorto = formatearPeriodoLegible(periodoPermitido.desde, periodoPermitido.hasta, true);

                    if (fechasFuera.length > 0) {
                        resultados[carpeta].erroresPorServicio[servicio] =
                            resultados[carpeta].erroresPorServicio[servicio] || [];
                        const unicasFuera = [...new Set(fechasFuera)];
                        resultados[carpeta].erroresPorServicio[servicio].push(
                            `5.pdf: Fuera del periodo permitido ${periodoTextoCorto} (${unicasFuera.join(", ")})`
                        );
                        if (resultados[carpeta].pdfsPorServicio[servicio]) {
                            resultados[carpeta].pdfsPorServicio[servicio]["5"] = "✗";
                        }
                    } else if (fechasServicio.length > 0) {
                        resultados[carpeta].exitosPorServicio[servicio] =
                            resultados[carpeta].exitosPorServicio[servicio] || [];
                        resultados[carpeta].exitosPorServicio[servicio].push(
                            `5.pdf: Fechas dentro del periodo permitido (${periodoTextoCorto}) ✓`
                        );
                    }
                }

                // Validar fechas duplicadas y orden
                if (fechasServicio.length > 0) {
                    const { duplicadas, desordenadas, fechasDesordenadas } =
                        validarOrdenFechas(fechasServicio);

                    if (duplicadas.length > 0) {
                        resultados[carpeta].alertasPorServicio[servicio] =
                            resultados[carpeta].alertasPorServicio[servicio] ||
                            [];
                        resultados[carpeta].alertasPorServicio[servicio].push(
                            `5.pdf: Fechas duplicadas: ${duplicadas.join(", ")}`
                        );
                    } else {
                        // Agregar validación exitosa cuando no hay duplicadas
                        resultados[carpeta].exitosPorServicio[servicio] =
                            resultados[carpeta].exitosPorServicio[servicio] ||
                            [];
                        resultados[carpeta].exitosPorServicio[servicio].push(
                            `5.pdf: Sin fechas duplicadas`
                        );
                    }

                    if (desordenadas) {
                        resultados[carpeta].alertasPorServicio[servicio] =
                            resultados[carpeta].alertasPorServicio[servicio] ||
                            [];
                        const detalleDesorden = fechasDesordenadas?.length > 0
                            ? ` (${fechasDesordenadas.join(", ")})`
                            : "";
                        resultados[carpeta].alertasPorServicio[servicio].push(
                            `5.pdf: Fechas no están en orden cronológico${detalleDesorden}`
                        );
                    } else {
                        // Agregar validación exitosa cuando están en orden
                        resultados[carpeta].exitosPorServicio[servicio] =
                            resultados[carpeta].exitosPorServicio[servicio] ||
                            [];
                        resultados[carpeta].exitosPorServicio[servicio].push(
                            `5.pdf: Fechas en orden cronológico correcto`
                        );
                    }
                }
            }

            // Extraer número del texto para archivo 2 (paquetes / evento en paquete)
            if (numArchivo === "2" && servicio !== "PAQ") {
                const REGLAS_PAQUETE = obtenerReglasPaquete(convenio);
                const textoBuscar =
                    REGLAS_PAQUETE[servicio]?.["2.pdf"]?.debeContener || "";
                let numeroExtraido = await extraerCantidadTablaNuevaEps(pdf);
                if (numeroExtraido === null) {
                    numeroExtraido = extraerCantidadAutorizacion(texto, textoBuscar, servicio, convenio);
                }

                if (numeroExtraido !== null) {
                    resultados[carpeta].numeroAutorizaciones = numeroExtraido;
                    resultados[carpeta].numerosPorServicio =
                        resultados[carpeta].numerosPorServicio || {};
                    resultados[carpeta].numerosPorServicio[servicio] =
                        numeroExtraido;
                }
            }

            // Validaciones especiales para el 4.pdf
            if (numArchivo === "4" && servicio !== "PAQ") {
                resultados[carpeta].alertasPorServicio[servicio] =
                    resultados[carpeta].alertasPorServicio[servicio] || [];
                resultados[carpeta].exitosPorServicio[servicio] =
                    resultados[carpeta].exitosPorServicio[servicio] || [];

                // Validar número de páginas
                if (pdf.numPages > 1) {
                    resultados[carpeta].alertasPorServicio[servicio].push(
                        `4.pdf: Tiene ${pdf.numPages} páginas (se espera 1 sola página)`
                    );
                } else {
                    resultados[carpeta].exitosPorServicio[servicio].push(
                        `4.pdf: Tiene 1 página correctamente`
                    );
                }

                // Buscar palabra "dentificaci" para detectar si no es archivo de firmas
                if (textoPlanoNorm.includes("dentificaci")) {
                    resultados[carpeta].alertasPorServicio[servicio].push(
                        `4.pdf: Al parecer no es el archivo de firmas (contiene "identificación")`
                    );
                }
            }

            // Validar archivo 2 individual de FOMAG (solo para los paquetes antiguos o crónicos sin matriz)
            if (
                numArchivo === "2" &&
                servicio !== "PAQ" &&
                convenio === "fomag" &&
                !tipoPaquete.startsWith("CPF") &&
                !PAQUETES_SOPORTADOS.includes(tipoPaquete)
            ) {
                await validarArchivo2Fomag(
                    file,
                    carpeta,
                    servicio,
                    texto,
                    textoPlanoNorm,
                    fechas,
                    resultados
                );
            }
        }

        // Validar reglas (para archivos 2, 4 y 5)
        const REGLAS_PAQUETE = obtenerReglasPaquete(convenio);
        if (REGLAS_PAQUETE[servicio] && servicio !== "PAQ") {
            const claveArchivo = numArchivo ? `${numArchivo}.pdf` : null;

            // Aplicar reglas:
            // - Para archivo 2: solo si NO es "2 paq.pdf" y NO es un paquete nuevo (CPF / Nueva EPS)
            // - Para archivos 4 y 5: siempre
            const es2Paquete = esPaquete && numArchivo === "2";
            const esPaqueteNuevo = tipoPaquete.startsWith("CPF") || PAQUETES_SOPORTADOS.includes(tipoPaquete);
            const debeAplicarRegla = claveArchivo && !es2Paquete && !(numArchivo === "2" && esPaqueteNuevo);

            if (debeAplicarRegla && REGLAS_PAQUETE[servicio][claveArchivo]) {
                const regla = REGLAS_PAQUETE[servicio][claveArchivo];

                // Convertir debeContener a array si no lo es (compatibilidad)
                const textosABuscar = Array.isArray(regla.debeContener)
                    ? regla.debeContener
                    : [regla.debeContener];

                let textoEncontrado = null;

                // Buscar cualquiera de los textos
                for (const buscar of textosABuscar) {
                    const buscarNorm = normalizeForSearch(buscar);
                    if (textoPlanoNorm.includes(buscarNorm)) {
                        textoEncontrado = buscar;
                        break;
                    }
                }

                // Si no se encontró el texto, intentar OCR
                if (!textoEncontrado) {
                    await asegurarOCR();
                    for (const buscar of textosABuscar) {
                        const buscarNorm = normalizeForSearch(buscar);
                        if (textoPlanoNorm.includes(buscarNorm)) {
                            textoEncontrado = buscar;
                            break;
                        }
                    }
                }

                if (!textoEncontrado) {
                    resultados[carpeta].erroresPorServicio[servicio] =
                        resultados[carpeta].erroresPorServicio[servicio] || [];

                    const nombreMostrar = file?.name || `${numArchivo}.pdf`;
                    const mensajeFalta =
                        textosABuscar.length === 1
                            ? `${nombreMostrar}: no contiene el texto requerido "${textosABuscar[0]}"`
                            : `${nombreMostrar}: no contiene ninguno de los textos requeridos (${textosABuscar
                                  .map((t) => `"${t}"`)
                                  .join(" o ")})`;

                    resultados[carpeta].erroresPorServicio[servicio].push(
                        mensajeFalta
                    );
                    // Marcar el archivo con error
                    if (resultados[carpeta].pdfsPorServicio[servicio]) {
                        resultados[carpeta].pdfsPorServicio[servicio][
                            numArchivo
                        ] = "✗";
                    }
                } else {
                    resultados[carpeta].exitosPorServicio[servicio] =
                        resultados[carpeta].exitosPorServicio[servicio] || [];
                    const nombreMostrar = file?.name || `${numArchivo}.pdf`;
                    resultados[carpeta].exitosPorServicio[servicio].push(
                        `${nombreMostrar}: contiene "${textoEncontrado}"`
                    );

                    // Si es archivo 2 y aún no tenía cantidad extraída (ej. requirió OCR), extraer ahora con el textoEncontrado
                    if (numArchivo === "2") {
                        let cantExtraida = resultados[carpeta].numerosPorServicio?.[servicio] ?? null;
                        if (cantExtraida === null) {
                            cantExtraida = extraerCantidadAutorizacion(
                                texto,
                                textoEncontrado || textosABuscar,
                                servicio,
                                convenio
                            );
                            if (cantExtraida !== null) {
                                resultados[carpeta].numeroAutorizaciones = cantExtraida;
                                resultados[carpeta].numerosPorServicio =
                                    resultados[carpeta].numerosPorServicio || {};
                                resultados[carpeta].numerosPorServicio[servicio] = cantExtraida;
                            }
                        }
                        if (cantExtraida !== null) {
                            resultados[carpeta].exitosPorServicio[servicio].push(
                                `${nombreMostrar}: Cantidad autorizada: ${cantExtraida}`
                            );
                        }
                    }
                }

                // COMPARACIÓN: Solo para archivo 5.pdf y solo si NO es un nuevo paquete (en paquetes modernos se valida contra la matriz)
                const esPaqueteIntegral = tipoPaquete.startsWith("CPF") || PAQUETES_SOPORTADOS.includes(tipoPaquete);
                if (regla.igualarConFechas && numArchivo === "5" && !esPaqueteIntegral) {
                    // Obtener Cant Auto (del 2.pdf ya procesado)
                    const cantAuto =
                        resultados[carpeta].numerosPorServicio?.[servicio] || 0;

                    // Obtener Cant HC (fechas del 5.pdf actual)
                    const fechasComparar = servicio === "PSI" ? fechas.slice(0, 1) : fechas;
                    const cantHC = fechasComparar.length;

                    if (cantAuto !== cantHC) {
                        // Si autorizaciones < evoluciones: ERROR
                        if (cantAuto < cantHC) {
                            resultados[carpeta].erroresPorServicio[servicio] =
                                resultados[carpeta].erroresPorServicio[
                                servicio
                                ] || [];
                            resultados[carpeta].erroresPorServicio[
                                servicio
                            ].push(
                                `5.pdf: Cant autorizaciones ${cantAuto} < cant evoluciones ${cantHC}`
                            );
                            // Marcar el archivo con error
                            if (resultados[carpeta].pdfsPorServicio[servicio]) {
                                resultados[carpeta].pdfsPorServicio[servicio][
                                    "5"
                                ] = "✗";
                            }
                        }
                        // Si autorizaciones > evoluciones: ALERTA
                        else {
                            resultados[carpeta].alertasPorServicio[servicio] =
                                resultados[carpeta].alertasPorServicio[
                                servicio
                                ] || [];
                            resultados[carpeta].alertasPorServicio[
                                servicio
                            ].push(
                                `5.pdf: Cant autorizaciones ${cantAuto} > cant evoluciones ${cantHC}`
                            );
                        }
                    } else {
                        // Cuando coinciden, agregar validación exitosa
                        resultados[carpeta].exitosPorServicio[servicio] =
                            resultados[carpeta].exitosPorServicio[servicio] ||
                            [];
                        resultados[carpeta].exitosPorServicio[servicio].push(
                            `5.pdf: Cant autorizaciones ${cantAuto} = cant evoluciones ${cantHC}`
                        );
                    }
                }
            }
        }
    } catch (err) {
        console.error(`[Error procesando PDF] ${file?.name} en ${carpeta}:`, err);
        if (servicio && servicio !== "PAQ") {
            resultados[carpeta].erroresPorServicio[servicio] =
                resultados[carpeta].erroresPorServicio[servicio] || [];
            resultados[carpeta].erroresPorServicio[servicio].push(
                `${file.name}: error leyendo PDF (${err?.message || err})`
            );
            // Marcar el archivo con error
            const numArchivo = file.name.match(/^(\d+) /)?.[1];
            if (numArchivo && resultados[carpeta].pdfsPorServicio[servicio]) {
                resultados[carpeta].pdfsPorServicio[servicio][numArchivo] = "✗";
            }
        }
    } finally {
        if (pdf && pdf.destroy) {
            try {
                await pdf.destroy();
            } catch (_) {}
        }
    }
}

/**
 * Procesa archivo "2 paq.pdf" de FOMAG buscando múltiples servicios
 */
async function procesarArchivoPaqueteFomag(
    file,
    carpeta,
    texto,
    textoPlanoNorm,
    resultados,
    nroDocumento
) {
    // Servicios a buscar (los que se encontraron en archivos 4 y 5)
    const serviciosABuscar = resultados[carpeta].buscarEn2Paq || new Set();

    for (const servicio of serviciosABuscar) {
        // Buscar texto del servicio según las reglas
        const textoABuscar = obtenerTextoServicioFomag(servicio);
        if (!textoABuscar) continue;

        const textoNorm = normalizeForSearch(textoABuscar);
        const encontrado = textoPlanoNorm.includes(textoNorm);

        // Extraer el número
        const numero = encontrado
            ? extraerNumeroDelTexto(texto, textoABuscar)
            : null;

        // Log limpio con información relevante del 2.pdf - SIEMPRE mostrar
        // console.log(
        //     `\n📄 VALIDACIÓN ARCHIVO 2.pdf (PAQ)\n` +
        //         `   Carpeta: ${carpeta}\n` +
        //         `   Servicio: ${servicio}\n` +
        //         `   Archivo: ${file.name}\n` +
        //         `   Convenio: fomag\n` +
        //         `   Texto buscado: "${textoABuscar}"\n` +
        //         `   Cant. Auto encontrada: ${
        //             numero !== null ? numero : "NO ENCONTRADO"
        //         }\n` +
        //         `   Documento (${nroDocumento}): ${
        //             textoPlanoNorm.includes(nroDocumento)
        //                 ? "✓ Encontrado"
        //                 : "✗ NO encontrado"
        //         }\n` +
        //         `\n--- TEXTO COMPLETO DEL PDF ---\n${texto}\n--- FIN TEXTO ---\n`
        // );

        if (encontrado) {
            if (numero !== null) {
                // Guardar el número para validar después
                resultados[carpeta].numerosPorServicio =
                    resultados[carpeta].numerosPorServicio || {};
                resultados[carpeta].numerosPorServicio[servicio] = numero;

                // Marcar como encontrado
                resultados[carpeta].pdfsPorServicio[servicio]["2"] = "✔";
            }
        } else {
            resultados[carpeta].errores.push(
                `2 paq.pdf: no contiene texto para ${servicio}`
            );
        }
    }
}

/**
 * Valida archivo "2 [servicio].pdf" individual de FOMAG
 */
async function validarArchivo2Fomag(
    file,
    carpeta,
    servicio,
    texto,
    textoPlanoNorm,
    fechas,
    resultados
) {
    const textoABuscar = obtenerTextoServicioFomag(servicio);
    if (!textoABuscar) return;

    const textoNorm = normalizeForSearch(textoABuscar);

    if (!textoPlanoNorm.includes(textoNorm)) {
        resultados[carpeta].errores.push(
            `${file.name}: falta "${textoABuscar}"`
        );
        return;
    }

    // Extraer el número
    const numero = extraerNumeroDelTexto(texto, textoABuscar);

    if (numero !== null) {
        // Guardar el número
        resultados[carpeta].numerosPorServicio =
            resultados[carpeta].numerosPorServicio || {};
        resultados[carpeta].numerosPorServicio[servicio] = numero;

        // NO comparar aquí con fechas del archivo 5
        // La comparación se hace cuando se procesa el archivo 5.pdf (después de extraer sus fechas)
    } else {
        resultados[carpeta].erroresPorServicio[servicio] =
            resultados[carpeta].erroresPorServicio[servicio] || [];
        resultados[carpeta].erroresPorServicio[servicio].push(
            `${file.name}: no se pudo extraer el número después del texto`
        );
    }
}

/**
 * Valida el soporte 3.pdf (ADRES) en paquetes, especialmente para Nueva EPS
 */
async function validarArchivo3(
    file,
    carpeta,
    nroDocumento,
    resultados,
    convenio
) {
    let pdf = null;
    try {
        pdf = await pdfjsLib.getDocument({
            data: await file.arrayBuffer(),
        }).promise;

        let texto = await extraerTextoPDF(pdf);
        let textoNorm = normalizeForSearch(texto);

        // Si no contiene el documento o está vacío, probar OCR
        if (!textoNorm.includes(nroDocumento) || textoNorm.length < 20) {
            const textoOCR = await extraerTextoOCRDePDF(pdf, Math.min(pdf.numPages, 3), nroDocumento);
            if (textoOCR && textoOCR.trim().length > 0) {
                texto = (texto + " " + textoOCR).trim();
                textoNorm = normalizeForSearch(texto);
            }
        }

        resultados[carpeta].pdfs = resultados[carpeta].pdfs || {};
        resultados[carpeta].servicios.add("General");
        resultados[carpeta].erroresPorServicio["General"] = resultados[carpeta].erroresPorServicio["General"] || [];
        resultados[carpeta].exitosPorServicio["General"] = resultados[carpeta].exitosPorServicio["General"] || [];

        let tieneErrores3 = false;

        // 1. Validar número de documento
        const docNorm = normalizeForSearch(nroDocumento);
        if (docNorm && !textoNorm.includes(docNorm)) {
            resultados[carpeta].erroresPorServicio["General"].push(`3.pdf: no contiene número ${nroDocumento}`);
            tieneErrores3 = true;
        } else if (docNorm) {
            resultados[carpeta].exitosPorServicio["General"].push(`3.pdf: contiene número ${nroDocumento}`);
        }

        // 2. Si es Nueva EPS, validar texto "Nueva EPS" y estado "ACTIVO" (alerta si está "INACTIVO")
        if (convenio === "nueva-eps") {
            const contieneNuevaEps = textoNorm.includes("NUEVA EPS") || textoNorm.includes("NUEVAEPS");
            if (!contieneNuevaEps) {
                resultados[carpeta].erroresPorServicio["General"].push('3.pdf: no contiene el texto "Nueva EPS"');
                tieneErrores3 = true;
            } else {
                resultados[carpeta].exitosPorServicio["General"].push('3.pdf: contiene "Nueva EPS"');
            }

            const tieneInactivo = textoNorm.includes("INACTIVO") || textoNorm.includes("INACTIVA");
            const tieneActivo = textoNorm.includes("ACTIVO") || textoNorm.includes("ACTIVA");

            if (tieneInactivo) {
                resultados[carpeta].alertasPorServicio["General"] = resultados[carpeta].alertasPorServicio["General"] || [];
                resultados[carpeta].alertasPorServicio["General"].push('3.pdf: afiliado se encuentra en estado "INACTIVO"');
            } else if (tieneActivo) {
                resultados[carpeta].exitosPorServicio["General"].push('3.pdf: estado de afiliado "Activo"');
            }
        }

        resultados[carpeta].pdfs["3.pdf"] = tieneErrores3 ? "✗" : "✔";
    } catch {
        resultados[carpeta].servicios.add("General");
        resultados[carpeta].erroresPorServicio["General"] = resultados[carpeta].erroresPorServicio["General"] || [];
        resultados[carpeta].erroresPorServicio["General"].push("3.pdf: error leyendo PDF");
        resultados[carpeta].pdfs = resultados[carpeta].pdfs || {};
        resultados[carpeta].pdfs["3.pdf"] = "✗";
    } finally {
        if (pdf && pdf.destroy) {
            try {
                await pdf.destroy();
            } catch (_) {}
        }
    }
}
