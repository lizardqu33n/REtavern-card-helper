/**
 * AIProgressPanel - Real-time AI generation progress viewer.
 * Shows streaming tokens as they arrive, with status and controls.
 */
import { useState, useEffect, useRef } from 'react';
import { useTranslation } from '../../i18n/I18nContext';

export type AIProgressStatus = 'idle' | 'generating' | 'done' | 'error';

interface AIProgressPanelProps {
  status: AIProgressStatus;
  text: string;
  error?: string | null;
  title?: string;
  onClear?: () => void;
}

export function AIProgressPanel({
  status,
  text,
  error,
  title,
  onClear,
}: AIProgressPanelProps) {
  const { t } = useTranslation();
  const displayTitle = title || t('aiProgress.titleDefault');
  const [collapsed, setCollapsed] = useState(false);
  const textRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (textRef.current && !collapsed) {
      textRef.current.scrollTop = textRef.current.scrollHeight;
    }
  }, [text, collapsed]);

  useEffect(() => {
    if (status === 'generating') {
      setCollapsed(false);
    }
  }, [status]);

  const statusConfig = {
    idle: { label: t('aiProgress.idle'), color: 'color-mix(in srgb, var(--text-color) 60%, transparent)', dot: 'bg-slate-400' },
    generating: { label: t('aiProgress.generating'), color: '#fbbf24', dot: 'bg-amber-400 animate-pulse' },
    done: { label: t('aiProgress.done'), color: '#4ade80', dot: 'bg-emerald-400' },
    error: { label: t('aiProgress.error'), color: '#f87171', dot: 'bg-red-400' },
  };

  const { label, color, dot } = statusConfig[status];
  const charCount = text.length;
  const estimatedTokens = Math.ceil(charCount / 2);
  const borderColor = 'var(--color-border-default)';

  return (
    <div className="rounded-xl border" style={{ borderColor, backgroundColor: 'rgba(15, 23, 42, 0.8)' }}>
      {/* Header */}
      <div
        className="flex items-center justify-between px-4 py-2.5 cursor-pointer select-none transition-colors hover:bg-white/5"
        style={{ borderBottom: `1px solid ${borderColor}` }}
        onClick={() => setCollapsed(!collapsed)}
      >
        <div className="flex items-center gap-2">
          <span className={`w-2 h-2 rounded-full ${dot}`} />
          <span className="text-sm font-medium" style={{ color: 'var(--text-color)' }}>{displayTitle}</span>
          <span className="text-xs" style={{ color }}>{label}</span>
        </div>
        <div className="flex items-center gap-3">
          {text && (
            <span className="text-[10px]" style={{ color: 'color-mix(in srgb, var(--text-color) 40%, transparent)' }}>
              {t('aiProgress.charTokenEstimate', { chars: String(charCount), tokens: String(estimatedTokens) })}
            </span>
          )}
          {status === 'done' && onClear && (
            <button
              onClick={(e) => { e.stopPropagation(); onClear(); }}
              className="text-xs transition-colors"
              style={{ color: 'color-mix(in srgb, var(--text-color) 60%, transparent)' }}
            >
              {t('aiProgress.clear')}
            </button>
          )}
          <svg
            className={`w-4 h-4 transition-transform ${collapsed ? '' : 'rotate-180'}`}
            style={{ color: 'color-mix(in srgb, var(--text-color) 60%, transparent)' }}
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
          </svg>
        </div>
      </div>

      {/* Content */}
      {!collapsed && (
        <div
          ref={textRef}
          className="p-4 max-h-[300px] overflow-y-auto font-mono text-sm whitespace-pre-wrap leading-relaxed"
          style={{ color: 'color-mix(in srgb, var(--text-color) 80%, transparent)' }}
        >
          {text ? (
            <span>{text}</span>
          ) : status === 'generating' ? (
            <span className="italic" style={{ color: 'color-mix(in srgb, var(--text-color) 40%, transparent)' }}>
              {t('aiProgress.waitingResponse')}
            </span>
          ) : status === 'error' ? (
            <span className="text-red-400">{error || t('aiProgress.unknownError')}</span>
          ) : (
            <span className="italic" style={{ color: 'color-mix(in srgb, var(--text-color) 40%, transparent)' }}>
              {t('aiProgress.clickToStart')}
            </span>
          )}
          {status === 'generating' && text && (
            <span className="inline-block w-2 h-4 bg-amber-400 animate-pulse ml-0.5 align-middle" />
          )}
        </div>
      )}
    </div>
  );
}
