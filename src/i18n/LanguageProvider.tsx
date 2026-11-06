import { useCallback, useEffect } from "react";
import { useLocation, useNavigate, type NavigateOptions } from "react-router-dom";
import { useTranslation } from "react-i18next";

/* ══════════════════════════════════════════════════════════════
   VARIANTE x IDIOMA

   O primeiro segmento da URL decide a VARIANTE do app:
     /home        → 'pt'     (português, base)
     /es/home     → 'es'     (espanhol)
     /amanda/home → 'amanda' (português, catálogo próprio de módulos/aulas)

   Idioma (SupportedLang) é só pt|es e continua sendo o que vai pro i18n,
   pro banco (locale dos posts, lang das lives, push) e pra IA. A Amanda é
   uma variante em PORTUGUÊS: muda o que aparece (módulos/aulas), não a
   língua nem a marca. Por isso quem monta caminho usa a variante
   (localizedPath/useLocalizedNavigate) e quem manda dado pra fora usa o
   idioma (useCurrentLang).
   ══════════════════════════════════════════════════════════════ */

const SUPPORTED_LANGS = ["pt", "es"] as const;
export type SupportedLang = (typeof SUPPORTED_LANGS)[number];

const APP_VARIANTS = ["pt", "es", "amanda"] as const;
export type AppVariant = (typeof APP_VARIANTS)[number];

/** A variante vem do primeiro segmento da URL — e só de lá. Sem localStorage,
 *  sem detecção de navegador, sem seletor. */
export function getVariantFromPath(pathname: string): AppVariant {
  const first = pathname.split("/")[1];
  return APP_VARIANTS.includes(first as AppVariant) && first !== "pt"
    ? (first as AppVariant)
    : "pt";
}

/** Idioma de uma variante: a Amanda é em português. */
export function variantLang(variant: AppVariant): SupportedLang {
  return variant === "es" ? "es" : "pt";
}

export function getLangFromPath(pathname: string): SupportedLang {
  return variantLang(getVariantFromPath(pathname));
}

export function useCurrentVariant(): AppVariant {
  const { pathname } = useLocation();
  return getVariantFromPath(pathname);
}

export function useCurrentLang(): SupportedLang {
  return variantLang(useCurrentVariant());
}

/** Adiciona o prefixo da variante a um path absoluto. pt não recebe prefixo. */
export function localizedPath(path: string, variant: AppVariant): string {
  if (variant === "pt") return path;
  // Evita duplicar: /es/es/home
  if (path.startsWith(`/${variant}/`) || path === `/${variant}`) return path;
  return `/${variant}${path.startsWith("/") ? "" : "/"}${path}`;
}

/** Remove o prefixo da variante. Use para comparar rota ativa (nav, tabs). */
export function unlocalizedPath(pathname: string, variant: AppVariant): string {
  if (variant === "pt") return pathname;
  if (pathname === `/${variant}`) return "/";
  if (pathname.startsWith(`/${variant}/`)) return pathname.slice(variant.length + 1);
  return pathname;
}

/** Wrapper de useNavigate que preserva o prefixo da variante.
 *  Aceita number (navigate(-1)) e repassa direto, sem prefixar. */
export function useLocalizedNavigate() {
  const navigate = useNavigate();
  const variant = useCurrentVariant();

  return useCallback(
    (to: string | number, options?: NavigateOptions) => {
      if (typeof to === "number") {
        navigate(to);
        return;
      }
      navigate(localizedPath(to, variant), options);
    },
    [navigate, variant],
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
