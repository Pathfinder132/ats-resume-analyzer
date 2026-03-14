const { v4: uuidv4 } = require("uuid");
const path = require("path");
const fs = require("fs");
const Resume = require("../models/Resume");
const { extractTextFromFile } = require("../services/parseService");
const { calculateATSScore } = require("../services/atsService");
const { getFullAIAnalysis, optimizeResume } = require("../services/aiService");
const { generatePDF } = require("../services/pdfService");

// POST /api/resume/upload
const uploadResume = async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ success: false, message: "No file uploaded" });

    const resumeId = uuidv4();
    const resume = new Resume({
      resumeId,
      originalFileName: req.file.originalname,
      originalFilePath: req.file.path,
      sessionId: req.body.sessionId || resumeId,
      userId: req.user?.id || null,
      isPaid: true,
      // Initialize with empty objects to satisfy Mongoose "required: true" validation
      fullAnalysis: {},
      scoreBreakdown: { formatting: 0, keywords: 0, skills: 0, experience: 0 },
    });

    await resume.save();
    res.json({ success: true, resumeId, message: "Resume uploaded successfully" });
  } catch (err) {
    console.error("Upload Error:", err.message);
    res.status(500).json({ success: false, message: "Upload failed" });
  }
};

// POST /api/resume/analyze
const analyzeResume = async (req, res) => {
  try {
    const { resumeId } = req.body;
    const resume = await Resume.findOne({ resumeId });
    if (!resume) return res.status(404).json({ success: false, message: "Resume not found" });

    // 1. Text Extraction
    const text = await extractTextFromFile(resume.originalFilePath, "");
    resume.originalText = text;

    // 2. Deterministic ATS Score
    const atsResult = calculateATSScore(text);
    resume.atsScore = atsResult.totalScore;
    resume.scoreBreakdown = atsResult.scoreBreakdown;
    resume.freeAnalysis = atsResult.freeAnalysis;

    // 3. AI Deep Analysis (Defensive call)
    try {
      console.log("Calling Gemini 2.5-flash for Analysis...");
      const aiData = await getFullAIAnalysis(text, resume.atsScore, resume.scoreBreakdown);
      resume.fullAnalysis = aiData;
    } catch (aiErr) {
      console.error("AI Service Error:", aiErr.message);
      // Fallback so the database save still works
      resume.fullAnalysis = { error: "AI temporarily busy", score: resume.atsScore };
    }

    await resume.save();
    res.json({
      success: true,
      resumeId,
      atsScore: resume.atsScore,
      fullAnalysis: resume.fullAnalysis,
    });
  } catch (err) {
    console.error("Analyze Process Crash:", err);
    res.status(500).json({ success: false, message: "Internal Server Error during analysis" });
  }
};

// POST /api/resume/optimize
const optimizeResumeHandler = async (req, res) => {
  try {
    const { resumeId } = req.body;
    const resume = await Resume.findOne({ resumeId });
    if (!resume) return res.status(404).json({ success: false, message: "Resume not found" });

    // AI Optimization
    const optimizedJson = await optimizeResume(resume.originalText);
    resume.optimizedResumeJson = optimizedJson;

    // PDF Generation
    const pdfDir = path.join(__dirname, "../../uploads/pdfs");
    if (!fs.existsSync(pdfDir)) fs.mkdirSync(pdfDir, { recursive: true });
    const pdfPath = path.join(pdfDir, `${resumeId}-optimized.pdf`);

    await generatePDF(optimizedJson, pdfPath);
    resume.optimizedResumePdfPath = pdfPath;

    await resume.save();
    res.json({
      success: true,
      resumeId,
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
    if (!resume || !resume.optimizedResumePdfPath) return res.status(404).send("File not found");
    res.download(resume.optimizedResumePdfPath, "optimized-resume.pdf");
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

module.exports = { uploadResume, analyzeResume, optimizeResumeHandler, downloadResume, getResumeStatus };
