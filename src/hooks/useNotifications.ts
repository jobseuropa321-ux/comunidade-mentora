import { useCallback, useState } from 'react';

export interface NotificationItem {
  id: string;
  type: 'lesson_reply' | 'community_like' | 'community_comment';
  actor_name: string;
  actor_avatar: string | null;
  preview: string;
  created_at: string;
  is_read: boolean;
  post_id?: string;
  /** No mock, o destino da notificação já vem resolvido (sem consulta ao banco). */
  module_slug?: string;
  aula_index?: number;
}

// Alguns instantes relativos ao "agora" para o timeAgo do Header renderizar bonito.
const minutesAgo = (m: number) => new Date(Date.now() - m * 60_000).toISOString();

const SEED: NotificationItem[] = [
  {
    id: 'n1',
    type: 'lesson_reply',
    actor_name: 'Equipe Amentora',
    actor_avatar: null,
    preview: 'Ótima pergunta! O gancho ideal depende do seu nicho — te respondi com um exemplo prático.',
    created_at: minutesAgo(4),
    is_read: false,
    module_slug: 'fundamentos',
    aula_index: 1,
  },
  {
    id: 'n2',
    type: 'community_like',
    actor_name: 'Marina Alves',
    actor_avatar: null,
    preview: '',
    created_at: minutesAgo(52),
    is_read: false,
    post_id: 'p1',
  },
  {
    id: 'n3',
    type: 'community_comment',
    actor_name: 'Rafael Dias',
    actor_avatar: null,
    preview: 'Testei o roteiro de lista e bateu 40k de views! Obrigado pela dica 🔥',
    created_at: minutesAgo(3 * 60),
    is_read: true,
    post_id: 'p2',
  },
];

/*
  Mock local de notificações. Mesma interface consumida pelo Header
  (items / unreadCount / markAllRead / fetchItems).
*/
export function useNotifications() {
  const [items, setItems] = useState<NotificationItem[]>(SEED);

  const unreadCount = items.filter((i) => !i.is_read).length;

  const fetchItems = useCallback(() => {
    // No app real busca do banco; aqui os dados já estão em memória.
  }, []);

  const markAllRead = useCallback(() => {
    setItems((prev) => prev.map((i) => (i.is_read ? i : { ...i, is_read: true })));
  }, []);

  return { items, unreadCount, markAllRead, fetchItems };
}
