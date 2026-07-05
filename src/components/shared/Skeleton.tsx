/**
 * Skeleton - Loading placeholder component with shimmer animation.
 * Use for page-level loading states (Library, Chat, Preset, etc.)
 */
interface SkeletonProps {
  className?: string;
  variant?: 'text' | 'rect' | 'circle' | 'card';
  lines?: number;
}

export function Skeleton({ className = '', variant = 'text', lines = 1 }: SkeletonProps) {
  const base = 'animate-shimmer rounded';

  const variants: Record<string, string> = {
    text: 'h-4 w-full rounded',
    rect: 'h-24 w-full rounded-lg',
    circle: 'h-10 w-10 rounded-full',
    card: 'h-32 w-full rounded-xl',
  };

  if (variant === 'text' && lines > 1) {
    return (
      <div className={`space-y-2 ${className}`}>
        {Array.from({ length: lines }, (_, i) => (
          <div
            key={i}
            className={`${base} ${variants.text}`}
            style={i === lines - 1 ? { width: '60%' } : undefined}
          />
        ))}
      </div>
    );
  }

  return <div className={`${base} ${variants[variant]} ${className}`} />;
}

/**
 * Pre-composed skeleton layouts for common page patterns.
 */
export function SkeletonCardGrid({ count = 6 }: { count?: number }) {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
      {Array.from({ length: count }, (_, i) => (
        <div key={i} className="rounded-xl border p-4 space-y-3" style={{ borderColor: 'var(--color-border-default)' }}>
          <Skeleton variant="rect" className="h-20" />
          <Skeleton variant="text" className="w-3/4" />
          <Skeleton variant="text" lines={2} />
        </div>
      ))}
    </div>
  );
}

export function SkeletonChat({ count = 4 }: { count?: number }) {
  return (
    <div className="space-y-4 py-4">
      {Array.from({ length: count }, (_, i) => (
        <div key={i} className={`flex ${i % 2 === 0 ? 'justify-start' : 'justify-end'}`}>
          <div className={`max-w-[80%] rounded-xl px-4 py-3 space-y-2 ${i % 2 === 0 ? 'w-2/3' : 'w-1/2'}`}>
            <Skeleton variant="text" lines={i % 2 === 0 ? 3 : 2} />
          </div>
        </div>
      ))}
    </div>
  );
}

export function SkeletonList({ count = 5 }: { count?: number }) {
  return (
    <div className="space-y-3">
      {Array.from({ length: count }, (_, i) => (
        <div key={i} className="flex items-center gap-3 rounded-lg p-3" style={{ backgroundColor: 'var(--color-surface-raised)' }}>
          <Skeleton variant="circle" />
          <div className="flex-1 space-y-2">
            <Skeleton variant="text" className="w-1/3" />
            <Skeleton variant="text" className="w-2/3" />
          </div>
        </div>
      ))}
    </div>
  );
}

export function SkeletonForm({ count = 4 }: { count?: number }) {
  return (
    <div className="space-y-5">
      {Array.from({ length: count }, (_, i) => (
        <div key={i} className="space-y-2">
          <Skeleton variant="text" className="w-24 h-3" />
          <Skeleton variant="rect" className="h-10 rounded-lg" />
        </div>
      ))}
    </div>
  );
}
