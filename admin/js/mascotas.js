/**
 * Entre Mascotas - Panel de Administración
 * Sección 8: Fichas Clínicas de Mascotas y Notas Médicas
 */

(function () {
  'use strict';

  const { esc, formatDateTime, formatDateOnly, openDrawer, closeDrawer, showToast } = window.adminUtils;

  let mascotasList = [];
  let filtroBusqueda = '';
  let filtroEspecie = 'todas';

  // Helper para cálculo de edad
  function calcularEdadMascota(fechaNacimiento) {
    if (!fechaNacimiento) return 'No especificada';
    try {
      const parts = fechaNacimiento.split('-');
      if (parts.length !== 3) return 'No especificada';
      const birth = new Date(Number(parts[0]), Number(parts[1]) - 1, Number(parts[2]));
      const now = new Date();
      if (isNaN(birth.getTime()) || birth > now) return 'Recién nacido';

      let years = now.getFullYear() - birth.getFullYear();
      let months = now.getMonth() - birth.getMonth();
      let days = now.getDate() - birth.getDate();

      if (days < 0) months -= 1;
      if (months < 0) {
        years -= 1;
        months += 12;
      }

      if (years > 0) {
        if (months > 0) return `${years} año${years > 1 ? 's' : ''} y ${months} mes${months > 1 ? 'es' : ''}`;
        return `${years} año${years > 1 ? 's' : ''}`;
      } else if (months > 0) {
        return `${months} mes${months > 1 ? 'es' : ''}`;
      } else {
        return 'Menos de 1 mes';
      }
    } catch {
      return 'No especificada';
    }
  }

  async function cargarMascotas() {
    const tbody = document.getElementById('mascotasTableBody');
    if (!tbody) return;

    tbody.innerHTML = window.adminUtils.renderTableSkeleton(6, 6);

    try {
      const { data, error } = await window.sb
        .from('mascotas')
        .select(`
          id,
          cliente_id,
          nombre,
          especie,
          raza,
          sexo,
          fecha_nacimiento,
          peso_kg,
          castrado,
          notas,
          creado_en,
          perfiles (
            id,
            nombre,
            apellido,
            email,
            telefono
          )
        `)
        .order('id', { ascending: false });

      if (error) throw error;

      mascotasList = data || [];
      filtrarYRenderizarMascotas();

    } catch (err) {
      console.error('[mascotas] Error al cargar mascotas:', err);
      showToast('Error al consultar fichas de mascotas: ' + (err.message || 'Desconocido'), 'danger');
      tbody.innerHTML = '<tr><td colspan="6" style="text-align: center; color: var(--danger-text); padding: 2rem;">Error al cargar las mascotas.</td></tr>';
    }
  }

  function filtrarYRenderizarMascotas() {
    const tbody = document.getElementById('mascotasTableBody');
    const countEl = document.getElementById('mascotasCountText');
    if (!tbody) return;

    let lista = mascotasList;

    if (filtroEspecie !== 'todas') {
      lista = lista.filter(m => m.especie === filtroEspecie);
    }

    if (filtroBusqueda.trim()) {
      const q = filtroBusqueda.toLowerCase().trim();
      lista = lista.filter(m => {
        const tutor = m.perfiles || {};
        const full = `${m.nombre || ''} ${m.raza || ''} ${tutor.nombre || ''} ${tutor.apellido || ''} ${tutor.email || ''}`.toLowerCase();
        return full.includes(q);
      });
    }

    if (countEl) {
      countEl.textContent = `Mostrando ${lista.length} de ${mascotasList.length} fichas clínicas`;
    }

    if (lista.length === 0) {
      tbody.innerHTML = `
        <tr>
          <td colspan="6" class="empty-state">
            <div class="empty-state-icon">🐾</div>
            <div class="empty-state-title">No hay mascotas con esos criterios</div>
            <p style="font-size: 0.85rem;">Probá buscando con otro nombre o cambiando el filtro de especie.</p>
          </td>
        </tr>
      `;
      return;
    }

    tbody.innerHTML = lista.map(m => {
      const tutor = m.perfiles || {};
      const tutorNombre = [tutor.nombre, tutor.apellido].filter(Boolean).join(' ') || tutor.email?.split('@')[0] || 'Tutor';
      const ic = m.especie === 'perro' ? '🐕' : (m.especie === 'gato' ? '🐈' : '🐾');
      const edadTexto = calcularEdadMascota(m.fecha_nacimiento);

      return `
        <tr>
          <td style="font-size: 1.3rem; text-align: center; width: 45px;">${ic}</td>
          <td>
            <div style="font-weight: 700; color: var(--text-main); font-size: 0.95rem;">
              ${esc(m.nombre)}
            </div>
            <div style="font-size: 0.78rem; color: var(--text-muted);">
              ${esc(m.especie.toUpperCase())} · ${esc(m.raza || 'Común')}
            </div>
          </td>
          <td>
            <div style="font-size: 0.85rem; font-weight: 600;">${esc(edadTexto)}</div>
            <div style="font-size: 0.75rem; color: var(--text-muted);">
              ${m.sexo ? `${esc(m.sexo)} · ` : ''}${m.peso_kg ? `${esc(m.peso_kg)} kg` : 'Sin peso'}
            </div>
          </td>
          <td>
            <button type="button" class="btn btn-outline btn-sm btn-link-to-client" data-client-id="${esc(tutor.id || m.cliente_id)}" style="font-weight: 600; padding: 0.2rem 0.5rem;">
              👤 ${esc(tutorNombre)} ↗
            </button>
            <div style="font-size: 0.75rem; color: var(--text-muted); margin-top: 0.15rem;">
              ${esc(tutor.telefono || tutor.email || '')}
            </div>
          </td>
          <td style="max-width: 250px;">
            <div style="font-size: 0.8rem; color: var(--text-muted); overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">
              ${m.notas ? `📝 ${esc(m.notas)}` : '<span style="color: var(--text-light); font-style: italic;">Sin notas</span>'}
            </div>
          </td>
          <td style="text-align: right;">
            <button type="button" class="btn btn-outline btn-sm btn-ver-ficha-mascota" data-pet-id="${esc(m.id)}">
              📋 Ver Historia Clínica
            </button>
          </td>
        </tr>
      `;
    }).join('');

    tbody.querySelectorAll('.btn-ver-ficha-mascota').forEach(btn => {
      btn.addEventListener('click', () => {
        const id = btn.getAttribute('data-pet-id');
        abrirFichaMascota(id);
      });
    });

    tbody.querySelectorAll('.btn-link-to-client').forEach(btn => {
      btn.addEventListener('click', () => {
        const cId = btn.getAttribute('data-client-id');
        if (window.adminClientes && window.adminClientes.abrirFicha) {
          window.adminClientes.abrirFicha(cId);
        }
      });
    });
  }

  // Abre el Drawer de la Ficha Clínica de la Mascota
  async function abrirFichaMascota(mascotaId) {
    const pet = mascotasList.find(m => String(m.id) === String(mascotaId));
    if (!pet) return;

    const drawerBody = document.getElementById('mascotaDrawerBody');
    const drawerTitle = document.getElementById('mascotaDrawerTitle');
    if (!drawerBody) return;

    if (drawerTitle) drawerTitle.textContent = `Historia Clínica: ${pet.nombre}`;
    drawerBody.innerHTML = '<div style="padding: 2rem; text-align: center; color: var(--text-muted);">Cargando historial clínico...</div>';
    openDrawer('drawerMascota');

    try {
      // Consultar turnos de esta mascota
      const { data: turnos, error } = await window.sb
        .from('turnos')
        .select('id, fecha_hora, estado, notas, servicios(nombre, icono)')
        .eq('mascota_id', pet.id)
        .order('fecha_hora', { ascending: false });

      if (error) throw error;

      const tutor = pet.perfiles || {};
      const tutorNombre = [tutor.nombre, tutor.apellido].filter(Boolean).join(' ') || tutor.email;
      const ic = pet.especie === 'perro' ? '🐕' : (pet.especie === 'gato' ? '🐈' : '🐾');
      const edadTexto = calcularEdadMascota(pet.fecha_nacimiento);
      const puedeEditar = window.adminContext?.puedeEditar || false;

      let castradoTexto = 'No especificado';
      if (pet.castrado === true) castradoTexto = 'Sí';
      else if (pet.castrado === false) castradoTexto = 'No';

      drawerBody.innerHTML = `
        <!-- Tarjeta de Identificación -->
        <div style="background-color: var(--bg-subtle); border: 1px solid var(--border-light); border-radius: var(--radius-md); padding: 1.15rem; margin-bottom: 1.25rem;">
          <div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 0.5rem;">
            <div style="display: flex; align-items: center; gap: 0.5rem;">
              <span style="font-size: 1.8rem;">${ic}</span>
              <div>
                <h3 style="font-size: 1.2rem; font-weight: 800; color: var(--text-main);">${esc(pet.nombre)}</h3>
                <span style="font-size: 0.8rem; color: var(--text-muted);">${esc(pet.especie.toUpperCase())} · ${esc(pet.raza || 'Común')}</span>
              </div>
            </div>
            <span class="badge badge-info">ID #${pet.id}</span>
          </div>

          <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 0.5rem; font-size: 0.82rem; margin-top: 0.75rem; border-top: 1px solid var(--border-light); padding-top: 0.75rem;">
            <div><strong>Edad calculada:</strong> ${esc(edadTexto)}</div>
            <div><strong>Nacimiento:</strong> ${esc(pet.fecha_nacimiento || 'No indicada')}</div>
            <div><strong>Sexo:</strong> ${esc(pet.sexo || 'No indicado')}</div>
            <div><strong>Peso:</strong> ${pet.peso_kg ? `${esc(pet.peso_kg)} kg` : 'No indicado'}</div>
            <div><strong>Castrado/a:</strong> ${esc(castradoTexto)}</div>
            <div><strong>Alta:</strong> ${formatDateOnly(pet.creado_en)}</div>
          </div>
        </div>

        <!-- Tutor a cargo -->
        <div style="background-color: var(--bg-surface); border: 1px solid var(--border-light); border-radius: var(--radius-sm); padding: 0.85rem; margin-bottom: 1.25rem; display: flex; align-items: center; justify-content: space-between;">
          <div>
            <div style="font-size: 0.75rem; color: var(--text-muted); text-transform: uppercase; font-weight: 700;">Tutor Responsable</div>
            <div style="font-weight: 700; color: var(--text-main); font-size: 0.95rem;">${esc(tutorNombre)}</div>
            <div style="font-size: 0.8rem; color: var(--text-muted);">${esc(tutor.telefono || tutor.email || '')}</div>
          </div>
          <button type="button" class="btn btn-outline btn-sm btn-drawer-jump-client" data-client-id="${esc(tutor.id || pet.cliente_id)}">
            Ver Cliente →
          </button>
        </div>

        <!-- Notas clínicas editables por el dueño -->
        <div style="margin-bottom: 1.5rem;">
          <div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 0.4rem;">
            <label class="form-label" style="margin-bottom: 0;">📝 Notas Clínicas / Alergias / Medicación</label>
            ${puedeEditar ? `<span style="font-size: 0.72rem; color: var(--accent); font-weight: 600;">Editable por el Dueño</span>` : ''}
          </div>
          <textarea id="drawerMascotaNotasInput" class="form-control" rows="4" placeholder="Alergias a fármacos, medicación habitual, comportamiento..." ${!puedeEditar ? 'disabled' : ''}>${esc(pet.notas || '')}</textarea>
          ${puedeEditar ? `
            <button type="button" class="btn btn-primary btn-sm" id="btnGuardarNotasMascota" data-pet-id="${esc(pet.id)}" style="margin-top: 0.5rem;">
              💾 Guardar Notas Clínicas
            </button>
          ` : ''}
        </div>

        <!-- Historial de Turnos de la Mascota -->
        <div>
          <h4 style="font-size: 0.95rem; font-weight: 700; color: var(--text-main); margin-bottom: 0.65rem;">
            🗓️ Historial de Turnos de ${esc(pet.nombre)} (${(turnos || []).length})
          </h4>
          ${(!turnos || turnos.length === 0) ? `
            <p style="font-size: 0.85rem; color: var(--text-muted); font-style: italic;">No tiene turnos registrados en la clínica.</p>
          ` : `
            <div style="display: flex; flex-direction: column; gap: 0.45rem; max-height: 250px; overflow-y: auto;">
              ${turnos.map(t => `
                <div style="display: flex; justify-content: space-between; align-items: center; padding: 0.5rem 0.65rem; background: var(--bg-surface); border: 1px solid var(--border-light); border-radius: var(--radius-sm); font-size: 0.82rem;">
                  <div>
                    <div style="font-weight: 600;">${esc(t.servicios?.icono || '🩺')} ${esc(t.servicios?.nombre || 'Consulta')}</div>
                    <div style="font-size: 0.75rem; color: var(--text-muted);">${formatDateTime(t.fecha_hora)}</div>
                    ${t.notas ? `<div style="font-size: 0.72rem; color: #b45309; margin-top: 0.2rem;">${esc(t.notas)}</div>` : ''}
                  </div>
                  <span class="badge badge-secondary">${esc(t.estado)}</span>
                </div>
              `).join('')}
            </div>
          `}
        </div>
      `;

      // Evento para guardar notas clínicas
      if (puedeEditar) {
        document.getElementById('btnGuardarNotasMascota')?.addEventListener('click', async () => {
          const btn = document.getElementById('btnGuardarNotasMascota');
          const notasVal = document.getElementById('drawerMascotaNotasInput')?.value.trim() || null;

          btn.disabled = true;
          btn.textContent = 'Guardando...';

          try {
            const { error: updError } = await window.sb
              .from('mascotas')
              .update({ notas: notasVal })
              .eq('id', pet.id);

            if (updError) throw updError;

            pet.notas = notasVal;
            showToast(`Notas clínicas de ${pet.nombre} actualizadas.`, 'success');
            await cargarMascotas();
          } catch (err) {
            console.error('[mascotas] Error al guardar notas:', err);
            showToast('Error al guardar notas clínicas: ' + (err.message || 'Error'), 'danger');
          } finally {
            btn.disabled = false;
            btn.textContent = '💾 Guardar Notas Clínicas';
          }
        });
      }

      // Evento para saltar a la ficha del cliente
      drawerBody.querySelectorAll('.btn-drawer-jump-client').forEach(btn => {
        btn.addEventListener('click', () => {
          const cId = btn.getAttribute('data-client-id');
          closeDrawer('drawerMascota');
          if (window.adminClientes && window.adminClientes.abrirFicha) {
            window.adminClientes.abrirFicha(cId);
          }
        });
      });

    } catch (err) {
      console.error('[mascotas] Error al abrir ficha:', err);
      drawerBody.innerHTML = '<div style="padding: 1.5rem; color: var(--danger-text);">Error al consultar historia clínica.</div>';
    }
  }

  function inicializarMascotas() {
    document.getElementById('mascotasBusquedaInput')?.addEventListener('input', (e) => {
      filtroBusqueda = e.target.value;
      filtrarYRenderizarMascotas();
    });

    document.getElementById('mascotasFiltroEspecie')?.addEventListener('change', (e) => {
      filtroEspecie = e.target.value;
      filtrarYRenderizarMascotas();
    });

    document.getElementById('btnRefreshMascotas')?.addEventListener('click', () => {
      cargarMascotas();
      showToast('Fichas de mascotas actualizadas.', 'info');
    });

    document.getElementById('btnCerrarDrawerMascota')?.addEventListener('click', () => {
      closeDrawer('drawerMascota');
    });
  }

  document.addEventListener('admin:ready', () => {
    inicializarMascotas();
    cargarMascotas();
  });

  window.adminMascotas = {
    recargar: cargarMascotas,
    abrirFichaMascota
  };
})();
