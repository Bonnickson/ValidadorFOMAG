import * as XLSX from "https://cdn.sheetjs.com/xlsx-0.20.3/package/xlsx.mjs";

/**
 * Carga dinámica de la librería XLSX con CDN de fallback si no está cargada
 */
export async function cargarXLSX() {
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

/**
 * Exporta el archivo XLSX de resultados de validación general
 */
export function exportarXLSX(resultados) {
    const modalProgreso = document.getElementById("modalProgresoBajada");
    const progresoFill = document.getElementById("progresoFillBajada");
    const progresoPorcentaje = document.getElementById(
        "progresoPorcentajeBajada",
    );
    const progresoTexto = document.getElementById("progresoTextoBajada");

    if (modalProgreso) modalProgreso.classList.remove("oculto");

    setTimeout(() => {
        try {
            const filas = [];
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

            if (progresoTexto) progresoTexto.textContent = "Recopilando datos...";
            if (progresoFill) progresoFill.style.width = "10%";
            if (progresoPorcentaje) progresoPorcentaje.textContent = "10%";

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
                if (progresoFill) progresoFill.style.width = porcentaje + "%";
                if (progresoPorcentaje) progresoPorcentaje.textContent = porcentaje + "%";
                if (progresoTexto) progresoTexto.textContent = `Procesando carpeta ${procesoActual}/${totalProcesos}...`;
            });

            if (progresoTexto) progresoTexto.textContent = "Formateando hoja de cálculo...";
            if (progresoFill) progresoFill.style.width = "60%";
            if (progresoPorcentaje) progresoPorcentaje.textContent = "60%";

            const ws = XLSX.utils.aoa_to_sheet(filas);
            const colWidths = [20, 25, 20, 16, 16, 16, 24, 34, 34, 20];
            ws["!cols"] = colWidths.map((w) => ({ wch: w }));
            ws["!freeze"] = { xSplit: 0, ySplit: 1, topLeftCell: "A2" };

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
                "sin-errores": { patternType: "solid", fgColor: { rgb: "E6F4EA" } },
                "con-alertas": { patternType: "solid", fgColor: { rgb: "FFF7D6" } },
                "con-errores": { patternType: "solid", fgColor: { rgb: "FDE2E1" } },
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

            if (progresoTexto) progresoTexto.textContent = "Generando archivo...";
            if (progresoFill) progresoFill.style.width = "85%";
            if (progresoPorcentaje) progresoPorcentaje.textContent = "85%";

            const wb = XLSX.utils.book_new();
            XLSX.utils.book_append_sheet(wb, ws, "Validación");

            if (progresoTexto) progresoTexto.textContent = "¡Descargando!";
            if (progresoFill) progresoFill.style.width = "95%";
            if (progresoPorcentaje) progresoPorcentaje.textContent = "95%";

            const timestamp = new Date()
                .toISOString()
                .slice(0, 19)
                .replace(/[:T]/g, "-");
            XLSX.writeFile(wb, `validacion-${timestamp}.xlsx`);

            setTimeout(() => {
                if (progresoTexto) progresoTexto.textContent = "¡Archivo descargado!";
                if (progresoFill) progresoFill.style.width = "100%";
                if (progresoPorcentaje) progresoPorcentaje.textContent = "100%";

                setTimeout(() => {
                    if (modalProgreso) modalProgreso.classList.add("oculto");
                }, 800);
            }, 300);
        } catch (error) {
            console.error("Error al exportar XLSX:", error);
            if (progresoTexto) {
                progresoTexto.textContent = `❌ Error al generar el archivo: ${error?.message || error}`;
            }
            if (progresoPorcentaje) progresoPorcentaje.textContent = "0%";
            if (progresoFill) progresoFill.style.width = "0%";
            setTimeout(() => {
                if (modalProgreso) modalProgreso.classList.add("oculto");
            }, 2400);
        }
    }, 100);
}

/**
 * Exporta un resumen de errores agrupados por tipo y sus carpetas
 */
export function exportarResumenErroresXLSX(
    erroresPorTipo,
    detallePorTipo,
    carpetasPorTipo
) {
    const modalProgreso = document.getElementById("modalProgresoBajada");
    const progresoFill = document.getElementById("progresoFillBajada");
    const progresoPorcentaje = document.getElementById(
        "progresoPorcentajeBajada"
    );
    const progresoTexto = document.getElementById("progresoTextoBajada");

    if (modalProgreso) modalProgreso.classList.remove("oculto");
    if (progresoTexto) progresoTexto.textContent = "Generando resumen de errores...";
    if (progresoFill) progresoFill.style.width = "20%";
    if (progresoPorcentaje) progresoPorcentaje.textContent = "20%";

    setTimeout(() => {
        try {
            const data = [];
            data.push([
                "Tipo de Error",
                "Detalle",
                "Cantidad",
                "Carpetas (Documentos)",
            ]);

            const tipos = Object.keys(erroresPorTipo).sort(
                (a, b) => erroresPorTipo[b] - erroresPorTipo[a]
            );

            tipos.forEach((tipo) => {
                const detalle = detallePorTipo[tipo] || "";
                const cantidad = erroresPorTipo[tipo];
                const carpetas = Array.from(carpetasPorTipo[tipo] || []).join(
                    ", "
                );
                data.push([tipo, detalle, cantidad, carpetas]);
            });

            const ws = XLSX.utils.aoa_to_sheet(data);
            ws["!cols"] = [
                { wch: 40 },
                { wch: 50 },
                { wch: 10 },
                { wch: 80 },
            ];

            const wb = XLSX.utils.book_new();
            XLSX.utils.book_append_sheet(wb, ws, "Resumen de Errores");

            const timestamp = new Date().toISOString().slice(0, 10);
            XLSX.writeFile(wb, `Resumen_Errores_${timestamp}.xlsx`);

            if (progresoFill) progresoFill.style.width = "100%";
            if (progresoPorcentaje) progresoPorcentaje.textContent = "100%";
            if (progresoTexto) progresoTexto.textContent = "¡Resumen descargado!";

            setTimeout(() => {
                if (modalProgreso) modalProgreso.classList.add("oculto");
            }, 1000);
        } catch (error) {
            console.error("Error al exportar resumen de errores:", error);
            alert("Error al generar el Excel de errores: " + error.message);
            if (modalProgreso) modalProgreso.classList.add("oculto");
        }
    }, 100);
}

/**
 * Exporta la matriz oficial de eventos FOMAG
 */
export function exportarFomagEvento(resultados) {
    const modalProgreso = document.getElementById("modalProgresoBajada");
    const progresoFill = document.getElementById("progresoFillBajada");
    const progresoPorcentaje = document.getElementById(
        "progresoPorcentajeBajada"
    );
    const progresoTexto = document.getElementById("progresoTextoBajada");

    if (modalProgreso) modalProgreso.classList.remove("oculto");

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
            filas.push(columnas.map((c) => c.header));

            if (progresoTexto) progresoTexto.textContent = "Recopilando datos Fomag...";
            if (progresoFill) progresoFill.style.width = "10%";

            const carpetas = Object.keys(resultados);
            carpetas.forEach((carpeta) => {
                const r = resultados[carpeta];
                const row = [];
                columnas.forEach((col, index) => {
                    if (index === 0) {
                        row.push(carpeta);
                    } else {
                        const servicio = col.service;
                        const fechas = r.fechasPorServicio?.[servicio] || [];
                        const count = [...new Set(fechas)].length;
                        row.push(count > 0 ? count : "");
                    }
                });
                filas.push(row);
            });

            if (progresoTexto) progresoTexto.textContent = "Generando Excel...";
            if (progresoFill) progresoFill.style.width = "60%";

            const ws = XLSX.utils.aoa_to_sheet(filas);

            const headerStyle = {
                fill: { patternType: "solid", fgColor: { rgb: "E7E7E7" } },
                font: { bold: true, color: { rgb: "000000" }, sz: 12 },
                alignment: {
                    horizontal: "center",
                    vertical: "bottom",
                    textRotation: 90,
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
                    const cellRef = XLSX.utils.encode_cell({ r, c: C, r: R });
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

            ws["!cols"] = [
                { wch: 30 },
                ...Array(18).fill({ wch: 5 }),
            ];

            const wb = XLSX.utils.book_new();
            XLSX.utils.book_append_sheet(wb, ws, "Reporte Eventos");

            const timestamp = new Date()
                .toISOString()
                .slice(0, 19)
                .replace(/[:T]/g, "-");
            XLSX.writeFile(wb, `Reporte_Fomag_Eventos_${timestamp}.xlsx`);

            if (progresoTexto) progresoTexto.textContent = "¡Descargado!";
            if (progresoFill) progresoFill.style.width = "100%";
            if (progresoPorcentaje) progresoPorcentaje.textContent = "100%";

            setTimeout(() => {
                if (modalProgreso) modalProgreso.classList.add("oculto");
            }, 1500);
        } catch (error) {
            console.error("Error Fomag Export:", error);
            if (progresoTexto) progresoTexto.textContent = `❌ Error: ${error?.message || error}`;
            setTimeout(() => {
                if (modalProgreso) modalProgreso.classList.add("oculto");
            }, 2500);
        }
    }, 100);
}
