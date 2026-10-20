-- =====================================================================
-- Migración 05 · Enlaces de invitación por rol
-- Cada enlace registra a la persona directamente con su rol (y estación).
-- Se puede correr más de una vez sin dañar nada.
-- Supabase → SQL Editor → New query → pegar todo → Run
-- =====================================================================

create table if not exists public.invitaciones (
  id uuid primary key default gen_random_uuid(),
  token text unique not null,
  rol text not null check (rol in ('direccion','jefa','admin','compras','diseno','operador')),
  estacion text check (estacion is null or estacion in ('preprensa','corte','serigrafia','costura','bordado','dtf')),
  etiqueta text default '',
  usos int not null default 0,
  max_usos int check (max_usos is null or max_usos > 0),   -- vacío = sin límite
  vence timestamptz,                                         -- vacío = no vence
  activa boolean not null default true,
  creado_por uuid references public.perfiles(id) on delete set null default auth.uid(),
  creado timestamptz not null default now()
);

-- De qué enlace se registró cada persona
alter table public.perfiles add column if not exists invitacion_id uuid references public.invitaciones(id) on delete set null;

alter table public.invitaciones enable row level security;
drop policy if exists "inv_leer" on public.invitaciones;
create policy "inv_leer" on public.invitaciones for select to authenticated using (public.mi_rol() = 'direccion');
drop policy if exists "inv_crear" on public.invitaciones;
create policy "inv_crear" on public.invitaciones for insert to authenticated with check (public.mi_rol() = 'direccion');
drop policy if exists "inv_editar" on public.invitaciones;
create policy "inv_editar" on public.invitaciones for update to authenticated using (public.mi_rol() = 'direccion') with check (public.mi_rol() = 'direccion');
drop policy if exists "inv_borrar" on public.invitaciones;
create policy "inv_borrar" on public.invitaciones for delete to authenticated using (public.mi_rol() = 'direccion');

-- Toma un cupo del enlace si sigue vigente (lo usa solo el servidor). Devuelve la invitación o nada.
create or replace function public.usar_invitacion(p_token text)
returns setof public.invitaciones language sql security definer set search_path = public as $$
  update public.invitaciones set usos = usos + 1
   where token = p_token and activa and (vence is null or vence > now()) and (max_usos is null or usos < max_usos)
  returning *;
$$;
-- Devuelve el cupo si el registro falló
create or replace function public.devolver_invitacion(p_id uuid)
returns void language sql security definer set search_path = public as $$
  update public.invitaciones set usos = greatest(0, usos - 1) where id = p_id;
$$;
revoke all on function public.usar_invitacion(text) from public, anon, authenticated;
revoke all on function public.devolver_invitacion(uuid) from public, anon, authenticated;

-- El perfil guarda el enlace de origen (viene en los datos del usuario al crearlo)
create or replace function public.crear_perfil()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.perfiles (id, email, nombre, rol, estacion, invitacion_id)
  values (
    new.id,
    new.email,
    coalesce(new.raw_user_meta_data->>'nombre', split_part(new.email, '@', 1)),
    coalesce(nullif(new.raw_user_meta_data->>'rol', ''), 'operador'),
    nullif(new.raw_user_meta_data->>'estacion', ''),
    nullif(new.raw_user_meta_data->>'invitacion_id', '')::uuid
  )
  on conflict (id) do nothing;
  return new;
end $$;
do $$ begin
  grant execute on function public.usar_invitacion(text) to service_role;
  grant execute on function public.devolver_invitacion(uuid) to service_role;
exception when undefined_object then null; end $$;
