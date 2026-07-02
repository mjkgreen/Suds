import AppIntents
import ActivityKit
import CoreFoundation

@available(iOS 17.0, *)
struct QuickLogDrinkIntent: AppIntent {
    static let title: LocalizedStringResource = "Log a drink"
    static let isDiscoverable = false

    func perform() async throws -> some IntentResult {
        guard let d = UserDefaults(suiteName: "group.com.sudssocial.app"),
              let sessionId = d.string(forKey: "sessionId"),
              let userId = d.string(forKey: "userId"),
              let storedRefreshToken = d.string(forKey: "refreshToken"),
              let supabaseUrl = d.string(forKey: "supabaseUrl"),
              let anonKey = d.string(forKey: "anonKey")
        else { return .result() }

        // Fall back to a generic beer entry when no drink has been logged yet
        let rawDrinkType = d.string(forKey: "lastDrinkType") ?? ""
        let rawDrinkName = d.string(forKey: "lastDrinkName") ?? ""
        let drinkType = rawDrinkType.isEmpty ? "beer" : rawDrinkType
        let drinkName = rawDrinkName.isEmpty ? "Beer" : rawDrinkName

        // Optimistic update — widget reflects the tap before any network calls.
        // The JS 60s timer reconciles if the DB write later fails.
        // elapsed time and BAC are now computed declaratively in the widget view
        // from sessionStartDate (static attribute) + drinkCount, so they don't
        // need to be pushed here.
        for activity in Activity<SudsSessionAttributes>.activities {
            let s = activity.contentState
            await activity.update(using: SudsSessionAttributes.ContentState(
                drinkCount: s.drinkCount + 1,
                lastDrinkName: drinkName,
                memberCount: s.memberCount,
                memberNames: s.memberNames,
                isLogging: true
            ))
        }

        // Signal the main app to call Activity.update() from its process (not throttled like widget-extension calls).
        let cfCenter = CFNotificationCenterGetDarwinNotifyCenter()
        CFNotificationCenterPostNotification(
            cfCenter,
            CFNotificationName("com.sudssocial.app.quicklog" as CFString),
            nil, nil, true
        )

        // Persist to DB. Prefer a still-valid cached access token over refreshing — Supabase
        // refresh tokens are single-use, and the main app may rotate one concurrently, so
        // refreshing on every tap risks "Invalid Refresh Token: Already Used" and forces the
        // user's session to be torn down.
        let now = Date().timeIntervalSince1970
        let cachedAccessToken = d.string(forKey: "accessToken")
        let cachedExpiresAt = d.double(forKey: "accessTokenExpiresAt")

        let accessToken: String
        if let cached = cachedAccessToken, cachedExpiresAt > now + 30 {
            accessToken = cached
        } else {
            guard let (freshAccessToken, newRefreshToken, expiresIn) = try? await refreshAccessToken(
                refreshToken: storedRefreshToken,
                supabaseUrl: supabaseUrl,
                anonKey: anonKey
            ) else { return .result() }

            accessToken = freshAccessToken
            d.set(freshAccessToken, forKey: "accessToken")
            d.set(now + expiresIn, forKey: "accessTokenExpiresAt")
            if let newToken = newRefreshToken {
                d.set(newToken, forKey: "refreshToken")
            }
        }

        var req = URLRequest(url: URL(string: "\(supabaseUrl)/rest/v1/drink_logs")!, timeoutInterval: 20)
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
        _ = try? await URLSession.shared.data(for: req)

        return .result()
    }

    private func refreshAccessToken(
        refreshToken: String,
        supabaseUrl: String,
        anonKey: String
    ) async throws -> (String, String?, Double)? {
        var req = URLRequest(url: URL(string: "\(supabaseUrl)/auth/v1/token?grant_type=refresh_token")!, timeoutInterval: 20)
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
