const { GoogleGenerativeAI } = require("@google/generative-ai");
require("dotenv").config();

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash" });

// ── Robust JSON parser ────────────────────────────────────────────────────────
const parseAIResponse = (rawText) => {
  try {
    const cleaned = rawText.replace(/```json/gi, "").replace(/```/g, "").trim();
    const jsonMatch = cleaned.match(/\{[\s\S]*\}/);
    if (!jsonMatch) throw new Error("No JSON object found in response");
    return JSON.parse(jsonMatch[0]);
  } catch (err) {
    console.error("AI JSON parse failed. Raw output:\n", rawText.slice(0, 500));
    throw new Error("AI returned invalid JSON: " + err.message);
  }
};

// ── Full AI Analysis ──────────────────────────────────────────────────────────
// Used in the JD match flow to generate the analysis report.
async function getFullAIAnalysis(resumeText, atsScore, scoreBreakdown) {
  const prompt = `You are an expert ATS resume analyst. Analyze this resume and return ONLY valid JSON with no markdown.

Resume:
"""
${resumeText.slice(0, 5000)}
"""

ATS Score: ${atsScore}/100
Breakdown: Keywords ${scoreBreakdown.keywords}/35 | Experience ${scoreBreakdown.experience}/25 | Formatting ${scoreBreakdown.formatting}/25 | Skills ${scoreBreakdown.skills}/15

Return exactly this structure:
{
  "overallFeedback": "2-3 sentence honest assessment of this specific resume",
  "topStrengths": ["specific strength from the resume", "specific strength", "specific strength"],
  "criticalIssues": ["specific issue found", "specific issue found", "specific issue found"],
  "keywordSuggestions": ["keyword1", "keyword2", "keyword3", "keyword4", "keyword5"],
  "bulletImprovements": [
    { "original": "exact bullet text from resume", "improved": "rewritten with power verb + metric + context" },
    { "original": "exact bullet text from resume", "improved": "rewritten with power verb + metric + context" },
    { "original": "exact bullet text from resume", "improved": "rewritten with power verb + metric + context" }
  ],
  "skillsToAdd": ["skill1", "skill2", "skill3"],
  "industryMatch": "target role or industry this resume is aimed at",
  "score": ${atsScore}
}`;

  try {
    const result = await model.generateContent(prompt);
    return parseAIResponse(result.response.text());
  } catch (err) {
    console.error("getFullAIAnalysis error:", err.message);
    throw err;
  }
}

// ── JD Bullet Rewriter ────────────────────────────────────────────────────────
// Takes specific bullets + missing JD keywords and rewrites only those bullets.
// Tiny contained task — highly reliable, minimal hallucination risk.
async function rewriteBulletsForJD(bulletsToImprove, missingKeywords, jobTitle) {
  if (!bulletsToImprove?.length || !missingKeywords?.length) return [];

  const bulletList = bulletsToImprove
    .slice(0, 4)
    .map((b, i) => `${i + 1}. "${b}"`)
    .join("\n");

  const kwList = missingKeywords.slice(0, 6).join(", ");

  const prompt = `You are a resume bullet point editor. Rewrite each bullet to naturally include relevant keywords for a ${jobTitle || "software engineering"} role.

KEYWORDS TO INCLUDE (use only what fits naturally — do not force all of them):
${kwList}

BULLETS TO REWRITE:
${bulletList}

STRICT RULES — READ CAREFULLY:
✗ NEVER mention a technology, framework, or tool not already in the bullet or implied by it
✗ NEVER add "Spring Boot", "React", "Kafka", or any specific tech unless it is ALREADY in the bullet
✗ NEVER invent metrics, company names, or project outcomes
✓ You may ADD a keyword only if the bullet already describes the CONCEPT that keyword represents
  Example: bullet says "built REST endpoint" → OK to add "REST API"
  Example: bullet says "improved task delegation" → NOT OK to add "Spring Boot"
✓ Keep the core achievement — only add keyword context around what already exists
✓ Max 20 words per bullet
✓ Start with a strong action verb
✓ Use N+ format for approximate numbers (e.g. "500+ users", "15+ events")

Return ONLY a valid JSON array — no markdown, no extra text:
[
  { "original": "exact original bullet text", "improved": "rewritten bullet" },
  { "original": "exact original bullet text", "improved": "rewritten bullet" }
]`;

  try {
    const result = await model.generateContent(prompt);
    const raw = result.response.text().replace(/```json/gi, "").replace(/```/g, "").trim();
    const arrMatch = raw.match(/\[[\s\S]*\]/);
    if (!arrMatch) throw new Error("No JSON array found");
    const parsed = JSON.parse(arrMatch[0]);
    console.log(`[aiService] rewriteBulletsForJD — rewrote ${parsed.length} bullets`);
    return parsed;
  } catch (err) {
    console.error("rewriteBulletsForJD error:", err.message);
    // Fallback: return originals unchanged so flow doesn't break
    return bulletsToImprove.map(b => ({ original: b, improved: b }));
  }
}

module.exports = { getFullAIAnalysis, rewriteBulletsForJD };