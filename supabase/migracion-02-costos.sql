-- =============================================================
-- Taller Hawaiira · Actualización 2: bordado, productos nuevos desde Pedidos,
-- materiales, salidas de material, costos y cotizaciones.
-- Ejecutar completo en: Supabase → SQL Editor → New query → Run
-- (se puede correr más de una vez sin problema)
-- =============================================================

-- ---------- Bordado como estación y etapa ----------
alter table public.perfiles drop constraint if exists perfiles_estacion_check;
alter table public.perfiles add constraint perfiles_estacion_check
  check (estacion is null or estacion in ('preprensa','corte','serigrafia','costura','bordado','dtf'));
alter table public.registros drop constraint if exists registros_etapa_check;
alter table public.registros add constraint registros_etapa_check
  check (etapa in ('preprensa','corte','serigrafia','costura','bordado','dtf','empaque'));

-- Tiempos de bordado por defecto (minutos), sin borrar lo que ya está configurado
update public.config
   set data = jsonb_set(data, '{deco}',
       '{"bordadoUbicacion": 8, "prepBordado": 60, "bordadoExternoDias": 5}'::jsonb || coalesce(data->'deco', '{}'::jsonb))
 where id = 1;

-- ---------- Agregar productos desde Pedidos (todos los que crean pedidos) ----------
create or replace function public.agregar_producto(p_clave text, p_nombre text, p_corte numeric, p_costura numeric, p_empaque numeric)
returns void language plpgsql security definer set search_path = public as $$
begin
  if public.mi_rol() not in ('direccion','jefa','admin','compras','diseno') then
    raise exception 'No tienes permiso para agregar productos';
  end if;
  if coalesce(trim(p_nombre), '') = '' or coalesce(trim(p_clave), '') = '' then
    raise exception 'Falta el nombre del producto';
  end if;
  if (select data->'productos' ? p_clave from public.config where id = 1) then
    raise exception 'Ese producto ya existe';
  end if;
  update public.config
     set data = jsonb_set(data, array['productos', p_clave],
                 jsonb_build_object('nombre', trim(p_nombre), 'corte', greatest(0, coalesce(p_corte,0)),
                                    'costura', greatest(0, coalesce(p_costura,0)), 'empaque', greatest(0, coalesce(p_empaque,0)))),
         actualizado = now()
   where id = 1;
end $$;
grant execute on function public.agregar_producto(text, text, numeric, numeric, numeric) to authenticated;
revoke execute on function public.agregar_producto(text, text, numeric, numeric, numeric) from anon;

-- ---------- Materiales ----------
create table if not exists public.materiales (
  id uuid primary key default gen_random_uuid(),
  nombre text not null,
  categoria text not null default 'Otros',
  unidad text not null default 'unidad',
  costo numeric not null default 0 check (costo >= 0),   -- US$ por unidad
  proveedor text default '',
  stock numeric not null default 0,
  activo boolean not null default true,
  creado timestamptz not null default now()
);

-- Materiales iniciales con precio en 0 (se completan en la app)
insert into public.materiales (nombre, categoria, unidad)
select * from (values
  ('Tela jersey algodón (franela)', 'Telas', 'kg'),
  ('Tela piqué (chemise)', 'Telas', 'kg'),
  ('Tela para chaqueta', 'Telas', 'm'),
  ('Forro para chaqueta', 'Telas', 'm'),
  ('Rib / cuello', 'Telas', 'm'),
  ('Hilo de costura', 'Hilos', 'cono'),
  ('Hilo de bordar', 'Hilos', 'cono'),
  ('Etiqueta tejida', 'Avíos', 'unidad'),
  ('Etiqueta de talla', 'Avíos', 'unidad'),
  ('Botón', 'Avíos', 'unidad'),
  ('Cierre', 'Avíos', 'unidad'),
  ('Bolsa de empaque', 'Empaque', 'unidad'),
  ('Tinta plastisol', 'Estampado', 'kg'),
  ('Emulsión y película serigrafía', 'Estampado', 'unidad'),
  ('Film DTF impreso', 'Estampado', 'm'),
  ('Vinil textil', 'Estampado', 'm'),
  ('Entretela para bordado', 'Estampado', 'm')
) as v(nombre, categoria, unidad)
where not exists (select 1 from public.materiales);

-- ---------- Configuración de costos (recetas, mano de obra, indirectos, empresa) ----------
create table if not exists public.costos_config (
  id int primary key default 1 check (id = 1),
  data jsonb not null default '{}'::jsonb,
  actualizado timestamptz not null default now()
);
insert into public.costos_config (id, data) values (1, '{
  "recetas": {},
  "decoMateriales": {"serigrafia": [], "dtf": [], "vinil": [], "bordado": []},
  "bordadoExterno": {"costoPieza": 0},
  "costoHora": {"preprensa": 0, "corte": 0, "serigrafia": 0, "costura": 0, "bordado": 0, "dtf": 0},
  "indirectosMes": 0,
  "margen": 35,
  "anticipo": 50,
  "validezDias": 15,
  "empresa": {"nombre": "Hawaiira Studio", "rif": "", "direccion": "El Hatillo, Caracas, Venezuela", "telefono": "", "correo": ""}
}'::jsonb) on conflict (id) do nothing;

-- ---------- Salidas de material por pedido (costo real) ----------
create table if not exists public.consumos (
  id uuid primary key default gen_random_uuid(),
  orden_id uuid not null references public.ordenes(id) on delete cascade,
  material_id uuid not null references public.materiales(id) on delete restrict,
  cantidad numeric not null check (cantidad > 0),
  costo_unit numeric not null default 0,       -- precio del material en el momento de la salida
  nota text default '',
  persona_id uuid references public.perfiles(id) on delete set null default auth.uid(),
  ts timestamptz not null default now()
);
create index if not exists consumos_orden_idx on public.consumos (orden_id);

-- Cada salida descuenta el stock y guarda el precio del momento
create or replace function public.consumo_stock()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if tg_op = 'INSERT' then
    select costo into new.costo_unit from public.materiales where id = new.material_id;
    update public.materiales set stock = stock - new.cantidad where id = new.material_id;
    return new;
  elsif tg_op = 'DELETE' then
    update public.materiales set stock = stock + old.cantidad where id = old.material_id;
    return old;
  end if;
  return null;
end $$;
drop trigger if exists consumos_stock_ins on public.consumos;
create trigger consumos_stock_ins before insert on public.consumos for each row execute function public.consumo_stock();
drop trigger if exists consumos_stock_del on public.consumos;
create trigger consumos_stock_del after delete on public.consumos for each row execute function public.consumo_stock();

-- ---------- Cotizaciones ----------
create table if not exists public.cotizaciones (
  id uuid primary key default gen_random_uuid(),
  numero text unique not null,
  cliente text not null,
  contacto text default '',
  items jsonb not null default '[]'::jsonb,
  notas text default '',
  estado text not null default 'borrador' check (estado in ('borrador','enviada','aprobada','rechazada')),
  validez date,
  fecha_entrega date,
  total numeric default 0,
  ordenes jsonb not null default '[]'::jsonb,   -- pedidos creados al aprobarla
  creado_por uuid references public.perfiles(id) on delete set null default auth.uid(),
  creado timestamptz not null default now()
);

-- ---------- Seguridad por filas ----------
alter table public.materiales    enable row level security;
alter table public.costos_config enable row level security;
alter table public.consumos      enable row level security;
alter table public.cotizaciones  enable row level security;

-- Materiales: los ven y editan Dirección, Jefe(a) de taller, Administración y Compras
drop policy if exists "materiales_leer" on public.materiales;
create policy "materiales_leer" on public.materiales for select to authenticated
  using (public.mi_rol() in ('direccion','jefa','admin','compras'));
drop policy if exists "materiales_crear" on public.materiales;
create policy "materiales_crear" on public.materiales for insert to authenticated
  with check (public.mi_rol() in ('direccion','jefa','admin','compras'));
drop policy if exists "materiales_editar" on public.materiales;
create policy "materiales_editar" on public.materiales for update to authenticated
  using (public.mi_rol() in ('direccion','jefa','admin','compras'))
  with check (public.mi_rol() in ('direccion','jefa','admin','compras'));
drop policy if exists "materiales_borrar" on public.materiales;
create policy "materiales_borrar" on public.materiales for delete to authenticated
  using (public.mi_rol() in ('direccion','admin'));

-- Costos y cotizaciones: solo Dirección, Jefe(a) de taller y Administración
drop policy if exists "costos_leer" on public.costos_config;
create policy "costos_leer" on public.costos_config for select to authenticated
  using (public.mi_rol() in ('direccion','jefa','admin'));
drop policy if exists "costos_editar" on public.costos_config;
create policy "costos_editar" on public.costos_config for update to authenticated
  using (public.mi_rol() in ('direccion','jefa','admin')) with check (public.mi_rol() in ('direccion','jefa','admin'));

drop policy if exists "cotizaciones_todo" on public.cotizaciones;
create policy "cotizaciones_todo" on public.cotizaciones for all to authenticated
  using (public.mi_rol() in ('direccion','jefa','admin')) with check (public.mi_rol() in ('direccion','jefa','admin'));

-- Salidas de material: las registran Dirección, Jefe(a), Administración y Compras
drop policy if exists "consumos_leer" on public.consumos;
create policy "consumos_leer" on public.consumos for select to authenticated
  using (public.mi_rol() in ('direccion','jefa','admin','compras'));
drop policy if exists "consumos_crear" on public.consumos;
create policy "consumos_crear" on public.consumos for insert to authenticated
  with check (public.mi_rol() in ('direccion','jefa','admin','compras'));
drop policy if exists "consumos_borrar" on public.consumos;
create policy "consumos_borrar" on public.consumos for delete to authenticated
  using (public.mi_rol() in ('direccion','jefa','admin'));

-- ---------- Tiempo real ----------
do $$ begin
  begin alter publication supabase_realtime add table public.materiales;    exception when duplicate_object then null; end;
  begin alter publication supabase_realtime add table public.consumos;      exception when duplicate_object then null; end;
  begin alter publication supabase_realtime add table public.costos_config; exception when duplicate_object then null; end;
  begin alter publication supabase_realtime add table public.cotizaciones;  exception when duplicate_object then null; end;
end $$;
