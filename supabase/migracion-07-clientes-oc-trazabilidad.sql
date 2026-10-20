-- =====================================================================
-- Migración 07 · Clientes, lectura de la orden de compra, envío de la orden
-- de producción y trazabilidad de los 31 pasos del flujograma
-- Se puede correr más de una vez sin dañar nada. Requiere la migración 06.
-- Supabase → SQL Editor → New query → pegar todo → Run
-- =====================================================================

-- ---------- 1. Clientes ----------
create table if not exists public.clientes (
  id uuid primary key default gen_random_uuid(),
  nombre text not null,
  clave text unique not null,          -- nombre normalizado (sin mayúsculas, acentos ni espacios dobles)
  rif text not null default '',
  contacto text not null default '',
  telefono text not null default '',
  correo text not null default '',
  direccion text not null default '',
  notas text not null default '',
  creado timestamptz not null default now()
);

create or replace function public.clave_cliente(p text)
returns text language sql immutable as $$
  select regexp_replace(lower(translate(trim(coalesce(p, '')), 'ÁÉÍÓÚÜÑáéíóúüñ.,', 'AEIOUUNaeiouun  ')), '\s+', ' ', 'g')
$$;

-- La clave del cliente siempre se calcula desde el nombre (evita duplicados por mayúsculas o acentos)
create or replace function public.clave_de_cliente()
returns trigger language plpgsql as $$
begin
  new.clave := trim(public.clave_cliente(new.nombre));
  new.nombre := trim(new.nombre);
  return new;
end $$;
drop trigger if exists clientes_clave on public.clientes;
create trigger clientes_clave before insert or update of nombre on public.clientes
  for each row execute function public.clave_de_cliente();

alter table public.ordenes      add column if not exists cliente_id uuid references public.clientes(id) on delete set null;
alter table public.cotizaciones add column if not exists cliente_id uuid references public.clientes(id) on delete set null;

-- Cada pedido y cada cotización quedan ligados a su cliente (lo crea si no existe)
create or replace function public.asignar_cliente()
returns trigger language plpgsql security definer set search_path = public as $$
declare k text;
begin
  k := trim(public.clave_cliente(new.cliente));
  if k = '' then return new; end if;
  if new.cliente_id is not null and tg_op = 'UPDATE' and new.cliente is distinct from old.cliente and new.cliente_id = old.cliente_id then
    new.cliente_id := null;   -- se cambió el nombre del cliente: se vuelve a buscar
  end if;
  if new.cliente_id is null then
    insert into public.clientes (nombre, clave) values (trim(new.cliente), k) on conflict (clave) do nothing;
    select id into new.cliente_id from public.clientes where clave = k;
  end if;
  return new;
end $$;

drop trigger if exists ordenes_cliente on public.ordenes;
create trigger ordenes_cliente before insert or update of cliente, cliente_id on public.ordenes
  for each row execute function public.asignar_cliente();
drop trigger if exists cotizaciones_cliente on public.cotizaciones;
create trigger cotizaciones_cliente before insert or update of cliente, cliente_id on public.cotizaciones
  for each row execute function public.asignar_cliente();

-- Clientes de los pedidos y cotizaciones que ya existen
update public.ordenes      set cliente_id = null where cliente_id is null;
update public.cotizaciones set cliente_id = null where cliente_id is null;

alter table public.clientes enable row level security;
drop policy if exists "clientes_leer" on public.clientes;
create policy "clientes_leer" on public.clientes for select to authenticated using (public.mi_rol() is not null);
drop policy if exists "clientes_crear" on public.clientes;
create policy "clientes_crear" on public.clientes for insert to authenticated
  with check (public.mi_rol() in ('direccion','jefa','admin','compras','diseno'));
drop policy if exists "clientes_editar" on public.clientes;
create policy "clientes_editar" on public.clientes for update to authenticated
  using (public.mi_rol() in ('direccion','jefa','admin','compras','diseno'))
  with check (public.mi_rol() in ('direccion','jefa','admin','compras','diseno'));
drop policy if exists "clientes_borrar" on public.clientes;
create policy "clientes_borrar" on public.clientes for delete to authenticated using (public.mi_rol() = 'direccion');

-- ---------- 2. Orden de compra leída y orden de producción enviada ----------
alter table public.ordenes add column if not exists cotizacion_id uuid references public.cotizaciones(id) on delete set null;
alter table public.ordenes add column if not exists oc_monto numeric;            -- monto a pagar según la OC
alter table public.ordenes add column if not exists oc_unidades int;             -- unidades según la OC
alter table public.ordenes add column if not exists oc_fecha_entrega date;       -- fecha de entrega pedida en la OC
alter table public.ordenes add column if not exists oc_datos jsonb;              -- todo lo leído de la OC (y si se corrigió a mano)
alter table public.ordenes add column if not exists op_enviada timestamptz;      -- cuándo se envió la orden de producción al taller
alter table public.ordenes add column if not exists op_enviada_por uuid references public.perfiles(id) on delete set null;

-- Pedidos que salieron de una cotización aprobada
update public.ordenes o set cotizacion_id = c.id
  from public.cotizaciones c
 where o.cotizacion_id is null and c.ordenes ? o.codigo;

-- ---------- 3. Pasos del flujograma: p01 … p31 ----------
-- Los pasos registrados con la versión anterior pasan a su número del flujograma

-- La bitácora ya anotada en la hoja conserva su marca para no repetir filas
update public.documentos d
   set clave = 'log:' || regexp_replace(h.clave, ':' || m.viejo || '$', ':' || m.nuevo)
  from public.hitos h join (values ('cotizacion','p06'), ('rechazada','p08'), ('anticipo','p10'), ('arte','p13'), ('op','p14'), ('material','p19'), ('calidad','p23'), ('empaque','p24'), ('entrega','p26'), ('factura','p28'), ('cobro','p29')) as m(viejo, nuevo) on h.paso = m.viejo
 where d.clave = 'log:' || h.clave
   and not exists (select 1 from public.documentos x where x.clave = 'log:' || regexp_replace(h.clave, ':' || m.viejo || '$', ':' || m.nuevo));

update public.hitos h
   set paso = m.nuevo, clave = regexp_replace(h.clave, ':' || m.viejo || '$', ':' || m.nuevo)
  from (values ('cotizacion','p06'), ('rechazada','p08'), ('anticipo','p10'), ('arte','p13'), ('op','p14'), ('material','p19'), ('calidad','p23'), ('empaque','p24'), ('entrega','p26'), ('factura','p28'), ('cobro','p29')) as m(viejo, nuevo)
 where h.paso = m.viejo
   and not exists (select 1 from public.hitos x where x.clave = regexp_replace(h.clave, ':' || m.viejo || '$', ':' || m.nuevo));

-- Pasos automáticos que ahora se calculan de otra forma (los vuelve a registrar la app)
delete from public.hitos where auto and paso in ('aceptada', 'oc', 'produccion', 'cotizacion', 'rechazada', 'anticipo', 'arte', 'op', 'material', 'empaque', 'entrega');
-- Los pasos 1 a 8 (cotización) se guardan en la cotización, no en el pedido
delete from public.hitos where orden_id is not null and paso in ('p01','p02','p03','p04','p05','p06','p07','p08');

-- ---------- Tiempo real ----------
do $$ begin
  begin alter publication supabase_realtime add table public.clientes; exception when duplicate_object then null; end;
end $$;
