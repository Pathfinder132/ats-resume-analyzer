const { GoogleGenerativeAI } = require("@google/generative-ai");
require("dotenv").config();

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash" });

const parseAIResponse = (rawText) => {
  try {
    const cleaned = rawText
      .replace(/```json/g, "")
      .replace(/```/g, "")
      .trim();

    const jsonMatch = cleaned.match(/\{[\s\S]*\}/);
    if (!jsonMatch) throw new Error("No JSON found");

    return JSON.parse(jsonMatch[0]);
  } catch (err) {
    console.error("AI JSON parse failed:", rawText);
    throw err;
  }
};

async function analyzeAndOptimizeResume(resumeText, atsScore) {
  try {
    const prompt = `
You are an ATS resume expert.

Tasks:
1. Briefly analyze the resume strengths and issues.
2. Improve the resume for ATS by:
   - adding metrics where possible
   - using strong action verbs
   - improving clarity
   - keeping all original roles/projects

Rules:
- do NOT invent jobs or companies
- keep chronology unchanged
- keep resume realistic
- output ONLY JSON

ATS Score: ${atsScore}

Resume:
"""
${resumeText.slice(0, 6000)}
"""

Return JSON:

{
 "analysis": {
   "overallFeedback": "string",
   "topStrengths": ["string"],
   "criticalIssues": ["string"],
   "keywordSuggestions": ["string"]
 },
 "optimizedResume": {
   "name": "",
   "email": "",
   "phone": "",
   "linkedin": "",
   "github": "",
   "summary": "",
   "education": [],
   "skills": { "technical": [], "tools": [], "soft": [] },
   "experience": [],
   "projects": [],
   "certifications": [],
   "achievements": []
 }
}
`;

    const result = await model.generateContent(prompt);

    return parseAIResponse(result.response.text());
  } catch (error) {
    console.error("Gemini error:", error.message);
    throw error;
  }
}

module.exports = { analyzeAndOptimizeResume };
