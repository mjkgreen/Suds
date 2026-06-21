import ActivityKit
import Foundation

struct SudsSessionAttributes: ActivityAttributes {
    // Static data (doesn't change during the activity)
    let sessionTitle: String

    // Dynamic data (updated as the session progresses)
    struct ContentState: Codable, Hashable {
        var drinkCount: Int
        var elapsedMinutes: Int
    }
}
