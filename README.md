# Peopole AI 🎓
### Academic & Visa Consultant — Earth Solutions Visa Zone, Dhaka

> An AI-powered academic and visa consultation web app built for Bangladeshi students, powered by **Groq LLaMA 3.3 70B** with real-time SSE streaming.

[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=https://github.com/nazmulbijoy9105-coder/earth-solutions-ecg&env=GROQ_API_KEY,ALLOWED_ORIGIN&envDescription=Groq%20API%20key%20and%20allowed%20origin&envLink=https://console.groq.com/)

---

## ✨ Features

- 🤖 **Real-time AI chat** — Groq LLaMA 3.3 70B with SSE streaming
- 🎓 **7 Academic Stages** — Foundation → Doctoral + Parent Mode
- 💬 **Persistent chat history** — localStorage, up to 20 sessions
- 📱 **PWA** — installable on mobile, offline support via Service Worker
- 💳 **Pricing page** — transparent stage-based plans (Free → ৳11,000 Elite)
- 📞 **WhatsApp integration** — floating button + sidebar CTA
- 🌐 **Fully responsive** — mobile-first design

---

## 🗂️ Project Structure

```
peopole-ai/
├── index.html          # Main chat UI
├── pricing.html        # Service plans & pricing
├── style.css           # All styles
├── frontend/
│   └── chat.js         # Frontend logic (streaming, history, stages)
├── api/
│   └── chat.js         # Vercel serverless API (Groq SSE proxy)
├── sw.js               # Service Worker (PWA / offline cache)
├── manifest.json       # PWA manifest
├── vercel.json         # Vercel routing & config
├── logo.jpg            # Your logo (add this file!)
├── .env.example        # Environment variable template
└── .gitignore
```

---

## 🚀 Deployment (Vercel)

### 1. Add your logo
Place your `logo.jpg` in the root of the project. It's used as the app icon, chat avatar, and PWA icon.

### 2. Set environment variables

| Variable | Required | Description |
|---|---|---|
| `GROQ_API_KEY` | ✅ Yes | Get from [console.groq.com](https://console.groq.com/) |
| `ALLOWED_ORIGIN` | Recommended | Your Vercel URL, e.g. `https://earth-solutions-ecg.vercel.app` |

In Vercel: **Project → Settings → Environment Variables**

### 3. Deploy

```bash
# Option A: Connect GitHub repo in Vercel dashboard (recommended)
# Option B: Vercel CLI
npm i -g vercel
vercel --prod
```

---

## 🛠️ Local Development

```bash
# Install Vercel CLI
npm i -g vercel

# Create .env from template
cp .env.example .env
# Add your GROQ_API_KEY to .env

# Run locally (emulates Vercel serverless)
vercel dev
# Open http://localhost:3000
```

> **Note:** `logo.jpg` must exist in the root for the UI to render correctly. Add your Earth Solutions logo file.

---

## 📋 Service Plans

| Plan | Price | Description |
|---|---|---|
| Basic Pathway | **Free** | Assessment, document checklist, general info |
| Entry-Level Report | ৳30–৳70 | Profile-based report with exact figures |
| Structured Plan | ৳120–৳250 | Human + AI combined, embassy contacts |
| Mentor-Led | ৳120–৳550 | Matched mentor, signed documents |
| Elite Pathway | ৳1,000–৳11,000 | Academic board, research mentorship |

**Payment:** bKash / Nagad → `01621-777657`

---

## 📞 Contact

- 📱 WhatsApp: [+880 1535-778111](https://wa.me/8801535778111)
- 📍 Panthapath, Dhaka, Bangladesh

---

© 2025 Peopole AI — Earth Solutions Visa Zone
