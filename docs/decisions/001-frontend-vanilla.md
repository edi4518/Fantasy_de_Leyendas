# ADR 001: Adopción de Vanilla JavaScript ES Modules para la PWA

## Estado
Aceptado

## Contexto
Se requiere construir una aplicación web progresiva (PWA) de alto rendimiento, bajo peso en bytes y máxima longevidad sin sobrecarga de dependencias de empaquetadores pesados ni lock-in de frameworks como React, Angular o Vue.

## Decisión
Usar Vanilla JavaScript estándar aprovechando ECMAScript Modules nativos (`type="module"`), Custom Elements/Templates y CSS Custom Properties.

## Consecuencias
- **Positivas:** Cero pasos obligatorios de build para desarrollo, arranque ultra veloz, carga directa vía HTTP/2 y Service Worker, control total sobre el DOM.
- **Negativas:** La reactividad y enrutamiento se gestionan con implementaciones propias y limpias en `src/app/router.js`.
