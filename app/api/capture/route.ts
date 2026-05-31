import { type NextRequest, NextResponse } from "next/server";
import { processCapture } from "@/lib/pipeline/processCapture";
import { writeMemory } from "@/lib/memory";

export async function POST(req: NextRequest): Promise<NextResponse> {
  // Parse body — expects { text: string }
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  if (
    !body ||
    typeof body !== "object" ||
    typeof (body as Record<string, unknown>)["text"] !== "string"
  ) {
    return NextResponse.json(
      { error: "Missing required field: text" },
      { status: 422 },
    );
  }

  const rawText = ((body as Record<string, unknown>)["text"] as string).trim();
  if (!rawText) {
    return NextResponse.json({ error: "text must not be empty" }, { status: 422 });
  }

  // Single-owner dashboard — same user ID as the Telegram integration
  const userId = process.env.TELEGRAM_USER_ID;
  if (!userId) {
    return NextResponse.json(
      { error: "TELEGRAM_USER_ID not configured" },
      { status: 500 },
    );
  }

  try {
    const result = await processCapture({
      rawText,
      userId,
      source: "dashboard",
    });

    // Fire-and-forget memory chunk for the raw capture
    void writeMemory({
      source_type: "capture",
      source_id:   result.captureId,
      text:        rawText,
      metadata:    {
        kind:      result.kind,
        urgency:   result.urgency,
        summary:   result.summary,
        tags:      result.tags,
        routed_to: result.routedTo,
        routed_id: result.routedId,
      },
    });

    // If the capture created a task, also embed the task
    if (result.routedTo === "tasks" && result.routedId) {
      void writeMemory({
        source_type: "task",
        source_id:   result.routedId,
        text:        [result.summary, rawText, result.tags.join(" ")].filter(Boolean).join(". "),
        metadata:    { urgency: result.urgency, tags: result.tags, from_capture: result.captureId },
      });
    }

    return NextResponse.json({ ok: true, result });
  } catch (err) {
    console.error("[capture] Error:", err);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}
