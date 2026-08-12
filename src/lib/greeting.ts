/** Time-of-day greeting, matching the prototype's getGreeting(). */
export type GreetingKey = 'morning' | 'afternoon' | 'evening' | 'night'

export interface Greeting {
  icon: string
  key: GreetingKey
}

export function getGreeting(now: Date = new Date()): Greeting {
  const h = now.getHours()
  if (h >= 5 && h < 12) return { icon: '☀️', key: 'morning' }
  if (h >= 12 && h < 17) return { icon: '🌤️', key: 'afternoon' }
  if (h >= 17 && h < 21) return { icon: '🌅', key: 'evening' }
  return { icon: '⭐', key: 'night' }
}
