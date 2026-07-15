// Cronograma de "Próximas aulas" ao vivo (dados locais, sem backend).
// A UI filtra automaticamente as aulas já passadas, então não precisa remover
// itens antigos manualmente — basta adicionar novos no fim quando renovar o ciclo.
// Datas em ISO (YYYY-MM-DD).
//
// ⚠️ SUBSTITUA os itens abaixo pela agenda real (nomes/datas/horários).

export interface ScheduledLive {
  /** Data da aula em ISO (YYYY-MM-DD) */
  date: string;
  /** Horário exibido (já formatado), ex.: "19h" */
  time: string;
  /** Responsável / mentor(a) da aula */
  presenter: string;
}

export const LIVE_SCHEDULE: ScheduledLive[] = [
  { date: '2026-07-14', time: '19h', presenter: 'Equipe Amentora' },
  { date: '2026-07-16', time: '19h', presenter: 'Equipe Amentora' },
  { date: '2026-07-21', time: '19h', presenter: 'Equipe Amentora' },
  { date: '2026-07-23', time: '19h', presenter: 'Equipe Amentora' },
  // ...adicione o resto da agenda aqui
];

/** Retorna as próximas aulas a partir de hoje (inclui a de hoje), em ordem. */
export const getUpcomingLives = (limit?: number): ScheduledLive[] => {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const upcoming = LIVE_SCHEDULE.filter((l) => {
    const d = new Date(l.date + 'T00:00:00');
    return d.getTime() >= today.getTime();
  });
  return typeof limit === 'number' ? upcoming.slice(0, limit) : upcoming;
};
