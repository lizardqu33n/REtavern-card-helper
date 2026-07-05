/** Text input with label and error state */
import type { InputHTMLAttributes } from 'react';

interface TextInputProps extends InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
}

export function TextInput({ label, error, className = '', ...props }: TextInputProps) {
  return (
    <div className="flex flex-col gap-1">
      {label && (
        <label className="text-sm font-medium" style={{ color: 'color-mix(in srgb, var(--text-color) 80%, transparent)' }}>
          {label}
        </label>
      )}
      <input
        className={`w-full rounded-lg px-3 py-2 text-sm
          transition-colors duration-150
          placeholder:text-[color-mix(in_srgb,var(--text-color)_40%,transparent)]
          focus:outline-none focus:ring-1 focus:ring-[var(--color-primary)]
          disabled:opacity-50 disabled:cursor-not-allowed
          ${error ? '!border-red-500 focus:!ring-red-500' : ''}
          ${className}`}
        style={{
          backgroundColor: 'var(--input-bg, #0f172a)',
          borderColor: error ? undefined : 'var(--input-border, #475569)',
          color: 'var(--text-color, #f1f5f9)',
        }}
        {...props}
      />
      {error && (
        <span className="text-xs text-red-400">{error}</span>
      )}
    </div>
  );
}
