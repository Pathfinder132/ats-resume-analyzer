import { useEffect, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import ScoreRing from '../components/ScoreRing'
import ScoreBreakdown from '../components/ScoreBreakdown'
import PaymentModal from '../components/PaymentModal'
import { getResumeStatus, optimizeResume } from '../services/api'

function Tag({ children, color = 'default' }) {
  const colors = {
    default: 'bg-ink-100 text-ink-600',
    red: 'bg-crimson-50 text-crimson-500',
    green: 'bg-sage-50 text-sage-500',
    amber: 'bg-amber-50 text-amber-500',
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
  const navigate = useNavigate()
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [showPayment, setShowPayment] = useState(false)
  const [optimizing, setOptimizing] = useState(false)

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

  const handlePaymentSuccess = async () => {
    setShowPayment(false)
    setOptimizing(true)
    try {
      await optimizeResume(resumeId)
      navigate(`/optimized/${resumeId}`)
    } catch (e) {
      setError('Optimization failed: ' + (e.message || 'Unknown error'))
      setOptimizing(false)
    }
  }

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

  const { atsScore, scoreBreakdown, freeAnalysis, isPaid } = data
  const isHighScore = atsScore >= 85

  return (
    <div className="max-w-4xl mx-auto px-6 py-12">
      {optimizing && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-ink-900/60 backdrop-blur-sm">
          <div className="card p-10 text-center max-w-sm w-full">
            <svg className="animate-spin w-10 h-10 text-sage-500 mx-auto mb-4" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/>
            </svg>
            <h3 className="font-display text-2xl text-ink-900 mb-2">Optimizing your resume</h3>
            <p className="text-ink-500 text-sm">AI is rewriting your bullets, adding keywords, and generating your PDF. This takes up to 30 seconds.</p>
          </div>
        </div>
      )}

      {showPayment && (
        <PaymentModal resumeId={resumeId} onSuccess={handlePaymentSuccess} onClose={() => setShowPayment(false)} />
      )}

      {/* Header */}
      <div className="text-center mb-10 animate-fade-up">
        <div className="section-tag mb-4 justify-center">ATS ANALYSIS COMPLETE</div>
        <h1 className="font-display text-4xl text-ink-900 mb-2">Your Resume Score</h1>
        <p className="text-ink-500">
          {isHighScore
            ? 'Your resume is already strong. See the breakdown below.'
            : 'Here\'s what\'s holding your resume back from ATS systems.'}
        </p>
      </div>

      <div className="grid lg:grid-cols-3 gap-6">
        {/* Score column */}
        <div className="lg:col-span-1 space-y-6">
          {/* Score Ring */}
          <div className="card p-8 text-center animate-fade-up animate-delay-100">
            <ScoreRing score={atsScore} />

            {isHighScore && (
              <div className="mt-4 p-3 bg-sage-50 border border-sage-100 rounded-xl text-sm text-sage-500">
                Your resume is already highly optimized for ATS systems.
              </div>
            )}
          </div>

          {/* Score Breakdown */}
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
              <span className="text-xs text-ink-400">+{Math.max(0, 25 - (freeAnalysis?.missingKeywords?.length || 0))} more in full analysis</span>
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
                <p className="text-xs text-ink-400 mt-2">+ {freeAnalysis.weakBullets.length - 2} more weak bullets detected</p>
              )}
            </div>
          )}

          {/* Sample Improvements (free preview) */}
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
                    <div className="text-xs font-mono text-sage-500 mb-1">AFTER (AI Optimized)</div>
                    <p className="text-sm text-ink-800">{imp.after}</p>
                  </div>
                </div>
              ))}
            </div>

            {/* Lock overlay for more improvements */}
            <div className="mt-5 p-4 border-2 border-dashed border-ink-200 rounded-xl text-center bg-ink-50">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#9B9A94" strokeWidth="1.5" className="mx-auto mb-2">
                <rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0110 0v4"/>
              </svg>
              <p className="text-sm font-500 text-ink-700 mb-1">Full optimization locked</p>
              <p className="text-xs text-ink-400">All bullets rewritten + downloadable PDF</p>
            </div>
          </div>

          {/* CTA */}
          <div className={`card p-8 text-center animate-fade-up animate-delay-400 ${isHighScore ? 'bg-sage-50 border-sage-100' : 'bg-ink-900 border-ink-900'}`}>
            {isHighScore ? (
              <>
                <div className="text-3xl mb-3">🎉</div>
                <h3 className="font-display text-2xl text-sage-500 mb-2">Strong resume!</h3>
                <p className="text-ink-600 text-sm mb-5">
                  Your score is excellent. Optional: let AI fine-tune it even further.
                </p>
                <button onClick={handlePaymentSuccess} className="btn-outline border-sage-200 text-sage-500 hover:bg-sage-50">
                  Optional: Full AI Optimization
                </button>
              </>
            ) : (
              <>
                <div className="section-tag text-ink-400 mb-3 justify-center">UNLOCK FULL POTENTIAL</div>
                <h3 className="font-display text-2xl text-white mb-3">
                  Boost your score to <span className="text-sage-300">85+</span>
                </h3>
                <p className="text-ink-400 text-sm mb-6">
                  AI rewrites every bullet point, adds missing keywords, and generates a polished PDF — for just ₹99.
                </p>
                <button onClick={handlePaymentSuccess} className="btn-sage w-full text-base py-4">
                  Optimize My Resume — ₹99
                </button>
                <p className="text-ink-500 text-xs mt-3">One-time · Download your new resume immediately</p>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
