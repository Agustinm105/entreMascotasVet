/**
 * Veterinaria Entre Mascotas - Lógica Principal de la Aplicación
 * FASE 2: Tienda, catálogo, carrito y checkout conectados con Supabase
 */

document.addEventListener('DOMContentLoaded', () => {
  'use strict';

  // Helper para escapar HTML seguro (docs/CONTEXTO.md - Regla 3)
  const esc = window.esc || function (str) {
    if (str === null || str === undefined) return '';
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  };

  // ==========================================
  // ESTADO DE LA APLICACIÓN
  // ==========================================
  let catalogCategories = [];
  let catalogProducts = [];
  let catalogServices = [];

  let currentCategory = 'all';
  let searchQuery = '';

  // Carrito persistente en localStorage solo como { producto_id, cantidad }
  const CART_STORAGE_KEY = 'entre_mascotas_cart';
  let cart = []; // Array<{ producto_id: number|string, cantidad: number }>

  // ID del cliente local para turnos y mascotas (fase de transición / Phase 3)
  const currentClientId = 1;

  // ==========================================
  // FORMATEADORES (docs/CONTEXTO.md - Regla 4)
  // ==========================================
  const formatCurrency = (val) => {
    return new Intl.NumberFormat('es-AR', {
      style: 'currency',
      currency: 'ARS',
      maximumFractionDigits: 0
    }).format(Number(val) || 0);
  };

  const formatDate = (isoString) => {
    if (!isoString) return '-';
    try {
      const d = new Date(isoString);
      return d.toLocaleDateString('es-AR', {
        timeZone: 'America/Argentina/Buenos_Aires',
        day: '2-digit',
        month: 'short',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
      });
    } catch {
      return String(isoString);
    }
  };

  // ==========================================
  // TOAST NOTIFICATIONS (Sin alert - Regla 6)
  // ==========================================
  const showToast = (message, type = 'success') => {
    let container = document.getElementById('toastContainer');
    if (!container) {
      container = document.createElement('div');
      container.id = 'toastContainer';
      container.className = 'toast-container';
      document.body.appendChild(container);
    }

    const toast = document.createElement('div');
    toast.className = `toast toast-${type}`;

    let icon = '✅';
    if (type === 'info') icon = 'ℹ️';
    if (type === 'warning') icon = '⚠️';
    if (type === 'danger') icon = '❌';

    const iconSpan = document.createElement('span');
    iconSpan.className = 'toast-icon';
    iconSpan.textContent = icon;

    const textDiv = document.createElement('div');
    textDiv.className = 'toast-text';
    textDiv.textContent = message;

    toast.appendChild(iconSpan);
    toast.appendChild(textDiv);
    container.appendChild(toast);

    setTimeout(() => toast.classList.add('show'), 10);
    setTimeout(() => {
      toast.classList.remove('show');
      setTimeout(() => toast.remove(), 350);
    }, 4200);
  };

  // ==========================================
  // RENDER: SERVICIOS VETERINARIOS (Supabase)
  // ==========================================
  const renderServices = async () => {
    const container = document.getElementById('servicesContainer');
    const select = document.getElementById('bookingServiceSelect');
    if (!container) return;

    // Estado de carga
    container.innerHTML = `
      <div class="loading-state">
        <span class="loading-spinner"></span>
        <p>Cargando servicios veterinarios...</p>
      </div>
    `;

    const { data: services, error } = await window.vetApi.getServicios();

    if (error || !services) {
      container.innerHTML = `
        <div class="error-state">
          <p>No se pudieron cargar los servicios en este momento.</p>
          <button type="button" class="btn btn-outline btn-sm" id="btnRetryServices">
            🔄 Reintentar
          </button>
        </div>
      `;
      const retryBtn = document.getElementById('btnRetryServices');
      if (retryBtn) retryBtn.addEventListener('click', renderServices);
      return;
    }

    catalogServices = services;

    if (services.length === 0) {
      container.innerHTML = `
        <div class="empty-state">
          <p>No hay servicios activos disponibles en este momento.</p>
        </div>
      `;
      return;
    }

    container.innerHTML = services.map(s => `
      <article class="service-card">
        <div class="service-card-media">
          <img src="${esc(s.imagen_url || 'assets/images/consultation.jpg')}" alt="${esc(s.nombre)}" loading="lazy">
          <span class="service-duration-badge">⏱️ ${esc(s.duracion_min)} min</span>
        </div>
        <div class="service-body">
          <h3 class="service-title">
            <span>${esc(s.icono || '🩺')}</span>
            ${esc(s.nombre)}
          </h3>
          <p class="service-desc">${esc(s.descripcion || '')}</p>
          <div class="service-footer">
            <div class="service-price">
              ${formatCurrency(s.precio)}
              <small>/ sesión</small>
            </div>
            <button type="button" class="btn btn-primary btn-sm btn-book-service" data-service-id="${esc(s.id)}" data-service-name="${esc(s.nombre)}">
              Agendar
            </button>
          </div>
        </div>
      </article>
    `).join('');

    // Rellenar select del modal de turnos
    if (select) {
      select.innerHTML = services.map(s => `
        <option value="${esc(s.id)}">${esc(s.nombre)} (${esc(s.duracion_min)} min - ${formatCurrency(s.precio)})</option>
      `).join('');
    }

    // Eventos para botones "Agendar"
    container.querySelectorAll('.btn-book-service').forEach(btn => {
      btn.addEventListener('click', () => {
        const sId = btn.getAttribute('data-service-id');
        openBookingModal(sId);
      });
    });
  };

  // ==========================================
  // CARGA DE CATÁLOGO: CATEGORÍAS & PRODUCTOS (Supabase)
  // ==========================================
  const loadCatalog = async () => {
    const productsContainer = document.getElementById('productsContainer');
    const pillsContainer = document.getElementById('categoryPills');

    if (productsContainer) {
      productsContainer.innerHTML = `
        <div class="loading-state">
          <span class="loading-spinner"></span>
          <p>Cargando catálogo de productos...</p>
        </div>
      `;
    }

    // Consultas concurrentes a Supabase
    const [catRes, prodRes] = await Promise.all([
      window.vetApi.getCategorias(),
      window.vetApi.getProductos()
    ]);

    if (catRes.error || prodRes.error) {
      console.error('[Catalog] Error al cargar categorías o productos:', catRes.error || prodRes.error);
      if (productsContainer) {
        productsContainer.innerHTML = `
          <div class="error-state">
            <p>Ocurrió un error al cargar los productos de la tienda.</p>
            <button type="button" class="btn btn-outline btn-sm" id="btnRetryCatalog">
              🔄 Reintentar
            </button>
          </div>
        `;
        const retryBtn = document.getElementById('btnRetryCatalog');
        if (retryBtn) retryBtn.addEventListener('click', loadCatalog);
      }
      return;
    }

    catalogCategories = catRes.data || [];
    catalogProducts = prodRes.data || [];

    // Revalidar el carrito contra los productos recién obtenidos
    revalidateCart(catalogProducts);

    renderCategories();
    renderProducts();
  };

  // Renderizar filtros de categoría
  const renderCategories = () => {
    const pillsContainer = document.getElementById('categoryPills');
    if (!pillsContainer) return;

    let html = `
      <button type="button" class="cat-btn ${currentCategory === 'all' ? 'active' : ''}" data-cat-id="all">
        🐾 Todos los Productos
      </button>
    `;

    html += catalogCategories.map(c => `
      <button type="button" class="cat-btn ${String(currentCategory) === String(c.id) ? 'active' : ''}" data-cat-id="${esc(c.id)}">
        ${esc(c.nombre)}
      </button>
    `).join('');

    pillsContainer.innerHTML = html;

    pillsContainer.querySelectorAll('.cat-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        currentCategory = btn.getAttribute('data-cat-id');
        renderCategories();
        renderProducts();
      });
    });
  };

  // Renderizar tarjetas de productos
  const renderProducts = () => {
    const container = document.getElementById('productsContainer');
    if (!container) return;

    let products = [...catalogProducts];

    // Filtro por categoría
    if (currentCategory !== 'all') {
      products = products.filter(p => String(p.categoria_id) === String(currentCategory));
    }

    // Filtro por buscador
    if (searchQuery.trim() !== '') {
      const q = searchQuery.toLowerCase().trim();
      products = products.filter(p =>
        (p.nombre && p.nombre.toLowerCase().includes(q)) ||
        (p.descripcion && p.descripcion.toLowerCase().includes(q))
      );
    }

    if (products.length === 0) {
      container.innerHTML = `
        <div style="grid-column: 1 / -1; text-align: center; padding: 3rem 1rem; color: var(--slate-500);">
          <div style="font-size: 3rem; margin-bottom: 0.5rem;">🔍</div>
          <h3>No encontramos productos que coincidan con tu búsqueda</h3>
          <p>Probá con otra categoría o término de búsqueda.</p>
        </div>
      `;
      return;
    }

    const categoriesMap = {};
    catalogCategories.forEach(c => { categoriesMap[c.id] = c.nombre; });

    container.innerHTML = products.map(p => {
      const catName = p.categorias?.nombre || categoriesMap[p.categoria_id] || 'General';
      const hasStock = Number(p.stock) > 0;
      const isLowStock = hasStock && Number(p.stock) <= 10;

      let stockTagHtml = '';
      if (!hasStock) {
        stockTagHtml = `<span class="product-stock-tag stock-out">Sin stock</span>`;
      } else if (isLowStock) {
        stockTagHtml = `<span class="product-stock-tag stock-low">¡Solo ${esc(p.stock)}! stock</span>`;
      } else {
        stockTagHtml = `<span class="product-stock-tag stock-in">${esc(p.stock)} en stock</span>`;
      }

      return `
        <article class="product-card">
          <div class="product-media">
            <span class="product-cat-tag">${esc(catName)}</span>
            ${stockTagHtml}
            <img src="${esc(p.imagen_url || 'https://images.unsplash.com/photo-1589924691995-400dc9ecc119?w=600')}" alt="${esc(p.nombre)}" loading="lazy">
          </div>
          <div class="product-body">
            <h4 class="product-name">${esc(p.nombre)}</h4>
            <p class="product-desc">${esc(p.descripcion || '')}</p>
            <div class="product-footer">
              <div class="product-price">${formatCurrency(p.precio)}</div>
              ${hasStock ? `
                <button type="button" class="btn btn-primary btn-sm btn-add-cart" data-prod-id="${esc(p.id)}">
                  🛒 Agregar
                </button>
              ` : `
                <button type="button" class="btn btn-primary btn-sm btn-add-cart" disabled style="opacity: 0.6; cursor: not-allowed;">
                  Sin stock
                </button>
              `}
            </div>
          </div>
        </article>
      `;
    }).join('');

    // Eventos para agregar al carrito
    container.querySelectorAll('.btn-add-cart:not([disabled])').forEach(btn => {
      btn.addEventListener('click', () => {
        const prodId = btn.getAttribute('data-prod-id');
        addToCart(prodId);
      });
    });
  };

  // Buscador de productos
  const searchInput = document.getElementById('searchInput');
  if (searchInput) {
    searchInput.addEventListener('input', (e) => {
      searchQuery = e.target.value;
      renderProducts();
    });
  }

  // ==========================================
  // CARRITO DE COMPRAS (localStorage & Revalidación)
  // ==========================================
  const loadCartFromStorage = () => {
    try {
      const raw = localStorage.getItem(CART_STORAGE_KEY);
      if (!raw) return [];
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) {
        return parsed
          .filter(item => item && item.producto_id !== undefined && Number(item.cantidad) > 0)
          .map(item => ({
            producto_id: item.producto_id,
            cantidad: Number(item.cantidad)
          }));
      }
      return [];
    } catch (e) {
      console.warn('[Cart] Error al leer carrito de localStorage:', e);
      return [];
    }
  };

  const saveCartToStorage = () => {
    try {
      const simplified = cart.map(item => ({
        producto_id: item.producto_id,
        cantidad: Number(item.cantidad)
      }));
      localStorage.setItem(CART_STORAGE_KEY, JSON.stringify(simplified));
    } catch (e) {
      console.error('[Cart] Error al guardar carrito en localStorage:', e);
    }
  };

  // Revalida el carrito contra la base de datos real
  const revalidateCart = (availableProducts) => {
    if (!Array.isArray(availableProducts) || availableProducts.length === 0) return;

    let changes = [];
    const validCart = [];

    cart.forEach(item => {
      const prod = availableProducts.find(p => String(p.id) === String(item.producto_id));

      if (!prod || !prod.activo || Number(prod.stock) <= 0) {
        changes.push(`"${prod ? prod.nombre : 'Un producto'}" ya no tiene stock y fue removido de tu carrito.`);
      } else {
        let qty = item.cantidad;
        if (qty > Number(prod.stock)) {
          qty = Number(prod.stock);
          changes.push(`Ajustamos la cantidad de "${prod.nombre}" a ${qty} unidad(es) por stock disponible.`);
        }
        validCart.push({
          producto_id: prod.id,
          cantidad: qty
        });
      }
    });

    const hadChanges = changes.length > 0 || validCart.length !== cart.length;
    cart = validCart;
    saveCartToStorage();
    updateCartUI();

    if (hadChanges) {
      changes.forEach(msg => showToast(msg, 'warning'));
    }
  };

  const addToCart = (productId) => {
    const product = catalogProducts.find(p => String(p.id) === String(productId));
    if (!product || Number(product.stock) <= 0) {
      showToast('Producto sin stock disponible.', 'warning');
      return;
    }

    const existing = cart.find(item => String(item.producto_id) === String(productId));
    if (existing) {
      if (existing.cantidad >= Number(product.stock)) {
        showToast(`Alcanzaste el stock disponible (${product.stock} un.)`, 'warning');
        return;
      }
      existing.cantidad += 1;
    } else {
      cart.push({
        producto_id: product.id,
        cantidad: 1
      });
    }

    saveCartToStorage();
    updateCartUI();
    showToast(`¡Agregado al carrito: ${product.nombre}!`, 'success');
  };

  const updateCartUI = () => {
    const badge = document.getElementById('cartCountBadge');
    const container = document.getElementById('cartItemsContainer');
    const totalEl = document.getElementById('cartTotalPrice');

    const totalCount = cart.reduce((sum, item) => sum + item.cantidad, 0);
    if (badge) badge.textContent = totalCount;

    let subtotal = 0;
    cart.forEach(item => {
      const prod = catalogProducts.find(p => String(p.id) === String(item.producto_id));
      if (prod) {
        subtotal += Number(prod.precio) * item.cantidad;
      }
    });

    if (totalEl) totalEl.textContent = formatCurrency(subtotal);

    if (!container) return;

    if (cart.length === 0) {
      container.innerHTML = `
        <div style="text-align: center; padding: 3rem 1rem; color: var(--slate-400);">
          <div style="font-size: 3rem; margin-bottom: 0.5rem;">🛍️</div>
          <p>Tu carrito está vacío.</p>
          <p style="font-size: 0.85rem; margin-top: 0.3rem;">¡Explorá nuestro catálogo de alimentos y accesorios!</p>
        </div>
      `;
      return;
    }

    container.innerHTML = cart.map(item => {
      const prod = catalogProducts.find(p => String(p.id) === String(item.producto_id));
      if (!prod) return '';

      return `
        <div class="cart-item">
          <img src="${esc(prod.imagen_url || 'https://images.unsplash.com/photo-1589924691995-400dc9ecc119?w=600')}" alt="${esc(prod.nombre)}" class="cart-item-img">
          <div class="cart-item-info">
            <div class="cart-item-name">${esc(prod.nombre)}</div>
            <div class="cart-item-price">${formatCurrency(prod.precio)}</div>
            <div class="cart-qty-ctrl">
              <button type="button" class="cart-qty-btn btn-cart-dec" data-id="${esc(prod.id)}">-</button>
              <span class="cart-qty-num">${esc(item.cantidad)}</span>
              <button type="button" class="cart-qty-btn btn-cart-inc" data-id="${esc(prod.id)}">+</button>
              <button type="button" class="btn btn-ghost btn-cart-remove" data-id="${esc(prod.id)}" style="font-size: 0.75rem; color: var(--danger); margin-left: auto; padding: 0.2rem 0.4rem;">
                Quitar
              </button>
            </div>
          </div>
        </div>
      `;
    }).join('');

    // Listeners de controles de cantidad
    container.querySelectorAll('.btn-cart-dec').forEach(btn => {
      btn.addEventListener('click', () => {
        const id = btn.getAttribute('data-id');
        const item = cart.find(i => String(i.producto_id) === String(id));
        if (item) {
          if (item.cantidad > 1) {
            item.cantidad -= 1;
          } else {
            cart = cart.filter(i => String(i.producto_id) !== String(id));
          }
          saveCartToStorage();
          updateCartUI();
        }
      });
    });

    container.querySelectorAll('.btn-cart-inc').forEach(btn => {
      btn.addEventListener('click', () => {
        const id = btn.getAttribute('data-id');
        const item = cart.find(i => String(i.producto_id) === String(id));
        const prod = catalogProducts.find(p => String(p.id) === String(id));
        if (item && prod) {
          if (item.cantidad < Number(prod.stock)) {
            item.cantidad += 1;
            saveCartToStorage();
            updateCartUI();
          } else {
            showToast(`Llegaste al límite de stock (${prod.stock} un.)`, 'warning');
          }
        }
      });
    });

    container.querySelectorAll('.btn-cart-remove').forEach(btn => {
      btn.addEventListener('click', () => {
        const id = btn.getAttribute('data-id');
        cart = cart.filter(i => String(i.producto_id) !== String(id));
        saveCartToStorage();
        updateCartUI();
      });
    });
  };

  // Abrir y cerrar Drawer del Carrito
  const cartDrawer = document.getElementById('cartDrawer');
  const btnOpenCart = document.getElementById('btnOpenCart');
  const btnCloseCart = document.getElementById('btnCloseCart');

  if (btnOpenCart && cartDrawer) {
    btnOpenCart.addEventListener('click', () => cartDrawer.classList.add('active'));
  }
  if (btnCloseCart && cartDrawer) {
    btnCloseCart.addEventListener('click', () => cartDrawer.classList.remove('active'));
  }

  // ==========================================
  // CHECKOUT DE COMPRA REAL (Supabase & Mercado Pago)
  // ==========================================
  const btnProceedCheckout = document.getElementById('btnProceedCheckout');
  const modalCheckout = document.getElementById('modalCheckout');
  const checkoutForm = document.getElementById('checkoutForm');
  const checkoutTotalText = document.getElementById('checkoutTotalText');
  const checkoutItemsSummary = document.getElementById('checkoutItemsSummary');
  const checkoutAuthPrompt = document.getElementById('checkoutAuthPrompt');
  const checkoutFormContent = document.getElementById('checkoutFormContent');
  const checkoutUserDisplay = document.getElementById('checkoutUserDisplay');
  const checkoutAddress = document.getElementById('checkoutAddress');
  const checkoutPhone = document.getElementById('checkoutPhone');
  const btnCheckoutGoogleLogin = document.getElementById('btnCheckoutGoogleLogin');
  const btnConfirmCheckout = document.getElementById('btnConfirmCheckout');

  const labelEnvio = document.getElementById('labelEnvio');
  const labelRetiro = document.getElementById('labelRetiro');
  const checkoutEnvioDetails = document.getElementById('checkoutEnvioDetails');
  const checkoutRetiroDetails = document.getElementById('checkoutRetiroDetails');

  // Alternar entre Envío y Retiro
  const handleDeliveryToggle = () => {
    const selected = document.querySelector('input[name="checkoutTipoEntrega"]:checked')?.value || 'envio';

    if (selected === 'envio') {
      if (checkoutEnvioDetails) checkoutEnvioDetails.style.display = 'block';
      if (checkoutRetiroDetails) checkoutRetiroDetails.style.display = 'none';
      if (labelEnvio) labelEnvio.classList.add('active');
      if (labelRetiro) labelRetiro.classList.remove('active');
      if (checkoutAddress) checkoutAddress.required = true;
    } else {
      if (checkoutEnvioDetails) checkoutEnvioDetails.style.display = 'none';
      if (checkoutRetiroDetails) checkoutRetiroDetails.style.display = 'block';
      if (labelEnvio) labelEnvio.classList.remove('active');
      if (labelRetiro) labelRetiro.classList.add('active');
      if (checkoutAddress) checkoutAddress.required = false;
    }
  };

  document.querySelectorAll('input[name="checkoutTipoEntrega"]').forEach(radio => {
    radio.addEventListener('change', handleDeliveryToggle);
  });

  // Abrir Modal de Checkout y preparar datos del usuario
  const openCheckoutModal = () => {
    if (cart.length === 0) {
      showToast('Agregá al menos un producto al carrito para comprar.', 'warning');
      return;
    }

    if (cartDrawer) cartDrawer.classList.remove('active');

    // Calcular subtotal estimado
    let subtotal = 0;
    let itemsCount = 0;
    cart.forEach(item => {
      const prod = catalogProducts.find(p => String(p.id) === String(item.producto_id));
      if (prod) {
        subtotal += Number(prod.precio) * item.cantidad;
        itemsCount += item.cantidad;
      }
    });

    if (checkoutTotalText) checkoutTotalText.textContent = formatCurrency(subtotal);
    if (checkoutItemsSummary) {
      checkoutItemsSummary.textContent = `${itemsCount} producto(s) en tu orden. El total es calculado y validado por la base de datos.`;
    }

    // Verificar estado de sesión actual
    const session = window.vetAuth ? window.vetAuth.obtenerSesion() : null;
    const perfil = window.vetAuth ? window.vetAuth.obtenerPerfil() : null;

    if (!session || !session.user) {
      // Usuario no autenticado: requerir login
      if (checkoutAuthPrompt) checkoutAuthPrompt.style.display = 'block';
      if (checkoutFormContent) checkoutFormContent.style.display = 'none';
    } else {
      // Usuario autenticado: mostrar formulario con datos precargados
      if (checkoutAuthPrompt) checkoutAuthPrompt.style.display = 'none';
      if (checkoutFormContent) checkoutFormContent.style.display = 'block';

      let nombreCompleto = '';
      if (perfil) {
        nombreCompleto = (perfil.nombre || '') + (perfil.apellido ? ' ' + perfil.apellido : '');
      }
      if (!nombreCompleto) {
        nombreCompleto = session.user.user_metadata?.full_name || session.user.email?.split('@')[0] || 'Cliente';
      }

      const email = perfil?.email || session.user.email || '';

      if (checkoutUserDisplay) {
        checkoutUserDisplay.textContent = `${nombreCompleto} (${email})`;
      }

      // Precargar dirección y teléfono de la base
      if (checkoutAddress) {
        checkoutAddress.value = perfil?.direccion || '';
      }
      if (checkoutPhone) {
        checkoutPhone.value = perfil?.telefono || '';
      }

      handleDeliveryToggle();
    }

    openModal(modalCheckout);
  };

  if (btnProceedCheckout) {
    btnProceedCheckout.addEventListener('click', openCheckoutModal);
  }

  if (btnCheckoutGoogleLogin) {
    btnCheckoutGoogleLogin.addEventListener('click', () => {
      if (window.vetAuth) window.vetAuth.loginConGoogle();
    });
  }

  // Confirmación del Pedido y Llamada a Supabase RPC crear_pedido
  if (checkoutForm) {
    checkoutForm.addEventListener('submit', async (e) => {
      e.preventDefault();

      const session = window.vetAuth ? window.vetAuth.obtenerSesion() : null;
      if (!session || !session.user) {
        showToast('Debés iniciar sesión con Google para confirmar la compra.', 'warning');
        return;
      }

      if (cart.length === 0) {
        showToast('El carrito está vacío.', 'warning');
        return;
      }

      const tipoEntrega = document.querySelector('input[name="checkoutTipoEntrega"]:checked')?.value || 'envio';
      const addressVal = checkoutAddress ? checkoutAddress.value.trim() : '';
      const phoneVal = checkoutPhone ? checkoutPhone.value.trim() : '';

      if (tipoEntrega === 'envio' && !addressVal) {
        showToast('Por favor, ingresá la dirección de entrega.', 'warning');
        if (checkoutAddress) checkoutAddress.focus();
        return;
      }

      if (!phoneVal) {
        showToast('El teléfono es obligatorio para coordinar la entrega.', 'warning');
        if (checkoutPhone) checkoutPhone.focus();
        return;
      }

      // Preparar payload seguro: NUNCA enviar precios ni totales (docs/CONTEXTO.md - Regla 2)
      const p_items = cart.map(item => ({
        producto_id: item.producto_id,
        cantidad: item.cantidad
      }));

      // Deshabilitar botón durante el envío
      if (btnConfirmCheckout) {
        btnConfirmCheckout.disabled = true;
        btnConfirmCheckout.textContent = '⏳ Creando pedido...';
      }

      try {
        const { data: pedidoId, error } = await window.vetApi.crearPedido({
          items: p_items,
          tipoEntrega,
          direccion: addressVal
        });

        if (error) {
          console.error('[Checkout] Error al crear pedido:', error);
          showToast(error.message || 'Error al procesar el pedido. Verificá el stock disponible.', 'danger');

          // Refrescar catálogo para mostrar el stock actualizado
          await loadCatalog();
          return;
        }

        // Éxito en la creación del pedido
        // Actualizar teléfono o dirección en el perfil si correspondiera
        const perfil = window.vetAuth ? window.vetAuth.obtenerPerfil() : null;
        const updates = {};
        if (!perfil?.telefono || perfil.telefono !== phoneVal) {
          updates.telefono = phoneVal;
        }
        if (tipoEntrega === 'envio' && (!perfil?.direccion || perfil.direccion !== addressVal)) {
          updates.direccion = addressVal;
        }

        if (Object.keys(updates).length > 0) {
          window.vetApi.actualizarPerfil(session.user.id, updates).then(() => {
            if (window.vetAuth && window.vetAuth.perfil) {
              Object.assign(window.vetAuth.perfil, updates);
            }
          }).catch(err => console.warn('[Checkout] No se pudo actualizar datos del perfil:', err));
        }

        // Vaciar carrito
        cart = [];
        saveCartToStorage();
        updateCartUI();

        // Cerrar modal
        closeModal(modalCheckout);

        // Actualizar stock de la tienda
        await loadCatalog();

        // Invocar Edge Function crear-pago
        showToast(`¡Pedido #${pedidoId} creado con éxito!`, 'success');

        const mpRes = await window.vetApi.crearPago(pedidoId);
        if (mpRes && mpRes.data && mpRes.data.init_point) {
          window.location.href = mpRes.data.init_point;
          return;
        } else {
          // Si la Edge function aún no está desplegada o falla, NO es un error fatal (docs/CONTEXTO.md)
          showToast(`Tu pedido #${pedidoId} fue creado. El pago todavía no está disponible; podés completarlo desde Mis pedidos.`, 'info');

          // Activar pestaña de Mis Pedidos y hacer scroll suave al portal
          activarTabPortal('pedidos');
          renderMisPedidos();
          const portalEl = document.getElementById('portal');
          if (portalEl) portalEl.scrollIntoView({ behavior: 'smooth' });
        }
      } catch (err) {
        console.error('[Checkout] Excepción:', err);
        showToast('Ocurrió un error inesperado al procesar el pedido.', 'danger');
      } finally {
        if (btnConfirmCheckout) {
          btnConfirmCheckout.disabled = false;
          btnConfirmCheckout.textContent = '✅ Confirmar Pedido';
        }
      }
    });
  }

  // ==========================================
  // PORTAL CLIENTE: PESTAÑAS & MIS PEDIDOS
  // ==========================================
  const tabBtnMascotasTurnos = document.getElementById('tabBtnMascotasTurnos');
  const tabBtnMisPedidos = document.getElementById('tabBtnMisPedidos');
  const tabContentMascotasTurnos = document.getElementById('tabContentMascotasTurnos');
  const tabContentMisPedidos = document.getElementById('tabContentMisPedidos');

  const activarTabPortal = (tab) => {
    if (tab === 'pedidos') {
      if (tabContentMascotasTurnos) tabContentMascotasTurnos.style.display = 'none';
      if (tabContentMisPedidos) tabContentMisPedidos.style.display = 'block';

      if (tabBtnMascotasTurnos) {
        tabBtnMascotasTurnos.classList.remove('active');
        tabBtnMascotasTurnos.style.borderBottomColor = 'transparent';
        tabBtnMascotasTurnos.style.color = 'var(--slate-500)';
      }
      if (tabBtnMisPedidos) {
        tabBtnMisPedidos.classList.add('active');
        tabBtnMisPedidos.style.borderBottomColor = 'var(--primary-600)';
        tabBtnMisPedidos.style.color = 'var(--primary-700)';
      }
    } else {
      if (tabContentMascotasTurnos) tabContentMascotasTurnos.style.display = 'block';
      if (tabContentMisPedidos) tabContentMisPedidos.style.display = 'none';

      if (tabBtnMascotasTurnos) {
        tabBtnMascotasTurnos.classList.add('active');
        tabBtnMascotasTurnos.style.borderBottomColor = 'var(--primary-600)';
        tabBtnMascotasTurnos.style.color = 'var(--primary-700)';
      }
      if (tabBtnMisPedidos) {
        tabBtnMisPedidos.classList.remove('active');
        tabBtnMisPedidos.style.borderBottomColor = 'transparent';
        tabBtnMisPedidos.style.color = 'var(--slate-500)';
      }
    }
  };

  if (tabBtnMascotasTurnos) {
    tabBtnMascotasTurnos.addEventListener('click', () => activarTabPortal('mascotas'));
  }
  if (tabBtnMisPedidos) {
    tabBtnMisPedidos.addEventListener('click', () => {
      activarTabPortal('pedidos');
      renderMisPedidos();
    });
  }

  // Renderizar la lista de pedidos del usuario autenticado
  const renderMisPedidos = async () => {
    const container = document.getElementById('portalOrdersContainer');
    const badge = document.getElementById('portalOrdersCount');
    if (!container) return;

    const session = window.vetAuth ? window.vetAuth.obtenerSesion() : null;

    if (!session || !session.user) {
      if (badge) badge.textContent = '0';
      container.innerHTML = `
        <div class="empty-state" style="padding: 2.5rem 1rem;">
          <div style="font-size: 2.5rem; margin-bottom: 0.5rem;">🔒</div>
          <h4 style="font-weight: 700; color: var(--slate-800); margin-bottom: 0.3rem;">Iniciá sesión para ver tus pedidos</h4>
          <p style="color: var(--slate-500); font-size: 0.9rem; margin-bottom: 1.25rem;">
            Podrás seguir el estado de preparación, realizar pagos y gestionar tus compras.
          </p>
          <button type="button" class="btn btn-outline btn-google" id="btnOrdersLogin">
            Ingresar con Google
          </button>
        </div>
      `;
      const loginBtn = document.getElementById('btnOrdersLogin');
      if (loginBtn) {
        loginBtn.addEventListener('click', () => {
          if (window.vetAuth) window.vetAuth.loginConGoogle();
        });
      }
      return;
    }

    container.innerHTML = `
      <div class="loading-state">
        <span class="loading-spinner"></span>
        <p>Cargando tus pedidos...</p>
      </div>
    `;

    const { data: pedidos, error } = await window.vetApi.getMisPedidos();

    if (error || !pedidos) {
      container.innerHTML = `
        <div class="error-state">
          <p>No pudimos cargar tus pedidos en este momento.</p>
          <button type="button" class="btn btn-outline btn-sm" id="btnRetryOrders">
            🔄 Reintentar
          </button>
        </div>
      `;
      const retryBtn = document.getElementById('btnRetryOrders');
      if (retryBtn) retryBtn.addEventListener('click', renderMisPedidos);
      return;
    }

    if (badge) badge.textContent = pedidos.length;

    if (pedidos.length === 0) {
      container.innerHTML = `
        <div class="empty-state">
          <div style="font-size: 2.5rem; margin-bottom: 0.5rem;">📦</div>
          <h4 style="font-weight: 700; color: var(--slate-800);">Aún no realizaste ningún pedido</h4>
          <p style="color: var(--slate-500); font-size: 0.9rem; margin-top: 0.25rem;">
            ¡Explorá nuestro Pet Shop para consentir a tu mascota!
          </p>
          <a href="#tienda" class="btn btn-primary btn-sm" style="margin-top: 1rem; display: inline-block;">
            Ir al Pet Shop
          </a>
        </div>
      `;
      return;
    }

    // Mapeo de estados según docs/CONTEXTO.md
    const getStatusInfo = (estado, tipoEntrega) => {
      switch (estado) {
        case 'pendiente_pago':
          return { label: 'Pendiente de pago', className: 'badge-pendiente_pago' };
        case 'preparando':
          return { label: 'Preparándose', className: 'badge-preparando' };
        case 'en_camino':
          return { label: 'En camino', className: 'badge-en_camino' };
        case 'completado':
          return {
            label: tipoEntrega === 'envio' ? 'Entregado' : 'Retirado',
            className: 'badge-completado'
          };
        case 'cancelado':
          return { label: 'Cancelado', className: 'badge-cancelado' };
        default:
          return { label: estado, className: 'badge-status' };
      }
    };

    container.innerHTML = pedidos.map(p => {
      const statusInfo = getStatusInfo(p.estado, p.tipo_entrega);
      const isPendiente = p.estado === 'pendiente_pago';
      const items = Array.isArray(p.detalle_pedido) ? p.detalle_pedido : [];

      return `
        <article class="order-card">
          <div class="order-header">
            <div>
              <div class="order-id">Pedido #${esc(p.id)}</div>
              <div class="order-date">🗓️ ${formatDate(p.fecha)}</div>
            </div>
            <div style="display: flex; align-items: center; gap: 0.5rem;">
              <span class="badge-status ${statusInfo.className}">${esc(statusInfo.label)}</span>
            </div>
          </div>

          <div style="font-size: 0.88rem; color: var(--slate-600); margin-bottom: 0.65rem;">
            ${p.tipo_entrega === 'envio' ? `
              <span>🚚 <strong>Envío a domicilio:</strong> ${esc(p.direccion_envio || 'Dirección registrada')}</span>
            ` : `
              <span>🏪 <strong>Retiro en el local:</strong> Av. Libertador 2450</span>
            `}
          </div>

          <div style="font-size: 0.82rem; font-weight: 700; color: var(--slate-700); text-transform: uppercase; letter-spacing: 0.5px; margin-top: 0.65rem;">
            Productos:
          </div>

          <ul class="order-items">
            ${items.map(item => `
              <li class="order-item-row">
                <span>
                  <strong>${esc(item.cantidad)}x</strong> ${esc(item.productos?.nombre || 'Producto')}
                </span>
                <span style="font-weight: 600; color: var(--slate-800);">
                  ${formatCurrency(item.precio_unitario * item.cantidad)}
                </span>
              </li>
            `).join('')}
          </ul>

          <div class="order-footer">
            <div class="order-total">
              Total: ${formatCurrency(p.total)}
            </div>

            ${isPendiente ? `
              <div class="order-actions">
                <button type="button" class="btn btn-outline btn-sm btn-cancel-order" data-pedido-id="${esc(p.id)}" style="color: var(--danger); font-size: 0.8rem; padding: 0.35rem 0.65rem;">
                  ❌ Cancelar
                </button>
                <button type="button" class="btn btn-primary btn-sm btn-pay-order" data-pedido-id="${esc(p.id)}" style="font-size: 0.8rem; padding: 0.35rem 0.75rem;">
                  💳 Pagar ahora
                </button>
              </div>
            ` : ''}
          </div>
        </article>
      `;
    }).join('');

    // Eventos de botones "Pagar ahora"
    container.querySelectorAll('.btn-pay-order').forEach(btn => {
      btn.addEventListener('click', async () => {
        const pedidoId = btn.getAttribute('data-pedido-id');
        btn.disabled = true;
        btn.textContent = '⏳ Cargando...';

        try {
          const res = await window.vetApi.crearPago(pedidoId);
          if (res && res.data && res.data.init_point) {
            window.location.href = res.data.init_point;
          } else {
            showToast('El servicio de pago todavía no está disponible. Podrás completarlo próximamente.', 'info');
          }
        } catch (err) {
          console.warn('[Orders] Error al intentar pagar:', err);
          showToast('No se pudo iniciar el pago en este momento.', 'warning');
        } finally {
          btn.disabled = false;
          btn.textContent = '💳 Pagar ahora';
        }
      });
    });

    // Eventos de botones "Cancelar pedido"
    container.querySelectorAll('.btn-cancel-order').forEach(btn => {
      btn.addEventListener('click', async () => {
        const pedidoId = btn.getAttribute('data-pedido-id');
        const confirma = confirm(`¿Estás seguro de que querés cancelar el pedido #${pedidoId}? El stock de los productos será devuelto a la tienda.`);
        if (!confirma) return;

        btn.disabled = true;
        btn.textContent = '⏳ Cancelando...';

        const { error } = await window.vetApi.cancelarPedido(pedidoId);
        if (error) {
          showToast(error.message || 'No se pudo cancelar el pedido.', 'danger');
          btn.disabled = false;
          btn.textContent = '❌ Cancelar';
        } else {
          showToast(`Pedido #${pedidoId} cancelado. El stock fue reintegrado con éxito.`, 'info');
          // Refrescar pedidos y tienda
          await Promise.all([renderMisPedidos(), loadCatalog()]);
        }
      });
    });
  };

  // ==========================================
  // RETORNO DE MERCADO PAGO (?pago=ok|pendiente|error &pedido=ID)
  // ==========================================
  const verificarRetornoMercadoPago = async () => {
    const params = new URLSearchParams(window.location.search);
    const estadoPago = params.get('pago');
    const pedidoId = params.get('pedido');

    if (!estadoPago || !pedidoId) return;

    // Abrir la pestaña de Mis Pedidos y hacer foco en el portal
    activarTabPortal('pedidos');
    const portalEl = document.getElementById('portal');
    if (portalEl) portalEl.scrollIntoView({ behavior: 'smooth' });

    // Limpiar URL sin recargar para no re-ejecutar en refresh
    const cleanUrl = window.location.origin + window.location.pathname;
    window.history.replaceState(null, document.title, cleanUrl);

    if (estadoPago === 'ok') {
      // El navegador NUNCA marca un pedido como pagado (lo hace solo el webhook).
      // Consultamos el estado actual
      const { data: pedido } = await window.vetApi.getPedidoPorId(pedidoId);

      if (pedido && (pedido.pago_estado === 'aprobado' || pedido.estado !== 'pendiente_pago')) {
        showToast('¡Pago aprobado! Estamos preparando tu pedido.', 'success');
        renderMisPedidos();
      } else {
        // Aún figura pendiente: mostrar "Estamos confirmando tu pago" y recargar cada 5s hasta 1 minuto
        showToast('Estamos confirmando tu pago con Mercado Pago...', 'info');

        let intentos = 0;
        const maxIntentos = 12; // 12 x 5s = 60 segundos (1 minuto)

        const polling = setInterval(async () => {
          intentos++;
          const res = await window.vetApi.getPedidoPorId(pedidoId);
          const p = res?.data;

          if (p && (p.pago_estado === 'aprobado' || p.estado !== 'pendiente_pago')) {
            clearInterval(polling);
            showToast('¡Pago confirmado! Estamos preparando tu pedido.', 'success');
            renderMisPedidos();
          } else if (intentos >= maxIntentos) {
            clearInterval(polling);
            showToast('Tu pago está siendo procesado por Mercado Pago. Te avisaremos cuando se confirme.', 'info');
            renderMisPedidos();
          }
        }, 5000);
      }
    } else if (estadoPago === 'pendiente') {
      showToast('Tu pago está pendiente de acreditación.', 'warning');
      renderMisPedidos();
    } else if (estadoPago === 'error') {
      showToast('No se pudo completar el pago, podés reintentarlo desde Mis pedidos.', 'danger');
      renderMisPedidos();
    }
  };

  // ==========================================
  // SINCRONIZACIÓN CON EVENTOS DE AUTENTICACIÓN
  // ==========================================
  document.addEventListener('vet:authchange', async (e) => {
    const { session, perfil } = e.detail || {};

    const clientTitle = document.getElementById('currentClientTitle');
    const clientSub = document.getElementById('currentClientSub');

    if (session && session.user) {
      let nombre = perfil?.nombre ? (perfil.nombre + (perfil.apellido ? ' ' + perfil.apellido : '')) : '';
      if (!nombre) {
        nombre = session.user.user_metadata?.full_name || session.user.email?.split('@')[0] || 'Cliente';
      }
      const email = perfil?.email || session.user.email || '';
      const tel = perfil?.telefono ? ` | Tel: ${perfil.telefono}` : '';

      if (clientTitle) clientTitle.textContent = `Cliente: ${nombre}`;
      if (clientSub) clientSub.textContent = `${email}${tel}`;

      // Si el modal de checkout estaba abierto en espera de login, actualizar su vista
      if (modalCheckout && modalCheckout.classList.contains('active')) {
        openCheckoutModal();
      }

      // Cargar pedidos reales de la persona
      renderMisPedidos();
    } else {
      if (clientTitle) clientTitle.textContent = 'Área de Clientes';
      if (clientSub) clientSub.textContent = 'Iniciá sesión para ver tus mascotas, turnos y pedidos en tiempo real.';
      renderMisPedidos();
    }
  });

  // ==========================================
  // TURNOS Y MASCOTAS (Módulo en transición / Fase 3)
  // ==========================================
  const modalBooking = document.getElementById('modalBooking');
  const bookingForm = document.getElementById('bookingForm');
  const modalAddPet = document.getElementById('modalAddPet');
  const btnAddNewPet = document.getElementById('btnAddNewPet');
  const addPetForm = document.getElementById('addPetForm');
  const btnHeroReserve = document.getElementById('btnHeroReserve');
  const btnMainBooking = document.getElementById('btnMainBooking');
  const btnPortalNewBooking = document.getElementById('btnPortalNewBooking');

  const openBookingModal = (preselectedServiceId = null) => {
    const dateInput = document.getElementById('bookingDate');
    const today = new Date().toISOString().split('T')[0];
    if (dateInput) {
      dateInput.min = today;
      if (!dateInput.value) dateInput.value = today;
    }

    if (preselectedServiceId) {
      const select = document.getElementById('bookingServiceSelect');
      if (select) select.value = preselectedServiceId;
    }

    // Precargar datos del cliente
    const perfil = window.vetAuth ? window.vetAuth.obtenerPerfil() : null;
    const session = window.vetAuth ? window.vetAuth.obtenerSesion() : null;

    if (perfil) {
      if (document.getElementById('bookingClientName')) document.getElementById('bookingClientName').value = perfil.nombre || '';
      if (document.getElementById('bookingClientLastname')) document.getElementById('bookingClientLastname').value = perfil.apellido || '';
      if (document.getElementById('bookingClientEmail')) document.getElementById('bookingClientEmail').value = perfil.email || '';
      if (document.getElementById('bookingClientPhone')) document.getElementById('bookingClientPhone').value = perfil.telefono || '';
    } else if (session?.user) {
      if (document.getElementById('bookingClientEmail')) document.getElementById('bookingClientEmail').value = session.user.email || '';
    } else if (window.vetDB) {
      const demoClient = window.vetDB.getById('clientes', currentClientId);
      if (demoClient) {
        if (document.getElementById('bookingClientName')) document.getElementById('bookingClientName').value = demoClient.nombre;
        if (document.getElementById('bookingClientLastname')) document.getElementById('bookingClientLastname').value = demoClient.apellido;
        if (document.getElementById('bookingClientEmail')) document.getElementById('bookingClientEmail').value = demoClient.email;
        if (document.getElementById('bookingClientPhone')) document.getElementById('bookingClientPhone').value = demoClient.telefono || '';
      }
    }

    openModal(modalBooking);
  };

  if (btnHeroReserve) btnHeroReserve.addEventListener('click', () => openBookingModal());
  if (btnMainBooking) btnMainBooking.addEventListener('click', () => openBookingModal());
  if (btnPortalNewBooking) btnPortalNewBooking.addEventListener('click', () => openBookingModal());

  if (bookingForm && window.vetDB) {
    bookingForm.addEventListener('submit', (e) => {
      e.preventDefault();

      const serviceId = Number(document.getElementById('bookingServiceSelect').value);
      const dateVal = document.getElementById('bookingDate').value;
      const timeVal = document.getElementById('bookingTime').value;
      const combinedDateTime = new Date(`${dateVal}T${timeVal}:00`).toISOString();

      const petName = document.getElementById('bookingPetName').value.trim();
      const petBreed = document.getElementById('bookingPetBreed').value.trim();
      const petBirth = document.getElementById('bookingPetBirth').value;
      const notes = document.getElementById('bookingNotes').value.trim();

      const clientName = document.getElementById('bookingClientName').value.trim();
      const clientLastname = document.getElementById('bookingClientLastname').value.trim();
      const clientEmail = document.getElementById('bookingClientEmail').value.trim();
      const clientPhone = document.getElementById('bookingClientPhone').value.trim();

      let client = window.vetDB.filter('clientes', c => c.email.toLowerCase() === clientEmail.toLowerCase())[0];
      if (!client) {
        client = window.vetDB.insert('clientes', {
          nombre: clientName,
          apellido: clientLastname,
          email: clientEmail,
          telefono: clientPhone,
          direccion: 'A coordinar',
          password_hash: 'auto_token'
        });
      }

      let pet = window.vetDB.filter('mascotas', m => m.cliente_id === client.id && m.nombre.toLowerCase() === petName.toLowerCase())[0];
      if (!pet) {
        pet = window.vetDB.insert('mascotas', {
          cliente_id: client.id,
          nombre: petName,
          raza: petBreed || 'No especificada',
          fecha_nacimiento: petBirth || null,
          notas: notes || null
        });
      }

      const nuevoTurno = window.vetDB.insert('turnos', {
        cliente_id: client.id,
        mascota_id: pet.id,
        servicio_id: serviceId,
        fecha_hora: combinedDateTime,
        estado: 'reservado',
        notas: notes || 'Turno solicitado online'
      });

      closeModal(modalBooking);
      bookingForm.reset();
      renderPortalMascotasYTurnos();
      showToast(`¡Turno #${nuevoTurno.id} reservado con éxito para ${pet.nombre}!`, 'success');
    });
  }

  if (btnAddNewPet) btnAddNewPet.addEventListener('click', () => openModal(modalAddPet));

  if (addPetForm && window.vetDB) {
    addPetForm.addEventListener('submit', (e) => {
      e.preventDefault();
      const name = document.getElementById('newPetName').value.trim();
      const breed = document.getElementById('newPetBreed').value.trim();
      const birth = document.getElementById('newPetBirth').value;
      const notes = document.getElementById('newPetNotes').value.trim();

      const newPet = window.vetDB.insert('mascotas', {
        cliente_id: currentClientId,
        nombre: name,
        raza: breed || 'Mestizo',
        fecha_nacimiento: birth || null,
        notas: notes || null
      });

      closeModal(modalAddPet);
      addPetForm.reset();
      renderPortalMascotasYTurnos();
      showToast(`Mascota "${newPet.nombre}" registrada correctamente.`, 'success');
    });
  }

  const renderPortalMascotasYTurnos = () => {
    if (!window.vetDB) return;

    const petsContainer = document.getElementById('petsListContainer');
    const appContainer = document.getElementById('appointmentsListContainer');
    const petBadge = document.getElementById('petCountBadge');
    const appBadge = document.getElementById('appointmentsCountBadge');

    // Mascotas
    const pets = window.vetDB.filter('mascotas', m => m.cliente_id === currentClientId);
    if (petBadge) petBadge.textContent = pets.length;

    if (petsContainer) {
      if (pets.length === 0) {
        petsContainer.innerHTML = `<p style="color: var(--slate-500); font-size: 0.9rem;">No tenés mascotas registradas aún.</p>`;
      } else {
        petsContainer.innerHTML = pets.map(pet => `
          <div style="background: var(--slate-50); border: 1px solid var(--slate-200); border-radius: var(--radius-md); padding: 1.1rem; display: flex; align-items: flex-start; justify-content: space-between; gap: 0.75rem;">
            <div>
              <div style="font-weight: 700; font-size: 1.05rem; color: var(--slate-900);">
                🐾 ${esc(pet.nombre)}
              </div>
              <div style="font-size: 0.82rem; color: var(--slate-600); margin: 0.2rem 0;">
                <strong>Raza:</strong> ${esc(pet.raza || 'Común')} | 
                <strong>Nacimiento:</strong> ${esc(pet.fecha_nacimiento || 'No especificado')}
              </div>
              ${pet.notas ? `<div style="font-size: 0.8rem; color: var(--slate-500); margin-top: 0.35rem; background: #fff; padding: 0.4rem 0.6rem; border-radius: 6px; border: 1px dashed var(--slate-300);">📝 ${esc(pet.notas)}</div>` : ''}
            </div>
            <button type="button" class="btn btn-outline btn-sm btn-quick-book" data-pet-name="${esc(pet.nombre)}" style="font-size: 0.78rem; padding: 0.3rem 0.65rem;">
              Pedir Turno
            </button>
          </div>
        `).join('');

        petsContainer.querySelectorAll('.btn-quick-book').forEach(btn => {
          btn.addEventListener('click', () => {
            const petName = btn.getAttribute('data-pet-name');
            openBookingModal();
            const petInput = document.getElementById('bookingPetName');
            if (petInput) petInput.value = petName;
          });
        });
      }
    }

    // Turnos
    const turnos = window.vetDB.getTurnosDetallados().filter(t => t.cliente_id === currentClientId);
    if (appBadge) appBadge.textContent = turnos.length;

    if (appContainer) {
      if (turnos.length === 0) {
        appContainer.innerHTML = `<p style="color: var(--slate-500); font-size: 0.9rem;">No tenés turnos programados.</p>`;
      } else {
        appContainer.innerHTML = turnos.map(t => `
          <div style="background: var(--slate-50); border: 1px solid var(--slate-200); border-radius: var(--radius-md); padding: 1.1rem;">
            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 0.5rem;">
              <span class="badge-status badge-${esc(t.estado)}">${esc(t.estado)}</span>
              <span style="font-size: 0.78rem; color: var(--slate-500);">ID #${esc(t.id)}</span>
            </div>
            <div style="font-weight: 700; color: var(--slate-900); font-size: 0.95rem;">
              ${esc(t.servicio?.nombre || 'Servicio')}
            </div>
            <div style="font-size: 0.82rem; color: var(--slate-600); margin: 0.25rem 0;">
              🐶 Paciente: <strong>${esc(t.mascota?.nombre || 'Mascota')}</strong> (${esc(t.mascota?.raza || 'Común')})
            </div>
            <div style="font-size: 0.85rem; font-weight: 600; color: var(--primary-700); margin-top: 0.4rem;">
              🗓️ ${formatDate(t.fecha_hora)}
            </div>
            ${t.estado !== 'cancelado' ? `
              <div style="display: flex; gap: 0.5rem; margin-top: 0.75rem; padding-top: 0.5rem; border-top: 1px solid var(--slate-200);">
                <button type="button" class="btn btn-outline btn-sm btn-cancel-appointment" data-turno-id="${esc(t.id)}" style="font-size: 0.75rem; padding: 0.25rem 0.5rem; color: var(--danger);">
                  Cancelar turno
                </button>
              </div>
            ` : ''}
          </div>
        `).join('');

        appContainer.querySelectorAll('.btn-cancel-appointment').forEach(btn => {
          btn.addEventListener('click', () => {
            const tId = Number(btn.getAttribute('data-turno-id'));
            window.vetDB.update('turnos', tId, { estado: 'cancelado' });
            renderPortalMascotasYTurnos();
            showToast(`Turno #${tId} cancelado.`, 'info');
          });
        });
      }
    }
  };

  // ==========================================
  // HELPERS DE MODALES
  // ==========================================
  const openModal = (modalEl) => {
    if (modalEl) modalEl.classList.add('active');
    document.body.style.overflow = 'hidden';
  };

  const closeModal = (modalEl) => {
    if (modalEl) modalEl.classList.remove('active');
    document.body.style.overflow = '';
  };

  document.querySelectorAll('[data-close-modal]').forEach(btn => {
    btn.addEventListener('click', () => {
      const targetId = btn.getAttribute('data-close-modal');
      const targetEl = document.getElementById(targetId);
      if (targetEl) closeModal(targetEl);
    });
  });

  document.querySelectorAll('.modal-overlay').forEach(overlay => {
    overlay.addEventListener('click', (e) => {
      if (e.target === overlay) closeModal(overlay);
    });
  });

  // ==========================================
  // INICIALIZACIÓN DE LA APLICACIÓN
  // ==========================================
  // 1. Cargar carrito desde localStorage
  cart = loadCartFromStorage();
  updateCartUI();

  // 2. Cargar servicios veterinarios desde Supabase
  renderServices();

  // 3. Cargar catálogo de categorías y productos desde Supabase
  loadCatalog();

  // 4. Cargar portal inicial
  renderPortalMascotasYTurnos();

  // 5. Verificar parámetros de retorno de Mercado Pago
  verificarRetornoMercadoPago();
});
