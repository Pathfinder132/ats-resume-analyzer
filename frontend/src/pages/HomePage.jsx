import { Link } from 'react-router-dom'

const stats = [
  { value: '10K+', label: 'Resumes Analyzed' },
  { value: '87%', label: 'Avg Score Improvement' },
  { value: '3s', label: 'Analysis Time' },
  { value: '₹99', label: 'One-time Cost' },
]

const features = [
  {
    icon: (
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
        <circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/>
      </svg>
    ),
    title: 'ATS Score Analysis',
    desc: 'Get a 0–100 ATS compatibility score with detailed breakdown across formatting, keywords, skills, and experience impact.'
  },
  {
    icon: (
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
        <path d="M12 2L2 7l10 5 10-5-10-5z"/><path d="M2 17l10 5 10-5M2 12l10 5 10-5"/>
      </svg>
    ),
    title: 'AI Keyword Detection',
    desc: 'Identify missing keywords and technical skills that ATS systems scan for, matched to your industry.'
  },
  {
    icon: (
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
        <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/><polyline points="10 9 9 9 8 9"/>
      </svg>
    ),
    title: 'Resume Rewriting',
    desc: 'AI rewrites your bullets with strong action verbs, measurable impact, and ATS-friendly structure. No fabrication.'
  },
  {
    icon: (
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
        <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/>
      </svg>
    ),
    title: 'Download Ready PDF',
    desc: 'Get a professionally formatted, ATS-optimized resume PDF ready to submit to any job application.'
  },
]

export default function HomePage() {
  return (
    <div>
      {/* Hero */}
      <section className="relative overflow-hidden bg-white border-b border-ink-100">
        {/* Background grid */}
        <div className="absolute inset-0 opacity-30"
          style={{ backgroundImage: 'radial-gradient(circle at 1px 1px, #d1d0cc 1px, transparent 0)', backgroundSize: '32px 32px' }} />

        <div className="relative max-w-5xl mx-auto px-6 py-24 text-center">
          {/* Badge */}
          <div className="inline-flex items-center gap-2 bg-sage-50 border border-sage-100 text-sage-500 text-xs font-mono font-500 px-4 py-2 rounded-full mb-8 animate-fade-up">
            <span className="w-1.5 h-1.5 rounded-full bg-sage-500 animate-pulse-slow"/>
            Free ATS analysis — no signup required
          </div>

          <h1 className="font-display text-5xl sm:text-6xl lg:text-7xl text-ink-900 mb-6 leading-tight animate-fade-up animate-delay-100">
            Beat the bots.<br />
            <em className="not-italic text-sage-500">Land the interview.</em>
          </h1>

          <p className="text-lg text-ink-500 max-w-xl mx-auto mb-10 leading-relaxed animate-fade-up animate-delay-200">
            Most resumes are rejected before a human sees them.
            ResumeIQ analyzes your resume against ATS algorithms and rewrites it for maximum visibility.
          </p>

          <div className="flex flex-col sm:flex-row gap-3 justify-center animate-fade-up animate-delay-300">
            <Link to="/analyze" className="btn-primary text-base px-8 py-4">
              Analyze My Resume — Free
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M5 12h14M12 5l7 7-7 7"/>
              </svg>
            </Link>
            <a href="#how-it-works" className="btn-outline text-base px-8 py-4">
              See How It Works
            </a>
          </div>

          {/* Mini score preview */}
          <div className="mt-16 max-w-sm mx-auto card p-6 animate-fade-up animate-delay-400">
            <div className="flex items-center justify-between mb-4">
              <div className="text-left">
                <div className="text-xs font-mono text-ink-400 mb-1">EXAMPLE SCORE</div>
                <div className="font-display text-4xl text-ink-900">64</div>
                <div className="text-sm text-amber-500 font-500">Needs Improvement</div>
              </div>
              <div className="flex-1 ml-6 space-y-2">
                {[
                  { l: 'Keywords', v: 60, c: 'bg-amber-500' },
                  { l: 'Formatting', v: 72, c: 'bg-ink-600' },
                  { l: 'Experience', v: 50, c: 'bg-crimson-500' },
                ].map(b => (
                  <div key={b.l}>
                    <div className="flex justify-between text-xs text-ink-400 mb-0.5">
                      <span>{b.l}</span><span>{b.v}%</span>
                    </div>
                    <div className="h-1.5 bg-ink-100 rounded-full">
                      <div className={`h-full rounded-full ${b.c}`} style={{ width: `${b.v}%` }}/>
                    </div>
                  </div>
                ))}
              </div>
            </div>
            <div className="text-xs text-ink-400 text-center pt-3 border-t border-ink-100">
              ↑ AI optimization improved this to 91
            </div>
          </div>
        </div>
      </section>

      {/* Stats */}
      <section className="bg-ink-900 py-14">
        <div className="max-w-5xl mx-auto px-6 grid grid-cols-2 sm:grid-cols-4 gap-8">
          {stats.map(s => (
            <div key={s.label} className="text-center">
              <div className="font-display text-4xl text-white mb-1">{s.value}</div>
              <div className="text-sm text-ink-400">{s.label}</div>
            </div>
          ))}
        </div>
      </section>

      {/* Features */}
      <section id="how-it-works" className="py-24 max-w-5xl mx-auto px-6">
        <div className="text-center mb-16">
          <div className="section-tag mb-4 justify-center">
            <span>HOW IT WORKS</span>
          </div>
          <h2 className="font-display text-4xl text-ink-900 mb-4">
            From upload to optimized in minutes
          </h2>
          <p className="text-ink-500 max-w-md mx-auto">
            Our two-tier system gives you instant insights for free, with AI optimization when you're ready to level up.
          </p>
        </div>

        <div className="grid sm:grid-cols-2 gap-6">
          {features.map((f, i) => (
            <div key={i} className="card p-6 hover:shadow-md transition-shadow">
              <div className="w-10 h-10 bg-ink-100 rounded-xl flex items-center justify-center text-ink-600 mb-4">
                {f.icon}
              </div>
              <h3 className="font-body font-500 text-ink-900 mb-2">{f.title}</h3>
              <p className="text-sm text-ink-500 leading-relaxed">{f.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Pricing */}
      <section className="py-24 bg-ink-50 border-y border-ink-100">
        <div className="max-w-5xl mx-auto px-6">
          <div className="text-center mb-16">
            <div className="section-tag mb-4 justify-center">PRICING</div>
            <h2 className="font-display text-4xl text-ink-900">Simple, transparent pricing</h2>
          </div>

          <div className="grid sm:grid-cols-2 gap-6 max-w-2xl mx-auto">
            {/* Free */}
            <div className="card p-8">
              <div className="text-xs font-mono text-ink-400 mb-4">FREE TIER</div>
              <div className="font-display text-5xl text-ink-900 mb-1">₹0</div>
              <p className="text-ink-500 text-sm mb-6">Always free. No card needed.</p>
              <div className="space-y-3 mb-8">
                {['ATS Score (0–100)', 'Basic keyword gaps', 'Formatting issues', '2 sample improvements'].map(f => (
                  <div key={f} className="flex items-center gap-2 text-sm text-ink-700">
                    <div className="w-4 h-4 rounded-full bg-ink-200 flex items-center justify-center">
                      <svg width="8" height="8" viewBox="0 0 8 8" fill="none" stroke="#4A4944" strokeWidth="2">
                        <path d="M1.5 4l1.5 2L6.5 2"/>
                      </svg>
                    </div>
                    {f}
                  </div>
                ))}
              </div>
              <Link to="/analyze" className="btn-outline w-full justify-center">Start for Free</Link>
            </div>

            {/* Paid */}
            <div className="card p-8 bg-ink-900 border-ink-900">
              <div className="text-xs font-mono text-ink-400 mb-4">PRO OPTIMIZATION</div>
              <div className="flex items-baseline gap-2 mb-1">
                <div className="font-display text-5xl text-white">₹99</div>
                <div className="text-ink-400 text-sm line-through">₹499</div>
              </div>
              <p className="text-ink-400 text-sm mb-6">One-time. Yours to keep.</p>
              <div className="space-y-3 mb-8">
                {[
                  'Everything in Free',
                  'Full AI analysis report',
                  'Rewritten bullet points',
                  'Keyword optimization',
                  'Downloadable PDF resume',
                  'ATS-safe formatting',
                ].map(f => (
                  <div key={f} className="flex items-center gap-2 text-sm text-white">
                    <div className="w-4 h-4 rounded-full bg-sage-500 flex items-center justify-center">
                      <svg width="8" height="8" viewBox="0 0 8 8" fill="none" stroke="white" strokeWidth="2">
                        <path d="M1.5 4l1.5 2L6.5 2"/>
                      </svg>
                    </div>
                    {f}
                  </div>
                ))}
              </div>
              <Link to="/analyze" className="btn-sage w-full justify-center">Analyze &amp; Optimize</Link>
            </div>
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="py-24 max-w-5xl mx-auto px-6 text-center">
        <h2 className="font-display text-5xl text-ink-900 mb-6">
          Your resume deserves<br />to be seen.
        </h2>
        <p className="text-ink-500 mb-8 max-w-md mx-auto">
          Upload your resume and get your ATS score in under 3 seconds. Free, no signup required.
        </p>
        <Link to="/analyze" className="btn-primary text-base px-10 py-4">
          Get My ATS Score
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M5 12h14M12 5l7 7-7 7"/>
          </svg>
        </Link>
      </section>
    </div>
  )
}
