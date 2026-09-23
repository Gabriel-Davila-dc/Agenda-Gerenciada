export type VisaoAgenda = 'calendario' | 'quadro' | 'aprendizados';

/**
 * A visão da agenda vem do `?visao=` da URL: as abas ficam no Header e a
 * agenda só lê. Sem parâmetro, ou com um valor que não existe, é o calendário.
 */
export function visaoDaUrl(valor: string | null): VisaoAgenda {
  return valor === 'quadro' || valor === 'aprendizados' ? valor : 'calendario';
}
