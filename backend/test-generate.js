// backend/test-generate.js
const { generatePDF } = require("./src/services/pdfService");
const sample = require("./sample-optimized-resume.json"); // create a small sample
generatePDF(sample, "./uploads/pdfs/test-output.pdf")
  .then(() => console.log("PDF generated"))
  .catch(e => console.error(e));