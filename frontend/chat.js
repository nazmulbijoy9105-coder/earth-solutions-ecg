// frontend/chat.js — Peopole AI v6.0
// Earth Solutions Visa Zone | Hybrid FAQ + Groq AI | Session Memory | EN/BN

'use strict';

// ═══════════════════════════════════════════════════════════
// 0. LANGUAGE CONFIG
// ═══════════════════════════════════════════════════════════
const LANG = {
  en: {
    chatTitle: 'Peopole AI',
    topbarSub: 'Earth Solutions Visa Zone, Dhaka',
    newChat: 'New Conversation',
    change: 'Change',
    clearLabel: 'Clear',
    sendLabel: 'Send',
    placeholder: 'Ask about universities, visas, scholarships, SOP writing…',
    disclaimer: 'Peopole AI can make mistakes. Always verify important decisions with an official consultant.',
    faqToggle: 'Common Questions',
    pricingBtn: 'Pricing',
    langBtn: 'বাংলা',
    pmTitle: 'Service Plans & Pricing',
    pmSub: 'Earth Solutions Visa Zone — Choose what fits you',
    pmNote: '⚠️ No visa or admission guarantee. Results depend on individual eligibility.',
    pmFullLink: 'View Full Pricing Page →',
    welcomeMsg: `👋 Welcome to **Peopole AI** — your personal academic and visa guide from **Earth Solutions Visa Zone, Dhaka**.\n\nI can help you with:\n• University selection & admissions\n• Visa requirements & applications\n• Scholarship opportunities\n• SOP, CV & document guidance\n• Study abroad pathways\n\nSelect your academic stage to get started, or just ask me anything!`,
    thinking: 'Thinking…',
    offlineMsg: 'You are offline. Please check your connection.',
    onlineMsg: 'Back online!',
    errorMsg: 'Sorry, I could not connect right now. Please try again.',
    stageNames: {
      1: '🌱 Foundation (Pre-School – Class 5)',
      2: '🔍 Development (Class 6–8)',
      3: '🎯 Strategic (Class 9–12)',
      4: '🎓 Undergraduate (Bachelor\'s)',
      5: '🔬 Master\'s (Postgraduate)',
      6: '🏛️ Doctoral (PhD)',
      7: '👨‍👩‍👧 Parent Mode'
    }
  },
  bn: {
    chatTitle: 'পিপল এআই',
    topbarSub: 'আর্থ সলিউশনস ভিসা জোন, ঢাকা',
    newChat: 'নতুন কথোপকথন',
    change: 'পরিবর্তন',
    clearLabel: 'মুছুন',
    sendLabel: 'পাঠান',
    placeholder: 'বিশ্ববিদ্যালয়, ভিসা, বৃত্তি, এসওপি সম্পর্কে জিজ্ঞাসা করুন…',
    disclaimer: 'পিপল এআই ভুল করতে পারে। সকল গুরুত্বপূর্ণ সিদ্ধান্ত একজন অফিসিয়াল কনসালট্যান্টের সাথে যাচাই করুন।',
    faqToggle: 'সাধারণ প্রশ্ন',
    pricingBtn: 'মূল্য তালিকা',
    langBtn: 'English',
    pmTitle: 'সেবা পরিকল্পনা ও মূল্য',
    pmSub: 'আর্থ সলিউশনস ভিসা জোন — আপনার জন্য সঠিকটি বেছে নিন',
    pmNote: '⚠️ ভিসা বা ভর্তির কোনো গ্যারান্টি নেই। ফলাফল ব্যক্তির যোগ্যতার উপর নির্ভর করে।',
    pmFullLink: 'সম্পূর্ণ মূল্য তালিকা দেখুন →',
    welcomeMsg: `👋 **পিপল এআই**-তে আপনাকে স্বাগতম — **আর্থ সলিউশনস ভিসা জোন, ঢাকা** থেকে আপনার ব্যক্তিগত শিক্ষা ও ভিসা গাইড।\n\nআমি আপনাকে সাহায্য করতে পারি:\n• বিশ্ববিদ্যালয় নির্বাচন ও ভর্তি\n• ভিসার প্রয়োজনীয়তা ও আবেদন\n• বৃত্তির সুযোগ\n• এসওপি, সিভি ও ডকুমেন্ট গাইডেন্স\n• বিদেশে পড়াশোনার পথনির্দেশ\n\nশুরু করতে আপনার একাডেমিক পর্যায় নির্বাচন করুন, বা সরাসরি প্রশ্ন করুন!`,
    thinking: 'চিন্তা করছি…',
    offlineMsg: 'আপনি অফলাইনে আছেন। সংযোগ পরীক্ষা করুন।',
    onlineMsg: 'আবার অনলাইন!',
    errorMsg: 'দুঃখিত, এখন সংযোগ করা সম্ভব হয়নি। আবার চেষ্টা করুন।',
    stageNames: {
      1: '🌱 ফাউন্ডেশন (প্রি-স্কুল – ক্লাস ৫)',
      2: '🔍 ডেভেলপমেন্ট (ক্লাস ৬–৮)',
      3: '🎯 স্ট্র্যাটেজিক (ক্লাস ৯–১২)',
      4: '🎓 আন্ডারগ্রাজুয়েট (ব্যাচেলর)',
      5: '🔬 মাস্টার্স (পোস্টগ্র্যাজুয়েট)',
      6: '🏛️ ডক্টরাল (পিএইচডি)',
      7: '👨‍👩‍👧 পেরেন্ট মোড'
    }
  }
};

// ═══════════════════════════════════════════════════════════
// 1. HYBRID FAQ DATABASE (EN + BN keywords → answer)
// ═══════════════════════════════════════════════════════════
const FAQ_DB = [
  {
    keys: ['pricing','price','cost','fee','fees','মূল্য','খরচ','ফি','দাম','কত'],
    en: `💰 **Our Service Plans:**\n\n🟢 **Basic (Free)** — Unlimited AI chat, 24/7\n💰 **Entry Report — ৳30** — AI university & visa report via WhatsApp\n🔵 **Structured Guidance — ৳100–৳500** — Human consultant + AI risk analysis\n💼 **Mid-Tier Mentorship — ৳500–৳20,000+** — Mentor + full application support\n🔴 **Elite Academic Board** — Call for pricing\n\nClick **Pricing** above to see full details!`,
    bn: `💰 **আমাদের সেবা পরিকল্পনা:**\n\n🟢 **বেসিক (বিনামূল্যে)** — সীমাহীন এআই চ্যাট, ২৪/৭\n💰 **এন্ট্রি রিপোর্ট — ৳৩০** — এআই বিশ্ববিদ্যালয় ও ভিসা রিপোর্ট হোয়াটসঅ্যাপে\n🔵 **স্ট্রাকচার্ড গাইডেন্স — ৳১০০–৳৫০০** — মানব কনসালট্যান্ট + এআই রিস্ক বিশ্লেষণ\n💼 **মিড-টায়ার মেন্টরশিপ — ৳৫০০–৳২০,০০০+** — মেন্টর + সম্পূর্ণ আবেদন সহায়তা\n🔴 **এলিট একাডেমিক বোর্ড** — মূল্যের জন্য ফোন করুন\n\nসম্পূর্ণ বিবরণের জন্য উপরে **মূল্য তালিকা** ক্লিক করুন!`
  },
  {
    keys: ['contact','phone','call','address','location','office','যোগাযোগ','ফোন','ঠিকানা','অফিস'],
    en: `📞 **Contact Earth Solutions:**\n\n📱 Phone: +880 1535-778111\n📍 Address: Panthapath, Dhaka\n💬 WhatsApp: [Chat with us](https://wa.me/8801535778111)\n\nOur consultants are available Saturday–Thursday, 9 AM – 7 PM BST.`,
    bn: `📞 **আর্থ সলিউশনসে যোগাযোগ:**\n\n📱 ফোন: +৮৮০ ১৫৩৫-৭৭৮১১১\n📍 ঠিকানা: পান্থপথ, ঢাকা\n💬 হোয়াটসঅ্যাপ: [আমাদের সাথে চ্যাট করুন](https://wa.me/8801535778111)\n\nআমাদের কনসালট্যান্টরা শনিবার–বৃহস্পতিবার সকাল ৯টা – সন্ধ্যা ৭টা পর্যন্ত উপলব্ধ।`
  },
  {
    keys: ['ielts','english test','language test','band','আইইএলটিএস','ইংরেজি পরীক্ষা'],
    en: `📝 **IELTS Requirements by Destination:**\n\n🇦🇺 **Australia** — 6.0–7.0 (most universities)\n🇨🇦 **Canada** — 6.0–7.0\n🇬🇧 **UK** — 6.0–7.5\n🇳🇿 **New Zealand** — 6.0–6.5\n🇺🇸 **USA** — 6.5–7.0+\n\nSome universities accept **Duolingo**, **PTE**, or **TOEFL** as alternatives. Want specific requirements for a university?`,
    bn: `📝 **গন্তব্য অনুযায়ী আইইএলটিএস প্রয়োজনীয়তা:**\n\n🇦🇺 **অস্ট্রেলিয়া** — ৬.০–৭.০\n🇨🇦 **কানাডা** — ৬.০–৭.০\n🇬🇧 **যুক্তরাজ্য** — ৬.০–৭.৫\n🇳🇿 **নিউজিল্যান্ড** — ৬.০–৬.৫\n🇺🇸 **যুক্তরাষ্ট্র** — ৬.৫–৭.০+\n\nকিছু বিশ্ববিদ্যালয় **ডুওলিঙ্গো**, **পিটিই** বা **টোফেল** বিকল্প হিসেবে গ্রহণ করে। কোনো নির্দিষ্ট বিশ্ববিদ্যালয়ের প্রয়োজনীয়তা জানতে চান?`
  },
  {
    keys: ['scholarship','scholarships','funding','bursary','বৃত্তি','স্কলারশিপ'],
    en: `🎓 **Scholarship Opportunities:**\n\n🌍 **International:**\n• Commonwealth Scholarships (UK)\n• Chevening Scholarship (UK)\n• Fulbright (USA)\n• DAAD (Germany — tuition-free!)\n• Australian Awards\n• Canada Graduate Scholarships\n\n🇧🇩 **For Bangladeshi Students:**\n• Prime Minister's Scholarship\n• ICT Division Scholarships\n• Many university-specific merit awards\n\nWhich country or field are you interested in? I can give you targeted scholarship advice!`,
    bn: `🎓 **বৃত্তির সুযোগ:**\n\n🌍 **আন্তর্জাতিক:**\n• কমনওয়েলথ স্কলারশিপ (যুক্তরাজ্য)\n• শেভেনিং স্কলারশিপ (যুক্তরাজ্য)\n• ফুলব্রাইট (যুক্তরাষ্ট্র)\n• ডিএএডি (জার্মানি — টিউশন ফি নেই!)\n• অস্ট্রেলিয়ান অ্যাওয়ার্ডস\n• কানাডা গ্র্যাজুয়েট স্কলারশিপ\n\n🇧🇩 **বাংলাদেশি শিক্ষার্থীদের জন্য:**\n• প্রধানমন্ত্রীর বৃত্তি\n• আইসিটি বিভাগের বৃত্তি\n• বিভিন্ন বিশ্ববিদ্যালয়ের মেধা পুরস্কার\n\nকোন দেশ বা বিষয়ে আগ্রহী? আমি লক্ষ্যভিত্তিক বৃত্তির পরামর্শ দিতে পারি!`
  },
  {
    keys: ['sop','statement of purpose','personal statement','essay','এসওপি','পার্সোনাল স্টেটমেন্ট'],
    en: `✍️ **Statement of Purpose (SOP) Tips:**\n\n**Structure (800–1000 words):**\n1. Opening hook — your defining moment\n2. Academic background & achievements\n3. Work/research experience\n4. Why this specific university & program\n5. Career goals & how this degree helps\n6. Closing with confidence\n\n**Key Rules:**\n• Be specific — name professors, labs, projects\n• Show passion, not desperation\n• Avoid clichés like "since childhood I dreamed…"\n• Proofread 3+ times\n\nWant me to review or help draft your SOP?`,
    bn: `✍️ **স্টেটমেন্ট অব পারপাস (এসওপি) টিপস:**\n\n**কাঠামো (৮০০–১০০০ শব্দ):**\n১. শুরুতে আকর্ষণীয় সূচনা\n২. একাডেমিক পটভূমি ও অর্জন\n৩. কাজ/গবেষণার অভিজ্ঞতা\n৪. কেন এই নির্দিষ্ট বিশ্ববিদ্যালয় ও প্রোগ্রাম\n৫. ক্যারিয়ার লক্ষ্য ও ডিগ্রি কীভাবে সাহায্য করবে\n৬. আত্মবিশ্বাসী সমাপ্তি\n\n**মূল নিয়ম:**\n• নির্দিষ্ট হন — অধ্যাপক, ল্যাব, প্রজেক্টের নাম উল্লেখ করুন\n• আবেগ দেখান, হতাশা নয়\n• "ছোটবেলা থেকে স্বপ্ন ছিল" জাতীয় ক্লিশে এড়িয়ে চলুন\n\nআপনার এসওপি পর্যালোচনা বা খসড়া করতে সাহায্য করব?`
  },
  {
    keys: ['australia','australian','অস্ট্রেলিয়া'],
    en: `🇦🇺 **Studying in Australia:**\n\n**Top Universities:**\n• University of Melbourne, ANU, University of Sydney\n• University of Queensland, Monash, UNSW\n\n**Key Requirements:**\n• IELTS: 6.0–7.0 | GPA: 3.0+/4.0\n• Student Visa (Subclass 500)\n• Genuine Temporary Entrant (GTE) statement\n• Health insurance (OSHC) mandatory\n\n**Cost:** AUD 20,000–45,000/year (tuition)\n**PR Pathway:** Strong — especially for STEM, healthcare, trades\n\nWhich university or course are you interested in?`,
    bn: `🇦🇺 **অস্ট্রেলিয়ায় পড়াশোনা:**\n\n**শীর্ষ বিশ্ববিদ্যালয়:**\n• ইউনিভার্সিটি অব মেলবোর্ন, এএনইউ, ইউনিভার্সিটি অব সিডনি\n• ইউনিভার্সিটি অব কুইন্সল্যান্ড, মোনাশ, ইউএনএসডব্লিউ\n\n**মূল প্রয়োজনীয়তা:**\n• আইইএলটিএস: ৬.০–৭.০ | জিপিএ: ৩.০+/৪.০\n• স্টুডেন্ট ভিসা (সাবক্লাস ৫০০)\n• জিটিই স্টেটমেন্ট\n• ওএসএইচসি স্বাস্থ্য বিমা বাধ্যতামূলক\n\n**খরচ:** বছরে AUD ২০,০০০–৪৫,০০০ (টিউশন)\n**পিআর পথ:** শক্তিশালী — বিশেষত স্টেম, স্বাস্থ্যসেবা\n\nকোন বিশ্ববিদ্যালয় বা কোর্সে আগ্রহী?`
  },
  {
    keys: ['canada','canadian','কানাডা'],
    en: `🇨🇦 **Studying in Canada:**\n\n**Top Universities:**\n• University of Toronto, McGill, UBC\n• University of Waterloo, McMaster, Alberta\n\n**Key Requirements:**\n• IELTS: 6.0–7.0\n• Study Permit (not a visa — applied separately)\n• Proof of funds: CAD 10,000+/year\n• Letter of Acceptance from DLI\n\n**Cost:** CAD 15,000–35,000/year\n**Post-Study Work:** PGWP up to 3 years → PR pathway\n\nWhich province or program interests you?`,
    bn: `🇨🇦 **কানাডায় পড়াশোনা:**\n\n**শীর্ষ বিশ্ববিদ্যালয়:**\n• ইউনিভার্সিটি অব টরন্টো, ম্যাকগিল, ইউবিসি\n• ইউনিভার্সিটি অব ওয়াটারলু, ম্যাকমাস্টার, আলবার্টা\n\n**মূল প্রয়োজনীয়তা:**\n• আইইএলটিএস: ৬.০–৭.০\n• স্টাডি পারমিট (ভিসা থেকে আলাদা)\n• প্রমাণিত তহবিল: বছরে CAD ১০,০০০+\n• ডিএলআই থেকে গ্রহণযোগ্যতা পত্র\n\n**খরচ:** বছরে CAD ১৫,০০০–৩৫,০০০\n**পড়াশোনার পর কাজ:** পিজিডব্লিউপি ৩ বছর পর্যন্ত → পিআর পথ\n\nকোন প্রদেশ বা প্রোগ্রামে আগ্রহী?`
  },
  {
    keys: ['uk','united kingdom','england','britain','যুক্তরাজ্য','ইংল্যান্ড'],
    en: `🇬🇧 **Studying in the UK:**\n\n**Top Universities:**\n• Oxford, Cambridge, Imperial College London\n• UCL, LSE, King's College London, Edinburgh\n\n**Key Requirements:**\n• IELTS: 6.0–7.5\n• Student Visa (Tier 4)\n• CAS from university\n• Financial proof: £1,334/month in London\n\n**Cost:** £15,000–£38,000/year\n**Duration:** BSc 3 years | MSc 1 year (faster!)\n**Post-Study:** Graduate Route — 2 years work visa`,
    bn: `🇬🇧 **যুক্তরাজ্যে পড়াশোনা:**\n\n**শীর্ষ বিশ্ববিদ্যালয়:**\n• অক্সফোর্ড, কেমব্রিজ, ইম্পেরিয়াল কলেজ লন্ডন\n• ইউসিএল, এলএসই, কিংস কলেজ লন্ডন, এডিনবার্গ\n\n**মূল প্রয়োজনীয়তা:**\n• আইইএলটিএস: ৬.০–৭.৫\n• স্টুডেন্ট ভিসা (টায়ার ৪)\n• বিশ্ববিদ্যালয় থেকে ক্যাস\n• আর্থিক প্রমাণ: লন্ডনে মাসে £১,৩৩৪\n\n**খরচ:** বছরে £১৫,০০০–£৩৮,০০০\n**সময়কাল:** বিএসসি ৩ বছর | এমএসসি মাত্র ১ বছর!\n**পড়াশোনার পর:** গ্র্যাজুয়েট রুট — ২ বছর কাজের ভিসা`
  },
  {
    keys: ['germany','german','জার্মানি'],
    en: `🇩🇪 **Studying in Germany:**\n\n🎉 **Public universities are mostly TUITION-FREE** (even for internationals!)\n\n**Top Universities:**\n• TU Munich, LMU Munich, Heidelberg, Berlin FU\n\n**Requirements:**\n• Language: German (B2/C1) OR English programs available\n• IELTS 6.0–6.5 for English programs\n• APS certificate (mandatory for Bangladeshi students)\n• Blocked account: €11,208/year (approx.)\n\n**Cost:** Only semester fees (~€150–350) + living costs\n\nGreat for engineering, medicine, and sciences!`,
    bn: `🇩🇪 **জার্মানিতে পড়াশোনা:**\n\n🎉 **সরকারি বিশ্ববিদ্যালয়ে টিউশন ফি প্রায় নেই** (বিদেশিদের জন্যও!)\n\n**শীর্ষ বিশ্ববিদ্যালয়:**\n• টিইউ মিউনিখ, এলএমইউ মিউনিখ, হাইডেলবার্গ\n\n**প্রয়োজনীয়তা:**\n• ভাষা: জার্মান (বি২/সি১) অথবা ইংরেজি প্রোগ্রাম\n• ইংরেজি প্রোগ্রামে আইইএলটিএস ৬.০–৬.৫\n• এপিএস সার্টিফিকেট (বাংলাদেশি শিক্ষার্থীদের জন্য বাধ্যতামূলক)\n• ব্লকড অ্যাকাউন্ট: বছরে €১১,২০৮\n\n**খরচ:** শুধু সেমিস্টার ফি (~€১৫০–৩৫০) + জীবনযাত্রার খরচ\n\nইঞ্জিনিয়ারিং, মেডিসিন ও বিজ্ঞানের জন্য অসাধারণ!`
  },
  {
    keys: ['visa','student visa','ভিসা','স্টুডেন্ট ভিসা'],
    en: `🛂 **Student Visa — Key Steps:**\n\n1. **Get admission** → Acceptance letter from university\n2. **Prepare documents:** Passport, transcripts, IELTS, financial proof, photos\n3. **Apply visa** → Embassy/consulate or online\n4. **Health check** → Required for Australia, UK, Canada\n5. **Wait for decision** → 4–12 weeks typically\n6. **Book flight** after visa approval\n\n**Common Rejection Reasons:**\n• Weak financial proof\n• Poor GTE/genuineness statement\n• Incomplete documents\n• Visa history issues\n\nWhich country's visa are you applying for?`,
    bn: `🛂 **স্টুডেন্ট ভিসা — মূল ধাপ:**\n\n১. **ভর্তি পান** → বিশ্ববিদ্যালয় থেকে গ্রহণযোগ্যতা পত্র\n২. **ডকুমেন্ট প্রস্তুত করুন:** পাসপোর্ট, ট্রান্সক্রিপ্ট, আইইএলটিএস, আর্থিক প্রমাণ, ছবি\n৩. **ভিসা আবেদন করুন** → দূতাবাস বা অনলাইনে\n৪. **স্বাস্থ্য পরীক্ষা** → অস্ট্রেলিয়া, যুক্তরাজ্য, কানাডার জন্য প্রয়োজন\n৫. **সিদ্ধান্তের জন্য অপেক্ষা করুন** → সাধারণত ৪–১২ সপ্তাহ\n৬. **ভিসা অনুমোদনের পর ফ্লাইট বুক করুন**\n\n**প্রত্যাখ্যানের সাধারণ কারণ:**\n• দুর্বল আর্থিক প্রমাণ\n• জিটিই স্টেটমেন্ট দুর্বল\n• অসম্পূর্ণ ডকুমেন্ট\n\nকোন দেশের ভিসার জন্য আবেদন করছেন?`
  }
];

// ═══════════════════════════════════════════════════════════
// 2. FAQ — STAGE-BASED QUICK QUESTIONS
// ═══════════════════════════════════════════════════════════
const STAGE_FAQS = {
  en: {
    1: ['What subjects should I focus on?','How early can I plan for abroad?','Is O level or SSC better for foreign universities?'],
    2: ['What activities build my profile?','When should I start IELTS prep?','Which countries are easiest to get into?'],
    3: ['What GPA do I need for abroad?','SAT vs A-levels — which to take?','Which countries are best for A-level students?'],
    4: ['What IELTS band do I need?','How much does it cost to study in Australia?','Can I work while studying?','Which country has the best PR pathway?'],
    5: ['What are the top universities for Masters?','How do I write a strong SOP?','Is a scholarship possible for Masters?','What is DAAD?'],
    6: ['How to find a PhD supervisor?','What is funded PhD?','Which countries fund international PhD students?'],
    7: ['How much will my child\'s education cost?','Which country is safest for students?','How do I support my child\'s application?']
  },
  bn: {
    1: ['কোন বিষয়গুলোতে মনোযোগ দেওয়া উচিত?','বিদেশে পড়ার পরিকল্পনা কখন শুরু করব?','ও লেভেল না এসএসসি — কোনটা ভালো?'],
    2: ['কোন কার্যক্রম প্রোফাইল গড়তে সাহায্য করে?','আইইএলটিএস প্রস্তুতি কখন শুরু করব?','কোন দেশে সহজে ভর্তি হওয়া যায়?'],
    3: ['বিদেশে পড়তে কত জিপিএ দরকার?','স্যাট না এ-লেভেল — কোনটা নেব?','এ-লেভেল শিক্ষার্থীদের জন্য কোন দেশ সেরা?'],
    4: ['কত ব্যান্ড আইইএলটিএস দরকার?','অস্ট্রেলিয়ায় পড়তে কত খরচ?','পড়ার সময় কাজ করা যাবে?','পিআরের সুযোগ কোন দেশে বেশি?'],
    5: ['মাস্টার্সের জন্য সেরা বিশ্ববিদ্যালয় কোনগুলো?','শক্তিশালী এসওপি কীভাবে লিখব?','মাস্টার্সে বৃত্তি পাওয়া সম্ভব?','ডিএএডি কী?'],
    6: ['পিএইচডি সুপারভাইজার কীভাবে খুঁজব?','ফান্ডেড পিএইচডি কী?','কোন দেশ আন্তর্জাতিক পিএইচডি শিক্ষার্থীদের ফান্ড দেয়?'],
    7: ['আমার সন্তানের শিক্ষায় কত খরচ হবে?','শিক্ষার্থীদের জন্য কোন দেশ নিরাপদ?','সন্তানের আবেদনে কীভাবে সাহায্য করব?']
  }
};

// ═══════════════════════════════════════════════════════════
// 3. APP STATE
// ═══════════════════════════════════════════════════════════
let lang        = 'en';
let stage       = null;
let memory      = [];   // session conversation memory
let isTyping    = false;
let isOnline    = navigator.onLine;

// ═══════════════════════════════════════════════════════════
// 4. DOM REFERENCES
// ═══════════════════════════════════════════════════════════
const $ = id => document.getElementById(id);

const els = {
  stageBackdrop:    $('stageModalBackdrop'),
  overlay:          $('overlay'),
  sidebar:          $('sidebar'),
  newChatBtn:       $('newChatBtn'),
  stageBadgeWrap:   $('stageBadgeWrap'),
  stageBadge:       $('stageBadge'),
  stageChangeBtn:   $('stageChangeBtn'),
  offlineBar:       $('offlineBar'),
  menuBtn:          $('menuBtn'),
  chatTitle:        $('chatTitle'),
  topbarSub:        $('topbarSub'),
  statusDot:        $('statusDot'),
  pricingBtnLabel:  $('pricingBtnLabel'),
  langBtn:          $('langBtn'),
  clearBtn:         $('clearBtn'),
  messages:         $('messages'),
  faqArea:          $('faqArea'),
  faqToggleLabel:   $('faqToggleLabel'),
  faqPanel:         $('faqPanel'),
  faqArrow:         $('faqArrow'),
  messageInput:     $('messageInput'),
  sendBtn:          $('sendBtn'),
  disclaimerEl:     $('disclaimerEl'),
  pricingBackdrop:  $('pricingModalBackdrop'),
  pmTitle:          $('pmTitle'),
  pmSub:            $('pmSub'),
  pmNote:           $('pmNote'),
  pmFullLink:       $('pmFullLink'),
  clearLabel:       document.querySelector('.clear-label'),
  sendLabel:        document.querySelector('.send-label'),
};

// ═══════════════════════════════════════════════════════════
// 5. LANGUAGE TOGGLE
// ═══════════════════════════════════════════════════════════
function setLang(newLang) {
  lang = newLang;
  const t = LANG[lang];

  document.body.classList.toggle('bn-mode', lang === 'bn');

  els.chatTitle.textContent        = t.chatTitle;
  els.topbarSub.textContent        = t.topbarSub;
  els.newChatBtn.innerHTML         = `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M12 5v14M5 12h14"/></svg> ${t.newChat}`;
  if (els.stageChangeBtn) els.stageChangeBtn.textContent = t.change;
  els.langBtn.textContent          = t.langBtn;
  els.messageInput.placeholder     = t.placeholder;
  els.disclaimerEl.textContent     = t.disclaimer;
  els.faqToggleLabel.textContent   = t.faqToggle;
  els.pricingBtnLabel.textContent  = t.pricingBtn;
  if (els.clearLabel)  els.clearLabel.textContent  = t.clearLabel;
  if (els.sendLabel)   els.sendLabel.textContent   = t.sendLabel;

  // Pricing modal labels
  if (els.pmTitle)    els.pmTitle.textContent    = t.pmTitle;
  if (els.pmSub)      els.pmSub.textContent      = t.pmSub;
  if (els.pmNote)     els.pmNote.textContent     = t.pmNote;
  if (els.pmFullLink) els.pmFullLink.textContent = t.pmFullLink;

  // Update stage badge text if stage is set
  if (stage) {
    els.stageBadge.textContent = t.stageNames[stage] || `Stage ${stage}`;
  }

  // Rebuild FAQ panel
  buildFAQPanel();
}

// ═══════════════════════════════════════════════════════════
// 6. STAGE MODAL
// ═══════════════════════════════════════════════════════════
function showStageModal() {
  els.stageBackdrop.classList.remove('hidden');
  document.body.style.overflow = 'hidden';
}
function hideStageModal() {
  els.stageBackdrop.classList.add('hidden');
  document.body.style.overflow = '';
}
function selectStage(s) {
  stage = s;
  hideStageModal();
  const t = LANG[lang];
  els.stageBadge.textContent    = t.stageNames[s] || `Stage ${s}`;
  els.stageBadgeWrap.style.display = 'flex';

  // Build system prompt for this stage
  startNewSession();
  buildFAQPanel();
}

// ═══════════════════════════════════════════════════════════
// 7. SESSION MEMORY & NEW CHAT
// ═══════════════════════════════════════════════════════════
function startNewSession() {
  memory = [];
  els.messages.innerHTML = '';
  // Show welcome message
  const t = LANG[lang];
  addMessage('assistant', t.welcomeMsg);
}

function getSystemPrompt() {
  const stageNames = LANG.en.stageNames;
  const stageName  = stage ? stageNames[stage] : 'General';
  return `You are Peopole AI, a warm, expert academic and visa consultant from Earth Solutions Visa Zone, Dhaka, Bangladesh.

Student Academic Stage: ${stageName}
Current Language Mode: ${lang === 'bn' ? 'Bengali (বাংলা)' : 'English'}

RULES:
- Always respond in ${lang === 'bn' ? 'Bengali (বাংলা)' : 'English'} unless the user switches language
- Be concise, practical, and encouraging
- Use bullet points and structure for clarity
- For ${stageName} students, tailor advice to their level
- Always relate advice to Bangladesh context when relevant
- If asked about pricing, mention Earth Solutions service plans
- If asked about contact, share: +880 1535-778111, Panthapath Dhaka, WhatsApp available
- For visa questions, always advise consulting an official consultant for final decisions
- Be honest about limitations — don't guarantee visa/admission outcomes
- Keep responses under 400 words unless more detail is genuinely needed`;
}

// ═══════════════════════════════════════════════════════════
// 8. FAQ MATCHING (instant pre-defined answers)
// ═══════════════════════════════════════════════════════════
function matchFAQ(text) {
  const lower = text.toLowerCase();
  for (const item of FAQ_DB) {
    if (item.keys.some(k => lower.includes(k))) {
      return lang === 'bn' ? item.bn : item.en;
    }
  }
  return null;
}

// ═══════════════════════════════════════════════════════════
// 9. FAQ PANEL (common questions chips)
// ═══════════════════════════════════════════════════════════
function buildFAQPanel() {
  if (!els.faqPanel) return;
  const questions = (STAGE_FAQS[lang] && STAGE_FAQS[lang][stage]) || STAGE_FAQS[lang]?.[4] || [];
  els.faqPanel.innerHTML = '';
  questions.forEach(q => {
    const btn = document.createElement('button');
    btn.className   = 'qp';
    btn.textContent = q;
    btn.onclick     = () => {
      els.messageInput.value = q;
      sendMessage();
      closeFAQPanel();
    };
    els.faqPanel.appendChild(btn);
  });
}

let faqOpen = false;
function toggleFAQ() {
  faqOpen = !faqOpen;
  els.faqPanel.style.display  = faqOpen ? 'flex' : 'none';
  els.faqArrow.style.transform = faqOpen ? 'rotate(180deg)' : '';
}
function closeFAQPanel() {
  faqOpen = false;
  if (els.faqPanel) els.faqPanel.style.display = 'none';
  if (els.faqArrow) els.faqArrow.style.transform = '';
}

// ═══════════════════════════════════════════════════════════
// 10. RENDER MESSAGES
// ═══════════════════════════════════════════════════════════
function renderMarkdown(text) {
  return text
    .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
    .replace(/\*(.+?)\*/g, '<em>$1</em>')
    .replace(/\[(.+?)\]\((https?:\/\/.+?)\)/g, '<a href="$2" target="_blank" rel="noopener">$1</a>')
    .replace(/^• (.+)$/gm, '<li>$1</li>')
    .replace(/^(\d+)\. (.+)$/gm, '<li>$2</li>')
    .replace(/(<li>.*<\/li>)/gs, '<ul>$1</ul>')
    .replace(/\n/g, '<br>');
}

function addMessage(role, text, streaming = false) {
  const wrap = document.createElement('div');
  wrap.className = `msg ${role}`;

  const bubble = document.createElement('div');
  bubble.className = 'msg-text';

  if (streaming) {
    bubble.textContent = text;
  } else {
    bubble.innerHTML = renderMarkdown(text);
  }

  wrap.appendChild(bubble);

  // Timestamp
  const ts = document.createElement('div');
  ts.className = 'msg-time';
  ts.textContent = new Date().toLocaleTimeString([], { hour:'2-digit', minute:'2-digit' });
  wrap.appendChild(ts);

  els.messages.appendChild(wrap);
  els.messages.scrollTop = els.messages.scrollHeight;
  return bubble;
}

function addTypingIndicator() {
  const wrap = document.createElement('div');
  wrap.className = 'msg assistant typing-wrap';
  wrap.id = 'typingIndicator';
  wrap.innerHTML = `<div class="msg-text typing"><span></span><span></span><span></span></div>`;
  els.messages.appendChild(wrap);
  els.messages.scrollTop = els.messages.scrollHeight;
}
function removeTypingIndicator() {
  const el = $('typingIndicator');
  if (el) el.remove();
}

// ═══════════════════════════════════════════════════════════
// 11. SEND MESSAGE (Hybrid FAQ + AI)
// ═══════════════════════════════════════════════════════════
async function sendMessage() {
  const text = els.messageInput.value.trim();
  if (!text || isTyping) return;

  els.messageInput.value = '';
  autoResize();
  isTyping = true;
  els.sendBtn.disabled = true;

  // Add user message to UI & memory
  addMessage('user', text);
  memory.push({ role: 'user', content: text });

  // 1. Try FAQ match first (instant)
  const faqAnswer = matchFAQ(text);
  if (faqAnswer) {
    await sleep(300); // brief delay so it feels natural
    const bubble = addMessage('assistant', faqAnswer);
    memory.push({ role: 'assistant', content: faqAnswer });
    isTyping = false;
    els.sendBtn.disabled = false;
    return;
  }

  // 2. Fallback to AI (streaming)
  addTypingIndicator();

  try {
    const response = await fetch('/api/chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        messages: memory.slice(-20), // last 20 messages for context window
        system: getSystemPrompt(),
        stage: stage,
        lang: lang
      })
    });

    if (!response.ok) throw new Error(`HTTP ${response.status}`);

    removeTypingIndicator();

    // Create streaming bubble
    const wrap = document.createElement('div');
    wrap.className = 'msg assistant';
    const bubble = document.createElement('div');
    bubble.className = 'msg-text';
    wrap.appendChild(bubble);
    const ts = document.createElement('div');
    ts.className = 'msg-time';
    ts.textContent = new Date().toLocaleTimeString([], { hour:'2-digit', minute:'2-digit' });
    wrap.appendChild(ts);
    els.messages.appendChild(wrap);

    // Read SSE stream
    const reader  = response.body.getReader();
    const decoder = new TextDecoder();
    let fullText  = '';
    let buffer    = '';

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split('\n');
      buffer = lines.pop(); // keep incomplete line

      for (const line of lines) {
        if (!line.startsWith('data:')) continue;
        const payload = line.slice(5).trim();
        if (!payload || payload === '[DONE]') continue;

        try {
          const parsed = JSON.parse(payload);
          if (parsed.error) throw new Error(parsed.error);
          const delta = parsed.choices?.[0]?.delta?.content || '';
          if (delta) {
            fullText += delta;
            bubble.innerHTML = renderMarkdown(fullText);
            els.messages.scrollTop = els.messages.scrollHeight;
          }
        } catch (_) {}
      }
    }

    if (fullText) {
      memory.push({ role: 'assistant', content: fullText });
    }

  } catch (err) {
    removeTypingIndicator();
    const errMsg = isOnline ? LANG[lang].errorMsg : LANG[lang].offlineMsg;
    addMessage('assistant', `⚠️ ${errMsg}`);
    console.error('[Peopole AI]', err.message);
  }

  isTyping = false;
  els.sendBtn.disabled = false;
}

const sleep = ms => new Promise(r => setTimeout(r, ms));

// ═══════════════════════════════════════════════════════════
// 12. PRICING MODAL (global functions called from HTML)
// ═══════════════════════════════════════════════════════════
window.openPricingModal = function () {
  if (els.pricingBackdrop) {
    els.pricingBackdrop.classList.remove('hidden');
    document.body.style.overflow = 'hidden';
  }
};
window.closePricingModal = function () {
  if (els.pricingBackdrop) {
    els.pricingBackdrop.classList.add('hidden');
    document.body.style.overflow = '';
  }
};
window.closePricingOnBackdrop = function (e) {
  if (e.target === els.pricingBackdrop) window.closePricingModal();
};
window.selectPlan = function (planId) {
  // Highlight selected plan — visual feedback only
  document.querySelectorAll('.pm-plan').forEach(el => el.classList.remove('pm-selected'));
  const planEl = document.querySelector(`.pm-plan.${planId}`);
  if (planEl) planEl.classList.add('pm-selected');
};

// ═══════════════════════════════════════════════════════════
// 13. CLEAR CONVERSATION
// ═══════════════════════════════════════════════════════════
function clearConversation() {
  if (els.messages) {
    els.messages.innerHTML = '';
    memory = [];
    const t = LANG[lang];
    addMessage('assistant', t.welcomeMsg);
  }
}

// ═══════════════════════════════════════════════════════════
// 14. SIDEBAR TOGGLE
// ═══════════════════════════════════════════════════════════
function toggleSidebar() {
  const open = els.sidebar.classList.toggle('open');
  els.overlay.classList.toggle('active', open);
}
function closeSidebar() {
  els.sidebar.classList.remove('open');
  els.overlay.classList.remove('active');
}

// ═══════════════════════════════════════════════════════════
// 15. INPUT AUTO-RESIZE + KEYBOARD SEND
// ═══════════════════════════════════════════════════════════
function autoResize() {
  const el = els.messageInput;
  el.style.height = 'auto';
  el.style.height = Math.min(el.scrollHeight, 140) + 'px';
}

// ═══════════════════════════════════════════════════════════
// 16. ONLINE / OFFLINE DETECTION
// ═══════════════════════════════════════════════════════════
function updateOnlineStatus() {
  isOnline = navigator.onLine;
  if (els.offlineBar) els.offlineBar.style.display = isOnline ? 'none' : 'flex';
  if (els.statusDot)  {
    els.statusDot.style.background = isOnline ? 'var(--teal, #1ec8b0)' : '#e05c7a';
    els.statusDot.title = isOnline ? 'Online' : 'Offline';
  }
}

// ═══════════════════════════════════════════════════════════
// 17. EVENT LISTENERS
// ═══════════════════════════════════════════════════════════
function bindEvents() {
  // Stage cards
  document.querySelectorAll('.stage-card').forEach(card => {
    card.addEventListener('click', () => selectStage(parseInt(card.dataset.stage)));
  });

  // Change stage button
  if (els.stageChangeBtn) els.stageChangeBtn.addEventListener('click', showStageModal);

  // New chat
  if (els.newChatBtn) els.newChatBtn.addEventListener('click', () => {
    clearConversation();
    closeSidebar();
  });

  // Menu toggle
  if (els.menuBtn) els.menuBtn.addEventListener('click', toggleSidebar);

  // Overlay close
  if (els.overlay) els.overlay.addEventListener('click', closeSidebar);

  // Language toggle
  if (els.langBtn) els.langBtn.addEventListener('click', () => {
    setLang(lang === 'en' ? 'bn' : 'en');
  });

  // Clear
  if (els.clearBtn) els.clearBtn.addEventListener('click', clearConversation);

  // Send button
  if (els.sendBtn) els.sendBtn.addEventListener('click', sendMessage);

  // Textarea keyboard
  if (els.messageInput) {
    els.messageInput.addEventListener('keydown', e => {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        sendMessage();
      }
    });
    els.messageInput.addEventListener('input', autoResize);
  }

  // Online/offline
  window.addEventListener('online',  updateOnlineStatus);
  window.addEventListener('offline', updateOnlineStatus);
}

// ═══════════════════════════════════════════════════════════
// 18. INIT
// ═══════════════════════════════════════════════════════════
function init() {
  bindEvents();
  updateOnlineStatus();
  buildFAQPanel();
  setLang('en');       // default language

  // Show welcome message (no stage selected yet)
  addMessage('assistant', LANG.en.welcomeMsg);

  // Show stage modal after brief delay
  setTimeout(showStageModal, 600);
}

document.addEventListener('DOMContentLoaded', init);
