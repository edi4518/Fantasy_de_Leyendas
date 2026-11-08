/**
 * @file main.js
 * @description Punto de entrada principal de la aplicación PWA frontend.
 * Inicializa el enrutador SPA, la barra de navegación, registra
 * el Service Worker y valida el estado de la sesión activa.
 *
 * @exports bootstrapApp
 */

import { initRouter } from './router.js';
import { renderNavigation } from './navigation.js';
import { authService } from '../services/auth-service.js';
import { initPwaInstall } from '../services/pwa-install.js';

export function bootstrapApp() {
  // 1. Inicializar sistema de instalación PWA (tarjeta flotante no invasiva)
  try {
    initPwaInstall();
  } catch (pwaErr) {
    console.debug('[PWA] Inicializador omitido:', pwaErr);
  }

  // 2. Verificar estado de autenticación inicial (sesión en localStorage o token)
  try {
    if (authService && typeof authService.initAuthState === 'function') {
      authService.initAuthState();
    }
  } catch (error) {
    console.error('[Auth] Error al inicializar estado de sesión:', error);
  }

  // 3. Montar barras de navegación (inferior / superior según la arquitectura)
  if (typeof renderNavigation === 'function') {
    renderNavigation();
  }

  // 4. Iniciar enrutador SPA inmediatamente para acelerar FCP y LCP
  if (typeof initRouter === 'function') {
    initRouter();
  }
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', bootstrapApp);
} else {
  bootstrapApp();
}
