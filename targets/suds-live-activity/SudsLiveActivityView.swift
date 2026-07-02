import ActivityKit
import AppIntents
import SwiftUI
import WidgetKit

// MARK: - Logo

private var sudsLogo: Image {
    guard let data = Data(base64Encoded: sudsLogoBase64),
          let ui = UIImage(data: data) else {
        return Image(systemName: "drop.fill")
    }
    return Image(uiImage: ui.withRenderingMode(.alwaysOriginal))
}

// MARK: - Widget Bundle

@main
struct SudsLiveActivityBundle: WidgetBundle {
    var body: some Widget {
        SudsLiveActivityWidget()
    }
}

// MARK: - Widget

struct SudsLiveActivityWidget: Widget {
    var body: some WidgetConfiguration {
        ActivityConfiguration(for: SudsSessionAttributes.self) { context in
            LockScreenView(context: context)
        } dynamicIsland: { context in
            DynamicIsland {
                DynamicIslandExpandedRegion(.leading) {
                    Label {
                        Text("\(context.state.drinkCount)")
                            .font(.title2.bold())
                            .foregroundStyle(.orange)
                    } icon: {
                        sudsLogo
                            .resizable()
                            .scaledToFit()
                            .frame(width: 22, height: 22)
                    }
                }
                DynamicIslandExpandedRegion(.trailing) {
                    VStack(alignment: .trailing, spacing: 2) {
                        Label {
                            Text(context.attributes.sessionStartDate, style: .timer)
                                .font(.caption.bold())
                                .monospacedDigit()
                        } icon: {
                            Image(systemName: "clock")
                        }
                        .font(.caption.bold())
                        .foregroundStyle(.secondary)
                        if !context.state.memberNames.isEmpty {
                            Text("w/ \(context.state.memberNames)")
                                .font(.caption2)
                                .foregroundStyle(.secondary)
                                .lineLimit(1)
                        }
                    }
                }
                DynamicIslandExpandedRegion(.center) {
                    Text(context.attributes.sessionTitle)
                        .font(.caption.bold())
                        .lineLimit(1)
                }
                DynamicIslandExpandedRegion(.bottom) {
                    HStack(spacing: 12) {
                        let bac = computeBAC(
                            drinkCount: context.state.drinkCount,
                            sessionStart: context.attributes.sessionStartDate,
                            weightLbs: context.attributes.weightLbs
                        )
                        if let pace = pacePerHour(drinkCount: context.state.drinkCount, sessionStart: context.attributes.sessionStartDate) {
                            Text("\(String(format: "%.1f", pace))/hr")
                                .font(.caption2)
                                .foregroundStyle(.secondary)
                        }
                        if bac > 0 {
                            Text("~\(String(format: "%.3f", bac))%")
                                .font(.caption2.bold())
                                .foregroundStyle(bacColor(bac))
                        }
                        Spacer()
                        PlusOneButton(lastDrinkName: context.state.lastDrinkName, isLogging: context.state.isLogging)
                    }
                }
            } compactLeading: {
                HStack(spacing: 3) {
                    sudsLogo
                        .resizable()
                        .scaledToFit()
                        .frame(width: 14, height: 14)
                    Text("\(context.state.drinkCount)")
                        .font(.caption.bold())
                        .foregroundStyle(.orange)
                }
            } compactTrailing: {
                Text(context.attributes.sessionStartDate, style: .timer)
                    .font(.caption2.bold())
                    .foregroundStyle(.secondary)
                    .monospacedDigit()
            } minimal: {
                sudsLogo
                    .resizable()
                    .scaledToFit()
                    .frame(width: 14, height: 14)
            }
        }
    }
}

// MARK: - Lock Screen View

struct LockScreenView: View {
    let context: ActivityViewContext<SudsSessionAttributes>

    var body: some View {
        let bac = computeBAC(
            drinkCount: context.state.drinkCount,
            sessionStart: context.attributes.sessionStartDate,
            weightLbs: context.attributes.weightLbs
        )
        VStack(alignment: .leading, spacing: 8) {
            // Row 1: logo + session title + +1 button
            HStack(spacing: 8) {
                ZStack {
                    Color.white
                    sudsLogo
                        .resizable()
                        .scaledToFit()
                        .padding(6)
                }
                .frame(width: 44, height: 44)
                .clipShape(RoundedRectangle(cornerRadius: 10))

                VStack(alignment: .leading, spacing: 1) {
                    Text(context.attributes.sessionTitle)
                        .font(.subheadline.bold())
                        .foregroundStyle(.primary)
                        .lineLimit(2)
                    if !context.state.memberNames.isEmpty {
                        Text("with \(context.state.memberNames)")
                            .font(.caption2)
                            .foregroundStyle(.secondary)
                            .lineLimit(1)
                    }
                }

                Spacer()

                PlusOneButton(lastDrinkName: context.state.lastDrinkName, isLogging: context.state.isLogging)
            }

            // Row 2: stats — each cell takes equal width so the timer growth doesn't shift siblings
            HStack(spacing: 0) {
                StatCell(
                    value: "\(context.state.drinkCount)",
                    label: "drinks",
                    color: .orange
                )
                .frame(maxWidth: .infinity)
                // Elapsed time auto-updates every second via SwiftUI timer rendering
                StatCell(label: "elapsed", timerDate: context.attributes.sessionStartDate)
                    .frame(maxWidth: .infinity)
                if let pace = pacePerHour(drinkCount: context.state.drinkCount, sessionStart: context.attributes.sessionStartDate) {
                    StatCell(value: String(format: "%.1f", pace), label: "/hr")
                        .frame(maxWidth: .infinity)
                }
                if bac > 0 {
                    StatCell(
                        value: "~\(String(format: "%.3f", bac))",
                        label: "% bac",
                        color: bacColor(bac)
                    )
                    .frame(maxWidth: .infinity)
                }
            }
        }
        .padding()
    }
}

// MARK: - Stat Cell

struct StatCell: View {
    var value: String = ""
    let label: String
    var color: Color = .primary
    var timerDate: Date? = nil

    var body: some View {
        VStack(alignment: .center, spacing: 0) {
            if let date = timerDate {
                Text(date, style: .timer)
                    .font(.callout.bold())
                    .foregroundStyle(color)
                    .monospacedDigit()
                    .lineLimit(1)
                    .minimumScaleFactor(0.8)
                    .multilineTextAlignment(.center)
                    .frame(maxWidth: .infinity, alignment: .center)
            } else {
                Text(value)
                    .font(.callout.bold())
                    .foregroundStyle(color)
                    .lineLimit(1)
                    .minimumScaleFactor(0.8)
                    .multilineTextAlignment(.center)
                    .frame(maxWidth: .infinity, alignment: .center)
            }
            Text(label)
                .font(.caption)
                .foregroundStyle(.secondary)
                .multilineTextAlignment(.center)
                .frame(maxWidth: .infinity, alignment: .center)
        }
        .frame(maxWidth: .infinity)
    }
}

// MARK: - +1 Button

struct PlusOneButton: View {
    let lastDrinkName: String
    var isLogging: Bool = false

    var body: some View {
        Group {
            if isLogging {
                VStack(spacing: 2) {
                    ProgressView()
                        .progressViewStyle(.circular)
                        .tint(.orange)
                        .frame(width: 22, height: 22)
                    Text("Logging…")
                        .font(.caption2)
                        .foregroundStyle(.secondary)
                }
                .frame(width: 60)
            } else if #available(iOS 17.0, *) {
                Button(intent: QuickLogDrinkIntent()) {
                    VStack(spacing: 2) {
                        Image(systemName: "plus.circle.fill")
                            .font(.title3)
                            .foregroundStyle(.orange)
                        Text(lastDrinkName.isEmpty ? "Drink" : lastDrinkName)
                            .font(.caption2)
                            .foregroundStyle(.secondary)
                            .multilineTextAlignment(.center)
                    }
                    .frame(width: 60)
                }
                .buttonStyle(.plain)
            } else {
                Link(destination: URL(string: "suds://log")!) {
                    Image(systemName: "plus.circle.fill")
                        .font(.title2)
                        .foregroundStyle(.orange)
                }
            }
        }
    }
}

// MARK: - Helpers

private func computeBAC(drinkCount: Int, sessionStart: Date, weightLbs: Double) -> Double {
    guard weightLbs > 0, drinkCount > 0 else { return 0 }
    let elapsedHours = -sessionStart.timeIntervalSinceNow / 3600
    let bac = (Double(drinkCount) * 0.6 * 5.14) / (weightLbs * 0.70) - (0.015 * elapsedHours)
    return max(0, (bac * 1000).rounded() / 1000)
}

private func pacePerHour(drinkCount: Int, sessionStart: Date) -> Double? {
    guard drinkCount > 0 else { return nil }
    let elapsedHours = -sessionStart.timeIntervalSinceNow / 3600
    guard elapsedHours >= 1.0 / 12.0 else { return nil } // suppress for first 5 min
    return Double(drinkCount) / elapsedHours
}

private func bacColor(_ bac: Double) -> Color {
    if bac < 0.05 { return .green }
    if bac < 0.08 { return .yellow }
    return .red
}
