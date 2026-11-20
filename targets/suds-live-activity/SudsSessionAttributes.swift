import ActivityKit
import Foundation

struct SudsSessionAttributes: ActivityAttributes {
    let sessionTitle: String
    let sessionStartDate: Date
    let weightLbs: Double

    struct ContentState: Codable, Hashable {
        var drinkCount: Double    // the user's OWN drinks (fractional quantities allowed) — pace and fallback BAC
        var groupDrinkCount: Double // all drinks in the session across members
        var lastDrinkName: String
        var memberCount: Int
        var memberNames: String
        var isLogging: Bool
        var bac: BACState?        // the user's drinks with times, for an accurate BAC; nil from older app builds

        // `bac` has no default on purpose: every update must carry it forward, or the
        // widget would fall back to the rough count-based estimate.
        init(drinkCount: Double, groupDrinkCount: Double, lastDrinkName: String, memberCount: Int, memberNames: String, isLogging: Bool = false, bac: BACState?) {
            self.drinkCount = drinkCount
            self.groupDrinkCount = groupDrinkCount
            self.lastDrinkName = lastDrinkName
            self.memberCount = memberCount
            self.memberNames = memberNames
            self.isLogging = isLogging
            self.bac = bac
        }

        // Custom decoder: isLogging and groupDrinkCount were added in later builds.
        // Activities started before these fields existed will decode without them; we
        // default so Activity<SudsSessionAttributes>.activities is never empty due to
        // a missing key.
        init(from decoder: Decoder) throws {
            let c = try decoder.container(keyedBy: CodingKeys.self)
            drinkCount = try c.decode(Double.self, forKey: .drinkCount) // older builds sent Int; decodes as Double
            lastDrinkName = try c.decode(String.self, forKey: .lastDrinkName)
            memberCount = try c.decode(Int.self, forKey: .memberCount)
            memberNames = try c.decode(String.self, forKey: .memberNames)
            isLogging = (try? c.decodeIfPresent(Bool.self, forKey: .isLogging)) ?? false
            groupDrinkCount = (try? c.decodeIfPresent(Double.self, forKey: .groupDrinkCount)) ?? drinkCount
            bac = try? c.decodeIfPresent(BACState.self, forKey: .bac)
        }
    }
}

/// One of the user's own alcoholic drinks, for the widget's BAC estimate.
struct BACDrink: Codable, Hashable {
    var start: Double   // unix seconds
    var end: Double?    // unix seconds; when set, the drink is absorbed evenly from start to end
    var grams: Double   // grams of alcohol
}

/// Everything the widget needs to estimate BAC the same way the app does
/// (src/utils/bacHelpers.ts): the user's own drinks with their times, plus
/// body constants the app works out from weight and sex.
struct BACState: Codable, Hashable {
    var drinks: [BACDrink]
    var bacPerGram: Double              // BAC % points per gram of alcohol in the body
    var eliminationGramsPerHour: Double // grams of alcohol metabolised per hour
    var gramsPerDrink: Double           // one standard drink, for the +1 button

    /// A copy with `count` standard drinks added at `time` (the +1 button).
    func adding(drinks count: Double, at time: Date) -> BACState {
        guard count > 0 else { return self }
        var copy = self
        copy.drinks.append(BACDrink(start: time.timeIntervalSince1970, end: nil, grams: count * gramsPerDrink))
        return copy
    }

    /// A copy without the most recently added drink (undoing a failed +1).
    func removingLatestDrink() -> BACState {
        var copy = self
        if let i = copy.drinks.indices.max(by: { copy.drinks[$0].start < copy.drinks[$1].start }) {
            copy.drinks.remove(at: i)
        }
        return copy
    }

    /// Estimated BAC (% points) at `date`. Mirrors runSimulation in
    /// src/utils/bacHelpers.ts: instant drinks add their grams at once, drinks
    /// with an end time add at a constant rate until it, and the body removes
    /// a fixed number of grams per hour, never going below zero.
    func bac(at date: Date) -> Double {
        let limit = date.timeIntervalSince1970
        var instant: [Double: Double] = [:]
        var rateChange: [Double: Double] = [:]
        for d in drinks where d.grams > 0 {
            if let end = d.end, end > d.start {
                let rate = d.grams / ((end - d.start) / 3600)
                rateChange[d.start, default: 0] += rate
                rateChange[end, default: 0] -= rate
            } else {
                instant[d.start, default: 0] += d.grams
            }
        }
        var times = Set(instant.keys).union(rateChange.keys).filter { $0 <= limit }.sorted()
        guard let last = times.last else { return 0 }
        if limit > last { times.append(limit) }

        var grams = 0.0
        var rate = 0.0
        for i in times.indices {
            let t = times[i]
            grams += instant[t] ?? 0
            rate += rateChange[t] ?? 0
            if abs(rate) < 1e-9 { rate = 0 }
            if i < times.count - 1 {
                let hours = (times[i + 1] - t) / 3600
                grams = max(0, grams + (rate - eliminationGramsPerHour) * hours)
            }
        }
        return max(0, grams * bacPerGram)
    }
}
