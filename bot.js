const { default: makeWASocket, useMultiFileAuthState, DisconnectReason } = require('@whiskeysockets/baileys')
const qrcode = require('qrcode-terminal')
const P = require('pino')

async function start() {
    const { state, saveCreds } = await useMultiFileAuthState('auth')
    const sock = makeWASocket({
        auth: state,
        logger: P({ level: 'silent' }),
        printQRInTerminal: true,
        browser: ['Hamo Bot', 'Chrome', '1.0']
    })

    sock.ev.on('creds.update', saveCreds)

    sock.ev.on('connection.update', async (update) => {
        const { connection, lastDisconnect, qr } = update
        if(qr) {
            console.log('=== QR CODE HAMO ===')
            qrcode.generate(qr, {small: true})
            console.log('رابط الـ QR لو مش ظاهر المربع:')
            console.log(`https://api.qrserver.com/v1/create-qr-code/?size=300x300&data=${encodeURIComponent(qr)}`)
            console.log('انسخ الرابط ده وافتحه في المتصفح وصوره بواتساب')
        }
        if(connection === 'close') {
            const shouldReconnect = lastDisconnect?.error?.output?.statusCode !== DisconnectReason.loggedOut
            if(shouldReconnect) start()
        } else if(connection === 'open') {
            console.log('حمو رجع يا وحوش 😈🔥')
        }
    })

    // هنا أوامر حمو
    sock.ev.on('messages.upsert', async m => {
        const msg = m.messages[0]
        if(!msg.message || msg.key.fromMe) return
        const text = msg.message.conversation || msg.message.extendedTextMessage?.text || ''
        const from = msg.key.remoteJid
        
        if(text === '!حمو' || text === '.حمو') {
            await sock.sendMessage(from, {text: 'حمو رجع يا وحوش 😈🔥 شغال 24 ساعة يا زعيم 👑'})
        }
    })
}
start()
