const puppeteer = require("puppeteer");
const path = require("path");
const fs = require("fs");

function buildResumeHTML(data) {
  const skillsHTML = `
    ${data.skills?.technical?.length ? `<div class="skill-group"><span class="skill-label">Technical:</span> ${data.skills.technical.join(" • ")}</div>` : ""}
    ${data.skills?.tools?.length ? `<div class="skill-group"><span class="skill-label">Tools:</span> ${data.skills.tools.join(" • ")}</div>` : ""}
    ${data.skills?.soft?.length ? `<div class="skill-group"><span class="skill-label">Soft Skills:</span> ${data.skills.soft.join(" • ")}</div>` : ""}
  `;

  const educationHTML = (data.education || [])
    .map(
      (edu) => `
    <div class="entry">
      <div class="entry-header">
        <div>
          <div class="entry-title">${edu.degree || ""}</div>
          <div class="entry-subtitle">${edu.institution || ""}</div>
        </div>
        <div class="entry-date">${edu.year || ""}</div>
      </div>
      ${edu.gpa ? `<div class="entry-meta">GPA: ${edu.gpa}</div>` : ""}
      ${(edu.achievements || []).map((a) => `<div class="bullet">• ${a}</div>`).join("")}
    </div>
  `,
    )
    .join("");

  const experienceHTML = (data.experience || [])
    .map(
      (exp) => `
    <div class="entry">
      <div class="entry-header">
        <div>
          <div class="entry-title">${exp.role || ""}</div>
          <div class="entry-subtitle">${exp.company || ""}${exp.location ? " — " + exp.location : ""}</div>
        </div>
        <div class="entry-date">${exp.duration || ""}</div>
      </div>
      ${(exp.bullets || []).map((b) => `<div class="bullet">• ${b}</div>`).join("")}
    </div>
  `,
    )
    .join("");

  const projectsHTML = (data.projects || [])
    .map(
      (proj) => `
    <div class="entry">
      <div class="entry-header">
        <div>
          <div class="entry-title">${proj.title || ""}</div>
          ${proj.tech?.length ? `<div class="entry-subtitle">${proj.tech.join(" • ")}</div>` : ""}
        </div>
      </div>
      ${(proj.bullets || []).map((b) => `<div class="bullet">• ${b}</div>`).join("")}
    </div>
  `,
    )
    .join("");

  const certsHTML = (data.certifications || []).map((c) => `<div class="bullet">• ${c}</div>`).join("");
  const achievementsHTML = (data.achievements || []).map((a) => `<div class="bullet">• ${a}</div>`).join("");

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8" />
<style>
  * { margin: 0; padding: 0; box-sizing: border-box; }
  body { font-family: 'Georgia', 'Times New Roman', serif; font-size: 11px; color: #1a1a1a; background: white; padding: 36px 44px; line-height: 1.5; }
  
  .header { text-align: center; margin-bottom: 18px; border-bottom: 2px solid #1a1a1a; padding-bottom: 12px; }
  .name { font-size: 24px; font-weight: bold; letter-spacing: 2px; text-transform: uppercase; margin-bottom: 6px; }
  .contact { font-size: 10px; color: #444; display: flex; gap: 14px; justify-content: center; flex-wrap: wrap; }
  .contact span::before { content: ''; }

  .section { margin-bottom: 16px; }
  .section-title { font-size: 12px; font-weight: bold; text-transform: uppercase; letter-spacing: 1.5px; border-bottom: 1px solid #333; padding-bottom: 3px; margin-bottom: 10px; color: #111; }
  
  .summary-text { font-size: 10.5px; color: #333; line-height: 1.6; }

  .skill-group { margin-bottom: 4px; font-size: 10.5px; }
  .skill-label { font-weight: bold; }

  .entry { margin-bottom: 12px; }
  .entry-header { display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 3px; }
  .entry-title { font-weight: bold; font-size: 11px; }
  .entry-subtitle { font-style: italic; font-size: 10.5px; color: #444; }
  .entry-date { font-size: 10px; color: #555; white-space: nowrap; margin-left: 10px; }
  .entry-meta { font-size: 10px; color: #666; margin-bottom: 3px; }
  .bullet { font-size: 10.5px; color: #222; margin-top: 3px; padding-left: 4px; line-height: 1.55; }

  @media print { body { padding: 28px 36px; } }
</style>
</head>
<body>

<div class="header">
  <div class="name">${data.name || "Name"}</div>
  <div class="contact">
    ${data.email ? `<span>${data.email}</span>` : ""}
    ${data.phone ? `<span>${data.phone}</span>` : ""}
    ${data.linkedin ? `<span>${data.linkedin}</span>` : ""}
    ${data.github ? `<span>${data.github}</span>` : ""}
  </div>
</div>

${
  data.summary
    ? `
<div class="section">
  <div class="section-title">Professional Summary</div>
  <div class="summary-text">${data.summary}</div>
</div>`
    : ""
}

${
  data.skills && (data.skills.technical?.length || data.skills.tools?.length)
    ? `
<div class="section">
  <div class="section-title">Skills</div>
  ${skillsHTML}
</div>`
    : ""
}

${
  data.experience?.length
    ? `
<div class="section">
  <div class="section-title">Experience</div>
  ${experienceHTML}
</div>`
    : ""
}

${
  data.projects?.length
    ? `
<div class="section">
  <div class="section-title">Projects</div>
  ${projectsHTML}
</div>`
    : ""
}

${
  data.education?.length
    ? `
<div class="section">
  <div class="section-title">Education</div>
  ${educationHTML}
</div>`
    : ""
}

${
  data.certifications?.length
    ? `
<div class="section">
  <div class="section-title">Certifications</div>
  ${certsHTML}
</div>`
    : ""
}

${
  data.achievements?.length
    ? `
<div class="section">
  <div class="section-title">Achievements</div>
  ${achievementsHTML}
</div>`
    : ""
}

</body>
</html>`;
}

async function generatePDF(resumeData, outputPath) {
  const html = buildResumeHTML(resumeData);

  const browser = await puppeteer.launch({
    executablePath: "/opt/render/.cache/puppeteer/chrome/linux-127.0.6533.88/chrome-linux64/chrome",
    args: ["--no-sandbox", "--disable-setuid-sandbox"],
    headless: "new",
  });

  try {
    const page = await browser.newPage();
    await page.setContent(html, { waitUntil: "networkidle0" });
    await page.pdf({
      path: outputPath,
      format: "A4",
      printBackground: true,
      margin: { top: "0", right: "0", bottom: "0", left: "0" },
    });
  } finally {
    await browser.close();
  }

  return outputPath;
}

module.exports = { generatePDF, buildResumeHTML };
