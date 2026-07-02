import ActivityKit
import Foundation

// Mirror of targets/suds-live-activity/SudsSessionAttributes.swift.
// Both copies must stay identical — ActivityKit matches them by JSON shape.
struct SudsSessionAttributes: ActivityAttributes {
    let sessionTitle: String
    let sessionStartDate: Date
    let weightLbs: Double

    struct ContentState: Codable, Hashable {
        var drinkCount: Int
        var lastDrinkName: String
        var memberCount: Int
        var memberNames: String
        var isLogging: Bool = false
    }
}
