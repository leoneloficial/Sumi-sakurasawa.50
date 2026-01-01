import {
  withDbLock,
  loadEconomyDb,
  saveEconomyDb,
  getSubbotId,
  getUser,
  formatMoney,
  economyDecor,
  safeUserTag,
  getCooldown,
  msToHuman,
  totalWealth,
  replyText
} from '../biblioteca/economia.js'

const handler = async (m, { conn }) => {
  const subbotId = getSubbotId(conn)
  const userJid = m?.sender

  await withDbLock(subbotId, async () => {
    const db = loadEconomyDb()
    const user = getUser(db, subbotId, userJid)
    const userTag = safeUserTag(conn, m)

    const now = Date.now()
    const investRemain = Math.max(0, Number(user?.invest?.matureAt || 0) - now)

    const cooldowns = [
      { name: 'Work', value: msToHuman(getCooldown(user, 'work')) },
      { name: 'Crime', value: msToHuman(getCooldown(user, 'crime')) },
      { name: 'Slut', value: msToHuman(getCooldown(user, 'slut')) },
      { name: 'Slot', value: msToHuman(getCooldown(user, 'slot')) },
      { name: 'Rob', value: msToHuman(getCooldown(user, 'rob')) },
      { name: 'Beg', value: msToHuman(getCooldown(user, 'beg')) },
      { name: 'Weekly', value: msToHuman(getCooldown(user, 'weekly')) },
      { name: 'Coinflip', value: msToHuman(getCooldown(user, 'coinflip')) },
      { name: 'Roulette', value: msToHuman(getCooldown(user, 'roulette')) },
      { name: 'Invest (cobro)', value: msToHuman(investRemain) }
    ]

    const text = economyDecor({
      title: 'E-Info',
      lines: ['> Aquí tienes tus tiempos y tu dinero actual.'],
      userTag,
      cooldowns,
      stats: [
        { k: '♡ Billetera', v: formatMoney(user.wallet) },
        { k: '✰ Banco', v: formatMoney(user.bank) },
        { k: '❏ Total', v: formatMoney(totalWealth(user)) }
      ]
    })

    saveEconomyDb(db)
    await replyText(conn, m, text)
  })
}

handler.command = ['economyinfo', 'einfo', 'econinfo', 'economia']
handler.tags = ['economy']
handler.help = ['einfo']

export default handler
