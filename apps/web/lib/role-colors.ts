const ROLE_COLOR_CLASSES = [
  'border-l-sky-500 bg-sky-50/80 dark:bg-sky-950/20',
  'border-l-emerald-500 bg-emerald-50/80 dark:bg-emerald-950/20',
  'border-l-amber-500 bg-amber-50/80 dark:bg-amber-950/20',
  'border-l-rose-500 bg-rose-50/80 dark:bg-rose-950/20',
  'border-l-violet-500 bg-violet-50/80 dark:bg-violet-950/20',
  'border-l-cyan-500 bg-cyan-50/80 dark:bg-cyan-950/20',
  'border-l-orange-500 bg-orange-50/80 dark:bg-orange-950/20',
  'border-l-lime-500 bg-lime-50/80 dark:bg-lime-950/20',
  'border-l-fuchsia-500 bg-fuchsia-50/80 dark:bg-fuchsia-950/20',
  'border-l-teal-500 bg-teal-50/80 dark:bg-teal-950/20',
]

const ROLE_BADGE_COLOR_CLASSES = [
  'border-sky-300 bg-sky-100 text-sky-900 dark:border-sky-800 dark:bg-sky-950 dark:text-sky-200',
  'border-emerald-300 bg-emerald-100 text-emerald-900 dark:border-emerald-800 dark:bg-emerald-950 dark:text-emerald-200',
  'border-amber-300 bg-amber-100 text-amber-900 dark:border-amber-800 dark:bg-amber-950 dark:text-amber-200',
  'border-rose-300 bg-rose-100 text-rose-900 dark:border-rose-800 dark:bg-rose-950 dark:text-rose-200',
  'border-violet-300 bg-violet-100 text-violet-900 dark:border-violet-800 dark:bg-violet-950 dark:text-violet-200',
  'border-cyan-300 bg-cyan-100 text-cyan-900 dark:border-cyan-800 dark:bg-cyan-950 dark:text-cyan-200',
  'border-orange-300 bg-orange-100 text-orange-900 dark:border-orange-800 dark:bg-orange-950 dark:text-orange-200',
  'border-lime-300 bg-lime-100 text-lime-900 dark:border-lime-800 dark:bg-lime-950 dark:text-lime-200',
  'border-fuchsia-300 bg-fuchsia-100 text-fuchsia-900 dark:border-fuchsia-800 dark:bg-fuchsia-950 dark:text-fuchsia-200',
  'border-teal-300 bg-teal-100 text-teal-900 dark:border-teal-800 dark:bg-teal-950 dark:text-teal-200',
]

const ROLE_AVATAR_COLOR_CLASSES = [
  'border-sky-200 bg-sky-600 text-white dark:border-sky-700 dark:bg-sky-500',
  'border-emerald-200 bg-emerald-600 text-white dark:border-emerald-700 dark:bg-emerald-500',
  'border-amber-200 bg-amber-600 text-white dark:border-amber-700 dark:bg-amber-500',
  'border-rose-200 bg-rose-600 text-white dark:border-rose-700 dark:bg-rose-500',
  'border-violet-200 bg-violet-600 text-white dark:border-violet-700 dark:bg-violet-500',
  'border-cyan-200 bg-cyan-600 text-white dark:border-cyan-700 dark:bg-cyan-500',
  'border-orange-200 bg-orange-600 text-white dark:border-orange-700 dark:bg-orange-500',
  'border-lime-200 bg-lime-600 text-white dark:border-lime-700 dark:bg-lime-500',
  'border-fuchsia-200 bg-fuchsia-600 text-white dark:border-fuchsia-700 dark:bg-fuchsia-500',
  'border-teal-200 bg-teal-600 text-white dark:border-teal-700 dark:bg-teal-500',
]

const DEFAULT_ROLE_COLOR_INDEX: Record<string, number> = {
  '架构师': 4,
  Orchestrator: 4,
  '前端工程师': 0,
  '后端工程师': 1,
  '演示稿工程师': 2,
  'Agent 创建助手': 3,
  '产物助手': 5,
}

const RESERVED_DEFAULT_ROLE_COLOR_INDEXES = new Set(Object.values(DEFAULT_ROLE_COLOR_INDEX))
const CUSTOM_ROLE_COLOR_INDEXES = ROLE_COLOR_CLASSES
  .map((_, index) => index)
  .filter((index) => !RESERVED_DEFAULT_ROLE_COLOR_INDEXES.has(index))

function defaultRoleColorIndex(roleName = '') {
  return DEFAULT_ROLE_COLOR_INDEX[roleName.trim()]
}

export function roleColorIndex(roleId: string | null | undefined, roleName = '') {
  const defaultIndex = defaultRoleColorIndex(roleName)
  if (typeof defaultIndex === 'number') return defaultIndex

  const seed = roleId || roleName || 'agent'
  let hash = 0
  for (let index = 0; index < seed.length; index += 1) {
    hash = (hash * 31 + seed.charCodeAt(index)) >>> 0
  }
  return CUSTOM_ROLE_COLOR_INDEXES[hash % CUSTOM_ROLE_COLOR_INDEXES.length] ?? 0
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
