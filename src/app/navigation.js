/**
 * @file navigation.js
 * @description Controlador de la barra de navegación principal y Bottom Navigation Bar.
 * Administra los enlaces activos, indicadores de presupuesto restante (100M) y botones de acción.
 *
 * @exports { renderNavigation, updateActiveNavItem }
 */

import { navigateTo, getCurrentRoute } from './router.js';

export function renderNavigation() {
  const navContainer = document.getElementById('app-navigation');
  if (!navContainer) return;

  navContainer.innerHTML = `
    <nav class="bottom-nav" aria-label="Navegación principal">
      <button class="bottom-nav__item" data-path="/dashboard">
        <span class="bottom-nav__icon">🏠</span>
        <span class="bottom-nav__label">Inicio</span>
      </button>
      <button class="bottom-nav__item" data-path="/lineup">
        <span class="bottom-nav__icon">📋</span>
        <span class="bottom-nav__label">Mi 11</span>
      </button>
      <button class="bottom-nav__item" data-path="/market">
        <span class="bottom-nav__icon">⚡</span>
        <span class="bottom-nav__label">Mercado</span>
      </button>
      <button class="bottom-nav__item" data-path="/ranking">
        <span class="bottom-nav__icon">🏆</span>
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
    } else {
      item.classList.remove('bottom-nav__item--active');
    }
  });
}
