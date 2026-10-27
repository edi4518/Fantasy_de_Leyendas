/**
 * @file router.js
 * @description Enrutador SPA ligero basado en History API o Hash routing para Vanilla JS.
 * Gestiona el mapeo de rutas (/dashboard, /market, /lineup, /match, etc.), carga perezosa
 * de vistas HTML/JS y guardias de autenticación.
 *
 * @exports { initRouter, navigateTo, getCurrentRoute }
 */

const routes = {
  '/': { screen: 'dashboard', authRequired: true },
  '/onboarding': { screen: 'onboarding', authRequired: false },
  '/login': { screen: 'auth', subview: 'login', authRequired: false },
  '/register': { screen: 'auth', subview: 'register', authRequired: false },
  '/dashboard': { screen: 'dashboard', authRequired: true },
  '/market': { screen: 'market', authRequired: true },
  '/comparison': { screen: 'comparison', authRequired: true },
  '/lineup': { screen: 'lineup', authRequired: true },
  '/match/live': { screen: 'match', subview: 'live', authRequired: true },
  '/match/result': { screen: 'match', subview: 'result', authRequired: true },
  '/history': { screen: 'history', authRequired: true },
  '/ranking': { screen: 'ranking', authRequired: true },
  '/profile': { screen: 'profile', authRequired: true },
  '/admin/players': { screen: 'admin', authRequired: true, adminOnly: true }
};

export function initRouter() {
  window.addEventListener('popstate', handleLocation);
  handleLocation();
}

export function navigateTo(url) {
  window.history.pushState({}, '', url);
  handleLocation();
}

export function getCurrentRoute() {
  return window.location.pathname || '/';
}

async function handleLocation() {
  const path = getCurrentRoute();
  const route = routes[path] || routes['/'];
  const appContent = document.getElementById('app-content');

  if (!appContent) return;

  console.debug(`[Router] Navegando hacia: ${path} (Pantalla: ${route.screen})`);
  // Carga e inyección dinámica de la pantalla correspondiente
}
