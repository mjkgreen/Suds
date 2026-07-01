import ExpoModulesCore
import ActivityKit

// TODO(security): refreshToken is written to App Group UserDefaults (plaintext plist on disk).
// For production hardening, migrate to shared Keychain using kSecAttrAccessGroup with the
// keychain-access-groups entitlement in both targets. Current threat model: single developer,
// single controlled extension — acceptable risk for v1.
public class SudsLiveActivityBridgeModule: Module {
  public func definition() -> ModuleDefinition {
    Name("SudsLiveActivityBridge")

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
        memberNames: memberNames
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
    }

    Function("updateSharedLastDrink") { (drinkType: String, drinkName: String) in
      guard let d = UserDefaults(suiteName: "group.com.sudssocial.app") else { return }
      d.set(drinkType, forKey: "lastDrinkType")
      d.set(drinkName, forKey: "lastDrinkName")
    }

    Function("clearSharedSession") { () in
      guard let d = UserDefaults(suiteName: "group.com.sudssocial.app") else { return }
      ["sessionId", "userId", "refreshToken", "weightLbs", "supabaseUrl", "anonKey", "sessionStart",
       "lastDrinkType", "lastDrinkName"]
        .forEach { d.removeObject(forKey: $0) }
    }
  }
}
