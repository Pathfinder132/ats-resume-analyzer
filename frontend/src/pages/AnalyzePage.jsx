import { useState, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { v4 as uuidv4 } from 'uuid'
import FileDropzone from '../components/FileDropzone'
import { uploadResume, analyzeResume } from '../services/api'

const steps = [
  { id: 1, label: 'Upload', desc: 'PDF or DOCX' },
  { id: 2, label: 'Extract', desc: 'Parse resume text' },
  { id: 3, label: 'Analyze', desc: 'ATS scoring' },
]

export default function AnalyzePage() {
  const navigate = useNavigate()
  const [file, setFile] = useState(null)
  const [currentStep, setCurrentStep] = useState(0)
  const [progress, setProgress] = useState(0)
  const [error, setError] = useState('')
  const [isProcessing, setIsProcessing] = useState(false)
  const sessionId = useRef(uuidv4())

  const handleFileAccepted = (f) => {
    setFile(f)
    setError('')
  }

  const handleAnalyze = async () => {
    if (!file) return
    setIsProcessing(true)
    setError('')

    try {
      // Step 1: Upload
      setCurrentStep(1)
      const uploadResult = await uploadResume(file, sessionId.current, setProgress)
      const { resumeId } = uploadResult

      // Step 2: Extract + Analyze
      setCurrentStep(2)
      await new Promise(r => setTimeout(r, 600))
      setCurrentStep(3)
      await analyzeResume(resumeId)

      // Navigate to results
      navigate(`/results/${resumeId}`)
    } catch (err) {
      setError(err.message || 'Something went wrong. Please try again.')
      setIsProcessing(false)
      setCurrentStep(0)
    }
  }

  return (
    <div className="max-w-2xl mx-auto px-6 py-16">
      {/* Header */}
      <div className="text-center mb-12">
        <div className="section-tag mb-4 justify-center">STEP 1 OF 1</div>
        <h1 className="font-display text-4xl sm:text-5xl text-ink-900 mb-4">
          Upload your resume
        </h1>
        <p className="text-ink-500">
          Get your ATS score instantly — free, no account needed.
          Analysis takes under 8 seconds.
        </p>
      </div>

      {/* Dropzone */}
      <FileDropzone onFileAccepted={handleFileAccepted} isLoading={isProcessing} />

      {/* Progress steps */}
      {isProcessing && (
        <div className="mt-8 card p-6">
          <div className="flex items-center justify-between mb-6">
            {steps.map((step, i) => (
              <div key={step.id} className="flex-1 flex flex-col items-center relative">
                {/* Connector line */}
                {i < steps.length - 1 && (
                  <div className={`absolute top-4 left-1/2 w-full h-0.5 transition-colors duration-500
                    ${currentStep > step.id ? 'bg-sage-500' : 'bg-ink-200'}`} />
                )}
                {/* Circle */}
                <div className={`relative z-10 w-8 h-8 rounded-full flex items-center justify-center mb-2 transition-all duration-500
                  ${currentStep > step.id ? 'bg-sage-500 text-white' :
                    currentStep === step.id ? 'bg-ink-900 text-white' : 'bg-ink-100 text-ink-400'}`}>
                  {currentStep > step.id ? (
                    <svg width="12" height="12" viewBox="0 0 12 12" fill="none" stroke="white" strokeWidth="2">
                      <path d="M2 6l3 3 5-5"/>
                    </svg>
                  ) : currentStep === step.id ? (
                    <svg className="animate-spin w-4 h-4" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/>
                    </svg>
                  ) : (
                    <span className="text-xs font-mono">{step.id}</span>
                  )}
                </div>
                <div className="text-center">
                  <div className={`text-xs font-500 ${currentStep >= step.id ? 'text-ink-900' : 'text-ink-400'}`}>
                    {step.label}
                  </div>
                  <div className="text-xs text-ink-400 hidden sm:block">{step.desc}</div>
                </div>
              </div>
            ))}
          </div>

          {/* Progress bar */}
          {progress > 0 && progress < 100 && (
            <div>
              <div className="flex justify-between text-xs text-ink-400 mb-1">
                <span>Uploading...</span><span>{progress}%</span>
              </div>
              <div className="h-1.5 bg-ink-100 rounded-full overflow-hidden">
                <div className="h-full bg-sage-500 rounded-full transition-all duration-200"
                  style={{ width: `${progress}%` }}/>
              </div>
            </div>
          )}

          <p className="text-center text-sm text-ink-400 mt-4">
            {currentStep === 1 && 'Uploading your resume securely...'}
            {currentStep === 2 && 'Extracting resume content...'}
            {currentStep === 3 && 'Running ATS scoring engine...'}
          </p>
        </div>
      )}

      {/* Error */}
      {error && (
        <div className="mt-4 p-4 bg-crimson-50 border border-crimson-200 rounded-xl text-sm text-crimson-500">
          {error}
        </div>
      )}

      {/* Analyze button */}
      {!isProcessing && (
        <div className="mt-6 text-center">
          <button
            onClick={handleAnalyze}
            disabled={!file}
            className="btn-primary text-base px-10 py-4 disabled:opacity-40"
          >
            Analyze My Resume
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M5 12h14M12 5l7 7-7 7"/>
            </svg>
          </button>
          <p className="mt-3 text-xs text-ink-400">Free · No signup · Results in seconds</p>
        </div>
      )}

      {/* Privacy note */}
      <div className="mt-8 text-center text-xs text-ink-400 flex items-center justify-center gap-1.5">
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <rect x="3" y="11" width="18" height="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0110 0v4"/>
        </svg>
        Your resume is processed securely and never shared
      </div>
    </div>
  )
}
