import i18n from "i18next";
import { initReactI18next } from "react-i18next";
import en from "./locales/en.json";
import fr from "./locales/fr.json";
import de from "./locales/de.json";

const saved =
  typeof window !== "undefined" ? localStorage.getItem("lexflow_locale") : null;

void i18n.use(initReactI18next).init({
  resources: {
    en: { translation: en },
    fr: { translation: fr },
    de: { translation: de },
  },
  lng: saved || "en",
  fallbackLng: "en",
  interpolation: { escapeValue: false },
});

export default i18n;

export function setAppLocale(locale: "en" | "fr" | "de") {
  localStorage.setItem("lexflow_locale", locale);
  void i18n.changeLanguage(locale);
}
