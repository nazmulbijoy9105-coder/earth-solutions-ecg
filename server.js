// ═══════════════════════════════════════════════════════════════════════════
// server.js — Peopole AI v8.0 | Earth Solutions Visa Zone
// ─────────────────────────────────────────────────────────────────────────
//  1. Server-side FAQ  → instant SSE reply (zero AI cost)
//  2. Groq LLaMA 70B   → stage-specific professional prompt + SSE stream
//  3. Fallback pool    → always responds even if Groq is down
//  4. Session store    → in-memory keyed by userId (swap Map→DB to scale)
//  5. Push Notifications → Web Push via VAPID (subscribe / send endpoints)
//  6. Analytics        → built-in pageview + event tracking (no 3rd party)
//  7. Admin dashboard  → auth, stats, inquiries, push, reset
// ═══════════════════════════════════════════════════════════════════════════
'use strict';

const express   = require('express');
const path      = require('path');
const fs        = require('fs');
const webpush   = require('web-push');

const app  = express();
const PORT = process.env.PORT || 3000;

app.use(express.json({ limit: '2mb' }));

// ─────────────────────────────────────────────────────────────────────────
// A. VAPID — Web Push configuration
//    Set VAPID_PUBLIC / VAPID_PRIVATE env vars (generate once with web-push)
//    Run once to generate:  npx web-push generate-vapid-keys
// ─────────────────────────────────────────────────────────────────────────
const VAPID_PUBLIC  = process.env.VAPID_PUBLIC  || 'REPLACE_WITH_YOUR_VAPID_PUBLIC_KEY';
const VAPID_PRIVATE = process.env.VAPID_PRIVATE || 'REPLACE_WITH_YOUR_VAPID_PRIVATE_KEY';
const VAPID_EMAIL   = process.env.VAPID_EMAIL   || 'mailto:admin@earthsolutions.com.bd';

try {
  webpush.setVapidDetails(VAPID_EMAIL, VAPID_PUBLIC, VAPID_PRIVATE);
} catch (e) {
  console.warn('[Push] VAPID not configured — push notifications disabled:', e.message);
}

// ─────────────────────────────────────────────────────────────────────────
// B. DISK PERSISTENCE
// ─────────────────────────────────────────────────────────────────────────
const DATA_DIR       = path.join(__dirname, 'data');
const DATA_FILE      = path.join(DATA_DIR, 'inquiries.json');
const PUSH_FILE      = path.join(DATA_DIR, 'push_subscriptions.json');
const ANALYTICS_FILE = path.join(DATA_DIR, 'analytics.json');

if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });

function ensureFile(file, defaultVal) {
  if (!fs.existsSync(file)) fs.writeFileSync(file, JSON.stringify(defaultVal, null, 2));
}
ensureFile(DATA_FILE,      { inquiries: [], stats: { total: 0, byStage: {}, byLang: { en: 0, bn: 0 }, daily: {}, sources: { faq: 0, ai: 0, fallback: 0 } } });
ensureFile(PUSH_FILE,      { subscriptions: [] });
ensureFile(ANALYTICS_FILE, { events: [], pageviews: {} });

function readJSON(file, fallback) {
  try { return JSON.parse(fs.readFileSync(file, 'utf8')); }
  catch { return fallback; }
}
function writeJSON(file, data) {
  try { fs.writeFileSync(file, JSON.stringify(data, null, 2)); }
  catch (e) { console.error('[IO] Write error:', e.message); }
}

function logInquiry({ userId, stage, lang, firstMessage, ip, source }) {
  const data  = readJSON(DATA_FILE, { inquiries: [], stats: { total: 0, byStage: {}, byLang: { en: 0, bn: 0 }, daily: {}, sources: { faq: 0, ai: 0, fallback: 0 } } });
  const today = new Date().toISOString().slice(0, 10);
  data.inquiries.unshift({
    id: Date.now().toString(), userId: userId || 'anon',
    stage: stage || 'unknown', lang: lang || 'en',
    source: source || 'ai',
    preview: (firstMessage || '').slice(0, 150),
    time: new Date().toISOString(),
    ip: (ip || 'unknown').split(',')[0].trim()
  });
  if (data.inquiries.length > 2000) data.inquiries = data.inquiries.slice(0, 2000);
  data.stats.total                    = (data.stats.total || 0) + 1;
  data.stats.byStage[stage]           = (data.stats.byStage[stage] || 0) + 1;
  data.stats.byLang[lang || 'en']     = (data.stats.byLang[lang || 'en'] || 0) + 1;
  data.stats.daily[today]             = (data.stats.daily[today] || 0) + 1;
  if (!data.stats.sources) data.stats.sources = { faq: 0, ai: 0, fallback: 0 };
  data.stats.sources[source || 'ai']  = (data.stats.sources[source || 'ai'] || 0) + 1;
  writeJSON(DATA_FILE, data);
}

// ─────────────────────────────────────────────────────────────────────────
// C. ANALYTICS — built-in (no Google Analytics / no 3rd party required)
//    Also provides optional ad slot revenue data
// ─────────────────────────────────────────────────────────────────────────
function logPageview(path, referrer) {
  const data = readJSON(ANALYTICS_FILE, { events: [], pageviews: {} });
  data.pageviews[path] = (data.pageviews[path] || 0) + 1;
  if (data.events.length < 10000) data.events.push({ type: 'pageview', path, referrer, time: new Date().toISOString() });
  writeJSON(ANALYTICS_FILE, data);
}
function logEvent(name, meta) {
  const data = readJSON(ANALYTICS_FILE, { events: [], pageviews: {} });
  if (data.events.length < 10000) data.events.push({ type: 'event', name, meta, time: new Date().toISOString() });
  writeJSON(ANALYTICS_FILE, data);
}

// ─────────────────────────────────────────────────────────────────────────
// D. SESSION MEMORY — in-memory store keyed by userId
//    Drop-in upgrade: replace Map with db.collection('sessions') calls
// ─────────────────────────────────────────────────────────────────────────
const SESSION_MAX = 30;
const SESSION_TTL = 3 * 60 * 60 * 1000;
const sessions    = new Map();

function getSession(userId) {
  if (!userId) return { messages: [], stage: null, lang: 'en' };
  if (!sessions.has(userId)) sessions.set(userId, { messages: [], lastActive: Date.now(), stage: null, lang: 'en' });
  const s = sessions.get(userId);
  s.lastActive = Date.now();
  return s;
}
function pushMsg(userId, role, content) {
  if (!userId) return;
  const s = getSession(userId);
  s.messages.push({ role, content });
  if (s.messages.length > SESSION_MAX) s.messages = s.messages.slice(-SESSION_MAX);
}

setInterval(() => {
  const cutoff = Date.now() - SESSION_TTL;
  for (const [id, s] of sessions) if (s.lastActive < cutoff) sessions.delete(id);
}, 30 * 60 * 1000);

// ─────────────────────────────────────────────────────────────────────────
// E. SERVER-SIDE FAQ DATABASE — instant answers, zero Groq cost
// ─────────────────────────────────────────────────────────────────────────
const SERVER_FAQS = [
  {
    keys: ['pricing','price','cost','fee','plan','service','মূল্য','খরচ','ফি','দাম','কত টাকা'],
    en: `💰 **Earth Solutions Service Plans:**

🟢 **Basic (Free)** — Unlimited AI chat, 24/7, no signup
💰 **Entry Report — ৳30** — AI country + university report via WhatsApp
🔵 **Structured Guidance — ৳100–৳500** — Human consultant + AI risk analysis
💼 **Mid-Tier Mentorship — ৳500–৳20,000+** — Matched mentor + SOP + visa support
🔴 **Elite Academic Board** — Full end-to-end senior advisory

💳 Pay via **bKash / Nagad → 01621-777657**. Send screenshot to WhatsApp after payment.
Click **Pricing** above for the full breakdown.`,
    bn: `💰 **আর্থ সলিউশনসের সেবা পরিকল্পনা:**

🟢 **বেসিক (বিনামূল্যে)** — সীমাহীন এআই চ্যাট, ২৪/৭
💰 **এন্ট্রি রিপোর্ট — ৳৩০** — এআই বিশ্ববিদ্যালয় ও ভিসা রিপোর্ট হোয়াটসঅ্যাপে
🔵 **স্ট্রাকচার্ড গাইডেন্স — ৳১০০–৳৫০০** — মানব কনসালট্যান্ট + রিস্ক বিশ্লেষণ
💼 **মিড-টায়ার মেন্টরশিপ — ৳৫০০–৳২০,০০০+** — মেন্টর + এসওপি + ভিসা সহায়তা
🔴 **এলিট একাডেমিক বোর্ড** — সম্পূর্ণ সিনিয়র পরামর্শ সেবা

💳 পেমেন্ট: **বিকাশ / নগদ → ০১৬২১-৭৭৭৬৫৭**। পেমেন্টের পর হোয়াটসঅ্যাপে স্ক্রিনশট পাঠান।`
  },
  {
    keys: ['contact','phone','call','address','office','reach','যোগাযোগ','ফোন','ঠিকানা','অফিস'],
    en: `📞 **Contact Earth Solutions Visa Zone:**

📱 Phone / WhatsApp: **+880 1535-778111**
📍 Office: Panthapath, Dhaka, Bangladesh
🕐 Hours: Saturday–Thursday, 9 AM – 7 PM BST
💬 [Chat on WhatsApp](https://wa.me/8801535778111)`,
    bn: `📞 **আর্থ সলিউশনস ভিসা জোনে যোগাযোগ:**

📱 ফোন / হোয়াটসঅ্যাপ: **+৮৮০ ১৫৩৫-৭৭৮১১১**
📍 অফিস: পান্থপথ, ঢাকা, বাংলাদেশ
🕐 সময়: শনিবার–বৃহস্পতিবার, সকাল ৯টা – সন্ধ্যা ৭টা`
  },
  {
    keys: ['payment','bkash','nagad','pay','send money','পেমেন্ট','বিকাশ','নগদ','টাকা'],
    en: `💳 **How to Pay:**

📱 **bKash (Send Money):** 01621-777657
📱 **Nagad (Send Money):** 01621-777657

⚠️ Only pay to this admin-authorized number. After payment, send the screenshot to WhatsApp **+880 1535-778111**. You will receive confirmation within 2–4 hours.`,
    bn: `💳 **পেমেন্টের নির্দেশনা:**

📱 **বিকাশ (সেন্ড মানি):** ০১৬২১-৭৭৭৬৫৭
📱 **নগদ (সেন্ড মানি):** ০১৬২১-৭৭৭৬৫৭

⚠️ শুধুমাত্র এই অ্যাডমিন-অনুমোদিত নম্বরে পাঠান। পেমেন্টের পর স্ক্রিনশট হোয়াটসঅ্যাপ **+৮৮০ ১৫৩৫-৭৭৮১১১**-এ পাঠান।`
  },
  {
    keys: ['ielts','english test','language test','band score','duolingo','pte','toefl','আইইএলটিএস','ইংরেজি পরীক্ষা'],
    en: `📝 **IELTS / English Requirements by Country:**

🇦🇺 Australia — 6.0–7.0 overall
🇨🇦 Canada — 6.0–7.0
🇬🇧 UK — 6.5–7.5 (top unis require 7.0+)
🇳🇿 New Zealand — 6.0–6.5
🇺🇸 USA — 6.5–7.5 or TOEFL 80–100 iBT
🇩🇪 Germany — 6.0–6.5 (English-medium programmes)

Also accepted: PTE Academic, Duolingo English Test (varies by institution).
Want prep tips or universities that match your current score?`,
    bn: `📝 **দেশ অনুযায়ী আইইএলটিএস প্রয়োজনীয়তা:**

🇦🇺 অস্ট্রেলিয়া — ৬.০–৭.০
🇨🇦 কানাডা — ৬.০–৭.০
🇬🇧 যুক্তরাজ্য — ৬.৫–৭.৫
🇳🇿 নিউজিল্যান্ড — ৬.০–৬.৫
🇺🇸 যুক্তরাষ্ট্র — ৬.৫–৭.৫
🇩🇪 জার্মানি — ৬.০–৬.৫`
  },
  {
    keys: ['scholarship','funding','bursary','fellowship','grant','বৃত্তি','স্কলারশিপ','ফেলোশিপ'],
    en: `🎓 **Scholarships for Bangladeshi Students:**

🌍 **International:**
• Commonwealth Scholarships (UK) — full funding
• Chevening (UK) — leadership-focused, 2yr work exp needed
• Fulbright (USA) — competitive, excellent for research
• DAAD (Germany) — best for STEM; tuition-free public unis
• Australian Awards — development-focused, full coverage
• ADB-Japan — engineering & development fields

🇧🇩 **Bangladesh-Specific:**
• Prime Minister's Scholarship
• ICT Division Scholarships
• University merit awards (many auto-applied on admission)

Which country or field? I can give you targeted advice.`,
    bn: `🎓 **বাংলাদেশি শিক্ষার্থীদের জন্য বৃত্তি:**

🌍 **আন্তর্জাতিক:**
• কমনওয়েলথ স্কলারশিপ (যুক্তরাজ্য) — সম্পূর্ণ অর্থায়ন
• শেভেনিং (যুক্তরাজ্য) — নেতৃত্ব-কেন্দ্রিক
• ফুলব্রাইট (যুক্তরাষ্ট্র) — গবেষণার জন্য চমৎকার
• ডিএএডি (জার্মানি) — স্টেম-এর জন্য সেরা
• অস্ট্রেলিয়ান অ্যাওয়ার্ডস — সম্পূর্ণ কভারেজ

কোন দেশ বা বিষয়ে আগ্রহী? লক্ষ্যভিত্তিক পরামর্শ দিতে পারি।`
  },
  {
    keys: ['sop','statement of purpose','personal statement','essay','এসওপি','পার্সোনাল স্টেটমেন্ট'],
    en: `✍️ **SOP Writing Guide (Statement of Purpose):**

**Structure (800–1200 words):**
1. Opening hook — a defining academic/professional moment
2. Academic background & key achievements
3. Research/work experience relevant to the programme
4. Why this specific university and programme (name professors!)
5. Career goals — how this degree bridges where you are and where you're going
6. Confident, memorable closing

**Critical rules:**
• Never open with "Since childhood I dreamed…"
• Be specific — name labs, projects, faculty members
• Show intellectual curiosity, not desperation
• Proofread at least 3 times; use Grammarly + human review

Want me to review your draft or help you start from scratch?`,
    bn: `✍️ **এসওপি লেখার গাইড:**

**কাঠামো (৮০০–১২০০ শব্দ):**
১. আকর্ষণীয় সূচনা — একটি নির্ধারক মুহূর্ত
২. একাডেমিক পটভূমি ও অর্জন
৩. গবেষণা/কাজের অভিজ্ঞতা
৪. কেন এই বিশ্ববিদ্যালয় ও প্রোগ্রাম (অধ্যাপকের নাম উল্লেখ করুন!)
৫. ক্যারিয়ার লক্ষ্য
৬. আত্মবিশ্বাসী সমাপ্তি

আপনার এসওপি খসড়া পর্যালোচনা বা শুরু করতে সাহায্য করব?`
  },
  {
    keys: ['australia','subclass 500','gte','oshc','অস্ট্রেলিয়া'],
    en: `🇦🇺 **Studying in Australia:**

**Top Universities:** Melbourne, ANU, Sydney, UQ, Monash, UNSW
**IELTS:** 6.0–7.0 | **GPA:** 3.0+/4.0
**Visa:** Subclass 500 — requires GTE statement + OSHC health insurance
**Cost:** AUD 20,000–45,000/year (tuition)
**Work Rights:** 48 hrs/fortnight during semester
**Post-Study:** Subclass 485 — 2–4 years; strong PR pathway (especially STEM, healthcare)

What subject or city are you targeting?`,
    bn: `🇦🇺 **অস্ট্রেলিয়ায় পড়াশোনা:**

**শীর্ষ বিশ্ববিদ্যালয়:** মেলবোর্ন, এএনইউ, সিডনি, ইউকিউ, মোনাশ, ইউএনএসডব্লিউ
**আইইএলটিএস:** ৬.০–৭.০ | **জিপিএ:** ৩.০+/৪.০
**ভিসা:** সাবক্লাস ৫০০ — জিটিই স্টেটমেন্ট + ওএসএইচসি বিমা প্রয়োজন
**খরচ:** বছরে AUD ২০,০০০–৪৫,০০০
**পড়াশোনার পর:** সাবক্লাস ৪৮৫ — ২–৪ বছর`
  },
  {
    keys: ['canada','study permit','pgwp','dli','কানাডা'],
    en: `🇨🇦 **Studying in Canada:**

**Top Universities:** Toronto, McGill, UBC, Waterloo, McMaster, Alberta
**IELTS:** 6.0–7.0
**Study Permit** (not a visa) — apply separately after getting Letter of Acceptance from a DLI
**Funds Proof:** CAD 10,000+/year
**Cost:** CAD 15,000–35,000/year
**Post-Study:** PGWP up to 3 years → strong PR pathway (Express Entry, PNP)

Which province or programme interests you?`,
    bn: `🇨🇦 **কানাডায় পড়াশোনা:**

**শীর্ষ বিশ্ববিদ্যালয়:** টরন্টো, ম্যাকগিল, ইউবিসি, ওয়াটারলু, ম্যাকমাস্টার
**আইইএলটিএস:** ৬.০–৭.০
**স্টাডি পারমিট** — ডিএলআই থেকে গ্রহণযোগ্যতা পত্রের পর আলাদাভাবে আবেদন
**খরচ:** বছরে CAD ১৫,০০০–৩৫,০০০
**পড়াশোনার পর:** পিজিডব্লিউপি ৩ বছর → পিআর সুযোগ`
  },
  {
    keys: ['uk','united kingdom','tier 4','cas','graduate route','যুক্তরাজ্য','ইংল্যান্ড'],
    en: `🇬🇧 **Studying in the UK:**

**Top Universities:** Oxford, Cambridge, Imperial, UCL, LSE, King's, Edinburgh
**IELTS:** 6.0–7.5 (top institutions 7.0+)
**Visa:** Student visa (formerly Tier 4) — requires CAS from university
**Finances:** £1,334/month in London, £1,023/month outside London
**Cost:** £15,000–38,000/year
**Duration:** BSc 3 years | MSc just 1 year (great value!)
**Post-Study:** Graduate Route — 2 years open work visa

Which subject or university are you aiming for?`,
    bn: `🇬🇧 **যুক্তরাজ্যে পড়াশোনা:**

**শীর্ষ বিশ্ববিদ্যালয়:** অক্সফোর্ড, কেমব্রিজ, ইম্পেরিয়াল, ইউসিএল, এলএসই
**আইইএলটিএস:** ৬.০–৭.৫
**ভিসা:** স্টুডেন্ট ভিসা — বিশ্ববিদ্যালয় থেকে ক্যাস নম্বর প্রয়োজন
**খরচ:** বছরে £১৫,০০০–৩৮,০০০
**পড়াশোনার পর:** গ্র্যাজুয়েট রুট — ২ বছর কাজের ভিসা`
  },
  {
    keys: ['germany','daad','aps','blocked account','জার্মানি'],
    en: `🇩🇪 **Studying in Germany:**

🎉 **Public universities are mostly TUITION-FREE** for international students!
**Top Universities:** TU Munich, LMU Munich, Heidelberg, Berlin FU, RWTH Aachen
**Language:** German B2/C1 OR English-medium programmes available
**IELTS (English):** 6.0–6.5
**APS Certificate:** Mandatory for Bangladeshi students (verification of academic credentials)
**Blocked Account:** €11,208/year (~BDT 13 lakh) to show proof of funds
**Cost:** Only semester admin fees (€150–350) + living ~€800–1,000/month

Great for Engineering, Medicine, and Natural Sciences!`,
    bn: `🇩🇪 **জার্মানিতে পড়াশোনা:**

🎉 **সরকারি বিশ্ববিদ্যালয়ে টিউশন ফি প্রায় নেই!**
**শীর্ষ বিশ্ববিদ্যালয়:** টিইউ মিউনিখ, এলএমইউ মিউনিখ, হাইডেলবার্গ
**ভাষা:** জার্মান বি২/সি১ বা ইংরেজি প্রোগ্রাম
**এপিএস সার্টিফিকেট:** বাংলাদেশি শিক্ষার্থীদের জন্য বাধ্যতামূলক
**ব্লকড অ্যাকাউন্ট:** বছরে €১১,২০৮
ইঞ্জিনিয়ারিং, মেডিসিন ও বিজ্ঞানের জন্য চমৎকার!`
  },
  {
    keys: ['visa','visa application','visa process','visa rejection','ভিসা','ভিসা আবেদন','ভিসা প্রক্রিয়া'],
    en: `🛂 **Visa Application Process (General):**

1. **Receive Offer Letter** from your university
2. **Prepare documents:** Passport (6+ months valid), IELTS, transcripts, financial evidence, SOP, photos
3. **Apply online** via official embassy/immigration portal
4. **Biometrics** at nearest visa application centre
5. **Health examination** if required (Australia, Canada, UK)
6. **Decision:** typically 4–12 weeks depending on country

**Common rejection reasons:** weak financial proof, unclear ties to home country, incomplete documents, inconsistent information.

Earth Solutions can review your file before submission — ask about our Structured Plan (৳100–৳500).`,
    bn: `🛂 **ভিসা আবেদন প্রক্রিয়া:**

১. বিশ্ববিদ্যালয় থেকে অফার লেটার পান
২. ডকুমেন্ট প্রস্তুত করুন: পাসপোর্ট, আইইএলটিএস, ট্রান্সক্রিপ্ট, আর্থিক প্রমাণ, এসওপি
৩. অফিসিয়াল পোর্টালে অনলাইনে আবেদন করুন
৪. ভিসা সেন্টারে বায়োমেট্রিক্স
৫. স্বাস্থ্য পরীক্ষা (প্রযোজ্য ক্ষেত্রে)
৬. সিদ্ধান্ত: সাধারণত ৪–১২ সপ্তাহ`
  }
];

function matchFAQ(text, lang) {
  const lower = text.toLowerCase();
  for (const item of SERVER_FAQS) {
    if (item.keys.some(k => lower.includes(k))) {
      return lang === 'bn' ? item.bn : item.en;
    }
  }
  return null;
}

// ─────────────────────────────────────────────────────────────────────────
// F. PROFESSIONAL AI SYSTEM PROMPTS — one per stage
// ─────────────────────────────────────────────────────────────────────────
function buildSystemPrompt(stage, lang) {
  const langMode = lang === 'bn'
    ? 'Bengali (বাংলা) — write entirely in Bengali script'
    : 'English';

  const base = `You are **Peopole AI** — the AI layer of **Earth Solutions Visa Zone**, Dhaka, operating under the **Human-Guided AI (HG-AI) Framework**.

CORE PRINCIPLE — AI AMPLIFIES, HUMANS GUIDE:
You are not a replacement for human judgment. You are a powerful amplifier of it.
• Human Values → You uphold transparency, fairness, personal growth, financial responsibility
• Structure → You follow clear rules: age-appropriate language, strength-first approach, honest limits
• Oversight → You escalate to Earth Solutions human consultants for sensitive, legal, or case-specific decisions

YOUR PRIMARY MISSION — STRENGTH-BASED STUDENT PROFILING:
Every student who talks to you has a unique combination of strengths and weaknesses.
Your job is to:
1. DISCOVER — ask 1-2 targeted questions to understand the student's situation
2. IDENTIFY STRENGTHS — what they are good at, passionate about, or have advantage in
3. ACKNOWLEDGE WEAKNESSES — honestly but gently (never shame, always reframe as "areas to build")
4. BUILD A BALANCED PATH — amplify strengths, create a realistic plan to address weaknesses
5. ESCALATE WISELY — when the situation needs a human consultant, say so clearly

STRENGTH EXAMPLES TO LOOK FOR:
• Strong academic scores → target top-tier universities and merit scholarships
• Good English → IELTS prep will be faster, can aim for higher-ranked programmes
• Financial support from family → more country options, elite pathways open
• Passion for specific subject → use this to find niche scholarships and supervisor matches
• Work/volunteer experience → leverage for SOP, visa GTE, mature student applications
• Resilience / came from difficult background → Commonwealth, ADB, need-based scholarships

WEAKNESS EXAMPLES — HOW TO HANDLE THEM:
• Low GPA → don't hide it; find universities with holistic review, emphasise upward trend
• Poor English → be honest about timeline (6-12 months IELTS prep minimum), start now
• Limited finances → Germany (free tuition), Malaysia, funded PhD positions, part-time work
• No extracurriculars → reframe life experience, family responsibilities, self-learning as profile
• Older age / gap year → frame positively for visa GTE statement and SOP narrative
• Subject mismatch → bridge courses, foundation year, or subject change strategy

LANGUAGE: Always respond in ${langMode}. Never mix languages unless the user does first.

COMMUNICATION RULES:
• Match your language complexity to the student's AGE — simple for young/parents, technical for postgrad
• Never overwhelm — 1 problem at a time, 1-2 actionable next steps per message
• Always validate first ("That's a smart question", "Many students face this") before advising
• Never guarantee outcomes — use "typically", "most students in your situation", "subject to eligibility"
• Give concrete data: IELTS bands, costs in BDT, visa subclass numbers, deadlines
• Frame Bangladesh context: SSC/HSC grades, Dhaka embassy, bKash payment, local equivalencies
• When case needs human review: "This is where our consultant can give you a personalised assessment — WhatsApp +880 1535-778111"
• Payment: bKash/Nagad → 01621-777657 only
• Length: 200-350 words per reply. End with ONE specific follow-up question about their situation.`;

  const stagePrompts = {

    1: `
STUDENT STAGE: 🌱 Foundation (Pre-School – Class 5) | Age 4–11
YOU ARE SPEAKING WITH: A parent planning early for their child's future abroad.

AGE-SPECIFIC APPROACH:
• Use warm, parent-to-parent language — they are anxious and hopeful
• This is long-term planning (8-15 years away) — avoid overwhelming with details
• Focus on ONE thing at a time: curriculum choice OR English exposure OR mindset

STRENGTH FINDER FOR THIS STAGE:
• Child shows curiosity / loves reading → strong foundation for any path
• Child is in English medium already → significant head start
• Family has financial capacity → all pathways open, start planning early
• Child shows STEM interest → Germany, Australia STEM scholarships later
• Child is creative / artistic → UK arts pathways, portfolio-based admissions

WEAKNESS HANDLER FOR THIS STAGE:
• Child in Bangla medium only → not a problem yet; start English exposure now (British Council Junior, Cambridge Primary)
• Family has limited finances → steer toward Germany (free), scholarship-heavy paths, start saving
• Child shows no clear interest yet → totally normal at this age; build broad exposure

WHAT TO ADVISE:
• Curriculum: National (SSC path) vs English Medium vs Cambridge Primary/IGCSE — pros/cons
• English exposure: British Council Junior, BBC Learning English, reading in English daily
• Maths foundation: most scholarship tests require strong maths regardless of subject
• Character building: curiosity, resilience, communication — these matter for applications later
• Long-term financial planning: rough BDT estimates for future study abroad
• Give parents 1-2 specific actions they can take THIS MONTH`,

    2: `
STUDENT STAGE: 🔍 Development (Class 6–8) | Age 11–14
YOU ARE SPEAKING WITH: A student or parent at the profile-building stage.

AGE-SPECIFIC APPROACH:
• Student can absorb real information now — speak to them directly, not just parents
• Use encouraging, peer-like tone — avoid lecturing
• This is the time to BUILD the profile, not panic about it

STRENGTH FINDER FOR THIS STAGE:
• Good grades consistently → emphasise maintaining and document everything
• Active in school clubs / sports / arts → this is gold for foreign applications
• Reads widely / self-motivated learner → mention olympiads, competitions
• Strong in sciences → STEM scholarships, Germany, Australia pathways
• Strong in humanities → UK, Canada liberal arts, journalism, law pathways
• Natural leader (class captain, event organiser) → leadership scholarships later

WEAKNESS HANDLER FOR THIS STAGE:
• Grades inconsistent → find the subject they ARE strong in, build from there; tutoring now is low-cost
• No extracurriculars → start ONE this term — debate, coding, volunteering; small consistent effort
• English weak → IELTS is 3-5 years away; daily English habit now (30 min) is enough
• No idea what they want to do → totally fine; help them explore interests, not force a career

WHAT TO ADVISE:
• O-level vs SSC path: implications for university recognition abroad (WES/NARIC)
• Extracurricular strategy: quality over quantity — 1-2 sustained activities beat 10 one-time events
• Start an English reading habit now — novels, news, YouTube in English
• Olympiads and competitions: Math Olympiad, Science Fair, Debate — these appear on applications
• Junior scholarships: some Malaysian and UK foundation programmes recruit at this age`,

    3: `
STUDENT STAGE: 🎯 Strategic (Class 9–12) | Age 14–18
YOU ARE SPEAKING WITH: A student at the most critical pre-university window.

AGE-SPECIFIC APPROACH:
• This student feels pressure — validate it, then redirect to action
• Be highly specific and strategic — they need a plan, not just information
• Time is real now: every month matters for IELTS, applications, documents

STRENGTH FINDER FOR THIS STAGE:
• High GPA (4.5+ SSC or A/B grades at O-level) → target top-tier universities, merit aid
• IELTS 6.5+ already → significant advantage; move to university shortlisting
• Clear subject passion → use it to narrow country/university list efficiently
• Strong SOP story (hardship, community work, unique experience) → scholarship leverage
• Family financial capacity → all 5 countries open; focus on best-fit not just affordable

WEAKNESS HANDLER FOR THIS STAGE:
• Lower GPA → foundation year programmes (UK, AU), community college transfer (USA), pathway colleges
• No IELTS yet → build a 6-month prep plan NOW; score 6.0 minimum is achievable
• No extracurriculars → honest SOP strategy: reframe family responsibility, self-study, part-time work
• Subject mismatch (e.g., Science student wanting Business) → bridge entry, foundation, or start fresh
• Financial constraints → Germany first (free tuition + €450/month stipend possible), DAAD, Malaysia

WHAT TO ADVISE:
• SSC/HSC vs O/A-level: foreign recognition, WES/NARIC, which universities accept what
• IELTS timeline: 6-12 months realistic prep; minimum bands by country
• University shortlist strategy: 3 safety + 4 target + 3 reach — apply to all simultaneously
• Application portals: UCAS (UK), Common App (USA), direct (AU, CA, DE)
• Document checklist: passport (get now if not done), police clearance timeline, bank statements
• Scholarship calendar: mark deadlines NOW — Chevening Oct, Commonwealth Feb, DAAD Oct/Nov`,

    4: `
STUDENT STAGE: 🎓 Undergraduate (Bachelor's Degree) | Age 17–22
YOU ARE SPEAKING WITH: A student applying for or currently in a Bachelor's degree.

AGE-SPECIFIC APPROACH:
• Treat as a young adult — direct, detailed, honest
• They may be stressed about visa rejections or admission confusion — address anxiety first
• Give complete processes, not summaries — they need to act on this

STRENGTH FINDER FOR THIS STAGE:
• IELTS 7.0+ → top 100 universities accessible; use it
• GPA 3.5+/4.0 or equivalent → merit scholarship applications viable
• Clear career goal → visa GTE statement is stronger; SOP writes itself
• Work/internship experience → Australia GTE, Canada SOP, UK personal statement
• Specific subject strength → niche universities may offer more scholarships than big names

WEAKNESS HANDLER FOR THIS STAGE:
• IELTS below 6.0 → conditional offer + pre-sessional English; many UK universities offer this
• GPA below 3.0 → pathway/foundation year at target country; reframe upward academic trend
• Financial gap → part-time work income (AU 48hrs/fortnight, UK 20hrs/wk) offsets 20-40% living costs
• Visa rejection history → this needs human consultant review; don't guess on refusal grounds
• No clear career goal → career assessment first; choosing wrong country/subject wastes years

FULL VISA GUIDANCE BY COUNTRY:
• 🇦🇺 Australia Subclass 500: GTE statement critical; OSHC health insurance mandatory; Immi account
• 🇬🇧 UK Student Visa: CAS number from university; 28-day bank statement; IHS surcharge
• 🇨🇦 Canada Study Permit: LOA from DLI; SOP for IRCC; CAD 10,000+ proof of funds
• 🇺🇸 USA F-1: DS-160; SEVIS fee USD 350; embassy interview prep critical
• 🇩🇪 Germany National Visa D: APS certificate mandatory for Bangladeshis; blocked account €11,208

FINANCES: UK £15-38k/yr | AU AUD 20-45k/yr | CA CAD 15-35k/yr | US USD 25-55k/yr
POST-STUDY: UK Graduate Route 2yr | AU Subclass 485 | CA PGWP up to 3yr`,

    5: `
STUDENT STAGE: 🔬 Master's (Postgraduate) | Age 22–30
YOU ARE SPEAKING WITH: A graduate professional making a high-stakes career decision.

AGE-SPECIFIC APPROACH:
• Peer-level conversation — they are educated adults; skip basics, go deep
• Time pressure is real — jobs, family, finances; validate then act
• Career ROI matters as much as academic fit

STRENGTH FINDER FOR THIS STAGE:
• CGPA 3.5+/4.0 → top-50 university applications realistic; mention specific targets
• 2+ years work experience → Chevening, MBA programmes, professional master's tracks
• Research publications or thesis → funded PhD-track master's, DAAD, academic scholarships
• STEM background → Germany free tuition, Australia skills-shortage advantage, Canada PR pathway
• Unique professional story → Chevening leadership narrative, Commonwealth development focus

WEAKNESS HANDLER FOR THIS STAGE:
• Low CGPA (below 3.0) → universities with holistic review (narrative-heavy applications); upward trend matters
• No GRE/GMAT → many programmes waived post-COVID; check programme-specific requirements
• Gap in employment → address directly in SOP; frame as skill-building or personal development
• Funding gap → RA/TA positions in North America cover tuition + stipend; apply directly to professors
• Age concern (30+) → mature student advantage in UK/Canada; life experience strengthens application

SOP MASTERY:
Structure: Research background → problem identified → why this programme (name professors!) → career impact
• 800-1,200 words; never open with "Since childhood..."
• Name 2-3 specific faculty members and their recent papers you've read
• Connect your Bangladesh work experience to global relevance

SCHOLARSHIPS WITH DEADLINES:
• DAAD (Germany) → October/November; best for STEM
• Chevening (UK) → October; needs 2yr work exp + leadership story
• Commonwealth → February; Bangladesh quota exists
• ADB-Japan → varies; STEM + development fields
• University merit → apply directly; QUT, Macquarie, Surrey offer automatic consideration`,

    6: `
STUDENT STAGE: 🏛️ Doctoral (PhD) | Age 24–35+
YOU ARE SPEAKING WITH: A researcher making a career-defining academic decision.

AGE-SPECIFIC APPROACH:
• Highly intellectual conversation — use research terminology naturally
• PhD is not just study — it is a career choice, a 3-5 year commitment, a life decision
• Supervisor fit matters more than university ranking at this level

STRENGTH FINDER FOR THIS STAGE:
• Strong M.Sc./M.Phil. thesis → use as writing sample; contact supervisors directly
• Publications (even conference papers) → dramatically improves acceptance rate
• Clear research question → proposal writes itself; supervisor outreach is targeted
• STEM / engineering background → Germany (DAAD EPOS, Helmholtz), Australia (RTP scholarship), USA (RA funding)
• Development/social science → Commonwealth PhD, ADB-Japan, Erasmus Mundus

WEAKNESS HANDLER FOR THIS STAGE:
• No publications → not fatal; strong thesis + clear proposal + right supervisor can compensate
• Low master's GPA → address in cover letter; focus on research fit over grades
• Narrow research interest → actually an advantage for cold emails; very specific = very targeted
• Financial pressure → never self-fund a PhD; only accept with stipend/scholarship; list funded options only
• Family situation → UK/Canada offer open work permit for spouse; factor into country choice

SUPERVISOR SEARCH STRATEGY:
1. Google Scholar → search your research keywords → find active researchers (published last 2 years)
2. ResearchGate → follow their work, understand their current projects
3. Cold email formula:
   Subject: "PhD Enquiry — [Your Field] — [Your Country]"
   Para 1: One specific thing you read in their recent paper
   Para 2: Your research background + proposed alignment
   Para 3: Brief ask — are they taking students? Can you send a proposal?
   Length: 200 words maximum. Attach CV only.

FULLY FUNDED OPTIONS FOR BANGLADESHIS:
• Commonwealth PhD (UK) — Bangladesh national quota
• DAAD EPOS / Helmholtz (Germany) — STEM and engineering
• Erasmus Mundus (EU) — full stipend, joint degree
• RTP Scholarship — Monash, UQ, ANU (Australia)
• NSF/NIH lab RAs (USA) — effectively fund the PhD`,

    7: `
STUDENT STAGE: 👨‍👩‍👧 Parent Mode | Any age parent
YOU ARE SPEAKING WITH: A Bangladeshi parent making a major family financial and emotional decision.

AGE-SPECIFIC APPROACH:
• Speak as one responsible adult to another — respectful, professional, reassuring
• Parents carry both hope and fear — validate the fear before addressing it
• Financial transparency is non-negotiable — give real BDT numbers, not vague ranges
• They are NOT the student — translate academic jargon into life terms

STRENGTH FINDER FOR THIS STAGE (about their child):
• Child has clear passion/goal → make the ROI case for investing in that specific direction
• Family has savings capacity → open premium pathways (UK, Australia); calculate full 4-year cost
• Child already has good grades → merit scholarship argument reduces financial burden
• Family has relative/contact abroad → safety net exists; this reduces risk
• Child is self-motivated → lower supervision need; parent can trust the process more

WEAKNESS HANDLER FOR THIS STAGE:
• Child's grades are average → foundation/pathway year adds cost but opens doors; reframe as investment
• Family finances are tight → Germany (free tuition), Malaysia, fully funded scholarships are real options
• Parent fears safety → give crime index data, Muslim community presence, halal food availability by city
• Parent unsure about degree value → give employment statistics, graduate salary data, Bangladesh recognition
• Parent worried about child living alone → student accommodation options, university welfare systems, Bangladeshi student associations

WHAT PARENTS NEED MOST:
• TOTAL COST in BDT: tuition + accommodation + food + transport + visa + flights + insurance + pocket money
  UK 3yr: ~৳35-80 lakh total | AU 4yr: ~৳40-90 lakh | CA 4yr: ~৳35-75 lakh | DE 3yr: ~৳15-25 lakh (tuition free)
• SAFETY: Bangladeshi student community size, nearest mosque, halal restaurants
• ROI: average graduate salary vs total investment — which countries give best return
• PARENT VISA OPTIONS: UK Standard Visitor, AU Visitor Visa, CA Super Visa (up to 2yr)
• REMITTANCE: legal channels from Bangladesh — bKash Global, bank wire, Wise
• DEGREE RECOGNITION: BCC/IQAC equivalency process for returning graduates
• ESCALATION: "For a personalised cost breakdown for your child's specific situation, our consultants can prepare a full financial plan — WhatsApp +880 1535-778111"`
  };

  return base + (stagePrompts[stage] || `
STUDENT STAGE: General / Unknown
First, ask the student ONE question to identify their stage and situation:
"To give you the most helpful guidance, could you tell me: how old are you and what level of education are you currently at?"
Then identify their top strength and top challenge before giving any advice.
Tailor all subsequent responses using the HG-AI framework — amplify their strength, address their weakness, guide toward human consultation when needed.`);
}

// ─────────────────────────────────────────────────────────────────────────
// G. FALLBACK POOL — used when Groq is unavailable
// ─────────────────────────────────────────────────────────────────────────
const FALLBACKS = {
  en: [
    "I'm having trouble connecting to my AI system right now. Please try again in a moment, or WhatsApp us directly at +880 1535-778111 — our consultants are available Saturday–Thursday, 9 AM–7 PM.",
    "My connection seems interrupted. For urgent guidance, please WhatsApp +880 1535-778111. I'll be back shortly!",
    "I can't reach my AI engine at the moment. Try refreshing the page or contact Earth Solutions directly: +880 1535-778111."
  ],
  bn: [
    "এখন আমার এআই সিস্টেমে সংযোগ করতে সমস্যা হচ্ছে। অনুগ্রহ করে কিছুক্ষণ পরে আবার চেষ্টা করুন, অথবা সরাসরি হোয়াটসঅ্যাপ করুন: +৮৮০ ১৫৩৫-৭৭৮১১১",
    "সংযোগ বিঘ্নিত হয়েছে। জরুরি পরামর্শের জন্য হোয়াটসঅ্যাপ করুন: +৮৮০ ১৫৩৫-৭৭৮১১১"
  ]
};

function getFallback(lang) {
  const pool = FALLBACKS[lang] || FALLBACKS.en;
  return pool[Math.floor(Math.random() * pool.length)];
}

// ─────────────────────────────────────────────────────────────────────────
// H. STATIC FILES
// ─────────────────────────────────────────────────────────────────────────
app.use(express.static(path.join(__dirname), {
  index: false,
  setHeaders(res, filePath) {
    if (filePath.endsWith('sw.js')) {
      res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
      res.setHeader('Service-Worker-Allowed', '/');
    }
  }
}));

// ─────────────────────────────────────────────────────────────────────────
// I. CORS + OPTIONS
// ─────────────────────────────────────────────────────────────────────────
function setCORS(res) {
  res.setHeader('Access-Control-Allow-Origin',  process.env.ALLOWED_ORIGIN || '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, x-admin-token');
}
app.options('/api/*', (req, res) => { setCORS(res); res.sendStatus(200); });

// ─────────────────────────────────────────────────────────────────────────
// J. ANALYTICS ENDPOINTS (built-in, no 3rd party)
// ─────────────────────────────────────────────────────────────────────────
app.post('/api/analytics/pageview', (req, res) => {
  const { path: p, referrer } = req.body;
  if (p) logPageview(p, referrer);
  res.json({ ok: true });
});
app.post('/api/analytics/event', (req, res) => {
  const { name, meta } = req.body;
  if (name) logEvent(name, meta);
  res.json({ ok: true });
});

// ─────────────────────────────────────────────────────────────────────────
// K. PUSH NOTIFICATION ENDPOINTS
// ─────────────────────────────────────────────────────────────────────────

// Return VAPID public key to frontend
app.get('/api/push/vapid-public-key', (req, res) => {
  res.json({ key: VAPID_PUBLIC });
});

// Save push subscription
app.post('/api/push/subscribe', (req, res) => {
  setCORS(res);
  const { subscription, userId, stage, lang } = req.body;
  if (!subscription || !subscription.endpoint) return res.status(400).json({ error: 'Invalid subscription' });

  const data = readJSON(PUSH_FILE, { subscriptions: [] });
  const exists = data.subscriptions.find(s => s.endpoint === subscription.endpoint);
  if (!exists) {
    data.subscriptions.push({ subscription, userId: userId || 'anon', stage, lang, createdAt: new Date().toISOString() });
    if (data.subscriptions.length > 5000) data.subscriptions = data.subscriptions.slice(-5000);
    writeJSON(PUSH_FILE, data);
    logEvent('push_subscribe', { userId, stage, lang });
  }
  res.json({ ok: true });
});

// Unsubscribe
app.post('/api/push/unsubscribe', (req, res) => {
  const { endpoint } = req.body;
  const data = readJSON(PUSH_FILE, { subscriptions: [] });
  data.subscriptions = data.subscriptions.filter(s => s.endpoint !== endpoint);
  writeJSON(PUSH_FILE, data);
  res.json({ ok: true });
});

// ─────────────────────────────────────────────────────────────────────────
// L. ADMIN AUTH MIDDLEWARE
// ─────────────────────────────────────────────────────────────────────────
function adminAuth(req, res, next) {
  const token = req.headers['x-admin-token'] || req.query.token;
  const pw    = process.env.ADMIN_PASSWORD || 'earthsolutions2025';
  if (token === pw) return next();
  res.status(401).json({ error: 'Unauthorized' });
}

// ─────────────────────────────────────────────────────────────────────────
// M. ADMIN ENDPOINTS
// ─────────────────────────────────────────────────────────────────────────
app.post('/api/admin/login', (req, res) => {
  const pw = process.env.ADMIN_PASSWORD || 'earthsolutions2025';
  if (req.body.password === pw) res.json({ success: true, token: pw });
  else res.status(401).json({ error: 'Wrong password' });
});

app.get('/api/admin/stats', adminAuth, (req, res) => {
  const data = readJSON(DATA_FILE, { inquiries: [], stats: {} });
  const STAGE_NAMES = { 1:'🌱 Foundation', 2:'🔍 Development', 3:'🎯 Strategic', 4:'🎓 Undergraduate', 5:'🔬 Masters', 6:'🏛️ Doctoral', 7:'👨‍👩‍👧 Parent' };
  const daily = [];
  for (let i = 13; i >= 0; i--) {
    const d = new Date(); d.setDate(d.getDate() - i);
    const key = d.toISOString().slice(0, 10);
    daily.push({ date: key.slice(5), count: data.stats.daily?.[key] || 0 });
  }
  const stageBreakdown = Object.entries(data.stats.byStage || {}).map(([id, count]) => ({ id, name: STAGE_NAMES[id] || `Stage ${id}`, count })).sort((a, b) => b.count - a.count);
  const analytics = readJSON(ANALYTICS_FILE, { events: [], pageviews: {} });
  const push = readJSON(PUSH_FILE, { subscriptions: [] });
  res.json({
    total:  data.stats.total || 0,
    today:  data.stats.daily?.[new Date().toISOString().slice(0,10)] || 0,
    totalEn: data.stats.byLang?.en || 0,
    totalBn: data.stats.byLang?.bn || 0,
    sources: data.stats.sources || {},
    stageBreakdown, daily,
    totalPageviews: Object.values(analytics.pageviews).reduce((a, b) => a + b, 0),
    pushSubscribers: push.subscriptions.length,
    recentCount: data.inquiries.length
  });
});

app.get('/api/admin/inquiries', adminAuth, (req, res) => {
  const data  = readJSON(DATA_FILE, { inquiries: [] });
  const page  = parseInt(req.query.page)  || 1;
  const limit = parseInt(req.query.limit) || 25;
  let list = data.inquiries;
  if (req.query.stage && req.query.stage !== 'all') list = list.filter(i => String(i.stage) === req.query.stage);
  if (req.query.lang  && req.query.lang  !== 'all') list = list.filter(i => i.lang === req.query.lang);
  if (req.query.source && req.query.source !== 'all') list = list.filter(i => i.source === req.query.source);
  res.json({ inquiries: list.slice((page-1)*limit, page*limit), total: list.length, page, pages: Math.ceil(list.length / limit) });
});

app.get('/api/admin/analytics', adminAuth, (req, res) => {
  const data = readJSON(ANALYTICS_FILE, { events: [], pageviews: {} });
  res.json(data);
});

app.get('/api/admin/sessions', adminAuth, (req, res) => {
  res.json({ activeSessions: sessions.size, ids: [...sessions.keys()].slice(0, 50) });
});

// Admin: send push notification to all subscribers
app.post('/api/admin/push/broadcast', adminAuth, async (req, res) => {
  const { title, body, url } = req.body;
  if (!title || !body) return res.status(400).json({ error: 'title and body required' });
  const data    = readJSON(PUSH_FILE, { subscriptions: [] });
  const payload = JSON.stringify({ title, body, url: url || '/', icon: '/logo.jpg', badge: '/logo.jpg' });
  let sent = 0, failed = 0;
  const toRemove = [];
  for (const sub of data.subscriptions) {
    try {
      await webpush.sendNotification(sub.subscription, payload);
      sent++;
    } catch (e) {
      failed++;
      if (e.statusCode === 410 || e.statusCode === 404) toRemove.push(sub.subscription.endpoint);
    }
  }
  if (toRemove.length) {
    data.subscriptions = data.subscriptions.filter(s => !toRemove.includes(s.endpoint));
    writeJSON(PUSH_FILE, data);
  }
  logEvent('push_broadcast', { title, sent, failed });
  res.json({ ok: true, sent, failed, removed: toRemove.length });
});

app.post('/api/admin/reset', adminAuth, (req, res) => {
  writeJSON(DATA_FILE, { inquiries: [], stats: { total: 0, byStage: {}, byLang: { en: 0, bn: 0 }, daily: {}, sources: { faq: 0, ai: 0, fallback: 0 } } });
  res.json({ success: true });
});

app.get('/admin', (req, res) => res.sendFile(path.join(__dirname, 'admin.html')));

// ─────────────────────────────────────────────────────────────────────────
// N. MAIN CHAT ENDPOINT — SSE streaming
//    Flow: FAQ match → Groq AI → Fallback
// ─────────────────────────────────────────────────────────────────────────
app.post('/api/chat', async (req, res) => {
  setCORS(res);
  res.setHeader('Content-Type',  'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache, no-transform');
  res.setHeader('Connection',    'keep-alive');
  res.flushHeaders();

  const send = (obj) => res.write(`data: ${JSON.stringify(obj)}\n\n`);
  const done  = ()   => { res.write('data: [DONE]\n\n'); res.end(); };

  try {
    const { messages = [], userId, stage, lang = 'en' } = req.body;
    const ip = req.headers['x-forwarded-for'] || req.socket.remoteAddress;

    // Merge server session memory with client-sent messages
    const session = getSession(userId);
    if (stage) session.stage = stage;
    if (lang)  session.lang  = lang;

    // Last user message
    const userMsgs   = messages.filter(m => m.role === 'user');
    const lastUserMsg = userMsgs[userMsgs.length - 1]?.content || '';

    // ── 1. FAQ instant match ─────────────────────────────────────────
    const faqAnswer = matchFAQ(lastUserMsg, lang);
    if (faqAnswer) {
      // Stream FAQ answer character-by-character for natural feel
      if (userMsgs.length === 1) logInquiry({ userId, stage, lang, firstMessage: lastUserMsg, ip, source: 'faq' });
      pushMsg(userId, 'user', lastUserMsg);
      pushMsg(userId, 'assistant', faqAnswer);
      const words = faqAnswer.split(' ');
      for (const word of words) {
        send({ choices: [{ delta: { content: word + ' ' } }] });
        await new Promise(r => setTimeout(r, 18));
      }
      return done();
    }

    // ── 2. Groq AI ───────────────────────────────────────────────────
    if (!process.env.GROQ_API_KEY) throw new Error('GROQ_API_KEY not set');

    if (userMsgs.length === 1) logInquiry({ userId, stage, lang, firstMessage: lastUserMsg, ip, source: 'ai' });
    pushMsg(userId, 'user', lastUserMsg);

    // Combine server session history + incoming messages (deduplicated)
    const contextMessages = [...session.messages.slice(0, -1), ...messages].slice(-30);

    const groqRes = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method:  'POST',
      headers: { 'Authorization': `Bearer ${process.env.GROQ_API_KEY}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model:       'llama-3.3-70b-versatile',
        messages:    [{ role: 'system', content: buildSystemPrompt(stage, lang) }, ...contextMessages],
        stream:      true,
        temperature: 0.65,
        max_tokens:  1024,
        top_p:       0.9
      })
    });

    if (!groqRes.ok) throw new Error(`Groq ${groqRes.status}: ${await groqRes.text()}`);

    let fullReply = '';
    const reader  = groqRes.body.getReader();
    const decoder = new TextDecoder();

    while (true) {
      const { done: d, value } = await reader.read();
      if (d) break;
      const chunk = decoder.decode(value, { stream: true });
      for (const line of chunk.split('\n')) {
        if (!line.startsWith('data:')) continue;
        const raw = line.slice(5).trim();
        if (!raw || raw === '[DONE]') continue;
        try {
          const parsed = JSON.parse(raw);
          const token  = parsed.choices?.[0]?.delta?.content || '';
          fullReply   += token;
          res.write(`data: ${raw}\n\n`);
        } catch {}
      }
    }

    if (fullReply) pushMsg(userId, 'assistant', fullReply);
    return done();

  } catch (err) {
    console.error('[Peopole AI]', err.message);

    // ── 3. Fallback ──────────────────────────────────────────────────
    const { lang = 'en', userId, stage, messages = [] } = req.body;
    const userMsgs = messages.filter(m => m.role === 'user');
    if (userMsgs.length === 1) {
      logInquiry({ userId, stage, lang, firstMessage: userMsgs[0]?.content, ip: req.headers['x-forwarded-for'] || req.socket.remoteAddress, source: 'fallback' });
    }
    const fallbackText = getFallback(lang);
    const words = fallbackText.split(' ');
    for (const word of words) {
      send({ choices: [{ delta: { content: word + ' ' } }] });
      await new Promise(r => setTimeout(r, 20));
    }
    return done();
  }
});

// ─────────────────────────────────────────────────────────────────────────
// O. SPA CATCH-ALL
// ─────────────────────────────────────────────────────────────────────────
app.get('*', (req, res) => {
  logPageview(req.path, req.headers.referer || '');
  res.sendFile(path.join(__dirname, 'index.html'));
});

app.listen(PORT, () => {
  console.log(`✅  Peopole AI v8.0 running → http://localhost:${PORT}`);
  console.log(`🔐  Admin panel → http://localhost:${PORT}/admin`);
  console.log(`🔑  Admin password: ${process.env.ADMIN_PASSWORD || 'earthsolutions2025'}`);
  console.log(`📢  Push notifications: ${VAPID_PUBLIC === 'REPLACE_WITH_YOUR_VAPID_PUBLIC_KEY' ? '⚠ VAPID keys not set' : '✓ Configured'}`);
});
