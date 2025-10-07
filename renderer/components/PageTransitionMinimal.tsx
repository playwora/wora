import { ReactNode } from 'react';

interface PageTransitionProps {
  children: ReactNode;
}

// Minimal approach: No transition, just instant page swap
// This is actually what many modern apps do (Spotify, Apple Music)
// The smooth scroll restoration gives enough visual continuity
export default function PageTransitionMinimal({ children }: PageTransitionProps) {
  return <>{children}</>;
}