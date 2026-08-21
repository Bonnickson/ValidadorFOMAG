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
