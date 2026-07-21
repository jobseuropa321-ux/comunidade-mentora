import React, { useEffect, useMemo, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Loader2, ChevronRight, Folder, X, Search, Play, Home } from 'lucide-react';
import { Input } from '@/components/ui/input';

interface PandaFolder {
  id: string;
  name: string;
  parent_folder_id: string | null;
  videos_count: number;
}

interface PandaVideo {
  id: string;
  title: string;
  length: number | null;
  status: string;
  playable: boolean;
  thumbnail: string | null;
  video_player: string;
}

interface Props {
  open: boolean;
  onClose: () => void;
  onPick: (videoUrl: string, video: PandaVideo) => void;
}

const formatDuration = (sec: number | null): string => {
  if (!sec) return '—';
  const m = Math.floor(sec / 60);
  const s = Math.floor(sec % 60);
  return `${m}:${String(s).padStart(2, '0')}`;
};

const PandaVideoPicker: React.FC<Props> = ({ open, onClose, onPick }) => {
  const [allFolders, setAllFolders] = useState<PandaFolder[]>([]);
  const [breadcrumb, setBreadcrumb] = useState<PandaFolder[]>([]); // [] = root
  const [videos, setVideos] = useState<PandaVideo[]>([]);
  const [loadingFolders, setLoadingFolders] = useState(false);
  const [loadingVideos, setLoadingVideos] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState('');

  // Reset ao abrir
  useEffect(() => {
    if (open) {
      setBreadcrumb([]);
      setVideos([]);
      setSearch('');
      loadFolders();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  const loadFolders = async () => {
    setLoadingFolders(true);
    setError(null);
    try {
      const { data, error } = await supabase.functions.invoke('panda-list', { body: {} });
      if (error) throw error;
      setAllFolders(data.folders || []);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Falha ao carregar pastas');
    } finally {
      setLoadingFolders(false);
    }
  };

  // Quando entra numa pasta, busca os vídeos dela
  useEffect(() => {
    if (!open || breadcrumb.length === 0) {
      setVideos([]);
      return;
    }
    const current = breadcrumb[breadcrumb.length - 1];
    let cancelled = false;
    (async () => {
      setLoadingVideos(true);
      setError(null);
      setVideos([]);
      try {
        const { data, error } = await supabase.functions.invoke('panda-list', {
          body: { folder_id: current.id, limit: 100 },
        });
        if (cancelled) return;
        if (error) throw error;
        setVideos(data.videos || []);
      } catch (e) {
        if (!cancelled) setError(e instanceof Error ? e.message : 'Falha ao carregar vídeos');
      } finally {
        if (!cancelled) setLoadingVideos(false);
      }
    })();
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [breadcrumb, open]);

  // Set de ids pra detectar root (pastas cujo parent não existe no nosso conjunto)
  const folderIds = useMemo(() => new Set(allFolders.map(f => f.id)), [allFolders]);

  const childrenOf = (parentId: string | null): PandaFolder[] => {
    if (parentId === null) {
      // root: pastas sem parent OU com parent que não está na nossa lista
      return allFolders
        .filter(f => !f.parent_folder_id || !folderIds.has(f.parent_folder_id))
        .sort((a, b) => a.name.localeCompare(b.name));
    }
    return allFolders
      .filter(f => f.parent_folder_id === parentId)
      .sort((a, b) => a.name.localeCompare(b.name));
  };

  const currentParentId = breadcrumb.length > 0 ? breadcrumb[breadcrumb.length - 1].id : null;
  const subfolders = childrenOf(currentParentId);

  if (!open) return null;

  const filteredVideos = search
    ? videos.filter(v => v.title.toLowerCase().includes(search.toLowerCase()))
    : videos;

  const filteredSubfolders = search
    ? subfolders.filter(f => f.name.toLowerCase().includes(search.toLowerCase()))
    : subfolders;

  const goToBreadcrumb = (index: number) => {
    // index = -1 → root
    if (index < 0) setBreadcrumb([]);
    else setBreadcrumb(prev => prev.slice(0, index + 1));
    setSearch('');
  };

  const enterFolder = (folder: PandaFolder) => {
    setBreadcrumb(prev => [...prev, folder]);
    setSearch('');
  };

  return (
    <div className="fixed inset-0 z-[60] bg-black/50 backdrop-blur-sm flex items-center justify-center p-4" onClick={onClose}>
      <div
        className="bg-white rounded-2xl w-full max-w-2xl max-h-[85vh] flex flex-col overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header com breadcrumb */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-[#FF2D7A]/15 gap-2">
          <div className="flex items-center gap-1 min-w-0 flex-1 flex-wrap">
            <button onClick={() => goToBreadcrumb(-1)}
              className="flex items-center gap-1 text-[10px] font-black uppercase tracking-widest text-[#FF2D7A] hover:underline">
              <Home size={11} /> Raiz
            </button>
            {breadcrumb.map((f, i) => (
              <React.Fragment key={f.id}>
                <ChevronRight size={11} className="text-[#6E6E6E] shrink-0" />
                <button onClick={() => goToBreadcrumb(i)}
                  className={`text-[11px] font-bold truncate ${i === breadcrumb.length - 1 ? 'text-[#1A1A1A]' : 'text-[#6E6E6E] hover:text-[#FF2D7A]'}`}>
                  {f.name}
                </button>
              </React.Fragment>
            ))}
          </div>
          <button onClick={onClose}
            className="w-7 h-7 rounded-lg bg-[#FFE8D0] text-[#6E6E6E] hover:bg-[#FFD9B3] flex items-center justify-center shrink-0">
            <X size={13} />
          </button>
        </div>

        {/* Busca (sempre visível pra filtrar pastas e vídeos) */}
        <div className="px-4 py-2 border-b border-[#FF2D7A]/8">
          <div className="relative">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-[#6E6E6E]" />
            <Input
              placeholder={breadcrumb.length === 0 ? 'Buscar pasta...' : 'Buscar nesta pasta (subpastas e vídeos)...'}
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-8 h-9 bg-[#FFF4E6] border-[#FF2D7A]/15 text-[12px]"
            />
          </div>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto p-3">
          {error ? (
            <div className="text-center py-8">
              <p className="text-[12px] text-red-500 font-bold">{error}</p>
            </div>
          ) : (
            <div className="space-y-3">
              {/* Subpastas */}
              {(loadingFolders && allFolders.length === 0) ? (
                <div className="flex justify-center py-12">
                  <Loader2 className="w-6 h-6 text-[#FF2D7A] animate-spin" />
                </div>
              ) : filteredSubfolders.length > 0 && (
                <div>
                  {breadcrumb.length > 0 && (
                    <p className="text-[9px] font-black uppercase tracking-widest text-[#6E6E6E] mb-2">Subpastas</p>
                  )}
                  <div className="grid grid-cols-2 gap-2">
                    {filteredSubfolders.map(f => {
                      const subCount = allFolders.filter(x => x.parent_folder_id === f.id).length;
                      const totalLabel = f.videos_count > 0
                        ? `${f.videos_count} vídeo${f.videos_count !== 1 ? 's' : ''}`
                        : subCount > 0
                          ? `${subCount} subpasta${subCount !== 1 ? 's' : ''}`
                          : 'vazia';
                      const isUsable = f.videos_count > 0 || subCount > 0;
                      return (
                        <button key={f.id} onClick={() => enterFolder(f)}
                          className={`flex items-center gap-2 p-3 rounded-xl border text-left transition-all ${
                            isUsable
                              ? 'bg-white border-[#FF2D7A]/15 hover:border-[#FF2D7A]/40 hover:bg-[#FFF4E6]'
                              : 'bg-gray-50 border-gray-200 opacity-50'
                          }`}>
                          <div className="w-8 h-8 rounded-lg bg-[#FF2D7A]/10 flex items-center justify-center shrink-0">
                            <Folder size={14} className="text-[#FF2D7A]" />
                          </div>
                          <div className="min-w-0 flex-1">
                            <p className="text-[11px] font-bold text-[#1A1A1A] truncate">{f.name}</p>
                            <p className="text-[9px] text-[#6E6E6E]">{totalLabel}</p>
                          </div>
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Vídeos da pasta atual */}
              {breadcrumb.length > 0 && (
                loadingVideos ? (
                  <div className="flex justify-center py-6">
                    <Loader2 className="w-5 h-5 text-[#FF2D7A] animate-spin" />
                  </div>
                ) : filteredVideos.length > 0 ? (
                  <div>
                    <p className="text-[9px] font-black uppercase tracking-widest text-[#6E6E6E] mb-2">
                      Vídeos ({filteredVideos.length})
                    </p>
                    <div className="grid grid-cols-2 gap-2">
                      {filteredVideos.map(v => (
                        <button key={v.id} onClick={() => onPick(v.video_player, v)}
                          className="bg-white border border-[#FF2D7A]/15 rounded-xl overflow-hidden hover:border-[#FF2D7A]/40 hover:scale-[1.02] active:scale-[0.98] transition-all text-left">
                          <div className="aspect-video bg-[#1A1A1A] relative overflow-hidden">
                            {v.thumbnail ? (
                              <img src={v.thumbnail} alt={v.title} className="w-full h-full object-cover" loading="lazy" />
                            ) : (
                              <div className="w-full h-full flex items-center justify-center">
                                <Play size={24} className="text-white/40" />
                              </div>
                            )}
                            <div className="absolute bottom-1 right-1 bg-black/70 text-white text-[9px] font-bold px-1.5 py-0.5 rounded">
                              {formatDuration(v.length)}
                            </div>
                            {!v.playable && (
                              <div className="absolute inset-0 bg-black/50 flex items-center justify-center">
                                <span className="text-white text-[9px] font-black uppercase tracking-widest">Processando</span>
                              </div>
                            )}
                          </div>
                          <div className="p-2">
                            <p className="text-[10px] font-bold text-[#1A1A1A] line-clamp-2 leading-tight">{v.title}</p>
                          </div>
                        </button>
                      ))}
                    </div>
                  </div>
                ) : !loadingVideos && filteredSubfolders.length === 0 ? (
                  <div className="text-center py-8">
                    <p className="text-[12px] text-[#6E6E6E] font-bold">
                      {search ? 'Nada bate com a busca' : 'Pasta vazia'}
                    </p>
                  </div>
                ) : null
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default PandaVideoPicker;
