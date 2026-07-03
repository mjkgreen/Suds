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
        var isLogging: Bool

        init(drinkCount: Int, lastDrinkName: String, memberCount: Int, memberNames: String, isLogging: Bool = false) {
            self.drinkCount = drinkCount
            self.lastDrinkName = lastDrinkName
            self.memberCount = memberCount
            self.memberNames = memberNames
            self.isLogging = isLogging
        }

        init(from decoder: Decoder) throws {
            let c = try decoder.container(keyedBy: CodingKeys.self)
            drinkCount = try c.decode(Int.self, forKey: .drinkCount)
            lastDrinkName = try c.decode(String.self, forKey: .lastDrinkName)
            memberCount = try c.decode(Int.self, forKey: .memberCount)
            memberNames = try c.decode(String.self, forKey: .memberNames)
            isLogging = (try? c.decodeIfPresent(Bool.self, forKey: .isLogging)) ?? false
        }
    }
}
