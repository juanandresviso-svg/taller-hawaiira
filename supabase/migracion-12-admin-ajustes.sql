-- =====================================================================
-- Migración 12 · Administración puede editar Ajustes
-- (capacidad, jornada, nombres de productos y productos nuevos)
-- Se puede correr más de una vez sin dañar nada.
-- Supabase → SQL Editor → New query → pegar todo → Run
-- =====================================================================
drop policy if exists "config_editar" on public.config;
create policy "config_editar" on public.config for update to authenticated
  using (public.mi_rol() in ('direccion','jefa','admin'))
  with check (public.mi_rol() in ('direccion','jefa','admin'));
