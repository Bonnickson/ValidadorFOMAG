import * as pdfjsLib from "https://cdnjs.cloudflare.com/ajax/libs/pdf.js/4.0.379/pdf.min.mjs";
import {
    ALLOWED_TYPES,
    PDF_WORKER_URL,
} from "./config/constants.js";
import {
    validarPDF,
    validarArchivosPermitidosEvento,
    procesarArchivo2PaqEvento,
} from "./validators/eventoValidator.js";
import { validarPorPaquete } from "./validators/paqueteValidator.js";
import {
    actualizarHeadersTabla,
    createPlaceholderRow,
    updateRow,
} from "./ui/tableRenderer.js";
import {
    abrirPDFModal,
    cerrarModal,
    inicializarControlesPDF,
} from "./ui/pdfViewer.js";
import {
    mostrarCondicionesPaquete,
    mostrarModalReglasPaquete,
    mostrarAvisoRevisionFirmas,
    verArchivosCarpeta as verArchivosCarpetaUI,
} from "./ui/modalManager.js";
import {
    aplicarFiltros,
    reiniciarFiltros,
    actualizarResumen,
    actualizarProgreso,
    normalizarTipoError,
} from "./ui/filterManager.js";
import {
    copiarNumero,
    copiarFormatoCompleto,
    copiarHallazgosCompletos,
} from "./utils/clipboardUtils.js";
import {
    agruparArchivosInteligente,
    ordenarCarpetasPorPaquete,
    recorrerCarpetaRecursivo,
} from "./services/folderService.js";
import {
    cargarXLSX,
    exportarXLSX,
    exportarResumenErroresXLSX,
    exportarFomagEvento,
} from "./services/excelExportService.js";

// Configurar worker de PDF.js
pdfjsLib.GlobalWorkerOptions.workerSrc = PDF_WORKER_URL;

// Elementos del DOM
const input = document.getElementById("inputFolder");
const btnAbrirFS = document.getElementById("btnAbrirFS");
const btnDescargar = document.getElementById("btnDescargar");
const btnDescargarMatriz = document.getElementById("btnDescargarMatriz");
const estado = document.getElementById("estado");
const tabla = document.getElementById("tabla");
const tablaBody = document.querySelector("#tabla tbody");
const tablaHeader = document.getElementById("tablaHeader");
const tipoValidacionSelect = document.getElementById("tipoValidacion");
const tipoPaqueteSelect = document.getElementById("tipoPaquete");
const paqueteOptionsDiv = document.getElementById("paqueteOptions");
const convenioSelect = document.getElementById("convenio");
const resumenDiv = document.getElementById("resumen");
const filtrosDiv = document.getElementById("filtros");
const buscarDocumentoInput = document.getElementById("buscarDocumento");
const mostrarExitosCheckbox = document.getElementById("mostrarExitos");
const filtroServicioSelect = document.getElementById("filtroServicio");
const grupoFiltroEstado = document.getElementById("grupoFiltroEstado");
const limpiarFiltrosBtn = document.getElementById("limpiarFiltros");
const btnLimpiarTodo = document.getElementById("btnLimpiar");
const barraProgresoDiv = document.getElementById("barraProgreso");
const progresoTexto = document.getElementById("progresoTexto");
const progresoDetalle = document.getElementById("progresoDetalle");
const progresoPorcentaje = document.getElementById("progresoPorcentaje");
const progresoFill = document.getElementById("progresoFill");
const resumenErroresDiv = document.getElementById("resumenErrores");
const listaErroresDiv = document.getElementById("listaErrores");
const paqueteCondicionesContent = document.getElementById("paqueteCondicionesContent");

// Agrupación de elementos para gestores de UI
const domElements = {
    input,
    tabla,
    tablaBody,
    tablaHeader,
    resumenDiv,
    filtrosDiv,
    buscarDocumentoInput,
    mostrarExitosCheckbox,
    filtroServicioSelect,
    grupoFiltroEstado,
    resumenErroresDiv,
    listaErroresDiv,
    progresoFill,
    progresoPorcentaje,
    progresoTexto,
    progresoDetalle,
};

// Estado global de la aplicación
let todosLosResultados = {};
let todasLasCarpetas = [];
const appState = {
    estadoFiltroActivo: "",
    erroresSeleccionados: new Set(),
};

// Ceder ejecución al hilo principal para mantener la UI responsiva
const cederHiloPrincipal = () => new Promise((resolve) => setTimeout(resolve, 0));

/**
 * Selección de carpetas y filas en la tabla
 */
export function seleccionarCarpeta(carpeta, filaEspecifica = null) {
    if (!tablaBody) return;

    tablaBody.querySelectorAll("tr.selected, tr.selected-folder").forEach((tr) => {
        tr.classList.remove("selected", "selected-folder");
    });

    if (!carpeta) {
        if (filaEspecifica) filaEspecifica.classList.add("selected");
        return;
    }

    const selector = `tr[data-carpeta="${CSS.escape ? CSS.escape(carpeta) : carpeta}"]`;
    const filas = tablaBody.querySelectorAll(selector);
    filas.forEach((tr) => {
        tr.classList.add("selected-folder");
    });

    if (filaEspecifica) {
        filaEspecifica.classList.add("selected");
    } else if (filas.length > 0) {
        filas[0].classList.add("selected");
    }
}

export function seleccionarFila(fila) {
    if (!fila) return;
    const carpeta = fila.getAttribute("data-carpeta");
    seleccionarCarpeta(carpeta, fila);
}

/**
 * Limpia los resultados y resetea la interfaz
 */
function limpiarResultados(limpiarInput = false) {
    if (todosLosResultados) {
        Object.values(todosLosResultados).forEach((r) => {
            if (r && r.fileUrls) {
                Object.values(r.fileUrls).forEach((url) => {
                    if (url && typeof url === "string" && url.startsWith("blob:")) {
                        URL.revokeObjectURL(url);
                    }
                });
            }
        });
    }
    tablaBody.innerHTML = "";
    estado.classList.add("oculto");
    resumenDiv.classList.add("oculto");
    filtrosDiv.classList.add("oculto");
    barraProgresoDiv.classList.add("oculto");
    btnLimpiarTodo.classList.add("oculto");
    btnDescargar.classList.add("oculto");
    btnDescargarMatriz.classList.add("oculto");
    resumenErroresDiv.classList.add("oculto");

    if (limpiarInput && input) {
        input.value = "";
    }

    reiniciarFiltros(domElements, appState, false);
    todosLosResultados = {};
    todasLasCarpetas = [];
    listaErroresDiv.innerHTML = "";
    progresoFill.style.width = "0%";
}

/**
 * Inicializa el objeto de resultados para una carpeta
 */
function inicializarResultado(tipoValidacion, tipoPaquete, convenio = "capital-salud") {
    return {
        pdfs:
            tipoValidacion === "evento"
                ? {
                      "2.pdf": "—",
                      "3.pdf": "—",
                      "4.pdf": "—",
                      "5.pdf": "—",
                  }
                : {},
        pdfsPorServicio: {},
        fechasPorServicio: {},
        servicios: new Set(),
        errores: [],
        erroresPorServicio: {},
        exitosPorServicio: {},
        alertasPorServicio: {},
        fechas: [],
        fileUrls: {},
        tipoValidacion,
        tipoPaquete,
        convenio,
        buscarEn2Paq: new Set(),
        numerosPorServicio: {},
        numeroFomag: null,
    };
}

/**
 * Detecta el tipo de servicio desde el nombre de carpeta para validación por evento
 */
function detectarTipoCarpeta(carpeta, resultado, convenio = "capital-salud") {
    const carpetaUpper = carpeta.toUpperCase();
    const tipoDetectado = ALLOWED_TYPES.find((t) => carpetaUpper.includes(t));
    resultado.tipo = tipoDetectado || null;

    if (!tipoDetectado && convenio !== "fomag") {
        resultado.errores.push(
            `Por Evento: la carpeta debe incluir un tipo válido (${ALLOWED_TYPES.join(", ")})`
        );
    }
}

/**
 * Inicializa las URLs de los archivos PDF
 */
function inicializarURLsArchivos(archivos, resultado) {
    resultado.fileUrls = {
        "2.pdf": null,
        "3.pdf": null,
        "4.pdf": null,
        "5.pdf": null,
    };

    for (const f of archivos) {
        if (f.type === "application/pdf") {
            const url = URL.createObjectURL(f);
            resultado.fileUrls[f.name] = url;
            if (resultado.fileUrls.hasOwnProperty(f.name)) {
                resultado.fileUrls[f.name] = url;
            }
        }
    }
}

/**
 * Procesa la validación por evento para una carpeta
 */
async function procesarValidacionEvento(
    carpeta,
    archivos,
    nombres,
    nroDocumento,
    resultados,
    convenio
) {
    validarArchivosPermitidosEvento(archivos, resultados, carpeta, convenio);

    if (convenio === "fomag") {
        const tieneNum = (num) =>
            nombres.some((n) => new RegExp(`^${num}\\s+`, "i").test(n));
        ["2", "4", "5"].forEach((num) => {
            const key = `${num}.pdf`;
            if (nombres.includes(key) || tieneNum(num)) {
                resultados[carpeta].pdfs[key] = "✔";
            } else {
                resultados[carpeta].errores.push(`Falta ${key}`);
            }
        });
        resultados[carpeta].pdfs["3.pdf"] = nombres.includes("3.pdf")
            ? "✔"
            : "—";
    } else {
        ["2.pdf", "3.pdf", "4.pdf", "5.pdf"].forEach((p) => {
            if (nombres.includes(p)) {
                resultados[carpeta].pdfs[p] = "✔";
            } else {
                resultados[carpeta].errores.push(`Falta ${p}`);
            }
        });
    }

    const archivosPDF = archivos
        .filter((f) => f.type === "application/pdf")
        .sort((a, b) => {
            const numA = parseInt(a.name.match(/^(\d+)/)?.[1] || "99");
            const numB = parseInt(b.name.match(/^(\d+)/)?.[1] || "99");
            return numA - numB;
        });

    let archivo2Paq = null;
    const serviciosCon5 = new Set();

    if (convenio === "fomag") {
        archivo2Paq = archivos.find(
            (f) => f.name.toLowerCase() === "2 paq.pdf"
        );
        for (const nombre of nombres) {
            const match5 = nombre
                .toLowerCase()
                .match(
                    /^5\s+(vm|enf12|enf|venf|tf|tr|succion|suc|trs|ts|psi|to|fon|nut)\.pdf$/
                );
            if (match5) {
                let serv = match5[1];
                if (serv === "suc") serv = "succion";
                serviciosCon5.add(serv.toUpperCase());
            }
        }

        if (archivo2Paq && serviciosCon5.size > 0) {
            estado.textContent = `Procesando: ${carpeta} / 2 paq.pdf`;
            await procesarArchivo2PaqEvento(archivo2Paq, carpeta, resultados, [
                ...serviciosCon5,
            ]);
        }

        const serviciosDetectados = new Set();
        const regexServicioValidacion =
            /^([245])\s+(vm|enf12|enf|venf|tf|tr|succion|suc|trs|ts|psi|to|fon|nut)\.pdf$/i;

        for (const nombre of nombres) {
            const match = nombre.match(regexServicioValidacion);
            if (match) {
                let s = match[2].toLowerCase();
                if (s === "suc") s = "succion";
                serviciosDetectados.add(s.toUpperCase());
            }
        }

        for (const servicio of serviciosDetectados) {
            const srvLower = servicio.toLowerCase();
            const tiene5 = nombres.some((n) =>
                new RegExp(`^5\\s+${srvLower}\\.pdf$`, "i").test(n)
            );
            const tiene4 = nombres.some((n) =>
                new RegExp(`^4\\s+${srvLower}\\.pdf$`, "i").test(n)
            );
            const tiene2Individual = nombres.some((n) =>
                new RegExp(`^2\\s+${srvLower}\\.pdf$`, "i").test(n)
            );
            const tiene2Paq = nombres.some(
                (n) => n.toLowerCase() === "2 paq.pdf"
            );
            const tiene2 = tiene2Individual || tiene2Paq;

            resultados[carpeta].erroresPorServicio[servicio] =
                resultados[carpeta].erroresPorServicio[servicio] || [];

            if (!tiene5) resultados[carpeta].erroresPorServicio[servicio].push(`Falta 5 ${srvLower}.pdf`);
            if (!tiene4) resultados[carpeta].erroresPorServicio[servicio].push(`Falta 4 ${srvLower}.pdf`);
            if (!tiene2) resultados[carpeta].erroresPorServicio[servicio].push(`Falta 2 ${srvLower}.pdf (o 2 paq.pdf)`);
        }
    }

    for (const file of archivosPDF) {
        if (file.name.toLowerCase() === "2 paq.pdf") continue;

        estado.textContent = `Procesando: ${carpeta} / ${file.name}`;
        const carpetaIndex = todasLasCarpetas.indexOf(carpeta) + 1;
        if (carpetaIndex > 0) {
            actualizarProgreso(
                carpetaIndex,
                todasLasCarpetas.length,
                carpeta,
                file.name,
                domElements
            );
        }
        await validarPDF(file, carpeta, nroDocumento, resultados, convenio);
        updateRow(
            tablaBody,
            carpeta,
            resultados[carpeta],
            mostrarExitosCheckbox ? mostrarExitosCheckbox.checked : false
        );
    }
}

/**
 * Orquesta el procesamiento de archivos agrupados
 */
async function procesarLoteArchivos(archivosLista) {
    try {
        reiniciarFiltros(domElements, appState, false);
        tablaBody.innerHTML = "";
        estado.classList.remove("oculto");
        barraProgresoDiv.classList.remove("oculto");
        btnLimpiarTodo.classList.remove("oculto");
        resumenDiv.classList.add("oculto");
        filtrosDiv.classList.add("oculto");

        const resultados = {};
        const tipoValidacion = tipoValidacionSelect.value;
        const tipoPaqueteFallback = tipoPaqueteSelect.value;
        const convenio = convenioSelect.value;

        actualizarHeadersTabla(
            tabla,
            tablaHeader,
            tipoValidacion,
            tipoPaqueteFallback,
            convenio
        );

        const carpetasAgrupadas = agruparArchivosInteligente(
            archivosLista,
            tipoPaqueteFallback,
            tipoValidacion
        );
        const carpetasKeys = ordenarCarpetasPorPaquete(carpetasAgrupadas);
        const totalCarpetas = carpetasKeys.length;

        if (totalCarpetas === 0) {
            estado.classList.remove("oculto");
            estado.textContent =
                "❌ Error: No se encontraron carpetas. Asegúrate de seleccionar una carpeta (no archivos individuales).";
            return;
        }

        todasLasCarpetas = carpetasKeys;
        let carpetasProcesadas = 0;

        for (const carpetaKey of carpetasKeys) {
            const infoCarpeta = carpetasAgrupadas[carpetaKey];
            const carpeta = infoCarpeta.carpetaNombre;
            const paqueteParaCarpeta = infoCarpeta.tipoPaquete;

            resultados[carpetaKey] = inicializarResultado(
                tipoValidacion,
                paqueteParaCarpeta,
                convenio
            );
            resultados[carpetaKey].tipoPaquete = paqueteParaCarpeta;

            if (tipoValidacion === "evento") {
                detectarTipoCarpeta(carpeta, resultados[carpetaKey], convenio);
            } else {
                resultados[carpetaKey].tipo = paqueteParaCarpeta;
            }

            if (infoCarpeta.errorPaquete) {
                resultados[carpetaKey].servicios.add("General");
                resultados[carpetaKey].erroresPorServicio["General"] =
                    resultados[carpetaKey].erroresPorServicio["General"] || [];
                resultados[carpetaKey].erroresPorServicio["General"].push(
                    infoCarpeta.errorPaquete
                );
            }

            createPlaceholderRow(
                tablaBody,
                carpetaKey,
                tipoValidacion,
                paqueteParaCarpeta
            );

            const archivos = infoCarpeta.archivos;
            const nombres = archivos.map((a) => a.name);
            const nroDocumento = carpeta.match(/^\d+/)?.[0] || "";

            resultados[carpetaKey].nroDocumento = nroDocumento;
            resultados[carpetaKey].primerArchivoRelPath =
                archivos[0]?.webkitRelativePath || carpeta;
            resultados[carpetaKey].listaArchivos = nombres;
            inicializarURLsArchivos(archivos, resultados[carpetaKey]);

            if (tipoValidacion === "paquete") {
                await validarPorPaquete(
                    carpetaKey,
                    archivos,
                    paqueteParaCarpeta,
                    nroDocumento,
                    resultados,
                    estado,
                    (carp, res) =>
                        updateRow(
                            tablaBody,
                            carp,
                            res,
                            mostrarExitosCheckbox.checked
                        ),
                    convenio,
                    (nombreArchivo) => {
                        actualizarProgreso(
                            carpetasProcesadas + 1,
                            totalCarpetas,
                            carpeta,
                            nombreArchivo,
                            domElements
                        );
                    }
                );
            } else {
                await procesarValidacionEvento(
                    carpetaKey,
                    archivos,
                    nombres,
                    nroDocumento,
                    resultados,
                    convenio
                );
                updateRow(
                    tablaBody,
                    carpetaKey,
                    resultados[carpetaKey],
                    mostrarExitosCheckbox.checked
                );
            }

            const row = document.querySelector(`tr[data-carpeta="${carpetaKey}"]`);
            if (row) row.classList.remove("processing");

            carpetasProcesadas++;
            actualizarProgreso(carpetasProcesadas, totalCarpetas, carpeta, "", domElements);
            actualizarResumen(resultados, domElements, appState, true, exportarResumenErroresXLSX);

            await cederHiloPrincipal();
        }

        todosLosResultados = resultados;
        actualizarResumen(resultados, domElements, appState, false, exportarResumenErroresXLSX);
        btnDescargar.classList.remove("oculto");

        if (tipoValidacion === "evento" && convenio === "fomag") {
            btnDescargarMatriz.classList.remove("oculto");
        } else {
            btnDescargarMatriz.classList.add("oculto");
        }

        estado.classList.add("oculto");
        barraProgresoDiv.classList.add("oculto");
    } catch (error) {
        console.error("❌ Error en procesamiento de lote:", error);
        estado.classList.remove("oculto");
        estado.textContent = `❌ Error: ${error.message}`;
    }
}

// ================= CONFIGURACIÓN DE EVENT LISTENERS =================

// Input file selector
input.addEventListener("change", async () => {
    await procesarLoteArchivos(input.files);
});

// Selector de File System Access API
if (btnAbrirFS) {
    btnAbrirFS.addEventListener("click", async () => {
        if (!window.showDirectoryPicker) {
            alert(
                "Esta opción requiere Chrome/Edge con permisos de sitio. Abra en Chrome o use el selector de carpeta."
            );
            return;
        }
        try {
            const dirHandle = await window.showDirectoryPicker();
            estado.classList.remove("oculto");
            estado.textContent = "🔍 Escaneando carpetas...";

            const files = await recorrerCarpetaRecursivo(dirHandle);
            if (files.length === 0) {
                estado.textContent = "❌ No se encontraron archivos en la carpeta seleccionada.";
                return;
            }
            await procesarLoteArchivos(files);
        } catch (error) {
            if (error.name !== "AbortError") {
                console.error("Error al abrir carpeta:", error);
                estado.classList.remove("oculto");
                estado.textContent = `❌ Error: ${error.message}`;
            }
        }
    });
}

// Botones de descarga Excel
btnDescargar.addEventListener("click", async () => {
    if (!todosLosResultados || Object.keys(todosLosResultados).length === 0) {
        alert("No hay resultados para descargar");
        return;
    }
    const ok = await cargarXLSX();
    if (!ok) {
        alert("No se pudo cargar la librería XLSX. Verifica tu conexión a internet.");
        return;
    }
    exportarXLSX(todosLosResultados);
});

btnDescargarMatriz.addEventListener("click", async () => {
    const ok = await cargarXLSX();
    if (!ok) {
        alert("No se pudo cargar la librería XLSX. Verifica tu conexión a internet.");
        return;
    }
    exportarFomagEvento(todosLosResultados);
});

btnLimpiarTodo.addEventListener("click", () => {
    limpiarResultados(true);
});

// Eventos de configuración de parámetros
function manejarCambioConfiguracion() {
    limpiarResultados(false);
    if (tipoValidacionSelect.value === "paquete" && convenioSelect.value === "capital-salud") {
        tipoValidacionSelect.value = "evento";
        paqueteOptionsDiv.classList.add("oculto");
        estado.classList.remove("oculto");
        estado.textContent = "Capital Salud no valida por paquete. Cambiando a Evento.";
        setTimeout(() => estado.classList.add("oculto"), 2500);
    } else {
        if (tipoValidacionSelect.value === "paquete") {
            paqueteOptionsDiv.classList.remove("oculto");
        } else {
            paqueteOptionsDiv.classList.add("oculto");
        }
    }
    actualizarHeadersTabla(
        tabla,
        tablaHeader,
        tipoValidacionSelect.value,
        tipoPaqueteSelect.value,
        convenioSelect.value
    );
    mostrarCondicionesPaquete(tipoPaqueteSelect, paqueteCondicionesContent);
}

tipoValidacionSelect.addEventListener("change", manejarCambioConfiguracion);
tipoPaqueteSelect.addEventListener("change", () => {
    limpiarResultados(false);
    actualizarHeadersTabla(
        tabla,
        tablaHeader,
        tipoValidacionSelect.value,
        tipoPaqueteSelect.value,
        convenioSelect.value
    );
    mostrarCondicionesPaquete(tipoPaqueteSelect, paqueteCondicionesContent);
});
convenioSelect.addEventListener("change", manejarCambioConfiguracion);

// Event listeners de filtros y búsqueda
buscarDocumentoInput.addEventListener("input", () => aplicarFiltros(domElements, appState));
mostrarExitosCheckbox.addEventListener("change", () => aplicarFiltros(domElements, appState));
filtroServicioSelect.addEventListener("change", () => aplicarFiltros(domElements, appState));

if (grupoFiltroEstado) {
    grupoFiltroEstado.addEventListener("click", (e) => {
        const btn = e.target.closest(".btn-segmented");
        if (!btn) return;
        const nuevoEstado = btn.getAttribute("data-estado") || "";
        grupoFiltroEstado.querySelectorAll(".btn-segmented").forEach((b) => b.classList.remove("active"));
        btn.classList.add("active");
        appState.estadoFiltroActivo = nuevoEstado;
        aplicarFiltros(domElements, appState);

        if (nuevoEstado === "con-novedades") {
            mostrarAvisoRevisionFirmas();
        }
    });
}

limpiarFiltrosBtn.addEventListener("click", () => {
    reiniciarFiltros(domElements, appState, true);
});

// Selección de tipos de error en el resumen
listaErroresDiv.addEventListener("click", (e) => {
    const item = e.target.closest(".error-card-pill, .error-tipo-item");
    if (!item) return;
    const tipo = item.getAttribute("data-tipo");
    if (!tipo) return;
    const tipoNorm = item.getAttribute("data-tipo-normalized") || normalizarTipoError(tipo);

    if (item.classList.toggle("selected")) {
        appState.erroresSeleccionados.add(tipoNorm);
    } else {
        appState.erroresSeleccionados.delete(tipoNorm);
    }
    aplicarFiltros(domElements, appState);
});

// Selección de filas al hacer clic en la tabla
tablaBody.addEventListener("click", (event) => {
    const fila = event.target.closest("tr");
    if (fila && fila.parentElement === tablaBody) {
        seleccionarFila(fila);
    }
});

// Inicialización de la aplicación al cargar el DOM
document.addEventListener("DOMContentLoaded", () => {
    const tipoValidacionInicial = tipoValidacionSelect.value;
    if (tipoValidacionInicial === "paquete") {
        paqueteOptionsDiv.classList.remove("oculto");
    } else {
        paqueteOptionsDiv.classList.add("oculto");
    }
    mostrarCondicionesPaquete(tipoPaqueteSelect, paqueteCondicionesContent);
    inicializarControlesPDF();
});

// ================= EXPOSICIÓN GLOBAL PARA COMPATIBILIDAD CON UI =================
window.abrirPDFModal = (url, titulo, anchorEl) => abrirPDFModal(url, titulo, anchorEl, seleccionarFila);
window.cerrarModal = cerrarModal;
window.seleccionarCarpeta = seleccionarCarpeta;
window.seleccionarFila = seleccionarFila;
window.verArchivosCarpeta = (carpeta, triggerEl) =>
    verArchivosCarpetaUI(carpeta, triggerEl, todosLosResultados, seleccionarCarpeta, abrirPDFModal);
window.copiarNumero = (event, carpeta) => copiarNumero(event, carpeta, seleccionarCarpeta);
window.copiarFormatoCompleto = (event, paquete, carpeta) =>
    copiarFormatoCompleto(event, paquete, carpeta, seleccionarCarpeta);
window.copiarHallazgosCompletos = (event, carpeta) =>
    copiarHallazgosCompletos(event, carpeta, todosLosResultados, seleccionarCarpeta);
window.mostrarAvisoRevisionFirmas = mostrarAvisoRevisionFirmas;
window.mostrarModalReglasPaquete = mostrarModalReglasPaquete;
