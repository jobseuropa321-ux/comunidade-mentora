import React from 'react';
import { useNavigate } from 'react-router-dom';
import { X, Camera, Play, Clock, Sparkles } from 'lucide-react';

interface Props {
  open: boolean;
  onClose: () => void;
}

interface RoteiroRapido {
  id: string;
  titulo: string;
  duracao: string;
  categoria: string;
  descricao: string;
  cor: string;
}

const ROTEIROS: RoteiroRapido[] = [
  {
    id: 'gancho-3s-polemico',
    titulo: 'Gancho de 3s polêmico',
    duracao: '15-30s',
    categoria: 'Retenção',
    descricao: 'Abertura que gera discordância imediata pra prender o scroll.',
    cor: '#BE0D3E',
  },
  {
    id: 'antes-e-depois',
    titulo: 'Antes e depois relâmpago',
    duracao: '20-40s',
    categoria: 'Transformação',
    descricao: 'Mostra o resultado logo no início e depois volta pro processo.',
    cor: '#F6B43A',
  },
  {
    id: 'lista-rapida-3-dicas',
    titulo: '3 dicas em 30 segundos',
    duracao: '30s',
    categoria: 'Educativo',
    descricao: 'Formato lista com corte seco entre cada dica — ótimo pra salvar.',
    cor: '#E06B85',
  },
  {
    id: 'pov-tendencia',
    titulo: 'POV com trend do momento',
    duracao: '10-20s',
    categoria: 'Tendência',
    descricao: 'Roteiro pronto pra encaixar num áudio viral em alta agora.',
    cor: '#BE0D3E',
  },
  {
    id: 'storytime-virada',
    titulo: 'Storytime com virada no final',
    duracao: '45-60s',
    categoria: 'Storytelling',
    descricao: 'Narrativa pessoal com plot twist pra segurar até o último segundo.',
    cor: '#F6B43A',
  },
];

const CameraScriptPicker: React.FC<Props> = ({ open, onClose }) => {
  const navigate = useNavigate();

  if (!open) return null;

  const handleEscolher = (id: string) => {
    navigate(`/estudio/${id}`);
    onClose();
  };

  return (
    <>
      <div
        className="fixed inset-0 z-[60] bg-[#1E1B11]/40 backdrop-blur-sm"
        onClick={onClose}
        aria-hidden="true"
      />

      <div
        className="fixed bottom-0 inset-x-0 z-[70] max-w-lg mx-auto rounded-t-3xl overflow-hidden"
        style={{
          background: 'linear-gradient(180deg, #FFFFFF 0%, #FFF9EE 100%)',
          border: '1px solid rgba(255,45,122,0.15)',
          borderBottom: 'none',
          boxShadow: '0 -20px 50px rgba(26,26,26,0.25)',
        }}
        role="dialog"
        aria-modal="true"
        aria-label="Escolher roteiro para gravar"
      >
        <div className="flex justify-center pt-3 pb-1">
          <div className="w-10 h-1 rounded-full bg-[#BE0D3E]/25" />
        </div>

        <div className="flex items-center justify-between px-5 pt-2 pb-4">
          <div>
            <span className="text-[9px] sm:text-[10px] font-black uppercase tracking-widest text-[#5B4041]/50">
              Câmera rápida
            </span>
            <h2 className="text-lg font-black tracking-tighter text-[#1E1B11] flex items-center gap-1.5">
              Escolha um roteiro pra gravar
              <Sparkles size={16} className="text-[#BE0D3E]" />
            </h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Fechar"
            className="w-9 h-9 shrink-0 rounded-full bg-[#1E1B11]/5 flex items-center justify-center active:scale-[0.92] transition-transform"
            style={{ WebkitTapHighlightColor: 'transparent' }}
          >
            <X size={18} className="text-[#1E1B11]" />
          </button>
        </div>

        <div className="max-h-[70vh] overflow-y-auto scrollbar-hide px-5 pb-6 space-y-3">
          {ROTEIROS.map((roteiro) => (
            <button
              key={roteiro.id}
              type="button"
              onClick={() => handleEscolher(roteiro.id)}
              className="viral-card w-full text-left p-4 flex items-center gap-3 active:scale-[0.98] transition-transform"
              style={{ WebkitTapHighlightColor: 'transparent' }}
            >
              <div
                className="w-12 h-12 shrink-0 rounded-2xl flex items-center justify-center"
                style={{
                  background: `linear-gradient(135deg, ${roteiro.cor} 0%, #1E1B11 220%)`,
                  boxShadow: `0 6px 16px ${roteiro.cor}55`,
                }}
              >
                <Camera size={20} className="text-white" />
              </div>

              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1">
                  <span
                    className="text-[9px] font-black uppercase tracking-widest px-2 py-0.5 rounded-full text-white"
                    style={{ backgroundColor: roteiro.cor }}
                  >
                    {roteiro.categoria}
                  </span>
                  <span className="flex items-center gap-0.5 text-[10px] font-bold text-[#5B4041]">
                    <Clock size={10} />
                    {roteiro.duracao}
                  </span>
                </div>
                <p className="font-black tracking-tight text-[#1E1B11] text-[15px] leading-tight truncate">
                  {roteiro.titulo}
                </p>
                <p className="text-xs text-[#5B4041] leading-snug mt-0.5 line-clamp-2">
                  {roteiro.descricao}
                </p>
              </div>

              <div
                className="w-8 h-8 shrink-0 rounded-full flex items-center justify-center"
                style={{
                  background: 'linear-gradient(135deg, #BE0D3E 0%, #E06B85 100%)',
                  boxShadow: '0 4px 12px rgba(255,45,122,0.4)',
                }}
              >
                <Play size={13} className="text-white fill-white ml-0.5" />
              </div>
            </button>
          ))}

          <p className="text-center text-[11px] text-[#5B4041]/70 pt-1 pb-1">
            Toque em um roteiro pra abrir a câmera no Estúdio
          </p>
        </div>
      </div>
    </>
  );
};

export default CameraScriptPicker;
