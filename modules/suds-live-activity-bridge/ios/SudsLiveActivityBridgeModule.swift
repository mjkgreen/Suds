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

  public func definition() -> ModuleDefinition {
    Name("SudsLiveActivityBridge")

    Events("onQuickLog")

    OnCreate {
        CFNotificationCenterAddObserver(
            CFNotificationCenterGetDarwinNotifyCenter(), nil, sudsQuickLogCallback,
            "com.sudssocial.app.quicklog" as CFString, nil, .deliverImmediately
        )
        self.quickLogObserver = NotificationCenter.default.addObserver(
            forName: .sudsQuickLogInternal, object: nil, queue: .main
        ) { [weak self] _ in
            self?.sendEvent("onQuickLog", [:])
        }
    }

    OnDestroy {
        CFNotificationCenterRemoveObserver(
            CFNotificationCenterGetDarwinNotifyCenter(), nil,
            CFNotificationName("com.sudssocial.app.quicklog" as CFString), nil
        )
        if let obs = self.quickLogObserver { NotificationCenter.default.removeObserver(obs) }
    }

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
          "elapsedMinutes": elapsedMinutes,
          "lastDrinkName": activity.contentState.lastDrinkName,
          "memberCount": activity.contentState.memberCount,
          "memberNames": activity.contentState.memberNames,
        ]
      }
    }

    AsyncFunction("startActivity") { (sessionTitle: String, drinkCount: Int, memberCount: Int, memberNames: String, sessionStartMs: Double, weightLbs: Double) throws -> String? in
      guard #available(iOS 16.1, *) else { return nil }
      let sessionStartDate = Date(timeIntervalSince1970: sessionStartMs / 1000.0)
      let attrs = SudsSessionAttributes(
        sessionTitle: sessionTitle,
        sessionStartDate: sessionStartDate,
        weightLbs: weightLbs
      )
      let state = SudsSessionAttributes.ContentState(
        drinkCount: drinkCount,
        lastDrinkName: "",
        memberCount: memberCount,
        memberNames: memberNames
      )
      let activity = try Activity<SudsSessionAttributes>.request(
        attributes: attrs,
        contentState: state,
        pushType: nil
      )
      return activity.id
    }

    // Awaited directly so the JS promise resolves only after ActivityKit commits the update.
    AsyncFunction("updateActivity") { (activityId: String, drinkCount: Int,
                                        lastDrinkName: String, memberCount: Int,
                                        memberNames: String) async in
      guard #available(iOS 16.1, *) else { return }
      let state = SudsSessionAttributes.ContentState(
        drinkCount: drinkCount,
        lastDrinkName: lastDrinkName,
        memberCount: memberCount,
        memberNames: memberNames,
        isLogging: false
      )
      for activity in Activity<SudsSessionAttributes>.activities where activity.id == activityId {
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
                                       sessionStartMs: Double, lastDrinkType: String, lastDrinkName: String,
                                       accessToken: String, accessTokenExpiresAt: Double) in
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
      d.set(accessToken, forKey: "accessToken")
      d.set(accessTokenExpiresAt, forKey: "accessTokenExpiresAt") // Unix seconds
    }

    Function("updateSharedLastDrink") { (drinkType: String, drinkName: String) in
      guard let d = UserDefaults(suiteName: "group.com.sudssocial.app") else { return }
      d.set(drinkType, forKey: "lastDrinkType")
      d.set(drinkName, forKey: "lastDrinkName")
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
       "lastDrinkType", "lastDrinkName", "accessToken", "accessTokenExpiresAt"]
        .forEach { d.removeObject(forKey: $0) }
    }
  }
}
