# Fantasy de Leyendas PWA

Plataforma fantasy de fútbol histórico para armar plantillas, comparar leyendas mediante estadísticas, configurar una formación táctica y simular partidos con resultados basados en atributos y aleatoriedad controlada.

> **Fuente funcional principal:** `Propuesta de Proyecto - Fantasy de Leyendas PWA.docx`. Los diseños HTML exportados desde Google Stitch se usan como referencia visual. Si un prototipo visual contradice un requisito funcional de la propuesta, registrar la diferencia y resolverla en equipo antes de implementarla.

## Objetivo

Construir una Progressive Web App (PWA) responsive, mobile-first e instalable que permita gestionar un equipo de seis titulares y tres suplentes con un presupuesto máximo de 100 millones de créditos, comparar jugadores, simular partidos y actualizar una clasificación.

## Funcionalidades principales

- Registro, inicio de sesión y perfil de mánager.
- Catálogo cerrado de 80 leyendas: 20 arqueros, 20 defensores, 20 mediocampistas y 20 delanteros.
- Mercado con búsqueda, filtros por posición, nacionalidad y precio, ordenamiento y fichajes.
- Comparador de dos o más jugadores mediante radar de cuatro atributos: ataque, creación, defensa y físico.
- Plantilla de seis titulares y tres suplentes, con validación de presupuesto.
- Pizarra táctica con formaciones predefinidas y alertas por desubicación posicional.
- Simulación de partidos minuto a minuto y modo de simulación rápida.
- Resultado del partido, estadísticas y actualización del ranking ELO/MMR.
- Historial de partidos.
- Panel administrativo ABM (alta, baja/desactivación, modificación y consulta) del catálogo.
- PWA instalable con soporte offline asistido por Service Worker y almacenamiento local.
- Dashboard analítico y visualizaciones de datos, incluyendo Power BI según disponibilidad del entorno.

## Stack propuesto

La propuesta académica define:

| Capa | Tecnología |
|---|---|
| Frontend | HTML5 semántico, CSS3, JavaScript Vanilla ES6+ |
| Gráficos | Chart.js |
| Backend | Python con FastAPI (recomendado frente a mantener dos alternativas) |
| Base de datos | MySQL |
| PWA | `manifest.webmanifest`, Service Worker y almacenamiento local/IndexedDB |
| BI | Power BI |
| Prototipado | Google Stitch |

No se introduce un framework frontend en esta guía para respetar la propuesta. Si el equipo decide usar uno, hacerlo antes de comenzar la implementación y documentarlo.

## Requisitos previos

- Git y una cuenta/repositorio compartido.
- Python 3.11+ (o la versión acordada por el equipo).
- MySQL 8+.
- Node.js solo si se desea usar herramientas de desarrollo o pruebas; la aplicación frontend base no lo necesita.
- Un navegador moderno.
- Un servidor local para frontend. No abrir los HTML directamente con `file://`, porque módulos ES y Service Worker requieren servir la aplicación por HTTP/HTTPS.
- Editor compartido y tablero de tareas.

## Inicio rápido de desarrollo

1. Crear el repositorio y la estructura propuesta en `ARQUITECTURA.md`.
2. Crear y activar un entorno virtual Python.
3. Instalar FastAPI, Uvicorn y el conector MySQL elegido.
4. Crear la base MySQL y configurar las variables de entorno desde `.env.example`.
5. Implementar primero los modelos y la API del catálogo de jugadores.
6. Implementar los tokens de diseño de `src/styles/design-tokens.css` y el CSS global.
7. Construir el shell común de navegación y después las pantallas por módulos.
8. Conectar cada pantalla a la API mediante una capa de servicios, evitando llamadas HTTP dentro del código de presentación.
9. Añadir Chart.js, la lógica de alineación, simulación y ranking.
10. Configurar el manifiesto PWA, iconos y Service Worker.
11. Ejecutar pruebas funcionales, responsive, accesibilidad y flujo offline antes de desplegar.

Los comandos y el orden detallado están en `GUIA_DESARROLLO.md`.

## Reglas de negocio que no deben quedar duplicadas en el frontend

- Presupuesto máximo: **100 millones de créditos**.
- Plantilla objetivo: **9 jugadores: 6 titulares y 3 suplentes**.
- Catálogo: **80 jugadores, 20 por posición**.
- Ratings normalizados: enteros entre 1 y 99.
- Las estadísticas acumuladas no pueden ser negativas.
- Las penalizaciones posicionales deben aplicarse en la lógica del dominio, no solo mostrarse en la interfaz.
- La actualización de ranking debe calcularse en un único lugar y guardar el resultado junto con el partido.
- El backend valida reglas críticas aunque también se validen en la interfaz.

### Decisión pendiente: formaciones

La propuesta menciona “5 formaciones” pero enumera seis esquemas: `1-2-2-1`, `1-2-1-2`, `1-1-2-2`, `1-3-1-1`, `1-1-3-1` y `1-1-1-3`. Los prototipos también muestran opciones de formación. Antes de codificar el catálogo definitivo, el equipo debe acordar si se implementan las seis o si se excluye una. No borrar ni inventar una opción sin registrar la decisión.

### Decisión pendiente: nombres y métricas de atributos

La propuesta de datos define cuatro ratings: ataque, creación, defensa y físico. Algunos prototipos visuales muestran también ritmo, táctica u otras métricas. Para el MVP, usar los cuatro atributos oficiales como base del radar; documentar cualquier métrica adicional y definir cómo se calcula antes de incorporarla.

## Pantallas de referencia

- Onboarding / cómo jugar (tres pasos).
- Registro y login.
- Inicio / dashboard del mánager.
- Mercado de fichajes.
- Comparativa de jugadores.
- Pizarra táctica / alineación.
- Partido en directo: cronología y estadísticas.
- Modal de resultado del partido.
- Historial de partidos y detalle.
- Ranking global.
- Perfil / preferencias.
- Panel de administración ABM.
- Dashboard analítico.

La guía de pantallas y responsabilidades está en `ARQUITECTURA.md`.

## Convenciones del equipo

- Mantener el código de presentación separado de reglas de negocio y acceso a datos.
- No copiar colores, tamaños ni sombras directamente en cada pantalla: importar los tokens compartidos.
- Una tarea por rama y Pull Request pequeño.
- No editar el mismo archivo de pantalla en paralelo sin coordinarlo.
- Usar nombres de clases por componente, evitar selectores globales demasiado amplios.
- No guardar contraseñas en texto plano ni secretos en el repositorio.
- Nunca usar `localStorage` como autoridad para presupuesto, puntuación o permisos; el backend debe validar esos datos.
- Cada PR debe incluir pruebas o una lista reproducible de verificación manual.

## Documentos del proyecto

- `README.md`: visión general, stack y reglas principales.
- `DESIGN.md`: guía visual y criterios de uso.
- `src/styles/design-tokens.css`: valores de diseño reutilizables desde CSS.
- `GUIA_DESARROLLO.md`: paso a paso para comenzar.
- `ARQUITECTURA.md`: estructura de directorios, pantallas y reparto del trabajo.
