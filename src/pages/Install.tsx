import React, { useState } from 'react';
import {
  Share,
  PlusSquare,
  MoreVertical,
  Download,
  Smartphone,
  Home as HomeIcon,
  CheckCircle2,
  Zap,
  BellRing,
  WifiOff,
  ChevronRight,
} from 'lucide-react';

type Plataforma = 'iphone' | 'android';

interface Passo {
  icon: React.ElementType;
  titulo: string;
  descricao: string;
}

const PASSOS_IPHONE: Passo[] = [
  {
    icon: Share,
    titulo: 'Toque em Compartilhar',
    descricao: 'Abra a Amentora no Safari e toque no ícone de compartilhamento (o quadrado com a seta pra cima), na barra inferior do navegador.',
  },
  {
    icon: PlusSquare,
    titulo: 'Adicionar à Tela de Início',
    descricao: 'Deslize o menu que abriu até encontrar a opção "Adicionar à Tela de Início" e toque nela.',
  },
  {
    icon: CheckCircle2,
    titulo: 'Confirme o nome do app',
    descricao: 'Deixe como "Amentora" (ou renomeie do seu jeito) e toque em "Adicionar" no canto superior direito.',
  },
  {
    icon: HomeIcon,
    titulo: 'Pronto! Ícone na tela',
    descricao: 'O app aparece na sua tela de início igual um app nativo, sem barra do navegador e com acesso instantâneo.',
  },
];

const PASSOS_ANDROID: Passo[] = [
  {
    icon: MoreVertical,
    titulo: 'Abra o menu do Chrome',
    descricao: 'Com a Amentora aberta no Chrome, toque nos três pontinhos no canto superior direito da tela.',
  },
  {
    icon: Download,
    titulo: 'Instalar aplicativo',
    descricao: 'Toque em "Instalar aplicativo" ou "Adicionar à tela inicial" (o texto pode variar um pouco conforme a versão do Chrome).',
  },
  {
    icon: CheckCircle2,
    titulo: 'Confirme a instalação',
    descricao: 'Uma caixinha vai aparecer perguntando se você quer instalar. Toque em "Instalar" para confirmar.',
  },
  {
    icon: HomeIcon,
    titulo: 'Pronto! Ícone na tela',
    descricao: 'O app cai direto na sua tela inicial ou na gaveta de aplicativos, pronto pra abrir com um toque.',
  },
];

const Install: React.FC = () => {
  const [aba, setAba] = useState<Plataforma>('iphone');
  const passos = aba === 'iphone' ? PASSOS_IPHONE : PASSOS_ANDROID;

  return (
    <div className="max-w-lg mx-auto px-4 pt-4 pb-28">
      {/* Header da tela */}
      <div className="mb-6">
        <span className="text-[9px] sm:text-[10px] font-black uppercase tracking-widest text-[#5B4041]/50">
          Leva 30 segundos
        </span>
        <h1 className="page-title mt-1">Instale a Amentora</h1>
        <p className="text-[13px] text-[#5B4041] font-medium mt-2 leading-relaxed">
          Transforme a comunidade num app de verdade no seu celular. Sem loja, sem espaço ocupado, sem complicação — só três toques.
        </p>
      </div>

      {/* Seletor de plataforma */}
      <div
        className="flex items-center gap-1 p-1 rounded-2xl mb-6"
        style={{ background: 'rgba(255,45,122,0.08)' }}
      >
        <button
          onClick={() => setAba('iphone')}
          style={{
            WebkitTapHighlightColor: 'transparent',
            ...(aba === 'iphone'
              ? { background: 'linear-gradient(135deg, #BE0D3E 0%, #E06B85 100%)', boxShadow: '0 6px 16px rgba(255,45,122,0.35)' }
              : {}),
          }}
          className={`flex-1 flex items-center justify-center gap-2 py-3 rounded-xl text-[13px] font-black transition-all active:scale-[0.98] ${
            aba === 'iphone' ? 'text-white' : 'text-[#5B4041]'
          }`}
        >
          <Smartphone size={16} />
          iPhone
        </button>
        <button
          onClick={() => setAba('android')}
          style={{
            WebkitTapHighlightColor: 'transparent',
            ...(aba === 'android'
              ? { background: 'linear-gradient(135deg, #BE0D3E 0%, #E06B85 100%)', boxShadow: '0 6px 16px rgba(255,45,122,0.35)' }
              : {}),
          }}
          className={`flex-1 flex items-center justify-center gap-2 py-3 rounded-xl text-[13px] font-black transition-all active:scale-[0.98] ${
            aba === 'android' ? 'text-white' : 'text-[#5B4041]'
          }`}
        >
          <Smartphone size={16} />
          Android
        </button>
      </div>

      {/* Passo a passo */}
      <div className="space-y-4 mb-6">
        {passos.map((passo, index) => {
          const Icon = passo.icon;
          return (
            <div key={`${aba}-${index}`} className="viral-card rounded-2xl p-4 flex gap-4 items-start">
              <div
                className="w-9 h-9 rounded-full flex items-center justify-center text-white text-[13px] font-black shrink-0"
                style={{
                  background: 'linear-gradient(135deg, #BE0D3E 0%, #E06B85 100%)',
                  boxShadow: '0 4px 12px rgba(255,45,122,0.35)',
                }}
              >
                {index + 1}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1">
                  <Icon size={16} className="text-[#BE0D3E] shrink-0" />
                  <h3 className="text-[14px] font-black text-[#1E1B11] leading-tight">{passo.titulo}</h3>
                </div>
                <p className="text-[12.5px] text-[#5B4041] font-medium leading-relaxed">{passo.descricao}</p>
              </div>
              {index < passos.length - 1 && (
                <ChevronRight size={16} className="text-[#1E1B11]/10 shrink-0 mt-2" />
              )}
            </div>
          );
        })}
      </div>

      {/* Card de benefícios */}
      <div className="card-glass-liquid-lime rounded-3xl p-6">
        <div className="flex items-center gap-2 mb-4">
          <div
            className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0"
            style={{ background: 'rgba(26,26,26,0.08)' }}
          >
            <Zap size={18} className="text-[#1E1B11]" fill="#1E1B11" />
          </div>
          <h2 className="text-[16px] font-black text-[#1E1B11] tracking-tight">
            Por que instalar vale a pena
          </h2>
        </div>

        <div className="space-y-3">
          <div className="flex items-start gap-3">
            <div className="w-7 h-7 rounded-lg bg-[#1E1B11]/8 flex items-center justify-center shrink-0 mt-0.5">
              <Zap size={14} className="text-[#1E1B11]" />
            </div>
            <p className="text-[13px] text-[#1E1B11] font-bold leading-snug">
              Acesso rápido — abre direto na sua tela inicial, sem procurar link ou digitar URL.
            </p>
          </div>
          <div className="flex items-start gap-3">
            <div className="w-7 h-7 rounded-lg bg-[#1E1B11]/8 flex items-center justify-center shrink-0 mt-0.5">
              <BellRing size={14} className="text-[#1E1B11]" />
            </div>
            <p className="text-[13px] text-[#1E1B11] font-bold leading-snug">
              Notificações de aulas novas, desafios e conteúdos quentes direto no seu celular.
            </p>
          </div>
          <div className="flex items-start gap-3">
            <div className="w-7 h-7 rounded-lg bg-[#1E1B11]/8 flex items-center justify-center shrink-0 mt-0.5">
              <WifiOff size={14} className="text-[#1E1B11]" />
            </div>
            <p className="text-[13px] text-[#1E1B11] font-bold leading-snug">
              Funciona até com internet ruim — a comunidade abre rápido mesmo em 3G fraquinho.
            </p>
          </div>
        </div>
      </div>

      {/* Rodapé motivacional */}
      <p className="text-center text-[11px] text-[#5B4041] font-semibold mt-6 px-4 leading-relaxed">
        Criador de conteúdo de verdade não perde tempo abrindo navegador. Instala uma vez e usa todo dia.
      </p>
    </div>
  );
};

export default Install;
