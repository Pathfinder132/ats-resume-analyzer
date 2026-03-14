# ResumeIQ — ATS Resume Analyzer & Optimizer

A full-stack freemium web application that analyzes resumes for ATS (Applicant Tracking System) compatibility and offers AI-powered resume optimization as a paid feature.

---

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Frontend | React 18 + Vite + TailwindCSS |
| Backend | Node.js + Express.js |
| Database | MongoDB (Mongoose) |
| AI | Google Gemini 1.5 Flash |
| Payments | Razorpay |
| PDF Generation | Puppeteer |
| File Parsing | pdf-parse + mammoth |

---

## Features

### Free Tier
- Upload PDF or DOCX resume (up to 5MB)
- ATS Score (0–100) with animated score ring
- Score breakdown across 4 dimensions
- Missing keyword detection
- Formatting issue detection
- Weak bullet point identification
- 2 sample bullet improvements

### Paid Tier (₹99 one-time)
- Full AI-powered ATS analysis report
- AI-rewritten bullet points with measurable impact
- Missing keywords inserted naturally
- ATS-safe formatting improvements
- Downloadable optimized PDF resume

---

## Project Structure

```
ats-resume-analyzer/
├── frontend/
│   ├── src/
│   │   ├── components/
│   │   │   ├── Navbar.jsx
│   │   │   ├── FileDropzone.jsx
│   │   │   ├── ScoreRing.jsx
│   │   │   ├── ScoreBreakdown.jsx
│   │   │   └── PaymentModal.jsx
│   │   ├── pages/
│   │   │   ├── HomePage.jsx
│   │   │   ├── AnalyzePage.jsx
│   │   │   ├── ResultsPage.jsx
│   │   │   └── OptimizedPage.jsx
│   │   ├── services/
│   │   │   └── api.js
│   │   ├── App.jsx
│   │   ├── main.jsx
│   │   └── index.css
│   ├── index.html
│   ├── vite.config.js
│   ├── tailwind.config.js
│   └── package.json
│
├── backend/
│   ├── src/
│   │   ├── config/
│   │   │   └── database.js
│   │   ├── controllers/
│   │   │   ├── resumeController.js
│   │   │   ├── paymentController.js
│   │   │   └── authController.js
│   │   ├── middleware/
│   │   │   ├── auth.js
│   │   │   └── upload.js
│   │   ├── models/
│   │   │   ├── User.js
│   │   │   ├── Resume.js
│   │   │   └── Payment.js
│   │   ├── routes/
│   │   │   ├── resume.js
│   │   │   ├── payment.js
│   │   │   └── auth.js
│   │   └── services/
│   │       ├── atsService.js      ← Deterministic ATS scoring
│   │       ├── aiService.js       ← Gemini AI integration
│   │       ├── parseService.js    ← PDF/DOCX text extraction
│   │       └── pdfService.js      ← Puppeteer PDF generation
│   ├── uploads/                   ← Uploaded & generated files (gitignored)
│   ├── server.js
│   ├── .env.example
│   └── package.json
│
└── README.md
```

---

## Local Setup

### Prerequisites

- Node.js 18+
- MongoDB (local or Atlas)
- Google Gemini API key
- Razorpay account (test keys work)

---

### 1. Clone the Repository

```bash
git clone https://github.com/yourname/ats-resume-analyzer.git
cd ats-resume-analyzer
```

---

### 2. Backend Setup

```bash
cd backend
npm install
```

Copy the example env file and fill in your values:

```bash
cp .env.example .env
```

Edit `.env`:

```env
PORT=5000
MONGODB_URI=mongodb://localhost:27017/ats-resume
JWT_SECRET=your_secret_here
GEMINI_API_KEY=your_gemini_key
RAZORPAY_KEY_ID=rzp_test_xxx
RAZORPAY_SECRET=your_razorpay_secret
FRONTEND_URL=http://localhost:5173
```

Start the backend:

```bash
npm run dev
```

The backend runs at `http://localhost:5000`

---

### 3. Frontend Setup

```bash
cd frontend
npm install
```

Copy the example env file:

```bash
cp .env.example .env
```

Start the frontend:

```bash
npm run dev
```

The frontend runs at `http://localhost:5173`

---

### 4. Getting API Keys

#### Google Gemini API Key
1. Go to https://aistudio.google.com/app/apikey
2. Click "Create API Key"
3. Copy and paste into `GEMINI_API_KEY`

#### Razorpay Keys (Test Mode)
1. Sign up at https://razorpay.com
2. Go to Dashboard → Settings → API Keys
3. Generate test keys
4. Copy Key ID → `RAZORPAY_KEY_ID`
5. Copy Key Secret → `RAZORPAY_SECRET`

#### MongoDB Atlas (Cloud)
1. Go to https://cloud.mongodb.com
2. Create a free cluster
3. Get the connection string
4. Replace `MONGODB_URI` value

---

## API Reference

### Resume Routes

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/resume/upload` | Upload PDF/DOCX resume |
| POST | `/api/resume/analyze` | Run ATS analysis |
| POST | `/api/resume/optimize` | AI optimization (paid only) |
| GET | `/api/resume/download/:resumeId` | Download optimized PDF |
| GET | `/api/resume/status/:resumeId` | Get resume status & results |

### Payment Routes

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/payment/create-order` | Create Razorpay order |
| POST | `/api/payment/verify` | Verify payment signature |

### Auth Routes

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/auth/register` | Register user |
| POST | `/api/auth/login` | Login user |

---

## ATS Scoring Engine

The scoring engine (`atsService.js`) is fully deterministic — no AI required for free analysis.

| Category | Weight | What It Checks |
|----------|--------|----------------|
| Keywords | 35pts | 50+ technical skills, frameworks, tools |
| Experience Impact | 25pts | Action verbs, quantifiable metrics |
| Formatting | 25pts | Section presence, length, contact info |
| Skills Section | 15pts | Dedicated section, skill count |

---

## Payment Flow

```
User clicks "Optimize" 
  → POST /api/payment/create-order (creates Razorpay order)
  → Razorpay checkout opens
  → User pays
  → Razorpay calls handler with payment details
  → POST /api/payment/verify (HMAC signature check)
  → Resume marked as isPaid=true
  → POST /api/resume/optimize (AI optimization triggered)
  → PDF generated with Puppeteer
  → User redirected to /optimized/:resumeId
  → Download button available
```

---

## Deployment

### Frontend → Vercel

```bash
cd frontend
npm run build
# Deploy dist/ folder to Vercel
# Set environment variable: VITE_API_URL=https://your-backend.onrender.com/api
```

### Backend → Render / Railway

1. Connect your GitHub repo
2. Set root directory to `backend/`
3. Build command: `npm install`
4. Start command: `node server.js`
5. Add all environment variables from `.env.example`

### Database → MongoDB Atlas

1. Create free M0 cluster
2. Whitelist `0.0.0.0/0` for Render/Railway IPs
3. Use the Atlas connection string in `MONGODB_URI`

---

## Performance Targets

| Operation | Target |
|-----------|--------|
| File upload | < 3s |
| ATS analysis | < 8s |
| AI optimization | < 30s |
| PDF generation | < 10s |

---

## Security

- File type validation (PDF/DOCX only via MIME type)
- File size limit: 5MB
- Razorpay HMAC-SHA256 signature verification on all payments
- JWT authentication (optional, for logged-in users)
- Environment variables for all secrets

---

## Development Notes

- The app works without user accounts — `sessionId` tracks anonymous users
- Puppeteer may need extra config on some Linux environments (see `--no-sandbox` flag in `pdfService.js`)
- Gemini Flash is used for cost efficiency; swap to Pro for higher quality
- The ATS scoring is deterministic and runs instantly without any AI API calls

---

## Future Features (Not Yet Implemented)

- Job description matching (paste JD, score resume against it)
- Multiple resume templates
- User dashboard with history
- Resume version comparison
- LinkedIn profile import

---

## License

MIT — use freely for personal and commercial projects.
