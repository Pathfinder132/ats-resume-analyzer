import { Routes, Route } from 'react-router-dom'
import Navbar from './components/Navbar'
import HomePage from './pages/HomePage'
import AnalyzePage from './pages/AnalyzePage'
import ResultsPage from './pages/ResultsPage'
import OptimizedPage from './pages/OptimizedPage'

export default function App() {
  return (
    <div className="min-h-screen flex flex-col">
      <Navbar />
      <main className="flex-1">
        <Routes>
          <Route path="/" element={<HomePage />} />
          <Route path="/analyze" element={<AnalyzePage />} />
          <Route path="/results/:resumeId" element={<ResultsPage />} />
          <Route path="/optimized/:resumeId" element={<OptimizedPage />} />
        </Routes>
      </main>
      <footer className="border-t border-ink-100 bg-white py-8 mt-20">
        <div className="max-w-5xl mx-auto px-6 flex flex-col sm:flex-row justify-between items-center gap-4">
          <div className="flex items-center gap-2">
            <span className="font-display text-lg text-ink-900">ResumeIQ</span>
            <span className="text-ink-400 text-xs font-mono">v1.0</span>
          </div>
          <p className="text-ink-400 text-sm">© 2025 ResumeIQ. Built for job seekers.</p>
        </div>
      </footer>
    </div>
  )
}
