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
        var isLogging: Bool

        init(drinkCount: Int, lastDrinkName: String, memberCount: Int, memberNames: String, isLogging: Bool = false) {
            self.drinkCount = drinkCount
            self.lastDrinkName = lastDrinkName
            self.memberCount = memberCount
            self.memberNames = memberNames
            self.isLogging = isLogging
        }

        // Custom decoder: isLogging was added in a later build.  Activities started
        // before this field existed will decode without it; we default to false so
        // Activity<SudsSessionAttributes>.activities is never empty due to a missing key.
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
