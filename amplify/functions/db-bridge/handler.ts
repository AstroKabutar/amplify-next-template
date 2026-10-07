/* Same logic as ../../../../lambda/index.mjs (approach A). */
import pg from 'pg'
import { SecretsManagerClient, GetSecretValueCommand } from '@aws-sdk/client-secrets-manager'

type Statement = { sql: string; params?: unknown[] }
type Db = Pick<pg.Pool, 'query'>

const sm = new SecretsManagerClient({})
let poolPromise: Promise<pg.Pool> | undefined

const getPool = () =>
  (poolPromise ??= (async () => {
    const { SecretString } = await sm.send(new GetSecretValueCommand({ SecretId: process.env.DB_SECRET_ARN }))
    const { username, password } = JSON.parse(SecretString!)
    return new pg.Pool({
      host: process.env.DB_HOST,
      port: Number(process.env.DB_PORT),
      database: process.env.DB_NAME,
      user: username,
      password,
      max: 1,
      ssl: { rejectUnauthorized: false }
    })
  })().catch((e) => {
    poolPromise = undefined
    throw e
  }))

const run = async (db: Db, { sql, params }: Statement) => {
  if (typeof sql !== 'string') throw Object.assign(new Error('sql must be a string'), { code: 'BAD_REQUEST' })
  const r = await db.query({ text: sql, values: params ?? [], rowMode: 'array' })
  return { rows: r.rows, fields: r.fields.map((f) => f.name) }
}

const transaction = async (pool: pg.Pool, statements: Statement[]) => {
  const client = await pool.connect()
  try {
    await client.query('BEGIN')
    const out = []
    for (const s of statements) out.push(await run(client, s))
    await client.query('COMMIT')
    return out
  } catch (e) {
    await client.query('ROLLBACK').catch(() => {})
    throw e
  } finally {
    client.release()
  }
}

export const handler = async (event: Statement & { batch?: Statement[]; transaction?: boolean }) => {
  try {
    const pool = await getPool()
    if (Array.isArray(event.batch)) {
      if (event.transaction) return await transaction(pool, event.batch)
      const out = []
      for (const s of event.batch) out.push(await run(pool, s))
      return out
    }
    return await run(pool, event)
  } catch (e) {
    const err = e as Error & { code?: string }
    return { error: { message: err.message, code: err.code } }
  }
}
