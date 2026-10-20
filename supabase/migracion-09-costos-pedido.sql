-- =====================================================================
-- Migración 09 · Costos adicionales de cada pedido y edición de salidas de material
-- Se puede correr más de una vez sin dañar nada.
-- Supabase → SQL Editor → New query → pegar todo → Run
-- =====================================================================

-- ---------- Costos adicionales (transporte, servicios de terceros, compras puntuales, horas extra…) ----------
create table if not exists public.costos_pedido (
  id uuid primary key default gen_random_uuid(),
  orden_id uuid not null references public.ordenes(id) on delete cascade,
  categoria text not null default 'otro' check (categoria in ('material','mano_obra','tercero','transporte','otro')),
  concepto text not null,
  monto numeric not null default 0 check (monto >= 0),   -- US$
  fecha date not null default (now() at time zone 'America/Caracas')::date,
  nota text not null default '',
  por uuid references public.perfiles(id) on delete set null default auth.uid(),
  creado timestamptz not null default now()
);
create index if not exists costos_pedido_orden_idx on public.costos_pedido (orden_id);

alter table public.costos_pedido enable row level security;
drop policy if exists "costos_pedido_leer" on public.costos_pedido;
create policy "costos_pedido_leer" on public.costos_pedido for select to authenticated
  using (public.mi_rol() in ('direccion','jefa','admin'));
drop policy if exists "costos_pedido_crear" on public.costos_pedido;
create policy "costos_pedido_crear" on public.costos_pedido for insert to authenticated
  with check (public.mi_rol() in ('direccion','jefa','admin'));
drop policy if exists "costos_pedido_editar" on public.costos_pedido;
create policy "costos_pedido_editar" on public.costos_pedido for update to authenticated
  using (public.mi_rol() in ('direccion','jefa','admin')) with check (public.mi_rol() in ('direccion','jefa','admin'));
drop policy if exists "costos_pedido_borrar" on public.costos_pedido;
create policy "costos_pedido_borrar" on public.costos_pedido for delete to authenticated
  using (public.mi_rol() in ('direccion','jefa','admin'));

-- ---------- Corregir salidas de material (cantidad y precio) ----------
-- Al cambiar la cantidad, el stock del material se ajusta por la diferencia
create or replace function public.consumo_stock_editar()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if new.material_id = old.material_id then
    update public.materiales set stock = stock + old.cantidad - new.cantidad where id = new.material_id;
  else
    update public.materiales set stock = stock + old.cantidad where id = old.material_id;
    update public.materiales set stock = stock - new.cantidad where id = new.material_id;
  end if;
  return new;
end $$;
drop trigger if exists consumos_stock_upd on public.consumos;
create trigger consumos_stock_upd after update of cantidad, material_id on public.consumos
  for each row execute function public.consumo_stock_editar();

drop policy if exists "consumos_editar" on public.consumos;
create policy "consumos_editar" on public.consumos for update to authenticated
  using (public.mi_rol() in ('direccion','jefa','admin')) with check (public.mi_rol() in ('direccion','jefa','admin'));

-- ---------- Tiempo real ----------
do $$ begin
  begin alter publication supabase_realtime add table public.costos_pedido; exception when duplicate_object then null; end;
end $$;
