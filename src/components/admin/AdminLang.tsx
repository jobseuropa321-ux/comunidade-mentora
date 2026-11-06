import React, { createContext, useContext, useState } from 'react';
import { variantLang, type AppVariant, type SupportedLang } from '@/i18n/LanguageProvider';

/* ══════════════════════════════════════════════════════════════
   VERSÃO DA EDIÇÃO — vale para a área de administração inteira.

   Antes cada tela mostrava os dois idiomas lado a lado (campo normal +
   campo "(ES)"), e era fácil salvar conteúdo em espanhol no campo do
   português: foi o que aconteceu com três capas de módulo em 15/08/2026,
   que trocaram a capa da versão brasileira.

   Agora o admin escolhe a versão uma vez e edita só ela. O português é a
   base (o que existe sempre); o espanhol é sobreposição — campo em branco
   no espanhol faz o app cair no português, em vez de ficar buraco.

   A Amanda (/amanda) é uma variante em PORTUGUÊS: os textos são os mesmos
   do PT, o que muda é o catálogo. Módulo/aula criado com o seletor nela
   nasce "só Amanda"; o campo "Versão da Amanda" do editor ajusta depois.
   ══════════════════════════════════════════════════════════════ */

interface AdminLangValue {
  adminLang: AppVariant;
  setAdminLang: (l: AppVariant) => void;
  /** Idioma do que está sendo editado (Amanda = português). É o que vai
   *  pro banco em live_settings.lang, push etc. */
  contentLang: SupportedLang;
  /** true quando está editando a versão em espanhol. */
  isEs: boolean;
  /** true quando está editando a variante da Amanda. */
  isAmanda: boolean;
}

const AdminLangContext = createContext<AdminLangValue>({
  adminLang: 'pt',
  setAdminLang: () => {},
  contentLang: 'pt',
  isEs: false,
  isAmanda: false,
});

export const useAdminLang = () => useContext(AdminLangContext);

export const AdminLangProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [adminLang, setAdminLang] = useState<AppVariant>('pt');
  return (
    <AdminLangContext.Provider value={{
      adminLang, setAdminLang,
      contentLang: variantLang(adminLang),
      isEs: adminLang === 'es',
      isAmanda: adminLang === 'amanda',
    }}>
      {children}
    </AdminLangContext.Provider>
  );
};

const OPTIONS: { id: AppVariant; label: string; flag: string }[] = [
  { id: 'pt', label: 'Português', flag: '🇧🇷' },
  { id: 'es', label: 'Espanhol', flag: '🇪🇸' },
  { id: 'amanda', label: 'Amanda', flag: '✨' },
];

const HINT: Record<AppVariant, string> = {
  pt: 'O que você salvar aqui vai para a versão em português — e serve de base para o espanhol e para a Amanda.',
  es: 'O que você salvar aqui vai só para a versão em espanhol (/es). Campo em branco = a aluna vê o português.',
  amanda: 'Versão /amanda: mesmos textos do português. Módulo ou aula criado aqui nasce "só Amanda"; o campo "Versão da Amanda" no editor tira ou devolve o que já existe. Ao vivo e avisos daqui são os do português.',
};

/** Seletor + aviso de qual versão está sendo editada. */
export const AdminLangSwitch: React.FC = () => {
  const { adminLang, setAdminLang, isEs, isAmanda } = useAdminLang();
  const dark = isEs || isAmanda;

  return (
    <div
      className={`rounded-2xl p-2.5 mb-4 border-2 transition-colors ${
        isEs ? 'bg-[#1E1B11] border-[#1E1B11]' : isAmanda ? 'bg-[#7C0026] border-[#7C0026]' : 'bg-white border-[#BE0D3E]/15'
      }`}
    >
      <p className={`text-[9px] font-black uppercase tracking-widest mb-1.5 px-0.5 ${dark ? 'text-white/60' : 'text-[#5B4041]/70'}`}>
        Editando a versão
      </p>
      <div className="grid grid-cols-3 gap-1.5">
        {OPTIONS.map(o => {
          const active = adminLang === o.id;
          return (
            <button
              key={o.id}
              onClick={() => setAdminLang(o.id)}
              className={`py-2 rounded-xl text-[10px] font-black uppercase tracking-widest flex items-center justify-center gap-1.5 transition-colors ${
                active
                  ? dark ? 'bg-white text-[#1E1B11]' : 'bg-[#BE0D3E] text-white'
                  : dark ? 'text-white/50' : 'text-[#5B4041]/60'
              }`}
              style={{ WebkitTapHighlightColor: 'transparent' }}
            >
              <span aria-hidden>{o.flag}</span> {o.label}
            </button>
          );
        })}
      </div>
      <p className={`text-[9px] leading-relaxed mt-2 px-0.5 ${dark ? 'text-white/70' : 'text-[#5B4041]/70'}`}>
        {HINT[adminLang]}
      </p>
    </div>
  );
};
