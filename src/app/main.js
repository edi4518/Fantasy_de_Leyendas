/**
 * @file main.js
 * @description Punto de entrada principal de la aplicación PWA frontend.
 * Inicializa el enrutador SPA, la barra de navegación, registra
 * el Service Worker y valida el estado de la sesión activa.
 *
 * @exports bootstrapApp
 */

import { initRouter } from './router.js?v=50';
import { renderNavigation } from './navigation.js?v=50';
import { authService } from '../services/auth-service.js?v=50';

export async function bootstrapApp() {
  console.info('[App] Inicializando Fantasy de Leyendas PWA...');

  // 1. Limpieza preventiva de cachés anteriores y desregistro de Service Workers antiguos
  if ('caches' in window) {
    caches.keys().then((names) => {
      names.forEach((name) => caches.delete(name));
    });
  }

  if ('serviceWorker' in navigator) {
    try {
      const registrations = await navigator.serviceWorker.getRegistrations();
      for (const reg of registrations) {
        await reg.unregister();
      }
    } catch (error) {
      console.warn('[PWA] Error al limpiar Service Worker:', error);
    }
  }

  // 2. Verificar estado de autenticación inicial (sesión en localStorage o token)
  try {
    if (authService && typeof authService.initAuthState === 'function') {
      await authService.initAuthState();
    }
  } catch (error) {
    console.error('[Auth] Error al inicializar estado de sesión:', error);
  }

  // 3. Montar barras de navegación (inferior / superior según la arquitectura)
  if (typeof renderNavigation === 'function') {
    renderNavigation();
  }

  // 4. Iniciar enrutador SPA para resolver la vista inicial (Onboarding, Login o Dashboard)
  if (typeof initRouter === 'function') {
    initRouter();
  }
}

// Ejecutar arranque al cargar completamente el DOM
document.addEventListener('DOMContentLoaded', bootstrapApp);
