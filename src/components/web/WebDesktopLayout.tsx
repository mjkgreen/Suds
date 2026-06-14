import React from "react";
import { View, useWindowDimensions } from "react-native";
import { usePathname } from "expo-router";
import { WebLeftPanel } from "./WebLeftPanel";
import { WebRightPanel } from "./WebRightPanel";

const DESKTOP_BREAKPOINT = 1024;
const FULL_THREE_COL_BREAKPOINT = 1280;
const PANEL_WIDTH = 300;
const CONTENT_MAX_WIDTH = 680;

interface WebDesktopLayoutProps {
  children: React.ReactNode;
}

export function WebDesktopLayout({ children }: WebDesktopLayoutProps) {
  const { width } = useWindowDimensions();
  const pathname = usePathname();
  const isDesktop = width >= DESKTOP_BREAKPOINT;
  const showRightPanel = width >= FULL_THREE_COL_BREAKPOINT;

  // Profile page handles its own 2-column layout — panels would duplicate content
  const isProfilePage = pathname.includes("/profile");

  if (!isDesktop) {
    return (
      <View style={{ flex: 1, maxWidth: 860, width: "100%", alignSelf: "center" }}>
        {children}
      </View>
    );
  }

  if (isProfilePage) {
    return <View style={{ flex: 1 }}>{children}</View>;
  }

  return (
    <View style={{ flex: 1, flexDirection: "row" }}>
      <View style={{ width: PANEL_WIDTH }}>
        <WebLeftPanel />
      </View>

      <View style={{ flex: 1, alignItems: "center", overflow: "hidden" }}>
        <View style={{ width: "100%", maxWidth: CONTENT_MAX_WIDTH, flex: 1 }}>
          {children}
        </View>
      </View>

      {showRightPanel && (
        <View style={{ width: PANEL_WIDTH }}>
          <WebRightPanel />
        </View>
      )}
    </View>
  );
}
