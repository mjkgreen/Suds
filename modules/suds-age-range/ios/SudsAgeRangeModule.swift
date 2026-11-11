import ExpoModulesCore
#if canImport(DeclaredAgeRange)
import DeclaredAgeRange
#endif

/// Bridges Apple's Declared Age Range API (iOS 26+) and the device region to
/// JavaScript. Every path resolves (never rejects): anything that isn't a
/// shared age range comes back as "declined" or "unavailable", and the app
/// falls back to the birthdate the person entered.
public class SudsAgeRangeModule: Module {
  public func definition() -> ModuleDefinition {
    Name("SudsAgeRange")

    /// ISO 3166 region from the device's settings, e.g. "US" or "CA".
    Function("getDeviceRegion") { () -> String? in
      if #available(iOS 16, *) {
        return Locale.current.region?.identifier
      }
      return Locale.current.regionCode
    }

    /// Asks the system for the person's age range around one age gate (the
    /// legal drinking age where they are). Shows Apple's sharing sheet the
    /// first time; the system remembers the answer after that.
    AsyncFunction("requestAgeRange") { (ageGate: Int) async -> [String: Any] in
      #if canImport(DeclaredAgeRange)
      if #available(iOS 26.0, *) {
        return await Self.request(ageGate: ageGate, appContext: self.appContext)
      }
      #endif
      return ["status": "unavailable", "reason": "unsupported_os"]
    }
  }

  #if canImport(DeclaredAgeRange)
  @available(iOS 26.0, *)
  @MainActor
  private static func request(ageGate: Int, appContext: AppContext?) async -> [String: Any] {
    guard let viewController = appContext?.utilities?.currentViewController() else {
      return ["status": "unavailable", "reason": "no_view_controller"]
    }
    do {
      let response = try await AgeRangeService.shared.requestAgeRange(ageGates: ageGate, in: viewController)
      switch response {
      case let .sharing(range):
        var result: [String: Any] = [
          "status": "sharing",
          // How the age was set (self-declared, guardian-declared, confirmed). Informational only.
          "declaration": String(describing: range.ageRangeDeclaration),
        ]
        if let lower = range.lowerBound { result["lowerBound"] = lower }
        if let upper = range.upperBound { result["upperBound"] = upper }
        return result
      case .declinedSharing:
        return ["status": "declined"]
      @unknown default:
        return ["status": "unavailable", "reason": "unknown_response"]
      }
    } catch {
      return ["status": "unavailable", "reason": String(describing: error)]
    }
  }
  #endif
}
