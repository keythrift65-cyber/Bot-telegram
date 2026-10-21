# 🤖 Bot de Telegram · Oposición Auxiliar Administrativo del Estado

Bot de preguntas tipo test para preparar la oposición de Auxiliar Administrativo del Estado (España). Se monetiza con una suscripción mensual en **Telegram Stars**.

- 10 preguntas gratis al día (se reinician a medianoche, hora de Madrid)
- Opciones desordenadas en cada pregunta, sin repetir preguntas respondidas en los últimos 7 días
- Corrección con artículo de referencia y explicación
- Repaso de fallos (premium)
- Estadísticas globales y por tema
- Suscripción premium de 250 ⭐ cada 30 días, con renovación automática
- Comandos de administrador: `/stats` y `/refund`

Tecnología: Node.js 20+, TypeScript, [grammY](https://grammy.dev), SQLite (better-sqlite3), long polling.

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
│   ├── start.ts             /start y menú
│   ├── quiz.ts              Nueva pregunta, responder, repasar fallos
│   ├── stats.ts             Mis estadísticas
│   ├── payments.ts          Premium, pre_checkout_query, successful_payment
│   ├── info.ts              /paysupport y /terms
│   └── admin.ts             /stats y /refund
├── db/                      SQLite: conexión, tablas y consultas
├── services/                Lógica: fechas, test, suscripción
└── scripts/
    └── import-questions.ts  npm run import
questions.json               Preguntas de ejemplo
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

Necesitas **Node.js 20 o superior** (`node -v` para comprobarlo).

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

Para desarrollo, con recarga automática al guardar:

```bash
npm run dev
```

La base de datos se crea sola en `data/bot.sqlite` la primera vez.

---

## 3. Importar preguntas

Las preguntas se cargan desde un JSON con este formato:

```json
[
  {
    "tema": "Constitución Española",
    "enunciado": "¿Cuál es la forma política del Estado español?",
    "opciones": {
      "A": "La Monarquía parlamentaria",
      "B": "La Monarquía constitucional",
      "C": "La República parlamentaria",
      "D": "El Estado autonómico"
    },
    "correcta": "A",
    "articulo": "Art. 1.3 CE",
    "explicacion": "El art. 1.3 CE establece que la forma política del Estado español es la Monarquía parlamentaria."
  }
]
```

- `tema`, `enunciado`, `opciones` (A-D) y `correcta` son obligatorios. `articulo` y `explicacion` son opcionales pero muy recomendables.
- No importa el orden de las opciones: el bot las desordena cada vez que muestra la pregunta.

Para importar:

```bash
npm run import                         # lee ./questions.json
npm run import -- ruta/a/otro.json     # otro archivo
```

- Una pregunta con el **mismo tema y enunciado** que otra ya existente se ignora, así que puedes volver a importar el mismo archivo sin crear duplicados.
- Si alguna pregunta tiene un error de formato, no se importa ninguna y se indica cuál falla.
- Se puede importar con el bot en marcha; las preguntas nuevas aparecen al momento.

> ⚠️ El `questions.json` incluido tiene 5 preguntas marcadas como **"[EJEMPLO - REVISAR]"** solo para mostrar el formato. Revísalas y sustitúyelas por tu banco de preguntas real antes de lanzar el bot.

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
| `/stats` | Usuarios totales, premium activos, estrellas ganadas y nº de preguntas |
| `/refund <user_id> <charge_id>` | Devuelve el pago con `refundStarPayment`, cancela la renovación y retira el premium |

El `charge_id` aparece en la consola/logs cuando entra cada pago (`[PAGO] … charge_id …`) y en la tabla `payments`.

---

## 5. Dejarlo funcionando 24/7 en un servidor Linux con pm2

Ejemplo para Ubuntu/Debian (un VPS pequeño es suficiente).

**1) Instalar Node.js 20 y herramientas de compilación** (better-sqlite3 las necesita si no hay binario precompilado):

```bash
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt-get install -y nodejs build-essential python3 git
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

## 6. Dejarlo funcionando 24/7 en un portátil

Con long polling no hay que abrir puertos en el router ni tener IP fija: basta con que el portátil tenga internet. El bot espera solo a que haya conexión al arrancar y pm2 lo reinicia si se cae.

**1) Instala Node.js 20+** desde [nodejs.org](https://nodejs.org) (versión LTS) y [Git](https://git-scm.com).
En Windows, si `npm install` falla al compilar better-sqlite3, instala las "Herramientas de compilación de C++" que ofrece el instalador de Node (casilla *Tools for Native Modules*).

**2) Descarga, configura y arranca** (en la terminal, o en PowerShell en Windows):

```bash
git clone <url-de-tu-repositorio> bot-telegram
cd bot-telegram
npm install
cp .env.example .env      # en Windows: copy .env.example .env
# edita .env y pon BOT_TOKEN y ADMIN_ID
npm run import            # compila y carga las preguntas
npm install -g pm2
pm2 start ecosystem.config.js
pm2 save
```

**3) Que arranque solo al encender el portátil:**

- **Linux / macOS:** `pm2 startup` y ejecuta el comando que te muestre. Luego `pm2 save`.
- **Windows:** `pm2 startup` no funciona. Usa:
  ```powershell
  npm install -g pm2-windows-startup
  pm2-startup install
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
- Comprueba el estado cuando quieras con `pm2 status` y `pm2 logs bot-oposiciones`.

---

## ⚙️ Ajustes

Precio, límite diario, días sin repetir y zona horaria están en `src/config.ts`. Tras cambiarlos: `npm run build` y `pm2 restart bot-oposiciones`.

> Si cambias el precio, reinicia el bot: el enlace de pago se genera una vez y se guarda en memoria.
