import {
    PAQUETES_INFO,
    REGLAS_TERAPIAS_PAQUETES,
    obtenerInfoSoporte,
} from "../config/constants.js";

/**
 * Muestra el resumen de condiciones del paquete seleccionado en el panel lateral
 */
export function mostrarCondicionesPaquete(tipoPaqueteSelect, paqueteCondicionesContent) {
    if (!paqueteCondicionesContent || !tipoPaqueteSelect) return;

    const paquete = tipoPaqueteSelect.value;
    const regla = REGLAS_TERAPIAS_PAQUETES[paquete] || { descripcion: "Requisitos según paquete." };
    const terapias = regla.descripcion;

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

/**
 * Modal Pop-up para Reglas de Paquete
 */
export function mostrarModalReglasPaquete(paquete) {
    const pkg = paquete || (document.getElementById("tipoPaquete") ? document.getElementById("tipoPaquete").value : "CPF1108");
    const regla = REGLAS_TERAPIAS_PAQUETES[pkg] || { descripcion: "Requisitos según paquete." };
    const terapias = regla.descripcion;

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
                <button type="button" class="modal-rules-close" onclick="document.getElementById('modalReglasPaqueteActivo')?.remove()">&times;</button>
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
                            <span class="rule-chip required">🩺 Valoración Médica (1)</span>
                            <span class="rule-chip required">🩺 Enfermería Profesional (1)</span>
                            <span class="rule-chip required">💉 Auxiliar de Enfermería (1)</span>
                        </div>
                    </div>
                    <div class="rule-group">
                        <span class="rule-label">A Elección (1 solo):</span>
                        <div class="rule-chips">
                            <span class="rule-chip choice">🧠 Psicología (1)</span>
                            <span class="rule-chip choice">🥗 Nutrición (1)</span>
                            <span class="rule-chip choice">👥 Trabajo Social (1)</span>
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
}

/**
 * Modal de Aviso Obligatorio de Revisión de Firmas con temporizador
 */
export function mostrarAvisoRevisionFirmas() {
    const prev = document.getElementById("modalAvisoFirmasActivo");
    if (prev) prev.remove();

    const backdrop = document.createElement("div");
    backdrop.id = "modalAvisoFirmasActivo";
    backdrop.className = "modal-aviso-firmas-backdrop";

    let segundosRestantes = 4;

    backdrop.innerHTML = `
        <div class="modal-aviso-firmas-card" onclick="event.stopPropagation()">
            <div class="modal-aviso-firmas-header">
                <div class="modal-aviso-firmas-icon">✍️</div>
                <div class="modal-aviso-firmas-title">Control Obligatorio: Verificación de Firmas (4.pdf)</div>
            </div>
            <div class="modal-aviso-firmas-body">
                <div class="aviso-intro-text">
                    Es requisito indispensable <strong>verificar manualmente 1 a 1</strong> el archivo <strong>4.pdf</strong> haciendo clic sobre el <strong>«4»</strong> de cada servicio y constatar:
                </div>

                <div class="aviso-checklist">
                    <div class="checklist-item">
                        <span class="chk-icon">📅</span>
                        <div class="chk-content"><strong>Fechas coincidentes:</strong> Deben coincidir exactamente con las fechas de la historia clínica (5.pdf).</div>
                    </div>
                    <div class="checklist-item">
                        <span class="chk-icon">🔢</span>
                        <div class="chk-content"><strong>Cantidad acorde:</strong> El total de firmas registradas debe corresponder al número de evoluciones.</div>
                    </div>
                    <div class="checklist-item">
                        <span class="chk-icon">🔍</span>
                        <div class="chk-content"><strong>Legibilidad completa:</strong> El documento debe ser nítido, sin borrones, tachones ni firmas cortadas.</div>
                    </div>
                    <div class="checklist-item">
                        <span class="chk-icon">📐</span>
                        <div class="chk-content"><strong>Orientación de lectura vertical:</strong> Las firmas y el texto deben leerse al derecho (en sentido vertical de lectura natural), nunca de lado, acostadas ni rotadas 90°.</div>
                    </div>
                </div>

                <div class="orientacion-ejemplo-box">
                    <div class="orientacion-title">Sentido de Lectura de las Firmas:</div>
                    <div class="orientacion-grid">
                        <div class="orientacion-card incorrecto">
                            <div class="firma-table-container incorrecto-box">
                                <table class="mini-tabla-firmas">
                                    <thead>
                                        <tr><th>Fecha</th><th>Serv</th><th>Firma</th></tr>
                                    </thead>
                                    <tbody>
                                        <tr><td>02/08</td><td>TF</td><td>✍️ Ok</td></tr>
                                        <tr><td>05/08</td><td>TF</td><td>✍️ Ok</td></tr>
                                    </tbody>
                                </table>
                            </div>
                            <span class="orientacion-label">❌ De lado / Rotado</span>
                        </div>
                        <div class="orientacion-card correcto">
                            <div class="firma-table-container correcto-box">
                                <table class="mini-tabla-firmas">
                                    <thead>
                                        <tr><th>Fecha</th><th>Serv</th><th>Firma</th></tr>
                                    </thead>
                                    <tbody>
                                        <tr><td>02/08</td><td>TF</td><td>✍️ Ok</td></tr>
                                        <tr><td>05/08</td><td>TF</td><td>✍️ Ok</td></tr>
                                    </tbody>
                                </table>
                            </div>
                            <span class="orientacion-label">✅ Al derecho / Vertical</span>
                        </div>
                    </div>
                </div>
            </div>
            <button type="button" id="btnCerrarAvisoFirmas" class="btn-aviso-firmas" disabled>
                He leído las instrucciones (${segundosRestantes}s)...
            </button>
        </div>
    `;

    document.body.appendChild(backdrop);

    const btnCerrar = backdrop.querySelector("#btnCerrarAvisoFirmas");

    const timer = setInterval(() => {
        segundosRestantes--;
        if (segundosRestantes > 0) {
            btnCerrar.textContent = `He leído las instrucciones (${segundosRestantes}s)...`;
        } else {
            clearInterval(timer);
            btnCerrar.disabled = false;
            btnCerrar.textContent = "Entendido, proceder con la auditoría";
            btnCerrar.classList.add("btn-aviso-firmas-ready");
        }
    }, 1000);

    const cerrarModal = () => {
        if (btnCerrar.disabled) return;
        clearInterval(timer);
        backdrop.remove();
    };

    btnCerrar.addEventListener("click", cerrarModal);
}

/**
 * Popover para ver archivos de la carpeta
 */
export function verArchivosCarpeta(
    carpeta,
    triggerEl,
    todosLosResultados,
    seleccionarCarpetaCallback,
    abrirPDFModalCallback
) {
    if (typeof seleccionarCarpetaCallback === "function") {
        seleccionarCarpetaCallback(carpeta);
    }
    const triggerBtn = triggerEl ? (triggerEl.closest("button") || triggerEl) : null;
    const r = todosLosResultados ? todosLosResultados[carpeta] : null;
    if (!r || !r.listaArchivos || r.listaArchivos.length === 0) return;

    const prev = document.getElementById("archivosPopoverActivo");
    if (prev) {
        prev.remove();
        if (prev._trigger === triggerBtn) return;
    }

    const popover = document.createElement("div");
    popover.id = "archivosPopoverActivo";
    popover.className = "archivos-floating-popover";
    popover._trigger = triggerBtn;

    const filesListHTML = r.listaArchivos
        .map((archivo) => {
            const info = obtenerInfoSoporte(archivo);
            const urlKey = Object.keys(r.fileUrls || {}).find(
                (k) => k.toLowerCase() === archivo.toLowerCase()
            );
            const url = urlKey ? r.fileUrls[urlKey] : null;
            const extraCls = info.reconocido ? "soporte-valido" : "soporte-no-reconocido";
            const iconHTML = info.reconocido
                ? `<span class="soporte-icon">${info.icono}</span>`
                : `<span class="soporte-icon error-x">❌</span>`;
            const badgeTexto = info.reconocido
                ? ""
                : `<span class="badge-no-reconocido" title="Soporte no reconocido">No reconocido</span>`;

            if (url) {
                return `<a href="#" onclick="abrirPDFModal('${url}', '${archivo}', this); return false;" class="popover-file-link ${extraCls}" title="${info.tipo}: ${archivo}">
                    ${iconHTML}
                    <span class="popover-file-name">${archivo}</span>
                    ${badgeTexto}
                </a>`;
            }
            return `<div class="popover-file-item ${extraCls}" title="${info.tipo}: ${archivo}">
                ${iconHTML}
                <span class="popover-file-name">${archivo}</span>
                ${badgeTexto}
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

    if (triggerBtn) {
        const rect = triggerBtn.getBoundingClientRect();
        popover.style.left = `${Math.max(10, rect.left)}px`;
        popover.style.top = `${rect.bottom + 6}px`;
    } else {
        popover.style.left = "260px";
        popover.style.top = "100px";
    }

    const closeListener = (e) => {
        if (!popover.contains(e.target) && (!triggerBtn || !triggerBtn.contains(e.target))) {
            popover.remove();
            document.removeEventListener("click", closeListener);
        }
    };
    setTimeout(() => document.addEventListener("click", closeListener), 50);
}

/**
 * Modal de diagnóstico y prevalidación de matriz
 */
export function mostrarModalPrevalidacionMatriz(matrizData) {
    if (!matrizData) return;

    const prev = document.getElementById("modalPrevalidacionMatrizActivo");
    if (prev) prev.remove();

    const { diagnosticoGlobal, pacientesList } = matrizData;

    const backdrop = document.createElement("div");
    backdrop.id = "modalPrevalidacionMatrizActivo";
    backdrop.className = "modal-rules-backdrop";

    const totalPacientes = diagnosticoGlobal.totalPacientes || 0;
    const conErrores = diagnosticoGlobal.pacientesConErrores || 0;
    const conformes = totalPacientes - conErrores;

    // Badges de conteo por paquete con los colores oficiales de badges
    const paquetesHTML = Object.entries(diagnosticoGlobal.conteoPorPaquete || {})
        .map(([pkg, count]) => {
            const pkgCls = `pkg-${pkg.toLowerCase()}`;
            return `
                <div class="preval-pkg-chip doc-package-tag ${pkgCls}">
                    <span class="package-name">${pkg}</span>
                    <span class="preval-pkg-count">${count}</span>
                </div>
            `;
        })
        .join("") || "<span style='color:var(--text-muted); font-size:11px;'>Sin paquetes</span>";

    // Helper para formatear nombres a Title/PascalCase
    const formatPascalCase = (str) => {
        if (!str) return "—";
        return str.toLowerCase().replace(/(?:^|\s|\/|-)\S/g, match => match.toUpperCase());
    };

    // Filas de la tabla
    const filasHTML = pacientesList.map((p) => {
        const estadoBadge = p.valido
            ? `<span class="preval-badge success">✔ Conforme</span>`
            : `<span class="preval-badge error">✗ Novedades</span>`;

        const renderDiagItem = (texto, tipo) => {
            const icon = tipo === "error" ? "✕" : "!";
            const cls = tipo === "error" ? "preval-item-error" : "preval-item-warning";
            const parts = texto.split(":");
            if (parts.length > 1) {
                const header = parts[0].trim();
                const body = parts.slice(1).join(":").trim();
                return `<div class="${cls}"><span class="preval-icon-bullet">${icon}</span><span class="preval-err-tag">${header}</span><span class="preval-err-desc">${body}</span></div>`;
            }
            return `<div class="${cls}"><span class="preval-icon-bullet">${icon}</span><span>${texto}</span></div>`;
        };

        const detalles = [
            ...(p.errores || []).map(e => renderDiagItem(e, "error")),
            ...(p.alertas || []).map(a => renderDiagItem(a, "warning")),
        ].join("");

        const pkgCode = p.paquete || p.paqueteRaw || "—";
        const pkgCls = p.paquete ? `pkg-${p.paquete.toLowerCase()}` : "";
        const s = p.servicios || {};

        // Helper para formatear cadenas a PascalCase
        const toPascalCase = (str) => {
            if (!str) return "—";
            return str
                .toLowerCase()
                .replace(/(?:^|\s|\/|-)\S/g, (match) => match.toUpperCase());
        };

        const nombrePascal = toPascalCase(p.nombre);

        // Desglose de terapias con formato visual (grisesito las que tienen 0)
        const listaTerapias = [
            { nombre: "TF", cant: s.TF || 0 },
            { nombre: "TR", cant: s.TR || 0 },
            { nombre: "TRS", cant: s.TRS || 0 },
            { nombre: "FON", cant: s.FON || 0 },
            { nombre: "TO", cant: s.TO || 0 },
        ];

        const terapiasDetalleChips = listaTerapias
            .map((t) => `<span class="pserv-ter-item ${t.cant === 0 ? 'zero' : 'active'}">${t.nombre}:${t.cant}</span>`)
            .join(" ");

        // Texto plano del error para el botón de copiar
        const textoErroresRaw = (p.errores || []).join(" | ") || (p.alertas || []).join(" | ") || "Conforme";
        const textoErroresEscaped = textoErroresRaw.replace(/'/g, "\\'");

        // 3 Grupos ordenados, alineados en columnas consistentes
        const chipsServicios = `
            <div class="preval-services-structured">
                <!-- 1. Fijos Obligatorios -->
                <div class="pserv-group">
                    <span class="pserv-group-title">Fijos:</span>
                    <div class="pserv-group-items">
                        <span class="pserv-tag oblig ${s.VM === 1 ? 'ok' : 'err'}">VM: ${s.VM}</span>
                        <span class="pserv-tag oblig ${s.VENF === 1 ? 'ok' : 'err'}">VENF: ${s.VENF}</span>
                        <span class="pserv-tag oblig ${s.ENF === 1 ? 'ok' : 'err'}">ENF: ${s.ENF}</span>
                    </div>
                </div>

                <!-- 2. Opcional A Elección -->
                <div class="pserv-group">
                    <span class="pserv-group-title">Opcional:</span>
                    <div class="pserv-group-items">
                        <span class="pserv-tag opt ${s.PSI > 0 ? 'active' : 'dim'}">PSI: ${s.PSI}</span>
                        <span class="pserv-tag opt ${s.NUT > 0 ? 'active' : 'dim'}">NUT: ${s.NUT}</span>
                        <span class="pserv-tag opt ${s.TS > 0 ? 'active' : 'dim'}">TS: ${s.TS}</span>
                    </div>
                </div>

                <!-- 3. Terapias con Desglose y Suma -->
                <div class="pserv-group">
                    <span class="pserv-group-title">Terapias:</span>
                    <div class="pserv-group-items">
                        <span class="pserv-tag ter-total">Total: ${p.totalTerapias}</span>
                        <div class="pserv-tag ter-detail">${terapiasDetalleChips}</div>
                    </div>
                </div>
            </div>
        `;

        return `
            <tr class="preval-row ${p.valido ? 'valido' : 'con-novedad'}" data-doc="${p.documento || ''}" data-nombre="${(p.nombre || '').toLowerCase()}" data-pkg="${pkgCode}" data-estado="${p.valido ? 'conforme' : 'novedades'}">
                <td class="preval-cell-num">${p.filaExcel}</td>
                <td class="preval-cell-doc">
                    <div class="doc-badge-stack preval-doc-badge-stack">
                        <div class="doc-package-tag ${pkgCls}">
                            <span class="package-name">${pkgCode}</span>
                            <button type="button" class="btn-package-rules" onclick="mostrarModalReglasPaquete('${pkgCode}')" title="Ver reglas de ${pkgCode}">
                                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="width:10px;height:10px;"><circle cx="12" cy="12" r="10"></circle><line x1="12" y1="16" x2="12" y2="12"></line><line x1="12" y1="8" x2="12.01" y2="8"></line></svg>
                            </button>
                        </div>
                        <div class="doc-title-line preval-doc-title-line">
                            <span class="carpeta-nombre preval-doc-num">${p.documento || "—"}</span>
                        </div>
                        <div class="preval-copy-btn-group">
                            <button type="button" class="btn-copy-minimal btn-copy-doc" title="Copiar sólo documento (${p.documento})">📋</button>
                            <button type="button" class="btn-copy-minimal btn-copy-pkg-doc" title="Copiar '${pkgCode} - ${p.documento} - '">🏷️</button>
                            <button type="button" class="btn-copy-minimal btn-copy-err" title="Copiar con novedad">📝</button>
                        </div>
                    </div>
                </td>
                <td class="preval-cell-name-full" title="${p.nombre || ''}">${nombrePascal}</td>
                <td class="preval-cell-terapias">
                    ${chipsServicios}
                </td>
                <td class="preval-cell-status">${estadoBadge}</td>
                <td class="preval-cell-diag">${detalles || '<span class="preval-ok-text">Cumple todas las condiciones</span>'}</td>
            </tr>
        `;
    }).join("");

    backdrop.innerHTML = `
        <div class="preval-modal-card" onclick="event.stopPropagation()">
            <!-- Modal Header Compacto -->
            <div class="preval-modal-header">
                <div class="preval-title-group">
                    <div class="preval-header-icon">
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" style="width:16px;height:16px;"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path><polyline points="14 2 14 8 20 8"></polyline><line x1="16" y1="13" x2="8" y2="13"></line><line x1="16" y1="17" x2="8" y2="17"></line></svg>
                    </div>
                    <div>
                        <h2 class="preval-modal-title">Pre-validación de Matriz</h2>
                        <p class="preval-modal-subtitle">Verificación automática de reglas de paquete antes de la auditoría</p>
                    </div>
                </div>
                <button type="button" class="modal-rules-close" onclick="document.getElementById('modalPrevalidacionMatrizActivo')?.remove()" title="Cerrar">&times;</button>
            </div>

            <!-- Modal Content Body -->
            <div class="preval-modal-body">
                <!-- Ribbon Stats y Chips de Paquete -->
                <div class="preval-top-toolbar">
                    <div class="stats-cluster">
                        <div class="stat-pill">
                            <span class="stat-pill-label">Total</span>
                            <span class="stat-pill-value" id="prevalKpiTotal">${totalPacientes}</span>
                        </div>
                        <div class="stat-pill success">
                            <span class="stat-pill-label">Conformes</span>
                            <span class="stat-pill-value" id="prevalKpiConformes">${conformes}</span>
                        </div>
                        <div class="stat-pill ${conErrores > 0 ? 'error' : ''}">
                            <span class="stat-pill-label">Novedades</span>
                            <span class="stat-pill-value" id="prevalKpiNovedades">${conErrores}</span>
                        </div>
                    </div>

                    <div class="preval-pkg-section">
                        <span class="preval-pkg-section-label">Paquetes:</span>
                        <div class="preval-pkg-cluster">${paquetesHTML}</div>
                    </div>
                </div>

                <!-- Barra de Búsqueda y Filtros Integrada -->
                <div class="preval-filter-strip">
                    <div class="preval-search-box">
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="width:13px;height:13px;color:var(--text-muted);"><circle cx="11" cy="11" r="8"></circle><line x1="21" y1="21" x2="16.65" y2="16.65"></line></svg>
                        <input type="text" id="prevalBuscarInput" class="preval-input-search" placeholder="Buscar por documento o nombre..." />
                    </div>

                    <div class="preval-filter-group">
                        <div class="studio-segmented-control" id="prevalFiltroEstadoGroup">
                            <button type="button" class="btn-segmented active" data-filter-estado="">Todos</button>
                            <button type="button" class="btn-segmented" data-filter-estado="conforme">Conformes</button>
                            <button type="button" class="btn-segmented" data-filter-estado="novedades">Con novedades</button>
                        </div>
                    </div>
                </div>

                <!-- Tabla de Diagnóstico Compacta -->
                <div class="preval-table-container">
                    <table class="preval-table" id="prevalTableMain">
                        <thead>
                            <tr>
                                <th style="width: 36px;">Fila</th>
                                <th style="width: 120px;">Documento</th>
                                <th style="width: 180px;">Nombre Paciente</th>
                                <th style="width: 320px;">Programación Matriz</th>
                                <th style="width: 95px;">Estado</th>
                                <th>Hallazgos / Reglas</th>
                            </tr>
                        </thead>
                        <tbody id="prevalTableBody">
                            ${filasHTML}
                        </tbody>
                    </table>
                </div>
            </div>

            <!-- Modal Footer -->
            <div class="preval-modal-footer">
                <span class="preval-footer-hint">Las cantidades programadas en la matriz se compararán de forma estricta contra las evoluciones de los PDFs.</span>
                <label class="studio-dropzone mini-dropzone" id="dropzoneModalSoportes" title="Click o arrastra la carpeta de soportes aquí">
                    <div class="dropzone-icon">
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="width:15px;height:15px;"><path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"></path></svg>
                    </div>
                    <div class="dropzone-text-row">
                        <span class="dropzone-title">Cargar Soportes</span>
                        <span class="dropzone-subtitle">(Click o arrastra carpeta)</span>
                    </div>
                    <input type="file" id="inputFolderModal" webkitdirectory directory multiple />
                </label>
            </div>
        </div>
    `;

    document.body.appendChild(backdrop);

    // Conectar el input del mini dropzone con el input principal para disparar la validación
    const inputFolderModal = document.getElementById("inputFolderModal");
    if (inputFolderModal) {
        inputFolderModal.addEventListener("change", (e) => {
            const files = e.target.files;
            if (files && files.length > 0) {
                // Cerrar modal de prevalidación
                backdrop.remove();
                // Mostrar sección de soportes
                const secSoportes = document.getElementById("seccionSoportes");
                if (secSoportes) secSoportes.classList.remove("oculto");
                // Transferir archivos y disparar validación en el input principal
                const mainInput = document.getElementById("inputFolder");
                if (mainInput) {
                    mainInput.files = files;
                    mainInput.dispatchEvent(new Event("change"));
                }
            }
        });
    }

    // ================= FUNCIONALIDAD DE FILTRADO DINÁMICO =================
    const buscarInput = document.getElementById("prevalBuscarInput");
    const filtroEstadoBtns = document.querySelectorAll("#prevalFiltroEstadoGroup .btn-segmented");
    const tbody = document.getElementById("prevalTableBody");

    let estadoActivo = "";

    const aplicarFiltrosModal = () => {
        if (!tbody) return;
        const q = (buscarInput?.value || "").toLowerCase().trim();
        const filas = tbody.querySelectorAll("tr.preval-row");

        filas.forEach((tr) => {
            const doc = tr.getAttribute("data-doc") || "";
            const nombre = tr.getAttribute("data-nombre") || "";
            const estado = tr.getAttribute("data-estado") || "";

            const matchTexto = !q || doc.includes(q) || nombre.includes(q);
            const matchEstado = !estadoActivo || estado === estadoActivo;

            if (matchTexto && matchEstado) {
                tr.style.display = "";
            } else {
                tr.style.display = "none";
            }
        });
    };

    if (buscarInput) {
        buscarInput.addEventListener("input", aplicarFiltrosModal);
    }

    if (filtroEstadoBtns) {
        filtroEstadoBtns.forEach((btn) => {
            btn.addEventListener("click", () => {
                filtroEstadoBtns.forEach((b) => b.classList.remove("active"));
                btn.classList.add("active");
                estadoActivo = btn.getAttribute("data-filter-estado") || "";
                aplicarFiltrosModal();
            });
        });
    }

    // Event delegation para los 3 botones de copiar en cada fila
    if (tbody) {
        tbody.addEventListener("click", (e) => {
            const btnDoc = e.target.closest(".btn-copy-doc");
            const btnPkgDoc = e.target.closest(".btn-copy-pkg-doc");
            const btnErr = e.target.closest(".btn-copy-err");

            if (!btnDoc && !btnPkgDoc && !btnErr) return;
            e.stopPropagation();

            const tr = e.target.closest("tr.preval-row");
            if (!tr) return;

            const doc = tr.getAttribute("data-doc") || "";
            const pkg = tr.getAttribute("data-pkg") || "";
            const paciente = pacientesList.find((p) => p.documento === doc);

            if (btnDoc) {
                copiarTextoSimple(e, doc);
            } else if (btnPkgDoc) {
                copiarTextoSimple(e, `${pkg} - ${doc} - `);
            } else if (btnErr) {
                const textoErroresRaw = paciente
                    ? (paciente.errores || []).join(" | ") || (paciente.alertas || []).join(" | ") || "Conforme"
                    : "Conforme";
                const nombreStr = paciente?.nombre
                    ? paciente.nombre.toLowerCase().replace(/(?:^|\s|\/|-)\S/g, (match) => match.toUpperCase())
                    : "";
                copiarErrorMatriz(e, pkg, doc, textoErroresRaw, nombreStr);
            }
        });
    }
}

/**
 * Modal emergente al terminar la validación que avisa si se encontraron errores
 */
export function mostrarModalAlertaFinalValidacion(totalCarpetas, totalConErrores, totalConAlertas, contexto = "auditoria") {
    const prev = document.getElementById("modalAlertaFinalValidacionActivo");
    if (prev) prev.remove();

    const esMatriz = contexto === "matriz";
    const hayProblemas = totalConErrores > 0;
    const soloAlertas = !hayProblemas && totalConAlertas > 0;
    const conformes = Math.max(0, totalCarpetas - totalConErrores - totalConAlertas);

    const backdrop = document.createElement("div");
    backdrop.id = "modalAlertaFinalValidacionActivo";
    backdrop.className = "modal-rules-backdrop";
    backdrop.style.zIndex = "2100";

    const iconoSVG = hayProblemas
        ? `<div class="modal-aviso-firmas-icon" style="background: rgba(239, 68, 68, 0.15); color: #ef4444; width: 44px; height: 44px; border-radius: 50%; display: flex; align-items: center; justify-content: center; font-size: 22px;">⚠️</div>`
        : soloAlertas
            ? `<div class="modal-aviso-firmas-icon" style="background: rgba(245, 158, 11, 0.15); color: #f59e0b; width: 44px; height: 44px; border-radius: 50%; display: flex; align-items: center; justify-content: center; font-size: 22px;">🔔</div>`
            : `<div class="modal-aviso-firmas-icon" style="background: rgba(16, 185, 129, 0.15); color: #10b981; width: 44px; height: 44px; border-radius: 50%; display: flex; align-items: center; justify-content: center; font-size: 22px;">✅</div>`;

    const tituloModal = esMatriz
        ? (hayProblemas
            ? "Pre-validación: Matriz con Novedades"
            : (soloAlertas ? "Pre-validación: Matriz con Alertas" : "Pre-validación: Matriz Conforme"))
        : (hayProblemas
            ? "Validación Finalizada con Novedades"
            : (soloAlertas ? "Validación Finalizada con Alertas" : "Validación Finalizada con Éxito"));

    const subtituloModal = esMatriz
        ? "Diagnóstico de programación de matriz"
        : "Resumen general de auditoría";

    const mensajePrincipal = esMatriz
        ? (hayProblemas
            ? `Se han detectado <strong style="color:#ef4444;">${totalConErrores} paciente(s) con inconsistencias</strong> en las reglas de paquetes programados en la matriz.`
            : (soloAlertas
                ? `Se han detectado <strong style="color:#f59e0b;">${totalConAlertas} paciente(s) con alertas</strong> en la matriz.`
                : `Los <strong>${totalCarpetas} paciente(s)</strong> de la matriz cumplen las reglas de paquete.`))
        : (hayProblemas
            ? `Se han detectado <strong style="color:#ef4444;">${totalConErrores} paciente(s) con novedades o inconsistencias</strong> durante la validación de los soportes.`
            : (soloAlertas
                ? `Se han detectado <strong style="color:#f59e0b;">${totalConAlertas} paciente(s) con alertas</strong> durante la auditoría.`
                : `Todos los <strong>${totalCarpetas} paciente(s)</strong> han superado la validación sin errores.`));

    backdrop.innerHTML = `
        <div class="modal-rules-card" style="max-width: 480px; padding: 0; overflow: hidden; box-shadow: var(--shadow-modal);" onclick="event.stopPropagation()">
            <div style="padding: 16px 20px; display: flex; align-items: center; gap: 14px; background: var(--bg-subtle); border-bottom: 1px solid var(--border-subtle);">
                ${iconoSVG}
                <div>
                    <h3 style="margin: 0; font-size: 15px; font-weight: 700; color: var(--text-pure);">${tituloModal}</h3>
                    <p style="margin: 2px 0 0 0; font-size: 11.5px; color: var(--text-muted);">${subtituloModal}</p>
                </div>
            </div>
            <div style="padding: 18px 20px; display: flex; flex-direction: column; gap: 14px;">
                <p style="margin: 0; font-size: 12.5px; line-height: 1.45; color: var(--text-primary);">${mensajePrincipal}</p>
                
                <div class="stats-cluster" style="display: flex; gap: 8px; justify-content: stretch; width: 100%;">
                    <div class="stat-pill" style="flex: 1; text-align: center; justify-content: center;">
                        <span class="stat-pill-label">Total</span>
                        <span class="stat-pill-value">${totalCarpetas}</span>
                    </div>
                    <div class="stat-pill success" style="flex: 1; text-align: center; justify-content: center;">
                        <span class="stat-pill-label">Conformes</span>
                        <span class="stat-pill-value">${conformes}</span>
                    </div>
                    <div class="stat-pill ${totalConErrores > 0 ? 'error' : ''}" style="flex: 1; text-align: center; justify-content: center;">
                        <span class="stat-pill-label">Novedades</span>
                        <span class="stat-pill-value">${totalConErrores}</span>
                    </div>
                </div>
            </div>
            <div style="padding: 12px 20px; background: var(--bg-subtle); border-top: 1px solid var(--border-subtle); display: flex; justify-content: flex-end; gap: 8px;">
                <button type="button" class="btn-studio btn-studio-primary" style="padding: 7px 18px; font-size: 12px; font-weight: 600;" onclick="document.getElementById('modalAlertaFinalValidacionActivo')?.remove()">
                    Entendido
                </button>
            </div>
        </div>
    `;

    document.body.appendChild(backdrop);
    backdrop.addEventListener("click", () => backdrop.remove());
}


