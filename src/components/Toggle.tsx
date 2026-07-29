interface ToggleProps {
  on: boolean
  onChange: (on: boolean) => void
  label: string
}

/** Accessible on/off switch matching the prototype's .toggle-sw. */
export default function Toggle({ on, onChange, label }: ToggleProps) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={on}
      aria-label={label}
      className={`toggle-sw${on ? ' on' : ''}`}
      onClick={() => onChange(!on)}
    />
  )
}
