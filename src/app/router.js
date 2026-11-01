/**
 * @file router.js
 * @description Enrutador SPA ligero basado en History API para Vanilla JS.
 * Gestiona el mapeo de rutas, carga perezosa de vistas HTML/JS y guardias de navegación.
 *
 * @exports { initRouter, navigateTo, getCurrentRoute }
 */

import { authService } from "../services/auth-service.js";

const routes = {
  "/": {
    screen: "onboarding",
    authRequired: false,
    fullScreen: true,
  },
  "/onboarding": {
    screen: "onboarding",
    authRequired: false,
    fullScreen: true,
  },
  "/login": {
    screen: "auth",
    subview: "login",
    authRequired: false,
    fullScreen: true,
  },
  "/register": {
    screen: "auth",
    subview: "register",
    authRequired: false,
    fullScreen: true,
  },
  "/dashboard": { screen: "dashboard", authRequired: true },
  "/market": { screen: "market", authRequired: true },
  "/comparison": { screen: "comparison", authRequired: true },
  "/lineup": { screen: "lineup", authRequired: true },
  "/match/live": { screen: "match", subview: "live", authRequired: true },
  "/match/result": { screen: "match", subview: "result", authRequired: true },
  "/history": { screen: "history", authRequired: true },
  "/ranking": {
    screen: "ranking",
    authRequired: false,
    fullScreen: false,
  },
  "/profile": { screen: "profile", authRequired: true },
  "/admin/players": { screen: "admin", authRequired: true, adminOnly: true },
};

export function initRouter() {
  // Manejo de eventos de retroceso/avance del navegador
  window.addEventListener("popstate", handleLocation);

  // Delegación de clics globales para enlaces internos <a href="/ruta" data-link>
  document.body.addEventListener("click", (e) => {
    const link = e.target.closest("a[data-link]");
    if (link) {
      e.preventDefault();
      navigateTo(link.getAttribute("href"));
    }
  });

  handleLocation();
}

export function navigateTo(url) {
  if (window.location.pathname !== url) {
    window.history.pushState({}, "", url);
  }
  handleLocation();
}

export function getCurrentRoute() {
  let path = window.location.pathname || "/";
  // Normalizar si Live Server carga con index.html o carpeta public
  if (path.includes("index.html") || path.endsWith("/public/")) {
    return "/";
  }
  return path;
}

async function handleLocation() {
  // 1. Herramienta de testeo aislada: parámetro ?reset=true en la URL
  const urlParams = new URLSearchParams(window.location.search);
  if (urlParams.get("reset") === "true") {
    localStorage.removeItem("auth_token");
    localStorage.removeItem("access_token");
    localStorage.removeItem("user");
    localStorage.removeItem("hasSeenOnboarding");

    // Limpia el query parameter de la URL para evitar reseteos en navegaciones posteriores
    const cleanPath = window.location.pathname || "/";
    window.history.replaceState({}, "", cleanPath);
  }

  let path = getCurrentRoute();
  const hasSeenOnboarding = localStorage.getItem("hasSeenOnboarding") === "true";
  const authToken = localStorage.getItem("auth_token") || localStorage.getItem("access_token");

  // 2. Redirección inicial en la raíz ("/")
  if (path === "/") {
    if (!hasSeenOnboarding) {
      // a) Nuevo usuario: nunca vio el tutorial
      path = "/onboarding";
    } else if (!authToken) {
      // b) Ya vio onboarding o deslogueado: directo a Login
      path = "/login";
    } else {
      // c) Sesión activa: directo a Dashboard
      path = "/dashboard";
    }

    if (window.location.pathname !== path) {
      window.history.replaceState({}, "", path);
    }
  }

  // 3. Regla de negocio: Onboarding estrictamente una única vez
  if (path === "/onboarding" && hasSeenOnboarding) {
    path = authToken ? "/dashboard" : "/login";
    if (window.location.pathname !== path) {
      window.history.replaceState({}, "", path);
    }
  }

  // 4. Guardia de rutas protegidas (authRequired)
  const candidateRoute = routes[path] || routes["/login"];
  if (candidateRoute.authRequired && !authToken) {
    path = "/login";
    if (window.location.pathname !== path) {
      window.history.replaceState({}, "", path);
    }
  }

  // 5. Redireccionar usuarios autenticados fuera de login o register
  if ((path === "/login" || path === "/register") && authToken) {
    path = "/dashboard";
    if (window.location.pathname !== path) {
      window.history.replaceState({}, "", path);
    }
  }

  const route = routes[path] || routes["/login"];

  // Ocultar header y barra inferior en pantallas a pantalla completa
  const appHeader = document.getElementById("app-header");
  const appNav = document.getElementById("app-navigation");
  if (appHeader) appHeader.style.display = route.fullScreen ? "none" : "";
  if (appNav) appNav.style.display = route.fullScreen ? "none" : "";

  // Contenedor principal
  const appContent = document.getElementById("app-content");
  if (!appContent) return;

  // Suavizar salida de la pantalla actual
  appContent.style.opacity = "0";
  appContent.style.transition = "opacity 0.15s ease";

  const viewFile = route.subview || route.screen;

  try {
    const response = await fetch(`/src/screens/${route.screen}/${viewFile}.html?v=${Date.now()}`);
    if (!response.ok) {
      throw new Error(`No se pudo cargar la vista: ${route.screen}/${viewFile}.html`);
    }
    const html = await response.text();

    // Inyectar nuevo contenido y transición hacia adentro
    setTimeout(async () => {
      appContent.innerHTML = html;
      appContent.style.opacity = "1";
      await loadScreenController(route);
    }, 100);
  } catch (error) {
    console.error("[Router] Error cargando vista:", error);
    appContent.innerHTML = `<p class="error-message">Error al cargar la pantalla.</p>`;
    appContent.style.opacity = "1";
  }
}

/**
 * Carga e inicializa el controlador JS de la pantalla activa
 */
async function loadScreenController(route) {
  const routerInstance = { navigate: navigateTo, current: getCurrentRoute };

  switch (route.screen) {
    case "onboarding": {
      try {
        const module = await import("../screens/onboarding/onboarding.js");
        if (typeof module.initOnboarding === "function") {
          module.initOnboarding(routerInstance);
        }
      } catch (err) {
        console.warn("[Router] Controlador onboarding.js no inicializado:", err);
      }
      break;
    }

    case "ranking": {
      try {
        const module = await import(`../screens/ranking/ranking.js?t=${Date.now()}`);
        if (typeof module.initRanking === "function") {
          module.initRanking(routerInstance);
        }
      } catch (err) {
        console.warn("[Router] Controlador ranking.js no inicializado:", err);
      }
      break;
    }

    case "auth": {
      try {
        const module = await import("../screens/auth/auth.js");
        if (typeof module.initAuth === "function") {
          module.initAuth(route.subview, routerInstance);
        }
      } catch (err) {
        console.warn("[Router] Controlador auth.js no inicializado:", err);
      }
      break;
    }

    case "dashboard": {
      try {
        const module = await import("../screens/dashboard/dashboard.js");
        if (typeof module.initDashboard === "function") {
          module.initDashboard(routerInstance);
        }
      } catch (err) {
        console.warn("[Router] Controlador dashboard.js no inicializado:", err);
      }
      break;
    }

    default:
      console.debug(
        `[Router] Sin controlador específico para pantalla: ${route.screen}`,
      );
      break;
  }
}
