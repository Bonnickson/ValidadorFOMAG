# Reglas del Proyecto (Workspace Rules) - Modo Ultra Rápido

## 0. Directiva Principal de Velocidad y Eficiencia
- **Actuar de inmediato**: Ir directo al archivo indicado y aplicar la modificación con `edit_file`.
- **PROHIBIDO ejecutar comandos de Git** (`git status`, `git diff`, `git log`, etc.) salvo que el usuario lo solicite expresamente.
- **PROHIBIDO hacer búsquedas o lecturas a ciegas** en múltiples archivos o bloques repetitivos de 20 líneas.
- Solo actualizar Wiki o README si el usuario lo pide expresamente.
- No ejecutar validaciones pesadas en cambios puntuales.

## 1. Mapa de Enrutamiento Inmediato
| Elemento / Tarea | Archivo Objetivo |
| :--- | :--- |
| **Tablas, celdas, filas, badges, iconos en resultados** | `src/ui/tableRenderer.js` |
| **Modales, diálogos emergentes, vistas secundarias** | `src/ui/modalManager.js` |
| **Estructura HTML base, botones principales, Wiki** | `index.html` |
| **Estilos, temas, colores, animaciones** | `styles.css` |
| **Filtros de búsqueda, ordenamiento, navegación** | `src/ui/filterManager.js` |
| **Lógica de validación (Paquetes, Masivos, CPF)** | `src/validators/paqueteValidator.js` |
| **Lógica de validación (Evento, Individual)** | `src/validators/eventoValidator.js` |
| **Catálogo de reglas de negocio** | `src/reglas.js` |
| **Importación y lectura de Matriz Excel/CSV** | `src/services/matrixService.js` |
| **Exportación a Excel** | `src/services/excelExportService.js` |
| **Exportación a PDF / Certificados** | `src/services/pdfExportService.js` / `src/ui/pdfViewer.js` |
| **Controlador principal y eventos globales** | `src/app.js` |
| **Utilidades de texto y normalización** | `src/utils/textUtils.js` |

## 2. Pautas Generales
- Responder siempre en español de forma concreta y concisa.
- No romper exports/imports esenciales entre módulos.
