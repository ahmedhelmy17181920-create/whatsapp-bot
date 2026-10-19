const { default: makeWASocket, useMultiFileAuthState, DisconnectReason } = require('@whiskeysockets/baileys')
const express = require('express')
const cron = require('node-cron')
const fs = require('fs')
const axios = require('axios')
const qrcode = require('qrcode')
const app = express()

let lastQR = null
let isConnected = false

// صفحات الويب لـ UptimeRobot
app.get('/', async (req, res) => {
  if (isConnected) {
    return res.send('<h1>Bot Connected ✅ - addicted ahmed Ai MAX</h1><p>شغال تمام يا معلمي ❤️</p>')
  }
  if (!lastQR) {
    return res.send('<h1>Bot Running - addicted ahmed Ai MAX</h1><p>Waiting for QR... اعمل ريفريش بعد 5 ثواني</p><script>setTimeout(()=>location.reload(),5000)</script>')
  }
  const qrImage = await qrcode.toDataURL(lastQR)
  res.send(`<h1>Scan QR - addicted ahmed Ai MAX</h1><img src="${qrImage}" style="width:350px;border:10px solid #000"/><br><p>واتساب > الاعدادات > الاجهزة المرتبطة > ربط جهاز</p><p>الـ QR بيتغير كل 30 ثانية اعمل ريفريش</p><script>setTimeout(()=>location.reload(),25000)</script>`)
})

// ده المهم لـ UptimeRobot
app.get('/health', (req, res) => {
  res.status(200).send('OK - Bot is alive')
})

const PORT = process.env.PORT || 3000
app.listen(PORT, () => console.log("Server running on port " + PORT))

const OWNER_NUMBER = '201285598027@s.whatsapp.net'
const OWNER_NAME = 'يا استاذ احمد يا معلمي'

let warnings = {}
try { warnings = JSON.parse(fs.readFileSync('./warnings.json')) } catch {}
const saveWarnings = () => fs.writeFileSync('./warnings.json', JSON.stringify(warnings))

const badWords = ['كسم','كس','خول','عرص','متناك','شرموط','عر$','يخربيتك','fuck','bitch','shit']
const urlRegex = /(https?:\/\/[^\s]+|www\.[^\s]+)/gi

async function checkLinkSafety(url) {
    if(!url.startsWith('http')) url = 'https://' + url
    let result = { safe: true, reason: 'آمن ✅', risk: 0 }
    try {
        const gKey = process.env.GOOGLE_SAFE_KEY
        if(gKey) {
            const gRes = await axios.post(`https://safebrowsing.googleapis.com/v4/threatMatches:find?key=${gKey}`, {
                client: { clientId: "ahmed-bot", clientVersion: "1.0" },
                threatInfo: { threatTypes: ["MALWARE","SOCIAL_ENGINEERING","UNWANTED_SOFTWARE"], platformTypes: ["ANY_PLATFORM"], threatEntryTypes: ["URL"], threatEntries: [{url}] }
            })
            if(gRes.data.matches) return { safe:false, reason:'خطر! جوجل مصنفه تصيد/فيروس', risk:100 }
        }
        const suspicious = ['bit.ly','tinyurl','free-money','giveaway','login-secure','verify-account','crypto-double','earn-fast']
        if(suspicious.some(s=> url.toLowerCase().includes(s))) result = { safe:false, reason:'لينك مختصر/مشبوه احتمال تصيد', risk:85 }
        try { const h = await axios.head(url, { timeout:5000, validateStatus:()=>true }); if(h.status>=400) result = { safe:false, reason:`الموقع مش شغال (${h.status})`, risk:60 } } catch {}
    } catch(e){}
    return result
}

async function aiReply(prompt, senderName, isOwner) {
    const apiKey = process.env.OPENAI_API_KEY
    if(!apiKey) return `يا ${senderName}، عشان أوصل MAX محتاج مفتاح OpenAI في Render. سؤالك: "${prompt}" - اقدر اترجم، اشرح، الخص، قولي عايز ايه؟`
    try {
        const r = await axios.post('https://api.openai.com/v1/chat/completions',{
            model:'gpt-4o',
            messages:[
                {role:'system', content:`انت addicted ahmed Ai Bot MAX. بتتكلم مصري عامي 100% روش. صاحبك احمد تقوله يا استاذ احمد يا معلمي. باقي الناس باسمهم. انت بوت المعهد العربي للعلوم اللاسلكي وتكنولوجيا الاتصالات. خبير ترجمة، شرح مواد، تلخيص، فحص لينكات، نكت، حكم.`},
                {role:'user', content:prompt}
            ],
            temperature:0.85, max_tokens:900
        },{headers:{Authorization:`Bearer ${apiKey}`}})
        return r.data.choices[0].message.content
    } catch { return 'الـ AI مهنج ثانية يا معلمي جرب تاني ❤️' }
}

async function startBot() {
    const { state, saveCreds } = await useMultiFileAuthState('auth')
    const sock = makeWASocket({ 
        auth: state, 
        printQRInTerminal: false,
        browser: ["Ahmed MAX", "Chrome", "1.0"]
    })
    sock.ev.on('creds.update', saveCreds)
    sock.ev.on('connection.update', (u) => { 
        if(u.qr) { lastQR = u.qr; console.log("QR Generated") }
        if(u.connection === 'open') { isConnected = true; lastQR = null; console.log("✅ Connected!") }
        if(u.connection==='close' && u.lastDisconnect?.error?.output?.statusCode !== DisconnectReason.loggedOut) startBot() 
    })

    sock.ev.on('messages.upsert', async ({ messages }) => {
        const msg = messages[0]
        if(!msg.message || msg.key.fromMe) return
        const from = msg.key.remoteJid
        const isGroup = from.endsWith('@g.us')
        const sender = msg.key.participant || from
        const pushName = msg.pushName || 'يا غالي'
        const isOwner = sender === OWNER_NUMBER
        const displayName = isOwner ? OWNER_NAME : pushName
        const text = (msg.message.conversation || msg.message.extendedTextMessage?.text || msg.message.imageMessage?.caption || "").trim()
        const lower = text.toLowerCase()
        if(!text) return

        const urls = text.match(urlRegex)
        if(urls && isGroup) {
            for(let u of urls) {
                const check = await checkLinkSafety(u)
                if(!check.safe) {
                    await sock.sendMessage(from, { text:`🚨 *لينك خطر!*\n👤 @${sender.split('@')[0]}\n🔗 ${u}\n⚠️ ${check.reason}\n📊 خطر ${check.risk}%`, mentions:[sender] }, {quoted:msg})
                    if(check.risk>=80 && !isOwner) { try{ await sock.sendMessage(from,{delete:msg.key}) }catch{} }
                } else if(lower.includes('افحص') || lower.includes('امان')) {
                    await sock.sendMessage(from, { text:`✅ آمن يا ${displayName}\n🔗 ${u}\n${check.reason}` }, {quoted:msg})
                }
            }
        }

        if(isGroup && badWords.some(w=> lower.includes(w))) {
            if(!warnings[from]) warnings[from]={}
            warnings[from][sender]=(warnings[from][sender]||0)+1; saveWarnings()
            let c=warnings[from][sender]
            if(c>=5){ await sock.sendMessage(from,{text:`🚫 @${sender.split('@')[0]} اتطرد بعد 5 تحذيرات`,mentions:[sender]}); try{await sock.groupParticipantsUpdate(from,[sender],'remove')}catch{}; warnings[from][sender]=0; saveWarnings() }
            else await sock.sendMessage(from,{text:`⚠️ مينفعش كده ده جروب محترم بلاش شتايم يا محترم @${sender.split('@')[0]}\nتحذير ${c}/5`,mentions:[sender]},{quoted:msg})
            return
        }

        if(['السلام عليكم','سلام عليكم'].some(s=>lower.includes(s))) { await sock.sendMessage(from,{text:`وعليكم السلام ورحمة الله وبركاتة ✨❤ ${displayName}`},{quoted:msg}); return }
        if(/س+م+و+.*ع+ل+ي+ك+و+/i.test(lower)) { await sock.sendMessage(from,{text:`وعليكم السلام ${displayName} ❤️`},{quoted:msg}); return }
        if(lower==='صباح الخير' || lower==='مساء الخير') { await sock.sendMessage(from,{text:`${lower==='صباح الخير'?'صباح':'مساء'} العسل ${displayName} ❤️`},{quoted:msg}); return }
        if(lower.includes('مين انت')) { await sock.sendMessage(from,{text: isOwner ? `أنا خدامك ${OWNER_NAME} ❤️\nI am addicted ahmed Ai Bot MAX 🤖\nبوت المعهد العربي للعلوم الاسلكي وتكنولوجيا الاتصالات` : `أهلا ${displayName} ❤️ أنا بوت المعهد MAX`},{quoted:msg}); return }

        if(lower.startsWith('يا بوت') || lower==='بوت' || lower.startsWith('بوت اسأل') || lower.includes('ai') || lower.startsWith('ترجم') || lower.startsWith('اشرح') || lower.startsWith('لخص') || lower.startsWith('نكتة') || lower.startsWith('حكمه')) {
            let q = text.replace(/يا بوت|بوت اسأل|بوت|ai|ترجم|اشرح|لخص/gi,'').trim() || text
            if(lower.startsWith('يا بوت') && isOwner) await sock.sendMessage(from,{text:`نعم ${OWNER_NAME} يا معلمي ❤️`},{quoted:msg})
            let ans = await aiReply(q || text, displayName, isOwner)
            await sock.sendMessage(from,{text:ans},{quoted:msg}); return
        }

        if(isOwner) {
            const mentioned = msg.message.extendedTextMessage?.contextInfo?.mentionedJid || []
            if(lower.startsWith('اطرد') && mentioned.length){ await sock.groupParticipantsUpdate(from,mentioned,'remove'); await sock.sendMessage(from,{text:`✅ تم بأمر ${OWNER_NAME}`}); return }
            if(lower.includes('اقفل الجروب')||lower==='اقفل'){ if(isGroup){await sock.groupSettingUpdate(from,'announcement'); await sock.sendMessage(from,{text:`🔒 حاضر ${OWNER_NAME} اتقفل`})} return }
            if(lower.includes('افتح الجروب')||lower==='افتح'){ if(isGroup){await sock.groupSettingUpdate(from,'not_announcement'); await sock.sendMessage(from,{text:`🔓 حاضر ${OWNER_NAME} اتفتح`})} return }
            let m = text.match(/اقفل الساعه (\d+).*افتح (\d+)/i); if(m){ cron.schedule(`0 ${m[1]} * * *`, ()=> sock.groupSettingUpdate(from,'announcement')); cron.schedule(`0 ${m[2]} * * *`, ()=> sock.groupSettingUpdate(from,'not_announcement')); await sock.sendMessage(from,{text:`تمام يا معلمي هقفل ${m[1]} وافتح ${m[2]}`}); return }
            if(lower==='منشن' || lower==='الجميع'){ const meta=await sock.groupMetadata(from); let txt=`📢 ${OWNER_NAME}:\n`; let mm=[]; for(let p of meta.participants){mm.push(p.id); txt+=`@${p.id.split('@')[0]} `} await sock.sendMessage(from,{text:txt,mentions:mm}); return }
            if(lower.includes('امسح التحذيرات')){ warnings[from]={}; saveWarnings(); await sock.sendMessage(from,{text:`✅ اتمسحت يا معلمي`}); return }
        }

        if(lower==='الاوامر' || lower==='اوامر'){
            await sock.sendMessage(from,{text:`📜 *MAX AI BOT - ${isOwner?OWNER_NAME:displayName}*\n\n*للكل:*\nسلام / سموو عليكووو\nيا بوت + سؤالك (ذكاء خارق مصري)\nترجم / اشرح / لخص / نكته / حكمه\nافحص اللينك + الرابط (أمان)\n\n*حماية:*\n🛡️ فحص لينكات تلقائي\n⚠️ شتايم 5=طرد\n\n*ليك انت بس يا ${OWNER_NAME}:*\nاقفل/افتح - اطرد @ - منشن\nاقفل الساعه 7 افتح 8\nامسح التحذيرات`},{quoted:msg})
        }
    })
}
startBot()
