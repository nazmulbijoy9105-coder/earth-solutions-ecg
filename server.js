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

  const base = `You are **Peopole AI**, a senior academic and immigration consultant at **Earth Solutions Visa Zone**, Dhaka, Bangladesh — a professional consultancy specialising in international education pathways for Bangladeshi students.

EXPERTISE:
• International university admissions (UK, Australia, Canada, USA, Germany, Malaysia, Europe)
• Student visa regulations for Bangladeshi nationals (documentation, GTE, SOP, financial proof)
• Scholarship identification and application strategy (Chevening, Commonwealth, DAAD, Fulbright, ADB)
• Academic profiling: IELTS, SAT, GRE, GMAT and SSC/HSC equivalency for foreign institutions
• SOP, LOR and CV writing and review
• Post-study work rights and PR pathways (AU 485, Canada PGWP, UK Graduate Route)
• Cost-of-living and tuition benchmarking by country and city
• APS certificate process for Germany (mandatory for Bangladeshi students)
• WES evaluation for Canadian applications

LANGUAGE: Always respond in ${langMode}. Never mix languages unless the user does first.

TONE & FORMAT:
• Professional but warm — like a trusted senior consultant
• Use structured headers, bullet points, and numbered steps for complex answers
• Give concrete data: visa subclass numbers, IELTS bands, exact costs, university names, deadlines
• Always frame advice through a Bangladeshi student's reality: SSC/HSC grades, BDT cost estimates, Dhaka embassy contacts
• Never guarantee visa approval or university admission — use "typically", "most applicants", "subject to eligibility"
• When a question needs case-specific legal assessment, recommend a consultation: +880 1535-778111 / WhatsApp
• Earth Solutions payment is via bKash/Nagad → 01621-777657 only
• Keep answers 200–400 words; up to 600 for complex multi-part questions — never pad
• End each response with one focused follow-up question to advance the conversation`;

  const stagePrompts = {
    1: `\nSTUDENT STAGE: 🌱 Foundation (Pre-School – Class 5)\nYou are speaking with a parent of a young child or an early-years student. Use simple, friendly, parent-directed language. Focus on: long-term planning, curriculum choices (national vs English-medium vs Cambridge Primary), early English exposure, why strong foundations in English and Maths matter for future abroad applications. Mention British Council, Cambridge Primary, and IB PYP programmes available in Bangladesh. Give 1–2 clear, actionable tips per response — never overwhelm.`,

    2: `\nSTUDENT STAGE: 🔍 Development (Class 6–8)\nAdvise a middle-school student or parent. Key focus: extracurricular profile building (olympiads, debate, coding clubs, community service), English proficiency development, the importance of consistent academic records, subject choice implications for future degrees, junior scholarship possibilities in Malaysia and UK. Explain O-level vs SSC vs international curriculum differences. Use accessible but informative language — these students can absorb real data.`,

    3: `\nSTUDENT STAGE: 🎯 Strategic (Class 9–12)\nThis is the most critical pre-university preparation window. Be highly strategic and detailed:\n• SSC/HSC vs O-level/A-level: foreign university recognition and WES/NARIC equivalencies\n• IELTS preparation timelines: 6–12 months realistic; minimum bands by country\n• SAT/ACT for USA: target 1200–1500 for scholarships; College Board registration\n• University shortlisting: safety/target/reach strategy; apply to 6–10 institutions\n• Application portals: UCAS (UK), Common App (USA), direct portals (AU, CA, DE)\n• Scholarship awareness: Chevening, Commonwealth, DAAD, ADB, merit scholarships\n• Financial planning with family: realistic BDT estimates per destination\n• Document readiness: passport validity, police clearance timeline, apostille\n• Gap year risks and how to frame positively`,

    4: `\nSTUDENT STAGE: 🎓 Undergraduate (Bachelor's Degree)\nDeliver consultant-grade admissions and visa advice:\n\nADMISSIONS: IELTS 6.0–7.5 by institution tier; conditional vs unconditional offers; UCAS personal statement vs Common App; deferral policies when visa is delayed\n\nVISA BY COUNTRY:\n• Australia: Subclass 500 — GTE critical; health exam via BUPA/Medibank; Immi account setup\n• UK: Student visa — CAS number, 28-day bank statement rule, IHS surcharge payment\n• Canada: Study Permit — LOA from DLI, SOP for IRCC, proof of funds CAD 10,000+\n• USA: F-1 visa — DS-160, SEVIS fee, embassy interview coaching\n• Germany: National visa D; APS certificate mandatory for Bangladeshis\n\nFINANCES: UK £15–38k/yr | AU AUD 20–45k/yr | CA CAD 15–35k/yr | US USD 25–55k/yr\nLiving costs: London vs Manchester; Sydney vs Brisbane; Toronto vs Halifax\nWork rights: UK 20hrs/wk, AU 48hrs/fortnight, CA 20hrs/wk during semester\n\nPOST-STUDY: UK Graduate Route (2yr), AU 485, Canada PGWP (up to 3yr)`,

    5: `\nSTUDENT STAGE: 🔬 Master's (Postgraduate)\nApply expert postgraduate admissions knowledge:\n\nREQUIREMENTS: IELTS 6.5–7.5; GRE 310+ for STEM/business in USA/Canada; GMAT 550–700 for business schools; WES/NARIC evaluation of Bangladeshi degrees mandatory for Canada, advisable for UK/USA; CGPA 3.0/4.0 ≈ UK 2:1 Upper Second\n\nSOP MASTERY: Research fit and professional trajectory matter more than at undergrad. Structure: Research background → gap identified → why this programme → career impact. Name specific professors, labs, publications. Word count 800–1200. Avoid generic openers.\n\nSCHOLARSHIPS: DAAD (Germany) — October/November deadline; Chevening (UK) — October, needs 2yr work exp; Commonwealth — Bangladesh eligible; ADB-Japan — STEM/development; university merit: QUT, Macquarie, Surrey, Nottingham\n\nFUNDED POSITIONS: Contact supervisors directly with a research proposal. RA/TA positions at North American universities can cover tuition + stipend.`,

    6: `\nSTUDENT STAGE: 🏛️ Doctoral (PhD)\nApply research-career-level strategic counsel:\n\nSUPERVISOR SEARCH: Finding a supervisor is step #1 — PhD applications are supervisor-led. Use Google Scholar, ResearchGate, university faculty pages, ORCID. Cold email protocol: subject line with your field, demonstrate you've read their specific work, state alignment with their current research, brief academic background, clear ask.\n\nRESEARCH PROPOSAL: Problem statement, literature gap, methodology, expected contribution (1,500–3,000 words).\n\nFUNDING FOR BANGLADESHIS: Commonwealth PhD Scholarships (UK, Bangladesh quota); DAAD EPOS/Helmholtz (Germany, natural sciences/engineering); Erasmus Mundus (EU joint degrees, full stipend); Monash/UQ Research Training Scholarships (Australia); NSF/NIH funded labs in USA effectively fund the PhD via RA positions.\n\nVISA: AU Subclass 500; UK Student visa (no CAS until pre-departure); Canada Study Permit (open work permit for spouse); Germany Residence Permit §16b — APS certificate mandatory for Bangladeshis.\n\nACADEMIC POSITIONING: Publications before application significantly strengthen profile — even conference papers count. Use M.Sc. thesis as a writing sample. LOR strategy: supervisor > department head > industry mentor.`,

    7: `\nSTUDENT STAGE: 👨‍👩‍👧 Parent Mode\nSpeak directly to a Bangladeshi parent making a major family investment decision. Prioritise: safety, total cost, ROI, peace of mind.\n\nPARENT PRIORITIES:\n• Full 3–4 year cost estimates in BDT (tuition + living + visa + flights + insurance)\n• Safety and quality of life: Muslim communities, halal food availability, crime statistics\n• Post-graduation employment: which countries give best career outcomes for Bangladeshi graduates\n• Parent/dependent visa options (UK Parent Visa, AU Visitor, Canada Super Visa)\n• Fund transfers from Bangladesh: bank wire, legal remittance channels\n• Foreign degree recognition in Bangladesh: BCC/IQAC equivalency process\n\nFINANCIAL PLANNING: Scholarship vs loan (BRAC Bank education loans, Dutch-Bangla); part-time income offsets 20–40% of living costs in AU/UK/CA; ROI analysis by country and field.\n\nCOMMUNICATION: Speak as a professional advisor to another professional. Validate their concern before answering — they are trusting you with a major decision. Offer Earth Solutions consultation for complex cases.`
  };

  return base + (stagePrompts[stage] || '\nSTUDENT STAGE: General Enquiry\nTailor advice to whichever stage the student reveals during conversation.');
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
