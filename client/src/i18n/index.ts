import i18n from "i18next";
import { initReactI18next } from "react-i18next";
import { APP_LOCALES, isAppLocale, isRtlLocale, type AppLocale } from "@shared/locales";
import en from "./locales/en.json";
import fr from "./locales/fr.json";
import de from "./locales/de.json";
import it from "./locales/it.json";
import ar from "./locales/ar.json";

const saved =
  typeof window !== "undefined" ? localStorage.getItem("lexflow_locale") : null;
const initialLng = isAppLocale(saved) ? saved : "en";

void i18n.use(initReactI18next).init({
  resources: {
    en: { translation: en },
    fr: { translation: fr },
    de: { translation: de },
    it: { translation: it },
    ar: { translation: ar },
  },
  lng: initialLng,
  fallbackLng: "en",
  supportedLngs: [...APP_LOCALES],
  interpolation: { escapeValue: false },
});

function applyDocumentLocale(locale: AppLocale) {
  if (typeof document === "undefined") return;
  document.documentElement.lang = locale;
  document.documentElement.dir = isRtlLocale(locale) ? "rtl" : "ltr";
}

applyDocumentLocale(initialLng);

export default i18n;

export function setAppLocale(locale: AppLocale) {
  localStorage.setItem("lexflow_locale", locale);
  applyDocumentLocale(locale);
  void i18n.changeLanguage(locale);
}

export type { AppLocale };
