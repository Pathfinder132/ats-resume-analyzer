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

// backend/src/services/pdfService.js

const PDFDocument = require("pdfkit");

// helper to draw bullets with wrapping
function drawBullets(doc, bullets, x, y, maxWidth, lineHeight) {
  let cursorY = y;
  bullets.forEach((b) => {
    doc
      .circle(x + 5, cursorY + 6, 2)
      .fillColor("#000")
      .fill();
    doc.fillColor("#000").fontSize(10);
    const bOptions = { width: maxWidth - 20, align: "left" };
    doc.text(b, x + 14, cursorY, bOptions);
    cursorY = doc.y + lineHeight;
  });
  return cursorY;
}

function normalizeDate(d) {
  if (!d) return "";
  // if already normalized (Mon YYYY) return
  return d;
}

/**
 * generatePDF - write resume JSON to a PDF file
 * @param {Object} resume - optimized resume JSON (see your schema)
 * @param {string} outputPath - full path to write pdf
 * @returns Promise<void>
 */
function generatePDF(resume, outputPath) {
  return new Promise((resolve, reject) => {
    try {
      const doc = new PDFDocument({
        size: "A4",
        margin: 48,
      });

      // ensure parent dir exists
      const dir = path.dirname(outputPath);
      if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });

      const stream = fs.createWriteStream(outputPath);
      doc.pipe(stream);

      // fonts and styles (use built-in fonts; embed custom .ttf if you want)
      const pageWidth = doc.page.width - doc.page.margins.left - doc.page.margins.right;
      let x = doc.page.margins.left;
      let y = doc.page.margins.top;

      // Header
      doc
        .fontSize(20)
        .font("Helvetica-Bold")
        .fillColor("#000")
        .text(resume.name || "", x, y);
      doc.moveDown(0.2);
      doc.fontSize(10).font("Helvetica").fillColor("#555");
      const contact = [resume.email || "", resume.phone || "", resume.linkedin || "", resume.github || ""].filter(Boolean).join("  •  ");
      doc.text(contact, { width: pageWidth, align: "left" });

      doc.moveDown(0.6);
      doc
        .strokeColor("#e6e6e6")
        .lineWidth(1)
        .moveTo(x, doc.y)
        .lineTo(x + pageWidth, doc.y)
        .stroke();
      doc.moveDown(0.8);

      // Summary
      if (resume.summary) {
        doc.fontSize(11).font("Helvetica").fillColor("#000").text(resume.summary, { width: pageWidth, align: "left" });
        doc.moveDown(0.8);
      }

      // Two-column layout for skills (left) and experience (right)
      const colGap = 18;
      const leftColWidth = Math.round(pageWidth * 0.32);
      const rightColWidth = pageWidth - leftColWidth - colGap;

      // LEFT column: Skills, Education, Certifications, Achievements
      let leftY = doc.y;
      const leftX = x;

      // Skills
      if (resume.skills) {
        doc.fontSize(12).font("Helvetica-Bold").fillColor("#000").text("Skills", leftX, leftY);
        leftY = doc.y + 6;
        const skillLines = [];
        if (resume.skills.technical?.length) skillLines.push("Technical: " + resume.skills.technical.join(", "));
        if (resume.skills.tools?.length) skillLines.push("Tools: " + resume.skills.tools.join(", "));
        if (resume.skills.soft?.length) skillLines.push("Soft: " + resume.skills.soft.join(", "));
        skillLines.forEach((line) => {
          doc.fontSize(10).font("Helvetica").fillColor("#333").text(line, { width: leftColWidth, continued: false });
          leftY = doc.y + 4;
          doc.moveDown(0.2);
        });
        leftY = doc.y + 6;
      }

      // Education
      if (resume.education && Array.isArray(resume.education) && resume.education.length) {
        doc.fontSize(12).font("Helvetica-Bold").text("Education", leftX, leftY);
        leftY = doc.y + 6;
        resume.education.forEach((ed) => {
          doc
            .fontSize(10)
            .font("Helvetica-Bold")
            .fillColor("#000")
            .text(`${ed.degree || ""}`, { width: leftColWidth });
          doc
            .fontSize(9)
            .font("Helvetica")
            .fillColor("#333")
            .text(`${ed.institution || ""} • ${ed.year || ""}`, { width: leftColWidth });
          if (ed.achievements && ed.achievements.length) {
            ed.achievements.forEach((a) => {
              doc.fontSize(9).text("• " + a, { width: leftColWidth });
            });
          }
          doc.moveDown(0.4);
        });
        leftY = doc.y + 6;
      }

      // Certifications & Achievements (left)
      if (resume.certifications && resume.certifications.length) {
        doc.fontSize(12).font("Helvetica-Bold").text("Certifications", leftX, leftY);
        leftY = doc.y + 6;
        resume.certifications.forEach((c) => {
          doc
            .fontSize(10)
            .font("Helvetica")
            .text("• " + c, { width: leftColWidth });
        });
        leftY = doc.y + 6;
      }
      if (resume.achievements && resume.achievements.length) {
        doc.fontSize(12).font("Helvetica-Bold").text("Achievements", leftX, leftY);
        leftY = doc.y + 6;
        resume.achievements.forEach((a) => {
          doc.fontSize(10).text("• " + a, { width: leftColWidth });
        });
        leftY = doc.y + 6;
      }

      // Now RIGHT column: Experience and Projects
      let rightY = doc.page.margins.top + 80; // start below header area
      const rightX = x + leftColWidth + colGap;

      doc
        .fontSize(12)
        .font("Helvetica-Bold")
        .text("Experience", rightX, doc.page.margins.top + 60);
      rightY = doc.y + 6;

      if (resume.experience && Array.isArray(resume.experience)) {
        resume.experience.forEach((exp) => {
          // company + role + duration
          doc
            .fontSize(11)
            .font("Helvetica-Bold")
            .fillColor("#000")
            .text(`${exp.role || ""}`, rightX, rightY, { width: rightColWidth });
          // second line company + duration
          doc
            .fontSize(10)
            .font("Helvetica")
            .fillColor("#333")
            .text(`${exp.company || ""} • ${normalizeDate(exp.duration) || ""}`, { width: rightColWidth });
          doc.moveDown(0.3);
          // bullets
          const startBulY = doc.y;
          let afterBulY = drawBullets(doc, exp.bullets || [], rightX, startBulY, rightColWidth, 6);
          rightY = afterBulY + 6;
          doc.y = rightY;
        });
      }

      // Projects
      if (resume.projects && Array.isArray(resume.projects) && resume.projects.length) {
        doc.addPageIfNeeded?.(); // harmless if not present
        doc.moveDown(0.4);
        doc.fontSize(12).font("Helvetica-Bold").text("Projects", rightX);
        resume.projects.forEach((p) => {
          doc
            .fontSize(11)
            .font("Helvetica-Bold")
            .text(p.title || "", { width: rightColWidth });
          doc
            .fontSize(10)
            .font("Helvetica")
            .text((p.tech || []).join(", "), { width: rightColWidth });
          drawBullets(doc, p.bullets || [], rightX, doc.y + 4, rightColWidth, 6);
          doc.moveDown(0.6);
        });
      }

      // footer
      doc.moveDown(1.0);
      doc.fontSize(9).fillColor("#999").text(`Generated by ResumeIQ`, { align: "center" });

      doc.end();

      stream.on("finish", () => resolve());
      stream.on("error", (err) => reject(err));
    } catch (err) {
      reject(err);
    }
  });
}

module.exports = { generatePDF, buildResumeHTML };
