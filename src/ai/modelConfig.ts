/**
 * Registry of known Amazon Bedrock model IDs with their context-window sizes and
 * tool-use support flags.
 *
 * Fix 2: Defaults to a high-context model (Claude 3.5 Sonnet v2, 200 k tokens)
 * and emits a warning when the caller selects a model with a context window
 * below SMALL_CONTEXT_THRESHOLD.
 */

export interface BedrockModelConfig {
  /** Bedrock model identifier */
  modelId: string;
  /** Maximum input context window in tokens */
  contextWindowTokens: number;
  /** Whether the model supports the Converse API tool-use (structured output) mode */
  supportsToolUse: boolean;
  /** Human-readable label */
  description: string;
}

/**
 * Models whose input context window is below this size will trigger a warning
 * when used for PDF discovery / extraction, because dense text easily overflows
 * them (Fix 2).
 */
export const SMALL_CONTEXT_THRESHOLD = 32_000;

/**
 * Default model used for discovery and extraction.
 * Claude 3.5 Sonnet v2 has a 200 k-token context window and supports tool-use,
 * making it the safest choice for long PDF documents.
 */
export const DEFAULT_DISCOVERY_MODEL = 'anthropic.claude-3-5-sonnet-20241022-v2:0';

/**
 * Known Bedrock models.  Add entries here when new models become available.
 */
export const KNOWN_MODELS: Readonly<Record<string, BedrockModelConfig>> = {
  'anthropic.claude-3-5-sonnet-20241022-v2:0': {
    modelId: 'anthropic.claude-3-5-sonnet-20241022-v2:0',
    contextWindowTokens: 200_000,
    supportsToolUse: true,
    description: 'Claude 3.5 Sonnet v2 — recommended for PDF processing',
  },
  'anthropic.claude-3-5-haiku-20241022-v1:0': {
    modelId: 'anthropic.claude-3-5-haiku-20241022-v1:0',
    contextWindowTokens: 200_000,
    supportsToolUse: true,
    description: 'Claude 3.5 Haiku — fast and cost-efficient, 200 k context',
  },
  'anthropic.claude-3-haiku-20240307-v1:0': {
    modelId: 'anthropic.claude-3-haiku-20240307-v1:0',
    contextWindowTokens: 200_000,
    supportsToolUse: true,
    description: 'Claude 3 Haiku — fast and cost-efficient, 200 k context',
  },
  'anthropic.claude-3-sonnet-20240229-v1:0': {
    modelId: 'anthropic.claude-3-sonnet-20240229-v1:0',
    contextWindowTokens: 200_000,
    supportsToolUse: true,
    description: 'Claude 3 Sonnet',
  },
  'anthropic.claude-3-opus-20240229-v1:0': {
    modelId: 'anthropic.claude-3-opus-20240229-v1:0',
    contextWindowTokens: 200_000,
    supportsToolUse: true,
    description: 'Claude 3 Opus — highest capability',
  },
  'amazon.titan-text-express-v1': {
    modelId: 'amazon.titan-text-express-v1',
    contextWindowTokens: 8_000,
    supportsToolUse: false,
    description: 'Amazon Titan Text Express — small context, no tool-use',
  },
  'amazon.titan-text-lite-v1': {
    modelId: 'amazon.titan-text-lite-v1',
    contextWindowTokens: 4_000,
    supportsToolUse: false,
    description: 'Amazon Titan Text Lite — very small context, no tool-use',
  },
  'meta.llama3-8b-instruct-v1:0': {
    modelId: 'meta.llama3-8b-instruct-v1:0',
    contextWindowTokens: 8_000,
    supportsToolUse: false,
    description: 'Meta Llama 3 8B — small context, no tool-use',
  },
  'meta.llama3-70b-instruct-v1:0': {
    modelId: 'meta.llama3-70b-instruct-v1:0',
    contextWindowTokens: 8_000,
    supportsToolUse: false,
    description: 'Meta Llama 3 70B — small context, no tool-use',
  },
};

/**
 * Look up a model by ID.  Returns undefined for unrecognised IDs.
 */
export function getModelConfig(modelId: string): BedrockModelConfig | undefined {
  return KNOWN_MODELS[modelId];
}

/**
 * Return the effective context window for a model ID.
 * Falls back to a conservative 8 000-token estimate for unknown models so that
 * the token-budget enforcement still activates rather than being skipped.
 */
export function getContextWindow(modelId: string): number {
  return KNOWN_MODELS[modelId]?.contextWindowTokens ?? 8_000;
}

/**
 * Return true when PDF processing is being attempted with a model that has a
 * context window below SMALL_CONTEXT_THRESHOLD.
 */
export function isSmallContextModel(modelId: string): boolean {
  return getContextWindow(modelId) < SMALL_CONTEXT_THRESHOLD;
}
