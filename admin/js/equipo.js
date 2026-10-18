/**
 * admin/js/equipo.js
 * Gestión de roles del equipo (solo visible y editable por el Dueño / Admin).
 */
(function() {
  const { esc, formatDateOnly, showToast } = window.adminUtils;

  let perfilesCache = [];
  let filtroBusqueda = '';
  let guardandoId = null;

  async function cargarEquipo() {
    const contenedor = document.getElementById('equipoTableBody');
    if (!contenedor) return;

    contenedor.innerHTML = `
      <tr>
        <td colspan="5" class="empty-state">
          <div class="skeleton-line" style="width: 80%; margin: 8px auto;"></div>
          <div class="skeleton-line" style="width: 60%; margin: 8px auto;"></div>
        </td>
      </tr>
    `;

    try {
      const { data, error } = await window.sb
        .from('perfiles')
        .select('id, nombre, apellido, email, telefono, rol, creado_en')
        .order('creado_en', { ascending: false });

      if (error) throw error;

      perfilesCache = data || [];
      renderizarTabla();
    } catch (err) {
      console.error('Error al cargar equipo:', err);
      contenedor.innerHTML = `
        <tr>
          <td colspan="5" class="empty-state text-error">
            Error al cargar los integrantes: ${esc(err.message || 'Error desconocido')}.
            <br><button class="btn btn-sm btn-outline mt-2" onclick="window.adminEquipo.recargar()">Reintentar</button>
          </td>
        </tr>
      `;
      showToast('Error al cargar equipo: ' + (err.message || 'Error'), 'error');
    }
  }

  function renderizarTabla() {
    const contenedor = document.getElementById('equipoTableBody');
    if (!contenedor) return;

    const term = filtroBusqueda.trim().toLowerCase();
    const filtrados = perfilesCache.filter(p => {
      if (!term) return true;
      const nom = `${p.nombre || ''} ${p.apellido || ''}`.toLowerCase();
      const em = (p.email || '').toLowerCase();
      return nom.includes(term) || em.includes(term);
    });

    if (filtrados.length === 0) {
      contenedor.innerHTML = `
        <tr>
          <td colspan="5" class="empty-state">
            ${term ? 'No se encontraron personas con ese correo o nombre.' : 'No hay perfiles registrados en el sistema.'}
          </td>
        </tr>
      `;
      return;
    }

    const currentUserId = window.adminAuthGuard.getCurrentUserId();

    contenedor.innerHTML = filtrados.map(p => {
      const esMiUsuario = p.id === currentUserId;
      const nombreCompleto = `${p.nombre || ''} ${p.apellido || ''}`.trim() || 'Sin nombre';
      const fecha = p.creado_en ? formatDateOnly(p.creado_en) : '—';
      const isSaving = guardandoId === p.id;

      let selectHtml = '';
      if (esMiUsuario) {
        selectHtml = `
          <div class="d-flex align-center gap-2">
            <span class="badge badge-primary font-bold">Dueño (Tu cuenta)</span>
          </div>
        `;
      } else {
        selectHtml = `
          <select 
            class="form-select form-select-sm" 
            style="width: 140px; display: inline-block;"
            data-profile-id="${esc(p.id)}"
            ${isSaving ? 'disabled' : ''}
            onchange="window.adminEquipo.onCambiarRol('${esc(p.id)}', this.value, '${esc(p.rol)}')"
          >
            <option value="cliente" ${p.rol === 'cliente' ? 'selected' : ''}>Cliente</option>
            <option value="empleado" ${p.rol === 'empleado' ? 'selected' : ''}>Empleado</option>
            <option value="admin" ${p.rol === 'admin' ? 'selected' : ''}>Dueño (Admin)</option>
          </select>
        `;
      }

      return `
        <tr>
          <td>
            <div class="font-bold">${esc(nombreCompleto)}</div>
            <div class="text-muted text-xs font-mono">${esc(p.id.substring(0, 8))}...</div>
          </td>
          <td>
            <a href="mailto:${esc(p.email || '')}" class="text-primary">${esc(p.email || 'Sin email')}</a>
          </td>
          <td>
            ${p.telefono ? esc(p.telefono) : '<span class="text-muted">—</span>'}
          </td>
          <td>
            ${selectHtml}
          </td>
          <td class="text-muted text-sm">
            ${esc(fecha)}
          </td>
        </tr>
      `;
    }).join('');
  }

  async function onCambiarRol(perfilId, nuevoRol, rolAnterior) {
    const currentUserId = window.adminAuthGuard.getCurrentUserId();
    if (perfilId === currentUserId) {
      showToast('No podés cambiar tu propio rol por seguridad.', 'error');
      renderizarTabla();
      return;
    }

    const rolLabels = {
      cliente: 'Cliente',
      empleado: 'Empleado',
      admin: 'Dueño (Admin)'
    };

    const confirmar = confirm(`¿Estás seguro de cambiar el rol de esta persona a "${rolLabels[nuevoRol] || nuevoRol}"?`);
    if (!confirmar) {
      renderizarTabla();
      return;
    }

    guardandoId = perfilId;
    renderizarTabla();

    try {
      const { error } = await window.sb
        .from('perfiles')
        .update({ rol: nuevoRol })
        .eq('id', perfilId);

      if (error) throw error;

      showToast(`Rol actualizado a ${rolLabels[nuevoRol] || nuevoRol} con éxito`, 'success');
      
      // Actualizar en caché
      const item = perfilesCache.find(p => p.id === perfilId);
      if (item) item.rol = nuevoRol;
    } catch (err) {
      console.error('Error al actualizar rol:', err);
      showToast('No se pudo cambiar el rol: ' + (err.message || 'Error en la base'), 'error');
    } finally {
      guardandoId = null;
      renderizarTabla();
    }
  }

  function init() {
    const inputBusqueda = document.getElementById('equipoSearchInput');
    if (inputBusqueda) {
      inputBusqueda.addEventListener('input', (e) => {
        filtroBusqueda = e.target.value;
        renderizarTabla();
      });
    }

    cargarEquipo();
  }

  window.adminEquipo = {
    init,
    recargar: cargarEquipo,
    onCambiarRol
  };
})();
