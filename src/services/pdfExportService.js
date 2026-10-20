/**
 * Servicio para generación de Certificado y Resumen Ejecutivo en PDF
 * Utiliza html2pdf.js con carga dinámica o impresión nativa de alta fidelidad.
 */

export async function cargarHtml2Pdf() {
    if (window.html2pdf) return true;
    const urls = [
        "https://cdnjs.cloudflare.com/ajax/libs/html2pdf.js/0.10.1/html2pdf.bundle.min.js",
        "https://cdn.jsdelivr.net/npm/html2pdf.js@0.10.1/dist/html2pdf.bundle.min.js"
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
            if (window.html2pdf) return true;
        } catch (e) {
            console.warn("Fallo cargar html2pdf desde:", url, e);
        }
    }
    return false;
}

/**
 * Clasifica si un error es crítico (bloqueante) o una alerta informativa / posible falso positivo
 */
export function categorizarNaturalezaError(tipoOriginal, detalle = "") {
    const texto = `${tipoOriginal} ${detalle}`.toLowerCase();

    // Alertas o variaciones de texto que no son glosas reales
    if (
        texto.includes("cabecera") ||
        texto.includes("titulo") ||
        texto.includes("no figura en la matriz") ||
        texto.includes("no se encuentra programado en la matriz") ||
        texto.includes("alerta") ||
        texto.includes("variante")
    ) {
        return {
            categoria: "Alerta / Cotejo Manual",
            esCritico: false,
            badgeClass: "badge-alerta",
            accion: "Verificar con facturación o visto bueno del auditor (posible adición o variante admitida)"
        };
    }

    // Errores críticos que generan glosa obligatoria
    return {
        categoria: "Error Crítico",
        esCritico: true,
        badgeClass: "badge-critico",
        accion: "Corregir soporte clínico, adjuntar PDF faltante o ajustar cantidad facturada antes de enviar"
    };
}

/**
 * Genera el HTML enriquecido para el Certificado de Auditoría en PDF
 */
export function construirHTMLReporte({
    resultados,
    convenio = "FOMAG",
    tipoValidacion = "paquete",
    nombreMatriz = "No adjunta",
    auditor = "Auditor General"
}) {
    const carpetas = Object.keys(resultados || {});
    const totalCuentas = carpetas.length;

    let cuentasAprobadas = 0;
    let cuentasConNovedad = 0;
    let totalArchivosPDF = 0;
    let totalCriticos = 0;
    let totalAlertas = 0;

    // Métricas por Paquete (CPF)
    const porPaquete = {};
    // Frecuencia por Tipo de Error
    const porTipoError = {};
    // Cuentas con observaciones
    const detalleCuentas = [];

    carpetas.forEach((carp) => {
        const r = resultados[carp];
        const paquete = r.tipoPaquete || "CPF1108";
        
        // Contar PDFs
        let pdfsEnCarpeta = 0;
        Object.values(r.pdfsPorServicio || {}).forEach(srvPdfs => {
            pdfsEnCarpeta += Object.keys(srvPdfs || {}).length;
        });
        totalArchivosPDF += pdfsEnCarpeta;

        if (!porPaquete[paquete]) {
            porPaquete[paquete] = { total: 0, aprobadas: 0, conError: 0, nombre: r.paqueteInfo?.nombre || paquete };
        }
        porPaquete[paquete].total++;

        // Consolidar errores y alertas
        const errsGen = [...(r.errores || []), ...(r.erroresPorServicio?.["General"] || [])];
        const alertsGen = [...(r.alertas || []), ...(r.alertasPorServicio?.["General"] || [])];
        
        const tieneErrores = errsGen.length > 0 || Object.entries(r.erroresPorServicio || {}).some(([s, arr]) => s !== "General" && arr.length > 0);
        const tieneAlertas = alertsGen.length > 0 || Object.entries(r.alertasPorServicio || {}).some(([s, arr]) => s !== "General" && arr.length > 0);

        if (tieneErrores || tieneAlertas) {
            cuentasConNovedad++;
            porPaquete[paquete].conError++;

            const docLimpio = r.nroDocumento || carp.replace(/^(\d+).*/, "$1") || carp;

            // Extraer detalle por servicio
            const agregarHallazgo = (srv, mensaje, esAlerta = false) => {
                const nat = categorizarNaturalezaError(srv, mensaje);
                if (nat.esCritico) totalCriticos++;
                else totalAlertas++;

                // Agrupar en porTipoError
                const claveError = srv === "General" ? "Inconsistencia de Paquete / Matriz" : `Soporte ${srv}`;
                if (!porTipoError[claveError]) {
                    porTipoError[claveError] = {
                        frecuencia: 0,
                        categoria: nat.categoria,
                        badgeClass: nat.badgeClass,
                        accion: nat.accion,
                        ejemplo: mensaje
                    };
                }
                porTipoError[claveError].frecuencia++;

                detalleCuentas.push({
                    documento: docLimpio,
                    paquete,
                    servicio: srv,
                    hallazgo: mensaje,
                    dictamen: nat.esCritico ? "Rechazo: Subsanar antes de enviar" : "Observación / Cotejar"
                });
            };

            errsGen.forEach(e => agregarHallazgo("General", e, false));
            alertsGen.forEach(a => agregarHallazgo("General", a, true));

            Object.entries(r.erroresPorServicio || {}).forEach(([srv, arr]) => {
                if (srv !== "General") arr.forEach(e => agregarHallazgo(srv, e, false));
            });
            Object.entries(r.alertasPorServicio || {}).forEach(([srv, arr]) => {
                if (srv !== "General") arr.forEach(a => agregarHallazgo(srv, a, true));
            });

        } else {
            cuentasAprobadas++;
            porPaquete[paquete].aprobadas++;
        }
    });

    const porcentajeExito = totalCuentas > 0 ? ((cuentasAprobadas / totalCuentas) * 100).toFixed(1) : "0";
    const estadoAprobado = cuentasConNovedad === 0;
    const fechaHora = new Date().toLocaleString("es-CO", { dateStyle: "short", timeStyle: "medium" });

    // Filas de paquetes
    const filasPaquetesHTML = Object.entries(porPaquete).map(([cod, p]) => {
        const pct = p.total > 0 ? ((p.aprobadas / p.total) * 100).toFixed(1) : "0";
        const barColor = parseFloat(pct) >= 90 ? "#10b981" : parseFloat(pct) >= 70 ? "#f59e0b" : "#ef4444";
        return `
            <tr>
                <td><span class="badge badge-pkg font-mono">${cod}</span></td>
                <td><b>${p.nombre || cod}</b></td>
                <td class="text-center font-mono"><b>${p.total}</b></td>
                <td class="text-center font-mono" style="color:#16a34a; font-weight:700;">${p.aprobadas}</td>
                <td class="text-center font-mono" style="color:#dc2626; font-weight:700;">${p.conError}</td>
                <td>
                    <div style="display:flex; justify-content:space-between; font-size:8px; font-weight:700;"><span>${pct}%</span></div>
                    <div class="mini-progress"><div class="mini-progress-fill" style="width: ${pct}%; background:${barColor};"></div></div>
                </td>
            </tr>
        `;
    }).join("");

    // Filas de clasificación de errores
    const filasErroresHTML = Object.entries(porTipoError).map(([tipo, inf]) => `
        <tr>
            <td><b>${tipo}</b></td>
            <td><span class="badge ${inf.badgeClass}">${inf.categoria}</span></td>
            <td>${inf.ejemplo}</td>
            <td class="text-center font-mono"><b>${inf.frecuencia}</b></td>
            <td>${inf.accion}</td>
        </tr>
    `).join("") || `<tr><td colspan="5" class="text-center" style="padding:10px; color:#16a34a; font-weight:700;">✓ No se encontraron inconsistencias en este lote.</td></tr>`;

    // Filas de detalle cuentas
    const filasDetalleHTML = detalleCuentas.slice(0, 35).map(d => `
        <tr>
            <td class="font-mono"><b>${d.documento}</b></td>
            <td><span class="badge badge-pkg font-mono">${d.paquete}</span></td>
            <td class="text-center"><span class="badge badge-srv font-mono">${d.servicio}</span></td>
            <td>${d.hallazgo}</td>
            <td><span class="badge ${d.dictamen.includes('Rechazo') ? 'badge-critico' : 'badge-alerta'}">${d.dictamen}</span></td>
        </tr>
    `).join("") || `<tr><td colspan="5" class="text-center" style="padding:10px; color:#16a34a; font-weight:700;">✓ 100% de las cuentas auditadas están conformes y listas para radicación.</td></tr>`;

    return `
    <div id="certificadoContainer" style="padding: 10px; background: white; color: #0f172a; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; font-size: 10px; line-height: 1.35;">
      <style>
        .font-mono { font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace; }
        .text-center { text-align: center; }
        .badge { display: inline-block; padding: 2px 6px; border-radius: 4px; font-size: 8.5px; font-weight: 700; white-space: nowrap; }
        .badge-pkg { background: #f0f9ff; color: #0369a1; border: 1px solid #bae6fd; }
        .badge-srv { background: #f1f5f9; color: #475569; border: 1px solid #cbd5e1; }
        .badge-critico { background: #fee2e2; color: #b91c1c; border: 1px solid #fca5a5; }
        .badge-alerta { background: #fef3c7; color: #b45309; border: 1px solid #fde68a; }
        .mini-progress { width: 100%; height: 5px; background: #e2e8f0; border-radius: 3px; overflow: hidden; margin-top: 3px; }
        .mini-progress-fill { height: 100%; border-radius: 3px; }
        table { width: 100%; border-collapse: separate; border-spacing: 0; margin-bottom: 12px; border: 1px solid #e2e8f0; border-radius: 6px; overflow: hidden; }
        th { background: #f8fafc; color: #475569; font-weight: 700; font-size: 8.5px; text-transform: uppercase; padding: 6px 8px; border-bottom: 1px solid #cbd5e1; text-align: left; }
        td { padding: 5px 8px; font-size: 9px; border-bottom: 1px solid #f1f5f9; vertical-align: middle; }
        tr:nth-child(even) td { background: #fafafa; }
      </style>

      <!-- HEADER -->
      <div style="display:flex; justify-content:space-between; align-items:center; padding-bottom:12px; border-bottom:2px solid #0ea5e9; margin-bottom:12px;">
        <div style="display:flex; align-items:center; gap:12px;">
          <div style="width:40px; height:40px; background:linear-gradient(135deg, #0284c7 0%, #0369a1 100%); border-radius:10px; display:flex; align-items:center; justify-content:center; color:white; font-size:18px; font-weight:900;">VF</div>
          <div>
            <h1 style="font-size:16px; font-weight:800; color:#0f172a; margin:0;">CERTIFICADO Y RESUMEN DE AUDITORÍA</h1>
            <p style="font-size:9.5px; color:#64748b; margin:2px 0 0 0;">Control de Calidad Documental de Cuentas Médicas</p>
          </div>
        </div>
        <div>
          <div style="display:inline-flex; align-items:center; gap:8px; padding:7px 14px; border-radius:9999px; font-size:11px; font-weight:800; text-transform:uppercase; ${estadoAprobado ? 'background:#f0fdf4; color:#166534; border:1.5px solid #22c55e;' : 'background:#fef2f2; color:#991b1b; border:1.5px solid #ef4444;'}">
            ${estadoAprobado ? '✓ APROBADO PARA ENVÍO' : `⚠ RECHAZADO • ${cuentasConNovedad} NOVEDADES`}
          </div>
        </div>
      </div>

      <!-- METADATA -->
      <div style="display:grid; grid-template-columns:1.2fr 1fr 1.3fr 1.1fr; gap:10px; background:#f8fafc; border:1px solid #e2e8f0; border-radius:8px; padding:8px 12px; margin-bottom:12px;">
        <div>
          <div style="font-size:8px; font-weight:700; text-transform:uppercase; color:#64748b;">Convenio / Modalidad</div>
          <div style="font-size:10.5px; font-weight:700; color:#1e293b; margin-top:1px;">${convenio.toUpperCase()} • ${tipoValidacion.toUpperCase()}</div>
        </div>
        <div>
          <div style="font-size:8px; font-weight:700; text-transform:uppercase; color:#64748b;">Fecha y Hora</div>
          <div style="font-size:10.5px; font-weight:700; color:#1e293b; margin-top:1px;">${fechaHora}</div>
        </div>
        <div>
          <div style="font-size:8px; font-weight:700; text-transform:uppercase; color:#64748b;">Matriz Vinculada</div>
          <div style="font-size:10.5px; font-weight:700; color:#1e293b; margin-top:1px; white-space:nowrap; overflow:hidden; text-overflow:ellipsis;" title="${nombreMatriz}">${nombreMatriz}</div>
        </div>
        <div>
          <div style="font-size:8px; font-weight:700; text-transform:uppercase; color:#64748b;">Auditor Responsable</div>
          <div style="font-size:10.5px; font-weight:700; color:#1e293b; margin-top:1px;">${auditor}</div>
        </div>
      </div>

      <!-- KPIS -->
      <div style="display:grid; grid-template-columns:repeat(5, 1fr); gap:8px; margin-bottom:12px;">
        <div style="background:#fff; border:1px solid #e2e8f0; border-top:3.5px solid #0284c7; border-radius:8px; padding:8px 10px;">
          <div style="font-size:18px; font-weight:800; color:#0f172a;">${totalCuentas}</div>
          <div style="font-size:8.5px; color:#64748b; font-weight:600;">Cuentas Auditadas</div>
        </div>
        <div style="background:#fff; border:1px solid #e2e8f0; border-top:3.5px solid #10b981; border-radius:8px; padding:8px 10px;">
          <div style="font-size:18px; font-weight:800; color:#16a34a;">${cuentasAprobadas}</div>
          <div style="font-size:8.5px; color:#64748b; font-weight:600;">Aprobadas (${porcentajeExito}%)</div>
        </div>
        <div style="background:#fff; border:1px solid #e2e8f0; border-top:3.5px solid #ef4444; border-radius:8px; padding:8px 10px;">
          <div style="font-size:18px; font-weight:800; color:#dc2626;">${cuentasConNovedad}</div>
          <div style="font-size:8.5px; color:#64748b; font-weight:600;">Con Novedades</div>
        </div>
        <div style="background:#fff; border:1px solid #e2e8f0; border-top:3.5px solid #8b5cf6; border-radius:8px; padding:8px 10px;">
          <div style="font-size:18px; font-weight:800; color:#8b5cf6;">${totalArchivosPDF}</div>
          <div style="font-size:8.5px; color:#64748b; font-weight:600;">Archivos PDF</div>
        </div>
        <div style="background:#fff; border:1px solid #e2e8f0; border-top:3.5px solid #f59e0b; border-radius:8px; padding:8px 10px;">
          <div style="font-size:18px; font-weight:800; color:#b45309;">${totalCriticos + totalAlertas}</div>
          <div style="font-size:8.5px; color:#64748b; font-weight:600;">${totalCriticos} Críticos / ${totalAlertas} Alertas</div>
        </div>
      </div>

      <!-- NOTA DE CRITERIO -->
      <div style="background:#fffbeb; border:1px solid #fef08a; border-left:4px solid #eab308; border-radius:6px; padding:7px 10px; margin-bottom:12px; font-size:9px; color:#713f12;">
        <b>Criterio de Aceptación:</b> Los <b>Errores Críticos</b> deben corregirse antes de radicar la cuenta médica. Las <b>Alertas</b> (como diferencias en rótulos de cabecera o adiciones a la matriz) pueden ser admitidas bajo aval de auditoría.
      </div>

      <!-- TABLA 1: POR PAQUETE -->
      <div style="font-size:10.5px; font-weight:800; text-transform:uppercase; color:#0f172a; margin:10px 0 5px 0; border-bottom:1px solid #cbd5e1; padding-bottom:3px;">
        1. Rendimiento por Código de Paquete (CPF)
      </div>
      <table>
        <thead>
          <tr>
            <th style="width:14%;">Código CPF</th>
            <th>Descripción del Paquete</th>
            <th class="text-center" style="width:10%;">Cuentas</th>
            <th class="text-center" style="width:10%;">Aprobadas</th>
            <th class="text-center" style="width:10%;">Con Error</th>
            <th class="text-center" style="width:18%;">Efectividad</th>
          </tr>
        </thead>
        <tbody>
          ${filasPaquetesHTML}
        </tbody>
      </table>

      <!-- TABLA 2: POR TIPO DE ERROR -->
      <div style="font-size:10.5px; font-weight:800; text-transform:uppercase; color:#0f172a; margin:12px 0 5px 0; border-bottom:1px solid #cbd5e1; padding-bottom:3px;">
        2. Clasificación de Inconsistencias y Causas Raíz
      </div>
      <table>
        <thead>
          <tr>
            <th style="width:24%;">Tipo de Inconsistencia</th>
            <th style="width:16%;">Categoría</th>
            <th>Detalle</th>
            <th class="text-center" style="width:8%;">Cant.</th>
            <th style="width:26%;">Instrucción Correctiva</th>
          </tr>
        </thead>
        <tbody>
          ${filasErroresHTML}
        </tbody>
      </table>

      <!-- TABLA 3: DETALLE CUENTAS -->
      <div style="font-size:10.5px; font-weight:800; text-transform:uppercase; color:#0f172a; margin:12px 0 5px 0; border-bottom:1px solid #cbd5e1; padding-bottom:3px;">
        3. Detalle Individual de Cuentas a Subsanar ${detalleCuentas.length > 35 ? `(Mostrando 35 de ${detalleCuentas.length})` : ''}
      </div>
      <table>
        <thead>
          <tr>
            <th style="width:14%;">Documento</th>
            <th style="width:12%;">Paquete</th>
            <th style="width:8%;" class="text-center">Srv</th>
            <th style="width:44%;">Hallazgo Detectado</th>
            <th style="width:22%;">Dictamen</th>
          </tr>
        </thead>
        <tbody>
          ${filasDetalleHTML}
        </tbody>
      </table>

      <!-- FIRMAS -->
      <div style="margin-top:22px; display:grid; grid-template-columns:1fr 1fr; gap:30px;">
        <div style="border-top:1.5px dashed #94a3b8; padding-top:6px; text-align:center;">
          <div style="font-weight:700; font-size:9.5px; color:#1e293b;">Responsable de Generación / Remisión</div>
          <div style="font-size:8px; color:#64748b; margin-top:2px;">Declaro haber verificado y subsanado los soportes auditados.</div>
        </div>
        <div style="border-top:1.5px dashed #94a3b8; padding-top:6px; text-align:center;">
          <div style="font-weight:700; font-size:9.5px; color:#1e293b;">Coordinación de Auditoría y Radicación</div>
          <div style="font-size:8px; color:#64748b; margin-top:2px;">Revisión técnica y aval de conformidad para recepción.</div>
        </div>
      </div>

      <!-- FOOTER -->
      <div style="margin-top:14px; padding-top:6px; border-top:1px solid #e2e8f0; display:flex; justify-content:space-between; font-size:8px; color:#94a3b8;">
        <div><b>Validador FOMAG 2026</b> • Certificación Automatizada</div>
        <div>Fecha: ${fechaHora}</div>
      </div>
    </div>
    `;
}

/**
 * Dispara la generación silenciosa y descarga directa del Certificado PDF
 * Mostrando barra de progreso y sin mostrarlo en la interfaz de la página.
 */
export async function exportarCertificadoPDF(datos) {
    const modalProgreso = document.getElementById("modalProgresoBajada");
    const modalTitulo = document.getElementById("modalProgresoBajadaTitulo");
    const progresoFill = document.getElementById("progresoFillBajada");
    const progresoPorcentaje = document.getElementById("progresoPorcentajeBajada");
    const progresoTexto = document.getElementById("progresoTextoBajada");

    if (modalTitulo) modalTitulo.textContent = "Generando Certificado Oficial en PDF...";
    if (progresoTexto) progresoTexto.textContent = "Preparando datos del certificado...";
    if (progresoFill) progresoFill.style.width = "15%";
    if (progresoPorcentaje) progresoPorcentaje.textContent = "15%";
    if (modalProgreso) modalProgreso.classList.remove("oculto");

    const htmlContenido = construirHTMLReporte(datos);

    // Contenedor completamente fuera de pantalla (offscreen) para no estorbar ni laguear la vista
    const container = document.createElement("div");
    container.style.position = "fixed";
    container.style.left = "-99999px";
    container.style.top = "0";
    container.style.width = "820px";
    container.style.background = "#ffffff";
    container.style.zIndex = "-1";
    container.style.opacity = "0";
    container.style.pointerEvents = "none";
    container.innerHTML = htmlContenido;
    document.body.appendChild(container);

    if (progresoTexto) progresoTexto.textContent = "Cargando motor de renderizado PDF...";
    if (progresoFill) progresoFill.style.width = "40%";
    if (progresoPorcentaje) progresoPorcentaje.textContent = "40%";

    const cargado = await cargarHtml2Pdf();

    const opt = {
        margin: [8, 10, 8, 10],
        filename: `Certificado_Auditoria_${datos.convenio || "FOMAG"}_${Date.now()}.pdf`,
        image: { type: "jpeg", quality: 0.98 },
        html2canvas: { scale: 1.6, useCORS: true, logging: false },
        jsPDF: { unit: "mm", format: "letter", orientation: "portrait" }
    };

    if (cargado && window.html2pdf) {
        try {
            if (progresoTexto) progresoTexto.textContent = "Generando páginas y tablas...";
            if (progresoFill) progresoFill.style.width = "75%";
            if (progresoPorcentaje) progresoPorcentaje.textContent = "75%";

            await new Promise((resolve) => setTimeout(resolve, 80));

            // Guardar directamente (descarga en segundo plano)
            await window.html2pdf().set(opt).from(container).save();

            if (progresoTexto) progresoTexto.textContent = "¡Certificado descargado con éxito!";
            if (progresoFill) progresoFill.style.width = "100%";
            if (progresoPorcentaje) progresoPorcentaje.textContent = "100%";
        } catch (err) {
            console.error("Error al generar PDF con html2pdf:", err);
            alert("Ocurrió un error al generar el PDF. Verifica tu conexión.");
        } finally {
            if (document.body.contains(container)) {
                document.body.removeChild(container);
            }
            setTimeout(() => {
                if (modalProgreso) modalProgreso.classList.add("oculto");
                if (modalTitulo) modalTitulo.textContent = "Generando archivo Excel XLSX...";
            }, 800);
        }
        return true;
    }

    // Fallback silencioso si no se pudo cargar la librería externa
    if (document.body.contains(container)) {
        document.body.removeChild(container);
    }
    if (modalProgreso) modalProgreso.classList.add("oculto");
    alert("No se pudo cargar el motor html2pdf. Verifica la conexión a internet para descargar el certificado.");
    return false;
}
