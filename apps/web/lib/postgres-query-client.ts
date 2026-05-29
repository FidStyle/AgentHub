import { Pool } from 'pg'

type DbError = { message: string }
type LooseRow = { id: never; [key: string]: never }
type LooseData = LooseRow & LooseRow[]
type DbResult<T = LooseData> = { data: T; error: DbError | null }
type Filter = { column: string; op: '=' | '<>' | '>' | 'IS' | 'IN'; value: unknown }
type OrderBy = { column: string; ascending: boolean }
type Operation = 'select' | 'insert' | 'update' | 'delete'

const tableNames = new Set([
  'user',
  'account',
  'session',
  'verificationToken',
  'profiles',
  'workspaces',
  'sessions',
  'role_agents',
  'messages',
  'devices',
  'device_bindings',
  'device_login_intents',
  'plans',
  'plan_nodes',
  'actions',
  'notifications',
  'runtime_endpoints',
  'runtime_sessions',
  'runtime_logs',
  'device_runtime_channels',
  'runtime_capabilities',
])

let pool: Pool | null = null

function getPool() {
  if (!pool) {
    pool = new Pool({ connectionString: process.env.DATABASE_URL })
  }
  return pool
}

function quoteIdent(value: string) {
  return `"${value.replace(/"/g, '""')}"`
}

function tableSql(table: string) {
  if (!tableNames.has(table)) throw new Error(`Unsupported local Postgres table: ${table}`)
  return `public.${quoteIdent(table)}`
}

function columnsSql(columns: string | null) {
  if (!columns || columns.trim() === '*') return '*'
  return columns
    .split(',')
    .map((column) => quoteIdent(column.trim()))
    .join(', ')
}

function normalizeValue(value: unknown) {
  if (value === undefined) return null
  return value
}

export type AppQueryBuilder<T = LooseData> = PromiseLike<DbResult<T>> & {
  select(columns?: string): AppQueryBuilder<T>
  insert(values: Record<string, unknown> | Record<string, unknown>[]): AppQueryBuilder<T>
  update(values: Record<string, unknown>): AppQueryBuilder<T>
  delete(): AppQueryBuilder<T>
  eq(column: string, value: unknown): AppQueryBuilder<T>
  neq(column: string, value: unknown): AppQueryBuilder<T>
  gt(column: string, value: unknown): AppQueryBuilder<T>
  is(column: string, value: unknown): AppQueryBuilder<T>
  in(column: string, values: unknown[]): AppQueryBuilder<T>
  order(column: string, options?: { ascending?: boolean }): AppQueryBuilder<T>
  limit(count: number): AppQueryBuilder<T>
  single(): AppQueryBuilder<T>
}

export type AppDbClient = {
  from(table: string): AppQueryBuilder
}

class LocalQueryBuilder<T = LooseData> implements AppQueryBuilder<T> {
  private operation: Operation | null = null
  private selectColumns: string | null = null
  private returningColumns: string | null = null
  private insertValues: Record<string, unknown>[] = []
  private updateValues: Record<string, unknown> = {}
  private filters: Filter[] = []
  private orderBy: OrderBy | null = null
  private limitCount: number | null = null
  private wantsSingle = false

  constructor(private readonly table: string) {}

  select(columns = '*') {
    if (this.operation === 'insert' || this.operation === 'update' || this.operation === 'delete') {
      this.returningColumns = columns
    } else {
      this.operation = 'select'
      this.selectColumns = columns
    }
    return this
  }

  insert(values: Record<string, unknown> | Record<string, unknown>[]) {
    this.operation = 'insert'
    this.insertValues = Array.isArray(values) ? values : [values]
    return this
  }

  update(values: Record<string, unknown>) {
    this.operation = 'update'
    this.updateValues = values
    return this
  }

  delete() {
    this.operation = 'delete'
    return this
  }

  eq(column: string, value: unknown) {
    this.filters.push({ column, op: '=', value })
    return this
  }

  neq(column: string, value: unknown) {
    this.filters.push({ column, op: '<>', value })
    return this
  }

  gt(column: string, value: unknown) {
    this.filters.push({ column, op: '>', value })
    return this
  }

  is(column: string, value: unknown) {
    this.filters.push({ column, op: 'IS', value })
    return this
  }

  in(column: string, values: unknown[]) {
    this.filters.push({ column, op: 'IN', value: values })
    return this
  }

  order(column: string, options: { ascending?: boolean } = {}) {
    this.orderBy = { column, ascending: options.ascending ?? true }
    return this
  }

  limit(count: number) {
    this.limitCount = count
    return this
  }

  single() {
    this.wantsSingle = true
    this.limitCount = 1
    return this
  }

  then<TResult1 = DbResult<T>, TResult2 = never>(
    onfulfilled?: ((value: DbResult<T>) => TResult1 | PromiseLike<TResult1>) | null,
    onrejected?: ((reason: unknown) => TResult2 | PromiseLike<TResult2>) | null,
  ): PromiseLike<TResult1 | TResult2> {
    return this.execute().then(onfulfilled, onrejected)
  }

  private buildWhere(params: unknown[]) {
    if (this.filters.length === 0) return ''
    const clauses = this.filters.map((filter) => {
      if (filter.op === 'IN') {
        const values = Array.isArray(filter.value) ? filter.value : []
        if (values.length === 0) return 'false'
        const placeholders = values.map((value) => {
          params.push(normalizeValue(value))
          return `$${params.length}`
        })
        return `${quoteIdent(filter.column)} IN (${placeholders.join(', ')})`
      }
      if (filter.op === 'IS') {
        if (filter.value === null) return `${quoteIdent(filter.column)} IS NULL`
        if (filter.value === true) return `${quoteIdent(filter.column)} IS TRUE`
        if (filter.value === false) return `${quoteIdent(filter.column)} IS FALSE`
        throw new Error(`Unsupported IS filter value for ${filter.column}`)
      }
      params.push(normalizeValue(filter.value))
      return `${quoteIdent(filter.column)} ${filter.op} $${params.length}`
    })
    return ` WHERE ${clauses.join(' AND ')}`
  }

  private async execute(): Promise<DbResult<T>> {
    try {
      const operation = this.operation ?? 'select'
      if (operation === 'select') return await this.executeSelect()
      if (operation === 'insert') return await this.executeInsert()
      if (operation === 'update') return await this.executeUpdate()
      return await this.executeDelete()
    } catch (error) {
      return { data: null as T, error: { message: error instanceof Error ? error.message : String(error) } }
    }
  }

  private async executeSelect(): Promise<DbResult<T>> {
    const params: unknown[] = []
    let sql = `SELECT ${columnsSql(this.selectColumns)} FROM ${tableSql(this.table)}`
    sql += this.buildWhere(params)
    if (this.orderBy) {
      sql += ` ORDER BY ${quoteIdent(this.orderBy.column)} ${this.orderBy.ascending ? 'ASC' : 'DESC'}`
    }
    if (this.limitCount !== null) {
      params.push(this.limitCount)
      sql += ` LIMIT $${params.length}`
    }
    const result = await getPool().query(sql, params)
    const data = this.wantsSingle ? (result.rows[0] ?? null) : result.rows
    return { data: data as T, error: null }
  }

  private async executeInsert(): Promise<DbResult<T>> {
    if (this.insertValues.length === 0) return { data: null as T, error: null }

    const rows = this.insertValues
    const columns = Object.keys(rows[0])
    const params: unknown[] = []
    const valuesSql = rows.map((row) => {
      const placeholders = columns.map((column) => {
        params.push(normalizeValue(row[column]))
        return `$${params.length}`
      })
      return `(${placeholders.join(', ')})`
    })

    let sql = `INSERT INTO ${tableSql(this.table)} (${columns.map(quoteIdent).join(', ')}) VALUES ${valuesSql.join(', ')}`
    if (this.returningColumns) sql += ` RETURNING ${columnsSql(this.returningColumns)}`

    const result = await getPool().query(sql, params)
    const data = this.returningColumns ? (this.wantsSingle ? (result.rows[0] ?? null) : result.rows) : null
    return { data: data as T, error: null }
  }

  private async executeUpdate(): Promise<DbResult<T>> {
    const columns = Object.keys(this.updateValues)
    const params: unknown[] = []
    const setSql = columns.map((column) => {
      params.push(normalizeValue(this.updateValues[column]))
      return `${quoteIdent(column)} = $${params.length}`
    })

    let sql = `UPDATE ${tableSql(this.table)} SET ${setSql.join(', ')}`
    sql += this.buildWhere(params)
    if (this.returningColumns) sql += ` RETURNING ${columnsSql(this.returningColumns)}`

    const result = await getPool().query(sql, params)
    const data = this.returningColumns ? (this.wantsSingle ? (result.rows[0] ?? null) : result.rows) : null
    return { data: data as T, error: null }
  }

  private async executeDelete(): Promise<DbResult<T>> {
    const params: unknown[] = []
    let sql = `DELETE FROM ${tableSql(this.table)}`
    sql += this.buildWhere(params)
    if (this.returningColumns) sql += ` RETURNING ${columnsSql(this.returningColumns)}`

    const result = await getPool().query(sql, params)
    const data = this.returningColumns ? (this.wantsSingle ? (result.rows[0] ?? null) : result.rows) : null
    return { data: data as T, error: null }
  }
}

export function createPostgresQueryClient(): AppDbClient {
  return {
    from(table: string) {
      return new LocalQueryBuilder(table)
    },
  }
}
