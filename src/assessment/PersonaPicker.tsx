import { useTranslation } from 'react-i18next'
import type { Persona } from '../lib/counsellorApi'
import { PERSONAS } from './personas'

export default function PersonaPicker({ onPick }: { onPick: (persona: Persona) => void }) {
  const { t } = useTranslation()
  return (
    <div className="rail">
      <div className="persona-grid">
        {PERSONAS.map((p) => (
          <button type="button" key={p.id} className={`persona-card persona-${p.id}`} onClick={() => onPick(p.id)}>
            <img src={p.img} alt="" width={84} height={84} />
            <span className="persona-name">{t(`assessment.persona.${p.id}.name`)}</span>
            <span className="persona-desc">{t(`assessment.persona.${p.id}.desc`)}</span>
          </button>
        ))}
      </div>
    </div>
  )
}
