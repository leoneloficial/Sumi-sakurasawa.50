import {
  setWelcomeEnabled,
  setAvisosEnabled,
  isWelcomeEnabled,
  isAvisosEnabled,
  setAntilinkEnabled,
  isAntilinkEnabled
} from '../biblioteca/settings.js'

const FEATURE_MAP = {
  welcome: 'welcome',
  bienvenida: 'welcome',
  avisos: 'avisos',
  aviso: 'avisos',
  antilink: 'antilink',
  anti: 'antilink',
  enlaces: 'antilink',
  links: 'antilink'
}

function cleanArg(input = '') {
  return String(input || '')
    .normalize('NFKC')
    .replace(/[\u200B-\u200D\uFEFF]/g, '')
    .trim()
    .replace(/^[^\p{L}\p{N}_-]+|[^\p{L}\p{N}_-]+$/gu, '')
    .toLowerCase()
}

function parseTokens(text = '') {
  return String(text || '')
    .normalize('NFKC')
    .replace(/[\u200B-\u200D\uFEFF]/g, '')
    .trim()
    .split(/\s+/)
    .filter(Boolean)
}

const buildStatusText = (feature, enabled) => {
  const label = feature === 'welcome' ? 'bienvenida' : feature === 'avisos' ? 'avisos' : 'antilink'
  const state = enabled ? 'activados' : 'desactivados'
  return `「✦」El *${label}* fue ${state}.`
}

async function callMaybeAsync(fn, ...args) {
  if (typeof fn !== 'function') throw new Error('Función no disponible')
  return await Promise.resolve(fn(...args))
}

let handler = async (m, { conn, text, command, isGroup }) => {
  const chat = m?.chat || m?.key?.remoteJid || m?.from
  const subbotId = conn?.isSubBot ? String(conn?.subbotId || '').trim() : ''

  const reply = async (t) => {
    try {
      return await conn.sendMessage(chat, { text: t }, { quoted: m })
    } catch (e) {
      try {
        console.error('[config] sendMessage error:', e)
      } catch {}
    }
  }

  try {
    if (!isGroup) return await reply('「✦」Este comando solo funciona en *grupos*.')

    const fullInput = `${command} ${text}`
    const tokens = parseTokens(fullInput)

    let action = null
    let feature = null

    for (const token of tokens) {
      const clean = cleanArg(token)
      
      if (clean === 'on') action = 'on'
      else if (clean === 'off') action = 'off'
      
      if (FEATURE_MAP[clean]) feature = FEATURE_MAP[clean]
    }

    if (!feature || !action) {
      return await reply(
        '「✦」Uso correcto (Cualquier orden):\n' +
          '> ✐ *.welcome on* | *.welcome off*\n' +
          '> ✐ *.avisos on*  | *.avisos off*\n' +
          '> ✐ *.antilink on* | *.antilink off*\n\n' +
          'También válido: *.on welcome*, *.off antilink*, etc.'
      )
    }

    const enable = action === 'on'

    if (feature === 'welcome') {
      await callMaybeAsync(setWelcomeEnabled, chat, enable, subbotId)
    } else if (feature === 'avisos') {
      await callMaybeAsync(setAvisosEnabled, chat, enable, subbotId)
    } else if (feature === 'antilink') {
      await callMaybeAsync(setAntilinkEnabled, chat, enable, subbotId)
    }

    const currentState =
      feature === 'welcome'
        ? await callMaybeAsync(isWelcomeEnabled, chat, subbotId)
        : feature === 'avisos'
          ? await callMaybeAsync(isAvisosEnabled, chat, subbotId)
          : await callMaybeAsync(isAntilinkEnabled, chat, subbotId)

    const statusText = buildStatusText(feature, enable)
    return await reply(`${statusText}\n> ✐ Estado actual » *${currentState ? 'ON' : 'OFF'}*`)
    
  } catch (e) {
    return await reply(
      '「✦」Ocurrió un error al ejecutar el comando.\n' +
        `> ✐ Error » *${String(e?.message || e)}*`
    )
  }
}

handler.help = ['welcome on/off', 'avisos on/off', 'antilink on/off']
handler.tags = ['group']
handler.command = [
  'on', 'off', 
  'welcome', 'bienvenida', 
  'avisos', 'aviso', 
  'antilink', 'anti', 'enlaces', 'links'
]
handler.useradm = true

export default handler
