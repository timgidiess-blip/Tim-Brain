import { type NextRequest, NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";

const SYSTEM = `You are a nutrition expert who computes realistic macro splits.
Given a food name and a calorie target, return the protein/carbs/fat breakdown.
Respond ONLY with valid JSON — no markdown, no prose, no explanation.
Schema: { "p": number, "c": number, "f": number }
• p: protein in grams (one decimal place)
• c: carbohydrates in grams (one decimal place)
• f: fat in grams (one decimal place)
Constraint: 4*p + 4*c + 9*f must equal the target kcal (±2 kcal tolerance).
Use the typical macro composition of the named food — don't invent unusual ratios.`;

export async function POST(req: NextRequest): Promise<NextResponse> {
  let body: { name?: string; kcal?: number };
  try { body = await req.json() as { name?: string; kcal?: number }; }
  catch { return NextResponse.json({ error: "Invalid JSON" }, { status: 400 }); }

  const name = body.name?.trim();
  const kcal = body.kcal;
  if (!name || kcal == null || kcal <= 0) {
    return NextResponse.json({ error: "name and positive kcal required" }, { status: 422 });
  }

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) return NextResponse.json({ error: "ANTHROPIC_API_KEY not set" }, { status: 503 });

  try {
    const client = new Anthropic({ apiKey });
    const msg = await client.messages.create({
      model:      "claude-haiku-4-5",
      max_tokens: 128,
      system:     SYSTEM,
      messages:   [{
        role:    "user",
        content: `Food: "${name}"\nTarget: ${kcal} kcal\nGive realistic p/c/f for this food at this calorie level.`,
      }],
    });

    const block = msg.content[0];
    if (!block || block.type !== "text") throw new Error("Unexpected response format");

    const raw    = block.text.trim().replace(/^```(?:json)?\n?/, "").replace(/\n?```$/, "");
    const parsed = JSON.parse(raw) as { p?: unknown; c?: unknown; f?: unknown };

    const n = (v: unknown) => {
      const x = parseFloat(String(v ?? 0));
      return isFinite(x) ? parseFloat(x.toFixed(1)) : 0;
    };

    return NextResponse.json({ p: n(parsed.p), c: n(parsed.c), f: n(parsed.f) });
  } catch (err) {
    console.error("[api/nutrition/redistribute]", err);
    return NextResponse.json({ error: (err as Error).message }, { status: 500 });
  }
}
