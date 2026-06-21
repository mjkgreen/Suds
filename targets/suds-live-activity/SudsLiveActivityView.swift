import ActivityKit
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
            // Lock Screen / Banner view
            LockScreenView(context: context)
        } dynamicIsland: { context in
            DynamicIsland {
                // Expanded regions
                DynamicIslandExpandedRegion(.leading) {
                    Label(
                        "\(context.state.drinkCount)",
                        systemImage: "mug.fill"
                    )
                    .font(.title2.bold())
                    .foregroundStyle(.orange)
                }
                DynamicIslandExpandedRegion(.trailing) {
                    Label(
                        elapsedString(context.state.elapsedMinutes),
                        systemImage: "clock"
                    )
                    .font(.caption.bold())
                    .foregroundStyle(.secondary)
                }
                DynamicIslandExpandedRegion(.center) {
                    Text(context.attributes.sessionTitle)
                        .font(.caption.bold())
                        .lineLimit(1)
                }
                DynamicIslandExpandedRegion(.bottom) {
                    Link(destination: URL(string: "suds://log")!) {
                        Label("Add Drink", systemImage: "plus.circle.fill")
                            .font(.caption.bold())
                            .foregroundStyle(.orange)
                    }
                }
            } compactLeading: {
                // Beer icon + count
                Label("\(context.state.drinkCount)", systemImage: "mug.fill")
                    .font(.caption.bold())
                    .foregroundStyle(.orange)
            } compactTrailing: {
                // Elapsed time
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
        HStack(spacing: 16) {
            // Left: session info
            VStack(alignment: .leading, spacing: 4) {
                Text(context.attributes.sessionTitle)
                    .font(.headline)
                    .lineLimit(1)
                HStack(spacing: 4) {
                    Image(systemName: "clock")
                        .font(.caption2)
                        .foregroundStyle(.secondary)
                    Text(elapsedString(context.state.elapsedMinutes))
                        .font(.caption)
                        .foregroundStyle(.secondary)
                }
            }

            Spacer()

            // Center: drink count
            VStack(spacing: 2) {
                Text("\(context.state.drinkCount)")
                    .font(.title.bold())
                    .foregroundStyle(.orange)
                Text("drinks")
                    .font(.caption2)
                    .foregroundStyle(.secondary)
            }

            // Right: quick-log link
            Link(destination: URL(string: "suds://log")!) {
                Image(systemName: "plus.circle.fill")
                    .font(.title2)
                    .foregroundStyle(.orange)
            }
        }
        .padding()
    }
}

// MARK: - Helpers

private func elapsedString(_ minutes: Int) -> String {
    let h = minutes / 60
    let m = minutes % 60
    if h > 0 {
        return "\(h)h \(m)m"
    }
    return "\(m)m"
}
