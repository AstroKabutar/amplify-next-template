import { query } from '@/lib/db'

export const dynamic = 'force-dynamic'

export async function GET() {
  try {
    const { rows } = await query('select now(), current_database()')
    return Response.json({ driver: process.env.DB_DRIVER ?? 'direct', rows })
  } catch (e) {
    return Response.json({ error: (e as Error).message }, { status: 500 })
  }
}
