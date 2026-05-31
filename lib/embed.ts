/**
 * Shared OpenAI text-embedding-3-small utility.
 * Returns a 1536-dimensional vector.
 * Throws on failure — callers that want fire-and-forget should catch themselves.
 */
import OpenAI from "openai";

// text-embedding-3-small token limit ≈ 8191 tokens; ~4 chars/token → ~32 K chars
const MAX_CHARS = 30_000;

export async function embed(text: string): Promise<number[]> {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) throw new Error("OPENAI_API_KEY not set");

  const client = new OpenAI({ apiKey });
  const input  = text.length > MAX_CHARS ? text.slice(0, MAX_CHARS) : text;

  const res = await client.embeddings.create({
    model: "text-embedding-3-small",
    input,
  });

  const vec = res.data[0]?.embedding;
  if (!vec?.length) throw new Error("OpenAI returned empty embedding");
  return vec;
}
