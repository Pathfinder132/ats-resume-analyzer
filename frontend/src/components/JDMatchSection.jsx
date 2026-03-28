import { useState } from 'react'
import axios from 'axios'

const api = axios.create({ baseURL: 'http://localhost:5000/api', timeout: 120000 })

async function callMatchJD(resumeId, jobDescription, jobTitle) {
  const res = await api.post('/resume/match-jd', { resumeId, jobDescription, jobTitle })
  return res.data
}

function MatchBar({ pct }) {
  const color = pct >= 70 ? '#2D5A3D' : pct >= 50 ? '#D97706' : '#DC2626'
  const label = pct >= 70 ? 'Strong Match' : pct >= 50 ? 'Partial Match' : 'Low Match'
  return (
    <div className="space-y-2">
      <div className="flex justify-between items-center">
        <span className="text-sm font-500 text-ink-800">{label}</span>
        <span className="font-display text-2xl font-bold" style={{ color }}>{pct}%</span>
      </div>
      <div className="h-3 bg-ink-100 rounded-full overflow-hidden">
        <div
          className="h-full rounded-full transition-all duration-700"
          style={{ width: `${pct}%`, background: color }}
        />
      </div>
      <p className="text-xs text-ink-400">
        {pct >= 70
          ? 'Your resume is well-aligned with this role.'
          : pct >= 50
          ? 'Your resume partially matches — see missing keywords below.'
          : 'Significant keyword gaps — tailoring will help a lot.'}
      </p>
    </div>
  )
}

export default function JDMatchSection({ resumeId, isPaid }) {
  const [step, setStep] = useState('input') // input | loading | result
  const [jdText, setJdText] = useState('')
  const [jobTitle, setJobTitle] = useState('')
  const [result, setResult] = useState(null)
  const [error, setError] = useState('')

  const handleMatch = async () => {
    if (jdText.trim().length < 50) {
      setError('Paste at least a few lines of the job description.')
      return
    }
    setError('')
    setStep('loading')
    try {
      const data = await callMatchJD(resumeId, jdText, jobTitle)
      setResult(data)
      setStep('result')
    } catch (e) {
      setError(e.response?.data?.message || e.message || 'Something went wrong')
      setStep('input')
    }
  }

  const handleReset = () => {
    setStep('input')
    setResult(null)
    setJdText('')
    setJobTitle('')
  }

  return (
    <div className="card border-2 border-dashed border-ink-200 hover:border-sage-300 transition-colors">
      {/* Header */}
      <div className="p-6 border-b border-ink-100">
        <div className="flex items-start justify-between">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <span className="text-xs font-mono font-500 bg-sage-50 text-sage-500 border border-sage-100 px-2 py-0.5 rounded">
                NEW ✦ ₹29
              </span>
            </div>
            <h3 className="font-display text-xl text-ink-900">Tailor Resume to a Job</h3>
            <p className="text-sm text-ink-500 mt-1">
              Paste any job description. We'll show your match score, missing keywords,
              and rewrite your bullets specifically for this role.
            </p>
          </div>
        </div>
      </div>

      <div className="p-6">
        {/* ── Step: Input ── */}
        {step === 'input' && (
          <div className="space-y-4">
            <div>
              <label className="block text-xs font-500 text-ink-600 mb-1.5">
                Job Title <span className="text-ink-400 font-normal">(optional but helps)</span>
              </label>
              <input
                type="text"
                value={jobTitle}
                onChange={e => setJobTitle(e.target.value)}
                placeholder="e.g. Software Engineer Intern, Data Analyst"
                className="w-full px-3 py-2 text-sm border border-ink-200 rounded-lg focus:outline-none focus:border-sage-400 bg-white"
              />
            </div>
            <div>
              <label className="block text-xs font-500 text-ink-600 mb-1.5">
                Job Description <span className="text-crimson-500">*</span>
              </label>
              <textarea
                value={jdText}
                onChange={e => setJdText(e.target.value)}
                placeholder="Paste the full job description here — from LinkedIn, Instahyre, Naukri, or any job portal..."
                rows={6}
                className="w-full px-3 py-2 text-sm border border-ink-200 rounded-lg focus:outline-none focus:border-sage-400 bg-white resize-none font-body"
              />
              <div className="flex justify-between mt-1">
                <p className="text-xs text-ink-400">Min 50 characters</p>
                <p className="text-xs text-ink-400">{jdText.length} chars</p>
              </div>
            </div>

            {error && (
              <p className="text-sm text-crimson-500 bg-crimson-50 border border-crimson-100 rounded-lg px-3 py-2">
                {error}
              </p>
            )}

            {/* What you get preview */}
            <div className="bg-ink-50 rounded-xl p-4 space-y-2">
              <p className="text-xs font-500 text-ink-600 mb-2">What you get for ₹29:</p>
              {[
                'Match % score for this specific role',
                'Keywords the JD wants that you\'re missing',
                'AI-rewritten bullets tailored to this JD',
                'Download a tailored PDF ready to submit',
              ].map((f, i) => (
                <div key={i} className="flex items-center gap-2 text-xs text-ink-600">
                  <div className="w-4 h-4 rounded-full bg-sage-500 flex items-center justify-center flex-shrink-0">
                    <svg width="8" height="8" viewBox="0 0 8 8" fill="none" stroke="white" strokeWidth="2">
                      <path d="M1.5 4l1.5 2L6.5 2"/>
                    </svg>
                  </div>
                  {f}
                </div>
              ))}
            </div>

            <button
              onClick={handleMatch}
              disabled={jdText.trim().length < 50}
              className="btn-sage w-full py-3 text-sm disabled:opacity-40"
            >
              Analyse & Tailor — ₹29
            </button>
            <p className="text-center text-xs text-ink-400">
              Secured by Razorpay · UPI, Cards, Net Banking
            </p>
          </div>
        )}

        {/* ── Step: Loading ── */}
        {step === 'loading' && (
          <div className="py-10 text-center space-y-4">
            <svg className="animate-spin w-10 h-10 text-sage-500 mx-auto" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/>
            </svg>
            <div>
              <p className="font-500 text-ink-800">Analysing job description...</p>
              <p className="text-sm text-ink-400 mt-1">Matching keywords, rewriting bullets, generating PDF</p>
            </div>
          </div>
        )}

        {/* ── Step: Result ── */}
        {step === 'result' && result && (
          <div className="space-y-6">
            {/* Before / After match comparison */}
            <div className="grid grid-cols-2 gap-3">
              <div className="bg-ink-50 border border-ink-100 rounded-xl p-4 text-center">
                <p className="text-xs font-mono text-ink-400 mb-1">ORIGINAL MATCH</p>
                <p className="font-display text-3xl font-bold text-crimson-500">
                  {result.matchPercentage}%
                </p>
                <p className="text-xs text-ink-400 mt-1">before tailoring</p>
              </div>
              <div className="bg-sage-50 border border-sage-100 rounded-xl p-4 text-center">
                <p className="text-xs font-mono text-sage-500 mb-1">AFTER TAILORING</p>
                <p className="font-display text-3xl font-bold text-sage-500">
                  {result.tailoredMatchPct}%
                </p>
                {result.improvement > 0 && (
                  <p className="text-xs text-sage-500 mt-1">+{result.improvement}% improvement</p>
                )}
              </div>
            </div>

            {/* Progress bar showing tailored % */}
            <MatchBar pct={result.tailoredMatchPct ?? result.matchPercentage} />

            {/* Keywords grid */}
            <div className="grid sm:grid-cols-2 gap-4">
              {/* Have */}
              <div>
                <div className="flex items-center gap-2 mb-2">
                  <div className="w-2 h-2 rounded-full bg-sage-500"/>
                  <span className="text-xs font-500 text-ink-700">
                    Keywords You Have ({result.keywordsYouHave?.length || 0})
                  </span>
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {(result.keywordsYouHave || []).slice(0, 12).map(kw => (
                    <span key={kw} className="px-2 py-0.5 bg-sage-50 border border-sage-100 text-sage-600 text-xs font-mono rounded">
                      ✓ {kw}
                    </span>
                  ))}
                  {(result.keywordsYouHave?.length || 0) > 12 && (
                    <span className="text-xs text-ink-400">+{result.keywordsYouHave.length - 12} more</span>
                  )}
                </div>
              </div>

              {/* Missing */}
              <div>
                <div className="flex items-center gap-2 mb-2">
                  <div className="w-2 h-2 rounded-full bg-crimson-500"/>
                  <span className="text-xs font-500 text-ink-700">
                    Missing Keywords ({result.keywordsMissing?.length || 0})
                  </span>
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {(result.keywordsMissing || []).slice(0, 12).map(kw => (
                    <span key={kw} className="px-2 py-0.5 bg-crimson-50 border border-crimson-100 text-crimson-500 text-xs font-mono rounded">
                      + {kw}
                    </span>
                  ))}
                  {(result.keywordsMissing?.length || 0) === 0 && (
                    <span className="text-xs text-sage-500">All key skills matched! 🎉</span>
                  )}
                </div>
              </div>
            </div>

            {/* Rewritten bullets */}
            {result.rewrittenBullets?.length > 0 && (
              <div>
                <h4 className="text-sm font-500 text-ink-900 mb-3">
                  Bullets Tailored for This Role
                </h4>
                <div className="space-y-3">
                  {result.rewrittenBullets.map((b, i) => (
                    <div key={i} className="rounded-xl overflow-hidden border border-ink-100">
                      <div className="p-3 bg-crimson-50">
                        <div className="text-xs font-mono text-crimson-500 mb-1">BEFORE</div>
                        <p className="text-xs text-ink-700">{b.original}</p>
                      </div>
                      <div className="p-3 bg-sage-50">
                        <div className="text-xs font-mono text-sage-500 mb-1">TAILORED FOR {(result.jobTitle || 'THIS ROLE').toUpperCase()}</div>
                        <p className="text-xs text-ink-800 font-500">{b.improved}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Download */}
            <div className="bg-ink-900 rounded-xl p-5 text-center">
              <p className="text-white text-sm font-500 mb-1">Your tailored resume is ready</p>
              <p className="text-ink-400 text-xs mb-4">
                PDF with bullets rewritten for {result.jobTitle || 'this role'}
              </p>
              <a
                href={`http://localhost:5000${result.downloadUrl}`}
                download="tailored-resume.pdf"
                className="btn-sage inline-flex items-center gap-2 text-sm"
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4"/>
                  <polyline points="7 10 12 15 17 10"/>
                  <line x1="12" y1="15" x2="12" y2="3"/>
                </svg>
                Download Tailored Resume PDF
              </a>
            </div>

            <button
              onClick={handleReset}
              className="w-full text-sm text-ink-400 hover:text-ink-700 transition-colors py-2"
            >
              ← Try with a different job description
            </button>
          </div>
        )}
      </div>
    </div>
  )
}