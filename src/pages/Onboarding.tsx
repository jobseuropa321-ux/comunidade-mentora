import React, { useEffect, useMemo, useRef, useState } from 'react';
import { motion, MotionConfig } from 'framer-motion';
import { ArrowLeft, ArrowRight, Camera, Check, Instagram, Loader2, LogOut, Sparkles, ImagePlus, Link2 } from 'lucide-react';
import { toast } from 'sonner';
import { useTranslation } from 'react-i18next';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useCurrentLang, useLocalizedNavigate } from '@/i18n/LanguageProvider';
import { ImageProcessingError } from '@/lib/imageCompression';
import { AVATAR_MAX_BYTES, uploadAvatar } from '@/lib/avatar';
import { normalizeInstagramHandle, instagramUrl } from '@/lib/instagram';
import Confetti from '@/components/Confetti';
import VoiceField from '@/components/VoiceField';
import {
  ArteBoasVindas, AroFoto, SemFoto, ArteInsta, ArteProfissao, ArteTempo,
  ArteObjetivo, ArteExpectativa, ArteConcluido, FundoVivo,
} from '@/components/onboarding/Arte';

/* ══════════════════════════════════════════════════════════════
   ONBOARDING DE BOAS-VINDAS — /onboarding (tela cheia)

   Aparece no primeiro login: o ProtectedRoute (App.tsx) manda pra cá
   enquanto profiles.onboarding_concluido_em for NULL. Quem já usava o app
   antes disso foi marcado como concluído na migration.

   Foto é OBRIGATÓRIA (sobe na hora, igual ao Perfil). Instagram vai direto
   pro profiles.instagram (fica linkado no perfil). O resto vai pra
   onboarding_respostas — separado porque profiles é legível por todas.

   Mesmo esqueleto da Matrícula: uma coisa por tela, barra sem número,
   balão de incentivo, chip escolhido já avança.
   ══════════════════════════════════════════════════════════════ */

type Passo = 'boasVindas' | 'nome' | 'foto' | 'insta' | 'profissao' | 'tempo' | 'objetivo' | 'expectativa' | 'fim';

const campoCls = 'w-full rounded-2xl bg-white border-2 border-[#BE0D3E]/20 px-4 py-3.5 text-[15px] text-[#1E1B11] placeholder:text-[#5B4041]/35 outline-none focus:border-[#BE0D3E] focus:ring-4 focus:ring-[#BE0D3E]/10 transition-shadow';

const Chips: React.FC<{ opcoes: string[]; valor: string; onChange: (v: string) => void }> = ({ opcoes, valor, onChange }) => (
  <div className="flex flex-wrap gap-2.5">
    {opcoes.map((o, i) => {
      const ativo = valor === o;
      return (
        <motion.button key={o} type="button" onClick={() => onChange(ativo ? '' : o)}
          initial={{ opacity: 0, y: 10, scale: 0.9 }} animate={{ opacity: 1, y: 0, scale: ativo ? 1.04 : 1 }}
          transition={{ delay: 0.05 * i, type: 'spring', stiffness: 320, damping: 20 }}
          whileTap={{ scale: 0.93 }}
          className="rounded-full px-4 py-2.5 text-[13px] font-bold flex items-center gap-1.5"
          style={{
            background: ativo ? 'linear-gradient(135deg, #BE0D3E, #94002D)' : 'white',
            color: ativo ? 'white' : '#5B4041',
            border: ativo ? '1px solid transparent' : '1px solid rgba(190,13,62,0.18)',
            boxShadow: ativo ? '0 6px 16px -6px rgba(190,13,62,0.6)' : 'none',
            WebkitTapHighlightColor: 'transparent',
          }}>
          {ativo && <Check size={13} strokeWidth={3} />}
          {o}
        </motion.button>
      );
    })}
  </div>
);

const Balao: React.FC<{ texto: string }> = ({ texto }) => (
  <motion.div key={texto} initial={{ y: 10, opacity: 0, scale: 0.94 }} animate={{ y: 0, opacity: 1, scale: 1 }}
    transition={{ type: 'spring', stiffness: 280, damping: 18 }} className="flex items-end gap-2">
    <img src="/logo-icon.png" alt="" className="w-9 h-9 rounded-full shrink-0 object-cover shadow-sm" />
    <div className="bg-white border border-[#BE0D3E]/12 rounded-2xl rounded-bl-md px-3.5 py-2.5 text-[12.5px] font-bold text-[#1E1B11] shadow-[0_6px_18px_-10px_rgba(190,13,62,0.5)]">
      {texto}
    </div>
  </motion.div>
);

/* Casca das perguntas. Fica FORA do Onboarding: declarada dentro, seria um
   componente novo a cada render e o input perderia o foco a cada tecla. */
const Pergunta: React.FC<{ arte?: React.ReactNode; titulo: string; sub?: string; children: React.ReactNode }> = ({ arte, titulo, sub, children }) => (
  <>
    <div className="mt-7 flex items-center gap-4">
      {arte}
      <h2 className="flex-1 text-[23px] font-black leading-tight text-[#1E1B11]">{titulo}</h2>
    </div>
    {sub && <p className="mt-3 text-[12.5px] text-[#5B4041]/75">{sub}</p>}
    <div className="mt-6">{children}</div>
  </>
);

const Onboarding: React.FC = () => {
  const { t } = useTranslation();
  const lang = useCurrentLang();
  const navigate = useLocalizedNavigate();
  const { user, profile, profileLoading, updateProfile, signOut } = useAuth();

  const opcoesProfissao = t('onboarding.profissao.opcoes', { returnObjects: true }) as string[];
  const opcoesTempo = t('onboarding.tempo.opcoes', { returnObjects: true }) as string[];
  const opcoesObjetivo = t('onboarding.objetivo.opcoes', { returnObjects: true }) as string[];
  const OUTRA = opcoesProfissao[opcoesProfissao.length - 1];

  // Sem nome no cadastro (conta criada pela compra às vezes vem sem) → pergunta.
  const [precisaNome] = useState(() => !profile?.full_name?.trim());
  const passos = useMemo<Passo[]>(
    () => ['boasVindas', ...(precisaNome ? ['nome' as const] : []), 'foto', 'insta', 'profissao', 'tempo', 'objetivo', 'expectativa', 'fim'],
    [precisaNome],
  );

  const [i, setI] = useState(0);
  const [direcao, setDirecao] = useState(1);
  const passo = passos[i];

  const [nome, setNome] = useState(profile?.full_name ?? '');
  const [insta, setInsta] = useState(normalizeInstagramHandle(profile?.instagram));
  const [profissao, setProfissao] = useState('');
  const [profissaoOutra, setProfissaoOutra] = useState('');
  const [tempo, setTempo] = useState('');
  const [objetivo, setObjetivo] = useState('');
  const [expectativa, setExpectativa] = useState('');

  const [enviandoFoto, setEnviandoFoto] = useState(false);
  const [fotoNova, setFotoNova] = useState(false);
  const [salvando, setSalvando] = useState(false);
  const [confete, setConfete] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  // Já concluiu (voltou pra /onboarding pela URL) → home. O ref cobre o
  // próprio concluir: o perfil ganha a data um render ANTES de o passo virar
  // 'fim', e sem ele a aluna pulava a tela de comemoração.
  const concluindo = useRef(false);
  useEffect(() => {
    if (!profileLoading && profile?.onboarding_concluido_em && !concluindo.current) navigate('/home', { replace: true });
  }, [profileLoading, profile?.onboarding_concluido_em, navigate]);

  useEffect(() => { window.scrollTo({ top: 0 }); }, [i]);

  const primeiroNome = (nome || profile?.full_name || '').trim().split(' ')[0];
  const avatar = profile?.avatar_url ?? null;
  const handle = normalizeInstagramHandle(insta);
  const profissaoFinal = profissao === OUTRA ? profissaoOutra.trim() : profissao;

  const ir = (para: number, dir: 1 | -1) => { setDirecao(dir); setI(Math.max(0, Math.min(passos.length - 1, para))); };

  const escolherFoto = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (fileRef.current) fileRef.current.value = '';
    if (!file || !user) return;
    if (file.size > AVATAR_MAX_BYTES) { toast.error(t('onboarding.foto.arquivoGrande')); return; }
    setEnviandoFoto(true);
    try {
      const url = await uploadAvatar(user.id, file);
      const { error } = await updateProfile({ avatar_url: url });
      if (error) throw error;
      setFotoNova(true);
    } catch (err) {
      console.error(err);
      const formato = err instanceof ImageProcessingError && (err.reason === 'not_image' || err.reason === 'decode');
      toast.error(formato ? t('onboarding.foto.formato') : t('onboarding.foto.falha'));
    } finally {
      setEnviandoFoto(false);
    }
  };

  /* Salva o que cada passo tem de "perfil" ao sair dele, pra não perder
     nada se ela fechar o app no meio. */
  const avancar = async () => {
    if (passo === 'nome') {
      const { error } = await updateProfile({ full_name: nome.trim() });
      if (error) { toast.error(t('onboarding.falhaSalvar')); return; }
    }
    if (passo === 'insta') {
      const { error } = await updateProfile({ instagram: handle || null });
      if (error) { toast.error(t('onboarding.falhaSalvar')); return; }
    }
    if (passo === 'expectativa') { await concluir(); return; }
    ir(i + 1, 1);
  };

  const pularInsta = async () => { setInsta(''); ir(i + 1, 1); };

  const concluir = async () => {
    if (!user) return;
    setSalvando(true);
    const { error } = await supabase.from('onboarding_respostas').upsert({
      user_id: user.id,
      profissao: profissaoFinal || null,
      tempo_area: tempo || null,
      objetivo: objetivo || null,
      expectativa: expectativa.trim() || null,
      idioma: lang,
      updated_at: new Date().toISOString(),
    }, { onConflict: 'user_id' });
    if (error) { setSalvando(false); toast.error(t('onboarding.falhaSalvar')); return; }
    concluindo.current = true;
    const { error: e2 } = await updateProfile({ onboarding_concluido_em: new Date().toISOString() });
    setSalvando(false);
    if (e2) { concluindo.current = false; toast.error(t('onboarding.falhaSalvar')); return; }
    setConfete(true);
    ir(passos.indexOf('fim'), 1);
  };

  const escolherChip = (set: (v: string) => void) => (v: string) => {
    set(v);
    if (v && v !== OUTRA) window.setTimeout(() => ir(i + 1, 1), 320);
  };

  const sair = async () => { await signOut(); navigate('/auth'); };

  if (profileLoading && !profile) {
    return (
      <div className="min-h-[100dvh] bg-[#FFF9EE] flex items-center justify-center">
        <Loader2 className="w-7 h-7 text-[#BE0D3E] animate-spin" />
      </div>
    );
  }

  /* ── validação do botão de baixo ── */
  const ok = (() => {
    switch (passo) {
      case 'nome': return nome.trim().length >= 2;
      case 'foto': return !!avatar && !enviandoFoto;
      case 'insta': return handle.length >= 2;
      case 'profissao': return !!profissao && (profissao !== OUTRA || profissaoOutra.trim().length >= 2);
      case 'tempo': return !!tempo;
      case 'objetivo': return !!objetivo;
      default: return true;
    }
  })();

  // Perguntas = tudo entre boas-vindas e fim (a barra só aparece nelas).
  const noMeio = passo !== 'boasVindas' && passo !== 'fim';
  const progresso = noMeio ? (i / (passos.length - 2)) * 100 : 0;

  const balao = (() => {
    if (passo === 'nome') return t('onboarding.balao.inicio');
    if (passo === 'foto') return t('onboarding.balao.foto');
    if (passo === 'insta') return t('onboarding.balao.insta');
    if (passo === 'expectativa') return t('onboarding.balao.ultima');
    if (passo === 'objetivo') return t('onboarding.balao.quase');
    return primeiroNome ? t('onboarding.balao.meio', { nome: primeiroNome }) : t('onboarding.balao.quase');
  })();

  const entrada = { initial: { x: direcao * 44, opacity: 0 }, animate: { x: 0, opacity: 1 }, transition: { duration: 0.3 } };

  return (
    <MotionConfig reducedMotion="user">
      <div className="min-h-[100dvh] bg-[#FFF9EE] relative overflow-x-hidden">
        {confete && <Confetti />}
        <FundoVivo />

        <div className="relative max-w-lg mx-auto px-4 pt-4 pb-40">
          {/* topo */}
          <div className="flex items-center gap-3 min-h-10">
            {noMeio ? (
              <button onClick={() => ir(i - 1, -1)} aria-label={t('onboarding.voltar')}
                className="glass-btn-pink shrink-0 w-10 h-10 rounded-full flex items-center justify-center text-white active:scale-95 transition-transform">
                <ArrowLeft size={17} strokeWidth={2.5} />
              </button>
            ) : null}
            <div className="flex-1 min-w-0">
              <p className="text-[9px] font-black uppercase tracking-widest text-[#BE0D3E]">{t('onboarding.topo')}</p>
              <p className="text-[11px] font-bold text-[#1E1B11] truncate">{noMeio ? t('onboarding.passo') : t('common.marca')}</p>
            </div>
            {passo !== 'fim' && (
              <button onClick={sair} className="text-[11px] font-bold text-[#5B4041]/60 flex items-center gap-1 px-2 py-1">
                <LogOut size={12} /> {t('onboarding.sair')}
              </button>
            )}
          </div>

          {/* barra de progresso (sem número) */}
          {noMeio && (
            <div className="flex items-center gap-2.5 mt-4">
              <div className="h-2 flex-1 rounded-full bg-[#F6D6DC]/70 overflow-hidden">
                <motion.div className="h-full rounded-full"
                  style={{ background: 'linear-gradient(90deg, #E63462, #BE0D3E 60%, #F6B43A)' }}
                  initial={false} animate={{ width: `${progresso}%` }} transition={{ duration: 0.5, ease: 'easeOut' }} />
              </div>
              <motion.span key={i} initial={{ scale: 0.5, rotate: -30 }} animate={{ scale: 1, rotate: 0 }}
                transition={{ type: 'spring', stiffness: 320, damping: 12 }}
                className="w-8 h-8 rounded-full flex items-center justify-center shrink-0"
                style={{ background: 'linear-gradient(135deg, #F6B43A, #E09A1F)', boxShadow: '0 6px 14px -6px rgba(246,180,58,0.9)' }}>
                <Sparkles size={14} className="text-[#1E1B11]" strokeWidth={2.5} />
              </motion.span>
            </div>
          )}

          {noMeio && <div className="mt-6"><Balao texto={balao} /></div>}

          {/* ── BOAS-VINDAS ── */}
          {passo === 'boasVindas' && (
            <motion.div key="bv" {...entrada} className="mt-8 text-center">
              <ArteBoasVindas />
              <motion.h1 initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.5 }}
                className="mt-8 text-[30px] font-black leading-[1.05] text-[#1E1B11]">
                {primeiroNome ? t('onboarding.boasVindas.titulo', { nome: primeiroNome }) : t('onboarding.boasVindas.tituloSemNome')}
              </motion.h1>
              <motion.p initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.7 }}
                className="mt-3 text-[14px] leading-relaxed text-[#5B4041]/80">
                {t('onboarding.boasVindas.texto')}
              </motion.p>
              <ul className="mt-6 space-y-2.5 text-left">
                {(t('onboarding.boasVindas.itens', { returnObjects: true }) as string[]).map((txt, k) => (
                  <motion.li key={txt} initial={{ opacity: 0, x: -14 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.85 + k * 0.12 }}
                    className="flex items-center gap-3 bg-white/75 border border-[#BE0D3E]/10 rounded-2xl px-4 py-3">
                    <span className="w-7 h-7 rounded-full flex items-center justify-center text-white shrink-0"
                      style={{ background: 'linear-gradient(135deg, #BE0D3E, #94002D)' }}>
                      {[<Camera key="c" size={14} strokeWidth={2.5} />, <Link2 key="l" size={14} strokeWidth={2.5} />, <Sparkles key="s" size={14} strokeWidth={2.5} />][k]}
                    </span>
                    <span className="text-[12.5px] font-bold text-[#1E1B11]">{txt}</span>
                  </motion.li>
                ))}
              </ul>
            </motion.div>
          )}

          {/* ── NOME (só se veio vazio do cadastro) ── */}
          {passo === 'nome' && (
            <motion.form key="nome" {...entrada} onSubmit={e => { e.preventDefault(); if (ok) void avancar(); }}>
              <Pergunta titulo={t('onboarding.nome.titulo')} sub={t('onboarding.nome.sub')}>
                <input value={nome} onChange={e => setNome(e.target.value)} placeholder={t('onboarding.nome.placeholder')}
                  autoFocus autoComplete="name" className={campoCls} />
              </Pergunta>
            </motion.form>
          )}

          {/* ── FOTO (obrigatória) ── */}
          {passo === 'foto' && (
            <motion.div key="foto" {...entrada} className="text-center">
              <h2 className="mt-7 text-[26px] font-black leading-tight text-[#1E1B11]">{t('onboarding.foto.titulo')}</h2>
              <p className="mt-2 text-[12.5px] text-[#5B4041]/75">{t('onboarding.foto.sub')}</p>

              <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={escolherFoto} />
              <button type="button" onClick={() => fileRef.current?.click()} disabled={enviandoFoto}
                className="mt-8 block mx-auto rounded-full active:scale-[0.97] transition-transform" aria-label={t('onboarding.foto.escolher')}>
                <AroFoto estado={enviandoFoto ? 'enviando' : avatar ? 'ok' : 'vazio'} key={avatar ?? 'vazio'}>
                  {avatar
                    ? <motion.img src={avatar} alt="" className="w-full h-full object-cover"
                        initial={fotoNova ? { scale: 1.3, opacity: 0 } : false} animate={{ scale: 1, opacity: 1 }} transition={{ duration: 0.5 }} />
                    : <SemFoto />}
                </AroFoto>
              </button>

              <div className="mt-6 min-h-[24px]">
                {enviandoFoto ? (
                  <p className="text-[12.5px] font-bold text-[#BE0D3E] flex items-center justify-center gap-1.5">
                    <Loader2 size={14} className="animate-spin" /> {t('onboarding.foto.enviando')}
                  </p>
                ) : avatar ? (
                  <motion.p initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.9 }}
                    className="text-[15px] font-black text-[#1E1B11]">{t('onboarding.foto.linda')}</motion.p>
                ) : null}
              </div>

              <button type="button" onClick={() => fileRef.current?.click()} disabled={enviandoFoto}
                className="mt-3 inline-flex items-center gap-2 rounded-full px-5 py-2.5 text-[13px] font-black bg-white border border-[#BE0D3E]/20 text-[#BE0D3E] active:scale-95 transition-transform disabled:opacity-50">
                <ImagePlus size={15} strokeWidth={2.5} /> {avatar ? t('onboarding.foto.trocar') : t('onboarding.foto.escolher')}
              </button>
            </motion.div>
          )}

          {/* ── INSTAGRAM ── */}
          {passo === 'insta' && (
            <motion.form key="insta" {...entrada} onSubmit={e => { e.preventDefault(); if (ok) void avancar(); }}>
              <div className="mt-8"><ArteInsta avatarUrl={avatar} ligado={handle.length >= 2} /></div>
              <h2 className="mt-7 text-[26px] font-black leading-tight text-[#1E1B11]">{t('onboarding.insta.titulo')}</h2>
              <p className="mt-2 text-[12.5px] text-[#5B4041]/75">{t('onboarding.insta.sub')}</p>
              <div className="relative mt-6">
                <span className="absolute left-4 top-1/2 -translate-y-1/2 text-[15px] font-bold text-[#BE0D3E]">@</span>
                <input value={insta} onChange={e => setInsta(e.target.value.replace(/^@+/, ''))} placeholder={t('onboarding.insta.placeholder')}
                  autoFocus={!insta} autoCapitalize="none" autoCorrect="off" spellCheck={false}
                  className={`${campoCls} pl-9`} />
              </div>
              <div className="mt-3 min-h-[22px] flex items-center justify-between gap-3">
                {handle.length >= 2 ? (
                  <motion.a initial={{ opacity: 0, x: -6 }} animate={{ opacity: 1, x: 0 }}
                    href={instagramUrl(handle) ?? '#'} target="_blank" rel="noopener noreferrer"
                    className="flex items-center gap-1.5 text-[12px] font-bold text-[#BE0D3E] truncate">
                    <Instagram size={13} strokeWidth={2.5} /> instagram.com/{handle}
                  </motion.a>
                ) : <span />}
                <button type="button" onClick={pularInsta} className="shrink-0 text-[11px] font-bold text-[#5B4041]/55 underline underline-offset-2">
                  {t('onboarding.insta.naoTenho')}
                </button>
              </div>
            </motion.form>
          )}

          {/* ── PROFISSÃO ── */}
          {passo === 'profissao' && (
            <motion.div key="prof" {...entrada}>
              <Pergunta arte={<ArteProfissao />} titulo={t('onboarding.profissao.titulo')} sub={t('onboarding.profissao.sub')}>
                <Chips opcoes={opcoesProfissao} valor={profissao} onChange={escolherChip(setProfissao)} />
                {profissao === OUTRA && (
                  <motion.input initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
                    value={profissaoOutra} onChange={e => setProfissaoOutra(e.target.value)} autoFocus
                    placeholder={t('onboarding.profissao.outraPlaceholder')} className={`${campoCls} mt-4`} />
                )}
              </Pergunta>
              {profissao !== OUTRA && <p className="mt-4 text-[11px] text-[#5B4041]/55">{t('onboarding.escolheu')}</p>}
            </motion.div>
          )}

          {/* ── TEMPO NA ÁREA ── */}
          {passo === 'tempo' && (
            <motion.div key="tempo" {...entrada}>
              <Pergunta arte={<ArteTempo />} titulo={t('onboarding.tempo.titulo')}>
                <Chips opcoes={opcoesTempo} valor={tempo} onChange={escolherChip(setTempo)} />
              </Pergunta>
              <p className="mt-4 text-[11px] text-[#5B4041]/55">{t('onboarding.escolheu')}</p>
            </motion.div>
          )}

          {/* ── OBJETIVO ── */}
          {passo === 'objetivo' && (
            <motion.div key="obj" {...entrada}>
              <Pergunta arte={<ArteObjetivo />} titulo={t('onboarding.objetivo.titulo')} sub={t('onboarding.objetivo.sub')}>
                <Chips opcoes={opcoesObjetivo} valor={objetivo} onChange={escolherChip(setObjetivo)} />
              </Pergunta>
            </motion.div>
          )}

          {/* ── EXPECTATIVA (opcional, texto ou áudio) ── */}
          {passo === 'expectativa' && (
            <motion.div key="exp" {...entrada}>
              <Pergunta arte={<ArteExpectativa />} titulo={t('onboarding.expectativa.titulo')} sub={t('onboarding.expectativa.sub')}>
                <VoiceField value={expectativa} onChange={setExpectativa} placeholder={t('onboarding.expectativa.placeholder')} rows={4} />
              </Pergunta>
            </motion.div>
          )}

          {/* ── FIM ── */}
          {passo === 'fim' && (
            <motion.div key="fim" initial={{ opacity: 0, scale: 0.96 }} animate={{ opacity: 1, scale: 1 }} transition={{ duration: 0.35 }} className="mt-8 text-center">
              <ArteConcluido />
              <div className="mt-6 inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-[10px] font-black uppercase tracking-widest text-[#BE0D3E]" style={{ background: 'rgba(190,13,62,0.08)' }}>
                <Sparkles size={12} /> {t('onboarding.fim.selo')}
              </div>
              <h1 className="mt-4 text-[28px] font-black leading-[1.05] text-[#1E1B11]">
                {t('onboarding.fim.titulo', { nome: primeiroNome })}
              </h1>
              <p className="mt-3 text-[14px] leading-relaxed text-[#5B4041]/80">{t('onboarding.fim.texto')}</p>

              {/* cartão do perfil */}
              <motion.div initial={{ y: 24, opacity: 0, rotate: -2 }} animate={{ y: 0, opacity: 1, rotate: 0 }}
                transition={{ delay: 0.5, type: 'spring', stiffness: 150, damping: 14 }}
                className="mt-7 rounded-3xl p-5 text-left relative overflow-hidden"
                style={{ background: 'linear-gradient(150deg, #94002D 0%, #BE0D3E 55%, #E06B85 100%)', boxShadow: '0 22px 44px -20px rgba(190,13,62,0.85)' }}>
                <div className="absolute -top-10 -right-10 w-36 h-36 rounded-full" style={{ background: 'radial-gradient(circle, rgba(246,180,58,0.55), transparent 70%)' }} />
                <p className="relative text-[9px] font-black uppercase tracking-[0.25em] text-[#F6B43A]">{t('onboarding.fim.cartao')}</p>
                <div className="relative mt-4 flex items-center gap-4">
                  <div className="p-[3px] rounded-full shrink-0" style={{ background: 'linear-gradient(135deg, #FFFFFF, #F6B43A)' }}>
                    {avatar
                      ? <img src={avatar} alt="" className="w-16 h-16 rounded-full object-cover" />
                      : <div className="w-16 h-16 rounded-full bg-[#F6D6DC]" />}
                  </div>
                  <div className="min-w-0">
                    <p className="text-[18px] font-black text-white leading-tight truncate">{nome || profile?.full_name}</p>
                    {handle && (
                      <a href={instagramUrl(handle) ?? '#'} target="_blank" rel="noopener noreferrer"
                        className="mt-0.5 flex items-center gap-1 text-[12px] font-bold text-white/85 truncate">
                        <Instagram size={12} strokeWidth={2.5} /> @{handle}
                      </a>
                    )}
                  </div>
                </div>
                <div className="relative mt-4 flex flex-wrap gap-2">
                  {[profissaoFinal, tempo, objetivo].filter(Boolean).map((tag, k) => (
                    <motion.span key={tag} initial={{ scale: 0 }} animate={{ scale: 1 }} transition={{ delay: 0.9 + k * 0.1, type: 'spring' }}
                      className="rounded-full px-3 py-1 text-[11px] font-bold bg-white/15 text-white border border-white/20">
                      {tag}
                    </motion.span>
                  ))}
                </div>
              </motion.div>
            </motion.div>
          )}
        </div>

        {/* ação fixa embaixo (não usa inset-0: o teclado do iPhone empurra normal) */}
        <div className="fixed bottom-0 inset-x-0 z-40 pointer-events-none">
          <div className="max-w-lg mx-auto px-4 pb-[max(16px,env(safe-area-inset-bottom))] pt-6 pointer-events-auto"
            style={{ background: 'linear-gradient(180deg, rgba(255,249,238,0) 0%, #FFF9EE 40%)' }}>
            {passo === 'boasVindas' ? (
              <button onClick={() => ir(1, 1)}
                className="glass-btn-pink w-full rounded-2xl py-4 text-[14px] font-black text-white flex items-center justify-center gap-2 active:scale-[0.98] transition-transform">
                {t('onboarding.boasVindas.cta')} <ArrowRight size={17} strokeWidth={2.5} />
              </button>
            ) : passo === 'fim' ? (
              <button onClick={() => navigate('/home', { replace: true })}
                className="card-glass-liquid-lime w-full rounded-2xl py-4 text-[14px] font-black text-[#1E1B11] flex items-center justify-center gap-2 active:scale-[0.98] transition-transform">
                {t('onboarding.fim.cta')} <ArrowRight size={17} strokeWidth={2.5} />
              </button>
            ) : passo === 'expectativa' ? (
              <button onClick={() => void avancar()} disabled={salvando}
                className="card-glass-liquid-lime w-full rounded-2xl py-4 text-[14px] font-black text-[#1E1B11] flex items-center justify-center gap-2 active:scale-[0.98] transition-transform disabled:opacity-45">
                {salvando ? <Loader2 size={17} className="animate-spin" /> : <Check size={17} strokeWidth={3} />}
                {t('onboarding.concluir')}
              </button>
            ) : (
              <button onClick={() => void avancar()} disabled={!ok}
                className="glass-btn-pink w-full rounded-2xl py-4 text-[14px] font-black text-white flex items-center justify-center gap-2 active:scale-[0.98] transition-transform disabled:opacity-45">
                {t('onboarding.continuar')} <ArrowRight size={17} strokeWidth={2.5} />
              </button>
            )}
            {passo === 'foto' && !avatar && !enviandoFoto && (
              <p className="text-center text-[10.5px] font-bold text-[#BE0D3E]/70 mt-2">{t('onboarding.foto.obrigatoria')}</p>
            )}
          </div>
        </div>
      </div>
    </MotionConfig>
  );
};

export default Onboarding;
