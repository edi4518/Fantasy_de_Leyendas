/*
 Controlador de Autenticación (Login & Registro)
 Manejo de credenciales, alternancia de visibilidad de contraseña,
 carga de foto de perfil y persistencia de sesión.
 */

import { navigateTo } from "../../app/router.js";
import { API_BASE_URL } from "../../services/api-client.js";

const ICON_EYE_PATH = '/src/assets/icons/eye-open.svg';
const ICON_EYE_OFF_PATH = '/src/assets/icons/eye-off.svg';

/**
 * Función principal exportada: enruta según la subvista
 */
export function initAuth(subview = 'login', router) {
  if (subview === 'register') {
    initRegister(router);
    return;
  }
  initLogin(router);
}

/*
  1. LÓGICA DE INICIO DE SESIÓN (LOGIN)
 */

function initLogin(router) {
  const form = document.getElementById('login-form');
  const emailInput = document.getElementById('email');
  const passwordInput = document.getElementById('password');
  const emailWrapper = document.getElementById('email-wrapper');
  const passwordWrapper = document.getElementById('password-wrapper');
  const emailGroup = emailInput?.closest('.form-group');
  const passwordGroup = passwordInput?.closest('.form-group');
  const errorMessage = document.getElementById('error-message');
  const togglePasswordBtn = document.getElementById('toggle-password-btn');
  const eyeIconImg = document.getElementById('eye-icon-img');
  const submitBtn = document.getElementById('submit-btn');

  const googleBtn = document.getElementById('google-login-btn');
  const appleBtn = document.getElementById('apple-login-btn');
  const guestBtn = document.getElementById('guest-login-btn');

  // Integración de Google Identity Services (OAuth 2.0)
  const GOOGLE_CLIENT_ID = '367906456287-h602ut2oho5r8c0q9cpa0epevsil3juo.apps.googleusercontent.com';
  let pendingGoogleCredential = null;
  const teamModal = document.getElementById('google-team-modal');
  const teamInput = document.getElementById('google-team-name-input');
  const teamSubmitBtn = document.getElementById('google-team-submit-btn');
  const teamModalError = document.getElementById('google-modal-error');
  const welcomeTitle = document.getElementById('google-welcome-title');
  const avatarImg = document.getElementById('google-modal-avatar');
  const avatarFallback = document.getElementById('google-modal-avatar-fallback');

  async function handleGoogleResponse(response) {
    if (!response || !response.credential) return;
    try {
      setLoadingState(true);
      clearErrorState();
      const res = await authService.loginWithGoogle(response.credential);

      if (res.is_new_user) {
        // Usuario nuevo: mostrar modal para elegir nombre de club
        pendingGoogleCredential = response.credential;
        if (welcomeTitle && res.first_name) {
          welcomeTitle.textContent = `¡Bienvenido, ${res.first_name}!`;
        }
        if (avatarImg && res.photo_url) {
          avatarImg.src = res.photo_url;
          avatarImg.style.display = 'block';
          if (avatarFallback) avatarFallback.style.display = 'none';
        }
        if (teamModal) {
          teamModal.style.display = 'flex';
          teamModal.classList.remove('hidden');
          setTimeout(() => teamInput?.focus(), 150);
        }
      } else if (res.access_token) {
        // Usuario existente: login directo al dashboard
        localStorage.setItem('hasSeenOnboarding', 'true');
        if (res.user) {
          localStorage.setItem('user', JSON.stringify(res.user));
          if (res.user.team_name) {
            localStorage.setItem('team_name', res.user.team_name);
          }
        }
        if (router && typeof router.navigate === 'function') {
          router.navigate('/dashboard');
        } else {
          window.location.pathname = '/dashboard';
        }
      }
    } catch (err) {
      showErrorMessage(err.message || 'Error al autenticar con Google. Por favor, reintenta.');
    } finally {
      setLoadingState(false);
    }
  }

  // Confirmar nombre de club en el modal de nuevo mánager
  if (teamSubmitBtn && teamInput) {
    teamSubmitBtn.addEventListener('click', async () => {
      const teamName = teamInput.value.trim();
      if (!teamName) {
        if (teamModalError) {
          teamModalError.textContent = 'Por favor, ingresa un nombre para tu equipo.';
          teamModalError.style.display = 'block';
        }
        teamInput.focus();
        return;
      }
      if (teamName.length < 3) {
        if (teamModalError) {
          teamModalError.textContent = 'El nombre debe tener al menos 3 caracteres.';
          teamModalError.style.display = 'block';
        }
        teamInput.focus();
        return;
      }

      try {
        teamSubmitBtn.disabled = true;
        teamSubmitBtn.textContent = 'CREANDO CLUB...';
        if (teamModalError) teamModalError.style.display = 'none';

        const res = await authService.loginWithGoogle(pendingGoogleCredential, teamName);
        if (res.access_token) {
          localStorage.setItem('hasSeenOnboarding', 'true');
          if (res.user) {
            localStorage.setItem('user', JSON.stringify(res.user));
            localStorage.setItem('team_name', res.user.team_name || teamName);
          }
          if (teamModal) teamModal.style.display = 'none';
          if (router && typeof router.navigate === 'function') {
            router.navigate('/dashboard');
          } else {
            window.location.pathname = '/dashboard';
          }
        }
      } catch (err) {
        if (teamModalError) {
          teamModalError.textContent = err.message || 'No se pudo crear el club.';
          teamModalError.style.display = 'block';
        }
      } finally {
        teamSubmitBtn.disabled = false;
        teamSubmitBtn.textContent = '¡CREAR CLUB Y EMPEZAR!';
      }
    });

    teamInput.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        teamSubmitBtn.click();
      }
    });
  }

  // Inicializar Google Identity Services SDK
  function initGoogleGSI() {
    if (typeof window !== 'undefined' && window.google?.accounts?.id) {
      try {
        window.google.accounts.id.initialize({
          client_id: GOOGLE_CLIENT_ID,
          callback: handleGoogleResponse,
          auto_select: false,
          cancel_on_tap_outside: true,
        });

        const gContainer = document.getElementById('google-login-container');
        if (gContainer) {
          window.google.accounts.id.renderButton(gContainer, {
            type: 'standard',
            theme: 'outline',
            size: 'large',
            text: 'continue_with',
            shape: 'rectangular',
            logo_alignment: 'left',
            width: 320,
          });
        }
      } catch (gErr) {
        console.warn('[Google Auth] Aviso al inicializar SDK:', gErr);
      }
    } else {
      setTimeout(initGoogleGSI, 300);
    }
  }

  initGoogleGSI();

  if (guestBtn) {
    guestBtn.addEventListener('click', (e) => {
      e.preventDefault();
      localStorage.setItem('hasSeenOnboarding', 'true');
      if (!localStorage.getItem('auth_token')) {
        localStorage.setItem('auth_token', 'dev-test-token');
        localStorage.setItem('user', JSON.stringify({ name: 'Mánager Leyenda', email: 'manager@fantasy.com' }));
      }
      if (router && typeof router.navigate === 'function') {
        router.navigate('/dashboard');
      } else {
        navigateTo('/dashboard');
      }
    });
  }

  clearErrorState();

  if (togglePasswordBtn && passwordInput) {
    togglePasswordBtn.addEventListener('click', () => {
      const isPassword = passwordInput.type === 'password';
      passwordInput.type = isPassword ? 'text' : 'password';

      if (eyeIconImg) {
        eyeIconImg.src = isPassword ? ICON_EYE_OFF_PATH : ICON_EYE_PATH;
        eyeIconImg.alt = isPassword ? 'Ocultar contraseña' : 'Ver contraseña';
      }

      togglePasswordBtn.setAttribute(
        'aria-label',
        isPassword ? 'Ocultar contraseña' : 'Mostrar contraseña'
      );
    });
  }

  emailInput?.addEventListener('input', () => {
    emailGroup?.classList.remove('has-error');
    emailWrapper?.classList.remove('has-error');
    if (!passwordGroup?.classList.contains('has-error')) {
      clearErrorMessage();
    }
  });

  passwordInput?.addEventListener('input', () => {
    passwordGroup?.classList.remove('has-error');
    passwordWrapper?.classList.remove('has-error');
    if (!emailGroup?.classList.contains('has-error')) {
      clearErrorMessage();
    }
  });



  appleBtn?.addEventListener('click', () => {
    window.location.href = 'https://appleid.apple.com/';
  });

  if (form) {
    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      clearErrorState();

      const email = emailInput?.value.trim() || '';
      const password = passwordInput?.value || '';

      const isEmailEmpty = !email;
      const isPasswordEmpty = !password;
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      const isEmailInvalid = !isEmailEmpty && !emailRegex.test(email);

      // Validación de campos vacíos o incorrectos
      if (isEmailEmpty || isEmailInvalid || isPasswordEmpty) {
        if (isEmailEmpty || isEmailInvalid) {
          emailGroup?.classList.add('has-error');
          emailWrapper?.classList.add('has-error');
        }
        if (isPasswordEmpty) {
          passwordGroup?.classList.add('has-error');
          passwordWrapper?.classList.add('has-error');
        }

        let msg = 'Datos incorrectos. Por favor, introduce tu correo y contraseña.';
        if (isEmailInvalid) {
          msg = 'Introduce un formato de correo electrónico válido.';
        }
        showErrorMessage(msg);
        return;
      }

      setLoadingState(true);

      try {
        let loggedIn = false;
        let token = 'login_token_' + Date.now();
        let userData = null;

        let response = null;
        try {
          response = await fetch(`${API_BASE_URL}/auth/login`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({ email, password }),
          });
        } catch (fetchErr) {
          console.warn('[Auth] Backend FastAPI offline. Verificando en modo local PWA:', fetchErr.message);
          const savedUserStr = localStorage.getItem('user');
          if (savedUserStr) {
            try {
              userData = JSON.parse(savedUserStr);
              loggedIn = true;
            } catch (_) {}
          }
          if (!loggedIn) {
            userData = { name: email.split('@')[0], email: email, team_name: 'Mi Equipo FC' };
            loggedIn = true;
          }
        }

        if (response) {
          if (response.ok) {
            const data = await response.json().catch(() => ({}));
            token = data.token || data.access_token || token;
            userData = data.user;
            loggedIn = true;
          } else {
            const errData = await response.json().catch(() => ({}));
            throw new Error(errData.detail || 'Credenciales inválidas');
          }
        }

        if (loggedIn) {
          localStorage.setItem('auth_token', token);
          localStorage.setItem('access_token', token);
          localStorage.setItem('hasSeenOnboarding', 'true');
          if (userData) {
            localStorage.setItem('user', JSON.stringify(userData));
          }

          if (router && typeof router.navigate === 'function') {
            router.navigate('/dashboard');
          } else {
            window.location.pathname = '/dashboard';
          }
        }
      } catch (error) {
        emailGroup?.classList.add('has-error');
        emailWrapper?.classList.add('has-error');
        passwordGroup?.classList.add('has-error');
        passwordWrapper?.classList.add('has-error');
        showErrorMessage(error.message || 'Correo o contraseña incorrectos. Por favor, inténtalo de nuevo.');
      } finally {
        setLoadingState(false);
      }
    });
  }

  function showErrorMessage(msg) {
    if (errorMessage) {
      errorMessage.textContent = msg;
      errorMessage.classList.remove('hidden');
    }
  }

  function clearErrorState() {
    clearErrorMessage();
    emailGroup?.classList.remove('has-error');
    emailWrapper?.classList.remove('has-error');
    passwordGroup?.classList.remove('has-error');
    passwordWrapper?.classList.remove('has-error');
  }

  function clearErrorMessage() {
    if (errorMessage) {
      errorMessage.textContent = '';
      errorMessage.classList.add('hidden');
    }
  }

  function setLoadingState(isLoading) {
    if (!submitBtn) return;
    submitBtn.disabled = isLoading;
    submitBtn.textContent = isLoading ? 'INGRESANDO...' : 'INICIAR SESIÓN';
  }
}

/*
 2. LÓGICA DE REGISTRO (REGISTER)
 */

function initRegister(router) {
  const form = document.getElementById('register-form');
  const firstNameInput = document.getElementById('reg-first-name');
  const lastNameInput = document.getElementById('reg-last-name');
  const teamNameInput = document.getElementById('reg-team-name');
  const birthdateInput = document.getElementById('reg-birthdate');
  const emailInput = document.getElementById('reg-email');
  const passwordInput = document.getElementById('reg-password');

  const pictureInput = document.getElementById('profile-picture-input');
  const avatarPreview = document.getElementById('avatar-preview');

  const togglePasswordBtn = document.getElementById('reg-toggle-password-btn');
  const eyeIconImg = document.getElementById('reg-eye-icon-img');
  const errorMessage = document.getElementById('reg-error-message');
  const submitBtn = document.getElementById('reg-submit-btn');

  clearErrors();

  // Preview de foto de perfil
  if (pictureInput && avatarPreview) {
    avatarPreview.addEventListener('click', () => {
      pictureInput.click();
    });

    pictureInput.addEventListener('change', () => {
      const file = pictureInput.files?.[0];
      if (file) {
        const reader = new FileReader();
        reader.onload = (e) => {
          const rawDataUrl = e.target.result;
          const img = new Image();
          img.onload = () => {
            try {
              const canvas = document.createElement('canvas');
              const maxDim = 256;
              let w = img.width || maxDim;
              let h = img.height || maxDim;
              if (w > h && w > maxDim) {
                h = Math.round((h * maxDim) / w);
                w = maxDim;
              } else if (h >= w && h > maxDim) {
                w = Math.round((w * maxDim) / h);
                h = maxDim;
              }
              canvas.width = w;
              canvas.height = h;
              const ctx = canvas.getContext('2d');
              ctx.drawImage(img, 0, 0, w, h);
              const compressedUrl = canvas.toDataURL('image/jpeg', 0.78);
              avatarPreview.innerHTML = `
                <img 
                  src="${compressedUrl}" 
                  alt="Foto de perfil" 
                  style="width: 100%; height: 100%; object-fit: cover; border-radius: 50%;" 
                />
              `;
            } catch (_) {
              avatarPreview.innerHTML = `
                <img 
                  src="${rawDataUrl}" 
                  alt="Foto de perfil" 
                  style="width: 100%; height: 100%; object-fit: cover; border-radius: 50%;" 
                />
              `;
            }
          };
          img.src = rawDataUrl;
        };
        reader.readAsDataURL(file);
      }
    });
  }

  // Máscara DD / MM / AAAA
  if (birthdateInput) {
    birthdateInput.addEventListener('input', (e) => {
      let value = e.target.value.replace(/\D/g, '').slice(0, 8);
      if (value.length >= 5) {
        value = `${value.slice(0, 2)} / ${value.slice(2, 4)} / ${value.slice(4)}`;
      } else if (value.length >= 3) {
        value = `${value.slice(0, 2)} / ${value.slice(2)}`;
      }
      e.target.value = value;
    });
  }

  // Toggle de visibilidad de password
  if (togglePasswordBtn && passwordInput) {
    togglePasswordBtn.addEventListener('click', () => {
      const isPassword = passwordInput.type === 'password';
      passwordInput.type = isPassword ? 'text' : 'password';

      if (eyeIconImg) {
        eyeIconImg.src = isPassword ? ICON_EYE_OFF_PATH : ICON_EYE_PATH;
        eyeIconImg.alt = isPassword ? 'Ocultar contraseña' : 'Ver contraseña';
      }

      togglePasswordBtn.setAttribute(
        'aria-label',
        isPassword ? 'Ocultar contraseña' : 'Mostrar contraseña'
      );
    });
  }

  [firstNameInput, lastNameInput, teamNameInput, birthdateInput, emailInput, passwordInput].forEach(input => {
    input?.addEventListener('input', () => {
      input.closest('.input-wrapper')?.classList.remove('has-error');
      input.closest('.form-group')?.classList.remove('has-error');
      if (!document.querySelector('#register-form .has-error')) {
        clearErrors();
      }
    });
  });

  if (form) {
    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      e.stopPropagation();
      clearErrors();

      const firstName = firstNameInput?.value.trim() || '';
      const lastName = lastNameInput?.value.trim() || '';
      const teamName = teamNameInput?.value.trim() || '';
      const birthdate = birthdateInput?.value.trim() || '';
      const email = emailInput?.value.trim() || '';
      const password = passwordInput?.value || '';

      const fields = [
        { val: firstName, el: firstNameInput },
        { val: lastName, el: lastNameInput },
        { val: teamName, el: teamNameInput },
        { val: birthdate, el: birthdateInput },
        { val: email, el: emailInput },
        { val: password, el: passwordInput },
      ];

      let hasEmpty = false;
      fields.forEach(({ val, el }) => {
        if (!val) {
          el?.closest('.input-wrapper')?.classList.add('has-error');
          el?.closest('.form-group')?.classList.add('has-error');
          hasEmpty = true;
        }
      });

      if (hasEmpty) {
        showError('Por favor completa todos los campos requeridos.');
        return;
      }

      if (password.length < 6) {
        showError('La contraseña debe tener al menos 6 caracteres.');
        passwordInput?.closest('.input-wrapper')?.classList.add('has-error');
        passwordInput?.closest('.form-group')?.classList.add('has-error');
        return;
      }

      setLoading(true);

      try {
        const formData = new FormData();
        formData.append('first_name', firstName);
        formData.append('last_name', lastName);
        formData.append('team_name', teamName);
        formData.append('birthdate', birthdate);
        formData.append('email', email);
        formData.append('password', password);

        if (pictureInput?.files?.[0]) {
          formData.append('profile_picture', pictureInput.files[0]);
        }

        let token = 'auth_token_' + Date.now();
        let dbUser = null;
        let response = null;

        try {
          response = await fetch(`${API_BASE_URL}/auth/register`, {
            method: 'POST',
            body: formData,
          });
        } catch (fetchErr) {
          // Si el backend FastAPI no está activo o hay error de red/fetch, fallback transparente a PWA Local
          console.warn('[Auth] Backend FastAPI offline o no disponible. Registrando usuario en modo PWA Local:', fetchErr.message);
          token = 'pwa_local_' + Date.now();
        }

        if (response) {
          if (response.ok) {
            const data = await response.json().catch(() => ({}));
            token = data.token || data.access_token || token;
            dbUser = data.user || null;
          } else {
            const errData = await response.json().catch(() => ({}));
            throw new Error(errData.detail || 'Error en el servidor al registrar usuario');
          }
        }

        // Persistencia de sesión y datos de usuario en localStorage (protegida contra QuotaExceededError en iOS Safari)
        try {
          localStorage.removeItem('fantasy_active_squad');
          localStorage.removeItem('fantasy_match_history');
          localStorage.removeItem('fantasy_player_stats');
          localStorage.removeItem('fantasy_user_stats');
          localStorage.setItem('auth_token', token);
          localStorage.setItem('access_token', token);
          localStorage.setItem('hasSeenOnboarding', 'true');
        } catch (_) {}

        const userData = {
          ...(dbUser || {}),
          id: dbUser?.id || null,
          team_name: dbUser?.team_name || teamName,
          name: dbUser?.name || `${firstName} ${lastName}`,
          first_name: dbUser?.first_name || firstName,
          last_name: dbUser?.last_name || lastName,
          email: dbUser?.email || email,
          birthdate: dbUser?.birthdate || birthdate
        };
        try {
          localStorage.setItem('user', JSON.stringify(userData));
        } catch (_) {}

        // Guardar avatar preview comprimido (sin bloquear jamás si el almacenamiento del móvil está lleno)
        try {
          const previewImg = avatarPreview?.querySelector('img');
          if (previewImg && previewImg.src && !previewImg.src.includes('user-avatar.svg')) {
            localStorage.setItem('user_avatar', previewImg.src);
          }
        } catch (quotaErr) {
          console.warn('[Auth] Omitiendo caché local de avatar por límite de cuota del navegador:', quotaErr.message);
        }

        // Redirección SPA inmediata a Ranking / Inicio
        if (router && typeof router.navigate === 'function') {
          router.navigate('/ranking');
        } else {
          window.history.pushState({}, '', '/ranking');
          window.dispatchEvent(new PopStateEvent('popstate'));
        }
      } catch (err) {
        showError(err.message || 'No se pudo completar el registro. Intenta nuevamente.');
      } finally {
        setLoading(false);
      }
    });
  }

  function showError(msg) {
    if (errorMessage) {
      errorMessage.textContent = msg;
      errorMessage.classList.remove('hidden');
    }
  }

  function clearErrors() {
    if (errorMessage) {
      errorMessage.textContent = '';
      errorMessage.classList.add('hidden');
    }
    document.querySelectorAll('.input-wrapper.has-error').forEach(wrapper => {
      wrapper.classList.remove('has-error');
    });
  }

  function setLoading(isLoading) {
    if (!submitBtn) return;
    submitBtn.disabled = isLoading;
    submitBtn.textContent = isLoading ? 'CREANDO CUENTA...' : 'CREAR CUENTA';
  }
}