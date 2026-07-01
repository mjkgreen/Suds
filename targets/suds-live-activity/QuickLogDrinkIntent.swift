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

        // Optimistically update the Live Activity immediately so the widget
        // reflects the tap before any network round-trips complete.
        var optimisticStates: [(Activity<SudsSessionAttributes>, SudsSessionAttributes.ContentState)] = []
        for activity in Activity<SudsSessionAttributes>.activities {
            let s = activity.contentState
            let newCount = s.drinkCount + 1
            let elapsed = sessionStart > 0
                ? Int((Date().timeIntervalSince1970 - sessionStart) / 60)
                : s.elapsedMinutes
            let newBAC: Double = weightLbs > 0
                ? max(0, (Double(newCount) * 0.6 * 5.14) / (weightLbs * 0.70) - (0.015 * Double(elapsed) / 60))
                : 0.0
            let newState = SudsSessionAttributes.ContentState(
                drinkCount: newCount,
                elapsedMinutes: elapsed,
                lastDrinkName: lastDrinkName,
                memberCount: s.memberCount,
                bacEstimate: newBAC,
                memberNames: s.memberNames
            )
            optimisticStates.append((activity, s))
            await activity.update(using: newState)
        }

        // Refresh the JWT; Supabase access tokens expire after 1 hour.
        guard let (accessToken, newRefreshToken) = try? await refreshAccessToken(
            refreshToken: storedRefreshToken,
            supabaseUrl: supabaseUrl,
            anonKey: anonKey
        ) else {
            // Revert optimistic updates on auth failure
            for (activity, originalState) in optimisticStates {
                await activity.update(using: originalState)
            }
            return .result()
        }

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
        else {
            // Revert optimistic updates on DB write failure
            for (activity, originalState) in optimisticStates {
                await activity.update(using: originalState)
            }
            return .result()
        }

        // DB write confirmed — optimistic state is now accurate.
        // The JS 60s timer will also sync on its next tick for ground-truth reconciliation.
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
