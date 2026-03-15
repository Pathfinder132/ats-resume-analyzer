// backend/src/services/parseService.js
// Enhanced: DOCX support, better section detection, header/footer dedup, richer structure

const fs = require("fs");
const path = require("path");
const pdfParse = require("pdf-parse");
const { normalize, words, sentenceSplit, deduplicateRepeatedLines } = require("./textUtils");

// Lazy-load mammoth so server doesn't crash if it's not installed yet
let mammoth;
try {
  mammoth = require("mammoth");
} catch (_) {
  mammoth = null;
}

// ─── Section header vocabulary ────────────────────────────────────────────────
// Ordered: more specific patterns first.
// Covers standard + Indian college formats (VIT, BITS, NIT, IIT, IIIT style resumes)
const SECTION_PATTERNS = [
  // ── Experience (internships count as experience for students) ─────────────
  {
    key: "experience",
    re: /^(work\s+experience|professional\s+experience|employment\s+history|experience|work\s+history|career\s+history|relevant\s+experience|industry\s+experience|corporate\s+experience|job\s+experience|professional\s+background)$/i,
  },
  // ── Internships (separate heading common in Indian resumes) ───────────────
  {
    key: "experience",
    re: /^(internships?|internship\s+experience|internship\s+&\s+work\s+experience|work\s+&\s+internship|industrial\s+training|summer\s+training|summer\s+internship|winter\s+internship|research\s+internship|industry\s+internship)$/i,
  },
  // ── Education ─────────────────────────────────────────────────────────────
  {
    key: "education",
    re: /^(education|academic\s+(background|qualifications?|details?|profile)|qualifications?|degrees?|schooling|studies|educational\s+qualifications?|academic\s+credentials?)$/i,
  },
  // ── Skills (many variants used in Indian college templates) ───────────────
  {
    key: "skills",
    re: /^(technical\s+skills?|skills?|core\s+competencies|competencies|technologies|tech\s+stack|tools?\s+[&and]+\s+technologies?|proficiencies|expertise|technical\s+expertise|areas\s+of\s+expertise|key\s+skills?|it\s+skills?|computer\s+skills?|programming\s+skills?|technical\s+proficiency|technical\s+knowledge|skills\s+&\s+technologies|skills\s+and\s+technologies|software\s+skills?|technical\s+competencies|tools\s+&\s+frameworks?|languages\s+&\s+technologies|technologies\s+[&and]+\s+tools?)$/i,
  },
  // ── Projects (many variants) ───────────────────────────────────────────────
  {
    key: "projects",
    re: /^(projects?|personal\s+projects?|key\s+projects?|notable\s+projects?|academic\s+projects?|side\s+projects?|portfolio|major\s+projects?|minor\s+projects?|course\s+projects?|self\s+projects?|independent\s+projects?|technical\s+projects?|software\s+projects?|college\s+projects?|capstone\s+project|final\s+year\s+project|b\.?tech\s+project|undergraduate\s+project|project\s+work|project\s+experience)$/i,
  },
  // ── Summary / Objective ────────────────────────────────────────────────────
  {
    key: "summary",
    re: /^(summary|professional\s+summary|career\s+summary|profile|professional\s+profile|about\s+me|objective|career\s+objective|career\s+goal|professional\s+objective|personal\s+statement|about|executive\s+summary|overview)$/i,
  },
  // ── Certifications ─────────────────────────────────────────────────────────
  {
    key: "certifications",
    re: /^(certifications?|certificates?|credentials?|licenses?\s+[&and]+\s+certifications?|professional\s+certifications?|online\s+certifications?|courses?\s+[&and]+\s+certifications?|moocs?|online\s+courses?)$/i,
  },
  // ── Achievements / Awards ──────────────────────────────────────────────────
  {
    key: "achievements",
    re: /^(achievements?|awards?|honors?|honours?|accomplishments?|recognitions?|scholarships?|fellowships?|prizes?|distinctions?|academic\s+achievements?|notable\s+achievements?)$/i,
  },
  // ── Positions of Responsibility (very common in Indian college resumes) ────
  {
    key: "experience",
    re: /^(positions?\s+of\s+responsibility|leadership\s+(roles?|experience|positions?)|roles?\s+[&and]+\s+responsibilities|club\s+(roles?|positions?)|committee\s+(roles?|positions?)|student\s+(leadership|council|body|government)|organizational\s+roles?)$/i,
  },
  // ── Co-curricular / Extra-curricular ──────────────────────────────────────
  {
    key: "activities",
    re: /^(co.?curricular(\s+activities?)?|extra.?curricular(\s+activities?)?|activities|extracurriculars?|clubs?\s+[&and]+\s+societies|societies?|clubs?|student\s+activities?)$/i,
  },
  // ── Publications / Research ────────────────────────────────────────────────
  {
    key: "publications",
    re: /^(publications?|research(\s+work|\s+experience|\s+papers?)?|papers?|articles?|conferences?|journal\s+papers?|research\s+[&and]+\s+publications?)$/i,
  },
  // ── Volunteer ─────────────────────────────────────────────────────────────
  { key: "activities", re: /^(volunteer(ing|\s+experience|\s+work)?|community\s+(service|involvement)|social\s+work|nss|ncc)$/i },
  // ── Coursework / Relevant Courses (common in student resumes) ─────────────
  {
    key: "education",
    re: /^(relevant\s+coursework|coursework|key\s+courses?|core\s+courses?|related\s+coursework|relevant\s+courses?|academic\s+courses?)$/i,
  },
  // ── Languages (spoken) ────────────────────────────────────────────────────
  { key: "languages", re: /^(languages?|spoken\s+languages?|linguistic\s+skills?|language\s+proficiency)$/i },
  // ── Hobbies / Interests ────────────────────────────────────────────────────
  { key: "activities", re: /^(hobbies?|interests?|personal\s+interests?|hobbies?\s+[&and]+\s+interests?)$/i },
  // ── Declaration (Indian resume specific — ignore content, just mark section)
  { key: "declaration", re: /^(declaration|self.?declaration)$/i },
];

// Section keys that should have their long lines treated as bullets
const EXPERIENCE_LIKE_SECTIONS = new Set([
  "experience",
  "work experience",
  "professional experience",
  "employment history",
  "projects",
  "personal projects",
  "key projects",
  "academic projects",
  "achievements",
  "activities",
  "certifications",
  "publications",
]);

const BULLET_MARKERS_RE = /^\s*(?:[-•●○◆◇▸▹►▻✓✔*]|\d{1,2}[.)]\s|[a-z][.)]\s)/i;

// Verbs that strongly suggest a bullet line in experience/project sections
const STARTS_WITH_VERB_RE =
  /^(developed|built|designed|implemented|created|led|managed|improved|increased|decreased|reduced|delivered|launched|maintained|architected|optimized|automated|deployed|integrated|migrated|collaborated|mentored|analyzed|established|spearheaded|orchestrated|engineered|scaled|drove|achieved|executed|resolved|streamlined|coordinated|researched|published|presented|awarded|earned|received|trained|supervised|handled|processed|wrote|contributed|refactored|shipped|initiated|restructured|pioneered|championed|devised|negotiated|secured|revamped|transformed|upgraded|consolidated|standardized|generated|expanded|enhanced|accelerated|simplified|eliminated|identified|formulated|directed|oversaw|facilitated|participated|organized|demonstrated|applied|utilized|leveraged|worked)\b/i;

// ─── File text extraction ──────────────────────────────────────────────────────
async function extractTextFromFile(filePath, mimetype = "") {
  const ext = path.extname(filePath).toLowerCase();

  // ── DOCX ──
  if (ext === ".docx" || mimetype.includes("wordprocessingml")) {
    if (!mammoth) throw new Error("mammoth not installed — run: npm i mammoth");
    const raw = await mammoth.extractRawText({ path: filePath });
    return normalize(raw.value || "");
  }

  // ── PDF (default) ──
  const buffer = fs.readFileSync(filePath);
  try {
    const data = await pdfParse(buffer);
    let text = data.text || "";
    // PDFs sometimes join lines with single spaces instead of newlines.
    // Heuristic: if there are very few newlines but many period-space-Capital patterns, restore them.
    const newlineCount = (text.match(/\n/g) || []).length;
    if (newlineCount < 10 && text.length > 200) {
      text = text.replace(/([.!?])\s+([A-Z])/g, "$1\n$2");
    }
    return normalize(text);
  } catch (err) {
    console.warn("[parseService] pdf-parse failed:", err.message);
    return "";
  }
}

// ─── Contact extraction ────────────────────────────────────────────────────────
function extractContactInfo(text) {
  const email = (text.match(/[a-zA-Z0-9._%+\-]+@[a-zA-Z0-9.\-]+\.[a-z]{2,}/i) || [])[0] || null;
  const phone = (text.match(/(\+?\d[\d\s\-().]{7,14}\d)/) || [])[0]?.replace(/\s+/g, " ").trim() || null;
  const linkedin = (text.match(/(?:linkedin\.com\/in\/|linkedin\.com\/)([A-Za-z0-9_\-%.]+)/i) || [])[1]
    ? "linkedin.com/in/" + (text.match(/(?:linkedin\.com\/in\/|linkedin\.com\/)([A-Za-z0-9_\-%.]+)/i) || [])[1]
    : null;
  const github = (text.match(/github\.com\/([A-Za-z0-9_\-]+)/i) || [])[1]
    ? "github.com/" + (text.match(/github\.com\/([A-Za-z0-9_\-]+)/i) || [])[1]
    : null;
  return { email, phone, linkedin, github };
}

// ─── Line classification ───────────────────────────────────────────────────────
function classifyLine(line) {
  const trimmed = line.trim();
  if (!trimmed) return "empty";

  // Section header heuristics (order matters)
  const clean = trimmed.replace(/[:\-_=*#|]+$/, "").trim();

  // Explicit section match
  for (const { key, re } of SECTION_PATTERNS) {
    if (re.test(clean)) return { type: "section", key };
  }

  // ALL-CAPS short line (common PDF header style)
  if (clean.length <= 40 && /^[A-Z][A-Z\s\-\/&]+$/.test(clean) && clean.split(" ").length <= 5) {
    // Check if it matches any section keyword loosely
    const lc = clean.toLowerCase();
    for (const { key, re } of SECTION_PATTERNS) {
      if (re.test(lc)) return { type: "section", key };
    }
    // Unknown ALL-CAPS heading — still treat as section boundary
    return { type: "section", key: clean.toLowerCase().replace(/\s+/g, "_") };
  }

  // Bullet line
  if (BULLET_MARKERS_RE.test(trimmed)) return "bullet";

  // Action verb start (likely a bullet in disguise — no marker)
  if (STARTS_WITH_VERB_RE.test(trimmed) && trimmed.length > 30) return "bullet_inferred";

  return "line";
}

// ─── Section splitter ──────────────────────────────────────────────────────────
function extractSections(lines) {
  const sections = {};
  let current = "top";
  sections[current] = [];

  for (const rawLine of lines) {
    const trimmed = rawLine.trim();
    if (!trimmed) continue;

    const cls = classifyLine(trimmed);
    if (cls && typeof cls === "object" && cls.type === "section") {
      current = cls.key;
      if (!sections[current]) sections[current] = [];
      continue;
    }
    sections[current].push(trimmed);
  }

  return sections;
}

// ─── Bullet extraction ─────────────────────────────────────────────────────────
function extractBulletsFromLines(lines, sectionKey) {
  const bullets = [];
  for (const line of lines) {
    const t = line.trim();
    if (t.length < 15) continue; // too short to be a meaningful bullet
    const cls = classifyLine(t);
    if (cls === "bullet" || cls === "bullet_inferred") {
      // Strip leading bullet marker
      const text = t.replace(/^\s*(?:[-•●○◆◇▸▹►▻✓✔*]|\d{1,2}[.)]\s|[a-z][.)]\s)/i, "").trim();
      if (text.length >= 15) bullets.push({ section: sectionKey, text });
    } else if (typeof cls === "string" && cls === "line") {
      // In experience/project-like sections, treat long lines as bullets too
      if (EXPERIENCE_LIKE_SECTIONS.has(sectionKey) && t.length > 40) {
        bullets.push({ section: sectionKey, text: t });
      }
    }
  }
  return bullets;
}

// ─── Main parser ───────────────────────────────────────────────────────────────
/**
 * parseResumeText(text)
 * Returns:
 * {
 *   rawText,
 *   contact: { email, phone, linkedin, github },
 *   sections: { sectionKey: [lines] },
 *   bullets: [{ section, text }],
 *   words: [...],
 *   stats: { lines, wordsCount, bullets, sectionsCount }
 * }
 */
function parseResumeText(text) {
  const normalized = normalize(text);
  const rawLines = normalized
    .split("\n")
    .map((l) => l.trim())
    .filter(Boolean);
  const contact = extractContactInfo(normalized);
  const sections = extractSections(rawLines);

  // Collect bullets per section
  const bullets = [];
  for (const [secKey, secLines] of Object.entries(sections)) {
    const secBullets = extractBulletsFromLines(secLines, secKey);
    bullets.push(...secBullets);
  }

  const allWords = words(normalized);

  const stats = {
    lines: rawLines.length,
    wordsCount: allWords.length,
    bullets: bullets.length,
    sectionsCount: Object.keys(sections).length,
  };

  return {
    rawText: normalized,
    contact,
    sections,
    bullets,
    words: allWords,
    stats,
  };
}

// ─── Non-resume classifier ─────────────────────────────────────────────────────
/**
 * Returns false for marksheets, certificates, ID scans, etc.
 */
function isLikelyResume(parsed) {
  const lowerSections = Object.keys(parsed.sections).map((s) => s.toLowerCase());
  const contactOk = parsed.contact.email || parsed.contact.phone;
  const hasExperience = lowerSections.some((s) => s.includes("experience") || s.includes("employment"));
  const hasEducation = lowerSections.some((s) => s.includes("education"));
  const hasBullets = parsed.bullets.length >= 1;

  // Numeric-heavy doc = marksheet / transcript
  const numericCount = parsed.words.filter((w) => /^[\d%.,]+$/.test(w)).length;
  const numericRatio = parsed.words.length ? numericCount / parsed.words.length : 1;

  return Boolean((contactOk || hasExperience || hasEducation || hasBullets) && numericRatio < 0.55 && parsed.stats.wordsCount > 40);
}

module.exports = { extractTextFromFile, parseResumeText, isLikelyResume };
