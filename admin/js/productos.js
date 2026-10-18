/**
 * Entre Mascotas - Panel de Administración
 * Sección 4: Catálogo de Productos y Control de Stock
 */

(function () {
  'use strict';

  const { esc, formatCurrency, openModal, closeModal, showToast } = window.adminUtils;

  let productosLista = [];
  let categoriasLista = [];
  let filtroBusqueda = '';
  let filtroCategoria = 'todas';
  let filtroEstadoStock = 'todos'; // 'todos' | 'bajo' | 'agotado' | 'inactivos'

  async function cargarCategoriasSelect() {
    try {
      const { data, error } = await window.sb
        .from('categorias')
        .select('id, nombre')
        .order('nombre', { ascending: true });

      if (error) throw error;
      categoriasLista = data || [];

      // Llenar select de filtros
      const filterSelect = document.getElementById('productosFiltroCategoria');
      if (filterSelect) {
        filterSelect.innerHTML = `
          <option value="todas">Todas las categorías</option>
          ${categoriasLista.map(c => `<option value="${esc(c.id)}">${esc(c.nombre)}</option>`).join('')}
        `;
      }

      // Llenar select del modal de producto
      const modalSelect = document.getElementById('prodModalCategoria');
      if (modalSelect) {
        modalSelect.innerHTML = `
          <option value="">Seleccionar categoría...</option>
          ${categoriasLista.map(c => `<option value="${esc(c.id)}">${esc(c.nombre)}</option>`).join('')}
        `;
      }
    } catch (err) {
      console.error('[productos] Error al cargar categorías:', err);
    }
  }

  async function cargarProductos() {
    const tbody = document.getElementById('productosTableBody');
    if (!tbody) return;

    tbody.innerHTML = window.adminUtils.renderTableSkeleton(6, 6);

    try {
      const { data, error } = await window.sb
        .from('productos')
        .select('id, categoria_id, nombre, descripcion, precio, stock, imagen_url, activo, creado_en, categorias(id, nombre)')
        .order('id', { ascending: true });

      if (error) throw error;

      productosLista = data || [];
      filtrarYRenderizarProductos();

    } catch (err) {
      console.error('[productos] Error al cargar productos:', err);
      showToast('Error al cargar productos: ' + (err.message || 'Desconocido'), 'danger');
      tbody.innerHTML = '<tr><td colspan="6" style="text-align: center; color: var(--danger-text); padding: 2rem;">Error al cargar los productos.</td></tr>';
    }
  }

  function filtrarYRenderizarProductos() {
    const tbody = document.getElementById('productosTableBody');
    const countEl = document.getElementById('productosCountText');
    if (!tbody) return;

    let lista = productosLista;

    // Filtro categoría
    if (filtroCategoria !== 'todas') {
      lista = lista.filter(p => String(p.categoria_id) === String(filtroCategoria));
    }

    // Filtro stock
    if (filtroEstadoStock === 'bajo') {
      lista = lista.filter(p => p.stock > 0 && p.stock <= 5);
    } else if (filtroEstadoStock === 'agotado') {
      lista = lista.filter(p => p.stock === 0);
    } else if (filtroEstadoStock === 'inactivos') {
      lista = lista.filter(p => !p.activo);
    }

    // Filtro texto
    if (filtroBusqueda.trim()) {
      const q = filtroBusqueda.toLowerCase().trim();
      lista = lista.filter(p => {
        return (p.nombre || '').toLowerCase().includes(q) ||
               (p.descripcion || '').toLowerCase().includes(q) ||
               (p.categorias?.nombre || '').toLowerCase().includes(q);
      });
    }

    if (countEl) {
      countEl.textContent = `Mostrando ${lista.length} de ${productosLista.length} productos`;
    }

    if (lista.length === 0) {
      tbody.innerHTML = `
        <tr>
          <td colspan="6" class="empty-state">
            <div class="empty-state-icon">🛒</div>
            <div class="empty-state-title">No hay productos que coincidan con la búsqueda</div>
            <p style="font-size: 0.85rem;">Probá limpiando los filtros o agregá un nuevo producto.</p>
          </td>
        </tr>
      `;
      return;
    }

    const puedeEditar = window.adminContext?.puedeEditar || false;

    tbody.innerHTML = lista.map(p => {
      const isLowStock = p.stock <= 5;
      const isOutOfStock = p.stock === 0;

      let stockDisplay = '';
      if (puedeEditar) {
        stockDisplay = `
          <div style="display: flex; align-items: center; gap: 0.35rem;">
            <input type="number" class="form-control input-inline-stock" data-product-id="${esc(p.id)}" value="${esc(p.stock)}" min="0" style="width: 70px; padding: 0.25rem 0.45rem; font-weight: 700; ${isLowStock ? 'border-color: #f59e0b; background-color: #fffbeb;' : ''}">
            <button type="button" class="btn btn-outline btn-sm btn-save-inline-stock" data-product-id="${esc(p.id)}" title="Guardar stock" style="padding: 0.25rem 0.45rem;">
              💾
            </button>
          </div>
          ${isOutOfStock ? '<span class="badge badge-danger" style="margin-top: 0.25rem;">Agotado</span>' : (isLowStock ? `<span class="badge badge-warning" style="margin-top: 0.25rem;">Bajo (${p.stock})</span>` : '')}
        `;
      } else {
        stockDisplay = `
          <span style="font-weight: 700;">${p.stock}</span>
          ${isOutOfStock ? '<span class="badge badge-danger">Agotado</span>' : (isLowStock ? `<span class="badge badge-warning">Bajo (${p.stock})</span>` : '')}
        `;
      }

      let activeToggle = '';
      if (puedeEditar) {
        activeToggle = `
          <label class="switch" title="${p.activo ? 'Desactivar producto' : 'Activar producto'}">
            <input type="checkbox" class="checkbox-toggle-active" data-product-id="${esc(p.id)}" ${p.activo ? 'checked' : ''}>
            <span class="slider"></span>
          </label>
        `;
      } else {
        activeToggle = p.activo
          ? '<span class="badge badge-success">Activo</span>'
          : '<span class="badge badge-danger">Inactivo</span>';
      }

      return `
        <tr data-product-id="${esc(p.id)}">
          <td style="width: 50px;">
            <img src="${esc(p.imagen_url || '../assets/images/consultation.jpg')}" alt="${esc(p.nombre)}" style="width: 44px; height: 44px; object-fit: cover; border-radius: var(--radius-sm); border: 1px solid var(--border-light);" loading="lazy">
          </td>
          <td>
            <div style="font-weight: 700; color: var(--text-main); font-size: 0.9rem;">
              ${esc(p.nombre)}
            </div>
            <div style="font-size: 0.78rem; color: var(--text-muted); max-width: 280px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">
              ${esc(p.descripcion || '')}
            </div>
          </td>
          <td>
            <span class="badge badge-secondary">${esc(p.categorias?.nombre || 'General')}</span>
          </td>
          <td style="font-weight: 700; font-size: 0.95rem; white-space: nowrap;">
            ${formatCurrency(p.precio)}
          </td>
          <td>${stockDisplay}</td>
          <td>${activeToggle}</td>
          <td>
            <div style="display: flex; gap: 0.35rem;">
              <button type="button" class="btn btn-outline btn-sm btn-edit-product" data-product-id="${esc(p.id)}" ${!puedeEditar ? 'disabled' : ''}>
                ✏️ Editar
              </button>
            </div>
          </td>
        </tr>
      `;
    }).join('');

    // Eventos de edición rápida de stock
    if (puedeEditar) {
      tbody.querySelectorAll('.btn-save-inline-stock').forEach(btn => {
        btn.addEventListener('click', async () => {
          const pId = btn.getAttribute('data-product-id');
          const input = tbody.querySelector(`.input-inline-stock[data-product-id="${pId}"]`);
          if (!input) return;

          const nuevoStock = Number(input.value);
          if (isNaN(nuevoStock) || nuevoStock < 0) {
            showToast('El stock debe ser un número igual o mayor a 0.', 'warning');
            return;
          }

          btn.disabled = true;
          try {
            const { error } = await window.sb
              .from('productos')
              .update({ stock: nuevoStock })
              .eq('id', pId);

            if (error) throw error;
            showToast(`Stock de producto #${pId} actualizado a ${nuevoStock}.`, 'success');
            await cargarProductos();
          } catch (err) {
            console.error('[productos] Error al actualizar stock:', err);
            showToast('No se pudo actualizar el stock: ' + (err.message || 'Error'), 'danger');
            btn.disabled = false;
          }
        });
      });

      // Switch activo / inactivo
      tbody.querySelectorAll('.checkbox-toggle-active').forEach(chk => {
        chk.addEventListener('change', async () => {
          const pId = chk.getAttribute('data-product-id');
          const nuevoEstado = chk.checked;

          try {
            const { error } = await window.sb
              .from('productos')
              .update({ activo: nuevoEstado })
              .eq('id', pId);

            if (error) throw error;
            showToast(`Producto #${pId} ${nuevoEstado ? 'activado' : 'desactivado'}.`, 'info');
            // Actualizar dato local
            const prod = productosLista.find(p => String(p.id) === String(pId));
            if (prod) prod.activo = nuevoEstado;
          } catch (err) {
            console.error('[productos] Error al alternar activo:', err);
            showToast('Error al modificar estado del producto: ' + (err.message || 'Error'), 'danger');
            chk.checked = !nuevoEstado; // revertir
          }
        });
      });

      // Botón editar producto
      tbody.querySelectorAll('.btn-edit-product').forEach(btn => {
        btn.addEventListener('click', () => {
          const pId = btn.getAttribute('data-product-id');
          const prod = productosLista.find(p => String(p.id) === String(pId));
          if (prod) abrirModalProducto(prod);
        });
      });
    }
  }

  // Abre el modal para nuevo producto o edición
  function abrirModalProducto(prod = null) {
    const modal = document.getElementById('modalProducto');
    const form = document.getElementById('formProducto');
    const title = document.getElementById('modalProductoTitle');
    if (!modal || !form) return;

    form.reset();

    const idInput = document.getElementById('prodModalId');
    const nombreInput = document.getElementById('prodModalNombre');
    const descInput = document.getElementById('prodModalDescripcion');
    const catInput = document.getElementById('prodModalCategoria');
    const precioInput = document.getElementById('prodModalPrecio');
    const stockInput = document.getElementById('prodModalStock');
    const activoInput = document.getElementById('prodModalActivo');
    const previewImg = document.getElementById('prodModalImagePreview');
    const currentUrlInput = document.getElementById('prodModalCurrentImageUrl');

    if (previewImg) previewImg.src = '';
    if (previewImg) previewImg.style.display = 'none';

    if (prod) {
      if (title) title.textContent = `Editar Producto #${prod.id}: ${prod.nombre}`;
      if (idInput) idInput.value = prod.id;
      if (nombreInput) nombreInput.value = prod.nombre || '';
      if (descInput) descInput.value = prod.descripcion || '';
      if (catInput) catInput.value = prod.categoria_id || '';
      if (precioInput) precioInput.value = prod.precio || '';
      if (stockInput) stockInput.value = prod.stock || 0;
      if (activoInput) activoInput.checked = Boolean(prod.activo);
      if (currentUrlInput) currentUrlInput.value = prod.imagen_url || '';

      if (prod.imagen_url && previewImg) {
        previewImg.src = prod.imagen_url;
        previewImg.style.display = 'block';
      }
    } else {
      if (title) title.textContent = 'Nuevo Producto';
      if (idInput) idInput.value = '';
      if (activoInput) activoInput.checked = true;
      if (currentUrlInput) currentUrlInput.value = '';
    }

    openModal('modalProducto');
  }

  // Manejo de envío del formulario de producto con subida a Supabase Storage
  async function guardarProducto(e) {
    e.preventDefault();

    const puedeEditar = window.adminContext?.puedeEditar || false;
    if (!puedeEditar) {
      showToast('Acción denegada: Modo solo lectura.', 'danger');
      return;
    }

    const btnSubmit = document.getElementById('btnSubmitProducto');
    const idVal = document.getElementById('prodModalId')?.value;
    const nombre = document.getElementById('prodModalNombre')?.value.trim();
    const descripcion = document.getElementById('prodModalDescripcion')?.value.trim();
    const categoriaId = document.getElementById('prodModalCategoria')?.value;
    const precio = Number(document.getElementById('prodModalPrecio')?.value);
    const stock = Number(document.getElementById('prodModalStock')?.value);
    const activo = document.getElementById('prodModalActivo')?.checked;
    const currentUrl = document.getElementById('prodModalCurrentImageUrl')?.value || null;
    const fileInput = document.getElementById('prodModalImageFile');

    if (!nombre) {
      showToast('El nombre del producto es obligatorio.', 'warning');
      return;
    }
    if (!categoriaId) {
      showToast('Seleccioná una categoría.', 'warning');
      return;
    }
    if (isNaN(precio) || precio < 0) {
      showToast('El precio debe ser mayor o igual a 0.', 'warning');
      return;
    }
    if (isNaN(stock) || stock < 0) {
      showToast('El stock debe ser mayor o igual a 0.', 'warning');
      return;
    }

    let finalImageUrl = currentUrl;

    if (btnSubmit) {
      btnSubmit.disabled = true;
      btnSubmit.textContent = '⏳ Guardando...';
    }

    try {
      // 1. Si se adjuntó un archivo de imagen, subirlo a Supabase Storage bucket 'productos'
      if (fileInput && fileInput.files && fileInput.files.length > 0) {
        const file = fileInput.files[0];

        // Validaciones: imagen y hasta 2 MB
        if (!file.type.startsWith('image/')) {
          throw new Error('El archivo debe ser una imagen (JPG, PNG o WebP).');
        }
        if (file.size > 2 * 1024 * 1024) {
          throw new Error('La imagen no puede superar los 2 MB.');
        }

        const ext = file.name.split('.').pop().toLowerCase() || 'jpg';
        const uniqueFileName = `${crypto.randomUUID()}.${ext}`;

        btnSubmit.textContent = '⏳ Subiendo imagen...';
        const { data: uploadData, error: uploadError } = await window.sb.storage
          .from('productos')
          .upload(uniqueFileName, file, {
            contentType: file.type,
            cacheControl: '3600',
            upsert: false
          });

        if (uploadError) throw uploadError;

        // Obtener URL pública
        const { data: publicUrlData } = window.sb.storage
          .from('productos')
          .getPublicUrl(uniqueFileName);

        finalImageUrl = publicUrlData.publicUrl;
      }

      // 2. Insert o Update en tabla productos
      const payload = {
        nombre,
        descripcion: descripcion || null,
        categoria_id: Number(categoriaId),
        precio,
        stock,
        imagen_url: finalImageUrl,
        activo: Boolean(activo)
      };

      btnSubmit.textContent = '⏳ Guardando producto...';

      if (idVal) {
        const { error } = await window.sb
          .from('productos')
          .update(payload)
          .eq('id', idVal);

        if (error) throw error;
        showToast(`Producto #${idVal} modificado con éxito.`, 'success');
      } else {
        const { error } = await window.sb
          .from('productos')
          .insert(payload);

        if (error) throw error;
        showToast(`Producto "${nombre}" creado con éxito.`, 'success');
      }

      closeModal('modalProducto');
      await cargarProductos();

    } catch (err) {
      console.error('[productos] Error al guardar producto:', err);
      showToast('Error al guardar: ' + (err.message || 'Desconocido'), 'danger');
    } finally {
      if (btnSubmit) {
        btnSubmit.disabled = false;
        btnSubmit.textContent = 'Guardar Producto';
      }
    }
  }

  function inicializarProductos() {
    // Filtros
    document.getElementById('productosBusquedaInput')?.addEventListener('input', (e) => {
      filtroBusqueda = e.target.value;
      filtrarYRenderizarProductos();
    });

    document.getElementById('productosFiltroCategoria')?.addEventListener('change', (e) => {
      filtroCategoria = e.target.value;
      filtrarYRenderizarProductos();
    });

    document.getElementById('productosFiltroStock')?.addEventListener('change', (e) => {
      filtroEstadoStock = e.target.value;
      filtrarYRenderizarProductos();
    });

    document.getElementById('btnRefreshProductos')?.addEventListener('click', () => {
      cargarProductos();
      showToast('Catálogo de productos actualizado.', 'info');
    });

    // Botón abrir modal nuevo
    document.getElementById('btnNuevoProducto')?.addEventListener('click', () => {
      abrirModalProducto(null);
    });

    // Form submit
    document.getElementById('formProducto')?.addEventListener('submit', guardarProducto);

    // Previsualización de imagen al seleccionarla
    document.getElementById('prodModalImageFile')?.addEventListener('change', (e) => {
      const file = e.target.files[0];
      const preview = document.getElementById('prodModalImagePreview');
      if (file && preview) {
        if (!file.type.startsWith('image/')) {
          showToast('Solo se permiten archivos de imagen.', 'warning');
          e.target.value = '';
          return;
        }
        if (file.size > 2 * 1024 * 1024) {
          showToast('La imagen es demasiado grande (máximo 2 MB).', 'warning');
          e.target.value = '';
          return;
        }
        const reader = new FileReader();
        reader.onload = (re) => {
          preview.src = re.target.result;
          preview.style.display = 'block';
        };
        reader.readAsDataURL(file);
      }
    });
  }

  document.addEventListener('admin:ready', async () => {
    inicializarProductos();
    await cargarCategoriasSelect();
    await cargarProductos();
  });

  window.adminProductos = {
    recargar: cargarProductos,
    filtrarPorId: (id) => {
      filtroBusqueda = String(id);
      const input = document.getElementById('productosBusquedaInput');
      if (input) input.value = String(id);
      filtrarYRenderizarProductos();
    }
  };
})();
