/**
 * The body figure from the assessment prototype (A01). Tapped parts colour in; "Whole body"
 * colours everything purple, and "just in my mind" leaves the figure grey.
 */
const COLOURS: Record<string, string> = {
  head: '#B09EE8',
  hands: '#7DDBA3',
  chest: '#F48FAD',
  stomach: '#F4C06A',
  legs: '#80BFEA',
}

export default function BodyFigure({ parts }: { parts: string[] }) {
  const whole = parts.includes('whole')
  const fill = (id: string) => (whole ? '#C084E8' : parts.includes(id) ? COLOURS[id] : '#E0E0E8')
  return (
    <svg className="asmt-body" width="100" height="160" viewBox="0 0 100 160" aria-hidden="true">
      <ellipse cx="50" cy="22" rx="18" ry="20" fill={fill('head')} />
      <ellipse cx="20" cy="68" rx="10" ry="22" fill={fill('hands')} />
      <ellipse cx="80" cy="68" rx="10" ry="22" fill={fill('hands')} />
      <rect x="30" y="44" width="40" height="30" rx="6" fill={fill('chest')} />
      <rect x="32" y="72" width="36" height="24" rx="6" fill={fill('stomach')} />
      <rect x="30" y="96" width="16" height="52" rx="8" fill={fill('legs')} />
      <rect x="54" y="96" width="16" height="52" rx="8" fill={fill('legs')} />
    </svg>
  )
}
