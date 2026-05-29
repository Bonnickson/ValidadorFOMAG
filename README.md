# Validador de PDFs

Aplicación web para validar documentos PDF en carpetas, con dos modos de validación: por evento y por paquete.

## 📁 Estructura del Proyecto

```
prueba validador/
├── index.html              # Página principal
├── styles.css             # Estilos de la aplicación
├── README.md              # Este archivo
└── src/                   # Código fuente organizado
    ├── app.js             # Punto de entrada y orquestación
    ├── reglas.js          # Reglas de validación de PDFs
    ├── config/
    │   └── constants.js   # Constantes y configuración
    ├── utils/
    │   ├── pdfUtils.js    # Utilidades para PDFs
    │   └── textUtils.js   # Utilidades para texto
    ├── validators/
    │   ├── eventoValidator.js    # Validación por evento
    │   └── paqueteValidator.js   # Validación por paquete
    └── ui/
        └── tableRenderer.js      # Renderizado de la tabla
```

## 🔧 Módulos

### `src/config/constants.js`

Contiene todas las constantes de configuración:

-   `DEBUG`: Modo debug
-   `ALLOWED_TYPES`: Tipos de carpetas permitidos
-   `SERVICIOS_TERAPIA`: Servicios de terapia válidos
-   URLs de PDF.js

### `src/utils/`

**textUtils.js**: Funciones de procesamiento de texto

-   `escapeRegExp()`: Escapa caracteres especiales
-   `normalizeForSearch()`: Normaliza texto para búsquedas
-   `formatearFecha()`: Formatea fechas
-   `formatearFechaCompacta()`: Formato compacto de fechas

**pdfUtils.js**: Funciones de manejo de PDFs

-   `extraerTextoPDF()`: Extrae texto completo de un PDF
-   `extraerFechas()`: Extrae fechas usando regex
-   `leerArchivoComoBuffer()`: Convierte archivo a ArrayBuffer

### `src/validators/`

**eventoValidator.js**: Validación por evento

-   `validarPDF()`: Valida un PDF individual en modo evento

**paqueteValidator.js**: Validación por paquete

-   `validarPorPaquete()`: Valida carpeta completa en modo paquete.
-   `validarNuevoPaquete()`: Aplica la lógica de los nuevos paquetes CPF (Validación estricta desde `2 PAQ.pdf`, validación de requerimientos, rangos de suma de terapias).
-   Funciones internas para paquetes antiguos o manejo especial FOMAG.

### `src/ui/tableRenderer.js`

Manejo completo de la interfaz de tabla:

-   `actualizarHeadersTabla()`: Actualiza encabezados según modo
-   `createPlaceholderRow()`: Crea fila con spinner
-   `updateRow()`: Actualiza fila existente
-   `pintarFila()`: Renderiza nueva fila
-   Helpers de renderizado para cada modo

### `src/app.js`

Punto de entrada principal:

-   Inicializa PDF.js
-   Maneja eventos del DOM
-   Orquesta el flujo de validación
-   Coordina todos los módulos

## 🚀 Uso

1. Abrir `index.html` en un navegador moderno
2. Seleccionar tipo de validación (evento o paquete)
3. Elegir carpeta con archivos PDF
4. Ver resultados en la tabla

## ✨ Ventajas de la Nueva Estructura

-   **Modularidad**: Código separado por responsabilidades
-   **Mantenibilidad**: Fácil localizar y modificar funcionalidad
-   **Reutilización**: Funciones compartidas en utils
-   **Escalabilidad**: Fácil agregar nuevos validadores o utilidades
-   **Legibilidad**: Archivos más pequeños y enfocados

## 📝 Reglas de Validación

Las reglas se definen en `src/reglas.js` y `src/validators/paqueteValidator.js`:

-   `obtenerReglasEvento(convenio)`: Genera reglas según el convenio seleccionado.
-   `obtenerReglasPaquete(convenio)`: Genera reglas para la antigua modalidad de paquetes (modo retro-compatibilidad).
-   `REGEX_FECHA`: Expresión regular para detectar fechas.

### Nuevos Paquetes Basados en Reglas (Familia CPF)

Para los nuevos códigos de paquete (CPF1109, CPF1108, CPF1110, CPF1105, CPF1106) el sistema cambia a un **modelo basado en reglas estrictas**, donde se abandona la comparación "Cant Auto vs Cant Evoluciones" del archivo 2 individual para centralizar el flujo en el documento maestro **`2 PAQ.pdf`**:

-   **Fuente única**: La existencia del código y número de autorizaciones se extrae únicamente de `2 PAQ.pdf` (no se admiten archivos `2 [servicio].pdf` individuales para estos paquetes).
-   **Servicios Obligatorios**: Todos estos paquetes exigen 1 evolución de `VM`, `ENF` y `VENF` (Auxiliar de Enfermería).
-   **Opción de Selección Única ("Uno de los siguientes")**: Obligan a la existencia de un (1) solo servicio opcional entre `PSI`, `NUT` y `TS`, que a su vez debe contar con exactamente 1 evolución.
-   **Regla de Sumatoria de Terapias**: Suma todas las evoluciones de las terapias (`TF`, `TO`, `TR`, `FON`, `TRS` - Terapia de Succión) y verifica que el total se encuentre en un rango de requerimiento específico para cada paquete:
    -   **CPF1109**: 6 - 12 terapias
    -   **CPF1108**: (no requiere sumatoria de terapias)
    -   **CPF1110**: 12 - 20 terapias
    -   **CPF1105 y CPF1106**: 12 - 30 terapias

### Convenios

El validador soporta dos tipos de convenios para el archivo **2.pdf**:

#### 🏢 Capital Salud (Por defecto)

-   **Validación**: Solo verifica que el archivo contenga el texto específico
-   **No valida**: Cantidad de registros vs fechas en el archivo 2.pdf

#### 🏛️ FOMAG

-   **Validación**: Verifica el texto Y valida cantidad
-   **Valida**: Que el número de veces que aparece el texto coincida con el número de fechas encontradas en el 2.pdf

**Nota**: El archivo **5.pdf** siempre valida texto + cantidad en ambos convenios.
