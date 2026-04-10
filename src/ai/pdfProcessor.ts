/**
 * PDF AI Processor — orchestrates discovery and extraction with full defensive
 * guardrails against Bedrock BadRequestError and JSON parse failures.
 *
 * Implements:
 *   Fix 1  — token-budget enforcement with adaptive page-count backoff
 *   Fix 2  — high-context model default, small-context-model warning
 *   Fix 3  — tool-use / structured-output mode; JSON repair fallback pipeline
 *   Fix 4  — text sanitisation before prompt injection
 *   Fix 10 — comprehensive debug logging at every key decision point
 */

import { log } from '../utils/logger';
import {
  DEFAULT_DISCOVERY_MODEL,
  getContextWindow,
  isSmallContextModel,
  getModelConfig,
} from './modelConfig';
import { estimatePromptTokens } from './tokenEstimator';
import { sanitizePages, truncatePage } from './textSanitizer';
import { repairAndParse, parseErrorLocation } from './jsonRepair';

// ---------------------------------------------------------------------------
// Public interfaces
// ---------------------------------------------------------------------------

/**
 * Minimal interface that any AI client must satisfy.
 * Implement this against your chosen provider (e.g. Amazon Bedrock, OpenAI).
 *
 * `invoke` — plain text completion.
 * `invokeWithSchema` — optional structured / tool-use mode that enforces a
 *   JSON Schema on the response.  When present it is always preferred over the
 *   free-form fallback so the model is constrained to return valid JSON.
 */
export interface AiClient {
  invoke(params: {
    modelId: string;
    systemPrompt: string;
    userPrompt: string;
  }): Promise<string>;

  invokeWithSchema?(params: {
    modelId: string;
    systemPrompt: string;
    userPrompt: string;
    /** JSON Schema object describing the expected response shape */
    schema: Record<string, unknown>;
    /** Human-readable tool name used in the Converse API tool definition */
    toolName: string;
    toolDescription: string;
  }): Promise<unknown>;
}

/** Configuration for a single `PdfAiProcessor` instance. */
export interface PdfAiProcessorConfig {
  /**
   * Bedrock model ID to use for discovery and extraction.
   * Defaults to `DEFAULT_DISCOVERY_MODEL` (Claude 3.5 Sonnet v2, 200 k context).
   */
  modelId?: string;

  /**
   * Maximum number of pages to sample for the discovery prompt.
   * The processor will automatically reduce this value if the assembled prompt
   * would exceed the token budget (Fix 1).
   * @default 10
   */
  discoverySamplePages?: number;

  /**
   * Hard token ceiling for any single prompt sent to the model, expressed as a
   * fraction of the model's declared context window.
   * @default 0.9
   */
  contextBudgetFraction?: number;

  /**
   * Maximum characters per page before the page text is truncated.
   * Acts as an additional guard on top of the token-budget enforcement.
   * @default 4000
   */
  maxCharsPerPage?: number;
}

/** A discovered category / section from the discovery phase. */
export interface DiscoveredCategory {
  name: string;
  description: string;
}

/** Structured output from the extraction phase. */
export interface ExtractionResult {
  categories: Array<{
    name: string;
    items: Array<{ title: string; summary: string }>;
  }>;
}

// ---------------------------------------------------------------------------
// Generic category fallback (Fix 1/3: used when discovery fails)
// ---------------------------------------------------------------------------

const GENERIC_CATEGORIES: DiscoveredCategory[] = [
  { name: 'Lecture Notes', description: 'Slides or notes from lectures' },
  { name: 'Assignments', description: 'Homework or project specifications' },
  { name: 'Readings', description: 'Required or recommended reading material' },
  { name: 'Exams', description: 'Past exams or practice problems' },
  { name: 'Miscellaneous', description: 'Other course materials' },
];

// ---------------------------------------------------------------------------
// JSON Schema for tool-use mode (Fix 3)
// ---------------------------------------------------------------------------

const DISCOVERY_TOOL_SCHEMA: Record<string, unknown> = {
  type: 'object',
  required: ['categories'],
  properties: {
    categories: {
      type: 'array',
      items: {
        type: 'object',
        required: ['name', 'description'],
        properties: {
          name: { type: 'string', description: 'Short category label' },
          description: { type: 'string', description: 'One-sentence description of this category' },
        },
      },
    },
  },
};

const EXTRACTION_TOOL_SCHEMA: Record<string, unknown> = {
  type: 'object',
  required: ['categories'],
  properties: {
    categories: {
      type: 'array',
      items: {
        type: 'object',
        required: ['name', 'items'],
        properties: {
          name: { type: 'string' },
          items: {
            type: 'array',
            items: {
              type: 'object',
              required: ['title', 'summary'],
              properties: {
                title: { type: 'string' },
                summary: { type: 'string' },
              },
            },
          },
        },
      },
    },
  },
};

// ---------------------------------------------------------------------------
// System prompts
// ---------------------------------------------------------------------------

const DISCOVERY_SYSTEM_PROMPT = `You are a document analyst.
Your task is to identify the main categories present in the provided PDF page samples.
Return ONLY a valid JSON object matching the supplied schema.
Rules for the JSON output:
- All string values MUST comply with RFC 8259: escape backslashes as \\\\, double-quotes as \\", newlines as \\n, carriage returns as \\r, tabs as \\t.
- Do NOT include trailing commas.
- Do NOT include comments.
- Do NOT wrap the JSON in markdown code fences.`;

const EXTRACTION_SYSTEM_PROMPT = `You are a document analyst.
Classify the content from the provided PDF page samples into the given categories.
Return ONLY a valid JSON object matching the supplied schema.
Rules for the JSON output:
- All string values MUST comply with RFC 8259: escape backslashes as \\\\, double-quotes as \\", newlines as \\n, carriage returns as \\r, tabs as \\t.
- Do NOT include trailing commas.
- Do NOT include comments.
- Do NOT wrap the JSON in markdown code fences.`;

// ---------------------------------------------------------------------------
// PdfAiProcessor
// ---------------------------------------------------------------------------

export class PdfAiProcessor {
  private client: AiClient;
  private modelId: string;
  private discoverySamplePages: number;
  private contextBudgetFraction: number;
  private maxCharsPerPage: number;
  private tokenBudget: number;

  constructor(client: AiClient, config: PdfAiProcessorConfig = {}) {
    this.client = client;
    this.modelId = config.modelId ?? DEFAULT_DISCOVERY_MODEL;
    this.discoverySamplePages = config.discoverySamplePages ?? 10;
    this.contextBudgetFraction = config.contextBudgetFraction ?? 0.9;
    this.maxCharsPerPage = config.maxCharsPerPage ?? 4_000;

    // Fix 2: warn when a small-context model is chosen for PDF processing.
    if (isSmallContextModel(this.modelId)) {
      const cfg = getModelConfig(this.modelId);
      const window = cfg?.contextWindowTokens ?? 'unknown';
      log.warn(
        `[AI] Model "${this.modelId}" has a small context window (${window} tokens). ` +
          'PDF discovery may fail with BadRequestError. ' +
          `Consider switching to "${DEFAULT_DISCOVERY_MODEL}" (200 k tokens).`
      );
    } else {
      log.debug(`[AI] Using model "${this.modelId}" (context: ${getContextWindow(this.modelId)} tokens)`);
    }

    this.tokenBudget = Math.floor(getContextWindow(this.modelId) * this.contextBudgetFraction);
    log.debug(`[AI] Token budget: ${this.tokenBudget} (${this.contextBudgetFraction * 100}% of ${getContextWindow(this.modelId)})`);
  }

  // -------------------------------------------------------------------------
  // Discovery phase
  // -------------------------------------------------------------------------

  /**
   * Run the discovery phase: identify categories present in the document.
   *
   * Fix 1: If the assembled prompt exceeds the token budget, the number of
   * sampled pages is halved on each attempt (10 → 5 → 2 → 1) until it fits.
   * If even a 1-page prompt is too large, discovery falls back to generic
   * categories without hitting the model at all.
   *
   * @param pages  All page texts from the PDF (raw, unsanitized).
   * @returns      Discovered categories, or generic fallback categories.
   */
  async discover(pages: string[]): Promise<DiscoveredCategory[]> {
    // Sanitize all pages once (Fix 4)
    const sanitized = sanitizePages(pages);

    // Adaptive backoff schedule: halve on each step (Fix 1)
    const schedule = this.buildBackoffSchedule(this.discoverySamplePages);
    log.debug(`[AI] Discovery backoff schedule: [${schedule.join(', ')}] pages`);

    for (const sampleCount of schedule) {
      const sample = this.selectSample(sanitized, sampleCount);
      const userPrompt = this.buildDiscoveryPrompt(sample);
      const estimatedTokens = estimatePromptTokens(DISCOVERY_SYSTEM_PROMPT, userPrompt);

      // Fix 10: log token estimate before every attempt
      log.debug(
        `[AI] Discovery attempt with ${sampleCount} pages — ` +
          `estimated tokens: ${estimatedTokens} / budget: ${this.tokenBudget} ` +
          `(prompt length: ${userPrompt.length} chars)`
      );

      if (estimatedTokens > this.tokenBudget) {
        log.warn(
          `[AI] Discovery prompt (${estimatedTokens} tokens) exceeds budget ` +
            `(${this.tokenBudget} tokens) with ${sampleCount} pages — reducing sample.`
        );
        continue;
      }

      // Fix 10: log model ID before every Bedrock call
      log.debug(`[AI] Calling model "${this.modelId}" for discovery (${sampleCount} sample pages)`);

      const result = await this.callModelForJson<{ categories: DiscoveredCategory[] }>(
        DISCOVERY_SYSTEM_PROMPT,
        userPrompt,
        DISCOVERY_TOOL_SCHEMA,
        'discover_categories',
        'Identify the main categories present in the provided PDF sample pages'
      );

      if (result?.categories && Array.isArray(result.categories) && result.categories.length > 0) {
        log.debug(`[AI] Discovery succeeded — found ${result.categories.length} categories`);
        return result.categories;
      }

      log.warn(`[AI] Discovery returned no usable categories with ${sampleCount} pages — retrying with fewer pages`);
    }

    // All attempts exhausted — fall back to generic categories (Fix 10: log which ones)
    log.warn('[AI] Discovery failed on all backoff levels — falling back to generic categories.');
    log.debug(`[AI] Generic fallback categories: ${GENERIC_CATEGORIES.map(c => c.name).join(', ')}`);
    return GENERIC_CATEGORIES;
  }

  // -------------------------------------------------------------------------
  // Extraction phase
  // -------------------------------------------------------------------------

  /**
   * Run the extraction phase: classify page content into the given categories.
   *
   * Uses the same token-budget enforcement and JSON repair pipeline as
   * `discover()`.
   *
   * @param pages       All page texts from the PDF (raw, unsanitized).
   * @param categories  Categories returned by `discover()`.
   * @returns           Structured extraction result, or an empty result on failure.
   */
  async extract(pages: string[], categories: DiscoveredCategory[]): Promise<ExtractionResult> {
    const sanitized = sanitizePages(pages);
    const schedule = this.buildBackoffSchedule(this.discoverySamplePages);

    for (const sampleCount of schedule) {
      const sample = this.selectSample(sanitized, sampleCount);
      const userPrompt = this.buildExtractionPrompt(sample, categories);
      const estimatedTokens = estimatePromptTokens(EXTRACTION_SYSTEM_PROMPT, userPrompt);

      log.debug(
        `[AI] Extraction attempt with ${sampleCount} pages — ` +
          `estimated tokens: ${estimatedTokens} / budget: ${this.tokenBudget} ` +
          `(prompt length: ${userPrompt.length} chars)`
      );

      if (estimatedTokens > this.tokenBudget) {
        log.warn(
          `[AI] Extraction prompt (${estimatedTokens} tokens) exceeds budget ` +
            `(${this.tokenBudget} tokens) with ${sampleCount} pages — reducing sample.`
        );
        continue;
      }

      log.debug(`[AI] Calling model "${this.modelId}" for extraction (${sampleCount} sample pages)`);

      const result = await this.callModelForJson<ExtractionResult>(
        EXTRACTION_SYSTEM_PROMPT,
        userPrompt,
        EXTRACTION_TOOL_SCHEMA,
        'extract_content',
        'Classify the content from the provided PDF pages into the given categories'
      );

      if (result?.categories && Array.isArray(result.categories)) {
        log.debug(`[AI] Extraction succeeded`);
        return result as ExtractionResult;
      }

      log.warn(`[AI] Extraction returned no usable data with ${sampleCount} pages — retrying with fewer pages`);
    }

    log.warn('[AI] Extraction failed on all backoff levels — returning empty result.');
    return { categories: [] };
  }

  // -------------------------------------------------------------------------
  // Internal helpers
  // -------------------------------------------------------------------------

  /**
   * Build the adaptive backoff schedule for `sampleCount`:
   * [sampleCount, sampleCount/2, …, 2, 1] (each step halved, minimum 1).
   */
  private buildBackoffSchedule(sampleCount: number): number[] {
    const schedule: number[] = [];
    let n = sampleCount;
    while (n > 1) {
      schedule.push(n);
      n = Math.max(1, Math.floor(n / 2));
    }
    if (!schedule.includes(1)) schedule.push(1);
    return schedule;
  }

  /**
   * Select up to `count` evenly-spaced pages from `pages` so the sample
   * covers the whole document rather than just the beginning.
   */
  private selectSample(pages: string[], count: number): string[] {
    if (pages.length <= count) return pages;
    const step = pages.length / count;
    return Array.from({ length: count }, (_, i) => pages[Math.floor(i * step)]);
  }

  private buildDiscoveryPrompt(samplePages: string[]): string {
    const pagesText = samplePages
      .map((p, i) => `=== Page sample ${i + 1} ===\n${truncatePage(p, this.maxCharsPerPage)}`)
      .join('\n\n');
    return `Analyse the following ${samplePages.length} page sample(s) from a PDF document and identify its main content categories.\n\n${pagesText}`;
  }

  private buildExtractionPrompt(samplePages: string[], categories: DiscoveredCategory[]): string {
    const categoriesList = categories.map(c => `- ${c.name}: ${c.description}`).join('\n');
    const pagesText = samplePages
      .map((p, i) => `=== Page sample ${i + 1} ===\n${truncatePage(p, this.maxCharsPerPage)}`)
      .join('\n\n');
    return (
      `Classify the content from the following PDF page samples into these categories:\n${categoriesList}\n\n${pagesText}`
    );
  }

  /**
   * Call the model and return a parsed JSON value of type T.
   *
   * Fix 3: Prefers `invokeWithSchema` (tool-use mode) when the client supports
   * it, so the model is constrained at the API level to return valid JSON.
   * Falls back to free-form `invoke` + JSON repair pipeline when tool-use is
   * unavailable or returns an unusable result.
   *
   * Fix 10: Logs the raw response prefix, error location, and repair outcome
   * on every JSON parse failure.
   */
  private async callModelForJson<T extends object>(
    systemPrompt: string,
    userPrompt: string,
    schema: Record<string, unknown>,
    toolName: string,
    toolDescription: string
  ): Promise<T | null> {
    // Attempt 1: tool-use / structured-output mode (Fix 3)
    if (this.client.invokeWithSchema) {
      try {
        log.debug(`[AI] Using tool-use mode (schema-constrained output) for "${toolName}"`);
        const structured = await this.client.invokeWithSchema({
          modelId: this.modelId,
          systemPrompt,
          userPrompt,
          schema,
          toolName,
          toolDescription,
        });
        log.debug(`[AI] Tool-use invocation succeeded`);
        return structured as T;
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : String(err);
        // Fix 10: log full prompt length on BadRequestError
        if (msg.includes('BadRequestError') || msg.includes('Bad request')) {
          log.warn(
            `[AI] BadRequestError in tool-use mode — model: "${this.modelId}", ` +
              `prompt chars: ${systemPrompt.length + userPrompt.length}, ` +
              `estimated tokens: ${estimatePromptTokens(systemPrompt, userPrompt)}`
          );
          log.warn(`[AI] ${msg}`);
        } else {
          log.warn(`[AI] Tool-use invocation failed: ${msg} — falling back to free-form`);
        }
      }
    }

    // Attempt 2: free-form invocation + JSON repair pipeline
    let raw: string;
    try {
      log.debug(`[AI] Using free-form invocation for "${toolName}"`);
      raw = await this.client.invoke({ modelId: this.modelId, systemPrompt, userPrompt });
      log.debug(`[AI] Raw response length: ${raw.length} chars`);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      // Fix 10: log full prompt length on BadRequestError
      if (msg.includes('BadRequestError') || msg.includes('Bad request')) {
        log.warn(
          `[AI] BadRequestError — model: "${this.modelId}", ` +
            `prompt chars: ${systemPrompt.length + userPrompt.length}, ` +
            `estimated tokens: ${estimatePromptTokens(systemPrompt, userPrompt)}`
        );
      }
      log.warn(`[AI] Model invocation failed: ${msg}`);
      return null;
    }

    // Fix 10: log first 500 chars of raw response on every JSON attempt
    log.debug(`[AI] Raw response preview: ${raw.slice(0, 500).replace(/\n/g, '↵')}`);

    // Try native parse first (fastest path)
    try {
      return JSON.parse(raw) as T;
    } catch (err: unknown) {
      const syntaxErr = err instanceof SyntaxError ? err : new SyntaxError(String(err));
      // Fix 10: log precise error location
      const loc = parseErrorLocation(raw, syntaxErr);
      if (loc) {
        log.warn(
          `[AI] Failed to parse model output as JSON: ${syntaxErr.message} ` +
            `— line ${loc.line} col ${loc.column} (char ${loc.charIndex}), ` +
            `char="${loc.charAtPosition}", context: …${loc.context}…`
        );
      } else {
        log.warn(`[AI] Failed to parse model output as JSON: ${syntaxErr.message}`);
      }
    }

    // Apply repair pipeline (Fix 3)
    log.debug('[AI] Attempting JSON repair pipeline…');
    const repaired = repairAndParse(raw);
    if (repaired !== null) {
      log.debug('[AI] JSON repair succeeded');
      return repaired as T;
    }

    log.warn('[AI] JSON repair pipeline exhausted — could not recover parseable JSON');
    return null;
  }
}
