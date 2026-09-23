import { Tarefa, tarefaVazia } from '../models/tarefa';
import { Nota } from '../models/nota';
import { distancia, filtrarPorBusca, semelhanca } from './busca';

const tarefa = (id: number, campos: Partial<Tarefa>): Tarefa => ({
  ...tarefaVazia('2026-09-10'),
  id,
  ...campos,
});

const ANGULAR = tarefa(1, { titulo: 'Estudar signals do Angular', objetivo: 'Dominar Angular' });
const BUG = tarefa(2, {
  titulo: 'Corrigir bug do login',
  descricao: 'O token vencido não mandava para a tela de login',
});
const DOCKER = tarefa(3, {
  titulo: 'Subir MySQL',
  area: 'Infra',
  aprendizado: 'O Docker Compose precisa do volume nomeado para não perder dados',
});
const CORRIDA = tarefa(4, { titulo: 'Correr 3 km', area: 'Saúde' });

const NOTA: Nota = { id: 9, data: '2026-09-12', texto: 'Hoje entendi a fila de sincronização offline.' };

const TAREFAS = [ANGULAR, BUG, DOCKER, CORRIDA];

// o que sobra na tela: ids das tarefas e "nota 9" para o diário
const sobra = (consulta: string) => {
  const { tarefas, notas } = filtrarPorBusca(consulta, TAREFAS, [NOTA]);
  return [...tarefas.map((t) => t.id), ...notas.map((n) => `nota ${n.id}`)];
};

describe('busca', () => {
  describe('semelhança de palavras', () => {
    it('igual vale mais que começo, que vale mais que pedaço', () => {
      expect(semelhanca('login', 'login')).toBe(1);
      expect(semelhanca('log', 'login')).toBeGreaterThan(semelhanca('ogi', 'login'));
      expect(semelhanca('ogi', 'login')).toBeGreaterThan(0);
    });

    it('aceita erro de digitação em palavra comprida, não em palavra curta', () => {
      expect(semelhanca('angluar', 'angular')).toBeGreaterThan(0.5);
      expect(semelhanca('sincronizaco', 'sincronizacao')).toBeGreaterThan(0.5);
      expect(semelhanca('rua', 'sua')).toBe(0);
    });

    it('conta a troca de duas letras vizinhas como um erro só', () => {
      expect(distancia('agnular', 'angular')).toBe(1);
    });
  });

  describe('filtro', () => {
    it('consulta vazia não esconde nada', () => {
      expect(sobra('   ')).toEqual([1, 2, 3, 4, 'nota 9']);
    });

    it('ignora acento e maiúscula', () => {
      expect(sobra('SAUDE')).toEqual([CORRIDA.id]);
      expect(sobra('sincronização')).toEqual(['nota 9']);
    });

    it('deixa passar erro de digitação', () => {
      expect(sobra('angluar')).toEqual([ANGULAR.id]);
      expect(sobra('dokcer')).toEqual([DOCKER.id]);
    });

    it('procura em todos os campos da tarefa, não só no título', () => {
      expect(sobra('token vencido')).toEqual([BUG.id]);
      expect(sobra('volume nomeado')).toEqual([DOCKER.id]);
      expect(sobra('infra')).toEqual([DOCKER.id]);
    });

    it('toda palavra tem que bater: o que só bate em parte sai', () => {
      expect(sobra('xyz')).toEqual([]);
      expect(sobra('angular kubernetes')).toEqual([]);
    });

    it('palavras vazias não atrapalham: "fila de sincronização" acha o diário', () => {
      expect(sobra('fila de sincronização')).toEqual(['nota 9']);
    });

    it('mantém a ordem em que as tarefas vieram', () => {
      const { tarefas } = filtrarPorBusca('login', [BUG, tarefa(5, { descricao: 'tela de login' })], []);

      expect(tarefas.map((t) => t.id)).toEqual([BUG.id, 5]);
    });
  });
});
