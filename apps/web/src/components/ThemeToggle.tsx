import React from "react";
import { IonButton, IonIcon } from "@ionic/react";
import { moon, sunny } from "ionicons/icons";
import { useTheme } from "../hooks/useTheme";
const ThemeToggle: React.FC = () => {
  const { theme, toggleTheme } = useTheme();
  const isDark =
    theme === "system"
      ? window.matchMedia("(prefers-color-scheme: dark)").matches
      : theme === "dark";

  return (
    <IonButton onClick={toggleTheme} fill="clear" color="dark">
      <IonIcon slot="icon-only" icon={isDark ? sunny : moon} />
    </IonButton>
  );
};

export default ThemeToggle;
