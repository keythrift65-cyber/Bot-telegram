# 🤖 Bot de Telegram · Oposición Auxiliar Administrativo del Estado

Bot de preguntas tipo test para preparar la oposición de Auxiliar Administrativo del Estado (España). Se monetiza con una suscripción mensual en **Telegram Stars**.

**Para el opositor**

- 📝 **596 preguntas tipo test** de la Constitución (289), la Ley 39/2015 (152) y la Ley 40/2015 (155), con las opciones desordenadas cada vez y sin repetir las respondidas en los últimos 7 días. 10 gratis al día (se reinician a medianoche, hora de Madrid).
- 📚 **De dónde sale cada pregunta**: ley, Título, Capítulo, Sección y artículo, con botón para leer el artículo en el BOE. También el examen oficial en el que apareció, si se indica.
- 💡 Corrección con la explicación y el porcentaje de usuarios que acierta cada pregunta.
- 📚 **Practicar por temas**: primero se elige la norma y después el tema (Títulos, y los Títulos más largos divididos en partes), viendo el porcentaje de acierto de cada tema.
- 🎓 **Simulacros de examen** de 10, 25 o 50 preguntas (premium): sin corrección hasta el final, con preguntas en blanco, penalización por fallo, nota, tiempo, temas a reforzar y corrección.
- 🔁 **Repaso de fallos** (premium): las preguntas falladas que aún no se han acertado.
- 📊 **Estadísticas**: racha de días seguidos 🔥, acierto global y por tema (del más flojo al más fuerte), parte del temario vista, últimos simulacros.
- ⏰ **Recordatorio diario** opcional a la hora que elija, solo si ese día aún no ha practicado.
- 🎁 **Invitar amigos**: enlace personal; el amigo empieza con 5 preguntas extra y quien invita gana 10 cuando el amigo responde sus 5 primeras.
- ⚠️ **Reportar errores** en cualquier pregunta; te llegan por privado.

**Para ti (administrador)**

- ⭐ Suscripción premium de 250 ⭐ cada 30 días en Telegram Stars, con renovación automática y reembolsos.
- 📢 Pregunta del día publicada automáticamente a las 9:00 en un canal público, con enlace al bot.
- 🛠 Comandos: `/stats`, `/origenes`, `/anuncio`, `/reportes`, `/resuelto`, `/ver`, `/refund`, `/canal_ahora` y `/canal_stats`.

Tecnología: Node.js 22.13+, TypeScript, [grammY](https://grammy.dev), SQLite (el incluido en Node, `node:sqlite`: no hay que compilar nada), long polling.

---

## 📁 Estructura

```
src/
├── index.ts                 Punto de entrada (long polling)
├── config.ts                Variables de entorno y ajustes (precio, límite…)
├── bot/
│   ├── bot.ts               Crea el bot, middlewares, handlers y bot.catch
│   └── keyboards.ts         Botones inline
├── handlers/
│   ├── start.ts             /start, menú, enlaces de origen e invitaciones
│   ├── quiz.ts              Nueva pregunta, responder, repasar fallos, pregunta de un tema
│   ├── topics.ts            Menú "Por temas"
│   ├── exam.ts              Simulacros de examen
│   ├── stats.ts             Mis estadísticas
│   ├── reminder.ts          Recordatorio diario
│   ├── invite.ts            Invitar amigos
│   ├── reports.ts           Reportar errores, /reportes y /resuelto
│   ├── payments.ts          Premium, pre_checkout_query, successful_payment
│   ├── info.ts              /paysupport y /terms
│   ├── admin.ts             /stats, /refund, /origenes, /ver y /anuncio
│   └── channel.ts           /canal_ahora y /canal_stats
├── db/                      SQLite: conexión, tablas, migraciones y consultas
├── services/
│   ├── sources.ts           De dónde sale cada pregunta: estructura de la CE, la Ley 39 y la Ley 40, y enlaces al BOE
│   ├── quiz.ts              Formato de preguntas y cupo diario
│   ├── exam.ts              Simulacros: nota, resumen y corrección
│   ├── progress.ts          Racha de días seguidos
│   ├── referrals.ts         Invitaciones y preguntas extra
│   ├── reminders.ts         Recordatorios (cada hora en punto)
│   ├── channel.ts           Pregunta del día en el canal
│   ├── messaging.ts         Envíos seguros (detecta quien ha bloqueado el bot)
│   └── time.ts, subscription.ts
└── scripts/
    ├── import-questions.ts  npm run import
    └── delete-examples.ts   npm run borrar-ejemplos
preguntas/                   Archivos .json con las preguntas
ecosystem.config.js          Configuración de pm2
```

---

## 1. Crear el bot en @BotFather

1. En Telegram, abre [@BotFather](https://t.me/BotFather) y envía `/newbot`.
2. Elige un nombre (ej: *Test Auxiliar Administrativo*) y un usuario que acabe en `bot` (ej: `TestAuxiliarBot`).
3. BotFather te dará un **token** como `123456789:AAH...`. Guárdalo: es tu `BOT_TOKEN`. No lo compartas.
4. (Opcional) Con `/setdescription`, `/setabouttext` y `/setuserpic` personaliza la ficha del bot.
5. Para cobrar en Stars no hace falta configurar ningún proveedor de pagos: los pagos con moneda `XTR` funcionan directamente.
6. Consigue tu id de usuario numérico (será el `ADMIN_ID`) escribiendo a [@userinfobot](https://t.me/userinfobot).

> Los comandos del menú (`/start`, `/pregunta`, `/premium`, `/paysupport`, `/terms`…) los registra el propio bot al arrancar.

---

## 2. Instalación

Necesitas **Node.js 22.13 o superior** (`node -v` para comprobarlo).

```bash
git clone <url-de-tu-repositorio> bot-telegram
cd bot-telegram
npm install
cp .env.example .env
```

Edita `.env`:

```env
BOT_TOKEN=123456789:AAH-tu-token
ADMIN_ID=123456789
# DB_PATH=./data/bot.sqlite   (opcional)
```

Compila y arranca:

```bash
npm run build
npm start
```

Para probarlo rápido en tu ordenador (compila y arranca en primer plano; Ctrl+C para pararlo):

```bash
npm run dev
```

La base de datos se crea sola en `data/bot.sqlite` la primera vez.

---

## 3. Importar preguntas

Las preguntas están en la carpeta **`preguntas/`**, en uno o varios archivos `.json` (por ejemplo, uno por bloque del temario). Ahora mismo hay **596 preguntas**:

| Archivo | Norma | Preguntas | Ids |
|---|---|---|---|
| `constitucion_bloque1.json` … `constitucion_bloque5.json` | Constitución Española | 289 | `CE-001` … `CE-289` |
| `ley39_2015.json` | Ley 39/2015, del Procedimiento Administrativo Común | 152 | `L39-001` … `L39-152` |
| `ley40_2015.json` | Ley 40/2015, de Régimen Jurídico del Sector Público | 155 | `L40-001` … `L40-155` |

Cada archivo es una lista de preguntas con este formato:

```json
[
  {
    "id": "CE-004",
    "ley": "Constitución Española",
    "tema": "Título Preliminar",
    "enunciado": "¿Cuál es la forma política del Estado español según el artículo 1.3?",
    "opcion_a": "Monarquía constitucional",
    "opcion_b": "Estado social y democrático de Derecho",
    "opcion_c": "Monarquía democrática",
    "opcion_d": "Monarquía parlamentaria",
    "correcta": "D",
    "articulo": "Art. 1.3 CE",
    "explicacion": "La forma política es la Monarquía parlamentaria."
  }
]
```

| Campo | ¿Obligatorio? | Para qué sirve |
|---|---|---|
| `id` | Muy recomendable | Identificador único y estable (ej: `CE-004`). Con él, si corriges una pregunta y vuelves a importar, **se actualiza** en vez de duplicarse y se conservan las estadísticas. No lo cambies una vez importada. |
| `enunciado`, `opcion_a`…`opcion_d`, `correcta` | Sí | La pregunta, sus 4 opciones y la letra correcta (A-D). También vale `"opciones": { "A": "…", … }`. El orden da igual: el bot las desordena. |
| `ley` | Recomendable | Norma de la que sale. Si falta, se deduce del artículo (`… CE`, `… Ley 39/2015`…). |
| `tema` | Opcional | Agrupa las preguntas en "Por temas" y en las estadísticas. **En la Constitución, la Ley 39/2015 y la Ley 40/2015 se calcula solo** según el Título (o la parte del Título) del artículo, si falta o si solo pone el nombre de la ley. |
| `articulo` | Recomendable | Artículo de referencia con la ley (ej: `Art. 17.2 CE`, `Art. 21.3 Ley 39/2015`). Con él se calcula **de dónde sale** (Título, Capítulo, Sección) y el **enlace al BOE**. |
| `explicacion` | Recomendable | Por qué es la correcta. |
| `ubicacion` | Opcional | Para otras leyes: lista con la ubicación, ej: `["Título II", "Capítulo I"]`. |
| `enlace` | Opcional | Enlace al texto oficial, si quieres uno concreto (debe empezar por `https://`). |
| `examen` | Opcional | Examen oficial en el que apareció la pregunta (ej: `"Auxiliar AGE 2023"`). Se muestra al corregir. |
| `enunciado_anterior` | Opcional | Si reescribes el enunciado de una pregunta importada **sin `id`**, pon aquí el antiguo para que se reconozca y no se duplique. |

La ubicación (Título, Capítulo y Sección) se calcula para la Constitución, la Ley 39/2015 y la Ley 40/2015; los enlaces al BOE, también para el TREBEP. Para añadir otra ley, ver `src/services/sources.ts`.

En las encuestas del canal, el enunciado lleva delante la norma (ej: `Ley 39/2015 · Según el artículo 21.3…`) para que se sepa de qué ley es cada pregunta.

Para importar:

```bash
npm run import                               # sincroniza todos los .json de la carpeta preguntas/
npm run import -- ruta/a/archivo.json        # solo los archivos que indiques
npm run import -- --limpiar                  # además retira las preguntas antiguas sin "id" que ya no están en ningún archivo
```

- **No crea duplicados**: las preguntas se reconocen por su `id` (o, si no lo tienen, por su enunciado). Volver a importar actualiza las que hayas corregido y deja igual el resto.
- Si en la carpeta quedan **archivos antiguos sin `id`** con preguntas que ya están en otro archivo con `id` (aunque se haya cambiado el enunciado), se ignoran y salen como "Duplicadas".
- **Retira, no borra**: al importar la carpeta entera, las preguntas con `id` que ya no estén en ningún archivo dejan de preguntarse, pero sus estadísticas se conservan. Si vuelves a ponerlas, se reactivan.
- Si alguna pregunta tiene un error de formato o un `id` repetido, no se importa nada y se indica en qué archivo y pregunta está.
- Avisa de las preguntas que no caben en las encuestas del canal (enunciado de más de 300 caracteres u opciones de más de 100).
- Se puede importar con el bot en marcha; los cambios se ven al momento.

Si importaste las 5 preguntas de ejemplo de versiones anteriores (las que empiezan por "[EJEMPLO - REVISAR]"), bórralas con:

```bash
npm run borrar-ejemplos
```

---

## 4. Pagos con Telegram Stars

- **Hazte premium** genera un enlace de suscripción con `createInvoiceLink` (moneda `XTR`, 250 ⭐, `subscription_period` = 2592000 s = 30 días).
- El bot responde siempre `true` al `pre_checkout_query`.
- En cada `successful_payment` (primer pago **y** cada renovación automática) se guarda el pago y se actualiza la fecha de fin de premium con `subscription_expiration_date`. Los pagos repetidos (mismo `charge_id`) se ignoran.
- Todos los pagos y errores se registran en la consola (y en los logs de pm2).
- El usuario puede cancelar la renovación desde *Ajustes de Telegram → Mis estrellas*; sigue siendo premium hasta el final del periodo pagado.

### Comandos de administrador (solo `ADMIN_ID`)

| Comando | Qué hace |
|---|---|
| `/stats` | Usuarios (totales, activos hoy y en 7 días, bloqueados), premium, estrellas, respuestas, simulacros, reportes y preguntas por ley |
| `/anuncio <texto>` | Envía un mensaje a todos los usuarios (enseña una vista previa y pide confirmación). Se envía poco a poco, sin bloquear el bot, y al terminar te dice cuántos lo recibieron |
| `/reportes` | Errores que han reportado los usuarios y están pendientes |
| `/resuelto <número>` | Marca un reporte como revisado y da las gracias a quien lo envió |
| `/ver <id>` | Ficha completa de una pregunta (ej: `/ver CE-017`): opciones, explicación, de dónde sale, % de acierto y reportes |
| `/refund <user_id> <charge_id>` | Devuelve el pago con `refundStarPayment`, cancela la renovación y retira el premium |
| `/canal_ahora` | Publica una pregunta en el canal al momento (para probar) |
| `/canal_stats` | Preguntas publicadas en el canal y usuarios que han llegado desde él |
| `/origenes` | Usuarios, premium activos y estrellas pagadas según el enlace por el que llegaron (`?start=reddit`, `?start=tiktok`…) |

El `charge_id` aparece en la consola/logs cuando entra cada pago (`[PAGO] … charge_id …`) y en la tabla `payments`.

---

## 5. Pregunta del día en un canal

Todos los días a las **9:00 (hora de Madrid)** el bot publica en tu canal una encuesta tipo *quiz* con una pregunta al azar, y justo debajo un mensaje con un botón para abrir el bot:

> ¿Quieres seguir practicando? Tienes 10 preguntas gratis al día en el bot 👇  **[📝 Practicar en el bot]**

### Configuración

1. **Crea el canal** en Telegram (público, con un @usuario) si aún no lo tienes.
2. **Añade el bot como administrador:** en el canal → *Administradores* → *Añadir administrador* → busca tu bot → deja activado **Publicar mensajes**.
3. **Añade al `.env`:**
   ```env
   CHANNEL_ID=@tu_canal
   BOT_USERNAME=tu_bot
   ```
   - `CHANNEL_ID`: el @usuario del canal (ej: `@test_auxiliar`). Si el canal es privado, usa su id numérico, que empieza por `-100` (puedes verlo reenviando un mensaje del canal a [@userinfobot](https://t.me/userinfobot)).
   - `BOT_USERNAME`: el usuario de tu bot **sin @** (ej: `Dev_gfv_bot`). Se usa para el botón `https://t.me/tu_bot?start=canal`. Si lo dejas vacío, se usa el que devuelve Telegram.
   - Si `CHANNEL_ID` está vacío, la publicación en el canal queda desactivada y el bot funciona igual.
4. **Reinicia el bot** (en Windows: `detener-bot.ps1` y `Start-ScheduledTask -TaskName BotOposiciones`; con pm2: `pm2 restart bot-oposiciones`). En el log debe aparecer `📢 Pregunta del día programada a las 9:00 (Madrid) en @tu_canal`.
5. **Pruébalo:** escribe `/canal_ahora` al bot desde tu cuenta de administrador.

### Cómo funciona

- **Encuesta tipo quiz anónima** con las 4 opciones desordenadas. Tras responder, el usuario ve el artículo de referencia y la explicación.
- **Límites de Telegram:** enunciado de hasta 300 caracteres, opciones de hasta 100 y explicación de hasta 200. Las preguntas que no caben no se publican en el canal (en el bot sí se usan). Si la explicación es larga, se recorta por frases completas; si ni la primera frase cabe, se muestra solo el artículo.
- **Sin repeticiones:** se guarda cada publicación en la tabla `channel_posts` y no se repite ninguna pregunta hasta haber publicado todas las que caben. Después empieza una vuelta nueva.
- **Si el bot estaba apagado a las 9:00** (por ejemplo, el portátil), publica la pregunta del día en cuanto arranca, siempre que hoy no se haya publicado ya.
- **Si falla la publicación** (el bot no es administrador, `CHANNEL_ID` incorrecto, sin internet…), se registra en el log como `[CANAL]` y te llega un aviso por privado con el motivo. El bot sigue funcionando.
- **Usuarios que llegan desde el canal:** quien entra con el botón (`/start canal`) y es nuevo en el bot queda marcado con origen `canal`. Lo ves con `/canal_stats`, junto con cuántos de ellos se han hecho premium.

> Puedes usar el mismo sistema para medir otros enlaces: `https://t.me/tu_bot?start=instagram` guarda el origen `instagram`. Con `/origenes` ves cuántos usuarios, premium y estrellas trae cada enlace. El origen solo puede tener letras, números, `_` y `-` (máx. 32).

---

## 6. Dejarlo funcionando 24/7 en un servidor Linux con pm2

Ejemplo para Ubuntu/Debian (un VPS pequeño es suficiente).

**1) Instalar Node.js 22 o superior y git:**

```bash
curl -fsSL https://deb.nodesource.com/setup_22.x | sudo -E bash -
sudo apt-get install -y nodejs git
```

**2) Descargar el proyecto, configurarlo y compilarlo:**

```bash
git clone <url-de-tu-repositorio> bot-telegram
cd bot-telegram
npm install
cp .env.example .env
nano .env                # pon BOT_TOKEN y ADMIN_ID
npm run build
npm run import           # carga las preguntas
```

**3) Instalar pm2 y arrancar el bot:**

```bash
sudo npm install -g pm2
pm2 start ecosystem.config.js
pm2 save                 # guarda la lista de procesos
pm2 startup              # muestra un comando: cópialo y ejecútalo para arrancar al reiniciar el servidor
```

**Comandos útiles:**

```bash
pm2 status                      # estado
pm2 logs bot-oposiciones        # ver logs en directo (pagos, errores…)
pm2 restart bot-oposiciones     # reiniciar
pm2 stop bot-oposiciones        # parar
```

Los logs también se guardan en `logs/out.log` y `logs/error.log`.

**Actualizar el bot:**

```bash
git pull
npm install
npm run build
pm2 restart bot-oposiciones
```

> ⚠️ Con long polling solo puede haber **una** instancia del bot funcionando con el mismo token. No lo arranques a la vez en tu ordenador y en el servidor.

**Copia de seguridad:** toda la información está en `data/bot.sqlite`. Para copiarla en caliente:

```bash
sqlite3 data/bot.sqlite ".backup 'backup-$(date +%F).sqlite'"
```

---

## 7. Dejarlo funcionando 24/7 en un portátil

Con long polling no hay que abrir puertos en el router ni tener IP fija: basta con que el portátil tenga internet. El bot espera solo a que haya conexión al arrancar y se reinicia solo si se cae.

**1) Instala Node.js 22 o superior** desde [nodejs.org](https://nodejs.org) (versión LTS) y [Git](https://git-scm.com).
En Windows también puedes instalarlos con `winget install --id OpenJS.NodeJS.LTS -e` y `winget install --id Git.Git -e`.

**2) Descarga y configura** (en la terminal, o en PowerShell en Windows):

```bash
git clone <url-de-tu-repositorio> bot-telegram
cd bot-telegram
npm install
cp .env.example .env      # en Windows: copy .env.example .env
# edita .env y pon BOT_TOKEN y ADMIN_ID   (en Windows: notepad .env)
npm run import            # compila y carga las preguntas
```

**3) Arráncalo y haz que arranque solo al encender el portátil:**

- **Windows** (sin pm2: usa el Programador de tareas de Windows, que es más fiable).
  Abre PowerShell **como administrador** (clic derecho → *Ejecutar como administrador*), entra en la carpeta del bot y ejecuta:
  ```powershell
  cd C:\Users\TuUsuario\bot-telegram
utaot-telegram
  powershell -ExecutionPolicy Bypass -File scripts\windows\instalar-inicio.ps1
  ```
  El bot queda en marcha y arrancará solo cada vez que se encienda el portátil, aunque nadie inicie sesión. Si se cierra, se reinicia a los 10 segundos.

  | Para… | Comando (PowerShell como administrador, en la carpeta del bot) |
  |---|---|
  | Ver los logs en directo | `Get-Content logs\bot.log -Wait -Tail 30` |
  | Parar el bot | `powershell -ExecutionPolicy Bypass -File scripts\windows\detener-bot.ps1` |
  | Volver a arrancarlo | `Start-ScheduledTask -TaskName BotOposiciones` |
  | Quitar el arranque automático | `powershell -ExecutionPolicy Bypass -File scripts\windows\desinstalar-inicio.ps1` |

  Para actualizar el bot: páralo, haz `git pull` y `npm install`, y vuelve a ejecutar `instalar-inicio.ps1`.

- **Linux / macOS** (con pm2):
  ```bash
  npm install -g pm2
  pm2 start ecosystem.config.js
  pm2 startup              # ejecuta el comando que te muestre
  pm2 save
  ```

**4) Que el portátil no se duerma nunca:**

- **Windows:** Configuración → Sistema → Inicio/apagado y suspensión → *Nunca* (enchufado). Panel de control → Opciones de energía → *Al cerrar la tapa: No hacer nada*. En Windows Update, configura las *horas activas* para que no reinicie cuando quiera (si reinicia, el bot vuelve solo).
- **macOS:** Ajustes → Batería → Opciones → *Evitar la suspensión automática cuando la pantalla esté apagada*. Con la tapa cerrada el Mac se duerme salvo que tenga una pantalla externa conectada.
- **Linux:** en `/etc/systemd/logind.conf` pon `HandleLidSwitch=ignore` y `HandleLidSwitchExternalPower=ignore`, y reinicia con `sudo systemctl restart systemd-logind`. Desactiva la suspensión automática en los ajustes de energía.

**5) Consejos:**

- Déjalo enchufado y, si tu portátil lo permite, limita la carga al 80 % para cuidar la batería.
- Haz copias de `data/bot.sqlite` (usuarios y pagos) en la nube o en un USB con regularidad.
- Si se va la luz o internet, el bot deja de responder mientras tanto, pero no se pierde nada: Telegram guarda los mensajes hasta 24 horas y el bot los procesa al volver.
- Comprueba el estado cuando quieras: en Windows mirando `logs\bot.log`; en Linux/macOS con `pm2 status` y `pm2 logs bot-oposiciones`.

---

## ⚙️ Ajustes

En `src/config.ts` están el precio, el límite diario, los días sin repetir, la zona horaria, los tamaños de simulacro y la penalización por fallo (1/3), las horas posibles del recordatorio y las preguntas extra por invitar amigos. Tras cambiarlos, reinicia el bot (en Windows vuelve a ejecutar `scripts\windows\instalar-inicio.ps1`, que compila y reinicia; con pm2: `npm run build` y `pm2 restart bot-oposiciones`).

> Si cambias el precio, reinicia el bot: el enlace de pago se genera una vez y se guarda en memoria.
