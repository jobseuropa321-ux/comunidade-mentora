import React, { useEffect, useRef } from 'react';

/* Chuva de confete nas cores da marca, em canvas puro (sem dependência).
   Dispara ao montar, dura ~4s e some sozinha. Respeita reduzir movimento. */

const CORES_MARCA = ['#BE0D3E', '#E06B85', '#F6B43A', '#FBC85F', '#F6D6DC', '#FFF3D6', '#94002D'];
/** Variante preto e dourado (mentoria). */
export const CORES_OURO = ['#D4AF37', '#F1D27A', '#B8860B', '#FFF1B8', '#8A6D1D', '#FFFFFF'];

interface Particula {
  x: number; y: number; vx: number; vy: number;
  w: number; h: number; rot: number; vr: number;
  cor: string; forma: 'rect' | 'circle'; vida: number;
}

const Confetti: React.FC<{ duracaoMs?: number; quantidade?: number; cores?: readonly string[] }> = ({ duracaoMs = 4200, quantidade = 160, cores = CORES_MARCA }) => {
  const ref = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = ref.current;
    if (!canvas) return;
    if (window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const resize = () => {
      canvas.width = window.innerWidth * dpr;
      canvas.height = window.innerHeight * dpr;
      canvas.style.width = `${window.innerWidth}px`;
      canvas.style.height = `${window.innerHeight}px`;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    };
    resize();
    window.addEventListener('resize', resize);

    const W = () => window.innerWidth;
    const H = () => window.innerHeight;

    // Duas rajadas: uma de cada canto de baixo, subindo pro meio.
    const particulas: Particula[] = [];
    const rajada = (ox: number, dir: number) => {
      for (let i = 0; i < quantidade / 2; i++) {
        const ang = (-Math.PI / 2) + dir * (Math.random() * 0.9 + 0.15);
        const forca = 9 + Math.random() * 9;
        particulas.push({
          x: ox, y: H() + 10,
          vx: Math.cos(ang) * forca, vy: Math.sin(ang) * forca,
          w: 6 + Math.random() * 6, h: 4 + Math.random() * 8,
          rot: Math.random() * Math.PI, vr: (Math.random() - 0.5) * 0.3,
          cor: cores[Math.floor(Math.random() * cores.length)],
          forma: Math.random() < 0.25 ? 'circle' : 'rect',
          vida: 1,
        });
      }
    };
    rajada(W() * 0.12, 1);
    rajada(W() * 0.88, -1);
    // Chuva suave de cima, pra preencher.
    for (let i = 0; i < quantidade / 2; i++) {
      particulas.push({
        x: Math.random() * W(), y: -20 - Math.random() * H() * 0.6,
        vx: (Math.random() - 0.5) * 1.5, vy: 2 + Math.random() * 3,
        w: 5 + Math.random() * 6, h: 4 + Math.random() * 8,
        rot: Math.random() * Math.PI, vr: (Math.random() - 0.5) * 0.25,
        cor: cores[Math.floor(Math.random() * cores.length)],
        forma: Math.random() < 0.25 ? 'circle' : 'rect',
        vida: 1,
      });
    }

    const inicio = performance.now();
    let raf = 0;
    const tick = (agora: number) => {
      const t = agora - inicio;
      ctx.clearRect(0, 0, W(), H());
      const fade = t > duracaoMs - 900 ? Math.max(0, (duracaoMs - t) / 900) : 1;
      for (const p of particulas) {
        p.vy += 0.28;              // gravidade
        p.vx *= 0.985; p.vy *= 0.985;
        p.x += p.vx + Math.sin((t + p.w * 40) / 260) * 0.6;
        p.y += p.vy;
        p.rot += p.vr;
        ctx.save();
        ctx.globalAlpha = fade;
        ctx.translate(p.x, p.y);
        ctx.rotate(p.rot);
        ctx.fillStyle = p.cor;
        if (p.forma === 'circle') {
          ctx.beginPath(); ctx.arc(0, 0, p.w / 2, 0, Math.PI * 2); ctx.fill();
        } else {
          ctx.fillRect(-p.w / 2, -p.h / 2, p.w, p.h);
        }
        ctx.restore();
      }
      if (t < duracaoMs) raf = requestAnimationFrame(tick);
      else ctx.clearRect(0, 0, W(), H());
    };
    raf = requestAnimationFrame(tick);

    return () => { cancelAnimationFrame(raf); window.removeEventListener('resize', resize); };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [duracaoMs, quantidade]);

  return <canvas ref={ref} className="fixed inset-0 z-[60] pointer-events-none" aria-hidden />;
};

export default Confetti;
