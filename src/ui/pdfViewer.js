import * as pdfjsLib from "https://cdnjs.cloudflare.com/ajax/libs/pdf.js/4.0.379/pdf.min.mjs";

let currentPdfDoc = null;
let currentPdfPage = 1;
let currentPdfScale = 1.0;
let currentPdfRotation = 0;
let isRenderingDocument = false;

/**
 * Renderiza todas las páginas del PDF con scroll continuo centrado
 */
export async function renderizarDocumentoPDF() {
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

/**
 * Observa el scroll del contenedor para actualizar el indicador de página activa
 */
export function iniciarScrollObserver() {
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

/**
 * Actualiza los badges de página, zoom y estado de botones
 */
export function actualizarBadgePagina(pageNum) {
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

/**
 * Desplaza la vista a una página específica
 */
export function irAPagina(pageNum) {
    if (!currentPdfDoc || pageNum < 1 || pageNum > currentPdfDoc.numPages) return;
    currentPdfPage = pageNum;
    const target = document.getElementById(`pdfPageWrapper_${pageNum}`);
    if (target) {
        target.scrollIntoView({ behavior: "smooth", block: "center" });
    }
    actualizarBadgePagina(pageNum);
}

function handleEscKey(e) {
    if (e.key === "Escape") {
        cerrarModal();
    }
}

/**
 * Abre el modal y carga el PDF indicado
 */
export async function abrirPDFModal(url, titulo, anchorEl, seleccionarFilaCallback) {
    const modal = document.getElementById("pdfModal");
    const tituloElement = document.getElementById("pdfModalTitle");
    if (tituloElement) tituloElement.textContent = titulo;
    if (modal) modal.style.display = "flex";

    if (anchorEl && typeof seleccionarFilaCallback === "function") {
        const fila = anchorEl.closest("tr");
        seleccionarFilaCallback(fila);
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
}

/**
 * Cierra el modal de PDF y libera memoria
 */
export function cerrarModal() {
    const modal = document.getElementById("pdfModal");
    if (modal) modal.style.display = "none";

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
}

/**
 * Inicializa los event listeners de zoom, rotación y paginación
 */
export function inicializarControlesPDF() {
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

    // Cerrar modal al hacer clic fuera del contenido
    const modal = document.getElementById("pdfModal");
    if (modal && !modal._boundClose) {
        modal._boundClose = true;
        modal.addEventListener("click", (event) => {
            if (event.target === modal) {
                cerrarModal();
            }
        });
    }
}
