# Peopole AI - Earth Solutions Visa Zone Platform

**A commercial-quality AI-powered education & visa consultancy platform for Bangladeshi students planning to study abroad.**

---

## 🎯 Project Overview

**Peopole AI** is a comprehensive student guidance platform that combines AI chatbot assistance with human consultancy services. The platform uses a tiered service model (from free to premium) to provide scalable support for students at every stage of their study abroad journey.

**Organization:** Earth Solutions ECG - Earth Solutions Visa Zone  
**Location:** Panthapath, Dhaka, Bangladesh  
**Contact:** +880 1535-778111 (WhatsApp)

---

## ✨ Completed Features

### 🔐 Authentication System
- **Multiple Sign-In Methods:**
  - ✅ Email/Password authentication
  - ✅ Phone number with OTP verification (demo: use code `1234`)
  - ✅ Google OAuth simulation
- **Session Management:**
  - User data persisted in localStorage
  - Automatic session restoration on page reload
  - Secure logout with conversation cleanup

### 💬 AI Chat Interface
- **Core Features:**
  - ✅ Real-time AI chatbot (Peopole AI)
  - ✅ Bilingual support (English + বাংলা Bangla)
  - ✅ Conversation persistence across sessions
  - ✅ Typing indicators for natural UX
  - ✅ Common questions quick-select
  - ✅ Message history with timestamps
- **AI Capabilities:**
  - University and country recommendations
  - Cost breakdown calculations
  - Visa requirements guidance
  - Scholarship information
  - SOP writing tips

### 💳 Payment Integration
- **Payment Methods Supported:**
  - ✅ bKash (Bangladesh mobile wallet)
  - ✅ Nagad (Bangladesh mobile wallet)
  - ✅ Stripe (International card payments)
- **Payment Features:**
  - Simulated payment processing
  - Transaction history tracking
  - Payment receipts and confirmations
  - Secure payment modal UI
  - Payment method selection interface

### 📊 Student Dashboard
- **Dashboard Sections:**
  - ✅ **Conversations:** View and resume past chat sessions
  - ✅ **My Reports:** Access purchased PDF reports (Entry-Level, Country Reports)
  - ✅ **Progress Tracker:** Visual progress of application stages
    - Profile Setup
    - Country Selection
    - University Shortlist
    - SOP Writing
    - Visa Application
  - ✅ **Payment History:** Complete transaction records

### 💰 Service Tier System
5-tier pricing model with feature gating:

1. **🟢 FREE - Basic Pathway (৳0)**
   - Unlimited AI chat
   - Stage-based guidance
   - Bangla + English support
   - No registration needed

2. **💰 ENTRY - Entry-Level Report (৳30)**
   - Country suitability report
   - University shortlist (AI-generated)
   - Visa requirement overview
   - Instant PDF delivery via WhatsApp

3. **🔵 POPULAR - Structured Guidance (৳100–500)**
   - AI risk analysis
   - Human consultant review
   - Full document checklist
   - SOP draft review

4. **💼 PREMIUM - Mid-Tier Mentorship (৳500–20,000+)**
   - Matched alumni mentor
   - Full SOP writing
   - Visa interview prep
   - Application filing support

5. **🔴 ELITE - Elite Academic Board (Call for Details)**
   - Academic board review
   - Professor outreach
   - Scholarship negotiation
   - End-to-end management

### 🎨 User Interface
- ✅ Modern, responsive design
- ✅ Gradient color scheme (purple/violet theme)
- ✅ Smooth animations and transitions
- ✅ Mobile-first responsive layout
- ✅ Custom scrollbars
- ✅ Loading states and spinners
- ✅ Modal overlays for forms
- ✅ Toast notifications

---

## 🚀 Currently Accessible Features

### Public (No Login Required)
- **Chat Interface** - Ask unlimited questions to Peopole AI
- **Language Toggle** - Switch between English and বাংলা
- **Pricing View** - Browse all service tiers
- **WhatsApp Contact** - Direct link to business WhatsApp

### Authenticated Users Only
- **Dashboard Access** - Full student dashboard
- **Conversation History** - Resume previous chats
- **Payment Processing** - Purchase paid services
- **Progress Tracking** - Monitor application stages
- **Report Downloads** - Access purchased PDF reports
- **Profile Management** - View account details

---

## 📂 Data Models & Storage

### LocalStorage Structure

```javascript
// User Object
{
  id: "unique-user-id",
  name: "Student Name",
  email: "student@email.com",
  phone: "+8801XXXXXXXXX",
  method: "email" | "phone" | "google",
  avatar: "https://ui-avatars.com/...",
  tier: "free" | "entry" | "structured" | "premium" | "elite",
  createdAt: timestamp
}

// Conversation Object
{
  id: "conversation-id",
  userId: "user-id-or-guest",
  messages: [
    {
      id: "message-id",
      role: "user" | "assistant",
      content: "Message text",
      timestamp: timestamp
    }
  ],
  active: true/false,
  createdAt: timestamp,
  updatedAt: timestamp
}

// Payment Object
{
  id: "payment-id",
  tier: "entry" | "structured" | "premium" | "elite",
  amount: number,
  method: "bkash" | "nagad" | "stripe",
  phone: "+8801XXXXXXXXX",
  status: "completed" | "pending" | "failed",
  timestamp: timestamp
}
```

### Storage Keys
- `user` - Current logged-in user object
- `conversations` - Array of all conversation objects
- `payments` - Array of all payment transaction objects

---

## 🛠️ Technical Architecture

### Frontend Stack
- **React 18** (via CDN - production build)
- **Tailwind CSS** (via CDN)
- **Font Awesome 6.4.0** (icons)
- **Google Fonts** (Inter typeface)
- **Babel Standalone** (JSX transformation)

### State Management
- React Hooks (`useState`, `useEffect`, `useRef`)
- LocalStorage API for persistence
- No external state management library needed

### Styling Approach
- Utility-first CSS with Tailwind
- Custom animations (typing indicators, slide-in effects)
- Gradient backgrounds and text
- Responsive breakpoints (mobile-first)

### Browser Compatibility
- Modern browsers (Chrome, Firefox, Safari, Edge)
- Requires JavaScript enabled
- LocalStorage support required

---

## 📖 User Workflows

### 1️⃣ Free User Journey
```
Land on Page → Chat with AI → Get basic guidance → Browse pricing
```

### 2️⃣ Paid Service Purchase
```
Browse Services → Select Tier → Sign Up/Login → Choose Payment Method 
→ Enter Payment Details → Complete Purchase → Access Service
```

### 3️⃣ Returning User
```
Open Platform → Auto-login (if session exists) → Resume last conversation 
OR → View Dashboard → Access history/reports
```

### 4️⃣ Dashboard Navigation
```
Login → Switch to Dashboard → Navigate tabs:
  - Conversations (view chat history)
  - My Reports (download PDFs)
  - Progress (track application stages)
  - Payments (view transaction history)
```

---

## 🎮 Demo Credentials & Testing

### Test Authentication
- **Phone OTP:** Use code `1234` for any phone number
- **Google OAuth:** Simulated - creates a demo Google user
- **Email/Password:** Any email/password combination works (demo mode)

### Test Payments
- **bKash/Nagad:** Any phone number works
- **Stripe Card:** Use `4242 4242 4242 4242` (standard test card)
- **CVC:** Any 3 digits
- **Expiry:** Any future date (MM/YY format)

### Test Conversations
1. Ask: "What are the best countries for Computer Science?"
2. Ask: "How much does it cost to study in Canada?"
3. Ask: "What IELTS score do I need for USA?"
4. Toggle language to বাংলা and repeat questions

---

## 🚧 Features NOT Yet Implemented

### Backend Requirements (Out of Scope for Static Site)
- ❌ Real AI API integration (OpenAI GPT-4)
- ❌ Actual payment gateway connections (bKash API, Nagad API, Stripe API)
- ❌ PDF report generation engine
- ❌ Email notification system
- ❌ SMS/WhatsApp API integration
- ❌ File upload for documents (transcripts, SOP drafts)
- ❌ Video call scheduling system
- ❌ Real-time notification system

### Admin Panel (Partially Complete)
- ❌ Lead management dashboard
- ❌ Student profile management
- ❌ Payment reconciliation tools
- ❌ Mentor assignment interface
- ❌ Analytics and reporting
- ❌ Conversation monitoring
- ❌ Bulk messaging tools

### Advanced Features
- ❌ Multi-language support beyond EN/BN (add Arabic, Hindi, Urdu)
- ❌ Video testimonials from past students
- ❌ Live chat with human consultants
- ❌ Document verification system
- ❌ University application tracking (external portal integration)
- ❌ Scholarship finder tool
- ❌ IELTS/TOEFL prep resources
- ❌ Country comparison tool (side-by-side)

---

## 🔮 Recommended Next Steps

### Phase 1: Backend Infrastructure (Critical)
1. **Set up backend server** (Node.js/Express or Python/FastAPI)
2. **Integrate real database** (PostgreSQL via Supabase or MongoDB)
3. **Connect AI API** (OpenAI GPT-4 for chatbot responses)
4. **Implement authentication backend** (JWT tokens, refresh tokens)
5. **Set up file storage** (AWS S3 or Supabase Storage for documents)

### Phase 2: Payment & Messaging (High Priority)
1. **Integrate bKash Payment Gateway** (bKash API for Bangladesh)
2. **Integrate Nagad Payment Gateway** (Nagad API for Bangladesh)
3. **Set up Stripe** (for international card payments)
4. **Connect WhatsApp Business API** (for automated messages)
5. **Implement email service** (SendGrid or AWS SES for receipts)

### Phase 3: Content & Features (Medium Priority)
1. **Build PDF generation** (PDFKit or Puppeteer for reports)
2. **Create admin CRM panel** (lead management, analytics)
3. **Add document upload** (transcript, SOP, certificates)
4. **Implement video call scheduling** (Calendly integration or custom)
5. **Build university database** (searchable, filterable catalog)

### Phase 4: Enhancement & Scale (Low Priority)
1. **Add more languages** (Arabic, Hindi, Urdu)
2. **Build mobile apps** (React Native for iOS/Android)
3. **Implement SEO** (blog, country guides, landing pages)
4. **Add testimonials section** (success stories, video interviews)
5. **Build scholarship finder** (curated scholarship database)

---

## 🌐 Functional Entry Points

### Main Routes (Single Page App - No Backend Routes)

| Route/View | Access Level | Description |
|------------|-------------|-------------|
| **Chat Interface** | Public | Main AI chatbot (default view) |
| **Pricing Modal** | Public | View all 5 service tiers |
| **Auth Modal** | Public | Login/Register interface |
| **Payment Modal** | Authenticated | Complete payment for services |
| **Dashboard** | Authenticated | Student dashboard (4 tabs) |

### Action Triggers

| Action | Trigger | Result |
|--------|---------|--------|
| `New Conversation` | Sidebar button | Clears chat, starts fresh session |
| `Language Toggle` | Header button | Switch EN ↔ BN |
| `Sign In` | Header button | Opens authentication modal |
| `Sign Out` | Dashboard button | Clears session, returns to chat |
| `View Pricing` | Multiple buttons | Opens service tier modal |
| `Select Tier` | Pricing modal CTAs | Initiates payment or WhatsApp flow |
| `WhatsApp Contact` | Sidebar/tier CTAs | Opens WhatsApp with pre-filled message |
| `Dashboard Toggle` | Header button (when logged in) | Switch between Chat ↔ Dashboard |

### API Endpoints (Currently Simulated)

These are NOT real endpoints in the static version but should be implemented in the backend:

```javascript
// Auth Endpoints
POST /api/auth/register
POST /api/auth/login
POST /api/auth/logout
POST /api/auth/verify-otp
POST /api/auth/google-oauth

// Chat Endpoints
POST /api/chat/send-message
GET  /api/chat/conversations
GET  /api/chat/conversations/:id
POST /api/chat/new-conversation

// Payment Endpoints
POST /api/payments/bkash
POST /api/payments/nagad
POST /api/payments/stripe
GET  /api/payments/history

// User Endpoints
GET  /api/user/profile
PUT  /api/user/profile
GET  /api/user/reports
GET  /api/user/progress

// Service Endpoints
GET  /api/services/tiers
POST /api/services/purchase
GET  /api/services/generate-report
```

---

## 📱 Mobile Responsiveness

- ✅ Fully responsive from 320px to 4K displays
- ✅ Touch-optimized buttons and inputs
- ✅ Collapsible sidebar on mobile (can be enhanced)
- ✅ Scrollable modals with max-height
- ✅ Mobile-friendly navigation

---

## 🔒 Security Considerations

### Current Implementation (Demo Mode)
- ⚠️ **LocalStorage only** - Not encrypted, visible in dev tools
- ⚠️ **No server validation** - All checks are client-side
- ⚠️ **Simulated payments** - No actual money transfer
- ⚠️ **Mock authentication** - No password hashing

### Production Requirements
- ✅ **HTTPS only** - Encrypt all traffic
- ✅ **Backend auth** - JWT tokens, bcrypt password hashing
- ✅ **Payment tokenization** - Never store raw card data
- ✅ **Rate limiting** - Prevent API abuse
- ✅ **Input validation** - Server-side sanitization
- ✅ **CORS configuration** - Whitelist allowed origins
- ✅ **Session management** - Secure cookies, refresh tokens

---

## 🎨 Brand Colors & Design System

### Color Palette
```css
Primary Gradient: linear-gradient(135deg, #667eea 0%, #764ba2 100%)
Purple-600: #667eea
Purple-700: #764ba2
Green-500: #10b981 (success)
Red-500: #ef4444 (error)
Gray-50 to Gray-900: Neutral scale
```

### Typography
- **Font Family:** Inter (Google Fonts)
- **Headings:** 700-800 weight
- **Body:** 400-500 weight
- **Small Text:** 300 weight

### Components
- **Buttons:** Rounded-lg (8px), gradient background, hover opacity 90%
- **Cards:** Rounded-xl (12px), subtle shadow, hover lift effect
- **Modals:** Rounded-2xl (16px), backdrop blur
- **Inputs:** Border rounded-lg, focus ring purple-500

---

## 🐛 Known Limitations

1. **No Real AI** - Responses are pre-programmed based on keywords
2. **No File Uploads** - Cannot upload documents (transcripts, certificates)
3. **No Email Notifications** - Payment confirmations not sent via email
4. **No Admin Panel** - Consultants cannot manage leads or students
5. **No PDF Generation** - Reports are not actually generated
6. **Session Timeout** - No automatic logout after inactivity
7. **No Search** - Cannot search conversation history
8. **Limited Conversation Export** - Cannot download chat transcripts

---

## 📊 Performance Metrics

### Load Time (Estimated)
- **First Contentful Paint:** ~1.2s (with CDN)
- **Time to Interactive:** ~2.0s
- **Page Size:** ~72KB (HTML only)

### Optimization Notes
- Using production React build (minified)
- Tailwind CSS via CDN (JIT compilation)
- No heavy images (using emoji and Font Awesome icons)
- Lazy loading for modals (only render when open)

---

## 🤝 Support & Contact

**For Users:**
- WhatsApp: +880 1535-778111
- Location: Panthapath, Dhaka, Bangladesh
- Facebook: [Earth Solution's Visa Zone](https://www.facebook.com/61585607205886/)

**For Developers:**
- This is a demo/MVP implementation
- For backend integration, contact your development team
- All code is in a single `index.html` file for easy deployment

---

## 📝 License & Usage

This platform is a commercial product for **Earth Solutions ECG**.

**Demo Features:**
- Free to explore and test
- Not for production use without proper backend
- Mock data only

**Production Deployment:**
- Requires backend server setup
- Requires payment gateway registration
- Requires AI API subscription (OpenAI or similar)
- Requires domain and hosting

---

## 🎉 Conclusion

This platform provides a **complete frontend experience** for a commercial-quality education consultancy service. All major user-facing features are implemented and functional in demo mode.

**To go live**, integrate with real backend services (auth, payments, AI, database) and deploy on a production server.

**Current Status:** ✅ **MVP Complete - Ready for Backend Integration**

---

**Built with ❤️ for Bangladeshi students dreaming of studying abroad**

🎓 **Peopole AI** - Your Personal Academic Amplifier
