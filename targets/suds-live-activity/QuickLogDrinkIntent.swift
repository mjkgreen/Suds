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

        // Fall back to a generic beer entry when no drink has been logged yet
        let rawDrinkType = d.string(forKey: "lastDrinkType") ?? ""
        let rawDrinkName = d.string(forKey: "lastDrinkName") ?? ""
        let drinkType = rawDrinkType.isEmpty ? "beer" : rawDrinkType
        let drinkName = rawDrinkName.isEmpty ? "Beer" : rawDrinkName

        // Optimistic update — widget reflects the tap before any network calls.
        // The JS 60s timer reconciles if the DB write later fails.
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
                lastDrinkName: drinkName,
                memberCount: s.memberCount,
                bacEstimate: newBAC,
                memberNames: s.memberNames
            ))
        }

        // Persist to DB — refresh the JWT first (Supabase tokens expire after 1 hour).
        guard let (accessToken, newRefreshToken) = try? await refreshAccessToken(
            refreshToken: storedRefreshToken,
            supabaseUrl: supabaseUrl,
            anonKey: anonKey
        ) else { return .result() }

        if let newToken = newRefreshToken {
            d.set(newToken, forKey: "refreshToken")
        }

        var req = URLRequest(url: URL(string: "\(supabaseUrl)/rest/v1/drink_logs")!)
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
