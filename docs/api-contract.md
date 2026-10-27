# Contrato de API RESTful (API Contract)

Especificación de endpoints base para el backend FastAPI.

## Endpoints Principales

### 1. Autenticación (`/api/v1/auth`)
- `POST /register`: Registro de nuevo director técnico / usuario.
- `POST /login`: Inicio de sesión, retorna JWT `access_token`.
- `GET /me`: Obtener perfil autenticado.

### 2. Jugadores / Leyendas (`/api/v1/players`)
- `GET /`: Listar catálogo de leyendas (soporta filtros por posición, precio, valoración).
- `GET /{player_id}`: Detalle de leyenda, estadísticas históricas y atributos.

### 3. Plantillas / Alineaciones (`/api/v1/squads`)
- `GET /my-squad`: Obtener la plantilla activa del usuario autenticado.
- `POST /save`: Guardar o actualizar alineación (valida tope 100M y regla de 11 jugadores).
- `GET /validate`: Simulación de validación de penalizaciones tácticas.

### 4. Partidos y Simulación (`/api/v1/matches`)
- `POST /simulate`: Ejecutar simulación entre dos plantillas.
- `GET /history`: Historial de encuentros del usuario.

### 5. Ranking y Clasificación (`/api/v1/ranking`)
- `GET /leaderboard`: Tabla general de posiciones de managers.

### 6. Analíticas (`/api/v1/analytics`)
- `GET /meta-stats`: Jugadores más elegidos, formaciones más efectivas.
