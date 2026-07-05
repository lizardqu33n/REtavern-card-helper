/**
 * Novel Workshop - Component index
 * Migrated from .temp_statusbar.astro
 */

export { NovelWorkshop } from './NovelWorkshop';
export { HeaderBanner } from './panels/HeaderBanner';
export { ImportPanel } from './panels/ImportPanel';
export { PipelinePanel } from './panels/PipelinePanel';
export { ConfigPanel } from './panels/ConfigPanel';
export { ManagerPanel } from './panels/ManagerPanel';
export { NovelStatusBar } from './shared/NovelStatusBar';

// Hooks
export { useNovelState } from './hooks/useNovelState';

// Types
export type {
  NovelWorkshopState,
  GateMode,
  NarrativeMode,
  CategoryId,
  RevealFlag,
  EntityIndex,
  GeneratedEntry,
  VariableBlueprint,
  WorkflowRunState,
  CallEstimate,
} from './types';

// Utils
export {
  escapeHtml,
  escapeAttr,
  uniqueStrings,
  clampNumber,
  formatNumber,
  sanitizeSegment,
  stableId,
  hashString,
  estimateTokenCount,
  estimatePromptTokens,
  categoryLabel,
  narrativeModeLabel,
  getStageIndex,
  stageOptionsForMode,
  splitTextIntoChunks,
  buildCallEstimate,
  renderCallRisk,
  assertWorkflowAffordable,
  normalizeApiErrorMessage,
  extractJsonObject,
} from './utils';
