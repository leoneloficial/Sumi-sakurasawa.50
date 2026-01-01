import { exec } from 'child_process'
import util from 'util'
import config from '../config.js'

const execAsync = util.promisify(exec)

let handler = async (m, { conn, text, usedPrefix, command }) => {
  const from = m.chat || m.key?.remoteJid

  const ownerJids = (config.owner || []).map(v =>
    String(v).includes('@')
      ? String(v).trim()
      : String(v).replace(/[^0-9]/g, '') + '@s.whatsapp.net'
  )

  const sender = m.sender || m.key?.participant || m.key?.remoteJid
  const botJid =
    (conn.user?.jid || conn.user?.id || '')
      .split(':')[0]
      .replace(/[^0-9]/g, '') + '@s.whatsapp.net'

  const isOwner = ownerJids.includes(sender) || sender === botJid
  if (!isOwner) {
    return await conn.sendMessage(
      from,
      { text: '「✦」Este comando solo puede ser usado por el *dueño* del bot.' },
      { quoted: m }
    )
  }

  const commandToExecute = (text || '').trim()
  if (!commandToExecute) {
    return await conn.sendMessage(
      from,
      {
        text:
          `「✦」Uso: *${usedPrefix || '.'}${command} <comando>*\n\n` +
          `> ✐ Ejemplo:\n` +
          `• ${usedPrefix || '.'}${command} ls -la\n` +
          `• ${usedPrefix || '.'}${command} node -v`
      },
      { quoted: m }
    )
  }

  try {
    await conn.sendMessage(from, { text: '「✦」Ejecutando comando...' }, { quoted: m })

    const { stdout, stderr } = await execAsync(commandToExecute, {
      windowsHide: true,
      timeout: 60_000,
      maxBuffer: 1024 * 1024
    })

    let output = ''
    if (stdout) output += stdout
    if (stderr) output += (output ? '\n\n' : '') + stderr

    if (!output.trim()) output = 'Comando ejecutado sin salida.'

    const maxLength = 50000
    if (output.length > maxLength) {
      output = output.slice(0, maxLength) + '\n\n... (mensaje truncado)'
    }

    await conn.sendMessage(
      from,
      {
        text:
          `${output}`
      },
      { quoted: m }
    )
  } catch (e) {
    let errorMessage = e?.message || String(e) || 'Error desconocido'
    if (errorMessage.length > 1000) errorMessage = errorMessage.slice(0, 1000) + '...'

    await conn.sendMessage(
      from,
      {
        text:
          `「✦」Error al ejecutar el comando.\n\n` +
          `> ✐ Comando:\n\`\`\`${commandToExecute}\`\`\`\n\n` +
          `> ✐ Error »\n${errorMessage}`
      },
      { quoted: m }
    )
  }
}

handler.help = ['e']
handler.tags = ['owner']
handler.command = ['e']
handler.rowner = true

export default handler