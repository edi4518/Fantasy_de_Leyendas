/**
 * @file profile.js
 * @description Controlador modular para la vista de Editar Perfil de Fantasy de Leyendas.
 * Consume el endpoint GET /api/me, procesa el guardado mediante PUT/PATCH a /api/me
 * y gestiona el cierre de sesión y carga local de avatar.
 *
 * @exports { initProfile, initProfileView, fetchProfileData, renderProfile, resizeAndCompressImage, DEFAULT_PROFILE_DATA }
 */

import { authService } from '../../services/auth-service.js';
import { apiClient } from '../../services/api-client.js';

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
  let cachedAvatar = null;
  try {
    cachedAvatar = localStorage.getItem('user_avatar') || null;
  } catch (_) {}

  try {
    const data = await apiClient.get('/me');
    if (data) {
      const normalized = normalizeProfileData(data);
      if (cachedAvatar && cachedAvatar.startsWith('data:image/')) {
        normalized.avatarUrl = cachedAvatar;
      } else if (!normalized.avatarUrl && cachedAvatar) {
        normalized.avatarUrl = cachedAvatar;
      }
      return normalized;
    }
  } catch (error) {
    console.info('[Profile] Backend no disponible o modo offline. Usando datos guardados:', error.message);
  }

  // Fusión con usuario en localStorage
  try {
    const localUser = JSON.parse(localStorage.getItem('user') || '{}');
    if (
      localUser &&
      (localUser.name ||
        localUser.username ||
        localUser.team_name ||
        localUser.first_name ||
        localUser.avatar_url ||
        localUser.photo_url ||
        cachedAvatar)
    ) {
      return normalizeProfileData(localUser);
    }
  } catch (e) {
    console.debug('[Profile] Error leyendo usuario local:', e);
  }

  return {
    ...DEFAULT_PROFILE_DATA,
    avatarUrl: cachedAvatar || DEFAULT_PROFILE_DATA.avatarUrl
  };
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
  let localCachedAvatar = null;
  try {
    localCachedAvatar = localStorage.getItem('user_avatar') || null;
  } catch (_) {}

  return {
    firstName: raw.first_name || raw.firstName || defaultFirst,
    lastName: raw.last_name || raw.lastName || defaultLast,
    teamName: raw.team_name || raw.teamName || raw.club_name || DEFAULT_PROFILE_DATA.teamName,
    email: raw.email || DEFAULT_PROFILE_DATA.email,
    avatarUrl:
      raw.avatar_url ||
      raw.avatarUrl ||
      raw.photo_url ||
      raw.profile_picture ||
      localCachedAvatar ||
      null,
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

  // Avatar circular mediante backgroundImage optimizado
  const avatarContainer = document.getElementById('profile-avatar-display');
  if (avatarContainer && data.avatarUrl) {
    applyAvatarBackground(
      avatarContainer,
      data.avatarUrl,
      `Avatar de ${data.firstName || 'Mánager'}`
    );
  }
}

let toastTimeoutId = null;
let isSavingProfile = false;
let pendingAvatarUrl = null;
let currentAvatarUrl = null;

/**
 * Aplica un Data URL o URL de imagen como backgroundImage en #profile-avatar-display.
 * @param {HTMLElement} avatarContainer
 * @param {string} imageUrl
 * @param {string} [ariaLabel='Avatar actual']
 */
function applyAvatarBackground(avatarContainer, imageUrl, ariaLabel = 'Avatar actual') {
  if (!avatarContainer || !imageUrl) return;
  avatarContainer.style.backgroundImage = `url("${imageUrl}")`;
  avatarContainer.style.backgroundSize = 'cover';
  avatarContainer.style.backgroundPosition = 'center';
  avatarContainer.style.backgroundRepeat = 'no-repeat';
  avatarContainer.classList.add('has-avatar');
  avatarContainer.setAttribute('aria-label', ariaLabel);
}

/**
 * Redimensiona y comprime una imagen en el cliente usando FileReader + Image + HTML5 <canvas>,
 * respetando la relación de aspecto original y exportando en formato WebP ligero.
 *
 * @param {File} file - Archivo de imagen seleccionado por el usuario.
 * @param {number} [maxWidth=400] - Ancho máximo permitido en píxeles.
 * @param {number} [maxHeight=400] - Alto máximo permitido en píxeles.
 * @param {number} [quality=0.8] - Calidad de compresión entre 0 y 1.
 * @returns {Promise<string>} Promesa que resuelve al Base64 optimizado (data:image/webp;base64,...).
 */
export function resizeAndCompressImage(file, maxWidth = 400, maxHeight = 400, quality = 0.8) {
  return new Promise((resolve, reject) => {
    if (!file || !file.type || !file.type.startsWith('image/')) {
      reject(new Error('El archivo seleccionado no es una imagen válida.'));
      return;
    }

    const reader = new FileReader();

    reader.onerror = () => {
      reject(new Error('Error al leer el archivo de imagen.'));
    };

    reader.onload = (readerEvent) => {
      const rawDataUrl = readerEvent.target?.result;
      if (typeof rawDataUrl !== 'string') {
        reject(new Error('No se pudo obtener el contenido del archivo.'));
        return;
      }

      const img = new Image();

      img.onerror = () => {
        reject(new Error('No se pudo decodificar la imagen seleccionada.'));
      };

      img.onload = () => {
        const sourceWidth = img.naturalWidth || img.width;
        const sourceHeight = img.naturalHeight || img.height;

        if (!sourceWidth || !sourceHeight) {
          reject(new Error('Dimensiones de imagen inválidas.'));
          return;
        }

        // Escalar respetando estrictamente el aspect ratio sin agrandar imágenes pequeñas
        const scaleRatio = Math.min(maxWidth / sourceWidth, maxHeight / sourceHeight, 1);
        const targetWidth = Math.max(1, Math.round(sourceWidth * scaleRatio));
        const targetHeight = Math.max(1, Math.round(sourceHeight * scaleRatio));

        const canvas = document.createElement('canvas');
        canvas.width = targetWidth;
        canvas.height = targetHeight;

        const ctx = canvas.getContext('2d');
        if (!ctx) {
          reject(new Error('No se pudo inicializar el contexto 2D del canvas.'));
          return;
        }

        ctx.imageSmoothingEnabled = true;
        ctx.imageSmoothingQuality = 'high';
        ctx.clearRect(0, 0, targetWidth, targetHeight);
        ctx.drawImage(img, 0, 0, targetWidth, targetHeight);

        let compressedDataUrl = canvas.toDataURL('image/webp', quality);
        // Respaldo automático a JPEG comprimido si el navegador no soporta codificación WebP en canvas
        if (!compressedDataUrl.startsWith('data:image/webp')) {
          compressedDataUrl = canvas.toDataURL('image/jpeg', quality);
        }

        resolve(compressedDataUrl);
      };

      img.src = rawDataUrl;
    };

    reader.readAsDataURL(file);
  });
}

/**
 * Manejador para el cambio de imagen de perfil local con compresión en cliente y preview instantáneo.
 */
export function setupAvatarUploader() {
  const changeBtn = document.getElementById('btn-change-avatar');
  const fileInput = document.getElementById('avatar-file-input');
  const avatarDisplay = document.getElementById('profile-avatar-display');

  if (changeBtn && fileInput) {
    changeBtn.addEventListener('click', () => {
      fileInput.click();
    });

    fileInput.addEventListener('change', async (e) => {
      const file = e.target.files?.[0];
      if (!file || !avatarDisplay) return;

      try {
        const optimizedBase64 = await resizeAndCompressImage(file, 400, 400, 0.8);
        pendingAvatarUrl = optimizedBase64;
        currentAvatarUrl = optimizedBase64;
        applyAvatarBackground(avatarDisplay, optimizedBase64, 'Foto de perfil seleccionada');

        // Persistir de inmediato en localStorage y backend (/api/me) para que se visualice en .manager-avatar
        try {
          localStorage.setItem('user_avatar', optimizedBase64);
          const localUser = JSON.parse(localStorage.getItem('user') || '{}');
          localUser.avatar_url = optimizedBase64;
          localUser.photo_url = optimizedBase64;
          localStorage.setItem('user', JSON.stringify(localUser));
        } catch (storageErr) {
          console.warn('[Profile] Aviso guardando user_avatar en localStorage:', storageErr);
        }

        apiClient
          .put('/me', { avatar_url: optimizedBase64 })
          .then((res) => {
            if (res?.avatarUrl) {
              try {
                const localUser = JSON.parse(localStorage.getItem('user') || '{}');
                localUser.photo_url = res.avatarUrl;
                localStorage.setItem('user', JSON.stringify(localUser));
              } catch (_) {}
            }
          })
          .catch(() => null);

        window.dispatchEvent(
          new CustomEvent('fantasy:profile-updated', { detail: { avatarUrl: optimizedBase64 } })
        );
      } catch (err) {
        console.warn('[Profile] Error al comprimir imagen de avatar:', err);
        showToast('No se pudo procesar la imagen seleccionada', 3000);
      } finally {
        // Permitir volver a seleccionar el mismo archivo si el usuario lo desea
        fileInput.value = '';
      }
    });
  }
}

/**
 * Procesa el envío del formulario para guardar cambios en el perfil.
 */
export async function handleSaveProfile(event) {
  if (event) event.preventDefault();
  if (isSavingProfile) return;

  const saveBtn = document.getElementById('btn-save-profile');
  const headerSaveBtn = document.getElementById('btn-header-save');
  const form = document.getElementById('profile-form');

  if (!form) return;
  isSavingProfile = true;

  const firstName = document.getElementById('profile-first-name')?.value.trim() || '';
  const lastName = document.getElementById('profile-last-name')?.value.trim() || '';
  const teamName = document.getElementById('profile-team-name')?.value.trim() || '';
  const resolvedAvatarUrl = pendingAvatarUrl || currentAvatarUrl || null;

  const payload = {
    first_name: firstName,
    last_name: lastName,
    team_name: teamName,
    avatar_url: resolvedAvatarUrl,
    preferences: {
      notifications: Boolean(document.getElementById('pref-notifications')?.checked),
      sounds: Boolean(document.getElementById('pref-sounds')?.checked)
    }
  };

  // Guardar en localStorage (imagen WebP optimizada <= ~25 KB, evitando QuotaExceededError)
  try {
    const localUser = JSON.parse(localStorage.getItem('user') || '{}');
    localUser.first_name = firstName;
    localUser.last_name = lastName;
    localUser.team_name = teamName;
    localUser.name = `${firstName} ${lastName}`.trim();
    if (resolvedAvatarUrl) {
      localUser.avatar_url = resolvedAvatarUrl;
      localUser.photo_url = resolvedAvatarUrl;
      currentAvatarUrl = resolvedAvatarUrl;
      localStorage.setItem('user_avatar', resolvedAvatarUrl);
    }
    localStorage.setItem('user', JSON.stringify(localUser));
  } catch (e) {
    console.warn('[Profile] Error actualizando user en localStorage:', e);
  }

  // Feedback visual de guardado
  const originalSaveText = saveBtn ? saveBtn.innerHTML : 'GUARDAR CAMBIOS';
  if (saveBtn) {
    saveBtn.disabled = true;
    saveBtn.innerHTML = `<span>GUARDANDO...</span>`;
  }
  if (headerSaveBtn) headerSaveBtn.disabled = true;

  try {
    const updatedRes = await apiClient.put('/me', payload).catch(() => null);
    if (updatedRes?.avatarUrl) {
      try {
        const localUser = JSON.parse(localStorage.getItem('user') || '{}');
        localUser.photo_url = updatedRes.avatarUrl;
        localStorage.setItem('user', JSON.stringify(localUser));
      } catch (_) {}
    }

    window.dispatchEvent(
      new CustomEvent('fantasy:profile-updated', {
        detail: { avatarUrl: resolvedAvatarUrl || updatedRes?.avatarUrl || null }
      })
    );

    showToast('Cambios guardados correctamente', 3000);
  } catch (error) {
    console.warn('[Profile] Error al guardar cambios en backend:', error);
    showToast('Cambios guardados localmente', 3000);
  } finally {
    setTimeout(() => {
      if (saveBtn) {
        saveBtn.disabled = false;
        saveBtn.innerHTML = originalSaveText;
      }
      if (headerSaveBtn) headerSaveBtn.disabled = false;
      isSavingProfile = false;
    }, 400);
  }
}

/**
 * Manejador del botón de Cerrar Sesión.
 * Limpia todos los tokens de autenticación y redirige a la pantalla de Login (/login).
 * @param {Object} [router]
 */
export function handleLogout(router) {
  console.info('[Profile] Ejecutando cierre de sesión...');
  if (authService && typeof authService.logout === 'function') {
    authService.logout({ redirect: false });
  }

  localStorage.removeItem('access_token');
  localStorage.removeItem('auth_token');
  localStorage.removeItem('user');
  localStorage.removeItem('team_name');
  localStorage.removeItem('user_avatar');
  localStorage.removeItem('fantasy_active_squad');
  localStorage.removeItem('fantasy_player_stats');
  localStorage.setItem('hasSeenOnboarding', 'true');

  const isStaticHtml =
    window.location.pathname.includes('index.html') ||
    window.location.pathname.endsWith('/public/');

  if (!isStaticHtml && window.location.search) {
    window.history.replaceState({}, '', '/login');
  }

  const activeRouter = router || window.router;
  if (activeRouter && typeof activeRouter.navigate === 'function') {
    activeRouter.navigate('/login');
  } else if (isStaticHtml) {
    window.location.hash = '#/login';
  } else {
    window.location.replace('/login');
  }
}

/**
 * Oculta inmediatamente el Toast de perfil.
 */
export function hideToast() {
  const toast = document.getElementById('profile-toast');
  if (!toast) return;
  if (toastTimeoutId) {
    clearTimeout(toastTimeoutId);
    toastTimeoutId = null;
  }
  toast.classList.remove('is-visible');
  toast.hidden = true;
  toast.setAttribute('hidden', '');
  toast.style.display = 'none';
}

/**
 * Muestra un mensaje flotante tipo Toast accesible durante unos segundos.
 * @param {string} message
 * @param {number} [durationMs=3000]
 */
export function showToast(message = 'Cambios guardados correctamente', durationMs = 3000) {
  const toast = document.getElementById('profile-toast');
  const messageEl = document.getElementById('toast-message');

  if (toast && messageEl) {
    if (toastTimeoutId) {
      clearTimeout(toastTimeoutId);
    }
    messageEl.textContent = message;
    toast.hidden = false;
    toast.removeAttribute('hidden');
    toast.style.display = '';
    toast.classList.add('is-visible');

    toastTimeoutId = setTimeout(() => {
      hideToast();
    }, durationMs);
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

  const headerSaveBtn = document.querySelector('.profile-header__save-btn');
  if (headerSaveBtn) {
    headerSaveBtn.addEventListener('click', (e) => {
      e.preventDefault();
      handleSaveProfile(e);
    });
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
  pendingAvatarUrl = null;
  currentAvatarUrl = null;
  isSavingProfile = false;
  hideToast();
  renderProfile(DEFAULT_PROFILE_DATA);
  setupProfileEventListeners(router);

  const liveData = await fetchProfileData();
  currentAvatarUrl = liveData.avatarUrl || null;
  renderProfile(liveData);
}

export const initProfileView = initProfile;
