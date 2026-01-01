import yts from 'yt-search'

function esc(s = '') {
  return String(s || '')
    .replace(/\*/g, '＊')
    .replace(/_/g, '＿')
    .replace(/`/g, '｀')
}

function fmtNum(n) {
  const x = Number(n)
  if (!Number.isFinite(x)) return ''
  return String(Math.trunc(x)).replace(/\B(?=(\d{3})+(?!\d))/g, ',')
}

function pickThumb(v) {
  if (v?.thumbnail) return v.thumbnail
  if (v?.image) return v.image
  const t = v?.thumbnails
  if (Array.isArray(t) && t.length) return t[t.length - 1]?.url || t[0]?.url || ''
  return ''
}

function buildText(query, videos) {
  const head = `「✦」Resultados de la busqueda para *${esc(query)}*`
  if (!videos?.length) return `${head}\n\n「✦」Sin resultados.`

  const body = videos
    .map(v => {
      const title = esc(v?.title || 'Sin título')
      const channel = esc(v?.author?.name || v?.author || 'Desconocido')
      const duration = esc(v?.timestamp || v?.duration?.timestamp || v?.duration || '—')
      const views = v?.views != null ? fmtNum(v.views) : ''
      const ago = esc(v?.ago || '')
      const descRaw = v?.description || v?.descriptionShort || ''
      const desc = esc(descRaw ? (descRaw.length > 120 ? descRaw.slice(0, 120) + '…' : descRaw) : '')
      const link = v?.url || (v?.videoId ? `https://youtu.be/${v.videoId}` : '')
      const thumb = esc(pickThumb(v))

      const extra =
        (views ? `\n> ꕥ Vistas » *${views}*` : '') +
        (ago ? `\n> ❏ Publicado » *${ago}*` : '') +
        (thumb ? `\n> ❍ Miniatura » _${thumb}_` : '') +
        (desc ? `\n> ✿ Desc » ${desc}` : '')

      return `❀ *${title}*\n> ✐ Canal » *${channel}*\n> ⴵ Duración » *${duration}*${extra}\n> 🜸 Link » _${link}_`
    })
    .join('\n\n')

  return `${head}\n\n${body}`
}

let handler = async (m, { conn, text }) => {
  const from = m.key.remoteJid
  const q = (text || '').trim()

  if (!q) {
    return await conn.sendMessage(
      from,
      { text: '「✦」Escribe algo para buscar.\n> ✐ Ej: *.yt Larin y las servilletas*' },
      { quoted: m }
    )
  }

  try {
    const r = await yts(q)
    const videos = (r?.videos || []).slice(0, 10)

    if (!videos.length) {
      return await conn.sendMessage(from, { text: `「✦」Resultados de la busqueda para *${esc(q)}*\n\n「✦」Sin resultados.` }, { quoted: m })
    }

    const firstThumb = pickThumb(videos[0])
    const msg = buildText(q, videos)

    if (firstThumb) {
      await conn.sendMessage(
        from,
        {
          image: { url: firstThumb },
          caption: msg
        },
        { quoted: m }
      )
    } else {
      await conn.sendMessage(from, { text: msg }, { quoted: m })
    }
  } catch (e) {
    console.error(e)
    await conn.sendMessage(
      from,
      { text: '「✦」Error buscando en YouTube.' },
      { quoted: m }
    )
  }
}

handler.help = ['yt <texto>']
handler.tags = ['search']
handler.command = ['yt', 'youtube', 'yts', 'yt-search', 'ytsearch']

export default handler