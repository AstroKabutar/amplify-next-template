import { Pool } from 'pg'
import { InvokeCommand, LambdaClient } from '@aws-sdk/client-lambda'

export type Statement = { sql: string; params?: unknown[] }
export type QueryResult<T = Record<string, unknown>> = { rows: T[]; fields: string[] }

const g = globalThis as unknown as { __pool?: Pool; __lambda?: LambdaClient }

const pool = () => (g.__pool ??= new Pool({ connectionString: process.env.DATABASE_URL, max: 10 }))

const lambdaClient = () => {
  if (!process.env.DB_REGION || !process.env.DB_LAMBDA_NAME) throw new Error('DB_REGION and DB_LAMBDA_NAME are required when DB_DRIVER=lambda')
  return (g.__lambda ??= new LambdaClient({ region: process.env.DB_REGION })) // default credential chain only
}

const invoke = async (payload: unknown) => {
  const res = await lambdaClient().send(
    new InvokeCommand({ FunctionName: process.env.DB_LAMBDA_NAME, Payload: Buffer.from(JSON.stringify(payload)) })
  )
  const body = JSON.parse(Buffer.from(res.Payload ?? []).toString() || 'null')
  if (res.FunctionError || body?.error) {
    throw Object.assign(new Error(body?.error?.message ?? res.FunctionError), { code: body?.error?.code })
  }
  return body
}

// Lambda returns array rows; map back to objects so callers see the same shape as pg.
const toObjects = <T>({ rows, fields }: { rows: unknown[][]; fields: string[] }): QueryResult<T> => ({
  rows: rows.map((r) => Object.fromEntries(fields.map((f, i) => [f, r[i]]))) as T[],
  fields
})

const useLambda = () => process.env.DB_DRIVER === 'lambda'

export async function query<T = Record<string, unknown>>(sql: string, params: unknown[] = []): Promise<QueryResult<T>> {
  if (useLambda()) return toObjects<T>(await invoke({ sql, params }))
  const r = await pool().query(sql, params)
  return { rows: r.rows as T[], fields: r.fields.map((f) => f.name) }
}

export async function transaction(statements: Statement[]): Promise<QueryResult[]> {
  if (useLambda()) return (await invoke({ batch: statements, transaction: true })).map(toObjects)
  const client = await pool().connect()
  try {
    await client.query('BEGIN')
    const out: QueryResult[] = []
    for (const s of statements) {
      const r = await client.query(s.sql, s.params ?? [])
      out.push({ rows: r.rows, fields: r.fields.map((f) => f.name) })
    }
    await client.query('COMMIT')
    return out
  } catch (e) {
    await client.query('ROLLBACK').catch(() => {})
    throw e
  } finally {
    client.release()
  }
}
