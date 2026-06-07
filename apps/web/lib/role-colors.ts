const ROLE_COLOR_CLASSES = [
  'border-l-sky-500 bg-sky-50/80 dark:bg-sky-950/20',
  'border-l-emerald-500 bg-emerald-50/80 dark:bg-emerald-950/20',
  'border-l-amber-500 bg-amber-50/80 dark:bg-amber-950/20',
  'border-l-rose-500 bg-rose-50/80 dark:bg-rose-950/20',
  'border-l-violet-500 bg-violet-50/80 dark:bg-violet-950/20',
  'border-l-cyan-500 bg-cyan-50/80 dark:bg-cyan-950/20',
]

const ROLE_BADGE_COLOR_CLASSES = [
  'border-sky-300 bg-sky-100 text-sky-900 dark:border-sky-800 dark:bg-sky-950 dark:text-sky-200',
  'border-emerald-300 bg-emerald-100 text-emerald-900 dark:border-emerald-800 dark:bg-emerald-950 dark:text-emerald-200',
  'border-amber-300 bg-amber-100 text-amber-900 dark:border-amber-800 dark:bg-amber-950 dark:text-amber-200',
  'border-rose-300 bg-rose-100 text-rose-900 dark:border-rose-800 dark:bg-rose-950 dark:text-rose-200',
  'border-violet-300 bg-violet-100 text-violet-900 dark:border-violet-800 dark:bg-violet-950 dark:text-violet-200',
  'border-cyan-300 bg-cyan-100 text-cyan-900 dark:border-cyan-800 dark:bg-cyan-950 dark:text-cyan-200',
]

const ROLE_AVATAR_COLOR_CLASSES = [
  'border-sky-300 bg-sky-100 text-sky-900 dark:border-sky-800 dark:bg-sky-950 dark:text-sky-200',
  'border-emerald-300 bg-emerald-100 text-emerald-900 dark:border-emerald-800 dark:bg-emerald-950 dark:text-emerald-200',
  'border-amber-300 bg-amber-100 text-amber-900 dark:border-amber-800 dark:bg-amber-950 dark:text-amber-200',
  'border-rose-300 bg-rose-100 text-rose-900 dark:border-rose-800 dark:bg-rose-950 dark:text-rose-200',
  'border-violet-300 bg-violet-100 text-violet-900 dark:border-violet-800 dark:bg-violet-950 dark:text-violet-200',
  'border-cyan-300 bg-cyan-100 text-cyan-900 dark:border-cyan-800 dark:bg-cyan-950 dark:text-cyan-200',
]

export function roleColorIndex(roleId: string | null | undefined, roleName = '') {
  const seed = roleId || roleName || 'agent'
  let hash = 0
  for (let index = 0; index < seed.length; index += 1) {
    hash = (hash * 31 + seed.charCodeAt(index)) >>> 0
  }
  return hash % ROLE_COLOR_CLASSES.length
}

export function roleMessageColorClass(roleId: string | null | undefined, roleName?: string) {
  return ROLE_COLOR_CLASSES[roleColorIndex(roleId, roleName)] ?? ROLE_COLOR_CLASSES[0]
}

export function roleBadgeColorClass(roleId: string | null | undefined, roleName?: string) {
  return ROLE_BADGE_COLOR_CLASSES[roleColorIndex(roleId, roleName)] ?? ROLE_BADGE_COLOR_CLASSES[0]
}

export function roleAvatarColorClass(roleId: string | null | undefined, roleName?: string) {
  return ROLE_AVATAR_COLOR_CLASSES[roleColorIndex(roleId, roleName)] ?? ROLE_AVATAR_COLOR_CLASSES[0]
}
