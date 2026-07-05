/**
 * StagedLorebookModal - 分阶段世界书生成器
 *
 * 套用「高考冲刺100天」卡的阶段性触发模式：
 *   - 用户配置阶段轴变量 + 阶段列表
 *   - AI 生成各阶段子条目内容
 *   - 一键生成 1 个 constant 调度条目 + N 个 disabled 子条目
 *
 * 调度条目用 EJS if/else if + await getWorldInfo() 互斥地拉取子条目。
 */
import { useState, useMemo, useEffect } from 'react';
import { Modal } from '../shared/Modal';
import { Button } from '../shared/Button';
import { TextInput } from '../shared/TextInput';
import { TextArea } from '../shared/TextArea';
import { useToast } from '../shared/Toast';
import { useTranslation } from '../../i18n/I18nContext';
import { useAIGenerate } from '../../hooks/useAIGenerate';
import { AIProgressPanel, type AIProgressStatus } from '../shared/AIProgressPanel';
import {
  buildStagedLorebookEntries,
  buildStagesFromAxis,
  autoCondition,
  type StagedLorebookConfig,
  type StageDefinition,
  type StageAxisType,
  type NumericDirection,
} from '../../services/staged-lorebook-builder';
import type { LorebookEntry, MvuConfig } from '../../constants/defaults';

interface StagedLorebookModalProps {
  isOpen: boolean;
  onClose: () => void;
  onApply: (entries: LorebookEntry[]) => void;
  cardName: string;
  characterSummaries: string;
  existingWorldbookContext: string;
  /** MVU 配置（用于从已定义变量中快速选择阶段轴） */
  mvu?: MvuConfig;
  /** 是否允许 NSFW 内容生成 */
  nsfw?: boolean;
}

export function StagedLorebookModal({
  isOpen, onClose, onApply, cardName, characterSummaries, existingWorldbookContext, mvu, nsfw,
}: StagedLorebookModalProps) {
  const { t } = useTranslation();
  const { generateStagedLorebook, autoGenerateStagedLorebook, rerollStage } = useAIGenerate();
  const { addToast } = useToast();

  // ── 配置状态 ──────────────────────────────────────────────
  const [axisPath, setAxisPath] = useState('关系.阶段');
  const [axisType, setAxisType] = useState<StageAxisType>('enum');
  const [numericDirection, setNumericDirection] = useState<NumericDirection>('>=');
  const [bookName, setBookName] = useState(cardName || '');
  const [dispatcherName, setDispatcherName] = useState('分阶段人设');
  const [topic, setTopic] = useState('');
  const [stages, setStages] = useState<StageDefinition[]>([
    { name: '陌生人', condition: "=== '陌生人'" },
    { name: '朋友', condition: "=== '朋友'" },
    { name: '暧昧', condition: "=== '暧昧'" },
    { name: '恋人', condition: "=== '恋人'" },
  ]);

  // ── AI 生成状态 ───────────────────────────────────────────
  const [generating, setGenerating] = useState(false);
  const [aiStatus, setAiStatus] = useState<AIProgressStatus>('idle');
  const [streamText, setStreamText] = useState('');
  // 自动生成（AI 读世界书一键生成全套配置）
  const [autoGenerating, setAutoGenerating] = useState(false);
  const [autoStatus, setAutoStatus] = useState<AIProgressStatus>('idle');
  const [autoStreamText, setAutoStreamText] = useState('');
  // 单阶段重 roll
  const [rerollingIdx, setRerollingIdx] = useState<number | null>(null);
  const [stageGuidance, setStageGuidance] = useState('');

  // ── 从 MVU 变量中挑选阶段轴的候选 ─────────────────────────
  const mvuAxisCandidates = useMemo(() => {
    if (!mvu?.enabled || !mvu.schemaSections) return [];
    const list: Array<{ path: string; type: StageAxisType; enumValues?: string[]; categories?: Array<{ range: string; label: string }>; label: string }> = [];
    for (const section of mvu.schemaSections) {
      for (const v of section.variables) {
        if (v.prefix === '$') continue;
        const isEnum = v.zodType.startsWith('z.enum(');
        const isNumber = v.zodType === 'z.coerce.number()';
        if (isEnum || isNumber) {
          list.push({
            path: v.path,
            type: isEnum ? 'enum' : 'number',
            enumValues: v.enumValues,
            categories: v.categories,
            label: `${v.path} — ${v.description || v.zodType}`,
          });
        }
      }
    }
    return list;
  }, [mvu]);

  // 卡片名变化时同步默认书名
  useEffect(() => {
    if (!bookName && cardName) setBookName(cardName);
  }, [cardName, bookName]);

  /** 从 condition 字符串推断数值方向 */
  const inferDirection = (cond: string): NumericDirection => cond.trim().startsWith('<=') ? '<=' : '>=';

  /** 选择 MVU 变量作为阶段轴时，自动填充 axisPath/type/stages */
  const handlePickMvuAxis = (path: string) => {
    const cand = mvuAxisCandidates.find((c) => c.path === path);
    if (!cand) return;
    setAxisPath(cand.path);
    setAxisType(cand.type);
    if (cand.type === 'enum' && cand.enumValues?.length) {
      setStages(buildStagesFromAxis('enum', cand.enumValues));
    } else if (cand.type === 'number') {
      // 数值型：优先读取 MVU 变量的 categories（多角色套模板生成的阶段划分）
      if (cand.categories && cand.categories.length > 0) {
        const dir = inferDirection(cand.categories[0].range);
        setNumericDirection(dir);
        setStages(cand.categories.map((c) => ({ name: c.label, condition: c.range })));
      } else {
        // 没有 categories：给 3 个空阈值占位，用户填
        setStages([
          { name: '阶段一', condition: '>= 70' },
          { name: '阶段二', condition: '>= 30' },
          { name: '阶段三', condition: '>= 0' },
        ]);
      }
    }
  };

  /** 添加一个阶段 */
  const addStage = () => {
    setStages([...stages, { name: `阶段${stages.length + 1}`, condition: '' }]);
  };

  /** 更新某个阶段 */
  const updateStage = (idx: number, patch: Partial<StageDefinition>) => {
    setStages(stages.map((s, i) => (i === idx ? { ...s, ...patch } : s)));
  };

  /** 删除某个阶段 */
  const removeStage = (idx: number) => {
    setStages(stages.filter((_, i) => i !== idx));
  };

  /** 阶段名变化时自动重算 condition（若用户未手填） */
  const handleStageNameChange = (idx: number, name: string) => {
    const stage = stages[idx];
    const auto = autoCondition(axisType, axisType === 'enum' ? name : 0, numericDirection);
    updateStage(idx, { name, condition: stage.condition?.trim() ? stage.condition : auto });
  };

  /** 切换轴类型时，重算所有 condition */
  const handleAxisTypeChange = (type: StageAxisType) => {
    setAxisType(type);
    setStages(stages.map((s) => ({
      ...s,
      condition: autoCondition(type, type === 'enum' ? s.name : 0, numericDirection),
    })));
  };

  /** 切换数值方向时，重算 condition */
  const handleDirectionChange = (dir: NumericDirection) => {
    setNumericDirection(dir);
    if (axisType === 'number') {
      setStages(stages.map((s) => {
        // 从旧 condition 提取阈值数字
        const m = (s.condition || '').match(/-?\d+(\.\d+)?/);
        const n = m ? Number(m[0]) : 0;
        return { ...s, condition: autoCondition('number', n, dir) };
      }));
    }
  };

  /** AI 生成各阶段内容 */
  const handleGenerate = async () => {
    if (!stages.length) {
      addToast('error', t('stagedLorebook.needStages'));
      return;
    }
    setGenerating(true);
    setAiStatus('generating');
    setStreamText('');
    try {
      const results = await generateStagedLorebook(
        cardName, characterSummaries, axisPath, stages, topic, existingWorldbookContext, !!nsfw,
        (_chunk, full) => setStreamText(full),
      );
      if (results.length === 0 || results.every((r) => !r.content)) {
        addToast('error', t('stagedLorebook.generateFailed'));
        setAiStatus('error');
        return;
      }
      setStages(stages.map((s, i) => ({ ...s, content: results[i]?.content || s.content || '' })));
      setAiStatus('done');
      addToast('success', t('stagedLorebook.generateDone'));
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : t('common.unknownError');
      setAiStatus('error');
      setStreamText(msg);
      addToast('error', t('stagedLorebook.generateFailed') + `: ${msg}`);
    } finally {
      setGenerating(false);
    }
  };

  /** AI 读世界书自动生成全套配置 */
  const handleAutoGenerate = async () => {
    setAutoGenerating(true);
    setAutoStatus('generating');
    setAutoStreamText('');
    try {
      const result = await autoGenerateStagedLorebook(
        cardName, characterSummaries, existingWorldbookContext, topic, !!nsfw,
        (_chunk, full) => setAutoStreamText(full),
      );
      if (!result) {
        addToast('error', t('stagedLorebook.generateFailed'));
        setAutoStatus('error');
        return;
      }
      setAxisPath(result.axisPath);
      setAxisType(result.axisType);
      setNumericDirection(result.numericDirection);
      setStages(result.stages);
      setAutoStatus('done');
      addToast('success', t('stagedLorebook.autoGenerateDone'));
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : t('common.unknownError');
      setAutoStatus('error');
      setAutoStreamText(msg);
      addToast('error', t('stagedLorebook.generateFailed') + `: ${msg}`);
    } finally {
      setAutoGenerating(false);
    }
  };

  /** 单阶段重 roll */
  const handleRerollStage = async (idx: number) => {
    const stage = stages[idx];
    if (!stage) return;
    setRerollingIdx(idx);
    try {
      const siblings = stages.filter((_, i) => i !== idx).map((s) => ({ name: s.name, content: s.content }));
      const newContent = await rerollStage(
        cardName, characterSummaries, axisPath, stage.name, stage.condition || '',
        siblings, existingWorldbookContext, stageGuidance, !!nsfw,
      );
      if (newContent) {
        setStages(stages.map((s, i) => (i === idx ? { ...s, content: newContent } : s)));
        addToast('success', t('stagedLorebook.rerollDone', { name: stage.name }));
      } else {
        addToast('error', t('stagedLorebook.generateFailed'));
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : t('common.unknownError');
      addToast('error', t('stagedLorebook.generateFailed') + `: ${msg}`);
    } finally {
      setRerollingIdx(null);
    }
  };

  /** 应用：构建条目并回调 */
  const handleApply = () => {
    if (!stages.length) {
      addToast('error', t('stagedLorebook.needStages'));
      return;
    }
    if (!axisPath.trim() || !bookName.trim() || !dispatcherName.trim()) {
      addToast('error', t('stagedLorebook.needRequired'));
      return;
    }
    const config: StagedLorebookConfig = {
      axisPath: axisPath.trim(),
      axisType,
      numericDirection,
      bookName: bookName.trim(),
      dispatcherName: dispatcherName.trim(),
      stages: stages.map((s) => ({
        name: s.name.trim() || `阶段${stages.indexOf(s) + 1}`,
        condition: s.condition?.trim() || autoCondition(axisType, axisType === 'enum' ? s.name : 0, numericDirection),
        content: s.content,
      })),
      description: t('stagedLorebook.dispatcherDesc'),
    };
    const entries = buildStagedLorebookEntries(config);
    onApply(entries);
    addToast('success', t('stagedLorebook.applyDone', { count: String(entries.length) }));
    onClose();
  };

  const fieldCls = 'w-full rounded border px-2 py-1 text-sm focus:outline-none focus:ring-1 focus:ring-[var(--color-primary)]';
  const labelCls = 'text-xs';
  const borderColor = 'var(--color-border-default)';

  return (
    <Modal isOpen={isOpen} onClose={onClose} title={t('stagedLorebook.title')} maxWidth="max-w-3xl">
      <div className="space-y-4 max-h-[75vh] overflow-y-auto pr-1">
        {/* 说明 */}
        <div className="rounded-lg bg-teal-900/20 border border-teal-700/40 px-3 py-2 text-[11px] text-teal-200 leading-relaxed">
          {t('stagedLorebook.intro')}
        </div>

        {/* AI 读世界书自动生成 */}
        <div className="rounded-lg border border-violet-700/40 bg-violet-900/15 p-3 space-y-2">
          <p className="text-xs font-medium text-violet-300">🤖 {t('stagedLorebook.autoGenerateTitle')}</p>
          <p className="text-[11px] text-slate-400 leading-relaxed">{t('stagedLorebook.autoGenerateHint')}</p>
          <TextArea
            value={topic}
            onChange={(e) => setTopic(e.target.value)}
            placeholder={t('stagedLorebook.autoGenerateGuidancePlaceholder')}
            rows={2}
          />
          <div className="flex items-center gap-2">
            <Button
              variant="secondary"
              size="sm"
              onClick={handleAutoGenerate}
              disabled={autoGenerating || generating}
            >
              {autoGenerating ? t('stagedLorebook.autoGenerating') : `✨ ${t('stagedLorebook.autoGenerateButton')}`}
            </Button>
            <span className="text-[10px] text-slate-500">{t('stagedLorebook.autoGenerateSubHint')}</span>
          </div>
          {autoStatus !== 'idle' && autoStatus !== 'done' && (
            <AIProgressPanel status={autoStatus} text={autoStreamText} />
          )}
        </div>

        {/* 阶段轴配置 */}
        <div className="rounded-lg border border-slate-700/50 p-3 space-y-2">
          <p className="text-xs font-medium text-slate-300">{t('stagedLorebook.axisConfigTitle')}</p>
          {mvuAxisCandidates.length > 0 && (
            <div>
              <label className={labelCls + ' text-slate-400'}>{t('stagedLorebook.pickFromMvu')}</label>
              <select
                onChange={(e) => e.target.value && handlePickMvuAxis(e.target.value)}
                value=""
                className={fieldCls}
                style={{ borderColor, backgroundColor: 'var(--input-bg)', color: 'var(--text-color)' }}
              >
                <option value="">{t('stagedLorebook.pickFromMvuPlaceholder')}</option>
                {mvuAxisCandidates.map((c) => (
                  <option key={c.path} value={c.path}>{c.label}</option>
                ))}
              </select>
            </div>
          )}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
            <TextInput
              label={t('stagedLorebook.axisPathLabel')}
              value={axisPath}
              onChange={(e) => setAxisPath(e.target.value)}
              placeholder={t('stagedLorebook.axisPathPlaceholder')}
            />
            <div>
              <label className={labelCls + ' text-slate-400'}>{t('stagedLorebook.axisTypeLabel')}</label>
              <select
                value={axisType}
                onChange={(e) => handleAxisTypeChange(e.target.value as StageAxisType)}
                className={fieldCls}
                style={{ borderColor, backgroundColor: 'var(--input-bg)', color: 'var(--text-color)' }}
              >
                <option value="enum">{t('stagedLorebook.axisTypeEnum')}</option>
                <option value="number">{t('stagedLorebook.axisTypeNumber')}</option>
              </select>
            </div>
            {axisType === 'number' && (
              <div>
                <label className={labelCls + ' text-slate-400'}>{t('stagedLorebook.directionLabel')}</label>
                <select
                  value={numericDirection}
                  onChange={(e) => handleDirectionChange(e.target.value as NumericDirection)}
                  className={fieldCls}
                  style={{ borderColor, backgroundColor: 'var(--input-bg)', color: 'var(--text-color)' }}
                >
                  <option value=">=">{t('stagedLorebook.directionGe')}</option>
                  <option value="<=">{t('stagedLorebook.directionLe')}</option>
                </select>
              </div>
            )}
          </div>
        </div>

        {/* 调度条目配置 */}
        <div className="rounded-lg border border-slate-700/50 p-3 space-y-2">
          <p className="text-xs font-medium text-slate-300">{t('stagedLorebook.dispatcherConfigTitle')}</p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            <TextInput
              label={t('stagedLorebook.dispatcherNameLabel')}
              value={dispatcherName}
              onChange={(e) => setDispatcherName(e.target.value)}
              placeholder={t('stagedLorebook.dispatcherNamePlaceholder')}
            />
            <TextInput
              label={t('stagedLorebook.bookNameLabel')}
              value={bookName}
              onChange={(e) => setBookName(e.target.value)}
              placeholder={t('stagedLorebook.bookNamePlaceholder')}
            />
          </div>
        </div>

        {/* 阶段列表 */}
        <div className="rounded-lg border border-slate-700/50 p-3 space-y-2">
          <div className="flex items-center justify-between">
            <p className="text-xs font-medium text-slate-300">{t('stagedLorebook.stagesTitle')}</p>
            <Button variant="ghost" size="sm" onClick={addStage} disabled={generating}>+ {t('stagedLorebook.addStage')}</Button>
          </div>
          <div className="space-y-2">
            {stages.map((stage, idx) => (
              <div key={idx} className="rounded border border-slate-700/40 p-2 space-y-2 bg-slate-900/30">
                <div className="grid grid-cols-[1fr,1fr,auto] gap-2 items-end">
                  <TextInput
                    label={t('stagedLorebook.stageNameLabel')}
                    value={stage.name}
                    onChange={(e) => handleStageNameChange(idx, e.target.value)}
                    placeholder={t('stagedLorebook.stageNamePlaceholder')}
                  />
                  <TextInput
                    label={t('stagedLorebook.stageConditionLabel')}
                    value={stage.condition || ''}
                    onChange={(e) => updateStage(idx, { condition: e.target.value })}
                    placeholder={t('stagedLorebook.stageConditionPlaceholder')}
                  />
                  <Button variant="danger" size="sm" onClick={() => removeStage(idx)} disabled={generating}>&times;</Button>
                </div>
                <TextArea
                  label={t('stagedLorebook.stageContentLabel')}
                  value={stage.content || ''}
                  onChange={(e) => updateStage(idx, { content: e.target.value })}
                  placeholder={t('stagedLorebook.stageContentPlaceholder')}
                  rows={3}
                />
                <div className="flex flex-wrap items-center gap-2">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => handleRerollStage(idx)}
                    disabled={rerollingIdx !== null || autoGenerating || generating}
                  >
                    {rerollingIdx === idx ? t('stagedLorebook.rerolling') : `🎲 ${t('stagedLorebook.rerollButton')}`}
                  </Button>
                  <input
                    type="text"
                    value={stageGuidance}
                    onChange={(e) => setStageGuidance(e.target.value)}
                    placeholder={t('stagedLorebook.rerollGuidancePlaceholder')}
                    className="flex-1 min-w-[160px] rounded border px-2 py-1 text-[11px] focus:outline-none focus:ring-1 focus:ring-[var(--color-primary)]"
                    style={{ borderColor: 'var(--color-border-default)', backgroundColor: 'var(--input-bg)', color: 'var(--text-color)' }}
                    disabled={rerollingIdx !== null}
                  />
                </div>
              </div>
            ))}
          </div>
          <p className="text-[10px] text-slate-500">{t('stagedLorebook.stagesHint')}</p>
        </div>

        {/* AI 生成 */}
        <div className="rounded-lg border border-amber-700/30 bg-amber-900/10 p-3 space-y-2">
          <p className="text-xs font-medium text-amber-300">🤖 {t('stagedLorebook.aiGenerateTitle')}</p>
          <p className="text-[11px] text-slate-400">{t('stagedLorebook.aiGenerateSubHint')}</p>
          <div className="flex items-center gap-2">
            <Button variant="secondary" size="sm" onClick={handleGenerate} disabled={generating || autoGenerating || !stages.length}>
              {generating ? t('stagedLorebook.generating') : `⚡ ${t('stagedLorebook.generateButton')}`}
            </Button>
            <span className="text-[10px] text-slate-500">{t('stagedLorebook.aiHint')}</span>
          </div>
          {aiStatus !== 'idle' && aiStatus !== 'done' && (
            <AIProgressPanel status={aiStatus} text={streamText} />
          )}
        </div>

        {/* 底部操作 */}
        <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-700/40">
          <Button variant="ghost" size="sm" onClick={onClose} disabled={generating || autoGenerating || rerollingIdx !== null}>{t('common.cancel')}</Button>
          <Button variant="primary" size="sm" onClick={handleApply} disabled={generating || autoGenerating || rerollingIdx !== null || !stages.length}>
            {t('stagedLorebook.applyButton')}
          </Button>
        </div>
      </div>
    </Modal>
  );
}
