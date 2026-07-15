import React, { useState, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { usePlan } from '@/contexts/PlanContext';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { useToast } from '@/hooks/use-toast';
import {
  LogOut, User, Mail, Edit2, Check, X, Camera, Loader2, Trash2, ImagePlus,
  Sparkles, Crown, ChevronRight, Shield, HelpCircle, Zap, ShieldCheck, Instagram,
} from 'lucide-react';
import { compressImage } from '@/lib/imageCompression';
import { normalizeInstagramHandle, instagramUrl } from '@/lib/instagram';
import { supabase } from '@/integrations/supabase/client';

/* ─────────────────────────────────────────────────────────────
 *  CONFIG — troque pelos dados do app
 * ───────────────────────────────────────────────────────────── */
const APP_VERSION = 'Amentora · v1.0';

/* Avatar real (Supabase Storage): a foto comprimida sobe pro bucket público
 * `avatars` no caminho `${user.id}/avatar.jpg` (a 1ª pasta = auth.uid(), que é
 * o que as policies de RLS validam — ver docs/backend/). A URL pública é
 * persistida em profiles.avatar_url via updateProfile. */
const AVATAR_PATH = (userId: string) => `${userId}/avatar.jpg`;

/* Avatar próprio (sem depender do sistema de "pet"):
 * mostra a imagem se existir, senão a inicial do nome num círculo vermelho. */
const Avatar: React.FC<{ url?: string | null; name?: string | null; size: number; className?: string }> = ({
  url, name, size, className = '',
}) => {
  if (url) {
    return <img src={url} alt="Avatar" className={`object-cover ${className}`} style={{ width: size, height: size }} />;
  }
  const initial = (name?.trim()?.[0] || 'U').toUpperCase();
  return (
    <div
      className={`flex items-center justify-center ${className}`}
      style={{ width: size, height: size, background: 'linear-gradient(135deg, #E06B85, #BE0D3E 60%, #94002D)' }}
    >
      <span className="font-black text-white leading-none" style={{ fontSize: size * 0.4 }}>{initial}</span>
    </div>
  );
};

const Profile: React.FC = () => {
  const { user, profile, isExpert, signOut, updateProfile } = useAuth();
  const { plan, hasFullAccess } = usePlan();
  const [isEditing, setIsEditing] = useState(false);
  const [fullName, setFullName] = useState(profile?.full_name || '');
  const [instagram, setInstagram] = useState(profile?.instagram || '');
  const [isSaving, setIsSaving] = useState(false);
  const [isUploadingAvatar, setIsUploadingAvatar] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const navigate = useNavigate();
  const { toast } = useToast();

  const handleLogout = async () => {
    await signOut();
    navigate('/auth');
  };

  const handleSave = async () => {
    setIsSaving(true);
    const cleanedInstagram = normalizeInstagramHandle(instagram);
    const { error } = await updateProfile({ full_name: fullName, instagram: cleanedInstagram || null });
    if (error) {
      toast({ title: 'Erro', description: 'Não foi possível atualizar o perfil', variant: 'destructive' });
    } else {
      toast({ title: 'Perfil atualizado!', description: 'Suas informações foram salvas' });
      setIsEditing(false);
    }
    setIsSaving(false);
  };

  // REAL: comprime e sobe a foto pro bucket `avatars` do Supabase Storage,
  // depois persiste a URL pública (com cache-buster) em profiles.avatar_url.
  const handleAvatarUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !user) return;
    if (file.size > 25 * 1024 * 1024) {
      toast({ title: 'Arquivo muito grande', description: 'Máximo 25MB', variant: 'destructive' });
      return;
    }
    setIsUploadingAvatar(true);
    try {
      // Avatar é exibido em ~112px max — 400px de largura é mais que suficiente
      // e converte HEIC/qualquer formato em JPEG automaticamente (canvas).
      const compressed = await compressImage(file, { maxWidth: 400, quality: 0.88 });

      // Sobe pro caminho `${user.id}/avatar.jpg` (upsert = sobrescreve a foto anterior).
      const path = AVATAR_PATH(user.id);
      const { error: uploadError } = await supabase.storage
        .from('avatars')
        .upload(path, compressed, { upsert: true, contentType: 'image/jpeg' });
      if (uploadError) throw uploadError;

      // URL pública + cache-buster pra forçar o <img> a recarregar após re-upload.
      const { data: { publicUrl } } = supabase.storage.from('avatars').getPublicUrl(path);
      const avatarUrl = `${publicUrl}?t=${Date.now()}`;

      const { error } = await updateProfile({ avatar_url: avatarUrl });
      if (error) throw error;
      toast({ title: 'Avatar atualizado!' });
    } catch (error) {
      console.error(error);
      toast({ title: 'Erro', description: 'Não foi possível atualizar o avatar', variant: 'destructive' });
    } finally {
      setIsUploadingAvatar(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const handleRemoveAvatar = async () => {
    if (!profile?.avatar_url || !user) return;
    setIsUploadingAvatar(true);
    try {
      // Apaga o arquivo do bucket (erros são ignorados — pode já não existir).
      await supabase.storage.from('avatars').remove([AVATAR_PATH(user.id)]);

      const { error } = await updateProfile({ avatar_url: null });
      if (error) throw error;
      toast({ title: 'Avatar removido' });
    } catch (error) {
      console.error(error);
      toast({ title: 'Erro', description: 'Não foi possível remover o avatar', variant: 'destructive' });
    } finally {
      setIsUploadingAvatar(false);
    }
  };

  const planLabel = plan === 'expert' ? 'Expert' : plan === 'app' ? 'App Completo' : 'Apenas Curso';
  const planColor = hasFullAccess ? '#F6B43A' : '#BE0D3E';

  return (
    <div className="pb-28">
      {/* ═══ HERO — vermelho com avatar ═══ */}
      <section className="relative pt-6 pb-20 px-4 overflow-hidden">
        {/* Fundo gradiente vermelho forte (segura a cor pra texto ficar legível) */}
        <div
          className="absolute inset-0 -z-10"
          style={{
            background: 'linear-gradient(160deg, #94002D 0%, #BE0D3E 45%, #BE0D3E 80%, #E06B85 100%)',
          }}
        />
        {/* Glow laranja no canto */}
        <div
          className="absolute top-0 right-0 w-48 h-48 -z-10 opacity-50"
          style={{
            background: 'radial-gradient(circle, #F6B43A 0%, transparent 70%)',
            filter: 'blur(30px)',
          }}
        />
        {/* Faíscas brancas */}
        <Sparkles size={14} className="absolute top-10 left-8 text-white/40 fill-white/40" />
        <Sparkles size={10} className="absolute top-24 right-12 text-white/50 fill-white/50" />

        <div className="max-w-lg mx-auto flex flex-col items-center text-center">
          {/* Avatar com aro laranja + branco */}
          <div className="relative mb-4">
            <div
              className="absolute inset-0 rounded-full -z-10"
              style={{
                background: 'conic-gradient(from 0deg, #F6B43A, #FFF7E6, #F6B43A, #FFFFFF, #F6B43A)',
                padding: '4px',
                filter: 'blur(2px)',
                transform: 'scale(1.1)',
                opacity: 0.5,
              }}
            />
            <div
              className="p-[3px] rounded-full"
              style={{ background: 'linear-gradient(135deg, #FFFFFF, #F6B43A 60%, #FFFFFF)' }}
            >
              <Avatar
                url={profile?.avatar_url}
                name={profile?.full_name}
                size={112}
                className="rounded-full"
              />
            </div>

            <input ref={fileInputRef} type="file" accept="image/*" className="hidden" onChange={handleAvatarUpload} />

            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button
                  disabled={isUploadingAvatar}
                  className="absolute -bottom-1 -right-1 w-10 h-10 rounded-full bg-[#F6B43A] text-[#1E1B11] flex items-center justify-center shadow-[0_8px_20px_rgba(246,180,58,0.55),inset_0_1px_2px_rgba(255,255,255,0.5)] border-2 border-white hover:scale-110 active:scale-95 transition-transform disabled:opacity-50"
                >
                  {isUploadingAvatar ? <Loader2 className="w-4 h-4 animate-spin" /> : <Camera className="w-4 h-4" strokeWidth={2.5} />}
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="center" className="bg-white border-[#BE0D3E]/20 text-[#1E1B11] shadow-[0_10px_30px_rgba(190,13,62,0.2)]">
                <DropdownMenuItem onClick={() => fileInputRef.current?.click()} className="gap-2 cursor-pointer hover:bg-[#FFF7E6] focus:bg-[#FFF7E6]">
                  <ImagePlus className="w-4 h-4 text-[#BE0D3E]" />
                  <span>Alterar foto</span>
                </DropdownMenuItem>
                {profile?.avatar_url && (
                  <DropdownMenuItem onClick={handleRemoveAvatar} className="gap-2 cursor-pointer text-[#BE0D3E] hover:bg-[#FFF7E6] focus:bg-[#FFF7E6]">
                    <Trash2 className="w-4 h-4" />
                    <span>Remover foto</span>
                  </DropdownMenuItem>
                )}
              </DropdownMenuContent>
            </DropdownMenu>
          </div>

          {/* Nome e email */}
          <h1
            className="text-[24px] font-black text-white leading-tight"
            style={{ textShadow: '0 2px 10px rgba(148,0,45,0.55), 0 1px 2px rgba(148,0,45,0.8)' }}
          >
            {profile?.full_name || 'Usuário'}
          </h1>
          <p
            className="text-[12px] text-white font-semibold mt-1"
            style={{ textShadow: '0 1px 6px rgba(148,0,45,0.6), 0 1px 2px rgba(148,0,45,0.5)' }}
          >
            {user?.email}
          </p>

          {/* Badge do plano */}
          <div className="mt-3 inline-flex items-center gap-1.5 bg-white/95 backdrop-blur px-3 py-1.5 rounded-full border border-white/60 shadow-[0_4px_12px_rgba(0,0,0,0.12)]">
            {hasFullAccess ? (
              <Crown size={12} className="text-[#BE0D3E] fill-[#BE0D3E]" />
            ) : (
              <Zap size={12} className="text-[#BE0D3E] fill-[#BE0D3E]" />
            )}
            <span className="text-[10px] font-black uppercase tracking-widest text-[#1E1B11]">
              Plano {planLabel}
            </span>
            <span
              className="w-1.5 h-1.5 rounded-full animate-pulse"
              style={{ background: planColor, boxShadow: `0 0 6px ${planColor}` }}
            />
          </div>
        </div>
      </section>

      {/* ═══ Conteúdo ═══ */}
      <div className="px-4 max-w-lg mx-auto -mt-12 space-y-4">

        {/* CARD — Informações da conta */}
        <section className="card-glass-liquid rounded-2xl p-5">
          <header className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <div className="w-7 h-7 rounded-lg bg-[#BE0D3E]/10 flex items-center justify-center">
                <User size={14} className="text-[#BE0D3E]" />
              </div>
              <h2 className="font-black text-[11px] text-[#1E1B11] uppercase tracking-widest">Conta</h2>
            </div>
            {!isEditing ? (
              <button
                onClick={() => { setFullName(profile?.full_name || ''); setInstagram(profile?.instagram || ''); setIsEditing(true); }}
                className="flex items-center gap-1 text-xs font-bold text-[#BE0D3E] hover:text-[#94002D] transition-colors px-2.5 py-1 rounded-lg hover:bg-[#BE0D3E]/8"
              >
                <Edit2 className="w-3 h-3" />
                Editar
              </button>
            ) : (
              <div className="flex gap-1">
                <button
                  onClick={() => setIsEditing(false)}
                  className="w-7 h-7 rounded-lg bg-[#F6D6DC] text-[#5B4041] hover:bg-[#ECA6BB] flex items-center justify-center transition-colors"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
                <button
                  onClick={handleSave}
                  disabled={isSaving}
                  className="w-7 h-7 rounded-lg bg-[#F6B43A] text-[#1E1B11] hover:scale-105 active:scale-95 disabled:opacity-50 flex items-center justify-center transition-transform shadow-[0_3px_10px_rgba(246,180,58,0.4)]"
                >
                  {isSaving ? <Loader2 className="w-3.5 h-3.5 animate-spin" strokeWidth={3} /> : <Check className="w-3.5 h-3.5" strokeWidth={3} />}
                </button>
              </div>
            )}
          </header>

          <div className="space-y-2">
            {/* Nome */}
            <div className="flex items-center gap-3 p-3 bg-[#FFF7E6] rounded-xl border border-[#BE0D3E]/8">
              <div className="w-8 h-8 rounded-lg bg-white flex items-center justify-center shrink-0 shadow-sm">
                <User className="w-3.5 h-3.5 text-[#BE0D3E]" strokeWidth={2.5} />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-[9px] font-black uppercase tracking-widest text-[#5B4041] mb-0.5">Nome</p>
                {isEditing ? (
                  <input
                    value={fullName}
                    onChange={(e) => setFullName(e.target.value)}
                    className="w-full bg-transparent text-sm font-bold text-[#1E1B11] placeholder:text-[#5B4041]/40 outline-none border-b border-[#BE0D3E]/30 focus:border-[#BE0D3E] pb-0.5"
                    placeholder="Seu nome"
                    autoFocus
                  />
                ) : (
                  <p className="text-sm font-bold text-[#1E1B11] truncate">{profile?.full_name || 'Não informado'}</p>
                )}
              </div>
            </div>

            {/* Email */}
            <div className="flex items-center gap-3 p-3 bg-[#FFF7E6] rounded-xl border border-[#BE0D3E]/8">
              <div className="w-8 h-8 rounded-lg bg-white flex items-center justify-center shrink-0 shadow-sm">
                <Mail className="w-3.5 h-3.5 text-[#BE0D3E]" strokeWidth={2.5} />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-[9px] font-black uppercase tracking-widest text-[#5B4041] mb-0.5">Email</p>
                <p className="text-sm font-bold text-[#1E1B11] truncate">{user?.email}</p>
              </div>
            </div>

            {/* Instagram */}
            <div className="flex items-center gap-3 p-3 bg-[#FFF7E6] rounded-xl border border-[#BE0D3E]/8">
              <div className="w-8 h-8 rounded-lg bg-white flex items-center justify-center shrink-0 shadow-sm">
                <Instagram className="w-3.5 h-3.5 text-[#BE0D3E]" strokeWidth={2.5} />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-[9px] font-black uppercase tracking-widest text-[#5B4041] mb-0.5">Instagram</p>
                {isEditing ? (
                  <div className="flex items-center gap-1">
                    <span className="text-sm font-bold text-[#5B4041]/60">@</span>
                    <input
                      value={instagram}
                      onChange={(e) => setInstagram(e.target.value)}
                      className="w-full bg-transparent text-sm font-bold text-[#1E1B11] placeholder:text-[#5B4041]/40 outline-none border-b border-[#BE0D3E]/30 focus:border-[#BE0D3E] pb-0.5"
                      placeholder="seu_usuario"
                      autoCapitalize="none"
                      autoCorrect="off"
                    />
                  </div>
                ) : profile?.instagram ? (
                  <a
                    href={instagramUrl(profile.instagram) || '#'}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-sm font-bold text-[#BE0D3E] hover:underline truncate block"
                  >
                    @{normalizeInstagramHandle(profile.instagram)}
                  </a>
                ) : (
                  <p className="text-sm font-bold text-[#1E1B11]/40 truncate">Adicione seu @</p>
                )}
              </div>
            </div>
          </div>
        </section>

        {/* CARD — Plano */}
        <section className={`${hasFullAccess ? 'card-glass-liquid-lime' : 'card-glass-liquid'} rounded-2xl p-5`}>
          <div className="flex items-start justify-between gap-3">
            <div className="flex-1">
              <div className="flex items-center gap-1.5 mb-1">
                <Crown size={14} className="text-[#1E1B11]" fill={hasFullAccess ? '#BE0D3E' : 'none'} />
                <span className="text-[9px] font-black uppercase tracking-widest text-[#1E1B11]">Seu plano</span>
              </div>
              <h3 className="text-[20px] font-black text-[#1E1B11] leading-tight">{planLabel}</h3>
              <p className="text-[11px] text-[#1E1B11]/70 font-medium mt-1 leading-snug">
                {hasFullAccess
                  ? 'Acesso completo a todas as ferramentas e conteúdos do app.'
                  : 'Você tem acesso apenas à área de cursos. Faça upgrade pra desbloquear tudo.'}
              </p>
            </div>
            {!hasFullAccess && (
              <button className="shrink-0 self-center px-4 py-2 bg-[#BE0D3E] text-white text-[10px] font-black uppercase tracking-widest rounded-xl shadow-[0_6px_18px_rgba(190,13,62,0.45)] hover:scale-105 active:scale-95 transition-transform">
                Upgrade
              </button>
            )}
          </div>
        </section>

        {/* CARD — Ações */}
        <section className="card-glass-liquid rounded-2xl overflow-hidden">
          {isExpert && (
            <>
              <ActionRow
                icon={<ShieldCheck className="w-4 h-4 text-[#BE0D3E]" strokeWidth={2.5} />}
                label="Admin"
                hint="Gerenciar cursos, lives, push, usuários"
                onClick={() => navigate('/admin')}
              />
              <div className="h-px bg-[#BE0D3E]/8 mx-4" />
            </>
          )}
          <ActionRow
            icon={<Shield className="w-4 h-4 text-[#BE0D3E]" strokeWidth={2.5} />}
            label="Privacidade"
            hint="Termos e política"
            onClick={() => toast({ title: 'Em breve', description: 'Estamos preparando essa seção' })}
          />
          <div className="h-px bg-[#BE0D3E]/8 mx-4" />
          <ActionRow
            icon={<HelpCircle className="w-4 h-4 text-[#BE0D3E]" strokeWidth={2.5} />}
            label="Suporte"
            hint="Tire suas dúvidas"
            onClick={() => toast({ title: 'Em breve', description: 'Canal de suporte em preparação' })}
          />
        </section>

        {/* Logout */}
        <button
          onClick={handleLogout}
          className="card-glass-liquid-danger w-full flex items-center justify-center gap-2 h-12 text-[#BE0D3E] font-black text-[11px] uppercase tracking-widest rounded-2xl hover:scale-[1.01] active:scale-[0.99] transition-transform"
        >
          <LogOut className="w-4 h-4" strokeWidth={2.5} />
          Sair da conta
        </button>

        {/* Versão */}
        <p className="text-center text-[10px] text-[#5B4041]/50 font-medium pt-2">
          {APP_VERSION}
        </p>
      </div>
    </div>
  );
};

/* ── ActionRow reutilizável ── */
interface ActionRowProps {
  icon: React.ReactNode;
  label: string;
  hint?: string;
  onClick: () => void;
}

const ActionRow: React.FC<ActionRowProps> = ({ icon, label, hint, onClick }) => (
  <button
    onClick={onClick}
    className="w-full flex items-center gap-3 px-4 py-3.5 hover:bg-[#FFF7E6] active:bg-[#F6D6DC] transition-colors"
    style={{ WebkitTapHighlightColor: 'transparent' }}
  >
    <div className="w-8 h-8 rounded-lg bg-[#BE0D3E]/10 flex items-center justify-center shrink-0">
      {icon}
    </div>
    <div className="flex-1 text-left">
      <p className="text-[13px] font-bold text-[#1E1B11] leading-tight">{label}</p>
      {hint && <p className="text-[10px] text-[#5B4041] font-medium">{hint}</p>}
    </div>
    <ChevronRight size={14} className="text-[#5B4041]/50" />
  </button>
);

export default Profile;
