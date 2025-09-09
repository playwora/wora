import i18n from "i18next";
import { initReactI18next } from "react-i18next";
import HttpApi from "i18next-http-backend";

export const initializeI18n = (lng: string = "en") => {
  if (!i18n.isInitialized) {
    i18n
      .use(HttpApi)
      .use(initReactI18next)
      .init({
        lng,
        fallbackLng: "en",
        supportedLngs: ["en", "es"],
        ns: ["translation"],
        defaultNS: "translation",
        backend: {
          loadPath: "/locales/{{lng}}/translation.json",
        },
        interpolation: {
          escapeValue: false,
        },
        react: {
          useSuspense: false,
        },
      });
  } else {
    if (i18n.language !== lng) {
      i18n.changeLanguage(lng);
    }
  }
};

export default i18n;
