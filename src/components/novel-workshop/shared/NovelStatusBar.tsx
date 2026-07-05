/**
 * NovelStatusBar - Status text display for Novel Workshop
 * Migrated from .temp_statusbar.astro
 */

interface NovelStatusBarProps {
  text: string;
  color: string;
}

export function NovelStatusBar({ text, color }: NovelStatusBarProps) {
  if (!text) return null;

  return (
    <div
      id="novelStatusText"
      className="status-text novel-status-text"
      style={{ color }}
    >
      {text}
    </div>
  );
}
