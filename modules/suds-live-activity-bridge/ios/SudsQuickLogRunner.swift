import ActivityKit
import CoreFoundation
import Foundation

// Executes the +1 quick-log flow in the MAIN APP process.
//
// Why this exists: a plain AppIntent attached to a Live Activity button runs in the
// widget extension's process, where Activity<SudsSessionAttributes>.activities is
// ALWAYS EMPTY — ActivityKit only exposes activities to the process that requested
// them. Every activity.update() in the old extension-side intent was a silent no-op,
// which is why the spinner and optimistic +1 never appeared.
//
// The fix is QuickLogDrinkIntent conforming to LiveActivityIntent, which the system
// runs in the app's process. That intent is compiled directly into the app target
// (injected by plugins/withLiveActivityBridge.js) and delegates here, so the activity
// updates use the exact same SudsSessionAttributes type that startActivity() used.
@available(iOS 16.1, *)
public enum SudsQuickLogRunner {
  private static let appGroup = "group.com.sudssocial.app"
  private static let darwinName = "com.sudssocial.app.quicklog"

  public static func run() async {
    guard let d = UserDefaults(suiteName: appGroup),
          let sessionId = d.string(forKey: "sessionId"),
          let userId = d.string(forKey: "userId"),
          let storedRefreshToken = d.string(forKey: "refreshToken"),
          let supabaseUrl = d.string(forKey: "supabaseUrl"),
          let anonKey = d.string(forKey: "anonKey")
    else {
      await updateAll { s in
        SudsSessionAttributes.ContentState(
          drinkCount: s.drinkCount, lastDrinkName: "⚠️ no session",
          memberCount: s.memberCount, memberNames: s.memberNames, isLogging: false
        )
      }
      return
    }

    // Cross-process cooldown — prevents double-inserts from rapid taps.
    let lastTap = d.double(forKey: "lastQuickLogTapAt")
    let now = Date().timeIntervalSince1970
    guard now - lastTap >= 5.0 else { return }
    d.set(now, forKey: "lastQuickLogTapAt")

    // While intentIsLogging = true, _refresh() in JS passes isLogging: true through
    // every ContentState push, preserving the spinner until the DB write lands.
    d.set(true, forKey: "intentIsLogging")

    let rawDrinkType = d.string(forKey: "lastDrinkType") ?? ""
    let rawDrinkName = d.string(forKey: "lastDrinkName") ?? ""
    let drinkType = rawDrinkType.isEmpty ? "beer" : rawDrinkType
    let drinkName = rawDrinkName.isEmpty ? "Beer" : rawDrinkName

    // Optimistic update — count+1 and spinner appear immediately.
    await updateAll { s in
      SudsSessionAttributes.ContentState(
        drinkCount: s.drinkCount + 1, lastDrinkName: drinkName,
        memberCount: s.memberCount, memberNames: s.memberNames, isLogging: true
      )
    }

    // Prefer a still-valid cached access token over refreshing — Supabase refresh
    // tokens are single-use and the app may rotate one concurrently.
    let cachedAccessToken = d.string(forKey: "accessToken")
    let cachedExpiresAt = d.double(forKey: "accessTokenExpiresAt")

    let accessToken: String
    if let cached = cachedAccessToken, cachedExpiresAt > now + 30 {
      accessToken = cached
    } else {
      guard let (freshAccessToken, newRefreshToken, expiresIn) = try? await refreshAccessToken(
        refreshToken: storedRefreshToken, supabaseUrl: supabaseUrl, anonKey: anonKey
      ) else {
        d.set(false, forKey: "intentIsLogging")
        await updateAll { s in
          SudsSessionAttributes.ContentState(
            drinkCount: max(0, s.drinkCount - 1), lastDrinkName: s.lastDrinkName,
            memberCount: s.memberCount, memberNames: s.memberNames, isLogging: false
          )
        }
        return
      }
      accessToken = freshAccessToken
      d.set(freshAccessToken, forKey: "accessToken")
      d.set(now + expiresIn, forKey: "accessTokenExpiresAt")
      if let newToken = newRefreshToken { d.set(newToken, forKey: "refreshToken") }
    }

    guard let drinkLogsUrl = URL(string: "\(supabaseUrl)/rest/v1/drink_logs") else {
      d.set(false, forKey: "intentIsLogging")
      return
    }
    var req = URLRequest(url: drinkLogsUrl, timeoutInterval: 20)
    req.httpMethod = "POST"
    req.setValue("Bearer \(accessToken)", forHTTPHeaderField: "Authorization")
    req.setValue(anonKey, forHTTPHeaderField: "apikey")
    req.setValue("application/json", forHTTPHeaderField: "Content-Type")
    let body: [String: Any] = [
      "user_id": userId,
      "session_id": sessionId,
      "drink_type": drinkType,
      "drink_name": drinkName,
      "quantity": 1,
      "logged_at": ISO8601DateFormatter().string(from: Date()),
    ]
    req.httpBody = try? JSONSerialization.data(withJSONObject: body)
    guard let (_, response) = try? await URLSession.shared.data(for: req),
          let http = response as? HTTPURLResponse,
          (200..<300).contains(http.statusCode) else {
      // DB write failed — roll back the optimistic count and clear the spinner.
      d.set(false, forKey: "intentIsLogging")
      await updateAll { s in
        SudsSessionAttributes.ContentState(
          drinkCount: max(0, s.drinkCount - 1), lastDrinkName: s.lastDrinkName,
          memberCount: s.memberCount, memberNames: s.memberNames, isLogging: false
        )
      }
      return
    }

    // DB write confirmed — clear the spinner, keep the optimistic count.
    d.set(false, forKey: "intentIsLogging")
    await updateAll { s in
      SudsSessionAttributes.ContentState(
        drinkCount: s.drinkCount, lastDrinkName: drinkName,
        memberCount: s.memberCount, memberNames: s.memberNames, isLogging: false
      )
    }

    // Wake the JS side (bridge observer lives in this same process; Darwin
    // notifications are also delivered to the posting process) so it can pull
    // the authoritative count and invalidate the feed queries.
    CFNotificationCenterPostNotification(
      CFNotificationCenterGetDarwinNotifyCenter(),
      CFNotificationName(darwinName as CFString),
      nil, nil, true
    )
  }

  private static func updateAll(
    _ transform: (SudsSessionAttributes.ContentState) -> SudsSessionAttributes.ContentState
  ) async {
    for activity in Activity<SudsSessionAttributes>.activities {
      await activity.update(using: transform(activity.contentState))
    }
  }

  private static func refreshAccessToken(
    refreshToken: String, supabaseUrl: String, anonKey: String
  ) async throws -> (String, String?, Double)? {
    guard let tokenUrl = URL(string: "\(supabaseUrl)/auth/v1/token?grant_type=refresh_token") else { return nil }
    var req = URLRequest(url: tokenUrl, timeoutInterval: 20)
    req.httpMethod = "POST"
    req.setValue(anonKey, forHTTPHeaderField: "apikey")
    req.setValue("application/json", forHTTPHeaderField: "Content-Type")
    req.httpBody = try? JSONSerialization.data(withJSONObject: ["refresh_token": refreshToken])
    let (data, _) = try await URLSession.shared.data(for: req)
    guard let json = try? JSONSerialization.jsonObject(with: data) as? [String: Any],
          let accessToken = json["access_token"] as? String
    else { return nil }
    let expiresIn = (json["expires_in"] as? Double) ?? 3600
    return (accessToken, json["refresh_token"] as? String, expiresIn)
  }
}
