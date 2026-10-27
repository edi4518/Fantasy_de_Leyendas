# Arquitectura de la aplicación y organización del trabajo

## 1\. Arquitectura por capas

Mantener estas responsabilidades separadas:

1. **Presentación (frontend):** HTML semántico, componentes visuales, navegación, accesibilidad y estados de pantalla.  
2. **Estilos:** tokens, estilos globales, layout y CSS por componente/pantalla.  
3. **Aplicación frontend:** controladores de pantalla, validación inmediata, estado de interfaz y coordinación de acciones.  
4. **Servicios HTTP:** funciones que llaman a la API y transforman respuestas/errores a un formato uniforme.  
5. **Backend API:** endpoints, autenticación, autorización y serialización.  
6. **Dominio:** reglas de presupuesto, plantilla, formaciones, penalizaciones, simulación y ranking.  
7. **Persistencia:** repositorios/consultas y base de datos MySQL.  
8. **PWA:** manifiesto, Service Worker, caché y experiencia offline.

Una pantalla no debe consultar MySQL ni calcular reglas críticas. El frontend puede mostrar validaciones inmediatas, pero el backend vuelve a validar antes de guardar o simular.

## 2\. Estructura de directorios recomendada

```
fantasy-de-leyendas/
├── README.md
├── DESIGN.md
├── ARQUITECTURA.md
├── GUIA_DESARROLLO.md
├── .gitignore
├── .env.example
├── docs/
│   ├── api-contract.md
│   ├── data-dictionary.md
│   ├── decisions/
│   │   ├── 001-frontend-vanilla.md
│   │   └── 002-formaciones.md
│   └── qa-checklist.md
├── public/
│   ├── index.html
│   ├── manifest.webmanifest
│   ├── sw.js
│   ├── icons/
│   └── images/
├── src/
│   ├── app/
│   │   ├── main.js
│   │   ├── router.js
│   │   └── navigation.js
│   ├── styles/
│   │   ├── design-tokens.css
│   │   ├── reset.css
│   │   ├── global.css
│   │   ├── layout.css
│   │   ├── components.css
│   │   └── screens/
│   │       ├── auth.css
│   │       ├── dashboard.css
│   │       ├── market.css
│   │       ├── comparison.css
│   │       ├── lineup.css
│   │       ├── match.css
│   │       ├── history.css
│   │       ├── ranking.css
│   │       └── admin.css
│   ├── components/
│   │   ├── button/
│   │   ├── input/
│   │   ├── card/
│   │   ├── badge/
│   │   ├── bottom-navigation/
│   │   ├── modal/
│   │   ├── player-card/
│   │   ├── metric-bar/
│   │   └── pitch/
│   ├── screens/
│   │   ├── onboarding/
│   │   │   ├── onboarding.html
│   │   │   └── onboarding.js
│   │   ├── auth/
│   │   │   ├── login.html
│   │   │   ├── register.html
│   │   │   └── auth.js
│   │   ├── dashboard/
│   │   │   ├── dashboard.html
│   │   │   └── dashboard.js
│   │   ├── market/
│   │   │   ├── market.html
│   │   │   └── market.js
│   │   ├── comparison/
│   │   │   ├── comparison.html
│   │   │   └── comparison.js
│   │   ├── lineup/
│   │   │   ├── lineup.html
│   │   │   └── lineup.js
│   │   ├── match/
│   │   │   ├── live-match.html
│   │   │   ├── match-result.html
│   │   │   └── match.js
│   │   ├── history/
│   │   │   ├── history.html
│   │   │   └── history.js
│   │   ├── ranking/
│   │   │   ├── ranking.html
│   │   │   └── ranking.js
│   │   ├── profile/
│   │   │   ├── profile.html
│   │   │   └── profile.js
│   │   └── admin/
│   │       ├── players-admin.html
│   │       └── players-admin.js
│   ├── services/
│   │   ├── api-client.js
│   │   ├── auth-service.js
│   │   ├── player-service.js
│   │   ├── squad-service.js
│   │   ├── match-service.js
│   │   ├── ranking-service.js
│   │   └── analytics-service.js
│   ├── domain/
│   │   ├── squad-rules.js
│   │   ├── formation-rules.js
│   │   ├── position-penalties.js
│   │   └── formatters.js
│   └── assets/
│       ├── images/
│       └── icons/
├── backend/
│   ├── requirements.txt
│   ├── .env.example
│   ├── app/
│   │   ├── main.py
│   │   ├── core/
│   │   │   ├── config.py
│   │   │   └── security.py
│   │   ├── api/
│   │   │   └── routes/
│   │   │       ├── auth.py
│   │   │       ├── players.py
│   │   │       ├── squads.py
│   │   │       ├── matches.py
│   │   │       ├── ranking.py
│   │   │       ├── analytics.py
│   │   │       └── admin.py
│   │   ├── schemas/
│   │   ├── models/
│   │   ├── repositories/
│   │   ├── services/
│   │   │   ├── simulation_service.py
│   │   │   ├── squad_service.py
│   │   │   ├── ranking_service.py
│   │   │   └── player_service.py
│   │   └── tests/
│   ├── migrations/
│   └── seed/
│       └── players_seed.csv
└── tests/
    ├── frontend/
    └── integration/
```

Esta es una estructura objetivo, no es necesario crear todos los archivos vacíos el primer día. Crear carpetas al iniciar cada módulo.

## 3\. Cómo trabajar cada pantalla

Cada pantalla se implementa con una ficha breve que indique propósito, datos, acciones, validaciones, errores, API y criterios de aceptación. La lista de abajo asigna responsabilidades de interfaz y lógica.

### Onboarding / Cómo jugar

- **Objetivo:** explicar presupuesto, formaciones y criterio GOAT.  
- **UI:** carrusel de tres pasos, imagen, puntos de progreso, Saltar, Próximo/Ir al login.  
- **Datos:** preferentemente contenido estático versionado.  
- **Criterios:** se puede saltar; el último paso conduce al login; se adapta a pantallas pequeñas.

### Login y registro

- **Objetivo:** crear cuenta y autenticar al mánager.  
- **UI:** formularios, validación, estados de carga y error, navegación entre pantallas.  
- **API:** `/api/auth/register`, `/api/auth/login`, `/api/me`.  
- **Criterios:** errores accesibles; no mostrar secretos; el acceso al ABM depende del rol del usuario.

### Inicio / dashboard del mánager

- **Objetivo:** resumir plantilla, presupuesto, rating/posición global y últimos resultados.  
- **UI:** tarjeta de presupuesto, plantilla resumida, último partido, acceso a Buscar rival.  
- **API:** perfil, plantilla, historial reciente y ranking.  
- **Criterios:** los datos provienen de servicios; estado vacío si todavía no hay plantilla/partidos.

### Mercado de fichajes

- **Objetivo:** explorar el catálogo y fichar jugadores sin superar 100M.  
- **UI:** búsqueda, filtros POR/DEF/MC/DEL, precio, tarjetas/listado y comparar.  
- **API:** `GET /api/players`; operaciones de plantilla.  
- **Criterios:** filtros combinables; no permitir fichajes duplicados si la regla de dominio lo prohíbe; mostrar presupuesto restante; el backend confirma disponibilidad y coste.

### Comparativa de jugadores

- **Objetivo:** contrastar dos o más leyendas.  
- **UI:** tarjetas de jugadores, gráfico radar, métricas individuales y leyenda.  
- **Datos:** ratings de ataque, creación, defensa y físico; métricas complementarias solo si están definidas en el modelo.  
- **Criterios:** colores por jugador consistentes; quitar/agregar jugador actualiza gráfico y estadísticas; ofrecer alternativa textual a la visualización.

### Pizarra táctica / alineación

- **Objetivo:** ubicar seis titulares en la formación seleccionada y gestionar tres suplentes.  
- **UI:** cancha, slots, selector de formación, reservas, equilibrio del equipo, avisos de penalización.  
- **Dominio:** validación de plantilla, presupuesto y penalización posicional 15–25%.  
- **Criterios:** no guardar formación inválida; cálculo de coste coherente con mercado; mostrar la razón y el porcentaje de la penalización.

### Partido en directo

- **Objetivo:** representar la simulación y sus eventos.  
- **UI:** marcador, estado, cancha, pestañas cronología/estadísticas/alineaciones, botón de simulación rápida.  
- **API:** endpoint de simulación y consulta de eventos.  
- **Criterios:** eventos ordenados por minuto; estado final inequívoco; modo rápido llega al resumen sin reproducir todos los eventos visualmente.  
- **Nota:** no asumir WebSockets; la propuesta excluye partidas sincrónicas entre usuarios.

### Resultado del partido

- **Objetivo:** mostrar marcador final, resultado, jugador destacado, puntos ganados/perdidos y posición actualizada.  
- **UI:** modal, tarjetas de resumen y acciones para siguiente partido o inicio.  
- **Criterios:** no actualizar puntos dos veces al recargar; el resultado persistido es la fuente de verdad.

### Historial de partidos

- **Objetivo:** consultar los últimos partidos y abrir su detalle.  
- **UI:** lista de tarjetas, marcador, rival, fecha, puntos y acceso al detalle.  
- **API:** `GET /api/matches`, `GET /api/matches/{id}`.  
- **Criterios:** estado vacío, paginación si hiciera falta y detalle consistente con el resultado guardado.

### Ranking global

- **Objetivo:** comparar la puntuación de mánagers.  
- **UI:** podio, lista ordenada, variación de posición y tarjeta del usuario.  
- **API:** `GET /api/ranking`.  
- **Criterios:** orden estable y cambio de puntos trazable al partido que lo originó.

### Perfil / preferencias

- **Objetivo:** actualizar nombre, equipo, foto y preferencias.  
- **UI:** campos editables, toggles de notificaciones/sonido y cierre de sesión.  
- **Criterios:** validación de cambios; estados guardado/error; no exponer el email si no corresponde.

### Administración ABM

- **Objetivo:** gestionar el catálogo de 80 leyendas y los parámetros permitidos.  
- **UI:** tabla/listado, filtros, alta, edición, desactivación con confirmación.  
- **API:** rutas `/api/admin/...` protegidas.  
- **Criterios:** validación de ratings 1–99, estadísticas no negativas, integridad referencial y auditoría mínima de cambios.

### Dashboard analítico

- **Objetivo:** exponer indicadores comparativos y agregados.  
- **UI:** gráficos radar y visualizaciones definidas en la propuesta; integración Power BI si la disponibilidad del servicio y las credenciales lo permiten.  
- **Criterios:** no inventar datos cuando el servicio no esté disponible; mostrar estado de carga/error y fuente de los datos.

## 4\. Reparto sugerido para cuatro participantes

Ajustar según experiencia y carga real. Una persona no debe ser la única que conoce una parte crítica; cada módulo debe tener una segunda persona revisora.

| Participante | Responsabilidad principal | Entregables |
| :---- | :---- | :---- |
| Persona A — Frontend base y diseño | shell, navegación, tokens, componentes comunes, login/registro y perfil | `src/styles/`, `src/components/`, pantallas auth/profile, revisión visual |
| Persona B — Mercado y plantilla | catálogo, filtros, fichajes, presupuesto, pizarra táctica y penalizaciones | pantallas market/lineup, servicios de jugadores/plantilla y reglas de alineación |
| Persona C — Backend y datos | FastAPI, MySQL, autenticación, modelos, migraciones, endpoints y ABM | `backend/app/models`, `api/routes`, repositorios, seed y tests API |
| Persona D — Simulación y analítica | motor de simulación, eventos, resultado, historial, ranking, radar/dashboard y pruebas de integración | servicios de simulación/ranking, pantallas match/history/ranking/comparison y gráficos |

### Trabajo compartido

- Todos revisan `DESIGN.md` y usan los tokens.  
- La Persona C acuerda contratos API con A, B y D antes de implementar endpoints.  
- La Persona D acuerda con C el formato persistido de eventos y resultados.  
- A mantiene el sistema visual, pero cada responsable escribe el CSS específico de su pantalla siguiendo los tokens.  
- Cada participante escribe pruebas de su módulo y otra persona revisa el PR.  
- Rotar las demos; la persona responsable explica decisiones y limitaciones.

## 5\. Flujo de trabajo por tarea

1. Crear issue con objetivo, pantalla/módulo y criterios de aceptación.  
2. Confirmar contrato de datos/API si hay integración.  
3. Crear rama `feat/nombre-corto`.  
4. Implementar presentación, lógica y pruebas en sus capas correspondientes.  
5. Probar el flujo de forma aislada.  
6. Abrir PR con capturas si hay cambios visuales y pasos de prueba.  
7. Un compañero revisa lógica, consistencia visual y accesibilidad.  
8. Integrar solo cuando no haya conflictos y las pruebas estén verdes.  
9. Actualizar documentación si cambió un contrato, regla o token.

## 6\. Convenciones de nombres

- JavaScript: `camelCase` para funciones/variables; `PascalCase` solo si el equipo adopta clases.  
- CSS: clases por componente, por ejemplo `.player-card__price`; tokens CSS `--color-primary`.  
- Python: `snake_case`.  
- API JSON: elegir `snake_case` o `camelCase` y mantenerlo consistentemente.  
- Rutas y archivos: minúsculas con guiones.  
- Usar IDs estables para jugadores; no usar el nombre como identificador de relación.