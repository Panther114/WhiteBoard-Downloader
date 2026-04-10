/**
 * AI processing infrastructure for PDF document analysis.
 *
 * Exports everything needed to integrate an AI document-processing pipeline
 * with full defensive guardrails against Bedrock BadRequestError and JSON
 * parse failures.
 */

export { PdfAiProcessor } from './pdfProcessor';
export type {
  AiClient,
  PdfAiProcessorConfig,
  DiscoveredCategory,
  ExtractionResult,
} from './pdfProcessor';

export {
  KNOWN_MODELS,
  DEFAULT_DISCOVERY_MODEL,
  SMALL_CONTEXT_THRESHOLD,
  getModelConfig,
  getContextWindow,
  isSmallContextModel,
} from './modelConfig';
export type { BedrockModelConfig } from './modelConfig';

export { estimateTokens, estimatePromptTokens } from './tokenEstimator';

export { sanitizePageText, sanitizePages, truncatePage } from './textSanitizer';

export {
  stripTrailingCommas,
  escapeControlCharsInStrings,
  stripJsComments,
  singleToDoubleQuotes,
  extractParseablePrefix,
  repairAndParse,
  parseErrorLocation,
} from './jsonRepair';
export type { ParseErrorLocation } from './jsonRepair';
