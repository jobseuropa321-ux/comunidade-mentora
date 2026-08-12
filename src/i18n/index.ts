import i18n from "i18next";
import { initReactI18next } from "react-i18next";
import pt from "./locales/pt.json";
import es from "./locales/es.json";
import { getLangFromPath } from "./LanguageProvider";

i18n.use(initReactI18next).init({
  resources: {
    pt: { translation: pt },
    es: { translation: es },
  },
  // Melhoria sobre o app original: inicia já no idioma da URL, em vez de 'pt'
  // fixo. Sem isso, abrir /es/ direto renderiza um frame em português.
  lng: getLangFromPath(window.location.pathname),
  fallbackLng: "pt",
  interpolation: { escapeValue: false },
});

export default i18n;
