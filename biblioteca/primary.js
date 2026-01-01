import fs from 'fs'

const PRIMARY_PATH = './biblioteca/primary.json'

const defaultState = {
  globalKey: '',
  byChat: {}
}

function normalizeKey(key = '') {
  const k = String(key || '').trim()
  if (!k) return ''
  if (k === 'main') return 'main'
  if (/^subbot:[0-9]{4,20}$/i.test(k)) return `subbot:${k.split(':')[1]}`
  return ''
}

function loadPrimary() {
  if (!fs.existsSync(PRIMARY_PATH)) return { ...defaultState }
  try {
    const raw = fs.readFileSync(PRIMARY_PATH, 'utf8')
    const data = JSON.parse(raw || '{}')

    
    if (typeof data?.key === 'string' && data?.byChat === undefined) {
      const legacy = normalizeKey(data.key)
      return { globalKey: legacy, byChat: {} }
    }

    const globalKey = normalizeKey(data?.globalKey || data?.key || '')
    const byChat = {}
    const src = data?.byChat && typeof data.byChat === 'object' ? data.byChat : {}
    for (const [chatId, key] of Object.entries(src)) {
      const k = normalizeKey(key)
      if (chatId && typeof chatId === 'string') byChat[chatId] = k
    }

    return { globalKey, byChat }
  } catch {
    return { ...defaultState }
  }
}

function savePrimary(state) {
  try {
    fs.writeFileSync(PRIMARY_PATH, JSON.stringify(state, null, 2))
  } catch (e) {
    console.error('[primary] No se pudo guardar primary.json', e)
  }
}

function getPrimaryKey(chatId = '') {
  const s = loadPrimary()
  const cid = String(chatId || '').trim()
  if (cid) {
    const k = normalizeKey(s.byChat?.[cid] || '')
    return k
  }
  return normalizeKey(s.globalKey || '')
}

function setPrimaryKey(key = '') {
  
  const k = normalizeKey(key)
  if (!k) return false
  const s = loadPrimary()
  savePrimary({ ...s, globalKey: k })
  return true
}

function clearPrimary() {
  const s = loadPrimary()
  savePrimary({ ...s, globalKey: '' })
  return true
}

function setPrimaryForChat(chatId = '', key = '') {
  const cid = String(chatId || '').trim()
  if (!cid) return false
  const k = normalizeKey(key)
  if (!k) return false
  const s = loadPrimary()
  const byChat = { ...(s.byChat || {}) }
  byChat[cid] = k
  savePrimary({ ...s, byChat })
  return true
}

function clearPrimaryForChat(chatId = '') {
  const cid = String(chatId || '').trim()
  if (!cid) return false
  const s = loadPrimary()
  const byChat = { ...(s.byChat || {}) }
  delete byChat[cid]
  savePrimary({ ...s, byChat })
  return true
}

function getSessionKey(conn) {
  try {
    if (conn?.isSubBot) {
      const id = String(conn?.subbotId || '').trim()
      return id ? `subbot:${id}` : 'subbot:unknown'
    }
  } catch {}
  return 'main'
}

export {
  getPrimaryKey,
  setPrimaryKey,
  clearPrimary,
  setPrimaryForChat,
  clearPrimaryForChat,
  getSessionKey
}
