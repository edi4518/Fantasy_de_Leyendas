/**
 * @file version.js
 * @description Versión única y centralizada de la aplicación PWA.
 * Al desplegar una nueva versión, actualizar esta constante invalida automáticamente
 * la caché de pantallas HTML, controladores JS, estilos CSS y estado obsoleto en localStorage.
 */

export const APP_VERSION = '1.3.0';

/**
 * Versionado de datos locales para migración de localStorage.
 * Si cambia el esquema o se necesita purgar datos corruptos, incrementar SCHEMA_VERSION.
 */
export const SCHEMA_VERSION = '2.0';

