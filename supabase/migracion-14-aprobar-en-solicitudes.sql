-- =====================================================================
-- Migración 14 · Aprobar o rechazar la cotización desde Solicitudes
-- Dirección, jefe de taller, Administración y Ventas pueden marcar la respuesta
-- del cliente. Al aprobar se crean los pedidos (quedan "por enviar OP").
-- Se puede correr más de una vez sin dañar nada.
-- Supabase → SQL Editor → New query → pegar todo → Run
-- =====================================================================

create or replace function public.aprobar_cotizacion(p_id uuid, p_fecha date)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  c public.cotizaciones;
  it jsonb;
  n int;
  dueno uuid;
  codigos text[] := '{}';
  cod text;
begin
  if public.mi_rol() not in ('direccion','jefa','admin','ventas') then
    raise exception 'No tienes permiso para aprobar cotizaciones';
  end if;
  select * into c from public.cotizaciones where id = p_id for update;
  if not found then raise exception 'No se encontró la cotización'; end if;
  if c.estado not in ('borrador','enviada') then raise exception 'La cotización ya está %', c.estado; end if;

  -- Cotización generada desde un pedido: solo cambia el estado
  if jsonb_array_length(coalesce(c.ordenes, '[]'::jsonb)) > 0 then
    update public.cotizaciones set estado = 'aprobada' where id = p_id;
    return c.ordenes;
  end if;

  if p_fecha is null then raise exception 'Indica la fecha de entrega comprometida'; end if;
  if jsonb_array_length(coalesce(c.items, '[]'::jsonb)) = 0 then raise exception 'La cotización no tiene productos'; end if;

  -- Dueño del pedido: quien vendió (la solicitud) o quien aprueba
  select vendedor_id into dueno from public.solicitudes where id = c.solicitud_id;
  dueno := coalesce(dueno, auth.uid());

  lock table public.ordenes in share row exclusive mode;
  select coalesce(max(nullif(regexp_replace(codigo, '\D', '', 'g'), '')::int), 0) into n from public.ordenes;

  for it in select * from jsonb_array_elements(c.items) loop
    n := n + 1;
    cod := 'OP-' || lpad(n::text, 4, '0');
    insert into public.ordenes (codigo, cliente, responsable_id, producto, cantidad, tallas, deco, fecha_compromiso, monto, notas,
                                arte_aprobado, material_listo, anticipo, estado, creado_por, cotizacion_id)
    values (cod, c.cliente, dueno, it->>'producto', coalesce((it->>'cantidad')::int, 0), coalesce(it->>'tallas', ''),
            coalesce(it->'deco', '{"tipo":"ninguna","colores":1,"ubicaciones":1}'::jsonb), p_fecha,
            round(coalesce((it->>'cantidad')::numeric, 0) * coalesce((it->>'precio')::numeric, 0), 2),
            concat_ws(' · ', 'Cotización ' || c.numero, nullif(trim(coalesce(it->>'descripcion', '')), '')),
            false, false, false, 'espera', auth.uid(), c.id);
    codigos := codigos || cod;
  end loop;

  update public.cotizaciones set estado = 'aprobada', fecha_entrega = p_fecha, ordenes = to_jsonb(codigos) where id = p_id;
  return to_jsonb(codigos);
end $$;

create or replace function public.rechazar_cotizacion(p_id uuid)
returns void language plpgsql security definer set search_path = public as $$
begin
  if public.mi_rol() not in ('direccion','jefa','admin','ventas') then
    raise exception 'No tienes permiso para rechazar cotizaciones';
  end if;
  update public.cotizaciones set estado = 'rechazada' where id = p_id and estado in ('borrador','enviada');
  if not found then raise exception 'La cotización ya no está abierta'; end if;
end $$;

revoke all on function public.aprobar_cotizacion(uuid, date) from public, anon;
revoke all on function public.rechazar_cotizacion(uuid) from public, anon;
grant execute on function public.aprobar_cotizacion(uuid, date) to authenticated;
grant execute on function public.rechazar_cotizacion(uuid) to authenticated;
