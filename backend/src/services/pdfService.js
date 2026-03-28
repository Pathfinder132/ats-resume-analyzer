// backend/src/services/pdfService.js
// Single-page A4 resume generator using PDFKit.
// Designed to fit the optimized JSON on one page.

const PDFDocument = require("pdfkit");
const path = require("path");
const fs = require("fs");

const M = 40;                        // page margin
const PW = 595.28;                   // A4 width
const PH = 841.89;                   // A4 height
const CW = PW - M * 2;              // content width
const BOTTOM_LIMIT = PH - M - 20;   // stop before margin

const C = {
  black:  "#0D0D0D",
  dark:   "#1F1E1B",
  mid:    "#4A4944",
  light:  "#9B9A94",
  rule:   "#D1D0CC",
  accent: "#2D5A3D",
};

// ── helpers ────────────────────────────────────────────────────────────────────

function rule(doc, color = C.rule) {
  doc.save().strokeColor(color).lineWidth(0.5)
    .moveTo(M, doc.y).lineTo(M + CW, doc.y).stroke().restore();
}

function sectionHead(doc, title) {
  if (doc.y > BOTTOM_LIMIT) return;
  doc.moveDown(0.35);
  doc.font("Helvetica-Bold").fontSize(8).fillColor(C.dark)
    .text(title.toUpperCase(), M, doc.y, { characterSpacing: 1.3, width: CW });
  rule(doc, C.accent);
  doc.moveDown(0.25);
}

function bullet(doc, text, indent = 6) {
  if (doc.y > BOTTOM_LIMIT) return;
  const bx = M + indent;
  const bw = CW - indent;
  const ty = doc.y;
  // dot
  doc.circle(bx + 3, ty + 5, 1.5).fillColor(C.mid).fill();
  doc.font("Helvetica").fontSize(9).fillColor(C.dark)
    .text(text.trim(), bx + 10, ty, { width: bw - 10, lineGap: 1 });
}

// Draw role line: bold title left, date right on same baseline
function roleLine(doc, title, right) {
  if (doc.y > BOTTOM_LIMIT) return;
  const y = doc.y;
  doc.font("Helvetica-Bold").fontSize(9.5).fillColor(C.black)
    .text(title, M, y, { continued: false, width: CW - 90 });
  doc.font("Helvetica").fontSize(8).fillColor(C.light)
    .text(right || "", M + CW - 85, y, { width: 85, align: "right" });
}

function subLine(doc, text) {
  if (doc.y > BOTTOM_LIMIT) return;
  doc.font("Helvetica-Oblique").fontSize(8.5).fillColor(C.mid)
    .text(text, M, doc.y, { width: CW });
  doc.moveDown(0.2);
}

// ── main ───────────────────────────────────────────────────────────────────────

function generatePDF(resume, outputPath) {
  return new Promise((resolve, reject) => {
    try {
      const dir = path.dirname(outputPath);
      if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });

      const doc = new PDFDocument({
        size: "A4",
        margins: { top: M, bottom: M, left: M, right: M },
        info: {
          Title:   (resume.name || "Resume") + " — Optimized by ResumeIQ",
          Author:  resume.name || "ResumeIQ",
          Creator: "ResumeIQ",
        },
      });

      const stream = fs.createWriteStream(outputPath);
      doc.pipe(stream);

      // ── HEADER ──────────────────────────────────────────────────────────────
      doc.font("Helvetica-Bold").fontSize(18).fillColor(C.black)
        .text((resume.name || "").toUpperCase(), M, M, {
          width: CW, align: "center", characterSpacing: 2,
        });
      doc.moveDown(0.3);

      // Contact — with clickable links
      const contactItems = [];
      if (resume.email)    contactItems.push({ label: resume.email,    url: `mailto:${resume.email}` });
      if (resume.phone)    contactItems.push({ label: resume.phone,    url: null });
      if (resume.linkedin) contactItems.push({ label: "LinkedIn",       url: resume.linkedin.startsWith("http") ? resume.linkedin : `https://${resume.linkedin}` });
      if (resume.github)   contactItems.push({ label: "GitHub",         url: resume.github.startsWith("http") ? resume.github : `https://${resume.github}` });

      if (contactItems.length) {
        const sep = "  |  ";
        const contactStr = contactItems.map(c => c.label).join(sep);
        const contactY = doc.y;

        // Set font BEFORE measuring — widthOfString depends on current font
        doc.font("Helvetica").fontSize(8.5);
        const totalW = doc.widthOfString(contactStr);
        const startX = M + (CW - totalW) / 2;

        // Draw the full contact line centered
        doc.fillColor(C.mid)
          .text(contactStr, M, contactY, { width: CW, align: "center" });

        // Overlay clickable link annotations at correct x positions
        let xCursor = startX;
        contactItems.forEach((item, i) => {
          const labelW = doc.widthOfString(item.label);
          if (item.url) {
            doc.link(xCursor, contactY, labelW, 11, item.url);
          }
          xCursor += labelW;
          if (i < contactItems.length - 1) {
            xCursor += doc.widthOfString(sep);
          }
        });
      }

      doc.moveDown(0.4);
      rule(doc, C.black);
      doc.moveDown(0.5);

      // ── SUMMARY ─────────────────────────────────────────────────────────────
      if (resume.summary) {
        sectionHead(doc, "Professional Summary");
        doc.font("Helvetica").fontSize(9).fillColor(C.dark)
          .text(resume.summary, M, doc.y, { width: CW, lineGap: 1.5 });
        doc.moveDown(0.3);
      }

      // ── SKILLS ──────────────────────────────────────────────────────────────
      if (resume.skills) {
        const lines = [];
        if (resume.skills.technical?.length) lines.push({ l: "Technical", v: resume.skills.technical.join("  •  ") });
        if (resume.skills.tools?.length)     lines.push({ l: "Tools",     v: resume.skills.tools.join("  •  ") });
        if (resume.skills.soft?.length)      lines.push({ l: "Soft",      v: resume.skills.soft.join("  •  ") });

        if (lines.length) {
          sectionHead(doc, "Skills");
          lines.forEach(({ l, v }) => {
            if (doc.y > BOTTOM_LIMIT) return;
            doc.font("Helvetica-Bold").fontSize(8.5).fillColor(C.dark)
              .text(l + ": ", M, doc.y, { continued: true, width: CW });
            doc.font("Helvetica").fontSize(8.5).fillColor(C.mid)
              .text(v, { width: CW - 60, lineGap: 1 });
          });
          doc.moveDown(0.2);
        }
      }

      // ── EXPERIENCE ──────────────────────────────────────────────────────────
      if (resume.experience?.length) {
        sectionHead(doc, "Experience");
        resume.experience.forEach((exp, i) => {
          if (doc.y > BOTTOM_LIMIT) return;
          roleLine(doc, exp.role || "", exp.duration || "");
          subLine(doc, [exp.company, exp.location].filter(Boolean).join("  —  "));
          (exp.bullets || []).slice(0, 3).forEach(b => bullet(doc, b));
          if (i < resume.experience.length - 1) doc.moveDown(0.4);
        });
        doc.moveDown(0.2);
      }

      // ── PROJECTS ────────────────────────────────────────────────────────────
      if (resume.projects?.length) {
        sectionHead(doc, "Projects");
        resume.projects.forEach((proj, i) => {
          if (doc.y > BOTTOM_LIMIT) return;
          // Title bold, full width — no right-alignment for tech (avoids wrapping smudge)
          doc.font("Helvetica-Bold").fontSize(9.5).fillColor(C.black)
            .text(proj.title || "", M, doc.y, { width: CW });
          // Tech stack on its own line, smaller, dimmed
          const techStr = (proj.tech || []).join("  •  ");
          if (techStr) {
            doc.font("Helvetica").fontSize(8).fillColor(C.mid)
              .text(techStr, M, doc.y, { width: CW, lineGap: 1 });
          }
          doc.moveDown(0.15);
          (proj.bullets || []).slice(0, 2).forEach(b => bullet(doc, b));
          if (i < resume.projects.length - 1) doc.moveDown(0.35);
        });
        doc.moveDown(0.2);
      }

      // ── EDUCATION ───────────────────────────────────────────────────────────
      if (resume.education?.length) {
        sectionHead(doc, "Education");
        resume.education.forEach((edu, i) => {
          if (doc.y > BOTTOM_LIMIT) return;
          roleLine(doc, edu.degree || "", edu.year || "");
          const instLine = [edu.institution, edu.gpa ? `GPA: ${edu.gpa}` : ""].filter(Boolean).join("  •  ");
          if (instLine) subLine(doc, instLine);
          (edu.achievements || []).forEach(a => bullet(doc, a, 4));
          if (i < resume.education.length - 1) doc.moveDown(0.3);
        });
        doc.moveDown(0.2);
      }

      // ── CERTIFICATIONS ──────────────────────────────────────────────────────
      if (resume.certifications?.length) {
        sectionHead(doc, "Certifications");
        resume.certifications.forEach(c => bullet(doc, c, 4));
        doc.moveDown(0.2);
      }

      // ── ACHIEVEMENTS ────────────────────────────────────────────────────────
      // Only render if there are actual achievements (not an empty array from AI)
      if (resume.achievements?.length && resume.achievements.some(a => a && a.trim().length > 3)) {
        sectionHead(doc, "Achievements");
        resume.achievements.forEach(a => { if (a?.trim()) bullet(doc, a, 4); });
      }

      doc.end();
      stream.on("finish", () => {
        console.log(`[pdfService] wrote ${outputPath}`);
        resolve();
      });
      stream.on("error", reject);

    } catch (err) {
      reject(err);
    }
  });
}

module.exports = { generatePDF };