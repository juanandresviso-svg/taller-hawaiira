-- =====================================================================
-- Migración 04 · Notificaciones push y Orden de compra del cliente
-- Se puede correr más de una vez sin dañar nada.
-- Supabase → SQL Editor → New query → pegar todo → Run
-- =====================================================================

-- ---------- 1. Orden de compra (OC) del cliente ----------
-- Un pedido nuevo queda "por activar" (estado 'espera') hasta que se sube la OC del cliente.
alter table public.ordenes drop constraint if exists ordenes_estado_check;
alter table public.ordenes add constraint ordenes_estado_check check (estado in ('espera','activo','entregado'));
alter table public.ordenes add column if not exists oc_numero text default '';
alter table public.ordenes add column if not exists oc_archivo text;          -- ruta en Storage
alter table public.ordenes add column if not exists oc_nombre text;           -- nombre original del archivo
alter table public.ordenes add column if not exists oc_subida timestamptz;
alter table public.ordenes add column if not exists oc_por uuid references public.perfiles(id) on delete set null;
alter table public.ordenes add column if not exists activado timestamptz;

-- Carpeta privada para los archivos de OC (PDF o foto, hasta 10 MB)
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('ordenes-compra', 'ordenes-compra', false, 10485760,
        array['application/pdf','image/jpeg','image/png','image/webp','image/heic'])
on conflict (id) do update set file_size_limit = excluded.file_size_limit, allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "oc_leer" on storage.objects;
create policy "oc_leer" on storage.objects for select to authenticated
  using (bucket_id = 'ordenes-compra' and public.mi_rol() is not null);
drop policy if exists "oc_subir" on storage.objects;
create policy "oc_subir" on storage.objects for insert to authenticated
  with check (bucket_id = 'ordenes-compra' and public.mi_rol() in ('direccion','jefa','admin','compras','diseno'));
drop policy if exists "oc_cambiar" on storage.objects;
create policy "oc_cambiar" on storage.objects for update to authenticated
  using (bucket_id = 'ordenes-compra' and public.mi_rol() in ('direccion','jefa','admin','compras','diseno'));
drop policy if exists "oc_borrar" on storage.objects;
create policy "oc_borrar" on storage.objects for delete to authenticated
  using (bucket_id = 'ordenes-compra' and public.mi_rol() in ('direccion','jefa','admin'));

-- ---------- 2. Notificaciones push ----------
-- Un dispositivo (navegador o app instalada) suscrito a avisos
create table if not exists public.suscripciones_push (
  endpoint text primary key,
  perfil_id uuid not null references public.perfiles(id) on delete cascade,
  p256dh text not null,
  auth text not null,
  agente text default '',
  creado timestamptz not null default now()
);
create index if not exists suscripciones_push_perfil on public.suscripciones_push(perfil_id);

-- Tipos de aviso que cada persona apagó: pedidos, cotizaciones, alertas, produccion, almacen
create table if not exists public.avisos_pref (
  perfil_id uuid primary key references public.perfiles(id) on delete cascade default auth.uid(),
  apagados text[] not null default '{}',
  actualizado timestamptz not null default now()
);

-- Avisos ya enviados (para no repetirlos). Solo lo usa el servidor.
create table if not exists public.avisos_enviados (
  clave text primary key,
  creado timestamptz not null default now()
);

alter table public.suscripciones_push enable row level security;
alter table public.avisos_pref enable row level security;
alter table public.avisos_enviados enable row level security;

drop policy if exists "push_leer" on public.suscripciones_push;
create policy "push_leer" on public.suscripciones_push for select to authenticated using (perfil_id = auth.uid());
drop policy if exists "push_borrar" on public.suscripciones_push;
create policy "push_borrar" on public.suscripciones_push for delete to authenticated using (perfil_id = auth.uid());

drop policy if exists "pref_leer" on public.avisos_pref;
create policy "pref_leer" on public.avisos_pref for select to authenticated using (perfil_id = auth.uid());
drop policy if exists "pref_crear" on public.avisos_pref;
create policy "pref_crear" on public.avisos_pref for insert to authenticated with check (perfil_id = auth.uid());
drop policy if exists "pref_editar" on public.avisos_pref;
create policy "pref_editar" on public.avisos_pref for update to authenticated using (perfil_id = auth.uid()) with check (perfil_id = auth.uid());
-- avisos_enviados no tiene políticas: nadie lo lee desde la app, solo el servidor.

-- Guardar la suscripción de este dispositivo a nombre de quien inició sesión
-- (si el dispositivo era de otra persona, pasa a la actual: tabletas compartidas)
create or replace function public.guardar_suscripcion(p_endpoint text, p_p256dh text, p_auth text, p_agente text default '')
returns void language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is null or public.mi_rol() is null then raise exception 'Sin sesión'; end if;
  insert into public.suscripciones_push (endpoint, perfil_id, p256dh, auth, agente)
  values (p_endpoint, auth.uid(), p_p256dh, p_auth, coalesce(p_agente, ''))
  on conflict (endpoint) do update set perfil_id = auth.uid(), p256dh = excluded.p256dh, auth = excluded.auth, agente = excluded.agente, creado = now();
end $$;

create or replace function public.quitar_suscripcion(p_endpoint text)
returns void language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is null then raise exception 'Sin sesión'; end if;
  delete from public.suscripciones_push where endpoint = p_endpoint;
end $$;

grant execute on function public.guardar_suscripcion(text, text, text, text) to authenticated;
grant execute on function public.quitar_suscripcion(text) to authenticated;
