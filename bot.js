const { default: makeWASocket, useMultiFileAuthState, DisconnectReason } = require('@whiskeysockets/baileys')
const express = require('express')
const fs = require('fs')
const OpenAI = require('openai')
const app = express()

// تعديل 1: عشان Render يفضل شايفه شغال 24 ساعة
app.get('/', (req,res)=>res.send('AHMED HELMY AI BOT Running!'))
app.listen(process.env.PORT || 3000, ()=>console.log('Server Started'))

const OWNER_JID = '201285598027@s.whatsapp.net'
let warnings = fs.existsSync('./warnings.json') ? JSON.parse(fs.readFileSync('./warnings.json')) : {}
let talkingMode = {}
let chatHistory = {}
function saveWarnings(){ try{ fs.writeFileSync('./warnings.json', JSON.stringify(warnings)) }catch(e){} }

const openai = process.env.OPENAI_API_KEY ? new OpenAI({ apiKey: process.env.OPENAI_API_KEY, baseURL: process.env.OPENAI_API_KEY.startsWith('gsk_') ? 'https://api.groq.com/openai/v1' : undefined }) : null

const badWords = ['كسمك','كس امك','كس','خول','عرص','متناك','شرموطة','شرموط','لبوة','مومس','منيوك','نيك','احا','كسم','fuck','fucking','bitch','shit','asshole','pussy','dick','bastard','whore','زبي','زبه','طيز','خرا','زق','عرصه','قحبه','عرصه','متناكه','شرموطه']

async function askAI(prompt, groupId){
    if(!openai) return '⚠️ يا مالكي Ahmed ضيف مفتاح OPENAI_API_KEY في Render > Environment عشان اشغل مخي 🧠'
    if(!chatHistory[groupId]) chatHistory[groupId] = []
    chatHistory[groupId].push({role:"user", content:prompt})
    if(chatHistory[groupId].length > 12) chatHistory[groupId].shift()
    try{
        const model = process.env.OPENAI_API_KEY.startsWith('gsk_') ? "llama3-8b-8192" : "gpt-4o-mini"
        const res = await openai.chat.completions.create({
            model: model,
            messages: [
                {role:"system", content: `انت بوت اسمه MAX من صنع Ahmed Helmy. انت مشرف جروب المعهد العربي للعلوم اللاسلكي. بتتكلم عامية مصرية اصلية بتاعة كل المحافظات: صعيدي اسيوط، اسكندراني، قاهري، فلاحي. جدع وبتحب تهزر وذكي جدا. بتجاوب على اي سؤال، بتترجم، بتشرح دروس، بتقول نكت. لو حد سألك انت مين قول: أنا بوت من صنع مالكي Ahmed Helmy ❤️ وتحت أمرك في أي سؤال؟ ردودك قصيرة ومصرية.`},
                ...chatHistory[groupId]
            ]
        })
        const reply = res.choices[0].message.content
        chatHistory[groupId].push({role:"assistant", content:reply})
        return reply
    }catch(e){ console.log(e); return 'النت مهنج عندي ثانية وجرب تاني 😅' }
}

async function startBot() {
    const { state, saveCreds } = await useMultiFileAuthState('auth')
    const sock = makeWASocket({ auth: state, printQRInTerminal: true })
    sock.ev.on('creds.update', saveCreds)
    sock.ev.on('connection.update', (u) => { 
        if(u.connection==='close' && u.lastDisconnect?.error?.output?.statusCode !== DisconnectReason.loggedOut) startBot()
        if(u.connection==='open') console.log('✅ Connected - 24h Mode ON')
    })
    sock.ev.on('messages.upsert', async ({ messages }) => {
        const msg = messages[0]; if(!msg.message || msg.key.fromMe) return
        const from = msg.key.remoteJid; const isGroup = from.endsWith('@g.us'); const sender = msg.key.participant || from
        const isOwner = sender === OWNER_JID || from === OWNER_JID
        const text = (msg.message.conversation || msg.message.extendedTextMessage?.text || "").trim(); const lower = text.toLowerCase()
        if(isGroup && badWords.some(w => lower.includes(w)) && !isOwner){
            if(!warnings[from]) warnings[from]={}; if(!warnings[from][sender]) warnings[from][sender]=0
            warnings[from][sender]++; saveWarnings()
            if(warnings[from][sender]>=5){
                await sock.sendMessage(from,{text:`🚫 تم طرد @${sender.split('@')[0]} بعد 5 تحذيرات - جروب المعهد محترم`,mentions:[sender]})
                try{ await sock.groupParticipantsUpdate(from,[sender],'remove') }catch(e){ await sock.sendMessage(from,{text:'اديني ادمن عشان اعرف اطرده!'}) }
                warnings[from][sender]=0; saveWarnings()
            }else{
                await sock.sendMessage(from,{text:`⚠️ يا محترم @${sender.split('@')[0]} بلاش شتايم، تحذير ${warnings[from][sender]}/5`,mentions:[sender]},{quoted:msg})
            }
            return
        }
        if(isOwner){
            if(lower.includes('اقفل الجروب')){ await sock.groupSettingUpdate(from,'announcement'); await sock.sendMessage(from,{text:'🔒 الجروب اتقفل بأمر من مالكي Ahmed Helmy 👑'}); return }
            if(lower.includes('افتح الجروب')){ await sock.groupSettingUpdate(from,'not_announcement'); await sock.sendMessage(from,{text:'🔓 الجروب اتفتح بأمر من مالكي Ahmed Helmy 👑'}); return }
            if(lower === 'اتكلم' || lower.includes('اتكلم معانا')){ talkingMode[from]=true; await sock.sendMessage(from,{text:'تمام يا كبير شغلت وضع التفاعل 😎'}); return }
            if(lower === 'اسكت' || lower.includes('اسكت يا بوت')){ talkingMode[from]=false; chatHistory[from]=[]; await sock.sendMessage(from,{text:'تمام سكت 🤫'}); return }
        }
        if(lower.includes('السلام عليكم') || /س+م+و+.*ع+ل+ي+ك+و+/.test(lower) || lower.includes('سمو عليكو') || lower.includes('سلامو عليكو')){ await sock.sendMessage(from,{text:'وعليكم السلام ورحمة الله وبركاتة ❤️🤍'},{quoted:msg}); return }
        if(lower.includes('انت مين') || lower.includes('مين انت')){ await sock.sendMessage(from,{text:'أنا بوت من صنع مالكي Ahmed Helmy ❤️\nوتحت أمرك في أي سؤال؟ 🤖'},{quoted:msg}); return }
        const shouldReply = lower.startsWith('ai') || lower.startsWith('بوت') || lower.startsWith('يا بوت') || talkingMode[from]
        if(shouldReply){
            let query = text.replace(/^(ai|بوت|يا بوت)\s*/i,'').trim()
            if(talkingMode[from] && !lower.startsWith('ai') && !lower.startsWith('بوت') && !lower.startsWith('يا بوت')) query = text
            if(!query) { await sock.sendMessage(from,{text:'نعم يا غالي؟ 😎'},{quoted:msg}); return }
            if(talkingMode[from] && !text.toLowerCase().startsWith('ai') && !text.toLowerCase().startsWith('بوت') && !text.toLowerCase().startsWith('يا بوت') && Math.random() > 0.75) return
            await sock.sendMessage(from,{text:'ثواني بفكر... 🤔'})
            const aiReply = await askAI(query, from)
            await sock.sendMessage(from,{text:aiReply},{quoted:msg})
        }
    })
}
startBot()
