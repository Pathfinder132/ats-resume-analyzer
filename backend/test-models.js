require('dotenv').config();
const { GoogleGenerativeAI } = require("@google/generative-ai");

async function listModels() {
  try {
    const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
    // This hits the API to see what's actually available to YOU
    const response = await fetch(`https://generativelanguage.googleapis.com/v1/models?key=${process.env.GEMINI_API_KEY}`);
    const data = await response.json();
    
    console.log("=== AVAILABLE MODELS ===");
    data.models.forEach(m => console.log(m.name));
  } catch (e) {
    console.error("Diagnostic failed. Check your API Key.", e);
  }
}

listModels();