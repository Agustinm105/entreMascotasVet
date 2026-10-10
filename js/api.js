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
     * Nota: columna servicios.imagen_url (reemplaza a servicios.imagen de la demo).
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
    },

    /**
     * Actualiza datos de contacto o dirección en el perfil de la persona autenticada.
     */
    async actualizarPerfil(userId, updates) {
      try {
        assertClient();
        const { data, error } = await window.sb
          .from('perfiles')
          .update(updates)
          .eq('id', userId)
          .select()
          .maybeSingle();

        if (error) throw error;
        return { data, error: null };
      } catch (error) {
        console.error('[vetApi.actualizarPerfil] Error al actualizar perfil:', error);
        return { data: null, error };
      }
    }
  };

  window.vetApi = vetApi;
})();
