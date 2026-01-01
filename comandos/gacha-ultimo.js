import {
  withDbLock,
  loadEconomyDb,
  saveEconomyDb,
  getUser,
  gachaDecor,
  safeUserTag,
  normalizeUserJid,
  msToHuman,
  replyText
} from '../biblioteca/economia.js'

import { getWaifuById, rarityMeta } from '../biblioteca/waifuCatalog.js'

const CLAIM_WINDOW = 5 * 60 * 1000

const handler = async (m, { conn, usedPrefix }) => {
  const userJid = normalizeUserJid(m?.sender)

  await withDbLock('global', async () => {
    const db = loadEconomyDb()
    const user = getUser(db, userJid)
    const userTag = safeUserTag(conn, m)

    const last = user.lastRoll || { id: '', at: 0 }
    const id = String(last.id || '').trim()
    const at = Number(last.at || 0)

    if (!id || !at) {
      const t = gachaDecor({
        title: 'No tienes un roll activo.',
        lines: [`> Usa *${usedPrefix || '.'}rw* para tirar.`],
        userTag
      })
      saveEconomyDb(db)
      return replyText(conn, m, t)
    }

    const w = getWaifuById(id)
    const meta = rarityMeta(w?.rarity)
    const elapsed = Date.now() - at
    const remain = Math.max(0, CLAIM_WINDOW - elapsed)

    const t = gachaDecor({
      title: 'Tu último roll',
      lines: [
        `> ❏ ID » *${id}*`,
        `> ❀ Nombre » *${w?.name || id}*`,
        w ? `> ✰ Rareza » *${meta.name} (${w.rarity})*` : '',
        w ? `> ❐ Origen » *${w.source || w.anime}*` : '',
        '',
        remain > 0 ? `> Tiempo para reclamar » *${msToHuman(remain)}*` : `> Estado » *Expirado*`,
        remain > 0 ? `✐ Reclamar: *${usedPrefix || '.'}c*` : `✐ Tirar de nuevo: *${usedPrefix || '.'}rw*`
      ].filter(Boolean),
      userTag
    })

    saveEconomyDb(db)
    return replyText(conn, m, t)
  })
}

handler.command = ['ultimoroll', 'lastroll', 'lastwaifu']
handler.tags = ['gacha']
handler.help = ['ultimoroll']

export default handler
