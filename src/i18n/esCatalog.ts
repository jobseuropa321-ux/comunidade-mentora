/* GERADO por scripts/gen-es-catalog.mjs — não edite à mão.
 * Rode `npm run es:catalog` depois de mexer em public/covers/modulos/es/.
 *
 * Catálogo do espanhol: a versão ES mostra SÓ estes módulos. A regra é ter
 * capa em espanhol — módulo sem capa própria não entra, em vez de entrar com
 * a capa em português.
 *
 * Módulos criados pelo painel (que guardam URL do Supabase Storage) não
 * aparecem aqui: para eles vale a coluna cover_url_es, conferida em runtime.
 */
export const ES_MODULE_SLUGS: readonly string[] = [
  '15-estrategias-de-atracao',
  'a-arte-de-focar-em-voce',
  'boas-vindas-a-comunidade',
  'brand-e-estruturacao-de-perfil',
  'comece-por-aqui',
  'como-editar-fotos-com-ia',
  'como-fazer-fotos-com-ia',
  'crie-seu-curso-em-minutos',
  'do-zero-aos-10k-em-30-dias',
  'fotos-que-vendem',
  'mentalidade-e-ressignificacao',
  'trafego-pago',
];

const ES_SET = new Set(ES_MODULE_SLUGS);

/** O módulo entra na versão espanhola? Vale para os dois caminhos de capa:
 *  o arquivo no repositório (lista acima) e o upload do painel (cover_url_es). */
export const isInEsCatalog = (m: { slug: string; cover_url_es?: string | null }): boolean =>
  ES_SET.has(m.slug) || !!m.cover_url_es;
