'use client';

import { useRef, useState, useCallback, useEffect, KeyboardEvent, ClipboardEvent } from 'react';

interface OTPInputProps {
  length?: number;
  onComplete: (code: string) => void;
  disabled?: boolean;
  error?: string;
}

/**
 * 6-box OTP input with auto-advance, paste support, and backspace navigation.
 */
export default function OTPInput({
  length = 6,
  onComplete,
  disabled = false,
  error,
}: OTPInputProps) {
  const [values, setValues] = useState<string[]>(Array(length).fill(''));
  const inputRefs = useRef<(HTMLInputElement | null)[]>([]);

  // Focus first input on mount
  useEffect(() => {
    inputRefs.current[0]?.focus();
  }, []);

  const handleChange = useCallback(
    (index: number, value: string) => {
      // Only allow digits
      const digit = value.replace(/\D/g, '').slice(-1);
      const newValues = [...values];
      newValues[index] = digit;
      setValues(newValues);

      if (digit && index < length - 1) {
        inputRefs.current[index + 1]?.focus();
      }

      // Check if complete
      if (newValues.every((v) => v !== '')) {
        onComplete(newValues.join(''));
      }
    },
    [values, length, onComplete]
  );

  const handleKeyDown = useCallback(
    (index: number, e: KeyboardEvent<HTMLInputElement>) => {
      if (e.key === 'Backspace' && !values[index] && index > 0) {
        inputRefs.current[index - 1]?.focus();
        const newValues = [...values];
        newValues[index - 1] = '';
        setValues(newValues);
      }
      if (e.key === 'ArrowLeft' && index > 0) {
        inputRefs.current[index - 1]?.focus();
      }
      if (e.key === 'ArrowRight' && index < length - 1) {
        inputRefs.current[index + 1]?.focus();
      }
    },
    [values, length]
  );

  const handlePaste = useCallback(
    (e: ClipboardEvent<HTMLInputElement>) => {
      e.preventDefault();
      const pasted = e.clipboardData.getData('text').replace(/\D/g, '').slice(0, length);
      if (!pasted) return;

      const newValues = [...values];
      for (let i = 0; i < pasted.length; i++) {
        newValues[i] = pasted[i];
      }
      setValues(newValues);

      // Focus the next empty or the last
      const nextEmpty = newValues.findIndex((v) => v === '');
      if (nextEmpty >= 0) {
        inputRefs.current[nextEmpty]?.focus();
      } else {
        inputRefs.current[length - 1]?.focus();
        onComplete(newValues.join(''));
      }
    },
    [values, length, onComplete]
  );

  return (
    <div>
      <div className="flex items-center justify-center gap-3">
        {values.map((val, i) => (
          <input
            key={i}
            ref={(el) => { inputRefs.current[i] = el; }}
            type="text"
            inputMode="numeric"
            maxLength={1}
            value={val}
            disabled={disabled}
            onChange={(e) => handleChange(i, e.target.value)}
            onKeyDown={(e) => handleKeyDown(i, e)}
            onPaste={i === 0 ? handlePaste : undefined}
            className={`
              w-12 h-14 text-center text-xl font-bold rounded-xl
              border-2 transition-all duration-200
              bg-slate-800/50 text-white
              focus:outline-none focus:ring-2
              disabled:opacity-40 disabled:cursor-not-allowed
              ${error
                ? 'border-red-500/60 focus:border-red-400 focus:ring-red-400/30'
                : 'border-slate-600/50 focus:border-emerald-400 focus:ring-emerald-400/30'
              }
            `}
            aria-label={`Digit ${i + 1} of ${length}`}
          />
        ))}
      </div>

      {error && (
        <p className="mt-3 text-sm text-red-400 text-center">{error}</p>
      )}
    </div>
  );
}
