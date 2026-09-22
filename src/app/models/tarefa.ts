export type Etapa = 'A fazer' | 'Fazendo' | 'Travado' | 'Feito';

// da mais neutra à de concluído, na ordem das colunas do quadro
export const ETAPAS: Etapa[] = ['A fazer', 'Fazendo', 'Travado', 'Feito'];

// a tarefa entrou nesta etapa neste dia (aaaa-mm-dd)
export interface MudancaEtapa {
  etapa: Etapa;
  data: string;
}

export interface Tarefa {
  id: number;
  // o nome livre da tarefa ("Estudar RxJS"): área, tipo e objetivo dizem de
  // que tipo ela é, mas nenhum deles serve de título na etiqueta
  titulo: string;
  area: string;
  tipo: string;
  objetivo: string;
  // guardadas no formato do input date (aaaa-mm-dd)
  dataInicio: string;
  dataFim: string;
  // dias de dentro do intervalo em que a tarefa não aconteceu, no mesmo
  // formato: o estudo de segunda a sexta que pulou a quarta continua sendo
  // uma tarefa só, com um buraco
  diasPulados: string[];
  descricao: string;
  // "o que aprendi": aparece junto do diário na aba Aprendizados
  aprendizado: string;
  etapa: Etapa;
  // cada mudança de etapa, em ordem, com o dia local em que aconteceu: é o
  // que diz em que dias a tarefa esteve em "Fazendo". Quem grava é o service
  historicoEtapas: MudancaEtapa[];
}

// "A fazer" tem espaço, então a classe CSS não sai direto do nome da etapa
export function classeEtapa(etapa: Etapa): string {
  return etapa.toLowerCase().replace(/\s+/g, '-');
}

// id 0 = ainda não salva; o service troca por um negativo ao salvar
export function tarefaVazia(dia: string, objetivo = ''): Tarefa {
  return {
    id: 0,
    titulo: '',
    area: '',
    tipo: '',
    objetivo,
    dataInicio: dia,
    dataFim: dia,
    diasPulados: [],
    descricao: '',
    aprendizado: '',
    etapa: 'A fazer',
    historicoEtapas: [],
  };
}
