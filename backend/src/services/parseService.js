// backend/src/services/parseService.js
// Enhanced: DOCX support, better section detection, header/footer dedup, richer structure

const fs = require('fs');
const path = require('path');
const pdfParse = require('pdf-parse');
const { normalize, words, sentenceSplit, deduplicateRepeatedLines } = require('./textUtils');

// Lazy-load mammoth so server doesn't crash if it's not installed yet
let mammoth;
try { mammoth = require('mammoth'); } catch (_) { mammoth = null; }

// ─── Section header vocabulary ────────────────────────────────────────────────
// Ordered: more specific patterns first.
// Covers standard + Indian college formats (VIT, BITS, NIT, IIT, IIIT style resumes)
const SECTION_PATTERNS = [
  // ── Experience (internships count as experience for students) ─────────────
  { key: 'experience', re: /^(work\s+experience|professional\s+experience|employment\s+history|experience|work\s+history|career\s+history|relevant\s+experience|industry\s+experience|corporate\s+experience|job\s+experience|professional\s+background)$/i },
  // ── Internships (separate heading common in Indian resumes) ───────────────
  { key: 'experience', re: /^(internships?|internship\s+experience|internship\s+&\s+work\s+experience|work\s+&\s+internship|industrial\s+training|summer\s+training|summer\s+internship|winter\s+internship|research\s+internship|industry\s+internship)$/i },
  // ── Education ─────────────────────────────────────────────────────────────
  { key: 'education', re: /^(education|academic\s+(background|qualifications?|details?|profile)|qualifications?|degrees?|schooling|studies|educational\s+qualifications?|academic\s+credentials?)$/i },
  // ── Skills (many variants used in Indian college templates) ───────────────
  { key: 'skills', re: /^(technical\s+skills?|skills?|core\s+competencies|competencies|technologies|tech\s+stack|tools?\s+[&and]+\s+technologies?|proficiencies|expertise|technical\s+expertise|areas\s+of\s+expertise|key\s+skills?|it\s+skills?|computer\s+skills?|programming\s+skills?|technical\s+proficiency|technical\s+knowledge|skills\s+&\s+technologies|skills\s+and\s+technologies|software\s+skills?|technical\s+competencies|tools\s+&\s+frameworks?|languages\s+&\s+technologies|technologies\s+[&and]+\s+tools?)$/i },
  // ── Projects (many variants) ───────────────────────────────────────────────
  { key: 'projects', re: /^(projects?|personal\s+projects?|key\s+projects?|notable\s+projects?|academic\s+projects?|side\s+projects?|portfolio|major\s+projects?|minor\s+projects?|course\s+projects?|self\s+projects?|independent\s+projects?|technical\s+projects?|software\s+projects?|college\s+projects?|capstone\s+project|final\s+year\s+project|b\.?tech\s+project|undergraduate\s+project|project\s+work|project\s+experience)$/i },
  // ── Summary / Objective ────────────────────────────────────────────────────
  { key: 'summary', re: /^(summary|professional\s+summary|career\s+summary|profile|professional\s+profile|about\s+me|objective|career\s+objective|career\s+goal|professional\s+objective|personal\s+statement|about|executive\s+summary|overview)$/i },
  // ── Certifications ─────────────────────────────────────────────────────────
  { key: 'certifications', re: /^(certifications?|certificates?|credentials?|licenses?\s+[&and]+\s+certifications?|professional\s+certifications?|online\s+certifications?|courses?\s+[&and]+\s+certifications?|moocs?|online\s+courses?)$/i },
  // ── Achievements / Awards ──────────────────────────────────────────────────
  { key: 'achievements', re: /^(achievements?|awards?|honors?|honours?|accomplishments?|recognitions?|scholarships?|fellowships?|prizes?|distinctions?|academic\s+achievements?|notable\s+achievements?)$/i },
  // ── Positions of Responsibility (very common in Indian college resumes) ────
  { key: 'experience', re: /^(positions?\s+of\s+responsibility|leadership\s+(roles?|experience|positions?)|roles?\s+[&and]+\s+responsibilities|club\s+(roles?|positions?)|committee\s+(roles?|positions?)|student\s+(leadership|council|body|government)|organizational\s+roles?)$/i },
  // ── Co-curricular / Extra-curricular ──────────────────────────────────────
  { key: 'activities', re: /^(co.?curricular(\s+activities?)?|extra.?curricular(\s+activities?)?|activities|extracurriculars?|clubs?\s+[&and]+\s+societies|societies?|clubs?|student\s+activities?)$/i },
  // ── Publications / Research ────────────────────────────────────────────────
  { key: 'publications', re: /^(publications?|research(\s+work|\s+experience|\s+papers?)?|papers?|articles?|conferences?|journal\s+papers?|research\s+[&and]+\s+publications?)$/i },
  // ── Volunteer ─────────────────────────────────────────────────────────────
  { key: 'activities', re: /^(volunteer(ing|\s+experience|\s+work)?|community\s+(service|involvement)|social\s+work|nss|ncc)$/i },
  // ── Coursework / Relevant Courses (common in student resumes) ─────────────
  { key: 'education', re: /^(relevant\s+coursework|coursework|key\s+courses?|core\s+courses?|related\s+coursework|relevant\s+courses?|academic\s+courses?)$/i },
  // ── Languages (spoken) ────────────────────────────────────────────────────
  { key: 'languages', re: /^(languages?|spoken\s+languages?|linguistic\s+skills?|language\s+proficiency)$/i },
  // ── Hobbies / Interests ────────────────────────────────────────────────────
  { key: 'activities', re: /^(hobbies?|interests?|personal\s+interests?|hobbies?\s+[&and]+\s+interests?)$/i },
  // ── Declaration (Indian resume specific — ignore content, just mark section) 
  { key: 'declaration', re: /^(declaration|self.?declaration)$/i },
];

// Section keys that should have their long lines treated as bullets
const EXPERIENCE_LIKE_SECTIONS = new Set([
  'experience', 'work experience', 'professional experience', 'employment history',
  'projects', 'personal projects', 'key projects', 'academic projects',
  'achievements', 'activities', 'certifications', 'publications',
]);

const BULLET_MARKERS_RE = /^\s*(?:[-•●○◆◇▸▹►▻✓✔*]|\d{1,2}[.)]\s|[a-z][.)]\s)/i;

// Verbs that strongly suggest a bullet line in experience/project sections
const STARTS_WITH_VERB_RE = /^(developed|built|designed|implemented|created|led|managed|improved|increased|decreased|reduced|delivered|launched|maintained|architected|optimized|automated|deployed|integrated|migrated|collaborated|mentored|analyzed|established|spearheaded|orchestrated|engineered|scaled|drove|achieved|executed|resolved|streamlined|coordinated|researched|published|presented|awarded|earned|received|trained|supervised|handled|processed|wrote|contributed|refactored|shipped|initiated|restructured|pioneered|championed|devised|negotiated|secured|revamped|transformed|upgraded|consolidated|standardized|generated|expanded|enhanced|accelerated|simplified|eliminated|identified|formulated|directed|oversaw|facilitated|participated|organized|demonstrated|applied|utilized|leveraged|worked)\b/i;

// ─── File text extraction ──────────────────────────────────────────────────────
async function extractTextFromFile(filePath, mimetype = '') {
  const ext = path.extname(filePath).toLowerCase();

  // ── DOCX ──
  if (ext === '.docx' || mimetype.includes('wordprocessingml')) {
    if (!mammoth) throw new Error('mammoth not installed — run: npm i mammoth');
    const raw = await mammoth.extractRawText({ path: filePath });
    return normalize(raw.value || '');
  }

  // ── PDF (default) ──
  const buffer = fs.readFileSync(filePath);
  try {
    const data = await pdfParse(buffer);
    let text = data.text || '';
    // PDFs sometimes join lines with single spaces instead of newlines.
    // Heuristic: if there are very few newlines but many period-space-Capital patterns, restore them.
    const newlineCount = (text.match(/\n/g) || []).length;
    if (newlineCount < 10 && text.length > 200) {
      text = text.replace(/([.!?])\s+([A-Z])/g, '$1\n$2');
    }
    return normalize(text);
  } catch (err) {
    console.warn('[parseService] pdf-parse failed:', err.message);
    return '';
  }
}

// ─── Contact extraction ────────────────────────────────────────────────────────
function extractContactInfo(text) {
  const email    = (text.match(/[a-zA-Z0-9._%+\-]+@[a-zA-Z0-9.\-]+\.[a-z]{2,}/i) || [])[0] || null;
  const phone    = (text.match(/(\+?\d[\d\s\-().]{7,14}\d)/) || [])[0]?.replace(/\s+/g, ' ').trim() || null;
  const linkedin = (text.match(/(?:linkedin\.com\/in\/|linkedin\.com\/)([A-Za-z0-9_\-%.]+)/i) || [])[1]
                    ? 'linkedin.com/in/' + (text.match(/(?:linkedin\.com\/in\/|linkedin\.com\/)([A-Za-z0-9_\-%.]+)/i) || [])[1]
                    : null;
  const github   = (text.match(/github\.com\/([A-Za-z0-9_\-]+)/i) || [])[1]
                    ? 'github.com/' + (text.match(/github\.com\/([A-Za-z0-9_\-]+)/i) || [])[1]
                    : null;
  return { email, phone, linkedin, github };
}

// ─── Line classification ───────────────────────────────────────────────────────
function classifyLine(line) {
  const trimmed = line.trim();
  if (!trimmed) return 'empty';

  // Section header heuristics (order matters)
  const clean = trimmed.replace(/[:\-_=*#|]+$/, '').trim();

  // Explicit section match
  for (const { key, re } of SECTION_PATTERNS) {
    if (re.test(clean)) return { type: 'section', key };
  }

  // ALL-CAPS short line (common PDF header style)
  if (clean.length <= 40 && /^[A-Z][A-Z\s\-\/&]+$/.test(clean) && clean.split(' ').length <= 5) {
    // Check if it matches any section keyword loosely
    const lc = clean.toLowerCase();
    for (const { key, re } of SECTION_PATTERNS) {
      if (re.test(lc)) return { type: 'section', key };
    }
    // Unknown ALL-CAPS heading — still treat as section boundary
    return { type: 'section', key: clean.toLowerCase().replace(/\s+/g, '_') };
  }

  // Bullet line
  if (BULLET_MARKERS_RE.test(trimmed)) return 'bullet';

  // Action verb start (likely a bullet in disguise — no marker)
  if (STARTS_WITH_VERB_RE.test(trimmed) && trimmed.length > 30) return 'bullet_inferred';

  return 'line';
}

// ─── Section splitter ──────────────────────────────────────────────────────────
function extractSections(lines) {
  const sections = {};
  let current = 'top';
  sections[current] = [];

  for (const rawLine of lines) {
    const trimmed = rawLine.trim();
    if (!trimmed) continue;

    const cls = classifyLine(trimmed);
    if (cls && typeof cls === 'object' && cls.type === 'section') {
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
    if (cls === 'bullet' || cls === 'bullet_inferred') {
      // Strip leading bullet marker
      const text = t.replace(/^\s*(?:[-•●○◆◇▸▹►▻✓✔*]|\d{1,2}[.)]\s|[a-z][.)]\s)/i, '').trim();
      if (text.length >= 15) bullets.push({ section: sectionKey, text });
    } else if (typeof cls === 'string' && cls === 'line') {
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
  const rawLines = normalized.split('\n').map(l => l.trim()).filter(Boolean);
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
 * Deliberately lenient — a false positive (real resume scored 0) is worse
 * than a false negative (certificate gets a low score instead of 0).
 */
function isLikelyResume(parsed) {
  const lowerSections = Object.keys(parsed.sections).map(s => s.toLowerCase());

  const contactOk     = parsed.contact.email || parsed.contact.phone;
  const hasExperience = lowerSections.some(s =>
    s.includes('experience') || s.includes('employment') || s.includes('internship')
  );
  const hasEducation  = lowerSections.some(s => s.includes('education'));
  const hasSkills     = lowerSections.some(s =>
    s.includes('skill') || s.includes('technolog') || s.includes('competenc')
  );
  const hasProjects   = lowerSections.some(s =>
    s.includes('project') || s.includes('portfolio')
  );
  const hasBullets    = parsed.bullets.length >= 1;
  const hasName       = parsed.stats.lines > 0; // first non-empty line is usually a name

  // Numeric-heavy doc = marksheet / transcript / bank statement
  const numericCount = parsed.words.filter(w => /^[\d%.,]+$/.test(w)).length;
  const numericRatio = parsed.words.length ? numericCount / parsed.words.length : 1;

  // Must pass BOTH:
  // 1. At least ONE resume signal present
  // 2. Not numeric-heavy AND not too short
  const hasAnyResumeSignal =
    contactOk || hasExperience || hasEducation ||
    hasSkills || hasProjects || hasBullets;

  return Boolean(
    hasAnyResumeSignal &&
    numericRatio < 0.60 &&          // raised from 0.55 — some resumes have lots of dates/years
    parsed.stats.wordsCount > 30    // lowered from 40 — very short resumes still valid
  );
}

// ─── Structured JSON extractor ────────────────────────────────────────────────
/**
 * extractResumeJson(parsed)
 *
 * Converts the output of parseResumeText() into a structured JSON that matches
 * the pdfService schema. Deterministic — no AI, zero API calls.
 *
 * Uses section lines directly rather than re-parsing raw text, so structure
 * matches what the parser already identified. This JSON is stored at analyze
 * time and used as the base for JD-tailored PDF generation.
 */
function extractResumeJson(parsed) {
  const { contact, sections, rawText } = parsed;

  // ── Name (first non-empty line before any section header) ──────────────────
  const topLines = (sections['top'] || []).filter(l => l.trim().length > 1);
  const name = topLines[0] || rawText.split('\n').find(l => l.trim().length > 1) || '';

  // ── Summary ──────────────────────────────────────────────────────────────────
  const summaryLines = sections['summary'] || sections['professional summary'] ||
                       sections['profile'] || sections['objective'] || [];
  const summary = summaryLines.join(' ').trim().slice(0, 400);

  // ── Skills ───────────────────────────────────────────────────────────────────
  // Find the skills section — try multiple possible keys
  const skillsLines = sections['skills'] || sections['technical skills'] ||
                      sections['technologies'] || sections['tech stack'] || [];

  const skillsText = skillsLines.join(' ');
  let technical = [];
  let tools = [];
  let soft = [];

  // Try to split by category labels (Technical:, Tools:, Soft:, Languages:, Libraries:)
  const techRe  = /(?:technical|languages?|programming)[:\s]+([^.]+?)(?:tools?[:\s]|soft[:\s]|libraries?[:\s]|frameworks?[:\s]|$)/i;
  const toolsRe = /(?:tools?|libraries?|frameworks?)[:\s]+([^.]+?)(?:soft[:\s]|technical[:\s]|languages?[:\s]|$)/i;
  const softRe  = /soft\s*skills?[:\s]+([^.]+?)(?:technical[:\s]|tools?[:\s]|$)/i;

  const techMatch  = skillsText.match(techRe);
  const toolsMatch = skillsText.match(toolsRe);
  const softMatch  = skillsText.match(softRe);

  const splitSkills = (str) =>
    str.split(/[,•·|]/).map(s => s.trim()).filter(s => s.length > 1 && s.length < 40);

  if (techMatch)  technical = splitSkills(techMatch[1]);
  if (toolsMatch) tools     = splitSkills(toolsMatch[1]);
  if (softMatch)  soft      = splitSkills(softMatch[1]).slice(0, 3);

  // Fallback: no category labels found — treat all skill lines as technical
  if (technical.length === 0 && skillsLines.length > 0) {
    technical = splitSkills(skillsLines.join(', '));
  }

  // Deduplicate tools from technical
  const techSet = new Set(technical.map(s => s.toLowerCase()));
  tools = tools.filter(t => !techSet.has(t.toLowerCase()));

  // ── Experience ────────────────────────────────────────────────────────────────
  // Experience lines come in a pattern:
  //   Header line 1: Role / Company
  //   Header line 2: Company / Location (sometimes)
  //   Bullet lines: actual achievements
  //
  // We detect role/company headers as non-bullet lines shorter than 80 chars.
  const expLines = sections['experience'] || [];
  const experience = parseEntriesFromLines(expLines, 'experience');

  // ── Projects ──────────────────────────────────────────────────────────────────
  const projLines = sections['projects'] || sections['personal projects'] ||
                    sections['academic projects'] || [];
  const projects  = parseEntriesFromLines(projLines, 'projects');

  // ── Education ────────────────────────────────────────────────────────────────
  const eduLines  = sections['education'] || sections['academic background'] || [];
  const education = parseEducationFromLines(eduLines, rawText);

  // ── Certifications ────────────────────────────────────────────────────────────
  const certLines = sections['certifications'] || sections['certificates'] ||
                    sections['online courses'] || [];
  const certifications = certLines
    .map(l => l.replace(/^[•\-*\s]+/, '').trim())
    .filter(l => l.length > 3);

  // ── Achievements ──────────────────────────────────────────────────────────────
  const achLines = sections['achievements'] || sections['awards'] || [];
  const achievements = achLines
    .map(l => l.replace(/^[•\-*\s]+/, '').trim())
    .filter(l => l.length > 3);

  return {
    name:     name.trim(),
    email:    contact.email   || '',
    phone:    contact.phone   || '',
    linkedin: contact.linkedin ? `https://${contact.linkedin}` : '',
    github:   contact.github  ? `https://${contact.github}`   : '',
    summary,
    skills:   { technical, tools, soft },
    experience,
    projects,
    education,
    certifications,
    achievements,
  };
}

// ── Parse experience / project entries from section lines ─────────────────────
// Heuristic: short non-bullet lines are headers (role/company/date);
// bullet-like lines are achievements.
function parseEntriesFromLines(lines, sectionType) {
  const entries = [];
  let current   = null;

  const DATE_RE = /\b(?:jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)[a-z]*[\s.,]+\d{4}|\b\d{4}\s*[-–]\s*(?:\d{4}|present|current|ongoing)\b/i;
  const isBullet = (line) =>
    BULLET_MARKERS_RE.test(line) || STARTS_WITH_VERB_RE.test(line);

  for (const rawLine of lines) {
    const line = rawLine.trim();
    if (!line) continue;

    if (isBullet(line)) {
      // Belongs to current entry
      if (!current) {
        // No header seen yet — create a blank entry
        current = sectionType === 'projects'
          ? { title: '', tech: [], bullets: [] }
          : { role: '', company: '', duration: '', location: '', bullets: [] };
        entries.push(current);
      }
      const cleanBullet = line.replace(/^[•\-*●○\s]+/, '').trim();
      if (cleanBullet.length > 10) current.bullets.push(cleanBullet);
    } else {
      // Header line — could be role, company, or date
      const hasDate = DATE_RE.test(line);

      if (sectionType === 'projects') {
        // For projects: first non-bullet line = title, look for tech after |
        const pipeIdx = line.indexOf('|');
        const title   = pipeIdx >= 0 ? line.slice(0, pipeIdx).trim() : line;
        const techStr = pipeIdx >= 0 ? line.slice(pipeIdx + 1).trim() : '';
        const tech    = techStr.split(/[,•·]/).map(t => t.trim()).filter(Boolean);

        // Only start a new project if this looks like a title (not just a date line)
        if (!hasDate || title.length > 5) {
          current = { title, tech, bullets: [] };
          entries.push(current);
        }
      } else {
        // For experience: role line first, then company/location line
        if (!current || current.bullets.length > 0) {
          // Start new entry
          const duration = (line.match(DATE_RE) || [])[0] || '';
          const rolePart = line.replace(DATE_RE, '').replace(/[|\-–—]+$/, '').trim();
          current = {
            role:     rolePart || line,
            company:  '',
            duration,
            location: '',
            bullets:  [],
          };
          entries.push(current);
        } else if (!current.company) {
          // Second header line = company + location + possibly date
          const duration = (line.match(DATE_RE) || [])[0] || '';
          const rest     = line.replace(DATE_RE, '').trim();
          // Split on — or | to separate company and location
          const parts = rest.split(/[—–|]/).map(p => p.trim()).filter(Boolean);
          current.company  = parts[0] || rest;
          current.location = parts[1] || '';
          if (duration && !current.duration) current.duration = duration;
        } else if (hasDate && !current.duration) {
          current.duration = (line.match(DATE_RE) || [])[0] || '';
        }
      }
    }
  }

  // Clean up: remove empty entries, cap bullets
  return entries
    .filter(e => e.bullets?.length > 0 ||
      (sectionType === 'projects' ? e.title : e.role))
    .map(e => ({
      ...e,
      bullets: (e.bullets || []).slice(0, sectionType === 'projects' ? 4 : 6),
    }));
}

// ── Parse education section ───────────────────────────────────────────────────
function parseEducationFromLines(lines, rawText) {
  if (!lines.length) {
    // Fallback: try to find degree/institution in raw text
    const degMatch  = rawText.match(/\b(b\.?tech|m\.?tech|b\.?e\.?|b\.?sc|m\.?sc|mba|phd|ph\.?d|bachelor|master)[^\n,]*/i);
    const instMatch = rawText.match(/\b(?:iit|nit|bits|iiit|snist|manit|vit|srm|manipal|amrita|anna\s+university|[a-z]+\s+(?:university|institute|college))[^\n,]*/i);
    if (degMatch || instMatch) {
      return [{
        degree:      degMatch  ? degMatch[0].trim()  : 'B.Tech',
        institution: instMatch ? instMatch[0].trim() : '',
        year:        '',
        gpa:         '',
        achievements: [],
      }];
    }
    return [];
  }

  const DATE_RE = /\b(?:jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)[a-z]*[\s.,]+\d{4}|\b\d{4}\s*[-–]\s*(?:\d{4}|present|current)\b/i;
  const GPA_RE  = /(?:gpa|cgpa|cpi|percentage)[:\s]+(\d+\.?\d*)/i;

  const entries = [];
  let current   = null;

  for (const rawLine of lines) {
    const line = rawLine.trim();
    if (!line || line.length < 3) continue;

    const gpaMatch  = line.match(GPA_RE);
    const dateMatch = line.match(DATE_RE);
    const isBullet  = BULLET_MARKERS_RE.test(line) || STARTS_WITH_VERB_RE.test(line);

    if (isBullet) {
      if (current) {
        const clean = line.replace(/^[•\-*\s]+/, '').trim();
        if (clean) current.achievements.push(clean);
      }
    } else if (gpaMatch) {
      if (current) current.gpa = gpaMatch[1];
    } else {
      // Degree / institution / year header line
      const isDegree = /\b(b\.?tech|m\.?tech|b\.?e|b\.?sc|m\.?sc|mba|phd|bachelor|master|diploma)\b/i.test(line);
      const isInst   = /\b(university|institute|college|school|iit|nit|bits|iiit|snist|manit)\b/i.test(line);

      if (isDegree || (!current && isInst)) {
        if (current) entries.push(current);
        const duration = (line.match(DATE_RE) || [])[0] || '';
        current = {
          degree:       line.replace(DATE_RE, '').trim(),
          institution:  '',
          year:         duration,
          gpa:          '',
          achievements: [],
        };
      } else if (current && !current.institution && (isInst || !dateMatch)) {
        current.institution = line.replace(DATE_RE, '').trim();
        if (dateMatch && !current.year) current.year = dateMatch[0];
      } else if (current && dateMatch && !current.year) {
        current.year = dateMatch[0];
      } else if (!current) {
        // First line in edu section — treat as degree even without keyword
        const duration = (line.match(DATE_RE) || [])[0] || '';
        current = {
          degree:       line.replace(DATE_RE, '').trim(),
          institution:  '',
          year:         duration,
          gpa:          '',
          achievements: [],
        };
      }
    }
  }
  if (current) entries.push(current);
  return entries;
}

module.exports = { extractTextFromFile, parseResumeText, isLikelyResume, extractResumeJson };