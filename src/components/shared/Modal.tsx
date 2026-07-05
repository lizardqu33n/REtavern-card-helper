/** Generic modal wrapper with overlay, animation, and theme-aware styling */
import type { ReactNode } from 'react';

interface ModalProps {
  isOpen: boolean;
  onClose: () => void;
  title?: string;
  children: ReactNode;
  maxWidth?: string;
}

export function Modal({ isOpen, onClose, title, children, maxWidth = 'max-w-lg' }: ModalProps) {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* Overlay */}
      <div
        className="absolute inset-0 animate-fade-in"
        style={{ backgroundColor: 'var(--color-surface-overlay)' }}
        onClick={onClose}
      />
      {/* Modal content */}
      <div
        className={`relative w-full ${maxWidth} rounded-xl border shadow-2xl animate-scale-in`}
        style={{
          backgroundColor: 'var(--color-surface-raised)',
          borderColor: 'var(--color-border-default)',
        }}
      >
        {title && (
          <div
            className="flex items-center justify-between px-6 py-4"
            style={{ borderBottom: '1px solid var(--color-border-default)' }}
          >
            <h3 className="text-lg font-semibold" style={{ color: 'var(--text-color)' }}>
              {title}
            </h3>
            <button
              onClick={onClose}
              className="text-slate-400 hover:text-white text-xl cursor-pointer transition-colors w-8 h-8 flex items-center justify-center rounded-lg hover:bg-white/5"
            >
              &times;
            </button>
          </div>
        )}
        <div className="p-6">{children}</div>
      </div>
    </div>
  );
}
