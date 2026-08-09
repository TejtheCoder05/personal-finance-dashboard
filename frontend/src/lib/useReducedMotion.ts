"use client";

import { useSyncExternalStore } from "react";

/*
  Recharts animates SVG attributes from JS, so the prefers-reduced-motion rule
  in globals.css cannot reach it. Charts read this hook to switch
  `isAnimationActive` off instead.
*/
const QUERY = "(prefers-reduced-motion: reduce)";

function subscribe(onStoreChange: () => void) {
  const query = window.matchMedia(QUERY);
  query.addEventListener("change", onStoreChange);
  return () => query.removeEventListener("change", onStoreChange);
}

function getSnapshot() {
  return window.matchMedia(QUERY).matches;
}

function getServerSnapshot() {
  return false;
}

export function useReducedMotion(): boolean {
  return useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
}
