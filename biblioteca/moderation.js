import config from '../config.js'
import { jidNormalizedUser } from '@whiskeysockets/baileys'
import {
  isAntilinkEnabled,
  isBotEnabled,
  bumpAntilinkStrike,
  resetAntilinkStrike
} from './settings.js'

const isGroupRe = /@g\.us$/

const groupCtxCache = new Map()
const GROUP_CTX_TTL_MS = 15_000

function groupCtxCacheKey(conn, from) {
  const sk = conn?.isSubBot ? String(conn?.subbotId || 'sub') : 'main'
  return `${sk}:${from}`
}

function getDecodeJid(conn) {
  return typeof conn?.decodeJid === 'function'
    ? conn.decodeJid.bind(conn)
    : (jid) => jidNormalizedUser(jid || '')
}

function getSenderJid(msg) {
  return (
    msg?.sender ||
    msg?.key?.participant ||
    msg?.participant ||
    msg?.message?.extendedTextMessage?.contextInfo?.participant ||
    msg?.message?.imageMessage?.contextInfo?.participant ||
    msg?.message?.videoMessage?.contextInfo?.participant ||
    msg?.message?.documentMessage?.contextInfo?.participant ||
    msg?.message?.audioMessage?.contextInfo?.participant ||
    msg?.message?.stickerMessage?.contextInfo?.participant ||
    msg?.message?.reactionMessage?.key?.participant ||
    msg?.message?.pollUpdateMessage?.pollCreationMessageKey?.participant ||
    ''
  )
}

function getBotJidRaw(conn) {
  return (
    conn?.user?.jid ||
    conn?.user?.id ||
    conn?.user?.user?.jid ||
    conn?.user?.user?.id ||
    ''
  )
}

function safeStr(v) {
  return v === undefined || v === null ? '' : String(v)
}

function extractLinks(text = '') {
  const t = String(text || '')
  if (!t) return []

  const re =
    /(?:https?:\/\/)?(?:www\.)?(?:chat\.whatsapp\.com\/[A-Za-z0-9]+|whatsapp\.com\/channel\/[A-Za-z0-9]+)/gi

  const out = []
  let m
  while ((m = re.exec(t))) out.push(m[0])
  return out
}

function isOwnerJid(conn, senderJid) {
  const decodeJid = getDecodeJid(conn)
  const s = decodeJid(senderJid)
  if (!s) return false

  const owners = Array.isArray(config?.owner) ? config.owner.map(decodeJid) : []
  if (owners.includes(s)) return true

  const subOwner = decodeJid(conn?.subbotOwner || '')
  return subOwner && subOwner === s
}

async function getGroupContextLikeHandler(conn, from, senderRaw, needFresh = true) {
  const decodeJid = getDecodeJid(conn)
  const key = groupCtxCacheKey(conn, from)
  const cached = groupCtxCache.get(key)

  if (cached && Date.now() - cached.ts < GROUP_CTX_TTL_MS) {
    const senderDecoded = decodeJid(senderRaw)
    const userIsAdmin = cached.adminByDecoded.get(senderDecoded) === true
    return {
      groupMetadata: cached.meta,
      participants: cached.participants,
      userIsAdmin,
      botIsAdmin: cached.botIsAdmin,
      groupName: safeStr(cached.meta?.subject)
    }
  }

  const storeCached = conn?.chats?.[from]?.metadata || null
  const meta =
    storeCached ||
    (needFresh ? await conn.groupMetadata(from).catch(() => null) : null) ||
    {}

  const rawParticipants = Array.isArray(meta?.participants) ? meta.participants : []
  const participants = rawParticipants.map((p) => {
    const jid = p?.jid || p?.id || p?.participant || ''
    return { jid, admin: p?.admin }
  })

  const adminByDecoded = new Map()
  for (const p of participants) {
    const dj = decodeJid(p.jid)
    if (!dj) continue
    const a = p?.admin
    const isAdmin = a === 'superadmin' || a === 'admin' || a === true
    adminByDecoded.set(dj, Boolean(isAdmin))
  }

  const senderDecoded = decodeJid(senderRaw)
  const botDecoded = decodeJid(getBotJidRaw(conn))
  const userIsAdmin = adminByDecoded.get(senderDecoded) === true
  const botIsAdmin = adminByDecoded.get(botDecoded) === true

  groupCtxCache.set(key, {
    ts: Date.now(),
    meta,
    participants,
    adminByDecoded,
    botIsAdmin
  })

  return {
    groupMetadata: meta,
    participants,
    userIsAdmin: Boolean(userIsAdmin),
    botIsAdmin: Boolean(botIsAdmin),
    groupName: safeStr(meta?.subject)
  }
}

function buildDeleteFromMsgKey(msg, senderJid) {
  const from = msg?.key?.remoteJid
  const id = msg?.key?.id
  if (!from || !id) return null

  const participant =
    msg?.key?.participant ||
    msg?.participant ||
    msg?.message?.extendedTextMessage?.contextInfo?.participant ||
    msg?.message?.imageMessage?.contextInfo?.participant ||
    msg?.message?.videoMessage?.contextInfo?.participant ||
    msg?.message?.documentMessage?.contextInfo?.participant ||
    msg?.message?.audioMessage?.contextInfo?.participant ||
    senderJid ||
    undefined

  return { remoteJid: from, fromMe: false, id, participant }
}

function makeFkontak(senderJid = '', displayName = 'Moderación') {
  const num = String(senderJid || '').split('@')[0] || '0'
  const vcard =
    'BEGIN:VCARD\n' +
    'VERSION:3.0\n' +
    `FN:${displayName}\n` +
    `N:${displayName};;;;\n` +
    `TEL;type=CELL;type=VOICE;waid=${num}:+${num}\n` +
    'END:VCARD'

  return {
    key: {
      fromMe: false,
      participant: '0@s.whatsapp.net',
      remoteJid: 'status@broadcast'
    },
    message: {
      contactMessage: {
        displayName,
        vcard
      }
    }
  }
}

async function sendWarn(conn, to, text, senderJid) {
  const quoted = makeFkontak(senderJid, '𝗔𝗡𝗧𝗜𝗟𝗜𝗡𝗞 🦖')
  try {
    await conn.sendMessage(to, { text }, { quoted })
  } catch {
    try {
      await conn.sendMessage(to, { text })
    } catch {}
  }
}

export async function applyModeration(conn, msg, text = '', ctx = {}) {
  const from = msg?.key?.remoteJid || ''
  if (!from || !isGroupRe.test(from)) return { acted: false }

  const subbotId = conn?.isSubBot ? String(conn?.subbotId || '').trim() : ''
  if (!isBotEnabled(from, subbotId)) return { acted: false, skipped: 'bot_off' }
  if (!isAntilinkEnabled(from, subbotId)) return { acted: false, skipped: 'antilink_off' }

  const sender = getSenderJid(msg)
  if (!sender) return { acted: false }

  const links = extractLinks(text)
  if (!links.length) return { acted: false }

  if (isOwnerJid(conn, sender)) return { acted: false, skipped: 'owner' }

  let userIsAdmin = ctx?.userIsAdmin === true
  let botIsAdmin = ctx?.botIsAdmin === true || ctx?.botadm === true

  if (!userIsAdmin || !botIsAdmin) {
    const gctx = await getGroupContextLikeHandler(conn, from, sender, true)
    if (!userIsAdmin) userIsAdmin = gctx.userIsAdmin
    if (!botIsAdmin) botIsAdmin = gctx.botIsAdmin
  }

  if (userIsAdmin) return { acted: false, skipped: 'admin' }

  let deleted = false
  if (botIsAdmin) {
    const delKey = buildDeleteFromMsgKey(msg, sender)
    if (delKey) {
      try {
        await conn.sendMessage(from, { delete: delKey })
        deleted = true
      } catch {
        try {
          await conn.sendMessage(from, { delete: msg.key })
          deleted = true
        } catch {}
      }
    }
  }

  const strike = bumpAntilinkStrike(from, sender, subbotId)
  const count = Number(strike?.count || 0)

  if (count >= 3) {
    if (botIsAdmin) {
      try {
        await conn.groupParticipantsUpdate(from, [sender], 'remove')
      } catch {}
      resetAntilinkStrike(from, sender, subbotId)

      await sendWarn(conn, from, `「✦」Antilink: 3/3 alcanzadas. Usuario expulsado.`, sender)
      return { acted: true, action: 'kick', strikes: 3, deleted, links }
    }

    await sendWarn(
      conn,
      from,
      `「✦」Antilink: 3/3 alcanzadas, pero no soy admin para expulsar${deleted ? '' : ' ni borrar'}.`,
      sender
    )
    return { acted: true, action: 'warn', strikes: 3, deleted, links }
  }

  if (!botIsAdmin && !deleted) {
    await sendWarn(
      conn,
      from,
      `「✦」Antilink: detecté enlace, pero no puedo borrarlo porque no soy admin. Advertencia ${count}/3.`,
      sender
    )
  } else {
    await sendWarn(
      conn,
      from,
      `「✦」Antilink: enlace ${deleted ? 'eliminado' : 'detectado'}. Advertencia ${count}/3.`,
      sender
    )
  }

  return { acted: true, action: 'warn', strikes: count, deleted, links }
}