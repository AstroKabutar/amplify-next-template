"use client";

import { useState } from "react";

type Row = { expression: string; result: string; created_at: string };

export default function Calculator() {
  const [a, setA] = useState("");
  const [op, setOp] = useState("+");
  const [b, setB] = useState("");
  const [result, setResult] = useState("");
  const [history, setHistory] = useState<Row[] | null>(null);
  const [error, setError] = useState("");

  async function call(init?: RequestInit) {
    const res = await fetch("/api/calculations", init);
    const body = await res.json();
    if (!res.ok) throw new Error(body.error);
    return body;
  }

  async function calculate() {
    setError("");
    try {
      const body = await call({
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ a: Number(a), op, b: Number(b) }),
      });
      setResult(`${body.expression} = ${body.result}`);
    } catch (e) {
      setError((e as Error).message);
    }
  }

  async function showHistory() {
    setError("");
    try {
      setHistory((await call()).rows);
    } catch (e) {
      setError((e as Error).message);
    }
  }

  return (
    <main style={{ color: "white", gap: 12 }}>
      <h1>Calculator</h1>
      <div style={{ display: "flex", gap: 8 }}>
        <input type="number" value={a} onChange={(e) => setA(e.target.value)} />
        <select value={op} onChange={(e) => setOp(e.target.value)}>
          {["+", "-", "*", "/"].map((o) => (
            <option key={o}>{o}</option>
          ))}
        </select>
        <input type="number" value={b} onChange={(e) => setB(e.target.value)} />
        <button onClick={calculate}>=</button>
      </div>
      {result && <p>{result}</p>}
      <button onClick={showHistory}>History</button>
      {error && <p style={{ color: "tomato" }}>{error}</p>}
      {history && (
        <ul>
          {history.map((r, i) => (
            <li key={i}>
              {r.expression} = {r.result}
            </li>
          ))}
        </ul>
      )}
    </main>
  );
}
