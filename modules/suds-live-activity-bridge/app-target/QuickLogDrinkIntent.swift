import AppIntents
// `internal` must match the generated ExpoModulesProvider.swift (also in the app
// target), which imports every Expo module as `internal import` since SDK 58.
// Mixing a plain `import` with it fails the build as an ambiguous access level.
internal import SudsLiveActivityBridge

// Compiled into the MAIN APP target (injected by plugins/withLiveActivityBridge.js —
// it is NOT part of the SudsLiveActivityBridge pod; the pod's podspec only builds ios/**).
//
// LiveActivityIntent is what makes the +1 button actually work: the system executes a
// LiveActivityIntent in the app's process instead of the widget extension's process.
// Only the app's process can see Activity<SudsSessionAttributes>.activities (the widget
// extension always sees an empty list), so this is the only place the optimistic count
// bump and the isLogging spinner can be pushed from.
//
// The widget extension declares an identically-named intent so Button(intent:) compiles
// there; at runtime the system routes the invocation to this app-target copy.
@available(iOS 17.0, *)
struct QuickLogDrinkIntent: LiveActivityIntent {
  static let title: LocalizedStringResource = "Log a drink"
  static let isDiscoverable = false
  static let openAppWhenRun = false

  func perform() async throws -> some IntentResult {
    await SudsQuickLogRunner.run()
    return .result()
  }
}
