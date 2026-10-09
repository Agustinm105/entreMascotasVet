// ============================================================================
// Entre Mascotas · Módulo de Autenticación (Google OAuth & Perfiles)
// Gestiona el ciclo de vida de la sesión, carga de perfil, roles y UI de usuario
// ============================================================================

(function () {
  // Helper para escapar texto (prevención XSS - docs/CONTEXTO.md)
  function esc(str) {
    if (str === null || str === undefined) return '';
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  // Notificaciones Toast accesibles para el módulo de auth
  function mostrarToast(mensaje, tipo = 'info') {
    let container = document.getElementById('toastContainer');
    if (!container) {
      container = document.createElement('div');
      container.id = 'toastContainer';
      container.className = 'toast-container';
      document.body.appendChild(container);
    }

    const toast = document.createElement('div');
    toast.className = `toast toast-${tipo}`;

    let icon = 'ℹ️';
    if (tipo === 'success') icon = '✅';
    if (tipo === 'warning') icon = '⚠️';
    if (tipo === 'danger') icon = '❌';

    const iconSpan = document.createElement('span');
    iconSpan.className = 'toast-icon';
    iconSpan.textContent = icon;

    const textDiv = document.createElement('div');
    textDiv.className = 'toast-text';
    textDiv.textContent = mensaje;

    toast.appendChild(iconSpan);
    toast.appendChild(textDiv);
    container.appendChild(toast);

    setTimeout(() => toast.classList.add('show'), 10);
    setTimeout(() => {
      toast.classList.remove('show');
      setTimeout(() => toast.remove(), 350);
    }, 3800);
  }

  // Carga del perfil del usuario desde public.perfiles con reintentos
  // (el trigger on_auth_user_created en la base puede demorar unos milisegundos en el primer login)
  async function cargarPerfil(userId, maxReintentos = 3) {
    if (!window.sb || !userId) return null;

    for (let intento = 1; intento <= maxReintentos; intento++) {
      try {
        const { data, error } = await window.sb
          .from('perfiles')
          .select('*')
          .eq('id', userId)
          .maybeSingle();

        if (error) {
          console.warn(`[vetAuth] Intento ${intento}/${maxReintentos} al consultar perfil:`, error.message);
        } else if (data) {
          return data;
        }
      } catch (err) {
        console.warn(`[vetAuth] Excepción en intento ${intento}/${maxReintentos} al obtener perfil:`, err);
      }

      if (intento < maxReintentos) {
        await new Promise((resolve) => setTimeout(resolve, 500));
      }
    }

    console.warn('[vetAuth] Perfil no encontrado tras reintentos.');
    return null;
  }

  // Limpiar parámetros y fragmentos OAuth de la URL sin recargar
  function limpiarUrlOAuth() {
    if (
      window.location.hash.includes('access_token=') ||
      window.location.hash.includes('refresh_token=') ||
      window.location.search.includes('code=')
    ) {
      const cleanUrl = window.location.origin + window.location.pathname;
      window.history.replaceState(null, document.title, cleanUrl);
    }
  }

  // Iniciar sesión con Google OAuth
  async function loginConGoogle() {
    if (!window.sb) {
      console.error('[vetAuth] Supabase no está inicializado.');
      mostrarToast('No se puede conectar con el servicio de autenticación.', 'danger');
      return;
    }

    try {
      const redirectTo = window.location.origin + window.location.pathname;
      const { error } = await window.sb.auth.signInWithOAuth({
        provider: 'google',
        options: {
          redirectTo: redirectTo
        }
      });

      if (error) {
        console.error('[vetAuth] Error en signInWithOAuth:', error);
        mostrarToast('Error al iniciar sesión con Google.', 'danger');
      }
    } catch (err) {
      console.error('[vetAuth] Excepción durante login:', err);
      mostrarToast('Ocurrió un error inesperado al conectar con Google.', 'danger');
    }
  }

  // Cerrar sesión
  async function logout() {
    if (!window.sb) return;

    try {
      const { error } = await window.sb.auth.signOut();
      if (error) {
        console.error('[vetAuth] Error en signOut:', error);
        mostrarToast('Error al cerrar sesión.', 'danger');
      } else {
        mostrarToast('Sesión cerrada correctamente.', 'info');
      }
    } catch (err) {
      console.error('[vetAuth] Excepción al cerrar sesión:', err);
      mostrarToast('Error al cerrar sesión.', 'danger');
    }
  }

  // Estado global expuesto
  window.vetAuth = {
    session: null,
    perfil: null,
    esStaff: false,
    esAdmin: false,
    loginConGoogle,
    logout,
    obtenerPerfil: () => window.vetAuth.perfil,
    obtenerSesion: () => window.vetAuth.session
  };

  // Actualizar UI del Navbar según el estado de autenticación
  function actualizarUiHeader() {
    const btnLoginGoogle = document.getElementById('btnLoginGoogle');
    const userMenuDropdown = document.getElementById('userMenuDropdown');
    const userAvatarImg = document.getElementById('userAvatarImg');
    const userAvatarFallback = document.getElementById('userAvatarFallback');
    const userNameText = document.getElementById('userNameText');
    const userEmailText = document.getElementById('userEmailText');
    const userRoleBadge = document.getElementById('userRoleBadge');
    const menuItemAdmin = document.getElementById('menuItemAdmin');

    if (!btnLoginGoogle || !userMenuDropdown) return;

    const session = window.vetAuth.session;
    const perfil = window.vetAuth.perfil;

    if (session && session.user) {
      // Con sesión: Ocultar botón de login y mostrar menú de usuario
      btnLoginGoogle.style.display = 'none';
      userMenuDropdown.style.display = 'inline-block';

      // Determinar nombre a mostrar
      let nombre = '';
      if (perfil) {
        if (perfil.nombre) {
          nombre = perfil.nombre + (perfil.apellido ? ' ' + perfil.apellido : '');
        } else if (perfil.email) {
          nombre = perfil.email.split('@')[0];
        }
      }
      if (!nombre) {
        nombre = session.user.user_metadata?.full_name ||
                 session.user.user_metadata?.name ||
                 session.user.email?.split('@')[0] ||
                 'Mi Cuenta';
      }

      if (userNameText) userNameText.textContent = nombre;

      // Email
      const email = perfil?.email || session.user.email || '';
      if (userEmailText) userEmailText.textContent = email;

      // Avatar
      const avatarUrl = perfil?.avatar_url ||
                        session.user.user_metadata?.avatar_url ||
                        session.user.user_metadata?.picture;

      if (avatarUrl && userAvatarImg) {
        userAvatarImg.src = avatarUrl;
        userAvatarImg.style.display = 'block';
        if (userAvatarFallback) userAvatarFallback.style.display = 'none';
        userAvatarImg.onerror = function () {
          userAvatarImg.style.display = 'none';
          if (userAvatarFallback) userAvatarFallback.style.display = 'flex';
        };
      } else if (userAvatarImg && userAvatarFallback) {
        userAvatarImg.style.display = 'none';
        userAvatarFallback.style.display = 'flex';
        userAvatarFallback.textContent = nombre ? nombre.charAt(0).toUpperCase() : 'U';
      }

      // Rol y enlace de administración (solo staff: admin o empleado)
      const rol = perfil?.rol || 'cliente';
      if (userRoleBadge) {
        userRoleBadge.textContent = rol === 'admin' ? 'Administrador' : (rol === 'empleado' ? 'Empleado' : 'Cliente');
        userRoleBadge.className = `user-role-badge role-${rol}`;
      }

      if (menuItemAdmin) {
        menuItemAdmin.style.display = window.vetAuth.esStaff ? 'flex' : 'none';
      }
    } else {
      // Sin sesión: Mostrar botón "Ingresar con Google" y ocultar menú
      btnLoginGoogle.style.display = 'inline-flex';
      userMenuDropdown.style.display = 'none';
      userMenuDropdown.classList.remove('open');
    }
  }

  // Manejar el cambio de estado de sesión
  async function manejarCambioSesion(event, session) {
    window.vetAuth.session = session || null;

    if (session && session.user) {
      const perfil = await cargarPerfil(session.user.id);
      window.vetAuth.perfil = perfil;
      window.vetAuth.esStaff = Boolean(perfil && (perfil.rol === 'admin' || perfil.rol === 'empleado'));
      window.vetAuth.esAdmin = Boolean(perfil && perfil.rol === 'admin');

      limpiarUrlOAuth();

      // Paso 4: Mostrar en consola el perfil cargado
      console.log('[vetAuth] Perfil cargado:', perfil || { id: session.user.id, email: session.user.email, rol: 'cliente' });
    } else {
      window.vetAuth.perfil = null;
      window.vetAuth.esStaff = false;
      window.vetAuth.esAdmin = false;
    }

    // Disparar evento personalizado en document
    document.dispatchEvent(
      new CustomEvent('vet:authchange', {
        detail: {
          session: window.vetAuth.session,
          perfil: window.vetAuth.perfil,
          esStaff: window.vetAuth.esStaff,
          esAdmin: window.vetAuth.esAdmin,
          event
        }
      })
    );

    actualizarUiHeader();
  }

  // Inicializar listeners del DOM y auth
  function inicializar() {
    const btnLoginGoogle = document.getElementById('btnLoginGoogle');
    const userMenuBtn = document.getElementById('userMenuBtn');
    const userMenuDropdown = document.getElementById('userMenuDropdown');
    const btnLogout = document.getElementById('btnLogout');
    const menuItemAccount = document.getElementById('menuItemAccount');

    if (btnLoginGoogle) {
      btnLoginGoogle.addEventListener('click', (e) => {
        e.preventDefault();
        loginConGoogle();
      });
    }

    if (userMenuBtn && userMenuDropdown) {
      userMenuBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        const isOpen = userMenuDropdown.classList.toggle('open');
        userMenuBtn.setAttribute('aria-expanded', isOpen ? 'true' : 'false');
      });

      // Cerrar al hacer clic fuera
      document.addEventListener('click', (e) => {
        if (!userMenuDropdown.contains(e.target)) {
          userMenuDropdown.classList.remove('open');
          userMenuBtn.setAttribute('aria-expanded', 'false');
        }
      });

      // Cerrar con Escape
      document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape' && userMenuDropdown.classList.contains('open')) {
          userMenuDropdown.classList.remove('open');
          userMenuBtn.setAttribute('aria-expanded', 'false');
        }
      });
    }

    if (menuItemAccount) {
      menuItemAccount.addEventListener('click', () => {
        if (userMenuDropdown) {
          userMenuDropdown.classList.remove('open');
          if (userMenuBtn) userMenuBtn.setAttribute('aria-expanded', 'false');
        }
      });
    }

    if (btnLogout) {
      btnLogout.addEventListener('click', (e) => {
        e.preventDefault();
        if (userMenuDropdown) {
          userMenuDropdown.classList.remove('open');
          if (userMenuBtn) userMenuBtn.setAttribute('aria-expanded', 'false');
        }
        logout();
      });
    }

    // Suscribirse a onAuthStateChange si sb está disponible
    if (window.sb && window.sb.auth) {
      window.sb.auth.onAuthStateChange((event, session) => {
        manejarCambioSesion(event, session);
      });
    } else {
      console.warn('[vetAuth] Cliente Supabase no disponible para registrar onAuthStateChange.');
      actualizarUiHeader();
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', inicializar);
  } else {
    inicializar();
  }
})();
