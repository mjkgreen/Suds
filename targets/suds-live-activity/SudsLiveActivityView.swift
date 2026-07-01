import ActivityKit
import AppIntents
import SwiftUI
import WidgetKit

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
                    HStack(spacing: 6) {
                        Image("SudsLogo")
                            .resizable().scaledToFit()
                            .frame(width: 22, height: 22)
                            .clipShape(RoundedRectangle(cornerRadius: 5))
                        Label(
                            "\(context.state.drinkCount)",
                            systemImage: "mug.fill"
                        )
                        .font(.title2.bold())
                        .foregroundStyle(.orange)
                    }
                }
                DynamicIslandExpandedRegion(.trailing) {
                    VStack(alignment: .trailing, spacing: 2) {
                        Label(
                            elapsedString(context.state.elapsedMinutes),
                            systemImage: "clock"
                        )
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
                        if let pace = paceString(context.state.drinkCount, context.state.elapsedMinutes) {
                            Text(pace)
                                .font(.caption2)
                                .foregroundStyle(.secondary)
                        }
                        if context.state.bacEstimate > 0 {
                            Text("~\(String(format: "%.3f", context.state.bacEstimate))%")
                                .font(.caption2.bold())
                                .foregroundStyle(bacColor(context.state.bacEstimate))
                        }
                        Spacer()
                        PlusOneButton(lastDrinkName: context.state.lastDrinkName)
                    }
                }
            } compactLeading: {
                Label("\(context.state.drinkCount)", systemImage: "mug.fill")
                    .font(.caption.bold())
                    .foregroundStyle(.orange)
            } compactTrailing: {
                Text(elapsedString(context.state.elapsedMinutes))
                    .font(.caption2.bold())
                    .foregroundStyle(.secondary)
            } minimal: {
                Image(systemName: "mug.fill")
                    .foregroundStyle(.orange)
            }
        }
    }
}

// MARK: - Lock Screen View

struct LockScreenView: View {
    let context: ActivityViewContext<SudsSessionAttributes>

    var body: some View {
        HStack(spacing: 10) {
            Image("SudsLogo")
                .resizable().scaledToFit()
                .frame(width: 28, height: 28)
                .clipShape(RoundedRectangle(cornerRadius: 6))

            VStack(alignment: .leading, spacing: 4) {
                Text(context.attributes.sessionTitle)
                    .font(.headline)
                    .lineLimit(1)
                if !context.state.memberNames.isEmpty {
                    Text("with \(context.state.memberNames)")
                        .font(.caption2)
                        .foregroundStyle(.secondary)
                        .lineLimit(1)
                }
                HStack(spacing: 12) {
                    StatCell(
                        value: "\(context.state.drinkCount)",
                        label: "drinks",
                        color: .orange
                    )
                    StatCell(
                        value: elapsedString(context.state.elapsedMinutes),
                        label: "elapsed"
                    )
                    if let pace = paceString(context.state.drinkCount, context.state.elapsedMinutes) {
                        StatCell(value: pace, label: "/hr")
                    }
                    if context.state.bacEstimate > 0 {
                        StatCell(
                            value: "~\(String(format: "%.3f", context.state.bacEstimate))%",
                            label: "bac",
                            color: bacColor(context.state.bacEstimate)
                        )
                    }
                }
            }

            Spacer()

            PlusOneButton(lastDrinkName: context.state.lastDrinkName)
        }
        .padding()
    }
}

// MARK: - Stat Cell

struct StatCell: View {
    let value: String
    let label: String
    var color: Color = .primary

    var body: some View {
        VStack(spacing: 0) {
            Text(value)
                .font(.title3.bold())
                .foregroundStyle(color)
            Text(label)
                .font(.caption2)
                .foregroundStyle(.secondary)
        }
    }
}

// MARK: - +1 Button

struct PlusOneButton: View {
    let lastDrinkName: String

    var body: some View {
        Group {
            if #available(iOS 17.0, *) {
                Button(intent: QuickLogDrinkIntent()) {
                    VStack(spacing: 2) {
                        Image(systemName: "plus.circle.fill")
                            .font(.title3)
                            .foregroundStyle(.orange)
                        Text(lastDrinkName.isEmpty ? "Drink" : lastDrinkName)
                            .font(.caption2)
                            .foregroundStyle(.secondary)
                            .lineLimit(1)
                    }
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

private func elapsedString(_ minutes: Int) -> String {
    let h = minutes / 60
    let m = minutes % 60
    return h > 0 ? "\(h)h \(m)m" : "\(m)m"
}

private func paceString(_ drinkCount: Int, _ elapsedMinutes: Int) -> String? {
    guard drinkCount > 0, elapsedMinutes > 0 else { return nil }
    let pace = Double(drinkCount) / (Double(elapsedMinutes) / 60.0)
    return String(format: "%.1f/hr", pace)
}

private func bacColor(_ bac: Double) -> Color {
    if bac < 0.05 { return .green }
    if bac < 0.08 { return .yellow }
    return .red
}
