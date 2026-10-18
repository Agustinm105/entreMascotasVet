/**
 * Entre Mascotas - Panel de Administración
 * Sección 7: Clientes y Tutores (Ficha 360° con mascotas, turnos y pedidos)
 */

(function () {
  'use strict';

  const { esc, formatCurrency, formatDateTime, formatDateOnly, openDrawer, closeDrawer, showToast } = window.adminUtils;

  let clientesLista = [];
  let filtroBusqueda = '';

  async function cargarClientes() {
    const tbody = document.getElementById('clientesTableBody');
    if (!tbody) return;

    tbody.innerHTML = window.adminUtils.renderTableSkeleton(6, 6);

    try {
      // Consulta relacional de clientes y sus mascotas
      const { data, error } = await window.sb
        .from('perfiles')
        .select(`
          id,
          email,
          nombre,
          apellido,
          telefono,
          direccion,
          avatar_url,
          rol,
          creado_en,
          mascotas (
            id,
            nombre,
            especie,
            raza,
            sexo,
            fecha_nacimiento,
            peso_kg,
            castrado,
            notas
          )
        `)
        .eq('rol', 'cliente')
        .order('creado_en', { ascending: false });

      if (error) throw error;

      clientesLista = data || [];
      filtrarYRenderizarClientes();

    } catch (err) {
      console.error('[clientes] Error al consultar clientes:', err);
      showToast('Error al consultar clientes: ' + (err.message || 'Desconocido'), 'danger');
      tbody.innerHTML = '<tr><td colspan="6" style="text-align: center; color: var(--danger-text); padding: 2rem;">Error al cargar la lista de clientes.</td></tr>';
    }
  }

  function filtrarYRenderizarClientes() {
    const tbody = document.getElementById('clientesTableBody');
    const countEl = document.getElementById('clientesCountText');
    if (!tbody) return;

    let lista = clientesLista;
    if (filtroBusqueda.trim()) {
      const q = filtroBusqueda.toLowerCase().trim();
      lista = lista.filter(c => {
        const full = `${c.nombre || ''} ${c.apellido || ''} ${c.email || ''} ${c.telefono || ''}`.toLowerCase();
        return full.includes(q);
      });
    }

    if (countEl) {
      countEl.textContent = `Mostrando ${lista.length} de ${clientesLista.length} clientes`;
    }

    if (lista.length === 0) {
      tbody.innerHTML = `
        <tr>
          <td colspan="6" class="empty-state">
            <div class="empty-state-icon">👥</div>
            <div class="empty-state-title">No se encontraron clientes</div>
            <p style="font-size: 0.85rem;">Probá buscando con otro nombre o correo.</p>
          </td>
        </tr>
      `;
      return;
    }

    tbody.innerHTML = lista.map(c => {
      const nombreCompleto = [c.nombre, c.apellido].filter(Boolean).join(' ') || c.email?.split('@')[0] || 'Cliente';
      const mascotas = Array.isArray(c.mascotas) ? c.mascotas : [];

      let waLink = '';
      if (c.telefono) {
        const numLimpio = c.telefono.replace(/[^\d]/g, '');
        waLink = `<a href="https://wa.me/${numLimpio}" target="_blank" rel="noopener" style="color: #059669; text-decoration: none; font-weight: 600;" title="WhatsApp">💬 ${esc(c.telefono)}</a>`;
      } else {
        waLink = '<span style="color: var(--text-light); font-size: 0.8rem;">Sin teléfono</span>';
      }

      // Resumen de mascotas
      const mascotasChips = mascotas.length > 0 ? mascotas.map(m => {
        const ic = m.especie === 'perro' ? '🐕' : (m.especie === 'gato' ? '🐈' : '🐾');
        return `<span class="badge badge-secondary" style="margin-right: 0.25rem;">${ic} ${esc(m.nombre)}</span>`;
      }).join('') : '<span style="color: var(--text-muted); font-size: 0.8rem;">Sin mascotas</span>';

      return `
        <tr>
          <td>
            <div style="font-weight: 700; color: var(--text-main); font-size: 0.95rem;">
              ${esc(nombreCompleto)}
            </div>
            <div style="font-size: 0.78rem; color: var(--text-muted);">
              Cliente desde: ${formatDateOnly(c.creado_en)}
            </div>
          </td>
          <td>
            <a href="mailto:${esc(c.email)}" style="color: var(--accent); text-decoration: none;">
              ${esc(c.email)}
            </a>
          </td>
          <td>${waLink}</td>
          <td style="font-size: 0.82rem; color: var(--text-muted); max-width: 220px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">
            ${esc(c.direccion || 'Sin dirección')}
          </td>
          <td>
            <div style="display: flex; flex-wrap: wrap; gap: 0.2rem;">
              ${mascotasChips}
            </div>
          </td>
          <td style="text-align: right;">
            <button type="button" class="btn btn-outline btn-sm btn-ver-cliente" data-cliente-id="${esc(c.id)}">
              🔍 Ver Ficha 360°
            </button>
          </td>
        </tr>
      `;
    }).join('');

    tbody.querySelectorAll('.btn-ver-cliente').forEach(btn => {
      btn.addEventListener('click', () => {
        const id = btn.getAttribute('data-cliente-id');
        abrirFichaCliente(id);
      });
    });
  }

  // Panel Lateral 360° del Cliente
  async function abrirFichaCliente(clienteId) {
    const cliente = clientesLista.find(c => String(c.id) === String(clienteId));
    if (!cliente) return;

    const drawerBody = document.getElementById('clienteDrawerBody');
    const drawerTitle = document.getElementById('clienteDrawerTitle');
    if (!drawerBody) return;

    const nombreCompleto = [cliente.nombre, cliente.apellido].filter(Boolean).join(' ') || cliente.email;
    if (drawerTitle) drawerTitle.textContent = `Ficha de Cliente: ${nombreCompleto}`;

    drawerBody.innerHTML = '<div style="padding: 2rem; text-align: center; color: var(--text-muted);">Cargando historial del cliente...</div>';
    openDrawer('drawerCliente');

    try {
      // Consultar turnos y pedidos asociados a este cliente en paralelo
      const [turnosRes, pedidosRes] = await Promise.all([
        window.sb
          .from('turnos')
          .select('id, fecha_hora, estado, notas, servicios(nombre, icono), mascotas(nombre)')
          .eq('cliente_id', cliente.id)
          .order('fecha_hora', { ascending: false }),

        window.sb
          .from('pedidos')
          .select('id, fecha, tipo_entrega, total, estado, pago_estado, detalle_pedido(cantidad, productos(nombre))')
          .eq('cliente_id', cliente.id)
          .order('fecha', { ascending: false })
      ]);

      const turnos = turnosRes.data || [];
      const pedidos = pedidosRes.data || [];
      const mascotas = cliente.mascotas || [];

      let waLink = '';
      if (cliente.telefono) {
        const numLimpio = cliente.telefono.replace(/[^\d]/g, '');
        waLink = `<a href="https://wa.me/${numLimpio}" target="_blank" rel="noopener" class="btn btn-outline btn-sm" style="color: #059669;">💬 WhatsApp (${esc(cliente.telefono)})</a>`;
      }

      let mapsLink = '';
      if (cliente.direccion) {
        const mapsUrl = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(cliente.direccion)}`;
        mapsLink = `<a href="${mapsUrl}" target="_blank" rel="noopener" class="btn btn-outline btn-sm">📍 Ver en Mapa</a>`;
      }

      drawerBody.innerHTML = `
        <!-- Tarjeta de contacto -->
        <div style="background-color: var(--bg-subtle); border: 1px solid var(--border-light); border-radius: var(--radius-md); padding: 1.15rem; margin-bottom: 1.5rem;">
          <h4 style="font-size: 1rem; font-weight: 700; margin-bottom: 0.5rem; color: var(--text-main);">${esc(nombreCompleto)}</h4>
          <div style="font-size: 0.85rem; color: var(--text-muted); display: flex; flex-direction: column; gap: 0.35rem; margin-bottom: 0.85rem;">
            <div>✉️ <strong>Email:</strong> <a href="mailto:${esc(cliente.email)}" style="color: var(--accent);">${esc(cliente.email)}</a></div>
            <div>📞 <strong>Teléfono:</strong> ${esc(cliente.telefono || 'No registrado')}</div>
            <div>🏠 <strong>Dirección:</strong> ${esc(cliente.direccion || 'No registrada')}</div>
            <div>📅 <strong>Registrado el:</strong> ${formatDateTime(cliente.creado_en)}</div>
          </div>
          <div style="display: flex; gap: 0.5rem; flex-wrap: wrap;">
            ${waLink}
            ${mapsLink}
          </div>
        </div>

        <!-- Mascotas del Cliente -->
        <div style="margin-bottom: 1.5rem;">
          <h4 style="font-size: 0.95rem; font-weight: 700; color: var(--text-main); margin-bottom: 0.75rem; display: flex; align-items: center; justify-content: space-between;">
            <span>🐾 Mascotas Asociadas (${mascotas.length})</span>
          </h4>
          ${mascotas.length === 0 ? `
            <p style="font-size: 0.85rem; color: var(--text-muted); font-style: italic;">No tiene mascotas registradas aún.</p>
          ` : `
            <div style="display: flex; flex-direction: column; gap: 0.65rem;">
              ${mascotas.map(m => {
                const ic = m.especie === 'perro' ? '🐕' : (m.especie === 'gato' ? '🐈' : '🐾');
                return `
                  <div style="background-color: var(--bg-surface); border: 1px solid var(--border-light); border-radius: var(--radius-sm); padding: 0.75rem;">
                    <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 0.25rem;">
                      <strong style="color: var(--text-main);">${ic} ${esc(m.nombre)}</strong>
                      <span class="badge badge-secondary">${esc(m.especie)} · ${esc(m.raza || 'Común')}</span>
                    </div>
                    <div style="font-size: 0.8rem; color: var(--text-muted);">
                      ${m.sexo ? `Sexo: <strong>${esc(m.sexo)}</strong> | ` : ''}
                      ${m.peso_kg ? `Peso: <strong>${esc(m.peso_kg)} kg</strong> | ` : ''}
                      Castrado/a: <strong>${m.castrado ? 'Sí' : (m.castrado === false ? 'No' : 'No sé')}</strong>
                    </div>
                    ${m.notas ? `<div style="font-size: 0.75rem; color: #b45309; background: #fffbeb; padding: 0.35rem 0.5rem; border-radius: 4px; margin-top: 0.4rem;">📝 ${esc(m.notas)}</div>` : ''}
                  </div>
                `;
              }).join('')}
            </div>
          `}
        </div>

        <!-- Turnos del Cliente -->
        <div style="margin-bottom: 1.5rem;">
          <h4 style="font-size: 0.95rem; font-weight: 700; color: var(--text-main); margin-bottom: 0.75rem;">
            🗓️ Historial de Turnos (${turnos.length})
          </h4>
          ${turnos.length === 0 ? `
            <p style="font-size: 0.85rem; color: var(--text-muted); font-style: italic;">No tiene turnos registrados.</p>
          ` : `
            <div style="max-height: 220px; overflow-y: auto; display: flex; flex-direction: column; gap: 0.45rem;">
              ${turnos.map(t => `
                <div style="display: flex; justify-content: space-between; align-items: center; padding: 0.5rem 0.65rem; background: var(--bg-surface); border: 1px solid var(--border-light); border-radius: var(--radius-sm); font-size: 0.82rem;">
                  <div>
                    <div><strong>${esc(t.servicios?.icono || '🩺')} ${esc(t.servicios?.nombre || 'Consulta')}</strong> (${esc(t.mascotas?.nombre || 'Mascota')})</div>
                    <div style="font-size: 0.75rem; color: var(--text-muted);">${formatDateTime(t.fecha_hora)}</div>
                  </div>
                  <span class="badge badge-secondary">${esc(t.estado)}</span>
                </div>
              `).join('')}
            </div>
          `}
        </div>

        <!-- Pedidos del Cliente -->
        <div>
          <h4 style="font-size: 0.95rem; font-weight: 700; color: var(--text-main); margin-bottom: 0.75rem;">
            📦 Pedidos Realizados (${pedidos.length})
          </h4>
          ${pedidos.length === 0 ? `
            <p style="font-size: 0.85rem; color: var(--text-muted); font-style: italic;">No tiene pedidos registrados.</p>
          ` : `
            <div style="max-height: 220px; overflow-y: auto; display: flex; flex-direction: column; gap: 0.45rem;">
              ${pedidos.map(p => `
                <div style="display: flex; justify-content: space-between; align-items: center; padding: 0.5rem 0.65rem; background: var(--bg-surface); border: 1px solid var(--border-light); border-radius: var(--radius-sm); font-size: 0.82rem;">
                  <div>
                    <div><strong>Pedido #${p.id}</strong> · <span style="font-weight: 700; color: var(--accent);">${formatCurrency(p.total)}</span></div>
                    <div style="font-size: 0.75rem; color: var(--text-muted);">${formatDateTime(p.fecha)} · ${esc(p.tipo_entrega)}</div>
                  </div>
                  <span class="badge ${p.pago_estado === 'aprobado' ? 'badge-success' : 'badge-warning'}">${esc(p.pago_estado)}</span>
                </div>
              `).join('')}
            </div>
          `}
        </div>
      `;

    } catch (err) {
      console.error('[clientes] Error al cargar detalle:', err);
      drawerBody.innerHTML = '<div style="padding: 1.5rem; color: var(--danger-text);">Error al cargar los datos completos del cliente.</div>';
    }
  }

  function inicializarClientes() {
    document.getElementById('clientesBusquedaInput')?.addEventListener('input', (e) => {
      filtroBusqueda = e.target.value;
      filtrarYRenderizarClientes();
    });

    document.getElementById('btnRefreshClientes')?.addEventListener('click', () => {
      cargarClientes();
      showToast('Lista de clientes actualizada.', 'info');
    });

    document.getElementById('btnCerrarDrawerCliente')?.addEventListener('click', () => {
      closeDrawer('drawerCliente');
    });
  }

  document.addEventListener('admin:ready', () => {
    inicializarClientes();
    cargarClientes();
  });

  window.adminClientes = {
    recargar: cargarClientes,
    abrirFicha: abrirFichaCliente
  };
})();
