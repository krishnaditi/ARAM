import { useRef } from 'react'

interface PinEntryProps {
  value: string
  onChange: (pin: string) => void
  autoFocus?: boolean
  ariaLabel: string
}

/** 4-digit PIN entry rendered as the prototype's pin-dots, backed by a numeric input. */
export default function PinEntry({ value, onChange, autoFocus, ariaLabel }: PinEntryProps) {
  const inputRef = useRef<HTMLInputElement>(null)

  const handle = (raw: string) => {
    const digits = raw.replace(/\D/g, '').slice(0, 4)
    onChange(digits)
  }

  return (
    <div style={{ position: 'relative' }}>
      <div className="pin-dots sc-anim-3" onClick={() => inputRef.current?.focus()}>
        {[0, 1, 2, 3].map((i) => (
          <div key={i} className={`pin-dot${i < value.length ? ' filled' : ''}`}>
            {i < value.length ? '●' : ''}
          </div>
        ))}
      </div>
      <input
        ref={inputRef}
        value={value}
        onChange={(e) => handle(e.target.value)}
        inputMode="numeric"
        autoComplete="one-time-code"
        maxLength={4}
        autoFocus={autoFocus}
        aria-label={ariaLabel}
        style={{
          position: 'absolute',
          inset: 0,
          opacity: 0,
          width: '100%',
          height: '100%',
          border: 'none',
          cursor: 'pointer',
        }}
      />
    </div>
  )
}
