import { useEffect, useRef } from 'react';

/**
 * Faz uma moldura `position: fixed; inset: 0` acompanhar o teclado do celular.
 *
 * O PROBLEMA: `inset-0` mede a viewport de LAYOUT, que no iOS não encolhe
 * quando o teclado sobe. A tela continua achando que tem a altura inteira do
 * aparelho enquanto pouco mais da metade está visível; o iOS então rola a
 * página sozinho pra revelar o campo de texto. O resultado é o que a aluna
 * filmou em 2026-08-15: cabeçalho sumido, mensagem da IA cortada no meio e um
 * vazio enorme onde deveria estar a conversa.
 *
 * `visualViewport` é a única medida que enxerga a área de fato visível.
 * `100dvh` NÃO resolve (a viewport dinâmica considera as barras do navegador,
 * não o teclado) e `interactive-widget=resizes-content` no meta viewport só
 * vale no Chrome/Android — as alunas estão no iPhone.
 *
 * EFEITO COLATERAL PROPOSITAL: o `transform` faz a moldura virar o bloco de
 * referência dos filhos com `position: fixed` — na prática, o modal de salvar
 * passa a medir a área visível em vez da tela inteira, e deixa de nascer meio
 * escondido atrás do teclado.
 */
export function useKeyboardViewport<T extends HTMLElement>() {
  const ref = useRef<T>(null);

  useEffect(() => {
    const vv = window.visualViewport;
    const el = ref.current;
    // Sem suporte: fica como era antes, com `inset-0` mesmo.
    if (!vv || !el) return;

    const apply = () => {
      el.style.height = `${vv.height}px`;
      // offsetTop compensa a rolagem que o próprio iOS aplica na página pra
      // trazer o campo focado à vista — sem isso a moldura fica deslocada.
      el.style.transform = `translate3d(0, ${vv.offsetTop}px, 0)`;
    };

    apply();
    vv.addEventListener('resize', apply);
    vv.addEventListener('scroll', apply);
    return () => {
      vv.removeEventListener('resize', apply);
      vv.removeEventListener('scroll', apply);
      el.style.height = '';
      el.style.transform = '';
    };
  }, []);

  return ref;
}
