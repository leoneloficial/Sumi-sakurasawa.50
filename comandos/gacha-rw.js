import {
  withDbLock,
  loadEconomyDb,
  saveEconomyDb,
  getUser,
  getWaifuState,
  normalizeUserJid,
  getNameSafe,
  gachaDecor,
  safeUserTag,
  getCooldown,
  setCooldown,
  msToHuman,
  replyText
} from '../biblioteca/economia.js'

import { WAIFUS, rarityMeta } from '../biblioteca/waifuCatalog.js'
import { getWaifuImageUrl } from '../biblioteca/waifuImages.js'

import fetch from 'node-fetch'

const CD = 15 * 60 * 1000
const CLAIM_WINDOW = 5 * 60 * 1000

function pickRandomWaifu() {
  const list = Array.isArray(WAIFUS) && WAIFUS.length ? WAIFUS : []
  if (!list.length) return null
  return list[Math.floor(Math.random() * list.length)]
}

function formatYen(n = 0) {
  const x = Number(n) || 0
  return x.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ',')
}

const handler = async (m, { conn }) => {
  const userJid = normalizeUserJid(m?.sender)

  await withDbLock('global', async () => {
    const db = loadEconomyDb()
    const user = getUser(db, userJid)
    const userTag = safeUserTag(conn, m)

    const remain = getCooldown(user, 'rw')
    if (remain > 0) {
      const text = gachaDecor({
        title: 'Aún no puedes usar rw.',
        lines: [`> Vuelve en » *${msToHuman(remain)}*`],
        userTag
      })
      saveEconomyDb(db)
      return await replyText(conn, m, text)
    }

    const waifu = pickRandomWaifu()
    if (!waifu) {
      const text = gachaDecor({
        title: 'No hay waifus disponibles.',
        lines: ['> Revisa que tu catálogo WAIFUS tenga datos.'],
        userTag
      })
      saveEconomyDb(db)
      return await replyText(conn, m, text)
    }

    const meta = rarityMeta(waifu.rarity)
    const state = getWaifuState(db, waifu.id)

    user.lastRoll = { id: waifu.id, at: Date.now() }
    setCooldown(user, 'rw', CD)

    const status = state.owner
      ? `Reclamada por *${await getNameSafe(conn, state.owner)}*`
      : 'Libre para reclamar'

    const value = Number(waifu.value) || Number(meta?.value) || 0

    const chatId = m?.chat || m?.key?.remoteJid || m?.from || m?.jid || m?.remoteJid

    const text = gachaDecor({
      title: `Roll Waifu — ${waifu.name}`,
      lines: [
        `> ❏ ID » *${waifu.id}*`,
        `> ✰ Rareza » *${meta?.name || 'Desconocida'} (${waifu.rarity})*`,
        `> ❐ Origen » *${waifu.source}*`,
        `> ♂/♀ Género » *${waifu.gender}*`,
        `> ♡ Valor » *¥${formatYen(value)}*`,
        `> ⌁ Estado » *${status}*`,
        '',
        `✐ Para reclamar: *${m.usedPrefix || '.'}c*`,
        `> Tienes *${Math.floor(CLAIM_WINDOW / 60000)} min* para reclamar este roll.`
      ],
      userTag
    })

    saveEconomyDb(db)

    const imgUrl = await getWaifuImageUrl(waifu).catch(() => null)
    if (imgUrl) {
      try {
        await conn.sendMessage(
          chatId,
          { image: { url: imgUrl }, caption: text },
          { quoted: m }
        )
        return
      } catch {
        try {
          const res = await fetch(imgUrl, {
            timeout: 15000,
            headers: {
              'user-agent': 'Mozilla/5.0',
              accept: 'image/*,*/*;q=0.8'
            }
          })
          const buf = await res.arrayBuffer()
          const buffer = Buffer.from(buf)
          if (buffer?.length) {
            await conn.sendMessage(
              chatId,
              { image: buffer, caption: text },
              { quoted: m }
            )
            return
          }
        } catch {}
      }
    }

    await replyText(conn, m, text)
  })
}

handler.command = ['rollwaifu', 'roll', 'rw', 'tirar']
handler.tags = ['gacha']
handler.help = ['rw']

export default handler