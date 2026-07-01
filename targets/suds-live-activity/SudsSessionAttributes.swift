import ActivityKit
import Foundation

struct SudsSessionAttributes: ActivityAttributes {
    let sessionTitle: String
    let sessionStartDate: Date
    let weightLbs: Double

    struct ContentState: Codable, Hashable {
        var drinkCount: Int
        var lastDrinkName: String
        var memberCount: Int
        var memberNames: String
    }
}
