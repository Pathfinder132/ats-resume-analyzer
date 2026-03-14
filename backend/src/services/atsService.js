/**
 * atsService.js — Strict ATS Scoring Engine
 *
 * Scoring philosophy (ResumeWorded-style):
 *   - Average resume: 40–60
 *   - Good resume:    65–80
 *   - Excellent:      85+
 *
 * Weights:
 *   Keywords & Relevance   35 pts
 *   Experience Impact      25 pts
 *   Formatting & Structure 25 pts
 *   Skills Section         15 pts
 *                        ──────
 *                         100 pts
 */

// ─── Keyword Bank ─────────────────────────────────────────────────────────────

const TECH_KEYWORDS = new Set([
  // Languages
  "javascript",
  "typescript",
  "python",
  "java",
  "c++",
  "c#",
  "ruby",
  "php",
  "swift",
  "kotlin",
  "go",
  "rust",
  "scala",
  "r",
  "matlab",
  "perl",
  "bash",
  "powershell",
  // Frontend
  "react",
  "angular",
  "vue",
  "next.js",
  "nuxt",
  "gatsby",
  "svelte",
  "redux",
  "html",
  "css",
  "sass",
  "tailwind",
  "bootstrap",
  "webpack",
  "vite",
  "babel",
  // Backend
  "node.js",
  "express",
  "django",
  "flask",
  "fastapi",
  "spring",
  "laravel",
  "rails",
  "graphql",
  "rest",
  "restful",
  "grpc",
  "websocket",
  // Data / ML
  "machine learning",
  "deep learning",
  "tensorflow",
  "pytorch",
  "keras",
  "scikit-learn",
  "pandas",
  "numpy",
  "spark",
  "hadoop",
  "kafka",
  "airflow",
  "dbt",
  "sql",
  "nosql",
  "postgresql",
  "mysql",
  "mongodb",
  "redis",
  "elasticsearch",
  "cassandra",
  "dynamodb",
  // Cloud / DevOps
  "aws",
  "azure",
  "gcp",
  "docker",
  "kubernetes",
  "terraform",
  "ansible",
  "jenkins",
  "ci/cd",
  "github actions",
  "gitlab ci",
  "linux",
  "nginx",
  "microservices",
  "serverless",
  "lambda",
  "s3",
  "ec2",
  "gke",
  "helm",
  "prometheus",
  "grafana",
  // Tools
  "git",
  "github",
  "gitlab",
  "jira",
  "confluence",
  "figma",
  "postman",
  "power bi",
  "tableau",
  "excel",
  "looker",
  "snowflake",
  "bigquery",
  // Practices
  "agile",
  "scrum",
  "kanban",
  "tdd",
  "bdd",
  "devops",
  "api",
  "sdk",
  "oauth",
]);

const STRONG_ACTION_VERBS = new Set([
  "accelerated",
  "achieved",
  "architected",
  "automated",
  "built",
  "championed",
  "collaborated",
  "consolidated",
  "created",
  "cut",
  "decreased",
  "defined",
  "delivered",
  "deployed",
  "designed",
  "developed",
  "devised",
  "directed",
  "drove",
  "eliminated",
  "enabled",
  "engineered",
  "enhanced",
  "established",
  "exceeded",
  "executed",
  "expanded",
  "generated",
  "grew",
  "identified",
  "implemented",
  "improved",
  "increased",
  "innovated",
  "integrated",
  "launched",
  "led",
  "managed",
  "mentored",
  "migrated",
  "modernized",
  "optimized",
  "orchestrated",
  "overhauled",
  "pioneered",
  "processed",
  "produced",
  "reduced",
  "refactored",
  "reformed",
  "released",
  "revamped",
  "scaled",
  "shipped",
  "simplified",
  "slashed",
  "solved",
  "spearheaded",
  "standardized",
  "streamlined",
  "strengthened",
  "transformed",
  "upgraded",
  "won",
]);

// Weak openers that ATS/recruiters penalize
const WEAK_OPENERS = [
  /^responsible for\b/i,
  /^assisted (with|in)\b/i,
  /^helped (with|to)\b/i,
  /^worked on\b/i,
  /^duties (include|included|were)\b/i,
  /^was involved in\b/i,
  /^participated in\b/i,
  /^part of (a |the )?(team|group)\b/i,
  /^contributed to\b/i,
  /^served as\b/i,
  /^tasked with\b/i,
];

// Patterns that suggest ATS-unfriendly layout (tables, columns, graphics)
const ATS_HOSTILE_SIGNALS = [
  /\t{3,}/, // multiple tabs → likely columns/table
  /\|.+\|.+\|/, // pipe-separated table
  / {10,}/, // large whitespace gaps (column layout)
];

const REQUIRED_SECTIONS = {
  experience: /\b(experience|work history|employment|professional background|work experience)\b/i,
  education: /\b(education|academic|qualification|degree)\b/i,
  skills: /\b(skills|technical skills|competencies|technologies|tech stack|proficiencies|tools)\b/i,
};

const OPTIONAL_SECTIONS = {
  summary: /\b(summary|profile|objective|about me|professional summary)\b/i,
  projects: /\b(projects|portfolio|personal projects|key projects)\b/i,
  certifications: /\b(certifications?|certificates?|credentials?|licenses?)\b/i,
};

const CONTACT_PATTERNS = {
  email: /[\w.+\-]+@[\w\-]+\.[a-z]{2,}/i,
  phone: /(\+?\d[\d\s\-().]{8,14}\d)/,
  linkedin: /linkedin\.com\/(in\/)?[\w\-]+/i,
  github: /github\.com\/[\w\-]+/i,
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

/**
 * Pull bullet-like lines from the resume text.
 * Captures lines starting with •, -, *, >, or a capital letter
 * that look like experience bullets (>25 chars, not a heading).
 */
function extractBullets(text) {
  return text
    .split("\n")
    .map((l) => l.trim())
    .filter((l) => {
      if (l.length < 25 || l.length > 350) return false;
      const startsWithMarker = /^[•\-\*>◦▪▸]\s/.test(l);
      const startsWithCapital = /^[A-Z][a-z]/.test(l);
      const looksLikeHeading = /^[A-Z\s]{4,}$/.test(l); // ALL-CAPS headings
      return (startsWithMarker || startsWithCapital) && !looksLikeHeading;
    });
}

function countMetrics(text) {
  // Numbers followed by units, % signs, currency, or scale words
  const pattern =
    /\b\d+\.?\d*\s*(%|x|×|times|hours?|days?|weeks?|months?|years?|users?|customers?|clients?|requests?|ms\b|kb\b|mb\b|gb\b|\$|₹|€|£|k\b|m\b|million|billion|employees?|engineers?|members?|tickets?|issues?|repos?)\b/gi;
  return (text.match(pattern) || []).length;
}

function firstWordOf(line) {
  return line
    .replace(/^[•\-\*>◦▪▸]\s*/, "")
    .split(/\s+/)[0]
    .toLowerCase()
    .replace(/[^a-z]/g, "");
}

// ─── 1. Keywords & Relevance (35 pts) ─────────────────────────────────────────
// Philosophy: Need 12+ distinct tech keywords for full marks. Anything below 5 = very low score.
// Penalise if experience section exists but almost no keywords are present.

function scoreKeywords(text) {
  const lower = text.toLowerCase();
  const found = [...TECH_KEYWORDS].filter((kw) => lower.includes(kw));
  const missing = [...TECH_KEYWORDS].filter((kw) => !lower.includes(kw));

  // Tiered scoring — strict steps
  let score;
  const n = found.length;
  if (n >= 14) score = 35;
  else if (n >= 11) score = 30;
  else if (n >= 8) score = 24;
  else if (n >= 5) score = 17;
  else if (n >= 3) score = 10;
  else if (n >= 1) score = 5;
  else score = 0;

  // Penalty: experience section present but very keyword-sparse
  if (REQUIRED_SECTIONS.experience.test(text) && n < 4) score = Math.max(score - 5, 0);

  // Return the most "impactful" missing keywords (common ones employers want)
  const priorityMissing = [
    "docker",
    "aws",
    "react",
    "python",
    "sql",
    "git",
    "ci/cd",
    "typescript",
    "kubernetes",
    "postgresql",
    "mongodb",
    "redis",
    "graphql",
    "terraform",
  ]
    .filter((kw) => !lower.includes(kw))
    .slice(0, 8);

  const otherMissing = missing.filter((kw) => !priorityMissing.includes(kw)).slice(0, 4);

  return {
    score,
    found,
    missing: [...priorityMissing, ...otherMissing].slice(0, 10),
  };
}

// ─── 2. Experience Impact (25 pts) ────────────────────────────────────────────
// Three sub-scores: action verbs (8), quantification (12), no weak openers (5)

function scoreExperience(text) {
  const issues = [];
  const weakBullets = [];

  const hasExp = REQUIRED_SECTIONS.experience.test(text);
  if (!hasExp) {
    return {
      score: 0,
      weakBullets: ['No experience section detected — add a "Work Experience" heading.'],
      issues: [],
    };
  }

  const bullets = extractBullets(text);

  // ── Sub-score A: Action verbs (8 pts) ──
  let verbScore = 0;
  let verbCount = 0;
  bullets.forEach((b) => {
    if (STRONG_ACTION_VERBS.has(firstWordOf(b))) verbCount++;
  });

  const totalBullets = Math.max(bullets.length, 1);
  const verbRatio = verbCount / totalBullets;

  if (verbRatio >= 0.8) verbScore = 8;
  else if (verbRatio >= 0.6) verbScore = 6;
  else if (verbRatio >= 0.4) verbScore = 4;
  else if (verbRatio >= 0.2) verbScore = 2;
  else verbScore = 0;

  if (verbRatio < 0.5) {
    issues.push(`Only ${Math.round(verbRatio * 100)}% of bullets start with strong action verbs (aim for 80%+).`);
  }

  // ── Sub-score B: Quantified impact (12 pts) ──
  let metricScore = 0;
  const metricCount = countMetrics(text);
  const bulletsWithMetrics = bullets.filter((b) => countMetrics(b) > 0).length;

  if (metricCount >= 6) metricScore = 12;
  else if (metricCount >= 4) metricScore = 9;
  else if (metricCount >= 2) metricScore = 6;
  else if (metricCount >= 1) metricScore = 3;
  else metricScore = 0;

  if (metricCount === 0) {
    issues.push('No quantifiable results detected. Add numbers — e.g., "Reduced load time by 40%" or "Managed team of 6".');
  } else if (metricCount < 3) {
    issues.push(`Only ${metricCount} metric(s) found. Add more data points to strengthen impact.`);
  }

  const metricCoverage = bulletsWithMetrics / totalBullets;
  if (metricCoverage < 0.3 && bullets.length >= 4) {
    issues.push(`Only ${Math.round(metricCoverage * 100)}% of bullets have metrics. Target 50%+.`);
  }

  // ── Sub-score C: No weak openers (5 pts) ──
  let weakPenalty = 0;
  bullets.forEach((b) => {
    const isWeak = WEAK_OPENERS.some((rx) => rx.test(b.replace(/^[•\-\*>◦▪▸]\s*/, "")));
    if (isWeak) {
      weakPenalty++;
      if (weakBullets.length < 3) weakBullets.push(b.slice(0, 100));
    }
  });

  let weakScore;
  if (weakPenalty === 0) weakScore = 5;
  else if (weakPenalty === 1) weakScore = 3;
  else if (weakPenalty <= 3) weakScore = 1;
  else weakScore = 0;

  if (weakPenalty > 0) {
    issues.push(`${weakPenalty} bullet(s) start with weak phrases like "Responsible for" or "Assisted with".`);
  }

  const score = Math.min(verbScore + metricScore + weakScore, 25);
  return { score, weakBullets, issues };
}

// ─── 3. Formatting & Structure (25 pts) ───────────────────────────────────────
// Sub-scores: required sections (9), contact completeness (6), ATS safety (5), length (5)

function scoreFormatting(text) {
  const issues = [];
  let score = 0;

  // ── Sub-score A: Required sections (9 pts — 3 each) ──
  let sectionScore = 0;
  Object.entries(REQUIRED_SECTIONS).forEach(([name, rx]) => {
    if (rx.test(text)) {
      sectionScore += 3;
    } else {
      issues.push(`Missing "${name}" section heading — ATS cannot categorise your resume without it.`);
    }
  });

  // Bonus for optional sections (up to 2 bonus pts, capped within sub-score)
  let optionalBonus = 0;
  Object.entries(OPTIONAL_SECTIONS).forEach(([, rx]) => {
    if (rx.test(text)) optionalBonus = Math.min(optionalBonus + 1, 2);
  });
  sectionScore = Math.min(sectionScore + optionalBonus, 10); // cap at 10 but weight is 9 base
  score += Math.min(sectionScore, 9);

  // ── Sub-score B: Contact information (6 pts) ──
  let contactScore = 0;
  const contactFound = [];
  const contactMissing = [];

  Object.entries(CONTACT_PATTERNS).forEach(([field, rx]) => {
    if (rx.test(text)) {
      contactScore += field === "email" ? 3 : field === "phone" ? 2 : 0.5;
      contactFound.push(field);
    } else {
      if (field === "email") issues.push("No email address detected.");
      if (field === "phone") issues.push("No phone number detected.");
      // LinkedIn / GitHub are advisory only
      contactMissing.push(field);
    }
  });
  score += Math.min(Math.round(contactScore), 6);

  // ── Sub-score C: ATS-hostile layout signals (5 pts) ──
  let atsLayoutScore = 5;
  ATS_HOSTILE_SIGNALS.forEach((rx) => {
    if (rx.test(text)) {
      atsLayoutScore -= 2;
      issues.push("Possible multi-column or table layout detected — many ATS systems cannot parse this correctly.");
    }
  });
  // Headers/footers hint: same short string repeated
  const lines = text
    .split("\n")
    .map((l) => l.trim())
    .filter(Boolean);
  const firstLine = lines[0] || "";
  const dupHeader = lines.filter((l) => l === firstLine && firstLine.length < 40).length > 2;
  if (dupHeader) {
    atsLayoutScore -= 2;
    issues.push("Repeated header/footer text detected — this can confuse ATS parsers.");
  }
  score += Math.max(atsLayoutScore, 0);

  // ── Sub-score D: Resume length (5 pts) ──
  const wordCount = text.split(/\s+/).filter(Boolean).length;
  let lengthScore = 0;

  if (wordCount >= 400 && wordCount <= 750)
    lengthScore = 5; // ideal 1-pager
  else if (wordCount >= 300 && wordCount < 400)
    lengthScore = 4; // a bit thin
  else if (wordCount > 750 && wordCount <= 950)
    lengthScore = 3; // slightly long
  else if (wordCount >= 200 && wordCount < 300)
    lengthScore = 2; // too thin
  else if (wordCount > 950 && wordCount <= 1200)
    lengthScore = 2; // too long
  else if (wordCount < 200) {
    lengthScore = 0;
    issues.push(`Resume is very short (${wordCount} words). Aim for 400–750 words.`);
  } else {
    lengthScore = 0;
    issues.push(`Resume is too long (${wordCount} words). Aim for 400–750 words.`);
  }

  if (wordCount >= 200 && wordCount < 300) issues.push(`Resume is thin (${wordCount} words). Add more detail to experience and projects.`);
  if (wordCount > 950) issues.push(`Resume is long (${wordCount} words). Trim to 1 page for best ATS results.`);

  score += lengthScore;

  return { score: Math.min(score, 25), issues };
}

// ─── 4. Skills Section (15 pts) ───────────────────────────────────────────────
// Sub-scores: section presence & quality (7), tech density (5), specificity (3)

function scoreSkills(text) {
  const issues = [];
  let score = 0;

  // ── Sub-score A: Section presence (7 pts) ──
  if (REQUIRED_SECTIONS.skills.test(text)) {
    score += 5;

    // Check for categorisation (e.g., "Languages:", "Frameworks:", "Tools:")
    const hasCategoryLabels = /\b(languages?|frameworks?|tools?|libraries|databases?|cloud|platforms?)\s*:/i.test(text);
    if (hasCategoryLabels) score += 2;
    else issues.push('Categorise your skills (e.g., "Languages: Python, Java | Frameworks: React, Django") for better ATS parsing.');
  } else {
    issues.push('No dedicated skills section. Add a "Skills" or "Technical Skills" section for ATS keyword matching.');
  }

  // ── Sub-score B: Technical keyword density in skills section (5 pts) ──
  const lower = text.toLowerCase();
  const techCount = [...TECH_KEYWORDS].filter((kw) => lower.includes(kw)).length;

  if (techCount >= 10) score += 5;
  else if (techCount >= 7) score += 4;
  else if (techCount >= 5) score += 3;
  else if (techCount >= 3) score += 2;
  else if (techCount >= 1) score += 1;
  else {
    issues.push("No recognised technical keywords found in your skills section.");
  }

  if (techCount < 5 && REQUIRED_SECTIONS.skills.test(text)) {
    issues.push(`Only ${techCount} technical skill(s) detected. Aim for 8–15 specific technologies.`);
  }

  // ── Sub-score C: Specificity penalty — generic "soft skills" stuffing (3 pts) ──
  const genericCount = (
    text.match(
      /\b(team player|hard.?working|detail.?oriented|self.?motivated|passionate|fast.?learner|communication skills?|problem.?solving)\b/gi,
    ) || []
  ).length;
  if (genericCount <= 1) score += 3;
  else if (genericCount <= 3) {
    score += 1;
    issues.push('Avoid vague soft skills like "team player" or "hardworking" — they hurt ATS ranking.');
  } else {
    issues.push("Too many generic soft skills. Replace with specific tools and technologies.");
  }

  return { score: Math.min(score, 15), issues };
}

// ─── Master Scorer ─────────────────────────────────────────────────────────────

function calculateATSScore(text) {
  const keywords = scoreKeywords(text);
  const experience = scoreExperience(text);
  const formatting = scoreFormatting(text);
  const skills = scoreSkills(text);

  const totalScore = keywords.score + experience.score + formatting.score + skills.score;

  // Assemble issues (de-duplicate, cap at 8 for UI)
  const allIssues = [...formatting.issues, ...experience.issues, ...skills.issues];

  // Sample improvements shown in free tier
  const sampleImprovements = [
    {
      before: "Responsible for building backend APIs for the platform.",
      after:
        "Engineered 12 RESTful APIs in Node.js and Express, reducing average response latency by 38% and supporting 50K+ daily active users.",
    },
    {
      before: "Worked on data pipeline for analytics team.",
      after: "Designed and automated a PySpark data pipeline ingesting 3M+ daily events, cutting manual processing time by 6 hours/week.",
    },
    {
      before: "Helped improve the CI/CD process.",
      after:
        "Overhauled GitHub Actions CI/CD workflow, slashing deployment time from 22 minutes to 6 minutes and eliminating 3 manual release steps.",
    },
  ];

  return {
    totalScore,
    scoreBreakdown: {
      formatting: formatting.score,
      keywords: keywords.score,
      skills: skills.score,
      experience: experience.score,
    },
    freeAnalysis: {
      missingKeywords: keywords.missing,
      weakBullets: experience.weakBullets,
      formattingIssues: allIssues.slice(0, 8),
      sampleImprovements,
    },
    // Useful for the paid AI analysis context
    _debug: {
      keywordsFound: keywords.found.length,
      keywordList: keywords.found,
      wordCount: text.split(/\s+/).filter(Boolean).length,
    },
  };
}

module.exports = { calculateATSScore };
