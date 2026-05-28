export const colors = {
  primary: 'hsl(222.2, 47.4%, 11.2%)',
  primaryForeground: 'hsl(210, 40%, 98%)',
  muted: 'hsl(210, 40%, 96.1%)',
  mutedForeground: 'hsl(215.4, 16.3%, 46.9%)',
  border: 'hsl(214.3, 31.8%, 91.4%)',
  background: 'hsl(0, 0%, 100%)',
  card: 'hsl(0, 0%, 100%)',
  success: 'hsl(142, 71%, 45%)',
  destructive: 'hsl(0, 84.2%, 60.2%)',
  accent: 'hsl(210, 40%, 96.1%)',
} as const

export type ColorToken = keyof typeof colors
