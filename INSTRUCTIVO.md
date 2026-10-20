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
6. Repite los pasos 1 a 4 con `supabase/migracion-03-tiempos.sql` (medición de tiempos reales, aprendizaje e informe de producción).
7. Repite los pasos 1 a 4 con `supabase/migracion-04-avisos-oc.sql` (notificaciones push y orden de compra del cliente; crea también la carpeta privada `ordenes-compra` en **Storage**).
8. Repite los pasos 1 a 4 con `supabase/migracion-05-enlaces.sql` (enlaces de invitación por rol).
9. Repite los pasos 1 a 4 con `supabase/migracion-06-seguimiento-drive.sql` (seguimiento del flujo del pedido paso a paso y exportación de documentos a Google Drive).
10. Repite los pasos 1 a 4 con `supabase/migracion-07-clientes-oc-trazabilidad.sql` (clientes y sus estadísticas, datos leídos de la orden de compra, envío de la orden de producción y los 31 pasos del flujograma). Crea los clientes de los pedidos y cotizaciones que ya existen.
11. Repite los pasos 1 a 4 con `supabase/migracion-08-formato-cotizacion.sql` (formato de cotización de Hawaiira Studio: método de pago, datos de INVERSIONES HAWAIIRA C.A. y numeración desde la 280).
12. Repite los pasos 1 a 4 con `supabase/migracion-09-costos-pedido.sql` (costos adicionales de cada pedido y corrección de salidas de material).
13. Repite los pasos 1 a 4 con `supabase/migracion-10-lista-precios.sql` (Materiales como lista de precios: el stock solo se lleva en los materiales marcados "en almacén" y se guarda el precio pagado en cada pedido).

> Todas las migraciones se pueden volver a correr sin dañar nada. Si tienes dudas de cuál corriste, córrelas otra vez en orden.

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

### 4.5 Notificaciones push (una sola vez)

Las notificaciones llegan aunque la app esté cerrada. Necesitan un par de claves propias del taller (se llaman claves VAPID). No cuestan nada.

1. Entra a la app con tu usuario de Dirección y pulsa **Notificaciones** (arriba a la derecha).
2. En el recuadro *Falta configurar las notificaciones* pulsa **Generar claves**. Las claves se crean en tu navegador y no se envían a ningún lado.
3. En **Vercel → Settings → Environment Variables** agrega, para Production:

| Nombre | Valor |
|---|---|
| `NEXT_PUBLIC_VAPID_PUBLIC_KEY` | la primera clave (pública, unas 87 letras) |
| `VAPID_PRIVATE_KEY` | la segunda clave (privada, unas 43 letras) |
| `VAPID_SUBJECT` | `mailto:` seguido del Gmail del taller, por ejemplo `mailto:tallerhawaiira@gmail.com` |

4. **Deployments → ⋯ → Redeploy**. La clave pública solo se aplica al volver a desplegar.
5. Vuelve a abrir **Notificaciones** → **Activar en este dispositivo** → acepta el permiso del navegador → **Enviar prueba**. Debe aparecer un aviso en segundos.

> Importante: no cambies las claves después. Si las cambias, todas las personas tienen que volver a activar las notificaciones en sus dispositivos.

**iPhone:** las notificaciones solo funcionan con la app agregada a la pantalla de inicio (Safari → Compartir → *Agregar a inicio*) y abierta desde ese ícono. En Android, Mac y Windows funcionan en Chrome o Edge, instalada o no.

### 4.6 Google Drive: documentos de cada pedido (una sola vez)

Con esto, en cada paso importante del pedido la app guarda el documento en Google Drive y anota el paso en una hoja de cálculo:

```
Taller Hawaiira · Documentos/
├── Seguimiento de pedidos      ← hoja: "Estado de pedidos" (una fila por pedido) y "Bitácora" (una fila por paso cumplido)
├── Cotizaciones/               ← cada cotización enviada, en PDF
└── Pedidos/
    └── OP-0012 · Cliente/
        ├── 01 Cotización COT-0007.pdf        (al aprobar la cotización)
        ├── 02 Orden de compra del cliente     (copia de la OC que se subió)
        ├── 03 Orden de producción OP-0012.pdf (al enviar la orden de producción)
        ├── 04 Nota de entrega OP-0012.pdf     (al terminar el empaque o al marcar entregado)
        └── 05 Informe de cierre OP-0012.pdf   (al marcar "Saldo cobrado")
```

Se usa el **Gmail del taller** (paso 1). La app pide el permiso más limitado de Google (`drive.file`): solo puede ver y modificar las carpetas y archivos que ella misma crea, nunca el resto del Drive.

**A. Crear la llave en Google Cloud** (con el Gmail del taller abierto)

1. Entra a **console.cloud.google.com** → arriba, selector de proyectos → **Proyecto nuevo** → nombre `Taller Hawaiira` → **Crear**. Verifica que quede seleccionado.
2. **APIs y servicios → Biblioteca**: busca y **Habilita** `Google Drive API`. Repite con `Google Sheets API`.
3. Menú → **Google Auth Platform** (o *APIs y servicios → Pantalla de consentimiento de OAuth*) → **Comenzar**:
   - Nombre de la app: `Taller Hawaiira` · Correo de asistencia: el Gmail del taller.
   - Público: **Externo**.
   - Información de contacto: el Gmail del taller → acepta y **Crear**.
4. **Acceso a los datos → Agregar o quitar permisos**: marca `.../auth/drive.file` ("Ver, editar, crear y borrar solo los archivos de Google Drive que uses con esta app") → **Actualizar** → **Guardar**.
5. **Desarrollo de la marca** (*Branding*): Google exige estos datos para poder publicar.
   - Nombre de la app: `Taller Hawaiira` (igual al título de la página principal).
   - Logotipo: **déjalo vacío**. Subir un logo obliga a una revisión de Google que tarda semanas.
   - Página principal de la aplicación: tu dirección + `/acerca`, por ejemplo `https://taller-hawaiira-v5ho.vercel.app/acerca`
   - Vínculo a la política de privacidad: tu dirección + `/privacidad`
   - Condiciones del servicio: puedes dejarlo vacío.
   - **Dominios autorizados → Agregar dominio**: tu dirección sin `https://`, por ejemplo `taller-hawaiira-v5ho.vercel.app`
   - Correo de contacto del desarrollador: el Gmail del taller → **Guardar**.
   Antes, publica en Vercel la versión que trae las páginas `/acerca` y `/privacidad` y ábrelas en una ventana de incógnito para comprobar que se ven sin iniciar sesión.
6. **Público → Publicar app → Confirmar**. Importante: si la app queda en modo *Prueba*, Google corta el permiso cada 7 días y la exportación se detiene.
7. **Clientes → Crear cliente**:
   - Tipo de aplicación: **Aplicación web** · Nombre: `App del taller`.
   - **URIs de redireccionamiento autorizados → Agregar URI**: tu dirección + `/api/drive/callback`, por ejemplo `https://taller-hawaiira-v5ho.vercel.app/api/drive/callback`. (La app la muestra exacta en **Ajustes → Google Drive**, con botón **Copiar**.)
   - **Crear**. Copia el **ID de cliente** y el **Secreto del cliente**.

**B. Pegar la llave en Vercel**

| Nombre | Valor |
|---|---|
| `GOOGLE_CLIENT_ID` | el ID de cliente (termina en `.apps.googleusercontent.com`) |
| `GOOGLE_CLIENT_SECRET` | el secreto del cliente (empieza por `GOCSPX-`) |

**Deployments → ⋯ → Redeploy**.

**C. Conectar desde la app** (usuario de Dirección)

1. **Ajustes → Google Drive → Conectar Google Drive**.
2. Elige el **Gmail del taller** y pulsa **Permitir**. Si Google muestra *"Google no verificó esta app"*, pulsa **Configuración avanzada → Ir a Taller Hawaiira** (es tu propia app).
3. Vuelves a la app con el aviso *Google Drive conectado*. Pulsa **Sincronizar ahora**: la primera vez sube los documentos de los pedidos en curso (puede tardar un par de minutos).
4. Pulsa **Abrir carpeta** y **Abrir hoja de seguimiento** para verlas. Comparte la carpeta desde Drive con quien deba consultarla (solo lectura recomendada).

Desde ese momento la app sincroniza sola después de cada cambio y una vez al día con el resumen. Los pedidos entregados antes de activar el seguimiento se consideran cerrados y no se exportan.

### 4.7 Lectura de la orden de compra con inteligencia artificial (una sola vez)

La app lee el PDF o la foto de la orden de compra del cliente (número de OC, unidades, monto a pagar, fecha de entrega, tallas) con Claude, de Anthropic. Sin esta clave todo funciona igual, pero los datos de la OC se escriben a mano.

1. Entra a **console.anthropic.com** con el correo del taller y crea la cuenta.
2. **Billing** (Facturación): agrega una tarjeta y una recarga pequeña (por ejemplo US$ 5). Cada OC cuesta del orden de 1 a 3 centavos de dólar.
3. **API Keys → Create Key** → nombre `Taller Hawaiira` → copia la clave (empieza por `sk-ant-`). Solo se muestra una vez.
4. En **Vercel → Settings → Environment Variables** agrega `ANTHROPIC_API_KEY` con esa clave → **Redeploy**.
5. Prueba: **Pedidos → Nuevo pedido desde OC** → sube una OC → **Subir y leer**. En unos segundos aparecen los datos marcados como *leído*.

> Opcional: `ANTHROPIC_MODEL` para usar otro modelo. Si lo dejas vacío la app elige uno sola.

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

**Más rápido: enlaces por rol.** En **Usuarios → Enlaces de invitación por rol** pulsa **Crear un enlace para cada rol**. Se crea un enlace distinto para jefe de taller, administración, compras, diseño y cada estación de producción. Manda a cada persona el de su rol (botón **WhatsApp** o **Copiar**). Al abrirlo escribe nombre, correo y contraseña y entra directo, sin esperar correos. Te llega una notificación por cada registro. Si un enlace se filtra, pulsa **Desactivar**.

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
| "Falta configurar las claves de notificaciones" | Faltan las variables VAPID o no se redesplegó | Revisa el paso 4.5 y pulsa **Redeploy**. |
| La prueba de notificación no llega | Permiso bloqueado en el navegador o el sistema | Candado junto a la dirección → Notificaciones → Permitir. En Mac: Configuración del Sistema → Notificaciones → Chrome. Luego desactiva y vuelve a activar en la app. |
| Error al subir la orden de compra | No se corrió la migración 04 | Corre `supabase/migracion-04-avisos-oc.sql` (paso 3.2). |
| No aparece el seguimiento en los pedidos | No se corrió la migración 06 | Corre `supabase/migracion-06-seguimiento-drive.sql` (paso 3.2). |
| La pestaña Clientes sale vacía o "Enviar orden de producción" da error | No se corrió la migración 07 | Corre `supabase/migracion-07-clientes-oc-trazabilidad.sql` (paso 3.2). |
| "Falta la clave ANTHROPIC_API_KEY" al leer la OC | No se configuró la lectura con IA | Paso 4.7. Mientras tanto, escribe los datos de la OC a mano. |
| "La clave ANTHROPIC_API_KEY no es válida" o la lectura falla siempre | Clave mal copiada o sin saldo | Crea otra clave en console.anthropic.com, revisa el saldo en Billing y pulsa **Redeploy**. |
| El correo de la orden de producción llega sin PDF | Google Drive no está conectado | Conecta Drive (paso 4.6). Sin Drive la orden va en el cuerpo del correo. |
| Ajustes → Google Drive dice "Falta configurar" | Faltan `GOOGLE_CLIENT_ID` o `GOOGLE_CLIENT_SECRET`, o no se redesplegó | Revisa el paso 4.6 B y pulsa **Redeploy**. |
| Google no deja publicar: "OAuth configuration is incomplete… Branding page" | Faltan página principal, política de privacidad o dominio autorizado | Completa **Desarrollo de la marca** (paso 4.6 A.5) con `/acerca`, `/privacidad` y el dominio de Vercel, sin logo. |
| Google dice `redirect_uri_mismatch` al conectar | La dirección de regreso no es idéntica a la registrada | Copia la que muestra **Ajustes → Google Drive** y pégala en Google Cloud → Clientes → URIs de redireccionamiento (paso 4.6 A.7). |
| "Google revocó o venció el permiso" | La app de Google quedó en modo Prueba (7 días) o se quitó el acceso | Publica la app (paso 4.6 A.6) y vuelve a pulsar **Conectar Google Drive**. |
| Un documento dice "no se pudo guardar en Drive" | Falló la subida (red o permiso) | La app reintenta sola hasta 5 veces. El detalle está en **Ajustes → Google Drive → Documentos con error**. |
| Borré la carpeta en Drive por error | — | Sácala de la papelera de Drive. Si ya no está, pulsa **Sincronizar ahora**: la app la vuelve a armar completa. |
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
| `NEXT_PUBLIC_VAPID_PUBLIC_KEY` y `VAPID_PRIVATE_KEY` | App → Notificaciones → Generar claves (paso 4.5) | Solo Vercel |
| `VAPID_SUBJECT` | `mailto:` + Gmail del taller | Vercel |
| Dirección de la app | Vercel, después del primer despliegue | Supabase → URL Configuration |
| `GOOGLE_CLIENT_ID` y `GOOGLE_CLIENT_SECRET` | Google Cloud → Google Auth Platform → Clientes (paso 4.6) | Solo Vercel |
| `ANTHROPIC_API_KEY` | console.anthropic.com → API Keys (paso 4.7) | Solo Vercel |
