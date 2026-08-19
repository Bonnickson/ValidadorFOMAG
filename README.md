# Validador de PDFs - FOMAG & Capital Salud

Aplicación web modular y de alto rendimiento para la validación automática de historias clínicas y soportes de atención domiciliaria en formato PDF. Permite validar expedientes organizados en carpetas, soportando dos modalidades de operación (**Por evento** y **Por paquete**), validaciones de convenios (**Capital Salud** y **FOMAG**), y exportación de resultados a reportes en Excel (.xlsx) y Matriz de facturación.

---

## 📁 Estructura del Proyecto

```text
Validador FOMAG/
├── index.html                  # Interfaz de usuario principal y visor de ayuda/wiki
├── styles.css                  # Estilos de la aplicación y componentes visuales
├── README.md                   # Documentación del proyecto
└── src/                        # Código fuente modular
    ├── app.js                  # Orquestación de eventos, DOM, exportación y filtros
    ├── reglas.js               # Definición de reglas de validación por servicio y convenio
    ├── config/
    │   └── constants.js        # Constantes, configuraciones y CDN de PDF.js
    ├── utils/
    │   ├── pdfUtils.js         # Extracción de texto y análisis de fechas en PDFs
    │   └── textUtils.js        # Normalización de texto y extracción numérica
    ├── validators/
    │   ├── eventoValidator.js  # Lógica de validación para modalidad Por Evento
    │   └── paqueteValidator.js # Lógica de validación para modalidad Por Paquete (Familia CPF)
    └── ui/
        └── tableRenderer.js    # Renderizado y actualización de filas/estados en la tabla
```

---

## 🔧 Módulos y Arquitectura

### `src/config/constants.js`
Centraliza la configuración global:
- `DEBUG`: Bandera de depuración en consola.
- `ALLOWED_TYPES`: Tipos de servicios clínicos permitidos.
- `SERVICIOS_TERAPIA`: Lista de terapias (`TF`, `TR`, `TO`, `FON`, `TRS`, etc.).
- URLs de workers y librerías externas (PDF.js).

### `src/utils/`
- **`textUtils.js`**: Normalización de texto para búsquedas sin acentos/espacios, extracción de números de autorización con regex y formateo de fechas.
- **`pdfUtils.js`**: Integración con PDF.js para extracción asíncrona de texto, parseo de patrones de fecha y validación cronológica y de duplicados.

### `src/validators/`
- **`eventoValidator.js`**: Validación independiente de cada servicio con sus pares de archivos (soportes `2.pdf` y registros `5.pdf`).
- **`paqueteValidator.js`**: Motor de reglas para paquetes mensuales integrales. Valida estructura de archivos, existencia de servicios obligatorios, selección de servicio opcional único y rangos de sumatoria de terapias.

### `src/ui/tableRenderer.js`
- Actualización dinámica de columnas y encabezados de la tabla según el tipo de validación.
- Renderizado de filas con estados en tiempo real (exitos, alertas, errores, links para previsualizar PDFs).

### `src/app.js`
- Manejo del ciclo de vida de la aplicación.
- Carga de carpetas (estándar o mediante la API rápida del File System).
- Filtros por estado, servicio, error o número de documento.
- Generación y descarga de reportes XLSX detallados y matriz consolidada.

---

## 🚀 Modos de Validación

### 1. Validación Por Evento (Individual)
Valida cada servicio de manera individual mediante pares de archivos (`2 [servicio].pdf` y `5 [servicio].pdf` o `2 paq.pdf`):
- Verifica que el número de identificación del paciente coincida en los documentos.
- Comprueba que los textos requeridos según el servicio y convenio estén presentes.
- En FOMAG, valida que la cantidad autorizada coincida con la cantidad de evoluciones registradas en el archivo 5.

### 2. Validación Por Paquete (Familia CPF)
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

---

## 🏛️ Reglas por Convenio

| Convenio | Validación Archivo 2.pdf | Validación Archivo 5.pdf | Documento Paciente |
| :--- | :--- | :--- | :--- |
| **🏢 Capital Salud** | Valida presencia del texto del servicio. | Valida texto y verifica duplicados/orden de fechas. | Validación estándar |
| **🏛️ FOMAG** | Valida texto específico y extrae cantidad autorizada. | Valida texto, cantidad de evoluciones vs autorizadas, duplicados y orden cronológico. | Valida coincidencia estricta en 2 y 5 |

---

## 📊 Características y Reportes

- ⚡ **Lectura Rápida de Carpetas**: Integración con *File System Access API* (`btnAbrirFS`) para procesar directorios masivos a alta velocidad.
- 🔍 **Filtros Avanzados**: Filtrado en vivo por término de búsqueda (documento o carpeta), servicio, estado (Correcto/Error) y chips de resumen de errores agrupados.
- 📥 **Exportación a Excel**:
  - **Descargar XLSX**: Reporte detallado carpeta por carpeta con desglose de servicios, archivos, autorizaciones y observaciones.
  - **Descarga reporte Matriz**: Generación consolidada optimizada para control de facturación y auditoría médica.
- ❓ **Wiki / Ayuda Integrada**: Panel interactivo con glosario de servicios, convenciones de nomenclatura y condiciones de paquetes.
