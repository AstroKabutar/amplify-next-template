import { query } from "@/lib/db";

export const dynamic = "force-dynamic";

const ops: Record<string, (a: number, b: number) => number> = {
  "+": (a, b) => a + b,
  "-": (a, b) => a - b,
  "*": (a, b) => a * b,
  "/": (a, b) => a / b,
};

const ensureTable = () =>
  query(
    "create table if not exists calculations (id serial primary key, expression text not null, result text not null, created_at timestamptz not null default now())"
  );

export async function POST(req: Request) {
  const { a, op, b } = await req.json();
  if (!Number.isFinite(a) || !Number.isFinite(b) || !(op in ops)) {
    return Response.json({ error: "Invalid input" }, { status: 400 });
  }
  if (op === "/" && b === 0) {
    return Response.json({ error: "Cannot divide by zero" }, { status: 400 });
  }
  const expression = `${a} ${op} ${b}`;
  const result = String(ops[op](a, b));
  try {
    await ensureTable();
    await query("insert into calculations (expression, result) values ($1, $2)", [expression, result]);
    return Response.json({ expression, result });
  } catch (e) {
    return Response.json({ error: (e as Error).message }, { status: 500 });
  }
}

export async function GET() {
  try {
    await ensureTable();
    const { rows } = await query(
      "select expression, result, created_at from calculations order by id desc limit 20"
    );
    return Response.json({ rows });
  } catch (e) {
    return Response.json({ error: (e as Error).message }, { status: 500 });
  }
}
