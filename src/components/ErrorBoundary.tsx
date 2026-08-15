/* ═══════════════════════════════════════════════════════════════════════
 *  ErrorBoundary — a rede de segurança que faltava.
 *
 *  Antes disso, QUALQUER erro em qualquer tela derrubava a árvore do React
 *  e deixava o #root vazio: a pessoa via só o fundo creme, sem mensagem e
 *  sem botão. Foi o que a Rayana viu em 24/07.
 *
 *  Agora:
 *  · erro de build obsoleto (pedaço do app que não existe mais) → limpa o
 *    cache e recarrega sozinho, sem a pessoa precisar fazer nada;
 *  · qualquer outro erro → tela explicando o que houve, com botão.
 *
 *  Precisa ser class component: só essa forma tem componentDidCatch.
 * ═══════════════════════════════════════════════════════════════════════ */
import React from 'react';
import i18n from '@/i18n';
import { isStaleBuildError, recoverFromStaleBuild } from '@/lib/appRecovery';

/* Class component não tem hook, então falamos com a instância do i18n direto.
   O defaultValue é a rede de segurança da rede de segurança: se o erro derrubou
   o app ANTES do i18n subir, a aluna vê a frase em português em vez da chave. */
const tt = (chave: string, padrao: string) => i18n.t(chave, { defaultValue: padrao });

type Phase = 'ok' | 'recovering' | 'failed';

interface State {
  phase: Phase;
  message: string;
}

const Shell: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <div className="min-h-screen flex flex-col items-center justify-center gap-5 px-8 text-center bg-[#FFF7E6]">
    {children}
  </div>
);

class ErrorBoundary extends React.Component<{ children: React.ReactNode }, State> {
  state: State = { phase: 'ok', message: '' };

  static getDerivedStateFromError(error: unknown): State {
    return {
      // Build obsoleto a gente conserta sozinho; o resto vira tela de erro.
      phase: isStaleBuildError(error) ? 'recovering' : 'failed',
      message: error instanceof Error ? error.message : String(error ?? ''),
    };
  }

  componentDidCatch(error: unknown, info: React.ErrorInfo) {
    // Fica no console pro suporte conseguir ler quando alguém reportar.
    console.error('[ErrorBoundary]', error, info?.componentStack);

    if (!isStaleBuildError(error)) return;
    void recoverFromStaleBuild().then((started) => {
      // Já tentamos nesta sessão e não resolveu — para de insistir e mostra
      // a tela, senão vira loop de reload.
      if (!started) this.setState({ phase: 'failed' });
    });
  }

  private hardReload = () => {
    this.setState({ phase: 'recovering' });
    void recoverFromStaleBuild(true);
  };

  render() {
    const { phase, message } = this.state;

    if (phase === 'recovering') {
      return (
        <Shell>
          <div className="w-10 h-10 border-2 border-[#BE0D3E] border-t-transparent rounded-full animate-spin" />
          <p className="text-sm font-medium text-[#5B4041]">Atualizando o app...</p>
        </Shell>
      );
    }

    if (phase === 'failed') {
      return (
        <Shell>
          <h1 className="text-2xl text-[#1E1B11]">{tt('erroApp.titulo', 'Algo deu errado')}</h1>
          <p className="text-sm text-[#5B4041] max-w-xs leading-relaxed">
            {tt('erroApp.descricao', 'Não foi possível carregar o app agora. Toque no botão abaixo — na maioria das vezes isso já resolve.')}
          </p>
          <button
            onClick={this.hardReload}
            className="mt-1 px-7 py-3 rounded-full text-white text-sm font-bold tracking-wide active:scale-95 transition-transform shadow-[0_5px_14px_-4px_rgba(190,13,62,0.45)]"
            style={{ background: 'linear-gradient(180deg, #E63462 0%, #CB1B49 100%)' }}
          >
            {tt('erroApp.recarregar', 'Recarregar o app')}
          </button>
          <p className="text-[11px] text-[#5B4041]/60 max-w-xs">
            {tt('erroApp.suporte', 'Se continuar assim, chame o suporte e mande este print.')}
          </p>
          {message && (
            <code className="text-[10px] text-[#5B4041]/45 break-all max-w-xs">{message}</code>
          )}
        </Shell>
      );
    }

    return <>{this.props.children}</>;
  }
}

export default ErrorBoundary;
