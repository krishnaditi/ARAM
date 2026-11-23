import type { Persona } from '../lib/counsellorApi'

/** Who the student talks with after the assessment (Green, Amber or Orange band only). */
export const PERSONAS: { id: Persona; img: string }[] = [
  { id: 'friend', img: '/personas/friend.svg' },
  { id: 'parent', img: '/personas/parent.svg' },
  { id: 'counsellor', img: '/personas/counsellor.svg' },
]
