import { useEffect, useId, useRef, useState } from 'react';
import { AlertCircle, ArrowRight, CornerDownLeft } from 'lucide-react';
import { Button, Segmented, cx } from './ui';

export type NotationMode = 'auto' | 'san' | 'uci';

export interface SubmitResult {
  ok: boolean;
  error?: string;
  suggestions?: string[];
}

export interface MoveInputProps {
  label: string;
  submitLabel: string;
  placeholder?: string;
  hint?: string;
  disabled?: boolean;
  autoFocus?: boolean;
  tone?: 'emerald' | 'amber';
  onSubmit: (raw: string, notation: NotationMode) => SubmitResult;
}

export function MoveInput({
  label,
  submitLabel,
  placeholder = 'e4, Nf3, Bxe5, O-O or e2e4',
  hint,
  disabled,
  autoFocus,
  tone = 'emerald',
  onSubmit,
}: MoveInputProps) {
  const [value, setValue] = useState('');
  const [notation, setNotation] = useState<NotationMode>('auto');
  const [error, setError] = useState<string | null>(null);
  const [suggestions, setSuggestions] = useState<string[]>([]);
  const inputId = useId();
  const errorId = useId();
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (autoFocus) inputRef.current?.focus();
  }, [autoFocus]);

  const submit = () => {
    const raw = value.trim();
    if (!raw) {
      setError('Type a move first.');
      setSuggestions([]);
      return;
    }
    const result = onSubmit(raw, notation);
    if (result.ok) {
      setValue('');
      setError(null);
      setSuggestions([]);
      inputRef.current?.focus();
    } else {
      setError(result.error ?? 'That move is not legal here.');
      setSuggestions(result.suggestions ?? []);
    }
  };

  const ring =
    tone === 'emerald'
      ? 'focus:border-emerald-400 focus:ring-emerald-400/30'
      : 'focus:border-amber-400 focus:ring-amber-400/30';

  return (
    <form
      className="space-y-2"
      onSubmit={(event) => {
        event.preventDefault();
        submit();
      }}
    >
      <div className="flex items-center justify-between gap-2">
        <label htmlFor={inputId} className="text-[11px] font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
          {label}
        </label>
        <Segmented
          size="sm"
          label="Notation"
          value={notation}
          onChange={(next) => setNotation(next)}
          options={[
            { value: 'auto', label: 'Auto' },
            { value: 'san', label: 'SAN' },
            { value: 'uci', label: 'UCI' },
          ]}
        />
      </div>
      <div className="flex gap-2">
        <input
          ref={inputRef}
          id={inputId}
          type="text"
          inputMode="text"
          autoComplete="off"
          autoCapitalize="off"
          spellCheck={false}
          value={value}
          disabled={disabled}
          placeholder={notation === 'uci' ? 'e2e4 or e7e8q' : placeholder}
          aria-invalid={Boolean(error)}
          aria-describedby={error ? errorId : hint ? `${inputId}-hint` : undefined}
          onChange={(event) => {
            setValue(event.target.value);
            if (error) setError(null);
          }}
          className={cx(
            'h-10 min-w-0 flex-1 rounded-xl border border-slate-300 bg-white px-3 font-mono text-sm text-slate-900 placeholder:font-sans placeholder:text-slate-400 focus:outline-none focus:ring-2 disabled:opacity-50 dark:border-white/15 dark:bg-white/[0.04] dark:text-white dark:placeholder:text-slate-500',
            ring,
          )}
        />
        <Button type="submit" variant={tone === 'emerald' ? 'primary' : 'secondary'} disabled={disabled}>
          {submitLabel}
          <ArrowRight className="h-4 w-4" aria-hidden="true" />
        </Button>
      </div>
      {hint && !error && (
        <p id={`${inputId}-hint`} className="text-[11px] leading-relaxed muted">
          {hint}
        </p>
      )}
      {error && (
        <div
          id={errorId}
          role="alert"
          className="flex items-start gap-1.5 rounded-lg border border-rose-200 bg-rose-50 px-2.5 py-1.5 text-[11px] leading-relaxed text-rose-700 dark:border-rose-400/25 dark:bg-rose-500/10 dark:text-rose-300"
        >
          <AlertCircle className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden="true" />
          <span>{error}</span>
        </div>
      )}
      {suggestions.length > 0 && (
        <div className="flex flex-wrap items-center gap-1.5">
          <span className="text-[11px] muted">Did you mean:</span>
          {suggestions.map((suggestion) => (
            <button
              key={suggestion}
              type="button"
              onClick={() => {
                setValue(suggestion);
                setError(null);
                inputRef.current?.focus();
              }}
              className="rounded-md border border-slate-200 bg-white px-1.5 py-0.5 font-mono text-[11px] text-slate-700 hover:border-emerald-400 hover:text-emerald-700 dark:border-white/10 dark:bg-white/5 dark:text-slate-200 dark:hover:border-emerald-400/60 dark:hover:text-emerald-300"
            >
              {suggestion}
            </button>
          ))}
        </div>
      )}
      <p className="flex items-center gap-1 text-[10px] muted">
        <CornerDownLeft className="h-3 w-3" aria-hidden="true" />
        Press Enter to record · you can also click or drag on the board
      </p>
    </form>
  );
}
