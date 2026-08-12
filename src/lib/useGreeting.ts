import { useTranslation } from 'react-i18next'
import { getGreeting } from './greeting'

/** Returns the time-based greeting icon + localised text. */
export function useGreeting(): { icon: string; text: string } {
  const { t } = useTranslation()
  const g = getGreeting()
  return { icon: g.icon, text: t(`greeting.${g.key}`) }
}
