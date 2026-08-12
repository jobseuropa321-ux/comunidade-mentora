import React, { useState } from 'react';

import { Bell, User, Kanban, TrendingUp, X, BellOff, MessageCircle, MessageSquareText, Heart, Library } from 'lucide-react';
import { usePlan } from '@/contexts/PlanContext';
import UpgradeModal from '@/components/UpgradeModal';
import { useNotifications, type NotificationItem } from '@/hooks/useNotifications';
import { useLocalizedNavigate, useCurrentLang, type SupportedLang } from '@/i18n/LanguageProvider';
import { useTranslation } from 'react-i18next';

// O locale vem do idioma da URL. Cravado em 'pt-BR' (como estava), a aluna
// espanhola lia "há 3 horas" no meio de uma tela em espanhol.
function timeAgo(iso: string, lang: SupportedLang): string {
  try {
    const rtf = new Intl.RelativeTimeFormat(lang === 'es' ? 'es-ES' : 'pt-BR', { numeric: 'auto' });
    const diffSec = (Date.now() - new Date(iso).getTime()) / 1000;
    const mins = Math.round(diffSec / 60);
    if (mins < 1) return rtf.format(0, 'minute');
    if (mins < 60) return rtf.format(-mins, 'minute');
    const hours = Math.round(mins / 60);
    if (hours < 24) return rtf.format(-hours, 'hour');
    const days = Math.round(hours / 24);
    return rtf.format(-days, 'day');
  } catch {
    return '';
  }
}

const actionKey = (type: string) =>
  type === 'lesson_reply' ? 'header.acao.lesson_reply'
  : type === 'community_like' ? 'header.acao.community_like'
  : 'header.acao.community_comment';

const Header: React.FC = () => {
  const navigate = useLocalizedNavigate();
  const { t } = useTranslation();
  const lang = useCurrentLang();
  const { hasFullAccess } = usePlan();
  const [notifsOpen, setNotifsOpen] = useState(false);
  const [upgradeModal, setUpgradeModal] = useState<string | null>(null);
  const { items, unreadCount, markAllRead, fetchItems } = useNotifications();

  const goTo = (path: string, featureName: string) => {
    if (!hasFullAccess) {
      setUpgradeModal(featureName);
      return;
    }
    navigate(path);
  };

  const openNotifs = () => {
    setNotifsOpen(true);
    fetchItems();
  };

  const closeNotifs = () => {
    setNotifsOpen(false);
    markAllRead();
  };

  const openNotification = (it: NotificationItem) => {
    setNotifsOpen(false);
    markAllRead();
    if ((it.type === 'community_comment' || it.type === 'community_like') && it.post_id) {
      navigate(`/community?post=${it.post_id}`);
      return;
    }
    if (it.type === 'lesson_reply' && it.module_slug) {
      // No mock o destino já vem resolvido na própria notificação.
      if (typeof it.aula_index === 'number') navigate(`/modulo/${it.module_slug}/aula/${it.aula_index + 1}`);
      else navigate(`/modulo/${it.module_slug}`);
    }
  };

  return (
    <>
      <header className="header-glass sticky top-0 z-40 w-full">
        <div className="relative flex items-center justify-between px-4 pt-3 pb-3 max-w-lg mx-auto">

          {/* Esquerda: perfil */}
          <div className="flex items-center gap-2">
            <button
              onClick={() => navigate('/profile')}
              className="shrink-0 w-10 h-10 rounded-full flex items-center justify-center text-white shadow-[0_5px_14px_-4px_rgba(190,13,62,0.35)] hover:scale-105 active:scale-95 transition-transform"
              style={{ background: 'linear-gradient(180deg, #E63462 0%, #CB1B49 100%)' }}
              aria-label={t('header.perfil')}
            >
              <User size={18} strokeWidth={1.8} />
            </button>
          </div>

          {/* Logo — centralizada absolutamente. TROQUE /logo-app.webp pela sua logo */}
          <div
            className="absolute left-1/2 -translate-x-1/2 pointer-events-none select-none"
            aria-label={t('header.logoApp')}
          >
            <img
              src="/logo-app.webp"
              alt="Amentora"
              className="h-12 w-auto"
              draggable={false}
              loading="eager"
              // @ts-expect-error fetchPriority é suportado em browsers modernos mas ainda não tipado no React
              fetchpriority="high"
              decoding="sync"
            />
          </div>

          {/* Direita: biblioteca + notificações */}
          <div className="flex items-center gap-2">
            <button
              onClick={() => navigate('/biblioteca')}
              className="relative shrink-0 w-10 h-10 rounded-full flex items-center justify-center text-[#BE0D3E] bg-white border border-[#BE0D3E]/15 shadow-[0_5px_14px_-4px_rgba(190,13,62,0.22)] hover:scale-105 active:scale-95 transition-transform"
              aria-label={t('header.abrirBiblioteca')}
              title={t('header.biblioteca')}
            >
              <Library size={18} strokeWidth={1.9} />
              <span className="absolute top-1 right-1 w-2 h-2 rounded-full bg-[#F6B43A] ring-2 ring-white" aria-hidden="true" />
            </button>
            <button
              onClick={openNotifs}
              className="relative shrink-0 w-10 h-10 rounded-full flex items-center justify-center text-white shadow-[0_5px_14px_-4px_rgba(190,13,62,0.35)] hover:scale-105 active:scale-95 transition-transform"
              style={{ background: 'linear-gradient(180deg, #E63462 0%, #CB1B49 100%)' }}
              aria-label={t('header.notificacoes')}
            >
              <Bell size={18} strokeWidth={1.8} />
              {unreadCount > 0 && (
                <span className="absolute -top-0.5 -right-0.5 min-w-[18px] h-[18px] px-1 rounded-full bg-[#F6B43A] text-[#1E1B11] text-[10px] font-black flex items-center justify-center ring-2 ring-white/90">
                  {unreadCount > 9 ? '9+' : unreadCount}
                </span>
              )}
            </button>
          </div>

        </div>
      </header>

      {/* Overlay + drawer de notificações */}
      {notifsOpen && (
        <>
          <div
            className="fixed inset-0 z-50 bg-[#1E1B11]/30 backdrop-blur-sm"
            onClick={closeNotifs}
          />
          <div className="fixed top-[64px] left-4 z-50 w-[300px] max-w-[calc(100vw-2rem)] rounded-2xl overflow-hidden shadow-[0_20px_50px_rgba(255,45,122,0.25)]"
            style={{
              background: 'rgba(255,255,255,0.97)',
              border: '1px solid rgba(255,45,122,0.2)',
              backdropFilter: 'blur(20px)',
            }}
          >
            <div className="flex items-center justify-between px-4 py-3 border-b border-[#BE0D3E]/15">
              <span className="text-[10px] font-black text-[#BE0D3E] uppercase tracking-widest">{t('header.notificacoes')}</span>
              <button onClick={closeNotifs} className="text-[#5B4041]/60 hover:text-[#1E1B11]">
                <X size={14} />
              </button>
            </div>

            {items.length === 0 ? (
              <div className="px-4 py-10 flex flex-col items-center justify-center">
                <div className="w-12 h-12 rounded-2xl bg-[#BE0D3E]/10 flex items-center justify-center mb-3">
                  <BellOff size={20} className="text-[#BE0D3E]/60" />
                </div>
                <p className="text-[12px] font-bold text-[#1E1B11]/80">{t('header.vazioTitulo')}</p>
                <p className="text-[10px] text-[#5B4041]/60 mt-1 text-center whitespace-pre-line">
                  {t('header.vazioTexto')}
                </p>
              </div>
            ) : (
              <div className="max-h-[60vh] overflow-y-auto">
                {items.map((it) => {
                  // Notificação de exemplo vem sem nome/texto prontos: o mock
                  // guarda a CHAVE para o texto seguir o idioma da tela.
                  const name = it.actor_name || (it.previewKey ? t('notificacoes.equipe') : t('header.alguem'));
                  const previewText = it.previewKey ? t(it.previewKey) : it.preview;
                  const Icon = it.type === 'lesson_reply'
                    ? MessageSquareText
                    : it.type === 'community_like'
                    ? Heart
                    : MessageCircle;
                  return (
                    <button
                      key={it.id}
                      onClick={() => openNotification(it)}
                      className={`w-full text-left flex gap-2.5 px-4 py-3 transition-colors border-b border-[#BE0D3E]/8 last:border-0 hover:bg-[#BE0D3E]/5 ${
                        it.is_read ? '' : 'bg-[#BE0D3E]/[0.06]'
                      }`}
                      style={{ WebkitTapHighlightColor: 'transparent' }}
                    >
                      <div className="relative shrink-0">
                        {it.actor_avatar ? (
                          <img src={it.actor_avatar} alt="" className="w-9 h-9 rounded-full object-cover" />
                        ) : (
                          <div className="w-9 h-9 rounded-full bg-[#BE0D3E]/15 flex items-center justify-center">
                            <Icon size={15} className="text-[#BE0D3E]" />
                          </div>
                        )}
                        {!it.is_read && (
                          <span className="absolute -top-0.5 -right-0.5 w-2.5 h-2.5 rounded-full bg-[#BE0D3E] ring-2 ring-white" />
                        )}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-[12px] text-[#1E1B11] leading-snug">
                          <span className="font-bold">{name}</span> {t(actionKey(it.type))}
                        </p>
                        {previewText && (
                          <p className="text-[11px] text-[#5B4041] mt-0.5 line-clamp-2 [overflow-wrap:anywhere]">
                            {previewText}
                          </p>
                        )}
                        <p className="text-[10px] text-[#5B4041]/60 mt-0.5">{timeAgo(it.created_at, lang)}</p>
                      </div>
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        </>
      )}

      {upgradeModal && (
        <UpgradeModal featureName={upgradeModal} onClose={() => setUpgradeModal(null)} />
      )}
    </>
  );
};

export default Header;
