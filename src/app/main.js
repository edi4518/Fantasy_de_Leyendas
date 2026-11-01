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

export async function bootstrapApp() {
  console.info('[App] Inicializando Fantasy de Leyendas PWA...');

  // 1. Limpieza preventiva de cachés anteriores y registro del Service Worker
  if ('caches' in window) {
    caches.keys().then((names) => {
      names.forEach((name) => {
        if (name !== 'fantasy-leyendas-v3') caches.delete(name);
      });
    });
  }

  if ('serviceWorker' in navigator && window.location.protocol.startsWith('http')) {
    try {
      // Registrado con scope global '/' para interceptar rutas de public y src
      const registration = await navigator.serviceWorker.register('/public/sw.js', { scope: '/' });
      registration.update();
      console.info('[PWA] Service Worker registrado exitosamente con scope:', registration.scope);
    } catch (error) {
      console.warn('[PWA] Error al registrar Service Worker:', error);
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
