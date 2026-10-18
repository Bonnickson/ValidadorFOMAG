# Reglas del Proyecto (Workspace Rules)

## 1. Actualización Obligatoria de la Wiki y Guía de Usuario
Siempre que se realice cualquier modificación en el proyecto (por ejemplo: cambios en la lógica de negocio, validaciones, flujos, paquetes, servicios, interfaz de usuario o parámetros), es **estrictamente obligatorio** mantener actualizada la documentación y guía de usuario correspondiente:

1. **Guía de Usuario / Wiki Integrada (`index.html`)**:
   - Sección `#wikiContainer` (`<!-- Wiki Section -->`).
   - Si se agregan, modifican o eliminan reglas, nuevos paquetes (códigos CPF), servicios, formatos de archivo (2, 3, 4, 5), validaciones de matriz o mensajes de error, actualizar los artículos correspondientes de la wiki (`#wiki-inicio`, `#wiki-matriz`, `#wiki-fomag-paquete`, `#wiki-estructura`, `#wiki-servicios`, `#wiki-errores`, etc.).
2. **Documentación Técnica (`README.md`)**:
   - Mantener sincronizada la arquitectura, lista de reglas por convenio y características destacadas.

## 2. Pautas Generales
- Mantener las explicaciones al usuario en español, de forma clara y directa.
- Asegurarse de que cualquier regla nueva reflejada en código (`src/reglas.js`, `src/validators/`, `src/services/`, etc.) tenga su correspondiente explicación en la guía de usuario.
