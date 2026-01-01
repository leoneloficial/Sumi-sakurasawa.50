import * as baileys from "@whiskeysockets/baileys"
import chalk from "chalk"
import readlineSync from "readline-sync"
import fs from "fs"
import pino from "pino"
import { start, handleMessage } from "./manager.js"
import groupWelcome from "./biblioteca/welcome.js"
import groupAvisos from "./biblioteca/avisos.js"
import { applyModeration } from "./biblioteca/moderation.js"
import { getCommandPrefix } from "./biblioteca/settings.js"
import { initSubbots } from "./subbotManager.js"
import config from "./config.js"
import { startWebPanel } from "./webpanel/app.js"

if (!global.WEBPANEL_STARTED) {
  global.WEBPANEL_STARTED = true
  try {
    startWebPanel()
  } catch (e) {
    console.error(chalk.red("「✦」Error iniciando panel web »"), e)
  }
}

const sessionFolder = "./session"
const credsPath = `${sessionFolder}/creds.json`

if (!fs.existsSync(sessionFolder)) fs.mkdirSync(sessionFolder, { recursive: true })

let usarCodigo = false
let numero = ""

// ✅ Por defecto: SOLO subbots (npm start normal)
// Para habilitar el principal: RUN_MAIN=1 npm start
let skipMain = process.env.RUN_MAIN !== "1"

let subbotsReady = false
let subbotsLock = null

async function ensureSubbots() {
  if (subbotsReady) return
  if (subbotsLock) return subbotsLock

  subbotsLock = (async () => {
    try {
      await initSubbots()
      subbotsReady = true
      console.log(chalk.green("「✿」Subbots reconectados"))
    } catch (err) {
      subbotsReady = false
      console.error(chalk.red("「✦」Error al reconectar subbots »"), err)
    } finally {
      subbotsLock = null
    }
  })()

  return subbotsLock
}

function keepAlive() {
  setInterval(() => {}, 1 << 30)
}

/**
 * “Principal virtual”: toma el primer subbot conectado y lo expone como MAIN_CONN/MAIN_JID
 * para que plugins/manager que esperan principal no se rompan.
 */
function setVirtualMainFromSubbots() {
  try {
    if (!(global.conns instanceof Array)) global.conns = []

    const first = global.conns.find((c) => {
      const jid = c?.user?.jid || c?.user?.id
      return Boolean(jid)
    })

    if (!first) {
      console.log(chalk.yellow("「✦」No hay subbots disponibles para asignar principal virtual"))
      return
    }

    const jid = first?.user?.jid || first?.user?.id || ""
    if (jid) {
      globalThis.MAIN_JID = jid
      globalThis.MAIN_CONN = first
      // opcional: “marcar” para lógica interna
      first.isSubBot = false
      first.isVirtualMain = true
      console.log(chalk.greenBright(`「✿」Principal virtual asignado » ${String(jid).split("@")[0]}`))
    }
  } catch (e) {
    console.error(chalk.red("「✦」Error asignando principal virtual »"), e)
  }
}

async function main() {
  console.clear()
  console.log(chalk.hex("#6A0DAD").bold("「✿」Meow WaBot"))
  console.log(chalk.gray("☆ Hecho por Ado :D"))

  // Mejora general de performance en Node (libuv threadpool)
  // Nota: no afecta si ya fue seteado antes del proceso.
  if (!process.env.UV_THREADPOOL_SIZE) process.env.UV_THREADPOOL_SIZE = "16"

  if (skipMain) {
    console.log(chalk.yellowBright("\n「✿」Modo subbots (default): principal omitido"))
    console.log(chalk.gray("☆ Para habilitar principal: RUN_MAIN=1 npm start"))

    await ensureSubbots().catch(() => {})

    // ✅ Simula principal “como si ya estuviera”
    setVirtualMainFromSubbots()

    console.log(chalk.gray("☆ Subbots activos. Panel web y manager iniciados."))
    keepAlive()
    return
  }

  // Si habilitas principal con RUN_MAIN=1, corre el flujo normal
  await iniciarBot()
}

async function iniciarBot() {
  const { state, saveCreds } = await baileys.useMultiFileAuthState("session")
  const { version } = await baileys.fetchLatestBaileysVersion()

  const sock = baileys.makeWASocket({
    version,
    printQRInTerminal: !usarCodigo && !fs.existsSync(credsPath),
    logger: pino({ level: "silent" }),
    auth: {
      creds: state.creds,
      keys: baileys.makeCacheableSignalKeyStore(state.keys, pino({ level: "silent" })),
    },
    browser: ["Ubuntu", "Chrome", "108.0.5359.125"],
    syncFullHistory: false,
    markOnlineOnConnect: false,

    // ⚡ Rendimiento en grupos grandes (BLY)
    enableParallelMessageProcessing: true,
    maxParallelMessageThreads: 8,
  })

  sock.ev.on("creds.update", saveCreds)
  sock.isSubBot = false

  sock.ev.on("connection.update", async ({ connection, lastDisconnect }) => {
    const code = lastDisconnect?.error?.output?.statusCode

    if (connection === "open") {
      try {
        const jid = sock?.user?.jid || sock?.user?.id || ""
        if (jid) globalThis.MAIN_JID = jid
        if (!(global.conns instanceof Array)) global.conns = []

        const meNum = String(jid).split("@")[0]
        global.conns = global.conns.filter((c) => {
          const cj = c?.user?.jid || c?.user?.id || ""
          const cn = String(cj).split("@")[0]
          return cn && cn !== meNum
        })
        global.conns.push(sock)
      } catch {}

      console.log(chalk.greenBright("\n「✿」¡Conectado correctamente!"))
      console.log(chalk.gray("☆ Esperando mensajes..."))
      ensureSubbots().catch(() => {})
    }

    if (connection === "close") {
      const reconectar = code !== baileys.DisconnectReason.loggedOut
      console.log(chalk.red("\n「✦」Conexión cerrada"))
      console.log(chalk.gray(`> Código » ${code}`))

      if (reconectar) {
        console.log(chalk.yellow("☆ Reconectando..."))
        try {
          sock.ev.removeAllListeners()
        } catch {}
        setTimeout(() => iniciarBot().catch(() => {}), 1500)
      } else {
        console.log(chalk.redBright("☆ Sesión cerrada. Borra la carpeta 'session' y vuelve a vincular."))
      }
    }
  })

  groupWelcome(sock)
  groupAvisos(sock)

  sock.ev.on("messages.upsert", async ({ messages, type }) => {
    if (type !== "notify") return

    const usedPrefix = getCommandPrefix("") || globalThis?.prefijo || config?.prefijo || config?.PREFIX || "."

    for (const msg of messages || []) {
      if (!msg?.message) continue

      const texto =
        msg.message?.conversation ||
        msg.message?.extendedTextMessage?.text ||
        msg.message?.imageMessage?.caption ||
        msg.message?.videoMessage?.caption ||
        msg.message?.documentMessage?.caption ||
        ""

      const isCommand = String(texto || "").trim().startsWith(String(usedPrefix || "."))

      // 🔥 No bloquees el listener: en grupos grandes esto evita colas de 10–15s.
      if (!isCommand) {
        void applyModeration(sock, msg, texto).catch(() => {})
        continue
      }

      void handleMessage(sock, msg).catch((e) => {
        console.error(chalk.red("「✦」Error handleMessage »"), e)
      })
    }
  })

  if (usarCodigo && !state.creds.registered && !fs.existsSync(credsPath)) {
    setTimeout(async () => {
      try {
        const code = await sock.requestPairingCode(String(numero || "").replace(/\D/g, ""))
        console.log(chalk.hex("#A020F0").bold("\n「✿」Código de emparejamiento"))
        console.log(chalk.white("> Código » ") + chalk.greenBright.bold(code))
        console.log(chalk.gray("☆ WhatsApp » Dispositivos vinculados » Vincular » Usar código"))
      } catch (e) {
        console.log(chalk.red("「✦」Error al generar código »"), e)
      }
    }, 2500)
  }
}

start()
main().catch((e) => console.error(e))
