# Instructivo: publicar la app del Taller Hawaiira (sin dominio propio)

Guía paso a paso para poner en línea la app del taller con **GitHub + Supabase + Vercel**, enviar los correos desde un **Gmail exclusivo del taller** e instalarla como **app de escritorio**. No se usa ningún dominio: la app vive en una dirección gratuita de Vercel, del tipo `taller-hawaiira.vercel.app`.

Tiempo estimado: 1 hora. No hace falta programar.

---

## 0. Cómo encaja todo

```
  Computadora / tableta / teléfono  (app instalada)
                │
                ▼
        VERCEL  ── publica la app en taller-hawaiira.vercel.app
          │  ▲            └─ cada mañana: resumen de alertas → GMAIL DEL TALLER → correo al equipo
          │  └── GITHUB  (guarda el código; cada cambio se publica solo)
          ▼
        SUPABASE ── base de datos, usuarios y contraseñas
          └─ invitaciones y cambio de contraseña → GMAIL DEL TALLER → correo
```

| Servicio | Para qué | Costo |
|---|---|---|
| Gmail del taller | Envía invitaciones, cambios de contraseña y el resumen diario | Gratis (hasta unos 500 correos al día) |
| GitHub | Guarda el código | Gratis (repositorio privado) |
| Supabase | Base de datos, usuarios y tiempo real | Gratis para empezar |
| Vercel | Publica la app y programa el resumen diario | Hobby gratis para probar; **Pro** para uso comercial |

> Vercel indica que el plan Hobby es para uso personal y no comercial. Cuando el taller use la app de verdad, conviene pasar a Pro.

Anota cada clave en una nota privada a medida que las creas. Al final hay una tabla con todas.

---

## 1. Gmail exclusivo del taller

Esta cuenta solo se usa para que la app envíe correos. Así no se mezcla con tu correo personal ni con Hawaiira Store.

1. Crea una cuenta nueva en **accounts.google.com**, por ejemplo `tallerhawaiira@gmail.com`.
2. Activa la verificación en dos pasos (Google la exige para el paso 3):
   1. Entra a **myaccount.google.com → Seguridad**.
   2. Pulsa **Verificación en dos pasos** → **Activar** y sigue los pasos con tu teléfono.
3. Crea una **contraseña de aplicación**:
   1. Entra a **myaccount.google.com/apppasswords** (si no aparece, busca "Contraseñas de aplicaciones" en la barra de búsqueda de tu cuenta de Google).
   2. Nombre: `Taller app` → **Crear**.
   3. Google muestra una clave de **16 letras** (por ejemplo `abcd efgh ijkl mnop`). Cópiala: solo se muestra una vez.

Guarda:

- **Correo del taller:** `tallerhawaiira@gmail.com`
- **Contraseña de aplicación:** las 16 letras

> Nunca uses la contraseña normal de la cuenta. Si un día crees que la clave se filtró, bórrala en la misma página y crea otra.

---

## 2. GitHub: subir el código

1. Crea una cuenta en **github.com** (o entra con la tuya).
2. Arriba a la derecha, **+ → New repository**:
   - Nombre: `taller-hawaiira`
   - Marca **Private**.
   - No marques "Add a README".
   - **Create repository**.
3. Sube los archivos con **GitHub Desktop** (desktop.github.com):
   1. Instálalo y entra con tu cuenta.
   2. **File → Clone repository** → elige `taller-hawaiira` → elige una carpeta en tu computadora.
   3. Copia **todo el contenido** de la carpeta `taller-hawaiira` que te entregué dentro de esa carpeta clonada. Incluye los archivos ocultos `.gitignore` y `.env.example`; en Mac se muestran con Cmd + Shift + punto.
   4. En GitHub Desktop escribe "Primera versión" → **Commit to main** → **Push origin**.

✅ **Listo cuando:** en github.com ves las carpetas `app`, `components`, `lib`, `public` y `supabase`, y los archivos `package.json` y `vercel.json`.

---

## 3. Supabase: base de datos y usuarios

### 3.1 Crear el proyecto

1. Entra a **supabase.com** → **Start your project** (puedes entrar con GitHub).
2. **New project**:
   - Name: `taller-hawaiira`
   - Database password: genera una y guárdala.
   - Region: **East US (North Virginia)**.
3. Espera 1 o 2 minutos a que termine de crearse.

### 3.2 Crear las tablas

1. Menú izquierdo → **SQL Editor** → **New query**.
2. Abre el archivo `supabase/schema.sql` con un editor de texto. No lo abras con doble clic: haz clic derecho → **Abrir con** → **TextEdit** (Mac) o **Bloc de notas** (Windows).
3. Selecciona todo (Cmd/Ctrl + A), copia y pégalo en Supabase.
4. Pulsa **Run**. Debe decir *Success. No rows returned*.

5. Repite los pasos 1 a 4 con el archivo `supabase/migracion-02-costos.sql` (agrega bordado, materiales, costos y cotizaciones).

### 3.3 Copiar las llaves

**Project Settings (engranaje) → API Keys**. Copia:

- **Project URL** (`https://xxxx.supabase.co`)
- **Publishable key** (`sb_publishable_…`)
- **Secret key** (`sb_secret_…`, pulsa *Reveal*)

> ⚠️ La **secret key** da acceso total a los datos. Solo se pega en Vercel (paso 4). Nunca la compartas.

### 3.4 Cerrar el registro público

**Authentication → Sign In / Providers**:

- Desactiva **Allow new users to sign up**. Así solo entra quien tú invites.
- En **Email**, cambia **Email OTP Expiration** a `86400` (24 horas).
- **Save**.

### 3.5 Conectar el Gmail del taller

**Authentication → Emails → SMTP Settings** → activa **Enable custom SMTP** y llena:

| Campo | Valor |
|---|---|
| Sender email | `tallerhawaiira@gmail.com` |
| Sender name | `Taller Hawaiira` |
| Host | `smtp.gmail.com` |
| Port | `465` |
| Username | `tallerhawaiira@gmail.com` |
| Password | la contraseña de aplicación de 16 letras (sin espacios) |

**Save**.

Después, en **Authentication → Rate Limits**, sube **Rate limit for sending emails** a `60` por hora. Así puedes invitar a todo el equipo el mismo día.

### 3.6 Plantillas de correo en español

**Authentication → Emails → Templates**. Copia cada bloque completo, desde `<table` hasta el último `</table>`. No cambies lo que está entre llaves `{{ }}`: Supabase lo completa solo.

**Plantilla "Invite user"**

- Subject: `Tu acceso al Taller Hawaiira`
- Body (borra lo que hay y pega):

```html
<table width="100%" cellpadding="0" cellspacing="0" style="background:#FFFFFF;font-family:Arial,Helvetica,sans-serif;color:#111111">
  <tr><td align="center" style="padding:32px 16px">
    <table width="100%" cellpadding="0" cellspacing="0" style="max-width:520px">
      <tr><td>
        <img src="{{ .SiteURL }}/icons/icon-192.png" width="56" height="56" alt="Hawaiira Studio" style="border-radius:12px">
        <h1 style="font-size:22px;margin:20px 0 8px">Te damos la bienvenida al Taller Hawaiira</h1>
        <p style="font-size:15px;line-height:1.5;color:#5C5C58;margin:0 0 24px">Te invitaron a la app del taller, donde se siguen los pedidos, la producción y las alertas. Crea tu contraseña para entrar.</p>
        <p style="margin:0 0 28px">
          <a href="{{ .SiteURL }}/auth/confirm?token_hash={{ .TokenHash }}&type=invite&next=/cuenta/clave"
             style="background:#111111;color:#FFFFFF;padding:12px 20px;border-radius:8px;text-decoration:none;font-weight:bold;display:inline-block">Crear mi contraseña</a>
        </p>
        <p style="font-size:12px;color:#8D8D88;margin:0">El enlace vence en 24 horas. Si no esperabas este correo, puedes ignorarlo.</p>
      </td></tr>
    </table>
  </td></tr>
</table>
```

**Save**.

**Plantilla "Reset password"**

- Subject: `Cambia tu contraseña del Taller Hawaiira`
- Body:

```html
<table width="100%" cellpadding="0" cellspacing="0" style="background:#FFFFFF;font-family:Arial,Helvetica,sans-serif;color:#111111">
  <tr><td align="center" style="padding:32px 16px">
    <table width="100%" cellpadding="0" cellspacing="0" style="max-width:520px">
      <tr><td>
        <img src="{{ .SiteURL }}/icons/icon-192.png" width="56" height="56" alt="Hawaiira Studio" style="border-radius:12px">
        <h1 style="font-size:22px;margin:20px 0 8px">Crea una contraseña nueva</h1>
        <p style="font-size:15px;line-height:1.5;color:#5C5C58;margin:0 0 24px">Recibimos una solicitud para cambiar tu contraseña del Taller Hawaiira.</p>
        <p style="margin:0 0 28px">
          <a href="{{ .SiteURL }}/auth/confirm?token_hash={{ .TokenHash }}&type=recovery&next=/cuenta/clave"
             style="background:#111111;color:#FFFFFF;padding:12px 20px;border-radius:8px;text-decoration:none;font-weight:bold;display:inline-block">Cambiar contraseña</a>
        </p>
        <p style="font-size:12px;color:#8D8D88;margin:0">Si no pediste el cambio, ignora este correo: tu contraseña sigue igual.</p>
      </td></tr>
    </table>
  </td></tr>
</table>
```

**Save**.

---

## 4. Vercel: publicar la app

### 4.1 Importar el proyecto

1. Entra a **vercel.com** → **Sign up with GitHub**.
2. **Add New… → Project** → busca `taller-hawaiira` → **Import**. Si no aparece, pulsa *Adjust GitHub App Permissions* y dale acceso al repositorio.
3. Framework: **Next.js** (se detecta solo). En **Project Name** deja `taller-hawaiira`; ese nombre define tu dirección.

### 4.2 Variables de entorno

Antes de desplegar, abre **Environment Variables** y agrega:

| Nombre | Valor |
|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | `https://xxxx.supabase.co` |
| `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | `sb_publishable_…` |
| `SUPABASE_SECRET_KEY` | `sb_secret_…` |
| `GMAIL_USER` | `tallerhawaiira@gmail.com` |
| `GMAIL_APP_PASSWORD` | las 16 letras |
| `MAIL_FROM_NAME` | `Taller Hawaiira` |
| `CRON_SECRET` | una frase larga inventada, por ejemplo 40 letras y números al azar |

No hace falta poner la dirección de la app: la toma sola de Vercel.

Pulsa **Deploy**. En 1 o 2 minutos aparece tu dirección, por ejemplo `https://taller-hawaiira.vercel.app`. Cópiala.

> Si el nombre ya estaba tomado, Vercel agrega letras (por ejemplo `taller-hawaiira-abc.vercel.app`). Para cambiarla: **Settings → Domains → Edit** y elige otra que termine en `.vercel.app`, como `tallerhs.vercel.app`. No tiene costo ni requiere dominio.

### 4.3 Avisarle a Supabase cuál es la dirección

**Supabase → Authentication → URL Configuration**:

- **Site URL:** tu dirección de Vercel, por ejemplo `https://taller-hawaiira.vercel.app` (con `https://` y sin `/` al final).
- **Redirect URLs → Add URL:** la misma dirección con `/**` al final, por ejemplo `https://taller-hawaiira.vercel.app/**`.
- **Save**.

### 4.4 Revisar el resumen diario

En Vercel → **Settings → Cron Jobs** debe aparecer `/api/cron/resumen` con horario `0 11 * * 1-6`. Eso es a las 7:00 a. m. de Caracas, de lunes a sábado; en el plan Hobby puede salir en cualquier momento entre 7:00 y 7:59.

Para probarlo sin esperar, pulsa **Run** en esa línea. Si no hay alertas, no se envía nada.

---

## 5. Tu primer usuario (Dirección)

1. **Supabase → Authentication → Users → Add user → Create new user**.
2. Escribe tu correo y una contraseña, marca **Auto Confirm User** y pulsa **Create user**.
3. **SQL Editor → New query** → pega esto con tu correo y pulsa **Run**:

```sql
update public.perfiles
set rol = 'direccion', nombre = 'Juan Andrés'
where email = 'tu-correo@ejemplo.com';
```

4. Abre tu dirección de Vercel y entra con ese correo y contraseña. Debes ver las pestañas **Tablero, Pedidos, Mi trabajo, Ajustes y Usuarios**.

---

## 6. Invitar al equipo

En la app → **Usuarios → Invitar a una persona**. Llena nombre, correo, rol y estación → **Enviar invitación**. A cada persona le llega un correo desde el Gmail del taller; pulsa **Crear mi contraseña** y queda dentro.

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

> Si una invitación no aparece en la bandeja de entrada, revisa **Spam** o **Promociones** y marca el correo como "No es spam". Así los siguientes llegan bien.

Después, en **Ajustes**:

1. Carga los tiempos estándar medidos.
2. Marca **Los tiempos ya fueron medidos en el taller**.
3. **Guardar ajustes**.

---

## 7. Instalar como app de escritorio

La app se instala desde el navegador, queda con el ícono de Hawaiira Studio en su propia ventana y se actualiza sola.

**Windows o Mac con Chrome o Edge**

1. Abre tu dirección de Vercel y entra.
2. En la barra de direcciones, a la derecha, pulsa el ícono **Instalar** (una pantalla con una flecha). En Chrome también está en **⋮ → Transmitir, guardar y compartir → Instalar página como app**.
3. **Instalar**. Aparece en el menú Inicio (Windows) o en Aplicaciones y el Dock (Mac).

**Mac con Safari**

- **Archivo → Agregar al Dock**.

**Tableta o teléfono**

- **iPad o iPhone (Safari):** **Compartir → Agregar a pantalla de inicio**.
- **Android (Chrome):** **⋮ → Instalar app**.

---

## 8. Mantenimiento y problemas comunes

**Publicar cambios:** todo lo que se suba a GitHub en la rama `main` se publica solo en Vercel en 1 o 2 minutos.

| Síntoma | Causa probable | Solución |
|---|---|---|
| La invitación no llega | Contraseña de aplicación mal copiada o SMTP incompleto | Revisa el paso 3.5. Mira también en Spam. |
| Supabase dice "Error sending invite email" | Gmail rechazó la clave | Crea otra contraseña de aplicación y pégala sin espacios en Supabase y en Vercel. |
| El enlace del correo lleva a la entrada sin sesión | Site URL o Redirect URLs mal escritos | Revisa el paso 4.3. |
| El enlace dice que venció | Pasaron más de 24 horas o ya se usó | Reinvita desde Usuarios o usa **Olvidé mi contraseña**. |
| No llega el resumen diario | Variables de Gmail en Vercel mal escritas | Revisa `GMAIL_USER` y `GMAIL_APP_PASSWORD` y redespliega. Mira **Vercel → Logs**. |
| Una estación muestra "sin capacidad" | Nadie activo asignado a esa estación | Asigna al menos una persona en Usuarios. |
| Supabase pausó el proyecto | En el plan gratuito se pausa tras 7 días sin uso | El resumen diario lo mantiene activo. Si pasa, pulsa **Restore**. |

**Respaldos:** cuando el taller dependa de la app, pasa a **Supabase Pro** para tener copias diarias.

**Si algún día quieres un dominio propio para el taller** (separado de Hawaiira Store), basta con agregarlo en **Vercel → Settings → Domains** y actualizar las direcciones del paso 4.3. No hay que cambiar el código.

---

## 9. Tabla de claves (guárdala en un lugar seguro)

| Clave | Dónde se obtiene | Dónde se pega |
|---|---|---|
| Correo del taller | Paso 1 | Supabase (SMTP) y Vercel (`GMAIL_USER`) |
| Contraseña de aplicación (16 letras) | myaccount.google.com/apppasswords | Supabase (SMTP) y Vercel (`GMAIL_APP_PASSWORD`) |
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase → API Keys | Vercel |
| `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | Supabase → API Keys | Vercel |
| `SUPABASE_SECRET_KEY` | Supabase → API Keys | Solo Vercel |
| `CRON_SECRET` | La inventas tú | Vercel |
| Dirección de la app | Vercel, después del primer despliegue | Supabase → URL Configuration |
