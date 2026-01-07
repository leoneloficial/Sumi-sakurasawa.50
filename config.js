const config = {
  nombrebot: '🤍 sumi sakurasawa 🤍',
  moneda: '$ᴅᴏʟᴀʀᴇs',
  apikey: 'Leonelkey22a5tm9999', // Pon tu apikey aqui, consiguela en: https://api-adonix.ultraplus.click
  prefijo: '.',

  owner: [
    '156981591593126@lid',
    '393715279301@s.whatsapp.net',
    '393715279301@s.whatsapp.net'
  ],

  restrict: false
}

try {
  if (!globalThis.nombrebot) globalThis.nombrebot = config.nombrebot
  if (!globalThis.moneda) globalThis.moneda = config.moneda
  if (!globalThis.prefijo) globalThis.prefijo = config.prefijo
  if (!globalThis.apikey) globalThis.apikey = config.apikey
} catch {}

export default config
