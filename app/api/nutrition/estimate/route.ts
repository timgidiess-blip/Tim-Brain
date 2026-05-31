import { type NextRequest, NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";

const SYSTEM = `You are a precise nutrition estimator.
Given a food or meal description, estimate its macronutrients.
Respond ONLY with valid JSON — no markdown, no prose, no explanation.
Schema: { "kcal": number, "p": number, "c": number, "f": number }
• kcal: total calories (integer, rounded to nearest 5)
• p: protein in grams (one decimal place)
• c: carbohydrates in grams (one decimal place)
• f: fat in grams (one decimal place)
Be accurate and specific. For mixed meals, sum all components.
Verify: 4*p + 4*c + 9*f should approximately equal kcal.`;

export async function POST(req: NextRequest): Promise<NextResponse> {
  let body: { text?: string };
  try { body = await req.json() as { text?: string }; }
  catch { return NextResponse.json({ error: "Invalid JSON" }, { status: 400 }); }

  const text = body.text?.trim();
  if (!text) return NextResponse.json({ error: "text required" }, { status: 422 });

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) return NextResponse.json({ error: "ANTHROPIC_API_KEY not set" }, { status: 503 });

  try {
    const client = new Anthropic({ apiKey });
    const msg = await client.messages.create({
      model:      "claude-haiku-4-5",
      max_tokens: 128,
      system:     SYSTEM,
      messages:   [{ role: "user", content: `Estimate macros for: ${text}` }],
    });

    const block = msg.content[0];
    if (!block || block.type !== "text") throw new Error("Unexpected response format");

    const raw    = block.text.trim().replace(/^```(?:json)?\n?/, "").replace(/\n?```$/, "");
    const parsed = JSON.parse(raw) as { kcal?: unknown; p?: unknown; c?: unknown; f?: unknown };

    const n = (v: unknown, dec: number) => {
      const x = parseFloat(String(v ?? 0));
      return isFinite(x) ? parseFloat(x.toFixed(dec)) : 0;
    };

    return NextResponse.json({
      kcal: Math.round(n(parsed.kcal, 0)),
      p:    n(parsed.p, 1),
      c:    n(parsed.c, 1),
      f:    n(parsed.f, 1),
    });
  } catch (err) {
    console.error("[api/nutrition/estimate]", err);
    return NextResponse.json({ error: (err as Error).message }, { status: 500 });
  }
}
