// Cronograma de "Próximas aulas" ao vivo (dados locais, sem backend).
// A UI filtra automaticamente as aulas já passadas, então não precisa remover
// itens antigos manualmente — basta adicionar novos no fim quando renovar o ciclo.
// Datas em ISO (YYYY-MM-DD).
//

export interface ScheduledLive {
  /** Data da aula em ISO (YYYY-MM-DD) */
  date: string;
  /** Horário exibido (já formatado), ex.: "19h" */
  time: string;
  /** Responsável / mentor(a) da aula (opcional — sem isso o card não mostra a linha "com ...") */
  presenter?: string;
}

export const LIVE_SCHEDULE: ScheduledLive[] = [
  // Ciclo ago–out/2026: toda segunda-feira às 19h.
  { date: '2026-08-24', time: '19h' },
  { date: '2026-08-31', time: '19h' },
  { date: '2026-09-07', time: '19h' },
  { date: '2026-09-14', time: '19h' },
  { date: '2026-09-21', time: '19h' },
  { date: '2026-09-28', time: '19h' },
  { date: '2026-10-05', time: '19h' },
  { date: '2026-10-12', time: '19h' },
  { date: '2026-10-19', time: '19h' },
  { date: '2026-10-26', time: '19h' },
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
