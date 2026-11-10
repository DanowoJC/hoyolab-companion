<h1 align="center">HoYoLAB Daily Auto Check-in</h1>

<p align="center">
  Userscripts que reclaman automáticamente la recompensa diaria de HoYoLAB<br>
  para <b>Genshin Impact</b> y <b>Honkai: Star Rail</b>, mientras navegas con normalidad.
</p>

<p align="center">
  <img alt="Violentmonkey" src="https://img.shields.io/badge/Violentmonkey-compatible-8a2be2">
  <img alt="Tampermonkey" src="https://img.shields.io/badge/Tampermonkey-compatible-00485b">
  <img alt="Licencia MIT" src="https://img.shields.io/badge/licencia-MIT-green">
</p>

---

## Índice

- [Qué hace](#qué-hace)
- [Requisitos](#requisitos)
- [Instalación](#instalación)
- [Cómo funciona](#cómo-funciona)
- [Menú y opciones](#menú-y-opciones)
- [Solución de problemas](#solución-de-problemas)
- [Privacidad y seguridad](#privacidad-y-seguridad)
- [Aviso](#aviso)
- [Licencia](#licencia)

---

## Qué hace

| Script | Juego | Instalar |
|---|---|---|
| `genshin-checkin.user.js` | Genshin Impact | [**Instalar**](https://raw.githubusercontent.com/JasdanJC/hoyolab-daily-auto-checkin/main/genshin-checkin.user.js) |
| `starrail-checkin.user.js` | Honkai: Star Rail | [**Instalar**](https://raw.githubusercontent.com/JasdanJC/hoyolab-daily-auto-checkin/main/starrail-checkin.user.js) |

- Hace el **registro diario** de HoYoLAB por ti, una vez al día, en segundo plano.
- Funciona en **cualquier web** que abras: no hace falta visitar HoYoLAB.
- Te avisa con una **notificación** cuando completa el registro o si algo falla.
- Usa **tu propia sesión** de HoYoLAB del navegador: no pide ni guarda contraseñas.
- Cada script es independiente: instala solo el del juego al que juegues, o los dos.

> Solo para cuentas de **HoYoLAB global** (servidores América, Europa, Asia y TW/HK/MO). No funciona con el servidor chino (miHoYo / 米游社).

---

## Requisitos

### 1. Navegador
Cualquier navegador de escritorio compatible con extensiones de userscripts:

- **Chromium**: Google Chrome, Brave, Microsoft Edge, Opera, Vivaldi…
- **Firefox**

### 2. Extensión de userscripts
Una de estas (recomendada: **Violentmonkey**, gratuita y de código abierto):

| Extensión | Chrome / Brave / Edge | Firefox |
|---|---|---|
| **Violentmonkey** (recomendada) | [Chrome Web Store](https://chromewebstore.google.com/detail/violentmonkey/jinjaccalgkegednnccohejagnlnfdag) | [Firefox Add-ons](https://addons.mozilla.org/firefox/addon/violentmonkey/) |
| Tampermonkey | [Chrome Web Store](https://chromewebstore.google.com/detail/tampermonkey/dhdgffkkebhmkfjojejmpbldmpobfkfo) | [Firefox Add-ons](https://addons.mozilla.org/firefox/addon/tampermonkey/) |

### 3. Permiso de scripts de usuario (solo navegadores Chromium)
Desde Manifest V3, Chrome, Brave y Edge exigen activar un permiso para que la extensión pueda ejecutar userscripts:

1. Abre `chrome://extensions` (o `brave://extensions`, `edge://extensions`).
2. Entra en **Detalles** de Violentmonkey / Tampermonkey.
3. Activa **"Permitir scripts de usuario"** (*Allow User Scripts*).
   En versiones antiguas del navegador, este interruptor no existe: activa en su lugar el **Modo de desarrollador** (arriba a la derecha).

En Firefox no hace falta este paso.

### 4. Sesión de HoYoLAB
Inicia sesión en [hoyolab.com](https://www.hoyolab.com) en **el mismo navegador** y con la cuenta vinculada a tu personaje de Genshin / Star Rail.

---

## Instalación

### Opción A: un clic (recomendada)
1. Haz clic en **Instalar** en la tabla de [Qué hace](#qué-hace).
2. La extensión abrirá su página de instalación. Pulsa **Instalar** / **Confirmar**.
3. Repite con el otro script si juegas a ambos.

Con esta opción la extensión **comprobará actualizaciones** automáticamente desde este repositorio.

### Opción B: manual
1. Abre el archivo `.user.js` en este repositorio y pulsa **Raw** (o copia su contenido).
2. En Violentmonkey: icono de la extensión → **+** (Nuevo script).
3. Pulsa `Ctrl+A` y borra **toda** la plantilla que trae el editor.
4. Pega el contenido del script y guarda (`Ctrl+S`).

> **Importante:** si no borras la plantilla, el editor mezcla su cabecera (`@grant none`) con la del script y aparecerá el error *"`@grant none` desactiva todas las demás claves `@grant`"*. El script no funcionará.

### Comprobar que funciona
1. Abre cualquier web (por ejemplo, google.com).
2. Pulsa el icono de Violentmonkey → nombre del script → **"Hacer registro ahora"**.
3. Deberías ver una notificación de éxito o de *"Ya habías hecho el registro hoy"*.

---

## Cómo funciona

```
Cargas cualquier web
        │
        ▼
¿Registro de hoy ya hecho? ──sí──► no hace nada
        │ no
        ▼
Consulta el estado en HoYoLAB (info)
        │
        ├─ ya registrado ───────► lo apunta y termina
        ├─ sin sesión ──────────► aviso: "inicia sesión en HoYoLAB"
        │
        ▼
Envía el registro (sign)
        │
        ├─ correcto ────────────► notificación "¡Registro completado!"
        ├─ pide captcha ────────► aviso para hacerlo a mano
        └─ error ───────────────► aviso + reintento en 30 min
```

### Detalles

- **Una vez al día.** Tras un registro correcto, el script no vuelve a hacer peticiones hasta el día siguiente.
- **Hora del servidor (UTC+8).** El día de HoYoLAB empieza a las 00:00 UTC+8, es decir, a las **17:00 en invierno** y las **18:00 en verano** en España peninsular. El script calcula el día con esa hora, no con la de tu PC.
- **Varias pestañas.** Un bloqueo de 5 minutos evita que varias pestañas abiertas a la vez hagan el registro en paralelo.
- **Reintentos.** Si falla (red, sesión caducada, error del servidor), espera **30 minutos** antes de volver a intentarlo.
- **Captcha.** A veces HoYoLAB pide una verificación. El script **no la resuelve**: te avisa y, al hacer clic en la notificación, abre la página oficial para que la completes tú.
- **Peticiones.** Solo se comunica con la API oficial de HoYoLAB, con las mismas peticiones que hace el botón de la web:

| Juego | API | `act_id` |
|---|---|---|
| Genshin Impact | `sg-hk4e-api.hoyolab.com/event/sol` | `e202102251931481` |
| Honkai: Star Rail | `sg-public-api.hoyolab.com/event/luna/os` | `e202303301540311` |

- **Sin navegador no hay registro.** Un userscript solo se ejecuta mientras navegas. Si un día no abres el navegador, ese día no se hace el registro.
- **No funciona en páginas internas** del navegador (nueva pestaña, `chrome://`, tienda de extensiones…). Basta con abrir cualquier web normal.

---

## Menú y opciones

### Menú de la extensión
Desde el icono de Violentmonkey → nombre del script:

| Comando | Qué hace |
|---|---|
| **Hacer registro ahora** | Fuerza el registro en el momento, aunque ya se haya hecho hoy (te dirá si ya estaba hecho). |
| **Abrir página de registro** | Abre la página oficial del evento de registro diario. |

### Opciones dentro del script
Al principio de cada script, en la sección `Configuración`:

| Constante | Por defecto | Significado |
|---|---|---|
| `NOTIFY_ON_SUCCESS` | `true` | `false` para no recibir notificación cuando el registro automático sale bien. Los errores se avisan siempre. |
| `LANG` | `'es-es'` | Idioma de los mensajes que devuelve HoYoLAB (`en-us`, `ja-jp`…). |
| `RETRY_MS` | 30 min | Espera tras un error antes de reintentar. |
| `LOCK_MS` | 5 min | Bloqueo entre pestañas. |

> Si editas el script y luego llega una actualización desde el repositorio, tus cambios se sobrescribirán.

---

## Solución de problemas

| Problema | Solución |
|---|---|
| El script aparece **tachado** con una **"i" roja** en el menú de Violentmonkey | Falta el permiso de [scripts de usuario](#3-permiso-de-scripts-de-usuario-solo-navegadores-chromium). Actívalo, recarga la pestaña y, si sigue igual, reinicia el navegador. |
| *"`@grant none` desactiva todas las demás claves `@grant`"* | Instalaste encima de la plantilla. Repite la [instalación manual](#opción-b-manual) borrando todo antes de pegar. |
| *"No has iniciado sesión en HoYoLAB"* pero sí la tienes | El navegador está bloqueando las cookies de terceros de HoYoLAB. Añade `[*.]hoyolab.com` como sitio permitido en los ajustes de cookies (en Brave, también revisa los **Escudos**). |
| *"HoYoLAB pide una verificación (captcha)"* | Haz clic en la notificación y completa el registro a mano ese día. Es normal que ocurra de vez en cuando. |
| No salen notificaciones | Permite las notificaciones del navegador en la configuración de Windows / macOS. |
| Error con `retcode` en Star Rail | Comprueba que tu cuenta de HoYoLAB tiene un personaje de Star Rail vinculado. |
| Al instalar desde GitHub sale un error 404 | El repositorio es privado: usa la [instalación manual](#opción-b-manual). |

---

## Privacidad y seguridad

- El script **no lee, guarda ni envía** tus cookies, contraseñas o datos personales. Las peticiones usan la sesión del navegador como lo haría la propia web de HoYoLAB.
- Solo puede conectarse a los dominios de HoYoLAB declarados en `@connect`. La extensión bloquea cualquier otra conexión.
- Lo único que guarda (en el almacenamiento de la extensión) es la fecha del último registro y la hora del último intento.
- El código es corto y legible: revísalo antes de instalarlo.

---

## Aviso

Este proyecto **no está afiliado** a HoYoverse, COGNOSPHERE ni miHoYo. Genshin Impact, Honkai: Star Rail y HoYoLAB son marcas de sus respectivos propietarios.

Las condiciones de uso de HoYoverse prohíben, en términos generales, el uso de herramientas de automatización no autorizadas. Este script no toca el cliente del juego y se limita a hacer, una vez al día, la misma petición que el botón oficial de registro, pero **lo usas bajo tu propia responsabilidad**.

---

## Licencia

[MIT](LICENSE) © 2026 JasdanJC
