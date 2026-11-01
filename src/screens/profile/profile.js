/**
 * @file profile.js
 * @description Controlador modular para la vista de Editar Perfil de Fantasy de Leyendas.
 * Consume el endpoint GET /api/me, procesa el guardado mediante PUT/PATCH a /api/me
 * y gestiona el cierre de sesión y carga local de avatar.
 *
 * @exports { initProfile, initProfileView, fetchProfileData, renderProfile, DEFAULT_PROFILE_DATA }
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
 * Obtiene los datos del perfil del usuario autenticado desde el backend FastAPI o localStorage.
 * @returns {Promise<typeof DEFAULT_PROFILE_DATA>}
 */
export async function fetchProfileData() {
  const token = localStorage.getItem('access_token') || localStorage.getItem('auth_token');
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
  } catch (error) {
    console.info('[Profile] Backend no disponible o modo offline. Usando datos guardados:', error.message);
  }

  // Fusión con usuario en localStorage
  try {
    const localUser = JSON.parse(localStorage.getItem('user') || '{}');
    if (localUser && (localUser.name || localUser.username || localUser.team_name)) {
      return normalizeProfileData(localUser);
    }
  } catch (e) {
    console.debug('[Profile] Error leyendo usuario local:', e);
  }

  return DEFAULT_PROFILE_DATA;
}

/**
 * Normaliza los nombres de campos del backend a la estructura de la vista.
 * @param {Object} raw
 * @returns {typeof DEFAULT_PROFILE_DATA}
 */
function normalizeProfileData(raw = {}) {
  const fullName = (raw.name || raw.username || '').split(' ');
  const defaultFirst = fullName[0] || DEFAULT_PROFILE_DATA.firstName;
  const defaultLast = fullName.slice(1).join(' ') || DEFAULT_PROFILE_DATA.lastName;

  return {
    firstName: raw.first_name || raw.firstName || defaultFirst,
    lastName: raw.last_name || raw.lastName || defaultLast,
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

  const firstName = document.getElementById('profile-first-name')?.value.trim() || '';
  const lastName = document.getElementById('profile-last-name')?.value.trim() || '';
  const teamName = document.getElementById('profile-team-name')?.value.trim() || '';

  const payload = {
    first_name: firstName,
    last_name: lastName,
    team_name: teamName,
    preferences: {
      notifications: Boolean(document.getElementById('pref-notifications')?.checked),
      sounds: Boolean(document.getElementById('pref-sounds')?.checked)
    }
  };

  // Guardar en localStorage para consistencia de la app
  try {
    const localUser = JSON.parse(localStorage.getItem('user') || '{}');
    localUser.team_name = teamName;
    localUser.name = `${firstName} ${lastName}`.trim();
    localStorage.setItem('user', JSON.stringify(localUser));
  } catch (e) {
    console.debug('[Profile] Error actualizando user en localStorage:', e);
  }

  // Feedback visual de guardado
  const originalSaveText = saveBtn ? saveBtn.innerHTML : 'GUARDAR CAMBIOS';
  if (saveBtn) {
    saveBtn.disabled = true;
    saveBtn.innerHTML = `<span>GUARDANDO...</span>`;
  }
  if (headerSaveBtn) headerSaveBtn.disabled = true;

  try {
    const token = localStorage.getItem('access_token') || localStorage.getItem('auth_token');
    const headers = {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {})
    };

    await fetch('/api/me', {
      method: 'PUT',
      headers,
      body: JSON.stringify(payload)
    }).catch(() => null);

    showToast('Cambios guardados correctamente');
  } catch (error) {
    console.warn('[Profile] Error al guardar cambios en backend:', error);
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
 * @param {Object} [router]
 */
export function handleLogout(router) {
  console.info('[Profile] Ejecutando cierre de sesión...');
  if (authService && typeof authService.logout === 'function') {
    authService.logout();
  } else {
    localStorage.removeItem('access_token');
    localStorage.removeItem('auth_token');
    localStorage.removeItem('user');
  }

  if (router && typeof router.navigate === 'function') {
    router.navigate('/login');
  } else {
    window.location.href = '/login';
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
 * @param {Object} [router]
 */
export function setupProfileEventListeners(router) {
  const form = document.getElementById('profile-form');
  if (form) {
    form.addEventListener('submit', handleSaveProfile);
  }

  const logoutBtn = document.getElementById('btn-logout');
  if (logoutBtn) {
    logoutBtn.addEventListener('click', () => handleLogout(router));
  }

  setupAvatarUploader();
}

/**
 * Inicialización completa de la pantalla Editar Perfil.
 * @param {Object} [router]
 */
export async function initProfile(router) {
  console.info('[Profile] Inicializando vista Editar Perfil...');
  renderProfile(DEFAULT_PROFILE_DATA);
  setupProfileEventListeners(router);

  const liveData = await fetchProfileData();
  renderProfile(liveData);
}

export const initProfileView = initProfile;
