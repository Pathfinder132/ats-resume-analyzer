const mongoose = require("mongoose");

const ResumeSchema = new mongoose.Schema(
  {
    resumeId: { type: String, required: true, unique: true },
    originalFileName: { type: String, required: true },
    originalFilePath: { type: String, required: true },
    originalText: { type: String },
    atsScore: { type: Number, default: 0 },
    optimizedAtsScore: { type: Number, default: null },
    resumeJson: { type: Object, default: null }, // structured JSON extracted at analyze time

    scoreBreakdown: { type: Object },
    freeAnalysis: { type: Object },

    fullAnalysis: { type: Object, default: {} },
    optimizedResumeJson: { type: Object },
    optimizedResumePdfPath: { type: String },
    jdMatchPdfPath: { type: String },
    isPaid: { type: Boolean, default: false },
    sessionId: { type: String },
    userId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: false },
  },
  { timestamps: true },
);

module.exports = mongoose.model("Resume", ResumeSchema);