import ActivityKit
import Foundation

struct SudsSessionAttributes: ActivityAttributes {
    let sessionTitle: String

    struct ContentState: Codable, Hashable {
        var drinkCount: Int
        var elapsedMinutes: Int
        var lastDrinkName: String
        var memberCount: Int
        var bacEstimate: Double
        var memberNames: String
    }
}
