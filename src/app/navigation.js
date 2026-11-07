/**
 * @file navigation.js
 * @description Controlador de la barra de navegación principal y Bottom Navigation Bar.
 * Renderiza los 5 accesos principales con iconos vectoriales SVG limpios según la maqueta de diseño:
 * Inicio, Mercado, Alineación, Historial y Ranking.
 *
 * @exports { renderNavigation, updateActiveNavItem }
 */

import { navigateTo, getCurrentRoute } from './router.js';

export function renderNavigation() {
  const navContainer = document.getElementById('app-navigation');
  if (!navContainer) return;

  navContainer.innerHTML = `
    <nav class="bottom-nav" aria-label="Navegación principal">
      <!-- 1. Inicio -->
      <button class="bottom-nav__item" data-path="/dashboard" aria-label="Inicio">
        <span class="bottom-nav__icon">
          <svg class="bottom-nav__svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <path d="M3 9.5L12 3l9 6.5V20a1 1 0 0 1-1 1h-5v-6H9v6H4a1 1 0 0 1-1-1V9.5z"/>
          </svg>
        </span>
        <span class="bottom-nav__label">Inicio</span>
      </button>

      <!-- 2. Mercado -->
      <button class="bottom-nav__item" data-path="/market" aria-label="Mercado">
        <span class="bottom-nav__icon">
          <svg class="bottom-nav__svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <path d="M6 2L3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4z"/>
            <line x1="3" y1="6" x2="21" y2="6"/>
            <path d="M16 10a4 4 0 0 1-8 0"/>
          </svg>
        </span>
        <span class="bottom-nav__label">Mercado</span>
      </button>

      <!-- 3. Alineación -->
      <button class="bottom-nav__item" data-path="/lineup" aria-label="Alineación">
        <span class="bottom-nav__icon">
          <svg class="bottom-nav__svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/>
            <circle cx="9" cy="7" r="4"/>
            <path d="M23 21v-2a4 4 0 0 0-3-3.87"/>
            <path d="M16 3.13a4 4 0 0 1 0 7.75"/>
          </svg>
        </span>
        <span class="bottom-nav__label">Alineación</span>
      </button>

      <!-- 4. Historial -->
      <button class="bottom-nav__item" data-path="/history" aria-label="Historial">
        <span class="bottom-nav__icon">
          <svg class="bottom-nav__svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <circle cx="12" cy="12" r="10"/>
            <polyline points="12 6 12 12 16 14"/>
          </svg>
        </span>
        <span class="bottom-nav__label">Historial</span>
      </button>

      <!-- 5. Ranking -->
      <button class="bottom-nav__item" data-path="/ranking" aria-label="Ranking">
        <span class="bottom-nav__icon">
          <svg class="bottom-nav__svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <path d="M6 9H4.5a2.5 2.5 0 0 1 0-5H6"/>
            <path d="M18 9h1.5a2.5 2.5 0 0 0 0-5H18"/>
            <path d="M4 22h16"/>
            <path d="M10 14.66V17c0 .55-.45 1-1 1H7"/>
            <path d="M14 14.66V17c0 .55.45 1 1 1h2"/>
            <path d="M18 2H6v7a6 6 0 0 0 12 0V2z"/>
          </svg>
        </span>
        <span class="bottom-nav__label">Ranking</span>
      </button>
    </nav>
  `;

  navContainer.querySelectorAll('.bottom-nav__item').forEach((button) => {
    button.addEventListener('click', () => {
      const targetPath = button.getAttribute('data-path');
      if (targetPath) navigateTo(targetPath);
    });
  });

  updateActiveNavItem(getCurrentRoute());
}

export function updateActiveNavItem(currentPath) {
  const items = document.querySelectorAll('.bottom-nav__item');
  items.forEach((item) => {
    const path = item.getAttribute('data-path');
    if (path === currentPath) {
      item.classList.add('bottom-nav__item--active');
      item.classList.add('is-active');
    } else {
      item.classList.remove('bottom-nav__item--active');
      item.classList.remove('is-active');
    }
  });
}
