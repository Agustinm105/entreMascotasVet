# Entre Mascotas - contexto técnico

## Stack
- Sitio estático: HTML + CSS + JS, sin framework ni build. Netlify publica desde GitHub.
- Backend: Supabase (Postgres, Auth con Google, Storage). Cliente: @supabase/supabase-js v2 por CDN con versión fija.
- Pagos: Mercado Pago Checkout Pro mediante dos Edge Functions de Supabase (crear-pago y mp-webhook). El navegador nunca habla directo con Mercado Pago.
- Esquema definitivo de la base: supabase/setup.sql. Si hace falta una tabla o columna nueva, no la inventes: avisá y proponé el SQL.

## Roles
- cliente (por defecto), empleado (solo lectura en el panel), admin (el dueño, todo). Se guardan en perfiles.rol.
- La seguridad real la dan las políticas RLS de la base. Esconder botones en la interfaz es solo comodidad.

## Reglas de código
1. En el frontend va solo la clave pública (publishable/anon). Jamás service_role, secretos de Google ni el token de Mercado Pago: ni en código, ni en comentarios, ni en commits.
2. Precios, totales y stock los calcula la base. Los pedidos se crean solo con rpc('crear_pedido'). Nunca cobrar un total calculado en el navegador.
3. Todo texto que venga de la base o de una persona (nombres, notas, direcciones, nombres de producto) se escapa antes de insertarlo con innerHTML (helper esc()) o se muestra con textContent. El código actual arma HTML con template strings: corregirlo en cada pantalla que se toque.
4. Zona horaria America/Argentina/Buenos_Aires (UTC-3). Los timestamps se guardan en UTC (timestamptz) y se muestran en hora local. Moneda ARS, formato es-AR.
5. Textos de la interfaz en español rioplatense (voseo).
6. Toda llamada a Supabase maneja el error: toast claro para la persona, console.error con el detalle. Sin alert().
7. La tienda conserva su diseño actual (css/styles.css). El panel de administración (carpeta admin/) tiene un diseño propio, totalmente distinto.
8. Sin dependencias nuevas salvo que la fase lo pida. Si agregás una librería por CDN, con versión fija.

## Estados
- pedidos.estado: pendiente_pago = "Pendiente de pago", preparando = "Preparándose", en_camino = "En camino", completado = "Entregado" (si fue envío) o "Retirado" (si fue retiro), cancelado = "Cancelado".
- pedidos.pago_estado: pendiente, aprobado, rechazado. Lo actualiza solo el webhook de Mercado Pago.
- turnos.estado: reservado, confirmado, realizado, cancelado.

## Funciones RPC disponibles (ver supabase/setup.sql)
- crear_pedido(p_items jsonb [{producto_id, cantidad}], p_tipo_entrega 'envio'|'retiro', p_direccion) devuelve el id del pedido.
- cancelar_pedido(p_id), cancelar_turno(p_id).
- cambiar_estado_pedido(p_id, p_estado): solo admin.
- horarios_ocupados(p_servicio, p_fecha) devuelve los timestamps ocupados.
- estadisticas_ventas(p_dias) devuelve un json: solo staff (admin y empleado).

## Estructura objetivo
index.html, css/, js/ (config.js, supabase-client.js, auth.js, etc.), admin/, supabase/setup.sql, docs/CONTEXTO.md
