import { useEffect, useState } from 'react'
import { useParams, Link } from 'react-router-dom'
import ScoreRing from '../components/ScoreRing'
import { getResumeStatus } from '../services/api'

function Section({ title, children, accent = 'ink' }) {
  const accents = { ink: 'border-l-ink-900', sage: 'border-l-sage-500', amber: 'border-l-amber-500' }
  return (
    <div className={`card p-6 border-l-4 ${accents[accent]}`}>
      <h3 className="font-body font-500 text-ink-900 mb-4">{title}</h3>
      {children}
    </div>
  )
}

export default function OptimizedPage() {
  const { resumeId } = useParams()
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    const load = async () => {
      try {
        const res = await getResumeStatus(resumeId)
        if (!res.isPaid) { setError('Access denied. Payment required.'); return }
        setData(res)
      } catch (e) {
        setError(e.message)
      } finally { setLoading(false) }
    }
    load()
  }, [resumeId])

  if (loading) return (
    <div className="max-w-4xl mx-auto px-6 py-20">
      <div className="space-y-4">
        {[1,2,3,4].map(i => <div key={i} className="skeleton h-24 rounded-2xl"/>)}
      </div>
    </div>
  )

  if (error) return (
    <div className="max-w-2xl mx-auto px-6 py-20 text-center">
      <p className="text-crimson-500 mb-4">{error}</p>
      <Link to="/analyze" className="btn-outline">Start New Analysis</Link>
    </div>
  )

  const {
    atsScore,
    optimizedAtsScore,
    fullAnalysis,
    optimizedResumeJson: resume,
  } = data

  // Show new score if available, fall back to original
  const displayScore   = optimizedAtsScore || atsScore
  const scoreImproved  = optimizedAtsScore && optimizedAtsScore > atsScore
  const scoreDiff      = optimizedAtsScore ? optimizedAtsScore - atsScore : 0

  return (
    <div className="max-w-4xl mx-auto px-6 py-12">
      {/* Hero header */}
      <div className="card p-8 bg-ink-900 border-ink-900 mb-8 animate-fade-up">
        <div className="flex flex-col sm:flex-row items-center gap-6">
          <div className="relative">
            <ScoreRing score={displayScore} size={140} animated={false} />
            {/* Score improvement badge */}
            {scoreImproved && (
              <div className="absolute -top-1 -right-1 bg-sage-500 text-white text-xs font-mono font-500 px-2 py-0.5 rounded-full">
                +{scoreDiff}
              </div>
            )}
          </div>
          <div className="text-center sm:text-left flex-1">
            <div className="section-tag text-ink-400 mb-3">OPTIMIZATION COMPLETE</div>
            <h1 className="font-display text-4xl text-white mb-2">Your Resume is Ready</h1>
            <p className="text-ink-400 mb-2 text-sm leading-relaxed">
              {fullAnalysis?.overallFeedback || 'AI has optimized your resume for maximum ATS compatibility.'}
            </p>
            {scoreImproved && (
              <p className="text-sage-400 text-xs mb-4 font-mono">
                Score improved: {atsScore} → {optimizedAtsScore} (+{scoreDiff} pts)
              </p>
            )}
            <a
              href={`http://localhost:5000/api/resume/download/${resumeId}`}
              className="btn-sage inline-flex items-center gap-2"
              download="optimized-resume.pdf"
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4"/>
                <polyline points="7 10 12 15 17 10"/>
                <line x1="12" y1="15" x2="12" y2="3"/>
              </svg>
              Download Optimized Resume PDF
            </a>
          </div>
        </div>
      </div>

      <div className="grid lg:grid-cols-3 gap-6">
        {/* Left column */}
        <div className="lg:col-span-1 space-y-6">
          {/* Strengths */}
          {fullAnalysis?.topStrengths?.length > 0 && (
            <Section title="✦ Top Strengths" accent="sage">
              <div className="space-y-2">
                {fullAnalysis.topStrengths.map((s, i) => (
                  <div key={i} className="flex items-start gap-2 text-sm text-ink-700">
                    <span className="text-sage-500 mt-0.5 flex-shrink-0">✓</span> {s}
                  </div>
                ))}
              </div>
            </Section>
          )}

          {/* Issues Fixed */}
          {fullAnalysis?.criticalIssues?.length > 0 && (
            <Section title="Issues Fixed" accent="amber">
              <div className="space-y-2">
                {fullAnalysis.criticalIssues.map((s, i) => (
                  <div key={i} className="flex items-start gap-2 text-sm text-ink-700">
                    <span className="text-amber-500 mt-0.5 flex-shrink-0">→</span> {s}
                  </div>
                ))}
              </div>
            </Section>
          )}

          {/* Keywords Added */}
          {fullAnalysis?.keywordSuggestions?.length > 0 && (
            <Section title="Keywords Added" accent="ink">
              <div className="flex flex-wrap gap-2">
                {fullAnalysis.keywordSuggestions.map(kw => (
                  <span key={kw} className="px-2.5 py-0.5 bg-sage-50 border border-sage-100 text-sage-500 text-xs font-mono rounded-lg">
                    + {kw}
                  </span>
                ))}
              </div>
            </Section>
          )}

          {/* Skills Highlighted */}
          {fullAnalysis?.skillsToAdd?.length > 0 && (
            <Section title="Skills Highlighted" accent="ink">
              <div className="flex flex-wrap gap-2">
                {fullAnalysis.skillsToAdd.map(skill => (
                  <span key={skill} className="px-2.5 py-0.5 bg-ink-50 text-ink-600 text-xs font-mono rounded-lg border border-ink-100">
                    {skill}
                  </span>
                ))}
              </div>
            </Section>
          )}
        </div>

        {/* Right column */}
        <div className="lg:col-span-2 space-y-6">
          {/* Bullet Improvements */}
          {fullAnalysis?.bulletImprovements?.length > 0 && (
            <Section title="Rewritten Bullet Points" accent="sage">
              <div className="space-y-4">
                {fullAnalysis.bulletImprovements.map((b, i) => (
                  <div key={i}>
                    <div className="p-3 bg-crimson-50 border border-crimson-100 rounded-lg mb-2">
                      <div className="text-xs font-mono text-crimson-500 mb-1">ORIGINAL</div>
                      <p className="text-sm text-ink-700">{b.original}</p>
                    </div>
                    <div className="p-3 bg-sage-50 border border-sage-100 rounded-lg">
                      <div className="text-xs font-mono text-sage-500 mb-1">OPTIMIZED</div>
                      <p className="text-sm text-ink-800 font-500">{b.improved}</p>
                    </div>
                  </div>
                ))}
              </div>
            </Section>
          )}

          {/* Optimized Experience */}
          {resume?.experience?.length > 0 && (
            <Section title="Optimized Experience" accent="ink">
              <div className="space-y-5">
                {resume.experience.map((exp, i) => (
                  <div key={i} className={i > 0 ? 'pt-5 border-t border-ink-100' : ''}>
                    <div className="flex justify-between items-start mb-2">
                      <div>
                        <div className="font-500 text-ink-900">{exp.role}</div>
                        <div className="text-sm text-ink-500">
                          {exp.company}{exp.location ? ` — ${exp.location}` : ''}
                        </div>
                      </div>
                      <div className="text-xs font-mono text-ink-400">{exp.duration}</div>
                    </div>
                    <ul className="space-y-1">
                      {(exp.bullets || []).map((b, j) => (
                        <li key={j} className="flex items-start gap-2 text-sm text-ink-700">
                          <span className="text-sage-500 flex-shrink-0 mt-0.5">•</span> {b}
                        </li>
                      ))}
                    </ul>
                  </div>
                ))}
              </div>
            </Section>
          )}

          {/* Optimized Projects */}
          {resume?.projects?.length > 0 && (
            <Section title="Optimized Projects" accent="ink">
              <div className="space-y-4">
                {resume.projects.map((proj, i) => (
                  <div key={i} className={i > 0 ? 'pt-4 border-t border-ink-100' : ''}>
                    <div className="font-500 text-ink-900 mb-1">{proj.title}</div>
                    {proj.tech?.length > 0 && (
                      <div className="flex flex-wrap gap-1 mb-2">
                        {proj.tech.map(t => (
                          <span key={t} className="px-2 py-0.5 bg-ink-100 text-ink-600 text-xs font-mono rounded">{t}</span>
                        ))}
                      </div>
                    )}
                    {(proj.bullets || []).map((b, j) => (
                      <div key={j} className="flex items-start gap-2 text-sm text-ink-700">
                        <span className="text-sage-500 flex-shrink-0">•</span> {b}
                      </div>
                    ))}
                  </div>
                ))}
              </div>
            </Section>
          )}

          {/* Skills Overview */}
          {resume?.skills && (
            <Section title="Skills Overview" accent="ink">
              {resume.skills.technical?.length > 0 && (
                <div className="mb-3">
                  <div className="text-xs font-mono text-ink-400 mb-2">TECHNICAL</div>
                  <div className="flex flex-wrap gap-2">
                    {resume.skills.technical.map(s => (
                      <span key={s} className="px-2.5 py-1 bg-ink-900 text-white text-xs font-mono rounded-lg">{s}</span>
                    ))}
                  </div>
                </div>
              )}
              {resume.skills.tools?.length > 0 && (
                <div>
                  <div className="text-xs font-mono text-ink-400 mb-2">TOOLS</div>
                  <div className="flex flex-wrap gap-2">
                    {resume.skills.tools.map(s => (
                      <span key={s} className="px-2.5 py-1 bg-ink-50 border border-ink-100 text-ink-600 text-xs font-mono rounded-lg">{s}</span>
                    ))}
                  </div>
                </div>
              )}
            </Section>
          )}

          {/* Download CTA */}
          <div className="card p-8 bg-sage-50 border-sage-100 text-center">
            <div className="text-4xl mb-3">📄</div>
            <h3 className="font-display text-2xl text-ink-900 mb-2">Your optimized resume is ready</h3>
            <p className="text-ink-500 text-sm mb-5">
              Professional single-page PDF with ATS-safe formatting. Ready to submit.
            </p>
            <a
              href={`http://localhost:5000/api/resume/download/${resumeId}`}
              className="btn-sage inline-flex items-center gap-2 text-base px-8 py-4"
              download="optimized-resume.pdf"
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4"/>
                <polyline points="7 10 12 15 17 10"/>
                <line x1="12" y1="15" x2="12" y2="3"/>
              </svg>
              Download Optimized Resume PDF
            </a>
            <div className="mt-4">
              <Link to="/analyze" className="text-sm text-ink-400 hover:text-ink-700 transition-colors">
                Analyze another resume →
              </Link>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}