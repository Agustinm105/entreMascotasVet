// ============================================================================
// Entre Mascotas · Capa de Datos API (Supabase Client Wrapper)
// Conecta la aplicación con la base de datos real en Supabase
// ============================================================================

(function () {
  'use strict';

  // Helper para escapar HTML y prevenir XSS (docs/CONTEXTO.md - Regla 3)
  function esc(str) {
    if (str === null || str === undefined) return '';
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  // Exponer helper global
  window.esc = esc;

  // Validación de cliente Supabase
  function assertClient() {
    if (!window.sb) {
      throw new Error('El cliente de Supabase no está inicializado.');
    }
  }

  const vetApi = {
    esc,

    // ==========================================
    // 1. TIENDA Y CATÁLOGO
    // ==========================================

    /**
     * Obtiene la lista completa de categorías.
     */
    async getCategorias() {
      try {
        assertClient();
        const { data, error } = await window.sb
          .from('categorias')
          .select('*')
          .order('id', { ascending: true });

        if (error) throw error;
        return { data: data || [], error: null };
      } catch (error) {
        console.error('[vetApi.getCategorias] Error al obtener categorías:', error);
        return { data: null, error };
      }
    },

    /**
     * Obtiene los productos activos con el nombre de su categoría asociada.
     * Solo lee productos activos (la política RLS además lo asegura para clientes).
     */
    async getProductos() {
      try {
        assertClient();
        const { data, error } = await window.sb
          .from('productos')
          .select('*, categorias(nombre)')
          .eq('activo', true)
          .order('id', { ascending: true });

        if (error) throw error;
        return { data: data || [], error: null };
      } catch (error) {
        console.error('[vetApi.getProductos] Error al obtener productos:', error);
        return { data: null, error };
      }
    },

    /**
     * Obtiene los servicios veterinarios activos.
     * Nota: columna servicios.imagen_url.
     */
    async getServicios() {
      try {
        assertClient();
        const { data, error } = await window.sb
          .from('servicios')
          .select('*')
          .eq('activo', true)
          .order('id', { ascending: true });

        if (error) throw error;
        return { data: data || [], error: null };
      } catch (error) {
        console.error('[vetApi.getServicios] Error al obtener servicios:', error);
        return { data: null, error };
      }
    },

    /**
     * Consulta productos específicos para revalidación del carrito.
     */
    async getProductosParaCarrito(ids) {
      if (!Array.isArray(ids) || ids.length === 0) {
        return { data: [], error: null };
      }
      try {
        assertClient();
        const { data, error } = await window.sb
          .from('productos')
          .select('id, categoria_id, nombre, descripcion, precio, stock, imagen_url, activo')
          .in('id', ids);

        if (error) throw error;
        return { data: data || [], error: null };
      } catch (error) {
        console.error('[vetApi.getProductosParaCarrito] Error al revalidar productos:', error);
        return { data: null, error };
      }
    },

    // ==========================================
    // 2. PERFIL DE USUARIO
    // ==========================================

    /**
     * Obtiene el perfil de un usuario por id.
     */
    async getPerfil(userId) {
      try {
        assertClient();
        const { data, error } = await window.sb
          .from('perfiles')
          .select('*')
          .eq('id', userId)
          .maybeSingle();

        if (error) throw error;
        return { data, error: null };
      } catch (error) {
        console.error('[vetApi.getPerfil] Error al obtener perfil:', error);
        return { data: null, error };
      }
    },

    /**
     * Actualiza datos de perfil (nombre, apellido, teléfono, dirección).
     * No modifica el rol.
     */
    async actualizarPerfil(userId, updates) {
      try {
        assertClient();
        // Filtrar estrictamente solo los campos permitidos para clientes
        const payload = {};
        if (updates.nombre !== undefined) payload.nombre = updates.nombre ? String(updates.nombre).trim() : null;
        if (updates.apellido !== undefined) payload.apellido = updates.apellido ? String(updates.apellido).trim() : null;
        if (updates.telefono !== undefined) payload.telefono = updates.telefono ? String(updates.telefono).trim() : null;
        if (updates.direccion !== undefined) payload.direccion = updates.direccion ? String(updates.direccion).trim() : null;

        const { data, error } = await window.sb
          .from('perfiles')
          .update(payload)
          .eq('id', userId)
          .select()
          .maybeSingle();

        if (error) throw error;
        return { data, error: null };
      } catch (error) {
        console.error('[vetApi.actualizarPerfil] Error al actualizar perfil:', error);
        return { data: null, error };
      }
    },

    // ==========================================
    // 3. FICHAS DE MASCOTAS
    // ==========================================

    /**
     * Lista todas las mascotas del usuario autenticado.
     */
    async getMisMascotas() {
      try {
        assertClient();
        const { data, error } = await window.sb
          .from('mascotas')
          .select('*')
          .order('id', { ascending: true });

        if (error) throw error;
        return { data: data || [], error: null };
      } catch (error) {
        console.error('[vetApi.getMisMascotas] Error al obtener mascotas:', error);
        return { data: null, error };
      }
    },

    /**
     * Crea una nueva ficha de mascota asociada al cliente autenticado.
     * @param {Object} mascotaData
     */
    async crearMascota(mascotaData) {
      try {
        assertClient();
        const user = window.vetAuth?.session?.user;
        if (!user) throw new Error('Tenés que iniciar sesión para registrar una mascota.');

        const payload = {
          cliente_id: user.id,
          nombre: String(mascotaData.nombre || '').trim(),
          especie: mascotaData.especie,
          raza: mascotaData.raza ? String(mascotaData.raza).trim() : null,
          sexo: mascotaData.sexo || null,
          fecha_nacimiento: mascotaData.fecha_nacimiento || null,
          peso_kg: mascotaData.peso_kg ? Number(mascotaData.peso_kg) : null,
          castrado: mascotaData.castrado === true ? true : (mascotaData.castrado === false ? false : null),
          notas: mascotaData.notas ? String(mascotaData.notas).trim() : null
        };

        if (!payload.nombre) throw new Error('El nombre de la mascota es obligatorio.');
        if (!payload.especie || !['perro', 'gato', 'otro'].includes(payload.especie)) {
          throw new Error('La especie es obligatoria (perro, gato u otro).');
        }

        const { data, error } = await window.sb
          .from('mascotas')
          .insert(payload)
          .select()
          .single();

        if (error) throw error;
        return { data, error: null };
      } catch (error) {
        console.error('[vetApi.crearMascota] Error al crear mascota:', error);
        return { data: null, error };
      }
    },

    /**
     * Actualiza la ficha de una mascota existente.
     * @param {number|string} mascotaId
     * @param {Object} mascotaData
     */
    async actualizarMascota(mascotaId, mascotaData) {
      try {
        assertClient();
        const payload = {
          nombre: String(mascotaData.nombre || '').trim(),
          especie: mascotaData.especie,
          raza: mascotaData.raza ? String(mascotaData.raza).trim() : null,
          sexo: mascotaData.sexo || null,
          fecha_nacimiento: mascotaData.fecha_nacimiento || null,
          peso_kg: mascotaData.peso_kg ? Number(mascotaData.peso_kg) : null,
          castrado: mascotaData.castrado === true ? true : (mascotaData.castrado === false ? false : null),
          notas: mascotaData.notas ? String(mascotaData.notas).trim() : null
        };

        if (!payload.nombre) throw new Error('El nombre de la mascota es obligatorio.');
        if (!payload.especie || !['perro', 'gato', 'otro'].includes(payload.especie)) {
          throw new Error('La especie es obligatoria (perro, gato u otro).');
        }

        const { data, error } = await window.sb
          .from('mascotas')
          .update(payload)
          .eq('id', mascotaId)
          .select()
          .single();

        if (error) throw error;
        return { data, error: null };
      } catch (error) {
        console.error('[vetApi.actualizarMascota] Error al actualizar mascota:', error);
        return { data: null, error };
      }
    },

    /**
     * Elimina una mascota. Si tiene turnos asociados, la base rechaza el borrado.
     * @param {number|string} mascotaId
     */
    async eliminarMascota(mascotaId) {
      try {
        assertClient();
        const { error } = await window.sb
          .from('mascotas')
          .delete()
          .eq('id', mascotaId);

        if (error) {
          // Error 23503 en Postgres = foreign_key_violation (turnos asociados)
          if (error.code === '23503' || String(error.message).includes('foreign key') || String(error.message).includes('turnos')) {
            throw new Error('No se puede eliminar porque tiene turnos asociados');
          }
          throw error;
        }

        return { success: true, error: null };
      } catch (error) {
        console.error('[vetApi.eliminarMascota] Error al eliminar mascota:', error);
        return { success: false, error };
      }
    },

    // ==========================================
    // 4. TURNOS VETERINARIOS
    // ==========================================

    /**
     * Horarios tomados para un servicio en una fecha específica (vía RPC horarios_ocupados).
     * @param {number|string} servicioId
     * @param {string} fecha YYYY-MM-DD
     */
    async getHorariosOcupados(servicioId, fecha) {
      try {
        assertClient();
        const { data, error } = await window.sb.rpc('horarios_ocupados', {
          p_servicio: Number(servicioId),
          p_fecha: fecha
        });

        if (error) throw error;
        return { data: data || [], error: null };
      } catch (error) {
        console.error('[vetApi.getHorariosOcupados] Error al consultar horarios ocupados:', error);
        return { data: [], error };
      }
    },

    /**
     * Lista los turnos de la persona autenticada con su servicio y mascota.
     */
    async getMisTurnos() {
      try {
        assertClient();
        const { data, error } = await window.sb
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
            mascotas (
              id,
              nombre,
              especie,
              raza
            ),
            servicios (
              id,
              nombre,
              icono,
              duracion_min,
              precio
            )
          `)
          .order('fecha_hora', { ascending: true });

        if (error) throw error;
        return { data: data || [], error: null };
      } catch (error) {
        console.error('[vetApi.getMisTurnos] Error al obtener turnos:', error);
        return { data: null, error };
      }
    },

    /**
     * Reserva un turno veterinario.
     * fecha_hora debe venir como ISO con offset -03:00 (ej: 2026-10-15T10:00:00-03:00).
     */
    async crearTurno({ mascotaId, servicioId, fechaHora, notas }) {
      try {
        assertClient();
        const user = window.vetAuth?.session?.user;
        if (!user) throw new Error('Tenés que iniciar sesión para reservar un turno.');

        const payload = {
          cliente_id: user.id,
          mascota_id: Number(mascotaId),
          servicio_id: Number(servicioId),
          fecha_hora: fechaHora,
          estado: 'reservado',
          notas: notas ? String(notas).trim() : null
        };

        const { data, error } = await window.sb
          .from('turnos')
          .insert(payload)
          .select()
          .single();

        if (error) {
          // 23505 = unique_violation (índice turnos_horario_unico)
          if (error.code === '23505' || String(error.message).includes('turnos_horario_unico')) {
            throw new Error('Ese horario se acaba de ocupar, elegí otro');
          }
          throw error;
        }

        return { data, error: null };
      } catch (error) {
        console.error('[vetApi.crearTurno] Error al reservar turno:', error);
        return { data: null, error };
      }
    },

    /**
     * Cancela un turno del cliente mediante RPC cancelar_turno.
     * Solo permitido si está en estado 'reservado' o 'confirmado'.
     */
    async cancelarTurno(turnoId) {
      try {
        assertClient();
        const { data, error } = await window.sb.rpc('cancelar_turno', {
          p_id: Number(turnoId)
        });

        if (error) throw error;
        return { data, error: null };
      } catch (error) {
        console.error('[vetApi.cancelarTurno] Error al cancelar turno:', error);
        return { data: null, error };
      }
    },

    // ==========================================
    // 5. PEDIDOS Y CHECKOUT (Fase 2)
    // ==========================================

    /**
     * Crea un pedido real mediante la función segura de Postgres crear_pedido.
     * NUNCA envía precios ni totales: solo [{ producto_id, cantidad }].
     * @param {Object} params
     * @param {Array<{producto_id: number|string, cantidad: number}>} params.items
     * @param {'envio'|'retiro'} params.tipoEntrega
     * @param {string|null} params.direccion
     */
    async crearPedido({ items, tipoEntrega, direccion }) {
      try {
        assertClient();
        const { data, error } = await window.sb.rpc('crear_pedido', {
          p_items: items,
          p_tipo_entrega: tipoEntrega,
          p_direccion: tipoEntrega === 'envio' ? (direccion || null) : null
        });

        if (error) throw error;
        return { data, error: null }; // data es el id del pedido (bigint)
      } catch (error) {
        console.error('[vetApi.crearPedido] Error al crear pedido:', error);
        return { data: null, error };
      }
    },

    /**
     * Cancela un pedido del cliente y devuelve el stock mediante RPC cancelar_pedido.
     * Solo permitido si está en estado pendiente_pago.
     * @param {number|string} pedidoId
     */
    async cancelarPedido(pedidoId) {
      try {
        assertClient();
        const { data, error } = await window.sb.rpc('cancelar_pedido', {
          p_id: pedidoId
        });

        if (error) throw error;
        return { data, error: null };
      } catch (error) {
        console.error('[vetApi.cancelarPedido] Error al cancelar pedido:', error);
        return { data: null, error };
      }
    },

    /**
     * Invoca la Edge Function de Supabase para generar la preferencia de Mercado Pago.
     * Si no existe o falla, no es un error fatal (se despliega en una fase posterior).
     * @param {number|string} pedidoId
     */
    async crearPago(pedidoId) {
      try {
        assertClient();
        const response = await window.sb.functions.invoke('crear-pago', {
          body: { pedido_id: pedidoId }
        });

        if (response.error) {
          console.warn('[vetApi.crearPago] Edge function crear-pago respondió con error:', response.error);
        }
        return response;
      } catch (error) {
        console.warn('[vetApi.crearPago] Excepción al invocar crear-pago:', error);
        return { data: null, error };
      }
    },

    /**
     * Lista los pedidos de la persona autenticada con su detalle y productos.
     * Más nuevos primero.
     */
    async getMisPedidos() {
      try {
        assertClient();
        const { data, error } = await window.sb
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
            detalle_pedido (
              id,
              producto_id,
              cantidad,
              precio_unitario,
              productos (
                id,
                nombre,
                imagen_url
              )
            )
          `)
          .order('id', { ascending: false });

        if (error) throw error;
        return { data: data || [], error: null };
      } catch (error) {
        console.error('[vetApi.getMisPedidos] Error al obtener pedidos:', error);
        return { data: null, error };
      }
    },

    /**
     * Obtiene un pedido individual por ID (para polling al retornar de Mercado Pago).
     * @param {number|string} pedidoId
     */
    async getPedidoPorId(pedidoId) {
      try {
        assertClient();
        const { data, error } = await window.sb
          .from('pedidos')
          .select('id, cliente_id, fecha, tipo_entrega, direccion_envio, estado, pago_estado, total')
          .eq('id', pedidoId)
          .maybeSingle();

        if (error) throw error;
        return { data, error: null };
      } catch (error) {
        console.error('[vetApi.getPedidoPorId] Error al consultar pedido:', error);
        return { data: null, error };
      }
    }
  };

  window.vetApi = vetApi;
})();
