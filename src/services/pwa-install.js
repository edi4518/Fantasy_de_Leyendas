/**
 * @file pwa-install.js
 * @description Gestor de instalación de la Progressive Web App (PWA) de Fantasy de Leyendas.
 * Renderiza la tarjeta flotante superior (Opción B: Píldora redondeada) con position: fixed y z-index alto.
 * No altera ni empuja el layout del Dashboard ni ninguna otra pantalla.
 */

const STORAGE_KEY_DISMISSED = 'fantasy_pwa_dismissed';
const STORAGE_KEY_INSTALLED = 'fantasy_pwa_installed';
const DISMISS_COOLDOWN_MS = 14 * 24 * 60 * 60 * 1000; // 14 días de espera si el usuario lo cierra

let deferredPrompt = null;
let bannerElement = null;
let isInitialized = false;

/**
 * Determina si la aplicación ya está instalada o ejecutándose en modo standalone
 */
export function isAppInstalled() {
  if (typeof window === 'undefined') return false;

  const isStandaloneMatch = window.matchMedia('(display-mode: standalone)').matches;
  const isNavStandalone = window.navigator.standalone === true;
  const isSavedInstalled = localStorage.getItem(STORAGE_KEY_INSTALLED) === 'true';

  return isStandaloneMatch || isNavStandalone || isSavedInstalled;
}

/**
 * Determina si el usuario descartó el banner recientemente
 */
function isDismissedRecently() {
  try {
    const rawTime = localStorage.getItem(STORAGE_KEY_DISMISSED);
    if (!rawTime) return false;
    const dismissedAt = parseInt(rawTime, 10);
    if (isNaN(dismissedAt)) return false;
    return Date.now() - dismissedAt < DISMISS_COOLDOWN_MS;
  } catch (_) {
    return false;
  }
}

/**
 * Detecta si el dispositivo es iOS (iPhone / iPad / iPod)
 */
function isIos() {
  if (typeof window === 'undefined' || !navigator) return false;
  return /iPhone|iPad|iPod/i.test(navigator.userAgent || '');
}

/**
 * Detecta si el usuario está estrictamente en un dispositivo móvil/celular
 */
function isMobileDevice() {
  if (typeof window === 'undefined' || !navigator) return false;
  const ua = navigator.userAgent || navigator.vendor || window.opera || '';
  return /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini|Mobile/i.test(ua);
}

/**
 * Inicializa el sistema de instalación PWA
 */
export function initPwaInstall() {
  if (isInitialized || typeof window === 'undefined') return;
  isInitialized = true;

  // Registrar Service Worker para cumplir con requisitos PWA
  if ('serviceWorker' in navigator) {
    navigator.serviceWorker
      .register('/public/sw.js')
      .catch((err) => console.debug('[PWA] Service Worker registration note:', err));
  }

  // 1. Exclusivo para dispositivos móviles (NUNCA en PC o navegador desktop)
  if (!isMobileDevice()) {
    return;
  }

  // 2. Si ya está instalada o descartada recientemente, salir inmediatamente
  if (isAppInstalled() || isDismissedRecently()) {
    return;
  }

  // Comprobar de forma asíncrona si la app ya está instalada en el dispositivo (API Chromium)
  if ('getInstalledRelatedApps' in navigator) {
    navigator.getInstalledRelatedApps().then((relatedApps) => {
      if (Array.isArray(relatedApps) && relatedApps.length > 0) {
        try {
          localStorage.setItem(STORAGE_KEY_INSTALLED, 'true');
        } catch (_) {}
        hideInstallBanner();
      }
    }).catch(() => {});
  }

  // 3. Capturar el evento nativo de Chrome/Android
  // En Android Chrome, este evento se dispara ÚNICAMENTE si la app NO está instalada.
  // Si la app ya está instalada, Chrome NO dispara este evento.
  window.addEventListener('beforeinstallprompt', (e) => {
    if (isAppInstalled() || isDismissedRecently() || !isMobileDevice()) {
      return;
    }
    e.preventDefault();
    deferredPrompt = e;
    showInstallBanner();
  });

  // Evento cuando la aplicación fue instalada exitosamente
  window.addEventListener('appinstalled', () => {
    deferredPrompt = null;
    hideInstallBanner();
    try {
      localStorage.setItem(STORAGE_KEY_INSTALLED, 'true');
    } catch (_) {}
    console.info('[PWA] Aplicación instalada exitosamente.');
  });

  // 4. Exclusivo para iOS Safari (que NO soporta 'beforeinstallprompt')
  // En Android NUNCA usamos timeout de fallback porque en Android el evento 'beforeinstallprompt'
  // es la única garantía de que la app no está previamente instalada.
  if (isIos()) {
    setTimeout(() => {
      if (!isAppInstalled() && !isDismissedRecently() && !bannerElement) {
        showInstallBanner();
      }
    }, 2500);
  }
}

/**
 * Muestra el banner flotante (Opción B: Píldora Redondeada)
 */
export function showInstallBanner() {
  if (typeof document === 'undefined') return;
  if (!isMobileDevice()) return;
  if (isAppInstalled() || isDismissedRecently()) return;
  if (document.getElementById('pwa-install-banner')) return;

  const banner = document.createElement('aside');
  banner.id = 'pwa-install-banner';
  banner.className = 'pwa-install-banner';
  banner.setAttribute('role', 'region');
  banner.setAttribute('aria-label', 'Sugerencia de instalación de la aplicación');

  banner.innerHTML = `
    <div class="pwa-install-banner__content">
      <div class="pwa-install-banner__badge" aria-hidden="true">
        FL
      </div>
      <div class="pwa-install-banner__info">
        <strong class="pwa-install-banner__title">Instalar App Oficial</strong>
        <span class="pwa-install-banner__subtitle">Acceso directo en 1 toque</span>
      </div>
    </div>
    <div class="pwa-install-banner__actions">
      <button id="pwa-btn-install" class="pwa-install-banner__btn" type="button" aria-label="Instalar aplicación Fantasy de Leyendas">
        Instalar
      </button>
      <button id="pwa-btn-close" class="pwa-install-banner__close" type="button" aria-label="Cerrar sugerencia">
        ✕
      </button>
    </div>
  `;

  document.body.appendChild(banner);
  bannerElement = banner;

  const btnInstall = banner.querySelector('#pwa-btn-install');
  const btnClose = banner.querySelector('#pwa-btn-close');

  if (btnInstall) {
    btnInstall.addEventListener('click', handleInstallClick);
  }

  if (btnClose) {
    btnClose.addEventListener('click', () => {
      dismissBanner();
    });
  }
}

/**
 * Maneja el clic en el botón de instalar
 */
async function handleInstallClick() {
  // Caso 1: Navegador con soporte de prompt programático (Android Chrome, Edge, etc.)
  if (deferredPrompt) {
    try {
      deferredPrompt.prompt();
      const choiceResult = await deferredPrompt.userChoice;
      if (choiceResult && choiceResult.outcome === 'accepted') {
        try {
          localStorage.setItem(STORAGE_KEY_INSTALLED, 'true');
        } catch (_) {}
      }
      deferredPrompt = null;
      hideInstallBanner();
      return;
    } catch (err) {
      console.warn('[PWA] Error ejecutando prompt de instalación:', err);
    }
  }

  // Caso 2: iOS Safari (mostrar modal explicativo)
  if (isIos()) {
    showIosInstallModal();
    return;
  }

  // Caso 3: Navegadores móviles sin prompt nativo directo
  showGenericInstallModal();
}

/**
 * Cierra y descarta el banner por 3 días
 */
function dismissBanner() {
  try {
    localStorage.setItem(STORAGE_KEY_DISMISSED, Date.now().toString());
  } catch (_) {}
  hideInstallBanner();
}

/**
 * Oculta el banner con animación suave
 */
export function hideInstallBanner() {
  if (!bannerElement) {
    bannerElement = document.getElementById('pwa-install-banner');
  }
  if (!bannerElement) return;

  bannerElement.classList.add('is-hiding');
  setTimeout(() => {
    if (bannerElement && bannerElement.parentNode) {
      bannerElement.parentNode.removeChild(bannerElement);
    }
    bannerElement = null;
  }, 220);
}

/**
 * Modal explicativo para usuarios en iPhone / iPad (iOS Safari)
 */
function showIosInstallModal() {
  const existing = document.getElementById('pwa-ios-modal-backdrop');
  if (existing) return;

  const backdrop = document.createElement('div');
  backdrop.id = 'pwa-ios-modal-backdrop';
  backdrop.className = 'pwa-ios-modal-backdrop';

  const modal = document.createElement('div');
  modal.className = 'pwa-ios-modal';
  modal.setAttribute('role', 'dialog');
  modal.setAttribute('aria-modal', 'true');

  modal.innerHTML = `
    <h3 class="pwa-ios-modal__title">Instalar Fantasy de Leyendas</h3>
    <p class="pwa-ios-modal__text">
      Para jugar como una app nativa en pantalla completa en tu iPhone:
    </p>
    <div class="pwa-ios-modal__step">
      <span>1. Toca el botón <strong>Compartir</strong></span>
      <svg width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path d="M4 12v8a2 2 0 002 2h12a2 2 0 002-2v-8"/><polyline points="16 6 12 2 8 6"/><line x1="12" y1="2" x2="12" y2="15"/></svg>
    </div>
    <div class="pwa-ios-modal__step">
      <span>2. Elige <strong>"Agregar a pantalla de inicio"</strong></span>
      <span style="font-size: 1.1rem; line-height: 1;">➕</span>
    </div>
    <button id="pwa-btn-close-ios" class="pwa-ios-modal__btn" type="button">
      Entendido
    </button>
  `;

  backdrop.appendChild(modal);
  document.body.appendChild(backdrop);

  const closeBtn = modal.querySelector('#pwa-btn-close-ios');
  const closeModal = () => {
    if (backdrop.parentNode) backdrop.parentNode.removeChild(backdrop);
    dismissBanner();
  };

  if (closeBtn) closeBtn.addEventListener('click', closeModal);
  backdrop.addEventListener('click', (e) => {
    if (e.target === backdrop) closeModal();
  });
}

/**
 * Modal explicativo genérico para navegadores sin prompt automático
 */
function showGenericInstallModal() {
  const existing = document.getElementById('pwa-ios-modal-backdrop');
  if (existing) return;

  const backdrop = document.createElement('div');
  backdrop.id = 'pwa-ios-modal-backdrop';
  backdrop.className = 'pwa-ios-modal-backdrop';

  const modal = document.createElement('div');
  modal.className = 'pwa-ios-modal';
  modal.setAttribute('role', 'dialog');
  modal.setAttribute('aria-modal', 'true');

  modal.innerHTML = `
    <h3 class="pwa-ios-modal__title">Instalar App Oficial</h3>
    <p class="pwa-ios-modal__text">
      Para instalar en tu dispositivo, abre el menú de tu navegador (<strong>los 3 puntos ⋮</strong> en la esquina superior) y selecciona:
    </p>
    <div class="pwa-ios-modal__step">
      <span>📲 <strong>"Instalar aplicación"</strong> o <strong>"Agregar a pantalla principal"</strong></span>
    </div>
    <button id="pwa-btn-close-generic" class="pwa-ios-modal__btn" type="button">
      Entendido
    </button>
  `;

  backdrop.appendChild(modal);
  document.body.appendChild(backdrop);

  const closeBtn = modal.querySelector('#pwa-btn-close-generic');
  const closeModal = () => {
    if (backdrop.parentNode) backdrop.parentNode.removeChild(backdrop);
    dismissBanner();
  };

  if (closeBtn) closeBtn.addEventListener('click', closeModal);
  backdrop.addEventListener('click', (e) => {
    if (e.target === backdrop) closeModal();
  });
}

