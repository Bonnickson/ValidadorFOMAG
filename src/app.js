import * as pdfjsLib from "https://cdnjs.cloudflare.com/ajax/libs/pdf.js/4.0.379/pdf.min.mjs";
import * as XLSX from "https://cdn.sheetjs.com/xlsx-0.20.3/package/xlsx.mjs";
import {
    ALLOWED_TYPES,
    PAQUETES_SOPORTADOS,
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
let estadoFiltroActivo = "con-novedades";
const limpiarFiltrosBtn = document.getElementById("limpiarFiltros");
const btnLimpiarTodo = document.getElementById("btnLimpiar");
const barraProgresoDiv = document.getElementById("barraProgreso");
const progresoTexto = document.getElementById("progresoTexto");
const progresoDetalle = document.getElementById("progresoDetalle");
const progresoPorcentaje = document.getElementById("progresoPorcentaje");
const progresoFill = document.getElementById("progresoFill");
const resumenErroresDiv = document.getElementById("resumenErrores");
const listaErroresDiv = document.getElementById("listaErrores");
const paqueteCondicionesIcon = document.getElementById(
    "paqueteCondicionesIcon",
);
const paqueteCondicionesContent = document.getElementById(
    "paqueteCondicionesContent",
);

// Verificación de elementos críticos
console.log("Verificando elementos del DOM:");
console.log("- input:", !!input);
console.log("- tabla:", !!tabla);
console.log("- tablaBody:", !!tablaBody);
console.log("- estado:", !!estado);
console.log("- btnAbrirFS:", !!btnAbrirFS);
if (!input || !tabla || !tablaBody || !estado) {
    console.error("❌ Elementos críticos del DOM no encontrados");
}

// Archivos que deben ignorarse por completo
const IGNORAR_ARCHIVOS = new Set(["desktop.ini", "thumbs.db", ".ds_store"]);

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
 * Agrupa archivos de manera inteligente detectando jerarquía de carpetas:
 * - 3+ niveles: [Raíz] / [Paquete] / [Paciente] / archivos.pdf
 * - 2 niveles: [Paquete] / [Paciente] / archivos.pdf
 * - 1 nivel: [Paciente] / archivos.pdf
 */
export function agruparArchivosInteligente(
    archivosLista,
    fallbackTipoPaquete,
    tipoValidacion,
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
            "/",
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

// Agrupa errores similares (ej: distintas cantidades de autorizaciones/evoluciones) bajo un tipo general
function clasificarErrorResumen(error) {
    const authEvoRegex = /cant\s+autorizaciones[^\n]*cant\s+evoluciones/i;
    if (authEvoRegex.test(error)) {
        return {
            tipo: "Cant autorizaciones ≠ cant evoluciones",
            detalle:
                "Revisar que las autorizaciones coincidan con las evoluciones",
        };
    }

    const [tipoRaw, ...resto] = error.split(":");
    const tipo = (tipoRaw || "").trim() || "Error";
    const detalle = resto.join(":").trim();
    return { tipo, detalle };
}

// Variables globales para filtrado
let todosLosResultados = {};
let todasLasCarpetas = [];
const erroresSeleccionados = new Set(); // almacena tipos normalizados

const normalizarTipoError = (txt) => (txt || "").trim().toLowerCase();

/**
 * Limpia los resultados y resetea la tabla
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
    if (limpiarInput) {
        input.value = "";
    }
    reiniciarFiltros(false);
    todosLosResultados = {};
    todasLasCarpetas = [];
    listaErroresDiv.innerHTML = "";
    progresoFill.style.width = "0%";
}

// Event listener para botón limpiar todo
btnLimpiarTodo.addEventListener("click", () => {
    limpiarResultados(true); // Sí limpiar input
});

btnDescargarMatriz.addEventListener("click", () => {
    exportarFomagEvento(todosLosResultados);
});

// Event listeners para cambios de configuración
tipoValidacionSelect.addEventListener("change", () => {
    limpiarResultados(false); // No limpiar input
    // Si convenio es Capital Salud, no permitir paquete
    if (
        tipoValidacionSelect.value === "paquete" &&
        convenioSelect.value === "capital-salud"
    ) {
        tipoValidacionSelect.value = "evento";
        paqueteOptionsDiv.classList.add("oculto");
        estado.classList.remove("oculto");
        estado.textContent =
            "Capital Salud no valida por paquete. Cambiando a Evento.";
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
        convenioSelect.value,
    );
    mostrarCondicionesPaquete();
});

tipoPaqueteSelect.addEventListener("change", () => {
    limpiarResultados(false);
    actualizarHeadersTabla(
        tabla,
        tablaHeader,
        tipoValidacionSelect.value,
        tipoPaqueteSelect.value,
        convenioSelect.value,
    );
    mostrarCondicionesPaquete();
});

convenioSelect.addEventListener("change", () => {
    limpiarResultados(false); // No limpiar input
    // Si se cambia a Capital Salud y estaba en paquete, forzar evento
    if (
        convenioSelect.value === "capital-salud" &&
        tipoValidacionSelect.value === "paquete"
    ) {
        tipoValidacionSelect.value = "evento";
        paqueteOptionsDiv.classList.add("oculto");
        estado.classList.remove("oculto");
        estado.textContent =
            "Capital Salud no valida por paquete. Cambiando a Evento.";
        setTimeout(() => estado.classList.add("oculto"), 2500);
    }
    actualizarHeadersTabla(
        tabla,
        tablaHeader,
        tipoValidacionSelect.value,
        tipoPaqueteSelect.value,
        convenioSelect.value,
    );
    mostrarCondicionesPaquete();
});

// Función para mostrar condiciones del paquete
function mostrarCondicionesPaquete() {
    if (!paqueteCondicionesContent) return;

    const paquete = tipoPaqueteSelect.value;
    let terapias = "";

    switch (paquete) {
        case "auto":
            terapias = "Detección automática por carpeta para cada paciente.";
            break;
        case "CPF1109":
            terapias = "Entre 6 y 12 evoluciones sumadas en total.";
            break;
        case "CPF1110":
            terapias = "Entre 12 y 20 evoluciones sumadas en total.";
            break;
        case "CPF1105":
        case "CPF1106":
            terapias = "Entre 12 y 30 evoluciones sumadas en total.";
            break;
        case "CPF1108":
            terapias = "Sin requisitos específicos de cantidad.";
            break;
        default:
            terapias = "Requisitos según paquete.";
    }

    const html = `
        <div class="paquete-rules-card">
            <div class="rule-group">
                <span class="rule-label">Archivo Base:</span>
                <span class="rule-value">Código en <code>2 PAQ.pdf</code></span>
            </div>
            <div class="rule-group">
                <span class="rule-label">Fijos Obligatorios:</span>
                <div class="rule-chips">
                    <span class="rule-chip required">VM: 1</span>
                    <span class="rule-chip required">ENF: 1</span>
                    <span class="rule-chip required">VENF: 1</span>
                </div>
            </div>
            <div class="rule-group">
                <span class="rule-label">A Elección (1 solo):</span>
                <div class="rule-chips">
                    <span class="rule-chip choice">PSI (1)</span>
                    <span class="rule-chip choice">NUT (1)</span>
                    <span class="rule-chip choice">TS (1)</span>
                </div>
            </div>
            <div class="rule-group">
                <span class="rule-label">Terapias:</span>
                <span class="rule-value highlight">${terapias}</span>
            </div>
        </div>
    `;

    paqueteCondicionesContent.innerHTML = html;
}

// Inicializar condiciones al cargar
document.addEventListener("DOMContentLoaded", () => {
    // Inicializar visibilidad de paquete options según valor por defecto
    const tipoValidacionInicial = tipoValidacionSelect.value;
    if (tipoValidacionInicial === "paquete") {
        paqueteOptionsDiv.classList.remove("oculto");
    } else {
        paqueteOptionsDiv.classList.add("oculto");
    }

    // Mostrar condiciones del paquete
    mostrarCondicionesPaquete();
});

// Función para reiniciar todos los filtros a su estado por defecto
function reiniciarFiltros(ejecutarAplicar = true) {
    buscarDocumentoInput.value = "";
    filtroServicioSelect.value = "";
    estadoFiltroActivo = "con-novedades";
    if (grupoFiltroEstado) {
        grupoFiltroEstado.querySelectorAll(".btn-segmented").forEach((btn) => {
            btn.classList.toggle("active", btn.getAttribute("data-estado") === "con-novedades");
        });
    }
    mostrarExitosCheckbox.checked = false;
    erroresSeleccionados.clear();
    listaErroresDiv
        .querySelectorAll(".error-tipo-item.selected, .error-card-pill.selected")
        .forEach((el) => el.classList.remove("selected"));
    if (ejecutarAplicar) {
        aplicarFiltros();
    }
}

// Event listeners para filtros
buscarDocumentoInput.addEventListener("input", aplicarFiltros);
mostrarExitosCheckbox.addEventListener("change", aplicarFiltros);
filtroServicioSelect.addEventListener("change", aplicarFiltros);

if (grupoFiltroEstado) {
    grupoFiltroEstado.addEventListener("click", (e) => {
        const btn = e.target.closest(".btn-segmented");
        if (!btn) return;
        grupoFiltroEstado
            .querySelectorAll(".btn-segmented")
            .forEach((b) => b.classList.remove("active"));
        btn.classList.add("active");
        estadoFiltroActivo = btn.getAttribute("data-estado") || "";
        aplicarFiltros();
    });
}

limpiarFiltrosBtn.addEventListener("click", () => {
    reiniciarFiltros(true);
});

// Selección de tipos de error desde el resumen
listaErroresDiv.addEventListener("click", (e) => {
    const item = e.target.closest(".error-card-pill, .error-tipo-item");
    if (!item) return;
    const tipo = item.getAttribute("data-tipo");
    if (!tipo) return;
    const tipoNorm =
        item.getAttribute("data-tipo-normalized") || normalizarTipoError(tipo);

    if (item.classList.toggle("selected")) {
        erroresSeleccionados.add(tipoNorm);
    } else {
        erroresSeleccionados.delete(tipoNorm);
    }
    aplicarFiltros();
});

/**
 * Aplica los filtros a la tabla
 */
function aplicarFiltros() {
    const buscarDoc = buscarDocumentoInput.value.trim().toLowerCase();
    const filtroServ = filtroServicioSelect.value;
    const filtroEst = estadoFiltroActivo;
    const mostrarExitos = mostrarExitosCheckbox.checked;
    const tiposErroresActivos = new Set(erroresSeleccionados);

    const filas = tablaBody.querySelectorAll("tr");

    // Agrupar filas por carpeta para el filtro de estado
    const filasPorCarpeta = {};
    filas.forEach((fila) => {
        const carpeta = fila.getAttribute("data-carpeta");
        if (carpeta) {
            if (!filasPorCarpeta[carpeta]) {
                filasPorCarpeta[carpeta] = [];
            }
            filasPorCarpeta[carpeta].push(fila);
        }
    });

    // Aplicar filtros
    Object.entries(filasPorCarpeta).forEach(([carpeta, filasCarpeta]) => {
        // Filtro por documento
        let mostrarCarpeta = true;
        if (buscarDoc && !carpeta.toLowerCase().includes(buscarDoc)) {
            mostrarCarpeta = false;
        }

        // Aplicar visibilidad a cada fila
        const filasVisibles = [];
        filasCarpeta.forEach((fila) => {
            let mostrarFila = mostrarCarpeta;

            // Filtro por servicio (solo aplica a filas que tengan data-servicio)
            if (filtroServ && mostrarFila) {
                const servicioFila = fila.getAttribute("data-servicio");
                // Si la fila NO tiene data-servicio (es modo evento), no aplicar filtro de servicio
                if (servicioFila) {
                    const coincide =
                        servicioFila === filtroServ ||
                        ((filtroServ === "TRS" || filtroServ === "SUCCION") &&
                            (servicioFila === "TRS" || servicioFila === "SUCCION"));
                    if (!coincide) {
                        mostrarFila = false;
                    }
                }
            }

            // Filtro por estado
            if (filtroEst && mostrarFila) {
                const estadoFila = fila.getAttribute("data-estado");
                if (filtroEst === "con-novedades") {
                    // Mostrar solo filas que tengan errores o alertas (no conformes)
                    if (estadoFila === "sin-errores") {
                        mostrarFila = false;
                    }
                } else if (estadoFila !== filtroEst) {
                    mostrarFila = false;
                }
            }

            // Filtro por tipos de error seleccionados (multi-select)
            if (tiposErroresActivos.size > 0 && mostrarFila) {
                const erroresFila = fila.querySelectorAll(
                    ".error-item[data-error-type]",
                );
                const coincide = Array.from(erroresFila).some((err) => {
                    const tNorm =
                        err.getAttribute("data-error-type-normalized") ||
                        normalizarTipoError(
                            err.getAttribute("data-error-type") || "",
                        );
                    return tiposErroresActivos.has(tNorm);
                });
                if (!coincide) {
                    mostrarFila = false;
                }
            }

            if (mostrarFila) {
                fila.style.display = "";
                filasVisibles.push(fila);
            } else {
                fila.style.display = "none";
            }
        });

        // Recalcular rowspan para la celda agrupada de la carpeta
        let cellCarpeta = null;
        for (const fila of filasCarpeta) {
            const cell = fila.querySelector("td.carpeta-cell.doc-header-grouped");
            if (cell) {
                cellCarpeta = cell;
                break;
            }
        }

        if (cellCarpeta) {
            if (filasVisibles.length > 0) {
                const primeraVisible = filasVisibles[0];
                if (!primeraVisible.contains(cellCarpeta)) {
                    primeraVisible.insertAdjacentElement("afterbegin", cellCarpeta);
                }
                cellCarpeta.setAttribute("rowspan", filasVisibles.length);
                cellCarpeta.style.display = "";
            } else {
                const headerRow = filasCarpeta[0];
                if (headerRow && !headerRow.contains(cellCarpeta)) {
                    headerRow.insertAdjacentElement("afterbegin", cellCarpeta);
                }
                cellCarpeta.setAttribute("rowspan", filasCarpeta.length);
            }
        }
    });

    // Mostrar/ocultar validaciones exitosas (items individuales dentro de las celdas)
    const exitosItems = document.querySelectorAll(".validacion-exitosa");
    exitosItems.forEach((item) => {
        item.style.display = mostrarExitos ? "" : "none";
    });
}

/**
 * Actualiza el resumen de validación
 */
function actualizarResumen(resultados, incremental = false) {
    const carpetas = Object.keys(resultados);
    const total = carpetas.length;

    let sinErrores = 0;
    let conAlertas = 0;
    let conErrores = 0;
    const erroresPorTipo = {};
    const detallePorTipo = {};
    const carpetasPorTipo = {};

    carpetas.forEach((carpeta) => {
        const r = resultados[carpeta];

        // Recopilar errores
        const todosLosErrores = [...(r.errores || [])];
        Object.values(r.erroresPorServicio || {}).forEach((arr) => {
            todosLosErrores.push(...arr);
        });

        // Contar errores por tipo solo si es resumen final (no incremental) para máxima fluidez
        if (!incremental) {
            const tiposProcesadosEnEstaCarpeta = new Set();

            todosLosErrores.forEach((error) => {
                const { tipo, detalle } = clasificarErrorResumen(error);
                const tipoNorm = normalizarTipoError(tipo);

                erroresPorTipo[tipo] = (erroresPorTipo[tipo] || 0) + 1;
                if (!detallePorTipo[tipo] && detalle) {
                    detallePorTipo[tipo] = detalle;
                }

                if (!carpetasPorTipo[tipo]) {
                    carpetasPorTipo[tipo] = new Set();
                }
                carpetasPorTipo[tipo].add(carpeta);
                tiposProcesadosEnEstaCarpeta.add(tipoNorm);
            });
        }

        const tieneErrores = todosLosErrores.length > 0;
        const tieneAlertas = Object.values(r.alertasPorServicio || {}).some(
            (arr) => arr.length > 0,
        );

        if (tieneErrores) {
            conErrores++;
        } else if (tieneAlertas) {
            conAlertas++;
        } else {
            sinErrores++;
        }
    });

    document.getElementById("statTotal").textContent = total;
    document.getElementById("statExito").textContent = sinErrores;
    document.getElementById("statAlertas").textContent = conAlertas;
    document.getElementById("statErrores").textContent = conErrores;

    resumenDiv.classList.remove("oculto");

    if (incremental) {
        return; // Durante el procesamiento incremental no manipulamos la lista detallada de errores
    }

    // Mostrar resumen de errores por tipo
    if (Object.keys(erroresPorTipo).length > 0) {
        const tiposDisponibles = new Set(
            Object.keys(erroresPorTipo).map(normalizarTipoError),
        );
        [...erroresSeleccionados].forEach((t) => {
            if (!tiposDisponibles.has(t)) {
                erroresSeleccionados.delete(t);
            }
        });

        const errorItems = Object.entries(erroresPorTipo)
            .sort((a, b) => b[1] - a[1])
            .map(([tipo, count]) => {
                const tipoNorm = normalizarTipoError(tipo);
                const seleccionado = erroresSeleccionados.has(tipoNorm)
                    ? " selected"
                    : "";

                const listaCarpetas = Array.from(carpetasPorTipo[tipo] || [])
                    .slice(0, 8)
                    .join(", ");
                const totalCarpetasConEsteError = (carpetasPorTipo[tipo] || [])
                    .size;
                const foldersExtra =
                    totalCarpetasConEsteError > 8
                        ? ` (+${totalCarpetasConEsteError - 8})`
                        : "";

                return `<div class="error-card-pill${seleccionado}" data-tipo="${tipo}" data-tipo-normalized="${tipoNorm}">
                    <div class="error-card-body">
                        <div class="error-card-title">${tipo}${detallePorTipo[tipo] ? `<span class="error-card-subtitle">${detallePorTipo[tipo]}</span>` : ""}</div>
                        <div class="error-card-meta">Docs: <code>${listaCarpetas}${foldersExtra}</code></div>
                    </div>
                    <div class="error-card-badge">${count}</div>
                </div>`;
            })
            .join("");

        const exportBtnHtml = `
            <div class="resumen-toolbar">
                <span class="resumen-counter">${Object.keys(erroresPorTipo).length} tipos de incidencias detectadas</span>
                <button id="btnExportarErrores" class="btn-studio btn-studio-ghost" style="padding: 5px 10px; width: auto; font-size: 11.5px;">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="width:13px;height:13px;"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path><polyline points="7 10 12 15 17 10"></polyline><line x1="12" y1="15" x2="12" y2="3"></line></svg>
                    Exportar Excel
                </button>
            </div>
        `;

        listaErroresDiv.innerHTML = exportBtnHtml + `<div class="error-cards-grid">${errorItems}</div>`;
        resumenErroresDiv.classList.remove("oculto");

        // Agregar event listener al botón de exportación
        const btnExport = document.getElementById("btnExportarErrores");
        if (btnExport) {
            btnExport.addEventListener("click", (e) => {
                e.stopPropagation();
                exportarResumenErroresXLSX(
                    erroresPorTipo,
                    detallePorTipo,
                    carpetasPorTipo,
                );
            });
        }
    } else {
        resumenErroresDiv.classList.add("oculto");
    }

    filtrosDiv.classList.remove("oculto");
    aplicarFiltros();
}

// Ceder ejecución al hilo principal del navegador para mantener la UI responsiva y evitar bloqueos
const cederHiloPrincipal = () => new Promise((resolve) => setTimeout(resolve, 0));

/**
 * Actualiza la barra de progreso
 */
function actualizarProgreso(actual, total, carpeta = "", archivo = "") {
    const porcentaje = Math.round((actual / total) * 100);
    progresoFill.style.width = `${porcentaje}%`;
    progresoPorcentaje.textContent = `${porcentaje}%`;
    progresoTexto.textContent = `Procesando ${actual} de ${total} carpetas`;

    if (carpeta) {
        let detalleTexto = `📁 ${carpeta}`;
        if (archivo) {
            detalleTexto += ` → 📄 ${archivo}`;
        }
        progresoDetalle.textContent = detalleTexto;
    } else {
        progresoDetalle.textContent = "";
    }
}

// Exportar XLSX de resultados actuales
function exportarXLSX(resultados) {
    // Mostrar modal de progreso
    const modalProgreso = document.getElementById("modalProgresoBajada");
    const progresoFill = document.getElementById("progresoFillBajada");
    const progresoPorcentaje = document.getElementById(
        "progresoPorcentajeBajada",
    );
    const progresoTexto = document.getElementById("progresoTextoBajada");

    const convenio = convenioSelect.value;
    modalProgreso.classList.remove("oculto");

    // Usar setTimeout para no bloquear el UI
    setTimeout(() => {
        try {
            const filas = [];
            // Encabezados
            filas.push([
                "Carpeta",
                "Tipo",
                "Servicio",
                "Estado",
                "Autorizaciones",
                "Evoluciones",
                "Archivos",
                "Errores",
                "Alertas",
                "Exitos",
            ]);

            progresoTexto.textContent = "Recopilando datos...";
            progresoFill.style.width = "10%";
            progresoPorcentaje.textContent = "10%";

            const carpetas = Object.keys(resultados);
            const totalProcesos = carpetas.length;
            let procesoActual = 0;

            carpetas.forEach((carpeta) => {
                const r = resultados[carpeta];
                if (r.tipoValidacion === "paquete") {
                    const servicios = [...(r.servicios || [])];
                    servicios.forEach((s) => {
                        if (s === "General") return;
                        const estado = determinarEstadoFilaPaquete(r, s);
                        const numAuto = r.numerosPorServicio?.[s] ?? "";
                        const evo = (r.fechasPorServicio?.[s] || []).length;
                        const archivos = Object.entries(
                            r.pdfsPorServicio?.[s] || {},
                        )
                            .map(([k, v]) => `${k}:${v}`)
                            .join(" ");
                        const errores = (r.erroresPorServicio?.[s] || []).join(
                            " | ",
                        );
                        const alertas = (r.alertasPorServicio?.[s] || []).join(
                            " | ",
                        );
                        const exitos = (r.exitosPorServicio?.[s] || []).join(
                            " | ",
                        );
                        filas.push([
                            carpeta,
                            r.tipoPaquete || r.tipo || "Paquete",
                            s,
                            estado,
                            numAuto,
                            evo,
                            archivos,
                            errores,
                            alertas,
                            exitos,
                        ]);
                    });
                } else {
                    const estado = determinarEstadoFilaEvento(r);
                    const errores = [...(r.errores || [])];
                    if (
                        r.servicios?.has("General") &&
                        r.erroresPorServicio?.["General"]
                    ) {
                        errores.push(...r.erroresPorServicio["General"]);
                    }
                    filas.push([
                        carpeta,
                        r.tipo || "Evento",
                        "—",
                        estado,
                        r.numeroFomag ?? "",
                        r.fechas?.length ?? 0,
                        Object.entries(r.pdfs || {})
                            .map(([k, v]) => `${k}:${v}`)
                            .join(" "),
                        errores.join(" | "),
                        Object.values(r.alertasPorServicio || {})
                            .flat()
                            .join(" | "),
                        "",
                    ]);
                }

                procesoActual++;
                const porcentaje = Math.round(
                    10 + (procesoActual / totalProcesos) * 40,
                );
                progresoFill.style.width = porcentaje + "%";
                progresoPorcentaje.textContent = porcentaje + "%";
                progresoTexto.textContent = `Procesando carpeta ${procesoActual}/${totalProcesos}...`;
            });

            progresoTexto.textContent = "Formateando hoja de cálculo...";
            progresoFill.style.width = "60%";
            progresoPorcentaje.textContent = "60%";

            // Crear workbook y worksheet
            const ws = XLSX.utils.aoa_to_sheet(filas);

            // Ajustar ancho de columnas y congelar encabezados
            const colWidths = [20, 25, 20, 16, 16, 16, 24, 34, 34, 20];
            ws["!cols"] = colWidths.map((w) => ({ wch: w }));
            ws["!freeze"] = { xSplit: 0, ySplit: 1, topLeftCell: "A2" };

            // Estilos reutilizables
            const headerStyle = {
                fill: { patternType: "solid", fgColor: { rgb: "0F172A" } },
                font: { bold: true, color: { rgb: "FFFFFF" }, sz: 11 },
                alignment: {
                    horizontal: "center",
                    vertical: "center",
                    wrapText: true,
                },
                border: {
                    top: { style: "thin", color: { rgb: "1F2937" } },
                    bottom: { style: "thin", color: { rgb: "1F2937" } },
                    left: { style: "thin", color: { rgb: "1F2937" } },
                    right: { style: "thin", color: { rgb: "1F2937" } },
                },
            };

            const baseDataStyle = {
                fill: { patternType: "solid", fgColor: { rgb: "FFFFFF" } },
                font: { color: { rgb: "0F172A" }, sz: 11 },
                alignment: {
                    horizontal: "left",
                    vertical: "top",
                    wrapText: true,
                },
                border: {
                    top: { style: "thin", color: { rgb: "E5E7EB" } },
                    bottom: { style: "thin", color: { rgb: "E5E7EB" } },
                    left: { style: "thin", color: { rgb: "E5E7EB" } },
                    right: { style: "thin", color: { rgb: "E5E7EB" } },
                },
            };

            const estadoFill = {
                "sin-errores": {
                    patternType: "solid",
                    fgColor: { rgb: "E6F4EA" },
                }, // verde claro
                "con-alertas": {
                    patternType: "solid",
                    fgColor: { rgb: "FFF7D6" },
                }, // amarillo claro
                "con-errores": {
                    patternType: "solid",
                    fgColor: { rgb: "FDE2E1" },
                }, // rojo claro
            };

            for (let r = 0; r < filas.length; r++) {
                for (let c = 0; c < filas[r].length; c++) {
                    const cellRef = XLSX.utils.encode_cell({ r, c });
                    if (!ws[cellRef]) ws[cellRef] = { t: "s", v: "" };

                    if (r === 0) {
                        ws[cellRef].s = headerStyle;
                    } else {
                        const style = { ...baseDataStyle };
                        const estado = filas[r][3];
                        if (estadoFill[estado]) {
                            style.fill = estadoFill[estado];
                        }

                        if (c === 4 || c === 5) {
                            style.alignment = {
                                horizontal: "center",
                                vertical: "center",
                            };
                        }

                        ws[cellRef].s = style;
                    }
                }
            }

            progresoTexto.textContent = "Generando archivo...";
            progresoFill.style.width = "85%";
            progresoPorcentaje.textContent = "85%";

            const wb = XLSX.utils.book_new();
            XLSX.utils.book_append_sheet(wb, ws, "Validación");

            progresoTexto.textContent = "¡Descargando!";
            progresoFill.style.width = "95%";
            progresoPorcentaje.textContent = "95%";

            // Descargar
            const timestamp = new Date()
                .toISOString()
                .slice(0, 19)
                .replace(/[:T]/g, "-");
            XLSX.writeFile(wb, `validacion-${timestamp}.xlsx`);

            // Finalizar
            setTimeout(() => {
                progresoTexto.textContent = "¡Archivo descargado!";
                progresoFill.style.width = "100%";
                progresoPorcentaje.textContent = "100%";

                setTimeout(() => {
                    modalProgreso.classList.add("oculto");
                }, 800);
            }, 300);
        } catch (error) {
            console.error("Error al exportar XLSX:", error);
            progresoTexto.textContent = `❌ Error al generar el archivo: ${
                error?.message || error
            }`;
            progresoPorcentaje.textContent = "0%";
            progresoFill.style.width = "0%";
            setTimeout(() => {
                modalProgreso.classList.add("oculto");
            }, 2400);
        }
    }, 100);
}

/**
 * Exporta un resumen de errores agrupados por tipo y sus carpetas
 */
function exportarResumenErroresXLSX(
    erroresPorTipo,
    detallePorTipo,
    carpetasPorTipo,
) {
    const modalProgreso = document.getElementById("modalProgresoBajada");
    const progresoFill = document.getElementById("progresoFillBajada");
    const progresoPorcentaje = document.getElementById(
        "progresoPorcentajeBajada",
    );
    const progresoTexto = document.getElementById("progresoTextoBajada");

    modalProgreso.classList.remove("oculto");
    progresoTexto.textContent = "Generando resumen de errores...";
    progresoFill.style.width = "20%";
    progresoPorcentaje.textContent = "20%";

    setTimeout(() => {
        try {
            const data = [];
            // Encabezados
            data.push([
                "Tipo de Error",
                "Detalle",
                "Cantidad",
                "Carpetas (Documentos)",
            ]);

            const tipos = Object.keys(erroresPorTipo).sort(
                (a, b) => erroresPorTipo[b] - erroresPorTipo[a],
            );

            tipos.forEach((tipo) => {
                const detalle = detallePorTipo[tipo] || "";
                const cantidad = erroresPorTipo[tipo];
                const carpetas = Array.from(carpetasPorTipo[tipo] || []).join(
                    ", ",
                );
                data.push([tipo, detalle, cantidad, carpetas]);
            });

            const ws = XLSX.utils.aoa_to_sheet(data);

            // Estilos y anchos
            ws["!cols"] = [
                { wch: 40 }, // Tipo
                { wch: 50 }, // Detalle
                { wch: 10 }, // Cantidad
                { wch: 80 }, // Carpetas
            ];

            const wb = XLSX.utils.book_new();
            XLSX.utils.book_append_sheet(wb, ws, "Resumen de Errores");

            const timestamp = new Date().toISOString().slice(0, 10);
            XLSX.writeFile(wb, `Resumen_Errores_${timestamp}.xlsx`);

            progresoFill.style.width = "100%";
            progresoPorcentaje.textContent = "100%";
            progresoTexto.textContent = "¡Resumen descargado!";

            setTimeout(() => {
                modalProgreso.classList.add("oculto");
            }, 1000);
        } catch (error) {
            console.error("Error al exportar resumen de errores:", error);
            alert("Error al generar el Excel de errores: " + error.message);
            modalProgreso.classList.add("oculto");
        }
    }, 100);
}

function exportarFomagEvento(resultados) {
    const modalProgreso = document.getElementById("modalProgresoBajada");
    const progresoFill = document.getElementById("progresoFillBajada");
    const progresoPorcentaje = document.getElementById(
        "progresoPorcentajeBajada",
    );
    const progresoTexto = document.getElementById("progresoTextoBajada");

    modalProgreso.classList.remove("oculto");

    // Usar setTimeout para no bloquear el UI
    setTimeout(() => {
        try {
            const columnas = [
                { header: "Número De Documento Del Paciente", key: "carpeta" },
                { header: "Eve. Médica General 2 ", service: "VM" },
                { header: "Eve. Enfermería Profesional 3 ", service: "ENF" },
                { header: "Eve. Nutrición", service: "NUT" },
                { header: "Eve. Fonoaudiología 5 ", service: "FON" },
                { header: "Eve. Terapia Física 6 ", service: "TF" },
                { header: "Eve. Terapia Respiratoria 7 ", service: "TR" },
                {
                    header: "Eve. Terapia Respiratoria Succión 8 ",
                    service: "TRS",
                },
                { header: "Eve. Terapia Ocupacional 9 ", service: "TO" },
                { header: "Eve. Trabajo Social 10 ", service: "TS" },
                { header: "Eve. Psicología 11 ", service: "PSI" },
                {
                    header: "Eve. Turno Enfermería 6 Horas 12 ",
                    service: "ENF6",
                },
                {
                    header: "Eve. Turno Enfermería 8 Horas 13 ",
                    service: "ENF8",
                },
                {
                    header: "Eve. Turno Enfermería 12 Horas 14 ",
                    service: "ENF12",
                },
                {
                    header: "Eve. Aplicación Medicamento 1 Dosis 15 ",
                    service: "MED1",
                },
                {
                    header: "Eve. Aplicación Medicamento 2 Dosis 16 ",
                    service: "MED2",
                },
                {
                    header: "Eve. Aplicación Medicamento 3 Dosis 17 ",
                    service: "MED3",
                },
                {
                    header: "Eve. Aplicación Medicamento 4 Dosis 18 ",
                    service: "MED4",
                },
                { header: "Eve. Medicina Especial 19 ", service: "ESP" },
            ];

            const filas = [];
            // Encabezado
            filas.push(columnas.map((c) => c.header));

            progresoTexto.textContent = "Recopilando datos Fomag...";
            progresoFill.style.width = "10%";

            const carpetas = Object.keys(resultados);
            carpetas.forEach((carpeta) => {
                const r = resultados[carpeta];
                const row = [];
                columnas.forEach((col, index) => {
                    if (index === 0) {
                        row.push(carpeta); // Número de documento
                    } else {
                        const servicio = col.service;
                        const fechas = r.fechasPorServicio?.[servicio] || [];
                        const count = [...new Set(fechas)].length;
                        row.push(count > 0 ? count : "");
                    }
                });
                filas.push(row);
            });

            progresoTexto.textContent = "Generando Excel...";
            progresoFill.style.width = "60%";

            const ws = XLSX.utils.aoa_to_sheet(filas);

            // Estilos
            const headerStyle = {
                fill: { patternType: "solid", fgColor: { rgb: "E7E7E7" } },
                font: { bold: true, color: { rgb: "000000" }, sz: 12 },
                alignment: {
                    horizontal: "center",
                    vertical: "bottom",
                    textRotation: 90, // Rotación vertical
                    wrapText: true,
                },
                border: {
                    top: { style: "thin", color: { rgb: "000000" } },
                    bottom: { style: "thin", color: { rgb: "000000" } },
                    left: { style: "thin", color: { rgb: "000000" } },
                    right: { style: "thin", color: { rgb: "000000" } },
                },
            };

            const colAStyle = {
                fill: { patternType: "solid", fgColor: { rgb: "E7E7E7" } },
                font: { bold: true, color: { rgb: "000000" }, sz: 11 },
                alignment: { horizontal: "left", vertical: "center" },
                border: {
                    top: { style: "thin", color: { rgb: "000000" } },
                    bottom: { style: "thin", color: { rgb: "000000" } },
                    left: { style: "thin", color: { rgb: "000000" } },
                    right: { style: "thin", color: { rgb: "000000" } },
                },
            };

            const dataStyle = {
                alignment: { horizontal: "center", vertical: "center" },
                border: {
                    top: { style: "thin", color: { rgb: "CCCCCC" } },
                    bottom: { style: "thin", color: { rgb: "CCCCCC" } },
                    left: { style: "thin", color: { rgb: "CCCCCC" } },
                    right: { style: "thin", color: { rgb: "CCCCCC" } },
                },
            };

            const dataStyleFilled = {
                fill: { patternType: "solid", fgColor: { rgb: "00FF00" } },
                alignment: { horizontal: "center", vertical: "center" },
                border: {
                    top: { style: "thin", color: { rgb: "CCCCCC" } },
                    bottom: { style: "thin", color: { rgb: "CCCCCC" } },
                    left: { style: "thin", color: { rgb: "CCCCCC" } },
                    right: { style: "thin", color: { rgb: "CCCCCC" } },
                },
            };

            const range = XLSX.utils.decode_range(ws["!ref"]);
            for (let R = range.s.r; R <= range.e.r; ++R) {
                for (let C = range.s.c; C <= range.e.c; ++C) {
                    const cellRef = XLSX.utils.encode_cell({ r: R, c: C });
                    if (!ws[cellRef]) ws[cellRef] = { t: "s", v: "" };

                    if (R === 0) {
                        ws[cellRef].s = headerStyle;
                    } else if (C === 0) {
                        ws[cellRef].s = colAStyle;
                    } else {
                        if (ws[cellRef].v !== "") {
                            ws[cellRef].s = dataStyleFilled;
                        } else {
                            ws[cellRef].s = dataStyle;
                        }
                    }
                }
            }

            // Anchos columnas
            ws["!cols"] = [
                { wch: 30 }, // A
                ...Array(18).fill({ wch: 5 }), // Resto estrechas
            ];

            const wb = XLSX.utils.book_new();
            XLSX.utils.book_append_sheet(wb, ws, "Reporte Eventos");

            const timestamp = new Date()
                .toISOString()
                .slice(0, 19)
                .replace(/[:T]/g, "-");
            XLSX.writeFile(wb, `Reporte_Fomag_Eventos_${timestamp}.xlsx`);

            progresoTexto.textContent = "¡Descargado!";
            progresoFill.style.width = "100%";
            progresoPorcentaje.textContent = "100%";

            setTimeout(() => {
                modalProgreso.classList.add("oculto");
            }, 1500);
        } catch (error) {
            console.error("Error Fomag Export:", error);
            progresoTexto.textContent = `❌ Error: ${error?.message || error}`;
            setTimeout(() => modalProgreso.classList.add("oculto"), 2500);
        }
    }, 100);
}

function determinarEstadoFilaPaquete(r, servicio) {
    const erroresServicio = r.erroresPorServicio?.[servicio] || [];
    const alertasServicio = r.alertasPorServicio?.[servicio] || [];
    return erroresServicio.length > 0
        ? "con-errores"
        : alertasServicio.length > 0
          ? "con-alertas"
          : "sin-errores";
}

function determinarEstadoFilaEvento(r) {
    const errores = [...(r.errores || [])];
    if (r.servicios?.has("General") && r.erroresPorServicio?.["General"]) {
        errores.push(...r.erroresPorServicio["General"]);
    }
    const tieneAlertas = Object.values(r.alertasPorServicio || {}).some(
        (arr) => arr.length > 0,
    );
    if (errores.length > 0) return "con-errores";
    if (tieneAlertas) return "con-alertas";
    return "sin-errores";
}

// Event listener principal para procesar carpetas
input.addEventListener("change", async () => {
    try {
        console.log("Evento change disparado en input");
        console.log("Archivos seleccionados:", input.files.length);
        reiniciarFiltros(false);
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

        console.log("Configuración:", {
            tipoValidacion,
            tipoPaqueteFallback,
            convenio,
        });

        // Actualizar headers de la tabla
        actualizarHeadersTabla(
            tabla,
            tablaHeader,
            tipoValidacion,
            tipoPaqueteFallback,
            convenio,
        );

        // Agrupar archivos inteligentemente
        console.log("=== INICIO AGRUPACIÓN DE ARCHIVOS INTELIGENTE ===");
        const carpetasAgrupadas = agruparArchivosInteligente(
            input.files,
            tipoPaqueteFallback,
            tipoValidacion,
        );
        const carpetasKeys = Object.keys(carpetasAgrupadas);
        console.log("Carpetas agrupadas:", carpetasKeys);
        console.log("=== FIN AGRUPACIÓN ===");

        // Inicializar progreso
        const totalCarpetas = carpetasKeys.length;

        if (totalCarpetas === 0) {
            estado.classList.remove("oculto");
            estado.textContent =
                "❌ Error: No se encontraron carpetas. Asegúrate de seleccionar una carpeta (no archivos individuales).";
            console.error("No se encontraron carpetas para procesar");
            return;
        }

        let carpetasProcesadas = 0;

        // Procesar cada carpeta
        for (const carpetaKey of carpetasKeys) {
            const infoCarpeta = carpetasAgrupadas[carpetaKey];
            const carpeta = infoCarpeta.carpetaNombre;
            const paqueteParaCarpeta = infoCarpeta.tipoPaquete;

            resultados[carpetaKey] = inicializarResultado(
                tipoValidacion,
                paqueteParaCarpeta,
                convenio,
            );
            resultados[carpetaKey].tipoPaquete = paqueteParaCarpeta;

            // Detectar tipo de carpeta (para validación por evento)
            if (tipoValidacion === "evento") {
                detectarTipoCarpeta(carpeta, resultados[carpetaKey], convenio);
            } else {
                resultados[carpetaKey].tipo = paqueteParaCarpeta;
            }

            // Si hubo error o advertencia detectando el paquete, registrarlo en General
            if (infoCarpeta.errorPaquete) {
                resultados[carpetaKey].servicios.add("General");
                resultados[carpetaKey].erroresPorServicio["General"] =
                    resultados[carpetaKey].erroresPorServicio["General"] || [];
                resultados[carpetaKey].erroresPorServicio["General"].push(
                    infoCarpeta.errorPaquete,
                );
            }

            // Crear fila placeholder
            createPlaceholderRow(
                tablaBody,
                carpetaKey,
                tipoValidacion,
                paqueteParaCarpeta,
            );

            const archivos = infoCarpeta.archivos;
            const nombres = archivos.map((a) => a.name);
            const nroDocumento = carpeta.match(/^\d+/)?.[0] || "";

            // Guardar datos útiles para copiar
            resultados[carpetaKey].nroDocumento = nroDocumento;
            resultados[carpetaKey].primerArchivoRelPath =
                archivos[0]?.webkitRelativePath || carpeta;
            resultados[carpetaKey].listaArchivos = nombres;

            // Inicializar URLs de archivos
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
                            mostrarExitosCheckbox.checked,
                        ),
                    convenio,
                    (nombreArchivo) => {
                        // Callback para actualizar progreso con archivo actual
                        actualizarProgreso(
                            carpetasProcesadas + 1,
                            totalCarpetas,
                            carpeta,
                            nombreArchivo,
                        );
                    },
                );
            } else {
                // Validación por evento
                await procesarValidacionEvento(
                    carpetaKey,
                    archivos,
                    nombres,
                    nroDocumento,
                    resultados,
                    convenio,
                );
                // Actualizar fila después de procesar evento
                if (tablaBody && carpetaKey && resultados[carpetaKey]) {
                    console.log(`Actualizando fila para carpeta: ${carpetaKey}`);
                    updateRow(
                        tablaBody,
                        carpetaKey,
                        resultados[carpetaKey],
                        mostrarExitosCheckbox
                            ? mostrarExitosCheckbox.checked
                            : false,
                    );
                    const filasEnTabla = tablaBody.querySelectorAll(
                        `tr[data-carpeta="${carpetaKey}"]`,
                    );
                    console.log(
                        `Filas encontradas para ${carpetaKey}: ${filasEnTabla.length}`,
                    );
                } else {
                    console.warn(
                        `No se pudo actualizar fila: tablaBody=${!!tablaBody}, carpetaKey=${!!carpetaKey}, resultado=${!!resultados[carpetaKey]}`,
                    );
                }
            }

            // Quitar spinner final
            const row = document.querySelector(
                `tr[data-carpeta="${carpetaKey}"]`,
            );
            if (row) row.classList.remove("processing");

            // Actualizar progreso y resumen incremental
            carpetasProcesadas++;
            actualizarProgreso(carpetasProcesadas, totalCarpetas, carpeta);
            actualizarResumen(resultados, true); // true = incremental

            // Ceder tiempo al hilo principal para actualizar la UI y permitir Garbage Collection
            await cederHiloPrincipal();
        }

        // Guardar resultados globales y actualizar resumen final
        todosLosResultados = resultados;
        todasLasCarpetas = carpetasKeys;
        actualizarResumen(resultados, false); // false = mostrar filtros
        btnDescargar.classList.remove("oculto");
        if (tipoValidacion === "evento" && convenio === "fomag") {
            btnDescargarMatriz.classList.remove("oculto");
        } else {
            btnDescargarMatriz.classList.add("oculto");
        }

        estado.classList.add("oculto");
        barraProgresoDiv.classList.add("oculto");
        console.log("✅ Procesamiento completado exitosamente");
    } catch (error) {
        console.error("❌ Error en event listener del input:", error);
        console.error("Stack:", error.stack);
        estado.classList.remove("oculto");
        estado.textContent = `❌ Error: ${error.message}`;
    }
});

// Función recursiva para recorrer carpetas
async function recorrerCarpetaRecursivo(handle, basePath = "") {
    const files = [];
    for await (const [name, childHandle] of handle.entries()) {
        const currentPath = basePath ? `${basePath}/${name}` : name;
        if (childHandle.kind === "directory") {
            const subFiles = await recorrerCarpetaRecursivo(
                childHandle,
                currentPath,
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

// Alternativa: abrir carpeta con File System Access API (Chrome/Edge)
if (btnAbrirFS) {
    btnAbrirFS.addEventListener("click", async () => {
        if (!window.showDirectoryPicker) {
            alert(
                "Esta opción requiere Chrome/Edge con permisos de sitio (no funciona en Firefox ni file://). Abra en Chrome o use el selector de carpeta.",
            );
            return;
        }
        try {
            const dirHandle = await window.showDirectoryPicker();

        console.log(
            "Carpeta seleccionada, recorriendo estructura recursivamente...",
        );
        estado.classList.remove("oculto");
        estado.textContent = "🔍 Escaneando carpetas...";

        // Recorrer recursivamente toda la estructura
        const files = await recorrerCarpetaRecursivo(dirHandle);

        console.log(`Total archivos encontrados: ${files.length}`);
        files.forEach((f) => console.log(`  → ${f.webkitRelativePath}`));

        // Inyectar en input.files-like flujo
        if (files.length === 0) {
            estado.textContent =
                "❌ No se encontraron archivos en la carpeta seleccionada.";
            return;
        }

        console.log("Iniciando procesamiento de archivos...");
        procesarArchivosDesdeFS(files);
    } catch (error) {
        if (error.name !== "AbortError") {
            console.error("Error al abrir carpeta:", error);
            estado.classList.remove("oculto");
            estado.textContent = `❌ Error: ${error.message}`;
        }
        // AbortError es normal cuando el usuario cancela
    }
    });
}

// Carga dinámica de la librería XLSX con fallback
async function cargarXLSX() {
    if (window.XLSX) return true;
    const urls = [
        "https://cdnjs.cloudflare.com/ajax/libs/xlsx/0.18.5/xlsx.full.min.js",
        "https://cdn.jsdelivr.net/npm/xlsx@0.18.5/dist/xlsx.full.min.js",
    ];
    for (const url of urls) {
        try {
            await new Promise((resolve, reject) => {
                const script = document.createElement("script");
                script.src = url;
                script.onload = resolve;
                script.onerror = reject;
                document.head.appendChild(script);
            });
            if (window.XLSX) return true;
        } catch (e) {
            console.warn("Falló cargar XLSX desde", url, e);
        }
    }
    return false;
}

// Botón descargar XLSX
btnDescargar.addEventListener("click", async () => {
    if (!todosLosResultados || Object.keys(todosLosResultados).length === 0) {
        alert("No hay resultados para descargar");
        return;
    }
    const ok = await cargarXLSX();
    if (!ok) {
        alert(
            "No se pudo cargar la librería XLSX. Verifica tu conexión a internet.",
        );
        return;
    }
    exportarXLSX(todosLosResultados);
});

async function procesarArchivosDesdeFS(fsFiles) {
    try {
        console.log(
            `Procesando ${fsFiles.length} archivos desde File System API...`,
        );

        reiniciarFiltros(false);
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

        console.log("Configuración:", {
            tipoValidacion,
            tipoPaqueteFallback,
            convenio,
        });

        actualizarHeadersTabla(
            tabla,
            tablaHeader,
            tipoValidacion,
            tipoPaqueteFallback,
            convenio,
        );

        console.log("=== INICIO AGRUPACIÓN DE ARCHIVOS INTELIGENTE (FS) ===");
        const carpetasAgrupadas = agruparArchivosInteligente(
            fsFiles,
            tipoPaqueteFallback,
            tipoValidacion,
        );
        const carpetasKeys = Object.keys(carpetasAgrupadas);
        console.log("Carpetas agrupadas:", carpetasKeys);
        console.log("=== FIN AGRUPACIÓN (FS) ===");

        const totalCarpetas = carpetasKeys.length;

        if (totalCarpetas === 0) {
            estado.classList.remove("oculto");
            estado.textContent =
                "❌ Error: No se encontraron carpetas en la selección.";
            console.error("No se encontraron carpetas para procesar");
            return;
        }

        let carpetasProcesadas = 0;

        for (const carpetaKey of carpetasKeys) {
            const infoCarpeta = carpetasAgrupadas[carpetaKey];
            const carpeta = infoCarpeta.carpetaNombre;
            const paqueteParaCarpeta = infoCarpeta.tipoPaquete;

            resultados[carpetaKey] = inicializarResultado(
                tipoValidacion,
                paqueteParaCarpeta,
                convenio,
            );
            resultados[carpetaKey].tipoPaquete = paqueteParaCarpeta;

            if (tipoValidacion === "evento") {
                detectarTipoCarpeta(carpeta, resultados[carpetaKey], convenio);
            } else {
                resultados[carpetaKey].tipo = paqueteParaCarpeta;
            }

            // Si hubo error o advertencia detectando el paquete, registrarlo en General
            if (infoCarpeta.errorPaquete) {
                resultados[carpetaKey].servicios.add("General");
                resultados[carpetaKey].erroresPorServicio["General"] =
                    resultados[carpetaKey].erroresPorServicio["General"] || [];
                resultados[carpetaKey].erroresPorServicio["General"].push(
                    infoCarpeta.errorPaquete,
                );
            }

            createPlaceholderRow(
                tablaBody,
                carpetaKey,
                tipoValidacion,
                paqueteParaCarpeta,
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
                    (carp, resultado) =>
                        updateRow(
                            tablaBody,
                            carp,
                            resultado,
                            mostrarExitosCheckbox.checked,
                        ),
                    convenio,
                    (nombreArchivo) => {
                        actualizarProgreso(
                            carpetasProcesadas + 1,
                            totalCarpetas,
                            carpeta,
                            nombreArchivo,
                        );
                    },
                );
            } else {
                await procesarValidacionEvento(
                    carpetaKey,
                    archivos,
                    nombres,
                    nroDocumento,
                    resultados,
                    convenio,
                );
                // Actualizar fila después de procesar evento
                updateRow(
                    tablaBody,
                    carpetaKey,
                    resultados[carpetaKey],
                    mostrarExitosCheckbox.checked,
                );
            }

            const row = document.querySelector(
                `tr[data-carpeta="${carpetaKey}"]`,
            );
            if (row) row.classList.remove("processing");
            carpetasProcesadas++;
            actualizarProgreso(carpetasProcesadas, totalCarpetas, carpeta);
            actualizarResumen(resultados, true);

            // Ceder tiempo al hilo principal para actualizar la UI y permitir Garbage Collection
            await cederHiloPrincipal();
        }

        todosLosResultados = resultados;
        todasLasCarpetas = carpetasKeys;
        actualizarResumen(resultados, false);
        btnDescargar.classList.remove("oculto");
        estado.classList.add("oculto");
        barraProgresoDiv.classList.add("oculto");

        console.log("Procesamiento completado exitosamente");
    } catch (error) {
        console.error("Error en procesarArchivosDesdeFS:", error);
        estado.classList.remove("oculto");
        estado.textContent = `❌ Error durante el procesamiento: ${error.message}`;
    }
}

/**
 * Inicializa el objeto de resultados para una carpeta
 */
function inicializarResultado(
    tipoValidacion,
    tipoPaquete,
    convenio = "capital-salud",
) {
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
        erroresPorServicio: {}, // Errores específicos por servicio
        exitosPorServicio: {}, // Validaciones exitosas por servicio
        alertasPorServicio: {}, // Alertas/advertencias por servicio
        fechas: [],
        fileUrls: {},
        tipoValidacion,
        tipoPaquete,
        convenio, // Guardamos convenio para el renderizado
        buscarEn2Paq: new Set(), // Para FOMAG: servicios a buscar en 2 paq.pdf
        numerosPorServicio: {}, // Para FOMAG: números extraídos por servicio
        numeroFomag: null, // Para FOMAG evento: número extraído del 2.pdf
    };
}

/**
 * Detecta el tipo de carpeta basándose en su nombre
 */
function detectarTipoCarpeta(carpeta, resultado, convenio = "capital-salud") {
    const carpetaUpper = carpeta.toUpperCase();
    const tipoDetectado = ALLOWED_TYPES.find((t) => carpetaUpper.includes(t));
    resultado.tipo = tipoDetectado || null;
    // En FOMAG por evento, las carpetas pueden ser solo número y contener múltiples servicios.
    // No marcar error si no se detecta tipo en nombre de carpeta.
    if (!tipoDetectado && convenio !== "fomag") {
        resultado.errores.push(
            `Por Evento: la carpeta debe incluir un tipo válido (${ALLOWED_TYPES.join(
                ", ",
            )})`,
        );
    }
}

/**
 * Inicializa las URLs de los archivos PDF
 */
function inicializarURLsArchivos(archivos, resultado) {
    // Mapear genéricos
    resultado.fileUrls = {
        "2.pdf": null,
        "3.pdf": null,
        "4.pdf": null,
        "5.pdf": null,
    };

    for (const f of archivos) {
        if (f.type === "application/pdf") {
            const url = URL.createObjectURL(f);
            // Guardar URL para nombre exacto
            resultado.fileUrls[f.name] = url;
            // Guardar también si coincide con genéricos
            if (resultado.fileUrls.hasOwnProperty(f.name)) {
                resultado.fileUrls[f.name] = url;
            }
        }
    }
}

/**
 * Procesa la validación por evento
 */
async function procesarValidacionEvento(
    carpeta,
    archivos,
    nombres,
    nroDocumento,
    resultados,
    convenio,
) {
    // Validar archivos permitidos primero
    validarArchivosPermitidosEvento(archivos, resultados, carpeta, convenio);

    // Verificar presencia de archivos
    if (convenio === "fomag") {
        // Para FOMAG por evento, considerar archivos por servicio
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
        // No exigir 3.pdf en FOMAG evento
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

    // Validar cada PDF (ordenados para que 2/4 se procesen antes que 5)
    const archivosPDF = archivos
        .filter((f) => f.type === "application/pdf")
        .sort((a, b) => {
            // Extraer número del nombre (ej: "2 tf.pdf" -> 2, "5.pdf" -> 5)
            const numA = parseInt(a.name.match(/^(\d+)/)?.[1] || "99");
            const numB = parseInt(b.name.match(/^(\d+)/)?.[1] || "99");
            return numA - numB;
        });

    // Para FOMAG evento: detectar servicios y preparar procesamiento de 2 paq.pdf
    let archivo2Paq = null;
    const serviciosCon5 = new Set();

    if (convenio === "fomag") {
        archivo2Paq = archivos.find(
            (f) => f.name.toLowerCase() === "2 paq.pdf",
        );
        for (const nombre of nombres) {
            const match5 = nombre
                .toLowerCase()
                .match(
                    /^5\s+(vm|enf12|enf|venf|tf|tr|succion|suc|trs|ts|psi|to|fon|nut)\.pdf$/,
                );
            if (match5) {
                let serv = match5[1];
                if (serv === "suc") serv = "succion";
                serviciosCon5.add(serv.toUpperCase());
            }
        }

        // Procesar 2 paq.pdf ANTES de los archivos 5 para tener las autorizaciones
        if (archivo2Paq && serviciosCon5.size > 0) {
            estado.textContent = `Procesando: ${carpeta} / 2 paq.pdf`;
            await procesarArchivo2PaqEvento(archivo2Paq, carpeta, resultados, [
                ...serviciosCon5,
            ]);
        }

        // --- NUEVO: Validar existencia de archivos por servicio ---
        // Detectar TODOS los servicios presentes (mirando archivos 2, 4, 5)
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

        // Verificar archivos faltantes para cada servicio detectado
        for (const servicio of serviciosDetectados) {
            const srvLower = servicio.toLowerCase();
            const srvLowerShort = srvLower === "succion" ? "suc" : srvLower;

            const tiene5 = nombres.some((n) =>
                new RegExp(`^5\\s+${srvLower}\\.pdf$`, "i").test(n),
            );
            const tiene4 = nombres.some((n) =>
                new RegExp(`^4\\s+${srvLower}\\.pdf$`, "i").test(n),
            );
            // El 2 puede ser individual o "2 paq.pdf"
            const tiene2Individual = nombres.some((n) =>
                new RegExp(`^2\\s+${srvLower}\\.pdf$`, "i").test(n),
            );
            const tiene2Paq = nombres.some(
                (n) => n.toLowerCase() === "2 paq.pdf",
            );
            const tiene2 = tiene2Individual || tiene2Paq;

            resultados[carpeta].erroresPorServicio[servicio] =
                resultados[carpeta].erroresPorServicio[servicio] || [];

            if (!tiene5) {
                resultados[carpeta].erroresPorServicio[servicio].push(
                    `Falta 5 ${srvLower}.pdf`,
                );
            }
            if (!tiene4) {
                resultados[carpeta].erroresPorServicio[servicio].push(
                    `Falta 4 ${srvLower}.pdf`,
                );
            }
            if (!tiene2) {
                resultados[carpeta].erroresPorServicio[servicio].push(
                    `Falta 2 ${srvLower}.pdf (o 2 paq.pdf)`,
                );
            }
        }
    }

    for (const file of archivosPDF) {
        // Saltar 2 paq.pdf ya que se procesó arriba
        if (file.name.toLowerCase() === "2 paq.pdf") continue;

        estado.textContent = `Procesando: ${carpeta} / ${file.name}`;
        // Actualizar barra de progreso con archivo actual
        const carpetaIndex = todasLasCarpetas.indexOf(carpeta) + 1;
        if (carpetaIndex > 0) {
            actualizarProgreso(
                carpetaIndex,
                todasLasCarpetas.length,
                carpeta,
                file.name,
            );
        }
        await validarPDF(file, carpeta, nroDocumento, resultados, convenio);
        updateRow(
            tablaBody,
            carpeta,
            resultados[carpeta],
            mostrarExitosCheckbox.checked,
        );
    }
}

// ================= VISOR PDF NATIVO MULTI-PÁGINA (SCROLL CONTINUO Y CENTRADO) =================
let currentPdfDoc = null;
let currentPdfPage = 1;
let currentPdfScale = 1.0;
let currentPdfRotation = 0;
let isRenderingDocument = false;

async function renderizarDocumentoPDF() {
    if (!currentPdfDoc) return;
    isRenderingDocument = true;

    const container = document.getElementById("pdfCanvasContainer");
    const pagesContainer = document.getElementById("pdfPagesContainer");
    if (!container || !pagesContainer) return;

    pagesContainer.innerHTML = "";
    const numPages = currentPdfDoc.numPages;

    const paddingW = 40;
    const paddingH = 40;
    const availWidth = Math.max((container.clientWidth || 900) - paddingW, 300);
    const availHeight = Math.max((container.clientHeight || 650) - paddingH, 300);

    for (let pageNum = 1; pageNum <= numPages; pageNum++) {
        const pageWrapper = document.createElement("div");
        pageWrapper.className = "pdf-page-wrapper";
        pageWrapper.id = `pdfPageWrapper_${pageNum}`;
        pageWrapper.setAttribute("data-page", pageNum);

        const canvas = document.createElement("canvas");
        canvas.className = "pdf-page-canvas";
        canvas.id = `pdfCanvas_${pageNum}`;

        pageWrapper.appendChild(canvas);
        pagesContainer.appendChild(pageWrapper);

        try {
            const page = await currentPdfDoc.getPage(pageNum);
            const ctx = canvas.getContext("2d");

            const totalRotation = (page.rotate + currentPdfRotation) % 360;
            const unscaledViewport = page.getViewport({ scale: 1, rotation: totalRotation });

            let baseScale = Math.min(availWidth / unscaledViewport.width, availHeight / unscaledViewport.height);
            if (baseScale <= 0 || isNaN(baseScale)) baseScale = 1.0;

            const finalScale = baseScale * currentPdfScale;
            const viewport = page.getViewport({ scale: finalScale, rotation: totalRotation });

            const outputScale = window.devicePixelRatio || 1;
            canvas.width = Math.floor(viewport.width * outputScale);
            canvas.height = Math.floor(viewport.height * outputScale);
            canvas.style.width = Math.floor(viewport.width) + "px";
            canvas.style.height = Math.floor(viewport.height) + "px";

            const transform = outputScale !== 1 ? [outputScale, 0, 0, outputScale, 0, 0] : null;

            await page.render({
                canvasContext: ctx,
                transform: transform,
                viewport: viewport,
            }).promise;

            if (page.cleanup) page.cleanup();
        } catch (err) {
            console.warn(`Error renderizando página ${pageNum}:`, err);
        }
    }

    isRenderingDocument = false;
    actualizarBadgePagina(currentPdfPage);
    iniciarScrollObserver();
}

function iniciarScrollObserver() {
    const container = document.getElementById("pdfCanvasContainer");
    if (!container) return;

    if (container._scrollHandler) {
        container.removeEventListener("scroll", container._scrollHandler);
    }

    container._scrollHandler = () => {
        const pages = container.querySelectorAll(".pdf-page-wrapper");
        if (pages.length === 0) return;

        const containerTop = container.scrollTop;
        const containerCenter = containerTop + container.clientHeight / 2;

        let activePage = 1;
        let minDiff = Infinity;

        pages.forEach((page) => {
            const pageNum = parseInt(page.getAttribute("data-page"), 10);
            const pageCenter = page.offsetTop + page.clientHeight / 2;
            const diff = Math.abs(containerCenter - pageCenter);
            if (diff < minDiff) {
                minDiff = diff;
                activePage = pageNum;
            }
        });

        if (activePage !== currentPdfPage) {
            currentPdfPage = activePage;
            actualizarBadgePagina(currentPdfPage);
        }
    };

    container.addEventListener("scroll", container._scrollHandler, { passive: true });
}

function actualizarBadgePagina(pageNum) {
    const pageInfo = document.getElementById("pdfPageInfo");
    if (pageInfo && currentPdfDoc) {
        pageInfo.textContent = `Página ${pageNum} de ${currentPdfDoc.numPages}`;
    }

    const zoomVal = document.getElementById("pdfZoomLevel");
    if (zoomVal) {
        zoomVal.textContent = `${Math.round(currentPdfScale * 100)}%`;
    }

    const btnPrev = document.getElementById("btnPdfPrev");
    const btnNext = document.getElementById("btnPdfNext");
    if (btnPrev) btnPrev.disabled = pageNum <= 1;
    if (btnNext) btnNext.disabled = !currentPdfDoc || pageNum >= currentPdfDoc.numPages;
}

function irAPagina(pageNum) {
    if (!currentPdfDoc || pageNum < 1 || pageNum > currentPdfDoc.numPages) return;
    currentPdfPage = pageNum;
    const target = document.getElementById(`pdfPageWrapper_${pageNum}`);
    if (target) {
        target.scrollIntoView({ behavior: "smooth", block: "center" });
    }
    actualizarBadgePagina(pageNum);
}

window.abrirPDFModal = async function (url, titulo, anchorEl) {
    const modal = document.getElementById("pdfModal");
    const tituloElement = document.getElementById("pdfModalTitle");
    tituloElement.textContent = titulo;

    modal.style.display = "flex";

    if (anchorEl) {
        const fila = anchorEl.closest("tr");
        seleccionarFila(fila);
    }

    document.addEventListener("keydown", handleEscKey);

    currentPdfPage = 1;
    currentPdfScale = 1.0;
    currentPdfRotation = 0;

    const pageInfo = document.getElementById("pdfPageInfo");
    if (pageInfo) pageInfo.textContent = "Cargando...";

    const container = document.getElementById("pdfCanvasContainer");
    if (container) container.scrollTop = 0;

    try {
        if (currentPdfDoc) {
            try { currentPdfDoc.destroy(); } catch (_) {}
            currentPdfDoc = null;
        }

        const loadingTask = pdfjsLib.getDocument({ url: url });
        currentPdfDoc = await loadingTask.promise;
        await renderizarDocumentoPDF();
    } catch (error) {
        console.error("Error abriendo PDF en modal:", error);
        if (pageInfo) pageInfo.textContent = "Error al abrir";
    }
};

window.cerrarModal = function () {
    const modal = document.getElementById("pdfModal");
    modal.style.display = "none";

    if (currentPdfDoc) {
        try {
            currentPdfDoc.destroy();
        } catch (_) {}
        currentPdfDoc = null;
    }

    const pagesContainer = document.getElementById("pdfPagesContainer");
    if (pagesContainer) {
        pagesContainer.innerHTML = "";
    }

    document.removeEventListener("keydown", handleEscKey);
};

// Event listeners para controles del visor PDF
function inicializarControlesPDF() {
    const btnPrev = document.getElementById("btnPdfPrev");
    const btnNext = document.getElementById("btnPdfNext");
    const btnZoomIn = document.getElementById("btnPdfZoomIn");
    const btnZoomOut = document.getElementById("btnPdfZoomOut");
    const btnFit = document.getElementById("btnPdfFit");
    const btnRotate = document.getElementById("btnPdfRotate");

    if (btnPrev && !btnPrev._bound) {
        btnPrev._bound = true;
        btnPrev.addEventListener("click", () => {
            if (currentPdfPage > 1) {
                irAPagina(currentPdfPage - 1);
            }
        });
    }

    if (btnNext && !btnNext._bound) {
        btnNext._bound = true;
        btnNext.addEventListener("click", () => {
            if (currentPdfDoc && currentPdfPage < currentPdfDoc.numPages) {
                irAPagina(currentPdfPage + 1);
            }
        });
    }

    if (btnZoomIn && !btnZoomIn._bound) {
        btnZoomIn._bound = true;
        btnZoomIn.addEventListener("click", () => {
            currentPdfScale = Math.min(currentPdfScale + 0.25, 3.0);
            renderizarDocumentoPDF();
        });
    }

    if (btnZoomOut && !btnZoomOut._bound) {
        btnZoomOut._bound = true;
        btnZoomOut.addEventListener("click", () => {
            currentPdfScale = Math.max(currentPdfScale - 0.25, 0.5);
            renderizarDocumentoPDF();
        });
    }

    if (btnFit && !btnFit._bound) {
        btnFit._bound = true;
        btnFit.addEventListener("click", () => {
            currentPdfScale = 1.0;
            currentPdfRotation = 0;
            renderizarDocumentoPDF();
        });
    }

    if (btnRotate && !btnRotate._bound) {
        btnRotate._bound = true;
        btnRotate.addEventListener("click", () => {
            currentPdfRotation = (currentPdfRotation + 90) % 360;
            renderizarDocumentoPDF();
        });
    }
}

if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", inicializarControlesPDF);
} else {
    inicializarControlesPDF();
}

function handleEscKey(e) {
    if (e.key === "Escape") {
        window.cerrarModal();
    }
}

// Cerrar modal al hacer clic fuera del contenido
window.addEventListener("click", function (event) {
    const modal = document.getElementById("pdfModal");
    if (event.target === modal) {
        window.cerrarModal();
    }
});

function seleccionarFila(fila) {
    if (!fila || fila.parentElement !== tablaBody) return;
    const filaPrevia = tablaBody.querySelector("tr.selected");
    if (filaPrevia && filaPrevia !== fila) {
        filaPrevia.classList.remove("selected");
    }
    fila.classList.add("selected");
}

// Selección de filas en la tabla
tablaBody.addEventListener("click", function (event) {
    // Solo seleccionar si se hace clic en una celda (td) o en la fila
    const fila = event.target.closest("tr");
    if (fila && fila.parentElement === tablaBody) {
        // Si se hizo clic en un enlace, no seleccionar la fila
        if (event.target.tagName === "A" || event.target.closest("a")) {
            return;
        }
        seleccionarFila(fila);
    }
});

// ====== Popover para ver archivos de la carpeta ======
window.verArchivosCarpeta = function (carpeta, triggerEl) {
    const triggerBtn = triggerEl ? (triggerEl.closest("button") || triggerEl) : null;
    const r = todosLosResultados[carpeta];
    if (!r || !r.listaArchivos || r.listaArchivos.length === 0) return;

    // Remover popover previo si existe
    const prev = document.getElementById("archivosPopoverActivo");
    if (prev) {
        prev.remove();
        if (prev._trigger === triggerBtn) return; // Toggle off
    }

    const popover = document.createElement("div");
    popover.id = "archivosPopoverActivo";
    popover.className = "archivos-floating-popover";
    popover._trigger = triggerBtn;

    const filesListHTML = r.listaArchivos
        .map((archivo) => {
            const urlKey = Object.keys(r.fileUrls || {}).find(
                (k) => k.toLowerCase() === archivo.toLowerCase()
            );
            const url = urlKey ? r.fileUrls[urlKey] : null;
            if (url) {
                return `<a href="#" onclick="abrirPDFModal('${url}', '${archivo}', this); return false;" class="popover-file-link">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="width:12px;height:12px;"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path><polyline points="14 2 14 8 20 8"></polyline></svg>
                    <span>${archivo}</span>
                </a>`;
            }
            return `<div class="popover-file-item">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="width:12px;height:12px;"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path><polyline points="14 2 14 8 20 8"></polyline></svg>
                <span>${archivo}</span>
            </div>`;
        })
        .join("");

    popover.innerHTML = `
        <div class="popover-header">
            <span>Soportes (${r.listaArchivos.length})</span>
            <button type="button" class="popover-close-btn" onclick="document.getElementById('archivosPopoverActivo')?.remove()">&times;</button>
        </div>
        <div class="popover-body">${filesListHTML}</div>
    `;

    document.body.appendChild(popover);

    // Posicionar cerca del botón
    if (triggerBtn) {
        const rect = triggerBtn.getBoundingClientRect();
        popover.style.left = `${Math.max(10, rect.left)}px`;
        popover.style.top = `${rect.bottom + 6}px`;
    } else {
        popover.style.left = "260px";
        popover.style.top = "100px";
    }

    // Cerrar al hacer clic fuera
    const closeListener = (e) => {
        if (!popover.contains(e.target) && (!triggerBtn || !triggerBtn.contains(e.target))) {
            popover.remove();
            document.removeEventListener("click", closeListener);
        }
    };
    setTimeout(() => document.addEventListener("click", closeListener), 50);
};

// ====== Utilidades de copia ======
window.copiarNumero = function (event, carpeta) {
    const texto = carpeta || "";
    if (!texto) return;
    navigator.clipboard?.writeText(texto).then(() => {
        // Mostrar tooltip cerca del cursor
        const tip = document.createElement("div");
        tip.className = "tooltip-copy";
        tip.textContent = "Carpeta copiada: " + texto;
        document.body.appendChild(tip);
        const x = event.pageX;
        const y = event.pageY;
        tip.style.left = x + "px";
        tip.style.top = y + "px";
        setTimeout(() => {
            tip.remove();
        }, 1400);
    });
};

// ====== Modal Pop up para Reglas de Paquete ======
window.mostrarModalReglasPaquete = function (paquete) {
    const pkg = paquete || (document.getElementById("tipoPaquete") ? document.getElementById("tipoPaquete").value : "CPF1108");
    
    let terapias = "";
    switch (pkg) {
        case "CPF1109":
            terapias = "Entre 6 y 12 evoluciones sumadas en total.";
            break;
        case "CPF1110":
            terapias = "Entre 12 y 20 evoluciones sumadas en total.";
            break;
        case "CPF1105":
        case "CPF1106":
            terapias = "Entre 12 y 30 evoluciones sumadas en total.";
            break;
        case "CPF1108":
            terapias = "Sin requisitos específicos de cantidad.";
            break;
        default:
            terapias = "Requisitos según paquete.";
    }

    // Remover popup previo si existe
    const prev = document.getElementById("modalReglasPaqueteActivo");
    if (prev) prev.remove();

    const backdrop = document.createElement("div");
    backdrop.id = "modalReglasPaqueteActivo";
    backdrop.className = "modal-rules-backdrop";

    backdrop.innerHTML = `
        <div class="modal-rules-card" onclick="event.stopPropagation()">
            <div class="modal-rules-header">
                <div class="modal-rules-title">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="width:16px;height:16px;"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path><polyline points="14 2 14 8 20 8"></polyline><line x1="16" y1="13" x2="8" y2="13"></line><line x1="16" y1="17" x2="8" y2="17"></line></svg>
                    <span>Reglas de Validación: <strong>${pkg}</strong></span>
                </div>
                <button type="button" class="modal-rules-close" onclick="document.getElementById('modalReglasPaqueteActivo').remove()">&times;</button>
            </div>
            <div class="modal-rules-body">
                <div class="paquete-rules-card">
                    <div class="rule-group">
                        <span class="rule-label">Archivo Base:</span>
                        <span class="rule-value">Código del paquete dentro de <code>2 PAQ.pdf</code></span>
                    </div>
                    <div class="rule-group">
                        <span class="rule-label">Fijos Obligatorios:</span>
                        <div class="rule-chips">
                            <span class="rule-chip required">VM: 1</span>
                            <span class="rule-chip required">ENF: 1</span>
                            <span class="rule-chip required">VENF: 1</span>
                        </div>
                    </div>
                    <div class="rule-group">
                        <span class="rule-label">A Elección (1 solo):</span>
                        <div class="rule-chips">
                            <span class="rule-chip choice">PSI (1)</span>
                            <span class="rule-chip choice">NUT (1)</span>
                            <span class="rule-chip choice">TS (1)</span>
                        </div>
                    </div>
                    <div class="rule-group">
                        <span class="rule-label">Terapias:</span>
                        <span class="rule-value highlight">${terapias}</span>
                    </div>
                </div>
            </div>
        </div>
    `;

    document.body.appendChild(backdrop);
    backdrop.addEventListener("click", () => backdrop.remove());
};

// Event listener para el botón de descarga principal (si no estaba en otro lado)
if (btnDescargar) {
    btnDescargar.addEventListener("click", () => {
        exportarXLSX(todosLosResultados);
    });
}
