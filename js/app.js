/**
 * Veterinaria Entre Mascotas - Lógica Principal de la Aplicación
 * Conecta los componentes de la interfaz con la capa de datos (vetDB)
 */

document.addEventListener('DOMContentLoaded', () => {
  // Estado local de la aplicación
  let currentCategory = 'all';
  let searchQuery = '';
  let activeDbTable = 'turnos';
  let cart = []; // { product, quantity }
  const currentClientId = 1; // Agustín Morales como cliente activo de demostración

  // ==========================================
  // FORMATEADORES
  // ==========================================
  const formatCurrency = (val) => {
    return new Intl.NumberFormat('es-AR', {
      style: 'currency',
      currency: 'ARS',
      maximumFractionDigits: 0
    }).format(val);
  };

  const formatDate = (isoString) => {
    if (!isoString) return '-';
    const d = new Date(isoString);
    return d.toLocaleDateString('es-AR', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  // ==========================================
  // TOAST NOTIFICATIONS
  // ==========================================
  const showToast = (message, type = 'success') => {
    const container = document.getElementById('toastContainer');
    const toast = document.createElement('div');
    toast.className = `toast toast-${type}`;
    
    let icon = '✅';
    if (type === 'info') icon = 'ℹ️';
    if (type === 'warning') icon = '⚠️';
    if (type === 'danger') icon = '❌';

    toast.innerHTML = `
      <span style="font-size: 1.25rem;">${icon}</span>
      <div style="font-size: 0.9rem; font-weight: 500; color: var(--slate-800);">${message}</div>
    `;

    container.appendChild(toast);
    setTimeout(() => toast.classList.add('show'), 10);

    setTimeout(() => {
      toast.classList.remove('show');
      setTimeout(() => toast.remove(), 350);
    }, 3800);
  };

  // ==========================================
  // RENDER: SERVICIOS VETERINARIOS
  // ==========================================
  const renderServices = () => {
    const container = document.getElementById('servicesContainer');
    const select = document.getElementById('bookingServiceSelect');
    if (!container) return;

    const services = window.vetDB.getAll('servicios').filter(s => s.activo);

    container.innerHTML = services.map(s => `
      <article class="service-card">
        <div class="service-card-media">
          <img src="${s.imagen || 'assets/images/consultation.jpg'}" alt="${s.nombre}" loading="lazy">
          <span class="service-duration-badge">⏱️ ${s.duracion_min} min</span>
        </div>
        <div class="service-body">
          <h3 class="service-title">
            <span>${s.icono || '🩺'}</span>
            ${s.nombre}
          </h3>
          <p class="service-desc">${s.descripcion}</p>
          <div class="service-footer">
            <div class="service-price">
              ${formatCurrency(s.precio)}
              <small>/ sesión</small>
            </div>
            <button class="btn btn-primary btn-sm btn-book-service" data-service-id="${s.id}" data-service-name="${s.nombre}">
              Agendar
            </button>
          </div>
        </div>
      </article>
    `).join('');

    // Rellenar select del modal de turnos
    if (select) {
      select.innerHTML = services.map(s => `
        <option value="${s.id}">${s.nombre} (${s.duracion_min} min - ${formatCurrency(s.precio)})</option>
      `).join('');
    }

    // Eventos de botones "Agendar"
    container.querySelectorAll('.btn-book-service').forEach(btn => {
      btn.addEventListener('click', () => {
        const sId = btn.getAttribute('data-service-id');
        openBookingModal(sId);
      });
    });
  };

  // ==========================================
  // RENDER: CATEGORÍAS & PRODUCTOS (PET SHOP)
  // ==========================================
  const renderCategories = () => {
    const pillsContainer = document.getElementById('categoryPills');
    if (!pillsContainer) return;

    const categories = window.vetDB.getAll('categorias');
    
    let html = `
      <button class="cat-btn ${currentCategory === 'all' ? 'active' : ''}" data-cat-id="all">
        🐾 Todos los Productos
      </button>
    `;

    html += categories.map(c => `
      <button class="cat-btn ${String(currentCategory) === String(c.id) ? 'active' : ''}" data-cat-id="${c.id}">
        ${c.nombre}
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

  const renderProducts = () => {
    const container = document.getElementById('productsContainer');
    if (!container) return;

    let products = window.vetDB.getAll('productos').filter(p => p.activo);

    // Filtrar por categoría
    if (currentCategory !== 'all') {
      products = products.filter(p => String(p.categoria_id) === String(currentCategory));
    }

    // Filtrar por texto de búsqueda
    if (searchQuery.trim() !== '') {
      const q = searchQuery.toLowerCase().trim();
      products = products.filter(p => 
        p.nombre.toLowerCase().includes(q) || 
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
    window.vetDB.getAll('categorias').forEach(c => { categoriesMap[c.id] = c.nombre; });

    container.innerHTML = products.map(p => {
      const catName = categoriesMap[p.categoria_id] || 'General';
      const isLowStock = p.stock <= 10;

      return `
        <article class="product-card">
          <div class="product-media">
            <span class="product-cat-tag">${catName}</span>
            <span class="product-stock-tag ${isLowStock ? 'stock-low' : 'stock-in'}">
              ${isLowStock ? `¡Solo ${p.stock}! stock` : `${p.stock} en stock`}
            </span>
            <img src="${p.imagen_url}" alt="${p.nombre}" loading="lazy">
          </div>
          <div class="product-body">
            <h4 class="product-name">${p.nombre}</h4>
            <p class="product-desc">${p.descripcion || ''}</p>
            <div class="product-footer">
              <div class="product-price">${formatCurrency(p.precio)}</div>
              <button class="btn btn-primary btn-sm btn-add-cart" data-prod-id="${p.id}">
                🛒 Agregar
              </button>
            </div>
          </div>
        </article>
      `;
    }).join('');

    // Eventos para agregar al carrito
    container.querySelectorAll('.btn-add-cart').forEach(btn => {
      btn.addEventListener('click', () => {
        const prodId = btn.getAttribute('data-prod-id');
        addToCart(Number(prodId));
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
  // CARRITO DE COMPRAS Y PEDIDOS (pedidos, detalle_pedido)
  // ==========================================
  const addToCart = (productId) => {
    const product = window.vetDB.getById('productos', productId);
    if (!product || product.stock <= 0) {
      showToast('Producto sin stock disponible.', 'warning');
      return;
    }

    const existing = cart.find(item => item.product.id === productId);
    if (existing) {
      if (existing.quantity >= product.stock) {
        showToast(`Stock máximo alcanzado (${product.stock} un.)`, 'warning');
        return;
      }
      existing.quantity += 1;
    } else {
      cart.push({ product, quantity: 1 });
    }

    updateCartUI();
    showToast(`¡Agregado al carrito: ${product.nombre}!`, 'success');
  };

  const updateCartUI = () => {
    const badge = document.getElementById('cartCountBadge');
    const container = document.getElementById('cartItemsContainer');
    const totalEl = document.getElementById('cartTotalPrice');

    const totalCount = cart.reduce((sum, item) => sum + item.quantity, 0);
    if (badge) badge.textContent = totalCount;

    const subtotal = cart.reduce((sum, item) => sum + (item.product.precio * item.quantity), 0);
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

    container.innerHTML = cart.map(item => `
      <div class="cart-item">
        <img src="${item.product.imagen_url}" alt="${item.product.nombre}" class="cart-item-img">
        <div class="cart-item-info">
          <div class="cart-item-name">${item.product.nombre}</div>
          <div class="cart-item-price">${formatCurrency(item.product.precio)}</div>
          <div class="cart-qty-ctrl">
            <button class="cart-qty-btn btn-cart-dec" data-id="${item.product.id}">-</button>
            <span class="cart-qty-num">${item.quantity}</span>
            <button class="cart-qty-btn btn-cart-inc" data-id="${item.product.id}">+</button>
            <button class="btn btn-ghost btn-cart-remove" data-id="${item.product.id}" style="font-size: 0.75rem; color: var(--danger); margin-left: auto; padding: 0.2rem 0.4rem;">
              Quitar
            </button>
          </div>
        </div>
      </div>
    `).join('');

    // Botones de cantidad dentro del carrito
    container.querySelectorAll('.btn-cart-dec').forEach(btn => {
      btn.addEventListener('click', () => {
        const id = Number(btn.getAttribute('data-id'));
        const item = cart.find(i => i.product.id === id);
        if (item) {
          if (item.quantity > 1) {
            item.quantity -= 1;
          } else {
            cart = cart.filter(i => i.product.id !== id);
          }
          updateCartUI();
        }
      });
    });

    container.querySelectorAll('.btn-cart-inc').forEach(btn => {
      btn.addEventListener('click', () => {
        const id = Number(btn.getAttribute('data-id'));
        const item = cart.find(i => i.product.id === id);
        if (item) {
          if (item.quantity < item.product.stock) {
            item.quantity += 1;
            updateCartUI();
          } else {
            showToast('No hay más stock disponible', 'warning');
          }
        }
      });
    });

    container.querySelectorAll('.btn-cart-remove').forEach(btn => {
      btn.addEventListener('click', () => {
        const id = Number(btn.getAttribute('data-id'));
        cart = cart.filter(i => i.product.id !== id);
        updateCartUI();
      });
    });
  };

  // Abrir / Cerrar Carrito Drawer
  const cartDrawer = document.getElementById('cartDrawer');
  const btnOpenCart = document.getElementById('btnOpenCart');
  const btnCloseCart = document.getElementById('btnCloseCart');

  if (btnOpenCart && cartDrawer) {
    btnOpenCart.addEventListener('click', () => cartDrawer.classList.add('active'));
  }
  if (btnCloseCart && cartDrawer) {
    btnCloseCart.addEventListener('click', () => cartDrawer.classList.remove('active'));
  }

  // Checkout modal
  const btnProceedCheckout = document.getElementById('btnProceedCheckout');
  const modalCheckout = document.getElementById('modalCheckout');
  const checkoutTotalText = document.getElementById('checkoutTotalText');

  if (btnProceedCheckout) {
    btnProceedCheckout.addEventListener('click', () => {
      if (cart.length === 0) {
        showToast('Agregá al menos un producto al carrito para comprar.', 'warning');
        return;
      }
      cartDrawer.classList.remove('active');
      const subtotal = cart.reduce((sum, item) => sum + (item.product.precio * item.quantity), 0);
      if (checkoutTotalText) checkoutTotalText.textContent = formatCurrency(subtotal);
      openModal(modalCheckout);
    });
  }

  // Confirmar compra (INSERT en pedidos y detalle_pedido)
  const checkoutForm = document.getElementById('checkoutForm');
  if (checkoutForm) {
    checkoutForm.addEventListener('submit', (e) => {
      e.preventDefault();

      const subtotal = cart.reduce((sum, item) => sum + (item.product.precio * item.quantity), 0);
      const address = document.getElementById('checkoutAddress').value;

      // 1. Inserción en tabla 'pedidos'
      const nuevoPedido = window.vetDB.insert('pedidos', {
        cliente_id: currentClientId,
        fecha: new Date().toISOString(),
        estado: 'pendiente',
        direccion_envio: address,
        total: subtotal
      });

      // 2. Inserciones en 'detalle_pedido' y descuento de stock
      cart.forEach(item => {
        window.vetDB.insert('detalle_pedido', {
          pedido_id: nuevoPedido.id,
          producto_id: item.product.id,
          cantidad: item.quantity,
          precio_unitario: item.product.precio
        });

        // Actualizar stock del producto
        const currentProd = window.vetDB.getById('productos', item.product.id);
        if (currentProd) {
          window.vetDB.update('productos', item.product.id, {
            stock: Math.max(0, currentProd.stock - item.quantity)
          });
        }
      });

      // Limpiar carrito y cerrar modal
      cart = [];
      updateCartUI();
      closeModal(modalCheckout);
      renderProducts();
      refreshDbInspector();

      showToast(`¡Pedido #${nuevoPedido.id} creado con éxito! Registrado en la base de datos.`, 'success');
    });
  }

  // ==========================================
  // RESERVA DE TURNOS (turnos, clientes, mascotas, servicios)
  // ==========================================
  const modalBooking = document.getElementById('modalBooking');
  const bookingForm = document.getElementById('bookingForm');

  const openBookingModal = (preselectedServiceId = null) => {
    // Establecer fecha mínima: hoy
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

    // Precargar datos del cliente activo para agilidad
    const client = window.vetDB.getById('clientes', currentClientId);
    if (client) {
      document.getElementById('bookingClientName').value = client.nombre;
      document.getElementById('bookingClientLastname').value = client.apellido;
      document.getElementById('bookingClientEmail').value = client.email;
      document.getElementById('bookingClientPhone').value = client.telefono || '';
    }

    openModal(modalBooking);
  };

  const btnHeroReserve = document.getElementById('btnHeroReserve');
  const btnMainBooking = document.getElementById('btnMainBooking');
  const btnPortalNewBooking = document.getElementById('btnPortalNewBooking');

  if (btnHeroReserve) btnHeroReserve.addEventListener('click', () => openBookingModal());
  if (btnMainBooking) btnMainBooking.addEventListener('click', () => openBookingModal());
  if (btnPortalNewBooking) btnPortalNewBooking.addEventListener('click', () => openBookingModal());

  if (bookingForm) {
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

      // 1. Obtener o crear cliente
      let client = window.vetDB.filter('clientes', c => c.email.toLowerCase() === clientEmail.toLowerCase())[0];
      if (!client) {
        client = window.vetDB.insert('clientes', {
          nombre: clientName,
          apellido: clientLastname,
          email: clientEmail,
          telefono: clientPhone,
          direccion: 'A coordinar',
          password_hash: 'auto_generated_token'
        });
      }

      // 2. Obtener o crear mascota para ese cliente
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

      // 3. Crear el turno
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
      renderPortalData();
      refreshDbInspector();

      showToast(`¡Turno #${nuevoTurno.id} reservado con éxito para ${pet.nombre}!`, 'success');
    });
  }

  // ==========================================
  // REGISTRAR MASCOTA ADICIONAL (mascotas)
  // ==========================================
  const modalAddPet = document.getElementById('modalAddPet');
  const btnAddNewPet = document.getElementById('btnAddNewPet');
  const addPetForm = document.getElementById('addPetForm');

  if (btnAddNewPet) btnAddNewPet.addEventListener('click', () => openModal(modalAddPet));

  if (addPetForm) {
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
      renderPortalData();
      refreshDbInspector();

      showToast(`Mascota "${newPet.nombre}" registrada correctamente.`, 'success');
    });
  }

  // ==========================================
  // RENDER: PORTAL CLIENTE (mascotas & turnos)
  // ==========================================
  const renderPortalData = () => {
    const petsContainer = document.getElementById('petsListContainer');
    const appContainer = document.getElementById('appointmentsListContainer');
    const petBadge = document.getElementById('petCountBadge');
    const appBadge = document.getElementById('appointmentsCountBadge');

    // Mascotas del cliente
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
                🐾 ${pet.nombre}
              </div>
              <div style="font-size: 0.82rem; color: var(--slate-600); margin: 0.2rem 0;">
                <strong>Raza:</strong> ${pet.raza || 'Común'} | 
                <strong>Nacimiento:</strong> ${pet.fecha_nacimiento ? pet.fecha_nacimiento : 'No especificado'}
              </div>
              ${pet.notas ? `<div style="font-size: 0.8rem; color: var(--slate-500); margin-top: 0.35rem; background: #fff; padding: 0.4rem 0.6rem; border-radius: 6px; border: 1px dashed var(--slate-300);">📝 ${pet.notas}</div>` : ''}
            </div>
            <button class="btn btn-outline btn-sm btn-quick-book" data-pet-id="${pet.id}" data-pet-name="${pet.nombre}" style="font-size: 0.78rem; padding: 0.3rem 0.65rem;">
              Pedir Turno
            </button>
          </div>
        `).join('');

        petsContainer.querySelectorAll('.btn-quick-book').forEach(btn => {
          btn.addEventListener('click', () => {
            const petName = btn.getAttribute('data-pet-name');
            openBookingModal();
            document.getElementById('bookingPetName').value = petName;
          });
        });
      }
    }

    // Turnos del cliente
    const turnos = window.vetDB.getTurnosDetallados().filter(t => t.cliente_id === currentClientId);
    if (appBadge) appBadge.textContent = turnos.length;

    if (appContainer) {
      if (turnos.length === 0) {
        appContainer.innerHTML = `<p style="color: var(--slate-500); font-size: 0.9rem;">No tenés turnos programados.</p>`;
      } else {
        appContainer.innerHTML = turnos.map(t => `
          <div style="background: var(--slate-50); border: 1px solid var(--slate-200); border-radius: var(--radius-md); padding: 1.1rem;">
            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 0.5rem;">
              <span class="badge-status badge-${t.estado}">${t.estado}</span>
              <span style="font-size: 0.78rem; color: var(--slate-500);">ID #${t.id}</span>
            </div>
            <div style="font-weight: 700; color: var(--slate-900); font-size: 0.95rem;">
              ${t.servicio.nombre}
            </div>
            <div style="font-size: 0.82rem; color: var(--slate-600); margin: 0.25rem 0;">
              🐶 Paciente: <strong>${t.mascota.nombre}</strong> (${t.mascota.raza})
            </div>
            <div style="font-size: 0.85rem; font-weight: 600; color: var(--primary-700); margin-top: 0.4rem;">
              🗓️ ${formatDate(t.fecha_hora)}
            </div>
            ${t.estado !== 'cancelado' ? `
              <div style="display: flex; gap: 0.5rem; margin-top: 0.75rem; padding-top: 0.5rem; border-top: 1px solid var(--slate-200);">
                <button class="btn btn-outline btn-sm btn-cancel-appointment" data-turno-id="${t.id}" style="font-size: 0.75rem; padding: 0.25rem 0.5rem; color: var(--danger);">
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
            renderPortalData();
            refreshDbInspector();
            showToast(`Turno #${tId} cancelado.`, 'info');
          });
        });
      }
    }
  };

  // ==========================================
  // EXPLORADOR Y VISOR DE BASE DE DATOS
  // ==========================================
  const modalDbInspector = document.getElementById('modalDbInspector');
  const btnOpenDbInspector = document.getElementById('btnOpenDbInspector');
  const btnFooterDb = document.getElementById('btnFooterDb');
  const btnResetDb = document.getElementById('btnResetDb');
  const dbTableView = document.getElementById('dbTableView');
  const dbTableInfo = document.getElementById('dbTableInfo');

  if (btnOpenDbInspector) {
    btnOpenDbInspector.addEventListener('click', () => {
      refreshDbInspector();
      openModal(modalDbInspector);
    });
  }
  if (btnFooterDb) {
    btnFooterDb.addEventListener('click', (e) => {
      e.preventDefault();
      refreshDbInspector();
      openModal(modalDbInspector);
    });
  }

  if (btnResetDb) {
    btnResetDb.addEventListener('click', () => {
      if (confirm('¿Deseas restaurar la base de datos a los valores iniciales de demostración?')) {
        window.vetDB.reset();
        renderServices();
        renderCategories();
        renderProducts();
        renderPortalData();
        refreshDbInspector();
        showToast('Base de datos restaurada con éxito.', 'info');
      }
    });
  }

  // Cambio de pestañas en el inspector de base de datos
  document.querySelectorAll('.db-tab-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.db-tab-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      activeDbTable = btn.getAttribute('data-table');
      refreshDbInspector();
    });
  });

  const refreshDbInspector = () => {
    if (!dbTableView) return;
    const records = window.vetDB.getAll(activeDbTable);
    if (dbTableInfo) {
      dbTableInfo.textContent = `Tabla: ${activeDbTable} (${records.length} registros)`;
    }

    if (records.length === 0) {
      dbTableView.innerHTML = `<tr><td style="padding: 2rem; text-align: center; color: var(--slate-400);">Sin registros en la tabla '${activeDbTable}'</td></tr>`;
      return;
    }

    // Encabezados basados en las llaves del primer registro
    const headers = Object.keys(records[0]);
    let thead = '<thead><tr>' + headers.map(h => `<th>${h}</th>`).join('') + '</tr></thead>';

    let tbody = '<tbody>' + records.map(row => {
      return '<tr>' + headers.map(key => {
        let val = row[key];
        if (key === 'estado') {
          return `<td><span class="badge-status badge-${val}">${val}</span></td>`;
        }
        if (key === 'precio' || key === 'precio_unitario' || key === 'total') {
          return `<td><strong>${formatCurrency(val)}</strong></td>`;
        }
        if (key.includes('fecha') || key === 'creado_en') {
          return `<td style="font-size: 0.78rem; color: var(--slate-500);">${formatDate(val)}</td>`;
        }
        if (typeof val === 'boolean') {
          return `<td>${val ? '✅ Sí' : '❌ No'}</td>`;
        }
        return `<td>${val !== null && val !== undefined ? String(val) : '<em style="color:#aaa;">null</em>'}</td>`;
      }).join('') + '</tr>';
    }).join('') + '</tbody>';

    dbTableView.innerHTML = thead + tbody;
  };

  // ==========================================
  // HELPERS MODAL
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

  // Cerrar al hacer clic fuera del modal
  document.querySelectorAll('.modal-overlay').forEach(overlay => {
    overlay.addEventListener('click', (e) => {
      if (e.target === overlay) closeModal(overlay);
    });
  });

  // ==========================================
  // INICIALIZACIÓN DE LA PÁGINA
  // ==========================================
  renderServices();
  renderCategories();
  renderProducts();
  renderPortalData();
  updateCartUI();
});
