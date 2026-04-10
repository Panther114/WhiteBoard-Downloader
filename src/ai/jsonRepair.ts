/**
 * JSON repair utilities for LLM output.
 *
 * Fix 3: When the model is asked to return JSON via a free-form text
 * instruction it occasionally produces JSON that is almost — but not quite —
 * valid.  Common failure modes:
 *
 *   1. Trailing comma before `}` or `]`
 *      e.g.  { "key": "value", }
 *   2. Unescaped control characters inside string values
 *      e.g.  { "title": "Chapter\n1" }  (LF must be \\n in JSON)
 *   3. Single-quoted strings instead of double-quoted
 *   4. JavaScript-style comments  //  or  /* … *\/
 *   5. Truncated output — the JSON ends mid-stream; we extract whatever is
 *      parseable so the caller can still make use of partial results.
 *
 * The functions here are ordered from cheapest to most aggressive.  Callers
 * should apply them in that order and stop as soon as `JSON.parse` succeeds.
 */

// ---------------------------------------------------------------------------
// Individual repair passes
// ---------------------------------------------------------------------------

/**
 * Pass 1 — strip trailing commas inside objects `{ … , }` and arrays `[ … , ]`.
 */
export function stripTrailingCommas(raw: string): string {
  return raw
    .replace(/,(\s*[}\]])/g, '$1');
}

/**
 * Pass 2 — replace unescaped literal control characters inside JSON string
 * values with their safe escape sequences.
 *
 * This regex finds content between double-quote pairs (skipping already-escaped
 * sequences) and replaces bare control characters with `\uXXXX`.
 *
 * NOTE: This is a best-effort heuristic; deeply nested strings with embedded
 * quotes may not be handled correctly.  It covers the most common case where
 * the model pastes a multi-line text excerpt verbatim.
 */
export function escapeControlCharsInStrings(raw: string): string {
  return raw.replace(
    // Match a JSON string: opening " then any chars (non-greedy) then closing "
    // The negative lookbehind ensures we don't match already-escaped quotes.
    /"((?:[^"\\]|\\.)*)"/gs,
    (_match, content: string) => {
      const fixed = content
        .replace(/\n/g, '\\n')
        .replace(/\r/g, '\\r')
        .replace(/\t/g, '\\t')
        // Other C0 control characters
        .replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/g, c =>
          `\\u${c.charCodeAt(0).toString(16).padStart(4, '0')}`
        );
      return `"${fixed}"`;
    }
  );
}

/**
 * Pass 3 — remove JavaScript-style line and block comments.
 */
export function stripJsComments(raw: string): string {
  return raw
    .replace(/\/\/[^\n]*/g, '')
    .replace(/\/\*[\s\S]*?\*\//g, '');
}

/**
 * Pass 4 — convert single-quoted string keys / values to double-quoted.
 * Only safe for simple cases (no escaped single quotes inside the value).
 */
export function singleToDoubleQuotes(raw: string): string {
  return raw.replace(/'([^'\\]*)'/g, '"$1"');
}

/**
 * Pass 5 — extract the longest prefix that looks like a complete JSON value.
 *
 * When the model output is truncated (e.g. context limit hit mid-stream), the
 * raw string may be valid JSON up to a certain character.  This function
 * scans backward from the end, progressively shortening the string and testing
 * whether the result parses.  Returns the first parseable prefix, or `null` if
 * none is found.
 *
 * @param raw     Potentially truncated JSON string.
 * @param minLen  Minimum character count to attempt before giving up (default 20).
 */
export function extractParseablePrefix(raw: string, minLen = 20): unknown | null {
  let s = raw.trimEnd();
  while (s.length >= minLen) {
    // Try closing the structure with the most recently removed character type
    for (const suffix of ['', '}', ']', '"}', '"]}', '"}}']) {
      try {
        return JSON.parse(s + suffix);
      } catch {
        // continue
      }
    }
    s = s.slice(0, -1).trimEnd();
  }
  return null;
}

// ---------------------------------------------------------------------------
// Composite repair pipeline
// ---------------------------------------------------------------------------

/**
 * Attempt to repair and parse a raw string from the model as JSON.
 *
 * Applies repair passes in order (cheapest first) and returns the first
 * successfully parsed value.  Returns `null` if all attempts fail.
 *
 * @param raw  Raw model output string.
 */
export function repairAndParse(raw: string): unknown | null {
  // Strip any markdown code fence the model may have wrapped the JSON in.
  let s = raw.trim();
  const fenceMatch = s.match(/^```(?:json)?\s*([\s\S]*?)```\s*$/i);
  if (fenceMatch) {
    s = fenceMatch[1].trim();
  }

  // Fast path: already valid JSON.
  try {
    return JSON.parse(s);
  } catch {
    // fall through to repair passes
  }

  // Apply repair passes cumulatively: each pass builds on the previous result.
  const passes: Array<(x: string) => string> = [
    stripTrailingCommas,
    escapeControlCharsInStrings,
    stripJsComments,
    singleToDoubleQuotes,
  ];

  let current = s;
  for (const pass of passes) {
    current = pass(current);
    try {
      return JSON.parse(current);
    } catch {
      // continue to next pass
    }
  }

  // Last resort: extract whatever partial JSON we can.
  return extractParseablePrefix(current);
}

/**
 * Describes the location of a JSON parse error.
 *
 * Fix 10 debug helper: used by PdfAiProcessor to log the exact error site.
 */
export interface ParseErrorLocation {
  line: number;
  column: number;
  charIndex: number;
  /** The character at the error position (or empty string if out of range) */
  charAtPosition: string;
  /** Up to 100 characters of context around the error position */
  context: string;
}

/**
 * Extract structured location information from a `SyntaxError` thrown by
 * `JSON.parse()`.  Node.js includes "line N column M (char K)" in the message.
 *
 * Returns `null` if the message format is not recognised.
 */
export function parseErrorLocation(raw: string, error: SyntaxError): ParseErrorLocation | null {
  const m = error.message.match(/line (\d+) column (\d+) \(char (\d+)\)/);
  if (!m) return null;

  const line = parseInt(m[1], 10);
  const column = parseInt(m[2], 10);
  const charIndex = parseInt(m[3], 10);
  const charAtPosition = raw[charIndex] ?? '';
  const start = Math.max(0, charIndex - 50);
  const end = Math.min(raw.length, charIndex + 50);
  const context = raw.slice(start, end).replace(/\n/g, '↵');

  return { line, column, charIndex, charAtPosition, context };
}
