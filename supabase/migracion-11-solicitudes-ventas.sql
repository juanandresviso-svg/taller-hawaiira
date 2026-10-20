-- Migración 11 · Solicitudes del cliente (Ventas) antes de la cotización
-- Ventas registra lo que pide el cliente; Administración o Dirección lo cotiza a partir de la solicitud.
-- Correr después de la migración 10. Se puede correr más de una vez.

-- ---------- 1. Cargo nuevo: Ventas ----------
alter table public.perfiles drop constraint if exists perfiles_rol_check;
alter table public.perfiles add constraint perfiles_rol_check
  check (rol in ('direccion','jefa','admin','compras','diseno','operador','ventas'));
-- También en los enlaces de registro por rol (migración 05)
do $$ begin
  if to_regclass('public.invitaciones') is not null then
    alter table public.invitaciones drop constraint if exists invitaciones_rol_check;
    alter table public.invitaciones add constraint invitaciones_rol_check
      check (rol in ('direccion','jefa','admin','compras','diseno','operador','ventas'));
  end if;
end $$;

-- ---------- 2. Solicitudes ----------
create table if not exists public.solicitudes (
  id uuid primary key default gen_random_uuid(),
  numero text unique,
  cliente text not null,
  cliente_id uuid references public.clientes(id) on delete set null,
  contacto text default '',
  telefono text default '',
  correo text default '',
  canal text not null default 'whatsapp',
  items jsonb not null default '[]',          -- [{ producto, descripcion, cantidad, tallas, deco }]
  detalle text default '',                    -- colores, tela, logos, ubicaciones, lo que pidió el cliente
  referencias text default '',                -- enlaces a fotos o artes de referencia
  fecha_deseada date,
  presupuesto numeric,                        -- lo que el cliente dijo que quiere gastar (opcional)
  estado text not null default 'nueva' check (estado in ('nueva','revision','cotizada','aprobada','rechazada','descartada')),
  motivo text default '',                     -- por qué se descartó o qué falta
  vendedor_id uuid references public.perfiles(id) on delete set null default auth.uid(),
  cotizacion_id uuid references public.cotizaciones(id) on delete set null,
  creado timestamptz not null default now(),
  actualizado timestamptz not null default now()
);
create index if not exists solicitudes_estado_idx on public.solicitudes (estado);

-- Número consecutivo SOL-0001
create or replace function public.solicitud_numero()
returns trigger language plpgsql security definer set search_path = public as $$
declare n int;
begin
  if coalesce(trim(new.numero), '') = '' then
    perform pg_advisory_xact_lock(hashtext('solicitudes_numero'));
    select coalesce(max(nullif(regexp_replace(numero, '\D', '', 'g'), '')::int), 0) + 1 into n from public.solicitudes;
    new.numero := 'SOL-' || lpad(n::text, 4, '0');
  end if;
  return new;
end $$;
drop trigger if exists solicitudes_numero on public.solicitudes;
create trigger solicitudes_numero before insert on public.solicitudes for each row execute function public.solicitud_numero();

-- El cliente queda en Clientes (mismo trigger que pedidos y cotizaciones)
drop trigger if exists solicitudes_cliente on public.solicitudes;
create trigger solicitudes_cliente before insert or update of cliente, cliente_id on public.solicitudes
  for each row execute function public.asignar_cliente();

create or replace function public.solicitud_actualizado()
returns trigger language plpgsql set search_path = public as $$
begin new.actualizado := now(); return new; end $$;
drop trigger if exists solicitudes_actualizado on public.solicitudes;
create trigger solicitudes_actualizado before update on public.solicitudes for each row execute function public.solicitud_actualizado();

-- ---------- 3. Cotización ligada a su solicitud ----------
alter table public.cotizaciones add column if not exists solicitud_id uuid references public.solicitudes(id) on delete set null;

-- La solicitud sigue el estado de su cotización
create or replace function public.cotizacion_a_solicitud()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if new.solicitud_id is null then return new; end if;
  update public.solicitudes set
    cotizacion_id = new.id,
    estado = case new.estado when 'aprobada' then 'aprobada' when 'rechazada' then 'rechazada' else 'cotizada' end
  where id = new.solicitud_id;
  return new;
end $$;
drop trigger if exists cotizaciones_solicitud on public.cotizaciones;
create trigger cotizaciones_solicitud after insert or update of estado, solicitud_id on public.cotizaciones
  for each row execute function public.cotizacion_a_solicitud();

-- ---------- 4. Permisos ----------
alter table public.solicitudes enable row level security;
drop policy if exists "solicitudes_leer" on public.solicitudes;
create policy "solicitudes_leer" on public.solicitudes for select to authenticated
  using (public.mi_rol() in ('direccion','jefa','admin','ventas'));
drop policy if exists "solicitudes_crear" on public.solicitudes;
create policy "solicitudes_crear" on public.solicitudes for insert to authenticated
  with check (public.mi_rol() in ('direccion','jefa','admin','ventas'));
drop policy if exists "solicitudes_editar" on public.solicitudes;
create policy "solicitudes_editar" on public.solicitudes for update to authenticated
  using (public.mi_rol() in ('direccion','jefa','admin','ventas'))
  with check (public.mi_rol() in ('direccion','jefa','admin','ventas'));
drop policy if exists "solicitudes_borrar" on public.solicitudes;
create policy "solicitudes_borrar" on public.solicitudes for delete to authenticated
  using (public.mi_rol() = 'direccion');

-- Ventas ve sus cotizaciones (número, total, estado y pedidos) sin los costos
drop policy if exists "cotizaciones_ventas_leer" on public.cotizaciones;
create or replace view public.v_cotizaciones_ventas as
  select id, numero, cliente, estado, total, ordenes, solicitud_id, creado, validez, fecha_entrega
  from public.cotizaciones
  where public.mi_rol() in ('direccion','jefa','admin','ventas');
grant select on public.v_cotizaciones_ventas to authenticated;

-- Ventas también registra clientes
drop policy if exists "clientes_crear" on public.clientes;
create policy "clientes_crear" on public.clientes for insert to authenticated
  with check (public.mi_rol() in ('direccion','jefa','admin','compras','diseno','ventas'));
drop policy if exists "clientes_editar" on public.clientes;
create policy "clientes_editar" on public.clientes for update to authenticated
  using (public.mi_rol() in ('direccion','jefa','admin','compras','diseno','ventas'))
  with check (public.mi_rol() in ('direccion','jefa','admin','compras','diseno','ventas'));

-- ---------- 5. Tiempo real ----------
do $$ begin
  begin alter publication supabase_realtime add table public.solicitudes; exception when duplicate_object then null; end;
end $$;
