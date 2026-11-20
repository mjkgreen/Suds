import ExpoModulesCore
import ActivityKit
import CoreFoundation

// CFNotificationCallback must be a top-level C function — cannot be a closure or method.
private func sudsQuickLogCallback(
    _ center: CFNotificationCenter?, _ observer: UnsafeMutableRawPointer?,
    _ name: CFNotificationName?, _ object: UnsafeRawPointer?, _ userInfo: CFDictionary?
) {
    NotificationCenter.default.post(name: .sudsQuickLogInternal, object: nil)
}
private extension Notification.Name {
    static let sudsQuickLogInternal = Notification.Name("suds.quicklog.internal")
}

// TODO(security): refreshToken is written to App Group UserDefaults (plaintext plist on disk).
// For production hardening, migrate to shared Keychain using kSecAttrAccessGroup with the
// keychain-access-groups entitlement in both targets. Current threat model: single developer,
// single controlled extension — acceptable risk for v1.
public class SudsLiveActivityBridgeModule: Module {
  private var quickLogObserver: NSObjectProtocol?

  private func setupDarwinObserver() {
    CFNotificationCenterAddObserver(
      CFNotificationCenterGetDarwinNotifyCenter(), nil, sudsQuickLogCallback,
      "com.sudssocial.app.quicklog" as CFString, nil, .deliverImmediately
    )
    quickLogObserver = NotificationCenter.default.addObserver(
      forName: .sudsQuickLogInternal, object: nil, queue: .main
    ) { [weak self] _ in
      self?.sendEvent("onQuickLog", [:])
    }
  }

  private func teardownDarwinObserver() {
    CFNotificationCenterRemoveObserver(
      CFNotificationCenterGetDarwinNotifyCenter(), nil,
      CFNotificationName("com.sudssocial.app.quicklog" as CFString), nil
    )
    if let obs = quickLogObserver { NotificationCenter.default.removeObserver(obs) }
  }

  public func definition() -> ModuleDefinition {
    Name("SudsLiveActivityBridge")

    Events("onQuickLog")

    OnCreate { self.setupDarwinObserver() }

    OnDestroy { self.teardownDarwinObserver() }

    Function("isSupported") { () -> Bool in
      guard #available(iOS 16.1, *) else { return false }
      return ActivityAuthorizationInfo().areActivitiesEnabled
    }

    AsyncFunction("getActivities") { () -> [[String: Any]] in
      guard #available(iOS 16.1, *) else { return [] }
      return Activity<SudsSessionAttributes>.activities.map { activity in
        let elapsedMinutes = Int(-activity.attributes.sessionStartDate.timeIntervalSinceNow / 60)
        return [
          "id": activity.id,
          "sessionTitle": activity.attributes.sessionTitle,
          "drinkCount": activity.contentState.drinkCount,
          "groupDrinkCount": activity.contentState.groupDrinkCount,
          "elapsedMinutes": elapsedMinutes,
          "lastDrinkName": activity.contentState.lastDrinkName,
          "lastDrinkQuantity": activity.contentState.lastDrinkQuantity,
          "memberCount": activity.contentState.memberCount,
          "memberNames": activity.contentState.memberNames,
        ]
      }
    }

    AsyncFunction("startActivity") { (sessionTitle: String, drinkCount: Double, groupDrinkCount: Double, memberCount: Int, memberNames: String, sessionStartMs: Double, weightLbs: Double) throws -> String? in
      guard #available(iOS 16.1, *) else { return nil }
      let sessionStartDate = Date(timeIntervalSince1970: sessionStartMs / 1000.0)
      let attrs = SudsSessionAttributes(
        sessionTitle: sessionTitle,
        sessionStartDate: sessionStartDate,
        weightLbs: weightLbs
      )
      let state = SudsSessionAttributes.ContentState(
        drinkCount: drinkCount,
        groupDrinkCount: groupDrinkCount,
        lastDrinkName: "",
        lastDrinkQuantity: 1,
        memberCount: memberCount,
        memberNames: memberNames,
        bac: nil // the app sends the drink timeline in its first updateActivity right after this
      )
      let activity = try Activity<SudsSessionAttributes>.request(
        attributes: attrs,
        contentState: state,
        pushType: nil
      )
      return activity.id
    }

    // Awaited directly so the JS promise resolves only after ActivityKit commits the update.
    // Reads intentIsLogging from shared UserDefaults rather than hardcoding false — while the
    // widget intent is in flight it sets intentIsLogging = true, so every _refresh() call from
    // the main app (triggered by realtime, Darwin, or the 60s timer) preserves the spinner
    // instead of killing it.
    //
    // bacJson: the user's drinks and body constants as JSON (BACState), so the widget can
    // estimate BAC exactly like the app. Empty string = keep the activity's current value.
    AsyncFunction("updateActivity") { (activityId: String, drinkCount: Double, groupDrinkCount: Double,
                                        lastDrinkName: String, lastDrinkQuantity: Double, memberCount: Int,
                                        memberNames: String, bacJson: String) async in
      guard #available(iOS 16.1, *) else { return }
      let d = UserDefaults(suiteName: "group.com.sudssocial.app")
      let flag = d?.bool(forKey: "intentIsLogging") ?? false
      let setAt = d?.double(forKey: "intentIsLoggingAt") ?? 0
      // A jetsam-killed intent can never clear its own flag, so treat anything older
      // than 30s as stale — otherwise the spinner would be preserved forever.
      let isLogging = flag && (Date().timeIntervalSince1970 - setAt) < 30
      let newBAC: BACState? = bacJson.isEmpty
        ? nil
        : try? JSONDecoder().decode(BACState.self, from: Data(bacJson.utf8))
      for activity in Activity<SudsSessionAttributes>.activities where activity.id == activityId {
        let state = SudsSessionAttributes.ContentState(
          drinkCount: drinkCount,
          groupDrinkCount: groupDrinkCount,
          lastDrinkName: lastDrinkName,
          lastDrinkQuantity: lastDrinkQuantity > 0 ? lastDrinkQuantity : 1,
          memberCount: memberCount,
          memberNames: memberNames,
          isLogging: isLogging,
          bac: newBAC ?? activity.contentState.bac
        )
        await activity.update(using: state)
        break
      }
    }

    AsyncFunction("endActivity") { (activityId: String) async in
      guard #available(iOS 16.1, *) else { return }
      for activity in Activity<SudsSessionAttributes>.activities where activity.id == activityId {
        await activity.end(using: nil, dismissalPolicy: .immediate)
        break
      }
    }

    AsyncFunction("endAllActivities") { () async in
      guard #available(iOS 16.1, *) else { return }
      for activity in Activity<SudsSessionAttributes>.activities {
        await activity.end(using: nil, dismissalPolicy: .immediate)
      }
    }

    Function("writeSharedSession") { (sessionId: String, userId: String, refreshToken: String,
                                       weightLbs: Double, supabaseUrl: String, anonKey: String,
                                       sessionStartMs: Double, lastDrinkType: String, lastDrinkName: String) in
      guard let d = UserDefaults(suiteName: "group.com.sudssocial.app") else { return }
      d.set(sessionId, forKey: "sessionId")
      d.set(userId, forKey: "userId")
      d.set(refreshToken, forKey: "refreshToken")
      d.set(weightLbs, forKey: "weightLbs")
      d.set(supabaseUrl, forKey: "supabaseUrl")
      d.set(anonKey, forKey: "anonKey")
      d.set(sessionStartMs / 1000.0, forKey: "sessionStart") // JS ms → Swift seconds
      d.set(lastDrinkType, forKey: "lastDrinkType")
      d.set(lastDrinkName, forKey: "lastDrinkName")
      d.removeObject(forKey: "lastDrinkQuantity") // the +1 falls back to 1 until a drink is logged
      // Clear any stale flag left by a jetsam-killed intent process — a new session
      // means no intent is in flight, so isLogging should never start as true.
      d.set(false, forKey: "intentIsLogging")
    }

    Function("updateSharedLastDrink") { (drinkType: String, drinkName: String, quantity: Double) in
      guard let d = UserDefaults(suiteName: "group.com.sudssocial.app") else { return }
      d.set(drinkType, forKey: "lastDrinkType")
      d.set(drinkName, forKey: "lastDrinkName")
      d.set(quantity > 0 ? quantity : 1, forKey: "lastDrinkQuantity")
    }

    // Called by the main app whenever its own Supabase client refreshes the session, so the
    // widget extension (a separate process) picks up the rotated refresh token instead of
    // retrying one that's already been consumed. Supabase refresh tokens are single-use.
    Function("updateSharedAuthTokens") { (accessToken: String, refreshToken: String, accessTokenExpiresAt: Double) in
      guard let d = UserDefaults(suiteName: "group.com.sudssocial.app") else { return }
      d.set(accessToken, forKey: "accessToken")
      d.set(refreshToken, forKey: "refreshToken")
      d.set(accessTokenExpiresAt, forKey: "accessTokenExpiresAt")
    }

    // Called by the main app on foreground to detect and adopt a refresh token that the
    // widget rotated independently while the app was backgrounded.
    Function("readSharedAuthTokens") { () -> [String: Any]? in
      guard let d = UserDefaults(suiteName: "group.com.sudssocial.app"),
            let accessToken = d.string(forKey: "accessToken"),
            let refreshToken = d.string(forKey: "refreshToken")
      else { return nil }
      return [
        "accessToken": accessToken,
        "refreshToken": refreshToken,
        "accessTokenExpiresAt": d.double(forKey: "accessTokenExpiresAt"),
      ]
    }

    Function("clearSharedSession") { () in
      guard let d = UserDefaults(suiteName: "group.com.sudssocial.app") else { return }
      ["sessionId", "userId", "refreshToken", "weightLbs", "supabaseUrl", "anonKey", "sessionStart",
       "lastDrinkType", "lastDrinkName", "lastDrinkQuantity", "accessToken", "accessTokenExpiresAt",
       "lastQuickLogTapAt", "intentIsLogging", "intentIsLoggingAt"]
        .forEach { d.removeObject(forKey: $0) }
    }
  }
}
