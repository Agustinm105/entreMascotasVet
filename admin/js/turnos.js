/**
 * Entre Mascotas - Panel de Administración
 * Sección 3: Agenda Veterinaria y Gestión de Turnos
 */

(function () {
  'use strict';

  const { esc, formatDateTime, formatDateOnly, formatTimeOnly, getTodayArgentinaDateStr, showToast } = window.adminUtils;

  let modoVista = 'dia'; // 'dia' | 'proximos' | 'todos'
  let fechaSeleccionada = '';
  let turnosCargados = [];

  async function cargarTurnos() {
    const tbody = document.getElementById('turnosTableBody');
    const labelFecha = document.getElementById('turnosFechaActualLabel');
    if (!tbody) return;

    tbody.innerHTML = window.adminUtils.renderTableSkeleton(6, 6);

    try {
      let query = window.sb
        .from('turnos')
        .select(`
          id,
          cliente_id,
          mascota_id,
          servicio_id,
          fecha_hora,
          estado,
          notas,
          creado_en,
          perfiles (
            id,
            nombre,
            apellido,
            email,
            telefono
          ),
          mascotas (
            id,
            nombre,
            especie,
            raza,
            sexo,
            peso_kg,
            castrado,
            notas
          ),
          servicios (
            id,
            nombre,
            duracion_min,
            precio,
            icono
          )
        `);

      if (modoVista === 'dia') {
        const diaIsoInicio = `${fechaSeleccionada}T00:00:00-03:00`;
        const diaIsoFin = `${fechaSeleccionada}T23:59:59-03:00`;
        query = query
          .gte('fecha_hora', diaIsoInicio)
          .lte('fecha_hora', diaIsoFin)
          .order('fecha_hora', { ascending: true });

        if (labelFecha) {
          const parts = fechaSeleccionada.split('-');
          labelFecha.textContent = `${parts[2]}/${parts[1]}/${parts[0]}`;
        }
      } else if (modoVista === 'proximos') {
        const ahoraIso = new Date().toISOString();
        query = query
          .gte('fecha_hora', ahoraIso)
          .neq('estado', 'cancelado')
          .order('fecha_hora', { ascending: true })
          .limit(50);

        if (labelFecha) labelFecha.textContent = 'Próximos Turnos';
      } else {
        query = query
          .order('fecha_hora', { ascending: false })
          .limit(100);

        if (labelFecha) labelFecha.textContent = 'Historial Completo';
      }

      const { data: turnos, error } = await query;
      if (error) throw error;

      turnosCargados = turnos || [];
      renderTablaTurnos(turnosCargados, tbody);

    } catch (err) {
      console.error('[turnos] Error al cargar agenda:', err);
      showToast('Error al consultar agenda: ' + (err.message || 'Desconocido'), 'danger');
      tbody.innerHTML = '<tr><td colspan="6" style="text-align: center; color: var(--danger-text); padding: 2rem;">Error al cargar turnos.</td></tr>';
    }
  }

  function renderTablaTurnos(turnos, tbody) {
    if (!turnos || turnos.length === 0) {
      tbody.innerHTML = `
        <tr>
          <td colspan="6" class="empty-state">
            <div class="empty-state-icon">🗓️</div>
            <div class="empty-state-title">No hay turnos registrados para esta fecha</div>
            <p style="font-size: 0.85rem;">Podés seleccionar otro día en el calendario o ver los próximos turnos.</p>
          </td>
        </tr>
      `;
      return;
    }

    const puedeEditar = window.adminContext?.puedeEditar || false;

    tbody.innerHTML = turnos.map(t => {
      const c = t.perfiles || {};
      const m = t.mascotas || {};
      const s = t.servicios || {};

      const tutorNombre = [c.nombre, c.apellido].filter(Boolean).join(' ') || c.email?.split('@')[0] || 'Tutor';
      const especieIcon = m.especie === 'perro' ? '🐕' : (m.especie === 'gato' ? '🐈' : '🐾');

      let waLink = '';
      if (c.telefono) {
        const numLimpio = c.telefono.replace(/[^\d]/g, '');
        waLink = `<a href="https://wa.me/${numLimpio}" target="_blank" rel="noopener" style="color: #059669; text-decoration: none; font-size: 0.8rem;" title="Abrir WhatsApp">📞 ${esc(c.telefono)}</a>`;
      } else {
        waLink = '<span style="color: var(--text-muted); font-size: 0.78rem;">Sin teléfono</span>';
      }

      // Selector de estado si puede editar, badge si no
      let estadoHtml = '';
      if (puedeEditar) {
        estadoHtml = `
          <select class="form-control select-turno-estado" data-turno-id="${esc(t.id)}" style="font-size: 0.8rem; padding: 0.25rem 0.45rem;">
            <option value="reservado" ${t.estado === 'reservado' ? 'selected' : ''}>⏳ Reservado</option>
            <option value="confirmado" ${t.estado === 'confirmado' ? 'selected' : ''}>🗓️ Confirmado</option>
            <option value="realizado" ${t.estado === 'realizado' ? 'selected' : ''}>✅ Realizado</option>
            <option value="cancelado" ${t.estado === 'cancelado' ? 'selected' : ''}>❌ Cancelado</option>
          </select>
        `;
      } else {
        const badgeMap = {
          reservado: 'badge-warning',
          confirmado: 'badge-info',
          realizado: 'badge-success',
          cancelado: 'badge-danger'
        };
        estadoHtml = `<span class="badge ${badgeMap[t.estado] || 'badge-secondary'}">${esc(t.estado)}</span>`;
      }

      return `
        <tr>
          <td style="font-weight: 700; white-space: nowrap;">
            <div style="font-size: 1.05rem; color: var(--accent);">${formatTimeOnly(t.fecha_hora)} hs</div>
            <div style="font-size: 0.75rem; color: var(--text-muted); font-weight: normal;">${formatDateOnly(t.fecha_hora)}</div>
          </td>
          <td>
            <div style="font-weight: 600; color: var(--text-main); display: flex; align-items: center; gap: 0.35rem;">
              <span>${esc(s.icono || '🩺')}</span>
              <span>${esc(s.nombre || 'Servicio')}</span>
            </div>
            <div style="font-size: 0.75rem; color: var(--text-muted);">${s.duracion_min ? `${s.duracion_min} min` : ''}</div>
          </td>
          <td>
            <div style="display: flex; align-items: center; gap: 0.4rem;">
              <span>${especieIcon}</span>
              <button type="button" class="btn btn-outline btn-sm btn-open-pet-sheet" data-pet-id="${esc(m.id)}" style="font-weight: 700; color: var(--text-main); padding: 0.15rem 0.45rem;">
                ${esc(m.nombre || 'Mascota')} ↗
              </button>
            </div>
            <div style="font-size: 0.75rem; color: var(--text-muted); margin-top: 0.1rem;">
              ${esc(m.raza || 'Común')}
            </div>
          </td>
          <td>
            <div style="font-weight: 600;">${esc(tutorNombre)}</div>
            <div>${waLink}</div>
          </td>
          <td style="max-width: 200px;">
            <div style="font-size: 0.8rem; color: var(--text-muted); line-height: 1.3;">
              ${t.notas ? `📝 ${esc(t.notas)}` : '<span style="color: var(--text-light); font-style: italic;">Sin notas</span>'}
            </div>
          </td>
          <td>${estadoHtml}</td>
        </tr>
      `;
    }).join('');

    // Eventos para cambiar estado de turno
    if (puedeEditar) {
      tbody.querySelectorAll('.select-turno-estado').forEach(sel => {
        sel.addEventListener('change', async () => {
          const tId = sel.getAttribute('data-turno-id');
          const nuevoEstado = sel.value;

          sel.disabled = true;
          try {
            const { error } = await window.sb
              .from('turnos')
              .update({ estado: nuevoEstado })
              .eq('id', tId);

            if (error) throw error;
            showToast(`Turno #${tId} actualizado a "${nuevoEstado}".`, 'success');
            await cargarTurnos();
          } catch (err) {
            console.error('[turnos] Error al actualizar estado:', err);
            showToast('No se pudo actualizar el turno: ' + (err.message || 'Error'), 'danger');
            await cargarTurnos();
          }
        });
      });
    }

    // Eventos para ver ficha de mascota desde el turno
    tbody.querySelectorAll('.btn-open-pet-sheet').forEach(btn => {
      btn.addEventListener('click', () => {
        const petId = btn.getAttribute('data-pet-id');
        if (window.adminMascotas && window.adminMascotas.abrirFichaMascota) {
          window.adminMascotas.abrirFichaMascota(petId);
        } else if (window.adminApp && window.adminApp.cambiarSeccion) {
          window.adminApp.cambiarSeccion('mascotas');
        }
      });
    });
  }

  function inicializarTurnos() {
    fechaSeleccionada = window.adminUtils.getTodayArgentinaDateStr();

    const inputFecha = document.getElementById('turnosDatePicker');
    if (inputFecha) {
      inputFecha.value = fechaSeleccionada;
      inputFecha.addEventListener('change', () => {
        fechaSeleccionada = inputFecha.value;
        modoVista = 'dia';
        actualizarBotonesModoVista();
        cargarTurnos();
      });
    }

    // Botones de navegación de fecha
    document.getElementById('btnTurnosDiaAnterior')?.addEventListener('click', () => {
      const d = new Date(fechaSeleccionada + 'T12:00:00');
      d.setDate(d.getDate() - 1);
      const formatter = new Intl.DateTimeFormat('en-CA', {
        timeZone: 'America/Argentina/Buenos_Aires',
        year: 'numeric',
        month: '2-digit',
        day: '2-digit'
      });
      fechaSeleccionada = formatter.format(d);
      if (inputFecha) inputFecha.value = fechaSeleccionada;
      modoVista = 'dia';
      actualizarBotonesModoVista();
      cargarTurnos();
    });

    document.getElementById('btnTurnosDiaSiguiente')?.addEventListener('click', () => {
      const d = new Date(fechaSeleccionada + 'T12:00:00');
      d.setDate(d.getDate() + 1);
      const formatter = new Intl.DateTimeFormat('en-CA', {
        timeZone: 'America/Argentina/Buenos_Aires',
        year: 'numeric',
        month: '2-digit',
        day: '2-digit'
      });
      fechaSeleccionada = formatter.format(d);
      if (inputFecha) inputFecha.value = fechaSeleccionada;
      modoVista = 'dia';
      actualizarBotonesModoVista();
      cargarTurnos();
    });

    document.getElementById('btnTurnosHoy')?.addEventListener('click', () => {
      fechaSeleccionada = window.adminUtils.getTodayArgentinaDateStr();
      if (inputFecha) inputFecha.value = fechaSeleccionada;
      modoVista = 'dia';
      actualizarBotonesModoVista();
      cargarTurnos();
    });

    // Pestañas de vista
    const tabDia = document.getElementById('turnosTabDia');
    const tabProximos = document.getElementById('turnosTabProximos');
    const navFechas = document.getElementById('turnosNavFechasContainer');

    function actualizarBotonesModoVista() {
      if (tabDia && tabProximos) {
        tabDia.classList.toggle('btn-primary', modoVista === 'dia');
        tabDia.classList.toggle('active', modoVista === 'dia');
        tabProximos.classList.toggle('btn-primary', modoVista === 'proximos');
        tabProximos.classList.toggle('active', modoVista === 'proximos');
      }
      if (navFechas) {
        navFechas.style.display = modoVista === 'dia' ? 'flex' : 'none';
      }
    }

    tabDia?.addEventListener('click', () => {
      modoVista = 'dia';
      actualizarBotonesModoVista();
      cargarTurnos();
    });

    tabProximos?.addEventListener('click', () => {
      modoVista = 'proximos';
      actualizarBotonesModoVista();
      cargarTurnos();
    });

    document.getElementById('btnRefreshTurnos')?.addEventListener('click', () => {
      cargarTurnos();
      showToast('Agenda actualizada.', 'info');
    });
  }

  document.addEventListener('admin:ready', () => {
    inicializarTurnos();
    cargarTurnos();
  });

  window.adminTurnos = {
    recargar: cargarTurnos
  };
})();
