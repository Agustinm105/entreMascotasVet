/**
 * Entre Mascotas - Panel de Administración
 * Utilidades compartidas: escapado seguro, formateo de fechas y moneda, toasts y modales
 */

(function () {
  'use strict';

  // Helper para escapar HTML seguro (docs/CONTEXTO.md - Regla 3)
  function esc(str) {
    if (str === null || str === undefined) return '';
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  // Formateador de moneda en pesos argentinos (ARS)
  function formatCurrency(val) {
    return new Intl.NumberFormat('es-AR', {
      style: 'currency',
      currency: 'ARS',
      maximumFractionDigits: 0
    }).format(Number(val) || 0);
  }

  // Formateador de fecha y hora en horario de Argentina (America/Argentina/Buenos_Aires)
  function formatDateTime(isoString) {
    if (!isoString) return '-';
    try {
      const d = new Date(isoString);
      return d.toLocaleDateString('es-AR', {
        timeZone: 'America/Argentina/Buenos_Aires',
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
      });
    } catch {
      return String(isoString);
    }
  }

  function formatDateOnly(isoString) {
    if (!isoString) return '-';
    try {
      const d = new Date(isoString);
      return d.toLocaleDateString('es-AR', {
        timeZone: 'America/Argentina/Buenos_Aires',
        day: '2-digit',
        month: '2-digit',
        year: 'numeric'
      });
    } catch {
      return String(isoString);
    }
  }

  function formatTimeOnly(isoString) {
    if (!isoString) return '-';
    try {
      const d = new Date(isoString);
      return d.toLocaleTimeString('es-AR', {
        timeZone: 'America/Argentina/Buenos_Aires',
        hour: '2-digit',
        minute: '2-digit',
        hour12: false
      });
    } catch {
      return String(isoString);
    }
  }

  // Obtiene la fecha actual en formato YYYY-MM-DD según horario de Argentina
  function getTodayArgentinaDateStr() {
    const formatter = new Intl.DateTimeFormat('en-CA', {
      timeZone: 'America/Argentina/Buenos_Aires',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit'
    });
    return formatter.format(new Date());
  }

  // Obtiene el inicio del día (00:00:00) de hoy en Argentina como ISO
  function getStartOfDayArgentinaIso() {
    const todayStr = getTodayArgentinaDateStr();
    return `${todayStr}T00:00:00-03:00`;
  }

  // Notificaciones Toast
  function showToast(message, type = 'info') {
    let container = document.getElementById('adminToastContainer');
    if (!container) {
      container = document.createElement('div');
      container.id = 'adminToastContainer';
      container.className = 'toast-container';
      document.body.appendChild(container);
    }

    const toast = document.createElement('div');
    toast.className = `toast toast-${type}`;

    let icon = 'ℹ️';
    if (type === 'success') icon = '✅';
    if (type === 'warning') icon = '⚠️';
    if (type === 'danger') icon = '❌';

    toast.innerHTML = `
      <span style="font-size: 1.1rem;">${icon}</span>
      <div style="flex: 1;">${esc(message)}</div>
    `;

    container.appendChild(toast);
    setTimeout(() => toast.classList.add('show'), 10);
    setTimeout(() => {
      toast.classList.remove('show');
      setTimeout(() => toast.remove(), 250);
    }, 4000);
  }

  // Helpers de modales con accesibilidad y tecla Escape
  function openModal(modalId) {
    const modal = document.getElementById(modalId);
    if (!modal) return;
    modal.classList.add('active');
    document.body.style.overflow = 'hidden';

    // Foco en el primer input o botón
    const focusable = modal.querySelector('button, input, select, textarea');
    if (focusable) focusable.focus();
  }

  function closeModal(modalId) {
    const modal = document.getElementById(modalId);
    if (!modal) return;
    modal.classList.remove('active');
    document.body.style.overflow = '';
  }

  // Helpers de paneles laterales (Drawer)
  function openDrawer(drawerId, overlayId = 'drawerOverlay') {
    const drawer = document.getElementById(drawerId);
    const overlay = document.getElementById(overlayId);
    if (drawer) drawer.classList.add('active');
    if (overlay) overlay.classList.add('active');
    document.body.style.overflow = 'hidden';
  }

  function closeDrawer(drawerId, overlayId = 'drawerOverlay') {
    const drawer = document.getElementById(drawerId);
    const overlay = document.getElementById(overlayId);
    if (drawer) drawer.classList.remove('active');
    if (overlay) overlay.classList.remove('active');
    document.body.style.overflow = '';
  }

  // Cierre global con Escape
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      document.querySelectorAll('.modal-overlay.active').forEach(m => closeModal(m.id));
      document.querySelectorAll('.drawer-panel.active').forEach(d => closeDrawer(d.id));
      const sidebar = document.getElementById('adminSidebar');
      if (sidebar && sidebar.classList.contains('open')) {
        sidebar.classList.remove('open');
      }
    }
  });

  // Cierre de modales al hacer clic en el backdrop
  document.addEventListener('click', (e) => {
    if (e.target.classList.contains('modal-overlay')) {
      closeModal(e.target.id);
    }
    if (e.target.classList.contains('drawer-overlay')) {
      document.querySelectorAll('.drawer-panel.active').forEach(d => closeDrawer(d.id));
    }
  });

  // Skeletons de carga
  function renderTableSkeleton(rows = 5, cols = 4) {
    let html = '';
    for (let r = 0; r < rows; r++) {
      html += '<tr>';
      for (let c = 0; c < cols; c++) {
        html += `<td><div class="skeleton-row" style="width: ${70 + (c * 7) % 25}%;"></div></td>`;
      }
      html += '</tr>';
    }
    return html;
  }

  // Exponer utilidades globales en window.adminUtils
  window.adminUtils = {
    esc,
    formatCurrency,
    formatDateTime,
    formatDateOnly,
    formatTimeOnly,
    getTodayArgentinaDateStr,
    getStartOfDayArgentinaIso,
    showToast,
    openModal,
    closeModal,
    openDrawer,
    closeDrawer,
    renderTableSkeleton
  };
})();
