import { Tarefa } from '../models/tarefa';
import { Nota } from '../models/nota';

/**
 * O filtro da pesquisa da agenda: deixa na tela só o que é relevante para o
 * que foi digitado.
 *
 * Não é um "contém o texto": cada palavra pesquisada é comparada com cada
 * palavra dos campos, sem acento e sem maiúscula, e bate se chega perto o
 * bastante — igual, começo de palavra, pedaço, ou com um erro de digitação
 * ("angluar" acha "Angular"). Toda palavra pesquisada tem que bater em algum
 * campo; uma que não bate em nada tira o item.
 *
 * Roda no cliente, sobre o cache: funciona sem rede, como o resto da agenda.
 */

// palavras que aparecem em quase todo texto e não dizem nada sobre ele
const VAZIAS = new Set([
  'a', 'o', 'as', 'os', 'e', 'de', 'da', 'do', 'das', 'dos', 'em', 'no', 'na',
  'nos', 'nas', 'um', 'uma', 'para', 'pra', 'com', 'por', 'que', 'se', 'ao',
]);

// abaixo disto a palavra não bateu: pedaço curto demais ou erro demais
const MINIMO_POR_PALAVRA = 0.5;

export function normalizar(texto: string): string {
  return (texto ?? '')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase();
}

export function palavras(texto: string): string[] {
  return normalizar(texto).split(/[^a-z0-9]+/).filter(Boolean);
}

/** Distância de edição com troca de letras vizinhas ("agnular" -> 1). */
export function distancia(a: string, b: string): number {
  const d: number[][] = Array.from({ length: a.length + 1 }, (_, i) => [i]);
  for (let j = 1; j <= b.length; j++) {
    d[0][j] = j;
  }

  for (let i = 1; i <= a.length; i++) {
    for (let j = 1; j <= b.length; j++) {
      const custo = a[i - 1] === b[j - 1] ? 0 : 1;
      d[i][j] = Math.min(d[i - 1][j] + 1, d[i][j - 1] + 1, d[i - 1][j - 1] + custo);
      if (i > 1 && j > 1 && a[i - 1] === b[j - 2] && a[i - 2] === b[j - 1]) {
        d[i][j] = Math.min(d[i][j], d[i - 2][j - 2] + 1);
      }
    }
  }

  return d[a.length][b.length];
}

/** Quanto uma palavra pesquisada bate numa palavra do texto, de 0 a 1. */
export function semelhanca(busca: string, palavra: string): number {
  if (palavra === busca) {
    return 1;
  }
  if (busca.length >= 2 && palavra.startsWith(busca)) {
    return 0.85;
  }
  if (busca.length >= 3 && palavra.includes(busca)) {
    return 0.6;
  }

  // erro de digitação: palavra curta não aceita erro nenhum, senão "rua"
  // acharia "sua"; até 6 letras aceita um, acima disso dois
  const tolerancia = busca.length <= 3 ? 0 : busca.length <= 6 ? 1 : 2;
  if (!tolerancia) {
    return 0;
  }

  const inteira = distancia(busca, palavra);
  if (inteira <= tolerancia) {
    return 0.75 - 0.1 * inteira;
  }

  // começo de palavra digitado com um erro ("anglar" para "angular..."): só
  // a partir de 5 letras, senão qualquer pedaço curto casaria com tudo
  if (busca.length >= 5 && distancia(busca, palavra.slice(0, busca.length)) <= 1) {
    return 0.55;
  }
  return 0;
}

/** As palavras que contam na consulta. "de" sozinho ainda é uma busca. */
export function termosDa(consulta: string): string[] {
  const todas = palavras(consulta);
  const uteis = todas.filter((palavra) => !VAZIAS.has(palavra));

  return uteis.length ? uteis : todas;
}

/** Toda palavra da consulta bate em alguma palavra de algum dos textos. */
export function combina(termos: string[], textos: string[]): boolean {
  const doItem = textos.flatMap(palavras);

  return termos.every((termo) =>
    doItem.some((palavra) => semelhanca(termo, palavra) >= MINIMO_POR_PALAVRA),
  );
}

/**
 * Só as tarefas e notas relevantes para a consulta, na ordem em que vieram.
 * Consulta vazia não filtra nada.
 */
export function filtrarPorBusca(
  consulta: string,
  tarefas: Tarefa[],
  notas: Nota[],
): { tarefas: Tarefa[]; notas: Nota[] } {
  const termos = termosDa(consulta);
  if (!termos.length) {
    return { tarefas, notas };
  }

  return {
    tarefas: tarefas.filter((tarefa) =>
      combina(termos, [
        tarefa.titulo,
        tarefa.objetivo,
        tarefa.area,
        tarefa.tipo,
        tarefa.descricao,
        tarefa.aprendizado,
      ]),
    ),
    notas: notas.filter((nota) => combina(termos, [nota.texto])),
  };
}
