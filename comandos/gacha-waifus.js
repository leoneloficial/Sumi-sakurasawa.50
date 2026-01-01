import {
  withDbLock,
  loadEconomyDb,
  saveEconomyDb,
  getUser,
  getWaifuState,
  gachaDecor,
  safeUserTag,
  replyText
} from '../biblioteca/economia.js'

import { getWaifuById, rarityMeta } from '../biblioteca/waifuCatalog.js'

const PER_PAGE = 10

const handler = async (m, { conn, args }) => {
  const userJid = m?.sender
  const page = Math.max(1, Math.floor(Number(args?.[0] || 1)))

  await withDbLock('global', async () => {
    const db = loadEconomyDb()
    const user = getUser(db, userJid)
    const userTag = safeUserTag(conn, m)

    const inv = Array.isArray(user.waifus) ? user.waifus : []
    if (!inv.length) {
      const text = gachaDecor({
        title: 'Tu inventario está vacío.',
        lines: [`> Usa *${m.usedPrefix || '.'}rw* para tirar.`],
        userTag
      })
      saveEconomyDb(db)
      return await replyText(conn, m, text)
    }

    const totalPages = Math.max(1, Math.ceil(inv.length / PER_PAGE))
    const p = Math.min(page, totalPages)
    const start = (p - 1) * PER_PAGE
    const slice = inv.slice(start, start + PER_PAGE)

    const lines = slice.map((id, idx) => {
      const w = getWaifuById(id)
      const st = getWaifuState(db, id)
      const meta = rarityMeta(w?.rarity)
      const listed = db.market?.[id] ? '🛒' : ''
      const origin = w ? (w.source || w.anime || '') : ''
      return `> ${(start + idx + 1).toString().padStart(2, '0')}. *${w?.name || id}* ${listed}\n  └ ID: *${id}* • ${w ? `✰ ${w.rarity}` : ''}${origin ? ` • ${origin}` : ''}${st?.owner ? '' : ''}`
    })

    lines.push('', `✐ Página *${p}*/*${totalPages}*  —  Total: *${inv.length}*`, `> Ver mercado: *${m.usedPrefix || '.'}market*`)

    const text = gachaDecor({
      title: 'Tus Waifus',
      lines,
      userTag
    })

    saveEconomyDb(db)
    await replyText(conn, m, text)
  })
}

handler.command = ['harem', 'claims', 'waifus', 'invwaifu', 'inv']
handler.tags = ['gacha']
handler.help = ['waifus [página]']

export default handler
