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
  setCooldown,
  msToHuman,
  pick,
  randInt,
  replyText
} from '../biblioteca/economia.js'
const CD = 60 * 60 * 1000

const GIGS = [
  'Le metiste la verga a @random y te pagaron bien',
  'Te chupaste la verga a @random en el baño',
  '@random te rompió el culo en el motel',
  'Hiciste un trío con @random y su amigo',
  'Te manoseaste delante de @random por dinero',
  '@random te pagó extra por una mamada'
]

const CAUGHT = [
  'El marido de @random te descubrió y te golpeó',
  'Te quisieron violar y tuviste que pagar seguridad',
  'La policía interrumpió tu sesión con @random',
  '@random se negó a pagar y te robaron',
  'Te dieron una paliza por ser muy puta'
]

const handler = async (m, { conn }) => {
  const subbotId = getSubbotId(conn)
  const userJid = m?.sender

  await withDbLock(subbotId, async () => {
    const db = loadEconomyDb()
    const user = getUser(db, subbotId, userJid)
    const userTag = safeUserTag(conn, m)

    const remain = getCooldown(user, 'slut')
    if (remain > 0) {
      const text = economyDecor({
        title: 'Aún no puedes usar slut.',
        lines: [`> Vuelve en » *${msToHuman(remain)}*`],
        userTag
      })
      saveEconomyDb(db)
      return await replyText(conn, m, text)
    }

    const ok = Math.random() < 0.68
    
    const getRandomMention = () => {
      if (m.isGroup && m.metadata?.participants) {
        const randomParticipant = pick(m.metadata.participants)
        return `@${randomParticipant.id.split('@')[0]}`
      }
      return 'un cliente'
    }

    const mention = getRandomMention()

    if (ok) {
      const earned = randInt(60000, 220000)
      user.wallet += earned
      user.stats.slut = (user.stats.slut || 0) + 1
      setCooldown(user, 'slut', CD)

      const gigText = pick(GIGS).replace(/@random/g, mention)

      const text = economyDecor({
        title: `Turno completado! +${formatMoney(earned)}`,
        lines: [`> ${gigText}.`],
        userTag
      })

      saveEconomyDb(db)
      return await replyText(conn, m, text)
    }

    const fine = randInt(15000, 120000)
    user.wallet = Math.max(0, user.wallet - fine)
    user.stats.slut = (user.stats.slut || 0) + 1
    setCooldown(user, 'slut', CD)

    const caughtText = pick(CAUGHT).replace(/@random/g, mention)

    const text = economyDecor({
      title: `Mal turno... -${formatMoney(fine)}`,
      lines: [`> ${caughtText}.`],
      userTag
    })

    saveEconomyDb(db)
    return await replyText(conn, m, text)
  })
}

handler.command = ['slut', 'nocturno', 'night']
handler.tags = ['economy']
handler.help = ['slut']

export default handler
