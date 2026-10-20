-- Migración 10 · Materiales como lista de precios
-- La mayoría de los materiales se compran para cada pedido: el catálogo guarda el precio,
-- y el stock solo se lleva en los materiales marcados "en almacén".
-- Correr después de la migración 09. Se puede correr más de una vez.

alter table public.materiales add column if not exists maneja_stock boolean not null default false;
alter table public.materiales add column if not exists precio_fecha timestamptz;
alter table public.consumos   add column if not exists precio_lista numeric;  -- precio de la lista en ese momento (para comparar)

-- Solo siguen llevando stock los materiales que hoy tienen existencia positiva
do $$ begin
  if not exists (select 1 from public.materiales where maneja_stock) then
    update public.materiales set maneja_stock = true where stock > 0;
  end if;
end $$;
update public.materiales set precio_fecha = coalesce(precio_fecha, creado) where costo > 0;

-- Fecha del último cambio de precio
create or replace function public.material_precio_fecha()
returns trigger language plpgsql set search_path = public as $$
begin
  if tg_op = 'INSERT' then
    if new.costo > 0 then new.precio_fecha := coalesce(new.precio_fecha, now()); end if;
  elsif new.costo is distinct from old.costo then
    new.precio_fecha := now();
  end if;
  return new;
end $$;
drop trigger if exists materiales_precio_fecha on public.materiales;
create trigger materiales_precio_fecha before insert or update of costo on public.materiales
  for each row execute function public.material_precio_fecha();

-- Material de un pedido: usa el precio que se escribió (lo que se pagó) o, si no, el de la lista.
-- El stock solo se mueve en los materiales que se llevan en almacén.
create or replace function public.consumo_stock()
returns trigger language plpgsql security definer set search_path = public as $$
declare m record;
begin
  if tg_op = 'INSERT' then
    select costo, maneja_stock into m from public.materiales where id = new.material_id;
    new.precio_lista := m.costo;
    if coalesce(new.costo_unit, 0) <= 0 then new.costo_unit := coalesce(m.costo, 0); end if;
    if m.maneja_stock then update public.materiales set stock = stock - new.cantidad where id = new.material_id; end if;
    return new;
  elsif tg_op = 'DELETE' then
    update public.materiales set stock = stock + old.cantidad where id = old.material_id and maneja_stock;
    return old;
  end if;
  return null;
end $$;

create or replace function public.consumo_stock_editar()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if new.material_id = old.material_id then
    update public.materiales set stock = stock + old.cantidad - new.cantidad where id = new.material_id and maneja_stock;
  else
    update public.materiales set stock = stock + old.cantidad where id = old.material_id and maneja_stock;
    update public.materiales set stock = stock - new.cantidad where id = new.material_id and maneja_stock;
  end if;
  return new;
end $$;

-- Compras también puede corregir el material que cargó a un pedido
drop policy if exists "consumos_editar" on public.consumos;
create policy "consumos_editar" on public.consumos for update to authenticated
  using (public.mi_rol() in ('direccion','jefa','admin','compras')) with check (public.mi_rol() in ('direccion','jefa','admin','compras'));
