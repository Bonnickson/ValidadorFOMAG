# Validador de PDFs - FOMAG & Capital Salud

Aplicación web modular y de alto rendimiento para la auditoría y validación automática de historias clínicas y soportes de atención domiciliaria en formato PDF. Permite validar expedientes organizados en carpetas, soportando dos modalidades de operación (**Por evento** y **Por paquete**), validaciones de convenios (**Capital Salud** y **FOMAG**), diagnóstico y pre-validación de matriz de programación (.xlsx, .xls, .csv), y exportación de resultados a reportes en Excel (.xlsx).

---

## 📁 Estructura del Proyecto

```text
Validador FOMAG/
├── index.html                  # Interfaz de usuario principal y visores modales
├── styles.css                  # Estilos de la aplicación y diseño responsivo
├── README.md                   # Documentación técnica del proyecto
└── src/                        # Código fuente modular
    ├── app.js                  # Orquestación global de eventos, ciclo de vida e inicialización
    ├── reglas.js               # Definición de reglas de validación por servicio y convenio
    ├── config/
    │   └── constants.js        # Constantes, configuraciones globales y CDN de PDF.js
    ├── services/
    │   ├── excelExportService.js # Generación y descarga de reportes Excel (.xlsx)
    │   ├── folderService.js    # Carga de carpetas (File System Access API y webkitdirectory)
    │   └── matrixService.js    # Lectura, parseo y evaluación de reglas en matriz Excel/CSV
    ├── ui/
    │   ├── filterManager.js    # Gestión de filtros dinámicos y panel de incidencias
    │   ├── modalManager.js     # Modales (Pre-validación, Reglas de Paquetes y Diagnóstico)
    │   ├── pdfViewer.js        # Visor modal de documentos PDF
    │   └── tableRenderer.js    # Renderizado interactivo de la tabla de auditoría
    ├── utils/
    │   ├── clipboardUtils.js   # Utilidades para copiado rápido de textos, cédulas y errores
    │   ├── pdfUtils.js         # Extracción de texto y análisis de fechas/páginas con PDF.js
    │   └── textUtils.js        # Normalización de texto y extracción de datos
    └── validators/
        ├── eventoValidator.js  # Lógica de validación para modalidad Por Evento
        └── paqueteValidator.js # Lógica de validación para modalidad Por Paquete (Familia CPF)
```

---

## 🔧 Módulos y Arquitectura

### `src/services/`
- **`matrixService.js`**: Lectura con SheetJS de la matriz de programación (`.xlsx`, `.xls`, `.csv`). Valida reglas de negocio por paciente (fijos obligatorios, opcionales a elección y total de terapias) y genera el diagnóstico global.
- **`folderService.js`**: Gestión de lectura recursiva de directorios y archivos PDF mediante File System Access API o el selector tradicional.
- **`excelExportService.js`**: Exportación avanzada de resultados de auditoría y reportes consolidados a formato `.xlsx`.

### `src/ui/`
- **`modalManager.js`**: Modales para pre-validación de matriz, visualización de reglas de paquete y navegación directa hacia la carga de soportes.
- **`filterManager.js`**: Filtrado en tiempo real por búsqueda, servicios, estado y panel de tarjetas de incidencias categorizadas.
- **`pdfViewer.js`**: Previsualización emergente de PDFs dentro del workspace.
- **`tableRenderer.js`**: Renderizado eficiente de filas con insignias de estado, alertas, errores y acciones rápidas.

### `src/validators/`
- **`eventoValidator.js`**: Validación independiente de cada servicio con sus pares de archivos (`2 [servicio].pdf` y `5 [servicio].pdf`).
- **`paqueteValidator.js`**: Motor de reglas para paquetes mensuales integrales. Valida estructura de archivos, existencia de servicios obligatorios, selección de servicio opcional único y rangos de sumatoria de terapias.

---

## 🚀 Flujo y Modos de Validación

### 1. Carga de Matriz de Programación (Paso 1)
- **Carga Obligatoria**: Admite archivos `.xlsx`, `.xls` y `.csv`.
- **Diagnóstico y Pre-validación Inmediata**: Al adjuntar la matriz, se abre un panel con KPIs (Conformes / Novedades), filtros por paquete/búsqueda y desglose por paciente.
- **Carga Directa de Soportes**: Permite avanzar a la carga de expedientes directamente desde el modal de diagnóstico o desde el sidebar una vez habilitado el paso 2.

### 2. Carga de Soportes (Paso 2)
- El panel de carga de soportes permanece oculto y protegido hasta que se cuente con una matriz cargada.
- Permite arrastrar o seleccionar la carpeta principal de soportes para iniciar la auditoría automatizada.

### 3. Validación Por Paquete (Familia CPF)
Diseñado para la validación de paquetes integrales con documento maestro `2 PAQ.pdf`:
- **Documento Maestro**: `2 PAQ.pdf` es la fuente única de autorizaciones. No se permiten archivos `2 [servicio].pdf` individuales.
- **Servicios Obligatorios**: Exige exactamente 1 evolución en `VM` (Valoración Médica), `ENF` (Enfermería) y `VENF` (Auxiliar de Enfermería).
- **Servicio Opcional Único**: Debe contener **exactamente 1** de los siguientes servicios: `PSI` (Psicología), `NUT` (Nutrición) o `TS` (Trabajo Social), con 1 sola evolución.
- **Archivos de Firma**: Valida que los archivos `4 [servicio].pdf` tengan 1 sola página y correspondan a formatos de firmas.
- **Regla de Sumatoria de Terapias**: Suma el total de evoluciones de las 5 terapias (`TF`, `TO`, `TR`, `FON`, `TRS`) y valida contra los rangos del paquete:
  - **CPF1108** (Atención Domiciliaria Crónico): No requiere terapias.
  - **CPF1109** (Crónico con Terapias): **6 a 12** terapias en total.
  - **CPF1110** (Paquete Intermedio): **12 a 20** terapias en total.
  - **CPF1105** (Rehabilitación Neurológico Agudo) & **CPF1106** (Traqueostomía): **12 a 30** terapias en total.

### 4. Validación Por Evento (Individual)
Valida cada servicio de manera individual mediante pares de archivos (`2 [servicio].pdf` y `5 [servicio].pdf`):
- Verifica coincidencia del documento del paciente entre los soportes.
- Comprueba la presencia de textos requeridos según el servicio y convenio.
- En FOMAG, valida que la cantidad autorizada coincida con las evoluciones registradas en el archivo 5.

---

## 🏛️ Reglas por Convenio

| Convenio | Validación Archivo 2.pdf | Validación Archivo 5.pdf | Documento Paciente |
| :--- | :--- | :--- | :--- |
| **🏢 Capital Salud** | Valida presencia del texto del servicio. | Valida texto y verifica duplicados/orden de fechas. | Validación estándar |
| **🏛️ FOMAG** | Valida texto específico y extrae cantidad autorizada. | Valida texto, cantidad de evoluciones vs autorizadas, duplicados y orden cronológico. | Valida coincidencia estricta en 2 y 5 |

---

## 📊 Características Destacadas

- ⚡ **Lectura Masiva**: Soporte para *File System Access API* (`btnAbrirFS`) y selector estándar por carpetas.
- 📐 **Panel de Incidencias Redimensionable**: Panel de resumen de errores interactivo con ajuste de altura fluido mediante `requestAnimationFrame`.
- 🔍 **Filtros Dinámicos**: Filtrado en vivo por texto/cédula, tipo de servicio, estado y selección múltiple de tarjetas de error.
- 📋 **Acciones Rápidas de Portapapeles**: Copiado rápido de identificadores, números de documento, formatos estándar y listas de expedientes con error.
- 📥 **Exportación a Excel**:
  - **Descargar XLSX**: Reporte detallado de auditoría carpeta por carpeta con observaciones y estados.
  - **Reporte Matriz**: Resumen consolidado para control de facturación y auditoría médica.
