import { Link, useLocation } from 'react-router-dom'
import { useState } from 'react'

export default function Navbar() {
  const location = useLocation()
  const isHome = location.pathname === '/'

  return (
    <nav className="sticky top-0 z-50 bg-white/90 backdrop-blur-sm border-b border-ink-100">
      <div className="max-w-5xl mx-auto px-6 h-16 flex items-center justify-between">
        <Link to="/" className="flex items-center gap-2 group">
          <div className="w-8 h-8 bg-ink-900 rounded-lg flex items-center justify-center">
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
              <rect x="2" y="2" width="5" height="1.5" rx="0.75" fill="white" opacity="0.6"/>
              <rect x="2" y="5" width="12" height="1.5" rx="0.75" fill="white"/>
              <rect x="2" y="8" width="12" height="1.5" rx="0.75" fill="white"/>
              <rect x="2" y="11" width="8" height="1.5" rx="0.75" fill="white" opacity="0.6"/>
            </svg>
          </div>
          <span className="font-display text-xl text-ink-900 group-hover:text-sage-500 transition-colors">
            ResumeIQ
          </span>
        </Link>

        <div className="flex items-center gap-4">
          {!isHome && (
            <Link to="/analyze" className="text-sm text-ink-600 hover:text-ink-900 transition-colors font-body">
              New Analysis
            </Link>
          )}
          <Link to="/analyze" className="btn-primary text-xs px-4 py-2">
            Analyze Resume
          </Link>
        </div>
      </div>
    </nav>
  )
}
