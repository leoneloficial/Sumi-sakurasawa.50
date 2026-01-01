import {
  withDbLock,
  loadEconomyDb,
  saveEconomyDb,
  getSubbotId,
  normalizeUserJid,
  resolveUserJid,
  getNameSafe,
  formatMoney,
  economyDecor,
  totalWealth,
  replyText
} from '../biblioteca/economia.js'

const PER_PAGE = 10

function clampInt(n, min, max) {
  const x = Math.floor(Number(n))
  if (!Number.isFinite(x)) return min
  return Math.max(min, Math.min(max, x))
}

const handler = async (m, { conn, args }) => {
  const subbotId = getSubbotId(conn)

  await withDbLock(subbotId, async () => {
    const db = loadEconomyDb()
    const users = db.users || {}

    const all = Object.entries(users)
      .map(([jid, u]) => ({ jid, total: totalWealth(u) }))
      .filter((e) => e.total > 0)
      .sort((a, b) => b.total - a.total)

    if (!all.length) {
      const text = economyDecor({
        title: 'Baltop vacío por ahora.',
        lines: ['> Empieza con *daily*, *work* y *crime*.']
      })
      saveEconomyDb(db)
      return await replyText(conn, m, text)
    }

    const totalPages = Math.max(1, Math.ceil(all.length / PER_PAGE))
    const page = clampInt(args?.[0] || 1, 1, totalPages)
    const start = (page - 1) * PER_PAGE
    const slice = all.slice(start, start + PER_PAGE)

    const names = await Promise.all(slice.map(async (e) => {
      const resolved = await resolveUserJid(conn, normalizeUserJid(e.jid))
      const n = await getNameSafe(conn, resolved || normalizeUserJid(e.jid))
      return String(n).trim() || null
    }))

    const lines = []
    for (let i = 0; i < slice.length; i++) {
      const rank = start + i + 1
      const jid = slice[i].jid
      const num = String(jid || '').split('@')[0]
      let name = names[i] || String(num)
      name = String(name).trim()
      if (!name.endsWith(':')) name = `${name}:`
      lines.push(`✰ ${rank} » *${name}*`)
      lines.push(`\t\t Total→ *${formatMoney(slice[i].total)}*`)
    }
    lines.push('')
    lines.push(`> • Página *${page}* de *${totalPages}*`)

    const text = economyDecor({
      title: 'Los usuarios con más *ᴅᴏʟᴀʀᴇs* son:',
      lines
    })

    saveEconomyDb(db)
    return await replyText(conn, m, text)
  })
}

handler.command = ['economyboard', 'eboard', 'baltop', 'topbal']
handler.tags = ['economy']
handler.help = ['baltop', 'baltop 2']

export default handler
