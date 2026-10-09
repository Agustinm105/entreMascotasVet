-- ============================================================================
-- ENTRE MASCOTAS · Base de datos en Supabase
-- Pegalo COMPLETO en Supabase > SQL Editor > New query > Run.
-- Se puede volver a ejecutar sin romper nada (es idempotente).
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 1. TABLAS
-- ----------------------------------------------------------------------------

-- Perfil de cada persona que inicia sesión con Google (clientes, empleados, dueño).
-- El login lo maneja Supabase Auth (tabla auth.users); acá guardamos los datos extra y el rol.
create table if not exists public.perfiles (
  id         uuid primary key references auth.users(id) on delete cascade,
  email      text not null unique,
  nombre     text,
  apellido   text,
  telefono   text,
  direccion  text,
  avatar_url text,
  rol        text not null default 'cliente' check (rol in ('cliente','empleado','admin')),
  creado_en  timestamptz not null default now()
);

create table if not exists public.categorias (
  id          bigint generated always as identity primary key,
  nombre      text not null unique,
  descripcion text
);

create table if not exists public.productos (
  id           bigint generated always as identity primary key,
  categoria_id bigint not null references public.categorias(id),
  nombre       text not null,
  descripcion  text,
  precio       numeric(10,2) not null check (precio >= 0),
  stock        integer not null default 0 check (stock >= 0),
  imagen_url   text,
  activo       boolean not null default true,
  creado_en    timestamptz not null default now()
);

create table if not exists public.servicios (
  id           bigint generated always as identity primary key,
  nombre       text not null,
  descripcion  text,
  duracion_min integer not null check (duracion_min > 0),
  precio       numeric(10,2) not null check (precio >= 0),
  icono        text,
  imagen_url   text,
  activo       boolean not null default true
);

-- Ficha de mascota: siempre pertenece a un cliente (relación con perfiles).
create table if not exists public.mascotas (
  id               bigint generated always as identity primary key,
  cliente_id       uuid not null references public.perfiles(id) on delete cascade,
  nombre           text not null,
  especie          text not null default 'perro' check (especie in ('perro','gato','otro')),
  raza             text,
  sexo             text check (sexo in ('macho','hembra')),
  fecha_nacimiento date,
  peso_kg          numeric(5,2) check (peso_kg > 0),
  castrado         boolean,
  notas            text,
  creado_en        timestamptz not null default now()
);

create table if not exists public.turnos (
  id          bigint generated always as identity primary key,
  cliente_id  uuid   not null references public.perfiles(id),
  mascota_id  bigint not null references public.mascotas(id),
  servicio_id bigint not null references public.servicios(id),
  fecha_hora  timestamptz not null,
  estado      text not null default 'reservado'
              check (estado in ('reservado','confirmado','cancelado','realizado')),
  notas       text,
  creado_en   timestamptz not null default now()
);

create table if not exists public.pedidos (
  id              bigint generated always as identity primary key,
  cliente_id      uuid not null references public.perfiles(id),
  fecha           timestamptz not null default now(),
  tipo_entrega    text not null check (tipo_entrega in ('envio','retiro')),
  direccion_envio text,
  -- pendiente_pago -> preparando -> en_camino (solo envíos) -> completado | cancelado
  estado          text not null default 'pendiente_pago'
                  check (estado in ('pendiente_pago','preparando','en_camino','completado','cancelado')),
  pago_estado     text not null default 'pendiente'
                  check (pago_estado in ('pendiente','aprobado','rechazado')),
  mp_preference_id text,
  mp_payment_id    text,
  total           numeric(10,2) not null default 0 check (total >= 0)
);

create table if not exists public.detalle_pedido (
  id              bigint generated always as identity primary key,
  pedido_id       bigint  not null references public.pedidos(id) on delete cascade,
  producto_id     bigint  not null references public.productos(id),
  cantidad        integer not null check (cantidad > 0),
  precio_unitario numeric(10,2) not null check (precio_unitario >= 0)
);

-- Índices
create index if not exists idx_productos_categoria on public.productos(categoria_id);
create index if not exists idx_mascotas_cliente    on public.mascotas(cliente_id);
create index if not exists idx_turnos_fecha        on public.turnos(fecha_hora);
create index if not exists idx_turnos_cliente      on public.turnos(cliente_id);
create index if not exists idx_pedidos_cliente     on public.pedidos(cliente_id);
create index if not exists idx_pedidos_fecha       on public.pedidos(fecha);
create index if not exists idx_detalle_pedido      on public.detalle_pedido(pedido_id);
-- Evita que dos personas reserven el mismo servicio en el mismo horario
create unique index if not exists turnos_horario_unico
  on public.turnos(servicio_id, fecha_hora) where estado <> 'cancelado';

-- ----------------------------------------------------------------------------
-- 2. FUNCIONES AUXILIARES DE ROL
-- ----------------------------------------------------------------------------
create or replace function public.rol_actual()
returns text language sql stable security definer set search_path = public as $$
  select rol from public.perfiles where id = auth.uid()
$$;

create or replace function public.es_admin()
returns boolean language sql stable security definer set search_path = public as $$
  select coalesce(public.rol_actual() = 'admin', false)
$$;

-- "Staff" = dueño + empleados (los dos pueden VER el panel; solo el dueño modifica)
create or replace function public.es_staff()
returns boolean language sql stable security definer set search_path = public as $$
  select coalesce(public.rol_actual() in ('admin','empleado'), false)
$$;

-- ----------------------------------------------------------------------------
-- 3. PERFIL AUTOMÁTICO AL REGISTRARSE CON GOOGLE + PROTECCIÓN DEL ROL
-- ----------------------------------------------------------------------------
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  v_full text := coalesce(new.raw_user_meta_data->>'full_name', new.raw_user_meta_data->>'name', '');
  v_first text := split_part(v_full, ' ', 1);
begin
  insert into public.perfiles (id, email, nombre, apellido, avatar_url)
  values (
    new.id,
    new.email,
    coalesce(nullif(new.raw_user_meta_data->>'given_name', ''), nullif(v_first, '')),
    coalesce(nullif(new.raw_user_meta_data->>'family_name', ''),
             nullif(btrim(substr(v_full, length(v_first) + 1)), '')),
    coalesce(new.raw_user_meta_data->>'avatar_url', new.raw_user_meta_data->>'picture')
  )
  on conflict (id) do nothing;
  return new;
end $$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- Solo el dueño puede cambiar roles, y nadie puede cambiarse el rol a sí mismo.
-- (Desde el SQL Editor de Supabase sí se puede: sirve para nombrar al primer dueño.)
create or replace function public.proteger_rol()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if new.rol is distinct from old.rol and auth.uid() is not null then
    if not public.es_admin() then
      raise exception 'Solo el dueño puede cambiar roles';
    end if;
    if old.id = auth.uid() then
      raise exception 'No podés cambiar tu propio rol';
    end if;
  end if;
  return new;
end $$;

drop trigger if exists proteger_rol on public.perfiles;
create trigger proteger_rol
  before update on public.perfiles
  for each row execute function public.proteger_rol();

-- ----------------------------------------------------------------------------
-- 4. SEGURIDAD (Row Level Security)
--    Cliente: solo ve y toca lo suyo · Empleado: ve todo, no modifica · Dueño: todo
-- ----------------------------------------------------------------------------
alter table public.perfiles       enable row level security;
alter table public.categorias     enable row level security;
alter table public.productos      enable row level security;
alter table public.servicios      enable row level security;
alter table public.mascotas       enable row level security;
alter table public.turnos         enable row level security;
alter table public.pedidos        enable row level security;
alter table public.detalle_pedido enable row level security;

-- perfiles
drop policy if exists perfiles_select on public.perfiles;
create policy perfiles_select on public.perfiles for select to authenticated
  using (id = auth.uid() or public.es_staff());
drop policy if exists perfiles_update on public.perfiles;
create policy perfiles_update on public.perfiles for update to authenticated
  using (id = auth.uid() or public.es_admin())
  with check (id = auth.uid() or public.es_admin());

-- categorias (públicas para leer; solo el dueño escribe)
drop policy if exists categorias_select on public.categorias;
create policy categorias_select on public.categorias for select to anon, authenticated using (true);
drop policy if exists categorias_admin on public.categorias;
create policy categorias_admin on public.categorias for all to authenticated
  using (public.es_admin()) with check (public.es_admin());

-- productos
drop policy if exists productos_select on public.productos;
create policy productos_select on public.productos for select to anon, authenticated
  using (activo or public.es_staff());
drop policy if exists productos_admin on public.productos;
create policy productos_admin on public.productos for all to authenticated
  using (public.es_admin()) with check (public.es_admin());

-- servicios
drop policy if exists servicios_select on public.servicios;
create policy servicios_select on public.servicios for select to anon, authenticated
  using (activo or public.es_staff());
drop policy if exists servicios_admin on public.servicios;
create policy servicios_admin on public.servicios for all to authenticated
  using (public.es_admin()) with check (public.es_admin());

-- mascotas
drop policy if exists mascotas_select on public.mascotas;
create policy mascotas_select on public.mascotas for select to authenticated
  using (cliente_id = auth.uid() or public.es_staff());
drop policy if exists mascotas_insert on public.mascotas;
create policy mascotas_insert on public.mascotas for insert to authenticated
  with check (cliente_id = auth.uid() or public.es_admin());
drop policy if exists mascotas_update on public.mascotas;
create policy mascotas_update on public.mascotas for update to authenticated
  using (cliente_id = auth.uid() or public.es_admin())
  with check (cliente_id = auth.uid() or public.es_admin());
drop policy if exists mascotas_delete on public.mascotas;
create policy mascotas_delete on public.mascotas for delete to authenticated
  using (cliente_id = auth.uid() or public.es_admin());

-- turnos (el cliente cancela con cancelar_turno(); el dueño cambia estados)
drop policy if exists turnos_select on public.turnos;
create policy turnos_select on public.turnos for select to authenticated
  using (cliente_id = auth.uid() or public.es_staff());
drop policy if exists turnos_insert on public.turnos;
create policy turnos_insert on public.turnos for insert to authenticated
  with check (
    (cliente_id = auth.uid()
      and estado = 'reservado'
      and exists (select 1 from public.mascotas m where m.id = mascota_id and m.cliente_id = auth.uid()))
    or public.es_admin()
  );
drop policy if exists turnos_update on public.turnos;
create policy turnos_update on public.turnos for update to authenticated
  using (public.es_admin()) with check (public.es_admin());

-- pedidos y detalle (se crean SOLO con crear_pedido(); el estado lo cambia el dueño con cambiar_estado_pedido())
drop policy if exists pedidos_select on public.pedidos;
create policy pedidos_select on public.pedidos for select to authenticated
  using (cliente_id = auth.uid() or public.es_staff());
drop policy if exists detalle_select on public.detalle_pedido;
create policy detalle_select on public.detalle_pedido for select to authenticated
  using (
    public.es_staff()
    or exists (select 1 from public.pedidos p where p.id = pedido_id and p.cliente_id = auth.uid())
  );

-- ----------------------------------------------------------------------------
-- 5. FUNCIONES DE NEGOCIO (corren en el servidor: el precio y el stock nunca los decide el navegador)
-- ----------------------------------------------------------------------------

-- Crea el pedido, valida stock y precios reales, descuenta stock y devuelve el id.
-- p_items: [{"producto_id": 1, "cantidad": 2}, ...]
create or replace function public.crear_pedido(
  p_items jsonb, p_tipo_entrega text, p_direccion text default null
) returns bigint language plpgsql security definer set search_path = public as $$
declare
  v_uid uuid := auth.uid();
  v_pedido_id bigint;
  v_total numeric(10,2) := 0;
  v_item record;
  v_prod record;
begin
  if v_uid is null then raise exception 'Tenés que iniciar sesión'; end if;
  if p_tipo_entrega not in ('envio','retiro') then raise exception 'Tipo de entrega inválido'; end if;
  if p_tipo_entrega = 'envio' and coalesce(btrim(p_direccion), '') = '' then
    raise exception 'Falta la dirección de envío';
  end if;
  if jsonb_typeof(p_items) is distinct from 'array' or jsonb_array_length(p_items) = 0 then
    raise exception 'El carrito está vacío';
  end if;

  insert into public.pedidos (cliente_id, tipo_entrega, direccion_envio)
  values (v_uid, p_tipo_entrega, case when p_tipo_entrega = 'envio' then btrim(p_direccion) end)
  returning id into v_pedido_id;

  for v_item in
    select (e->>'producto_id')::bigint as producto_id, (e->>'cantidad')::integer as cantidad
    from jsonb_array_elements(p_items) as e
  loop
    if v_item.producto_id is null or v_item.cantidad is null or v_item.cantidad <= 0 then
      raise exception 'Producto o cantidad inválidos';
    end if;
    select * into v_prod from public.productos
      where id = v_item.producto_id and activo for update;
    if not found then raise exception 'Un producto del carrito ya no está disponible'; end if;
    if v_prod.stock < v_item.cantidad then
      raise exception 'Stock insuficiente de "%" (quedan %)', v_prod.nombre, v_prod.stock;
    end if;
    update public.productos set stock = stock - v_item.cantidad where id = v_prod.id;
    insert into public.detalle_pedido (pedido_id, producto_id, cantidad, precio_unitario)
      values (v_pedido_id, v_prod.id, v_item.cantidad, v_prod.precio);
    v_total := v_total + v_prod.precio * v_item.cantidad;
  end loop;

  update public.pedidos set total = v_total where id = v_pedido_id;
  return v_pedido_id;
end $$;

-- Cancela un pedido y devuelve el stock. El cliente solo puede cancelar si todavía no pagó.
create or replace function public.cancelar_pedido(p_id bigint)
returns void language plpgsql security definer set search_path = public as $$
declare v_p public.pedidos;
begin
  select * into v_p from public.pedidos where id = p_id for update;
  if not found then raise exception 'Pedido inexistente'; end if;
  if not (public.es_admin() or (v_p.cliente_id = auth.uid() and v_p.estado = 'pendiente_pago')) then
    raise exception 'No autorizado';
  end if;
  if v_p.estado in ('cancelado','completado') then
    raise exception 'El pedido ya está %', v_p.estado;
  end if;
  update public.productos p set stock = p.stock + d.cantidad
    from public.detalle_pedido d where d.pedido_id = p_id and p.id = d.producto_id;
  update public.pedidos set estado = 'cancelado' where id = p_id;
end $$;

-- El dueño cambia el estado de un pedido (si lo cancela, devuelve el stock).
create or replace function public.cambiar_estado_pedido(p_id bigint, p_estado text)
returns void language plpgsql security definer set search_path = public as $$
begin
  if not public.es_admin() then raise exception 'No autorizado'; end if;
  if p_estado not in ('preparando','en_camino','completado','cancelado') then
    raise exception 'Estado inválido';
  end if;
  if p_estado = 'cancelado' then
    perform public.cancelar_pedido(p_id);
  else
    update public.pedidos set estado = p_estado where id = p_id and estado <> 'cancelado';
  end if;
end $$;

-- El cliente cancela su propio turno.
create or replace function public.cancelar_turno(p_id bigint)
returns void language plpgsql security definer set search_path = public as $$
begin
  update public.turnos set estado = 'cancelado'
  where id = p_id
    and estado in ('reservado','confirmado')
    and (cliente_id = auth.uid() or public.es_admin());
  if not found then raise exception 'No se pudo cancelar el turno'; end if;
end $$;

-- Horarios ya tomados de un servicio en un día (sin exponer datos de otros clientes).
create or replace function public.horarios_ocupados(p_servicio bigint, p_fecha date)
returns setof timestamptz language sql stable security definer set search_path = public as $$
  select fecha_hora from public.turnos
  where servicio_id = p_servicio
    and estado <> 'cancelado'
    and (fecha_hora at time zone 'America/Argentina/Buenos_Aires')::date = p_fecha
$$;

-- Estadísticas básicas para el panel (dueño y empleados).
create or replace function public.estadisticas_ventas(p_dias integer default 30)
returns jsonb language plpgsql stable security definer set search_path = public as $$
declare
  tz constant text := 'America/Argentina/Buenos_Aires';
  v_desde timestamptz :=
    (date_trunc('day', now() at time zone tz) - make_interval(days => greatest(p_dias, 1) - 1)) at time zone tz;
  v_res jsonb;
begin
  if not public.es_staff() then raise exception 'No autorizado'; end if;

  select jsonb_build_object(
    'ventas_total',     coalesce(sum(total), 0),
    'cantidad_pedidos', count(*),
    'ticket_promedio',  coalesce(round(avg(total), 2), 0)
  ) into v_res
  from public.pedidos
  where pago_estado = 'aprobado' and estado <> 'cancelado' and fecha >= v_desde;

  v_res := v_res || jsonb_build_object(
    'ventas_por_dia', coalesce((
      select jsonb_agg(jsonb_build_object('dia', x.dia, 'total', x.total) order by x.dia)
      from (
        select (fecha at time zone tz)::date as dia, sum(total) as total
        from public.pedidos
        where pago_estado = 'aprobado' and estado <> 'cancelado' and fecha >= v_desde
        group by 1
      ) x), '[]'::jsonb),
    'top_productos', coalesce((
      select jsonb_agg(jsonb_build_object('nombre', y.nombre, 'unidades', y.unidades) order by y.unidades desc)
      from (
        select pr.nombre, sum(d.cantidad)::integer as unidades
        from public.detalle_pedido d
        join public.pedidos p on p.id = d.pedido_id
        join public.productos pr on pr.id = d.producto_id
        where p.pago_estado = 'aprobado' and p.estado <> 'cancelado' and p.fecha >= v_desde
        group by pr.id, pr.nombre
        order by 2 desc limit 5
      ) y), '[]'::jsonb),
    'bajo_stock', coalesce((
      select jsonb_agg(jsonb_build_object('id', z.id, 'nombre', z.nombre, 'stock', z.stock) order by z.stock)
      from (select id, nombre, stock from public.productos where activo and stock <= 5 order by stock limit 10) z
    ), '[]'::jsonb),
    'turnos_por_estado', coalesce((
      select jsonb_object_agg(estado, n)
      from (select estado, count(*) as n from public.turnos where fecha_hora >= v_desde group by estado) t
    ), '{}'::jsonb),
    'total_clientes', (select count(*) from public.perfiles where rol = 'cliente'),
    'total_mascotas', (select count(*) from public.mascotas)
  );
  return v_res;
end $$;

-- ----------------------------------------------------------------------------
-- 6. PERMISOS DE LA API (explícitos, para que funcione igual en cualquier proyecto nuevo)
-- ----------------------------------------------------------------------------
grant usage on schema public to anon, authenticated;

grant select on public.categorias, public.productos, public.servicios to anon, authenticated;
grant insert, update, delete on public.categorias, public.productos, public.servicios to authenticated;

grant select on public.perfiles to authenticated;
revoke update on public.perfiles from authenticated;
grant update (nombre, apellido, telefono, direccion, rol) on public.perfiles to authenticated;

grant select, insert, update, delete on public.mascotas to authenticated;
grant select, insert, update on public.turnos to authenticated;
grant select on public.pedidos, public.detalle_pedido to authenticated;

revoke execute on all functions in schema public from public, anon, authenticated;
grant execute on function public.rol_actual(), public.es_admin(), public.es_staff() to anon, authenticated;
grant execute on function public.horarios_ocupados(bigint, date) to anon, authenticated;
grant execute on function
  public.crear_pedido(jsonb, text, text),
  public.cancelar_pedido(bigint),
  public.cambiar_estado_pedido(bigint, text),
  public.cancelar_turno(bigint),
  public.estadisticas_ventas(integer)
  to authenticated;

-- ----------------------------------------------------------------------------
-- 7. IMÁGENES DE PRODUCTOS (Storage): públicas para ver, solo el dueño sube/borra
-- ----------------------------------------------------------------------------
insert into storage.buckets (id, name, public)
values ('productos', 'productos', true)
on conflict (id) do nothing;

drop policy if exists "productos_img_lectura" on storage.objects;
create policy "productos_img_lectura" on storage.objects for select
  using (bucket_id = 'productos');
drop policy if exists "productos_img_admin" on storage.objects;
create policy "productos_img_admin" on storage.objects for all to authenticated
  using (bucket_id = 'productos' and public.es_admin())
  with check (bucket_id = 'productos' and public.es_admin());

-- ----------------------------------------------------------------------------
-- 8. DATOS INICIALES (solo si las tablas están vacías)
-- ----------------------------------------------------------------------------
insert into public.categorias (nombre, descripcion) values
  ('Comida',     'Alimento balanceado, húmedo y snacks nutritivos'),
  ('Limpieza',   'Shampoo, cepillos, toallitas y productos de higiene'),
  ('Juguetes',   'Pelotas, mordillos y juguetes interactivos'),
  ('Correas',    'Correas, collares ergonómicos y pecheras reforzadas'),
  ('Accesorios', 'Camas térmicas, comederos de acero, ropa y mantas')
on conflict (nombre) do nothing;

do $$
begin
  if not exists (select 1 from public.servicios) then
    insert into public.servicios (nombre, descripcion, duracion_min, precio, icono, imagen_url) values
      ('Baño y Desinfección', 'Baño terapéutico hipoalergénico, secado profesional con turbina, limpieza de oídos y corte de uñas.', 60, 8500, '🛁', 'assets/images/grooming.jpg'),
      ('Peluquería Canina y Felina', 'Corte de raza o higiénico a tijera/máquina, deslanado profundo, cepillado y perfume frutal suave.', 90, 11500, '✂️', 'assets/images/grooming.jpg'),
      ('Consulta Veterinaria General', 'Chequeo físico integral, auscultación cardíaca y pulmonar, pesaje, control dental y plan preventivo.', 30, 9000, '🩺', 'assets/images/consultation.jpg'),
      ('Vacunación y Desparasitación', 'Aplicación de esquemas quíntuple/séxtuple, antirrábica, antiparasitarios internos y libreta sanitaria.', 25, 7500, '💉', 'assets/images/consultation.jpg');
  end if;

  if not exists (select 1 from public.productos) then
    insert into public.productos (categoria_id, nombre, descripcion, precio, stock, imagen_url) values
      ((select id from public.categorias where nombre = 'Comida'),     'Alimento Royal Canin Maxi Adult 15kg', 'Nutrición óptima con proteínas de alta digestibilidad y soporte osteoarticular para perros grandes.', 48900, 14, 'https://images.unsplash.com/photo-1589924691995-400dc9ecc119?w=600&auto=format&fit=crop&q=80'),
      ((select id from public.categorias where nombre = 'Comida'),     'Snacks Dentales Hills Prescription Dental Care', 'Premios crocantes clínicamente probados para reducir sarro, placa bacteriana y refrescar el aliento.', 6800, 28, 'https://images.unsplash.com/photo-1568640347023-a616a30bc3bd?w=600&auto=format&fit=crop&q=80'),
      ((select id from public.categorias where nombre = 'Limpieza'),   'Shampoo Avena & Aloe Vera Orgánico 500ml', 'Fórmula hidratante calmante para pieles sensibles, alivia picores y deja pelaje sedoso y brillante.', 5200, 19, 'https://images.unsplash.com/photo-1583947215259-38e31be8751f?w=600&auto=format&fit=crop&q=80'),
      ((select id from public.categorias where nombre = 'Juguetes'),   'Pelota Kong Classic con Dispensador de Treats', 'Goma natural ultra resistente anti-mordidas, rebote impredecible para ejercicio mental y físico.', 9500, 22, 'https://images.unsplash.com/photo-1576201836106-db1758fd1c97?w=600&auto=format&fit=crop&q=80'),
      ((select id from public.categorias where nombre = 'Correas'),    'Pechera Ergonómica Reflectiva Acolchada Talle M/L', 'Diseño antitirones con doble anilla de sujeción frontal y trasera, tela transpirable y reflectiva nocturna.', 14200, 12, 'https://images.unsplash.com/photo-1601758228041-f3b2795255f1?w=600&auto=format&fit=crop&q=80'),
      ((select id from public.categorias where nombre = 'Accesorios'), 'Cama Nube Ortopédica Memory Foam 80cm', 'Alivia articulaciones y columna con espuma viscoelástica, funda lavable con cierre y base antideslizante.', 29500, 8, 'https://images.unsplash.com/photo-1541599540903-216a46ca1dc0?w=600&auto=format&fit=crop&q=80'),
      ((select id from public.categorias where nombre = 'Comida'),     'Lata Royal Canin Feline Wet Kitten 85g', 'Textura mousse suave para gatitos de hasta 12 meses y gatas gestantes. Alto aporte calórico.', 3100, 45, 'https://images.unsplash.com/photo-1583337130417-3346a1be7dee?w=600&auto=format&fit=crop&q=80'),
      ((select id from public.categorias where nombre = 'Limpieza'),   'Cepillo Deslanador Cardina Profesional Autolimpiante', 'Remueve hasta un 95% del pelo muerto sin irritar la piel, botón expulsor fácil para una limpieza instantánea.', 6400, 16, 'https://images.unsplash.com/photo-1516734212186-a967f81ad0d7?w=600&auto=format&fit=crop&q=80');
  end if;
end $$;