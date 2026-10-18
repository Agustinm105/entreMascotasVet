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
  // PESTAÑAS DEL PORTAL CLIENTE (#portal - Fase 3)
  // Pestañas: 'datos', 'mascotas', 'turnos', 'pedidos'
  // ==========================================
  let currentPortalTab = 'datos';

  const activarTabPortal = (tabKey) => {
    currentPortalTab = tabKey;

    // Alternar botones
    document.querySelectorAll('.portal-tab-btn').forEach(btn => {
      const isTarget = btn.getAttribute('data-portal-tab') === tabKey;
      btn.classList.toggle('active', isTarget);
    });

    // Alternar paneles
    const panes = {
      datos: document.getElementById('tabPortalDatos'),
      mascotas: document.getElementById('tabPortalMascotas'),
      turnos: document.getElementById('tabPortalTurnos'),
      pedidos: document.getElementById('tabPortalPedidos')
    };

    Object.entries(panes).forEach(([k, pane]) => {
      if (pane) {
        pane.classList.toggle('active', k === tabKey);
      }
    });

    // Cargar contenido según pestaña
    if (tabKey === 'datos') {
      if (typeof renderPortalDatos === 'function') renderPortalDatos();
    } else if (tabKey === 'mascotas') {
      if (typeof renderPortalMascotas === 'function') renderPortalMascotas();
    } else if (tabKey === 'turnos') {
      if (typeof renderPortalTurnos === 'function') renderPortalTurnos();
    } else if (tabKey === 'pedidos') {
      if (typeof renderMisPedidos === 'function') renderMisPedidos();
    }
  };

  document.querySelectorAll('.portal-tab-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const tabKey = btn.getAttribute('data-portal-tab');
      if (tabKey) activarTabPortal(tabKey);
    });
  });

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
  // CONFIGURACIÓN DE HORARIOS DE ATENCIÓN (Fase 3)
  // Turnos cada 30 min, finalizan antes del cierre según duración del servicio
  // ==========================================
  const HORARIOS_CONFIG = {
    slotMinutes: 30,
    maxDiasFuturo: 60,
    dias: {
      0: null, // Domingo cerrado
      1: { inicio: '09:00', fin: '18:00' }, // Lunes
      2: { inicio: '09:00', fin: '18:00' }, // Martes
      3: { inicio: '09:00', fin: '18:00' }, // Miércoles
      4: { inicio: '09:00', fin: '18:00' }, // Jueves
      5: { inicio: '09:00', fin: '18:00' }, // Viernes
      6: { inicio: '09:00', fin: '13:00' }  // Sábado
    }
  };

  // Helper: cálculo de edad para mascotas (ej: "2 años y 3 meses")
  const calcularEdad = (fechaNacimiento) => {
    if (!fechaNacimiento) return 'Edad no indicada';
    try {
      const parts = fechaNacimiento.split('-');
      if (parts.length !== 3) return 'Edad no indicada';
      const birth = new Date(Number(parts[0]), Number(parts[1]) - 1, Number(parts[2]));
      const now = new Date();
      if (isNaN(birth.getTime()) || birth > now) return 'Recién nacido';

      let years = now.getFullYear() - birth.getFullYear();
      let months = now.getMonth() - birth.getMonth();
      let days = now.getDate() - birth.getDate();

      if (days < 0) {
        months -= 1;
      }
      if (months < 0) {
        years -= 1;
        months += 12;
      }

      if (years > 0) {
        if (months > 0) {
          const yStr = years === 1 ? '1 año' : `${years} años`;
          const mStr = months === 1 ? '1 mes' : `${months} meses`;
          return `${yStr} y ${mStr}`;
        }
        return years === 1 ? '1 año' : `${years} años`;
      } else if (months > 0) {
        return months === 1 ? '1 mes' : `${months} meses`;
      } else {
        return 'Menos de 1 mes';
      }
    } catch {
      return 'Edad no indicada';
    }
  };

  // Helpers de fecha en horario de Argentina (UTC-3)
  const getHoyArgentina = () => {
    const d = new Date();
    const formatter = new Intl.DateTimeFormat('en-CA', {
      timeZone: 'America/Argentina/Buenos_Aires',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit'
    });
    return formatter.format(d); // "YYYY-MM-DD"
  };

  const getMaxFechaArgentina = () => {
    const d = new Date();
    d.setDate(d.getDate() + HORARIOS_CONFIG.maxDiasFuturo);
    const formatter = new Intl.DateTimeFormat('en-CA', {
      timeZone: 'America/Argentina/Buenos_Aires',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit'
    });
    return formatter.format(d);
  };

  const getMinutosActualesArgentina = () => {
    const d = new Date();
    const formatter = new Intl.DateTimeFormat('es-AR', {
      timeZone: 'America/Argentina/Buenos_Aires',
      hour: '2-digit',
      minute: '2-digit',
      hour12: false
    });
    const [h, m] = formatter.format(d).split(':').map(Number);
    return (h * 60) + m;
  };

  // Caches locales para optimizar re-renders en el portal
  let cacheMisMascotas = [];
  let cacheMisTurnos = [];

  // Control de visibilidad del portal según sesión
  const actualizarPortalSegunAuth = async () => {
    const portalUnauth = document.getElementById('portalUnauthenticated');
    const portalAuth = document.getElementById('portalAuthenticated');
    const session = window.vetAuth ? window.vetAuth.obtenerSesion() : null;
    const perfil = window.vetAuth ? window.vetAuth.obtenerPerfil() : null;

    if (!session || !session.user) {
      if (portalUnauth) portalUnauth.style.display = 'block';
      if (portalAuth) portalAuth.style.display = 'none';
      return;
    }

    if (portalUnauth) portalUnauth.style.display = 'none';
    if (portalAuth) portalAuth.style.display = 'block';

    // Actualizar encabezado del portal con nombre y correo
    const clientTitle = document.getElementById('currentClientTitle');
    const clientSub = document.getElementById('currentClientSub');

    let nombre = perfil?.nombre ? (perfil.nombre + (perfil.apellido ? ' ' + perfil.apellido : '')) : '';
    if (!nombre) {
      nombre = session.user.user_metadata?.full_name || session.user.email?.split('@')[0] || 'Cliente';
    }
    const email = perfil?.email || session.user.email || '';
    const tel = perfil?.telefono ? ` | Tel: ${perfil.telefono}` : '';

    if (clientTitle) clientTitle.textContent = `Cliente: ${nombre}`;
    if (clientSub) clientSub.textContent = `${email}${tel}`;

    actualizarAlertaDatosIncompletos(perfil);
    activarTabPortal(currentPortalTab);
    actualizarContadoresPortal();
  };

  const actualizarAlertaDatosIncompletos = (perfil) => {
    const alertEl = document.getElementById('datosIncompleteAlert');
    if (!alertEl) return;
    const faltaTel = !perfil?.telefono || !perfil.telefono.trim();
    const faltaDir = !perfil?.direccion || !perfil.direccion.trim();
    alertEl.style.display = (faltaTel || faltaDir) ? 'flex' : 'none';
  };

  const actualizarContadoresPortal = async () => {
    const session = window.vetAuth ? window.vetAuth.obtenerSesion() : null;
    if (!session || !session.user) return;

    try {
      const [mascotasRes, turnosRes, pedidosRes] = await Promise.all([
        window.vetApi.getMisMascotas(),
        window.vetApi.getMisTurnos(),
        window.vetApi.getMisPedidos()
      ]);

      const petsCount = document.getElementById('portalPetsCount');
      if (petsCount && mascotasRes.data) petsCount.textContent = mascotasRes.data.length;

      const turnosCount = document.getElementById('portalAppointmentsCount');
      if (turnosCount && turnosRes.data) turnosCount.textContent = turnosRes.data.length;

      const ordersCount = document.getElementById('portalOrdersCount');
      if (ordersCount && pedidosRes.data) ordersCount.textContent = pedidosRes.data.length;
    } catch (e) {
      console.warn('[actualizarContadoresPortal] Error:', e);
    }
  };

  // Botón de login desde la tarjeta unauthenticated del portal
  const btnPortalGoogleLogin = document.getElementById('btnPortalGoogleLogin');
  if (btnPortalGoogleLogin) {
    btnPortalGoogleLogin.addEventListener('click', () => {
      window.vetAuth?.loginConGoogle();
    });
  }

  // ==========================================
  // SECCIÓN 2: MIS DATOS (perfiles)
  // ==========================================
  const renderPortalDatos = () => {
    const perfil = window.vetAuth ? window.vetAuth.obtenerPerfil() : null;
    const session = window.vetAuth ? window.vetAuth.obtenerSesion() : null;

    const inputNombre = document.getElementById('profileNombre');
    const inputApellido = document.getElementById('profileApellido');
    const inputTelefono = document.getElementById('profileTelefono');
    const inputEmail = document.getElementById('profileEmail');
    const inputDireccion = document.getElementById('profileDireccion');

    if (inputEmail) {
      inputEmail.value = perfil?.email || session?.user?.email || '';
    }
    if (inputNombre) {
      inputNombre.value = perfil?.nombre || '';
    }
    if (inputApellido) {
      inputApellido.value = perfil?.apellido || '';
    }
    if (inputTelefono) {
      inputTelefono.value = perfil?.telefono || '';
    }
    if (inputDireccion) {
      inputDireccion.value = perfil?.direccion || '';
    }

    actualizarAlertaDatosIncompletos(perfil);
  };

  const profileForm = document.getElementById('profileForm');
  if (profileForm) {
    profileForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      const session = window.vetAuth ? window.vetAuth.obtenerSesion() : null;
      if (!session || !session.user) {
        showToast('Debés iniciar sesión para actualizar tus datos.', 'warning');
        return;
      }

      const btnSubmit = document.getElementById('btnSaveProfile');
      if (btnSubmit) {
        btnSubmit.disabled = true;
        btnSubmit.textContent = '💾 Guardando...';
      }

      const updates = {
        nombre: document.getElementById('profileNombre')?.value.trim() || null,
        apellido: document.getElementById('profileApellido')?.value.trim() || null,
        telefono: document.getElementById('profileTelefono')?.value.trim() || null,
        direccion: document.getElementById('profileDireccion')?.value.trim() || null
      };

      const { data: updated, error } = await window.vetApi.actualizarPerfil(session.user.id, updates);

      if (btnSubmit) {
        btnSubmit.disabled = false;
        btnSubmit.textContent = '💾 Guardar Cambios';
      }

      if (error) {
        showToast('No se pudieron actualizar los datos: ' + (error.message || 'Error desconocido'), 'danger');
        return;
      }

      if (window.vetAuth) {
        window.vetAuth.perfil = updated || { ...window.vetAuth.perfil, ...updates };
      }

      actualizarAlertaDatosIncompletos(window.vetAuth?.perfil);

      const clientTitle = document.getElementById('currentClientTitle');
      const clientSub = document.getElementById('currentClientSub');
      let fullName = [updates.nombre, updates.apellido].filter(Boolean).join(' ');
      if (!fullName) fullName = session.user.email?.split('@')[0] || 'Cliente';
      if (clientTitle) clientTitle.textContent = `Cliente: ${fullName}`;
      if (clientSub) clientSub.textContent = `${session.user.email}${updates.telefono ? ' | Tel: ' + updates.telefono : ''}`;

      showToast('Tus datos fueron actualizados correctamente.', 'success');
    });
  }

  // ==========================================
  // SECCIÓN 3: FICHA DE MASCOTAS (tabla mascotas)
  // ==========================================
  const modalPetForm = document.getElementById('modalPetForm');
  const petForm = document.getElementById('petForm');

  const openPetModal = (petToEdit = null) => {
    if (!modalPetForm || !petForm) return;

    const session = window.vetAuth ? window.vetAuth.obtenerSesion() : null;
    if (!session || !session.user) {
      showToast('Iniciá sesión para registrar una mascota.', 'info');
      window.vetAuth?.loginConGoogle();
      return;
    }

    const titleEl = document.getElementById('modalPetFormTitle');
    const idInput = document.getElementById('petFormId');
    const nombreInput = document.getElementById('petFormNombre');
    const especieSelect = document.getElementById('petFormEspecie');
    const razaInput = document.getElementById('petFormRaza');
    const sexoSelect = document.getElementById('petFormSexo');
    const fechaInput = document.getElementById('petFormFechaNacimiento');
    const pesoInput = document.getElementById('petFormPesoKg');
    const castradoSelect = document.getElementById('petFormCastrado');
    const notasInput = document.getElementById('petFormNotas');

    if (fechaInput) {
      fechaInput.max = getHoyArgentina();
    }

    if (petToEdit) {
      if (titleEl) titleEl.textContent = `Editar Mascota: ${petToEdit.nombre}`;
      if (idInput) idInput.value = petToEdit.id;
      if (nombreInput) nombreInput.value = petToEdit.nombre || '';
      if (especieSelect) especieSelect.value = petToEdit.especie || 'perro';
      if (razaInput) razaInput.value = petToEdit.raza || '';
      if (sexoSelect) sexoSelect.value = petToEdit.sexo || '';
      if (fechaInput) fechaInput.value = petToEdit.fecha_nacimiento || '';
      if (pesoInput) pesoInput.value = petToEdit.peso_kg || '';
      if (castradoSelect) {
        if (petToEdit.castrado === true) castradoSelect.value = 'true';
        else if (petToEdit.castrado === false) castradoSelect.value = 'false';
        else castradoSelect.value = '';
      }
      if (notasInput) notasInput.value = petToEdit.notas || '';
    } else {
      if (titleEl) titleEl.textContent = 'Registrar Nueva Mascota';
      petForm.reset();
      if (idInput) idInput.value = '';
    }

    openModal(modalPetForm);
  };

  const renderPortalMascotas = async () => {
    const container = document.getElementById('portalPetsContainer');
    if (!container) return;

    const session = window.vetAuth ? window.vetAuth.obtenerSesion() : null;
    if (!session || !session.user) {
      container.innerHTML = `<p style="color: var(--slate-500); font-size: 0.9rem;">Iniciá sesión para ver tus mascotas.</p>`;
      return;
    }

    container.innerHTML = `
      <div class="loading-state">
        <span class="loading-spinner"></span>
        <p>Cargando fichas de mascotas...</p>
      </div>
    `;

    const [mascotasRes, turnosRes] = await Promise.all([
      window.vetApi.getMisMascotas(),
      window.vetApi.getMisTurnos()
    ]);

    if (mascotasRes.error) {
      container.innerHTML = `
        <div class="error-state">
          <p>No pudimos cargar tus mascotas.</p>
          <button type="button" class="btn btn-outline btn-sm" id="btnRetryPets">🔄 Reintentar</button>
        </div>
      `;
      document.getElementById('btnRetryPets')?.addEventListener('click', renderPortalMascotas);
      return;
    }

    cacheMisMascotas = mascotasRes.data || [];
    cacheMisTurnos = turnosRes.data || [];

    const countBadge = document.getElementById('portalPetsCount');
    if (countBadge) countBadge.textContent = cacheMisMascotas.length;

    if (cacheMisMascotas.length === 0) {
      container.innerHTML = `
        <div class="empty-state">
          <div style="font-size: 2.2rem; margin-bottom: 0.5rem;">🐾</div>
          <p style="font-size: 1rem; font-weight: 600; color: var(--slate-700); margin-bottom: 0.35rem;">No tenés mascotas registradas aún</p>
          <p style="color: var(--slate-500); font-size: 0.88rem; margin-bottom: 1rem;">Registrá a tu compañero para pedir turnos y llevar su historial médico.</p>
          <button type="button" class="btn btn-primary btn-sm btn-open-add-pet">➕ Registrar mi primera mascota</button>
        </div>
      `;
      container.querySelector('.btn-open-add-pet')?.addEventListener('click', () => openPetModal());
      return;
    }

    const now = new Date();

    container.innerHTML = `
      <div class="pets-grid">
        ${cacheMisMascotas.map(pet => {
          const especieIcon = pet.especie === 'perro' ? '🐕' : (pet.especie === 'gato' ? '🐈' : '🐾');
          const edadTexto = calcularEdad(pet.fecha_nacimiento);

          const proximos = cacheMisTurnos.filter(t => {
            if (t.mascota_id !== pet.id) return false;
            if (t.estado === 'cancelado') return false;
            return new Date(t.fecha_hora) >= now;
          }).sort((a, b) => new Date(a.fecha_hora) - new Date(b.fecha_hora));

          let castradoTexto = 'No sé';
          if (pet.castrado === true) castradoTexto = 'Sí';
          else if (pet.castrado === false) castradoTexto = 'No';

          return `
            <article class="pet-card">
              <div class="pet-card-header">
                <div class="pet-avatar-icon">${especieIcon}</div>
                <div class="pet-title-box">
                  <h4 class="pet-name">${esc(pet.nombre)}</h4>
                  <div class="pet-subtitle">
                    ${esc(pet.especie.toUpperCase())} ${pet.raza ? `· ${esc(pet.raza)}` : ''}
                  </div>
                </div>
              </div>

              <div class="pet-details-grid">
                <div class="pet-detail-item">
                  <span class="detail-label">Edad</span>
                  <span class="detail-value">${esc(edadTexto)}</span>
                </div>
                <div class="pet-detail-item">
                  <span class="detail-label">Sexo</span>
                  <span class="detail-value">${esc(pet.sexo ? (pet.sexo === 'macho' ? 'Macho' : 'Hembra') : 'No indicado')}</span>
                </div>
                <div class="pet-detail-item">
                  <span class="detail-label">Peso aprox.</span>
                  <span class="detail-value">${pet.peso_kg ? `${esc(pet.peso_kg)} kg` : 'No indicado'}</span>
                </div>
                <div class="pet-detail-item">
                  <span class="detail-label">Castrado/a</span>
                  <span class="detail-value">${esc(castradoTexto)}</span>
                </div>
              </div>

              ${pet.notas ? `
                <div class="pet-notes">
                  <strong>📝 Notas / Alergias:</strong> ${esc(pet.notas)}
                </div>
              ` : ''}

              <div class="pet-appointments-section">
                <div class="pet-appointments-title">🗓️ Próximos turnos:</div>
                ${proximos.length > 0 ? `
                  <ul class="pet-appointments-list">
                    ${proximos.map(t => `
                      <li class="pet-appointment-chip">
                        <strong>${esc(t.servicios?.nombre || 'Consulta')}:</strong>
                        ${formatDate(t.fecha_hora)}
                        <span class="badge-status badge-${esc(t.estado)}" style="font-size: 0.7rem; padding: 0.1rem 0.35rem;">${esc(t.estado)}</span>
                      </li>
                    `).join('')}
                  </ul>
                ` : `
                  <div class="pet-no-appointments">Sin turnos pendientes programados.</div>
                `}
              </div>

              <div class="pet-card-actions">
                <button type="button" class="btn btn-outline btn-sm btn-quick-book-pet" data-pet-id="${esc(pet.id)}">
                  📅 Pedir Turno
                </button>
                <div style="display: flex; gap: 0.4rem;">
                  <button type="button" class="btn btn-outline btn-sm btn-edit-pet" data-pet-id="${esc(pet.id)}" title="Editar ficha">
                    ✏️ Editar
                  </button>
                  <button type="button" class="btn btn-outline btn-sm btn-delete-pet" data-pet-id="${esc(pet.id)}" data-pet-name="${esc(pet.nombre)}" title="Eliminar ficha" style="color: var(--danger);">
                    🗑️
                  </button>
                </div>
              </div>
            </article>
          `;
        }).join('')}
      </div>
    `;

    // Eventos de botones en tarjetas
    container.querySelectorAll('.btn-quick-book-pet').forEach(btn => {
      btn.addEventListener('click', () => {
        const petId = btn.getAttribute('data-pet-id');
        openBookingModal(null, petId);
      });
    });

    container.querySelectorAll('.btn-edit-pet').forEach(btn => {
      btn.addEventListener('click', () => {
        const petId = btn.getAttribute('data-pet-id');
        const pet = cacheMisMascotas.find(m => String(m.id) === String(petId));
        if (pet) openPetModal(pet);
      });
    });

    container.querySelectorAll('.btn-delete-pet').forEach(btn => {
      btn.addEventListener('click', async () => {
        const petId = btn.getAttribute('data-pet-id');
        const petName = btn.getAttribute('data-pet-name') || 'esta mascota';
        const confirma = confirm(`¿Estás seguro de que querés eliminar la ficha de ${petName}?`);
        if (!confirma) return;

        btn.disabled = true;
        const { error } = await window.vetApi.eliminarMascota(petId);
        if (error) {
          btn.disabled = false;
          const msg = String(error.message || '');
          if (msg.includes('turnos asociados') || error.code === '23503') {
            showToast('No se puede eliminar porque tiene turnos asociados', 'danger');
          } else {
            showToast(msg || 'Error al eliminar mascota', 'danger');
          }
          return;
        }

        showToast(`Ficha de "${petName}" eliminada correctamente.`, 'info');
        await Promise.all([renderPortalMascotas(), renderPortalTurnos()]);
      });
    });
  };

  // Submit de ficha de mascota (alta o edición)
  if (petForm) {
    petForm.addEventListener('submit', async (e) => {
      e.preventDefault();

      const idVal = document.getElementById('petFormId')?.value;
      const nombre = document.getElementById('petFormNombre')?.value.trim();
      const especie = document.getElementById('petFormEspecie')?.value;
      const raza = document.getElementById('petFormRaza')?.value.trim() || null;
      const sexo = document.getElementById('petFormSexo')?.value || null;
      const fechaNac = document.getElementById('petFormFechaNacimiento')?.value || null;
      const pesoVal = document.getElementById('petFormPesoKg')?.value;
      const castradoVal = document.getElementById('petFormCastrado')?.value;
      const notas = document.getElementById('petFormNotas')?.value.trim() || null;

      if (!nombre) {
        showToast('El nombre de la mascota es obligatorio.', 'warning');
        return;
      }

      if (!especie || !['perro', 'gato', 'otro'].includes(especie)) {
        showToast('La especie es obligatoria (perro, gato u otro).', 'warning');
        return;
      }

      if (fechaNac && fechaNac > getHoyArgentina()) {
        showToast('La fecha de nacimiento no puede ser futura.', 'warning');
        return;
      }

      let pesoKg = null;
      if (pesoVal !== '' && pesoVal !== undefined && pesoVal !== null) {
        pesoKg = Number(pesoVal);
        if (isNaN(pesoKg) || pesoKg <= 0) {
          showToast('El peso debe ser mayor a 0 kg.', 'warning');
          return;
        }
      }

      let castrado = null;
      if (castradoVal === 'true') castrado = true;
      else if (castradoVal === 'false') castrado = false;

      const petData = {
        nombre,
        especie,
        raza,
        sexo,
        fecha_nacimiento: fechaNac,
        peso_kg: pesoKg,
        castrado,
        notas
      };

      const btnSave = document.getElementById('btnSavePet');
      if (btnSave) {
        btnSave.disabled = true;
        btnSave.textContent = 'Guardando...';
      }

      let result;
      if (idVal) {
        result = await window.vetApi.actualizarMascota(idVal, petData);
      } else {
        result = await window.vetApi.crearMascota(petData);
      }

      if (btnSave) {
        btnSave.disabled = false;
        btnSave.textContent = 'Guardar Mascota';
      }

      if (result.error) {
        showToast('Error al guardar mascota: ' + (result.error.message || 'Error desconocido'), 'danger');
        return;
      }

      closeModal(modalPetForm);
      petForm.reset();
      showToast(idVal ? 'Mascota actualizada correctamente.' : `Mascota "${nombre}" registrada con éxito.`, 'success');

      await Promise.all([renderPortalMascotas(), renderPortalTurnos()]);

      // Si el modal de reserva está abierto, actualizar su select de mascotas y preseleccionar la recién creada
      if (modalBooking && modalBooking.classList.contains('active')) {
        await popularSelectMascotasBooking(result.data?.id);
      }
    });
  }

  // Delegación de botones para abrir alta de mascota
  document.querySelectorAll('.btn-open-add-pet').forEach(btn => {
    btn.addEventListener('click', () => openPetModal());
  });

  // ==========================================
  // SECCIÓN 4: RESERVA DE TURNOS (modalBooking)
  // ==========================================
  const modalBooking = document.getElementById('modalBooking');
  const bookingForm = document.getElementById('bookingForm');
  const btnHeroReserve = document.getElementById('btnHeroReserve');
  const btnMainBooking = document.getElementById('btnMainBooking');
  const btnPortalNewBooking = document.getElementById('btnPortalNewBooking');

  const popularSelectMascotasBooking = async (preselectId = null) => {
    const select = document.getElementById('bookingPetSelect');
    const noticeNoPets = document.getElementById('bookingPetNoticeNoPets');
    const btnConfirm = document.getElementById('btnConfirmBooking');
    if (!select) return;

    const { data: mascotas } = await window.vetApi.getMisMascotas();
    const list = mascotas || [];

    if (list.length === 0) {
      if (noticeNoPets) noticeNoPets.style.display = 'block';
      select.innerHTML = `
        <option value="">-- No tenés mascotas registradas --</option>
        <option value="new">➕ Registrar una mascota nueva...</option>
      `;
      if (btnConfirm) btnConfirm.disabled = true;
    } else {
      if (noticeNoPets) noticeNoPets.style.display = 'none';
      if (btnConfirm) btnConfirm.disabled = false;
      select.innerHTML = `
        <option value="">Seleccioná tu mascota...</option>
        ${list.map(m => `
          <option value="${esc(m.id)}" ${String(preselectId) === String(m.id) ? 'selected' : ''}>
            ${esc(m.nombre)} (${esc(m.especie)}${m.raza ? ` · ${esc(m.raza)}` : ''})
          </option>
        `).join('')}
        <option value="new">➕ Agregar una mascota nueva...</option>
      `;
    }
  };

  const calcularHorariosDisponibles = async () => {
    const serviceSelect = document.getElementById('bookingServiceSelect');
    const dateInput = document.getElementById('bookingDate');
    const timeSelect = document.getElementById('bookingTimeSelect');
    const serviceInfo = document.getElementById('bookingServiceInfo');
    if (!serviceSelect || !dateInput || !timeSelect) return;

    const serviceId = serviceSelect.value;
    const fecha = dateInput.value;

    if (!serviceId || !fecha) {
      timeSelect.innerHTML = '<option value="">Primero seleccioná servicio y fecha...</option>';
      timeSelect.disabled = true;
      if (serviceInfo) serviceInfo.textContent = '';
      return;
    }

    const service = catalogServices.find(s => String(s.id) === String(serviceId));
    const duracionMin = service ? Number(service.duracion_min) : 30;

    if (serviceInfo && service) {
      serviceInfo.textContent = `⏱️ Duración: ${duracionMin} min · Precio: ${formatCurrency(service.precio)}`;
    }

    timeSelect.disabled = true;
    timeSelect.innerHTML = '<option value="">Consultando disponibilidad...</option>';

    // Determinar día de la semana en la fecha elegida (UTC noon evita desfasajes de zona horaria)
    const [y, m, d] = fecha.split('-').map(Number);
    const dateObj = new Date(Date.UTC(y, m - 1, d, 12, 0, 0));
    const dayOfWeek = dateObj.getUTCDay();

    const dayConfig = HORARIOS_CONFIG.dias[dayOfWeek];
    if (!dayConfig) {
      timeSelect.innerHTML = '<option value="" disabled selected>Domingos cerrado. Elegí otra fecha.</option>';
      timeSelect.disabled = true;
      return;
    }

    // Consulta RPC a Supabase horarios_ocupados
    const { data: ocupadosIsoList } = await window.vetApi.getHorariosOcupados(serviceId, fecha);

    const ocupadosSet = new Set();
    (ocupadosIsoList || []).forEach(iso => {
      try {
        const dObj = new Date(iso);
        const formatter = new Intl.DateTimeFormat('es-AR', {
          timeZone: 'America/Argentina/Buenos_Aires',
          hour: '2-digit',
          minute: '2-digit',
          hour12: false
        });
        ocupadosSet.add(formatter.format(dObj));
      } catch (e) {
        console.warn('Error al formatear ocupado:', iso, e);
      }
    });

    const toMin = (hhmm) => {
      const [h, min] = hhmm.split(':').map(Number);
      return (h * 60) + min;
    };

    const toHhmm = (minutos) => {
      const h = Math.floor(minutos / 60);
      const min = minutos % 60;
      return `${String(h).padStart(2, '0')}:${String(min).padStart(2, '0')}`;
    };

    const inicioMin = toMin(dayConfig.inicio);
    const finMin = toMin(dayConfig.fin);
    const slotStep = HORARIOS_CONFIG.slotMinutes;

    const hoyArgentina = getHoyArgentina();
    const esHoy = fecha === hoyArgentina;
    const minutosActuales = esHoy ? getMinutosActualesArgentina() : -1;

    const slots = [];
    // Los turnos inician cada 30 min y deben terminar antes del cierre según la duración del servicio
    for (let start = inicioMin; start + duracionMin <= finMin; start += slotStep) {
      const horaStr = toHhmm(start);
      const yaPaso = esHoy && (start <= minutosActuales);
      const estaOcupado = ocupadosSet.has(horaStr);

      slots.push({
        hora: horaStr,
        disponible: !yaPaso && !estaOcupado,
        razon: yaPaso ? 'Pasado' : (estaOcupado ? 'Ocupado' : null)
      });
    }

    if (slots.length === 0) {
      timeSelect.innerHTML = '<option value="" disabled selected>No hay horarios que cubran la duración del servicio hoy.</option>';
      timeSelect.disabled = true;
      return;
    }

    const disponiblesCount = slots.filter(s => s.disponible).length;

    let optionsHtml = `<option value="">Seleccioná un horario (${disponiblesCount} disponibles)...</option>`;
    slots.forEach(s => {
      if (s.disponible) {
        optionsHtml += `<option value="${esc(s.hora)}">${esc(s.hora)} hs</option>`;
      } else {
        optionsHtml += `<option value="${esc(s.hora)}" disabled>${esc(s.hora)} hs (${esc(s.razon)})</option>`;
      }
    });

    timeSelect.innerHTML = optionsHtml;
    timeSelect.disabled = false;
  };

  const openBookingModal = async (preselectedServiceId = null, preselectedPetId = null) => {
    const session = window.vetAuth ? window.vetAuth.obtenerSesion() : null;
    const perfil = window.vetAuth ? window.vetAuth.obtenerPerfil() : null;

    if (!session || !session.user) {
      if (preselectedServiceId) {
        sessionStorage.setItem('vet_pending_booking_service', String(preselectedServiceId));
      }
      showToast('Iniciá sesión con Google para agendar un turno.', 'info');
      window.vetAuth?.loginConGoogle();
      return;
    }

    // Datos del tutor
    const tutorNameEl = document.getElementById('bookingTutorName');
    const tutorEmailEl = document.getElementById('bookingTutorEmail');
    let tutorNombre = [perfil?.nombre, perfil?.apellido].filter(Boolean).join(' ');
    if (!tutorNombre) tutorNombre = session.user.user_metadata?.full_name || session.user.email?.split('@')[0] || 'Tutor';
    if (tutorNameEl) tutorNameEl.textContent = tutorNombre;
    if (tutorEmailEl) tutorEmailEl.textContent = perfil?.email || session.user.email || '';

    // Si falta el teléfono en el perfil, pedirlo en el modal
    const phoneGroup = document.getElementById('bookingPhoneGroup');
    const phoneInput = document.getElementById('bookingPhone');
    if (phoneGroup && phoneInput) {
      if (!perfil?.telefono || !perfil.telefono.trim()) {
        phoneGroup.style.display = 'block';
        phoneInput.required = true;
        phoneInput.value = '';
      } else {
        phoneGroup.style.display = 'none';
        phoneInput.required = false;
        phoneInput.value = perfil.telefono;
      }
    }

    // Restricciones de fecha: hoy a +60 días
    const dateInput = document.getElementById('bookingDate');
    const minDate = getHoyArgentina();
    const maxDate = getMaxFechaArgentina();
    if (dateInput) {
      dateInput.min = minDate;
      dateInput.max = maxDate;
      if (!dateInput.value || dateInput.value < minDate || dateInput.value > maxDate) {
        dateInput.value = minDate;
      }
    }

    // Cargar opciones de servicios
    const serviceSelect = document.getElementById('bookingServiceSelect');
    if (serviceSelect && (serviceSelect.options.length <= 1 || catalogServices.length > 0)) {
      serviceSelect.innerHTML = catalogServices.map(s => `
        <option value="${esc(s.id)}">${esc(s.nombre)} (${esc(s.duracion_min)} min - ${formatCurrency(s.precio)})</option>
      `).join('');
    }

    if (preselectedServiceId && serviceSelect) {
      serviceSelect.value = preselectedServiceId;
    }

    // Cargar mascotas del usuario
    await popularSelectMascotasBooking(preselectedPetId);

    // Calcular horarios según servicio y fecha
    await calcularHorariosDisponibles();

    openModal(modalBooking);
  };

  const bookingPetSelect = document.getElementById('bookingPetSelect');
  if (bookingPetSelect) {
    bookingPetSelect.addEventListener('change', () => {
      if (bookingPetSelect.value === 'new') {
        openPetModal();
      }
    });
  }

  const bookingServiceSelect = document.getElementById('bookingServiceSelect');
  if (bookingServiceSelect) {
    bookingServiceSelect.addEventListener('change', calcularHorariosDisponibles);
  }

  const bookingDate = document.getElementById('bookingDate');
  if (bookingDate) {
    bookingDate.addEventListener('change', calcularHorariosDisponibles);
  }

  if (btnHeroReserve) btnHeroReserve.addEventListener('click', () => openBookingModal());
  if (btnMainBooking) btnMainBooking.addEventListener('click', () => openBookingModal());
  if (btnPortalNewBooking) btnPortalNewBooking.addEventListener('click', () => openBookingModal());
  document.querySelectorAll('.btn-open-booking-direct').forEach(btn => {
    btn.addEventListener('click', () => openBookingModal());
  });

  // Submit de reserva de turno
  if (bookingForm) {
    bookingForm.addEventListener('submit', async (e) => {
      e.preventDefault();

      const session = window.vetAuth ? window.vetAuth.obtenerSesion() : null;
      const perfil = window.vetAuth ? window.vetAuth.obtenerPerfil() : null;

      if (!session || !session.user) {
        showToast('Debés iniciar sesión para reservar un turno.', 'warning');
        window.vetAuth?.loginConGoogle();
        return;
      }

      const mascotaId = document.getElementById('bookingPetSelect')?.value;
      const servicioId = document.getElementById('bookingServiceSelect')?.value;
      const fecha = document.getElementById('bookingDate')?.value;
      const hora = document.getElementById('bookingTimeSelect')?.value;
      const notas = document.getElementById('bookingNotes')?.value.trim();

      if (!mascotaId || mascotaId === 'new') {
        showToast('Por favor seleccioná o registrá una mascota.', 'warning');
        return;
      }

      if (!servicioId) {
        showToast('Por favor seleccioná un servicio.', 'warning');
        return;
      }

      if (!fecha || !hora) {
        showToast('Por favor seleccioná fecha y horario disponible.', 'warning');
        return;
      }

      // Guardar teléfono en perfil si faltaba
      const phoneInput = document.getElementById('bookingPhone');
      if (phoneInput && (!perfil?.telefono || !perfil.telefono.trim())) {
        const phoneVal = phoneInput.value.trim();
        if (!phoneVal) {
          showToast('Por favor completá un teléfono de contacto.', 'warning');
          phoneInput.focus();
          return;
        }
        await window.vetApi.actualizarPerfil(session.user.id, { telefono: phoneVal });
        if (window.vetAuth && window.vetAuth.perfil) {
          window.vetAuth.perfil.telefono = phoneVal;
        }
      }

      // Armar fecha_hora como ISO 8601 con offset -03:00 (hora de Argentina), no con la zona del navegador
      const fechaHora = `${fecha}T${hora}:00-03:00`;

      const btnConfirm = document.getElementById('btnConfirmBooking');
      if (btnConfirm) {
        btnConfirm.disabled = true;
        btnConfirm.textContent = '⏳ Reservando...';
      }

      const { error } = await window.vetApi.crearTurno({
        mascotaId,
        servicioId,
        fechaHora,
        notas
      });

      if (btnConfirm) {
        btnConfirm.disabled = false;
        btnConfirm.textContent = '📅 Confirmar Reserva de Turno';
      }

      if (error) {
        const errorMsg = String(error.message || '');
        if (error.code === '23505' || errorMsg.includes('turnos_horario_unico') || errorMsg.includes('se acaba de ocupar')) {
          showToast('Ese horario se acaba de ocupar, elegí otro', 'danger');
        } else {
          showToast(errorMsg || 'No se pudo reservar el turno. Probá nuevamente.', 'danger');
        }
        await calcularHorariosDisponibles();
        return;
      }

      closeModal(modalBooking);
      bookingForm.reset();
      showToast('Turno reservado. Te vamos a confirmar a la brevedad', 'success');

      await Promise.all([renderPortalTurnos(), renderPortalMascotas()]);
      activarTabPortal('turnos');
    });
  }

  // ==========================================
  // SECCIÓN 5: MIS TURNOS (turnos)
  // ==========================================
  const renderPortalTurnos = async () => {
    const container = document.getElementById('portalAppointmentsContainer');
    if (!container) return;

    const session = window.vetAuth ? window.vetAuth.obtenerSesion() : null;
    if (!session || !session.user) {
      container.innerHTML = `<p style="color: var(--slate-500); font-size: 0.9rem;">Iniciá sesión para ver tus turnos.</p>`;
      return;
    }

    container.innerHTML = `
      <div class="loading-state">
        <span class="loading-spinner"></span>
        <p>Cargando tus turnos...</p>
      </div>
    `;

    const { data: turnos, error } = await window.vetApi.getMisTurnos();

    if (error) {
      container.innerHTML = `
        <div class="error-state">
          <p>No pudimos cargar tus turnos en este momento.</p>
          <button type="button" class="btn btn-outline btn-sm" id="btnRetryTurnos">🔄 Reintentar</button>
        </div>
      `;
      document.getElementById('btnRetryTurnos')?.addEventListener('click', renderPortalTurnos);
      return;
    }

    const list = turnos || [];
    cacheMisTurnos = list;

    const countBadge = document.getElementById('portalAppointmentsCount');
    if (countBadge) countBadge.textContent = list.length;

    if (list.length === 0) {
      container.innerHTML = `
        <div class="empty-state">
          <div style="font-size: 2.2rem; margin-bottom: 0.5rem;">🗓️</div>
          <p style="font-size: 1rem; font-weight: 600; color: var(--slate-700); margin-bottom: 0.35rem;">No tenés turnos programados ni historial</p>
          <p style="color: var(--slate-500); font-size: 0.88rem; margin-bottom: 1rem;">Agendá una consulta médica veterinaria o servicio de peluquería para tu mascota.</p>
          <button type="button" class="btn btn-primary btn-sm btn-open-booking-direct">📅 Agendar un Turno</button>
        </div>
      `;
      container.querySelector('.btn-open-booking-direct')?.addEventListener('click', () => openBookingModal());
      return;
    }

    const now = new Date();

    // Próximos primero y luego historial
    const proximos = list
      .filter(t => t.estado !== 'cancelado' && new Date(t.fecha_hora) >= now)
      .sort((a, b) => new Date(a.fecha_hora) - new Date(b.fecha_hora));

    const historial = list
      .filter(t => t.estado === 'cancelado' || new Date(t.fecha_hora) < now)
      .sort((a, b) => new Date(b.fecha_hora) - new Date(a.fecha_hora));

    const renderTurnoCard = (t, esProximo) => {
      const isFuture = new Date(t.fecha_hora) >= now;
      const canCancel = esProximo && isFuture && (t.estado === 'reservado' || t.estado === 'confirmado');

      const badgeLabel = {
        reservado: 'Reservado',
        confirmado: 'Confirmado',
        realizado: 'Realizado',
        cancelado: 'Cancelado'
      }[t.estado] || t.estado;

      return `
        <article class="appointment-card" data-appointment-id="${esc(t.id)}">
          <div class="appointment-header">
            <div>
              <span class="badge-status badge-${esc(t.estado)}">${esc(badgeLabel)}</span>
            </div>
            <span class="appointment-id">Turno #${esc(t.id)}</span>
          </div>

          <div class="appointment-service-name">
            ${esc(t.servicios?.icono || '🩺')} ${esc(t.servicios?.nombre || 'Servicio Veterinario')}
          </div>

          <div class="appointment-pet-info">
            🐾 Paciente: <strong>${esc(t.mascotas?.nombre || 'Mascota')}</strong>
            ${t.mascotas?.especie ? `(${esc(t.mascotas.especie)}${t.mascotas.raza ? ` · ${esc(t.mascotas.raza)}` : ''})` : ''}
          </div>

          <div class="appointment-time">
            🗓️ ${formatDate(t.fecha_hora)}
          </div>

          ${t.notas ? `
            <div class="appointment-notes">
              <strong>Motivo / Notas:</strong> ${esc(t.notas)}
            </div>
          ` : ''}

          ${canCancel ? `
            <div class="appointment-actions">
              <button type="button" class="btn btn-outline btn-sm btn-cancel-turno" data-turno-id="${esc(t.id)}">
                ❌ Cancelar turno
              </button>
            </div>
          ` : ''}
        </article>
      `;
    };

    container.innerHTML = `
      ${proximos.length > 0 ? `
        <div style="margin-bottom: 2rem;">
          <h4 style="font-size: 1rem; font-weight: 700; color: var(--slate-800); margin-bottom: 0.85rem; display: flex; align-items: center; gap: 0.5rem;">
            <span>🟢</span> Próximos Turnos (${proximos.length})
          </h4>
          <div class="appointments-grid">
            ${proximos.map(t => renderTurnoCard(t, true)).join('')}
          </div>
        </div>
      ` : `
        <div style="background: var(--slate-50); border: 1px dashed var(--slate-300); padding: 1.25rem; border-radius: var(--radius-md); margin-bottom: 2rem; text-align: center;">
          <p style="color: var(--slate-600); font-size: 0.9rem; margin-bottom: 0.6rem;">No tenés turnos activos próximos.</p>
          <button type="button" class="btn btn-primary btn-sm btn-open-booking-direct">📅 Solicitar un Turno</button>
        </div>
      `}

      ${historial.length > 0 ? `
        <div>
          <h4 style="font-size: 1rem; font-weight: 700; color: var(--slate-700); margin-bottom: 0.85rem; display: flex; align-items: center; gap: 0.5rem;">
            <span>📋</span> Historial de Turnos (${historial.length})
          </h4>
          <div class="appointments-grid">
            ${historial.map(t => renderTurnoCard(t, false)).join('')}
          </div>
        </div>
      ` : ''}
    `;

    container.querySelectorAll('.btn-open-booking-direct').forEach(btn => {
      btn.addEventListener('click', () => openBookingModal());
    });

    container.querySelectorAll('.btn-cancel-turno').forEach(btn => {
      btn.addEventListener('click', async () => {
        const tId = btn.getAttribute('data-turno-id');
        const confirma = confirm(`¿Estás seguro de que querés cancelar el turno #${tId}?`);
        if (!confirma) return;

        btn.disabled = true;
        btn.textContent = '⏳ Cancelando...';

        const { error } = await window.vetApi.cancelarTurno(tId);
        if (error) {
          btn.disabled = false;
          btn.textContent = '❌ Cancelar turno';
          showToast('No se pudo cancelar el turno: ' + (error.message || 'Error desconocido'), 'danger');
          return;
        }

        showToast(`Turno #${tId} cancelado.`, 'info');
        await Promise.all([renderPortalTurnos(), renderPortalMascotas()]);
      });
    });
  };

  // ==========================================
  // SINCRONIZACIÓN CON EVENTOS DE AUTENTICACIÓN
  // ==========================================
  document.addEventListener('vet:authchange', async (e) => {
    const { session } = e.detail || {};

    if (session && session.user) {
      if (modalCheckout && modalCheckout.classList.contains('active')) {
        openCheckoutModal();
      }

      // Reabrir modal de turno si el usuario venía de cliquear "Agendar" sin sesión
      const pendingService = sessionStorage.getItem('vet_pending_booking_service');
      if (pendingService) {
        sessionStorage.removeItem('vet_pending_booking_service');
        setTimeout(() => {
          openBookingModal(pendingService);
        }, 300);
      }

      await actualizarPortalSegunAuth();
    } else {
      await actualizarPortalSegunAuth();
    }
  });

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
  // 1. Borrar datos de prueba residuales de localStorage (Fase 3 - Regla 6)
  try {
    localStorage.removeItem('entre_mascotas_db_v1');
  } catch (e) {
    console.warn('No se pudo limpiar localStorage:', e);
  }

  // 2. Cargar carrito desde localStorage
  cart = loadCartFromStorage();
  updateCartUI();

  // 3. Cargar servicios veterinarios desde Supabase
  renderServices();

  // 4. Cargar catálogo de categorías y productos desde Supabase
  loadCatalog();

  // 5. Cargar portal inicial según sesión actual
  actualizarPortalSegunAuth();

  // 6. Verificar parámetros de retorno de Mercado Pago
  verificarRetornoMercadoPago();
});

