-- =====================================================================
-- Migración 08 · Formato de cotización de Hawaiira Studio
-- Se puede correr más de una vez sin dañar nada.
-- Supabase → SQL Editor → New query → pegar todo → Run
-- =====================================================================

-- Método de pago de cada cotización (aparece en el recuadro "Métodos de Pago")
alter table public.cotizaciones add column if not exists metodo_pago text not null default 'TRANSFERENCIA';

-- Datos de la empresa del formato (solo si todavía no se habían escrito)
update public.costos_config
   set data = jsonb_set(data, '{empresa}', coalesce(data->'empresa', '{}'::jsonb) || jsonb_build_object(
         'nombre', 'INVERSIONES HAWAIIRA C.A.',
         'rif', 'J-41313895-6',
         'direccion', 'Centro Comercial Trinidad Tepuy, Local L-03. Baruta',
         'ciudad', 'Caracas, Venezuela'))
 where id = 1 and coalesce(data->'empresa'->>'rif', '') = '';

-- La numeración sigue la de las cotizaciones hechas en Google Sheets (la última fue la 279)
update public.costos_config
   set data = jsonb_set(data, '{empresa,proximaCotizacion}', '"280"'::jsonb)
 where id = 1 and coalesce(data->'empresa'->>'proximaCotizacion', '') = '';
