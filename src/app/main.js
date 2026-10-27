/**
 * @file main.js
 * @description Punto de entrada principal de la aplicación PWA frontend.
 * Inicializa el enrutador SPA, la barra de navegación, registra el Service Worker
 * y valida el estado de la sesión activa.
 *
 * @exports bootstrapApp
 */

import { initRouter } from './router.js';
import { renderNavigation } from './navigation.js';
import { authService } from '../services/auth-service.js';

export async function bootstrapApp() {
  console.info('[App] Inicializando Fantasy de Leyendas PWA...');

  // 1. Registro del Service Worker para capacidades PWA
  if ('serviceWorker' in navigator && window.location.protocol.startsWith('http')) {
    try {
      await navigator.serviceWorker.register('/public/sw.js');
      console.info('[PWA] Service Worker registrado exitosamente.');
    } catch (error) {
      console.warn('[PWA] Error al registrar Service Worker:', error);
    }
  }

  // 2. Verificar estado de autenticación inicial
  authService.initAuthState();

  // 3. Montar barra de navegación inferior/superior
  renderNavigation();

  // 4. Iniciar enrutador SPA
  initRouter();
}

// Ejecutar arranque al cargar el DOM
document.addEventListener('DOMContentLoaded', bootstrapApp);
