/**
 * A nota do diário: o que aprendi e como foi o dia.
 *
 * Uma por dia. É o dia que identifica a nota, não o id — o servidor junta duas
 * notas do mesmo dia em vez de criar a segunda.
 */
export interface Nota {
  id: number;
  // aaaa-mm-dd
  data: string;
  texto: string;
}
