import { serve } from "https://deno.land/std@0.195.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { corsHeaders } from "../_shared/cors.ts";

/**
 * Sends the push for one in_app_notifications row.
 *
 * Called by a database trigger with { notification_id } whenever a
 * notification is inserted. The row is claimed by setting pushed_at, so each
 * notification is pushed at most once, and the message is built only from the
 * stored row. That makes it safe to deploy with --no-verify-jwt: a caller can
 * at most trigger a not-yet-sent notification to go out.
 */

type NotificationType =
  | "like"
  | "comment"
  | "follow"
  | "session_invite"
  | "follow_request"
  | "follow_request_accepted"
  | "mention"
  | "tag";

interface NotificationRow {
  id: string;
  user_id: string;
  actor_id: string | null;
  actor_name: string | null;
  type: NotificationType;
  context: {
    drink_log_id?: string;
    comment_preview?: string;
    session_id?: string;
    invite_token?: string;
    /** mention: where the mention was made */
    source?: "drink" | "comment";
  };
}

interface NotificationPreferences {
  notify_likes: boolean;
  notify_comments: boolean;
  notify_follows: boolean;
  notify_session_invites: boolean;
  notify_mentions: boolean;
}

interface ExpoMessage {
  to: string;
  sound: "default";
  title: string;
  body: string;
  data: Record<string, string>;
}

interface ExpoPushTicket {
  status: "ok" | "error";
  message?: string;
  details?: { error?: string };
}

const PREF_BY_TYPE: Record<NotificationType, keyof NotificationPreferences> = {
  like: "notify_likes",
  comment: "notify_comments",
  follow: "notify_follows",
  follow_request: "notify_follows",
  follow_request_accepted: "notify_follows",
  session_invite: "notify_session_invites",
  mention: "notify_mentions",
  tag: "notify_mentions",
};

function buildNotification(n: NotificationRow): { title: string; body: string } {
  const name = n.actor_name ?? "Someone";
  switch (n.type) {
    case "like":
      return { title: "New Like", body: `${name} liked your drink` };
    case "comment":
      return {
        title: "New Comment",
        body: n.context.comment_preview ? `${name}: ${n.context.comment_preview}` : `${name} commented on your drink`,
      };
    case "follow":
      return { title: "New Follower", body: `${name} started following you` };
    case "follow_request":
      return { title: "Follow Request", body: `${name} requested to follow you` };
    case "follow_request_accepted":
      return { title: "Request Accepted", body: `${name} accepted your follow request` };
    case "session_invite":
      return { title: "Session Invite", body: `${name} invited you to join their session` };
    case "mention":
      return {
        title: "New Mention",
        body: n.context.comment_preview
          ? `${name} mentioned you: ${n.context.comment_preview}`
          : `${name} mentioned you`,
      };
    case "tag":
      return { title: "Tagged", body: `${name} tagged you in a drink` };
  }
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

  try {
    const { notification_id } = await req.json();
    if (typeof notification_id !== "string") {
      return json({ success: false, error: "notification_id required" }, 400);
    }

    // Service role client bypasses RLS so we can read another user's data
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    // Claim the notification; if it's already been pushed (or doesn't exist) stop.
    const { data: claimed, error: claimError } = await supabase
      .from("in_app_notifications")
      .update({ pushed_at: new Date().toISOString() })
      .eq("id", notification_id)
      .is("pushed_at", null)
      .select("id, user_id, actor_id, actor_name, type, context")
      .maybeSingle();
    if (claimError) throw claimError;
    if (!claimed) return json({ success: true, skipped: "already_pushed" });

    const notification = claimed as NotificationRow;
    const recipientId = notification.user_id;

    // Ensure a preferences row exists with defaults, then read it
    await supabase
      .from("notification_preferences")
      .upsert({ user_id: recipientId }, { onConflict: "user_id", ignoreDuplicates: true });

    const { data: prefs, error: prefsError } = await supabase
      .from("notification_preferences")
      .select("notify_likes, notify_comments, notify_follows, notify_session_invites, notify_mentions")
      .eq("user_id", recipientId)
      .single();
    if (prefsError) throw prefsError;

    const prefKey = PREF_BY_TYPE[notification.type];
    if (prefKey && !(prefs as NotificationPreferences)[prefKey]) {
      return json({ success: true, skipped: "preference_disabled" });
    }

    const { data: tokens, error: tokensError } = await supabase
      .from("push_tokens")
      .select("token")
      .eq("user_id", recipientId);
    if (tokensError) throw tokensError;

    const tokenList = (tokens ?? []).map((t: { token: string }) => t.token);
    if (tokenList.length === 0) {
      return json({ success: true, skipped: "no_tokens" });
    }

    const { title, body } = buildNotification(notification);
    const ctx = notification.context ?? {};

    const messages: ExpoMessage[] = tokenList.map((to) => ({
      to,
      sound: "default",
      title,
      body,
      data: {
        type: notification.type,
        notification_id: notification.id,
        actor_id: notification.actor_id ?? "",
        drink_log_id: ctx.drink_log_id ?? "",
        session_id: ctx.session_id ?? "",
        invite_token: ctx.invite_token ?? "",
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

    const expoResult = await expoResponse.json();
    if (!expoResponse.ok) {
      // Request-level failure (e.g. bad payload, missing credentials) —
      // surface it in the function logs instead of failing silently.
      console.error("send-push-notification: Expo rejected request:", JSON.stringify(expoResult));
      return json({ success: false, error: "expo_request_failed", details: expoResult }, 502);
    }

    const tickets: ExpoPushTicket[] = Array.isArray(expoResult.data) ? expoResult.data : [];
    const staleTokens: string[] = [];
    tickets.forEach((ticket, i) => {
      if (ticket.status !== "error") return;
      if (ticket.details?.error === "DeviceNotRegistered") {
        staleTokens.push(tokenList[i]);
      } else {
        // e.g. InvalidCredentials (APNs/FCM not configured in EAS), MessageTooBig
        console.error(
          `send-push-notification: ticket error for ${notification.id}:`,
          ticket.details?.error ?? "unknown",
          ticket.message ?? ""
        );
      }
    });

    if (staleTokens.length > 0) {
      await supabase.from("push_tokens").delete().in("token", staleTokens);
    }

    const sent = tickets.filter((t) => t.status === "ok").length;
    return json({ success: true, sent });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : JSON.stringify(error);
    console.error("send-push-notification error:", message);
    return json({ success: false, error: message }, 500);
  }
});
