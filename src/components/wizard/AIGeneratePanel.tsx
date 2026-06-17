/**
 * AIGeneratePanel - Always-visible panel for AI batch world book generation.
 * Contains theme, skeleton mode, world rules, NSFW toggle, and generate button.
 */
import { useState, useCallback, useEffect, useRef } from 'react';
import { TextInput } from '../shared/TextInput';
import { TextArea } from '../shared/TextArea';
import { Button } from '../shared/Button';
import { AIProgressPanel, type AIProgressStatus } from '../shared/AIProgressPanel';
import { useAIGenerate } from '../../hooks/useAIGenerate';

interface AIGeneratePanelProps {
  topic: string;
  worldRules: string;
  generating: boolean;
  skeletonMode: boolean;
  skeletonCount: number;
  batchCount: number;
  onTopicChange: (topic: string) => void;
  onWorldRulesChange: (rules: string) => void;
  onSkeletonModeChange: (skeleton: boolean) => void;
  onSkeletonCountChange: (count: number) => void;
  onBatchCountChange: (count: number) => void;
  onGenerate: () => void;
  /** Whether NSFW content generation is allowed */
  nsfw?: boolean;
  onNsfwChange?: (nsfw: boolean) => void;
  /** Card name, used for AI rule generation */
  cardName?: string;
  /** Character summaries, used for AI rule generation */
  characterSummaries?: string;
  /** Existing world book entries context, used to keep rules consistent */
  existingWorldbookContext?: string;
}

export function AIGeneratePanel({
  topic,
  worldRules,
  generating,
  skeletonMode,
  skeletonCount,
  batchCount,
  onTopicChange,
  onWorldRulesChange,
  onSkeletonModeChange,
  onSkeletonCountChange,
  onBatchCountChange,
  onGenerate,
  nsfw,
  onNsfwChange,
  cardName,
  characterSummaries,
  existingWorldbookContext,
}: AIGeneratePanelProps) {
  const { generateWorldRulesStreaming } = useAIGenerate();
  const [rulesStatus, setRulesStatus] = useState<AIProgressStatus>('idle');
  const [rulesText, setRulesText] = useState('');
  const [rulesError, setRulesError] = useState<string | null>(null);
  const [pendingRules, setPendingRules] = useState<string | null>(null);
  const rulesRetryCountRef = useRef(0);
  const rulesRetryTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Clean up pending retry timeout on unmount
  useEffect(() => () => {
    if (rulesRetryTimeoutRef.current) clearTimeout(rulesRetryTimeoutRef.current);
  }, []);

  const canGenerateRules = !!cardName?.trim();

  const handleGenerateRules = useCallback(async (isRetry = false) => {
    if (!canGenerateRules) {
      setRulesError('请先填写卡片名称');
      return;
    }
    if (!isRetry) {
      rulesRetryCountRef.current = 0;
    }
    setRulesStatus('generating');
    setRulesText('');
    setRulesError(null);
    setPendingRules(null);

    try {
      const fullText = await generateWorldRulesStreaming(
        cardName || '',
        characterSummaries || '',
        (chunk) => setRulesText((prev) => prev + chunk),
        topic || undefined,
        worldRules || undefined,
        existingWorldbookContext || undefined,
        nsfw,
      );

      // ── Empty/too-short response detection ─────────────────────────────
      const trimmed = fullText.trim();
      if (trimmed.length < 20) {
        rulesRetryCountRef.current = isRetry ? rulesRetryCountRef.current + 1 : 1;
        const currentRetry = rulesRetryCountRef.current;
        if (currentRetry <= 2) {
          setRulesText(`⚠️ AI 返回规则过短（${trimmed.length} 字），自动重试中 (${currentRetry}/2)...\n\n`);
          rulesRetryTimeoutRef.current = setTimeout(() => handleGenerateRules(true), 1000);
          return;
        } else {
          setRulesStatus('error');
          setRulesError('AI 连续 3 次返回空内容或过短的规则。请检查 API 配置或主题描述后重试。');
          return;
        }
      }

      setRulesStatus('done');
      setPendingRules(fullText);
    } catch (err: unknown) {
      setRulesStatus('error');
      setRulesError(err instanceof Error ? err.message : '生成失败');
    }
  }, [canGenerateRules, cardName, characterSummaries, topic, worldRules, existingWorldbookContext, nsfw, generateWorldRulesStreaming]);

  const handleAcceptRules = useCallback(() => {
    if (pendingRules) {
      onWorldRulesChange(pendingRules);
      setPendingRules(null);
    }
    setRulesStatus('idle');
    setRulesText('');
  }, [pendingRules, onWorldRulesChange]);

  const handleRejectRules = useCallback(() => {
    setPendingRules(null);
    setRulesStatus('idle');
    setRulesText('');
  }, []);

  const handleClearRules = useCallback(() => {
    setRulesStatus('idle');
    setRulesText('');
    setRulesError(null);
    setPendingRules(null);
    rulesRetryCountRef.current = 0;
  }, []);

  return (
    <div className="mb-6 rounded-xl border border-indigo-700/40 bg-indigo-950/30 p-4 space-y-3">
      {/* NSFW toggle */}
      <div className="flex items-center gap-3 pb-2 border-b border-indigo-700/30">
        <label className="relative inline-flex items-center cursor-pointer">
          <input
            type="checkbox"
            checked={nsfw ?? false}
            onChange={(e) => onNsfwChange?.(e.target.checked)}
            className="sr-only peer"
          />
          <div className="w-9 h-5 bg-slate-700 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-rose-600" />
        </label>
        <div className="flex items-center gap-1.5">
          <span className="text-xs text-slate-300">NSFW 内容</span>
          <span className="text-[10px] text-slate-500">
            {nsfw ? '允许生成成人内容' : '关闭（适配模型审核）'}
          </span>
        </div>
      </div>

      <div>
        <label className="text-sm font-medium text-indigo-300">主题 / Theme</label>
        <TextInput
          value={topic}
          onChange={(e) => onTopicChange(e.target.value)}
          placeholder="例如：修仙界、魔法学院、末日废土、赛博朋克..."
        />
      </div>

      {/* ── Skeleton mode ──────────────────────────── */}
      <div className="p-3 rounded-lg bg-emerald-900/20 border border-emerald-700/30 space-y-2">
        <div className="flex items-center justify-between">
          <div>
            <label className="text-sm font-medium text-emerald-300 flex items-center gap-2 cursor-pointer select-none">
              <input
                type="checkbox"
                checked={skeletonMode}
                onChange={(e) => onSkeletonModeChange(e.target.checked)}
                className="rounded border-emerald-600 bg-slate-800 text-emerald-500"
              />
              🦴 骨架模式
            </label>
            <p className="text-[10px] text-emerald-400/60 mt-0.5 ml-6">
              快速生成简短骨架，之后用「✨ AI 展开」逐条扩展为完整设定
            </p>
          </div>
          {skeletonMode && (
            <div className="flex items-center gap-2 shrink-0">
              <span className="text-xs text-emerald-400/70">条数</span>
              <input
                type="number"
                value={skeletonCount}
                min={3}
                max={30}
                onChange={(e) => onSkeletonCountChange(Math.max(3, parseInt(e.target.value) || 6))}
                className="w-14 text-center rounded border border-emerald-600/40 bg-slate-800 px-2 py-1 text-sm font-semibold text-emerald-300"
              />
            </div>
          )}
        </div>
        {skeletonMode && (
          <div className="flex gap-1.5 ml-6">
            {[6, 10, 15, 20].map((n) => (
              <button
                key={n}
                onClick={() => onSkeletonCountChange(n)}
                className={`text-[11px] px-2 py-0.5 rounded-full border transition-colors ${
                  skeletonCount === n
                    ? 'border-emerald-500 bg-emerald-900/40 text-emerald-300'
                    : 'border-slate-600 bg-slate-700/50 text-slate-400 hover:border-emerald-600 hover:text-emerald-400'
                }`}
              >
                {n}条
              </button>
            ))}
          </div>
        )}
      </div>

      {/* ── Full mode batch count ──────────────────── */}
      {!skeletonMode && (
        <div className="flex items-center gap-3">
          <span className="text-xs text-indigo-300 shrink-0">生成条数</span>
          <input
            type="number"
            value={batchCount}
            min={3}
            max={20}
            onChange={(e) => onBatchCountChange(Math.max(3, Math.min(20, parseInt(e.target.value) || 8)))}
            className="w-14 text-center rounded border border-indigo-600/40 bg-slate-800 px-2 py-1 text-sm font-semibold text-indigo-300"
          />
          <div className="flex gap-1.5">
            {[4, 8, 12, 16].map((n) => (
              <button
                key={n}
                onClick={() => onBatchCountChange(n)}
                className={`text-[11px] px-2 py-0.5 rounded-full border transition-colors ${
                  batchCount === n
                    ? 'border-indigo-500 bg-indigo-900/40 text-indigo-300'
                    : 'border-slate-600 bg-slate-700/50 text-slate-400 hover:border-indigo-600 hover:text-indigo-400'
                }`}
              >
                {n}条
              </button>
            ))}
          </div>
        </div>
      )}

      <div>
        <div className="flex items-center justify-between mb-1">
          <label className="text-sm font-medium text-indigo-300">
            世界观约束与运行规则
            <span className="text-xs text-slate-500 font-normal ml-2">（可选，定义世界法则、扮演规则等）</span>
          </label>
          {canGenerateRules && (
            <div className="flex items-center gap-2">
              <Button
                variant="secondary"
                size="sm"
                onClick={() => handleGenerateRules(false)}
                disabled={rulesStatus === 'generating'}
              >
                {rulesStatus === 'generating'
                  ? '⏳ 生成中...'
                  : (worldRules.trim() ? '🔄 扩展规则' : '✨ AI 生成规则')
                }
              </Button>
              {pendingRules && (
                <>
                  <Button size="sm" onClick={handleAcceptRules}>✅ 采纳</Button>
                  <Button size="sm" variant="ghost" onClick={handleRejectRules}>丢弃</Button>
                </>
              )}
            </div>
          )}
        </div>

        {/* AI Progress Panel for world rules generation */}
        {rulesStatus !== 'idle' && (
          <div className="mb-3">
            <AIProgressPanel
              status={rulesStatus}
              text={rulesText}
              error={rulesError}
              title="AI 世界观规则生成"
              onClear={handleClearRules}
            />
          </div>
        )}

        <TextArea
          value={worldRules}
          onChange={(e) => onWorldRulesChange(e.target.value)}
          placeholder={`例如：\n- 修仙体系：炼气→筑基→金丹→元婴→化神→渡劫\n- 灵气复苏设定：现代都市+灵气渐浓\n- 势力格局：三大仙门+散修联盟+魔道\n- 战力规则：每个大境界分三层，突破需天材地宝\n- 扮演规则：角色严格按设定性格行事，不可崩人设`}
          rows={6}
        />
        <p className="text-[10px] text-slate-500 mt-1">
          填写世界观设定、力量体系、势力关系、运行规则等，AI 将据此生成符合约束的世界书条目
        </p>
      </div>
      <div className="flex items-center gap-2 pt-1">
        <button
          onClick={onGenerate}
          disabled={generating}
          className="inline-flex items-center justify-center gap-2 rounded-lg font-medium px-5 py-2 text-sm
            bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500
            text-white shadow-lg shadow-emerald-500/25 hover:shadow-emerald-500/40
            transition-all duration-200 hover:scale-105 active:scale-95
            disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:scale-100 cursor-pointer"
        >
          {generating ? '⏳ 生成中...' : '🚀 生成世界书'}
        </button>
        {(topic || worldRules) && (
          <span className="text-[10px] text-slate-500 ml-auto">
            {topic && '主题: ' + topic.slice(0, 30) + (topic.length > 30 ? '...' : '')}
            {topic && worldRules && ' · '}
            {worldRules && worldRules.length + ' 字规则'}
          </span>
        )}
      </div>
    </div>
  );
}