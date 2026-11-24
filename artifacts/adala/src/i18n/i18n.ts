import i18n from "i18next";
import { initReactI18next } from "react-i18next";
import ar from "./ar/common.json";
import en from "./en/common.json";

const STORAGE_KEY = "adala_lang";

const savedLang = (typeof localStorage !== "undefined"
  ? localStorage.getItem(STORAGE_KEY)
  : null) ?? "ar";

i18n.use(initReactI18next).init({
  resources: {
    ar: { translation: ar },
    en: { translation: en },
  },
  lng: savedLang,
  fallbackLng: "ar",
  interpolation: { escapeValue: false },
});

/* Persist language choice and sync document direction */
i18n.on("languageChanged", (lng) => {
  if (typeof localStorage !== "undefined") {
    localStorage.setItem(STORAGE_KEY, lng);
  }
  if (typeof document !== "undefined") {
    document.documentElement.dir  = lng === "ar" ? "rtl" : "ltr";
    document.documentElement.lang = lng;
  }
});

/* Apply on initial load */
if (typeof document !== "undefined") {
  document.documentElement.dir  = savedLang === "ar" ? "rtl" : "ltr";
  document.documentElement.lang = savedLang;
}

export default i18n;
