/**
 * @file router.js
 * @description Enrutador SPA ligero basado en History API para Vanilla JS.
 * Gestiona el mapeo de rutas, carga perezosa de vistas HTML/JS y guardias de navegación.
 *
 * @exports { initRouter, navigateTo, getCurrentRoute }
 */

import { authService } from "../services/auth-service.js";
import { renderNavigation, updateActiveNavItem } from "./navigation.js";
import { APP_VERSION } from "./version.js";

// Caché en memoria para plantillas HTML de vistas (carga en 0ms tras la primera visita)
const viewTemplateCache = new Map();

async function getScreenTemplate(viewUrl) {
  if (viewTemplateCache.has(viewUrl)) {
    return viewTemplateCache.get(viewUrl);
  }
  const response = await fetch(viewUrl);
  if (!response.ok) {
    throw new Error(`No se pudo cargar la vista: ${viewUrl}`);
  }
  const html = await response.text();
  viewTemplateCache.set(viewUrl, html);
  return html;
}

function preloadCommonTemplates() {
  const commonScreens = [
    { screen: "dashboard", file: "dashboard" },
    { screen: "lineup", file: "lineup" },
    { screen: "market", file: "market" },
    { screen: "history", file: "history" },
    { screen: "ranking", file: "ranking" },
  ];

  const idleRunner = typeof window !== "undefined" && window.requestIdleCallback
    ? window.requestIdleCallback
    : (cb) => setTimeout(cb, 600);

  idleRunner(() => {
    commonScreens.forEach(({ screen, file }) => {
      const url = `/src/screens/${screen}/${file}.html?v=${APP_VERSION}`;
      if (!viewTemplateCache.has(url)) {
        fetch(url)
          .then((r) => (r.ok ? r.text() : null))
          .then((html) => {
            if (html) viewTemplateCache.set(url, html);
          })
          .catch(() => {});
      }
      ensureScreenStylesheet(screen);
    });
  });
}

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
  "/matchmaking": {
    screen: "matchmaking",
    subview: "matchmaking",
    authRequired: true,
    fullScreen: true
  },
  "/market": { screen: "market", authRequired: true },
  "/comparison": { screen: "comparison", authRequired: true },
  "/lineup": { screen: "lineup", authRequired: true },
  "/match/live": { screen: "match", subview: "live-match", authRequired: true, fullScreen: true },
  "/match/result": { screen: "match", subview: "match-result", authRequired: true, fullScreen: true },
  "/history": { screen: "history", authRequired: true },
  "/ranking": {
    screen: "ranking",
    authRequired: true,
    fullScreen: false,
  },
  "/profile": { screen: "profile", authRequired: true },
  "/admin/players": { screen: "admin", authRequired: true, adminOnly: true },
};

let isRouterInitialized = false;
let currentNavigationSeq = 0;
let lastPopHashUrl = "";
let lastPopTimestamp = 0;

export function initRouter() {
  if (isRouterInitialized) return;
  isRouterInitialized = true;

  window.router = { navigate: navigateTo, current: getCurrentRoute };

  // Manejo de eventos de retroceso/avance del navegador, BFCache y cambio de hash
  window.addEventListener("popstate", () => {
    const currentUrl = window.location.pathname + window.location.search + window.location.hash;
    lastPopHashUrl = currentUrl;
    lastPopTimestamp = Date.now();
    handleLocation();
  });
  window.addEventListener("hashchange", () => {
    const currentUrl = window.location.pathname + window.location.search + window.location.hash;
    // Evitar doble ejecución cuando el navegador dispara popstate y hashchange juntos
    if (currentUrl === lastPopHashUrl && (Date.now() - lastPopTimestamp) < 120) {
      return;
    }
    handleLocation();
  });
  window.addEventListener("pageshow", (event) => {
    if (event.persisted) {
      handleLocation();
    }
  });

  // Delegación de clics globales para enlaces internos <a href="/ruta" data-link>
  document.body.addEventListener("click", (e) => {
    if (e.target.closest(".match-details-link")) {
      e.preventDefault();
      return;
    }
    const link = e.target.closest("a[data-link]");
    if (link) {
      e.preventDefault();
      navigateTo(link.getAttribute("href"));
    }
  });

  handleLocation();
}

export function navigateTo(url) {
  // Limpiar cualquier parámetro de prueba (?screen=, ?test= o ?home=) de la URL al navegar
  if (window.location.search) {
    const isIndexFile =
      window.location.pathname.includes("index.html") ||
      window.location.pathname.endsWith("/public/");
    const cleanUrl = isIndexFile ? window.location.pathname + "#" + url : url;
    window.history.replaceState({}, "", cleanUrl);
    handleLocation();
  } else if (
    window.location.pathname.includes("index.html") ||
    window.location.pathname.endsWith("/public/") ||
    window.location.hash.startsWith("#/")
  ) {
    const targetHash = "#" + url;
    if (window.location.hash !== targetHash) {
      // El cambio de hash disparará el evento 'hashchange' que invoca handleLocation de forma natural
      window.location.hash = targetHash;
    } else {
      handleLocation();
    }
  } else {
    const currentFullUrl = window.location.pathname + window.location.search;
    if (currentFullUrl !== url) {
      window.history.pushState({}, "", url);
    }
    handleLocation();
  }
}

export function getCurrentRoute() {
  // 1. Si hay un hash activo (ej. #/dashboard, #/lineup, #/history), tiene prioridad máxima en la SPA
  if (window.location.hash && window.location.hash.length > 1) {
    const rawHash = window.location.hash.slice(1).split("?")[0];
    return rawHash.startsWith("/") ? rawHash : "/" + rawHash;
  }

  // 2. Parámetro query explícito (?screen= o ?route=) en la carga inicial
  const urlParams = new URLSearchParams(window.location.search);
  const explicit = urlParams.get("screen") || urlParams.get("route");
  if (explicit) {
    return explicit.startsWith("/") ? explicit : "/" + explicit;
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
  const navSeq = ++currentNavigationSeq;
  // 1. Herramienta de testeo aislada: parámetro ?reset=true en la URL
  const urlParams = new URLSearchParams(window.location.search);
  if (urlParams.get("reset") === "true") {
    localStorage.removeItem("auth_token");
    localStorage.removeItem("access_token");
    localStorage.removeItem("user");
    localStorage.removeItem("hasSeenOnboarding");
    localStorage.removeItem("fantasy_active_squad");
    localStorage.removeItem("fantasy_player_stats");

    const cleanPath = window.location.pathname || "/";
    window.history.replaceState({}, "", cleanPath);
  }

  // Soporte directo para modo de prueba con parámetros query explícitos (?test=true o ?home=true)
  const isDirectTest = urlParams.get("test") === "true" || urlParams.get("home") === "true";

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

  // 2. Si entra desde cero (sin haber completado onboarding) y no está en login/register/onboarding -> /onboarding
  if (!isDirectTest && !hasSeenOnboarding) {
    if (path !== "/onboarding" && path !== "/login" && path !== "/register") {
      path = "/onboarding";
      updateBrowserUrl(path);
    }
  }

  // 3. Redirección inicial en la raíz ("/")
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

  // 4. Regla de negocio: Onboarding estrictamente una única vez
  if (path === "/onboarding" && hasSeenOnboarding && !isDirectTest) {
    path = authToken ? "/dashboard" : "/login";
    updateBrowserUrl(path);
  }

  // 5. Guardia de rutas protegidas (authRequired)
  const candidateRoute = routes[path] || routes["/login"];
  if (candidateRoute.authRequired && !authToken) {
    path = hasSeenOnboarding ? "/login" : "/onboarding";
    updateBrowserUrl(path);
  }

  // 6. Redireccionar usuarios autenticados fuera de login o register
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
  if (appNav) {
    appNav.style.display = route.fullScreen ? "none" : "";
    appNav.toggleAttribute("hidden", Boolean(route.fullScreen));
  }

  // Contenedor principal
  const appContent = document.getElementById("app-content");
  if (!appContent) return;
  appContent.style.paddingBottom = route.fullScreen ? "0px" : "";

  appContent.scrollTop = 0;
  window.scrollTo(0, 0);

  const viewFile = route.subview || route.screen;
  const viewUrl = `/src/screens/${route.screen}/${viewFile}.html?v=${APP_VERSION}`;

  // Si la plantilla no está aún en caché, mostrar inmediatamente el skeleton de feedback táctil (0ms)
  if (!viewTemplateCache.has(viewUrl)) {
    appContent.innerHTML = getSkeletonHTML(route.screen);
    appContent.style.opacity = "1";
  }

  try {
    const [html] = await Promise.all([
      getScreenTemplate(viewUrl),
      ensureScreenStylesheet(route.screen),
    ]);
    if (navSeq !== currentNavigationSeq) return;

    appContent.innerHTML = html;
    appContent.scrollTop = 0;
    appContent.style.opacity = "1";
    dismissInitialSplash();
    await loadScreenController(route);
  } catch (error) {
    console.error("[Router] Error cargando vista:", error);
    appContent.innerHTML = `<p class="error-message">Error al cargar la pantalla.</p>`;
    appContent.style.opacity = "1";
    dismissInitialSplash();
  }
}

/**
 * Retira con desvanecimiento la pantalla de inicio inicial de la PWA
 */
function dismissInitialSplash() {
  const splash = document.getElementById("pwa-app-splash");
  if (splash) {
    splash.style.opacity = "0";
    splash.style.visibility = "hidden";
    setTimeout(() => {
      if (splash && splash.parentNode) {
        splash.parentNode.removeChild(splash);
      }
    }, 350);
  }
}

/**
 * Plantilla ligera de Skeleton Loader para First Contentful Paint instantáneo
 */
function getSkeletonHTML(screenName) {
  return `
    <div class="skeleton-view-container" aria-hidden="true" style="width: 100%; max-width: 440px; margin: 0 auto; padding: 16px; box-sizing: border-box; display: flex; flex-direction: column; gap: 14px;">
      <style>
        @keyframes skPulse {
          0%, 100% { opacity: 0.85; transform: scale(1); }
          50% { opacity: 0.45; transform: scale(0.998); }
        }
        .sk-elem {
          background: linear-gradient(90deg, #E2E8F0 0%, #EDF2F7 50%, #E2E8F0 100%);
          background-size: 200% 100%;
          border-radius: 12px;
          animation: skPulse 1.2s ease-in-out infinite;
        }
      </style>
      <div style="display: flex; justify-content: space-between; align-items: center; min-height: 54px;">
        <div style="display: flex; align-items: center; gap: 12px;">
          <div class="sk-elem" style="width: 44px; height: 44px; border-radius: 50%;"></div>
          <div style="display: flex; flex-direction: column; gap: 6px;">
            <div class="sk-elem" style="width: 120px; height: 16px;"></div>
            <div class="sk-elem" style="width: 75px; height: 12px;"></div>
          </div>
        </div>
        <div class="sk-elem" style="width: 48px; height: 32px; border-radius: 8px;"></div>
      </div>
      <div class="sk-elem" style="width: 100%; height: 130px; border-radius: 16px;"></div>
      <div class="sk-elem" style="width: 100%; height: 80px; border-radius: 16px;"></div>
      <div class="sk-elem" style="width: 100%; height: 120px; border-radius: 16px;"></div>
      <div class="sk-elem" style="width: 100%; height: 48px; border-radius: 14px; margin-top: 4px;"></div>
    </div>
  `;
}

/**
 * Carga e inicializa el controlador JS de la pantalla activa
 */
async function loadScreenController(route) {
  const routerInstance = { navigate: navigateTo, current: getCurrentRoute };

  const appContent = document.getElementById("app-content");
  if (!appContent) return;

  switch (route.screen) {
    case "onboarding": {
      try {
        const module = await import(`../screens/onboarding/onboarding.js?v=${APP_VERSION}`);
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
        const module = await import(`../screens/ranking/ranking.js?v=${APP_VERSION}`);
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
        const module = await import(`../screens/auth/auth.js?v=${APP_VERSION}`);
        if (typeof module.initAuth === "function") {
          module.initAuth(route.subview, routerInstance);
        }
        if (route.subview !== "register") {
          setTimeout(ensureGoogleIdentityScript, 0);
        }
      } catch (err) {
        console.warn("[Router] Controlador auth.js no inicializado:", err);
      }
      break;
    }

    case "dashboard": {
      try {
        const module = await import(`../screens/dashboard/dashboard.js?v=${APP_VERSION}`);
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
        const module = await import(`../screens/history/history.js?v=${APP_VERSION}`);
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

    case "market": {
      try {
        const module = await import(`/src/screens/market/market.js?v=${APP_VERSION}`);
        if (typeof module.renderMarketScreen === "function") {
          module.renderMarketScreen(appContent, routerInstance);
        } else {
          console.warn("[Router] renderMarketScreen no se encontró en market.js");
        }
      } catch (err) {
        console.error("[Router] Error crítico al importar market.js:", err);
      }
      break;
    }

    case "comparison": {
      try {
        const module = await import(`../screens/comparison/comparison.js?v=${APP_VERSION}`);
        // Extraemos parámetros de la URL si los hay (ej: ?ids=1,2,3) tanto de search como de hash
        const hashQuery = window.location.hash.includes("?")
          ? window.location.hash.split("?")[1]
          : "";
        const mergedParams = new URLSearchParams(window.location.search);
        if (hashQuery) {
          const hashSearchParams = new URLSearchParams(hashQuery);
          for (const [k, v] of hashSearchParams.entries()) {
            mergedParams.set(k, v);
          }
        }
        const urlParams = Object.fromEntries(mergedParams);
        if (typeof module.renderComparisonScreen === "function") {
          module.renderComparisonScreen(appContent, routerInstance, urlParams);
        }
      } catch (err) {
        console.warn("[Router] Controlador comparison.js no inicializado:", err);
      }
      break;
    }

    case "admin": {
      try {
        const module = await import(`../screens/admin/players-admin.js?v=${APP_VERSION}`);
        if (typeof module.renderPlayersAdminScreen === "function") {
          module.renderPlayersAdminScreen(appContent, routerInstance);
        }
      } catch (err) {
        console.warn("[Router] Controlador players-admin.js no inicializado:", err);
      }
      break;
    }

    case "profile": {
      try {
        const module = await import(`../screens/profile/profile.js?v=${APP_VERSION}`);
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

    case "matchmaking": {
      try {
        const module = await import(`../screens/matchmaking/matchmaking.js?v=${APP_VERSION}`);
        if (typeof module.initMatchmaking === "function") {
          module.initMatchmaking(routerInstance);
        }
      } catch (err) {
        console.warn("[Router] Controlador matchmaking.js no inicializado:", err);
      }
      break;
    }

    case "lineup": {
      try {
        const module = await import(`../screens/lineup/lineup.js?v=${APP_VERSION}`);
        if (typeof module.initLineup === "function") {
          module.initLineup(routerInstance);
        }
      } catch (err) {
        console.warn("[Router] Controlador lineup.js no inicializado:", err);
      }
      break;
    }

    case "match": {
      try {
        const module = await import(`../screens/match/match.js?v=${APP_VERSION}`);
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

function loadStylesheetOnce(basePath, versionQuery = `v=${APP_VERSION}`) {
  const existing = document.querySelector(`link[href*="${basePath}"]`);
  if (existing) return Promise.resolve();

  return new Promise((resolve) => {
    const link = document.createElement("link");
    link.rel = "stylesheet";
    link.href = `${basePath}?${versionQuery}`;
    const timer = setTimeout(resolve, 2500);
    link.onload = () => {
      clearTimeout(timer);
      resolve();
    };
    link.onerror = () => {
      clearTimeout(timer);
      resolve();
    };
    document.head.appendChild(link);
  });
}

function ensureGoogleIdentityScript() {
  if (document.querySelector('script[src*="accounts.google.com/gsi/client"]')) return;
  const script = document.createElement("script");
  script.src = "https://accounts.google.com/gsi/client";
  script.async = true;
  script.defer = true;
  document.body.appendChild(script);
}

function ensureScreenStylesheet(screenName) {
  if (!screenName) return Promise.resolve();
  if (screenName === "onboarding") {
    if (document.querySelector('link[href*="main.min.css"], link[href*="main.css"]')) {
      return Promise.resolve();
    }
    return loadStylesheetOnce("/src/styles/screens/onboarding.css", `v=${APP_VERSION}`);
  }
  return Promise.all([
    loadStylesheetOnce("/src/styles/components.css", `v=${APP_VERSION}`),
    loadStylesheetOnce("/src/components/modal/modal.css", `v=${APP_VERSION}`),
    loadStylesheetOnce(`/src/styles/screens/${screenName}.css`, `v=${APP_VERSION}`),
  ]);
}

function bootstrapRouter() {
  if (typeof window !== "undefined") {
    if (window.__fantasyRouterBootstrapped) return;
    window.__fantasyRouterBootstrapped = true;
  }
  try {
    if (authService && typeof authService.initAuthState === "function") {
      authService.initAuthState();
    }
  } catch (err) {
    console.warn("[Auth] Error inicializando sesión:", err);
  }
  if (typeof renderNavigation === "function") {
    renderNavigation();
  }
  initRouter();
  preloadCommonTemplates();
}

if (typeof document !== "undefined") {
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", bootstrapRouter);
  } else {
    bootstrapRouter();
  }
}
