# Design System — Fantasy de Leyendas

## 1. Principios visuales

La interfaz combina un dashboard deportivo analítico con referencias al fútbol clásico. Debe sentirse táctica, sobria, confiable y clara; evitar efectos arcade innecesarios. La prioridad es leer rápidamente nombres, presupuesto, posiciones, resultados y métricas.

Los HTML y capturas de Google Stitch muestran una línea visual consistente en la mayoría de pantallas: fondo gris muy claro, tarjetas blancas, texto carbón, verde de cancha como color principal y acentos dorados/rojos para estados. Los archivos `DESIGN.md` anteriores contenían también una alternativa oscura con Space Grotesk y Manrope que no coincide con la mayoría de los prototipos actuales. Para reducir inconsistencias, este sistema toma como base el diseño claro y la fuente Plus Jakarta Sans. El tema oscuro puede evaluarse en una iteración posterior.

## 2. Tokens de color

Los valores canónicos están definidos en `src/styles/design-tokens.css`. En el código de pantalla, usar variables CSS en lugar de repetir hexadecimales.

| Token | Valor | Uso |
|---|---|---|
| `--color-primary` | `#2D6A4F` | CTA principal, navegación activa, selección confirmada |
| `--color-primary-hover` | `#245640` | Hover/pressed del verde principal |
| `--color-primary-dark` | `#1B4130` | Verde profundo para cancha y elementos de énfasis |
| `--color-primary-light` | `#EAF3EE` | Fondos suaves de estados positivos/selección |
| `--color-background` | `#F8F9FA` | Fondo global de la aplicación |
| `--color-surface` | `#FFFFFF` | Tarjetas, paneles, modales y formularios |
| `--color-text` | `#212529` | Texto principal y valores destacados |
| `--color-text-muted` | `#6B7280` | Ayuda, etiquetas, metadatos y texto secundario |
| `--color-border` | `#DEE2E6` | Bordes, divisores y contornos de campos |
| `--color-gold` | `#D4AC0D` | Empate, insignias, ranking y distinciones |
| `--color-error` | `#C92A2A` | Errores, derrota, validación fallida |
| `--color-success` | `#2D6A4F` | Victoria y confirmación |
| `--color-info` | `#2563EB` | Datos informativos o una serie secundaria de gráficos |
| `--color-chart-neutral` | `#E9ECEF` | Fondo de barras/progreso |

### Uso semántico

No comunicar el estado únicamente con color: incluir texto, icono o etiqueta. El dorado no reemplaza al verde como CTA general. El rojo se reserva para errores y consecuencias negativas. En gráficos comparativos, usar una paleta consistente por serie y mostrar leyenda.

## 3. Tipografía

**Familia única:** `Plus Jakarta Sans`, con fallback `system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif`.

Importación recomendada en `index.html`:

```html
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700;800&display=swap" rel="stylesheet">
```

Si la aplicación debe funcionar sin conexión, la fuente remota puede no estar disponible en la primera visita offline. El fallback del sistema debe conservar legibilidad. Si el equipo decide alojar la fuente localmente, comprobar su licencia y rendimiento.

| Token | Tamaño | Peso | Interlineado | Uso |
|---|---:|---:|---:|---|
| `--font-size-xs` | 0.6875rem / 11px | 500–700 | 1.35 | microetiquetas, estados |
| `--font-size-sm` | 0.75rem / 12px | 400–600 | 1.4 | metadatos, ayudas |
| `--font-size-md` | 0.875rem / 14px | 400–600 | 1.45 | cuerpo estándar |
| `--font-size-lg` | 0.9375rem / 15px | 400–600 | 1.5 | texto destacado |
| `--font-size-title-sm` | 1.0625rem / 17px | 700 | 1.3 | títulos de tarjetas |
| `--font-size-title-md` | 1.25rem / 20px | 700–800 | 1.3 | encabezados de sección |
| `--font-size-title-lg` | 1.625rem / 26px | 800 | 1.25 | títulos de pantalla |
| `--font-size-metric` | 2rem / 32px | 800 | 1.1 | marcadores y métricas principales |

Los títulos de pantalla pueden reducirse en dispositivos estrechos. Usar números tabulares para puntuaciones y estadísticas cuando sea posible.

## 4. Espaciado y layout

Usar múltiplos de 4px. Tokens incluidos en CSS:

- `--space-1`: 4px
- `--space-2`: 8px
- `--space-3`: 12px
- `--space-4`: 16px
- `--space-5`: 20px
- `--space-6`: 24px
- `--space-8`: 32px
- `--space-10`: 40px
- `--space-12`: 48px

Reglas:
- Diseñar primero para móvil; el contenido no debe depender de una anchura fija de 390–430px.
- Usar `max-width` para limitar la lectura en escritorio, pero permitir que el contenido se adapte en pantallas grandes.
- Respetar `env(safe-area-inset-top)` y `env(safe-area-inset-bottom)` en dispositivos con notch.
- Reservar espacio inferior para la navegación fija.
- Evitar que los encabezados se solapen con el contenido o los controles.

## 5. Bordes, radios y sombras

| Token | Valor | Uso |
|---|---|---|
| `--radius-sm` | 6px | etiquetas y controles compactos |
| `--radius-md` | 10px | botones, campos y tarjetas pequeñas |
| `--radius-lg` | 16px | tarjetas y paneles |
| `--radius-xl` | 24px | modales y paneles de onboarding |
| `--radius-pill` | 999px | chips, estados y avatares |
| `--shadow-card` | sombra ligera | tarjetas elevadas con moderación |
| `--shadow-modal` | sombra media | modal sobre overlay |

Los bordes estándar son de 1px en `--color-border`. Las sombras no deben sustituir a la separación estructural.

## 6. Componentes compartidos

Crear componentes visuales reutilizables para:
- `Button`: variantes primary, secondary, ghost y danger; estados hover, focus, disabled y loading.
- `Input` / `Select`: etiqueta visible, ayuda y error asociados.
- `Card`: superficie blanca, borde y radio estándar.
- `Badge`: estado, resultado, posición y clasificación.
- `BottomNavigation`: Inicio, Mercado, Alineación, Historial y Ranking.
- `PlayerCard`: nombre, posición, precio, rating y acción.
- `MetricBar`: valor, etiqueta y referencia.
- `Modal`: overlay, foco, cierre y accesibilidad.
- `Pitch`: cancha SVG/CSS y slots posicionales.
- `EmptyState`, `LoadingState` y `ErrorState`.
- `Toast` / mensaje de confirmación.

La estructura HTML y la funcionalidad de cada componente deben permanecer separadas de sus estilos.

## 7. Pantallas y aplicación del sistema

- **Login/Registro:** superficies blancas, marca verde, formularios con labels persistentes y errores legibles.
- **Mercado:** filtros tipo chip; el filtro activo usa verde. El presupuesto debe ser visible y actualizarse al fichar.
- **Comparador:** radar con leyenda, valores numéricos accesibles y colores consistentes por jugador.
- **Alineación:** cancha verde con líneas blancas semitransparentes; slots claramente diferenciados; alerta adicional si hay penalización táctica.
- **Partido en directo:** marcador prominente, estado del partido, cancha y pestañas de cronología/estadísticas/alineaciones.
- **Resultado:** modal con marcador, resultado, jugador destacado, variación de ranking y acciones.
- **Historial:** tarjetas compactas con rival, fecha, marcador, puntos y enlace a detalle.
- **Ranking:** podio y lista; mostrar tendencia con icono y texto, no solo color.
- **Perfil:** datos de cuenta y preferencias con controles consistentes.
- **Administración:** formularios y tablas priorizando precisión, validación y confirmación de acciones destructivas.

## 8. Accesibilidad e interacción

- Contraste suficiente entre texto y fondo; revisar los colores de texto secundario en tamaños pequeños.
- Foco de teclado visible.
- Botones táctiles de al menos 44×44px como objetivo de diseño.
- Formularios con `label`, mensajes de error asociados y atributos accesibles.
- Modales con `role="dialog"`, `aria-modal="true"`, foco controlado y cierre por Escape.
- Gráficos con un resumen textual o tabla alternativa.
- Animaciones cortas y no esenciales; respetar `prefers-reduced-motion`.
- No desactivar zoom del navegador en producción.

## 9. Regla de mantenimiento

`DESIGN.md` explica las decisiones; `src/styles/design-tokens.css` es la fuente de verdad para valores que consume el código. Si cambia un color o espaciado, actualizar el token una sola vez y ajustar esta documentación en el mismo PR.
