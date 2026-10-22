import { useState, useEffect } from "react";

export type ThemePreference = "auto" | "dark" | "light";
export type ActiveTheme = "dark" | "light";

const THEME_KEY = "coptic_meeting_theme_preference_v1";

class ThemeStore {
  private preference: ThemePreference = "auto";
  private listeners: Set<() => void> = new Set();
  private timer: any = null;

  constructor() {
    // Load saved preference or default to "auto"
    if (typeof window !== "undefined") {
      const saved = localStorage.getItem(THEME_KEY) as ThemePreference;
      if (saved === "auto" || saved === "dark" || saved === "light") {
        this.preference = saved;
      }
    }
    this.initTimer();
  }

  private initTimer() {
    if (typeof window === "undefined") return;

    // Check time every 60 seconds to auto-switch if mode is "auto"
    this.timer = setInterval(() => {
      if (this.preference === "auto") {
        this.notify();
      }
    }, 60000);

    // Also update on tab visibility change
    document.addEventListener("visibilitychange", () => {
      if (!document.hidden && this.preference === "auto") {
        this.notify();
      }
    });
  }

  /**
   * Determines if local time is Day (6:00 AM - 6:00 PM) or Night (6:00 PM - 6:00 AM)
   */
  public isDaytime(): boolean {
    const hour = new Date().getHours();
    return hour >= 6 && hour < 18; // 06:00 to 17:59 is Day, 18:00 to 05:59 is Night
  }

  /**
   * Get calculated active theme ("dark" or "light")
   */
  public getActiveTheme(): ActiveTheme {
    if (this.preference === "light") return "light";
    if (this.preference === "dark") return "dark";

    // If preference is "auto", use time detection
    return this.isDaytime() ? "light" : "dark";
  }

  /**
   * Get stored preference ("auto", "dark", "light")
   */
  public getPreference(): ThemePreference {
    return this.preference;
  }

  /**
   * Set theme preference and save to localStorage
   */
  public setPreference(pref: ThemePreference) {
    this.preference = pref;
    if (typeof window !== "undefined") {
      localStorage.setItem(THEME_KEY, pref);
    }
    this.applyToDOM();
    this.notify();
  }

  /**
   * Apply 'dark' or 'light' class to document element for Tailwind & CSS rules
   */
  public applyToDOM() {
    if (typeof document === "undefined") return;
    const active = this.getActiveTheme();
    if (active === "light") {
      document.documentElement.classList.add("light");
      document.documentElement.classList.remove("dark");
    } else {
      document.documentElement.classList.add("dark");
      document.documentElement.classList.remove("light");
    }
  }

  public subscribe(listener: () => void): () => void {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }

  private notify() {
    this.applyToDOM();
    this.listeners.forEach((listener) => listener());
  }
}

export const themeStore = new ThemeStore();

/**
   * React hook to use themeStore in components
   */
export function useTheme() {
  const [preference, setPreferenceState] = useState<ThemePreference>(themeStore.getPreference());
  const [activeTheme, setActiveThemeState] = useState<ActiveTheme>(themeStore.getActiveTheme());
  const [isDaytime, setIsDaytimeState] = useState<boolean>(themeStore.isDaytime());

  useEffect(() => {
    themeStore.applyToDOM();

    const unsub = themeStore.subscribe(() => {
      setPreferenceState(themeStore.getPreference());
      setActiveThemeState(themeStore.getActiveTheme());
      setIsDaytimeState(themeStore.isDaytime());
    });

    return unsub;
  }, []);

  const setPreference = (pref: ThemePreference) => {
    themeStore.setPreference(pref);
  };

  return {
    preference,
    activeTheme,
    isDaytime,
    isAuto: preference === "auto",
    isDark: activeTheme === "dark",
    isLight: activeTheme === "light",
    setPreference,
  };
}
