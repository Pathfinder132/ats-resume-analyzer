import { useEffect, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import ScoreRing from '../components/ScoreRing'
import ScoreBreakdown from '../components/ScoreBreakdown'
import JDMatchSection from '../components/JDMatchSection'
import { getResumeStatus } from '../services/api'

function Tag({ children, color = 'default' }) {
  const colors = {
    default: 'bg-ink-100 text-ink-600',
    red:     'bg-crimson-50 text-crimson-500',
    green:   'bg-sage-50 text-sage-500',
    amber:   'bg-amber-50 text-amber-500',
  }
  return (
    <span className={`inline-block px-2.5 py-0.5 rounded-md text-xs font-mono font-500 ${colors[color]}`}>
      {children}
    </span>
  )
}

function LockBadge() {
  return (
    <div className="inline-flex items-center gap-1 text-xs text-ink-400 bg-ink-100 px-2 py-1 rounded">
      <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0110 0v4"/>
      </svg>
      Locked · Upgrade to unlock
    </div>
  )
}

export default function ResultsPage() {
  const { resumeId } = useParams()
  const navigate     = useNavigate()
  const [data, setData]     = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError]   = useState('')

  useEffect(() => {
    const load = async () => {
      try {
        const res = await getResumeStatus(resumeId)
        setData(res)
      } catch (e) {
        setError(e.message || 'Failed to load results')
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [resumeId])

  if (loading) return (
    <div className="max-w-4xl mx-auto px-6 py-20 text-center">
      <div className="skeleton h-6 w-48 rounded mx-auto mb-4"/>
      <div className="skeleton h-48 w-48 rounded-full mx-auto mb-8"/>
      <div className="space-y-3 max-w-md mx-auto">
        {[1,2,3].map(i => <div key={i} className="skeleton h-4 rounded"/>)}
      </div>
    </div>
  )

  if (error) return (
    <div className="max-w-2xl mx-auto px-6 py-20 text-center">
      <p className="text-crimson-500 mb-4">{error}</p>
      <button onClick={() => navigate('/analyze')} className="btn-outline">Try Again</button>
    </div>
  )

  const { atsScore, scoreBreakdown, freeAnalysis } = data

  // ── Unreadable / non-resume file ─────────────────────────────────────────
  if (atsScore === 0) {
    const messages = freeAnalysis?.formattingIssues || []
    const isImagePdf = messages[0]?.toLowerCase().includes('scanned') ||
                       messages[0]?.toLowerCase().includes('image')
    return (
      <div className="max-w-xl mx-auto px-6 py-24 text-center">
        <div className="card p-10">
          <div className="w-16 h-16 rounded-2xl bg-amber-50 border border-amber-200 flex items-center justify-center mx-auto mb-6">
            <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#D97706" strokeWidth="1.5">
              <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/>
              <polyline points="14 2 14 8 20 8"/>
              <line x1="12" y1="11" x2="12" y2="16"/>
              <line x1="12" y1="19" x2="12.01" y2="19"/>
            </svg>
          </div>
          <h2 className="font-display text-2xl text-ink-900 mb-3">
            {isImagePdf ? 'Could not read this PDF' : 'File not recognised'}
          </h2>
          <div className="space-y-2 mb-8 text-left bg-amber-50 border border-amber-100 rounded-xl p-4">
            {messages.length > 0 ? messages.map((msg, i) => (
              <p key={i} className={`text-sm ${i === 0 ? 'text-ink-800 font-500' : 'text-ink-600'}`}>
                {i === 0 ? '⚠️ ' : '→ '}{msg}
              </p>
            )) : (
              <p className="text-sm text-ink-600">→ Please upload a text-based PDF or DOCX resume file.</p>
            )}
          </div>
          {isImagePdf && (
            <div className="mb-6 p-4 bg-ink-50 border border-ink-100 rounded-xl text-left">
              <p className="text-xs font-500 text-ink-700 mb-2">How to get a readable PDF:</p>
              <ol className="text-xs text-ink-500 space-y-1 list-decimal list-inside">
                <li>Open your resume in Google Docs, Word, or Overleaf</li>
                <li>Go to File → Download → PDF Document</li>
                <li>Upload that PDF — it will have selectable text</li>
              </ol>
            </div>
          )}
          <button onClick={() => navigate('/analyze')} className="btn-primary w-full justify-center">
            Upload a Different File
          </button>
        </div>
      </div>
    )
  }

  const isHighScore = atsScore >= 85

  return (
    <div className="max-w-4xl mx-auto px-6 py-12">
      {/* Header */}
      <div className="text-center mb-10 animate-fade-up">
        <div className="section-tag mb-4 justify-center">ATS ANALYSIS COMPLETE</div>
        <h1 className="font-display text-4xl text-ink-900 mb-2">Your Resume Score</h1>
        <p className="text-ink-500">
          {isHighScore
            ? 'Your resume is already strong. See what to improve below.'
            : "Here's what's holding your resume back from ATS systems."}
        </p>
      </div>

      <div className="grid lg:grid-cols-3 gap-6">
        {/* Score column */}
        <div className="lg:col-span-1 space-y-6">
          <div className="card p-8 text-center animate-fade-up animate-delay-100">
            <ScoreRing score={atsScore} />
            {isHighScore && (
              <div className="mt-4 p-3 bg-sage-50 border border-sage-100 rounded-xl text-sm text-sage-500">
                Your resume is already highly optimized for ATS systems.
              </div>
            )}
          </div>
          <div className="card p-6 animate-fade-up animate-delay-200">
            <h3 className="font-body font-500 text-ink-900 mb-5">Score Breakdown</h3>
            <ScoreBreakdown breakdown={scoreBreakdown} />
          </div>
        </div>

        {/* Analysis column */}
        <div className="lg:col-span-2 space-y-6">
          {/* Missing Keywords */}
          <div className="card p-6 animate-fade-up animate-delay-100">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-body font-500 text-ink-900">Missing Keywords</h3>
              <Tag color="red">{freeAnalysis?.missingKeywords?.length || 0} missing</Tag>
            </div>
            {freeAnalysis?.missingKeywords?.length > 0 ? (
              <div className="flex flex-wrap gap-2">
                {freeAnalysis.missingKeywords.map(kw => (
                  <span key={kw} className="inline-flex items-center gap-1 px-3 py-1 bg-crimson-50 border border-crimson-100 text-crimson-500 text-xs font-mono rounded-lg">
                    <svg width="8" height="8" viewBox="0 0 8 8" fill="none" stroke="currentColor" strokeWidth="1.5">
                      <path d="M4 1v6M1 4h6"/>
                    </svg>
                    {kw}
                  </span>
                ))}
              </div>
            ) : (
              <p className="text-sm text-sage-500">Great — major keywords detected!</p>
            )}
            <div className="mt-3 flex items-center gap-1.5">
              <LockBadge />
              <span className="text-xs text-ink-400">
                +{Math.max(0, 25 - (freeAnalysis?.missingKeywords?.length || 0))} more in full analysis
              </span>
            </div>
          </div>

          {/* Formatting Issues */}
          {freeAnalysis?.formattingIssues?.length > 0 && (
            <div className="card p-6 animate-fade-up animate-delay-200">
              <h3 className="font-body font-500 text-ink-900 mb-4">Formatting Issues</h3>
              <div className="space-y-2">
                {freeAnalysis.formattingIssues.map((issue, i) => (
                  <div key={i} className="flex items-start gap-3 text-sm">
                    <div className="w-5 h-5 rounded-full bg-amber-50 border border-amber-200 flex items-center justify-center flex-shrink-0 mt-0.5">
                      <svg width="8" height="8" viewBox="0 0 8 8" fill="none" stroke="#D97706" strokeWidth="2">
                        <path d="M4 2v2.5M4 6v.5"/>
                      </svg>
                    </div>
                    <span className="text-ink-700">{issue}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Weak Bullets */}
          {freeAnalysis?.weakBullets?.length > 0 && (
            <div className="card p-6 animate-fade-up animate-delay-300">
              <div className="flex items-center justify-between mb-4">
                <h3 className="font-body font-500 text-ink-900">Weak Experience Bullets</h3>
                <LockBadge />
              </div>
              <div className="space-y-2">
                {freeAnalysis.weakBullets.slice(0, 2).map((b, i) => (
                  <div key={i} className="p-3 bg-ink-50 border border-ink-100 rounded-lg text-sm text-ink-600 font-mono">
                    "{b.length > 80 ? b.slice(0, 80) + '...' : b}"
                  </div>
                ))}
              </div>
              {freeAnalysis.weakBullets.length > 2 && (
                <p className="text-xs text-ink-400 mt-2">
                  + {freeAnalysis.weakBullets.length - 2} more weak bullets detected
                </p>
              )}
            </div>
          )}

          {/* Sample Improvements */}
          <div className="card p-6 animate-fade-up animate-delay-400">
            <div className="flex items-center justify-between mb-5">
              <h3 className="font-body font-500 text-ink-900">Sample Bullet Improvements</h3>
              <Tag color="amber">Preview</Tag>
            </div>
            <div className="space-y-5">
              {(freeAnalysis?.sampleImprovements || []).slice(0, 2).map((imp, i) => (
                <div key={i} className="space-y-2">
                  <div className="p-3 bg-crimson-50 border border-crimson-100 rounded-lg">
                    <div className="text-xs font-mono text-crimson-500 mb-1">BEFORE</div>
                    <p className="text-sm text-ink-800">{imp.before}</p>
                  </div>
                  <div className="flex items-center gap-2 text-ink-400">
                    <div className="flex-1 h-px bg-ink-100"/>
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <path d="M12 5v14M5 12l7 7 7-7"/>
                    </svg>
                    <div className="flex-1 h-px bg-ink-100"/>
                  </div>
                  <div className="p-3 bg-sage-50 border border-sage-100 rounded-lg">
                    <div className="text-xs font-mono text-sage-500 mb-1">AFTER</div>
                    <p className="text-sm text-ink-800">{imp.after}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* JD Match — the paid feature */}
          <JDMatchSection resumeId={resumeId} />
        </div>
      </div>
    </div>
  )
}