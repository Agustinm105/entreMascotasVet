/**
 * Entre Mascotas - Panel de Administración
 * Sección 5: Categorías del Pet Shop
 */

(function () {
  'use strict';

  const { esc, openModal, closeModal, showToast } = window.adminUtils;

  let categoriasLista = [];

  async function cargarCategorias() {
    const tbody = document.getElementById('categoriasTableBody');
    if (!tbody) return;

    tbody.innerHTML = window.adminUtils.renderTableSkeleton(4, 4);

    try {
      // Leer categorías junto con la cantidad de productos asociados
      const { data, error } = await window.sb
        .from('categorias')
        .select(`
          id,
          nombre,
          descripcion,
          productos (
            id
          )
        `)
        .order('id', { ascending: true });

      if (error) throw error;

      categoriasLista = data || [];
      renderTablaCategorias(categoriasLista, tbody);

    } catch (err) {
      console.error('[categorias] Error al cargar categorías:', err);
      showToast('Error al cargar categorías: ' + (err.message || 'Desconocido'), 'danger');
      tbody.innerHTML = '<tr><td colspan="4" style="text-align: center; color: var(--danger-text); padding: 2rem;">Error al cargar categorías.</td></tr>';
    }
  }

  function renderTablaCategorias(lista, tbody) {
    if (!lista || lista.length === 0) {
      tbody.innerHTML = `
        <tr>
          <td colspan="4" class="empty-state">
            <div class="empty-state-icon">🏷️</div>
            <div class="empty-state-title">No hay categorías creadas</div>
            <p style="font-size: 0.85rem;">Creá la primera categoría para organizar los productos.</p>
          </td>
        </tr>
      `;
      return;
    }

    const puedeEditar = window.adminContext?.puedeEditar || false;

    tbody.innerHTML = lista.map(c => {
      const cantProductos = Array.isArray(c.productos) ? c.productos.length : 0;

      return `
        <tr>
          <td style="font-weight: 700; width: 60px;">#${esc(c.id)}</td>
          <td>
            <div style="font-weight: 700; color: var(--text-main); font-size: 0.95rem;">
              ${esc(c.nombre)}
            </div>
          </td>
          <td style="color: var(--text-muted); font-size: 0.85rem;">
            ${esc(c.descripcion || 'Sin descripción')}
          </td>
          <td>
            <span class="badge ${cantProductos > 0 ? 'badge-info' : 'badge-secondary'}">
              ${cantProductos} producto${cantProductos === 1 ? '' : 's'}
            </span>
          </td>
          <td style="text-align: right; white-space: nowrap;">
            <button type="button" class="btn btn-outline btn-sm btn-edit-cat" data-cat-id="${esc(c.id)}" ${!puedeEditar ? 'disabled' : ''}>
              ✏️ Editar
            </button>
            <button type="button" class="btn btn-outline btn-sm btn-delete-cat" data-cat-id="${esc(c.id)}" data-cat-name="${esc(c.nombre)}" data-product-count="${cantProductos}" style="color: var(--danger-text);" ${!puedeEditar ? 'disabled' : ''}>
              🗑️
            </button>
          </td>
        </tr>
      `;
    }).join('');

    if (puedeEditar) {
      tbody.querySelectorAll('.btn-edit-cat').forEach(btn => {
        btn.addEventListener('click', () => {
          const id = btn.getAttribute('data-cat-id');
          const cat = categoriasLista.find(c => String(c.id) === String(id));
          if (cat) abrirModalCategoria(cat);
        });
      });

      tbody.querySelectorAll('.btn-delete-cat').forEach(btn => {
        btn.addEventListener('click', async () => {
          const id = btn.getAttribute('data-cat-id');
          const nombre = btn.getAttribute('data-cat-name') || 'esta categoría';
          const prodCount = Number(btn.getAttribute('data-product-count')) || 0;

          if (prodCount > 0) {
            showToast('No se puede eliminar la categoría porque tiene productos asociados. Reasigna o desactiva sus productos primero.', 'warning');
            return;
          }

          const confirma = confirm(`¿Estás seguro de que querés eliminar la categoría "${nombre}"?`);
          if (!confirma) return;

          btn.disabled = true;
          try {
            const { error } = await window.sb
              .from('categorias')
              .delete()
              .eq('id', id);

            if (error) {
              if (error.code === '23503' || String(error.message).includes('foreign key')) {
                throw new Error('No se puede eliminar la categoría porque tiene productos asociados. Reasigna o desactiva sus productos primero.');
              }
              throw error;
            }

            showToast(`Categoría "${nombre}" eliminada.`, 'info');
            await cargarCategorias();
          } catch (err) {
            console.error('[categorias] Error al eliminar:', err);
            showToast(err.message || 'Error al eliminar categoría.', 'danger');
            btn.disabled = false;
          }
        });
      });
    }
  }

  function abrirModalCategoria(cat = null) {
    const modal = document.getElementById('modalCategoria');
    const form = document.getElementById('formCategoria');
    const title = document.getElementById('modalCategoriaTitle');
    if (!modal || !form) return;

    form.reset();

    const idInput = document.getElementById('catModalId');
    const nombreInput = document.getElementById('catModalNombre');
    const descInput = document.getElementById('catModalDescripcion');

    if (cat) {
      if (title) title.textContent = `Editar Categoría: ${cat.nombre}`;
      if (idInput) idInput.value = cat.id;
      if (nombreInput) nombreInput.value = cat.nombre || '';
      if (descInput) descInput.value = cat.descripcion || '';
    } else {
      if (title) title.textContent = 'Nueva Categoría';
      if (idInput) idInput.value = '';
    }

    openModal('modalCategoria');
  }

  async function guardarCategoria(e) {
    e.preventDefault();

    const puedeEditar = window.adminContext?.puedeEditar || false;
    if (!puedeEditar) {
      showToast('Acción denegada: Modo solo lectura.', 'danger');
      return;
    }

    const btnSubmit = document.getElementById('btnSubmitCategoria');
    const idVal = document.getElementById('catModalId')?.value;
    const nombre = document.getElementById('catModalNombre')?.value.trim();
    const descripcion = document.getElementById('catModalDescripcion')?.value.trim();

    if (!nombre) {
      showToast('El nombre de la categoría es obligatorio.', 'warning');
      return;
    }

    if (btnSubmit) {
      btnSubmit.disabled = true;
      btnSubmit.textContent = 'Guardando...';
    }

    try {
      const payload = {
        nombre,
        descripcion: descripcion || null
      };

      if (idVal) {
        const { error } = await window.sb
          .from('categorias')
          .update(payload)
          .eq('id', idVal);

        if (error) throw error;
        showToast(`Categoría "${nombre}" actualizada.`, 'success');
      } else {
        const { error } = await window.sb
          .from('categorias')
          .insert(payload);

        if (error) throw error;
        showToast(`Categoría "${nombre}" creada.`, 'success');
      }

      closeModal('modalCategoria');
      await cargarCategorias();

    } catch (err) {
      console.error('[categorias] Error al guardar:', err);
      showToast('Error al guardar categoría: ' + (err.message || 'Desconocido'), 'danger');
    } finally {
      if (btnSubmit) {
        btnSubmit.disabled = false;
        btnSubmit.textContent = 'Guardar Categoría';
      }
    }
  }

  function inicializarCategorias() {
    document.getElementById('btnNuevaCategoria')?.addEventListener('click', () => {
      abrirModalCategoria(null);
    });

    document.getElementById('formCategoria')?.addEventListener('submit', guardarCategoria);

    document.getElementById('btnRefreshCategorias')?.addEventListener('click', () => {
      cargarCategorias();
      showToast('Categorías actualizadas.', 'info');
    });
  }

  document.addEventListener('admin:ready', () => {
    inicializarCategorias();
    cargarCategorias();
  });

  window.adminCategorias = {
    recargar: cargarCategorias
  };
})();
