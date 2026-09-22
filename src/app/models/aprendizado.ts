import { Nota } from './nota';
import { Tarefa } from './tarefa';

// uma linha da aba Aprendizados: vem do diário ou do "o que aprendi" de uma tarefa
export interface Aprendizado {
  chave: string;
  origem: 'diario' | 'tarefa';
  titulo: string;
  detalhe: string;
  texto: string;
  nota?: Nota;
  tarefa?: Tarefa;
}

export interface DiaDeAprendizado {
  // aaaa-mm-dd, ou '' para tarefa sem data
  data: string;
  rotulo: string;
  itens: Aprendizado[];
}
