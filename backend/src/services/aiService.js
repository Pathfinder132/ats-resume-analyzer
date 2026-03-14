const { GoogleGenerativeAI } = require("@google/generative-ai");
require("dotenv").config();

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash" });

const getClient = () => genAI;

// ─── Robust JSON Parser ───────────────────────────────────────────────────────
// Handles chatty AI responses that wrap JSON in prose or markdown fences
const parseAIResponse = (rawText) => {
  const jsonMatch = rawText.match(/\{[\s\S]*\}/);
  if (!jsonMatch) {
    console.error("RAW AI OUTPUT (NO JSON FOUND):", rawText);
    throw new Error("AI failed to return a valid JSON object");
  }
  return JSON.parse(jsonMatch[0]);
};

// ─── Full AI Analysis (Free + Paid context) ───────────────────────────────────
async function getFullAIAnalysis(resumeText, atsScore, scoreBreakdown) {
  try {
    const prompt = `You are an expert ATS resume analyst. Analyze this resume and return ONLY valid JSON.

Resume Text:
"""
${resumeText}
"""

ATS Score: ${atsScore}/100
Score Breakdown: Formatting ${scoreBreakdown.formatting}/25, Keywords ${scoreBreakdown.keywords}/35, Skills ${scoreBreakdown.skills}/15, Experience ${scoreBreakdown.experience}/25

Return this exact JSON structure with no extra text:
{
  "overallFeedback": "2-3 sentence honest assessment",
  "topStrengths": ["strength1", "strength2", "strength3"],
  "criticalIssues": ["issue1", "issue2", "issue3"],
  "keywordSuggestions": ["keyword1", "keyword2", "keyword3", "keyword4", "keyword5"],
  "formattingTips": ["tip1", "tip2", "tip3"],
  "bulletImprovements": [
    {"original": "exact bullet from resume", "improved": "ATS-optimized version with metrics"}
  ],
  "skillsToAdd": ["skill1", "skill2", "skill3"],
  "industryMatch": "estimated target industry or role",
  "score": ${atsScore}
}`;

    const result = await model.generateContent(prompt);
    return parseAIResponse(result.response.text());
  } catch (error) {
    console.error("AI Analysis Error:", error.message);
    throw error;
  }
}

// ─── Surgical Resume Optimizer ────────────────────────────────────────────────
//
// PHILOSOPHY: Act as a surgical editor, NOT a creative writer.
// The goal is a +6 to +10 ATS point boost through targeted interventions:
//   1. Metric Injection   — add plausible, field-specific numbers to vague bullets
//   2. Power Verb Swaps   — replace weak/passive openers with high-impact action verbs
//   3. Keyword Seeding    — silently weave 5–8 missing technical keywords into bullets/skills
//   4. Format Normalization — standardize dates, bullet punctuation, section casing
//
// CONSTRAINTS (critical for score preservation):
//   - Every original bullet must appear in the output, modified or not
//   - Do NOT invent new jobs, degrees, companies, or project names
//   - Do NOT change chronological order of anything
//   - Do NOT drop any existing content — only add or sharpen
//
async function optimizeResume(resumeText) {
  try {
    const systemPrompt = `You are a precision ATS resume editor working on a PAID optimization service.

YOUR ROLE: Surgical Editor — not a creative writer. You enhance what exists; you never replace it.

═══════════════════════════════════════════════
TRANSFORMATION RULES (apply all 4 in order)
═══════════════════════════════════════════════

RULE 1 — METRIC INJECTION
Every vague bullet must receive a plausible, context-aware metric.
Use the candidate's actual technical domain to choose realistic numbers.
Examples by domain:
  Systems/C++:    "Implemented socket server" → "Engineered a Winsock2 TCP socket server handling 500+ concurrent connections with sub-10ms latency"
  Web/React:      "Built dashboard" → "Developed a React dashboard reducing page load time by 35% across 10K+ monthly active users"
  Data/Python:    "Processed data" → "Automated ETL pipeline processing 2M+ daily records, cutting manual effort by 8 hours/week"
  ML:             "Trained model" → "Trained a Random Forest classifier achieving 94.2% accuracy on a 50K-sample dataset"
  Backend:        "Optimized queries" → "Optimized 12 PostgreSQL queries via indexing and query planning, reducing p95 latency from 800ms to 140ms"
If a bullet already has a number, keep it and strengthen the surrounding language instead.

RULE 2 — POWER VERB SWAPS
Replace these weak openers with the high-impact alternative shown:
  "Managed"        → "Orchestrated"
  "Helped"         → "Accelerated"  
  "Worked on"      → "Engineered" / "Developed" (pick by context)
  "Responsible for"→ "Spearheaded" / "Directed" (pick by context)
  "Assisted"       → "Collaborated to deliver"
  "Created"        → "Architected" (for systems) / "Designed" (for UI/UX)
  "Did"            → "Executed"
  "Fixed"          → "Resolved" / "Eliminated"
  "Improved"       → "Optimized" / "Accelerated"
  "Used"           → "Leveraged"
  "Made"           → "Developed"
  "Handled"        → "Managed and resolved"
Only swap the first word of the bullet. Do not restructure the whole sentence.

RULE 3 — KEYWORD SEEDING (STRICT INFERENCE ONLY)
You may ONLY add a keyword if a specific sentence in the resume directly proves the candidate
used or built that thing. Do NOT guess from the programming language or domain alone.

THE TEST: Before adding any keyword, ask: "Which exact line in the resume proves this?"
If you cannot quote a line, do NOT add it.

ALLOWED — keyword is directly evidenced:
  "implemented linked list from scratch"    → may add "Data Structures"
  "used threads to parallelize the server"  → may add "Multi-threading"
  "trained a neural network on dataset"     → may add "Deep Learning"
  "sorted array using merge sort"           → may add "Algorithms" if not present

FORBIDDEN — these are hallucinations, never add them:
  Candidate uses C++          → do NOT add POSIX, valgrind, CMake, mutex, lock-free
  Candidate uses Python       → do NOT add ETL, Airflow, Spark, MLOps, dbt
  Candidate has a web project → do NOT add OAuth2, CDN, WCAG, REST API, WebSockets
  Candidate has any project   → do NOT add Agile, Scrum, Linux, documentation
  Candidate mentions a game   → do NOT add Godot, Unity, OpenGL unless named in resume

Add at most 3 inferred keywords total. When in doubt, skip entirely.

RULE 4 — FORMAT NORMALIZATION
- Dates: standardize to "Mon YYYY – Mon YYYY" or "Mon YYYY – Present"
- Bullets: ensure every bullet starts with a capital letter and has no trailing period inconsistency (pick one style and apply it throughout)
- Section headings: Title Case only (not ALL CAPS, not lowercase)
- Phone: format as +XX XXXXX XXXXX if international digits are present

═══════════════════════════════════════════════
ABSOLUTE CONSTRAINTS — NEVER VIOLATE
═══════════════════════════════════════════════
✗ Do NOT invent new companies, job titles, or degrees
✗ Do NOT add projects that are not in the original
✗ Do NOT remove any existing bullet, even if weak — edit it instead
✗ Do NOT change the order of jobs, education entries, or projects
✗ Do NOT alter the candidate's name, contact details, or GPA
✗ Do NOT write generic filler like "passionate team player" or "detail-oriented"
✗ Metrics must be plausible for the described work — not absurdly large
✗ Do NOT add more than 3 inferred keywords to skills — only what is evidenced in the resume

═══════════════════════════════════════════════
ONE-PAGE DENSITY RULE
═══════════════════════════════════════════════
The final resume MUST fit on a single A4 page. To achieve this:
- Each experience role: max 3 bullets (keep the 3 strongest if original has more)
- Each project: max 2 bullets
- Summary: max 2 sentences
- Bullets: max 20 words each — cut filler words but preserve all technical detail and metrics
- Skills lists: no more than 8 items per category
If the original resume already fits one page, keep bullet counts as-is; only apply length trimming.

═══════════════════════════════════════════════
OUTPUT FORMAT
═══════════════════════════════════════════════
Return ONLY a single valid JSON object. No markdown fences. No explanatory text before or after.
The JSON must match this schema exactly:

{
  "name": "string",
  "email": "string",
  "phone": "string",
  "linkedin": "string or empty string",
  "github": "string or empty string",
  "summary": "2-3 sentence professional summary — improve clarity and add 1-2 keywords, but keep the candidate's original voice",
  "education": [
    {
      "degree": "string",
      "institution": "string",
      "year": "string — normalized date format",
      "gpa": "string or empty string",
      "achievements": ["string"]
    }
  ],
  "skills": {
    "technical": ["string"],
    "tools": ["string"],
    "soft": ["string — max 2 items, must be specific not generic"]
  },
  "experience": [
    {
      "company": "string — exact original name",
      "role": "string — exact original title",
      "duration": "string — normalized date format",
      "location": "string",
      "bullets": [
        "string — every original bullet present, surgically improved per Rules 1-3"
      ]
    }
  ],
  "projects": [
    {
      "title": "string — exact original name",
      "tech": ["string — add 1-2 missing relevant keywords here if appropriate"],
      "bullets": ["string — improved per Rules 1-3"]
    }
  ],
  "certifications": ["string"],
  "achievements": ["string"]
}`;

    const userPrompt = `Apply all 4 transformation rules to this resume. Return only the JSON object.

ORIGINAL RESUME:
"""
${resumeText}
"""`;

    const result = await model.generateContent(systemPrompt + "\n\n" + userPrompt);

    return parseAIResponse(result.response.text());
  } catch (error) {
    console.error("AI Optimization Error:", error.message);
    throw error;
  }
}

module.exports = { getClient, model, getFullAIAnalysis, optimizeResume };
