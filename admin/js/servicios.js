/**
 * Entre Mascotas - Panel de Administración
 * Sección 6: Servicios Veterinarios y Estéticos
 */

(function () {
  'use strict';

  const { esc, formatCurrency, openModal, closeModal, showToast } = window.adminUtils;

  let serviciosLista = [];

  async function cargarServicios() {
    const tbody = document.getElementById('serviciosTableBody');
    if (!tbody) return;

    tbody.innerHTML = window.adminUtils.renderTableSkeleton(4, 5);

    try {
      const { data, error } = await window.sb
        .from('servicios')
        .select('*')
        .order('id', { ascending: true });

      if (error) throw error;

      serviciosLista = data || [];
      renderTablaServicios(serviciosLista, tbody);

    } catch (err) {
      console.error('[servicios] Error al cargar servicios:', err);
      showToast('Error al cargar servicios: ' + (err.message || 'Desconocido'), 'danger');
      tbody.innerHTML = '<tr><td colspan="5" style="text-align: center; color: var(--danger-text); padding: 2rem;">Error al cargar servicios.</td></tr>';
    }
  }

  function renderTablaServicios(lista, tbody) {
    if (!lista || lista.length === 0) {
      tbody.innerHTML = `
        <tr>
          <td colspan="5" class="empty-state">
            <div class="empty-state-icon">🩺</div>
            <div class="empty-state-title">No hay servicios registrados</div>
          </td>
        </tr>
      `;
      return;
    }

    const puedeEditar = window.adminContext?.puedeEditar || false;

    tbody.innerHTML = lista.map(s => {
      const activeBadge = s.activo
        ? '<span class="badge badge-success">✓ Activo</span>'
        : '<span class="badge badge-danger">✗ Inactivo</span>';

      return `
        <tr>
          <td style="font-size: 1.5rem; text-align: center; width: 50px;">
            ${esc(s.icono || '🩺')}
          </td>
          <td>
            <div style="font-weight: 700; color: var(--text-main); font-size: 0.95rem;">
              ${esc(s.nombre)}
            </div>
            <div style="font-size: 0.8rem; color: var(--text-muted); max-width: 380px;">
              ${esc(s.descripcion || '')}
            </div>
          </td>
          <td style="font-weight: 600; white-space: nowrap;">
            ⏱️ ${esc(s.duracion_min)} min
          </td>
          <td style="font-weight: 700; font-size: 0.95rem; white-space: nowrap;">
            ${formatCurrency(s.precio)}
          </td>
          <td>${activeBadge}</td>
          <td style="text-align: right;">
            <button type="button" class="btn btn-outline btn-sm btn-edit-servicio" data-servicio-id="${esc(s.id)}" ${!puedeEditar ? 'disabled' : ''}>
              ✏️ Editar
            </button>
          </td>
        </tr>
      `;
    }).join('');

    if (puedeEditar) {
      tbody.querySelectorAll('.btn-edit-servicio').forEach(btn => {
        btn.addEventListener('click', () => {
          const id = btn.getAttribute('data-servicio-id');
          const s = serviciosLista.find(item => String(item.id) === String(id));
          if (s) abrirModalServicio(s);
        });
      });
    }
  }

  function abrirModalServicio(s) {
    const modal = document.getElementById('modalServicio');
    const form = document.getElementById('formServicio');
    const title = document.getElementById('modalServicioTitle');
    if (!modal || !form || !s) return;

    form.reset();

    document.getElementById('servModalId').value = s.id;
    document.getElementById('servModalNombre').value = s.nombre || '';
    document.getElementById('servModalDescripcion').value = s.descripcion || '';
    document.getElementById('servModalIcono').value = s.icono || '🩺';
    document.getElementById('servModalDuracion').value = s.duracion_min || 30;
    document.getElementById('servModalPrecio').value = s.precio || '';
    document.getElementById('servModalActivo').checked = Boolean(s.activo);

    if (title) title.textContent = `Editar Servicio: ${s.nombre}`;

    openModal('modalServicio');
  }

  async function guardarServicio(e) {
    e.preventDefault();

    const puedeEditar = window.adminContext?.puedeEditar || false;
    if (!puedeEditar) {
      showToast('Acción denegada: Modo solo lectura.', 'danger');
      return;
    }

    const btnSubmit = document.getElementById('btnSubmitServicio');
    const idVal = document.getElementById('servModalId')?.value;
    const nombre = document.getElementById('servModalNombre')?.value.trim();
    const descripcion = document.getElementById('servModalDescripcion')?.value.trim();
    const icono = document.getElementById('servModalIcono')?.value.trim() || '🩺';
    const duracion = Number(document.getElementById('servModalDuracion')?.value);
    const precio = Number(document.getElementById('servModalPrecio')?.value);
    const activo = document.getElementById('servModalActivo')?.checked;

    if (!nombre) {
      showToast('El nombre del servicio es obligatorio.', 'warning');
      return;
    }
    if (isNaN(duracion) || duracion <= 0) {
      showToast('La duración debe ser mayor a 0 minutos.', 'warning');
      return;
    }
    if (isNaN(precio) || precio < 0) {
      showToast('El precio debe ser mayor o igual a 0.', 'warning');
      return;
    }

    if (btnSubmit) {
      btnSubmit.disabled = true;
      btnSubmit.textContent = 'Guardando...';
    }

    try {
      const payload = {
        nombre,
        descripcion: descripcion || null,
        icono,
        duracion_min: duracion,
        precio,
        activo: Boolean(activo)
      };

      const { error } = await window.sb
        .from('servicios')
        .update(payload)
        .eq('id', idVal);

      if (error) throw error;

      showToast(`Servicio "${nombre}" actualizado.`, 'success');
      closeModal('modalServicio');
      await cargarServicios();

    } catch (err) {
      console.error('[servicios] Error al guardar:', err);
      showToast('Error al actualizar servicio: ' + (err.message || 'Desconocido'), 'danger');
    } finally {
      if (btnSubmit) {
        btnSubmit.disabled = false;
        btnSubmit.textContent = 'Guardar Cambios';
      }
    }
  }

  function inicializarServicios() {
    document.getElementById('formServicio')?.addEventListener('submit', guardarServicio);

    document.getElementById('btnRefreshServicios')?.addEventListener('click', () => {
      cargarServicios();
      showToast('Servicios actualizados.', 'info');
    });
  }

  document.addEventListener('admin:ready', () => {
    inicializarServicios();
    cargarServicios();
  });

  window.adminServicios = {
    recargar: cargarServicios
  };
})();
