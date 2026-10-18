/**
 * Entre Mascotas - Panel de Administración
 * Sección 1: Resumen General y Estadísticas de Negocio
 */

(function () {
  'use strict';

  const { esc, formatCurrency, formatDateOnly, showToast } = window.adminUtils;

  let periodoSeleccionado = 30; // 7, 30 o 90 días

  async function cargarResumen() {
    const container = document.getElementById('sectionResumen');
    if (!container) return;

    const kpiVentas = document.getElementById('kpiVentasTotal');
    const kpiPedidos = document.getElementById('kpiCantidadPedidos');
    const kpiTicket = document.getElementById('kpiTicketPromedio');
    const kpiClientes = document.getElementById('kpiTotalClientes');
    const kpiMascotas = document.getElementById('kpiTotalMascotas');

    const chartContainer = document.getElementById('resumenChartContainer');
    const topProductosContainer = document.getElementById('resumenTopProductos');
    const bajoStockContainer = document.getElementById('resumenBajoStock');
    const turnosEstadoContainer = document.getElementById('resumenTurnosEstado');
    const paraHoyPedidos = document.getElementById('resumenParaHoyPedidos');
    const paraHoyTurnos = document.getElementById('resumenParaHoyTurnos');

    if (kpiVentas) kpiVentas.textContent = '...';
    if (chartContainer) chartContainer.innerHTML = '<div style="padding: 2rem; text-align: center; color: var(--text-muted);">Cargando gráfico de ventas...</div>';

    try {
      // 1. Invocar RPC estadisticas_ventas
      const { data: stats, error } = await window.sb.rpc('estadisticas_ventas', {
        p_dias: periodoSeleccionado
      });

      if (error) throw error;

      // 2. Consultar pedidos y turnos pendientes de hoy
      const hoyStr = window.adminUtils.getTodayArgentinaDateStr();
      const inicioHoyIso = `${hoyStr}T00:00:00-03:00`;
      const finHoyIso = `${hoyStr}T23:59:59-03:00`;

      const [pedidosHoyRes, turnosHoyRes] = await Promise.all([
        window.sb
          .from('pedidos')
          .select('id, estado, pago_estado', { count: 'exact' })
          .gte('fecha', inicioHoyIso)
          .eq('pago_estado', 'aprobado')
          .in('estado', ['pendiente_pago', 'preparando', 'en_camino']),

        window.sb
          .from('turnos')
          .select('id, estado', { count: 'exact' })
          .gte('fecha_hora', inicioHoyIso)
          .lte('fecha_hora', finHoyIso)
          .neq('estado', 'cancelado')
      ]);

      const pedidosPendientesHoy = pedidosHoyRes.count || 0;
      const turnosAgendadosHoy = turnosHoyRes.count || 0;

      // Actualizar Tarjetas KPI
      if (kpiVentas) kpiVentas.textContent = formatCurrency(stats?.ventas_total || 0);
      if (kpiPedidos) kpiPedidos.textContent = stats?.cantidad_pedidos || 0;
      if (kpiTicket) kpiTicket.textContent = formatCurrency(stats?.ticket_promedio || 0);
      if (kpiClientes) kpiClientes.textContent = stats?.total_clientes || 0;
      if (kpiMascotas) kpiMascotas.textContent = stats?.total_mascotas || 0;

      // Bloques "Para hoy"
      if (paraHoyPedidos) {
        paraHoyPedidos.innerHTML = `
          <div style="font-size: 1.6rem; font-weight: 800; color: var(--accent);">${pedidosPendientesHoy}</div>
          <div style="font-size: 0.85rem; color: var(--text-muted); margin-bottom: 0.5rem;">Pedidos aprobados a preparar/entregar hoy</div>
          <button type="button" class="btn btn-outline btn-sm btn-nav-jump" data-target-section="pedidos">Ver pedidos de hoy →</button>
        `;
      }

      if (paraHoyTurnos) {
        paraHoyTurnos.innerHTML = `
          <div style="font-size: 1.6rem; font-weight: 800; color: #047857;">${turnosAgendadosHoy}</div>
          <div style="font-size: 0.85rem; color: var(--text-muted); margin-bottom: 0.5rem;">Turnos veterinarios programados hoy</div>
          <button type="button" class="btn btn-outline btn-sm btn-nav-jump" data-target-section="turnos">Ver agenda de hoy →</button>
        `;
      }

      // Eventos para botones de salto de sección
      container.querySelectorAll('.btn-nav-jump').forEach(btn => {
        btn.addEventListener('click', () => {
          const target = btn.getAttribute('data-target-section');
          if (window.adminApp && window.adminApp.cambiarSeccion) {
            window.adminApp.cambiarSeccion(target);
          }
        });
      });

      // 3. Renderizar Gráfico de Ventas SVG con días faltantes en cero
      renderGraficoVentas(stats?.ventas_por_dia || [], chartContainer, periodoSeleccionado);

      // 4. Renderizar Top 5 Productos
      renderTopProductos(stats?.top_productos || [], topProductosContainer);

      // 5. Renderizar Productos con Bajo Stock
      renderBajoStock(stats?.bajo_stock || [], bajoStockContainer);

      // 6. Renderizar Turnos por Estado
      renderTurnosPorEstado(stats?.turnos_por_estado || {}, turnosEstadoContainer);

    } catch (err) {
      console.error('[resumen] Error al cargar estadísticas:', err);
      showToast('Error al cargar datos del resumen: ' + (err.message || 'Desconocido'), 'danger');
      if (chartContainer) chartContainer.innerHTML = '<div style="padding: 1.5rem; color: var(--danger-text); text-align: center;">No se pudieron cargar las estadísticas.</div>';
    }
  }

  // Generador de gráfico SVG propio completando con 0 los días sin ventas
  function renderGraficoVentas(ventasPorDia, container, dias) {
    if (!container) return;

    // Generar serie completa de fechas para los últimos N días
    const mapaVentas = new Map();
    (ventasPorDia || []).forEach(v => {
      if (v.dia) mapaVentas.set(String(v.dia).split('T')[0], Number(v.total) || 0);
    });

    const puntos = [];
    const hoy = new Date();

    for (let i = dias - 1; i >= 0; i--) {
      const d = new Date();
      d.setDate(hoy.getDate() - i);
      const formatter = new Intl.DateTimeFormat('en-CA', {
        timeZone: 'America/Argentina/Buenos_Aires',
        year: 'numeric',
        month: '2-digit',
        day: '2-digit'
      });
      const diaStr = formatter.format(d);
      const total = mapaVentas.get(diaStr) || 0;
      puntos.push({ dia: diaStr, total });
    }

    const maxVenta = Math.max(...puntos.map(p => p.total), 1000);

    const width = 800;
    const height = 240;
    const paddingLeft = 65;
    const paddingRight = 20;
    const paddingTop = 25;
    const paddingBottom = 40;

    const chartW = width - paddingLeft - paddingRight;
    const chartH = height - paddingTop - paddingBottom;

    // Coordenadas
    const coords = puntos.map((p, idx) => {
      const x = paddingLeft + (idx / (puntos.length - 1)) * chartW;
      const y = paddingTop + chartH - (p.total / maxVenta) * chartH;
      return { x, y, ...p };
    });

    const polylinePoints = coords.map(c => `${c.x.toFixed(1)},${c.y.toFixed(1)}`).join(' ');
    const areaPoints = `${paddingLeft},${paddingTop + chartH} ${polylinePoints} ${paddingLeft + chartW},${paddingTop + chartH}`;

    // Líneas horizontales de guía (4 niveles)
    const lineasGuia = [0, 0.33, 0.66, 1].map(ratio => {
      const y = paddingTop + chartH - ratio * chartH;
      const val = ratio * maxVenta;
      return `
        <line x1="${paddingLeft}" y1="${y}" x2="${width - paddingRight}" y2="${y}" stroke="#e2e8f0" stroke-dasharray="3,3" />
        <text x="${paddingLeft - 8}" y="${y + 4}" fill="#94a3b8" font-size="10" text-anchor="end">${formatCurrency(val)}</text>
      `;
    }).join('');

    // Etiquetas de fechas (mostrar algunas representativas)
    const stepLabel = Math.max(1, Math.floor(puntos.length / 6));
    const labelsFechas = coords.filter((_, idx) => idx % stepLabel === 0 || idx === coords.length - 1).map(c => {
      const parts = c.dia.split('-');
      const label = `${parts[2]}/${parts[1]}`;
      return `
        <text x="${c.x}" y="${height - 12}" fill="#64748b" font-size="11" text-anchor="middle">${label}</text>
      `;
    }).join('');

    // Puntos interactivos con tooltip SVG
    const svgCircles = coords.map(c => `
      <circle cx="${c.x}" cy="${c.y}" r="4" fill="#2563eb" stroke="#ffffff" stroke-width="2">
        <title>${c.dia}: ${formatCurrency(c.total)}</title>
      </circle>
    `).join('');

    container.innerHTML = `
      <div style="width: 100%; overflow-x: auto;">
        <svg viewBox="0 0 ${width} ${height}" style="width: 100%; height: auto; min-width: 500px; display: block;" aria-label="Gráfico de evolución de ventas diarias">
          <!-- Fondo de área -->
          <polygon points="${areaPoints}" fill="#eff6ff" opacity="0.8" />
          <!-- Líneas de referencia -->
          ${lineasGuia}
          <!-- Línea de ventas -->
          <polyline points="${polylinePoints}" fill="none" stroke="#2563eb" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" />
          <!-- Círculos -->
          ${svgCircles}
          <!-- Fechas eje X -->
          ${labelsFechas}
        </svg>
      </div>
    `;
  }

  // Renderizar Top 5 productos
  function renderTopProductos(topList, container) {
    if (!container) return;
    if (!topList || topList.length === 0) {
      container.innerHTML = '<p style="color: var(--text-muted); font-size: 0.85rem;">No hay ventas registradas en este período.</p>';
      return;
    }

    const maxUnits = Math.max(...topList.map(t => Number(t.unidades) || 1));

    container.innerHTML = topList.map((item, idx) => {
      const unidades = Number(item.unidades) || 0;
      const pct = Math.round((unidades / maxUnits) * 100);

      return `
        <div style="margin-bottom: 0.85rem;">
          <div style="display: flex; justify-content: space-between; font-size: 0.85rem; margin-bottom: 0.25rem;">
            <span style="font-weight: 600; color: var(--text-main); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; max-width: 75%;">
              ${idx + 1}. ${esc(item.nombre)}
            </span>
            <span style="font-weight: 700; color: var(--accent);">${unidades} u.</span>
          </div>
          <div style="height: 7px; background-color: #f1f5f9; border-radius: 4px; overflow: hidden;">
            <div style="height: 100%; width: ${pct}%; background-color: var(--accent); border-radius: 4px;"></div>
          </div>
        </div>
      `;
    }).join('');
  }

  // Renderizar productos con bajo stock
  function renderBajoStock(bajoStockList, container) {
    if (!container) return;
    if (!bajoStockList || bajoStockList.length === 0) {
      container.innerHTML = '<p style="color: var(--success-text); font-size: 0.85rem; background: var(--success-bg); padding: 0.75rem; border-radius: var(--radius-sm);">✓ Todos los productos activos tienen stock adecuado.</p>';
      return;
    }

    container.innerHTML = `
      <div class="table-responsive">
        <table class="table">
          <thead>
            <tr>
              <th>Producto</th>
              <th>Stock</th>
              <th>Acción</th>
            </tr>
          </thead>
          <tbody>
            ${bajoStockList.map(p => `
              <tr>
                <td style="font-weight: 600;">${esc(p.nombre)}</td>
                <td>
                  <span class="badge ${p.stock <= 2 ? 'badge-danger' : 'badge-warning'}">
                    ⚠️ ${p.stock} unidades
                  </span>
                </td>
                <td>
                  <button type="button" class="btn btn-outline btn-sm btn-edit-product-stock" data-product-id="${esc(p.id)}">
                    Gestionar
                  </button>
                </td>
              </tr>
            `).join('')}
          </tbody>
        </table>
      </div>
    `;

    container.querySelectorAll('.btn-edit-product-stock').forEach(btn => {
      btn.addEventListener('click', () => {
        const prodId = btn.getAttribute('data-product-id');
        if (window.adminApp && window.adminApp.cambiarSeccion) {
          window.adminApp.cambiarSeccion('productos', { filterProductId: prodId });
        }
      });
    });
  }

  // Renderizar turnos por estado
  function renderTurnosPorEstado(turnosPorEstado, container) {
    if (!container) return;

    const estados = [
      { key: 'reservado', label: 'Reservados', badgeClass: 'badge-warning', icon: '⏳' },
      { key: 'confirmado', label: 'Confirmados', badgeClass: 'badge-info', icon: '🗓️' },
      { key: 'realizado', label: 'Realizados', badgeClass: 'badge-success', icon: '✅' },
      { key: 'cancelado', label: 'Cancelados', badgeClass: 'badge-danger', icon: '❌' }
    ];

    container.innerHTML = `
      <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(130px, 1fr)); gap: 0.75rem;">
        ${estados.map(est => {
          const cant = turnosPorEstado[est.key] || 0;
          return `
            <div style="background-color: var(--bg-subtle); border: 1px solid var(--border-light); border-radius: var(--radius-sm); padding: 0.75rem; text-align: center;">
              <span class="badge ${est.badgeClass}" style="margin-bottom: 0.35rem;">${est.icon} ${est.label}</span>
              <div style="font-size: 1.4rem; font-weight: 800; color: var(--text-main);">${cant}</div>
            </div>
          `;
        }).join('')}
      </div>
    `;
  }

  // Inicialización de la sección
  function initResumen() {
    // Selectores de período
    document.querySelectorAll('[data-resumen-periodo]').forEach(btn => {
      btn.addEventListener('click', () => {
        document.querySelectorAll('[data-resumen-periodo]').forEach(b => b.classList.remove('active', 'btn-primary'));
        btn.classList.add('active', 'btn-primary');
        periodoSeleccionado = Number(btn.getAttribute('data-resumen-periodo')) || 30;
        cargarResumen();
      });
    });

    const btnRefresh = document.getElementById('btnRefreshResumen');
    if (btnRefresh) {
      btnRefresh.addEventListener('click', cargarResumen);
    }
  }

  document.addEventListener('admin:ready', () => {
    initResumen();
    cargarResumen();
  });

  window.adminResumen = {
    recargar: cargarResumen
  };
})();
