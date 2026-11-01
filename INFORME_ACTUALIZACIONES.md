# 🏆 Fantasy de Leyendas - Informe Completo de Actualizaciones y Nuevas Funcionalidades

**Rama activa:** `feat/pantallas-franco`  
**Versión / Hito:** Fase 4 - Módulo de Partido y Motor Táctico 6v6  
**Fecha de informe:** 1 de Noviembre de 2026  

---

## 📌 Resumen Ejecutivo

Durante esta fase de desarrollo se ha completado la integración y refinamiento del **Módulo de Partido en Vivo** (*Live Match Engine*), la conexión con la pantalla principal de Inicio (*Home*), la persistencia de adversarios controlados por la computadora (CPU), y una serie de optimizaciones visuales y de diseño que elevan la experiencia a nivel de un videojuego de gestión deportiva profesional.

A continuación se detalla cada funcionalidad, cambio arquitectónico y mejora estética implementada.

---

## ⚽ 1. Motor Táctico 6v6 y Simulación por Ciclos (`simulation-engine.js`)

Se diseñó e implementó un motor matemático cliente-servidor capaz de simular encuentros de fútbol reducido 6v6 con alto rigor táctico:

### 1.1. Reglas Tácticas y Formaciones Oficiales
- **6 Formaciones Soportadas**:
  - `1-2-2-1` (Equilibrada)
  - `1-1-3-1` (Ofensiva / Rombo)
  - `1-3-1-1` (Defensiva)
  - `1-2-1-2` (Transición Rápida)
  - `1-1-2-2` (Doble Punta)
  - `1-1-1-3` (Ataque Total)
- **Sistema de Ventaja Táctica (*Counters*)**: Cada formación posee un counter natural (+15% de efectividad para el equipo contrarrestante, -10% para el contrarrestado).
- **Penalización por Posición**:
  - *Posición natural:* 100% de eficiencia (0% penalización).
  - *Posición similar:* 85% de eficiencia (15% penalización).
  - *Posición opuesta / Portero:* 75% de eficiencia (25% penalización).
- **Desgaste Físico por Fatiga**: A partir del minuto 55', los titulares acumulan una reducción gradual de rendimiento físico si no son sustituidos.

### 1.2. Sistema Ampliado de 20 Snapshots (~4.5 min por ciclo)
Se expandió la simulación de 10 a **20 estados temporales**, cubriendo de forma realista los 90 minutos de juego:
- **Mayor diversidad de eventos generados**:
  1. *Goles de Jugada Colectiva* (con cálculo de duelo atacante vs. portero).
  2. *Goles de Tiro Libre Directo* y *Tiros Libres Peligrosos*.
  3. *Goles de Cabeza tras Córner*.
  4. *Penaltis convertidos y Penaltis atajados*.
  5. *Atajadas Clave de los porteros*.
  6. *Tiros de Esquina tácticos*.
  7. *Tarjetas Disciplinarias* (Amarillas y Rojas directas).
- **Hitos Cronológicos Claros**:
  - `0' INICIO DEL PARTIDO` (píldora divisoria de inicio).
  - `45' DESCANSO` (píldora divisoria de entretiempo).
  - `90' FIN DEL PARTIDO` (píldora divisoria de conclusión).
- **Sustituciones Escalonadas**:
  - En lugar de cambios masivos en el mismo minuto, los 3 cambios por equipo ocurren de forma progresiva en el segundo tiempo (ciclos 12, 13, 15, 16, 17 y 18: minutos ~54', 59', 68', 72', 77' y 81').
  - Cada cambio refleja claramente el jugador que entra y el que sale (`🔄 Entra X por Y`).

---

## 🤖 2. Equipos Rivales CPU (`cpu-teams.json`)

Para posibilitar el emparejamiento inmediato sin esperar a otros usuarios reales:
1. **Catálogo de Equipos de Leyendas**:
   - Integración completa de plantillas históricas balanceadas en formato JSON.
   - Limpieza exhaustiva de nombres: se eliminó la formación embebida (ej. `"Los Renacidos (1-1-1-3)"` fue saneado a `"Los Renacidos"`), delegando la visualización táctica a la pestaña correspondiente.
2. **Doble Persistencia**:
   - **Frontend:** Ubicado en `src/data/cpu-teams.json` y expuesto vía `src/data/cpu-teams.js` con selector aleatorio `getRandomCpuTeam()`.
   - **Backend:** Ubicado en `backend/app/seed/cpu_teams.json` y servido mediante la ruta REST `GET /api/matches/cpu-opponents`.

---

## 🔍 3. Flujo de Emparejamiento (Matchmaking en `home.html`)

En la vista principal de Inicio:
- **Animación Radar**: Al presionar **"Buscar rival"**, el botón activa un estado pulsante que muestra `"BUSCANDO RIVAL..."`.
- **Feedback de Emparejamiento**: Tras detectar adversario, el botón actualiza su estado a `"Rival encontrado"` (eliminando emojis predeterminados) y efectúa una redirección automática a `src/pages/match-detail.html?autoplay=true`.
- **Prevención de Salto Inmediato**: Se reemplazó el atributo `onclick` estático en HTML por un controlador asíncrono robusto en `src/js/views/home.js`.

---

## ⏱️ 4. Reloj Acelerado Minuto a Minuto (`#match-status-badge`)

En la pantalla de partido en vivo:
- **Evolución Minuto a Minuto**:
  - El elemento `<span id="match-status-text">` ya no salta de 5 en 5 minutos. Corre en tiempo acelerado continuo: `EN VIVO 1'`, `EN VIVO 2'`, `EN VIVO 3'`, `...`, `EN VIVO 90'`.
  - Frecuencia de refresco: **150 ms por minuto simulado** (~15 segundos totales de simulación), permitiendo una lectura fluida y emocionante.
- **Pausa Táctica en Entretiempo**:
  - Al minuto 45', el badge pasa automáticamente a **`DESCANSO`**, detiene el pulso del indicador y realiza una pausa inmersiva de 1.1 segundos antes de reanudar el segundo tiempo al minuto 46'.
- **Sincronización con la Cronología**:
  - Al coincidir el minuto del reloj con un evento generado, este se añade dinámicamente a la cronología, se actualiza el marcador con micro-animación de impacto (*score bump*) y se refrescan las estadísticas en vivo.
- **Estabilidad de Interfaz**:
  - Se añadieron reglas CSS con `font-variant-numeric: tabular-nums` y ancho mínimo definido (`min-width: 96px`) para eliminar temblores horizontales en el marcador al variar los dígitos.

---

## 🎨 5. Iconografía Vectorial SVG Temática Personalizada

Se eliminaron todos los caracteres emoji o emotes estándar del sistema operativo (⚽, 🟨, 🟥, 🔄, 🚩, 🧤, 🎯) y se sustituyeron por **iconos vectoriales SVG diseñados específicamente para el juego**:

| Evento | Icono Vectorial SVG | Especificación Visual |
| :--- | :--- | :--- |
| **Gol Local (`goal`)** | Balón geométrico esmeralda | Círculo blanco con pentágono central verde bosque (`#065F46`), costuras y borde esmeralda (`#10B981`). |
| **Gol Visitante (`goal`)** | Balón geométrico pizarra | Círculo con costuras y pentágono gris pizarra (`#334155` y `#64748B`). |
| **Gol de Penal (`penalty-goal`)** | Red de portería y balón | Marco de postes, red cuadriculada punteada, balón en el ángulo y trazos dorados de velocidad. |
| **Tarjeta Amarilla (`yellow-card`)** | Tarjeta de árbitro dorada | Rectángulo con rotación dinámica de 7°, relleno ámbar (`#F59E0B`), borde oscuro y brillo superior. |
| **Tarjeta Roja (`red-card`)** | Tarjeta de árbitro carmesí | Rectángulo con rotación dinámica de 7°, relleno rojo fuego (`#EF4444`), borde borgoña y brillo superior. |
| **Sustitución (`substitution`)** | Flechas tácticas de cambio | Dos flechas curvas concéntricas: verde ascendente (Entra) y roja descendente (Sale). |
| **Tiro de Esquina (`corner`)** | Banderín de córner | Cuadrante de campo punteado, asta metálica y banderín flameante en oro deportivo (`#F59E0B`). |
| **Atajada Clave (`save`)** | Guante de arquero | Silueta anatómica de guante acolchado en azul cian (`#0284C7`), almohadilla palmar y muñequera. |
| **Tiro Libre (`freekick`)** | Balón sobre césped y arco | Balón con trayectoria parabólica táctica discontinua hacia el objetivo en escuadra. |

### Disposición y Estilizado:
- **Alineación Simétrica de Transmisión Deportiva**:
  - Lado Local (Izquierda): `[Jugador - Detalle] [ICONO SVG]   12'   [ICONO SVG] [Jugador - Detalle]` : Lado Visitante (Derecha).
- **Micro-interacciones**: Sombra sutil `filter: drop-shadow(0 1px 2px rgba(0,0,0,0.12))` y escalado `transform: scale(1.18)` al posar el cursor.

---

## 📱 6. Ajustes de Viewport, Scroll y Pestañas

Para garantizar un comportamiento óptimo en pantallas móviles y de escritorio:
- **Bloqueo de Viewport (`100vh` / `100dvh`)**:
  - Tanto `class="match-detail-body"` como `id="match-view"` tienen altura contenida estricta sin desbordar el alto del dispositivo (`overflow: hidden`).
- **Scroll Independiente en Cronología**:
  - La sección `#panel-cronologia` cuenta con desplazamiento vertical interno fluido (`overflow-y: auto`) con barra de desplazamiento estilizada de 6px a la derecha.
- **Pestaña Alineaciones con Suplentes**:
  - Ahora muestra los **6 Titulares** y una sección separada con subtítulo **`SUPLENTES`** donde figuran los 3 jugadores de banquillo con sus dorsales, roles y medias.

---

## 🔗 7. Integración Híbrida Frontend - Backend

- **FastAPI Backend**:
  - Endpoint `POST /api/matches/simulate` para validación y registro de encuentros en base de datos.
  - Endpoint `GET /api/matches/cpu-opponents` para obtención de rivales.
  - Endpoint `GET /api/matches/history` para consulta de resultados anteriores.
- **PWA Offline First**:
  - Si el backend se encuentra desconectado o en fallo de red, el servicio cliente (`matchService`) genera el encuentro táctico inmediatamente mediante `simulation-engine.js` y almacena el resultado en `localStorage`, garantizando cero bloqueos o pantallas en blanco.

---

## 📂 8. Archivos Principales Involucrados

| Archivo | Rol en el Proyecto |
| :--- | :--- |
| `src/domain/simulation-engine.js` | Motor táctico 6v6, 20 ciclos, eventos, fatiga y sustituciones. |
| `src/domain/formation-rules.js` | Definición de las 6 formaciones, roles y reglas de contra-táctica. |
| `src/js/views/match-detail.js` | Controlador de vista, ticker minuto a minuto, SVGs y renderizado. |
| `src/styles/views/match-detail.css` | Estilos de pantalla de partido, badge de estado, tabs y scroll. |
| `src/styles/screens/match.css` | Espejo sincronizado de estilos de partido para componentes modulares. |
| `src/pages/match-detail.html` | Estructura HTML de la pantalla de detalle y partido en directo. |
| `src/js/views/home.js` | Controlador de inicio, animación de búsqueda de rival y redirección. |
| `src/services/match-service.js` | Servicio de emparejamiento, simulación híbrida y persistencia. |
| `src/data/cpu-teams.json` / `.js` | Banco de datos de equipos legendarios CPU con nombres limpios. |
| `backend/app/seed/cpu_teams.json` | Semilla de adversarios para el backend FastAPI. |
| `backend/app/services/simulation_service.py` | Motor de simulación equivalente en Python. |

---

*Informe generado automáticamente para el repositorio de **Futbol Fantasy Legend**.*
