/**
 * Entre Mascotas - Panel de Administración
 * Control de Acceso y Roles (Auth Guard)
 * Valida sesión y rol ('admin' o 'empleado') antes de renderizar el panel.
 */

(function () {
  'use strict';

  window.adminContext = {
    session: null,
    perfil: null,
    rol: null,
    puedeEditar: false,
    userFullName: ''
  };

  const { esc, showToast } = window.adminUtils;

  // Consulta el perfil de la persona en public.perfiles
  async function obtenerPerfilUsuario(userId) {
    if (!window.sb || !userId) return null;
    try {
      const { data, error } = await window.sb
        .from('perfiles')
        .select('*')
        .eq('id', userId)
        .maybeSingle();

      if (error) {
        console.error('[auth-guard] Error al consultar perfil:', error);
        return null;
      }
      return data;
    } catch (err) {
      console.error('[auth-guard] Excepción al consultar perfil:', err);
      return null;
    }
  }

  // Verifica sesión y rol
  async function verificarAcceso() {
    const screenLoading = document.getElementById('screenLoading');
    const screenLogin = document.getElementById('screenLogin');
    const screenDenied = document.getElementById('screenDenied');
    const adminLayout = document.getElementById('adminAppLayout');

    // Estado inicial: pantalla de carga
    if (screenLoading) screenLoading.style.display = 'flex';
    if (screenLogin) screenLogin.style.display = 'none';
    if (screenDenied) screenDenied.style.display = 'none';
    if (adminLayout) adminLayout.style.display = 'none';

    if (!window.sb) {
      console.error('[auth-guard] Cliente de Supabase no disponible.');
      if (screenLoading) screenLoading.style.display = 'none';
      if (screenLogin) screenLogin.style.display = 'flex';
      return;
    }

    try {
      const { data: { session }, error } = await window.sb.auth.getSession();

      if (error || !session || !session.user) {
        // Sin sesión -> pantalla de login
        if (screenLoading) screenLoading.style.display = 'none';
        if (screenLogin) screenLogin.style.display = 'flex';
        return;
      }

      // Con sesión: buscar su perfil
      const perfil = await obtenerPerfilUsuario(session.user.id);
      const rol = perfil?.rol || 'cliente';

      // Validación estricta de rol
      if (rol !== 'admin' && rol !== 'empleado') {
        // Usuario autenticado pero no es staff -> pantalla denegada
        const deniedEmail = document.getElementById('deniedUserEmail');
        if (deniedEmail) deniedEmail.textContent = perfil?.email || session.user.email || '';

        if (screenLoading) screenLoading.style.display = 'none';
        if (screenDenied) screenDenied.style.display = 'flex';
        return;
      }

      // Acceso concedido
      const puedeEditar = (rol === 'admin');
      let fullName = [perfil?.nombre, perfil?.apellido].filter(Boolean).join(' ');
      if (!fullName) {
        fullName = session.user.user_metadata?.full_name || session.user.email?.split('@')[0] || 'Usuario';
      }

      window.adminContext = {
        session,
        perfil,
        rol,
        puedeEditar,
        userFullName: fullName
      };

      // Configurar UI superior
      const topbarUserName = document.getElementById('topbarUserName');
      const topbarUserRole = document.getElementById('topbarUserRole');
      const readOnlyBanner = document.getElementById('readOnlyBanner');
      const navItemEquipo = document.getElementById('navItemEquipo');

      if (topbarUserName) topbarUserName.textContent = fullName;
      if (topbarUserRole) {
        topbarUserRole.textContent = puedeEditar ? 'Dueño' : 'Empleado';
        topbarUserRole.className = `user-role-chip ${puedeEditar ? 'user-role-admin' : 'user-role-empleado'}`;
      }

      // Si es empleado: modo solo lectura
      if (!puedeEditar) {
        document.body.classList.add('is-employee-readonly');
        if (readOnlyBanner) readOnlyBanner.style.display = 'flex';
        // Ocultar sección de Equipo (solo para dueño)
        if (navItemEquipo) navItemEquipo.style.display = 'none';
      } else {
        document.body.classList.remove('is-employee-readonly');
        if (readOnlyBanner) readOnlyBanner.style.display = 'none';
        if (navItemEquipo) navItemEquipo.style.display = 'flex';
      }

      // Mostrar panel
      if (screenLoading) screenLoading.style.display = 'none';
      if (screenLogin) screenLogin.style.display = 'none';
      if (screenDenied) screenDenied.style.display = 'none';
      if (adminLayout) adminLayout.style.display = 'flex';

      // Disparar evento para inicializar módulos del panel
      document.dispatchEvent(new CustomEvent('admin:ready', { detail: window.adminContext }));

    } catch (err) {
      console.error('[auth-guard] Error durante verificación:', err);
      if (screenLoading) screenLoading.style.display = 'none';
      if (screenLogin) screenLogin.style.display = 'flex';
    }
  }

  // Inicializar listeners de autenticación
  function inicializarAuthListeners() {
    // Botón de login con Google
    const btnLogin = document.getElementById('btnAdminLoginGoogle');
    if (btnLogin) {
      btnLogin.addEventListener('click', async () => {
        try {
          const redirectTo = window.location.origin + window.location.pathname;
          await window.sb.auth.signInWithOAuth({
            provider: 'google',
            options: { redirectTo }
          });
        } catch (err) {
          console.error('[auth-guard] Error en login:', err);
          showToast('Error al conectar con Google.', 'danger');
        }
      });
    }

    // Botón de logout
    const btnLogout = document.getElementById('btnAdminLogout');
    if (btnLogout) {
      btnLogout.addEventListener('click', async () => {
        try {
          await window.sb.auth.signOut();
          window.location.reload();
        } catch (err) {
          console.error('[auth-guard] Error al cerrar sesión:', err);
        }
      });
    }

    const btnDeniedLogout = document.getElementById('btnDeniedLogout');
    if (btnDeniedLogout) {
      btnDeniedLogout.addEventListener('click', async () => {
        try {
          await window.sb.auth.signOut();
          window.location.reload();
        } catch (err) {
          console.error('[auth-guard] Error al cerrar sesión:', err);
        }
      });
    }

    // Sincronización con eventos de Supabase Auth
    if (window.sb) {
      window.sb.auth.onAuthStateChange((event, session) => {
        if (event === 'SIGNED_OUT') {
          window.location.reload();
        }
      });
    }
  }

  document.addEventListener('DOMContentLoaded', () => {
    inicializarAuthListeners();
    verificarAcceso();
  });
})();
