// backend/src/services/atsService.js
//
// ResumeWorded-calibrated ATS scoring engine.
//
// Target score distribution:
//   Weak (skills-only, no experience):  35-45
//   Average (has exp, few metrics):     45-58
//   Good   (decent exp, some metrics):  60-72
//   Strong (strong exp, metrics, verbs): 73-85
//   Exceptional:                         86+
//
// ── Key design principles ──────────────────────────────────────────────────
//  1. Skills listed without demonstrated experience get a cross-dimension penalty
//     — keywords, experience, and skills scores are all reduced when no
//     experience section exists, because listing React ≠ using React.
//  2. Experience partial credit — having even 1 metric shows awareness;
//     having 33% strong verbs is better than 0%; give credit for partial effort.
//  3. Missing keywords are contextual — derived from what the resume already
//     has, scaled by how complete the resume is, never showing niche skills
//     unless the candidate is already deep in that niche.
//  4. Penalty layer runs after dimension scores and can only reduce total.

const { parseResumeText, isLikelyResume } = require("./parseService");
const { phrases: extractPhrases, normalizeToken, words: tokenize } = require("./textUtils");
const skillsDB = require("./skills.json");

// ── Weights (must sum to 100) ──────────────────────────────────────────────
const WEIGHTS = { keywords: 35, experience: 25, formatting: 25, skills: 15 };

// ── Section weights for keyword matching ──────────────────────────────────
// Skill found in dedicated skills section = 1.0; in hobbies = 0.15
const SECTION_KW_WEIGHT = {
  skills: 1.0,
  "technical skills": 1.0,
  technologies: 1.0,
  "tech stack": 1.0,
  "tools and technologies": 1.0,
  "core competencies": 1.0,
  competencies: 1.0,
  experience: 0.9,
  "work experience": 0.9,
  "professional experience": 0.9,
  "employment history": 0.9,
  projects: 0.8,
  "personal projects": 0.8,
  "key projects": 0.8,
  summary: 0.75,
  profile: 0.75,
  top: 0.7,
  education: 0.45,
  certifications: 0.6,
  achievements: 0.6,
  activities: 0.25,
  interests: 0.2,
  hobbies: 0.15,
  languages: 0.25,
};
const DEFAULT_SECTION_WEIGHT = 0.5;

// ── Strong action verbs ────────────────────────────────────────────────────
const STRONG_VERBS = new Set([
  "accelerated",
  "achieved",
  "architected",
  "automated",
  "built",
  "championed",
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
  "maintained",
  "mentored",
  "migrated",
  "modernized",
  "optimized",
  "orchestrated",
  "overhauled",
  "pioneered",
  "produced",
  "reduced",
  "refactored",
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
  "supervised",
  "trained",
  "transformed",
  "upgraded",
  "delivered",
  "negotiated",
  "resolved",
  "restructured",
  "revitalized",
  "secured",
  "shaped",
  "sourced",
]);

// ── Weak openers ──────────────────────────────────────────────────────────
const WEAK_OPENERS = [
  /^responsible\s+for\b/i,
  /^assisted?\s+(with|in)\b/i,
  /^helped?\s+(with|to)\b/i,
  /^worked\s+on\b/i,
  /^duties\s+(include|included|were)\b/i,
  /^was\s+involved\s+in\b/i,
  /^participated\s+in\b/i,
  /^part\s+of\s+(a\s+|the\s+)?(team|group)\b/i,
  /^contributed\s+to\b/i,
  /^served\s+as\b/i,
  /^tasked\s+with\b/i,
  /^handled\b/i,
  /^did\b/i,
  /^made\b/i,
  /^in\s+charge\s+of\b/i,
  /^involved\s+in\b/i,
  /^support(ed|ing)\b/i,
];

// ── Buzzwords ──────────────────────────────────────────────────────────────
const BUZZWORDS = [
  "synergy",
  "leverage",
  "leveraged",
  "leveraging",
  "innovative",
  "innovation",
  "cutting-edge",
  "cutting edge",
  "world-class",
  "world class",
  "best-in-class",
  "best in class",
  "passionate",
  "passionate about",
  "enthusiasm",
  "enthusiastic",
  "dynamic",
  "results-driven",
  "results driven",
  "results-oriented",
  "go-to person",
  "thought leader",
  "thought leadership",
  "change agent",
  "game changer",
  "game-changer",
  "disruptive",
  "strategic thinker",
  "visionary",
  "proactive",
  "self-starter",
  "team player",
  "hardworking",
  "hard-working",
  "hard working",
  "detail-oriented",
  "detail oriented",
  "motivated",
  "strong work ethic",
  "people person",
  "outside the box",
  "value-add",
  "move the needle",
  "deep dive",
  "bandwidth",
  "circle back",
  "touch base",
  "scalable solution",
  "holistic approach",
  "bleeding edge",
  "pain point",
  "pain points",
  "low-hanging fruit",
  "robust solution",
  "seamless",
  "empower",
  "empowering",
  "transformative",
  "disruptive technology",
];

// ── Weak/passive verb patterns (beyond opener) ────────────────────────────
const WEAK_VERB_PATTERNS = [
  /\bwas\s+(responsible|involved|tasked)\b/i,
  /\bhave\s+(been|had)\b/i,
  /\bhad\s+to\b/i,
  /\btried\s+to\b/i,
  /\battempted\s+to\b/i,
  /\blearned\s+about\b/i,
  /\bgained\s+experience\b/i,
  /\bexposure\s+to\b/i,
  /\bfamiliar\s+with\b/i,
  /\bknowledge\s+of\b/i,
  /\bbasic\s+knowledge\b/i,
  /\bsome\s+experience\b/i,
];

// ── Growth signals ─────────────────────────────────────────────────────────
const GROWTH_SIGNALS = {
  promotion: /\b(promot(ed|ion)|advanced\s+to|elevated\s+to|moved\s+up)\b/i,
  award: /\b(award(ed)?|recogni(zed|sed|tion)|honor(ed)?|scholarship|fellowship|prize|winner|ranked\s+(first|1st|top)|dean'?s\s+list)\b/i,
  leadership: /\b(led\s+(a\s+)?(team\s+of\s*)?\d+|managed\s+\d+\s*(people|engineer|member)|supervised\s+\d+|mentored\s+\d+)\b/i,
  impact: /\b(revenue|cost\s+sav(ing|ed)|reduced\s+cost|saved\s+[\$₹€]|generated\s+[\$₹€]|roi|profit|growth\s+of\s+\d+%)\b/i,
  contribution:
    /\b(published\s+[a-z]|open.?sourced?|contributed\s+to\s+(?!the\b|our\b|this\b)|npm\s+package|pypi|launched\s+(a\s+)?product)\b/i,
};

// ── Niche skills — only suggest if candidate is already deep in that niche ─
const NICHE_SKILLS = new Set([
  "rust",
  "assembly",
  "posix",
  "opengl",
  "vulkan",
  "cuda",
  "rtos",
  "firmware",
  "embedded systems",
  "low-level programming",
  "winsock2",
  "compiler design",
  "computer architecture",
  "haskell",
  "clojure",
  "erlang",
  "elixir",
  "databricks",
  "apache hadoop",
  "huggingface",
  "transformers",
  "large language models",
  "helm",
]);
const NICHE_THRESHOLD = 5; // need 5+ skills in same category before showing niche suggestions

// Generic domains — too broad to drive missing keyword suggestions
const GENERIC_DOMAINS = new Set(["languages", "cs_fundamentals", "tools_practices"]);

// ======================================================
//  Build lookup structures from skills.json (once at startup)
// ======================================================
function buildLookups(db) {
  const skillSet = new Set();
  const phraseSet = new Set();
  const aliasMap = new Map();
  const catMap = new Map();
  const catSkills = new Map();

  for (const [catKey, catData] of Object.entries(db.categories)) {
    const s = new Set();
    for (const skill of catData.skills) {
      const norm = skill.toLowerCase().trim();
      skillSet.add(norm);
      catMap.set(norm, catKey);
      s.add(norm);
      if (norm.includes(" ")) phraseSet.add(norm);
    }
    catSkills.set(catKey, s);
  }

  for (const [variant, canonical] of Object.entries(db.aliases)) {
    const normV = variant.toLowerCase().trim();
    const normC = canonical.toLowerCase().trim();
    aliasMap.set(normV, normC);
    if (!skillSet.has(normC)) skillSet.add(normC);
    if (normV.includes(" ")) phraseSet.add(normV);
  }

  return { skillSet, phraseSet, aliasMap, catMap, catSkills };
}

const LOOKUPS = buildLookups(skillsDB);

// ======================================================
//  Fuzzy matching — character bigrams
// ======================================================
function charBigrams(s) {
  const bg = new Set();
  for (let i = 0; i < s.length - 1; i++) bg.add(s.slice(i, i + 2));
  return bg;
}

const SINGLE_WORD_SKILLS = [...LOOKUPS.skillSet].filter((s) => !s.includes(" "));
const SKILL_BIGRAMS = new Map(SINGLE_WORD_SKILLS.map((s) => [s, charBigrams(s)]));

function resolveToken(token) {
  const t = normalizeToken(token);
  if (!t || t.length < 2) return null;
  if (LOOKUPS.skillSet.has(t)) return t;
  if (LOOKUPS.aliasMap.has(t)) return LOOKUPS.aliasMap.get(t);
  if (t.length >= 5) {
    const tBg = charBigrams(t);
    let best = 0.8;
    let bestSkill = null;
    for (const skill of SINGLE_WORD_SKILLS) {
      if (Math.abs(skill.length - t.length) > 3) continue;
      const skillBg = SKILL_BIGRAMS.get(skill);
      let inter = 0;
      for (const g of tBg) if (skillBg.has(g)) inter++;
      const sim = (2 * inter) / (tBg.size + skillBg.size || 1);
      if (sim > best) {
        best = sim;
        bestSkill = skill;
      }
    }
    return bestSkill;
  }
  return null;
}

function resolvePhrase(phrase) {
  const p = phrase.toLowerCase().trim();
  if (LOOKUPS.phraseSet.has(p)) return p;
  if (LOOKUPS.aliasMap.has(p)) return LOOKUPS.aliasMap.get(p);
  return null;
}

// ======================================================
//  Section-aware skill matching
// ======================================================
function matchSkillsInParsed(parsed) {
  const matched = new Map();

  function record(canonical, sectionKey) {
    const sw = SECTION_KW_WEIGHT[sectionKey?.toLowerCase()] ?? DEFAULT_SECTION_WEIGHT;
    if ((matched.get(canonical) || 0) < sw) matched.set(canonical, sw);
  }

  for (const [sectionKey, lines] of Object.entries(parsed.sections)) {
    const tokens = lines
      .join(" ")
      .toLowerCase()
      .replace(/[^a-z0-9.#+\s\-\/]/g, " ")
      .split(/\s+/)
      .filter(Boolean);

    const usedIdx = new Set();
    for (let i = 0; i < tokens.length; i++) {
      for (let n = 2; n <= 3; n++) {
        if (i + n > tokens.length) break;
        const canonical = resolvePhrase(tokens.slice(i, i + n).join(" "));
        if (canonical) {
          record(canonical, sectionKey);
          for (let j = 0; j < n; j++) usedIdx.add(i + j);
        }
      }
    }
    tokens.forEach((tok, idx) => {
      if (usedIdx.has(idx)) return;
      const canonical = resolveToken(tok);
      if (canonical) record(canonical, sectionKey);
    });
  }

  for (const bullet of parsed.bullets) {
    const tokens = bullet.text
      .toLowerCase()
      .replace(/[^a-z0-9.#+\s\-\/]/g, " ")
      .split(/\s+/)
      .filter(Boolean);

    const usedIdx = new Set();
    for (let i = 0; i < tokens.length; i++) {
      for (let n = 2; n <= 3; n++) {
        if (i + n > tokens.length) break;
        const canonical = resolvePhrase(tokens.slice(i, i + n).join(" "));
        if (canonical) {
          record(canonical, bullet.section);
          for (let j = 0; j < n; j++) usedIdx.add(i + j);
        }
      }
    }
    tokens.forEach((tok, idx) => {
      if (usedIdx.has(idx)) return;
      const canonical = resolveToken(tok);
      if (canonical) record(canonical, bullet.section);
    });
  }

  return matched;
}

// ======================================================
//  Domain detection — prefers specific over generic
// ======================================================
function detectDomain(matched) {
  const scores = new Map();
  for (const [skill] of matched) {
    const cat = LOOKUPS.catMap.get(skill);
    if (cat) scores.set(cat, (scores.get(cat) || 0) + 1);
  }
  // Sort and split: specific domains first, generic fallbacks after
  const all = [...scores.entries()].sort((a, b) => b[1] - a[1]);
  const specific = all.filter(([d]) => !GENERIC_DOMAINS.has(d));
  const generic = all.filter(([d]) => GENERIC_DOMAINS.has(d));
  const ordered = [...specific, ...generic];
  return [ordered[0]?.[0] || null, ordered[1]?.[0] || null];
}

// ======================================================
//  Contextual missing keywords
//  — scale count to how complete the resume already is
//  — skip niche skills unless candidate is already in that niche
//  — never show a keyword that's already matched
// ======================================================
function getMissingKeywords(matched, primaryDomain, secondaryDomain) {
  // Adaptive limit: the more skills present, the fewer gaps to show
  const n = matched.size;
  const limit = n >= 18 ? 4 : n >= 12 ? 6 : n >= 8 ? 8 : 10;

  // Count matched per category for niche threshold check
  const catCounts = new Map();
  for (const [skill] of matched) {
    const cat = LOOKUPS.catMap.get(skill);
    if (cat) catCounts.set(cat, (catCounts.get(cat) || 0) + 1);
  }

  const missing = [];
  const seen = new Set();
  const domains = [primaryDomain, secondaryDomain, "cs_fundamentals", "cloud_devops", "web_backend"]
    .filter(Boolean)
    .filter((d, i, a) => a.indexOf(d) === i);

  for (const domain of domains) {
    const skills = LOOKUPS.catSkills.get(domain);
    if (!skills) continue;
    for (const skill of skills) {
      if (matched.has(skill)) continue;
      if (seen.has(skill)) continue;
      if (missing.length >= limit) break;
      // Skip niche unless deeply in that domain
      if (NICHE_SKILLS.has(skill) && (catCounts.get(domain) || 0) < NICHE_THRESHOLD) continue;
      seen.add(skill);
      missing.push(skill);
    }
    if (missing.length >= limit) break;
  }

  return missing.slice(0, limit);
}

// ======================================================
//  Penalty signals
// ======================================================
function detectBuzzwords(rawText) {
  const lower = rawText.toLowerCase();
  const found = BUZZWORDS.filter((bw) => lower.includes(bw));
  const count = found.length;
  const penalty = count >= 7 ? 6 : count >= 5 ? 4 : count >= 3 ? 3 : count >= 2 ? 2 : count >= 1 ? 1 : 0;
  return { count, found: found.slice(0, 5), penalty };
}

function detectWeakVerbDensity(rawText, bullets) {
  const total = Math.max(bullets.length, 1);
  let weakCount = 0;
  for (const b of bullets) {
    const text = b.text.toLowerCase();
    const clean = b.text.replace(/^[-*•\s]+/, "");
    if (WEAK_VERB_PATTERNS.some((rx) => rx.test(text)) || WEAK_OPENERS.some((rx) => rx.test(clean))) {
      weakCount++;
    }
  }
  const rawLower = rawText.toLowerCase();
  const extraHits = WEAK_VERB_PATTERNS.filter((rx) => rx.test(rawLower)).length;
  const density = (weakCount + Math.min(extraHits, 3)) / (total + 3);
  const penalty = density >= 0.6 ? 4 : density >= 0.4 ? 3 : density >= 0.25 ? 2 : density >= 0.1 ? 1 : 0;
  return { density: Math.round(density * 100), weakCount, penalty };
}

function detectGrowthSignals(rawText, bullets, hasExperienceSection) {
  // Only check signals in experience-related content
  const expText = bullets
    .filter((b) => ["experience", "work experience", "professional experience"].includes((b.section || "").toLowerCase()))
    .map((b) => b.text)
    .join(" ");
  const textToCheck = hasExperienceSection ? expText || rawText : "";

  const signalsFound = Object.entries(GROWTH_SIGNALS)
    .filter(([, rx]) => rx.test(textToCheck))
    .map(([key]) => key);

  let penalty = 0;
  if (hasExperienceSection && bullets.length >= 4) {
    if (signalsFound.length === 0) penalty = 4;
    else if (signalsFound.length === 1) penalty = 2;
  }
  return { signalsFound, penalty };
}

function detectRepetition(bullets) {
  const phraseCount = new Map();
  for (const b of bullets) {
    const toks = b.text
      .toLowerCase()
      .replace(/[^a-z\s]/g, " ")
      .split(/\s+/)
      .filter((t) => t.length > 2);
    for (let i = 0; i <= toks.length - 3; i++) {
      const tri = toks.slice(i, i + 3).join(" ");
      if (/^(the|and|for|with|that|this|are|was|were|has|have|from|into)\s/.test(tri)) continue;
      phraseCount.set(tri, (phraseCount.get(tri) || 0) + 1);
    }
  }
  const repeated = [...phraseCount.entries()]
    .filter(([, c]) => c >= 3)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(([ph]) => ph);
  const penalty = repeated.length >= 4 ? 4 : repeated.length >= 3 ? 3 : repeated.length >= 2 ? 2 : repeated.length >= 1 ? 1 : 0;
  return { repeatedPhrases: repeated, penalty };
}

// ======================================================
//  Core scoring — Keywords (35 pts)
// ======================================================
function computeKeywordsScore(matched) {
  let effectiveCount = 0;
  for (const [, w] of matched) effectiveCount += w;

  let score;
  if (effectiveCount >= 22) score = 35;
  else if (effectiveCount >= 18) score = 29;
  else if (effectiveCount >= 14) score = 23;
  else if (effectiveCount >= 10) score = 17;
  else if (effectiveCount >= 6) score = 11;
  else if (effectiveCount >= 3) score = 5;
  else if (effectiveCount >= 1) score = 2;
  else score = 0;

  return { score: Math.min(score, 35), effectiveCount, distinctCount: matched.size };
}

// ======================================================
//  Core scoring — Experience (25 pts)
//
//  Sub-scores:
//    Action verb ratio  (0-10)
//    Quantified impact  (0-12)  — more partial credit than before
//    No weak openers    (0-3)
// ======================================================
function computeExperienceScore(parsed) {
  // ── Bullet selection ───────────────────────────────────────────────────
  // Priority 1: explicit experience bullets
  const expOnlyBullets = parsed.bullets.filter((b) =>
    ["experience", "work experience", "professional experience", "employment history"].includes((b.section || "").toLowerCase()),
  );
  // Priority 2: project bullets (primary section for students)
  const projectBullets = parsed.bullets.filter((b) =>
    ["projects", "personal projects", "key projects", "academic projects"].includes((b.section || "").toLowerCase()),
  );
  // Priority 3: all bullets EXCEPT education (GPA, graduation year are not impact metrics)
  const nonEduBullets = parsed.bullets.filter(
    (b) => !["education", "academic background", "qualifications"].includes((b.section || "").toLowerCase()),
  );

  // Choose the most specific set that has enough bullets to be meaningful
  let bullets;
  if (expOnlyBullets.length >= 2) {
    // Has real work experience — use that + projects together
    bullets = [...expOnlyBullets, ...projectBullets];
  } else if (projectBullets.length >= 2) {
    // Student with only projects — use projects (this is their "experience")
    bullets = projectBullets;
  } else {
    // Fallback: everything except education
    bullets = nonEduBullets;
  }

  const total = Math.max(bullets.length, 1);
  const issues = [];
  const weakBullets = [];

  // ── Sub A: Action verb ratio (10 pts) ──────────────────────────────────
  let verbCount = 0;
  for (const b of bullets) {
    const first = b.text
      .replace(/^[-*•\s]+/, "")
      .split(/\s+/)[0]
      ?.toLowerCase()
      .replace(/[^a-z]/g, "");
    if (first && STRONG_VERBS.has(first)) verbCount++;
  }
  const verbRatio = verbCount / total;
  let verbScore = 0;
  if (verbRatio >= 0.8) verbScore = 10;
  else if (verbRatio >= 0.6) verbScore = 8;
  else if (verbRatio >= 0.4) verbScore = 6;
  else if (verbRatio >= 0.3) verbScore = 4;
  else if (verbRatio >= 0.2) verbScore = 2;

  if (verbRatio < 0.5 && bullets.length >= 2)
    issues.push(`Only ${Math.round(verbRatio * 100)}% of bullets start with strong action verbs — aim for 80%+.`);

  // ── Sub B: Quantified impact (12 pts) ──────────────────────────────────
  // IMPORTANT: metrics counted ONLY on non-education bullets so GPA/graduation
  // year don't inflate the score.
  const METRIC_RE =
    /\b\d+\.?\d*\s*(%|x\b|times|hours?|days?|weeks?|months?|years?|users?|clients?|requests?|ms\b|kb\b|mb\b|gb\b|\$|INR|Rs\.?|EUR|GBP|k\b(?!\w)|m\b(?!\w)|million|billion|members?|engineers?|employees?|tickets?|repos?|commits?|tests?|features?|queries?|endpoints?|projects?|components?|systems?|apis?)\b/gi;

  // Exclude education bullets explicitly from metric counting
  const metricBullets_arr = bullets.filter(
    (b) => !["education", "academic background", "qualifications"].includes((b.section || "").toLowerCase()),
  );
  let metricBullets = 0,
    totalMetrics = 0;
  for (const b of metricBullets_arr) {
    const m = b.text.match(METRIC_RE);
    if (m) {
      metricBullets++;
      totalMetrics += m.length;
    }
  }
  const metricRatio = metricBullets / total;
  let metricScore = 0;
  if (metricRatio >= 0.5 || totalMetrics >= 7) metricScore = 12;
  else if (metricRatio >= 0.35 || totalMetrics >= 5) metricScore = 10;
  else if (metricRatio >= 0.2 || totalMetrics >= 3) metricScore = 8;
  else if (metricRatio >= 0.1 || totalMetrics >= 2) metricScore = 6;
  else if (totalMetrics >= 1) metricScore = 5;
  // 0 metrics → 0 pts

  if (totalMetrics === 0)
    issues.push('No quantified achievements — add numbers (e.g., "reduced load time by 40%", "built app with 500+ users").');
  else if (metricRatio < 0.25 && bullets.length >= 4)
    issues.push(`Only ${metricBullets} of ${bullets.length} bullets have measurable results — aim for 50%+.`);

  // ── Sub C: Weak openers (3 pts) ────────────────────────────────────────
  let weakCount = 0;
  for (const b of bullets) {
    const clean = b.text.replace(/^[-*•\s]+/, "");
    if (WEAK_OPENERS.some((rx) => rx.test(clean))) {
      weakCount++;
      if (weakBullets.length < 3) weakBullets.push(clean.slice(0, 115));
    }
  }
  const weakScore = weakCount === 0 ? 3 : weakCount === 1 ? 2 : weakCount <= 3 ? 1 : 0;
  if (weakCount > 0) issues.push(`${weakCount} bullet(s) use weak openers like "Responsible for" or "Worked on".`);

  // ── No experience OR projects section ─────────────────────────────────
  const lowerSecs = Object.keys(parsed.sections).map((s) => s.toLowerCase());
  const hasAnyPracticalSection = lowerSecs.some(
    (s) => s.includes("experience") || s.includes("employment") || s.includes("work") || s.includes("project") || s.includes("portfolio"),
  );
  if (!hasAnyPracticalSection)
    issues.push('No experience or projects section found — add at least a "Projects" section with what you\'ve built.');

  let expScore = verbScore + metricScore + weakScore;

  // Hard cap: zero quantified achievements → score can't exceed 7
  if (totalMetrics === 0) expScore = Math.min(expScore, 7);

  return {
    score: Math.min(expScore, 25),
    weakBullets,
    issues,
    verbRatio,
    metricRatio,
    totalMetrics,
    hasProjectsOnly: expOnlyBullets.length < 2 && projectBullets.length >= 2,
  };
}

// ======================================================
//  Core scoring — Formatting (25 pts, penalty-based)
// ======================================================
function computeFormattingScore(parsed) {
  let score = 25;
  const issues = [];
  const lowerSecs = Object.keys(parsed.sections).map((s) => s.toLowerCase());

  // Contact
  if (!parsed.contact.email) {
    score -= 5;
    issues.push("No email address detected.");
  } else if (!parsed.contact.phone) {
    score -= 2;
    issues.push("No phone number detected.");
  }

  // Required sections
  const hasExp = lowerSecs.some((s) => s.includes("experience") || s.includes("employment"));
  const hasEdu = lowerSecs.some((s) => s.includes("education"));
  const hasSkills = lowerSecs.some((s) => s.includes("skill") || s.includes("technolog") || s.includes("competenc"));
  if (!hasExp) {
    score -= 6;
    issues.push("No experience section found.");
  }
  if (!hasEdu) {
    score -= 3;
    issues.push("No education section found.");
  }
  if (!hasSkills) {
    score -= 3;
    issues.push('Add a dedicated "Technical Skills" section.');
  }
  if (Object.keys(parsed.sections).length < 3) {
    score -= 3;
    issues.push("Very few sections detected — resume may be unstructured.");
  }

  // Resume length
  const wc = parsed.stats.wordsCount;
  if (wc < 200) {
    score -= 5;
    issues.push(`Resume too short (${wc} words) — aim for 350–750 words.`);
  } else if (wc < 300) {
    score -= 3;
    issues.push(`Resume is thin (${wc} words) — add more detail to experience.`);
  } else if (wc > 1100) {
    score -= 4;
    issues.push(`Resume too long (${wc} words) — trim to one page.`);
  } else if (wc > 850) {
    score -= 2;
    issues.push(`Resume is slightly long (${wc} words) — consider trimming.`);
  }

  // Bullet quality
  const avgLen = parsed.bullets.length ? parsed.bullets.reduce((a, b) => a + b.text.split(" ").length, 0) / parsed.bullets.length : 0;
  if (avgLen > 40) {
    score -= 2;
    issues.push("Bullets are too long — keep each under 20 words.");
  }
  if (parsed.bullets.length < 3 && hasExp) {
    score -= 3;
    issues.push("Too few bullet points — add detail under each role.");
  }

  // Generic filler
  const FILLER = [
    "team player",
    "hard-working",
    "hardworking",
    "detail-oriented",
    "self-motivated",
    "passionate about",
    "fast learner",
    "quick learner",
    "excellent communication",
    "good communication",
    "problem solver",
    "results-driven",
    "results driven",
    "good knowledge",
    "good understanding",
    "basic knowledge",
    "exposure to",
    "familiar with",
    "knowledge of",
  ];
  const rawLow = parsed.rawText.toLowerCase();
  const fillerHits = FILLER.filter((f) => rawLow.includes(f)).length;
  if (fillerHits >= 4) {
    score -= 3;
    issues.push('Many generic phrases ("familiar with", "passionate about") — replace with specific achievements.');
  } else if (fillerHits >= 2) {
    score -= 1;
    issues.push('Some generic phrases detected — "familiar with" and "knowledge of" weaken ATS ranking.');
  }

  // Date completeness
  const expLines = (parsed.sections["experience"] || parsed.sections["work experience"] || []).join(" ");
  const hasDate =
    /\b(jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)[a-z]*[\s\-,]+\d{4}\b/gi.test(expLines) || /\b(20\d{2}|19\d{2})\b/.test(expLines);
  if (hasExp && !hasDate) {
    score -= 2;
    issues.push("No dates detected in experience — add start/end dates for each role.");
  }

  return { score: Math.max(score, 0), issues };
}

// ======================================================
//  Core scoring — Skills section (15 pts)
// ======================================================
function computeSkillsSectionScore(parsed, kwInfo, wordCount, totalMetrics) {
  const lowerSecs = Object.keys(parsed.sections).map((s) => s.toLowerCase());
  const hasSection = lowerSecs.some(
    (s) => s.includes("skill") || s.includes("technolog") || s.includes("competenc") || s.includes("tools"),
  );
  const distinct = kwInfo.distinctCount;

  let base;
  if (distinct >= 20) base = 13;
  else if (distinct >= 15) base = 11;
  else if (distinct >= 11) base = 8;
  else if (distinct >= 7) base = 5;
  else if (distinct >= 4) base = 3;
  else base = 1;

  let score = base + (hasSection ? 2 : 0);
  if (!hasSection) score = Math.min(score, 7);

  // A long skills list on a thin resume with no demonstrated impact is inflated.
  // Skills listed without evidence (thin doc, zero metrics) get a hard cap.
  if (wordCount < 300 && totalMetrics === 0) score = Math.min(score, 8);

  return { score: Math.min(score, 15), hasSection, distinct };
}

// ======================================================
//  Sample improvements (domain-aware)
// ======================================================
function buildSampleImprovements(primaryDomain, expInfo) {
  const examples = {
    systems_programming: [
      {
        before: "Built a server using C++ and sockets.",
        after: "Engineered a multi-threaded Winsock2 TCP server in C++ handling 500+ concurrent connections with sub-10ms average latency.",
      },
      {
        before: "Optimized memory usage.",
        after: "Reduced peak heap allocation by 35% via memory pool reuse and RAII patterns, eliminating 12 classes of memory leaks.",
      },
    ],
    data_science: [
      {
        before: "Trained a machine learning model.",
        after:
          "Trained a Random Forest classifier achieving 94.3% accuracy on a 50K-sample dataset, outperforming SVM baseline by 8.7 percentage points.",
      },
      {
        before: "Worked on data pipelines.",
        after: "Designed an Apache Airflow ETL pipeline ingesting 3M+ daily events, reducing manual processing by 6 hours/week.",
      },
    ],
    web_backend: [
      {
        before: "Built REST APIs for the platform.",
        after:
          "Engineered 14 RESTful API endpoints in Node.js/Express with JWT auth, reducing average response time by 42% through Redis caching.",
      },
      {
        before: "Improved application performance.",
        after: "Optimized 8 PostgreSQL queries via composite indexing, cutting p95 latency from 820ms to 145ms.",
      },
    ],
    web_frontend: [
      {
        before: "Created the UI for the application.",
        after: "Architected a React component library (32 components) with TypeScript, reducing UI dev time by 40% across 3 product teams.",
      },
      {
        before: "Improved page load speed.",
        after: "Optimized bundle size by 55% via code splitting and lazy loading, improving First Contentful Paint from 3.8s to 1.4s.",
      },
    ],
    cloud_devops: [
      {
        before: "Set up the CI/CD pipeline.",
        after:
          "Built a GitHub Actions CI/CD pipeline with Docker builds and automated tests, cutting deployment time from 28 to 6 minutes.",
      },
      {
        before: "Helped with Kubernetes deployment.",
        after: "Migrated 5 microservices to Kubernetes on AWS EKS, achieving 99.95% uptime and reducing infra costs by $1,200/month.",
      },
    ],
    default: [
      {
        before: "Responsible for building a web app using React.",
        after:
          "Developed a responsive React web application improving user engagement by 28% and reducing support tickets by 15% post-launch.",
      },
      {
        before: "Worked on backend APIs.",
        after: "Designed and deployed 10+ RESTful APIs processing 50K+ daily requests with 99.9% uptime over a 3-month production window.",
      },
    ],
  };

  const pool = examples[primaryDomain] || examples.default;
  const fallback = examples.default;
  const actual = expInfo?.weakBullets?.[0];

  if (actual) {
    return [
      {
        before: actual.slice(0, 120),
        after:
          'Start with a power verb + specific technology + measurable outcome. E.g.: "Engineered [what] using [tech], achieving [X% improvement / N users]."',
      },
      pool[0],
      pool[1] || fallback[0],
    ];
  }
  return [pool[0], pool[1] || fallback[0], fallback[1]];
}

// ======================================================
//  Main export
// ======================================================
function calculateATSScore(input, jobDescriptionText = null) {
  const parsed = typeof input === "string" ? parseResumeText(input) : input;

  if (!isLikelyResume(parsed)) {
    return {
      totalScore: 0,
      scoreBreakdown: { keywords: 0, experience: 0, formatting: 0, skills: 0 },
      freeAnalysis: {
        missingKeywords: [],
        weakBullets: [],
        formattingIssues: ["This document does not appear to be a resume — please upload a CV or resume file."],
        sampleImprovements: [],
      },
    };
  }

  // ── Dimension scores ──────────────────────────────────────────────────────
  const matched = matchSkillsInParsed(parsed);
  const [primaryDomain, secondaryDomain] = detectDomain(matched);
  const kwInfo = computeKeywordsScore(matched);
  const expInfo = computeExperienceScore(parsed);
  const fmtInfo = computeFormattingScore(parsed);
  const skillsInfo = computeSkillsSectionScore(parsed, kwInfo, parsed.stats.wordsCount, expInfo.totalMetrics);

  const scoreBreakdown = {
    keywords: Math.min(Math.max(kwInfo.score, 0), WEIGHTS.keywords),
    experience: Math.min(Math.max(expInfo.score, 0), WEIGHTS.experience),
    formatting: Math.min(Math.max(fmtInfo.score, 0), WEIGHTS.formatting),
    skills: Math.min(Math.max(skillsInfo.score, 0), WEIGHTS.skills),
  };

  // ── Cross-dimension adjustment for missing experience ────────────────────
  // Distinguish between:
  //   A) No experience AND no projects → skills list only → heavy penalty
  //   B) No experience BUT has projects → student resume → mild penalty
  //   C) Has experience → no adjustment needed
  const lowerSecs = Object.keys(parsed.sections).map((s) => s.toLowerCase());
  const hasExpSection = lowerSecs.some((s) => s.includes("experience") || s.includes("employment") || s.includes("work"));
  const hasProjectsSection = lowerSecs.some((s) => s.includes("project") || s.includes("portfolio"));
  const projectBulletCount = parsed.bullets.filter((b) =>
    ["projects", "personal projects", "key projects", "academic projects"].includes((b.section || "").toLowerCase()),
  ).length;
  // "strong projects" = dedicated section with 3+ bullets
  const hasStrongProjects = hasProjectsSection && projectBulletCount >= 3;

  if (!hasExpSection) {
    if (hasStrongProjects) {
      // Student resume — projects are their experience. Mild adjustments only.
      // Keywords: small reduction since skills listed but only project-demonstrated
      scoreBreakdown.keywords = Math.max(0, scoreBreakdown.keywords - 4);
      // Experience: modest cap — projects count as partial evidence
      scoreBreakdown.experience = Math.min(scoreBreakdown.experience, 12);
      // Skills: cap at 10 — projects partially back up skill claims
      scoreBreakdown.skills = Math.min(scoreBreakdown.skills, 10);
      // Formatting: only the existing -6 from computeFormattingScore applies
    } else {
      // Pure skills list — no backing evidence at all. Heavy caps.
      scoreBreakdown.keywords = Math.max(0, scoreBreakdown.keywords - 8);
      scoreBreakdown.experience = Math.min(scoreBreakdown.experience, 3);
      scoreBreakdown.skills = Math.min(scoreBreakdown.skills, 7);
      scoreBreakdown.formatting = Math.max(0, scoreBreakdown.formatting - 4);
    }
  }

  let totalScore = Object.values(scoreBreakdown).reduce((a, b) => a + b, 0);

  // ── Penalty layer ─────────────────────────────────────────────────────────
  const buzzwordInfo = detectBuzzwords(parsed.rawText);
  const weakVerbInfo = detectWeakVerbDensity(parsed.rawText, parsed.bullets);
  const growthInfo = detectGrowthSignals(parsed.rawText, parsed.bullets, hasExpSection);
  const repetitionInfo = detectRepetition(parsed.bullets);
  const totalPenalty = buzzwordInfo.penalty + weakVerbInfo.penalty + growthInfo.penalty + repetitionInfo.penalty;

  // ── Compound incompleteness penalty ──────────────────────────────────────
  // Counts simultaneous missing critical signals. Only penalises heavily when
  // the resume is structurally incomplete, not when it's a valid student resume.
  const incompletenessSignals = [
    !parsed.contact.email, // no email
    parsed.stats.wordsCount < 300, // thin resume
    expInfo.totalMetrics === 0, // zero quantified achievements
    parsed.bullets.length < 4, // almost no bullet content
    hasExpSection &&
      (() => {
        // experience section exists but no dates
        const expLines = (parsed.sections["experience"] || parsed.sections["work experience"] || []).join(" ");
        return (
          !/\b(jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)[a-z]*[\s\-,]+\d{4}\b/gi.test(expLines) &&
          !/\b(20\d{2}|19\d{2})\b/.test(expLines)
        );
      })(),
  ].filter(Boolean).length;

  // Student resumes with strong projects get half the compound penalty
  // — they're incomplete by industry standards but valid for their stage
  const compoundBase = incompletenessSignals >= 4 ? 10 : incompletenessSignals >= 3 ? 6 : incompletenessSignals >= 2 ? 2 : 0;
  const compoundPenalty = hasStrongProjects ? Math.round(compoundBase * 0.5) : compoundBase;

  totalScore = Math.max(5, Math.min(100, Math.round(totalScore - totalPenalty - compoundPenalty)));

  // ── Penalty issues for UI ─────────────────────────────────────────────────
  const penaltyIssues = [];
  if (buzzwordInfo.count >= 2)
    penaltyIssues.push(
      `${buzzwordInfo.count} buzzwords detected ("${buzzwordInfo.found.slice(0, 2).join('", "')}") — replace with specific achievements.`,
    );
  if (weakVerbInfo.weakCount >= 2)
    penaltyIssues.push(`${weakVerbInfo.weakCount} bullets use weak or passive language — rephrase with direct action verbs.`);
  if (growthInfo.signalsFound.length === 0 && hasExpSection && parsed.bullets.length >= 4)
    penaltyIssues.push("No growth signals (promotions, awards, quantified leadership) — add evidence of career progression.");
  if (repetitionInfo.repeatedPhrases.length >= 2)
    penaltyIssues.push(
      `Repeated phrases across bullets ("${repetitionInfo.repeatedPhrases[0]}") — vary language to avoid sounding formulaic.`,
    );

  // ── JD coverage (optional) ────────────────────────────────────────────────
  let jdCoverage = null;
  if (jobDescriptionText) {
    const jdToks = new Set(tokenize(jobDescriptionText));
    const resToks = new Set(parsed.words);
    let matchCount = 0;
    jdToks.forEach((t) => {
      if (resToks.has(t)) matchCount++;
    });
    jdCoverage = {
      coveragePct: jdToks.size ? Math.round((matchCount / jdToks.size) * 100) : 0,
      missingFromJD: [...jdToks].filter((t) => !resToks.has(t) && t.length > 3).slice(0, 20),
    };
  }

  return {
    totalScore,
    scoreBreakdown,
    freeAnalysis: {
      missingKeywords: getMissingKeywords(matched, primaryDomain, secondaryDomain),
      weakBullets: expInfo.weakBullets,
      formattingIssues: [...fmtInfo.issues, ...expInfo.issues, ...penaltyIssues].slice(0, 8),
      sampleImprovements: buildSampleImprovements(primaryDomain, expInfo),
      _evidence: {
        matchedSkills: [...matched.keys()],
        distinctCount: kwInfo.distinctCount,
        effectiveCount: +kwInfo.effectiveCount.toFixed(1),
        verbRatio: Math.round(expInfo.verbRatio * 100),
        metricRatio: Math.round(expInfo.metricRatio * 100),
        totalMetrics: expInfo.totalMetrics,
        wordCount: parsed.stats.wordsCount,
        bulletCount: parsed.stats.bullets,
        primaryDomain,
        secondaryDomain,
        hasExpSection,
        hasStrongProjects,
        hasProjectsOnly: expInfo.hasProjectsOnly || false,
        penalties: {
          buzzwords: buzzwordInfo.penalty,
          weakVerbs: weakVerbInfo.penalty,
          growth: growthInfo.penalty,
          repetition: repetitionInfo.penalty,
          compound: compoundPenalty,
          total: totalPenalty + compoundPenalty,
        },
        growthSignals: growthInfo.signalsFound,
        buzzwordsFound: buzzwordInfo.found,
        jdCoverage,
      },
    },
  };
}

module.exports = { calculateATSScore };
