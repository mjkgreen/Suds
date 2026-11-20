import AppIntents
import ActivityKit
import CoreFoundation

// LiveActivityIntent → the system runs perform() in the MAIN APP's process, not this
// widget extension's. That is essential: Activity<SudsSessionAttributes>.activities is
// always EMPTY inside the widget extension process (ActivityKit only exposes activities
// to the process that requested them), so any activity.update() here is a silent no-op —
// which is exactly why the spinner and optimistic +1 never rendered as a plain AppIntent.
//
// The app target compiles its own QuickLogDrinkIntent (see
// modules/suds-live-activity-bridge/app-target/QuickLogDrinkIntent.swift) that delegates
// to SudsQuickLogRunner. This copy exists so Button(intent:) compiles in this target and
// as a last-resort fallback (DB write still works from here; UI updates don't).
@available(iOS 17.0, *)
struct QuickLogDrinkIntent: LiveActivityIntent {
    static let title: LocalizedStringResource = "Log a drink"
    static let isDiscoverable = false
    static let openAppWhenRun = false

    func perform() async throws -> some IntentResult {
        guard let d = UserDefaults(suiteName: "group.com.sudssocial.app"),
              let sessionId = d.string(forKey: "sessionId"),
              let userId = d.string(forKey: "userId"),
              let storedRefreshToken = d.string(forKey: "refreshToken"),
              let supabaseUrl = d.string(forKey: "supabaseUrl"),
              let anonKey = d.string(forKey: "anonKey")
        else {
            for activity in Activity<SudsSessionAttributes>.activities {
                let s = activity.contentState
                await activity.update(using: SudsSessionAttributes.ContentState(
                    drinkCount: s.drinkCount,
                    groupDrinkCount: s.groupDrinkCount,
                    lastDrinkName: "⚠️ no session", lastDrinkQuantity: s.lastDrinkQuantity,
                    memberCount: s.memberCount,
                    memberNames: s.memberNames,
                    isLogging: false, bac: s.bac
                ))
            }
            return .result()
        }

        // Cross-process cooldown — UserDefaults persists even if the extension process
        // is killed and restarted between taps. Prevents double-inserts.
        let lastTap = d.double(forKey: "lastQuickLogTapAt")
        let now = Date().timeIntervalSince1970
        guard now - lastTap >= 5.0 else { return .result() }
        d.set(now, forKey: "lastQuickLogTapAt")

        // Signal to the bridge's updateActivity that an intent is in flight.
        // While intentIsLogging = true, every _refresh() in the main app will pass
        // isLogging: true through to the ContentState, preserving the spinner.
        d.set(true, forKey: "intentIsLogging")
        d.set(now, forKey: "intentIsLoggingAt") // staleness marker — see bridge updateActivity
        d.synchronize() // force plist flush before first await so main app reads true immediately
        defer { d.set(false, forKey: "intentIsLogging") }

        // Fall back to a generic beer entry when no drink has been logged yet
        let rawDrinkType = d.string(forKey: "lastDrinkType") ?? ""
        let rawDrinkName = d.string(forKey: "lastDrinkName") ?? ""
        let drinkType = rawDrinkType.isEmpty ? "beer" : rawDrinkType
        let drinkName = rawDrinkName.isEmpty ? "Beer" : rawDrinkName
        // Count it like the app does: non-alcoholic drinks (water etc.) don't add to
        // the drink count, which also drives the widget's BAC. Keep in sync with
        // NON_ALCOHOLIC_DRINK_TYPES in src/types/models.ts.
        // The +1 repeats the last drink as logged, quantity included (a 1.5 glass of
        // wine logs 1.5 again). Older app builds never stored it: fall back to 1.
        let storedQuantity = d.double(forKey: "lastDrinkQuantity")
        let quantity = storedQuantity > 0 ? storedQuantity : 1
        let added: Double = ["water", "soft_drink", "mocktail", "non_alcoholic"].contains(drinkType) ? 0 : quantity

        // Optimistic update — count bump and spinner appear immediately.
        for activity in Activity<SudsSessionAttributes>.activities {
            let s = activity.contentState
            await activity.update(using: SudsSessionAttributes.ContentState(
                drinkCount: s.drinkCount + added,
                groupDrinkCount: s.groupDrinkCount + added,
                lastDrinkName: drinkName, lastDrinkQuantity: quantity,
                memberCount: s.memberCount,
                memberNames: s.memberNames,
                isLogging: true, bac: added > 0 ? s.bac?.adding(drinks: added, at: Date()) : s.bac
            ))
        }

        // Persist to DB. Prefer a still-valid cached access token over refreshing — Supabase
        // refresh tokens are single-use, and the main app may rotate one concurrently, so
        // refreshing on every tap risks "Invalid Refresh Token: Already Used".
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
            ) else {
                // Token refresh failed — undo the optimistic +1 and clear the spinner.
                d.set(false, forKey: "intentIsLogging")
                for activity in Activity<SudsSessionAttributes>.activities {
                    let s = activity.contentState
                    await activity.update(using: SudsSessionAttributes.ContentState(
                        drinkCount: max(0, s.drinkCount - added), groupDrinkCount: max(0, s.groupDrinkCount - added),
                        lastDrinkName: s.lastDrinkName, lastDrinkQuantity: s.lastDrinkQuantity,
                        memberCount: s.memberCount, memberNames: s.memberNames, isLogging: false,
                        bac: added > 0 ? s.bac?.removingLatestDrink() : s.bac
                    ))
                }
                return .result()
            }

            accessToken = freshAccessToken
            d.set(freshAccessToken, forKey: "accessToken")
            d.set(now + expiresIn, forKey: "accessTokenExpiresAt")
            if let newToken = newRefreshToken {
                d.set(newToken, forKey: "refreshToken")
            }
        }

        guard let drinkLogsUrl = URL(string: "\(supabaseUrl)/rest/v1/drink_logs") else { return .result() }
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
            "quantity": quantity,
            "logged_at": ISO8601DateFormatter().string(from: Date()),
        ]
        req.httpBody = try? JSONSerialization.data(withJSONObject: body)
        guard let (_, response) = try? await URLSession.shared.data(for: req),
              let http = response as? HTTPURLResponse,
              (200..<300).contains(http.statusCode) else {
            // DB write failed — roll back optimistic count and clear spinner.
            d.set(false, forKey: "intentIsLogging")
            for activity in Activity<SudsSessionAttributes>.activities {
                let s = activity.contentState
                await activity.update(using: SudsSessionAttributes.ContentState(
                    drinkCount: max(0, s.drinkCount - added), groupDrinkCount: max(0, s.groupDrinkCount - added),
                    lastDrinkName: s.lastDrinkName, lastDrinkQuantity: s.lastDrinkQuantity,
                    memberCount: s.memberCount, memberNames: s.memberNames, isLogging: false, bac: added > 0 ? s.bac?.removingLatestDrink() : s.bac
                ))
            }
            return .result()
        }

        // DB write confirmed. Clear intentIsLogging explicitly before Darwin so the
        // Darwin-triggered _refresh() in the main app immediately sees false and
        // calls updateActivity(isLogging: false) to clear the spinner.
        // defer is a backup — runs on return.
        d.set(false, forKey: "intentIsLogging")
        d.synchronize() // ensure false is visible to main app before Darwin fires _refresh()

        // Self-clear the widget directly (fallback: handles case where main app is dead
        // or backgrounded and never receives Darwin).
        for activity in Activity<SudsSessionAttributes>.activities {
            let s = activity.contentState
            await activity.update(using: SudsSessionAttributes.ContentState(
                drinkCount: s.drinkCount,
                groupDrinkCount: s.groupDrinkCount,
                lastDrinkName: drinkName, lastDrinkQuantity: quantity,
                memberCount: s.memberCount,
                memberNames: s.memberNames,
                isLogging: false, bac: s.bac
            ))
        }

        let cfCenter = CFNotificationCenterGetDarwinNotifyCenter()
        CFNotificationCenterPostNotification(
            cfCenter,
            CFNotificationName("com.sudssocial.app.quicklog" as CFString),
            nil, nil, true
        )

        return .result()
    }

    private func refreshAccessToken(
        refreshToken: String,
        supabaseUrl: String,
        anonKey: String
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
