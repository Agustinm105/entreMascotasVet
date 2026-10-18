/**
 * admin/js/admin-app.js
 * Coordinador general del panel de administración:
 * Router de secciones, manejo de la barra lateral responsive y ciclo de vida de los módulos.
 */
(function() {
  const secciones = {
    resumen: {
      titulo: 'Resumen General',
      modulo: () => window.adminResumen,
      requiereAdmin: false
    },
    pedidos: {
      titulo: 'Gestión de Pedidos',
      modulo: () => window.adminPedidos,
      requiereAdmin: false
    },
    turnos: {
      titulo: 'Agenda de Turnos',
      modulo: () => window.adminTurnos,
      requiereAdmin: false
    },
    productos: {
      titulo: 'Catálogo de Productos',
      modulo: () => window.adminProductos,
      requiereAdmin: false
    },
    categorias: {
      titulo: 'Categorías de Productos',
      modulo: () => window.adminCategorias,
      requiereAdmin: false
    },
    servicios: {
      titulo: 'Servicios Veterinarios',
      modulo: () => window.adminServicios,
      requiereAdmin: false
    },
    clientes: {
      titulo: 'Base de Clientes',
      modulo: () => window.adminClientes,
      requiereAdmin: false
    },
    mascotas: {
      titulo: 'Fichas de Mascotas',
      modulo: () => window.adminMascotas,
      requiereAdmin: false
    },
    equipo: {
      titulo: 'Gestión del Equipo',
      modulo: () => window.adminEquipo,
      requiereAdmin: true
    }
  };

  let seccionActual = 'resumen';
  let modulosInicializados = {};

  function cambiarSeccion(nombre, params = {}) {
    if (!secciones[nombre]) {
      nombre = 'resumen';
    }

    const puedeEditar = window.adminAuthGuard.puedeEditar();
    if (secciones[nombre].requiereAdmin && !puedeEditar) {
      window.adminUtils.showToast('Solo el dueño puede acceder a la sección Equipo.', 'error');
      nombre = 'resumen';
    }

    seccionActual = nombre;

    // Actualizar título en topbar
    const headerTitle = document.getElementById('adminHeaderTitle');
    if (headerTitle) {
      headerTitle.textContent = secciones[nombre].titulo;
    }

    // Actualizar botones de navegación en sidebar
    document.querySelectorAll('.sidebar-nav-item').forEach(btn => {
      const target = btn.getAttribute('data-section');
      if (target === nombre) {
        btn.classList.add('active');
      } else {
        btn.classList.remove('active');
      }
    });

    // Ocultar todas las secciones y mostrar la activa
    document.querySelectorAll('.admin-section').forEach(sec => {
      sec.style.display = 'none';
    });

    const seccionEl = document.getElementById(`section-${nombre}`);
    if (seccionEl) {
      seccionEl.style.display = 'block';
    }

    // Cerrar sidebar móvil si está abierto
    cerrarSidebarMovil();

    // Actualizar hash en URL sin recargar
    if (window.location.hash !== `#${nombre}`) {
      history.replaceState(null, '', `#${nombre}`);
    }

    // Inicializar o recargar módulo
    const mod = secciones[nombre].modulo();
    if (mod) {
      if (!modulosInicializados[nombre]) {
        if (typeof mod.init === 'function') mod.init(params);
        modulosInicializados[nombre] = true;
      } else if (typeof mod.recargar === 'function') {
        mod.recargar(params);
      }
    }
  }

  function toggleSidebarMovil() {
    const sidebar = document.getElementById('adminSidebar');
    const backdrop = document.getElementById('sidebarBackdrop');
    if (!sidebar || !backdrop) return;

    const isOpen = sidebar.classList.contains('open');
    if (isOpen) {
      sidebar.classList.remove('open');
      backdrop.classList.remove('open');
    } else {
      sidebar.classList.add('open');
      backdrop.classList.add('open');
    }
  }

  function cerrarSidebarMovil() {
    const sidebar = document.getElementById('adminSidebar');
    const backdrop = document.getElementById('sidebarBackdrop');
    if (sidebar) sidebar.classList.remove('open');
    if (backdrop) backdrop.classList.remove('open');
  }

  function setupEventListeners() {
    // Clics en la barra de navegación
    document.querySelectorAll('.sidebar-nav-item').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.preventDefault();
        const sec = btn.getAttribute('data-section');
        if (sec) cambiarSeccion(sec);
      });
    });

    // Toggle móvil
    const btnMenu = document.getElementById('btnToggleMobileMenu');
    if (btnMenu) {
      btnMenu.addEventListener('click', toggleSidebarMovil);
    }

    const backdrop = document.getElementById('sidebarBackdrop');
    if (backdrop) {
      backdrop.addEventListener('click', cerrarSidebarMovil);
    }

    // Tecla Escape para cerrar drawer móvil
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') {
        cerrarSidebarMovil();
      }
    });

    // Hash navigation
    window.addEventListener('hashchange', () => {
      const hash = (window.location.hash || '').replace('#', '');
      if (hash && secciones[hash] && hash !== seccionActual) {
        cambiarSeccion(hash);
      }
    });
  }

  // Escuchar cuando el Auth Guard valide el rol
  document.addEventListener('admin:ready', (e) => {
    setupEventListeners();

    // Determinar sección inicial desde el hash o por defecto 'resumen'
    const hash = (window.location.hash || '').replace('#', '');
    const seccionInicial = (hash && secciones[hash]) ? hash : 'resumen';

    cambiarSeccion(seccionInicial);
  });

  window.adminApp = {
    cambiarSeccion,
    toggleSidebarMovil,
    cerrarSidebarMovil
  };
})();
