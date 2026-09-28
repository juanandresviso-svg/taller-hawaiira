# Instructivo: publicar la app del Taller Hawaiira

Guía paso a paso para poner en línea la app del taller con **GitHub + Supabase + Vercel**, enviar correos con **Resend** (accesos) y **Brevo** (resumen diario de alertas), e instalarla como **app de escritorio**.

Tiempo estimado: 1 a 2 horas la primera vez. No hace falta programar: todo se hace desde las páginas web de cada servicio.

---

## 0. Cómo encaja todo

```
  Computadora / tableta / teléfono  (app instalada)
                │
                ▼
        VERCEL  ── publica la app (taller.tudominio.com)
          │  ▲            └─ todos los días a las 7:00 a. m. → resumen de alertas → BREVO → correo
          │  └── GITHUB  (guarda el código; cada cambio se publica solo)
          ▼
        SUPABASE ── base de datos, usuarios y contraseñas
          └─ correos de invitación y de contraseña → RESEND → correo
```

| Servicio | Para qué se usa | Plan para empezar |
|---|---|---|
| GitHub | Guardar el código | Gratis (repositorio privado) |
| Supabase | Base de datos, usuarios, tiempo real | Gratis |
| Vercel | Publicar la app y el resumen diario | Hobby gratis para probar; **Pro** para uso comercial |
| Resend | Correos de invitación y recuperar contraseña | Gratis (3.000 correos/mes) |
| Brevo | Resumen diario de alertas | Gratis (300 correos/día) |

> Vercel indica que el plan Hobby es para uso personal y no comercial. Como es la herramienta de una empresa, cuando la usen de verdad pasa a Pro.

**Qué necesitas a la mano**

- Un correo para crear las cuentas (puede ser el mismo en todas).
- Acceso al panel del dominio (DNS) de tu marca, por ejemplo donde está `hawaiirastore.com`. Sin eso los correos pueden llegar a spam.
- La carpeta del proyecto `taller-hawaiira` que te entregué.

Anota cada clave en una nota privada a medida que las creas. Al final hay una tabla con todas.

---

## 1. GitHub: subir el código

1. Crea una cuenta en **github.com** (o entra con la tuya).
2. Arriba a la derecha, **+ → New repository**.
   - Nombre: `taller-hawaiira`
   - Marca **Private**.
   - No marques "Add a README".
   - **Create repository**.
3. Sube los archivos. La forma más fácil es **GitHub Desktop** (desktop.github.com):
   1. Instálalo y entra con tu cuenta.
   2. **File → Clone repository** → elige `taller-hawaiira` → elige una carpeta en tu computadora.
   3. Copia **todo el contenido** de la carpeta `taller-hawaiira` que te entregué dentro de esa carpeta clonada. Incluye los archivos que empiezan con punto (`.gitignore`, `.env.example`); en Mac se ven con Cmd + Shift + punto.
   4. En GitHub Desktop escribe un resumen como "Primera versión" → **Commit to main** → **Push origin**.

   Otra opción: en la página del repositorio, **uploading an existing file** → arrastra los archivos y carpetas → **Commit changes**. No subas la carpeta `node_modules` si existiera.

✅ **Listo cuando:** en github.com ves las carpetas `app`, `components`, `lib`, `public`, `supabase` y los archivos `package.json` y `vercel.json`.

---

## 2. Supabase: base de datos y usuarios

### 2.1 Crear el proyecto

1. Entra a **supabase.com** → **Start your project** → crea la cuenta (puedes entrar con GitHub).
2. **New project**:
   - Name: `taller-hawaiira`
   - Database password: genera una y guárdala.
   - Region: **East US (North Virginia)**, la más cercana a Venezuela.
3. Espera 1 o 2 minutos a que termine de crearse.

### 2.2 Crear las tablas

1. Menú izquierdo → **SQL Editor** → **New query**.
2. Abre el archivo `supabase/schema.sql` del proyecto, copia **todo** y pégalo.
3. Pulsa **Run**. Debe decir *Success. No rows returned*.

Esto crea las tablas (perfiles, configuración, órdenes, registros, historial), la seguridad por rol y las funciones para registrar producción. Si lo corres dos veces no pasa nada.

### 2.3 Copiar las llaves

**Project Settings (engranaje) → API Keys** (también desde el botón **Connect**). Copia:

- **Project URL** → `https://xxxx.supabase.co` → será `NEXT_PUBLIC_SUPABASE_URL`
- **Publishable key** (`sb_publishable_…`) → será `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`
- **Secret key** (`sb_secret_…`, pulsa *Reveal*) → será `SUPABASE_SECRET_KEY`

> ⚠️ La **secret key** da acceso total. Nunca la pegues en el navegador, en WhatsApp ni en el código. Solo va en Vercel (paso 5).

### 2.4 Cerrar el registro público

**Authentication → Sign In / Providers**:

- Desactiva **Allow new users to sign up**. Así solo entra quien tú invites.
- En **Email**, deja activo el proveedor.
- Cambia **Email OTP Expiration** a `86400` (24 horas), para que las invitaciones no venzan en 1 hora.
- **Save**.

### 2.5 Plantillas de correo en español

**Authentication → Emails → Templates**:

1. **Invite user**
   - Subject: `Tu acceso al Taller Hawaiira`
   - Body: borra lo que hay y pega el contenido de `supabase/plantillas/invitacion.html`.
   - **Save**.
2. **Reset password**
   - Subject: `Cambia tu contraseña del Taller Hawaiira`
   - Body: pega `supabase/plantillas/recuperar.html`.
   - **Save**.

(Las direcciones del sitio se completan en el paso 5.4, cuando ya tengas la dirección de Vercel.)

---

## 3. Resend: correos de acceso (invitaciones y contraseñas)

Supabase trae un correo de prueba limitado a pocos mensajes por hora. Resend lo reemplaza para que las invitaciones lleguen bien.

1. Entra a **resend.com** → crea la cuenta.
2. **Domains → Add domain** → escribe un subdominio de tu marca, por ejemplo `mail.hawaiirastore.com` → región **us-east-1** → **Add**.
3. Resend te muestra 3 o 4 registros DNS (MX, TXT/SPF y TXT/DKIM).
   1. En otra pestaña, abre el panel de tu dominio (donde lo compraste o Cloudflare).
   2. Crea cada registro **exactamente** como aparece: tipo, nombre y valor.
   3. Vuelve a Resend → **Verify DNS records**. Puede tardar de minutos a unas horas; espera a que diga **Verified**.
4. **API Keys → Create API key**:
   - Name: `supabase`
   - Permission: **Sending access**
   - Copia la clave `re_…`. Solo se muestra una vez.
5. Conecta Resend con Supabase: **Supabase → Authentication → Emails → SMTP Settings** → activa **Enable custom SMTP** y llena:

| Campo | Valor |
|---|---|
| Sender email | `taller@mail.hawaiirastore.com` (del dominio verificado) |
| Sender name | `Taller Hawaiira` |
| Host | `smtp.resend.com` |
| Port | `465` |
| Username | `resend` |
| Password | tu clave `re_…` |

   **Save**. Desde ahora Supabase envía las invitaciones a través de Resend.

---

## 4. Brevo: resumen diario de alertas

Cada mañana (lunes a sábado, cerca de las 7:00 a. m. de Caracas) la app revisa el taller y envía un correo a cada responsable **solo si tiene alertas**:

- **Dirección** recibe todas las alertas, la carga por estación y las recomendaciones de expansión.
- **Jefa de taller** recibe las suyas, la carga y las recomendaciones.
- **Diseño, Compras y Administración** reciben sus alertas y las de los pedidos donde son dueños.

Pasos:

1. Entra a **brevo.com** → crea la cuenta (plan Free).
2. Verifica un remitente: **Senders, Domains & Dedicated IPs → Domains → Add a domain** → `hawaiirastore.com` (o el subdominio) → agrega en tu DNS los registros que te indique (DKIM, DMARC y el código de Brevo) → **Authenticate**.
3. **Senders → Add a sender** → nombre `Taller Hawaiira`, correo `alertas@hawaiirastore.com`.
4. API: menú de tu perfil (arriba a la derecha) → **SMTP & API → API Keys → Generate a new API key** → nombre `taller` → copia la clave `xkeysib-…`.
5. Si Brevo te pide autorizar IPs para la API (**Security → Authorised IPs**), desactiva el bloqueo por IP. Vercel no usa una IP fija y, si no, el correo se rechaza.

Guarda:

- `BREVO_API_KEY` = `xkeysib-…`
- `BREVO_SENDER_EMAIL` = `alertas@hawaiirastore.com`
- `BREVO_SENDER_NAME` = `Taller Hawaiira`

---

## 5. Vercel: publicar la app

### 5.1 Importar el proyecto

1. Entra a **vercel.com** → **Sign up with GitHub**.
2. **Add New… → Project** → busca `taller-hawaiira` → **Import**. Si no aparece, pulsa *Adjust GitHub App Permissions* y dale acceso al repositorio.
3. Framework: **Next.js** (se detecta solo). No cambies los comandos.

### 5.2 Variables de entorno

Antes de desplegar, abre **Environment Variables** y agrega una por una:

| Nombre | Valor |
|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | `https://xxxx.supabase.co` |
| `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | `sb_publishable_…` |
| `SUPABASE_SECRET_KEY` | `sb_secret_…` |
| `NEXT_PUBLIC_SITE_URL` | por ahora `https://taller-hawaiira.vercel.app` (se ajusta en 5.4) |
| `BREVO_API_KEY` | `xkeysib-…` |
| `BREVO_SENDER_EMAIL` | `alertas@hawaiirastore.com` |
| `BREVO_SENDER_NAME` | `Taller Hawaiira` |
| `CRON_SECRET` | una frase larga inventada, por ejemplo 40 letras y números al azar |

Pulsa **Deploy**. En 1 o 2 minutos te da una dirección tipo `https://taller-hawaiira.vercel.app`.

### 5.3 Dominio propio (opcional, recomendado)

1. **Project → Settings → Domains → Add** → `taller.hawaiirastore.com`.
2. Vercel te indica un registro **CNAME**. Créalo en tu DNS.
3. Cuando aparezca en verde, esa es tu dirección definitiva.

### 5.4 Ajustar la dirección definitiva

1. En Vercel, **Settings → Environment Variables** → edita `NEXT_PUBLIC_SITE_URL` con la dirección final (con `https://` y sin `/` al final).
2. **Deployments → ⋯ → Redeploy**.
3. En **Supabase → Authentication → URL Configuration**:
   - **Site URL**: tu dirección final, por ejemplo `https://taller.hawaiirastore.com`.
   - **Redirect URLs → Add URL**: `https://taller.hawaiirastore.com/**`. Si vas a probar en tu computadora, agrega también `http://localhost:3000/**`.
   - **Save**.

### 5.5 Revisar el resumen diario

En Vercel → **Settings → Cron Jobs** debe aparecer `/api/cron/resumen` con horario `0 11 * * 1-6`. Eso es a las 11:00 UTC, o sea las 7:00 a. m. en Caracas, de lunes a sábado. En el plan Hobby puede salir en cualquier momento entre 7:00 y 7:59. Vercel envía el `CRON_SECRET` solo; no tienes que hacer nada más.

Para probarlo sin esperar: **Cron Jobs → Run** en esa línea. Si no hay alertas, no se envía ningún correo.

---

## 6. Tu primer usuario (Dirección)

Como el registro está cerrado, tu usuario se crea a mano una sola vez:

1. **Supabase → Authentication → Users → Add user → Create new user**.
2. Escribe tu correo y una contraseña, marca **Auto Confirm User** y pulsa **Create user**.
3. **SQL Editor → New query** → pega esto con tu correo y pulsa **Run**:

```sql
update public.perfiles
set rol = 'direccion', nombre = 'Juan Andrés'
where email = 'tu-correo@ejemplo.com';
```

4. Abre tu dirección de Vercel → entra con ese correo y contraseña. Debes ver las pestañas **Tablero, Pedidos, Mi trabajo, Ajustes y Usuarios**.

---

## 7. Invitar al equipo

En la app → **Usuarios → Invitar a una persona**. Llena nombre, correo, rol y estación → **Enviar invitación**. Cada persona recibe un correo (vía Resend), pulsa **Crear mi contraseña** y queda dentro.

Cómo asignar a tu equipo actual:

| Persona | Rol | Estación |
|---|---|---|
| Tu socio | Dirección | Sin estación |
| Jefa de taller | Jefa de taller | Sin estación |
| Administrador | Administración | Sin estación |
| Compras | Compras | Sin estación |
| Diseñador | Diseño | Diseño y preprensa |
| Cortador | Producción | Corte |
| 6 operadoras | Producción | Costura |
| Responsable de serigrafía y su equipo (7) | Producción | Serigrafía |
| Persona de DTF, vinil y empaque | Producción | DTF, vinil y empaque |

Qué ve cada rol:

- **Producción:** solo *Mi trabajo*, con el plan del día de su estación, la meta en piezas, los recordatorios y el botón para registrar.
- **Diseño, Compras y Administración:** Tablero, Pedidos y Mi trabajo. Pueden crear pedidos (todos venden) y marcar arte, material y anticipo.
- **Jefa de taller:** lo anterior más *Ajustes* (tiempos y capacidad). También puede deshacer registros de cualquiera.
- **Dirección:** todo, más *Usuarios* y eliminar pedidos.

> La capacidad de cada estación sale de cuántas personas activas tiene asignadas. Si alguien sale del taller, pulsa **Desactivar** (no se borra su historial).

Después, en **Ajustes**:

1. Carga los tiempos estándar medidos. Cronometra 10 piezas seguidas por etapa, divide entre 10 y promedia dos personas.
2. Marca **Los tiempos ya fueron medidos en el taller**.
3. **Guardar ajustes**.

---

## 8. Instalar como app de escritorio

La app se instala desde el navegador y queda con su propio ícono y ventana. Se actualiza sola cada vez que publicas un cambio.

**Windows o Mac con Chrome o Edge**

1. Abre la dirección de la app y entra.
2. En la barra de direcciones, a la derecha, pulsa el ícono de **Instalar** (una pantalla con una flecha). En Chrome también está en **⋮ → Transmitir, guardar y compartir → Instalar página como app**.
3. **Instalar**. Aparece en el menú Inicio (Windows) o en Aplicaciones y el Dock (Mac).

**Mac con Safari**

- **Archivo → Agregar al Dock**.

**Tableta del taller o teléfono**

- **iPad o iPhone (Safari):** botón **Compartir → Agregar a pantalla de inicio**.
- **Android (Chrome):** **⋮ → Instalar app** o **Agregar a pantalla principal**.

Sugerencia: en la tableta del piso de producción, cada operadora entra con su usuario. Si varias comparten una tableta, deben pulsar **Salir** al terminar, para que los registros queden a nombre de quien trabajó.

---

## 9. Mantenimiento

**Publicar cambios:** cualquier cambio que se suba a GitHub (rama `main`) se publica solo en Vercel en 1 o 2 minutos. Las apps instaladas se actualizan al volver a abrirlas.

**Probar en tu computadora (opcional, para quien programe):**

```bash
npm install
cp .env.example .env.local   # y llena los valores
npm run dev                  # abre http://localhost:3000
```

**Problemas comunes**

| Síntoma | Causa probable | Solución |
|---|---|---|
| La invitación no llega | Dominio de Resend sin verificar o SMTP mal configurado | Revisa el paso 3. En Resend → **Emails** ves si salió y si rebotó. |
| El enlace del correo dice que venció | Pasaron más de 24 horas o ya se usó | Vuelve a invitar desde Usuarios (reenvía el acceso) o usa **Olvidé mi contraseña**. |
| El enlace lleva a la página de entrada sin sesión | Site URL o Redirect URLs de Supabase mal escritos | Revisa el paso 5.4 (con `https://` y el `/**` al final). |
| "Tu acceso está desactivado" | Perfil desactivado | Dirección lo reactiva en Usuarios → Desactivados. |
| No llega el resumen diario | Clave de Brevo, remitente sin verificar o bloqueo por IP | Revisa el paso 4. En Vercel → **Logs** busca `/api/cron/resumen`. |
| Una estación muestra "sin capacidad" | Nadie activo asignado a esa estación | Asigna al menos una persona en Usuarios. |
| Supabase pausó el proyecto | En el plan gratuito se pausa tras 7 días sin actividad | El resumen diario mantiene la actividad. Si pasa, pulsa **Restore** en Supabase. |

**Respaldos:** en el plan gratuito Supabase no guarda copias descargables. Cuando el taller dependa de la app, pasa a **Supabase Pro** (copias diarias) o exporta periódicamente desde **Database → Backups**.

---

## 10. Tabla de claves (llénala y guárdala en un lugar seguro)

| Variable | Dónde se obtiene | Dónde se pega |
|---|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase → Settings → API Keys | Vercel |
| `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | Supabase → Settings → API Keys | Vercel |
| `SUPABASE_SECRET_KEY` | Supabase → Settings → API Keys (secret) | Vercel (nunca en otro lado) |
| `NEXT_PUBLIC_SITE_URL` | Tu dirección final | Vercel |
| Clave `re_…` de Resend | Resend → API Keys | Supabase → SMTP Settings (Password) |
| `BREVO_API_KEY` | Brevo → SMTP & API → API Keys | Vercel |
| `BREVO_SENDER_EMAIL` / `BREVO_SENDER_NAME` | Remitente verificado en Brevo | Vercel |
| `CRON_SECRET` | La inventas tú | Vercel |

---

### Qué contiene el proyecto

```
app/                  Páginas: entrada, crear contraseña, app principal, API
  api/usuarios/       Invitar usuarios (solo Dirección)
  api/cron/resumen/   Resumen diario por Brevo
components/           Tablero, Pedidos, Mi trabajo, Ajustes, Usuarios
lib/motor.js          Cálculo de capacidad, fechas proyectadas, alertas y recomendaciones
lib/correo.js         Envío con Brevo y diseño del correo
supabase/schema.sql   Base de datos, seguridad y funciones
supabase/plantillas/  Correos de invitación y contraseña (Resend)
public/               Logo, íconos y service worker (app instalable)
vercel.json           Horario del resumen diario
```
