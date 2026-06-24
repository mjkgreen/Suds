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
                    VStack(alignment: .leading, spacing: 2) {
                        Label(
                            "\(context.state.drinkCount)",
                            systemImage: "mug.fill"
                        )
                        .font(.title2.bold())
                        .foregroundStyle(.orange)
                        if !context.state.lastDrinkName.isEmpty {
                            Text(context.state.lastDrinkName)
                                .font(.caption2)
                                .foregroundStyle(.secondary)
                                .lineLimit(1)
                        }
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
                        if context.state.memberCount > 1 {
                            Text("\(context.state.memberCount) people")
                                .font(.caption2)
                                .foregroundStyle(.secondary)
                        }
                    }
                }
                DynamicIslandExpandedRegion(.center) {
                    Text(context.attributes.sessionTitle)
                        .font(.caption.bold())
                        .lineLimit(1)
                }
                DynamicIslandExpandedRegion(.bottom) {
                    HStack {
                        if context.state.bacEstimate > 0 {
                            Text("~\(String(format: "%.3f", context.state.bacEstimate))%")
                                .font(.caption2.bold())
                                .foregroundStyle(bacColor(context.state.bacEstimate))
                        }
                        Spacer()
                        PlusOneButton()
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
        HStack(spacing: 12) {
            // Left: session info + metadata
            VStack(alignment: .leading, spacing: 4) {
                Text(context.attributes.sessionTitle)
                    .font(.headline)
                    .lineLimit(1)
                HStack(spacing: 8) {
                    Label(elapsedString(context.state.elapsedMinutes), systemImage: "clock")
                        .font(.caption)
                        .foregroundStyle(.secondary)
                    if context.state.memberCount > 1 {
                        Label("\(context.state.memberCount)", systemImage: "person.2.fill")
                            .font(.caption)
                            .foregroundStyle(.secondary)
                    }
                }
                if let pace = paceString(context.state.drinkCount, context.state.elapsedMinutes) {
                    Text(pace)
                        .font(.caption2)
                        .foregroundStyle(.secondary)
                }
            }

            Spacer()

            // Center: drink count + last drink name + BAC
            VStack(spacing: 2) {
                Text("\(context.state.drinkCount)")
                    .font(.title.bold())
                    .foregroundStyle(.orange)
                Text(context.state.lastDrinkName.isEmpty ? "drinks" : context.state.lastDrinkName)
                    .font(.caption2)
                    .foregroundStyle(.secondary)
                    .lineLimit(1)
                if context.state.bacEstimate > 0 {
                    Text("~\(String(format: "%.3f", context.state.bacEstimate))%")
                        .font(.caption2.bold())
                        .foregroundStyle(bacColor(context.state.bacEstimate))
                }
            }

            // Right: +1 button
            PlusOneButton()
        }
        .padding()
    }
}

// MARK: - +1 Button

struct PlusOneButton: View {
    var body: some View {
        Group {
            if #available(iOS 17.0, *) {
                Button(intent: QuickLogDrinkIntent()) {
                    Image(systemName: "plus.circle.fill")
                        .font(.title2)
                        .foregroundStyle(.orange)
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
