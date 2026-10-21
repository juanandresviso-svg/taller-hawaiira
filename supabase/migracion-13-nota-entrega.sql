-- =====================================================================
-- Migración 13 · Nota de entrega
-- Al despachar (Marcar entregado) cada entrega recibe un número de nota de entrega
-- correlativo. Varios pedidos del mismo cliente despachados juntos comparten la nota.
-- Se puede correr más de una vez sin dañar nada.
-- Supabase → SQL Editor → New query → pegar todo → Run
-- =====================================================================

alter table public.ordenes add column if not exists nota_entrega int;          -- número de la nota de entrega
alter table public.ordenes add column if not exists nota_obs text not null default '';  -- observaciones de la nota (ej. POR PAGAR)
create index if not exists ordenes_nota_entrega on public.ordenes(nota_entrega);

-- Numeración: sigue la de las notas hechas en Word (la última fue la 114)
create sequence if not exists public.nota_entrega_seq;
select setval('public.nota_entrega_seq', greatest(114, coalesce((select max(nota_entrega) from public.ordenes), 0),
  (select last_value from public.nota_entrega_seq where is_called)));
-- Para cambiar el próximo número (por ejemplo, que la siguiente sea la 200):
--   select setval('public.nota_entrega_seq', 199);

-- Despacha uno o varios pedidos con una sola nota de entrega y devuelve su número.
-- Si los pedidos ya estaban entregados (sin nota), solo les asigna la nota.
create or replace function public.entregar_pedidos(p_ids uuid[], p_obs text default '')
returns int language plpgsql security definer set search_path = public as $$
declare n int; clientes int;
begin
  if public.mi_rol() not in ('direccion','jefa','admin','compras','diseno') then
    raise exception 'No tienes permiso para despachar pedidos';
  end if;
  if coalesce(array_length(p_ids, 1), 0) = 0 then raise exception 'Elige al menos un pedido'; end if;
  select count(distinct coalesce(cliente_id::text, lower(trim(cliente)))) into clientes from public.ordenes where id = any(p_ids);
  if clientes > 1 then raise exception 'Una nota de entrega es para un solo cliente'; end if;
  if exists (select 1 from public.ordenes where id = any(p_ids) and estado = 'espera') then
    raise exception 'Hay pedidos que todavía no tienen la orden de producción enviada';
  end if;
  n := nextval('public.nota_entrega_seq');
  update public.ordenes
     set nota_entrega = n,
         nota_obs = upper(trim(coalesce(p_obs, ''))),
         estado = 'entregado',
         entregado = coalesce(entregado, now())
   where id = any(p_ids);
  return n;
end $$;
revoke all on function public.entregar_pedidos(uuid[], text) from public, anon;
grant execute on function public.entregar_pedidos(uuid[], text) to authenticated;

-- ---------- Productos nuevos desde Solicitudes ----------
-- Ventas también puede agregar un producto nuevo (por ejemplo al registrar una solicitud)
create or replace function public.agregar_producto(p_clave text, p_nombre text, p_corte numeric, p_costura numeric, p_empaque numeric, p_estimado boolean default false)
returns void language plpgsql security definer set search_path = public as $$
begin
  if public.mi_rol() not in ('direccion','jefa','admin','compras','diseno','ventas') then
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
                                    'costura', greatest(0, coalesce(p_costura,0)), 'empaque', greatest(0, coalesce(p_empaque,0)),
                                    'estimado', coalesce(p_estimado, false))),
         actualizado = now()
   where id = 1;
end $$;
grant execute on function public.agregar_producto(text, text, numeric, numeric, numeric, boolean) to authenticated;
revoke execute on function public.agregar_producto(text, text, numeric, numeric, numeric, boolean) from anon;
