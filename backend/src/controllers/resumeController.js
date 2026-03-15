const { v4: uuidv4 } = require("uuid");
const path = require("path");
const fs = require("fs");
const Resume = require("../models/Resume");
const { extractTextFromFile } = require("../services/parseService");
const { calculateATSScore } = require("../services/atsService");
const { optimizeResume, getFullAIAnalysis } = require("../services/aiService");
const { generatePDF } = require("../services/pdfService");

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
      isPaid: true, // testing phase
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
// ✅ Pure deterministic — zero Gemini API calls
const analyzeResume = async (req, res) => {
  try {
    const { resumeId } = req.body;

    if (!resumeId) {
      return res.status(400).json({ success: false, message: "resumeId is required" });
    }

    const resume = await Resume.findOne({ resumeId });
    if (!resume) {
      return res.status(404).json({ success: false, message: "Resume not found" });
    }

    // 1. Extract text
    const text = await extractTextFromFile(resume.originalFilePath, "");
    resume.originalText = text;

    // 2. Deterministic ATS scoring only — no AI
    const atsResult = calculateATSScore(text, req.body.jobDescription || null);
    resume.atsScore = atsResult.totalScore;
    resume.scoreBreakdown = atsResult.scoreBreakdown;
    resume.freeAnalysis = atsResult.freeAnalysis;
    resume.fullAnalysis = {}; // stays empty until user pays and optimize runs

    await resume.save();

    console.log(`[analyze] resumeId=${resumeId} score=${resume.atsScore} (no AI used)`);

    res.json({
      success: true,
      resumeId,
      atsScore: resume.atsScore,
      scoreBreakdown: resume.scoreBreakdown,
      freeAnalysis: resume.freeAnalysis,
    });
  } catch (err) {
    console.error("Analyze Process Crash:", err);
    res.status(500).json({ success: false, message: "Internal Server Error during analysis" });
  }
};

// POST /api/resume/optimize
// 🔒 Gemini runs HERE only — after payment
const optimizeResumeHandler = async (req, res) => {
  try {
    const { resumeId } = req.body;

    const resume = await Resume.findOne({ resumeId });
    if (!resume) {
      return res.status(404).json({ success: false, message: "Resume not found" });
    }

    console.log(`[optimize] resumeId=${resumeId} — calling Gemini...`);

    // 1. AI full analysis (for the detailed report shown on OptimizedPage)
    let fullAnalysis = {};
    try {
      fullAnalysis = await getFullAIAnalysis(resume.originalText, resume.atsScore, resume.scoreBreakdown);
    } catch (aiErr) {
      console.error("AI Analysis Error:", aiErr.message);
      fullAnalysis = { error: "AI analysis unavailable", score: resume.atsScore };
    }
    resume.fullAnalysis = fullAnalysis;

    // 2. AI optimization → structured JSON for PDF
    const optimizedJson = await optimizeResume(resume.originalText);
    resume.optimizedResumeJson = optimizedJson;

    // 3. Generate PDF
    const pdfDir = path.join(__dirname, "../../uploads/pdfs");
    if (!fs.existsSync(pdfDir)) fs.mkdirSync(pdfDir, { recursive: true });
    const pdfPath = path.join(pdfDir, `${resumeId}-optimized.pdf`);

    await generatePDF(optimizedJson, pdfPath);
    resume.optimizedResumePdfPath = pdfPath;

    await resume.save();

    console.log(`[optimize] resumeId=${resumeId} — done`);

    res.json({
      success: true,
      resumeId,
      fullAnalysis,
      optimizedResumeJson: optimizedJson,
      downloadUrl: `/api/resume/download/${resumeId}`,
    });
  } catch (err) {
    console.error("Optimization Error:", err);
    res.status(500).json({ success: false, message: "Optimization failed" });
  }
};

// GET /api/resume/download/:resumeId
const downloadResume = async (req, res) => {
  try {
    const resume = await Resume.findOne({ resumeId: req.params.resumeId });
    if (!resume || !resume.optimizedResumePdfPath) {
      return res.status(404).send("File not found");
    }
    res.download(resume.optimizedResumePdfPath, "optimized-resume.pdf");
  } catch (err) {
    res.status(500).send("Download error");
  }
};

// GET /api/resume/status/:resumeId
const getResumeStatus = async (req, res) => {
  try {
    const resume = await Resume.findOne({ resumeId: req.params.resumeId });
    if (!resume) {
      return res.status(404).json({ success: false, message: "Not found" });
    }
    res.json({ success: true, ...resume._doc });
  } catch (err) {
    res.status(500).json({ success: false });
  }
};

module.exports = {
  uploadResume,
  analyzeResume,
  optimizeResumeHandler,
  downloadResume,
  getResumeStatus,
};
