# Guía paso a paso para empezar a programar

Esta guía parte de la propuesta académica: frontend HTML/CSS/JavaScript Vanilla, backend Python/FastAPI, MySQL, Chart.js y soporte PWA. El equipo puede ajustar versiones, pero debe dejar la decisión registrada en el README.

## Fase 0 — Alinear al equipo (antes de programar)

1. Leer la propuesta y recorrer todos los prototipos de Stitch.
2. Acordar el MVP, las reglas de negocio y las pantallas obligatorias.
3. Resolver la discrepancia de la propuesta sobre el número de formaciones: dice cinco, pero enumera seis.
4. Acordar el modelo de datos y los nombres de campos en español o inglés. No mezclar convenciones.
5. Crear un tablero con tareas, responsables, prioridad y criterios de aceptación.
6. Definir revisión por Pull Request y una persona responsable de integrar cada rama.

## Fase 1 — Crear repositorio y estructura

1. Crear un repositorio Git compartido.
2. Crear la estructura indicada en `ARQUITECTURA.md`.
3. Añadir `.gitignore` para `.env`, entornos virtuales, cachés, dependencias y archivos de editor.
4. Añadir `README.md`, `DESIGN.md`, `ARQUITECTURA.md`, esta guía y `src/styles/design-tokens.css`.
5. Crear ramas de trabajo: `main` protegida, `develop` (si el equipo la necesita) y ramas cortas `feat/...`, `fix/...`, `docs/...`.
6. Añadir `CONTRIBUTING.md` si el equipo necesita reglas más detalladas.

## Fase 2 — Configurar backend FastAPI

Desde la carpeta `backend/`:

```bash
python -m venv .venv
```

Activar entorno virtual:
- Windows PowerShell: `.venv\\Scripts\\Activate.ps1`
- macOS/Linux: `source .venv/bin/activate`

Instalar paquetes iniciales:

```bash
pip install fastapi "uvicorn[standard]" sqlalchemy pymysql pydantic-settings pytest httpx
pip freeze > requirements.txt
```

> SQLAlchemy y PyMySQL son una propuesta práctica para conectar Python con MySQL; la propuesta del proyecto no obliga a una librería ORM concreta. El equipo puede elegir otra y documentarla.

Crear `backend/.env.example` con variables vacías o valores de ejemplo no secretos:

```env
APP_ENV=development
DATABASE_URL=mysql+pymysql://usuario:clave@localhost:3306/fantasy_leyendas
CORS_ORIGINS=http://localhost:5500
```

No subir el archivo `.env` real al repositorio.

Crear la aplicación mínima (`backend/app/main.py`):

```python
from fastapi import FastAPI

app = FastAPI(title="Fantasy de Leyendas API", version="0.1.0")

@app.get("/api/health")
def health():
    return {"status": "ok"}
```

Ejecutar desde `backend/`:

```bash
uvicorn app.main:app --reload
```

Verificar `http://127.0.0.1:8000/api/health` y `http://127.0.0.1:8000/docs`.

## Fase 3 — Modelar la base de datos

1. Crear base de datos `fantasy_leyendas`.
2. Implementar las entidades de la propuesta y revisar el diagrama entidad-relación.
3. Crear migraciones versionadas; no depender de cambios manuales locales.
4. Agregar claves foráneas y restricciones.
5. Cargar inicialmente las 80 leyendas (20 por posición) y validar los datos.
6. Crear pruebas de integridad: ratings 1–99, métricas no negativas y jugadores no duplicados según la regla que acuerde el equipo.

Entidades mínimas a modelar:
- Usuario/Mánager.
- Jugador/Leyenda.
- Plantilla.
- Detalle de plantilla (jugador, posición asignada, titular/suplente).
- Partido.
- Evento del partido.
- Historial de puntuación/ranking.
- Configuración de simulación o parámetros, si el administrador puede calibrarlos.

No guardar contraseñas en texto plano. Usar hashing de contraseñas y sesiones/tokens con un mecanismo elegido y revisado por el equipo.

## Fase 4 — Diseñar API antes de conectar pantallas

Definir contrato de endpoints y ejemplos JSON antes de que frontend y backend trabajen en paralelo. Propuesta inicial:

| Método | Ruta | Responsabilidad |
|---|---|---|
| GET | `/api/health` | Estado de API |
| POST | `/api/auth/register` | Registrar mánager |
| POST | `/api/auth/login` | Iniciar sesión |
| GET | `/api/me` | Perfil actual |
| GET | `/api/players` | Listar, buscar y filtrar leyendas |
| GET | `/api/players/{id}` | Detalle de jugador |
| POST/PATCH/DELETE | `/api/admin/players...` | ABM protegido |
| GET | `/api/squad` | Consultar plantilla |
| PUT | `/api/squad` | Guardar/validar plantilla |
| GET | `/api/players/compare` | Datos de comparación, o resolver comparación en frontend con datos del catálogo |
| POST | `/api/matches/simulate` | Simulación rápida |
| POST | `/api/matches/simulate/live` | Generar o iniciar eventos de simulación |
| GET | `/api/matches` | Historial |
| GET | `/api/matches/{id}` | Detalle de partido |
| GET | `/api/ranking` | Ranking global |
| GET | `/api/analytics/summary` | Métricas resumidas para dashboard |

El sufijo `/live` no implica WebSockets. La propuesta excluye partidas sincrónicas en tiempo real entre usuarios. Para una simulación local minuto a minuto puede usarse una respuesta con eventos o polling sencillo; acordar el enfoque y documentarlo.

## Fase 5 — Crear el sistema visual reutilizable

1. Importar `src/styles/design-tokens.css` antes de los estilos de componentes.
2. Crear `reset.css`, `global.css` y `layout.css`.
3. Implementar botones, inputs, tarjetas, badges, navegación inferior y modal.
4. Probar los componentes con los tamaños de pantalla de los prototipos y con anchuras más pequeñas.
5. Acordar que ningún componente repita colores o radios hardcodeados si existe un token equivalente.

Ejemplo de carga en `index.html`:

```html
<link rel="stylesheet" href="/src/styles/design-tokens.css">
<link rel="stylesheet" href="/src/styles/reset.css">
<link rel="stylesheet" href="/src/styles/global.css">
<link rel="stylesheet" href="/src/styles/components.css">
```

## Fase 6 — Construir pantallas por flujo de usuario

Orden recomendado:
1. Shell de la app, rutas y navegación.
2. Login y registro.
3. Inicio/perfil del mánager.
4. Catálogo y mercado.
5. Comparador de jugadores y radar.
6. Alineación y validaciones de presupuesto.
7. Motor de simulación y partido en directo.
8. Resultado final e historial.
9. Ranking y actualización ELO/MMR.
10. Administración ABM.
11. Dashboard analítico e integración Power BI, según alcance disponible.
12. Onboarding y detalles de experiencia.

Cada pantalla debe tener HTML/JS de presentación, CSS propio, un módulo de lógica de interfaz y una capa de servicios para API. No implementar reglas de negocio complejas dentro del click handler del botón.

## Fase 7 — Motor de simulación

1. Definir formalmente la fórmula de ponderación de ataque, creación, defensa y físico.
2. Definir cómo influyen las formaciones y las penalizaciones por rol incorrecto (15–25%).
3. Definir los tipos de evento y sus probabilidades.
4. Asegurar que la simulación use una semilla opcional en pruebas para reproducir resultados.
5. Guardar resultado, eventos y cambio de ranking en una operación consistente.
6. Probar casos extremos: equipo sin plantilla completa, presupuesto excedido, empate, victoria y derrota.

La propuesta establece el enfoque estocástico, pero no fija una fórmula matemática completa. La fórmula debe ser una decisión explícita del equipo, no una constante improvisada en varios archivos.

## Fase 8 — PWA

1. Crear `public/manifest.webmanifest` con nombre, nombre corto, colores, `start_url`, `display` e iconos.
2. Crear `public/sw.js` para cachear recursos estáticos esenciales.
3. Definir estrategia de caché: estáticos primero; API dinámica con una estrategia adecuada y manejo de errores.
4. Mostrar un estado claro cuando se está offline.
5. No cachear respuestas privadas o datos sensibles sin diseñar cuidadosamente su invalidación.
6. Probar instalación y actualización del Service Worker en Chrome/Android y navegadores objetivo.
7. Recordar que Service Workers requieren localhost o HTTPS.

## Fase 9 — Pruebas y revisión

- **Frontend:** validaciones de formularios, navegación, filtros, estados vacíos y errores.
- **Backend:** pruebas de endpoints, autorización, validación de datos y reglas de negocio.
- **Integración:** fichar jugadores, guardar plantilla, simular partido y actualizar ranking.
- **Responsive:** móvil estrecho, móvil estándar, tablet y escritorio.
- **PWA:** instalación, recarga, caché y comportamiento offline.
- **Accesibilidad:** teclado, foco, labels, contraste y lectura alternativa de gráficos.
- **Datos:** catálogo de 80 jugadores y 20 por posición.
- **Seguridad:** credenciales, roles de administrador, CORS y secretos.

## Fase 10 — Entrega

1. Completar `README.md` con instalación real verificada.
2. Revisar que `.env`, contraseñas y datos sensibles no estén en Git.
3. Ejecutar todas las pruebas desde un entorno limpio.
4. Documentar limitaciones conocidas.
5. Hacer una demo de los flujos principales y repartir quién presenta cada módulo.
