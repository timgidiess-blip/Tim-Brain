/**
 * writeMemory — fire-and-forget helper used by every write route.
 *
 * Usage (never await — never blocks a response):
 *   void writeMemory({ source_type: "task", source_id: task.id, text: "...", metadata: {...} });
 *
 * Silently no-ops when OPENAI_API_KEY or TELEGRAM_USER_ID are absent so the
 * rest of the app works even without the memory layer configured.
 */
import { embed } from "./embed";
import { getDb } from "./supabase";

export interface MemoryInput {
  source_type: string;
  source_id:   string;
  text:        string;
  metadata?:   Record<string, unknown>;
}

export async function writeMemory(chunk: MemoryInput): Promise<void> {
  const userId = process.env.TELEGRAM_USER_ID;
  if (!userId || !process.env.OPENAI_API_KEY) return;

  // Skip obviously empty text
  const text = chunk.text.trim();
  if (!text) return;

  try {
    const embedding = await embed(text);
    const db        = getDb();

    const { error } = await db.from("memory_chunks").upsert(
      {
        user_id:     userId,
        source_type: chunk.source_type,
        source_id:   chunk.source_id,
        text,
        embedding,
        metadata:    chunk.metadata ?? {},
        updated_at:  new Date().toISOString(),
      },
      { onConflict: "user_id,source_type,source_id" },
    );

    if (error) console.error("[memory/write] Supabase upsert:", error.message);
  } catch (err) {
    // Never propagate — a memory write failure must not break the calling route
    console.error("[memory/write]", (err as Error).message);
  }
}
