import { useCallback, useEffect } from "react";
import { useLocation, useNavigate, type NavigateOptions } from "react-router-dom";
import { useTranslation } from "react-i18next";

const SUPPORTED_LANGS = ["pt", "es"] as const;
export type SupportedLang = (typeof SUPPORTED_LANGS)[number];

/** O idioma vem do primeiro segmento da URL — e só de lá. Sem localStorage,
 *  sem detecção de navegador, sem seletor. `/es/home` = espanhol, `/home` = português. */
export function getLangFromPath(pathname: string): SupportedLang {
  const first = pathname.split("/")[1];
  return SUPPORTED_LANGS.includes(first as SupportedLang) && first !== "pt"
    ? (first as SupportedLang)
    : "pt";
}

export function useCurrentLang(): SupportedLang {
  const { pathname } = useLocation();
  return getLangFromPath(pathname);
}

/** Adiciona o prefixo de idioma a um path absoluto. pt não recebe prefixo. */
export function localizedPath(path: string, lang: SupportedLang): string {
  if (lang === "pt") return path;
  // Evita duplicar: /es/es/home
  if (path.startsWith(`/${lang}/`) || path === `/${lang}`) return path;
  return `/${lang}${path.startsWith("/") ? "" : "/"}${path}`;
}

/** Remove o prefixo de idioma. Use para comparar rota ativa (nav, tabs). */
export function unlocalizedPath(pathname: string, lang: SupportedLang): string {
  if (lang === "pt") return pathname;
  if (pathname === `/${lang}`) return "/";
  if (pathname.startsWith(`/${lang}/`)) return pathname.slice(lang.length + 1);
  return pathname;
}

/** Wrapper de useNavigate que preserva o prefixo de idioma.
 *  Aceita number (navigate(-1)) e repassa direto, sem prefixar. */
export function useLocalizedNavigate() {
  const navigate = useNavigate();
  const lang = useCurrentLang();

  return useCallback(
    (to: string | number, options?: NavigateOptions) => {
      if (typeof to === "number") {
        navigate(to);
        return;
      }
      navigate(localizedPath(to, lang), options);
    },
    [navigate, lang],
  );
}

/** Componente invisível: sincroniza o i18next com a URL a cada navegação. */
export function LanguageSync() {
  const currentLang = useCurrentLang();
  const { i18n } = useTranslation();

  useEffect(() => {
    if (i18n.language !== currentLang) {
      i18n.changeLanguage(currentLang);
    }
    if (document.documentElement.lang !== currentLang) {
      document.documentElement.lang = currentLang === "es" ? "es" : "pt-BR";
    }
  }, [currentLang, i18n]);

  return null;
}
