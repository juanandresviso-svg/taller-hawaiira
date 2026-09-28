-- =============================================================
-- Taller Hawaiira · Esquema de base de datos (Supabase / Postgres)
-- Ejecutar completo en: Supabase → SQL Editor → New query → Run
-- =============================================================

-- ---------- Perfiles (un registro por usuario) ----------
create table if not exists public.perfiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text,
  nombre text not null default '',
  rol text not null default 'operador'
    check (rol in ('direccion','jefa','admin','compras','diseno','operador')),
  estacion text
    check (estacion is null or estacion in ('preprensa','corte','serigrafia','costura','dtf')),
  activo boolean not null default true,
  creado timestamptz not null default now()
);

-- Crea el perfil automáticamente al invitar o crear un usuario.
-- El nombre, rol y estación viajan en los metadatos de la invitación.
create or replace function public.crear_perfil()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.perfiles (id, email, nombre, rol, estacion)
  values (
    new.id,
    new.email,
    coalesce(new.raw_user_meta_data->>'nombre', split_part(new.email, '@', 1)),
    coalesce(nullif(new.raw_user_meta_data->>'rol', ''), 'operador'),
    nullif(new.raw_user_meta_data->>'estacion', '')
  )
  on conflict (id) do nothing;
  return new;
end $$;

drop trigger if exists al_crear_usuario on auth.users;
create trigger al_crear_usuario after insert on auth.users
  for each row execute function public.crear_perfil();

-- Rol del usuario conectado (solo si está activo)
create or replace function public.mi_rol()
returns text language sql stable security definer set search_path = public as $$
  select rol from public.perfiles where id = auth.uid() and activo
$$;

-- ---------- Configuración (una sola fila, id = 1) ----------
create table if not exists public.config (
  id int primary key default 1 check (id = 1),
  data jsonb not null default '{}'::jsonb,
  actualizado timestamptz not null default now()
);
insert into public.config (id, data) values (1, '{
  "horasDia": 8, "eficiencia": 85, "sabado": false, "medidos": false,
  "productos": {
    "franela":  {"nombre": "Franela",  "corte": 1.5, "costura": 10, "empaque": 0.8},
    "chemise":  {"nombre": "Chemise",  "corte": 2.5, "costura": 22, "empaque": 1.2},
    "chaqueta": {"nombre": "Chaqueta", "corte": 5,   "costura": 60, "empaque": 2}
  },
  "deco": {"serigrafiaColor": 0.8, "dtfUbicacion": 1.2, "prepBase": 60, "prepColor": 30, "prepDtf": 45}
}'::jsonb) on conflict (id) do nothing;

-- ---------- Órdenes de producción ----------
create table if not exists public.ordenes (
  id uuid primary key default gen_random_uuid(),
  codigo text unique not null,
  cliente text not null,
  responsable_id uuid references public.perfiles(id) on delete set null,
  producto text not null,
  cantidad int not null check (cantidad > 0),
  tallas text default '',
  deco jsonb not null default '{"tipo":"ninguna","colores":1,"ubicaciones":1}'::jsonb,
  fecha_compromiso date not null,
  monto numeric default 0,
  notas text default '',
  arte_aprobado boolean not null default false,
  material_listo boolean not null default false,
  anticipo boolean not null default false,
  estado text not null default 'activo' check (estado in ('activo','entregado')),
  prog jsonb not null default '{}'::jsonb,     -- piezas hechas por etapa
  ultimo jsonb not null default '{}'::jsonb,   -- último registro por etapa
  creado_por uuid references public.perfiles(id) on delete set null,
  creado timestamptz not null default now(),
  entregado timestamptz
);

-- ---------- Registros de producción ----------
create table if not exists public.registros (
  id uuid primary key default gen_random_uuid(),
  orden_id uuid not null references public.ordenes(id) on delete cascade,
  etapa text not null check (etapa in ('preprensa','corte','serigrafia','costura','dtf','empaque')),
  persona_id uuid references public.perfiles(id) on delete set null,
  cantidad int not null check (cantidad > 0),
  ts timestamptz not null default now(),
  dia date not null default (now() at time zone 'America/Caracas')::date
);
create index if not exists registros_dia_idx on public.registros (dia);
create index if not exists registros_orden_idx on public.registros (orden_id);

-- ---------- Historial semanal de carga ----------
create table if not exists public.historial (
  semana text primary key,
  util jsonb not null default '{}'::jsonb,
  actualizado timestamptz not null default now()
);

-- ---------- Registrar producción (atómico, evita choques entre personas) ----------
create or replace function public.registrar_produccion(p_orden uuid, p_etapa text, p_cantidad int)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  o public.ordenes;
  total int;
  actual int;
  nuevo int;
  real_ int;
  rid uuid;
begin
  if public.mi_rol() is null then raise exception 'Usuario sin acceso'; end if;
  if p_cantidad is null or p_cantidad <= 0 then raise exception 'Cantidad inválida'; end if;
  select * into o from public.ordenes where id = p_orden for update;
  if not found then raise exception 'Orden no encontrada'; end if;
  total := case when p_etapa = 'preprensa' then 1 else o.cantidad end;
  actual := coalesce((o.prog->>p_etapa)::numeric, 0)::int;
  nuevo := least(total, actual + p_cantidad);
  real_ := nuevo - actual;
  if real_ <= 0 then return jsonb_build_object('registrado', 0); end if;
  update public.ordenes
     set prog = jsonb_set(prog, array[p_etapa], to_jsonb(nuevo)),
         ultimo = jsonb_set(ultimo, array[p_etapa], to_jsonb(now()))
   where id = p_orden;
  insert into public.registros (orden_id, etapa, persona_id, cantidad)
  values (p_orden, p_etapa, auth.uid(), real_) returning id into rid;
  return jsonb_build_object('registrado', real_, 'registro_id', rid, 'total', nuevo);
end $$;

-- Deshacer un registro: la misma persona (dentro de 30 minutos) o dirección / jefa de taller
create or replace function public.deshacer_registro(p_registro uuid)
returns void language plpgsql security definer set search_path = public as $$
declare r public.registros;
begin
  select * into r from public.registros where id = p_registro;
  if not found then return; end if;
  if not (public.mi_rol() in ('direccion','jefa')
          or (r.persona_id = auth.uid() and r.ts > now() - interval '30 minutes')) then
    raise exception 'No puedes deshacer este registro';
  end if;
  update public.ordenes
     set prog = jsonb_set(prog, array[r.etapa],
                 to_jsonb(greatest(0, coalesce((prog->>r.etapa)::numeric,0)::int - r.cantidad)))
   where id = r.orden_id;
  delete from public.registros where id = p_registro;
end $$;

-- ---------- Seguridad por filas (RLS) ----------
alter table public.perfiles  enable row level security;
alter table public.config    enable row level security;
alter table public.ordenes   enable row level security;
alter table public.registros enable row level security;
alter table public.historial enable row level security;

drop policy if exists "perfiles_leer" on public.perfiles;
create policy "perfiles_leer" on public.perfiles for select to authenticated
  using (public.mi_rol() is not null);
drop policy if exists "perfiles_editar" on public.perfiles;
create policy "perfiles_editar" on public.perfiles for update to authenticated
  using (public.mi_rol() = 'direccion') with check (public.mi_rol() = 'direccion');

drop policy if exists "config_leer" on public.config;
create policy "config_leer" on public.config for select to authenticated
  using (public.mi_rol() is not null);
drop policy if exists "config_editar" on public.config;
create policy "config_editar" on public.config for update to authenticated
  using (public.mi_rol() in ('direccion','jefa')) with check (public.mi_rol() in ('direccion','jefa'));

drop policy if exists "ordenes_leer" on public.ordenes;
create policy "ordenes_leer" on public.ordenes for select to authenticated
  using (public.mi_rol() is not null);
drop policy if exists "ordenes_crear" on public.ordenes;
create policy "ordenes_crear" on public.ordenes for insert to authenticated
  with check (public.mi_rol() in ('direccion','jefa','admin','compras','diseno'));
drop policy if exists "ordenes_editar" on public.ordenes;
create policy "ordenes_editar" on public.ordenes for update to authenticated
  using (public.mi_rol() in ('direccion','jefa','admin','compras','diseno'))
  with check (public.mi_rol() in ('direccion','jefa','admin','compras','diseno'));
drop policy if exists "ordenes_borrar" on public.ordenes;
create policy "ordenes_borrar" on public.ordenes for delete to authenticated
  using (public.mi_rol() = 'direccion');

drop policy if exists "registros_leer" on public.registros;
create policy "registros_leer" on public.registros for select to authenticated
  using (public.mi_rol() is not null);
-- Los registros solo se crean y borran con las funciones de arriba.

drop policy if exists "historial_leer" on public.historial;
create policy "historial_leer" on public.historial for select to authenticated
  using (public.mi_rol() is not null);
drop policy if exists "historial_guardar" on public.historial;
create policy "historial_guardar" on public.historial for insert to authenticated
  with check (public.mi_rol() is not null);
drop policy if exists "historial_actualizar" on public.historial;
create policy "historial_actualizar" on public.historial for update to authenticated
  using (public.mi_rol() is not null) with check (public.mi_rol() is not null);

grant execute on function public.registrar_produccion(uuid, text, int) to authenticated;
grant execute on function public.deshacer_registro(uuid) to authenticated;
revoke execute on function public.registrar_produccion(uuid, text, int) from anon;
revoke execute on function public.deshacer_registro(uuid) from anon;

-- ---------- Tiempo real (la app se actualiza sola en todas las pantallas) ----------
do $$ begin
  begin alter publication supabase_realtime add table public.ordenes;   exception when duplicate_object then null; end;
  begin alter publication supabase_realtime add table public.registros; exception when duplicate_object then null; end;
  begin alter publication supabase_realtime add table public.config;    exception when duplicate_object then null; end;
  begin alter publication supabase_realtime add table public.perfiles;  exception when duplicate_object then null; end;
end $$;
