/*
 Controlador de Autenticación (Login & Registro)
 Manejo de credenciales, alternancia de visibilidad de contraseña,
 carga de foto de perfil y persistencia de sesión.
 */

import { navigateTo } from "../../app/router.js";

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
  const errorMessage = document.getElementById('error-message');
  const togglePasswordBtn = document.getElementById('toggle-password-btn');
  const eyeIconImg = document.getElementById('eye-icon-img');
  const submitBtn = document.getElementById('submit-btn');

  const googleBtn = document.getElementById('google-login-btn');
  const appleBtn = document.getElementById('apple-login-btn');

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

  emailInput?.addEventListener('input', clearErrorState);
  passwordInput?.addEventListener('input', clearErrorState);

  // Redirección OAuth de Google con tus credenciales

  googleBtn?.addEventListener('click', () => {
    const CLIENT_ID = '367906456287-h602ut2oho5r8c0q9cpa0epevsil3juo.apps.googleusercontent.com';
    const REDIRECT_URI = encodeURIComponent('http://127.0.0.1:8000/api/auth/google/callback');
    const SCOPE = encodeURIComponent('openid email profile');

    const authUrl = `https://accounts.google.com/o/oauth2/v2/auth?client_id=${CLIENT_ID}&redirect_uri=${REDIRECT_URI}&response_type=code&scope=${SCOPE}&access_type=offline&prompt=consent`;

    window.location.href = authUrl;
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

      if (!email || !password) {
        showError('Correo o contraseña incorrectos. Por favor, inténtalo de nuevo.');
        return;
      }

      setLoadingState(true);

      try {
        const response = await fetch('http://127.0.0.1:8000/api/auth/login', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ email, password }),
        });

        const data = await response.json();

        if (!response.ok) {
          throw new Error(data.detail || 'Credenciales inválidas');
        }

        if (data.token || data.access_token) {
          localStorage.setItem('auth_token', data.token || data.access_token);
        }
        localStorage.setItem('hasSeenOnboarding', 'true');
        if (data.user) {
          localStorage.setItem('user', JSON.stringify(data.user));
        }

        if (router && typeof router.navigate === 'function') {
          router.navigate('/dashboard');
        } else {
          window.location.pathname = '/dashboard';
        }
      } catch (error) {
        showError('Correo o contraseña incorrectos. Por favor, inténtalo de nuevo.');
      } finally {
        setLoadingState(false);
      }
    });
  }

  function showError(msg) {
    if (errorMessage) {
      errorMessage.textContent = msg;
      errorMessage.classList.remove('hidden');
    }
    emailWrapper?.classList.add('has-error');
    passwordWrapper?.classList.add('has-error');
  }

  function clearErrorState() {
    if (errorMessage) {
      errorMessage.textContent = '';
      errorMessage.classList.add('hidden');
    }
    emailWrapper?.classList.remove('has-error');
    passwordWrapper?.classList.remove('has-error');
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
    pictureInput.addEventListener('change', () => {
      const file = pictureInput.files?.[0];
      if (file) {
        const reader = new FileReader();
        reader.onload = (e) => {
          avatarPreview.innerHTML = `
            <img 
              src="${e.target.result}" 
              alt="Foto de perfil" 
              style="width: 100%; height: 100%; object-fit: cover; border-radius: 50%;" 
            />
          `;
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
    input?.addEventListener('input', clearErrors);
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

      if (!firstName || !lastName || !teamName || !birthdate || !email || !password) {
        showError('Por favor completa todos los campos requeridos.');
        return;
      }

      if (password.length < 6) {
        showError('La contraseña debe tener al menos 6 caracteres.');
        document.getElementById('reg-password-wrapper')?.classList.add('has-error');
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

        const response = await fetch('http://127.0.0.1:8000/api/auth/register', {
          method: 'POST',
          body: formData,
        });

        const data = await response.json();

        if (!response.ok) {
          throw new Error(data.detail || 'Ocurrió un error al crear la cuenta');
        }

        if (data.token || data.access_token) {
          localStorage.setItem('auth_token', data.token || data.access_token);
        }

        localStorage.setItem('hasSeenOnboarding', 'true');
        localStorage.setItem('user', JSON.stringify({ team_name: teamName, name: `${firstName} ${lastName}` }));

        // Redirección SPA sin recargas de página
        if (router && typeof router.navigate === 'function') {
          router.navigate('/ranking');
        } else {
          // Fallback directo a window.history asegurando disparar handleLocation
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