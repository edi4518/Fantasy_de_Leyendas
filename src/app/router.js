/**
 * @file router.js
 * @description Enrutador SPA ligero basado en History API para Vanilla JS.
 * Gestiona el mapeo de rutas, carga perezosa de vistas HTML/JS y guardias de navegación.
 *
 * @exports { initRouter, navigateTo, getCurrentRoute }
 */

import { authService } from "../services/auth-service.js";
import { updateActiveNavItem } from "./navigation.js";

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
  "/dashboard": { screen: "dashboard", authRequired: false },
  "/market": { screen: "market", authRequired: true },
  "/comparison": { screen: "comparison", authRequired: true },
  "/lineup": { screen: "lineup", authRequired: true },
  "/match/live": { screen: "match", subview: "live-match", authRequired: false },
  "/match/result": { screen: "match", subview: "match-result", authRequired: false },
  "/history": { screen: "history", authRequired: false },
  "/ranking": {
    screen: "ranking",
    authRequired: false,
    fullScreen: false,
  },
  "/profile": { screen: "profile", authRequired: true },
  "/admin/players": { screen: "admin", authRequired: true, adminOnly: true },
};

export function initRouter() {
  window.router = { navigate: navigateTo, current: getCurrentRoute };

  // Manejo de eventos de retroceso/avance del navegador y cambio de hash
  window.addEventListener("popstate", handleLocation);
  window.addEventListener("hashchange", handleLocation);

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
  if (window.location.pathname.includes("index.html") || window.location.pathname.endsWith("/public/")) {
    window.location.hash = url;
  } else {
    const currentFullUrl = window.location.pathname + window.location.search;
    if (currentFullUrl !== url) {
      window.history.pushState({}, "", url);
    }
  }
  handleLocation();
}

export function getCurrentRoute() {
  const urlParams = new URLSearchParams(window.location.search);
  const explicit = urlParams.get("screen") || urlParams.get("route");
  if (explicit) {
    return explicit.startsWith("/") ? explicit : "/" + explicit;
  }

  if (window.location.hash && window.location.hash.length > 1) {
    const rawHash = window.location.hash.slice(1).split("?")[0];
    return rawHash.startsWith("/") ? rawHash : "/" + rawHash;
  }

  let path = window.location.pathname || "/";
  // Normalizar si Live Server carga con index.html o carpeta public
  if (path.includes("index.html") || path.endsWith("/public/")) {
    return "/";
  }
  return path;
}

function updateBrowserUrl(newPath) {
  if (window.location.pathname.includes("index.html") || window.location.pathname.endsWith("/public/")) {
    if (window.location.hash !== "#" + newPath) {
      window.location.hash = newPath;
    }
  } else if (window.location.pathname !== newPath) {
    window.history.replaceState({}, "", newPath);
  }
}

async function handleLocation() {
  // 1. Herramienta de testeo aislada: parámetro ?reset=true en la URL
  const urlParams = new URLSearchParams(window.location.search);
  if (urlParams.get("reset") === "true") {
    localStorage.removeItem("auth_token");
    localStorage.removeItem("access_token");
    localStorage.removeItem("user");
    localStorage.removeItem("hasSeenOnboarding");

    const cleanPath = window.location.pathname || "/";
    window.history.replaceState({}, "", cleanPath);
  }

  // Soporte directo para modo de prueba (Home / Dashboard)
  const isDirectTest = urlParams.get("test") === "true" ||
                       urlParams.get("home") === "true" ||
                       urlParams.get("screen") === "dashboard" ||
                       window.location.hash.includes("dashboard");

  if (isDirectTest) {
    localStorage.setItem("hasSeenOnboarding", "true");
    if (!localStorage.getItem("auth_token") && !localStorage.getItem("access_token")) {
      localStorage.setItem("auth_token", "dev-test-token");
      localStorage.setItem("user", JSON.stringify({ name: "Mánager Leyenda", email: "manager@fantasy.com" }));
    }
  }

  let path = getCurrentRoute();
  const hasSeenOnboarding = localStorage.getItem("hasSeenOnboarding") === "true";
  const authToken = localStorage.getItem("auth_token") || localStorage.getItem("access_token");

  // 2. Redirección inicial en la raíz ("/")
  if (path === "/") {
    if (isDirectTest) {
      path = "/dashboard";
    } else if (!hasSeenOnboarding) {
      path = "/onboarding";
    } else if (!authToken) {
      path = "/login";
    } else {
      path = "/dashboard";
    }

    updateBrowserUrl(path);
  }

  // 3. Regla de negocio: Onboarding estrictamente una única vez
  if (path === "/onboarding" && hasSeenOnboarding) {
    path = authToken ? "/dashboard" : "/login";
    updateBrowserUrl(path);
  }

  // 4. Guardia de rutas protegidas (authRequired)
  const candidateRoute = routes[path] || routes["/login"];
  if (candidateRoute.authRequired && !authToken) {
    path = "/login";
    updateBrowserUrl(path);
  }

  // 5. Redireccionar usuarios autenticados fuera de login o register
  if ((path === "/login" || path === "/register") && authToken) {
    path = "/dashboard";
    updateBrowserUrl(path);
  }

  const route = routes[path] || routes["/login"];

  // Sincronizar ítem activo en la barra de navegación inferior
  if (typeof updateActiveNavItem === "function") {
    updateActiveNavItem(path);
  }

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
        const module = await import(`../screens/auth/auth.js?t=${Date.now()}`);
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
        const module = await import(`../screens/dashboard/dashboard.js?t=${Date.now()}`);
        if (typeof module.initDashboard === "function") {
          module.initDashboard(routerInstance);
        } else if (typeof module.initHomeView === "function") {
          module.initHomeView(routerInstance);
        }
      } catch (err) {
        console.warn("[Router] Controlador dashboard.js no inicializado:", err);
      }
      break;
    }

    case "history": {
      try {
        const module = await import("../screens/history/history.js");
        if (typeof module.initHistory === "function") {
          module.initHistory(routerInstance);
        } else if (typeof module.initHistoryView === "function") {
          module.initHistoryView(routerInstance);
        }
      } catch (err) {
        console.warn("[Router] Controlador history.js no inicializado:", err);
      }
      break;
    }

    case "profile": {
      try {
        const module = await import("../screens/profile/profile.js");
        if (typeof module.initProfile === "function") {
          module.initProfile(routerInstance);
        } else if (typeof module.initProfileView === "function") {
          module.initProfileView(routerInstance);
        }
      } catch (err) {
        console.warn("[Router] Controlador profile.js no inicializado:", err);
      }
      break;
    }

    case "match": {
      try {
        const module = await import(`../screens/match/match.js?t=${Date.now()}`);
        if (typeof module.initMatch === "function") {
          module.initMatch(routerInstance);
        } else if (typeof module.initMatchDetailView === "function") {
          module.initMatchDetailView(routerInstance);
        }
      } catch (err) {
        console.warn("[Router] Controlador match.js no inicializado:", err);
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
