import AppIntents
import ActivityKit

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

        let weightLbs = d.double(forKey: "weightLbs")
        let sessionStart = d.double(forKey: "sessionStart")

        // Abort if no drink has been logged yet — avoids inserting a fabricated row.
        guard let lastDrinkType = d.string(forKey: "lastDrinkType"), !lastDrinkType.isEmpty,
              let lastDrinkName = d.string(forKey: "lastDrinkName"), !lastDrinkName.isEmpty
        else { return .result() }

        // Refresh the JWT; Supabase access tokens expire after 1 hour.
        // Also saves the rotated refresh_token so the next tap uses a fresh token.
        guard let (accessToken, newRefreshToken) = try? await refreshAccessToken(
            refreshToken: storedRefreshToken,
            supabaseUrl: supabaseUrl,
            anonKey: anonKey
        ) else { return .result() }

        if let newToken = newRefreshToken {
            d.set(newToken, forKey: "refreshToken")
        }

        // Insert a minimal drink_log row
        var req = URLRequest(url: URL(string: "\(supabaseUrl)/rest/v1/drink_logs")!)
        req.httpMethod = "POST"
        req.setValue("Bearer \(accessToken)", forHTTPHeaderField: "Authorization")
        req.setValue(anonKey, forHTTPHeaderField: "apikey")
        req.setValue("application/json", forHTTPHeaderField: "Content-Type")
        let body: [String: Any] = [
            "user_id": userId,
            "session_id": sessionId,
            "drink_type": lastDrinkType,
            "drink_name": lastDrinkName,
            "quantity": 1,
            "logged_at": ISO8601DateFormatter().string(from: Date()),
        ]
        req.httpBody = try? JSONSerialization.data(withJSONObject: body)

        guard let (_, response) = try? await URLSession.shared.data(for: req),
              (response as? HTTPURLResponse)?.statusCode == 201
        else { return .result() }

        // Update Live Activity only after confirming the DB write succeeded
        // If the user taps +1 while a JS-side log is also in flight, both increment
        // from the same stored drinkCount. The JS 60s timer corrects on its next tick.
        for activity in Activity<SudsSessionAttributes>.activities {
            let s = activity.contentState
            let newCount = s.drinkCount + 1
            let elapsed = sessionStart > 0
                ? Int((Date().timeIntervalSince1970 - sessionStart) / 60)
                : s.elapsedMinutes
            let newBAC: Double = weightLbs > 0
                ? max(0, (Double(newCount) * 0.6 * 5.14) / (weightLbs * 0.70) - (0.015 * Double(elapsed) / 60))
                : 0.0
            await activity.update(using: SudsSessionAttributes.ContentState(
                drinkCount: newCount,
                elapsedMinutes: elapsed,
                lastDrinkName: lastDrinkName,
                memberCount: s.memberCount,
                bacEstimate: newBAC
            ))
        }

        return .result()
    }

    // Returns (accessToken, newRefreshToken?) — saves rotated token back to UserDefaults
    private func refreshAccessToken(
        refreshToken: String,
        supabaseUrl: String,
        anonKey: String
    ) async throws -> (String, String?)? {
        var req = URLRequest(url: URL(string: "\(supabaseUrl)/auth/v1/token?grant_type=refresh_token")!)
        req.httpMethod = "POST"
        req.setValue(anonKey, forHTTPHeaderField: "apikey")
        req.setValue("application/json", forHTTPHeaderField: "Content-Type")
        req.httpBody = try? JSONSerialization.data(withJSONObject: ["refresh_token": refreshToken])
        let (data, _) = try await URLSession.shared.data(for: req)
        guard let json = try? JSONSerialization.jsonObject(with: data) as? [String: Any],
              let accessToken = json["access_token"] as? String
        else { return nil }
        return (accessToken, json["refresh_token"] as? String)
    }
}
