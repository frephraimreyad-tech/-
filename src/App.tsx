import React, { useState } from "react";
import { Top10Scoreboard } from "./components/Top10Scoreboard";
import { LoginEntranceScreen } from "./components/LoginEntranceScreen";
import { authStore } from "./utils/authStore";

export default function App() {
  const [currentScreen, setCurrentScreen] = useState<"welcome" | "app">(() => {
    const params = new URLSearchParams(window.location.search);
    const mode = params.get("mode");
    const view = params.get("view");
    // Only bypass welcome screen if explicitly requested as public presentation display mode
    if (mode === "public" || view === "public" || params.get("tv") === "1") {
      return "app";
    }
    // For all other cases, including QR code links (?code=...), always open the login page first
    return "welcome";
  });

  if (currentScreen === "welcome") {
    return (
      <LoginEntranceScreen
        onEnterPublic={() => setCurrentScreen("app")}
        onEnterAdmin={() => setCurrentScreen("app")}
      />
    );
  }

  return (
    <Top10Scoreboard
      onReturnToWelcome={() => {
        authStore.logout();
        setCurrentScreen("welcome");
      }}
    />
  );
}
