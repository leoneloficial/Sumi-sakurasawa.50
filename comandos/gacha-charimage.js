import {
  withDbLock,
  loadEconomyDb,
  saveEconomyDb,
  gachaDecor,
  safeUserTag,
  replyText
} from '../biblioteca/economia.js'

import { getWaifuById, searchWaifus, rarityMeta } from '../biblioteca/waifuCatalog.js'
import { getWaifuImageUrl } from '../biblioteca/waifuImages.js'

function resolveWaifu(query = '') {
  const q = String(query || '').trim()
  if (!q) return null
  const direct = getWaifuById(q)
  if (direct) return direct
  const hit = searchWaifus(q, 1)?.[0]
  return hit || null
}

const handler = async (m, { conn, text, usedPrefix, command }) => {
  const q = String(text || '').trim()

  await withDbLock('global', async () => {
    const db = loadEconomyDb()
    const userTag = safeUserTag(conn, m)

    if (!q) {
      const t = gachaDecor({
        title: 'Uso:',
        lines: [
          `> *${usedPrefix || '.'}${command} <id|nombre>*`,
          `> Ej: *${usedPrefix || '.'}${command} w005*`
        ],
        userTag
      })
      saveEconomyDb(db)
      return replyText(conn, m, t)
    }

    const w = resolveWaifu(q)
    if (!w) {
      const t = gachaDecor({
        title: 'No se encontró el personaje.',
        lines: [`> Prueba con *${usedPrefix || '.'}buscarwaifu <texto>*.`],
        userTag
      })
      saveEconomyDb(db)
      return replyText(conn, m, t)
    }

    const meta = rarityMeta(w.rarity)
    const caption = gachaDecor({
      title: `Imagen: ${w.name}`,
      lines: [
        `> ❏ ID » *${w.id}*`,
        `> ✰ Rareza » *${meta.name} (${w.rarity})*`,
        `> ❐ Origen » *${w.source}*`
      ],
      userTag
    })

    const url = await getWaifuImageUrl(w, null).catch(() => null)
    saveEconomyDb(db)

    if (url) {
      try {
        await conn.sendMessage(m.chat, { image: { url }, caption }, { quoted: m })
        return
      } catch {}
    }

    return replyText(conn, m, caption)
  })
}

handler.command = ['charimage', 'waifuimage', 'cimage', 'wimage']
handler.tags = ['gacha']
handler.help = ['charimage <id|nombre>']

export default handler
