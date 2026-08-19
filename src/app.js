import * as pdfjsLib from "https://cdnjs.cloudflare.com/ajax/libs/pdf.js/4.0.379/pdf.min.mjs";
import * as XLSX from "https://cdn.sheetjs.com/xlsx-0.20.3/package/xlsx.mjs";
import { ALLOWED_TYPES, PDF_WORKER_URL } from "./config/constants.js";
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
const filtroEstadoSelect = document.getElementById("filtroEstado");
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
const IGNORAR_ARCHIVOS = new Set(["desktop.ini"]);

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
    buscarDocumentoInput.value = "";
    filtroServicioSelect.value = "";
    filtroEstadoSelect.value = "";
    todosLosResultados = {};
    todasLasCarpetas = [];
    erroresSeleccionados.clear();
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
    if (tipoValidacionSelect.value !== "paquete") {
        paqueteCondicionesIcon.style.display = "none";
        return;
    }

    const paquete = tipoPaqueteSelect.value;
    let terapias = "";

    switch (paquete) {
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
        <h4 style="margin: 0 0 10px 0; font-size: 0.95em; color: #059669; border-bottom: 1px solid #e5e7eb; padding-bottom: 5px;">Requisitos del paquete ${paquete}</h4>
        <ul style="margin: 0; padding-left: 15px; font-size: 0.85em; line-height: 1.5; color: #475569;">
            <li style="margin-bottom: 6px;"><strong>Validación General:</strong> El código del paquete debe estar dentro del archivo <code>2 PAQ.pdf</code>.</li>
            <li style="margin-bottom: 6px;"><strong>Servicios Fijos Obligatorios:</strong> Se requiere exactamente <strong>1 evolución</strong> de cada uno de los siguientes servicios:
                <ul style="padding-left: 15px; margin-top: 4px;">
                    <li><code>VM</code> (Visita Médica)</li>
                    <li><code>ENF</code> (Enfermería)</li>
                    <li><code>VENF</code> (Registro de Enfermería)</li>
                </ul>
            </li>
            <li style="margin-bottom: 6px;"><strong>Servicio a Elección Obligatorio:</strong> Se requiere exactamente <strong>1 evolución</strong> de <u>uno solo</u> de los siguientes servicios:
                <ul style="padding-left: 15px; margin-top: 4px;">
                    <li><code>PSI</code> (Psicología) o <code>NUT</code> (Nutrición) o <code>TS</code> (Trabajo Social).</li>
                </ul>
            </li>
            <li><strong>Terapias (TF, TR, FON, TO, TRS):</strong> ${terapias}</li>
        </ul>
    `;

    paqueteCondicionesContent.innerHTML = html;
    paqueteCondicionesIcon.style.display = "inline-flex";
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

// Event listeners para filtros
buscarDocumentoInput.addEventListener("input", aplicarFiltros);
mostrarExitosCheckbox.addEventListener("change", aplicarFiltros);
filtroServicioSelect.addEventListener("change", aplicarFiltros);
filtroEstadoSelect.addEventListener("change", aplicarFiltros);
limpiarFiltrosBtn.addEventListener("click", () => {
    buscarDocumentoInput.value = "";
    filtroServicioSelect.value = "";
    filtroEstadoSelect.value = "";
    mostrarExitosCheckbox.checked = true;
    erroresSeleccionados.clear();
    listaErroresDiv
        .querySelectorAll(".error-tipo-item.selected")
        .forEach((el) => el.classList.remove("selected"));
    aplicarFiltros();
});

// Selección de tipos de error desde el resumen
listaErroresDiv.addEventListener("click", (e) => {
    const item = e.target.closest(".error-tipo-item");
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
    const filtroEst = filtroEstadoSelect.value;
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
        filasCarpeta.forEach((fila) => {
            let mostrarFila = mostrarCarpeta;

            // Filtro por servicio (solo aplica a filas que tengan data-servicio)
            if (filtroServ && mostrarFila) {
                const servicioFila = fila.getAttribute("data-servicio");
                // Si la fila NO tiene data-servicio (es modo evento), no aplicar filtro de servicio
                if (servicioFila && servicioFila !== filtroServ) {
                    mostrarFila = false;
                }
            }

            // Filtro por estado (solo si la fila será mostrada)
            if (filtroEst && mostrarFila) {
                const estadoFila = fila.getAttribute("data-estado");
                if (estadoFila !== filtroEst) {
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

            fila.style.display = mostrarFila ? "" : "none";
        });
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

        // Contar errores por tipo y guardar carpetas
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
                    .slice(0, 10)
                    .join(", ");
                const totalCarpetasConEsteError = (carpetasPorTipo[tipo] || [])
                    .size;
                const foldersExtra =
                    totalCarpetasConEsteError > 10
                        ? ` y ${totalCarpetasConEsteError - 10} más...`
                        : "";

                return `<div class="error-tipo-item${seleccionado}" data-tipo="${tipo}" data-tipo-normalized="${tipoNorm}">
                    <div class="error-tipo-content">
                        <span class="error-tipo-texto">
                            <strong>${tipo}</strong>${detallePorTipo[tipo] ? " — " + detallePorTipo[tipo] : ""}
                        </span>
                        <span class="error-tipo-folders">Carpetas: ${listaCarpetas}${foldersExtra}</span>
                    </div>
                    <span class="error-tipo-count" title="Total incidencias">${count}</span>
                </div>`;
            })
            .join("");

        const exportBtnHtml = `
            <div style="margin-bottom: 12px; display: flex; justify-content: flex-end;">
                <button id="btnExportarErrores" class="btn-descargar" style="font-size: 12px; padding: 6px 12px; background-color: #7c3aed; border-color: #6d28d9;">
                    📊 Exportar errores agrupados
                </button>
            </div>
        `;

        listaErroresDiv.innerHTML = exportBtnHtml + errorItems;
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

    resumenDiv.classList.remove("oculto");
    if (!incremental) {
        filtrosDiv.classList.remove("oculto");
    }
}

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
                            r.tipo || "Paquete",
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
        tablaBody.innerHTML = "";
        estado.classList.remove("oculto");
        barraProgresoDiv.classList.remove("oculto");
        btnLimpiarTodo.classList.remove("oculto");
        resumenDiv.classList.add("oculto");
        filtrosDiv.classList.add("oculto");

        const carpetas = {};
        const resultados = {};
        const tipoValidacion = tipoValidacionSelect.value;
        const tipoPaquete = tipoPaqueteSelect.value;
        const convenio = convenioSelect.value;

        console.log("Configuración:", {
            tipoValidacion,
            tipoPaquete,
            convenio,
        });
        // console.log("Archivos seleccionados:", input.files.length);

        // Actualizar headers de la tabla
        actualizarHeadersTabla(
            tabla,
            tablaHeader,
            tipoValidacion,
            tipoPaquete,
            convenio,
        );

        // Agrupar archivos por carpeta
        console.log("=== INICIO AGRUPACIÓN DE ARCHIVOS ===");
        for (const f of input.files) {
            console.log(`Archivo: ${f.name}, Path: ${f.webkitRelativePath}`);
            if (IGNORAR_ARCHIVOS.has(f.name.toLowerCase())) {
                console.log(`  → Ignorado por IGNORAR_ARCHIVOS`);
                continue;
            }
            const p = f.webkitRelativePath.split("/");
            console.log(
                `  → Partes: ${JSON.stringify(p)}, Length: ${p.length}`,
            );
            if (p.length < 2) {
                console.log(`  → Saltado: length < 2`);
                continue;
            }
            const carpetaKey = p[p.length - 2];
            console.log(`  → Carpeta detectada: ${carpetaKey}`);
            carpetas[carpetaKey] ??= [];
            carpetas[carpetaKey].push(f);
        }
        console.log("Carpetas agrupadas:", Object.keys(carpetas));
        console.log("=== FIN AGRUPACIÓN ===");

        // Inicializar progreso
        const totalCarpetas = Object.keys(carpetas).length;

        if (totalCarpetas === 0) {
            estado.classList.remove("oculto");
            estado.textContent =
                "❌ Error: No se encontraron carpetas. Asegúrate de seleccionar una carpeta (no archivos individuales).";
            console.error("No se encontraron carpetas para procesar");
            return;
        }

        let carpetasProcesadas = 0;

        // Procesar cada carpeta
        for (const carpeta in carpetas) {
            resultados[carpeta] = inicializarResultado(
                tipoValidacion,
                tipoPaquete,
                convenio,
            );

            // Detectar tipo de carpeta (para validación por evento)
            if (tipoValidacion === "evento") {
                detectarTipoCarpeta(carpeta, resultados[carpeta], convenio);
            } else {
                resultados[carpeta].tipo = `Paquete: ${
                    tipoPaquete === "cronico"
                        ? "Crónico"
                        : "Crónico con terapias"
                }`;
            }

            // Crear fila placeholder
            createPlaceholderRow(
                tablaBody,
                carpeta,
                tipoValidacion,
                tipoPaquete,
            );

            const archivos = carpetas[carpeta];
            const nombres = archivos.map((a) => a.name);
            const nroDocumento = carpeta.match(/^\d+/)?.[0] || "";

            // Guardar datos útiles para copiar
            resultados[carpeta].nroDocumento = nroDocumento;
            resultados[carpeta].primerArchivoRelPath =
                archivos[0]?.webkitRelativePath || carpeta;
            resultados[carpeta].listaArchivos = nombres;

            // Inicializar URLs de archivos
            inicializarURLsArchivos(archivos, resultados[carpeta]);

            if (tipoValidacion === "paquete") {
                await validarPorPaquete(
                    carpeta,
                    archivos,
                    tipoPaquete,
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
                    carpeta,
                    archivos,
                    nombres,
                    nroDocumento,
                    resultados,
                    convenio,
                );
                // Actualizar fila después de procesar evento
                if (tablaBody && carpeta && resultados[carpeta]) {
                    console.log(`Actualizando fila para carpeta: ${carpeta}`);
                    updateRow(
                        tablaBody,
                        carpeta,
                        resultados[carpeta],
                        mostrarExitosCheckbox
                            ? mostrarExitosCheckbox.checked
                            : false,
                    );
                    const filasEnTabla = tablaBody.querySelectorAll(
                        `tr[data-carpeta="${carpeta}"]`,
                    );
                    console.log(
                        `Filas encontradas para ${carpeta}: ${filasEnTabla.length}`,
                    );
                } else {
                    console.warn(
                        `No se pudo actualizar fila: tablaBody=${!!tablaBody}, carpeta=${!!carpeta}, resultado=${!!resultados[carpeta]}`,
                    );
                }
            }

            // Quitar spinner final
            const row = document.querySelector(`tr[data-carpeta="${carpeta}"]`);
            if (row) row.classList.remove("processing");

            // Actualizar progreso y resumen incremental
            carpetasProcesadas++;
            actualizarProgreso(carpetasProcesadas, totalCarpetas, carpeta);
            actualizarResumen(resultados, true); // true = incremental
        }

        // Guardar resultados globales y actualizar resumen final
        todosLosResultados = resultados;
        todasLasCarpetas = Object.keys(carpetas);
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

        tablaBody.innerHTML = "";
        estado.classList.remove("oculto");
        barraProgresoDiv.classList.remove("oculto");
        btnLimpiarTodo.classList.remove("oculto");
        resumenDiv.classList.add("oculto");
        filtrosDiv.classList.add("oculto");

        const carpetas = {};
        const resultados = {};
        const tipoValidacion = tipoValidacionSelect.value;
        const tipoPaquete = tipoPaqueteSelect.value;
        const convenio = convenioSelect.value;

        console.log("Configuración:", {
            tipoValidacion,
            tipoPaquete,
            convenio,
        });

        actualizarHeadersTabla(
            tabla,
            tablaHeader,
            tipoValidacion,
            tipoPaquete,
            convenio,
        );

        // console.log("=== INICIO AGRUPACIÓN DE ARCHIVOS (FS) ===");
        for (const f of fsFiles) {
            console.log(
                `Procesando archivo: ${f.name}, webkitRelativePath: ${f.webkitRelativePath}`,
            );

            if (IGNORAR_ARCHIVOS.has(f.name.toLowerCase())) {
                console.log(`  → Ignorado`);
                continue;
            }

            const p = f.webkitRelativePath.split("/");
            console.log(
                `  → Partes: ${JSON.stringify(p)}, Length: ${p.length}`,
            );

            if (p.length < 2) {
                console.log(`  → Saltado: estructura inválida`);
                continue;
            }

            const carpetaKey = p[p.length - 2];
            console.log(`  → Carpeta detectada: ${carpetaKey}`);

            carpetas[carpetaKey] ??= [];
            carpetas[carpetaKey].push(f);
        }

        console.log("Carpetas agrupadas:", Object.keys(carpetas));
        // console.log("=== FIN AGRUPACIÓN (FS) ===");

        const totalCarpetas = Object.keys(carpetas).length;

        if (totalCarpetas === 0) {
            estado.classList.remove("oculto");
            estado.textContent =
                "❌ Error: No se encontraron carpetas en la selección.";
            console.error("No se encontraron carpetas para procesar");
            return;
        }

        let carpetasProcesadas = 0;

        for (const carpeta in carpetas) {
            resultados[carpeta] = inicializarResultado(
                tipoValidacion,
                tipoPaquete,
                convenio,
            );
            if (tipoValidacion === "evento") {
                detectarTipoCarpeta(carpeta, resultados[carpeta], convenio);
            } else {
                resultados[carpeta].tipo = `Paquete: ${
                    tipoPaquete === "cronico"
                        ? "Crónico"
                        : "Crónico con terapias"
                }`;
            }
            createPlaceholderRow(
                tablaBody,
                carpeta,
                tipoValidacion,
                tipoPaquete,
            );

            const archivos = carpetas[carpeta];
            const nombres = archivos.map((a) => a.name);
            const nroDocumento = carpeta.match(/^\d+/)?.[0] || "";
            resultados[carpeta].nroDocumento = nroDocumento;
            resultados[carpeta].primerArchivoRelPath =
                archivos[0]?.webkitRelativePath || carpeta;
            resultados[carpeta].listaArchivos = nombres;
            inicializarURLsArchivos(archivos, resultados[carpeta]);

            if (tipoValidacion === "paquete") {
                await validarPorPaquete(
                    carpeta,
                    archivos,
                    tipoPaqueteSelect.value,
                    nroDocumento,
                    resultados,
                    estado,
                    (carpeta, resultado) =>
                        updateRow(
                            tablaBody,
                            carpeta,
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
                    carpeta,
                    archivos,
                    nombres,
                    nroDocumento,
                    resultados,
                    convenio,
                );
                // Actualizar fila después de procesar evento
                updateRow(
                    tablaBody,
                    carpeta,
                    resultados[carpeta],
                    mostrarExitosCheckbox.checked,
                );
            }

            const row = document.querySelector(`tr[data-carpeta="${carpeta}"]`);
            if (row) row.classList.remove("processing");
            carpetasProcesadas++;
            actualizarProgreso(carpetasProcesadas, totalCarpetas, carpeta);
            actualizarResumen(resultados, true);
        }

        todosLosResultados = resultados;
        todasLasCarpetas = Object.keys(carpetas);
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

// ================= FUNCIONES GLOBALES PARA MODAL =================
window.abrirPDFModal = function (url, titulo, anchorEl) {
    const modal = document.getElementById("pdfModal");
    const frame = document.getElementById("pdfFrame");
    const tituloElement = document.getElementById("pdfModalTitle");

    tituloElement.textContent = titulo;
    // Abrir con zoom del visor a 150% sin afectar resolución
    try {
        frame.src = url + "#zoom=150";
    } catch {
        frame.src = url;
    }
    modal.style.display = "block";

    // Marcar la fila asociada
    if (anchorEl) {
        const fila = anchorEl.closest("tr");
        seleccionarFila(fila);
    }

    // Cerrar con ESC
    document.addEventListener("keydown", handleEscKey);
};

window.cerrarModal = function () {
    const modal = document.getElementById("pdfModal");
    const frame = document.getElementById("pdfFrame");

    modal.style.display = "none";
    frame.src = "";
    // No modificar estilos al cerrar para evitar acumulaciones

    document.removeEventListener("keydown", handleEscKey);
};

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

// ====== Utilidades de copia ======
window.copiarNumero = function (event, carpeta) {
    const r = todosLosResultados[carpeta];
    const texto = r?.nroDocumento || "";
    if (!texto) return;
    navigator.clipboard?.writeText(texto).then(() => {
        // Mostrar tooltip cerca del cursor
        const tip = document.createElement("div");
        tip.className = "tooltip-copy";
        tip.textContent = "Número copiado";
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

// Event listener para el botón de descarga principal (si no estaba en otro lado)
if (btnDescargar) {
    btnDescargar.addEventListener("click", () => {
        exportarXLSX(todosLosResultados);
    });
}
