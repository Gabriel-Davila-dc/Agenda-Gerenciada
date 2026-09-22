import { Tarefa } from '../models/tarefa';

/**
 * Datas trafegam e ficam guardadas como texto "aaaa-mm-dd", e só viram Date
 * em UTC, e só na hora de fazer conta.
 *
 * new Date('2026-09-10') é lido como meia-noite em UTC e, no Brasil (UTC-3),
 * exibido como o dia 9. Fazendo toda a aritmética em UTC, o dia não escorrega.
 */

export const MESES = [
  'Janeiro',
  'Fevereiro',
  'Março',
  'Abril',
  'Maio',
  'Junho',
  'Julho',
  'Agosto',
  'Setembro',
  'Outubro',
  'Novembro',
  'Dezembro',
];

// getUTCDay: 0 é domingo
const DIAS_DA_SEMANA = ['domingo', 'segunda', 'terça', 'quarta', 'quinta', 'sexta', 'sábado'];

// o suficiente de uma tarefa para saber em que dias ela acontece
type Intervalo = Pick<Tarefa, 'dataInicio' | 'dataFim' | 'diasPulados'>;

export function isoParaData(iso: string): Date {
  const [ano, mes, dia] = iso.split('-').map(Number);
  return new Date(Date.UTC(ano, mes - 1, dia));
}

export function dataParaIso(data: Date): string {
  return data.toISOString().slice(0, 10);
}

export function somarDias(data: Date, dias: number): Date {
  const nova = new Date(data.getTime());
  nova.setUTCDate(nova.getUTCDate() + dias);
  return nova;
}

// segunda-feira da semana daquela data
export function segundaDa(data: Date): Date {
  return somarDias(data, -((data.getUTCDay() + 6) % 7));
}

// hoje pela data LOCAL do aparelho, montada à mão: toISOString() usa UTC e,
// depois das 21h no Brasil, já devolveria o dia seguinte
export function hojeISO(): string {
  const hoje = new Date();
  const mes = String(hoje.getMonth() + 1).padStart(2, '0');
  const dia = String(hoje.getDate()).padStart(2, '0');

  return `${hoje.getFullYear()}-${mes}-${dia}`;
}

// "aaaa-mm-dd" para "dd/mm/aaaa" quebrando o texto, sem passar por Date
export function isoParaBR(iso: string): string {
  if (!iso) {
    return '';
  }

  const [ano, mes, dia] = iso.split('-');
  return `${dia}/${mes}/${ano}`;
}

// "dd/mm", para o botão "Tirar só do dia"
export function diaMes(iso: string): string {
  const [, mes, dia] = iso.split('-');
  return `${dia}/${mes}`;
}

export function rotuloDoMes(data: Date): string {
  return `${MESES[data.getUTCMonth()]} de ${data.getUTCFullYear()}`;
}

/**
 * "8 a 14 de setembro". Quando a semana cruza a virada do mês entram os dois
 * ("29 de setembro a 5 de outubro"): sem isso o cabeçalho estaria errado para
 * metade dos dias listados embaixo dele.
 */
export function rotuloDaSemana(segunda: Date, domingo: Date): string {
  const mesInicio = MESES[segunda.getUTCMonth()].toLowerCase();
  const mesFim = MESES[domingo.getUTCMonth()].toLowerCase();

  if (mesInicio === mesFim) {
    return `${segunda.getUTCDate()} a ${domingo.getUTCDate()} de ${mesFim}`;
  }

  return `${segunda.getUTCDate()} de ${mesInicio} a ${domingo.getUTCDate()} de ${mesFim}`;
}

// "sexta, 11 de setembro de 2026"
export function rotuloDoDia(iso: string): string {
  const data = isoParaData(iso);
  const mes = MESES[data.getUTCMonth()].toLowerCase();

  return `${DIAS_DA_SEMANA[data.getUTCDay()]}, ${data.getUTCDate()} de ${mes} de ${data.getUTCFullYear()}`;
}

// ocupa todos os dias entre início e fim, menos os tirados à mão; sem fim, só o início
export function aconteceEm(tarefa: Intervalo, iso: string): boolean {
  if (!tarefa.dataInicio) {
    return false;
  }

  if (tarefa.diasPulados?.includes(iso)) {
    return false;
  }

  const fim = tarefa.dataFim || tarefa.dataInicio;

  // datas em aaaa-mm-dd comparam certo como texto
  return iso >= tarefa.dataInicio && iso <= fim;
}

/**
 * A tarefa esteve em `etapa` em algum momento do dia `iso`?
 *
 * Cada entrada do histórico vale do dia em que a tarefa entrou na etapa até o
 * dia em que saiu, com os dois dias contando: foi para Fazendo na terça e para
 * Feito na quinta, esteve em Fazendo na terça, na quarta e na quinta, porque
 * terminou fazendo. A última entrada vale até hoje, e nunca adiante: ninguém
 * sabe ainda o que vai estar fazendo amanhã.
 *
 * As datas planejadas não entram na conta. É o que de fato aconteceu.
 */
export function esteveNaEtapa(
  tarefa: Pick<Tarefa, 'historicoEtapas'>,
  etapa: Tarefa['etapa'],
  iso: string,
  hoje: string,
): boolean {
  const historico = tarefa.historicoEtapas ?? [];

  if (iso > hoje) {
    return false;
  }

  return historico.some((mudanca, indice) => {
    const saida = historico[indice + 1]?.data ?? hoje;
    return mudanca.etapa === etapa && iso >= mudanca.data && iso <= saida;
  });
}

// os dias em que a tarefa acontece de fato, em ordem
export function diasDaTarefa(tarefa: Intervalo): string[] {
  if (!tarefa.dataInicio) {
    return [];
  }

  const fim = tarefa.dataFim || tarefa.dataInicio;
  const dias: string[] = [];

  let data = isoParaData(tarefa.dataInicio);

  for (let iso = dataParaIso(data); iso <= fim; iso = dataParaIso(data)) {
    if (aconteceEm(tarefa, iso)) {
      dias.push(iso);
    }

    data = somarDias(data, 1);
  }

  return dias;
}
