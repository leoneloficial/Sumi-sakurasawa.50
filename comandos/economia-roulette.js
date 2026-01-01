import {
  withDbLock,
  loadEconomyDb,
  saveEconomyDb,
  getSubbotId,
  getUser,
  parseAmount,
  formatMoney,
  economyDecor,
  safeUserTag,
  getCooldown,
  setCooldown,
  replyText
} from '../biblioteca/economia.js'

const CD = 20 * 1000

function normalizeBet(s = '') {
  const t = String(s || '').toLowerCase()
  if (['rojo', 'r', 'red'].includes(t)) return 'rojo'
  if (['negro', 'n', 'black'].includes(t)) return 'negro'
  if (['verde', 'v', 'green'].includes(t)) return 'verde'
  return null
}

function rollColor() {

  const p = Math.random()
  if (p < 1 / 37) return 'verde'
  return Math.random() < 0.5 ? 'rojo' : 'negro'
}

const handler = async (m, { conn, args }) => {
  const subbotId = getSubbotId(conn)
  const userJid = m?.sender

  await withDbLock(subbotId, async () => {
    const db = loadEconomyDb()
    const user = getUser(db, subbotId, userJid)
    const userTag = safeUserTag(conn, m)

    const remain = getCooldown(user, 'roulette')
    if (remain > 0) {
      const text = economyDecor({
        title: 'Espera un momento para jugar ruleta.',
        lines: ['> Mira tu tiempo en *.einfo*'],
        userTag
      })
      saveEconomyDb(db)
      return await replyText(conn, m, text)
    }

    const amount = parseAmount(args?.[0], user.wallet)
    const bet = normalizeBet(args?.[1] || '')

    if (!amount || amount <= 0 || !bet) {
      const text = economyDecor({
        title: 'Uso: roulette <cantidad> <rojo/negro/verde>',
        lines: ['> Ej: roulette 100k rojo', '> Verde paga x14 (más difícil).'],
        userTag
      })
      saveEconomyDb(db)
      return await replyText(conn, m, text)
    }

    if (user.wallet < amount) {
      const text = economyDecor({
        title: 'No tienes suficiente para apostar.',
        lines: ['> Mira tu dinero en *.einfo*'],
        userTag
      })
      saveEconomyDb(db)
      return await replyText(conn, m, text)
    }

    const result = rollColor()
    const win = result === bet
    const mult = bet === 'verde' ? 14 : 2

    user.stats.roulette = (user.stats.roulette || 0) + 1
    setCooldown(user, 'roulette', CD)

    if (win) {
      const profit = amount * (mult - 1)
      user.wallet += profit
      const text = economyDecor({
        title: `¡Ruleta ganada! +${formatMoney(profit)}`,
        lines: [`> Resultado: *${result}* | Apuesta: *${bet}* (x${mult})`],
        userTag
      })
      saveEconomyDb(db)
      return await replyText(conn, m, text)
    }

    user.wallet = Math.max(0, user.wallet - amount)
    const text = economyDecor({
      title: `Ruleta perdida... -${formatMoney(amount)}`,
      lines: [`> Resultado: *${result}* | Apuesta: *${bet}*`],
      userTag
    })

    saveEconomyDb(db)
    return await replyText(conn, m, text)
  })
}

handler.command = ['roulette', 'ruleta', 'rt']
handler.tags = ['economy']
handler.help = ['roulette 100k rojo']

export default handler
