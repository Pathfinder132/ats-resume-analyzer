import { useEffect, useRef } from 'react'

const getScoreColor = (score) => {
  if (score >= 85) return { stroke: '#2D5A3D', label: 'Excellent', bg: 'bg-sage-50', text: 'text-sage-500' }
  if (score >= 70) return { stroke: '#D97706', label: 'Good', bg: 'bg-amber-50', text: 'text-amber-500' }
  if (score >= 50) return { stroke: '#F59E0B', label: 'Fair', bg: 'bg-amber-50', text: 'text-amber-500' }
  return { stroke: '#DC2626', label: 'Poor', bg: 'bg-crimson-50', text: 'text-crimson-500' }
}

export default function ScoreRing({ score, size = 180, animated = true }) {
  const circleRef = useRef(null)
  const radius = 54
  const circumference = 2 * Math.PI * radius
  const offset = circumference - (score / 100) * circumference
  const { stroke, label, bg, text } = getScoreColor(score)

  useEffect(() => {
    if (!animated || !circleRef.current) return
    circleRef.current.style.strokeDashoffset = circumference
    setTimeout(() => {
      if (circleRef.current) {
        circleRef.current.style.transition = 'stroke-dashoffset 1.2s cubic-bezier(0.34,1.12,0.64,1)'
        circleRef.current.style.strokeDashoffset = offset
      }
    }, 100)
  }, [score, animated, circumference, offset])

  return (
    <div className="flex flex-col items-center gap-3">
      <div className={`relative rounded-full p-3 ${bg}`} style={{ width: size, height: size }}>
        <svg width={size - 24} height={size - 24} viewBox="0 0 120 120" className="absolute top-3 left-3">
          {/* Background track */}
          <circle
            cx="60" cy="60" r={radius}
            fill="none"
            stroke="#E8E8E5"
            strokeWidth="8"
            className="score-circle"
          />
          {/* Score arc */}
          <circle
            ref={circleRef}
            cx="60" cy="60" r={radius}
            fill="none"
            stroke={stroke}
            strokeWidth="8"
            strokeLinecap="round"
            strokeDasharray={circumference}
            strokeDashoffset={animated ? circumference : offset}
            className="score-circle"
            style={!animated ? { strokeDashoffset: offset } : {}}
          />
          {/* Score text */}
          <text x="60" y="56" textAnchor="middle" dy=".35em" fontSize="28" fontWeight="bold"
            fontFamily="DM Serif Display, Georgia, serif" fill="#0D0D0D">
            {score}
          </text>
          <text x="60" y="74" textAnchor="middle" fontSize="10"
            fontFamily="DM Sans, sans-serif" fill="#9B9A94" letterSpacing="0.5">
            / 100
          </text>
        </svg>
      </div>
      <div className={`text-sm font-body font-500 ${text}`}>{label} ATS Score</div>
    </div>
  )
}
