const { v4: uuidv4 } = require("uuid");
const path = require("path");
const fs = require("fs");
const Resume = require("../models/Resume");
const { extractTextFromFile, parseResumeText } = require("../services/parseService");
const { calculateATSScore } = require("../services/atsService");
const { rewriteBulletsForJD } = require("../services/aiService");
const { generatePDF } = require("../services/pdfService");
const { words: tokenize } = require("../services/textUtils");

// POST /api/resume/upload
const uploadResume = async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ success: false, message: "No file uploaded" });
    }
    const resumeId = uuidv4();
    const resume = new Resume({
      resumeId,
      originalFileName: req.file.originalname,
      originalFilePath: req.file.path,
      sessionId: req.body.sessionId || resumeId,
      userId: req.user?.id || null,
      isPaid: true, // ⚠️ testing — set false in production
      fullAnalysis: {},
      scoreBreakdown: { formatting: 0, keywords: 0, skills: 0, experience: 0 },
    });
    await resume.save();
    res.json({ success: true, resumeId, message: "Resume uploaded successfully" });
  } catch (err) {
    console.error("Upload Error:", err);
    res.status(500).json({ success: false, message: "Upload failed" });
  }
};

// POST /api/resume/analyze
// Deterministic ATS scoring + Gemini structured extraction (saved for JD matching later)
const analyzeResume = async (req, res) => {
  try {
    const { resumeId } = req.body;
    if (!resumeId) return res.status(400).json({ success: false, message: "resumeId is required" });

    const resume = await Resume.findOne({ resumeId });
    if (!resume) return res.status(404).json({ success: false, message: "Resume not found" });

    const text = await extractTextFromFile(resume.originalFilePath, "");
    resume.originalText = text;

    // 1. Deterministic ATS scoring
    const atsResult       = calculateATSScore(text, req.body.jobDescription || null);
    resume.atsScore       = atsResult.totalScore;
    resume.scoreBreakdown = atsResult.scoreBreakdown;
    resume.freeAnalysis   = atsResult.freeAnalysis;
    resume.fullAnalysis   = {};

    await resume.save();
    console.log(`[analyze] resumeId=${resumeId} score=${resume.atsScore}`);

    res.json({
      success: true,
      resumeId,
      atsScore:       resume.atsScore,
      scoreBreakdown: resume.scoreBreakdown,
      freeAnalysis:   resume.freeAnalysis,
    });
  } catch (err) {
    console.error("Analyze Process Crash:", err);
    res.status(500).json({ success: false, message: "Internal Server Error during analysis" });
  }
};

// POST /api/resume/match-jd
// Paid feature (₹29) — deterministic keyword match + AI bullet rewrites + tailored PDF
const matchJD = async (req, res) => {
  try {
    const { resumeId, jobDescription, jobTitle } = req.body;
    if (!resumeId || !jobDescription) {
      return res.status(400).json({ success: false, message: "resumeId and jobDescription are required" });
    }

    const resume = await Resume.findOne({ resumeId });
    if (!resume) return res.status(404).json({ success: false, message: "Resume not found" });
    if (!resume.originalText) return res.status(400).json({ success: false, message: "Resume not analyzed yet" });

    console.log(`[match-jd] resumeId=${resumeId} jobTitle="${jobTitle || "unknown"}"`);

    // ── Phase 1: Deterministic keyword analysis ──────────────────────────────
    const STOPWORDS = new Set([
      "the","and","for","with","that","this","are","was","were","has","have",
      "from","into","will","our","your","you","we","they","their","its","it",
      "be","to","of","in","a","an","is","or","on","at","by","as","up","do",
      "if","so","not","but","can","all","one","any","who","how","when","what",
      "which","also","than","then","both","over","such","each","would","could",
      "should","may","must","per","via","etc","about","after","within","across",
      "between","through","during","while","where","well","experience","work",
      "role","team","strong","good","ability","skills","knowledge","looking",
      "required","preferred","plus","year","years","using","used","able","join",
    ]);

    // Skills present in resume
    const atsResult    = calculateATSScore(resume.originalText, jobDescription);
    const evidence     = atsResult.freeAnalysis._evidence;
    const resumeSkills = new Set(evidence.matchedSkills || []);

    // Skills the JD asks for
    const jdAtsResult = calculateATSScore(jobDescription);
    const jdSkills    = new Set(jdAtsResult.freeAnalysis._evidence?.matchedSkills || []);

    // JD raw tokens for relevant bullet detection
    const jdTokens = new Set(
      tokenize(jobDescription).filter(t => t.length >= 4 && !STOPWORDS.has(t))
    );

    const youHave    = [...jdSkills].filter(s => resumeSkills.has(s));
    const youMissing = [...jdSkills].filter(s => !resumeSkills.has(s));
    const originalMatchPct = jdSkills.size > 0
      ? Math.round((youHave.length / jdSkills.size) * 100)
      : 0;

    // Bullets to improve — exp/project bullets that don't yet have missing keywords
    const parsed = parseResumeText(resume.originalText);
    const allExpProjBullets = parsed.bullets.filter(b =>
      b.section !== 'education' &&
      /experience|project|internship|position/i.test(b.section || '')
    );

    // Prefer bullets with some JD context already
    let bulletsToImprove = allExpProjBullets
      .filter(b => {
        const bWords = new Set(tokenize(b.text));
        return [...jdTokens].some(t => bWords.has(t));
      })
      .map(b => b.text)
      .slice(0, 4);

    // Fallback: take first exp bullets if none match
    if (bulletsToImprove.length === 0) {
      bulletsToImprove = allExpProjBullets.map(b => b.text).slice(0, 3);
    }

    // Relevant bullets (already match JD) — shown in UI
    const relevantBullets = allExpProjBullets
      .filter(b => {
        const bWords = new Set(tokenize(b.text));
        return [...jdTokens].some(t => bWords.has(t));
      })
      .map(b => b.text)
      .slice(0, 5);

    // ── Phase 2: AI rewrites targeted bullets ────────────────────────────────
    let rewrittenBullets = [];
    if (youMissing.length > 0 && bulletsToImprove.length > 0) {
      rewrittenBullets = await rewriteBulletsForJD(
        bulletsToImprove,
        youMissing.slice(0, 5),
        jobTitle || ""
      );
    }

    // ── Recompute match % after tailoring ────────────────────────────────────
    // Build a mini text of the improved bullets + original skills to rescore
    const improvedBulletsText = rewrittenBullets.map(b => b.improved).join("\n");
    const tailoredText = resume.originalText + "\n" + improvedBulletsText;
    const tailoredAts  = calculateATSScore(tailoredText, jobDescription);
    const tailoredEvidence = tailoredAts.freeAnalysis._evidence;
    const tailoredSkills = new Set(tailoredEvidence.matchedSkills || []);
    const tailoredHave  = [...jdSkills].filter(s => tailoredSkills.has(s));
    const tailoredMatchPct = jdSkills.size > 0
      ? Math.round((tailoredHave.length / jdSkills.size) * 100)
      : originalMatchPct;

    // ── Phase 3: Generate tailored PDF ───────────────────────────────────────
    const baseJson     = buildBasicJson(resume, parsed);
    const tailoredJson = swapBullets(baseJson, rewrittenBullets);

    const pdfDir  = path.join(__dirname, "../../uploads/pdfs");
    if (!fs.existsSync(pdfDir)) fs.mkdirSync(pdfDir, { recursive: true });
    const pdfPath = path.join(pdfDir, `${resumeId}-jd-${Date.now()}.pdf`);

    await generatePDF(tailoredJson, pdfPath);
    resume.jdMatchPdfPath = pdfPath;
    await resume.save();

    console.log(`[match-jd] done — original: ${originalMatchPct}% → tailored: ${tailoredMatchPct}%, rewrote: ${rewrittenBullets.length} bullets`);

    res.json({
      success:            true,
      resumeId,
      jobTitle:           jobTitle || null,
      matchPercentage:    originalMatchPct,
      tailoredMatchPct,
      improvement:        tailoredMatchPct - originalMatchPct,
      keywordsYouHave:    youHave,
      keywordsMissing:    youMissing,
      relevantBullets,
      rewrittenBullets,
      downloadUrl:        `/api/resume/download-jd/${resumeId}`,
    });
  } catch (err) {
    console.error("Match JD Error:", err);
    res.status(500).json({ success: false, message: "JD matching failed: " + err.message });
  }
};

// GET /api/resume/download-jd/:resumeId
const downloadJdResume = async (req, res) => {
  try {
    const resume = await Resume.findOne({ resumeId: req.params.resumeId });
    if (!resume || !resume.jdMatchPdfPath) return res.status(404).send("File not found");
    res.download(resume.jdMatchPdfPath, "tailored-resume.pdf");
  } catch (err) {
    res.status(500).send("Download error");
  }
};

// GET /api/resume/status/:resumeId
const getResumeStatus = async (req, res) => {
  try {
    const resume = await Resume.findOne({ resumeId: req.params.resumeId });
    if (!resume) return res.status(404).json({ success: false, message: "Not found" });
    res.json({ success: true, ...resume._doc });
  } catch (err) {
    res.status(500).json({ success: false });
  }
};

// Fallback: build basic JSON from parsed text (used for JD-tailored PDF)
function buildBasicJson(resume, parsed) {
  const contact  = parsed.contact;
  const sections = parsed.sections;
  const rawText  = resume.originalText;
  const rawLines = rawText.split("\n").map(l => l.trim()).filter(Boolean);

  // ── Skills ───────────────────────────────────────────────────────────────
  // Grab ALL lines from the skills section and split by every common delimiter.
  // Don't try to categorise — just preserve everything.
  const skillsLines = [];
  for (const [sec, lines] of Object.entries(sections)) {
    if (/skill|technolog|competenc/i.test(sec)) skillsLines.push(...lines);
  }

  // Split by bullets, pipes, commas — handles "C++ • Python • Java" style
  const allSkillTokens = skillsLines
    .join(" | ")
    .split(/[,•·|\/]/)
    .map(s => s.trim())
    .filter(s => s.length > 1 && !/^(technical|tools?|soft|languages?|frameworks?|libraries)$/i.test(s));

  // Separate into technical vs tools by looking for tool-like keywords
  const TOOL_KEYWORDS = /^(git|github|gitlab|vs\s?code|docker|kubernetes|jira|figma|postman|linux|windows|macos|eclipse|intellij|pycharm|vim|bash|zsh)/i;
  const technical = allSkillTokens.filter(s => !TOOL_KEYWORDS.test(s));
  const tools     = allSkillTokens.filter(s => TOOL_KEYWORDS.test(s));

  // ── Experience ────────────────────────────────────────────────────────────
  const experience = [];
  for (const [sec, lines] of Object.entries(sections)) {
    if (!/experience|employment|internship|position/i.test(sec)) continue;
    let current = null;
    for (const line of lines) {
      const isBullet = /^[•\-*]/.test(line) || parsed.bullets.some(b => b.text === line);
      if (!isBullet && line.length > 3 && line.length < 80) {
        if (current) experience.push(current);
        current = {
          role:     line.replace(/\|.*$/, '').trim(),
          company:  "",
          duration: "",
          location: "",
          bullets:  [],
        };
      } else if (current && isBullet) {
        const b = line.replace(/^[•\-*\s]+/, '').trim();
        if (b) current.bullets.push(b);
      }
    }
    if (current) experience.push(current);
  }

  // ── Projects ──────────────────────────────────────────────────────────────
  const projects = [];
  for (const [sec, lines] of Object.entries(sections)) {
    if (!/project|portfolio/i.test(sec)) continue;
    let current = null;
    for (const line of lines) {
      const isBullet = /^[•\-*]/.test(line) || parsed.bullets.some(b => b.text === line);
      if (!isBullet && line.length > 2 && line.length < 100) {
        if (current) projects.push(current);
        const parts = line.split(/[|•]/).map(p => p.trim());
        current = {
          title: parts[0] || line,
          tech:  (parts[1] || "").split(/[,•·]/).map(t => t.trim()).filter(Boolean),
          bullets: [],
        };
      } else if (current && isBullet) {
        const b = line.replace(/^[•\-*\s]+/, '').trim();
        if (b) current.bullets.push(b);
      }
    }
    if (current) projects.push(current);
  }

  // ── Education ─────────────────────────────────────────────────────────────
  const education = [];
  const eduLines  = sections['education'] || [];
  if (eduLines.length > 0) {
    const degMatch  = rawText.match(/\b(b\.?tech|m\.?tech|b\.?e|mba|bsc|msc|bachelor|master|ph\.?d)[^,\n]*/i);
    const instMatch = rawText.match(/\b([A-Z][a-z]+(?:\s+[A-Z][a-z]+){1,4}(?:\s+(?:University|Institute|College|School|SNIST|MANIT|IIT|NIT|BITS))[^,\n]*)/);
    const yearMatch = rawText.match(/\b(20\d{2})\s*[-–]\s*(20\d{2}|present)/i);
    const gpaMatch  = rawText.match(/(?:gpa|cgpa)[:\s]+(\d+\.?\d*)/i);
    education.push({
      degree:       degMatch  ? degMatch[0].trim()  : "B.Tech",
      institution:  instMatch ? instMatch[0].trim() : "",
      year:         yearMatch ? yearMatch[0]        : "",
      gpa:          gpaMatch  ? gpaMatch[1]         : "",
      achievements: [],
    });
  }

  // ── Summary + Certifications ──────────────────────────────────────────────
  const summaryLines = sections['summary'] || sections['professional summary'] || sections['profile'] || [];
  const certLines    = sections['certifications'] || sections['certificates'] || [];
  const certifications = certLines
    .filter(l => l.trim().length > 3)
    .map(l => l.replace(/^[•\-*\s]+/, '').trim());

  // ── Contact — extract LinkedIn/GitHub from raw text if parser missed them ─
  const linkedinMatch = rawText.match(/linkedin\.com\/in\/[a-zA-Z0-9\-_]+/i);
  const githubMatch   = rawText.match(/github\.com\/[a-zA-Z0-9\-_]+/i);

  return {
    name:            rawLines[0] || "Candidate",
    email:           contact.email    || "",
    phone:           contact.phone    || "",
    linkedin:        contact.linkedin || (linkedinMatch ? "https://" + linkedinMatch[0] : ""),
    github:          contact.github   || (githubMatch   ? "https://" + githubMatch[0]   : ""),
    summary:         summaryLines.join(" ").trim().slice(0, 400),
    skills:          { technical, tools, soft: [] },
    experience,
    projects,
    education,
    certifications,
    achievements:    [],
  };
}

// Swap improved bullets into JSON (deep clone first)
function swapBullets(resumeJson, rewrittenBullets) {
  if (!rewrittenBullets?.length) return resumeJson;
  const json = JSON.parse(JSON.stringify(resumeJson));
  rewrittenBullets.forEach(({ original, improved }) => {
    if (!original || !improved || original === improved) return;
    const orig = original.trim();
    const swap = (arr) => arr.map(b => b.trim() === orig ? improved : b);
    (json.experience || []).forEach(e => { e.bullets = swap(e.bullets || []); });
    (json.projects   || []).forEach(p => { p.bullets = swap(p.bullets || []); });
  });
  return json;
}

module.exports = {
  uploadResume,
  analyzeResume,
  matchJD,
  downloadJdResume,
  getResumeStatus,
};