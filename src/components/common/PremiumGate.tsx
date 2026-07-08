import React from "react";

interface PremiumGateProps {
  children: React.ReactNode;
  /** Kept for call-site compatibility; previews are unused while all features are free */
  preview?: React.ReactNode;
  featureName: string;
}

/**
 * Historical wrapper for premium-only content. All features are currently
 * free for everyone, so this simply renders its children.
 */
export function PremiumGate({ children }: PremiumGateProps) {
  return <>{children}</>;
}
