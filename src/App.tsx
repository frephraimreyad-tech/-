import React, { useState } from "react";
import { Top10Scoreboard } from "./components/Top10Scoreboard";
import { LoginEntranceScreen } from "./components/LoginEntranceScreen";
import { authStore } from "./utils/authStore";

export default function App() {
  const [currentScreen, setCurrentScreen] = useState<"welcome" | "app">(() => {
    const params = new URLSearchParams(window.location.search);
    const mode = params.get("mode");
    const code = params.get("code");
    const view = params.get("view");
    // If URL contains direct view parameter or auto-login QR code, skip entrance screen
    if (mode || code || view) return "app";
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
