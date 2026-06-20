import { serve } from "https://deno.land/std@0.195.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { corsHeaders } from "../_shared/cors.ts";

interface PushPayload {
  actor_id: string;
  actor_name: string;
  recipient_id: string;
  type: "like" | "comment" | "follow";
  context: {
    drink_log_id?: string;
    comment_preview?: string;
  };
}

interface NotificationPreferences {
  notify_likes: boolean;
  notify_comments: boolean;
  notify_follows: boolean;
}

interface PushTokenRow {
  token: string;
}

interface ExpoMessage {
  to: string;
  sound: "default";
  title: string;
  body: string;
  data: Record<string, string>;
}

interface ExpoPushResult {
  status: string;
  details?: { error?: string };
}

interface ExpoPushResponse {
  data?: ExpoPushResult[];
}

function buildNotification(
  actorName: string,
  type: PushPayload["type"],
  context: PushPayload["context"]
): { title: string; body: string } {
  switch (type) {
    case "like":
      return { title: "New Like", body: `${actorName} liked your drink` };
    case "comment":
      return {
        title: "New Comment",
        body: context.comment_preview
          ? `${actorName}: ${context.comment_preview}`
          : `${actorName} commented on your drink`,
      };
    case "follow":
      return { title: "New Follower", body: `${actorName} started following you` };
  }
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const payload: PushPayload = await req.json();
    const { actor_id, actor_name, recipient_id, type, context } = payload;

    if (actor_id === recipient_id) {
      return new Response(
        JSON.stringify({ success: true, skipped: "self" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Service role client bypasses RLS so we can read another user's data
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    // Ensure a preferences row exists with defaults, then read it
    await supabase
      .from("notification_preferences")
      .insert({ user_id: recipient_id })
      .select()
      .maybeSingle();

    const { data: prefs } = await supabase
      .from("notification_preferences")
      .select("notify_likes, notify_comments, notify_follows")
      .eq("user_id", recipient_id)
      .single();

    if (!prefs) {
      return new Response(
        JSON.stringify({ success: true, skipped: "no_prefs" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const prefsByType: Record<PushPayload["type"], keyof NotificationPreferences> = {
      like: "notify_likes",
      comment: "notify_comments",
      follow: "notify_follows",
    };

    if (!(prefs as NotificationPreferences)[prefsByType[type]]) {
      return new Response(
        JSON.stringify({ success: true, skipped: "preference_disabled" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const { data: tokens } = await supabase
      .from("push_tokens")
      .select("token")
      .eq("user_id", recipient_id);

    const tokenRows = (tokens ?? []) as PushTokenRow[];

    if (tokenRows.length === 0) {
      return new Response(
        JSON.stringify({ success: true, skipped: "no_tokens" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const { title, body } = buildNotification(actor_name, type, context);

    const messages: ExpoMessage[] = tokenRows.map((t) => ({
      to: t.token,
      sound: "default",
      title,
      body,
      data: {
        type,
        actor_id,
        drink_log_id: context.drink_log_id ?? "",
      },
    }));

    const expoResponse = await fetch("https://exp.host/--/api/v2/push/send", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json",
      },
      body: JSON.stringify(messages),
    });

    const expoResult: ExpoPushResponse = await expoResponse.json();
    const results: ExpoPushResult[] = Array.isArray(expoResult.data) ? expoResult.data : [];

    const staleTokens = tokenRows
      .filter((_, i) => results[i]?.details?.error === "DeviceNotRegistered")
      .map((t) => t.token);

    if (staleTokens.length > 0) {
      await supabase.from("push_tokens").delete().in("token", staleTokens);
    }

    return new Response(
      JSON.stringify({ success: true, sent: tokenRows.length - staleTokens.length }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 200 }
    );
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Unknown error";
    console.error("send-push-notification error:", message);
    return new Response(
      JSON.stringify({ success: false, error: message }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 400 }
    );
  }
});
