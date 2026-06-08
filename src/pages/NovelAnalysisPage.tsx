import { useMemo, useRef, useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { FileText, Download, Sparkles, BookMarked } from 'lucide-react';
import { Button } from '../components/shared/Button';
import { TextArea } from '../components/shared/TextArea';
import {
  DEFAULT_NOVEL_OUTPUT_MAX_TOKENS,
  analyzeNovelText,
  analyzeNovelTextStreaming,
  exportAnalysisAsJson,
  saveAnalysisLorebookImport,
  splitNovelText,
  type NovelAnalysisResult,
  type NovelChunk,
} from '../services/novel-analysis-service';

function downloadText(filename: string, content: string) {
  const blob = new Blob([content], { type: 'application/json;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

function Stat({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="rounded-lg border border-slate-700/50 bg-slate-900/40 p-3">
      <div className="text-[11px] text-slate-500">{label}</div>
      <div className="mt-1 text-sm font-semibold text-slate-100">{value}</div>
    </div>
  );
}

type TokenMode = 'standard' | 'large' | 'extreme' | 'custom';

const TOKEN_MODE_OPTIONS: Array<{ value: TokenMode; label: string; tokens: number; description: string }> = [
  { value: 'standard', label: '标准', tokens: DEFAULT_NOVEL_OUTPUT_MAX_TOKENS, description: '适合普通章节抽样' },
  { value: 'large', label: '大型', tokens: 32000, description: '更充分拆分人物和设定' },
  { value: 'extreme', label: '极限', tokens: 128000, description: '适合长篇、多人物、多设定' },
  { value: 'custom', label: '自定义', tokens: DEFAULT_NOVEL_OUTPUT_MAX_TOKENS, description: '按模型能力手动填写' },
];

function getTokenModeValue(mode: TokenMode, customTokens: number): number {
  if (mode === 'custom') return customTokens;
  return TOKEN_MODE_OPTIONS.find((option) => option.value === mode)?.tokens ?? DEFAULT_NOVEL_OUTPUT_MAX_TOKENS;
}

export function NovelAnalysisPage() {
  const navigate = useNavigate();
  const fileRef = useRef<HTMLInputElement>(null);
  const [title, setTitle] = useState('');
  const [text, setText] = useState('');
  const [chunks, setChunks] = useState<NovelChunk[]>([]);
  const [analysis, setAnalysis] = useState<NovelAnalysisResult | null>(null);
  const [tokenMode, setTokenMode] = useState<TokenMode>('standard');
  const [customOutputTokens, setCustomOutputTokens] = useState(DEFAULT_NOVEL_OUTPUT_MAX_TOKENS);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [streamingText, setStreamingText] = useState('');
  const [progressPercent, setProgressPercent] = useState(0);
  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  const streamPanelRef = useRef<HTMLDivElement>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Auto-scroll streaming text to bottom
  useEffect(() => {
    if (streamPanelRef.current) {
      streamPanelRef.current.scrollTop = streamPanelRef.current.scrollHeight;
    }
  }, [streamingText]);

  // Elapsed timer during analysis
  useEffect(() => {
    if (loading) {
      setElapsedSeconds(0);
      timerRef.current = setInterval(() => setElapsedSeconds(s => s + 1), 1000);
    } else {
      if (timerRef.current) { clearInterval(timerRef.current); timerRef.current = null; }
    }
    return () => { if (timerRef.current) clearInterval(timerRef.current); };
  }, [loading]);

  const totalChars = useMemo(() => text.trim().length, [text]);
  const outputMaxTokens = useMemo(() => getTokenModeValue(tokenMode, customOutputTokens), [tokenMode, customOutputTokens]);
  const lorebookCategoryCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    analysis?.lorebookEntries.forEach((entry) => {
      const category = entry.category || '素材';
      counts[category] = (counts[category] || 0) + 1;
    });
    return counts;
  }, [analysis]);

  const handleChunk = () => {
    setError('');
    setAnalysis(null);
    const nextChunks = splitNovelText(text);
    setChunks(nextChunks);
    if (nextChunks.length === 0) setError('请先输入或上传小说文本');
  };

  const handleAnalyze = async () => {
    setError('');
    setStreamingText('');
    setProgressPercent(0);
    const nextChunks = chunks.length > 0 ? chunks : splitNovelText(text);
    setChunks(nextChunks);
    if (nextChunks.length === 0) {
      setError('请先输入或上传小说文本');
      return;
    }

    setLoading(true);
    try {
      const result = await analyzeNovelTextStreaming(
        title,
        nextChunks,
        outputMaxTokens,
        (chunk, fullText) => {
          setStreamingText(fullText);
          // Estimate progress: roughly based on character count versus expected output
          const estimatedChars = outputMaxTokens * 2; // rough: ~2 chars per token
          const pct = Math.min(Math.round((fullText.length / estimatedChars) * 100), 99);
          setProgressPercent(pct);
        },
      );
      setProgressPercent(100);
      setStreamingText('');
      setAnalysis(result);
    } catch (err) {
      setError(err instanceof Error ? err.message : '小说分析失败');
    } finally {
      setLoading(false);
    }
  };

  const handleFile = async (file: File) => {
    setError('');
    setAnalysis(null);
    const content = await file.text();
    setText(content);
    setTitle(file.name.replace(/\.[^.]+$/, ''));
    setChunks(splitNovelText(content));
  };

  const handleExport = () => {
    if (!analysis) return;
    downloadText(`${title || 'novel-analysis'}.json`, exportAnalysisAsJson(title, chunks, analysis));
  };

  const handleImportToWizard = () => {
    if (!analysis) return;
    saveAnalysisLorebookImport(title, analysis);
    navigate('/wizard?fromNovelAnalysis=1');
  };

  return (
    <div className="max-w-6xl mx-auto space-y-5 animate-fade-in">
      <input
        ref={fileRef}
        type="file"
        accept=".txt,.md,text/plain,text/markdown"
        className="hidden"
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) void handleFile(file);
        }}
      />

      <div className="rounded-2xl border border-emerald-700/30 bg-emerald-950/20 p-5 shadow-lg shadow-emerald-950/20">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <div className="flex items-center gap-2">
              <BookMarked className="text-emerald-300" size={22} />
              <h1 className="text-2xl font-bold text-slate-100">小说分析提取</h1>
            </div>
            <p className="mt-2 text-sm text-slate-400">
              按世界书结构拆分小说素材：人物、外貌着装、关系枢纽、事件、地点、势力、特定设定与文风都会分条生成。
            </p>
          </div>
          <Button variant="secondary" onClick={() => fileRef.current?.click()}>
            <FileText size={16} /> 上传 TXT
          </Button>
        </div>
      </div>

      <div className="grid gap-5 lg:grid-cols-[1.05fr_0.95fr]">
        <div className="space-y-4 rounded-xl border border-slate-700/50 bg-slate-900/35 p-4 backdrop-blur-sm">
          <div>
            <label className="mb-1 block text-sm font-medium text-slate-300">小说标题</label>
            <input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="可选，例如：斗罗大陆"
              className="w-full rounded-lg border border-slate-600 bg-slate-800 px-3 py-2 text-sm text-slate-100 placeholder-slate-500 focus:border-emerald-500 focus:outline-none"
            />
          </div>

          <div className="rounded-lg border border-slate-700/50 bg-slate-950/30 p-3">
            <div className="mb-2 flex items-center justify-between gap-3">
              <label className="text-sm font-medium text-slate-300">小说分析输出 Token 模式</label>
              <span className="text-xs text-emerald-300">当前：{outputMaxTokens.toLocaleString()} tokens</span>
            </div>
            <div className="grid gap-2 sm:grid-cols-4">
              {TOKEN_MODE_OPTIONS.map((option) => (
                <button
                  key={option.value}
                  type="button"
                  onClick={() => setTokenMode(option.value)}
                  className={`rounded-lg border px-3 py-2 text-left transition ${tokenMode === option.value ? 'border-emerald-500 bg-emerald-950/40 text-emerald-100' : 'border-slate-700 bg-slate-900/40 text-slate-300 hover:border-slate-500'}`}
                >
                  <div className="text-sm font-semibold">{option.label}</div>
                  <div className="mt-0.5 text-[11px] text-slate-500">{option.value === 'custom' ? '手动填写' : `${option.tokens.toLocaleString()} tokens`}</div>
                  <div className="mt-1 text-[10px] text-slate-500">{option.description}</div>
                </button>
              ))}
            </div>
            {tokenMode === 'custom' && (
              <div className="mt-3">
                <input
                  type="number"
                  min={4000}
                  max={300000}
                  step={1000}
                  value={customOutputTokens}
                  onChange={(e) => setCustomOutputTokens(parseInt(e.target.value) || DEFAULT_NOVEL_OUTPUT_MAX_TOKENS)}
                  className="w-full rounded-lg border border-slate-600 bg-slate-800 px-3 py-2 text-sm text-slate-100 focus:border-emerald-500 focus:outline-none"
                />
                <p className="mt-1 text-[11px] text-slate-500">范围 4000 - 200000，最终是否可用取决于当前模型和中转站支持。</p>
              </div>
            )}
          </div>

          <TextArea
            label="小说文本"
            value={text}
            onChange={(e) => {
              setText(e.target.value);
              setAnalysis(null);
              setChunks([]);
            }}
            placeholder="粘贴小说正文，或上传 .txt 文件。系统会自动识别 第X章 / 番外 / 序章 等章节标题。"
            className="min-h-[360px]"
          />

          {error && (
            <div className="rounded-lg border border-red-700/50 bg-red-900/20 p-3 text-sm text-red-300">
              {error}
            </div>
          )}

          {/* Streaming Monitoring Panel — “创作者无法介入” read-only dashboard */}
          {loading && (
            <div className="rounded-xl border-2 border-amber-600/50 bg-gradient-to-b from-amber-950/30 to-slate-950/60 overflow-hidden animate-fade-in">
              {/* Header bar */}
              <div className="flex items-center justify-between px-4 py-3 bg-amber-900/30 border-b border-amber-700/40">
                <div className="flex items-center gap-2">
                  <span className="relative flex h-3 w-3">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-amber-400 opacity-75"></span>
                    <span className="relative inline-flex rounded-full h-3 w-3 bg-amber-500"></span>
                  </span>
                  <span className="text-sm font-bold text-amber-200">
                    <Sparkles size={14} className="inline mr-1" />
                    AI 正在结构化分析中
                  </span>
                </div>
                <div className="flex items-center gap-3 text-xs">
                  <span className="text-amber-300/80 font-mono">
                    ⏱ {Math.floor(elapsedSeconds / 60).toString().padStart(2, '0')}:{(elapsedSeconds % 60).toString().padStart(2, '0')}
                  </span>
                  <span className="text-amber-300/80 font-mono">
                    {streamingText.length} 字
                  </span>
                  <span className="text-amber-300 font-bold text-sm">
                    {progressPercent}%
                  </span>
                </div>
              </div>
          
              {/* Progress bar */}
              <div className="px-4 pt-3">
                <div className="h-3 w-full overflow-hidden rounded-full bg-slate-800/80 shadow-inner">
                  <div
                    className="h-full rounded-full bg-gradient-to-r from-amber-500 via-yellow-400 to-emerald-500 transition-all duration-500 ease-out relative"
                    style={{ width: `${Math.max(progressPercent, 2)}%` }}
                  >
                    <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/20 to-transparent animate-pulse" />
                  </div>
                </div>
                <div className="flex justify-between mt-1 text-[10px] text-slate-500">
                  <span>开始</span>
                  <span>≈{Math.round(outputMaxTokens * 2).toLocaleString()} 字</span>
                  <span>完成</span>
                </div>
              </div>
          
              {/* Streaming text preview — auto-scrolling */}
              <div className="px-4 py-3">
                <div className="flex items-center justify-between mb-1.5">
                  <span className="text-[11px] font-medium text-slate-400">实时输出流</span>
                  <span className="text-[10px] text-slate-600">自动滚动 · 只读</span>
                </div>
                <div
                  ref={streamPanelRef}
                  className="h-56 overflow-y-auto rounded-lg border border-slate-700/50 bg-slate-950/70 p-3 scrollbar-thin scrollbar-thumb-slate-700"
                >
                  <pre className="whitespace-pre-wrap text-xs text-slate-300 leading-relaxed font-mono selection:bg-amber-500/30">
                    {streamingText || '等待 AI 响应...'}
                  </pre>
                  {streamingText && (
                    <span className="inline-block w-2 h-4 bg-amber-400/80 animate-pulse ml-0.5 align-middle" />
                  )}
                </div>
              </div>
          
              {/* Footer — “创作者无法介入” */}
              <div className="px-4 py-2.5 bg-slate-900/50 border-t border-slate-700/30 text-center">
                <p className="text-[11px] text-amber-500/80">
                  🚫 <strong>创作者无法介入</strong> — AI 正在生成结构化世界书分析，请勿操作，耐心等待完成
                </p>
              </div>
            </div>
          )}

          <div className="flex flex-wrap gap-2">
            <Button variant="secondary" onClick={handleChunk} disabled={!text.trim()}>
              智能切块
            </Button>
            <Button onClick={handleAnalyze} disabled={loading || !text.trim()}>
              <Sparkles size={16} /> {loading ? '分析中...' : 'AI 分析提取'}
            </Button>
            <Button variant="ghost" onClick={handleExport} disabled={!analysis}>
              <Download size={16} /> 导出结果
            </Button>
            <Button variant="secondary" onClick={handleImportToWizard} disabled={!analysis || (analysis?.lorebookEntries.length ?? 0) === 0}>
              导入到世界书
            </Button>
          </div>
        </div>

        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 lg:grid-cols-2">
            <Stat label="文本字数" value={totalChars} />
            <Stat label="切块数量" value={chunks.length} />
            <Stat label="输出上限" value={outputMaxTokens.toLocaleString()} />
            <Stat label="人物" value={analysis?.characters.length ?? '-'} />
            <Stat label="世界书条目" value={analysis?.lorebookEntries.length ?? '-'} />
            <Stat label="人物关系" value={analysis?.relationshipMap.length ?? '-'} />
            <Stat label="特定设定" value={analysis?.uniqueSettings.length ?? '-'} />
          </div>

          <div className="rounded-xl border border-slate-700/50 bg-slate-900/35 p-4 backdrop-blur-sm">
            <h2 className="mb-3 text-sm font-semibold text-slate-200">切块预览</h2>
            {chunks.length === 0 ? (
              <p className="text-sm text-slate-500">暂无切块。点击“智能切块”后查看章节结构。</p>
            ) : (
              <div className="max-h-60 space-y-2 overflow-y-auto pr-1">
                {chunks.slice(0, 20).map((chunk) => (
                  <div key={chunk.id} className="rounded-lg bg-slate-800/60 px-3 py-2 text-xs">
                    <div className="font-medium text-slate-200">#{chunk.id} {chunk.title}</div>
                    <div className="mt-1 text-slate-500">{chunk.content.length} 字</div>
                  </div>
                ))}
                {chunks.length > 20 && <div className="text-xs text-slate-500">仅显示前 20 个切块</div>}
              </div>
            )}
          </div>
        </div>
      </div>

      {analysis && (
        <div className="space-y-4 rounded-xl border border-slate-700/50 bg-slate-900/35 p-4 backdrop-blur-sm animate-fade-in-up">
          <div>
            <h2 className="text-lg font-semibold text-slate-100">分析结果</h2>
            <p className="mt-1 text-sm text-slate-400">{analysis.genre} · {analysis.tone}</p>
          </div>

          <section>
            <h3 className="mb-2 text-sm font-medium text-emerald-300">摘要</h3>
            <p className="whitespace-pre-wrap rounded-lg bg-slate-800/50 p-3 text-sm text-slate-300">{analysis.summary}</p>
          </section>

          <section>
            <h3 className="mb-2 text-sm font-medium text-emerald-300">文风画像</h3>
            <div className="grid gap-3 lg:grid-cols-2">
              <div className="rounded-lg bg-slate-800/50 p-3 text-sm text-slate-300">
                <div className="font-medium text-slate-100">叙述</div>
                <p className="mt-1 text-slate-400">{analysis.styleProfile.narration || '无'}</p>
              </div>
              <div className="rounded-lg bg-slate-800/50 p-3 text-sm text-slate-300">
                <div className="font-medium text-slate-100">对白</div>
                <p className="mt-1 text-slate-400">{analysis.styleProfile.dialogue || '无'}</p>
              </div>
              <div className="rounded-lg bg-slate-800/50 p-3 text-sm text-slate-300">
                <div className="font-medium text-slate-100">节奏</div>
                <p className="mt-1 text-slate-400">{analysis.styleProfile.pacing || '无'}</p>
              </div>
              <div className="rounded-lg bg-slate-800/50 p-3 text-sm text-slate-300">
                <div className="font-medium text-slate-100">意象</div>
                <p className="mt-1 text-slate-400">{analysis.styleProfile.imagery || '无'}</p>
              </div>
            </div>
            {analysis.styleProfile.taboos.length > 0 && (
              <div className="mt-3 rounded-lg border border-amber-700/40 bg-amber-950/20 p-3 text-sm text-amber-200">
                避免：{analysis.styleProfile.taboos.join('、')}
              </div>
            )}
          </section>

          <section className="grid gap-4 lg:grid-cols-2">
            <div>
              <h3 className="mb-2 text-sm font-medium text-emerald-300">人物逻辑枢纽</h3>
              <div className="space-y-2">
                {analysis.characters.map((item, index) => (
                  <div key={`${item.name}-${index}`} className="rounded-lg border border-slate-700/40 bg-slate-800/40 p-3 text-sm">
                    <div className="font-semibold text-slate-100">{item.name} <span className="text-xs text-slate-500">{item.role}</span></div>
                    <div className="mt-1 text-slate-400">逻辑枢纽：{item.logicHub || '无'}</div>
                    <div className="mt-1 text-slate-500">外貌：{item.appearance || '无'}</div>
                    {item.outfits?.length > 0 && <div className="mt-1 text-slate-500">着装：{item.outfits.map((outfit) => `${outfit.scene}：${outfit.description}`).join('；')}</div>}
                    <div className="mt-1 text-slate-500">依据：{item.evidence}</div>
                  </div>
                ))}
              </div>
            </div>

            <div>
              <h3 className="mb-2 text-sm font-medium text-emerald-300">人物关系网络</h3>
              <div className="space-y-2">
                {analysis.relationshipMap.map((item, index) => (
                  <div key={`${item.source}-${item.target}-${index}`} className="rounded-lg border border-slate-700/40 bg-slate-800/40 p-3 text-sm">
                    <div className="font-semibold text-slate-100">{item.source} → {item.target}</div>
                    <div className="mt-1 text-slate-400">{item.relation}：{item.conflictOrBond}</div>
                    <div className="mt-1 text-slate-500">叙事功能：{item.storyFunction}</div>
                  </div>
                ))}
                {analysis.relationshipMap.length === 0 && <p className="text-sm text-slate-500">暂无关系网络。</p>}
              </div>
            </div>
          </section>

          <section className="grid gap-4 lg:grid-cols-2">
            <div>
              <h3 className="mb-2 text-sm font-medium text-emerald-300">特定设定</h3>
              <div className="space-y-2">
                {analysis.uniqueSettings.map((item, index) => (
                  <div key={`${item.name}-${index}`} className="rounded-lg border border-slate-700/40 bg-slate-800/40 p-3 text-sm">
                    <div className="font-semibold text-slate-100">{item.name} <span className="text-xs text-emerald-300">{item.category}</span></div>
                    <div className="mt-1 text-slate-400">{item.description}</div>
                    <div className="mt-1 text-slate-500">独特性：{item.difference}</div>
                    <div className="mt-1 text-slate-500">用途：{item.usage}</div>
                  </div>
                ))}
                {analysis.uniqueSettings.length === 0 && <p className="text-sm text-slate-500">暂无特定设定。</p>}
              </div>
            </div>

            <div>
              <h3 className="mb-2 text-sm font-medium text-emerald-300">事件时间线</h3>
              <div className="space-y-2">
                {analysis.timeline.map((item) => (
                  <div key={item.order} className="rounded-lg border border-slate-700/40 bg-slate-800/40 p-3 text-sm">
                    <div className="font-semibold text-slate-100">{item.order}. {item.event}</div>
                    <div className="mt-1 text-slate-500">影响：{item.impact}</div>
                  </div>
                ))}
              </div>
            </div>
          </section>

          <section>
            <div className="mb-3 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
              <h3 className="text-sm font-medium text-emerald-300">世界书条目</h3>
              <div className="flex flex-wrap gap-1.5">
                {Object.entries(lorebookCategoryCounts).map(([category, count]) => (
                  <span key={category} className="rounded-full bg-emerald-900/30 px-2 py-0.5 text-[11px] text-emerald-200">
                    {category} × {count}
                  </span>
                ))}
              </div>
            </div>
            <div className="grid gap-3 lg:grid-cols-2">
              {analysis.lorebookEntries.map((entry, index) => (
                <div key={`${entry.name}-${index}`} className="rounded-lg border border-slate-700/40 bg-slate-800/40 p-3">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-semibold text-slate-100">{entry.name}</span>
                    <span className="rounded bg-emerald-900/40 px-1.5 py-0.5 text-[10px] text-emerald-300">{entry.category}</span>
                  </div>
                  <div className="mt-2 text-xs text-slate-500">触发词：{entry.keys?.join('、')}</div>
                  {(entry.parent || entry.purpose) && (
                    <div className="mt-1 text-xs text-slate-500">
                      {entry.parent && <span>归属：{entry.parent}</span>}
                      {entry.parent && entry.purpose && <span> · </span>}
                      {entry.purpose && <span>用途：{entry.purpose}</span>}
                    </div>
                  )}
                  <pre className="mt-2 whitespace-pre-wrap rounded bg-slate-950/40 p-2 text-xs text-slate-300">{entry.content}</pre>
                </div>
              ))}
            </div>
          </section>

          {analysis.cleaningNotes.length > 0 && (
            <section>
              <h3 className="mb-2 text-sm font-medium text-amber-300">清洗提示</h3>
              <ul className="list-disc space-y-1 pl-5 text-sm text-slate-400">
                {analysis.cleaningNotes.map((note, index) => <li key={index}>{note}</li>)}
              </ul>
            </section>
          )}
        </div>
      )}
    </div>
  );
}
