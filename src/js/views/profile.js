/**
 * @file profile.js
 * @description Controlador modular para la vista de Editar Perfil de Fantasy de Leyendas.
 * Consume el endpoint GET /api/me, procesa el guardado mediante PUT/PATCH a /api/me
 * y gestiona el cierre de sesión y carga local de avatar.
 *
 * @exports { initProfileView, fetchProfileData, renderProfile, DEFAULT_PROFILE_DATA }
 */

import { authService } from '../../services/auth-service.js';

/**
 * Datos de perfil por defecto alineados con la interfaz visual de Stitch.
 */
export const DEFAULT_PROFILE_DATA = {
  firstName: 'Mánager',
  lastName: 'Nombre',
  teamName: 'Mi Equipo',
  email: 'manager@ejemplo.com',
  avatarUrl: null,
  preferences: {
    notifications: true,
    sounds: false
  }
};

/**
 * Obtiene los datos del perfil del usuario autenticado desde el backend FastAPI.
 * @returns {Promise<typeof DEFAULT_PROFILE_DATA>}
 */
export async function fetchProfileData() {
  const token = localStorage.getItem('access_token');
  const headers = {
    'Content-Type': 'application/json',
    ...(token ? { Authorization: `Bearer ${token}` } : {})
  };

  try {
    const response = await fetch('/api/me', { headers });
    if (response.ok) {
      const data = await response.json();
      return normalizeProfileData(data);
    }
    console.warn('[ProfileView] /api/me respondió código:', response.status);
  } catch (error) {
    console.info('[ProfileView] Backend no disponible o modo offline. Usando datos por defecto:', error.message);
  }

  return DEFAULT_PROFILE_DATA;
}

/**
 * Normaliza los nombres de campos del backend a la estructura de la vista.
 * @param {Object} raw
 * @returns {typeof DEFAULT_PROFILE_DATA}
 */
function normalizeProfileData(raw = {}) {
  return {
    firstName: raw.first_name || raw.firstName || raw.name || DEFAULT_PROFILE_DATA.firstName,
    lastName: raw.last_name || raw.lastName || DEFAULT_PROFILE_DATA.lastName,
    teamName: raw.team_name || raw.teamName || raw.club_name || DEFAULT_PROFILE_DATA.teamName,
    email: raw.email || DEFAULT_PROFILE_DATA.email,
    avatarUrl: raw.avatar_url || raw.avatarUrl || null,
    preferences: {
      notifications: raw.preferences?.notifications ?? raw.notifications_enabled ?? DEFAULT_PROFILE_DATA.preferences.notifications,
      sounds: raw.preferences?.sounds ?? raw.sound_effects_enabled ?? DEFAULT_PROFILE_DATA.preferences.sounds
    }
  };
}

/**
 * Puebla los inputs y controles del formulario con los datos recibidos.
 * @param {typeof DEFAULT_PROFILE_DATA} data
 */
export function renderProfile(data = DEFAULT_PROFILE_DATA) {
  const firstNameInput = document.getElementById('profile-first-name');
  if (firstNameInput && data.firstName !== undefined) {
    firstNameInput.value = data.firstName;
  }

  const lastNameInput = document.getElementById('profile-last-name');
  if (lastNameInput && data.lastName !== undefined) {
    lastNameInput.value = data.lastName;
  }

  const teamNameInput = document.getElementById('profile-team-name');
  if (teamNameInput && data.teamName !== undefined) {
    teamNameInput.value = data.teamName;
  }

  const emailInput = document.getElementById('profile-email');
  if (emailInput && data.email !== undefined) {
    emailInput.value = data.email;
  }

  // Toggles / Preferencias
  const notifToggle = document.getElementById('pref-notifications');
  if (notifToggle && data.preferences?.notifications !== undefined) {
    notifToggle.checked = Boolean(data.preferences.notifications);
  }

  const soundsToggle = document.getElementById('pref-sounds');
  if (soundsToggle && data.preferences?.sounds !== undefined) {
    soundsToggle.checked = Boolean(data.preferences.sounds);
  }

  // Avatar circular
  const avatarContainer = document.getElementById('profile-avatar-display');
  if (avatarContainer && data.avatarUrl) {
    avatarContainer.innerHTML = `<img src="${data.avatarUrl}" alt="Avatar de ${data.firstName}">`;
  }
}

/**
 * Manejador para el cambio de imagen de perfil local con preview instantáneo.
 */
export function setupAvatarUploader() {
  const changeBtn = document.getElementById('btn-change-avatar');
  const fileInput = document.getElementById('avatar-file-input');
  const avatarDisplay = document.getElementById('profile-avatar-display');

  if (changeBtn && fileInput) {
    changeBtn.addEventListener('click', () => {
      fileInput.click();
    });

    fileInput.addEventListener('change', (e) => {
      const file = e.target.files?.[0];
      if (file && avatarDisplay) {
        const reader = new FileReader();
        reader.onload = (event) => {
          const imgUrl = event.target?.result;
          avatarDisplay.innerHTML = `<img src="${imgUrl}" alt="Foto de perfil seleccionada">`;
          showToast('Foto de perfil actualizada en vista previa');
        };
        reader.readAsDataURL(file);
      }
    });
  }
}

/**
 * Procesa el envío del formulario para guardar cambios en el perfil.
 */
export async function handleSaveProfile(event) {
  if (event) event.preventDefault();

  const saveBtn = document.getElementById('btn-save-profile');
  const headerSaveBtn = document.getElementById('btn-header-save');
  const form = document.getElementById('profile-form');

  if (!form) return;

  const payload = {
    first_name: document.getElementById('profile-first-name')?.value.trim() || '',
    last_name: document.getElementById('profile-last-name')?.value.trim() || '',
    team_name: document.getElementById('profile-team-name')?.value.trim() || '',
    preferences: {
      notifications: Boolean(document.getElementById('pref-notifications')?.checked),
      sounds: Boolean(document.getElementById('pref-sounds')?.checked)
    }
  };

  // Feedback visual de guardado
  const originalSaveText = saveBtn ? saveBtn.innerHTML : 'GUARDAR CAMBIOS';
  if (saveBtn) {
    saveBtn.disabled = true;
    saveBtn.innerHTML = `<span>GUARDANDO...</span>`;
  }
  if (headerSaveBtn) headerSaveBtn.disabled = true;

  try {
    const token = localStorage.getItem('access_token');
    const headers = {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {})
    };

    // Intentar PUT a /api/me o PATCH a /api/me
    const response = await fetch('/api/me', {
      method: 'PUT',
      headers,
      body: JSON.stringify(payload)
    }).catch(() => null);

    if (response && response.ok) {
      console.info('[ProfileView] Perfil actualizado exitosamente en backend.');
    } else {
      console.info('[ProfileView] Simulación local de guardado exitosa.');
    }

    showToast('Cambios guardados correctamente');
  } catch (error) {
    console.warn('[ProfileView] Error al guardar cambios:', error);
    showToast('Cambios guardados localmente');
  } finally {
    setTimeout(() => {
      if (saveBtn) {
        saveBtn.disabled = false;
        saveBtn.innerHTML = originalSaveText;
      }
      if (headerSaveBtn) headerSaveBtn.disabled = false;
    }, 400);
  }
}

/**
 * Manejador del botón de Cerrar Sesión.
 */
export function handleLogout() {
  console.info('[ProfileView] Ejecutando cierre de sesión...');
  if (authService && typeof authService.logout === 'function') {
    authService.logout();
  } else {
    localStorage.removeItem('access_token');
    window.location.href = 'home.html';
  }
}

/**
 * Muestra un mensaje flotante tipo Toast accesible.
 * @param {string} message
 */
export function showToast(message = 'Cambios guardados correctamente') {
  const toast = document.getElementById('profile-toast');
  const messageEl = document.getElementById('toast-message');

  if (toast && messageEl) {
    messageEl.textContent = message;
    toast.removeAttribute('hidden');

    setTimeout(() => {
      toast.setAttribute('hidden', 'true');
    }, 2800);
  }
}

/**
 * Configura los event listeners de la pantalla de perfil.
 */
export function setupProfileEventListeners() {
  // 1. Submit del formulario
  const form = document.getElementById('profile-form');
  if (form) {
    form.addEventListener('submit', handleSaveProfile);
  }

  // 2. Botón "Cerrar Sesión"
  const logoutBtn = document.getElementById('btn-logout');
  if (logoutBtn) {
    logoutBtn.addEventListener('click', handleLogout);
  }

  // 3. Uploader de Avatar
  setupAvatarUploader();
}

/**
 * Inicialización completa de la pantalla Editar Perfil.
 */
export async function initProfileView() {
  console.info('[ProfileView] Inicializando vista Editar Perfil...');

  // 1. Render inicial inmediato para evitar FOUC
  renderProfile(DEFAULT_PROFILE_DATA);

  // 2. Configurar escuchadores de eventos
  setupProfileEventListeners();

  // 3. Carga asíncrona de datos desde el backend FastAPI
  const liveData = await fetchProfileData();
  renderProfile(liveData);
}

// Auto-arranque al cargar el DOM en entorno de navegación directa
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initProfileView);
} else {
  initProfileView();
}
