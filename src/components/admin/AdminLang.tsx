import React, { createContext, useContext, useState } from 'react';
import type { SupportedLang } from '@/i18n/LanguageProvider';

/* ══════════════════════════════════════════════════════════════
   IDIOMA DA EDIÇÃO — vale para a área de administração inteira.

   Antes cada tela mostrava os dois idiomas lado a lado (campo normal +
   campo "(ES)"), e era fácil salvar conteúdo em espanhol no campo do
   português: foi o que aconteceu com três capas de módulo em 15/08/2026,
   que trocaram a capa da versão brasileira.

   Agora o admin escolhe o idioma uma vez e edita só ele. O português é a
   base (o que existe sempre); o espanhol é sobreposição — campo em branco
   no espanhol faz o app cair no português, em vez de ficar buraco.
   ══════════════════════════════════════════════════════════════ */

interface AdminLangValue {
  adminLang: SupportedLang;
  setAdminLang: (l: SupportedLang) => void;
  /** true quando está editando a versão em espanhol. */
  isEs: boolean;
}

const AdminLangContext = createContext<AdminLangValue>({
  adminLang: 'pt',
  setAdminLang: () => {},
  isEs: false,
});

export const useAdminLang = () => useContext(AdminLangContext);

export const AdminLangProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [adminLang, setAdminLang] = useState<SupportedLang>('pt');
  return (
    <AdminLangContext.Provider value={{ adminLang, setAdminLang, isEs: adminLang === 'es' }}>
      {children}
    </AdminLangContext.Provider>
  );
};

const OPTIONS: { id: SupportedLang; label: string; flag: string }[] = [
  { id: 'pt', label: 'Português', flag: '🇧🇷' },
  { id: 'es', label: 'Espanhol', flag: '🇪🇸' },
];

/** Seletor + aviso de qual versão está sendo editada. */
export const AdminLangSwitch: React.FC = () => {
  const { adminLang, setAdminLang, isEs } = useAdminLang();

  return (
    <div
      className={`rounded-2xl p-2.5 mb-4 border-2 transition-colors ${
        isEs ? 'bg-[#1E1B11] border-[#1E1B11]' : 'bg-white border-[#BE0D3E]/15'
      }`}
    >
      <p className={`text-[9px] font-black uppercase tracking-widest mb-1.5 px-0.5 ${isEs ? 'text-white/60' : 'text-[#5B4041]/70'}`}>
        Editando a versão
      </p>
      <div className="grid grid-cols-2 gap-1.5">
        {OPTIONS.map(o => {
          const active = adminLang === o.id;
          return (
            <button
              key={o.id}
              onClick={() => setAdminLang(o.id)}
              className={`py-2 rounded-xl text-[10px] font-black uppercase tracking-widest flex items-center justify-center gap-1.5 transition-colors ${
                active
                  ? isEs ? 'bg-white text-[#1E1B11]' : 'bg-[#BE0D3E] text-white'
                  : isEs ? 'text-white/50' : 'text-[#5B4041]/60'
              }`}
              style={{ WebkitTapHighlightColor: 'transparent' }}
            >
              <span aria-hidden>{o.flag}</span> {o.label}
            </button>
          );
        })}
      </div>
      <p className={`text-[9px] leading-relaxed mt-2 px-0.5 ${isEs ? 'text-white/70' : 'text-[#5B4041]/70'}`}>
        {isEs
          ? 'O que você salvar aqui vai só para a versão em espanhol (/es). Campo em branco = a aluna vê o português.'
          : 'O que você salvar aqui vai para a versão em português — e serve de base para o espanhol.'}
      </p>
    </div>
  );
};
