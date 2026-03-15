export default function ScoreBreakdown({ breakdown }) {
  const items = [
    { label: "Keywords & Skills", key: "keywords", max: 35, color: "bg-sage-500" },
    { label: "Experience Impact", key: "experience", max: 25, color: "bg-amber-500" },
    { label: "Formatting", key: "formatting", max: 25, color: "bg-ink-600" },
    { label: "Skills Section", key: "skills", max: 15, color: "bg-ink-400" },
  ];

  return (
    <div className="space-y-4">
      {items.map((item, i) => {
        const rawScore = breakdown?.[item.key] ?? 0;
        const score = Math.min(rawScore, item.max);

        const pct = Math.round((score / item.max) * 100);

        return (
          <div key={item.key} className="space-y-1.5" style={{ animationDelay: `${i * 80}ms` }}>
            <div className="flex justify-between items-center">
              <span className="text-sm font-body text-ink-700">{item.label}</span>

              <span className="text-sm font-mono text-ink-500">
                {score}/{item.max}
              </span>
            </div>

            <div className="h-2 bg-ink-100 rounded-full overflow-hidden">
              <div
                className={`h-full rounded-full transition-all duration-700 ${item.color}`}
                style={{
                  width: `${pct}%`,
                  transitionDelay: `${i * 100 + 300}ms`,
                }}
              />
            </div>
          </div>
        );
      })}
    </div>
  );
}
