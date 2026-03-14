import { useCallback, useState } from 'react'
import { useDropzone } from 'react-dropzone'

export default function FileDropzone({ onFileAccepted, isLoading }) {
  const [dragError, setDragError] = useState('')

  const onDrop = useCallback((accepted, rejected) => {
    setDragError('')
    if (rejected.length > 0) {
      const err = rejected[0].errors[0]
      if (err.code === 'file-too-large') setDragError('File too large. Max size is 5MB.')
      else if (err.code === 'file-invalid-type') setDragError('Only PDF and DOCX files are accepted.')
      else setDragError(err.message)
      return
    }
    if (accepted[0]) onFileAccepted(accepted[0])
  }, [onFileAccepted])

  const { getRootProps, getInputProps, isDragActive, acceptedFiles } = useDropzone({
    onDrop,
    accept: {
      'application/pdf': ['.pdf'],
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document': ['.docx']
    },
    maxFiles: 1,
    maxSize: 5 * 1024 * 1024,
    disabled: isLoading
  })

  const file = acceptedFiles[0]

  return (
    <div className="w-full">
      <div
        {...getRootProps()}
        className={`
          relative border-2 border-dashed rounded-2xl p-12 text-center cursor-pointer
          transition-all duration-200
          ${isDragActive ? 'border-sage bg-sage-50 scale-[1.01]' : 'border-ink-200 hover:border-ink-400 bg-white hover:bg-ink-50'}
          ${isLoading ? 'opacity-60 cursor-not-allowed' : ''}
          ${dragError ? 'border-crimson-500 bg-crimson-50' : ''}
        `}
      >
        <input {...getInputProps()} />

        {/* Upload icon */}
        <div className={`mx-auto w-14 h-14 rounded-2xl flex items-center justify-center mb-5 transition-colors
          ${isDragActive ? 'bg-sage-500' : 'bg-ink-100'}`}>
          {isLoading ? (
            <svg className="animate-spin w-7 h-7 text-ink-600" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/>
            </svg>
          ) : (
            <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke={isDragActive ? 'white' : '#4A4944'} strokeWidth="1.5">
              <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4"/>
              <polyline points="17 8 12 3 7 8"/>
              <line x1="12" y1="3" x2="12" y2="15"/>
            </svg>
          )}
        </div>

        {file && !isLoading ? (
          <div>
            <div className="flex items-center justify-center gap-2 mb-2">
              <FileIcon type={file.name.endsWith('.pdf') ? 'pdf' : 'docx'} />
              <span className="font-body font-500 text-ink-800">{file.name}</span>
            </div>
            <p className="text-sm text-ink-400">{(file.size / 1024).toFixed(1)} KB · Click to change</p>
          </div>
        ) : isLoading ? (
          <div>
            <p className="font-body font-500 text-ink-800 mb-1">Processing your resume...</p>
            <p className="text-sm text-ink-400">Extracting and analyzing content</p>
          </div>
        ) : (
          <div>
            <p className="font-body font-500 text-ink-800 mb-2">
              {isDragActive ? 'Drop it here' : 'Drop your resume here'}
            </p>
            <p className="text-sm text-ink-400 mb-4">or click to browse your files</p>
            <div className="flex items-center justify-center gap-3">
              <span className="inline-flex items-center gap-1 text-xs font-mono text-ink-400 bg-ink-100 px-2 py-1 rounded">
                <FileIcon type="pdf" size={12} /> PDF
              </span>
              <span className="inline-flex items-center gap-1 text-xs font-mono text-ink-400 bg-ink-100 px-2 py-1 rounded">
                <FileIcon type="docx" size={12} /> DOCX
              </span>
              <span className="text-xs text-ink-400">Max 5MB</span>
            </div>
          </div>
        )}
      </div>

      {dragError && (
        <p className="mt-2 text-sm text-crimson-500 text-center">{dragError}</p>
      )}
    </div>
  )
}

function FileIcon({ type, size = 16 }) {
  const color = type === 'pdf' ? '#DC2626' : '#2563EB'
  return (
    <svg width={size} height={size} viewBox="0 0 16 16" fill="none">
      <rect x="2" y="1" width="10" height="14" rx="1.5" fill={color} opacity="0.15"/>
      <rect x="2" y="1" width="10" height="14" rx="1.5" stroke={color} strokeWidth="1"/>
      <text x="7" y="10" textAnchor="middle" fontSize="4.5" fontWeight="700" fill={color} fontFamily="sans-serif">
        {type.toUpperCase()}
      </text>
    </svg>
  )
}
