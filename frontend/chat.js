/* Peopole AI — frontend/chat.js v4.0 — Bangla + English */

const API_URL     = '/api/chat';
const STORAGE_KEY = 'peopole_chats_v3';
const STAGE_KEY   = 'peopole_stage_v3';
const LANG_KEY    = 'peopole_lang_v1';
const AI_NAME     = 'Peopole AI';

// ── Language Strings ─────────────────────────────────────
const STRINGS = {
  en: {
    newChat:        'New Conversation',
    change:         'Change',
    offlineBar:     'You are offline',
    whatsappBtn:    'WhatsApp Us',
    contactTitle:   'Contact',
    location:       'Panthapath, Dhaka',
    pricing:        '📋 View Service Plans & Pricing →',
    clear:          'Clear',
    whatsapp:       'WhatsApp',
    placeholder:    'Ask about universities, visas, scholarships, SOP writing…',
    disclaimer:     'Peopole AI can make mistakes. Always verify important decisions with an official consultant.',
    modalTitle:     'Welcome to',
    modalSub:       'Select your current academic stage to get personalised guidance',
    chatTitle:      'Peopole AI',
    topbarSub:      'Earth Solutions Visa Zone, Dhaka',
    langBtn:        'বাংলা',
    greetings: {
      1: "🌱 Welcome to Foundation stage! I'm here to make learning fun and easy.",
      2: "🔍 Development stage selected. Let's sharpen your study skills!",
      3: "🎯 Strategic stage ready. Exam prep and career guidance starts now.",
      4: "🎓 Undergraduate guidance activated. Let's plan your university journey.",
      5: "🔬 Master's guidance activated. Ready to dive into research?",
      6: "🏛️ Doctoral research mode. Let's advance your academic work.",
      7: "👨‍👩‍👧 Parent advisory mode. I'm here to guide your child's education journey."
    },
    offlineReplies: {
      default: "⚠️ Offline mode — please reconnect to get AI responses.",
      1: "Offline: Foundation stage guidance paused.",
      2: "Offline: Development stage guidance paused.",
      3: "Offline: Strategic stage guidance paused.",
      4: "Offline: Undergraduate guidance paused.",
      5: "Offline: Master's guidance paused.",
      6: "Offline: Doctoral guidance paused.",
      7: "Offline: Parent advisory paused."
    },
    stages: {
      1: { label: "Foundation",    range: "Pre-School – Class 5",              num: "Stage 1" },
      2: { label: "Development",   range: "Class 6 – 8",                       num: "Stage 2" },
      3: { label: "Strategic",     range: "Class 9 – 12",                      num: "Stage 3" },
      4: { label: "Undergraduate", range: "Bachelor's Degree",                 num: "Stage 4" },
      5: { label: "Master's",      range: "Postgraduate",                      num: "Stage 5" },
      6: { label: "Doctoral",      range: "PhD Research",                      num: "Stage 6" },
      7: { label: "Parent Mode",   range: "Education & Career Guidance",       num: "Stage 7" }
    },
    faqs: {
      1: [
        "What subjects are most important in primary school?",
        "How can I make studying more fun for my child?",
        "What after-school activities help development?",
        "How do I improve my child's reading skills?",
        "What age should a child start learning English?"
      ],
      2: [
        "How do I prepare for JSC exams?",
        "Which subjects should I focus on in Class 6–8?",
        "How can I improve my English speaking skills?",
        "What extra-curricular activities look good for university?",
        "How many hours should I study daily?"
      ],
      3: [
        "How to get a GPA 5 in SSC/HSC exams?",
        "What career paths are best after Class 12?",
        "Should I take Science, Commerce, or Arts?",
        "How do I prepare for admission tests?",
        "What are the top universities in Bangladesh?"
      ],
      4: [
        "How do I apply to universities abroad?",
        "What scholarships are available for Bangladeshi students?",
        "Which countries are easiest to get student visa?",
        "How much does a bachelor's degree cost in Malaysia?",
        "What is IELTS and how much score do I need?"
      ],
      5: [
        "How do I find a funded Master's program?",
        "What GRE score do I need for US universities?",
        "How to write a Statement of Purpose (SOP)?",
        "Which countries offer free Master's for Bangladeshis?",
        "What is the difference between thesis and non-thesis Master's?"
      ],
      6: [
        "How do I find a PhD supervisor abroad?",
        "What is a fully funded PhD scholarship?",
        "How do I write a research proposal?",
        "Which countries have the best PhD programs?",
        "How long does a PhD take on average?"
      ],
      7: [
        "What is the best country for my child's education?",
        "How much money should I prepare for my child's studies?",
        "Is a student visa easy to get for Malaysia?",
        "What is the safest country for Bangladeshi students?",
        "How can Earth Solutions help my child study abroad?"
      ]
    },
    prompts: {
      1: ["What subjects are most important?", "Fun study tips for kids"],
      2: ["How to prepare for JSC?", "Daily study schedule tips"],
      3: ["How to get GPA 5 in SSC?", "Best career paths after Class 12"],
      4: ["How to apply abroad?", "Available scholarships"],
      5: ["How to find a funded Master's?", "How to write an SOP?"],
      6: ["How to find a PhD supervisor?", "Fully funded PhD info"],
      7: ["Best countries for my child?", "How to plan study abroad budget?"]
    },
    pricingBtn:   'Pricing',
    pmTitle:      'Service Plans & Pricing',
    pmSub:        'Earth Solutions Visa Zone — Choose what fits you',
    pmNote:       '⚠️ No visa or admission guarantee. Results depend on individual eligibility.',
    pmFullLink:   'View Full Pricing Page →',
    systemPrompt: (label, range) =>
      `You are Peopole AI, an expert academic and visa consultant from Earth Solutions Visa Zone, Dhaka, Bangladesh. You are helping a student at ${label} level (${range}). Be concise, warm, and give practical guidance tailored to their stage. For visa queries always recommend verifying with official sources. Respond in English.`,
    systemDefault:
      `You are Peopole AI, an expert academic and visa consultant from Earth Solutions Visa Zone, Dhaka, Bangladesh. Respond in English.`
  },

  bn: {
    newChat:        'নতুন কথোপকথন',
    change:         'পরিবর্তন',
    offlineBar:     'আপনি অফলাইনে আছেন',
    whatsappBtn:    'হোয়াটসঅ্যাপ করুন',
    contactTitle:   'যোগাযোগ',
    location:       'পান্থপথ, ঢাকা',
    pricing:        '📋 সার্ভিস প্ল্যান ও মূল্য দেখুন →',
    clear:          'মুছুন',
    whatsapp:       'হোয়াটসঅ্যাপ',
    placeholder:    'বিশ্ববিদ্যালয়, ভিসা, বৃত্তি বা SOP সম্পর্কে জিজ্ঞাসা করুন…',
    disclaimer:     'Peopole AI ভুল করতে পারে। গুরুত্বপূর্ণ সিদ্ধান্তের আগে সরাসরি পরামর্শদাতার সাথে যাচাই করুন।',
    modalTitle:     'স্বাগতম',
    modalSub:       'আপনার বর্তমান পর্যায় বেছে নিন ব্যক্তিগত গাইডেন্সের জন্য',
    chatTitle:      'Peopole AI',
    topbarSub:      'আর্থ সলিউশন্স ভিসা জোন, ঢাকা',
    langBtn:        'English',
    greetings: {
      1: "🌱 ফাউন্ডেশন পর্যায়ে স্বাগতম! শেখাকে মজাদার করতে আমি এখানে আছি।",
      2: "🔍 ডেভেলপমেন্ট পর্যায় বেছে নেওয়া হয়েছে। পড়ার দক্ষতা বাড়াই একসাথে!",
      3: "🎯 স্ট্র্যাটেজিক পর্যায় শুরু। পরীক্ষার প্রস্তুতি ও ক্যারিয়ার গাইডেন্স শুরু হোক।",
      4: "🎓 আন্ডারগ্র্যাজুয়েট গাইডেন্স চালু। বিশ্ববিদ্যালয় যাত্রা পরিকল্পনা করি।",
      5: "🔬 মাস্টার্স গাইডেন্স চালু। গবেষণায় ডুব দিতে প্রস্তুত?",
      6: "🏛️ ডক্টরাল রিসার্চ মোড। আপনার একাডেমিক কাজ এগিয়ে নিই।",
      7: "👨‍👩‍👧 অভিভাবক মোড। আপনার সন্তানের শিক্ষা যাত্রায় গাইড করতে এখানে আছি।"
    },
    offlineReplies: {
      default: "⚠️ অফলাইন মোড — AI সাড়া পেতে পুনরায় সংযুক্ত হন।",
      1: "অফলাইন: ফাউন্ডেশন গাইডেন্স বিরাম নিয়েছে।",
      2: "অফলাইন: ডেভেলপমেন্ট গাইডেন্স বিরাম নিয়েছে।",
      3: "অফলাইন: স্ট্র্যাটেজিক গাইডেন্স বিরাম নিয়েছে।",
      4: "অফলাইন: আন্ডারগ্র্যাজুয়েট গাইডেন্স বিরাম নিয়েছে।",
      5: "অফলাইন: মাস্টার্স গাইডেন্স বিরাম নিয়েছে।",
      6: "অফলাইন: ডক্টরাল গাইডেন্স বিরাম নিয়েছে।",
      7: "অফলাইন: অভিভাবক পরামর্শ বিরাম নিয়েছে।"
    },
    stages: {
      1: { label: "ফাউন্ডেশন",      range: "প্রাক-বিদ্যালয় – ক্লাস ৫",       num: "পর্যায় ১" },
      2: { label: "ডেভেলপমেন্ট",    range: "ক্লাস ৬ – ৮",                      num: "পর্যায় ২" },
      3: { label: "স্ট্র্যাটেজিক",  range: "ক্লাস ৯ – ১২",                     num: "পর্যায় ৩" },
      4: { label: "আন্ডারগ্র্যাজুয়েট", range: "ব্যাচেলর ডিগ্রি",              num: "পর্যায় ৪" },
      5: { label: "মাস্টার্স",       range: "স্নাতকোত্তর",                      num: "পর্যায় ৫" },
      6: { label: "ডক্টরাল",         range: "পিএইচডি গবেষণা",                   num: "পর্যায় ৬" },
      7: { label: "অভিভাবক মোড",    range: "শিক্ষা ও ক্যারিয়ার গাইডেন্স",    num: "পর্যায় ৭" }
    },
    faqs: {
      1: [
        "প্রাথমিক স্কুলে কোন বিষয়গুলো সবচেয়ে গুরুত্বপূর্ণ?",
        "আমার সন্তানের পড়াকে কীভাবে মজাদার করা যায়?",
        "ইংরেজি শেখার সঠিক বয়স কখন?",
        "কীভাবে সন্তানের পড়ার অভ্যাস তৈরি করব?",
        "প্রাথমিক শিক্ষায় সহায়ক কার্যক্রম কোনগুলো?"
      ],
      2: [
        "JSC পরীক্ষার প্রস্তুতি কীভাবে নেব?",
        "ক্লাস ৬–৮ এ কোন বিষয়ে বেশি মনোযোগ দেব?",
        "ইংরেজি স্পিকিং স্কিল কীভাবে উন্নত করব?",
        "দিনে কত ঘণ্টা পড়া উচিত?",
        "কোন এক্সট্রা কারিকুলার অ্যাক্টিভিটি ভালো?"
      ],
      3: [
        "SSC/HSC তে GPA ৫ পেতে কী করব?",
        "বিজ্ঞান, বাণিজ্য না মানবিক — কোনটি বেছে নেব?",
        "ভর্তি পরীক্ষার প্রস্তুতি কীভাবে নেব?",
        "ক্লাস ১২ এর পরে সেরা ক্যারিয়ার পথ কোনগুলো?",
        "বাংলাদেশের শীর্ষ বিশ্ববিদ্যালয় কোনগুলো?"
      ],
      4: [
        "বিদেশে বিশ্ববিদ্যালয়ে আবেদন করব কীভাবে?",
        "বাংলাদেশি শিক্ষার্থীদের জন্য কোন বৃত্তি আছে?",
        "মালয়েশিয়ায় ব্যাচেলর ডিগ্রির খরচ কত?",
        "IELTS কী এবং কত স্কোর দরকার?",
        "কোন দেশে স্টুডেন্ট ভিসা পাওয়া সহজ?"
      ],
      5: [
        "ফান্ডেড মাস্টার্স প্রোগ্রাম কীভাবে খুঁজব?",
        "Statement of Purpose (SOP) কীভাবে লিখব?",
        "থিসিস ও নন-থিসিস মাস্টার্সের পার্থক্য কী?",
        "কোন দেশে বাংলাদেশিদের জন্য বিনামূল্যে মাস্টার্স আছে?",
        "GRE ছাড়া কি মাস্টার্সে ভর্তি হওয়া যায়?"
      ],
      6: [
        "বিদেশে পিএইচডি সুপারভাইজার কীভাবে খুঁজব?",
        "ফুলি ফান্ডেড পিএইচডি স্কলারশিপ কী?",
        "গবেষণা প্রস্তাব (Research Proposal) কীভাবে লিখব?",
        "পিএইচডি কমপ্লিট করতে কত সময় লাগে?",
        "কোন দেশে সেরা পিএইচডি প্রোগ্রাম আছে?"
      ],
      7: [
        "সন্তানের পড়াশোনার জন্য সেরা দেশ কোনটি?",
        "বিদেশে পড়তে কত টাকা লাগবে?",
        "মালয়েশিয়ার স্টুডেন্ট ভিসা কি সহজে পাওয়া যায়?",
        "বাংলাদেশি শিক্ষার্থীদের জন্য নিরাপদ দেশ কোনগুলো?",
        "আর্থ সলিউশন্স কীভাবে আমার সন্তানকে সাহায্য করতে পারে?"
      ]
    },
    prompts: {
      1: ["গুরুত্বপূর্ণ বিষয়গুলো কী?", "মজার পড়ার টিপস"],
      2: ["JSC প্রস্তুতি কীভাবে নেব?", "দৈনিক পড়ার রুটিন"],
      3: ["GPA ৫ পেতে কী করব?", "ক্লাস ১২ এর পর ক্যারিয়ার"],
      4: ["বিদেশে আবেদন করব কীভাবে?", "বৃত্তির তথ্য"],
      5: ["ফান্ডেড মাস্টার্স কীভাবে খুঁজব?", "SOP লেখার টিপস"],
      6: ["পিএইচডি সুপারভাইজার কীভাবে খুঁজব?", "ফুলি ফান্ডেড পিএইচডি"],
      7: ["সেরা দেশ কোনটি?", "বাজেট পরিকল্পনা"]
    },
    pricingBtn:   'মূল্য তালিকা',
    pmTitle:      'সার্ভিস প্ল্যান ও মূল্য তালিকা',
    pmSub:        'আর্থ সলিউশন্স ভিসা জোন — আপনার জন্য সঠিক প্ল্যান বেছে নিন',
    pmNote:       '⚠️ ভিসা বা ভর্তির কোনো গ্যারান্টি নেই। ফলাফল ব্যক্তিগত যোগ্যতার উপর নির্ভর করে।',
    pmFullLink:   'সম্পূর্ণ মূল্য তালিকা দেখুন →',
    systemPrompt: (label, range) =>
      `আপনি Peopole AI, আর্থ সলিউশন্স ভিসা জোন, ঢাকা, বাংলাদেশ-এর একজন বিশেষজ্ঞ একাডেমিক ও ভিসা পরামর্শদাতা। আপনি ${label} স্তরের (${range}) একজন শিক্ষার্থীকে সাহায্য করছেন। সংক্ষিপ্ত, উষ্ণ এবং ব্যবহারিক নির্দেশনা দিন। ভিসার বিষয়ে সরকারি উৎস যাচাই করার পরামর্শ দিন। সবসময় বাংলায় উত্তর দিন।`,
    systemDefault:
      `আপনি Peopole AI, আর্থ সলিউশন্স ভিসা জোন, ঢাকা, বাংলাদেশ-এর একজন বিশেষজ্ঞ একাডেমিক ও ভিসা পরামর্শদাতা। সবসময় বাংলায় উত্তর দিন।`
  }
};

// ── Globals ──────────────────────────────────────────────
let chats        = loadChats();
let activeChatId = chats.length ? chats[0].id : null;
let currentStage = localStorage.getItem(STAGE_KEY) || null;
let currentLang  = localStorage.getItem(LANG_KEY) || 'en';
let isStreaming   = false;
let isOnline      = navigator.onLine;

// ── DOM refs ─────────────────────────────────────────────
const messagesEl       = document.getElementById('messages');
const inputEl          = document.getElementById('messageInput');
const sendBtn          = document.getElementById('sendBtn');
const newChatBtn       = document.getElementById('newChatBtn');
const clearBtn         = document.getElementById('clearBtn');
const chatListEl       = document.getElementById('chatList');
const chatTitleEl      = document.getElementById('chatTitle');
const topbarSubEl      = document.getElementById('topbarSub');
const menuBtn          = document.getElementById('menuBtn');
const sidebarEl        = document.getElementById('sidebar');
const overlayEl        = document.getElementById('overlay');
const stageModalEl     = document.getElementById('stageModalBackdrop');
const stageBadgeWrapEl = document.getElementById('stageBadgeWrap');
const stageBadgeEl     = document.getElementById('stageBadge');
const stageChangeBtnEl = document.getElementById('stageChangeBtn');
const offlineBarEl     = document.getElementById('offlineBar');
const statusDotEl      = document.getElementById('statusDot');
const langBtnEl        = document.getElementById('langBtn');

// ── Helpers ───────────────────────────────────────────────
function t(key) { return STRINGS[currentLang][key]; }
function loadChats() {
  try { const s = localStorage.getItem(STORAGE_KEY); return s ? JSON.parse(s) : []; }
  catch (e) { return []; }
}
function saveChats() {
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(chats)); } catch (e) {}
}

// ── Apply Language to UI ─────────────────────────────────
function applyLanguage() {
  const s = STRINGS[currentLang];

  // Topbar & sidebar static text
  if (newChatBtn)       newChatBtn.childNodes[1].textContent = ' ' + s.newChat;
  if (stageChangeBtnEl) stageChangeBtnEl.textContent = s.change;
  if (offlineBarEl)     offlineBarEl.querySelector('span') && (offlineBarEl.querySelector('span').textContent = s.offlineBar);
  if (langBtnEl)        langBtnEl.textContent = s.langBtn;
  if (inputEl)          inputEl.placeholder = s.placeholder;
  if (topbarSubEl)      topbarSubEl.textContent = s.topbarSub;

  // Disclaimer
  const disc = document.querySelector('.disclaimer');
  if (disc) disc.textContent = s.disclaimer;

  // WhatsApp sidebar btn text
  const waBtnSpan = document.querySelector('.whatsapp-btn span');
  if (waBtnSpan) waBtnSpan.textContent = s.whatsappBtn;

  // Contact card
  const contactTitle = document.querySelector('.contact-card-title');
  if (contactTitle) contactTitle.textContent = s.contactTitle;
  const locationEl = document.querySelector('.contact-line:nth-child(3)');
  if (locationEl) locationEl.childNodes[locationEl.childNodes.length-1].textContent = ' ' + s.location;
  const pricingLink = document.querySelector('.contact-card a');
  if (pricingLink) pricingLink.textContent = s.pricing;

  // Clear btn
  const clearSpan = clearBtn ? clearBtn.childNodes[clearBtn.childNodes.length-1] : null;
  if (clearSpan) clearSpan.textContent = ' ' + s.clear;

  // Modal
  const modalH2 = document.querySelector('.stage-modal-header h2');
  if (modalH2) modalH2.innerHTML = `${s.modalTitle} <span>Peopole AI</span>`;
  const modalP = document.querySelector('.stage-modal-header p');
  if (modalP) modalP.textContent = s.modalSub;

  // Stage cards in modal
  Object.entries(s.stages).forEach(([id, stage]) => {
    const card = document.querySelector(`.stage-card[data-stage="${id}"]`);
    if (!card) return;
    const numEl  = card.querySelector('.stage-num');
    const nameEl = card.querySelector('.stage-name');
    const rangeEl= card.querySelector('.stage-range');
    if (numEl)   numEl.textContent   = stage.num;
    if (nameEl)  nameEl.textContent  = stage.label;
    if (rangeEl) rangeEl.textContent = stage.range;
  });

  // Update stage badge if set
  if (currentStage) {
    const stg = s.stages[currentStage];
    if (stg && stageBadgeEl) {
      const icon = ['🌱','🔍','🎯','🎓','🔬','🏛️','👨‍👩‍👧'][currentStage - 1];
      stageBadgeEl.textContent = `${icon} ${stg.label}`;
    }
    if (topbarSubEl) {
      const stg = s.stages[currentStage];
      topbarSubEl.textContent = stg ? `${['🌱','🔍','🎯','🎓','🔬','🏛️','👨‍👩‍👧'][currentStage-1]} ${stg.label} · ${stg.range}` : s.topbarSub;
    }
  }

  // Pricing button label
  const pricingLbl = document.getElementById('pricingBtnLabel');
  if (pricingLbl) pricingLbl.textContent = s.pricingBtn;

  // Re-render messages (updates welcome screen prompts)
  renderMessages();
  renderFAQ();
}

// ── Toggle Language ───────────────────────────────────────
function toggleLanguage() {
  currentLang = currentLang === 'en' ? 'bn' : 'en';
  localStorage.setItem(LANG_KEY, currentLang);
  applyLanguage();
}

// ── Sidebar ──────────────────────────────────────────────
function openSidebar()  { sidebarEl.classList.add('open');    overlayEl.classList.add('show'); }
function closeSidebar() { sidebarEl.classList.remove('open'); overlayEl.classList.remove('show'); }
function toggleSidebar() { sidebarEl.classList.contains('open') ? closeSidebar() : openSidebar(); }

// ── Online Status ─────────────────────────────────────────
function updateOnlineStatus() {
  if (isOnline) {
    offlineBarEl.style.display = 'none';
    statusDotEl.classList.remove('offline');
    statusDotEl.title = 'Online';
  } else {
    offlineBarEl.style.display = 'flex';
    statusDotEl.classList.add('offline');
    statusDotEl.title = 'Offline';
  }
}

// ── Stage Modal ───────────────────────────────────────────
function showStageModal() { stageModalEl.classList.remove('hidden'); }
function hideStageModal() { stageModalEl.classList.add('hidden'); }

function attachStageCards() {
  document.querySelectorAll('.stage-card').forEach(card => {
    card.addEventListener('click', () => selectStage(card.dataset.stage));
  });
}

function selectStage(stage) {
  currentStage = stage;
  localStorage.setItem(STAGE_KEY, stage);
  hideStageModal();
  applyStage(stage, true);
  if (!chats.length) createNewChat();
  else { renderSidebar(); renderMessages(); }
}

function applyStage(stage, isNew) {
  const s    = STRINGS[currentLang];
  const stg  = s.stages[stage];
  const icon = ['🌱','🔍','🎯','🎓','🔬','🏛️','👨‍👩‍👧'][stage - 1];
  if (!stg) return;

  stageBadgeEl.textContent = `${icon} ${stg.label}`;
  stageBadgeWrapEl.style.display = 'flex';
  topbarSubEl.textContent = `${icon} ${stg.label} · ${stg.range}`;

  renderFAQ();

  if (isNew) {
    const greeting = s.greetings[stage];
    if (greeting) setTimeout(() => sendMessage(greeting, true), 400);
  }
}

// ── Chat Management ───────────────────────────────────────
function createNewChat() {
  const id = Date.now().toString();
  chats.unshift({ id, title: t('newChat'), messages: [] });
  activeChatId = id;
  saveChats();
  renderSidebar();
  renderMessages();
}

function getActiveChat() { return chats.find(c => c.id === activeChatId); }

function switchChat(id) {
  activeChatId = id;
  closeSidebar();
  renderSidebar();
  renderMessages();
  if (chatTitleEl) chatTitleEl.textContent = getActiveChat()?.title || t('chatTitle');
}

function clearActiveChat() {
  const chat = getActiveChat();
  if (!chat) return;
  if (!confirm(currentLang === 'bn' ? 'এই কথোপকথন মুছবেন?' : 'Clear this conversation?')) return;
  chat.messages = [];
  saveChats();
  renderMessages();
}

function deleteChat(id, e) {
  e.stopPropagation();
  chats = chats.filter(c => c.id !== id);
  if (activeChatId === id) activeChatId = chats.length ? chats[0].id : null;
  if (!chats.length) createNewChat();
  else { saveChats(); renderSidebar(); renderMessages(); }
}

// ── Render Sidebar ────────────────────────────────────────
function renderSidebar() {
  if (!chatListEl) return;
  chatListEl.innerHTML = '';
  chats.forEach(chat => {
    const item = document.createElement('div');
    item.className = 'chat-item' + (chat.id === activeChatId ? ' active' : '');
    item.innerHTML = `
      <span class="chat-item-icon">💬</span>
      <span class="chat-item-title" style="flex:1;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${escapeHtml(chat.title)}</span>
      <button class="chat-delete-btn" title="Delete" style="background:none;border:none;color:#4f6180;cursor:pointer;padding:2px 5px;font-size:12px;flex-shrink:0;opacity:0;transition:opacity .2s">✕</button>
    `;
    item.addEventListener('click', () => switchChat(chat.id));
    item.addEventListener('mouseenter', () => item.querySelector('.chat-delete-btn').style.opacity = '1');
    item.addEventListener('mouseleave', () => item.querySelector('.chat-delete-btn').style.opacity = '0');
    item.querySelector('.chat-delete-btn').addEventListener('click', e => deleteChat(chat.id, e));
    chatListEl.appendChild(item);
  });
}

// ── Render Messages ───────────────────────────────────────
function renderMessages() {
  if (!messagesEl) return;
  const chat   = getActiveChat();
  const s      = STRINGS[currentLang];
  messagesEl.innerHTML = '';

  if (!chat || !chat.messages.length) {
    const stage   = currentStage ? s.stages[currentStage] : null;
    const prompts = currentStage ? (s.prompts[currentStage] || []) : [];
    const icon    = currentStage ? ['🌱','🔍','🎯','🎓','🔬','🏛️','👨‍👩‍👧'][currentStage - 1] : '';
    messagesEl.innerHTML = `
      <div class="welcome">
        <div class="welcome-logo-wrap"><img src="logo.jpg" alt="Peopole AI"/></div>
        <h2>${currentLang === 'bn' ? 'স্বাগতম' : 'Welcome to'} <span>Peopole AI</span></h2>
        <p>${stage ? `${icon} ${stage.label} · ${stage.range}` : (currentLang === 'bn' ? 'শুরু করতে একটি পর্যায় বেছে নিন' : 'Select a stage to begin')}</p>
        ${prompts.length ? `
          <div class="quick-prompts">
            ${prompts.map(p => `<button class="qp" onclick="sendMessage('${escapeHtml(p)}', false)">${p}</button>`).join('')}
          </div>` : ''}
      </div>
    `;
    return;
  }

  chat.messages.forEach(msg => appendMessageEl(msg));
  scrollBottom();
  if (chatTitleEl) chatTitleEl.textContent = chat.title;
}

// ── Append Message Element ────────────────────────────────
function appendMessageEl(msg) {
  const isUser = msg.role === 'user';
  const div = document.createElement('div');
  div.className = `msg ${isUser ? 'user' : 'ai'}`;

  const avatarHtml = isUser
    ? `<div class="msg-avatar">U</div>`
    : `<div class="msg-avatar"><img src="logo.jpg" alt="AI"/></div>`;

  const content = isUser ? escapeHtml(msg.content) : formatMarkdown(msg.content);
  const time = msg.time || nowTime();

  div.innerHTML = `
    ${avatarHtml}
    <div class="msg-body">
      <div class="msg-meta">${isUser ? (currentLang === 'bn' ? 'আপনি' : 'You') : AI_NAME} · ${time}</div>
      <div class="msg-text">${content}</div>
    </div>
  `;
  messagesEl.appendChild(div);
}

// ── Typing Indicator ──────────────────────────────────────
function showTyping() {
  removeTyping();
  const div = document.createElement('div');
  div.className = 'typing-wrap';
  div.id = 'typingIndicator';
  div.innerHTML = `
    <div class="typing-avatar"><img src="logo.jpg" alt="AI"/></div>
    <div class="typing-bubble"><span></span><span></span><span></span></div>
    <div class="typing-label">${currentLang === 'bn' ? 'Peopole AI লিখছে…' : 'Peopole AI is typing…'}</div>
  `;
  messagesEl.appendChild(div);
  scrollBottom();
}
function removeTyping() {
  const el = document.getElementById('typingIndicator');
  if (el) el.remove();
}

// ── Send Message ──────────────────────────────────────────
async function sendMessage(overrideText, isSystem = false) {
  if (isStreaming) return;

  const text = (typeof overrideText === 'string') ? overrideText.trim() : inputEl.value.trim();
  if (!text) return;

  if (!isSystem && typeof overrideText !== 'string') {
    inputEl.value = '';
    inputEl.style.height = 'auto';
  }

  if (!isOnline) {
    const offReplies = STRINGS[currentLang].offlineReplies;
    showToast(offReplies[currentStage] || offReplies.default);
    return;
  }

  const chat = getActiveChat();
  if (!chat) return;

  if (!isSystem) {
    const userMsg = { role: 'user', content: text, time: nowTime() };
    chat.messages.push(userMsg);
    if (chat.messages.filter(m => m.role === 'user').length === 1) {
      chat.title = text.slice(0, 40) + (text.length > 40 ? '…' : '');
    }
    saveChats();
    renderSidebar();
    appendMessageEl(userMsg);
    scrollBottom();
  }

  isStreaming = true;
  sendBtn.disabled = true;
  showTyping();

  const history = chat.messages
    .filter(m => m.role === 'user' || m.role === 'assistant')
    .map(m => ({ role: m.role, content: m.content }));

  // Build system prompt in correct language
  const s   = STRINGS[currentLang];
  const stg = currentStage ? s.stages[currentStage] : null;
  const systemPrompt = stg
    ? s.systemPrompt(stg.label, stg.range)
    : s.systemDefault;

  try {
    const res = await fetch(API_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ messages: history, system: systemPrompt, stage: currentStage, lang: currentLang })
    });

    if (!res.ok) throw new Error(`Server error ${res.status}`);

    const contentType = res.headers.get('content-type') || '';

    if (contentType.includes('text/event-stream') || contentType.includes('text/plain')) {
      removeTyping();
      const aiMsg = { role: 'assistant', content: '', time: nowTime() };
      chat.messages.push(aiMsg);

      const div = document.createElement('div');
      div.className = 'msg ai';
      div.innerHTML = `
        <div class="msg-avatar"><img src="logo.jpg" alt="AI"/></div>
        <div class="msg-body">
          <div class="msg-meta">${AI_NAME} · ${aiMsg.time}</div>
          <div class="msg-text" id="streamTarget"></div>
        </div>
      `;
      messagesEl.appendChild(div);
      const streamTarget = document.getElementById('streamTarget');

      const reader  = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop();
        for (const line of lines) {
          if (!line.startsWith('data: ')) continue;
          const data = line.slice(6).trim();
          if (data === '[DONE]') break;
          try {
            const parsed = JSON.parse(data);
            const chunk = parsed.choices?.[0]?.delta?.content
                       || parsed.delta?.text
                       || parsed.content || '';
            if (chunk) {
              aiMsg.content += chunk;
              streamTarget.innerHTML = formatMarkdown(aiMsg.content);
              scrollBottom();
            }
          } catch (_) {}
        }
      }

      streamTarget.removeAttribute('id');
      saveChats();

    } else {
      const data = await res.json();
      const reply = data.content || data.message || data.choices?.[0]?.message?.content || data.reply || '⚠️ No response received.';
      removeTyping();
      const aiMsg = { role: 'assistant', content: reply, time: nowTime() };
      chat.messages.push(aiMsg);
      saveChats();
      appendMessageEl(aiMsg);
      scrollBottom();
    }

  } catch (err) {
    console.error('sendMessage error:', err);
    removeTyping();
    const errMsg = {
      role: 'assistant',
      content: currentLang === 'bn'
        ? `⚠️ সার্ভারে সংযোগ করা যায়নি: ${err.message}। আবার চেষ্টা করুন।`
        : `⚠️ Could not reach the server: ${err.message}. Please try again.`,
      time: nowTime()
    };
    chat.messages.push(errMsg);
    saveChats();
    appendMessageEl(errMsg);
    scrollBottom();
  } finally {
    isStreaming = false;
    sendBtn.disabled = false;
    inputEl.focus();
  }
}

// ── Utilities ─────────────────────────────────────────────
function nowTime() { return new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }); }
function scrollBottom() { messagesEl.scrollTop = messagesEl.scrollHeight; }
function escapeHtml(str) {
  return String(str).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}
function formatMarkdown(text) {
  return text
    .replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;')
    .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
    .replace(/\*(.+?)\*/g,     '<em>$1</em>')
    .replace(/`(.+?)`/g,       '<code>$1</code>')
    .replace(/^### (.+)$/gm,   '<h4>$1</h4>')
    .replace(/^## (.+)$/gm,    '<h3>$1</h3>')
    .replace(/^# (.+)$/gm,     '<h2>$1</h2>')
    .replace(/^\s*[-*] (.+)$/gm, '<li>$1</li>')
    .replace(/(<li>[\s\S]+?<\/li>)/g, '<ul>$1</ul>')
    .replace(/\n\n+/g, '</p><p>')
    .replace(/\n/g, '<br>');
}
function showToast(msg) {
  let t = document.getElementById('paToast');
  if (!t) {
    t = document.createElement('div');
    t.id = 'paToast';
    t.style.cssText = 'position:fixed;bottom:88px;left:50%;transform:translateX(-50%);background:#1a2a45;color:#e8edf5;padding:11px 22px;border-radius:10px;font-size:13px;z-index:9999;max-width:92vw;text-align:center;border:1px solid rgba(255,255,255,.1);box-shadow:0 4px 16px rgba(0,0,0,.4);font-family:Outfit,sans-serif;';
    document.body.appendChild(t);
  }
  t.textContent = msg;
  t.style.display = 'block';
  setTimeout(() => { t.style.display = 'none'; }, 3500);
}

// ── Input Setup ───────────────────────────────────────────
function setupAutoResize() {
  if (!inputEl) return;
  inputEl.addEventListener('input', () => {
    inputEl.style.height = 'auto';
    inputEl.style.height = Math.min(inputEl.scrollHeight, 160) + 'px';
  });
}
function setupKeyboard() {
  if (!inputEl) return;
  inputEl.addEventListener('keydown', e => {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendMessage(); }
  });
}

// ── Events ────────────────────────────────────────────────
sendBtn.addEventListener('click', () => sendMessage());
newChatBtn.addEventListener('click', createNewChat);
clearBtn.addEventListener('click', clearActiveChat);
menuBtn.addEventListener('click', toggleSidebar);
overlayEl.addEventListener('click', closeSidebar);
stageChangeBtnEl.addEventListener('click', showStageModal);
if (langBtnEl) langBtnEl.addEventListener('click', toggleLanguage);

// ── Init ──────────────────────────────────────────────────
function init() {
  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('/sw.js').catch(() => {});
  }
  window.addEventListener('online',  () => { isOnline = true;  updateOnlineStatus(); });
  window.addEventListener('offline', () => { isOnline = false; updateOnlineStatus(); });
  updateOnlineStatus();

  if (!currentStage) showStageModal();
  else {
    hideStageModal();
    applyStage(currentStage, false);
    if (!chats.length) createNewChat();
    else { renderSidebar(); renderMessages(); }
  }

  setupAutoResize();
  setupKeyboard();
  attachStageCards();
  applyLanguage();
  renderFAQ();
}

// ── Pricing Modal ────────────────────────────────────────
function openPricingModal() {
  const backdrop = document.getElementById('pricingModalBackdrop');
  if (backdrop) {
    backdrop.classList.remove('hidden');
    updatePricingModalLang();
    document.body.style.overflow = 'hidden';
  }
}
function closePricingModal() {
  const backdrop = document.getElementById('pricingModalBackdrop');
  if (backdrop) backdrop.classList.add('hidden');
  document.body.style.overflow = '';
}
function closePricingOnBackdrop(e) {
  if (e.target.id === 'pricingModalBackdrop') closePricingModal();
}
function updatePricingModalLang() {
  const s   = STRINGS[currentLang];
  const isBn = currentLang === 'bn';

  const set = (id, text) => { const el = document.getElementById(id); if (el) el.textContent = text; };
  const setHtml = (id, html) => { const el = document.getElementById(id); if (el) el.innerHTML = html; };

  set('pmTitle',    s.pmTitle);
  set('pmSub',      s.pmSub);
  set('pmNote',     s.pmNote);
  set('pmFullLink', s.pmFullLink);

  if (isBn) {
    // Bangla plan content
    set('ppBadge0', '🟢 বিনামূল্যে');   set('ppName0',  'বেসিক পাথওয়ে');
    set('ppPrice0', '৳০');              set('ppDesc0',  'প্রতিটি শিক্ষার্থীর জন্য বিনামূল্যে AI গাইডেন্স। ২৪/৭ তাৎক্ষণিক উত্তর পান।');
    setHtml('ppFeatures0','<li>✅ সীমাহীন AI চ্যাট</li><li>✅ স্তর-ভিত্তিক গাইডেন্স</li><li>✅ বাংলা + ইংরেজি সাপোর্ট</li><li>✅ রেজিস্ট্রেশন লাগবে না</li>');

    set('ppBadge1', '💰 এন্ট্রি');      set('ppName1',  'এন্ট্রি লেভেল রিপোর্ট');
    set('ppPrice1', '৳৩০');            set('ppDesc1',  'আপনার একাডেমিক স্তর অনুযায়ী দেশ ও বিশ্ববিদ্যালয় রিপোর্ট।');
    setHtml('ppFeatures1','<li>✅ দেশ উপযুক্ততা রিপোর্ট</li><li>✅ বিশ্ববিদ্যালয় শর্টলিস্ট (AI)</li><li>✅ ভিসার প্রয়োজনীয়তা</li><li>✅ হোয়াটসঅ্যাপে ডেলিভারি</li>');

    set('ppBadge2', '🔵 জনপ্রিয়');    set('ppName2',  'কাঠামোবদ্ধ গাইডেন্স');
    set('ppPrice2', '৳১০০–৳৫০০');

    set('ppBadge3', '💼 প্রিমিয়াম');   set('ppName3',  'মিড-টিয়ার মেন্টরশিপ');
    set('ppPrice3', '৳৫০০–৳২০,০০০+');

    set('ppBadge4', '🔴 এলিট');        set('ppName4',  'এলিট একাডেমিক বোর্ড');
    set('ppPrice4', 'বিস্তারিত জানুন');
  } else {
    // English (reset to defaults)
    set('ppBadge0', '🟢 FREE');        set('ppName0', 'Basic Pathway');
    set('ppPrice0', '৳0');            set('ppDesc0', 'Free AI guidance for every student. Ask anything, get instant answers 24/7.');
    setHtml('ppFeatures0','<li>✅ Unlimited AI chat</li><li>✅ Stage-based guidance</li><li>✅ Bangla + English support</li><li>✅ No registration needed</li>');

    set('ppBadge1', '💰 ENTRY');       set('ppName1', 'Entry-Level Report');
    set('ppPrice1', '৳30 / student'); set('ppDesc1', 'Automated country + university report tailored to your academic stage.');
    setHtml('ppFeatures1','<li>✅ Country suitability report</li><li>✅ University shortlist (AI)</li><li>✅ Visa requirement overview</li><li>✅ Delivered via WhatsApp</li>');

    set('ppBadge2', '🔵 POPULAR');     set('ppName2', 'Structured Guidance');
    set('ppPrice2', '৳100–৳500');

    set('ppBadge3', '💼 PREMIUM');     set('ppName3', 'Mid-Tier Mentorship');
    set('ppPrice3', '৳500–৳20,000+');

    set('ppBadge4', '🔴 ELITE');       set('ppName4', 'Elite Academic Board');
    set('ppPrice4', 'Call for Details');
  }
}

// ── FAQ Panel ─────────────────────────────────────────────
function renderFAQ() {
  const panel  = document.getElementById('faqPanel');
  const area   = document.getElementById('faqArea');
  const label  = document.getElementById('faqToggleLabel');
  if (!panel || !area) return;

  const s = STRINGS[currentLang];
  if (label) label.textContent = currentLang === 'bn' ? 'সাধারণ প্রশ্নসমূহ' : 'Common Questions';

  if (!currentStage) {
    area.style.display = 'none';
    return;
  }
  area.style.display = '';

  const faqs = (s.faqs && s.faqs[currentStage]) || [];
  panel.innerHTML = faqs.map(q =>
    `<button class="faq-q" onclick="sendFAQ(this, '${q.replace(/'/g,"\\'")}')">💬 ${q}</button>`
  ).join('');
}

function sendFAQ(btn, question) {
  const input = document.getElementById('messageInput');
  if (input) {
    input.value = question;
    input.focus();
    input.style.height = 'auto';
    input.style.height = Math.min(input.scrollHeight, 160) + 'px';
  }
  // Close FAQ panel
  const panel = document.getElementById('faqPanel');
  const toggleBtn = document.getElementById('faqToggleBtn');
  if (panel) panel.classList.remove('open');
  if (toggleBtn) toggleBtn.classList.remove('open');
  // Auto-send
  sendMessage(question, false);
}

function toggleFAQ() {
  const panel     = document.getElementById('faqPanel');
  const toggleBtn = document.getElementById('faqToggleBtn');
  if (!panel) return;
  const isOpen = panel.classList.contains('open');
  panel.classList.toggle('open', !isOpen);
  toggleBtn.classList.toggle('open', !isOpen);
}

init();