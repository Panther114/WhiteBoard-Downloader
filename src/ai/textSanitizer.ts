/**
 * Text sanitizer for content injected into AI prompts.
 *
 * Fix 4: PDF pages often contain LaTeX math, Chinese characters, and other
 * Unicode that can cause the model to echo back characters that are illegal
 * inside JSON strings (control characters, unescaped backslashes, etc.).
 * Running page text through this sanitizer before building the prompt reduces
 * the chance of receiving malformed JSON from the model.
 *
 * Design goals:
 *   - Do NOT escape content for JSON — that is the *model's* responsibility.
 *     The system prompt instructs the model to produce valid JSON.
 *   - Strip characters that are invisible noise in a prompt but that can leak
 *     into model output and break downstream JSON parsing.
 *   - Preserve meaningful Unicode (CJK, Arabic, math symbols, etc.).
 *   - Be idempotent — calling twice returns the same result.
 */

/**
 * C0 control characters (U+0000–U+001F) minus the three whitespace characters
 * that are safe and readable in a prompt: TAB (U+0009), LF (U+000A), CR (U+000D).
 */
const CONTROL_CHARS_RE = /[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/g;

/**
 * Unicode directional / formatting marks that are invisible and can confuse
 * parsers: LRM, RLM, LRE, RLE, PDF, LRO, RLO, WJ, ZWNJ, ZWJ, BOM.
 */
const INVISIBLE_FORMATTING_RE =
  /[\u200b-\u200f\u202a-\u202e\u2060-\u2064\ufeff]/g;

/**
 * Multiple consecutive blank lines collapsed into a single blank line.
 * Reduces prompt size without losing paragraph structure.
 */
const MULTI_BLANK_LINE_RE = /(\r?\n){3,}/g;

/**
 * Sanitize a single PDF page's text before injecting it into an AI prompt.
 *
 * Steps performed (in order):
 *   1. Remove C0 control characters (except TAB / LF / CR).
 *   2. Remove invisible Unicode formatting marks (ZWJ, BOM, directional marks).
 *   3. Collapse runs of 3+ blank lines into one blank line.
 *   4. Trim leading / trailing whitespace from the whole string.
 *
 * @param text  Raw page text extracted from the PDF.
 * @returns     Cleaned text safe for prompt injection.
 */
export function sanitizePageText(text: string): string {
  return text
    .replace(CONTROL_CHARS_RE, '')
    .replace(INVISIBLE_FORMATTING_RE, '')
    .replace(MULTI_BLANK_LINE_RE, '\n\n')
    .trim();
}

/**
 * Sanitize an array of page texts (convenience wrapper around `sanitizePageText`).
 *
 * @param pages  Array of raw page strings.
 * @returns      Array of sanitized strings (same length and order).
 */
export function sanitizePages(pages: string[]): string[] {
  return pages.map(sanitizePageText);
}

/**
 * Truncate a page to at most `maxChars` characters, preserving whole words
 * where possible and appending an ellipsis when truncation occurs.
 * Use this to keep individual pages within a per-page character budget.
 *
 * @param text      Page text.
 * @param maxChars  Maximum character count.
 * @returns         Possibly truncated string.
 */
export function truncatePage(text: string, maxChars: number): string {
  if (text.length <= maxChars) return text;
  const cut = text.lastIndexOf(' ', maxChars);
  const pos = cut > maxChars * 0.8 ? cut : maxChars;
  return text.slice(0, pos) + '…';
}
