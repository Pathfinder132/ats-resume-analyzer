const mongoose = require("mongoose");

const ResumeSchema = new mongoose.Schema(
  {
    resumeId: { type: String, required: true, unique: true },
    originalFileName: { type: String, required: true },
    originalFilePath: { type: String, required: true },
    originalText: { type: String },
    atsScore: { type: Number, default: 0 },

    // CHANGE THESE TWO LINES:
    scoreBreakdown: { type: Object },
    freeAnalysis: { type: Object },

    fullAnalysis: { type: Object, required: true },
    optimizedResumeJson: { type: Object },
    optimizedResumePdfPath: { type: String },
    isPaid: { type: Boolean, default: false },
    sessionId: { type: String },
    userId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: false },
  },
  { timestamps: true },
);

module.exports = mongoose.model("Resume", ResumeSchema);
