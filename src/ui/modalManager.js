import {
    FEATURE_RIESGO_JURIDICO_ACTIVO,
    PAQUETES_INFO,
    PAQUETES_SOPORTADOS,
    REGLAS_TERAPIAS_PAQUETES,
    obtenerInfoSoporte,
    normalizarCodigoPaquete,
    CODIGOS_APLICACION,
} from "../config/constants.js";
import {
    copiarTextoSimple,
    copiarErrorMatriz,
    copiarTextoAlPortapapeles,
    mostrarToastCopia,
} from "../utils/clipboardUtils.js";
import { formatearErrorConIconosPDF } from "../utils/textUtils.js";
import { buscarPacienteEnMatriz } from "../services/matrixService.js";

/**
 * Muestra el resumen de condiciones del paquete seleccionado en el panel lateral
 */
export function mostrarCondicionesPaquete(tipoPaqueteSelect, paqueteCondicionesContent) {
    if (!paqueteCondicionesContent || !tipoPaqueteSelect) return;

    const paquete = tipoPaqueteSelect.value;
    const paqueteCanonico = normalizarCodigoPaquete(paquete);
    const esPaqueteAplicacion = CODIGOS_APLICACION.has(paquete) || ["CPF1102", "CPF1103", "CPF1104"].includes(paqueteCanonico);
    const regla = REGLAS_TERAPIAS_PAQUETES[paquete] || { descripcion: "Requisitos según paquete." };
    const tieneRangoTer = regla.min !== undefined && regla.max !== undefined;
    const minTer = tieneRangoTer ? regla.min : 0;
    const maxTer = tieneRangoTer ? regla.max : "Según matriz";
    const badgeTer = tieneRangoTer
        ? `<span class="wiki-badge-ter">Obligatorio (${minTer} a ${maxTer})</span>`
        : `<span class="wiki-badge-neutral">Opcional / Según matriz</span>`;

    let filasServiciosHTML = "";
    if (esPaqueteAplicacion) {
        filasServiciosHTML = `
            <tr>
                <td><code>VM</code> (Médica)</td>
                <td><span class="wiki-badge-req">Obligatorio</span></td>
                <td class="wiki-nowrap" style="text-align:center;">1</td>
                <td class="wiki-nowrap" style="text-align:center;">1</td>
            </tr>
            <tr>
                <td><code>ENF</code> (Enfermería)</td>
                <td><span class="wiki-badge-req">Obligatorio</span></td>
                <td class="wiki-nowrap" style="text-align:center;">1</td>
                <td class="wiki-nowrap" style="text-align:center;">1</td>
            </tr>
            <tr>
                <td><code>APL</code> (Aplicación Med.)</td>
                <td><span class="wiki-badge-req">Obligatorio (Dosis)</span></td>
                <td class="wiki-nowrap" style="text-align:center;">1</td>
                <td class="wiki-nowrap" style="text-align:center;">Según dosis</td>
            </tr>
        `;
    } else {
        filasServiciosHTML = `
            <tr>
                <td><code>VM</code> (Médica)</td>
                <td><span class="wiki-badge-req">Obligatorio</span></td>
                <td class="wiki-nowrap" style="text-align:center;">1</td>
                <td class="wiki-nowrap" style="text-align:center;">1</td>
            </tr>
            <tr>
                <td><code>VENF</code> / <code>ENF</code></td>
                <td><span class="wiki-badge-enf">Al menos 1</span></td>
                <td class="wiki-nowrap" style="text-align:center;">1</td>
                <td class="wiki-nowrap" style="text-align:center;">1 c/u</td>
            </tr>
            <tr>
                <td><code>PSI</code> / <code>NUT</code> / <code>TS</code></td>
                <td><span class="wiki-badge-opt">Elegir solo 1</span></td>
                <td class="wiki-nowrap" style="text-align:center;">1</td>
                <td class="wiki-nowrap" style="text-align:center;">1</td>
            </tr>
            <tr>
                <td><code>TF+TR+TRS+FON+TO</code></td>
                <td>${badgeTer}</td>
                <td class="wiki-nowrap" style="text-align:center;">${minTer}</td>
                <td class="wiki-nowrap" style="text-align:center;">${maxTer}</td>
            </tr>
        `;
    }

    const html = `
        <div class="paquete-rules-card">
            <div class="rule-group">
                <span class="rule-label">Archivo base:</span>
                <span class="rule-value">Código en <code>2 PAQ.pdf</code></span>
            </div>
            <div class="wiki-table" style="margin: 6px 0 2px 0;">
                <table>
                    <thead>
                        <tr>
                            <th>Servicio</th>
                            <th>Condición</th>
                            <th style="text-align:center;">Mín.</th>
                            <th style="text-align:center;">Máx.</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${filasServiciosHTML}
                    </tbody>
                </table>
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
    const estaParametrizado = Boolean(PAQUETES_INFO[pkg]);
    const infoPaquete = estaParametrizado
        ? PAQUETES_INFO[pkg]
        : { nombre: `${pkg} - No parametrizado`, descripcion: "No parametrizado" };
    const regla = REGLAS_TERAPIAS_PAQUETES[pkg] || { descripcion: "Sin reglas específicas parametrizadas." };
    const tieneRangoTer = regla.permiteTerapias && regla.min !== undefined && regla.max !== undefined && regla.min > 0;
    const minTer = regla.permiteTerapias === false ? 0 : (regla.min || 0);
    const maxTer = regla.permiteTerapias === false ? 0 : (regla.max !== undefined && regla.max < 999 ? regla.max : (regla.permiteTerapias ? "Opcional" : 0));
    
    let badgeTer = `<span class="wiki-badge-neutral">Opcional / Según matriz</span>`;
    if (regla.permiteTerapias === false) {
        badgeTer = `<span class="wiki-badge-danger" style="background:#fee2e2;color:#991b1b;padding:2px 8px;border-radius:12px;font-size:11px;font-weight:600;">No Aplica (0 terapias)</span>`;
    } else if (tieneRangoTer) {
        badgeTer = `<span class="wiki-badge-ter">Obligatorio (${regla.min} a ${regla.max})</span>`;
    } else if (regla.terapiasPermitidas) {
        badgeTer = `<span class="wiki-badge-opt">Opcional (${regla.terapiasPermitidas.join(", ")})</span>`;
    }

    const prev = document.getElementById("modalReglasPaqueteActivo");
    if (prev) prev.remove();

    const backdrop = document.createElement("div");
    backdrop.id = "modalReglasPaqueteActivo";
    backdrop.className = "modal-rules-backdrop";

    const estadoParametrizacionHTML = !estaParametrizado
        ? `<div class="alerta-item" style="margin-bottom: 12px; background: rgba(239, 68, 68, 0.1); border: 1px solid rgba(239, 68, 68, 0.3); border-radius: 6px; padding: 8px 12px; color: #ef4444; font-size: 12px;">
            ⚠️ Este código de paquete no se encuentra parametrizado en el sistema.
           </div>`
        : "";

    const esPaqueteAplicacion = ["CPF1102", "CPF1103", "CPF1104"].includes(pkg);
    const dosisTexto = pkg === "CPF1102" ? "1 Dosis diaria" : (pkg === "CPF1103" ? "2 o 3 Dosis diarias" : "4 Dosis diarias");

    const tablaModalHTML = esPaqueteAplicacion ? `
        <table>
            <thead>
                <tr>
                    <th>Grupo</th>
                    <th>Servicios</th>
                    <th>Condición</th>
                    <th style="text-align:center;">Mín.</th>
                    <th style="text-align:center;">Máx.</th>
                    <th>Detalle</th>
                </tr>
            </thead>
            <tbody>
                <tr>
                    <td>1. Médica</td>
                    <td class="wiki-nowrap"><code>VM</code></td>
                    <td><span class="wiki-badge-req">Obligatorio fijo</span></td>
                    <td class="wiki-nowrap" style="text-align:center;">1</td>
                    <td class="wiki-nowrap" style="text-align:center;">1</td>
                    <td>Exactamente 1 valoración médica.</td>
                </tr>
                <tr>
                    <td>2. Enfermería</td>
                    <td class="wiki-nowrap"><code>ENF</code></td>
                    <td><span class="wiki-badge-req">Obligatorio fijo</span></td>
                    <td class="wiki-nowrap" style="text-align:center;">1</td>
                    <td class="wiki-nowrap" style="text-align:center;">1</td>
                    <td>Exactamente 1 valoración de enfermería (ENF).</td>
                </tr>
                <tr>
                    <td>3. Aplicación</td>
                    <td class="wiki-nowrap"><code>APL</code></td>
                    <td><span class="wiki-badge-req">Obligatorio (${dosisTexto})</span></td>
                    <td class="wiki-nowrap" style="text-align:center;">1</td>
                    <td class="wiki-nowrap" style="text-align:center;">Según dosis</td>
                    <td>Programado en columna '${dosisTexto.replace(" diaria", "").replace(" diarias", "")}' de la matriz, igual a 'Cant Paquete Diario' y verificado en 5 apl.pdf.</td>
                </tr>
            </tbody>
        </table>
    ` : `
        <table>
            <thead>
                <tr>
                    <th>Grupo</th>
                    <th>Servicios</th>
                    <th>Condición</th>
                    <th style="text-align:center;">Mín.</th>
                    <th style="text-align:center;">Máx.</th>
                    <th>Detalle</th>
                </tr>
            </thead>
            <tbody>
                <tr>
                    <td>1. Médica</td>
                    <td class="wiki-nowrap"><code>VM</code></td>
                    <td><span class="wiki-badge-req">Obligatorio fijo</span></td>
                    <td class="wiki-nowrap" style="text-align:center;">${(pkg === "CPF1107" || pkg === "CPF1225") ? 2 : 1}</td>
                    <td class="wiki-nowrap" style="text-align:center;">${(pkg === "CPF1107" || pkg === "CPF1225") ? 2 : 1}</td>
                    <td>Exactamente ${(pkg === "CPF1107" || pkg === "CPF1225") ? "2 valoraciones médicas" : "1 valoración médica"}.</td>
                </tr>
                <tr>
                    <td>2. Enfermería</td>
                    <td class="wiki-nowrap">${pkg === "CPF1107" ? "<code>ENF</code>" : "<code>VENF</code>, <code>ENF</code>"}</td>
                    <td><span class="wiki-badge-enf">${pkg === "CPF1107" ? "Obligatorio fijo" : "Obligatorio (mín. 1)"}</span></td>
                    <td class="wiki-nowrap" style="text-align:center;">${pkg === "CPF1107" ? 4 : 1}</td>
                    <td class="wiki-nowrap" style="text-align:center;">${pkg === "CPF1107" ? 4 : "1 c/u"}</td>
                    <td>${pkg === "CPF1107" ? "Exactamente 4 valoraciones de auxiliar de enfermería (ENF)." : "Válido <code>1 VENF</code>, <code>1 ENF</code> o ambos (<code>1 + 1</code>)."}</td>
                </tr>
                <tr>
                    <td>3. Complementario</td>
                    <td class="wiki-nowrap"><code>PSI</code>, <code>NUT</code>, <code>TS</code></td>
                    <td><span class="wiki-badge-opt">A elección (solo 1)</span></td>
                    <td class="wiki-nowrap" style="text-align:center;">1</td>
                    <td class="wiki-nowrap" style="text-align:center;">1</td>
                    <td>Elegir solo 1 de los tres (los otros dos en 0).</td>
                </tr>
                <tr>
                    <td>4. Terapias</td>
                    <td class="wiki-nowrap"><code>TF</code>, <code>TR</code>, <code>TRS</code>, <code>FON</code>, <code>TO</code></td>
                    <td>${badgeTer}</td>
                    <td class="wiki-nowrap" style="text-align:center;">${minTer}</td>
                    <td class="wiki-nowrap" style="text-align:center;">${maxTer}</td>
                    <td>${regla.descripcion} (suma total de terapias).</td>
                </tr>
            </tbody>
        </table>
    `;

    backdrop.innerHTML = `
        <div class="modal-rules-card" style="max-width: 680px;" onclick="event.stopPropagation()">
            <div class="modal-rules-header">
                <div class="modal-rules-title">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="width:16px;height:16px;"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path><polyline points="14 2 14 8 20 8"></polyline><line x1="16" y1="13" x2="8" y2="13"></line><line x1="16" y1="17" x2="8" y2="17"></line></svg>
                    <div>
                        <div style="font-size:13.5px; font-weight:600;">${pkg} — ${infoPaquete.descripcion || infoPaquete.nombre}</div>
                        <div style="font-size:11px; font-weight:400; color:var(--text-muted);">${estaParametrizado ? infoPaquete.nombre : "No parametrizado"}</div>
                    </div>
                </div>
                <button type="button" class="modal-rules-close" onclick="document.getElementById('modalReglasPaqueteActivo')?.remove()">&times;</button>
            </div>
            <div class="modal-rules-body">
                ${estadoParametrizacionHTML}
                <div class="paquete-rules-card">
                    <div class="rule-group" style="margin-bottom: 8px;">
                        <span class="rule-label">Soporte base del paquete:</span>
                        <span class="rule-value">El código <code>${pkg}</code> debe estar incluido en <code>2 PAQ.pdf</code></span>
                    </div>
                    <div class="wiki-table" style="margin: 4px 0 8px 0;">
                        ${tablaModalHTML}
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
 * Helper para hacer un popover flotante arrastrable y redimensionable
 */
function hacerDraggableYResizable(popover, header) {
    if (!popover || !header) return;

    header.style.cursor = "move";
    header.style.userSelect = "none";

    let isDragging = false;
    let startX = 0;
    let startY = 0;
    let initialLeft = 0;
    let initialTop = 0;

    const onMouseDown = (e) => {
        if (e.button !== 0 || e.target.closest("button") || e.target.closest("a") || e.target.closest("input")) {
            return;
        }

        isDragging = true;
        startX = e.clientX;
        startY = e.clientY;

        const parent = popover.offsetParent || document.body;
        const parentRect = parent.getBoundingClientRect();
        const rect = popover.getBoundingClientRect();

        initialLeft = rect.left - parentRect.left + (parent.scrollLeft || 0);
        initialTop = rect.top - parentRect.top + (parent.scrollTop || 0);

        popover.style.left = `${initialLeft}px`;
        popover.style.top = `${initialTop}px`;
        popover.style.right = "auto";
        popover.style.bottom = "auto";

        const onMouseMove = (moveEvent) => {
            if (!isDragging) return;
            const dx = moveEvent.clientX - startX;
            const dy = moveEvent.clientY - startY;

            let newLeft = initialLeft + dx;
            let newTop = initialTop + dy;

            newLeft = Math.max(5, newLeft);
            newTop = Math.max(5, newTop);

            popover.style.left = `${newLeft}px`;
            popover.style.top = `${newTop}px`;
        };

        const onMouseUp = () => {
            if (isDragging) {
                isDragging = false;
                document.removeEventListener("mousemove", onMouseMove);
                document.removeEventListener("mouseup", onMouseUp);
            }
        };

        document.addEventListener("mousemove", onMouseMove);
        document.addEventListener("mouseup", onMouseUp);
        e.preventDefault();
    };

    header.addEventListener("mousedown", onMouseDown);
}

/**
 * Popover para ver archivos de la carpeta (Arrastrable, Redimensionable y Anclado al Scroll)
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
    popover.className = "archivos-floating-popover floating-popover-movable";
    popover._trigger = triggerBtn;

    const renderPdfIcon = (num, srv) => {
        // Icono SVG profesional de PDF con color según tipo (2: azul/doc, 4: ambar/firma, 5: esmeralda/evolución)
        let strokeColor = "#6366f1";
        let fillBg = "rgba(99, 102, 241, 0.08)";
        let badgeColor = "#4f46e5";
        let numLabel = num || "";

        if (num === "2") {
            strokeColor = "#0284c7";
            fillBg = "rgba(2, 132, 199, 0.09)";
            badgeColor = "#0369a1";
        } else if (num === "4") {
            strokeColor = "#d97706";
            fillBg = "rgba(217, 119, 6, 0.09)";
            badgeColor = "#b45309";
        } else if (num === "5") {
            strokeColor = "#059669";
            fillBg = "rgba(5, 150, 105, 0.09)";
            badgeColor = "#047857";
        }

        return `
            <div class="soporte-file-svg-tag" style="background:${fillBg}; border-color:${strokeColor}33; color:${strokeColor};">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" class="soporte-file-svg"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path><polyline points="14 2 14 8 20 8"></polyline></svg>
                ${numLabel ? `<span class="soporte-num-badge" style="color:${badgeColor}">${numLabel}</span>` : ""}
            </div>
        `;
    };

    const filesListHTML = r.listaArchivos
        .map((archivo) => {
            const info = obtenerInfoSoporte(archivo);
            const urlKey = Object.keys(r.fileUrls || {}).find(
                (k) => k.toLowerCase() === archivo.toLowerCase()
            );
            const url = urlKey ? r.fileUrls[urlKey] : null;
            const extraCls = info.reconocido ? "soporte-valido" : "soporte-no-reconocido";
            
            const numMatch = archivo.match(/^([2-5])/);
            const num = numMatch ? numMatch[1] : "";
            const iconHTML = info.reconocido
                ? renderPdfIcon(num, archivo)
                : `<div class="soporte-file-svg-tag soporte-err-tag"><svg viewBox="0 0 24 24" fill="none" stroke="#ef4444" stroke-width="2" class="soporte-file-svg"><circle cx="12" cy="12" r="10"></circle><line x1="15" y1="9" x2="9" y2="15"></line><line x1="9" y1="9" x2="15" y2="15"></line></svg></div>`;

            const badgeTexto = info.reconocido
                ? `<span class="badge-soporte-tipo">${info.tipo.replace(/\s*\([^\)]*\)/g, "")}</span>`
                : `<span class="badge-no-reconocido" title="Soporte no reconocido">No reconocido</span>`;

            if (url) {
                return `<a href="#" onclick="abrirPDFModal('${url}', '${archivo}', this); return false;" class="popover-file-link ${extraCls}" title="${info.tipo}: ${archivo}">
                    ${iconHTML}
                    <div class="popover-file-text-col">
                        <span class="popover-file-name">${archivo}</span>
                    </div>
                    ${badgeTexto}
                </a>`;
            }
            return `<div class="popover-file-item ${extraCls}" title="${info.tipo}: ${archivo}">
                ${iconHTML}
                <div class="popover-file-text-col">
                    <span class="popover-file-name">${archivo}</span>
                </div>
                ${badgeTexto}
            </div>`;
        })
        .join("");

    popover.innerHTML = `
        <div class="popover-header">
            <span class="popover-header-title">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="width:13px;height:13px;display:inline-block;vertical-align:middle;"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path><polyline points="14 2 14 8 20 8"></polyline></svg>
                <span>Soportes</span>
                <span class="popover-count-pill">${r.listaArchivos.length}</span>
            </span>
            <button type="button" class="popover-close-btn" onclick="document.getElementById('archivosPopoverActivo')?.remove()" title="Cerrar">&times;</button>
        </div>
        <div class="popover-body">${filesListHTML}</div>
    `;

    const container = document.querySelector(".table-wrapper") || document.querySelector(".workspace-body") || document.body;
    container.appendChild(popover);

    if (triggerBtn) {
        const parent = popover.offsetParent || container;
        const parentRect = parent.getBoundingClientRect();
        const btnRect = triggerBtn.getBoundingClientRect();

        const left = btnRect.left - parentRect.left + (parent.scrollLeft || 0);
        const top = btnRect.bottom - parentRect.top + (parent.scrollTop || 0) + 1;
        const maxLeft = Math.max(5, parent.clientWidth - (popover.offsetWidth || 270) - 10);

        popover.style.left = `${Math.max(5, Math.min(maxLeft, left))}px`;
        popover.style.top = `${Math.max(0, top)}px`;
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
 * Popover para ver la programación de la matriz del paciente (Arrastrable y Redimensionable)
 */
export function verProgramadoCarpeta(
    carpeta,
    triggerEl,
    todosLosResultados,
    datosMatrizGlobal,
    seleccionarCarpetaCallback
) {
    if (typeof seleccionarCarpetaCallback === "function") {
        seleccionarCarpetaCallback(carpeta);
    }
    const triggerBtn = triggerEl ? (triggerEl.closest("button") || triggerEl) : null;
    
    // Búsqueda inteligente y robusta del resultado del paciente
    let r = todosLosResultados ? todosLosResultados[carpeta] : null;
    if (!r && todosLosResultados) {
        const cNorm = String(carpeta).replace(/\\/g, "/").trim();
        for (const [k, v] of Object.entries(todosLosResultados)) {
            if (k.replace(/\\/g, "/").trim() === cNorm) {
                r = v;
                break;
            }
        }
    }
    if (!r && todosLosResultados) {
        const docClean = String(carpeta).replace(/\D/g, "");
        for (const [k, v] of Object.entries(todosLosResultados)) {
            const kDoc = (v.nroDocumento || k).replace(/\D/g, "");
            const kLast = k.replace(/\\/g, "/").split("/").pop().trim();
            if ((docClean && kDoc === docClean) || kLast === carpeta || k.includes(carpeta) || carpeta.includes(k)) {
                r = v;
                break;
            }
        }
    }

    const prev = document.getElementById("programadoPopoverActivo");
    if (prev) {
        prev.remove();
        if (prev._trigger === triggerBtn) return;
    }

    const calcularSoportesServicio = (servicioCod) => {
        if (!r?.fechasPorServicio) return 0;
        const cod = servicioCod.toUpperCase().trim();

        // 1. Clave canónica directa
        if (r.fechasPorServicio[cod] && Array.isArray(r.fechasPorServicio[cod])) {
            return [...new Set(r.fechasPorServicio[cod])].length;
        }

        // 2. Succión / TRS
        if (cod === "TRS" && r.fechasPorServicio["SUCCION"] && Array.isArray(r.fechasPorServicio["SUCCION"])) {
            return [...new Set(r.fechasPorServicio["SUCCION"])].length;
        }
        if (cod === "SUCCION" && r.fechasPorServicio["TRS"] && Array.isArray(r.fechasPorServicio["TRS"])) {
            return [...new Set(r.fechasPorServicio["TRS"])].length;
        }

        // 3. Comparación estricta de nombres completos exactos (sin includes parcial)
        const exactKeysMap = {
            "VM": ["VM", "MEDICA", "VISITA MEDICA", "VALORACION MEDICA", "VALORACIÓN MÉDICA"],
            "VMRJ": ["VMRJ", "VISITA MEDICA RIESGO JURIDICO", "RIESGO JURIDICO", "VALORACION MEDICA RIESGO JURIDICO"],
            "VENF": ["VENF", "ENFERMERIA PROFESIONAL", "ENF PROF", "ENFERMERA PROFESIONAL", "ENFERMERÍA PROFESIONAL"],
            "ENF": ["ENF", "AUXILIAR ENFERMERIA", "AUXILIAR DE ENFERMERIA", "AUXILIAR DE ENFERMERÍA", "ENFERMERIA", "AUX ENF"],
            "TF": ["TF", "TERAPIA FISICA", "FISICA", "TERAPIA FÍSICA", "FÍSICA"],
            "TR": ["TR", "TERAPIA RESPIRATORIA", "RESPIRATORIA"],
            "TRS": ["TRS", "SUCCION", "SUC", "SUCCIÓN", "TERAPIA RESPIRATORIA SUCCION", "TERAPIA RESPIRATORIA SUCCIÓN"],
            "FON": ["FON", "FONOAUDIOLOGIA", "FONO", "FONOAUDIOLOGÍA"],
            "TO": ["TO", "TERAPIA OCUPACIONAL", "OCUPACIONAL"],
            "NUT": ["NUT", "NUTRICION", "NUTRICIÓN"],
            "TS": ["TS", "TRABAJO SOCIAL"],
            "PSI": ["PSI", "PSICOLOGIA", "PSICOLOGÍA"],
            "ESP": ["ESP", "MEDICINA ESPECIAL", "ESPECIAL", "MEDICO ESPECIALISTA"],
            "MED1": ["MED1", "APL1", "1 DOSIS", "1DOSIS"],
            "MED2": ["MED2", "APL2", "2 DOSIS", "2DOSIS"],
            "MED3": ["MED3", "APL3", "3 DOSIS", "3DOSIS"],
            "MED4": ["MED4", "APL4", "4 DOSIS", "4DOSIS"],
            "ENF6": ["ENF6", "ENFERMERIA 6H", "TURNO 6H"],
            "ENF8": ["ENF8", "ENFERMERIA 8H", "TURNO 8H"],
            "ENF12": ["ENF12", "ENFERMERIA 12H", "TURNO 12H"],
            "ENF12N": ["ENF12N", "ENFERMERIA 12HN", "TURNO 12HN"],
            "ENF24": ["ENF24", "ENFERMERIA 24H", "TURNO 24H"],
            "CUID6": ["CUID6", "CUIDADOR 6H"],
            "CUID8": ["CUID8", "CUIDADOR 8H"],
            "CUID12": ["CUID12", "CUIDADOR 12H"],
            "CUID12N": ["CUID12N", "CUIDADOR 12HN"],
            "CUID24": ["CUID24", "CUIDADOR 24H"]
        };

        const validNames = exactKeysMap[cod] || [cod];
        for (const [k, fechas] of Object.entries(r.fechasPorServicio)) {
            if (k === "General") continue;
            const kNorm = k.toUpperCase().trim();
            if (validNames.includes(kNorm)) {
                if (Array.isArray(fechas) && fechas.length > 0) {
                    return [...new Set(fechas)].length;
                }
            }
        }
        return 0;
    };

    const buscarSoporte = (servicioCod, num) => {
        if (!r?.fileUrls) return null;
        const cod = servicioCod.toUpperCase().trim();
        const aliasCod = (cod === "TRS") ? ["TRS", "SUCCION", "SUC"] : [cod];

        for (const [nombre, url] of Object.entries(r.fileUrls)) {
            const nomUpper = nombre.toUpperCase().trim();
            for (const al of aliasCod) {
                const regex = new RegExp(`^${num}[\\s_-]+${al}(\\.[a-z0-9]+|\\s|$)`, "i");
                if (regex.test(nomUpper) || nomUpper === `${num} ${al}.PDF`.toUpperCase()) {
                    return { nombre, url };
                }
            }
        }
        return null;
    };

    // Buscar datos de la matriz del paciente
    let mat = r?.datosMatriz;
    if (!mat && datosMatrizGlobal) {
        mat = buscarPacienteEnMatriz(datosMatrizGlobal, r?.nroDocumento || carpeta, r?.tipoPaquete);
    }

    const popover = document.createElement("div");
    popover.id = "programadoPopoverActivo";
    popover.className = "programado-floating-popover floating-popover-movable";
    popover._trigger = triggerBtn;

    let contentHTML = "";
    if (!mat) {
        contentHTML = `
            <div class="popover-empty-state">
                <div style="font-size:18px; margin-bottom:2px;">⚠️</div>
                <div style="font-weight:700; color:var(--text-pure); font-size:11px;">Sin datos en Matriz</div>
                <div style="font-size:10px; color:var(--text-muted); margin-top:2px;">No figura en la matriz Excel.</div>
            </div>
        `;
    } else {
        const s = mat.servicios || {};
        const pkgCarpeta = r?.tipoPaquete || "—";
        const pkgMatriz = mat.paquete || mat.paqueteRaw || "—";
        const paqueteMismatch = pkgCarpeta !== "—" && pkgMatriz !== "—" && pkgCarpeta !== "auto" && pkgCarpeta !== "EVENTO" && pkgCarpeta.toUpperCase() !== pkgMatriz.toUpperCase();
        const pkgCode = (pkgCarpeta === "EVENTO" ? "EVENTO" : (mat.paquete || mat.paqueteRaw || r?.tipoPaquete || "—"));
        const pkgCls = pkgCode !== "—" ? `pkg-${pkgCode.toLowerCase()}` : "";

        const renderFilaServicio = (item) => {
            const matCount = item.progCount || 0;
            const sopCount = item.sopCount || 0;
            const activo = matCount > 0 || sopCount > 0;
            const isMatFaltante = (matCount === 0 && sopCount > 0);
            const isSopFaltante = (sopCount === 0 && matCount > 0);
            const match = matCount === sopCount && matCount > 0;
            const diff = matCount > 0 && sopCount > 0 && matCount !== sopCount;

            return `
                <div class="prog-row-item ${activo ? 'row-active' : 'row-muted'}">
                    <span class="prog-col-name" title="${item.label}">${item.label}</span>
                    <span class="prog-col-prog ${isMatFaltante ? 'prog-pulse-red' : ''}" title="Matriz: ${matCount}">
                        <span class="prog-txt-label">Matriz:</span> <b>${matCount}</b>
                    </span>
                    <span class="prog-col-sop ${isSopFaltante ? 'prog-pulse-red' : (match ? 'sop-ok' : (diff ? 'sop-warn' : ''))}" title="Soporte: ${sopCount}">
                        <span class="prog-txt-label">Soporte:</span> <b>${sopCount}</b>
                    </span>
                    <span class="prog-col-chip">
                        ${item.sop4 
                            ? `<button type="button" class="btn-pdf-subtle" onclick="abrirPDFModal('${item.sop4.url}', '${item.sop4.nombre}', this); return false;" title="Ver ${item.sop4.nombre} en visor PDF">4</button>` 
                            : `<span class="chip-dash">—</span>`}
                    </span>
                    <span class="prog-col-chip">
                        ${item.sop5 
                            ? `<button type="button" class="btn-pdf-subtle" onclick="abrirPDFModal('${item.sop5.url}', '${item.sop5.nombre}', this); return false;" title="Ver ${item.sop5.nombre} en visor PDF">5</button>` 
                            : `<span class="chip-dash">—</span>`}
                    </span>
                </div>
            `;
        };

        const esPacienteSoloEvento = pkgCarpeta === "EVENTO" || pkgCode === "EVENTO" || (!mat.paqueteRaw && Boolean(mat.esFacturarEvento)) || (Boolean(mat.esFacturarEvento) && !mat.paquete);
        const evs = mat.serviciosEvento || {};

        let grupoFijos = [];
        let grupoTerapias = [];
        let grupoOtros = [];
        let grupoAplicacion = [];

        if (esPacienteSoloEvento) {
            // Servicios que empiezan por Eve. en la Matriz
            grupoFijos = [
                { id: "VM", label: "Eve. Médica General (VM)", progCount: evs.VM || 0 },
                ...(FEATURE_RIESGO_JURIDICO_ACTIVO ? [{ id: "VMRJ", label: "Eve. Médica General Riesgo Jurídico (VMRJ)", progCount: evs.VMRJ || 0 }] : []),
                { id: "VENF", label: "Eve. Enf. Profesional (VENF)", progCount: evs.VENF || 0 },
                { id: "ENF6", label: "Eve. Turno Enf. 6 Horas", progCount: evs.ENF6 || 0 },
                { id: "ENF8", label: "Eve. Turno Enf. 8 Horas", progCount: evs.ENF8 || 0 },
                { id: "ENF12", label: "Eve. Turno Enf. 12 Horas", progCount: evs.ENF12 || 0 },
                { id: "ENF12N", label: "Eve. Turno Enf. 12H Nocturno", progCount: evs.ENF12N || 0 },
                { id: "ENF24", label: "Eve. Turno Enf. 24 Horas", progCount: evs.ENF24 || 0 },
                { id: "CUID6", label: "Eve. Turno Cuidador 6H", progCount: evs.CUID6 || 0 },
                { id: "CUID8", label: "Eve. Turno Cuidador 8H", progCount: evs.CUID8 || 0 },
                { id: "CUID12", label: "Eve. Turno Cuidador 12H", progCount: evs.CUID12 || 0 },
                { id: "CUID12N", label: "Eve. Turno Cuidador 12HN", progCount: evs.CUID12N || 0 },
                { id: "CUID24", label: "Eve. Turno Cuidador 24H", progCount: evs.CUID24 || 0 },
            ].map(f => {
                const cantFechas = calcularSoportesServicio(f.id);
                const sop4 = buscarSoporte(f.id, "4") || buscarSoporte("ENF", "4");
                const sop5 = buscarSoporte(f.id, "5") || buscarSoporte("ENF", "5");
                const sopCount = cantFechas > 0 ? cantFechas : ((sop4 || sop5) ? 1 : 0);
                return { ...f, sopCount, sop4, sop5 };
            });

            grupoTerapias = [
                { id: "TF", label: "Eve. Terapia Física (TF)", progCount: evs.TF || 0 },
                { id: "TR", label: "Eve. Terapia Respiratoria (TR)", progCount: evs.TR || 0 },
                { id: "TRS", label: "Eve. T. Resp. Succión (TRS)", progCount: evs.TRS || 0 },
                { id: "FON", label: "Eve. Fonoaudiología (FON)", progCount: evs.FON || 0 },
                { id: "TO", label: "Eve. Terapia Ocupacional (TO)", progCount: evs.TO || 0 },
            ].map(t => {
                const sopCount = calcularSoportesServicio(t.id);
                const sop4 = buscarSoporte(t.id, "4");
                const sop5 = buscarSoporte(t.id, "5");
                return { ...t, sopCount, sop4, sop5 };
            });

            grupoOtros = [
                { id: "NUT", label: "Eve. Nutrición (NUT)", progCount: evs.NUT || 0 },
                { id: "TS", label: "Eve. Trabajo Social (TS)", progCount: evs.TS || 0 },
                { id: "PSI", label: "Eve. Psicología (PSI)", progCount: evs.PSI || 0 },
                { id: "ESP", label: "Eve. Medicina Especial (ESP)", progCount: evs.ESP || 0 },
            ].map(o => {
                const sopCount = calcularSoportesServicio(o.id);
                const sop4 = buscarSoporte(o.id, "4");
                const sop5 = buscarSoporte(o.id, "5");
                return { ...o, sopCount, sop4, sop5 };
            });

            grupoAplicacion = [
                { id: "MED1", label: "Eve. Aplicación Med. 1 Dosis", progCount: evs.MED1 || 0 },
                { id: "MED2", label: "Eve. Aplicación Med. 2 Dosis", progCount: evs.MED2 || 0 },
                { id: "MED3", label: "Eve. Aplicación Med. 3 Dosis", progCount: evs.MED3 || 0 },
                { id: "MED4", label: "Eve. Aplicación Med. 4 Dosis", progCount: evs.MED4 || 0 },
            ].map(a => {
                const sopCount = calcularSoportesServicio(a.id) || calcularSoportesServicio("APL");
                const sop4 = buscarSoporte(a.id, "4") || buscarSoporte("APL", "4");
                const sop5 = buscarSoporte(a.id, "5") || buscarSoporte("APL", "5");
                return { ...a, sopCount, sop4, sop5 };
            });
        } else {
            // 1. Servicios Fijos Estándar (Paquetes)
            grupoFijos = [
                { id: "VM", label: "Médica (VM)", progCount: s.VM ?? 0 },
                { id: "VENF", label: "Enf. Profesional (VENF)", progCount: s.VENF ?? 0 },
                { id: "ENF", label: "Aux. Enfermería (ENF)", progCount: s.ENF ?? 0 },
            ].map(f => {
                const cantFechas = calcularSoportesServicio(f.id);
                const sop4 = buscarSoporte(f.id, "4");
                const sop5 = buscarSoporte(f.id, "5");
                const sopCount = cantFechas > 0 ? cantFechas : ((sop4 || sop5) ? 1 : 0);
                return { ...f, sopCount, sop4, sop5 };
            });

            // 2. Terapias
            grupoTerapias = [
                { id: "TF", label: "Terapia Física (TF)", progCount: s.TF || 0 },
                { id: "TR", label: "Terapia Respiratoria (TR)", progCount: s.TR || 0 },
                { id: "TRS", label: "T. Resp. Succión (TRS)", progCount: s.TRS || s.SUCCION || 0 },
                { id: "FON", label: "Fonoaudiología (FON)", progCount: s.FON || 0 },
                { id: "TO", label: "Terapia Ocupacional (TO)", progCount: s.TO || 0 },
            ].map(t => {
                const sopCount = calcularSoportesServicio(t.id);
                const sop4 = buscarSoporte(t.id, "4");
                const sop5 = buscarSoporte(t.id, "5");
                return { ...t, sopCount, sop4, sop5 };
            });

            // 3. Otros Servicios
            grupoOtros = [
                { id: "PSI", label: "Psicología (PSI)", progCount: s.PSI || 0 },
                { id: "TS", label: "Trabajo Social (TS)", progCount: s.TS || 0 },
                { id: "NUT", label: "Nutrición (NUT)", progCount: s.NUT || 0 },
            ].map(o => {
                const sopCount = calcularSoportesServicio(o.id);
                const sop4 = buscarSoporte(o.id, "4");
                const sop5 = buscarSoporte(o.id, "5");
                return { ...o, sopCount, sop4, sop5 };
            });

            // 4. Aplicación de Medicamentos (APL)
            grupoAplicacion = [
                { id: "APL", label: "Aplicación Medicamento (APL)", progCount: s.APL || 0 },
            ].map(a => {
                const sopCount = calcularSoportesServicio(a.id);
                const sop4 = buscarSoporte(a.id, "4");
                const sop5 = buscarSoporte(a.id, "5");
                return { ...a, sopCount, sop4, sop5 };
            });
        }

        const totalTerapiasProg = mat.totalTerapias !== undefined 
            ? mat.totalTerapias 
            : ((s.TF || 0) + (s.TR || 0) + (s.TRS || s.SUCCION || 0) + (s.FON || 0) + (s.TO || 0));

        const totalTerapiasSop = ["TF", "TR", "TRS", "FON", "TO"].reduce((acc, tid) => acc + calcularSoportesServicio(tid), 0);

        let avisosHTML = "";
        if (paqueteMismatch) {
            avisosHTML += `
                <div class="prog-err-line warning" style="margin-top:6px;">⚠️ <strong>Discrepancia de Paquete:</strong> Carpeta tiene <b>${pkgCarpeta}</b> y en matriz está <b>${pkgMatriz}</b>.</div>
            `;
        }
        if ((mat.errores && mat.errores.length > 0) || (mat.alertas && mat.alertas.length > 0)) {
            const tieneErr = mat.errores && mat.errores.length > 0;
            const errs = (mat.errores || []).map(e => `<div class="prog-err-line error">❌ ${e}</div>`).join("");
            const alts = (mat.alertas || []).map(a => `<div class="prog-err-line warning">⚠️ ${a}</div>`).join("");
            avisosHTML += `
                <div class="prog-section-title" style="color:${tieneErr ? '#ef4444' : '#d97706'}; margin-top:6px;">${tieneErr ? 'Novedades Matriz' : 'Alertas Matriz'}</div>
                <div class="prog-err-container">${errs}${alts}</div>
            `;
        }

        const pkgNombreDesc = (PAQUETES_INFO[pkgCode] || {}).descripcion || (PAQUETES_INFO[pkgCode] || {}).nombre || "";
        const metaPaqueteHTML = paqueteMismatch
            ? `<div style="display:flex; align-items:center; gap:4px; flex-wrap:wrap;">
                    <span class="doc-package-tag pkg-${pkgCarpeta.toLowerCase()} prog-pkg-badge" title="Paquete en Carpeta de soportes">📁 ${pkgCarpeta}</span>
                    <span class="doc-package-tag pkg-${pkgMatriz.toLowerCase()} prog-pkg-badge" title="Paquete en Matriz Excel">📊 ${pkgMatriz}</span>
               </div>`
            : `<span class="doc-package-tag ${pkgCls} prog-pkg-badge">${pkgCode}</span>`;

        contentHTML = `
            <div class="prog-patient-header">
                <div class="prog-patient-name" title="${mat.nombre || '—'}">${mat.nombre || 'Paciente'}</div>
                <div class="prog-patient-meta">
                    <span class="prog-meta-badge">Doc: <strong>${mat.documento || carpeta}</strong></span>
                    ${mat.filaExcel ? `<span class="prog-meta-badge">Fila: <strong>#${mat.filaExcel}</strong></span>` : ''}
                    ${metaPaqueteHTML}
                </div>
                ${pkgNombreDesc ? `<div style="font-size:10px; font-weight:600; color:var(--text-secondary); line-height:1.3; margin-top:2px;">${pkgNombreDesc}</div>` : ''}
            </div>

            <!-- Servicios Fijos -->
            <div class="prog-category-block">
                <div class="prog-category-header">
                    <span>Servicios Fijos</span>
                </div>
                <div class="prog-category-list">
                    ${grupoFijos.map(renderFilaServicio).join("")}
                </div>
            </div>

            <!-- Terapias -->
            <div class="prog-category-block">
                <div class="prog-category-header">
                    <span>Terapias</span>
                    <span class="prog-total-terapias-badge" title="Total Matriz: ${totalTerapiasProg} | Total Soporte: ${totalTerapiasSop}">Matriz: ${totalTerapiasProg} | Soporte: ${totalTerapiasSop}</span>
                </div>
                <div class="prog-category-list">
                    ${grupoTerapias.map(renderFilaServicio).join("")}
                </div>
            </div>

            <!-- Otros Servicios -->
            <div class="prog-category-block">
                <div class="prog-category-header">
                    <span>Otros Servicios</span>
                </div>
                <div class="prog-category-list">
                    ${grupoOtros.map(renderFilaServicio).join("")}
                </div>
            </div>

            <!-- Aplicación de Medicamentos -->
            <div class="prog-category-block">
                <div class="prog-category-header">
                    <span>Aplicación Medicamentos</span>
                </div>
                <div class="prog-category-list">
                    ${grupoAplicacion.map(renderFilaServicio).join("")}
                </div>
            </div>

            ${avisosHTML}
        `;
    }

    popover.innerHTML = `
        <div class="popover-header">
            <span class="popover-header-title">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="width:12px;height:12px;display:inline-block;vertical-align:middle;margin-right:4px;color:#107c41;"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path><polyline points="14 2 14 8 20 8"></polyline><path d="M8 13h8"></path><path d="M8 17h8"></path><path d="M10 9h4"></path></svg>
                Programado
            </span>
            <div class="popover-header-actions">
                <button type="button" class="popover-expand-btn" onclick="abrirModalProgramadoDetallado('${carpeta}'); return false;" title="Abrir en ventana grande / Pop up">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="width:11px;height:11px;"><path d="M15 3h6v6"></path><path d="M9 21H3v-6"></path><path d="M21 3l-7 7"></path><path d="M3 21l7-7"></path></svg>
                </button>
                <button type="button" class="popover-close-btn" onclick="document.getElementById('programadoPopoverActivo')?.remove()">&times;</button>
            </div>
        </div>
        <div class="popover-body prog-popover-body">${contentHTML}</div>
    `;

    const container = document.querySelector(".table-wrapper") || document.querySelector(".workspace-body") || document.body;
    container.appendChild(popover);

    if (triggerBtn) {
        const parent = popover.offsetParent || container;
        const parentRect = parent.getBoundingClientRect();
        const btnRect = triggerBtn.getBoundingClientRect();

        const left = btnRect.left - parentRect.left + (parent.scrollLeft || 0);
        const top = btnRect.bottom - parentRect.top + (parent.scrollTop || 0) + 1;
        const maxLeft = Math.max(5, parent.clientWidth - (popover.offsetWidth || 250) - 10);

        popover.style.left = `${Math.max(5, Math.min(maxLeft, left))}px`;
        popover.style.top = `${Math.max(0, top)}px`;
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
 * Modal amplio y detallado para ver la programación vs soportes del paciente (Pop Up grande y claro)
 */
export function mostrarModalProgramadoDetallado(
    carpeta,
    todosLosResultados,
    datosMatrizGlobal
) {
    const prev = document.getElementById("modalProgramadoDetalladoActivo");
    if (prev) prev.remove();

    // Búsqueda inteligente del resultado
    let r = todosLosResultados ? todosLosResultados[carpeta] : null;
    if (!r && todosLosResultados) {
        const cNorm = String(carpeta).replace(/\\/g, "/").trim();
        for (const [k, v] of Object.entries(todosLosResultados)) {
            if (k.replace(/\\/g, "/").trim() === cNorm) {
                r = v;
                break;
            }
        }
    }
    if (!r && todosLosResultados) {
        const docClean = String(carpeta).replace(/\D/g, "");
        for (const [k, v] of Object.entries(todosLosResultados)) {
            const kDoc = (v.nroDocumento || k).replace(/\D/g, "");
            const kLast = k.replace(/\\/g, "/").split("/").pop().trim();
            if ((docClean && kDoc === docClean) || kLast === carpeta || k.includes(carpeta) || carpeta.includes(k)) {
                r = v;
                break;
            }
        }
    }

    const calcularSoportesServicio = (servicioCod) => {
        if (!r?.fechasPorServicio) return 0;
        const cod = servicioCod.toUpperCase().trim();

        // 1. Clave canónica directa
        if (r.fechasPorServicio[cod] && Array.isArray(r.fechasPorServicio[cod])) {
            return [...new Set(r.fechasPorServicio[cod])].length;
        }

        // 2. Succión / TRS
        if (cod === "TRS" && r.fechasPorServicio["SUCCION"] && Array.isArray(r.fechasPorServicio["SUCCION"])) {
            return [...new Set(r.fechasPorServicio["SUCCION"])].length;
        }
        if (cod === "SUCCION" && r.fechasPorServicio["TRS"] && Array.isArray(r.fechasPorServicio["TRS"])) {
            return [...new Set(r.fechasPorServicio["TRS"])].length;
        }

        // 3. Comparación estricta de nombres completos exactos (sin includes parcial)
        const exactKeysMap = {
            "VM": ["VM", "MEDICA", "VISITA MEDICA", "VALORACION MEDICA", "VALORACIÓN MÉDICA"],
            "VMRJ": ["VMRJ", "VISITA MEDICA RIESGO JURIDICO", "RIESGO JURIDICO", "VALORACION MEDICA RIESGO JURIDICO"],
            "VENF": ["VENF", "ENFERMERIA PROFESIONAL", "ENF PROF", "ENFERMERA PROFESIONAL", "ENFERMERÍA PROFESIONAL"],
            "ENF": ["ENF", "AUXILIAR ENFERMERIA", "AUXILIAR DE ENFERMERIA", "AUXILIAR DE ENFERMERÍA", "ENFERMERIA", "AUX ENF"],
            "TF": ["TF", "TERAPIA FISICA", "FISICA", "TERAPIA FÍSICA", "FÍSICA"],
            "TR": ["TR", "TERAPIA RESPIRATORIA", "RESPIRATORIA"],
            "TRS": ["TRS", "SUCCION", "SUC", "SUCCIÓN", "TERAPIA RESPIRATORIA SUCCION", "TERAPIA RESPIRATORIA SUCCIÓN"],
            "FON": ["FON", "FONOAUDIOLOGIA", "FONO", "FONOAUDIOLOGÍA"],
            "TO": ["TO", "TERAPIA OCUPACIONAL", "OCUPACIONAL"],
            "NUT": ["NUT", "NUTRICION", "NUTRICIÓN"],
            "TS": ["TS", "TRABAJO SOCIAL"],
            "PSI": ["PSI", "PSICOLOGIA", "PSICOLOGÍA"],
            "ESP": ["ESP", "MEDICINA ESPECIAL", "ESPECIAL", "MEDICO ESPECIALISTA"],
            "MED1": ["MED1", "APL1", "1 DOSIS", "1DOSIS"],
            "MED2": ["MED2", "APL2", "2 DOSIS", "2DOSIS"],
            "MED3": ["MED3", "APL3", "3 DOSIS", "3DOSIS"],
            "MED4": ["MED4", "APL4", "4 DOSIS", "4DOSIS"],
            "ENF6": ["ENF6", "ENFERMERIA 6H", "TURNO 6H"],
            "ENF8": ["ENF8", "ENFERMERIA 8H", "TURNO 8H"],
            "ENF12": ["ENF12", "ENFERMERIA 12H", "TURNO 12H"],
            "ENF12N": ["ENF12N", "ENFERMERIA 12HN", "TURNO 12HN"],
            "ENF24": ["ENF24", "ENFERMERIA 24H", "TURNO 24H"],
            "CUID6": ["CUID6", "CUIDADOR 6H"],
            "CUID8": ["CUID8", "CUIDADOR 8H"],
            "CUID12": ["CUID12", "CUIDADOR 12H"],
            "CUID12N": ["CUID12N", "CUIDADOR 12HN"],
            "CUID24": ["CUID24", "CUIDADOR 24H"]
        };

        const validNames = exactKeysMap[cod] || [cod];
        for (const [k, fechas] of Object.entries(r.fechasPorServicio)) {
            if (k === "General") continue;
            const kNorm = k.toUpperCase().trim();
            if (validNames.includes(kNorm)) {
                if (Array.isArray(fechas) && fechas.length > 0) {
                    return [...new Set(fechas)].length;
                }
            }
        }
        return 0;
    };

    const buscarSoporte = (servicioCod, num) => {
        if (!r?.fileUrls) return null;
        const cod = servicioCod.toUpperCase().trim();
        const aliasCod = (cod === "TRS") ? ["TRS", "SUCCION", "SUC"] : [cod];

        for (const [nombre, url] of Object.entries(r.fileUrls)) {
            const nomUpper = nombre.toUpperCase().trim();
            for (const al of aliasCod) {
                const regex = new RegExp(`^${num}[\\s_-]+${al}(\\.[a-z0-9]+|\\s|$)`, "i");
                if (regex.test(nomUpper) || nomUpper === `${num} ${al}.PDF`.toUpperCase()) {
                    return { nombre, url };
                }
            }
        }
        return null;
    };

    let mat = r?.datosMatriz;
    if (!mat && datosMatrizGlobal) {
        mat = buscarPacienteEnMatriz(datosMatrizGlobal, r?.nroDocumento || carpeta, r?.tipoPaquete);
    }

    const backdrop = document.createElement("div");
    backdrop.id = "modalProgramadoDetalladoActivo";
    backdrop.className = "modal-rules-backdrop";

    if (!mat) {
        backdrop.innerHTML = `
            <div class="modal-rules-card" style="max-width: 440px;" onclick="event.stopPropagation()">
                <div class="modal-rules-header">
                    <div style="display:flex; align-items:center; gap:8px;">
                        <span style="font-size:18px;">⚠️</span>
                        <h3 class="modal-rules-title">Programado en Matriz</h3>
                    </div>
                    <button type="button" class="btn-close-rules" onclick="document.getElementById('modalProgramadoDetalladoActivo')?.remove()">&times;</button>
                </div>
                <div class="modal-rules-body" style="text-align:center; padding:24px 16px;">
                    <div style="font-weight:700; font-size:14px; color:var(--text-pure);">Sin datos en la Matriz Excel</div>
                    <div style="font-size:12px; color:var(--text-muted); margin-top:6px;">El paciente <strong>${carpeta}</strong> no figura en la matriz Excel cargada.</div>
                </div>
            </div>
        `;
        document.body.appendChild(backdrop);
        backdrop.addEventListener("click", () => backdrop.remove());
        return;
    }

    const s = mat.servicios || {};
    const pkgCarpeta = r?.tipoPaquete || "—";
    const pkgMatriz = mat.paquete || mat.paqueteRaw || "—";
    const paqueteMismatch = pkgCarpeta !== "—" && pkgMatriz !== "—" && pkgCarpeta !== "auto" && pkgCarpeta !== "EVENTO" && pkgCarpeta.toUpperCase() !== pkgMatriz.toUpperCase();
    const pkgCode = (pkgCarpeta === "EVENTO" ? "EVENTO" : (mat.paquete || mat.paqueteRaw || r?.tipoPaquete || "—"));
    const pkgCls = pkgCode !== "—" ? `pkg-${pkgCode.toLowerCase()}` : "";

    const renderFilaServicioModal = (item) => {
        const matCount = item.progCount || 0;
        const sopCount = item.sopCount || 0;
        const activo = matCount > 0 || sopCount > 0;
        const isMatFaltante = (matCount === 0 && sopCount > 0);
        const isSopFaltante = (sopCount === 0 && matCount > 0);
        const match = matCount === sopCount && matCount > 0;
        const diff = matCount > 0 && sopCount > 0 && matCount !== sopCount;

        return `
            <div class="prog-modal-stat-item ${activo ? 'stat-active' : 'stat-muted'}">
                <span class="prog-modal-stat-label"><strong>${item.label}</strong></span>
                <span class="prog-modal-val-p ${isMatFaltante ? 'prog-pulse-red' : ''}" title="Matriz: ${matCount}">
                    <span class="prog-txt-label">Matriz:</span> <b>${matCount}</b>
                </span>
                <span class="prog-modal-val-s ${isSopFaltante ? 'prog-pulse-red' : (match ? 'sop-ok' : (diff ? 'sop-warn' : ''))}" title="En Soportes: ${sopCount}">
                    <span class="prog-txt-label">Soporte:</span> <b>${sopCount}</b>
                </span>
                <div class="prog-modal-stat-btns">
                    ${item.sop4 ? `<button type="button" class="btn-pdf-subtle modal-btn" onclick="abrirPDFModal('${item.sop4.url}', '${item.sop4.nombre}', this); return false;" title="Ver ${item.sop4.nombre}">4</button>` : `<span class="chip-dash">—</span>`}
                    ${item.sop5 ? `<button type="button" class="btn-pdf-subtle modal-btn" onclick="abrirPDFModal('${item.sop5.url}', '${item.sop5.nombre}', this); return false;" title="Ver ${item.sop5.nombre}">5</button>` : `<span class="chip-dash">—</span>`}
                </div>
            </div>
        `;
    };

    const esPacienteSoloEvento = pkgCarpeta === "EVENTO" || pkgCode === "EVENTO" || (!mat.paqueteRaw && Boolean(mat.esFacturarEvento)) || (Boolean(mat.esFacturarEvento) && !mat.paquete);
        const evs = mat.serviciosEvento || {};

        let grupoFijos = [];
        let grupoTerapias = [];
        let grupoOtros = [];
        let grupoAplicacion = [];

        if (esPacienteSoloEvento) {
            // Servicios que empiezan por Eve. en la Matriz
            grupoFijos = [
                { id: "VM", label: "Eve. Médica General (VM)", progCount: evs.VM || 0 },
                ...(FEATURE_RIESGO_JURIDICO_ACTIVO ? [{ id: "VMRJ", label: "Eve. Médica General Riesgo Jurídico (VMRJ)", progCount: evs.VMRJ || 0 }] : []),
                { id: "VENF", label: "Eve. Enf. Profesional (VENF)", progCount: evs.VENF || 0 },
                { id: "ENF6", label: "Eve. Turno Enf. 6 Horas", progCount: evs.ENF6 || 0 },
                { id: "ENF8", label: "Eve. Turno Enf. 8 Horas", progCount: evs.ENF8 || 0 },
                { id: "ENF12", label: "Eve. Turno Enf. 12 Horas", progCount: evs.ENF12 || 0 },
                { id: "ENF12N", label: "Eve. Turno Enf. 12H Nocturno", progCount: evs.ENF12N || 0 },
                { id: "ENF24", label: "Eve. Turno Enf. 24 Horas", progCount: evs.ENF24 || 0 },
                { id: "CUID6", label: "Eve. Turno Cuidador 6H", progCount: evs.CUID6 || 0 },
                { id: "CUID8", label: "Eve. Turno Cuidador 8H", progCount: evs.CUID8 || 0 },
                { id: "CUID12", label: "Eve. Turno Cuidador 12H", progCount: evs.CUID12 || 0 },
                { id: "CUID12N", label: "Eve. Turno Cuidador 12HN", progCount: evs.CUID12N || 0 },
                { id: "CUID24", label: "Eve. Turno Cuidador 24H", progCount: evs.CUID24 || 0 },
            ].map(f => {
                const cantFechas = calcularSoportesServicio(f.id);
                const sop4 = buscarSoporte(f.id, "4") || buscarSoporte("ENF", "4");
                const sop5 = buscarSoporte(f.id, "5") || buscarSoporte("ENF", "5");
                const sopCount = cantFechas > 0 ? cantFechas : ((sop4 || sop5) ? 1 : 0);
                return { ...f, sopCount, sop4, sop5 };
            });

            grupoTerapias = [
                { id: "TF", label: "Eve. Terapia Física (TF)", progCount: evs.TF || 0 },
                { id: "TR", label: "Eve. Terapia Respiratoria (TR)", progCount: evs.TR || 0 },
                { id: "TRS", label: "Eve. T. Resp. Succión (TRS)", progCount: evs.TRS || 0 },
                { id: "FON", label: "Eve. Fonoaudiología (FON)", progCount: evs.FON || 0 },
                { id: "TO", label: "Eve. Terapia Ocupacional (TO)", progCount: evs.TO || 0 },
            ].map(t => {
                const sopCount = calcularSoportesServicio(t.id);
                const sop4 = buscarSoporte(t.id, "4");
                const sop5 = buscarSoporte(t.id, "5");
                return { ...t, sopCount, sop4, sop5 };
            });

            grupoOtros = [
                { id: "NUT", label: "Eve. Nutrición (NUT)", progCount: evs.NUT || 0 },
                { id: "TS", label: "Eve. Trabajo Social (TS)", progCount: evs.TS || 0 },
                { id: "PSI", label: "Eve. Psicología (PSI)", progCount: evs.PSI || 0 },
                { id: "ESP", label: "Eve. Medicina Especial (ESP)", progCount: evs.ESP || 0 },
            ].map(o => {
                const sopCount = calcularSoportesServicio(o.id);
                const sop4 = buscarSoporte(o.id, "4");
                const sop5 = buscarSoporte(o.id, "5");
                return { ...o, sopCount, sop4, sop5 };
            });

            grupoAplicacion = [
                { id: "MED1", label: "Eve. Aplicación Med. 1 Dosis", progCount: evs.MED1 || 0 },
                { id: "MED2", label: "Eve. Aplicación Med. 2 Dosis", progCount: evs.MED2 || 0 },
                { id: "MED3", label: "Eve. Aplicación Med. 3 Dosis", progCount: evs.MED3 || 0 },
                { id: "MED4", label: "Eve. Aplicación Med. 4 Dosis", progCount: evs.MED4 || 0 },
            ].map(a => {
                const sopCount = calcularSoportesServicio(a.id) || calcularSoportesServicio("APL");
                const sop4 = buscarSoporte(a.id, "4") || buscarSoporte("APL", "4");
                const sop5 = buscarSoporte(a.id, "5") || buscarSoporte("APL", "5");
                return { ...a, sopCount, sop4, sop5 };
            });
        } else {
            // 1. Servicios Fijos Estándar (Paquetes)
            grupoFijos = [
                { id: "VM", label: "Médica (VM)", progCount: s.VM ?? 0 },
                { id: "VENF", label: "Enf. Profesional (VENF)", progCount: s.VENF ?? 0 },
                { id: "ENF", label: "Aux. Enfermería (ENF)", progCount: s.ENF ?? 0 },
            ].map(f => {
                const cantFechas = calcularSoportesServicio(f.id);
                const sop4 = buscarSoporte(f.id, "4");
                const sop5 = buscarSoporte(f.id, "5");
                const sopCount = cantFechas > 0 ? cantFechas : ((sop4 || sop5) ? 1 : 0);
                return { ...f, sopCount, sop4, sop5 };
            });

            // 2. Terapias
            grupoTerapias = [
                { id: "TF", label: "Terapia Física (TF)", progCount: s.TF || 0 },
                { id: "TR", label: "Terapia Respiratoria (TR)", progCount: s.TR || 0 },
                { id: "TRS", label: "T. Resp. Succión (TRS)", progCount: s.TRS || s.SUCCION || 0 },
                { id: "FON", label: "Fonoaudiología (FON)", progCount: s.FON || 0 },
                { id: "TO", label: "Terapia Ocupacional (TO)", progCount: s.TO || 0 },
            ].map(t => {
                const sopCount = calcularSoportesServicio(t.id);
                const sop4 = buscarSoporte(t.id, "4");
                const sop5 = buscarSoporte(t.id, "5");
                return { ...t, sopCount, sop4, sop5 };
            });

            // 3. Otros Servicios
            grupoOtros = [
                { id: "PSI", label: "Psicología (PSI)", progCount: s.PSI || 0 },
                { id: "TS", label: "Trabajo Social (TS)", progCount: s.TS || 0 },
                { id: "NUT", label: "Nutrición (NUT)", progCount: s.NUT || 0 },
            ].map(o => {
                const sopCount = calcularSoportesServicio(o.id);
                const sop4 = buscarSoporte(o.id, "4");
                const sop5 = buscarSoporte(o.id, "5");
                return { ...o, sopCount, sop4, sop5 };
            });

            // 4. Aplicación de Medicamentos (APL)
            grupoAplicacion = [
                { id: "APL", label: "Aplicación Medicamento (APL)", progCount: s.APL || 0 },
            ].map(a => {
                const sopCount = calcularSoportesServicio(a.id);
                const sop4 = buscarSoporte(a.id, "4");
                const sop5 = buscarSoporte(a.id, "5");
                return { ...a, sopCount, sop4, sop5 };
            });
        }

    const totalTerapiasProg = mat.totalTerapias !== undefined 
        ? mat.totalTerapias 
        : ((s.TF || 0) + (s.TR || 0) + (s.TRS || s.SUCCION || 0) + (s.FON || 0) + (s.TO || 0));

    const totalTerapiasSop = ["TF", "TR", "TRS", "FON", "TO"].reduce((acc, tid) => acc + calcularSoportesServicio(tid), 0);

    let avisosModalHTML = "";
    if (paqueteMismatch) {
        avisosModalHTML += `
            <div class="prog-err-line warning" style="margin-top:10px; padding:8px 12px; font-size:12px;">⚠️ <strong>Discrepancia de Paquete:</strong> La carpeta de soportes corresponde a <b>${pkgCarpeta}</b> pero en la matriz Excel fue programado con <b>${pkgMatriz}</b>.</div>
        `;
    }
    if ((mat.errores && mat.errores.length > 0) || (mat.alertas && mat.alertas.length > 0)) {
        const tieneErr = mat.errores && mat.errores.length > 0;
        const errs = (mat.errores || []).map(e => `<div class="prog-err-line error">❌ ${e}</div>`).join("");
        const alts = (mat.alertas || []).map(a => `<div class="prog-err-line warning">⚠️ ${a}</div>`).join("");
        avisosModalHTML += `
            <div style="font-size:12px; font-weight:700; color:${tieneErr ? '#ef4444' : '#d97706'}; margin-top:10px;">${tieneErr ? 'Novedades Detectadas en la Matriz' : 'Alertas Detectadas en la Matriz'}</div>
            <div class="prog-err-container" style="padding:8px 10px; font-size:11.5px;">${errs}${alts}</div>
        `;
    }

    const pkgNombreFull = (PAQUETES_INFO[pkgCode] || {}).nombre || (PAQUETES_INFO[pkgCode] || {}).descripcion || "";
    const metaPaqueteModalHTML = paqueteMismatch
        ? `<div style="display:flex; align-items:center; gap:6px; flex-wrap:wrap;">
                <span class="doc-package-tag pkg-${pkgCarpeta.toLowerCase()} prog-pkg-badge" style="font-size:10.5px !important; padding:2px 8px !important;" title="Paquete en Carpeta de soportes">📁 Carpeta: ${pkgCarpeta}</span>
                <span class="doc-package-tag pkg-${pkgMatriz.toLowerCase()} prog-pkg-badge" style="font-size:10.5px !important; padding:2px 8px !important;" title="Paquete en Matriz Excel">📊 Matriz: ${pkgMatriz}</span>
           </div>`
        : `<span class="doc-package-tag ${pkgCls} prog-pkg-badge" style="font-size:10px !important; padding:2px 8px !important;">${pkgCode}</span>`;

    backdrop.innerHTML = `
        <div class="modal-rules-card" style="max-width: 760px; width: 95%; max-height: 88vh; display:flex; flex-direction:column; box-shadow: var(--shadow-modal);" onclick="event.stopPropagation()">
            <div class="modal-rules-header" style="padding:14px 18px;">
                <div style="display:flex; align-items:center; gap:10px;">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="width:16px;height:16px;color:#107c41;"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path><polyline points="14 2 14 8 20 8"></polyline><path d="M8 13h8"></path><path d="M8 17h8"></path><path d="M10 9h4"></path></svg>
                    <h3 class="modal-rules-title" style="font-size:15px; margin:0;">Programado en Matriz vs Soportes</h3>
                </div>
                <button type="button" class="btn-close-rules" onclick="document.getElementById('modalProgramadoDetalladoActivo')?.remove()">&times;</button>
            </div>

            <div class="modal-rules-body" style="padding:16px 20px; overflow-y:auto; display:flex; flex-direction:column; gap:12px;">
                <div class="prog-patient-header" style="padding:10px 14px; font-size:12px;">
                    <div style="font-size:13.5px; font-weight:800; color:var(--text-pure);">${mat.nombre || 'Paciente'}</div>
                    <div class="prog-patient-meta" style="font-size:11px; margin-top:4px; gap:8px;">
                        <span class="prog-meta-badge" style="padding:2px 6px;">Doc: <strong>${mat.documento || carpeta}</strong></span>
                        ${mat.filaExcel ? `<span class="prog-meta-badge" style="padding:2px 6px;">Fila: <strong>#${mat.filaExcel}</strong></span>` : ''}
                        ${metaPaqueteModalHTML}
                        ${pkgNombreFull ? `<span style="font-size:11.5px; font-weight:600; color:var(--text-secondary);">${pkgNombreFull}</span>` : ''}
                    </div>
                </div>

                <div>
                    <div style="font-size:11px; font-weight:800; text-transform:uppercase; color:var(--text-muted); margin-bottom:6px; letter-spacing:0.4px;">Servicios Fijos</div>
                    <div style="display:flex; flex-direction:column; gap:4px;">
                        ${grupoFijos.map(renderFilaServicioModal).join("")}
                    </div>
                </div>

                <div>
                    <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:6px;">
                        <span style="font-size:11px; font-weight:800; text-transform:uppercase; color:var(--text-muted); letter-spacing:0.4px;">Terapias</span>
                        <span class="prog-total-terapias-badge" style="font-size:10.5px; padding:2px 8px;">Matriz: ${totalTerapiasProg} | Soporte: ${totalTerapiasSop}</span>
                    </div>
                    <div style="display:flex; flex-direction:column; gap:4px;">
                        ${grupoTerapias.map(renderFilaServicioModal).join("")}
                    </div>
                </div>

                <div>
                    <div style="font-size:11px; font-weight:800; text-transform:uppercase; color:var(--text-muted); margin-bottom:6px; letter-spacing:0.4px;">Otros Servicios</div>
                    <div style="display:flex; flex-direction:column; gap:4px;">
                        ${grupoOtros.map(renderFilaServicioModal).join("")}
                    </div>
                </div>

                <div>
                    <div style="font-size:11px; font-weight:800; text-transform:uppercase; color:var(--text-muted); margin-bottom:6px; letter-spacing:0.4px;">Aplicación de Medicamentos</div>
                    <div style="display:flex; flex-direction:column; gap:4px;">
                        ${grupoAplicacion.map(renderFilaServicioModal).join("")}
                    </div>
                </div>

                ${avisosModalHTML}
            </div>

            <div style="padding:10px 20px; background:var(--bg-subtle); border-top:1px solid var(--border-subtle); display:flex; justify-content:flex-end;">
                <button type="button" class="btn-studio btn-studio-primary" style="padding:6px 18px; font-size:12px; font-weight:600;" onclick="document.getElementById('modalProgramadoDetalladoActivo')?.remove()">
                    Cerrar
                </button>
            </div>
        </div>
    `;

    document.body.appendChild(backdrop);
    backdrop.addEventListener("click", () => backdrop.remove());
}

/**
 * Modal amplio para ver la fila completa de un paciente en la Matriz Excel
 * (Mismo estilo visual que el popup 'Programado' de validación de soportes)
 */
export function mostrarModalFilaMatriz(p) {
    if (!p) return;

    const prev = document.getElementById("modalFilaMatrizActivo");
    if (prev) prev.remove();

    const backdrop = document.createElement("div");
    backdrop.id = "modalFilaMatrizActivo";
    backdrop.className = "modal-rules-backdrop";
    backdrop.style.zIndex = "2150";

    const s = p.servicios || {};
    const evs = p.serviciosEvento || {};
    const pkgCode = p.paquete || p.paqueteRaw || "—";
    const pkgCls = p.paquete ? `pkg-${p.paquete.toLowerCase()}` : "";
    const pkgInfo = PAQUETES_INFO[pkgCode] || {};
    const esPacienteEvento = pkgCode === "EVENTO" || (!p.paqueteRaw && Boolean(p.esFacturarEvento)) || (Boolean(p.esFacturarEvento) && !p.paquete);
    const pkgNombreFull = esPacienteEvento
        ? "Facturar por Evento"
        : (pkgInfo.descripcion || pkgInfo.nombre || (p.paqueteRaw || "Sin paquete asignado"));
    const reglaTer = REGLAS_TERAPIAS_PAQUETES[pkgCode] || {};
    const esPaqueteAplicacion = ["CPF1102", "CPF1103", "CPF1104"].includes(pkgCode);

    const renderFilaCompacta = (label, cant, tipoProblema = "", detalle = "") => {
        const val = cant ?? 0;
        const activo = val > 0 || tipoProblema !== "";

        let valCls = val > 0 ? "sop-ok" : "";
        let detalleHTML = "";

        if (tipoProblema === "falta" || tipoProblema === "no_aplica") {
            valCls = "prog-pulse-red";
            if (detalle) {
                detalleHTML = `<span style="font-size:9px; font-weight:700; color:#dc2626;">${detalle}</span>`;
            }
        } else if (tipoProblema === "excede") {
            valCls = "sop-warn";
            if (detalle) {
                detalleHTML = `<span style="font-size:9px; font-weight:700; color:#d97706;">${detalle}</span>`;
            }
        }

        return `
            <div class="prog-row-item ${activo ? 'row-active' : 'row-muted'}" style="grid-template-columns: 1fr auto;">
                <span class="prog-col-name" title="${label}">${label}</span>
                <div style="display:inline-flex; align-items:center; gap:6px;">
                    ${detalleHTML}
                    <span class="prog-col-sop ${valCls}" title="Matriz: ${val}">
                        <span class="prog-txt-label">Matriz:</span> <b>${val}</b>
                    </span>
                </div>
            </div>
        `;
    };

    let filasFijosHTML = "";
    let filasTerapiasHTML = "";
    let filasOtrosHTML = "";
    let filasAplHTML = "";
    let totalTer = 0;
    let terHeaderStyle = "";
    let terHeaderExtra = "";

    if (esPacienteEvento) {
        // En paciente por Evento se muestran los servicios que en la matriz empiezan por Eve.
        filasFijosHTML = [
            renderFilaCompacta("Eve. Médica General (VM)", evs.VM || 0),
            ...(FEATURE_RIESGO_JURIDICO_ACTIVO ? [renderFilaCompacta("Eve. Médica General Riesgo Jurídico (VMRJ)", evs.VMRJ || 0)] : []),
            renderFilaCompacta("Eve. Enfermería Profesional (VENF)", evs.VENF || 0),
            renderFilaCompacta("Eve. Turno Enfermería 6 Horas", evs.ENF6 || 0),
            renderFilaCompacta("Eve. Turno Enfermería 8 Horas", evs.ENF8 || 0),
            renderFilaCompacta("Eve. Turno Enfermería 12 Horas", evs.ENF12 || 0),
            renderFilaCompacta("Eve. Turno Enfermería 12 Horas Nocturno", evs.ENF12N || 0),
            renderFilaCompacta("Eve. Turno Enfermería 24 Horas", evs.ENF24 || 0),
            renderFilaCompacta("Eve. Turno Cuidador 6 Horas", evs.CUID6 || 0),
            renderFilaCompacta("Eve. Turno Cuidador 8 Horas", evs.CUID8 || 0),
            renderFilaCompacta("Eve. Turno Cuidador 12 Horas", evs.CUID12 || 0),
            renderFilaCompacta("Eve. Turno Cuidador 12 Horas Nocturno", evs.CUID12N || 0),
            renderFilaCompacta("Eve. Turno Cuidador 24 Horas", evs.CUID24 || 0),
        ].join("");

        const terapiasEvento = [
            { label: "Eve. Terapia Física (TF)", val: evs.TF || 0 },
            { label: "Eve. Terapia Respiratoria (TR)", val: evs.TR || 0 },
            { label: "Eve. T. Resp. Succión (TRS)", val: evs.TRS || 0 },
            { label: "Eve. Fonoaudiología (FON)", val: evs.FON || 0 },
            { label: "Eve. Terapia Ocupacional (TO)", val: evs.TO || 0 },
        ];
        totalTer = terapiasEvento.reduce((acc, t) => acc + (t.val || 0), 0);
        filasTerapiasHTML = terapiasEvento.map(t => renderFilaCompacta(t.label, t.val)).join("");

        filasOtrosHTML = [
            renderFilaCompacta("Eve. Nutrición (NUT)", evs.NUT || 0),
            renderFilaCompacta("Eve. Trabajo Social (TS)", evs.TS || 0),
            renderFilaCompacta("Eve. Psicología (PSI)", evs.PSI || 0),
            renderFilaCompacta("Eve. Medicina Especial (ESP)", evs.ESP || 0),
        ].join("");

        filasAplHTML = [
            renderFilaCompacta("Eve. Aplicación Medicamento 1 Dosis", evs.MED1 || 0),
            renderFilaCompacta("Eve. Aplicación Medicamento 2 Dosis", evs.MED2 || 0),
            renderFilaCompacta("Eve. Aplicación Medicamento 3 Dosis", evs.MED3 || 0),
            renderFilaCompacta("Eve. Aplicación Medicamento 4 Dosis", evs.MED4 || 0),
        ].join("");
    } else {
        // 1. Servicios Fijos Estándar (Paquetes)
        const vmReq = (pkgCode === "CPF1107" || pkgCode === "CPF1225") ? 2 : 1;
        const vmVal = s.VM ?? 0;
        const probVM = vmVal < vmReq ? "falta" : (vmVal > vmReq ? "excede" : "");
        const detVM = vmVal < vmReq ? `Falta (requiere ${vmReq})` : (vmVal > vmReq ? `Excede (requiere ${vmReq})` : "");

        let probVENF = "", detVENF = "";
        let probENF = "", detENF = "";
        const venfVal = s.VENF ?? 0;
        const enfVal = s.ENF ?? 0;

        if (esPaqueteAplicacion) {
            if (enfVal < 1) { probENF = "falta"; detENF = "Falta (requiere 1)"; }
            else if (enfVal > 1) { probENF = "excede"; detENF = "Excede (requiere 1)"; }
            if (venfVal > 0) { probVENF = "no_aplica"; detVENF = "No aplica (requiere 0)"; }
        } else if (pkgCode === "CPF1107") {
            if (enfVal < 4) { probENF = "falta"; detENF = "Falta (requiere 4)"; }
            else if (enfVal > 4) { probENF = "excede"; detENF = "Excede (requiere 4)"; }
            if (venfVal > 0) { probVENF = "excede"; detVENF = "No aplica (requiere 0)"; }
        } else if (pkgCode.startsWith("CPF")) {
            if (venfVal === 0 && enfVal === 0) {
                probVENF = "falta"; detVENF = "Falta (requiere VENF o ENF)";
                probENF = "falta"; detENF = "Falta (requiere VENF o ENF)";
            } else {
                if (venfVal > 1) { probVENF = "excede"; detVENF = "Excede (requiere 1)"; }
                if (enfVal > 1) { probENF = "excede"; detENF = "Excede (requiere 1)"; }
            }
        }

        filasFijosHTML = [
            renderFilaCompacta("Médica (VM)", vmVal, probVM, detVM),
            renderFilaCompacta("Enf. Profesional (VENF)", venfVal, probVENF, detVENF),
            renderFilaCompacta("Aux. Enfermería (ENF)", enfVal, probENF, detENF),
        ].join("");

        // 2. Terapias
        const getProbTerapia = (val) => {
            const v = val || 0;
            if (v > 0 && (esPaqueteAplicacion || reglaTer.permiteTerapias === false)) {
                return { prob: "no_aplica", det: "No aplica (requiere 0)" };
            }
            return { prob: "", det: "" };
        };

        filasTerapiasHTML = [
            { label: "Terapia Física (TF)", val: s.TF || 0 },
            { label: "Terapia Respiratoria (TR)", val: s.TR || 0 },
            { label: "T. Resp. Succión (TRS)", val: s.TRS || 0 },
            { label: "Fonoaudiología (FON)", val: s.FON || 0 },
            { label: "Terapia Ocupacional (TO)", val: s.TO || 0 },
        ].map(t => {
            const { prob, det } = getProbTerapia(t.val);
            return renderFilaCompacta(t.label, t.val, prob, det);
        }).join("");

        totalTer = p.totalTerapias ?? 0;
        if (reglaTer.min !== undefined && totalTer < reglaTer.min) {
            terHeaderStyle = "color:#dc2626; border-color:rgba(239,68,68,0.35); background:rgba(239,68,68,0.08);";
            terHeaderExtra = ` · Falta (mín. ${reglaTer.min})`;
        } else if (reglaTer.max !== undefined && totalTer > reglaTer.max) {
            terHeaderStyle = "color:#d97706; border-color:rgba(245,158,11,0.35); background:rgba(245,158,11,0.1);";
            terHeaderExtra = ` · Excede (máx. ${reglaTer.max})`;
        }

        // 3. Otros Servicios
        const cantOptActivos = [s.PSI || 0, s.NUT || 0, s.TS || 0].filter((c) => c > 0).length;
        const getProbOpt = (val) => {
            const v = val || 0;
            if (esPaqueteAplicacion) {
                return v > 0 ? { prob: "no_aplica", det: "No aplica (requiere 0)" } : { prob: "", det: "" };
            }
            if (cantOptActivos === 0) {
                return { prob: "falta", det: "Falta (requiere 1 opcional)" };
            }
            if (v === 0) return { prob: "", det: "" };
            if (v > 1) return { prob: "excede", det: "Excede (requiere 1)" };
            if (cantOptActivos > 1) return { prob: "excede", det: "Excede (solo 1 opcional)" };
            return { prob: "", det: "" };
        };

        filasOtrosHTML = [
            { label: "Psicología (PSI)", val: s.PSI || 0 },
            { label: "Trabajo Social (TS)", val: s.TS || 0 },
            { label: "Nutrición (NUT)", val: s.NUT || 0 },
        ].map(o => {
            const { prob, det } = getProbOpt(o.val);
            return renderFilaCompacta(o.label, o.val, prob, det);
        }).join("");

        // 4. Aplicación de Medicamentos
        const aplVal = s.APL || 0;
        const probAPL = (esPaqueteAplicacion && aplVal === 0) ? "falta" : "";
        const detAPL = (esPaqueteAplicacion && aplVal === 0) ? "Falta dosis" : "";
        filasAplHTML = renderFilaCompacta("Aplicación Medicamento (APL)", aplVal, probAPL, detAPL);
    }

    // Avisos al pie (mismo formato compacto que Soportes)
    let avisosHTML = "";
    if ((p.errores && p.errores.length > 0) || (p.alertas && p.alertas.length > 0)) {
        const tieneErr = p.errores && p.errores.length > 0;
        const errs = (p.errores || []).map(e => `<div class="prog-err-line error">❌ ${e}</div>`).join("");
        const alts = (p.alertas || []).map(a => `<div class="prog-err-line warning">⚠️ ${a}</div>`).join("");
        avisosHTML = `
            <div class="prog-section-title" style="color:${tieneErr ? '#ef4444' : '#d97706'}; margin-top:6px;">${tieneErr ? 'Novedades Matriz' : 'Alertas Matriz'}</div>
            <div class="prog-err-container">${errs}${alts}</div>
        `;
    }

    backdrop.innerHTML = `
        <div class="programado-floating-popover floating-popover-movable" style="position:relative; width: 420px; min-width: 320px; max-width: 94vw; max-height: 88vh; resize:none;" onclick="event.stopPropagation()">
            <div class="popover-header">
                <span class="popover-header-title">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="width:12px;height:12px;display:inline-block;vertical-align:middle;margin-right:4px;color:#107c41;"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path><polyline points="14 2 14 8 20 8"></polyline><path d="M8 13h8"></path><path d="M8 17h8"></path><path d="M10 9h4"></path></svg>
                    Matriz
                </span>
                <div class="popover-header-actions">
                    <button type="button" class="popover-close-btn" onclick="document.getElementById('modalFilaMatrizActivo')?.remove()">&times;</button>
                </div>
            </div>

            <div class="popover-body prog-popover-body">
                <div class="prog-patient-header">
                    <div class="prog-patient-name" title="${p.nombre || '—'}">${p.nombre || 'Paciente'}</div>
                    <div class="prog-patient-meta">
                        <span class="prog-meta-badge">Doc: <strong>${p.documento || '—'}</strong></span>
                        ${p.filaExcel ? `<span class="prog-meta-badge">Fila: <strong>#${p.filaExcel}</strong></span>` : ''}
                        <span class="doc-package-tag ${pkgCls} prog-pkg-badge">${pkgCode}</span>
                    </div>
                    <div style="font-size:10px; font-weight:600; color:var(--text-secondary); line-height:1.3; margin-top:2px;">${pkgNombreFull}</div>
                </div>

                <!-- Servicios Fijos / Turnos -->
                <div class="prog-category-block">
                    <div class="prog-category-header">
                        <span>${esPacienteEvento ? 'Servicios Médicos / Turnos' : 'Servicios Fijos'}</span>
                    </div>
                    <div class="prog-category-list">
                        ${filasFijosHTML}
                    </div>
                </div>

                <!-- Terapias -->
                <div class="prog-category-block">
                    <div class="prog-category-header">
                        <span>Terapias</span>
                        <span class="prog-total-terapias-badge" style="${terHeaderStyle}">Matriz: ${totalTer}${terHeaderExtra}</span>
                    </div>
                    <div class="prog-category-list">
                        ${filasTerapiasHTML}
                    </div>
                </div>

                <!-- Otros Servicios -->
                <div class="prog-category-block">
                    <div class="prog-category-header">
                        <span>Otros Servicios</span>
                    </div>
                    <div class="prog-category-list">
                        ${filasOtrosHTML}
                    </div>
                </div>

                <!-- Aplicación Medicamentos -->
                <div class="prog-category-block">
                    <div class="prog-category-header">
                        <span>Aplicación Medicamentos</span>
                    </div>
                    <div class="prog-category-list">
                        ${filasAplHTML}
                    </div>
                </div>

                ${avisosHTML}
            </div>
        </div>
    `;

    document.body.appendChild(backdrop);
    backdrop.addEventListener("click", () => backdrop.remove());
}

/**
 * Modal de diagnóstico y prevalidación de matriz
 */
export function mostrarModalPrevalidacionMatriz(matrizData, registrosOmitidosSet = new Set(), onToggleOmitirRegistro = null) {
    if (!matrizData) return;

    const prev = document.getElementById("modalPrevalidacionMatrizActivo");
    if (prev) prev.remove();

    const { diagnosticoGlobal, pacientesList } = matrizData;

    const backdrop = document.createElement("div");
    backdrop.id = "modalPrevalidacionMatrizActivo";
    backdrop.className = "modal-rules-backdrop";

    const totalPacientes = diagnosticoGlobal.totalPacientes || 0;
    const conErrores = diagnosticoGlobal.pacientesConErrores || 0;
    const conAlertas = diagnosticoGlobal.pacientesConAlertas || 0;
    const conformes = Math.max(0, totalPacientes - conErrores - conAlertas);

    // Mapa de errores/alertas por código de paquete para identificar paquetes con problemas
    const estadoPorPaquete = {};
    pacientesList.forEach((p) => {
        const pkg = (p.paquete || p.paqueteRaw || "SIN_PAQUETE").toUpperCase();
        if (!estadoPorPaquete[pkg]) {
            estadoPorPaquete[pkg] = { errores: 0, alertas: 0 };
        }
        if (p.errores && p.errores.length > 0) estadoPorPaquete[pkg].errores += p.errores.length;
        if (p.alertas && p.alertas.length > 0) estadoPorPaquete[pkg].alertas += p.alertas.length;
    });

    // Badges de conteo por paquete ordenados y clickeables para filtrar
    const paquetesEntries = Object.entries(diagnosticoGlobal.conteoPorPaquete || {});
    paquetesEntries.sort(([pkgA], [pkgB]) => {
        const idxA = PAQUETES_SOPORTADOS.indexOf(pkgA.toUpperCase());
        const idxB = PAQUETES_SOPORTADOS.indexOf(pkgB.toUpperCase());
        if (idxA !== -1 && idxB !== -1) return idxA - idxB;
        if (idxA !== -1) return -1;
        if (idxB !== -1) return 1;
        return pkgA.localeCompare(pkgB, undefined, { numeric: true, sensitivity: "base" });
    });

    const paquetesHTML = paquetesEntries
        .map(([pkg, count]) => {
            const pkgCls = `pkg-${pkg.toLowerCase()}`;
            const pkgState = estadoPorPaquete[pkg.toUpperCase()] || { errores: 0, alertas: 0 };
            const tieneError = pkgState.errores > 0;
            const tieneAlerta = !tieneError && pkgState.alertas > 0;
            const statusCls = tieneError ? "pkg-has-error" : (tieneAlerta ? "pkg-has-warning" : "");
            const titleMsg = tieneError
                ? `${pkg}: Contiene errores en la matriz. Click para filtrar.`
                : (tieneAlerta
                    ? `${pkg}: Contiene alertas por exceso en la matriz. Click para filtrar.`
                    : `${pkg}: Todo conforme. Click para filtrar.`);

            return `
                <div class="preval-pkg-chip doc-package-tag ${pkgCls} ${statusCls}" data-pkg="${pkg}" role="button" tabindex="0" title="${titleMsg}">
                    <span class="package-name">${pkg}</span>
                    <span class="preval-pkg-count">${count}</span>
                </div>
            `;
        })
        .join("") || "<span style='color:var(--text-muted); font-size:11px;'>Sin paquetes</span>";

    // Filas de la tabla
    const filasHTML = pacientesList.map((p, idx) => {
        const docUpper = String(p.documento || "").trim().toUpperCase();
        const estaOmitido = registrosOmitidosSet && registrosOmitidosSet.has(docUpper);

        const tieneErroresFila = p.errores && p.errores.length > 0;
        const tieneAlertasFila = p.alertas && p.alertas.length > 0;

        const estadoBadge = estaOmitido
            ? `<span class="preval-badge omitido">🚫 Omitido</span>`
            : (tieneErroresFila
                ? `<span class="preval-badge error">✗ Novedades</span>`
                : (tieneAlertasFila
                    ? `<span class="preval-badge warning">⚠️ Alerta</span>`
                    : `<span class="preval-badge success">✔ Conforme</span>`));

        const estadoDataAttr = estaOmitido
            ? "omitido"
            : (tieneErroresFila
                ? "novedades"
                : (tieneAlertasFila ? "alerta" : "conforme"));

        const renderDiagItem = (texto, tipo) => {
            const icon = tipo === "error" ? "✕" : "⚠️";
            const cls = tipo === "error" ? "preval-item-error" : "preval-item-warning";
            const parts = texto.split(":");
            if (parts.length > 1) {
                const header = parts[0].trim();
                const body = parts.slice(1).join(":").trim();
                return `<div class="${cls}"><span class="preval-icon-bullet">${icon}</span><span class="preval-err-tag">${header}</span><span class="preval-err-desc">${formatearErrorConIconosPDF(body)}</span></div>`;
            }
            return `<div class="${cls}"><span class="preval-icon-bullet">${icon}</span><span>${formatearErrorConIconosPDF(texto)}</span></div>`;
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

        const esFilaSoloEvento = pkgCode === "EVENTO" || (!p.paqueteRaw && p.esFacturarEvento) || (p.esFacturarEvento && !p.paquete);

        const nombresEventoCompleto = {
            VM: "Valoración medicina general",
            VMRJ: "Visita médica riesgo jurídico",
            ENF6: "Turno enfermería 6 horas",
            ENF8: "Turno enfermería 8 horas",
            ENF12: "Turno enfermería 12 horas",
            ENF12N: "Turno enfermería 12 horas nocturno",
            ENF24: "Turno enfermería 24 horas",
            CUID6: "Turno cuidador 6 horas",
            CUID8: "Turno cuidador 8 horas",
            CUID12: "Turno cuidador 12 horas",
            CUID12N: "Turno cuidador 12 horas nocturno",
            CUID24: "Turno cuidador 24 horas",
            TS: "Trabajo social",
        };

        const esPaqueteAplicacion = ["CPF1102", "CPF1103", "CPF1104"].includes(pkgCode);

        // Grupos ordenados, alineados en columnas consistentes con semáforo según reglas reales del paquete
        let chipsServicios = "";
        if (esFilaSoloEvento) {
            const evs = p.serviciosEvento || {};
            const evItems = Object.entries(evs)
                .filter(([_, cant]) => cant > 0)
                .map(([cod, cant]) => `<span class="pserv-tag active" style="font-weight:700;" title="${nombresEventoCompleto[cod] || cod}: ${cant}">${cod}: ${cant}</span>`);

            chipsServicios = `
                <div class="preval-services-structured">
                    <div class="pserv-group">
                        <span class="pserv-group-title">Eventos:</span>
                        <div class="pserv-group-items">
                            ${evItems.length > 0 ? evItems.join(" ") : '<span class="pserv-tag dim">Sin eventos asignados</span>'}
                        </div>
                    </div>
                </div>
            `;
        } else if (esPaqueteAplicacion) {
            const clsVM = s.VM < 1 ? "err" : (s.VM === 1 ? "ok" : "warn");
            const clsENF = s.ENF < 1 ? "err" : (s.ENF === 1 ? "ok" : "warn");
            const clsVENF = s.VENF > 0 ? "err" : "dim";
            const aplVal = s.APL || 0;
            let clsAPL = "ok";
            if (pkgCode === "CPF1102") {
                clsAPL = aplVal < 1 ? "err" : (aplVal === 1 ? "ok" : "warn");
            } else if (pkgCode === "CPF1103") {
                clsAPL = aplVal < 2 ? "err" : (aplVal <= 3 ? "ok" : "warn");
            } else if (pkgCode === "CPF1104") {
                clsAPL = aplVal < 4 ? "err" : "ok";
            }
            const paqDiarioVal = p.cantPaqDiario ?? 0;
            const clsPaqDiario = (paqDiarioVal <= 0 || paqDiarioVal < aplVal)
                ? "err"
                : (paqDiarioVal === aplVal ? "ok" : "warn");

            chipsServicios = `
                <div class="preval-services-structured">
                    <!-- 1. Fijos Obligatorios -->
                    <div class="pserv-group">
                        <span class="pserv-group-title">Fijos:</span>
                        <div class="pserv-group-items">
                            <span class="pserv-tag oblig ${clsVM}">VM: ${s.VM}</span>
                            <span class="pserv-tag oblig ${clsENF}">ENF: ${s.ENF}</span>
                            <span class="pserv-tag oblig ${clsVENF}" title="${s.VENF > 0 ? 'VENF: No aplica en este paquete (requiere 0)' : 'VENF: 0 (No aplica)'}">VENF: ${s.VENF}</span>
                        </div>
                    </div>

                    <!-- 2. Aplicación Medicamentos -->
                    <div class="pserv-group">
                        <span class="pserv-group-title">Aplicación:</span>
                        <div class="pserv-group-items">
                            <span class="pserv-tag oblig ${clsAPL}">APL (Dosis): ${aplVal}</span>
                            <span class="pserv-tag oblig ${clsPaqDiario}">Paq. Diario: ${paqDiarioVal}</span>
                        </div>
                    </div>
                </div>
            `;
        } else {
            // 1. Fijos Obligatorios según paquete
            const vmReq = (pkgCode === "CPF1107" || pkgCode === "CPF1225") ? 2 : 1;
            const clsVM = s.VM < vmReq ? "err" : (s.VM === vmReq ? "ok" : "warn");

            let clsVENF = "ok";
            let clsENF = "ok";
            if (pkgCode === "CPF1107") {
                // CPF1107 exige 4 ENF y 0 VENF
                clsENF = s.ENF < 4 ? "err" : (s.ENF === 4 ? "ok" : "warn");
                clsVENF = s.VENF === 0 ? "dim" : "warn";
            } else {
                // Resto de paquetes CPF: requiere 1 VENF o 1 ENF (al menos uno, máx 1 por servicio)
                if (s.VENF === 0 && s.ENF === 0) {
                    clsVENF = "err";
                    clsENF = "err";
                } else {
                    clsVENF = s.VENF === 0 ? "dim" : (s.VENF === 1 ? "ok" : "warn");
                    clsENF = s.ENF === 0 ? "dim" : (s.ENF === 1 ? "ok" : "warn");
                }
            }

            // 2. Opcional (PSI, NUT, TS): requiere exactamente 1 de los 3 con cantidad 1
            const cantOptActivos = [s.PSI || 0, s.NUT || 0, s.TS || 0].filter((c) => c > 0).length;
            const getOptCls = (val) => {
                const v = val || 0;
                if (cantOptActivos === 0) return "err";
                if (v === 0) return "dim";
                if (cantOptActivos > 1 || v > 1) return "warn";
                return "active";
            };
            const clsPSI = getOptCls(s.PSI);
            const clsNUT = getOptCls(s.NUT);
            const clsTS = getOptCls(s.TS);

            // 3. Terapias (Total)
            const reglaTer = REGLAS_TERAPIAS_PAQUETES[pkgCode];
            let clsTerTotal = "";
            if (pkgCode === "CPF1107") {
                clsTerTotal = p.totalTerapias > 0 ? "warn" : "";
            } else if (reglaTer && reglaTer.min !== undefined && reglaTer.max !== undefined) {
                if (p.totalTerapias < reglaTer.min) clsTerTotal = "err";
                else if (p.totalTerapias > reglaTer.max) clsTerTotal = "warn";
            }

            chipsServicios = `
                <div class="preval-services-structured">
                    <!-- 1. Fijos Obligatorios -->
                    <div class="pserv-group">
                        <span class="pserv-group-title">Fijos:</span>
                        <div class="pserv-group-items">
                            <span class="pserv-tag oblig ${clsVM}">VM: ${s.VM}</span>
                            <span class="pserv-tag oblig ${clsVENF}">VENF: ${s.VENF}</span>
                            <span class="pserv-tag oblig ${clsENF}">ENF: ${s.ENF}</span>
                        </div>
                    </div>

                    <!-- 2. Opcional A Elección -->
                    <div class="pserv-group">
                        <span class="pserv-group-title">Opcional:</span>
                        <div class="pserv-group-items">
                            <span class="pserv-tag opt ${clsPSI}">PSI: ${s.PSI}</span>
                            <span class="pserv-tag opt ${clsNUT}">NUT: ${s.NUT}</span>
                            <span class="pserv-tag opt ${clsTS}">TS: ${s.TS}</span>
                        </div>
                    </div>

                    <!-- 3. Terapias con Desglose y Suma -->
                    <div class="pserv-group">
                        <span class="pserv-group-title">Terapias:</span>
                        <div class="pserv-group-items">
                            <span class="pserv-tag ter-total ${clsTerTotal}">Total: ${p.totalTerapias}</span>
                            <div class="pserv-tag ter-detail">${terapiasDetalleChips}</div>
                        </div>
                    </div>
                </div>
            `;
        }

        let packageDescText = (PAQUETES_INFO[pkgCode] || {}).descripcion || "No parametrizado";
        let packageDescStyle = PAQUETES_INFO[pkgCode] ? "" : "color:#ef4444; font-weight:700;";
        if (esFilaSoloEvento) {
            const evs = p.serviciosEvento || {};
            const listaNombres = Object.entries(evs)
                .filter(([_, cant]) => cant > 0)
                .map(([cod]) => nombresEventoCompleto[cod] || cod);
            packageDescText = listaNombres.length > 0 ? listaNombres.join("<br>") : "Validación por Evento";
            packageDescStyle = "white-space: normal; line-height: 1.25; color: var(--text-secondary);";
        }

        return `
            <tr class="preval-row ${estaOmitido ? 'fila-omitida' : (tieneErroresFila ? 'con-novedad' : (tieneAlertasFila ? 'con-alerta' : 'valido'))}" data-row-idx="${idx}" data-doc="${p.documento || ''}" data-nombre="${(p.nombre || '').toLowerCase()}" data-pkg="${pkgCode}" data-estado="${estadoDataAttr}">
                <td class="preval-cell-num" style="text-align:center;">
                    <label style="cursor:pointer; display:flex; flex-direction:column; align-items:center; gap:2px;" title="${estaOmitido ? 'Registro omitido (click para incluir)' : 'Click para omitir este registro'}">
                        <input type="checkbox" class="btn-preval-omitir-chk" data-doc="${p.documento || ''}" ${estaOmitido ? 'checked' : ''} />
                        <span style="font-size:10px; color:var(--text-muted);">${p.filaExcel}</span>
                    </label>
                </td>
                <td class="preval-cell-doc">
                    <div class="doc-badge-stack preval-doc-badge-stack">
                        <div class="doc-package-container">
                            <div class="doc-package-tag ${pkgCls}">
                                <span class="package-name">${pkgCode}</span>
                                <button type="button" class="btn-package-rules" onclick="mostrarModalReglasPaquete('${pkgCode}')" title="Ver reglas y detalles de ${pkgCode}">
                                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="width:10px;height:10px;"><circle cx="12" cy="12" r="10"></circle><line x1="12" y1="16" x2="12" y2="12"></line><line x1="12" y1="8" x2="12.01" y2="8"></line></svg>
                                </button>
                            </div>
                            <div class="doc-package-desc" style="${packageDescStyle}" title="${(PAQUETES_INFO[pkgCode] || {}).nombre || 'No parametrizado'}">${packageDescText}</div>
                        </div>
                        <div class="doc-title-line preval-doc-title-line">
                            <span class="carpeta-nombre preval-doc-num">${p.documento || "—"}</span>
                            <div class="preval-copy-btn-group">
                                <button type="button" class="btn-copy-minimal btn-copy-doc" title="Copiar sólo documento (${p.documento})">📋</button>
                                <button type="button" class="btn-copy-minimal btn-copy-pkg-doc" title="Copiar '${pkgCode} - ${p.documento} - '">🏷️</button>
                                <button type="button" class="btn-copy-minimal btn-copy-err" title="Copiar con novedad">📝</button>
                            </div>
                        </div>
                        <div class="doc-badge-actions">
                            <button type="button" class="carpeta-files-badge btn-programado-trigger btn-ver-fila-matriz" title="Ver fila completa #${p.filaExcel} en la matriz Excel">
                                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="width:11px;height:11px;color:#107c41;"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path><polyline points="14 2 14 8 20 8"></polyline><path d="M8 13h8"></path><path d="M8 17h8"></path><path d="M10 9h4"></path></svg>
                                <span>Ver matriz</span>
                            </button>
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
            <!-- Modal Header Compacto con KPIs Integrados -->
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

                <div class="preval-header-actions">
                    <button type="button" class="btn-subtle-pill" id="btnModalOmitirRegistros" title="Seleccionar qué pacientes o filas ignorar para no auditarlos">
                        🚫 Omitir Filas (${registrosOmitidosSet ? registrosOmitidosSet.size : 0})
                    </button>
                    <div class="preval-kpi-compact">
                        <span class="kpi-tag total">Total <strong>${totalPacientes}</strong></span>
                        <span class="kpi-tag ok">Conformes <strong>${conformes}</strong></span>
                        <span class="kpi-tag ${conAlertas > 0 ? 'warn' : 'ok'}">Alertas <strong>${conAlertas}</strong></span>
                        <span class="kpi-tag ${conErrores > 0 ? 'err' : 'ok'}">
                            Novedades <strong>${conErrores}</strong>
                            <button type="button" id="btnCopiarTodasNovedadesMatriz" class="btn-copy-kpi" title="Copiar todas las novedades y alertas visibles de la matriz">📋 Copiar</button>
                        </span>
                    </div>
                    <button type="button" class="modal-rules-close" onclick="document.getElementById('modalPrevalidacionMatrizActivo')?.remove()" title="Cerrar">&times;</button>
                </div>
            </div>

            <!-- Modal Content Body -->
            <div class="preval-modal-body">
                <!-- Barra de Paquetes con Ancho Completo -->
                <div class="preval-top-toolbar">
                    <div class="preval-pkg-section">
                        <span class="preval-pkg-section-label">Paquetes:</span>
                        <div class="preval-pkg-cluster-scroll">
                            <div class="preval-pkg-cluster">${paquetesHTML}</div>
                        </div>
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
                            <button type="button" class="btn-segmented" data-filter-estado="alerta">Alertas</button>
                            <button type="button" class="btn-segmented" data-filter-estado="novedades">Con novedades</button>
                            <button type="button" class="btn-segmented" data-filter-estado="omitido">Omitidos</button>
                        </div>
                    </div>
                </div>

                <!-- Tabla de Diagnóstico Compacta -->
                <div class="preval-table-container">
                    <table class="preval-table" id="prevalTableMain">
                        <thead>
                            <tr>
                                <th style="width: 52px; text-align: center;" title="Casilla para omitir fila de la validación">Omitir</th>
                                <th style="width: 220px;">Documento / Paquete</th>
                                <th style="width: 195px;">Nombre Paciente</th>
                                <th style="width: 300px;">Programación Matriz</th>
                                <th style="width: 115px; text-align: center;">Estado</th>
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
    const pkgChips = document.querySelectorAll(".preval-pkg-chip[data-pkg]");
    const tbody = document.getElementById("prevalTableBody");

    let estadoActivo = "";
    let paqueteActivo = "";

    const aplicarFiltrosModal = () => {
        if (!tbody) return;
        const q = (buscarInput?.value || "").toLowerCase().trim();
        const filas = tbody.querySelectorAll("tr.preval-row");

        filas.forEach((tr) => {
            const doc = tr.getAttribute("data-doc") || "";
            const nombre = tr.getAttribute("data-nombre") || "";
            const estado = tr.getAttribute("data-estado") || "";
            const pkg = tr.getAttribute("data-pkg") || "";

            const matchTexto = !q || doc.includes(q) || nombre.includes(q);
            const matchEstado = !estadoActivo || estado === estadoActivo;
            const matchPaquete = !paqueteActivo || pkg.toUpperCase() === paqueteActivo.toUpperCase();

            if (matchTexto && matchEstado && matchPaquete) {
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

    // Toggle de filtrado por chip de paquete
    if (pkgChips) {
        pkgChips.forEach((chip) => {
            const togglePkg = () => {
                const pkg = chip.getAttribute("data-pkg");
                if (paqueteActivo === pkg) {
                    // Quitar filtro si se vuelve a hacer click en el mismo
                    paqueteActivo = "";
                    pkgChips.forEach((c) => c.classList.remove("active-filter", "dimmed-filter"));
                } else {
                    // Aplicar filtro al paquete seleccionado
                    paqueteActivo = pkg;
                    pkgChips.forEach((c) => {
                        if (c.getAttribute("data-pkg") === pkg) {
                            c.classList.add("active-filter");
                            c.classList.remove("dimmed-filter");
                        } else {
                            c.classList.remove("active-filter");
                            c.classList.add("dimmed-filter");
                        }
                    });
                }
                aplicarFiltrosModal();
            };

            chip.addEventListener("click", togglePkg);
            chip.addEventListener("keydown", (e) => {
                if (e.key === "Enter" || e.key === " ") {
                    e.preventDefault();
                    togglePkg();
                }
            });
        });
    }

    // Event delegation para los botones de copiar y el botón "Ver fila" en cada fila
    if (tbody) {
        tbody.addEventListener("click", (e) => {
            const btnDoc = e.target.closest(".btn-copy-doc");
            const btnPkgDoc = e.target.closest(".btn-copy-pkg-doc");
            const btnErr = e.target.closest(".btn-copy-err");
            const btnVerFila = e.target.closest(".btn-ver-fila-matriz");

            if (!btnDoc && !btnPkgDoc && !btnErr && !btnVerFila) return;
            e.stopPropagation();

            const tr = e.target.closest("tr.preval-row");
            if (!tr) return;

            const rowIdx = parseInt(tr.getAttribute("data-row-idx") || "-1", 10);
            const doc = tr.getAttribute("data-doc") || "";
            const pkg = tr.getAttribute("data-pkg") || "";
            const paciente = (rowIdx >= 0 && pacientesList[rowIdx])
                ? pacientesList[rowIdx]
                : pacientesList.find((p) => String(p.documento || "").trim() === String(doc).trim());

            if (btnVerFila) {
                if (paciente) {
                    mostrarModalFilaMatriz(paciente);
                }
                return;
            }

            if (btnDoc) {
                copiarTextoSimple(e, doc);
            } else if (btnPkgDoc) {
                copiarTextoSimple(e, `${pkg} - ${doc} - `);
            } else if (btnErr) {
                const textoErroresRaw = paciente
                    ? ([...(paciente.errores || []), ...(paciente.alertas || [])].join(" | ") || "Conforme")
                    : "Conforme";
                copiarErrorMatriz(e, pkg, doc, textoErroresRaw);
            }
        });
    }

    // Botón masivo para copiar todas las novedades de la matriz
    const btnCopiarTodas = document.getElementById("btnCopiarTodasNovedadesMatriz");
    if (btnCopiarTodas) {
        btnCopiarTodas.addEventListener("click", async (e) => {
            e.stopPropagation();

            // Obtener documentos de filas visibles según filtros actuales
            const filasVisibles = tbody
                ? Array.from(tbody.querySelectorAll("tr.preval-row")).filter((tr) => tr.style.display !== "none")
                : [];
            const docsVisibles = new Set(filasVisibles.map((tr) => (tr.getAttribute("data-doc") || "").trim()).filter(Boolean));

            const pacientesConNovedad = pacientesList.filter((p) => {
                const tieneNovedad = (p.errores && p.errores.length > 0) || (p.alertas && p.alertas.length > 0);
                if (!tieneNovedad) return false;
                const docStr = String(p.documento || "").trim();
                return docsVisibles.size > 0 ? docsVisibles.has(docStr) : true;
            });

            if (pacientesConNovedad.length === 0) {
                mostrarToastCopia("No hay novedades para copiar");
                return;
            }

            const lineas = pacientesConNovedad.map((p) => {
                const pkg = p.paquete || p.paqueteRaw || "CPF";
                const errText = [...(p.errores || []), ...(p.alertas || [])].join(" | ") || "Sin novedades";
                return `${p.documento} - ${pkg} - ${errText.trim()}`;
            });

            const textoFinal = lineas.join("\n");
            await copiarTextoAlPortapapeles(textoFinal);
            mostrarToastCopia(`${lineas.length} novedades copiadas`);

            const origHTML = btnCopiarTodas.innerHTML;
            btnCopiarTodas.innerHTML = `✓ ${lineas.length} Copiadas`;
            btnCopiarTodas.style.color = "#10b981";
            btnCopiarTodas.style.borderColor = "#10b981";
            setTimeout(() => {
                btnCopiarTodas.innerHTML = origHTML;
                btnCopiarTodas.style.color = "";
                btnCopiarTodas.style.borderColor = "";
            }, 2000);
        });
    }
    // Manejo del checkbox individual de omitir en cada fila
    if (tbody) {
        tbody.addEventListener("change", (e) => {
            const chk = e.target.closest(".btn-preval-omitir-chk");
            if (!chk) return;
            const doc = chk.getAttribute("data-doc");
            const tr = chk.closest("tr.preval-row");
            const omitir = chk.checked;

            if (tr) {
                if (omitir) {
                    tr.classList.add("fila-omitida");
                    tr.setAttribute("data-estado", "omitido");
                    const badge = tr.querySelector(".preval-cell-status");
                    if (badge) badge.innerHTML = `<span class="preval-badge omitido">🚫 Omitido</span>`;
                } else {
                    tr.classList.remove("fila-omitida");
                    const tieneErrores = tr.classList.contains("con-novedad");
                    const tieneAlertas = tr.classList.contains("con-alerta");
                    const estadoRecov = tieneErrores ? "novedades" : (tieneAlertas ? "alerta" : "conforme");
                    tr.setAttribute("data-estado", estadoRecov);
                    const badge = tr.querySelector(".preval-cell-status");
                    if (badge) {
                        badge.innerHTML = tieneErrores
                            ? `<span class="preval-badge error">✗ Novedades</span>`
                            : (tieneAlertas
                                ? `<span class="preval-badge warning">⚠️ Alerta</span>`
                                : `<span class="preval-badge success">✔ Conforme</span>`);
                    }
                }
            }

            if (typeof onToggleOmitirRegistro === "function") {
                onToggleOmitirRegistro(doc, omitir);
            }
        });
    }

    // Botón para abrir modal de gestión masiva de registros omitidos
    const btnModalOmitirReg = document.getElementById("btnModalOmitirRegistros");
    if (btnModalOmitirReg) {
        btnModalOmitirReg.addEventListener("click", () => {
            const btnSidebar = document.getElementById("btnOmitirRegistrosMatriz");
            if (btnSidebar) {
                btnSidebar.click();
            }
        });
    }

    // Botón para abrir configuración de omitir columnas desde el modal de prevalidación
    const btnModalOmitirColumnas = document.getElementById("btnModalOmitirColumnas");
    if (btnModalOmitirColumnas) {
        btnModalOmitirColumnas.addEventListener("click", () => {
            const btnSidebar = document.getElementById("btnOmitirColumnasMatriz");
            if (btnSidebar) {
                btnSidebar.click();
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
            ? `Se han detectado <strong style="color:#ef4444;">${totalConErrores} paciente(s) con novedades o inconsistencias</strong>. Por favor <strong>revisa los hallazgos en pantalla</strong>. Si todo está debidamente verificado y subsanado, <strong>descarga el Certificado PDF</strong> para adjuntarlo y reportarlo en tu entrega.`
            : (soloAlertas
                ? `Se han detectado <strong style="color:#f59e0b;">${totalConAlertas} paciente(s) con alertas informativas</strong>. Por favor revisa las observaciones y, si todo está correcto, <strong>descarga el Certificado PDF</strong> oficial para reportarlo.`
                : `Todos los <strong>${totalCarpetas} paciente(s)</strong> superaron la validación sin errores. Revisa el resultado final y <strong>descarga el Certificado PDF</strong> oficial para reportar tu radicación.`));

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
                ${!esMatriz ? `
                    <button type="button" class="btn-studio" style="padding: 7px 14px; font-size: 12px; font-weight: 600; background: linear-gradient(135deg, #0284c7, #0369a1); color: white; border: 1px solid #0284c7;" onclick="document.getElementById('modalAlertaFinalValidacionActivo')?.remove(); document.getElementById('btnDescargarPDF')?.click();">
                        Descargar Certificado PDF
                    </button>
                ` : ''}
                <button type="button" class="btn-studio btn-studio-ghost" style="padding: 7px 18px; font-size: 12px; font-weight: 600;" onclick="document.getElementById('modalAlertaFinalValidacionActivo')?.remove()">
                    ${esMatriz ? 'Entendido' : 'Revisar en Pantalla'}
                </button>
            </div>
        </div>
    `;

    document.body.appendChild(backdrop);
    backdrop.addEventListener("click", () => backdrop.remove());
}

/**
 * Cierra exactamente una ventana o popup activo por pulsación de la tecla Escape (de a una por vez)
 */
export function cerrarUnPopupActivoConEscape() {
    // 1. Modales de pantalla completa con backdrop (Prevalidación, Reglas, Alertas)
    const backdropModals = document.querySelectorAll(".modal-rules-backdrop, .modal-aviso-firmas-backdrop");
    if (backdropModals.length > 0) {
        const topBackdrop = backdropModals[backdropModals.length - 1];
        if (topBackdrop.id === "modalAvisoFirmasActivo") {
            const btn = topBackdrop.querySelector("#btnCerrarAvisoFirmas");
            if (btn && !btn.disabled) {
                btn.click();
                return true;
            }
        } else {
            topBackdrop.remove();
            return true;
        }
    }

    // 2. Visor de PDF si está abierto en pantalla
    const pdfModal = document.getElementById("pdfModal");
    if (pdfModal && pdfModal.style.display !== "none" && !pdfModal.classList.contains("oculto")) {
        if (typeof window.cerrarModal === "function") {
            window.cerrarModal();
        } else {
            pdfModal.style.display = "none";
        }
        return true;
    }

    // 3. Popovers flotantes individuales (Programado y Soportes)
    const progPopover = document.getElementById("programadoPopoverActivo");
    if (progPopover) {
        progPopover.remove();
        return true;
    }

    const archPopover = document.getElementById("archivosPopoverActivo");
    if (archPopover) {
        archPopover.remove();
        return true;
    }

    // 4. Modal Wiki / Ayuda
    const wikiContainer = document.getElementById("wikiContainer");
    if (wikiContainer && !wikiContainer.classList.contains("oculto")) {
        wikiContainer.classList.add("oculto");
        return true;
    }

    // 5. Cualquier otro popup genérico
    const otro = document.querySelector(".floating-popover-movable, .modal-rules-backdrop, .modal-aviso-firmas-backdrop");
    if (otro) {
        otro.remove();
        return true;
    }

    return false;
}

// Alias para compatibilidad
export const cerrarTodosLosPopupsYModales = cerrarUnPopupActivoConEscape;

/**
 * Solicita interactivamente el rango de periodos permitidos (Desde mes/año hasta mes/año)
 * Retorna una promesa que resuelve con { desde: "YYYY-MM", hasta: "YYYY-MM" } o null si cancela.
 */
export function solicitarPeriodoPermitidoModal({ desdeInicial = "", hastaInicial = "", sugerenciaNombre = "" } = {}) {
    return new Promise((resolve) => {
        // Eliminar modal previo si existe
        const prev = document.getElementById("periodoPermitidoModalOverlay");
        if (prev) prev.remove();

        const hoy = new Date();
        const fechaMesAnterior = new Date(hoy.getFullYear(), hoy.getMonth() - 1, 1);
        const aAntDefault = fechaMesAnterior.getFullYear();
        const mAntDefault = String(fechaMesAnterior.getMonth() + 1).padStart(2, "0");
        const defaultMes = `${aAntDefault}-${mAntDefault}`;

        const valorDesde = desdeInicial || defaultMes;
        const valorHasta = hastaInicial || desdeInicial || defaultMes;

        const overlay = document.createElement("div");
        overlay.id = "periodoPermitidoModalOverlay";
        overlay.className = "periodo-modal-overlay";

        overlay.innerHTML = `
            <div class="periodo-modal-box" role="dialog" aria-labelledby="periodoModalTitle">
                <div class="periodo-modal-header">
                    <span class="periodo-modal-title" id="periodoModalTitle">
                        <span>📅</span> Configurar Periodo Permitido
                    </span>
                    <button type="button" class="btn-wiki-action" id="btnCerrarPeriodoModal" title="Cerrar (Esc)">
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="width:14px;height:14px;"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
                    </button>
                </div>
                <div class="periodo-modal-body">
                    <p class="periodo-modal-desc">
                        Indica los meses autorizados para la facturación. Cualquier evolución o soporte médico fuera de este rango se marcará como <strong>error estricto</strong>.
                    </p>

                    <div class="periodo-grid-inputs">
                        <div class="periodo-input-group">
                            <label for="inputPeriodoDesde">Desde (Mes Inicial):</label>
                            <input type="month" id="inputPeriodoDesde" class="periodo-month-input" value="${valorDesde}" />
                        </div>
                        <div class="periodo-input-group">
                            <label for="inputPeriodoHasta">Hasta (Mes Final):</label>
                            <input type="month" id="inputPeriodoHasta" class="periodo-month-input" value="${valorHasta}" />
                        </div>
                    </div>

                    <div class="periodo-quick-shortcuts">
                        <span style="font-size:11px;color:var(--text-muted);align-self:center;">Atajos:</span>
                        <button type="button" class="btn-periodo-shortcut" id="btnPeriodoUnSoloMes">Mismo mes (Desde)</button>
                        <button type="button" class="btn-periodo-shortcut" id="btnPeriodoMesActual">Mes actual</button>
                        <button type="button" class="btn-periodo-shortcut" id="btnPeriodoMesAnterior">Mes anterior</button>
                        <button type="button" class="btn-periodo-shortcut" id="btnPeriodoSinLimite" title="Permitir todas las fechas sin marcar error">Sin restricción</button>
                    </div>
                </div>
                <div class="periodo-modal-footer">
                    <button type="button" class="btn-periodo-cancel" id="btnPeriodoCancelar">Cancelar</button>
                    <button type="button" class="btn-periodo-submit" id="btnPeriodoConfirmar">Continuar y Validar</button>
                </div>
            </div>
        `;

        document.body.appendChild(overlay);

        const inputDesde = overlay.querySelector("#inputPeriodoDesde");
        const inputHasta = overlay.querySelector("#inputPeriodoHasta");
        const btnCerrar = overlay.querySelector("#btnCerrarPeriodoModal");
        const btnCancelar = overlay.querySelector("#btnPeriodoCancelar");
        const btnConfirmar = overlay.querySelector("#btnPeriodoConfirmar");
        const btnUnSoloMes = overlay.querySelector("#btnPeriodoUnSoloMes");
        const btnMesActual = overlay.querySelector("#btnPeriodoMesActual");
        const btnMesAnterior = overlay.querySelector("#btnPeriodoMesAnterior");
        const btnSinLimite = overlay.querySelector("#btnPeriodoSinLimite");

        inputDesde.focus();

        const cerrarConRespuesta = (respuesta) => {
            overlay.remove();
            resolve(respuesta);
        };

        btnCerrar.addEventListener("click", () => cerrarConRespuesta(null));
        btnCancelar.addEventListener("click", () => cerrarConRespuesta(null));

        btnUnSoloMes.addEventListener("click", () => {
            if (inputDesde.value) {
                inputHasta.value = inputDesde.value;
            }
        });

        btnMesActual.addEventListener("click", () => {
            const aAct = hoy.getFullYear();
            const mAct = String(hoy.getMonth() + 1).padStart(2, "0");
            const mesActStr = `${aAct}-${mAct}`;
            inputDesde.value = mesActStr;
            inputHasta.value = mesActStr;
        });

        btnMesAnterior.addEventListener("click", () => {
            const fechaAnt = new Date(hoy.getFullYear(), hoy.getMonth() - 1, 1);
            const aAnt = fechaAnt.getFullYear();
            const mAnt = String(fechaAnt.getMonth() + 1).padStart(2, "0");
            const mesAntStr = `${aAnt}-${mAnt}`;
            inputDesde.value = mesAntStr;
            inputHasta.value = mesAntStr;
        });

        btnSinLimite.addEventListener("click", () => {
            inputDesde.value = "";
            inputHasta.value = "";
            cerrarConRespuesta({ desde: "", hasta: "" });
        });

        // Asegurar que si cambia "Desde" y "Hasta" es menor, se ajuste
        inputDesde.addEventListener("change", () => {
            if (inputHasta.value && inputDesde.value > inputHasta.value) {
                inputHasta.value = inputDesde.value;
            }
        });

        const confirmar = () => {
            let desde = inputDesde.value.trim();
            let hasta = inputHasta.value.trim();

            if (desde && hasta && desde > hasta) {
                // Invertir si el usuario puso al revés
                const temp = desde;
                desde = hasta;
                hasta = temp;
            }

            cerrarConRespuesta({ desde, hasta });
        };

        btnConfirmar.addEventListener("click", confirmar);

        // Teclado
        overlay.addEventListener("keydown", (e) => {
            if (e.key === "Enter") {
                e.preventDefault();
                confirmar();
            } else if (e.key === "Escape") {
                e.preventDefault();
                cerrarConRespuesta(null);
            }
        });
    });
}

/**
 * Modal para seleccionar y gestionar qué registros o filas de la matriz omitir en la validación
 */
export function solicitarRegistrosAOmitirModal(pacientesList, registrosOmitidosActuales = new Set()) {
    return new Promise((resolve) => {
        const modalId = "modalOmitirRegistrosMatrizActivo";
        const prev = document.getElementById(modalId);
        if (prev) prev.remove();

        const omitidosIniciales = new Set(
            Array.from(registrosOmitidosActuales || []).map((d) => String(d).trim().toUpperCase())
        );

        const overlay = document.createElement("div");
        overlay.id = modalId;
        overlay.className = "modal-rules-backdrop";
        overlay.style.zIndex = "2150";

        const lista = pacientesList || [];

        // Generar items individuales de pacientes
        const itemsHTML = lista
            .map((p, idx) => {
                const docNorm = String(p.documento || "").trim().toUpperCase();
                const isChecked = omitidosIniciales.has(docNorm);
                const pkg = p.paquete || p.paqueteRaw || "SIN_PAQUETE";
                return `
                    <label class="registro-omit-item ${isChecked ? 'active' : ''}" data-doc="${docNorm}" data-idx="${idx}">
                        <input type="checkbox" class="registro-omit-chk" value="${docNorm}" ${isChecked ? 'checked' : ''} />
                        <span class="col-omit-letra" style="font-size:10px;">#${p.filaExcel}</span>
                        <div class="col-omit-info">
                            <span class="col-omit-title">${p.documento || 'Sin doc'} - ${pkg}</span>
                            <span class="col-omit-sub">${p.nombre || 'Sin nombre'}</span>
                        </div>
                        <span class="col-omit-status-badge">${isChecked ? 'Omitido' : 'Activo'}</span>
                    </label>
                `;
            })
            .join("");

        overlay.innerHTML = `
            <div class="modal-rules-card modal-omit-card" onclick="event.stopPropagation()">
                <div class="modal-rules-header">
                    <div style="display:flex; align-items:center; gap:10px;">
                        <div class="preval-header-icon" style="background:rgba(239, 68, 68, 0.12); color:#ef4444;">
                            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="width:17px;height:17px;"><circle cx="12" cy="12" r="10"></circle><line x1="4.93" y1="4.93" x2="19.07" y2="19.07"></line></svg>
                        </div>
                        <div>
                            <h3 class="modal-rules-title">Omitir Registros / Filas de la Matriz</h3>
                            <p class="modal-rules-subtitle">Selecciona los pacientes que deseas ignorar para no exigir soportes ni auditarlos</p>
                        </div>
                    </div>
                    <button type="button" class="modal-rules-close" id="btnCerrarModalOmitirReg">&times;</button>
                </div>

                <div class="modal-omit-body">
                    <div class="modal-omit-hint">
                        💡 <strong>¿Cómo funciona?</strong> Los pacientes o filas que marques como <em>Omitidos</em> no generarán faltantes de soporte en la auditoría y quedarán excluidos de los reportes.
                    </div>

                    <!-- Pegado en lote de cédulas -->
                    <div style="display:flex; flex-direction:column; gap:6px;">
                        <label style="font-size:11px; font-weight:700; color:var(--text-secondary); text-transform:uppercase;">
                            Pegar Cédulas a Omitir en Lote (separadas por coma, espacio o salto de línea):
                        </label>
                        <div style="display:flex; gap:8px;">
                            <textarea id="txtLoteCedulasOmitir" class="registro-omit-textarea" placeholder="Ejemplo: 10234567, 79456123, 52987412"></textarea>
                        </div>
                        <div style="display:flex; gap:8px; align-items:center; flex-wrap:wrap;">
                            <button type="button" class="btn-subtle-pill" id="btnProcesarLoteCedulas">Procesar Cédulas Pegadas</button>
                            <button type="button" class="btn-subtle-pill" id="btnDesmarcarTodosReg">Limpiar Omitidos (Incluir Todos)</button>
                            <span style="font-size:11px; color:var(--text-muted);" id="lblFeedbackLote"></span>
                        </div>
                    </div>

                    <div style="display:flex; justify-content:space-between; align-items:center; margin-top:6px;">
                        <span style="font-size:11.5px; font-weight:700; color:var(--text-pure);">Listado de Pacientes en Matriz:</span>
                        <input type="text" id="filtroRegistroOmitirInput" class="studio-search-input" placeholder="Buscar cédula o nombre..." style="width:200px;" />
                    </div>

                    <div class="modal-omit-grid" id="contenedorOmitirRegistros" style="max-height: 260px;">
                        ${itemsHTML}
                    </div>
                </div>

                <div class="modal-rules-footer" style="display:flex; justify-content:space-between; align-items:center;">
                    <span class="omit-selected-count" id="lblConteoRegistrosOmitidos">0 registros omitidos</span>
                    <div style="display:flex; gap:8px;">
                        <button type="button" class="btn-studio btn-studio-ghost" id="btnCancelarOmitirReg">Cancelar</button>
                        <button type="button" class="btn-studio btn-studio-primary" id="btnAplicarOmitirReg">Guardar y Aplicar</button>
                    </div>
                </div>
            </div>
        `;

        document.body.appendChild(overlay);

        const contenedor = overlay.querySelector("#contenedorOmitirRegistros");
        const lblConteo = overlay.querySelector("#lblConteoRegistrosOmitidos");
        const filtroInput = overlay.querySelector("#filtroRegistroOmitirInput");
        const txtLote = overlay.querySelector("#txtLoteCedulasOmitir");
        const btnProcesarLote = overlay.querySelector("#btnProcesarLoteCedulas");
        const lblFeedback = overlay.querySelector("#lblFeedbackLote");

        const actualizarConteoYEstilos = () => {
            const checks = overlay.querySelectorAll(".registro-omit-chk");
            let count = 0;
            checks.forEach((chk) => {
                const parent = chk.closest(".registro-omit-item");
                const badge = parent?.querySelector(".col-omit-status-badge");
                if (chk.checked) {
                    count++;
                    parent?.classList.add("active");
                    if (badge) badge.textContent = "Omitido";
                } else {
                    parent?.classList.remove("active");
                    if (badge) badge.textContent = "Activo";
                }
            });
            if (lblConteo) {
                lblConteo.textContent = `${count} registro(s) omitido(s)`;
            }
        };

        actualizarConteoYEstilos();

        // Cambio individual
        contenedor?.addEventListener("change", (e) => {
            if (e.target && e.target.classList.contains("registro-omit-chk")) {
                actualizarConteoYEstilos();
            }
        });

        // Filtrado en tiempo real
        filtroInput?.addEventListener("input", (e) => {
            const q = (e.target.value || "").toLowerCase().trim();
            const items = overlay.querySelectorAll(".registro-omit-item");
            items.forEach((it) => {
                const text = it.textContent.toLowerCase();
                it.style.display = !q || text.includes(q) ? "" : "none";
            });
        });

        // Procesar lote pegado
        btnProcesarLote?.addEventListener("click", () => {
            const raw = txtLote?.value || "";
            const matches = raw.match(/\w+/g) || [];
            if (matches.length === 0) {
                if (lblFeedback) lblFeedback.textContent = "No se encontraron cédulas para procesar.";
                return;
            }
            const setDocs = new Set(matches.map((m) => m.toUpperCase().trim()));
            let marcados = 0;
            overlay.querySelectorAll(".registro-omit-chk").forEach((chk) => {
                const val = (chk.value || "").toUpperCase().trim();
                const numOnly = val.replace(/\D/g, "");
                if (setDocs.has(val) || (numOnly && setDocs.has(numOnly))) {
                    chk.checked = true;
                    marcados++;
                }
            });
            actualizarConteoYEstilos();
            if (lblFeedback) {
                lblFeedback.textContent = `✓ ${marcados} paciente(s) marcados como omitidos`;
                lblFeedback.style.color = "#10b981";
            }
        });

        // Desmarcar todos
        overlay.querySelector("#btnDesmarcarTodosReg")?.addEventListener("click", () => {
            overlay.querySelectorAll(".registro-omit-chk").forEach((chk) => (chk.checked = false));
            actualizarConteoYEstilos();
            if (lblFeedback) lblFeedback.textContent = "Todos los pacientes están activos.";
        });

        const cerrarCon = (resultado) => {
            overlay.remove();
            resolve(resultado);
        };

        overlay.querySelector("#btnCerrarModalOmitirReg")?.addEventListener("click", () => cerrarCon(null));
        overlay.querySelector("#btnCancelarOmitirReg")?.addEventListener("click", () => cerrarCon(null));
        overlay.addEventListener("click", (e) => {
            if (e.target === overlay) cerrarCon(null);
        });

        overlay.querySelector("#btnAplicarOmitirReg")?.addEventListener("click", () => {
            const checks = overlay.querySelectorAll(".registro-omit-chk:checked");
            const seleccionadas = new Set(Array.from(checks).map((chk) => chk.value.toUpperCase().trim()));
            cerrarCon(seleccionadas);
        });
    });
}

/**
 * Abre un modal interactivo para seleccionar qué columnas omitir de la matriz
 * @param {Array<Object>} columnasDisponibles [{ key, label, colIdx, letra, defaultOmitir }]
 * @param {Set<string>|Array<string>} columnasOmitidasActuales Claves actualmente omitidas
 * @returns {Promise<Set<string>|null>} Devuelve Set con las claves a omitir o null si canceló
 */
export function solicitarColumnasAOmitirModal(columnasDisponibles, columnasOmitidasActuales = []) {
    return new Promise((resolve) => {
        const modalId = "modalOmitirColumnasMatrizActivo";
        const prev = document.getElementById(modalId);
        if (prev) prev.remove();

        const omitidasIniciales = new Set(
            (columnasOmitidasActuales || []).map((k) => String(k).toUpperCase())
        );

        const overlay = document.createElement("div");
        overlay.id = modalId;
        overlay.className = "modal-rules-backdrop";
        overlay.style.zIndex = "2150";

        // Generar items de columnas
        const itemsHTML = columnasDisponibles
            .map((col) => {
                const isChecked = omitidasIniciales.has(col.key.toUpperCase());
                return `
                    <label class="col-omit-item ${isChecked ? 'active' : ''}" data-key="${col.key}">
                        <input type="checkbox" class="col-omit-checkbox" value="${col.key}" ${isChecked ? 'checked' : ''} />
                        <span class="col-omit-letra">${col.letra}</span>
                        <div class="col-omit-info">
                            <span class="col-omit-title">${col.label}</span>
                            <span class="col-omit-sub">Clave: ${col.key}</span>
                        </div>
                        <span class="col-omit-status-badge">${isChecked ? 'Omitida' : 'Incluida'}</span>
                    </label>
                `;
            })
            .join("");

        overlay.innerHTML = `
            <div class="modal-rules-card modal-omit-card" onclick="event.stopPropagation()">
                <div class="modal-rules-header">
                    <div style="display:flex; align-items:center; gap:10px;">
                        <div class="preval-header-icon" style="background:rgba(239, 68, 68, 0.12); color:#ef4444;">
                            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="width:17px;height:17px;"><circle cx="12" cy="12" r="10"></circle><line x1="4.93" y1="4.93" x2="19.07" y2="19.07"></line></svg>
                        </div>
                        <div>
                            <h3 class="modal-rules-title">Omitir Columnas de la Matriz</h3>
                            <p class="modal-rules-subtitle">Selecciona los servicios o columnas que deseas ignorar en la auditoría</p>
                        </div>
                    </div>
                    <button type="button" class="modal-rules-close" id="btnCerrarModalOmitir">&times;</button>
                </div>

                <div class="modal-omit-body">
                    <div class="modal-omit-hint">
                        💡 <strong>¿Cómo funciona?</strong> Las columnas que marques como <em>Omitidas</em> no generarán alertas de soporte faltante ni causarán inconsistencias en las reglas de cantidad de la matriz.
                    </div>

                    <div class="modal-omit-actions-bar">
                        <button type="button" class="btn-subtle-pill" id="btnMarcarTodasOmitir">Omitir Todas</button>
                        <button type="button" class="btn-subtle-pill" id="btnRestablecerOmitir">Restablecer (Solo Geriatría)</button>
                        <button type="button" class="btn-subtle-pill" id="btnDesmarcarTodasOmitir">Incluir Todas</button>
                    </div>

                    <div class="modal-omit-grid" id="contenedorOmitirColumnas">
                        ${itemsHTML}
                    </div>
                </div>

                <div class="modal-rules-footer" style="display:flex; justify-content:space-between; align-items:center;">
                    <span class="omit-selected-count" id="lblConteoOmitidas">0 columnas omitidas</span>
                    <div style="display:flex; gap:8px;">
                        <button type="button" class="btn-studio btn-studio-ghost" id="btnCancelarOmitir">Cancelar</button>
                        <button type="button" class="btn-studio btn-studio-primary" id="btnAplicarOmitir">Aplicar y Revalidar</button>
                    </div>
                </div>
            </div>
        `;

        document.body.appendChild(overlay);

        const contenedor = overlay.querySelector("#contenedorOmitirColumnas");
        const lblConteo = overlay.querySelector("#lblConteoOmitidas");

        const actualizarConteoYEstilos = () => {
            const checks = overlay.querySelectorAll(".col-omit-checkbox");
            let count = 0;
            checks.forEach((chk) => {
                const parent = chk.closest(".col-omit-item");
                const badge = parent?.querySelector(".col-omit-status-badge");
                if (chk.checked) {
                    count++;
                    parent?.classList.add("active");
                    if (badge) badge.textContent = "Omitida";
                } else {
                    parent?.classList.remove("active");
                    if (badge) badge.textContent = "Incluida";
                }
            });
            if (lblConteo) {
                lblConteo.textContent = `${count} columna(s) omitida(s)`;
            }
        };

        actualizarConteoYEstilos();

        // Cambio en checkboxes
        contenedor?.addEventListener("change", (e) => {
            if (e.target && e.target.classList.contains("col-omit-checkbox")) {
                actualizarConteoYEstilos();
            }
        });

        // Botones de lote
        overlay.querySelector("#btnMarcarTodasOmitir")?.addEventListener("click", () => {
            overlay.querySelectorAll(".col-omit-checkbox").forEach((chk) => (chk.checked = true));
            actualizarConteoYEstilos();
        });

        overlay.querySelector("#btnDesmarcarTodasOmitir")?.addEventListener("click", () => {
            overlay.querySelectorAll(".col-omit-checkbox").forEach((chk) => (chk.checked = false));
            actualizarConteoYEstilos();
        });

        overlay.querySelector("#btnRestablecerOmitir")?.addEventListener("click", () => {
            columnasDisponibles.forEach((col) => {
                const chk = overlay.querySelector(`.col-omit-checkbox[value="${col.key}"]`);
                if (chk) chk.checked = col.defaultOmitir;
            });
            actualizarConteoYEstilos();
        });

        const cerrarCon = (resultado) => {
            overlay.remove();
            resolve(resultado);
        };

        overlay.querySelector("#btnCerrarModalOmitir")?.addEventListener("click", () => cerrarCon(null));
        overlay.querySelector("#btnCancelarOmitir")?.addEventListener("click", () => cerrarCon(null));
        overlay.addEventListener("click", (e) => {
            if (e.target === overlay) cerrarCon(null);
        });

        overlay.querySelector("#btnAplicarOmitir")?.addEventListener("click", () => {
            const checks = overlay.querySelectorAll(".col-omit-checkbox:checked");
            const seleccionadas = new Set(Array.from(checks).map((chk) => chk.value.toUpperCase()));
            cerrarCon(seleccionadas);
        });
    });
}

/**
 * Muestra el modal para pegar una fila copiada de la matriz Excel/CSV
 * Organiza en tiempo real mostrando los títulos de cada columna.
 * @param {string} [textoInicial=""]
 * @returns {Promise<string|null>} Retorna el texto pegado o null si se cancela
 */
export function solicitarFilaMatrizPegadaModal(textoInicial = "") {
    return new Promise((resolve) => {
        const modalId = "modalPegarFilaMatriz";
        const prev = document.getElementById(modalId);
        if (prev) prev.remove();

        const overlay = document.createElement("div");
        overlay.id = modalId;
        overlay.className = "modal-rules-backdrop";
        overlay.style.zIndex = "2200";

        const TITULOS_COLUMNAS_MATRIZ = [
            "Tipo doc",
            "Documento Paciente",
            "Nombre Completo Del Paciente",
            "Paquete",
            "Facturar por evento",
            "Cant Paquete Diario",
            "Paq. Médica General",
            "Paq. Enfermería Profesional",
            "Paq. Aux Enfermeria",
            "Paq. Terapia Física",
            "Paq. Terapia Respiratoria",
            "Paq. Terapia Respiratoria Con Succión",
            "Paq. Fonoaudiología",
            "Paq. Terapia Ocupacional",
            "Paq. Nutrición",
            "Paq. Trabajo Social",
            "Paq. Psicología",
            "Paq. Aplicación Medicamento 1 Dosis",
            "Paq. Aplicación Medicamento 2 Dosis",
            "Paq. Aplicación Medicamento 3 Dosis",
            "Paq. Aplicación Medicamento 4 Dosis",
            "Paq. Cambio de Sonda",
            "Paq. Curacion De Herida Grado III - Complejidad Alta",
            "Paq. Curacion De Herida Grado II - Complejidad Media",
            "Paq. Curacion De Herida Grado I - Complejidad Baja",
            "Eve. Médica General",
            "Eve. Médica General Riesgo Juridico",
            "Eve. Turno Enfermería 6 Horas",
            "Eve. Turno Enfermería 8 Horas",
            "Eve. Turno Enfermería 12 Horas",
            "Eve. Turno Enfermería 12 Horas Nocturno",
            "Eve. Turno Enfermería 24 Horas",
            "Eve. Turno Cuidador 6 Horas",
            "Eve. Turno Cuidador 8 Horas",
            "Eve. Turno Cuidador 12 Horas",
            "Eve. Turno Cuidador 12 Horas Nocturno",
            "Eve. Turno Cuidador 24 Horas",
            "Eve. Trabajo Social",
            "Observaciones PAD",
            "Observaciones Facturación",
            "Factura Paquete",
            "Factura Eventos",
            "Estado Paquete",
            "Estado Evento",
            "Observación Soft"
        ];

        overlay.innerHTML = `
            <div class="modal-rules-card" style="max-width: 1100px; width: 96%; max-height: 94vh; display:flex; flex-direction:column; box-shadow: var(--shadow-modal);" onclick="event.stopPropagation()">
                <div class="modal-rules-header" style="padding: 12px 18px;">
                    <div style="display:flex; align-items:center; gap:10px;">
                        <div class="preval-header-icon" style="background:rgba(37, 99, 235, 0.12); color:#2563eb;">
                            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="width:18px;height:18px;"><path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2"></path><rect x="8" y="2" width="8" height="4" rx="1" ry="1"></rect></svg>
                        </div>
                        <div>
                            <h3 class="modal-rules-title" style="margin:0; font-size:15px;">Validar con Fila Individual de Matriz</h3>
                            <p class="modal-rules-subtitle" style="margin:2px 0 0; font-size:11.5px;">Pega los datos de la fila de Excel para organizarlos automáticamente en la estructura de 45 columnas</p>
                        </div>
                    </div>
                    <button type="button" class="modal-rules-close" id="btnCerrarModalPegarFila">&times;</button>
                </div>

                <div class="modal-rules-body" style="padding:12px 18px; overflow-y:auto; display:flex; flex-direction:column; gap:8px;">
                    <div style="display:flex; flex-direction:column; gap:4px;">
                        <div style="display:flex; justify-content:space-between; align-items:center;">
                            <label for="txtFilaMatrizPegada" style="font-size:11px; font-weight:700; text-transform:uppercase; letter-spacing:0.4px; color:var(--text-muted);">
                                Fila copiada de Excel:
                            </label>
                            <span id="filaColsCounter" style="font-size:11px; font-weight:600; color:var(--text-muted);">0 columnas detectadas</span>
                        </div>
                        <textarea id="txtFilaMatrizPegada" class="form-control" rows="2" placeholder="Pega aquí (Ctrl+V) la fila copiada de Excel..." style="width:100%; font-family:monospace; font-size:11px; padding:6px 10px; border-radius:6px; border:1px solid var(--border-subtle, #cbd5e1); background:var(--bg-card, #fff); color:var(--text-primary); resize:vertical;">${textoInicial}</textarea>
                    </div>

                    <!-- Vista previa en vivo organizada horizontalmente con los títulos -->
                    <div id="contenedorOrganizadoMatriz" style="display:none; flex-direction:column; gap:6px;">
                        <div style="font-size:11px; font-weight:800; text-transform:uppercase; letter-spacing:0.4px; color:var(--accent, #2563eb); display:flex; align-items:center; justify-content:space-between;">
                            <span>✨ Matriz Organizada Horizontalmente (45 Columnas):</span>
                            <span style="font-size:10.5px; font-weight:600; color:var(--text-muted);">Desplaza la barra inferior para revisar todas las columnas &rarr;</span>
                        </div>
                        <div id="tablaOrganizadaPreview" style="max-height: 280px; overflow-x: scroll; overflow-y: auto; border: 1px solid var(--border-subtle, #94a3b8); border-radius: 6px; background: var(--bg-card, #fff); box-shadow: inset 0 1px 3px rgba(0,0,0,0.08); padding-bottom: 2px;">
                            <!-- Se rellena dinámicamente -->
                        </div>
                    </div>

                    <div id="pegarFilaFeedback" style="font-size:11.5px; color:#ef4444; min-height:14px;"></div>
                </div>

                <div class="modal-rules-footer" style="display:flex; justify-content:space-between; align-items:center; padding:10px 18px; border-top:1px solid var(--border-subtle, #e2e8f0); background:var(--bg-subtle, #f8fafc); border-radius:0 0 10px 10px;">
                    <button type="button" class="btn-studio btn-studio-ghost" id="btnCancelarPegarFila" style="font-size:11.5px;">Cancelar</button>
                    <button type="button" class="btn-studio btn-studio-primary" id="btnProcesarFilaMatriz" style="font-size:11.5px;">
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="width:13px;height:13px;"><polyline points="20 6 9 17 4 12"></polyline></svg>
                        <span>Confirmar y Validar Paciente</span>
                    </button>
                </div>
            </div>
        `;

        document.body.appendChild(overlay);

        const textarea = overlay.querySelector("#txtFilaMatrizPegada");
        const feedback = overlay.querySelector("#pegarFilaFeedback");
        const colsCounter = overlay.querySelector("#filaColsCounter");
        const contenedorOrganizado = overlay.querySelector("#contenedorOrganizadoMatriz");
        const tablaPreview = overlay.querySelector("#tablaOrganizadaPreview");

        const actualizarOrganizacionEnVivo = () => {
            const raw = textarea ? textarea.value.trim() : "";
            if (!raw) {
                if (contenedorOrganizado) contenedorOrganizado.style.display = "none";
                if (colsCounter) colsCounter.textContent = "0 columnas detectadas";
                if (feedback) feedback.textContent = "";
                return;
            }

            const lineas = raw.split(/\r?\n/).filter(l => l.trim().length > 0);
            let linea = lineas[0] || "";
            if (lineas.length > 1) {
                const l0 = lineas[0].toLowerCase();
                if (l0.includes("documento") || l0.includes("tipo doc") || l0.includes("paciente")) {
                    linea = lineas[1];
                }
            }

            let celdas = [];
            if (linea.includes("\t")) {
                celdas = linea.split("\t");
            } else if (linea.includes(";")) {
                celdas = linea.split(";");
            } else if (linea.includes(",")) {
                celdas = linea.split(",");
            } else {
                celdas = linea.split(/\s{2,}/);
            }

            celdas = celdas.map(c => String(c ?? "").trim());

            if (colsCounter) {
                colsCounter.textContent = `${celdas.length} columnas detectadas (de ${TITULOS_COLUMNAS_MATRIZ.length} oficiales)`;
            }

            if (celdas.length >= 2) {
                if (contenedorOrganizado) contenedorOrganizado.style.display = "flex";
                if (feedback) feedback.textContent = "";

                // Generar tabla horizontal tipo Excel con encabezados coloreados según el formato oficial
                let thsHTML = "";
                let tdsHTML = "";

                // Paleta de colores idéntica a la imagen del Excel FOMAG
                const obtenerEstiloColumna = (idx) => {
                    if (idx === 0) return { bg: "#fed7aa", color: "#7c2d12", vertical: true, minWidth: "38px" }; // Tipo doc (vertical)
                    if (idx >= 1 && idx <= 2) return { bg: "#fed7aa", color: "#7c2d12", vertical: false, minWidth: "140px" }; // Doc, Nombre (horizontal)
                    if (idx === 3) return { bg: "#86efac", color: "#14532d", vertical: false, minWidth: "220px", maxWidth: "260px" }; // Paquete (ancho contenido)
                    if (idx === 4) return { bg: "#60a5fa", color: "#1e3a8a", vertical: true, minWidth: "34px" }; // Facturar por evento
                    if (idx === 5) return { bg: "#c4b5fd", color: "#4c1d95", vertical: true, minWidth: "34px" }; // Cant Paquete Diario
                    if (idx >= 6 && idx <= 8) return { bg: "#bae6fd", color: "#0369a1", vertical: true, minWidth: "34px" }; // Med, Enf prof, Aux enf
                    if (idx >= 9 && idx <= 13) return { bg: "#fef08a", color: "#854d0e", vertical: true, minWidth: "34px" }; // Terapias
                    if (idx >= 14 && idx <= 16) return { bg: "#bbf7d0", color: "#166534", vertical: true, minWidth: "34px" }; // Nut, TS, Psi
                    if (idx >= 17 && idx <= 20) return { bg: "#a7f3d0", color: "#065f46", vertical: true, minWidth: "34px" }; // APL 1-4 dosis
                    if (idx >= 21 && idx <= 24) return { bg: "#99f6e4", color: "#115e59", vertical: true, minWidth: "34px" }; // Sonda, Curaciones
                    if (idx >= 25 && idx <= 26) return { bg: "#93c5fd", color: "#1e40af", vertical: true, minWidth: "34px" }; // Eve Med
                    if (idx >= 27 && idx <= 31) return { bg: "#bfdbfe", color: "#1d4ed8", vertical: true, minWidth: "34px" }; // Turnos enf
                    if (idx >= 32 && idx <= 36) return { bg: "#fed7aa", color: "#c2410c", vertical: true, minWidth: "34px" }; // Cuidadores
                    if (idx === 37) return { bg: "#fef08a", color: "#854d0e", vertical: true, minWidth: "34px" }; // Eve TS
                    return { bg: "#e2e8f0", color: "#334155", vertical: false, minWidth: "120px" }; // Observaciones y facturas
                };

                TITULOS_COLUMNAS_MATRIZ.forEach((titulo, idx) => {
                    const val = celdas[idx] !== undefined ? celdas[idx] : "";
                    const tieneValor = val !== "";
                    const estilo = obtenerEstiloColumna(idx);

                    let thInner = "";
                    if (estilo.vertical) {
                        thInner = `
                            <div style="writing-mode: vertical-rl; transform: rotate(180deg); height: 165px; white-space: nowrap; font-size: 10.5px; font-weight: 600; line-height: 1.1; margin: auto; display: flex; align-items: center; justify-content: flex-start; text-transform: none; letter-spacing: -0.2px;">
                                ${titulo}
                            </div>
                        `;
                    } else {
                        thInner = `
                            <div style="font-size: 11px; font-weight: 700; line-height: 1.25; text-transform: none; text-align: left; padding: 4px;">
                                ${titulo}
                            </div>
                        `;
                    }

                    const minW = estilo.minWidth || "34px";
                    const maxW = estilo.maxWidth ? `max-width: ${estilo.maxWidth};` : "";

                    thsHTML += `
                        <th style="padding: 6px 4px; background: ${estilo.bg}; color: ${estilo.color}; border: 1px solid #cbd5e1; vertical-align: bottom; min-width: ${minW}; ${maxW}">
                            ${thInner}
                        </th>
                    `;

                    const valTexto = tieneValor ? val : "";
                    const tdColor = tieneValor ? "font-weight: 700; color: #0f172a; background: #ffffff;" : "background: #f8fafc; color: #94a3b8;";
                    const tdAlign = estilo.vertical ? "text-align: center;" : "text-align: left;";
                    const tdOverflow = estilo.maxWidth ? "overflow: hidden; text-overflow: ellipsis; white-space: nowrap;" : "white-space: nowrap;";

                    tdsHTML += `
                        <td title="${valTexto}" style="padding: 6px 6px; font-size: 11px; font-family: monospace; border: 1px solid #cbd5e1; min-width: ${minW}; ${maxW} ${tdAlign} ${tdColor} ${tdOverflow}">
                            ${valTexto}
                        </td>
                    `;
                });

                if (tablaPreview) {
                    tablaPreview.innerHTML = `
                        <table style="border-collapse: collapse; min-width: 100%; border: 1px solid #94a3b8;">
                            <thead>
                                <tr>${thsHTML}</tr>
                            </thead>
                            <tbody>
                                <tr>${tdsHTML}</tr>
                            </tbody>
                        </table>
                    `;
                }
            } else {
                if (contenedorOrganizado) contenedorOrganizado.style.display = "none";
            }
        };

        if (textarea) {
            textarea.addEventListener("input", actualizarOrganizacionEnVivo);
            textarea.addEventListener("paste", () => setTimeout(actualizarOrganizacionEnVivo, 50));
            setTimeout(() => {
                textarea.focus();
                if (textoInicial) actualizarOrganizacionEnVivo();
            }, 80);
        }

        const cerrarCon = (val) => {
            overlay.remove();
            resolve(val);
        };

        overlay.querySelector("#btnCerrarModalPegarFila")?.addEventListener("click", () => cerrarCon(null));
        overlay.querySelector("#btnCancelarPegarFila")?.addEventListener("click", () => cerrarCon(null));
        overlay.addEventListener("click", (e) => {
            if (e.target === overlay) cerrarCon(null);
        });

        overlay.querySelector("#btnProcesarFilaMatriz")?.addEventListener("click", () => {
            const val = textarea ? textarea.value.trim() : "";
            if (!val) {
                if (feedback) feedback.textContent = "Por favor pega la fila de datos antes de continuar.";
                return;
            }
            cerrarCon(val);
        });
    });
}

/**
 * Inicializa el listener global para cerrar de a una ventana con la tecla Escape
 */
export function inicializarCierrePorEscape() {
    if (window._escapeListenerInit) return;
    window._escapeListenerInit = true;

    document.addEventListener("keydown", (e) => {
        if (e.key === "Escape" || e.keyCode === 27) {
            cerrarUnPopupActivoConEscape();
        }
    });
}

// Auto-inicializar el listener al importar
inicializarCierrePorEscape();



