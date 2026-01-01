import fetch from 'node-fetch'

function esc(s = '') {
  return String(s || '')
    .replace(/\*/g, '＊')
    .replace(/_/g, '＿')
    .replace(/`/g, '｀')
}

async function replyText(conn, chat, text, quoted) {
  return conn.sendMessage(chat, { text }, { quoted })
}

async function reactMsg(conn, chat, key, emoji) {
  try {
    return await conn.sendMessage(chat, { react: { text: emoji, key } })
  } catch {
    return null
  }
}

function isValidIgUrl(u = '') {
  const s = String(u || '').trim()
  if (!s) return false
  return /instagram\.com/i.test(s)
}

function pickMediaList(json) {
  const arr = json?.data
  return Array.isArray(arr) ? arr : []
}

const handler = async (m, { conn, args, usedPrefix, command }) => {
  const chat = m.chat || m.key?.remoteJid
  const url = (args || []).join(' ').trim()

  if (!url) {
    return replyText(
      conn,
      chat,
      `「✦」Uso » *${usedPrefix + command}* <enlace>\n> ✐ Ejemplo » *${usedPrefix + command}* https://www.instagram.com/reel/abc123/`,
      m
    )
  }

  if (!isValidIgUrl(url)) {
    return replyText(conn, chat, '「✦」Ingresa un enlace válido de Instagram.\n> ✐ Debe contener *instagram.com*', m)
  }

  try {
    await reactMsg(conn, chat, m.key, '🕒')

    const api = `https://api.dorratz.com/igdl?url=${encodeURIComponent(url)}`
    const res = await fetch(api)
    const json = await res.json().catch(() => null)

    const items = pickMediaList(json)

    if (!items.length) {
      await reactMsg(conn, chat, m.key, '✔️')
      return replyText(conn, chat, '「✦」No se pudo obtener el contenido.\n> ✐ Intenta con otro enlace.', m)
    }

    const header =
      `「✦」 *INSTAGRAM DOWNLOAD*\n` +
      `> 🜸 Link » _${esc(url)}_\n\n`

    let sent = 0

    for (const media of items) {
      const mediaUrl = media?.url
      if (!mediaUrl) continue

      const type = String(media?.type || '').toLowerCase()
      const isImage = type.includes('image') || type.includes('jpg') || type.includes('png') || type.includes('photo')

      const caption = sent === 0 ? header + '❀ Aquí tienes tu video.' : '❀ Aquí tienes otra parte.'

      try {
        if (isImage) {
          await conn.sendMessage(chat, { image: { url: mediaUrl }, caption }, { quoted: m })
        } else {
          await conn.sendMessage(chat, { video: { url: mediaUrl }, caption }, { quoted: m })
        }
        sent++
      } catch (e) {
        try {
          await conn.sendFile(chat, mediaUrl, isImage ? 'igdl.jpg' : 'igdl.mp4', caption, m)
          sent++
        } catch {}
      }
    }

    await reactMsg(conn, chat, m.key, '✔️')

    if (!sent) {
      return replyText(conn, chat, '「✦」No pude enviar el archivo.\n> ✐ Intenta nuevamente.', m)
    }
  } catch (e) {
    console.error(e)
    await reactMsg(conn, chat, m.key, '✔️')
    return replyText(conn, chat, '「✦」Ocurrió un error al descargar.\n> ✐ Intenta nuevamente.', m)
  }
}

handler.help = ['ig <url>']
handler.tags = ['downloader']
handler.command = ['ig', 'instagram']

export default handler