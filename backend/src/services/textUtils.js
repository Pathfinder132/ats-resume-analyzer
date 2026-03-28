// backend/src/services/textUtils.js
// Enhanced: ligature fixing, proper unicode normalization, phrase extraction

// ─── Ligature & Unicode Character Map ─────────────────────────────────────────
const CHAR_MAP = {
  // Ligatures
  '\uFB00': 'ff',  '\uFB01': 'fi',  '\uFB02': 'fl',
  '\uFB03': 'ffi', '\uFB04': 'ffl', '\uFB05': 'st', '\uFB06': 'st',
  // Smart quotes
  '\u2018': "'",  '\u2019': "'",  '\u201A': "'",
  '\u201C': '"',  '\u201D': '"',  '\u201E': '"',
  // Dashes → hyphen (so "full-stack" stays parseable)
  '\u2013': '-',  '\u2014': '-',  '\u2015': '-',
  '\u2212': '-',
  // Bullet-like symbols → keep as dash so bullet detection works
  '\u2022': '\n• ', '\u2023': '\n• ', '\u25CF': '\n• ',
  '\u25AA': '\n• ', '\u25AB': '\n• ', '\u2027': '.',
  '\u25B8': '\n• ', '\u25E6': '\n• ',
  // Non-breaking & special spaces → regular space
  '\u00A0': ' ',  '\u202F': ' ',  '\u2009': ' ',
  '\u2003': ' ',  '\u2002': ' ',  '\u2007': ' ',
  // Ellipsis
  '\u2026': '...',
  // Degree, superscripts (keep readable)
  '\u00B0': ' degrees',
  '\u00B9': '1', '\u00B2': '2', '\u00B3': '3',
  // Accented latin chars → base char (common in copied text)
  '\u00E9': 'e', '\u00E8': 'e', '\u00EA': 'e', '\u00EB': 'e',
  '\u00E0': 'a', '\u00E1': 'a', '\u00E2': 'a', '\u00E4': 'a',
  '\u00F3': 'o', '\u00F2': 'o', '\u00F4': 'o', '\u00F6': 'o',
  '\u00FA': 'u', '\u00F9': 'u', '\u00FB': 'u', '\u00FC': 'u',
  '\u00ED': 'i', '\u00EC': 'i', '\u00EE': 'i', '\u00EF': 'i',
  '\u00F1': 'n', '\u00E7': 'c',
};

// Build the regex once
const CHAR_MAP_RE = new RegExp(
  Object.keys(CHAR_MAP).map(c => c.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('|'),
  'g'
);

/**
 * Fix ligatures and normalize unicode characters to ASCII equivalents.
 * This runs BEFORE stripping so we preserve meaningful chars.
 */
function fixUnicode(s) {
  if (!s) return '';
  return s.replace(CHAR_MAP_RE, ch => CHAR_MAP[ch] || ch);
}

/**
 * Fix soft-hyphen line breaks (word-\nword → word)
 * Common in copy-pasted PDF text.
 */
function fixHyphenBreaks(s) {
  if (!s) return '';
  // "hyphen at end of line followed by newline + lowercase" = broken word
  return s.replace(/-\s*\n\s*([a-z])/g, '$1');
}

/**
 * Remove lines that appear 3+ times in the document — these are
 * likely repeated page headers/footers injected by the PDF parser.
 */
function deduplicateRepeatedLines(text) {
  const lines = text.split('\n');
  const freq = new Map();
  for (const l of lines) {
    const k = l.trim().toLowerCase();
    if (k.length > 0 && k.length < 60) {
      freq.set(k, (freq.get(k) || 0) + 1);
    }
  }
  return lines
    .filter(l => {
      const k = l.trim().toLowerCase();
      return !k || k.length >= 60 || (freq.get(k) || 0) < 3;
    })
    .join('\n');
}

/**
 * Master normalization pipeline.
 * Order matters: fix unicode → fix line breaks → collapse whitespace
 */
function normalize(s) {
  if (!s) return '';
  let result = fixUnicode(s);
  result = fixHyphenBreaks(result);
  result = result
    .replace(/\r\n/g, '\n')
    .replace(/\r/g, '\n')
    // Collapse 3+ blank lines into 2 (preserve paragraph separation)
    .replace(/\n{3,}/g, '\n\n')
    // Strip remaining non-printable, non-ASCII chars (after unicode fixup)
    .replace(/[^\x09\x0A\x0D\x20-\x7E\n]/g, ' ')
    .replace(/[ \t]{2,}/g, ' ')
    .trim();
  result = deduplicateRepeatedLines(result);
  return result;
}

/**
 * Extract individual word tokens (lowercase, no punctuation).
 * Used for single-word skill matching.
 */
function words(s) {
  if (!s) return [];
  return s
    .toLowerCase()
    .split(/[\s\n\t,;:()\[\]{}"'!?|]+/)
    .map(w => w.replace(/^[^a-z0-9]+|[^a-z0-9]+$/g, '')) // strip leading/trailing punct
    .filter(w => w.length >= 1);
}

/**
 * Extract overlapping n-grams (phrases) from the text for multi-word skill matching.
 * Returns an array of normalized phrase strings.
 * maxN=3 catches "machine learning", "natural language processing", etc.
 */
function phrases(s, maxN = 3) {
  if (!s) return [];
  const tokens = s
    .toLowerCase()
    .replace(/[^a-z0-9.#+\s\n\-\/]/g, ' ')
    .split(/[\s\n\t]+/)
    .map(t => t.replace(/^[-./]+|[-./]+$/g, '').trim())
    .filter(t => t.length >= 1);

  const result = [];
  for (let i = 0; i < tokens.length; i++) {
    for (let n = 2; n <= maxN; n++) {
      if (i + n <= tokens.length) {
        result.push(tokens.slice(i, i + n).join(' '));
      }
    }
  }
  return result;
}

/**
 * Normalize a token for alias/skill lookup:
 * - lowercase
 * - collapse separators (-, /, ., spaces) to a single space
 * - strip trailing punctuation
 *
 * Examples:
 *   "Node.js"   → "node.js"   (keep dot, it's meaningful)
 *   "CI/CD"     → "ci/cd"
 *   "C++"       → "c++"
 *   "NodeJS"    → "nodejs"
 *   "React.JS"  → "react.js"
 */
function normalizeToken(s) {
  if (!s) return '';
  return s
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Split text into lines/sentences for bullet analysis.
 */
function sentenceSplit(text) {
  if (!text) return [];
  return text.split(/\n+/).map(l => l.trim()).filter(Boolean);
}

module.exports = { normalize, words, phrases, normalizeToken, sentenceSplit, fixUnicode, deduplicateRepeatedLines };