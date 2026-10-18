/**
 * Entre Mascotas - Panel de Administración
 * Sección 2: Gestión de Pedidos y Envíos
 */

(function () {
  'use strict';

  const { esc, formatCurrency, formatDateTime, formatTimeOnly, getStartOfDayArgentinaIso, showToast } = window.adminUtils;

  let pestanaActual = 'hoy'; // 'hoy' | 'todos'
  let filtroMostrarSinPagar = false;
  let filtroEstado = 'todos';
  let filtroTipoEntrega = 'todos';
  let filtroPago = 'todos';
  let filtroFechaDesde = '';
  let filtroFechaHasta = '';
  let filtroBusqueda = '';
  let paginaActual = 1;
  const TAMANIO_PAGINA = 50;

  let timerAutoRefresh = null;
  let pedidosCargados = [];

  async function cargarPedidos() {
    const tbody = document.getElementById('pedidosTableBody');
    const totalCountEl = document.getElementById('pedidosCountText');
    if (!tbody) return;

    tbody.innerHTML = window.adminUtils.renderTableSkeleton(6, 7);

    try {
      let query = window.sb
        .from('pedidos')
        .select(`
          id,
          cliente_id,
          fecha,
          tipo_entrega,
          direccion_envio,
          estado,
          pago_estado,
          mp_preference_id,
          mp_payment_id,
          total,
          perfiles (
            id,
            nombre,
            apellido,
            email,
            telefono,
            direccion
          ),
          detalle_pedido (
            id,
            producto_id,
            cantidad,
            precio_unitario,
            productos (
              id,
              nombre
            )
          )
        `, { count: 'exact' });

      // Filtro pestaña "Hoy"
      if (pestanaActual === 'hoy') {
        const inicioHoy = getStartOfDayArgentinaIso();
        query = query.gte('fecha', inicioHoy);
      }

      // Filtro pago aprobado por defecto
      if (!filtroMostrarSinPagar) {
        query = query.eq('pago_estado', 'aprobado');
      } else if (filtroPago !== 'todos') {
        query = query.eq('pago_estado', filtroPago);
      }

      // Filtros de pestaña "Todos"
      if (pestanaActual === 'todos') {
        if (filtroEstado !== 'todos') {
          query = query.eq('estado', filtroEstado);
        }
        if (filtroTipoEntrega !== 'todos') {
          query = query.eq('tipo_entrega', filtroTipoEntrega);
        }
        if (filtroFechaDesde) {
          query = query.gte('fecha', `${filtroFechaDesde}T00:00:00-03:00`);
        }
        if (filtroFechaHasta) {
          query = query.lte('fecha', `${filtroFechaHasta}T23:59:59-03:00`);
        }
      }

      // Orden cronológico descendente (los más recientes primero)
      query = query.order('fecha', { ascending: false });

      // Paginación
      const from = (paginaActual - 1) * TAMANIO_PAGINA;
      const to = from + TAMANIO_PAGINA - 1;
      query = query.range(from, to);

      const { data: pedidos, count, error } = await query;
      if (error) throw error;

      pedidosCargados = pedidos || [];

      // Filtro en cliente por búsqueda de texto (nombre, apellido, email, teléfono, ID)
      let lista = pedidosCargados;
      if (filtroBusqueda.trim()) {
        const q = filtroBusqueda.toLowerCase().trim();
        lista = lista.filter(p => {
          const cliente = p.perfiles || {};
          const full = `${cliente.nombre || ''} ${cliente.apellido || ''} ${cliente.email || ''} ${cliente.telefono || ''} ${p.id}`.toLowerCase();
          return full.includes(q);
        });
      }

      if (totalCountEl) {
        totalCountEl.textContent = `Mostrando ${lista.length} pedidos (Total base: ${count || 0})`;
      }

      renderTablaPedidos(lista, tbody);
      renderPaginadorPedidos(count || 0);
      actualizarHojaImpresion(pedidosCargados);

    } catch (err) {
      console.error('[pedidos] Error al cargar pedidos:', err);
      showToast('Error al consultar pedidos: ' + (err.message || 'Desconocido'), 'danger');
      tbody.innerHTML = '<tr><td colspan="7" style="text-align: center; color: var(--danger-text); padding: 2rem;">Error al cargar los pedidos.</td></tr>';
    }
  }

  function renderTablaPedidos(lista, tbody) {
    if (!lista || lista.length === 0) {
      tbody.innerHTML = `
        <tr>
          <td colspan="7" class="empty-state">
            <div class="empty-state-icon">📦</div>
            <div class="empty-state-title">No hay pedidos que coincidan con los filtros</div>
            <p style="font-size: 0.85rem;">Probá desactivando los filtros o habilitando "Mostrar sin pagar".</p>
          </td>
        </tr>
      `;
      return;
    }

    const puedeEditar = window.adminContext?.puedeEditar || false;

    tbody.innerHTML = lista.map(p => {
      const cliente = p.perfiles || {};
      const items = Array.isArray(p.detalle_pedido) ? p.detalle_pedido : [];
      const nombreCliente = [cliente.nombre, cliente.apellido].filter(Boolean).join(' ') || cliente.email?.split('@')[0] || 'Cliente';

      // Teléfono con enlace a WhatsApp limpio
      let waLink = '';
      if (cliente.telefono) {
        const numLimpio = cliente.telefono.replace(/[^\d]/g, '');
        waLink = `<a href="https://wa.me/${numLimpio}" target="_blank" rel="noopener" style="color: #059669; text-decoration: none; font-weight: 600;" title="Abrir chat de WhatsApp">💬 ${esc(cliente.telefono)}</a>`;
      } else {
        waLink = '<span style="color: var(--text-muted);">Sin teléfono</span>';
      }

      // Entrega
      let entregaHtml = '';
      if (p.tipo_entrega === 'envio') {
        const dir = p.direccion_envio || cliente.direccion || 'Dirección registrada';
        const mapsUrl = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(dir)}`;
        entregaHtml = `
          <div>
            <span class="badge badge-info" style="margin-bottom: 0.2rem;">🚚 Envío</span>
            <div style="font-size: 0.8rem; line-height: 1.3;">
              <a href="${mapsUrl}" target="_blank" rel="noopener" style="color: var(--accent); text-decoration: none;" title="Abrir en Google Maps">
                📍 ${esc(dir)}
              </a>
            </div>
          </div>
        `;
      } else {
        entregaHtml = `
          <div>
            <span class="badge badge-secondary">🏪 Retiro</span>
            <div style="font-size: 0.75rem; color: var(--text-muted); margin-top: 0.15rem;">Local Libertador</div>
          </div>
        `;
      }

      // Badge pago
      const badgePago = {
        aprobado: '<span class="badge badge-success">✓ Pago Aprobado</span>',
        pendiente: '<span class="badge badge-warning">⏳ Pago Pendiente</span>',
        rechazado: '<span class="badge badge-danger">✗ Pago Rechazado</span>'
      }[p.pago_estado] || `<span class="badge">${esc(p.pago_estado)}</span>`;

      // Badge / Selector de estado del pedido
      // Estados: 'pendiente_pago', 'preparando', 'en_camino', 'completado', 'cancelado'
      let estadoControl = '';
      const labelCompletado = p.tipo_entrega === 'envio' ? 'Entregado' : 'Retirado';

      if (puedeEditar) {
        estadoControl = `
          <div style="display: flex; flex-direction: column; gap: 0.35rem;">
            <select class="form-control select-cambiar-estado" data-pedido-id="${esc(p.id)}" style="font-size: 0.8rem; padding: 0.3rem 0.5rem;">
              <option value="pendiente_pago" ${p.estado === 'pendiente_pago' ? 'selected' : ''}>Pendiente de pago</option>
              <option value="preparando" ${p.estado === 'preparando' ? 'selected' : ''}>Preparándose</option>
              ${p.tipo_entrega === 'envio' ? `<option value="en_camino" ${p.estado === 'en_camino' ? 'selected' : ''}>En camino</option>` : ''}
              <option value="completado" ${p.estado === 'completado' ? 'selected' : ''}>✓ ${labelCompletado}</option>
              <option value="cancelado" ${p.estado === 'cancelado' ? 'selected' : ''}>✗ Cancelado</option>
            </select>
            ${p.estado !== 'cancelado' ? `
              <button type="button" class="btn btn-outline btn-sm btn-cancel-order" data-pedido-id="${esc(p.id)}" style="color: var(--danger-text); font-size: 0.72rem; padding: 0.15rem 0.4rem;">
                Cancelar (devuelve stock)
              </button>
            ` : ''}
          </div>
        `;
      } else {
        const badgeClass = {
          pendiente_pago: 'badge-warning',
          preparando: 'badge-warning',
          en_camino: 'badge-info',
          completado: 'badge-success',
          cancelado: 'badge-danger'
        }[p.estado] || 'badge-secondary';

        const labelEstado = {
          pendiente_pago: 'Pendiente de pago',
          preparando: 'Preparándose',
          en_camino: 'En camino',
          completado: labelCompletado,
          cancelado: 'Cancelado'
        }[p.estado] || p.estado;

        estadoControl = `<span class="badge ${badgeClass}">${esc(labelEstado)}</span>`;
      }

      // Detalle de productos compacto
      const itemsHtml = items.map(it => `
        <div style="font-size: 0.8rem; white-space: nowrap;">
          <strong>${it.cantidad}x</strong> ${esc(it.productos?.nombre || 'Producto')}
        </div>
      `).join('');

      return `
        <tr>
          <td style="font-weight: 700; color: var(--text-main);">
            #${esc(p.id)}
            <div style="font-size: 0.75rem; color: var(--text-muted); font-weight: normal;">
              ${formatTimeOnly(p.fecha)} hs · ${formatDateOnly(p.fecha)}
            </div>
          </td>
          <td>
            <div style="font-weight: 600; color: var(--text-main);">${esc(nombreCliente)}</div>
            <div style="font-size: 0.8rem; margin-top: 0.15rem;">${waLink}</div>
          </td>
          <td>${entregaHtml}</td>
          <td>
            <div style="max-height: 80px; overflow-y: auto;">
              ${itemsHtml}
            </div>
          </td>
          <td style="font-weight: 700; color: var(--text-main); font-size: 0.92rem;">
            ${formatCurrency(p.total)}
          </td>
          <td>${badgePago}</td>
          <td>${estadoControl}</td>
        </tr>
      `;
    }).join('');

    // Eventos para cambiar de estado
    if (puedeEditar) {
      tbody.querySelectorAll('.select-cambiar-estado').forEach(sel => {
        sel.addEventListener('change', async () => {
          const pedidoId = sel.getAttribute('data-pedido-id');
          const nuevoEstado = sel.value;

          if (nuevoEstado === 'cancelado') {
            const confirma = confirm(`¿Estás seguro de cancelar el pedido #${pedidoId}? Esta acción reintegrará el stock de los productos a la tienda.`);
            if (!confirma) {
              cargarPedidos(); // restaurar vista
              return;
            }
          }

          sel.disabled = true;
          try {
            const { error } = await window.sb.rpc('cambiar_estado_pedido', {
              p_id: Number(pedidoId),
              p_estado: nuevoEstado
            });

            if (error) throw error;
            showToast(`Pedido #${pedidoId} actualizado a "${nuevoEstado}".`, 'success');
            await cargarPedidos();
          } catch (err) {
            console.error('[pedidos] Error al cambiar estado:', err);
            showToast('No se pudo cambiar el estado: ' + (err.message || 'Error'), 'danger');
            await cargarPedidos();
          }
        });
      });

      tbody.querySelectorAll('.btn-cancel-order').forEach(btn => {
        btn.addEventListener('click', async () => {
          const pedidoId = btn.getAttribute('data-pedido-id');
          const confirma = confirm(`¿Estás seguro de cancelar el pedido #${pedidoId}? El stock de los productos será reintegrado inmediatamente.`);
          if (!confirma) return;

          btn.disabled = true;
          try {
            const { error } = await window.sb.rpc('cambiar_estado_pedido', {
              p_id: Number(pedidoId),
              p_estado: 'cancelado'
            });

            if (error) throw error;
            showToast(`Pedido #${pedidoId} cancelado. Stock reintegrado.`, 'info');
            await cargarPedidos();
          } catch (err) {
            console.error('[pedidos] Error al cancelar:', err);
            showToast('No se pudo cancelar el pedido: ' + (err.message || 'Error'), 'danger');
          }
        });
      });
    }
  }

  function renderPaginadorPedidos(totalCount) {
    const paginadorContainer = document.getElementById('pedidosPaginador');
    if (!paginadorContainer) return;

    const totalPaginas = Math.ceil(totalCount / TAMANIO_PAGINA);
    if (totalPaginas <= 1) {
      paginadorContainer.innerHTML = '';
      return;
    }

    paginadorContainer.innerHTML = `
      <div style="display: flex; align-items: center; justify-content: flex-end; gap: 0.5rem; margin-top: 1rem;">
        <button type="button" class="btn btn-outline btn-sm" id="btnPaginaAnt" ${paginaActual === 1 ? 'disabled' : ''}>
          ◀ Anterior
        </button>
        <span style="font-size: 0.85rem; color: var(--text-muted);">Página ${paginaActual} de ${totalPaginas}</span>
        <button type="button" class="btn btn-outline btn-sm" id="btnPaginaSig" ${paginaActual >= totalPaginas ? 'disabled' : ''}>
          Siguiente ▶
        </button>
      </div>
    `;

    document.getElementById('btnPaginaAnt')?.addEventListener('click', () => {
      if (paginaActual > 1) {
        paginaActual--;
        cargarPedidos();
      }
    });

    document.getElementById('btnPaginaSig')?.addEventListener('click', () => {
      if (paginaActual < totalPaginas) {
        paginaActual++;
        cargarPedidos();
      }
    });
  }

  // Prepara la hoja imprimible de envíos del día (@media print)
  function actualizarHojaImpresion(pedidos) {
    const printEl = document.getElementById('printShippingSheet');
    if (!printEl) return;

    const enviosPendientes = pedidos.filter(p => p.tipo_entrega === 'envio' && p.pago_estado === 'aprobado' && p.estado !== 'cancelado');
    const fechaImpresion = window.adminUtils.formatDateOnly(new Date().toISOString());

    printEl.innerHTML = `
      <div style="margin-bottom: 1.5rem; border-bottom: 2px solid #0f172a; padding-bottom: 0.75rem;">
        <h1 style="font-size: 1.4rem; font-weight: 800; margin-bottom: 0.25rem;">🐾 Clínica Veterinaria Entre Mascotas</h1>
        <h2 style="font-size: 1.1rem; font-weight: 600; color: #475569;">Hoja de Ruta y Envíos a Domicilio · ${fechaImpresion}</h2>
        <p style="font-size: 0.85rem; color: #64748b;">Total de envíos pendientes para entrega: ${enviosPendientes.length}</p>
      </div>

      ${enviosPendientes.length === 0 ? `
        <p style="font-style: italic; color: #64748b;">No hay envíos pendientes con pago aprobado para esta fecha.</p>
      ` : `
        <table class="print-table">
          <thead>
            <tr>
              <th style="width: 8%;">Pedido</th>
              <th style="width: 22%;">Destinatario / Teléfono</th>
              <th style="width: 35%;">Dirección de Entrega</th>
              <th style="width: 25%;">Productos a Entregar</th>
              <th style="width: 10%;">Firma / Recibido</th>
            </tr>
          </thead>
          <tbody>
            ${enviosPendientes.map(p => {
              const c = p.perfiles || {};
              const dir = p.direccion_envio || c.direccion || 'A coordinar';
              const nom = [c.nombre, c.apellido].filter(Boolean).join(' ') || c.email;
              const items = (p.detalle_pedido || []).map(it => `${it.cantidad}x ${it.productos?.nombre || 'Producto'}`).join(', ');

              return `
                <tr>
                  <td><strong>#${p.id}</strong></td>
                  <td>
                    <strong>${esc(nom)}</strong><br>
                    📞 ${esc(c.telefono || 'Sin teléfono')}
                  </td>
                  <td>📍 ${esc(dir)}</td>
                  <td>${esc(items)}</td>
                  <td style="height: 50px; vertical-align: bottom; text-align: center; font-size: 0.7rem; color: #94a3b8;">
                    [  ] Entregado
                  </td>
                </tr>
              `;
            }).join('')}
          </tbody>
        </table>
      `}
    `;
  }

  function inicializarPedidos() {
    // Pestañas Hoy / Todos
    const tabHoy = document.getElementById('pedidosTabHoy');
    const tabTodos = document.getElementById('pedidosTabTodos');
    const panelFiltrosTodos = document.getElementById('pedidosPanelFiltrosTodos');

    if (tabHoy && tabTodos) {
      tabHoy.addEventListener('click', () => {
        pestanaActual = 'hoy';
        tabHoy.classList.add('active', 'btn-primary');
        tabTodos.classList.remove('active', 'btn-primary');
        if (panelFiltrosTodos) panelFiltrosTodos.style.display = 'none';
        paginaActual = 1;
        cargarPedidos();
      });

      tabTodos.addEventListener('click', () => {
        pestanaActual = 'todos';
        tabTodos.classList.add('active', 'btn-primary');
        tabHoy.classList.remove('active', 'btn-primary');
        if (panelFiltrosTodos) panelFiltrosTodos.style.display = 'block';
        paginaActual = 1;
        cargarPedidos();
      });
    }

    // Switch "Mostrar sin pagar"
    const switchSinPagar = document.getElementById('switchMostrarSinPagar');
    if (switchSinPagar) {
      switchSinPagar.addEventListener('change', () => {
        filtroMostrarSinPagar = switchSinPagar.checked;
        paginaActual = 1;
        cargarPedidos();
      });
    }

    // Filtros de pestaña "Todos"
    document.getElementById('pedidosFiltroEstado')?.addEventListener('change', (e) => {
      filtroEstado = e.target.value;
      paginaActual = 1;
      cargarPedidos();
    });

    document.getElementById('pedidosFiltroTipoEntrega')?.addEventListener('change', (e) => {
      filtroTipoEntrega = e.target.value;
      paginaActual = 1;
      cargarPedidos();
    });

    document.getElementById('pedidosFiltroPago')?.addEventListener('change', (e) => {
      filtroPago = e.target.value;
      paginaActual = 1;
      cargarPedidos();
    });

    document.getElementById('pedidosFiltroFechaDesde')?.addEventListener('change', (e) => {
      filtroFechaDesde = e.target.value;
      paginaActual = 1;
      cargarPedidos();
    });

    document.getElementById('pedidosFiltroFechaHasta')?.addEventListener('change', (e) => {
      filtroFechaHasta = e.target.value;
      paginaActual = 1;
      cargarPedidos();
    });

    document.getElementById('pedidosBusquedaInput')?.addEventListener('input', (e) => {
      filtroBusqueda = e.target.value;
      cargarPedidos();
    });

    // Botón refrescar manual
    document.getElementById('btnRefreshPedidos')?.addEventListener('click', () => {
      cargarPedidos();
      showToast('Lista de pedidos actualizada.', 'info');
    });

    // Botón imprimir hoja de envíos
    document.getElementById('btnPrintShipping')?.addEventListener('click', () => {
      window.print();
    });

    // Auto-refresh cada 60 segundos
    if (timerAutoRefresh) clearInterval(timerAutoRefresh);
    timerAutoRefresh = setInterval(() => {
      const secEl = document.getElementById('sectionPedidos');
      if (secEl && secEl.classList.contains('active')) {
        cargarPedidos();
      }
    }, 60000);
  }

  document.addEventListener('admin:ready', () => {
    inicializarPedidos();
    cargarPedidos();
  });

  window.adminPedidos = {
    recargar: cargarPedidos
  };
})();
