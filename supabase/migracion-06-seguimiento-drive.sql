-- =====================================================================
-- Migración 06 · Seguimiento del flujo del pedido y exportación a Google Drive
-- Se puede correr más de una vez sin dañar nada.
-- Supabase → SQL Editor → New query → pegar todo → Run
-- =====================================================================

-- ---------- 1. Hitos: cada paso cumplido del flujo de un pedido ----------
-- clave = 'op:<pedido>:<paso>' (pasos del pedido) o 'cot:<cotización>:<paso>' (cotizaciones sin pedido)
-- auto = true: lo registra el servidor al detectarlo (OC subida, anticipo marcado, producción terminada…)
-- auto = false: lo marca una persona en la app (control de calidad, saldo facturado, saldo cobrado)
create table if not exists public.hitos (
  clave text primary key,
  orden_id uuid references public.ordenes(id) on delete cascade,
  cotizacion_id uuid references public.cotizaciones(id) on delete cascade,
  paso text not null,
  hecho timestamptz not null default now(),
  por uuid references public.perfiles(id) on delete set null default auth.uid(),
  nota text not null default '',
  auto boolean not null default false
);
create index if not exists hitos_orden_idx on public.hitos (orden_id);

-- ---------- 2. Documentos y carpetas exportados a Google Drive ----------
-- Solo los escribe el servidor. La app los lee para mostrar los enlaces.
create table if not exists public.documentos (
  clave text primary key,            -- 'carpeta:raiz', 'carpeta:op:<id>', 'hoja', 'doc:op:<id>:<paso>', 'log:<clave del hito>'…
  orden_id uuid references public.ordenes(id) on delete cascade,
  cotizacion_id uuid references public.cotizaciones(id) on delete cascade,
  tipo text not null default 'documento' check (tipo in ('carpeta','hoja','documento','registro')),
  nombre text not null default '',
  drive_id text,
  url text,
  estado text not null default 'pendiente' check (estado in ('pendiente','ok','error')),
  error text,
  intentos int not null default 0,
  creado timestamptz not null default now(),
  actualizado timestamptz not null default now()
);
create index if not exists documentos_orden_idx on public.documentos (orden_id);

-- ---------- 3. Cuenta de Google conectada (una sola fila). SOLO servidor ----------
create table if not exists public.drive_cuenta (
  id int primary key default 1 check (id = 1),
  email text,
  refresh_token text,
  conectado timestamptz,
  por uuid references public.perfiles(id) on delete set null,
  ultima_sync timestamptz,
  ultimo_error text
);

-- ---------- Seguridad por filas ----------
alter table public.hitos        enable row level security;
alter table public.documentos   enable row level security;
alter table public.drive_cuenta enable row level security;

drop policy if exists "hitos_leer" on public.hitos;
create policy "hitos_leer" on public.hitos for select to authenticated
  using (public.mi_rol() is not null);
-- Las personas solo crean y quitan pasos manuales, siempre a su propio nombre
drop policy if exists "hitos_crear" on public.hitos;
create policy "hitos_crear" on public.hitos for insert to authenticated
  with check (public.mi_rol() in ('direccion','jefa','admin','compras','diseno') and auto = false and por = auth.uid());
drop policy if exists "hitos_borrar" on public.hitos;
create policy "hitos_borrar" on public.hitos for delete to authenticated
  using (auto = false and (public.mi_rol() = 'direccion' or (por = auth.uid() and public.mi_rol() in ('jefa','admin','compras','diseno'))));

drop policy if exists "documentos_leer" on public.documentos;
create policy "documentos_leer" on public.documentos for select to authenticated
  using (public.mi_rol() is not null);
-- documentos y drive_cuenta no tienen políticas de escritura: solo el servidor los modifica.

-- ---------- Tiempo real ----------
do $$ begin
  begin alter publication supabase_realtime add table public.hitos;      exception when duplicate_object then null; end;
  begin alter publication supabase_realtime add table public.documentos; exception when duplicate_object then null; end;
end $$;
