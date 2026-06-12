import { useTranslation } from "react-i18next";

export function useLang() {
  const { i18n } = useTranslation();
  const isAr = i18n.language !== "en";

  function tx(ar: string, en: string): string {
    return isAr ? ar : en;
  }

  const dateLocale = isAr ? "ar-SA" : "en-US";
  const dir = (isAr ? "rtl" : "ltr") as "rtl" | "ltr";

  return { tx, isAr, isEn: !isAr, dir, dateLocale, lang: i18n.language };
}
