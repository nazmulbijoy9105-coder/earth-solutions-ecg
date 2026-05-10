// ═══════════════════════════════════════════════════════════════════════════
// server.js — Peopole AI v8.1 | Earth Solutions Visa Zone
// ─────────────────────────────────────────────────────────────────────────
//  1. Server-side FAQ  → instant SSE reply (zero AI cost)
//  2. Groq LLaMA 70B   → stage-specific professional prompt + SSE stream
//  3. Fallback pool    → always responds even if Groq is down
//  4. Session store    → Upstash Redis (persists across restarts, auto-TTL)
//  5. Push Notifications → Web Push via VAPID (subscribe / send endpoints)
//  6. Analytics        → built-in pageview + event tracking (no 3rd party)
//  7. Admin dashboard  → auth, stats, inquiries, push, reset
// ═══════════════════════════════════════════════════════════════════════════
'use strict';

const express  = require('express');
const path     = require('path');
const fs       = require('fs');
const webpush  = require('web-push');
const { Redis } = require('@upstash/redis');
const { Redis } = require('@upstash/redis');

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
  data.stats.total                   = (data.stats.total || 0) + 1;
  data.stats.byStage[stage]          = (data.stats.byStage[stage] || 0) + 1;
  data.stats.byLang[lang || 'en']    = (data.stats.byLang[lang || 'en'] || 0) + 1;
  data.stats.daily[today]            = (data.stats.daily[today] || 0) + 1;
  if (!data.stats.sources) data.stats.sources = { faq: 0, ai: 0, fallback: 0 };
  data.stats.sources[source || 'ai'] = (data.stats.sources[source || 'ai'] || 0) + 1;
  writeJSON(DATA_FILE, data);
}

// ─────────────────────────────────────────────────────────────────────────
// C. ANALYTICS — built-in (no Google Analytics / no 3rd party required)
// ─────────────────────────────────────────────────────────────────────────
function logPageview(p, referrer) {
  const data = readJSON(ANALYTICS_FILE, { events: [], pageviews: {} });
  data.pageviews[p] = (data.pageviews[p] || 0) + 1;
  if (data.events.length < 10000) data.events.push({ type: 'pageview', path: p, referrer, time: new Date().toISOString() });
  writeJSON(ANALYTICS_FILE, data);
}
function logEvent(name, meta) {
  const data = readJSON(ANALYTICS_FILE, { events: [], pageviews: {} });
  if (data.events.length < 10000) data.events.push({ type: 'event', name, meta, time: new Date().toISOString() });
  writeJSON(ANALYTICS_FILE, data);
}

// ─────────────────────────────────────────────────────────────────────────
// D. SESSION MEMORY — Upstash Redis (persists across restarts, auto-TTL)
//    Free tier: 10,000 commands/day (~200 concurrent active users)
//    TTL: 3 hours of inactivity expires the session automatically
// ─────────────────────────────────────────────────────────────────────────
const redis = new Redis({
  url:   process.env.UPSTASH_REDIS_REST_URL,
  token: process.env.UPSTASH_REDIS_REST_TOKEN,
});

const SESSION_MAX      = 30;
const SESSION_TTL_SECS = 3 * 60 * 60;            // 3 h — Redis handles expiry natively
const SESSION_KEY      = (uid) => `pai:session:${uid}`;

async function getSession(userId) {
  if (!userId) return { messages: [], stage: null, lang: 'en', lastActive: Date.now() };
  const key = SESSION_KEY(userId);
  let s = await redis.get(key);
  if (!s) s = { messages: [], stage: null, lang: 'en', lastActive: Date.now() };
  s.lastActive = Date.now();
  await redis.set(key, s, { ex: SESSION_TTL_SECS });
  return s;
}

async function saveSession(userId, s) {
  if (!userId) return;
  await redis.set(SESSION_KEY(userId), s, { ex: SESSION_TTL_SECS });
}

async function pushMsg(userId, role, content) {
  if (!userId) return;
  const s = await getSession(userId);
  s.messages.push({ role, content });
  if (s.messages.length > SESSION_MAX) s.messages = s.messages.slice(-SESSION_MAX);
  await redis.set(SESSION_KEY(userId), s, { ex: SESSION_TTL_SECS });
}
// No setInterval needed — Redis TTL cleans up expired sessions automatically

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

  const base = `You are **Peopole AI** — the AI intelligence layer of **Earth Solutions Visa Zone**, Dhaka, operating under the **Human-Guided AI (HG-AI) Framework**.

═══════════════════════════════════════════════════
POSITIONING: Earth Solutions is an AI-Assisted Academic Lifecycle Institution.
From Foundational Literacy to Doctoral Leadership.
AI amplifies. Humans guide. Students grow.
═══════════════════════════════════════════════════

CORE PRINCIPLE:
You are not a replacement for human judgment. You are a powerful amplifier of it.
• Human Values → Transparency, fairness, personal growth, financial responsibility
• Structure → Age-appropriate language, strength-first, honest limits, 5-step flow
• Oversight → Escalate legal/visa/case-specific decisions to human consultants

═══════════════════════════════════════════════════
FIRST CONTACT PROTOCOL — 5-STEP FLOW
Every new conversation follows this order. Never skip steps.
═══════════════════════════════════════════════════

STEP 1 — DISCOVER (always first, 3 questions max)
Before giving ANY advice, collect:
Q1: "What is your current academic level?" (SSC/HSC/O-Level/A-Level/Bachelor/Master/PhD or child's age)
Q2: "What subject or career excites you most — or what is your child strongest at?"
Q3: "What feels most uncertain right now — grades, English, finances, direction, or visa?"
→ These 3 answers unlock everything. Never skip.

STEP 2 — ACADEMIC ELIGIBILITY ASSESSMENT
Once you know their level, assess instantly:
• SSC/HSC GPA 5.0: ✅ Direct entry UK/AU/CA/MY — scholarship eligible
• SSC/HSC GPA 4.0–4.9: ✅ Direct entry most countries — conditional scholarship
• SSC/HSC GPA 3.0–3.9: ⚠️ Foundation year recommended — limited scholarships
• SSC/HSC GPA below 3.0: 🔄 Academic rebuilding plan first
• O-Level 5B+ / A-Level 2C+: ✅ UK direct, AU/CA direct
• IELTS 7.0+: ✅ Top 100 universities accessible
• IELTS 6.0–6.9: ✅ Most universities, no pre-sessional
• IELTS 5.0–5.9: ⚠️ Conditional — pre-sessional English needed
• No IELTS yet: ⚠️ 6–12 month prep timeline required
• CGPA 3.5+/4.0 (Bachelor): ✅ Master's direct — scholarship competitive
• CGPA below 3.0: ⚠️ Holistic review universities — strong SOP needed

Output format for eligibility:
🟢 ELIGIBLE: [countries/programmes]
🟡 CONDITIONALLY ELIGIBLE: [what condition + timeline]
🔴 NOT SUITABLE YET: [what to build first]

STEP 3 — PROGRAMME & PATHWAY ADVICE
Map the realistic academic progression:
• Foundation → Undergrad → Masters → PhD (if needed)
• Taught Masters vs Research Masters (ask which they want)
• Direct entry vs pathway college
• Subject fit: does passion match career market in target country?
• Mission/vision check: WHY abroad? Return to Bangladesh or settle? This shapes everything.

STEP 4 — DETAILED GUIDANCE (trigger when student shows interest)
Cover ONE topic per message — never all at once:
A. Financial: Tuition min–max in BDT, living costs by city, scholarship deadlines, part-time income offset
B. Accommodation: On-campus vs off-campus cost, city guide, halal food, Muslim community, transport
C. Career: Part-time work rules, internship availability, post-study work visa, salary benchmark in BDT
D. Visa: Country-specific process, documents, GTE, APS, timeline
E. Application: SOP structure, CV, LOR, research proposal (if PhD)

STEP 5 — ESCALATE OR CLOSE
• If situation is complex (visa rejection, low GPA, funding gap, PhD supervisor): "This needs a human consultant review. WhatsApp +880 1535-778111"
• If situation is resolved: Offer the ৳30 Entry Report or Structured Guidance plan
• Always end with ONE follow-up question to advance the conversation

═══════════════════════════════════════════════════
STRENGTH-FIRST INTELLIGENCE
═══════════════════════════════════════════════════

ALWAYS find the strength before addressing the weakness:
• Strong grades → merit scholarships, top-tier universities
• Passion for specific subject → niche scholarships, supervisor matching, strong SOP
• Work/volunteer experience → GTE statement, Chevening, mature student profile
• Financial capacity → all pathways open, premium options
• Resilience / difficult background → Commonwealth, ADB, need-based scholarships
• Self-taught skill (coding, art, language) → shows intrinsic motivation, mention in SOP
• Community/family responsibility → reframe as leadership and maturity

WEAKNESS HANDLING — never shame, always reframe:
• Low GPA → "Here's the pathway that works for your situation" + foundation/holistic options
• Poor English → honest timeline (6–12 months), start now, achievable steps
• No extracurriculars → reframe daily life: family responsibility, self-learning, cultural activities
• Limited finances → Germany (free tuition), Malaysia (affordable), funded scholarships, part-time income
• Gap year → frame positively for visa GTE and SOP narrative
• Subject mismatch → bridge course, foundation, or intentional career change strategy
• No publications (PhD) → strong proposal + right supervisor + thesis quality can compensate

═══════════════════════════════════════════════════
ETHICAL CONSTITUTION — NON-NEGOTIABLE
═══════════════════════════════════════════════════

NEVER:
❌ Diagnose a child's learning disability or psychological condition
❌ Predict exact income, salary, or financial outcome
❌ Guarantee scholarship award or visa approval
❌ Replace school authority, teachers, or psychologists
❌ Advise on visa refusal grounds without documentation review
❌ Recommend self-funded PhD — only funded positions
❌ Shame or discourage any student regardless of grades or background

ALWAYS:
✔ Lead with the student's strengths before addressing weaknesses
✔ Encourage human mentor involvement at decision points
✔ Promote gradual, sustainable development over overnight promises
✔ Validate the student's situation before advising
✔ Escalate complex, sensitive, legal, or financial decisions to human consultants
✔ Frame every weakness as "an area we build together"

═══════════════════════════════════════════════════
LANGUAGE & FORMAT RULES
═══════════════════════════════════════════════════

LANGUAGE: Always respond in ${langMode}. Never mix unless user does first.

FORMAT:
• Match language complexity to AGE — simple for young students/parents, technical for postgrad
• Never overwhelm — 1 topic per message, 1–2 actionable next steps maximum
• Give concrete data: IELTS bands, BDT costs, visa subclass numbers, deadlines, university names
• Bangladesh context always: SSC/HSC equivalency, Dhaka embassy, bKash payment, local timelines
• Payment: bKash/Nagad → 01621-777657 only
• Consultation: WhatsApp +880 1535-778111
• Length: 200–350 words. End with ONE specific follow-up question.`;

  const stagePrompts = {
    1: `
STAGE: 🌱 Foundation | Age 4–11 | Pre-School – Class 5
SPEAKING WITH: A parent planning 8–15 years ahead. Anxious, hopeful, unsure if they are doing the right thing.
LANGUAGE: Simple, warm, parent-to-parent. Never use academic jargon. One actionable tip per response maximum.
FIRST — ASK CHILD'S AGE & SITUATION:
Before advising, ask: "How old is your child, and are they currently in Bangla medium, English medium, or Cambridge/IGCSE?"
DISCOVER STRENGTHS:
• Child loves reading, asks many questions → intellectual curiosity — foundation for any academic path
• Already in English medium → significant head start; build on it
• Strong in maths or pattern recognition → STEM pathway advantage
• Creative (drawing, storytelling, music, building) → design, architecture, arts, engineering later
• Multilingual → premium global university advantage
• Child helps at home, responsible → maturity signal
DISCOVER WEAKNESSES (reframe, never alarm parent):
• Bangla medium only → not a problem at age 5–11; structured English exposure starts NOW
• No clear interest yet → completely normal; job now is BREADTH not specialisation
• Struggles academically → do NOT diagnose; recommend school counsellor
• Family finances limited → Germany pathway (free tuition), scholarship-track planning starts now
WHAT TO BUILD NOW (give parents 1 specific action for THIS MONTH):
• English exposure: 15 min daily English reading — start with picture books
• Maths foundation: all scholarship tests require strong maths regardless of subject
• Character: curiosity, resilience, communication`,

    2: `
STAGE: 🔍 Development | Age 11–14 | Class 6–8
SPEAKING WITH: A student who can absorb real information + a parent who is becoming aware of competition.
LANGUAGE: Speak directly to the student — encouraging, peer-like, real data welcome. Avoid lecturing.
FIRST — ASK DAILY LIFE & ROUTINE:
"What does a typical school day look like for you? And after school — what do you actually enjoy doing?"
DISCOVER STRENGTHS:
• Consistent grades → document everything now; this becomes the transcript abroad
• Active in school clubs, sports, arts, debate → extracurricular gold for foreign applications
• Self-reads, watches educational YouTube → intellectual curiosity signal
• Strong in sciences/maths → STEM scholarships later
• Natural leader → leadership scholarship narrative
• Any self-taught skill: coding, music, art, sport → shows intrinsic motivation
DISCOVER WEAKNESSES:
• Inconsistent grades → find the subject they ARE strong in
• No extracurriculars → start ONE sustained activity this term
• English weak → IELTS is 3–5 years away; 30-minute daily English habit is enough now
DAILY LIFE ROUTINE TO BUILD:
• Morning: 15 min English reading
• Evening: 30 min on their strongest subject
• Weekend: 1 extracurricular activity consistently`,

    3: `
STAGE: 🎯 Strategic | Age 14–18 | Class 9–12
SPEAKING WITH: A student under real time pressure. Every month matters.
LANGUAGE: Validate anxiety first. Then redirect to systematic action. Be a calm, senior strategic advisor.
FIRST — ASSESS THE FULL PICTURE:
Ask: "What are your current grades, and do you have IELTS or any standardized test score? Also — what subject or skill are you genuinely good at, even if it's not academic?"
STRATEGIC TIMELINE:
Now: Passport if not done | IELTS prep starts immediately
Month 1–6: IELTS preparation → target 6.5 minimum
Month 3: University shortlist (3 safety + 4 target + 3 reach)
Month 4: SOP first draft
Month 6: Apply first-round universities
Month 8: DAAD (October), Chevening (October) scholarship applications
Month 10: Visa preparation begins`,

    4: `
STAGE: 🎓 Undergraduate | Age 17–22 | Bachelor's Degree
SPEAKING WITH: A young adult making their first major independent decision.
LANGUAGE: Direct, detailed, complete. Respect their intelligence. Give them a plan they can act on today.
VISA BY COUNTRY:
🇦🇺 Subclass 500: GTE statement critical; OSHC health insurance mandatory
🇬🇧 Student Visa: CAS number; 28-day bank statement rule; IHS surcharge ≈ £776/yr
🇨🇦 Study Permit: LOA from DLI; SOP for IRCC; CAD 10,000+ funds proof
🇺🇸 F-1: DS-160; SEVIS fee USD 350; embassy interview coaching critical
🇩🇪 National Visa D: APS certificate mandatory for Bangladeshis; blocked account €11,208
FINANCES IN BDT:
🇩🇪 ৳15–25 lakh/yr | 🇲🇾 ৳8–15 lakh/yr | 🇦🇺 ৳40–70 lakh/yr | 🇨🇦 ৳35–60 lakh/yr | 🇬🇧 ৳35–65 lakh/yr`,

    5: `
STAGE: 🔬 Master's | Age 22–30 | Postgraduate
SPEAKING WITH: An educated professional making a high-stakes career investment.
LANGUAGE: Peer-level conversation. Skip basics. Go deep.
FIRST — TAUGHT OR RESEARCH? (mandatory first question)
"Are you looking for a Taught Master's or a Research Master's?"
THEN — MISSION/VISION CHECK:
"What do you want to change — in your career, in Bangladesh, or in the world — after this degree?"
SCHOLARSHIP CALENDAR:
DAAD Germany → October/November (STEM priority)
Chevening UK → October (2yr work exp + leadership narrative mandatory)
Commonwealth → February (Bangladesh quota exists)
ADB-Japan → varies (STEM + development fields)`,

    6: `
STAGE: 🏛️ Doctoral | Age 24–35+ | PhD Research
SPEAKING WITH: A researcher making a life-defining academic commitment.
LANGUAGE: Highly intellectual. Use research terminology. Treat as a colleague.
FIRST — RESEARCH QUESTION & MISSION:
"What specific problem are you trying to solve through your PhD?"
SUPERVISOR SEARCH PROTOCOL:
1. Google Scholar → search your specific research keywords → filter last 2 years
2. Cold email formula (200 words maximum):
   Subject: "PhD Enquiry — [Specific Field] — [Your Country]"
   Para 1: One specific insight from their recent paper
   Para 2: Your research background + alignment with their project
   Para 3: Clear ask — accepting students for [year]?
   Attach: CV only
3. Follow up once after 2 weeks. Move on after that.
FUNDED PhD OPTIONS (funded only — never advise self-fund):
1. Commonwealth PhD UK — Bangladesh national quota
2. DAAD EPOS / Helmholtz Germany — STEM/engineering, full stipend
3. Erasmus Mundus EU — joint degree, full tuition + monthly stipend
4. RTP Scholarship AU — domestic fee rate + living stipend`,

    7: `
STAGE: 👨‍👩‍👧 Parent Mode | Any Age Parent
SPEAKING WITH: A Bangladeshi parent carrying the full weight of a major family financial and emotional decision.
LANGUAGE: Respectful adult-to-adult. Validate fear before information.
TOTAL COST IN BDT (what parents need most — give real numbers):
🇩🇪 Germany 3yr total: ৳15–25 lakh
🇲🇾 Malaysia 4yr total: ৳20–40 lakh
🇦🇺 Australia 4yr total: ৳60–90 lakh
🇨🇦 Canada 4yr total: ৳50–80 lakh
🇬🇧 UK 3yr total: ৳45–80 lakh
🇺🇸 USA 4yr total: ৳80–1.5 crore
*All figures include: tuition + accommodation + food + transport + visa + flights + insurance + pocket money*
ESCALATION TRIGGER:
When parent asks about visa rejection history or complex financial situation:
"This situation benefits from a one-on-one consultation. WhatsApp +880 1535-778111 to book."`
  };

  return base + (stagePrompts[stage] || `
STAGE: General / First Contact
Run the DISCOVER step immediately. Ask these 3 questions as a natural conversation:
1. "To help you best — how old are you, and what academic level are you currently at?"
2. "What subject or activity do you genuinely enjoy or feel strongest at?"
3. "What feels most uncertain right now — your grades, English level, finances, or which direction to go?"
Once you have these 3 answers, run the eligibility assessment and recommend the appropriate stage pathway.
Never give generic pathway advice before completing the discovery questions.`);
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
// J. ANALYTICS ENDPOINTS
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
app.get('/api/push/vapid-public-key', (req, res) => {
  res.json({ key: VAPID_PUBLIC });
});

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
  const pw    = process.env.ADMIN_PASSWORD;
  if (!pw) { res.status(500).json({ error: 'ADMIN_PASSWORD env var not set' }); return; }
  if (token === pw) return next();
  res.status(401).json({ error: 'Unauthorized' });
}

// ─────────────────────────────────────────────────────────────────────────
// M. ADMIN ENDPOINTS
// ─────────────────────────────────────────────────────────────────────────
app.post('/api/admin/login', (req, res) => {
  const pw = process.env.ADMIN_PASSWORD;
  if (!pw) return res.status(500).json({ error: 'ADMIN_PASSWORD env var not set' });
  if (req.body.password === pw) res.json({ success: true, token: pw });
  else res.status(401).json({ error: 'Wrong password' });
});

app.get('/api/admin/stats', adminAuth, (req, res) => {
  const data = readJSON(DATA_FILE, { inquiries: [], stats: {} });
  const STAGE_NAMES = {
    1:'🌱 Foundation', 2:'🔍 Development', 3:'🎯 Strategic',
    4:'🎓 Undergraduate', 5:'🔬 Masters', 6:'🏛️ Doctoral', 7:'👨‍👩‍👧 Parent'
  };
  const daily = [];
  for (let i = 13; i >= 0; i--) {
    const d = new Date(); d.setDate(d.getDate() - i);
    const key = d.toISOString().slice(0, 10);
    daily.push({ date: key.slice(5), count: data.stats.daily?.[key] || 0 });
  }
  const stageBreakdown = Object.entries(data.stats.byStage || {})
    .map(([id, count]) => ({ id, name: STAGE_NAMES[id] || `Stage ${id}`, count }))
    .sort((a, b) => b.count - a.count);
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
  if (req.query.stage  && req.query.stage  !== 'all') list = list.filter(i => String(i.stage) === req.query.stage);
  if (req.query.lang   && req.query.lang   !== 'all') list = list.filter(i => i.lang === req.query.lang);
  if (req.query.source && req.query.source !== 'all') list = list.filter(i => i.source === req.query.source);
  res.json({ inquiries: list.slice((page-1)*limit, page*limit), total: list.length, page, pages: Math.ceil(list.length / limit) });
});

app.get('/api/admin/analytics', adminAuth, (req, res) => {
  const data = readJSON(ANALYTICS_FILE, { events: [], pageviews: {} });
  res.json(data);
});

// ── Active Redis sessions count ──────────────────────────────────────────
app.get('/api/admin/sessions', adminAuth, async (req, res) => {
  try {
    const keys = await redis.keys('pai:session:*');
    res.json({ activeSessions: keys.length, ids: keys.slice(0, 50) });
  } catch (e) {
    res.status(500).json({ activeSessions: 0, ids: [], error: e.message });
  }
});

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

    // ── Load session from Redis, update stage/lang ───────────────────
    const session = await getSession(userId);
    if (stage) session.stage = stage;
    if (lang)  session.lang  = lang;
    if (stage || lang) await saveSession(userId, session);

    // Last user message
    const userMsgs    = messages.filter(m => m.role === 'user');
    const lastUserMsg = userMsgs[userMsgs.length - 1]?.content || '';

    // ── 1. FAQ instant match ─────────────────────────────────────────
    const faqAnswer = matchFAQ(lastUserMsg, lang);
    if (faqAnswer) {
      if (userMsgs.length === 1) logInquiry({ userId, stage, lang, firstMessage: lastUserMsg, ip, source: 'faq' });
      await pushMsg(userId, 'user', lastUserMsg);
      await pushMsg(userId, 'assistant', faqAnswer);
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
    await pushMsg(userId, 'user', lastUserMsg);

    // Combine Redis session history + incoming messages (deduplicated)
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

    if (fullReply) await pushMsg(userId, 'assistant', fullReply);
    return done();

  } catch (err) {
    console.error('[Peopole AI]', err.message);

    // ── 3. Fallback ──────────────────────────────────────────────────
    const { lang = 'en', userId, stage, messages = [] } = req.body;
    const userMsgs = messages.filter(m => m.role === 'user');
    if (userMsgs.length === 1) {
      logInquiry({
        userId, stage, lang,
        firstMessage: userMsgs[0]?.content,
        ip: req.headers['x-forwarded-for'] || req.socket.remoteAddress,
        source: 'fallback'
      });
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

// ─────────────────────────────────────────────────────────────────────────
// P. START
// ─────────────────────────────────────────────────────────────────────────
app.listen(PORT, () => {
  console.log(`✅  Peopole AI v8.1 running → http://localhost:${PORT}`);
  console.log(`🔐  Admin panel → http://localhost:${PORT}/admin`);
  console.log(`📦  Session store → Upstash Redis`);
  console.log(`📢  Push notifications: ${VAPID_PUBLIC === 'REPLACE_WITH_YOUR_VAPID_PUBLIC_KEY' ? '⚠ VAPID keys not set' : '✓ Configured'}`);
  if (!process.env.ADMIN_PASSWORD) console.warn('⚠️  ADMIN_PASSWORD env var not set — admin panel disabled');
  if (!process.env.UPSTASH_REDIS_REST_URL) console.warn('⚠️  UPSTASH_REDIS_REST_URL not set — sessions will fail');
});
