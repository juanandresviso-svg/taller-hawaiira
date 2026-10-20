-- =============================================================
-- Taller Hawaiira · Actualización 3: medición de tiempos reales,
-- aprendizaje de tiempos estándar e informe de producción.
-- Ejecutar completo en: Supabase → SQL Editor → New query → Run
-- (se puede correr más de una vez sin problema)
-- =============================================================

-- Cada registro guarda cuándo empezó el trabajo y cuántos minutos-persona tomó
alter table public.registros add column if not exists inicio timestamptz;
alter table public.registros add column if not exists minutos numeric;

-- Jornada del taller (para medir el primer registro del día) y aprendizaje automático
update public.config
   set data = '{"horaInicio": "07:30", "almuerzoInicio": "12:00", "almuerzoMin": 60, "aprendizaje": true}'::jsonb || data
 where id = 1;

-- ---------- Registrar producción midiendo el tiempo ----------
drop function if exists public.registrar_produccion(uuid, text, int);
create or replace function public.registrar_produccion(p_orden uuid, p_etapa text, p_cantidad int, p_inicio timestamptz default null)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  o public.ordenes;
  cfg jsonb;
  total int; actual int; nuevo int; real_ int; rid uuid;
  hoy date := (now() at time zone 'America/Caracas')::date;
  ini timestamptz; jornada timestamptz; alm_ini timestamptz; alm_fin timestamptz;
  ult timestamptz; mins numeric; solape numeric;
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

  -- Inicio del trabajo: el que marcó la persona con "Empezar", si no su registro anterior de hoy, si no el inicio de la jornada
  select data into cfg from public.config where id = 1;
  jornada := (hoy + coalesce(cfg->>'horaInicio', '07:30')::time) at time zone 'America/Caracas';
  alm_ini := (hoy + coalesce(cfg->>'almuerzoInicio', '12:00')::time) at time zone 'America/Caracas';
  alm_fin := alm_ini + make_interval(mins => coalesce((cfg->>'almuerzoMin')::int, 60));
  select max(ts) into ult from public.registros where persona_id = auth.uid() and dia = hoy;
  if p_inicio is not null and p_inicio > now() - interval '12 hours' and p_inicio < now() then
    ini := p_inicio;
  else
    ini := greatest(coalesce(ult, jornada), jornada);
  end if;
  if ini < now() then
    mins := extract(epoch from (now() - ini)) / 60;
    solape := greatest(0, extract(epoch from (least(now(), alm_fin) - greatest(ini, alm_ini))) / 60);
    mins := mins - solape;
    if mins < 0.5 or mins > 600 then mins := null; end if;  -- medición poco confiable: se descarta
  end if;

  update public.ordenes
     set prog = jsonb_set(prog, array[p_etapa], to_jsonb(nuevo)),
         ultimo = jsonb_set(ultimo, array[p_etapa], to_jsonb(now()))
   where id = p_orden;
  insert into public.registros (orden_id, etapa, persona_id, cantidad, inicio, minutos)
  values (p_orden, p_etapa, auth.uid(), real_, ini, round(mins, 1)) returning id into rid;
  return jsonb_build_object('registrado', real_, 'registro_id', rid, 'total', nuevo, 'minutos', round(mins, 1));
end $$;
grant execute on function public.registrar_produccion(uuid, text, int, timestamptz) to authenticated;
revoke execute on function public.registrar_produccion(uuid, text, int, timestamptz) from anon;

-- ---------- Agregar producto sin tiempos (quedan como estimados hasta que haya producción real) ----------
drop function if exists public.agregar_producto(text, text, numeric, numeric, numeric);
create or replace function public.agregar_producto(p_clave text, p_nombre text, p_corte numeric, p_costura numeric, p_empaque numeric, p_estimado boolean default false)
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
                                    'costura', greatest(0, coalesce(p_costura,0)), 'empaque', greatest(0, coalesce(p_empaque,0)),
                                    'estimado', coalesce(p_estimado, false))),
         actualizado = now()
   where id = 1;
end $$;
grant execute on function public.agregar_producto(text, text, numeric, numeric, numeric, boolean) to authenticated;
revoke execute on function public.agregar_producto(text, text, numeric, numeric, numeric, boolean) from anon;

-- ---------- Resumen de tiempos reales por pedido y etapa ----------
create or replace view public.v_tiempos with (security_invoker = true) as
select r.orden_id, r.etapa, o.codigo, o.producto, o.deco, o.cantidad, o.estado,
       sum(r.cantidad)                                       as piezas,
       sum(r.cantidad) filter (where r.minutos is not null)  as piezas_med,
       sum(r.minutos)                                        as minutos,
       count(distinct r.persona_id)                          as personas,
       min(coalesce(r.inicio, r.ts))                         as desde,
       max(r.ts)                                             as hasta
  from public.registros r
  join public.ordenes o on o.id = r.orden_id
 group by r.orden_id, r.etapa, o.codigo, o.producto, o.deco, o.cantidad, o.estado;
grant select on public.v_tiempos to authenticated;
