import { serve } from "https://deno.land/std@0.195.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { corsHeaders } from "../_shared/cors.ts";

/**
 * Drains public.storage_cleanup_queue, removing each queued file through the
 * Storage API (deleting storage.objects rows directly would leave the actual
 * files behind).
 *
 * Rows are queued by database triggers when a drink log (or its media) or a
 * profile is deleted, and those triggers call this function. It only ever
 * acts on queued rows, so it's safe for anyone to invoke; anything left over
 * from a failed run is picked up by the next one.
 */

const BATCH_SIZE = 100;
const MAX_BATCHES = 20;

interface QueueRow {
  id: number;
  bucket_id: string;
  path: string;
}

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
  );

  let removed = 0;

  for (let batch = 0; batch < MAX_BATCHES; batch++) {
    const { data: rows, error } = await supabase
      .from("storage_cleanup_queue")
      .select("id, bucket_id, path")
      .order("id")
      .limit(BATCH_SIZE);
    if (error) return json({ error: error.message, removed }, 500);
    if (!rows || rows.length === 0) break;

    const byBucket = new Map<string, QueueRow[]>();
    for (const row of rows as QueueRow[]) {
      byBucket.set(row.bucket_id, [...(byBucket.get(row.bucket_id) ?? []), row]);
    }

    const doneIds: number[] = [];
    let failed = false;
    for (const [bucket, bucketRows] of byBucket) {
      const { error: removeError } = await supabase.storage
        .from(bucket)
        .remove(bucketRows.map((r) => r.path));
      if (removeError) {
        // Leave these rows queued for the next run.
        console.error(`cleanup-storage: removing from ${bucket} failed:`, removeError.message);
        failed = true;
        continue;
      }
      doneIds.push(...bucketRows.map((r) => r.id));
    }

    if (doneIds.length === 0) break;
    const { error: deleteError } = await supabase
      .from("storage_cleanup_queue")
      .delete()
      .in("id", doneIds);
    if (deleteError) return json({ error: deleteError.message, removed }, 500);
    removed += doneIds.length;

    // Failed rows sort first next time, so stop rather than retry them in a loop.
    if (failed || rows.length < BATCH_SIZE) break;
  }

  return json({ removed });
});
