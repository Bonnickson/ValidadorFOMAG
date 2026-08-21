/**
 * Normaliza el tipo de error para comparaciones consistentes
 */
export const normalizarTipoError = (txt) => (txt || "").trim().toLowerCase();

/**
 * Agrupa errores similares bajo un tipo general
 */
export function clasificarErrorResumen(error) {
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

/**
 * Actualiza la barra de progreso
 */
export function actualizarProgreso(actual, total, carpeta = "", archivo = "", elements = {}) {
    const { progresoFill, progresoPorcentaje, progresoTexto, progresoDetalle } = elements;
    const porcentaje = Math.round((actual / total) * 100);

    if (progresoFill) progresoFill.style.width = `${porcentaje}%`;
    if (progresoPorcentaje) progresoPorcentaje.textContent = `${porcentaje}%`;
    if (progresoTexto) progresoTexto.textContent = `Procesando ${actual} de ${total} carpetas`;

    if (progresoDetalle) {
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
}

/**
 * Aplica los filtros de búsqueda, servicio, estado y tipo de error a la tabla
 */
export function aplicarFiltros(elements = {}, state = {}) {
    const {
        buscarDocumentoInput,
        filtroServicioSelect,
        mostrarExitosCheckbox,
        tablaBody,
    } = elements;

    if (!tablaBody) return;

    const buscarDoc = buscarDocumentoInput ? buscarDocumentoInput.value.trim().toLowerCase() : "";
    const filtroServ = filtroServicioSelect ? filtroServicioSelect.value : "";
    const filtroEst = state.estadoFiltroActivo || "";
    const mostrarExitos = mostrarExitosCheckbox ? mostrarExitosCheckbox.checked : false;
    const tiposErroresActivos = new Set(state.erroresSeleccionados || []);

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

    Object.entries(filasPorCarpeta).forEach(([carpeta, filasCarpeta]) => {
        let mostrarCarpeta = true;
        if (buscarDoc && !carpeta.toLowerCase().includes(buscarDoc)) {
            mostrarCarpeta = false;
        }

        const filasVisibles = [];
        filasCarpeta.forEach((fila) => {
            let mostrarFila = mostrarCarpeta;

            if (filtroServ && mostrarFila) {
                const servicioFila = fila.getAttribute("data-servicio");
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

            if (filtroEst && mostrarFila) {
                const estadoFila = fila.getAttribute("data-estado");
                if (filtroEst === "con-novedades") {
                    if (estadoFila === "sin-errores") {
                        mostrarFila = false;
                    }
                } else if (estadoFila !== filtroEst) {
                    mostrarFila = false;
                }
            }

            if (tiposErroresActivos.size > 0 && mostrarFila) {
                const erroresFila = fila.querySelectorAll(
                    ".error-item[data-error-type]"
                );
                const coincide = Array.from(erroresFila).some((err) => {
                    const tNorm =
                        err.getAttribute("data-error-type-normalized") ||
                        normalizarTipoError(
                            err.getAttribute("data-error-type") || ""
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

    const exitosItems = document.querySelectorAll(".validacion-exitosa");
    exitosItems.forEach((item) => {
        item.style.display = mostrarExitos ? "" : "none";
    });
}

/**
 * Reinicia todos los filtros a su estado por defecto
 */
export function reiniciarFiltros(elements = {}, state = {}, ejecutarAplicar = true) {
    const {
        buscarDocumentoInput,
        filtroServicioSelect,
        grupoFiltroEstado,
        mostrarExitosCheckbox,
        listaErroresDiv,
    } = elements;

    if (buscarDocumentoInput) buscarDocumentoInput.value = "";
    if (filtroServicioSelect) filtroServicioSelect.value = "";
    state.estadoFiltroActivo = "";

    if (grupoFiltroEstado) {
        grupoFiltroEstado.querySelectorAll(".btn-segmented").forEach((btn) => {
            btn.classList.toggle("active", btn.getAttribute("data-estado") === "");
        });
    }

    if (mostrarExitosCheckbox) mostrarExitosCheckbox.checked = false;
    if (state.erroresSeleccionados) state.erroresSeleccionados.clear();

    if (listaErroresDiv) {
        listaErroresDiv
            .querySelectorAll(".error-tipo-item.selected, .error-card-pill.selected")
            .forEach((el) => el.classList.remove("selected"));
    }

    if (ejecutarAplicar) {
        aplicarFiltros(elements, state);
    }
}

/**
 * Actualiza el resumen estadístico y la cuadrícula de incidencias
 */
export function actualizarResumen(
    resultados,
    elements = {},
    state = {},
    incremental = false,
    onExportarErroresCallback = null
) {
    const {
        resumenDiv,
        filtrosDiv,
        resumenErroresDiv,
        listaErroresDiv,
    } = elements;

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
        const todosLosErrores = [...(r.errores || [])];
        Object.values(r.erroresPorServicio || {}).forEach((arr) => {
            todosLosErrores.push(...arr);
        });

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
            (arr) => arr.length > 0
        );

        if (tieneErrores) {
            conErrores++;
        } else if (tieneAlertas) {
            conAlertas++;
        } else {
            sinErrores++;
        }
    });

    const statTotal = document.getElementById("statTotal");
    const statExito = document.getElementById("statExito");
    const statAlertas = document.getElementById("statAlertas");
    const statErrores = document.getElementById("statErrores");

    if (statTotal) statTotal.textContent = total;
    if (statExito) statExito.textContent = sinErrores;
    if (statAlertas) statAlertas.textContent = conAlertas;
    if (statErrores) statErrores.textContent = conErrores;

    if (resumenDiv) resumenDiv.classList.remove("oculto");

    if (incremental) return;

    if (Object.keys(erroresPorTipo).length > 0 && listaErroresDiv) {
        const tiposDisponibles = new Set(
            Object.keys(erroresPorTipo).map(normalizarTipoError)
        );
        if (state.erroresSeleccionados) {
            [...state.erroresSeleccionados].forEach((t) => {
                if (!tiposDisponibles.has(t)) {
                    state.erroresSeleccionados.delete(t);
                }
            });
        }

        const errorItems = Object.entries(erroresPorTipo)
            .sort((a, b) => b[1] - a[1])
            .map(([tipo, count]) => {
                const tipoNorm = normalizarTipoError(tipo);
                const seleccionado = state.erroresSeleccionados && state.erroresSeleccionados.has(tipoNorm)
                    ? " selected"
                    : "";

                const listaCarpetas = Array.from(carpetasPorTipo[tipo] || [])
                    .slice(0, 8)
                    .join(", ");
                const totalCarpetasConEsteError = (carpetasPorTipo[tipo] || []).size;
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
        if (resumenErroresDiv) resumenErroresDiv.classList.remove("oculto");

        const btnExport = document.getElementById("btnExportarErrores");
        if (btnExport && typeof onExportarErroresCallback === "function") {
            btnExport.addEventListener("click", (e) => {
                e.stopPropagation();
                onExportarErroresCallback(erroresPorTipo, detallePorTipo, carpetasPorTipo);
            });
        }
    } else if (resumenErroresDiv) {
        resumenErroresDiv.classList.add("oculto");
    }

    if (filtrosDiv) filtrosDiv.classList.remove("oculto");
    aplicarFiltros(elements, state);
}
