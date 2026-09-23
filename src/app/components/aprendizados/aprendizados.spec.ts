import { provideZonelessChangeDetection } from '@angular/core';
import { TestBed } from '@angular/core/testing';

import { Aprendizados, EscritaNoCaderno } from './aprendizados';
import { Aprendizado, DiaDeAprendizado } from '../../models/aprendizado';
import { tarefaVazia } from '../../models/tarefa';

const DIA = '2026-09-22';

const TAREFA = { ...tarefaVazia(DIA), id: 5, titulo: 'Busca de dados', aprendizado: 'Índice composto' };
const DA_TAREFA: Aprendizado = {
  chave: 'tarefa-5',
  origem: 'tarefa',
  titulo: 'Busca de dados',
  detalhe: '',
  texto: 'Índice composto',
  tarefa: TAREFA,
};
const DO_DIARIO: Aprendizado = {
  chave: 'nota-1',
  origem: 'diario',
  titulo: 'Diário do dia',
  detalhe: '',
  texto: 'Senhas\nArgon2 é o recomendado',
};

describe('Aprendizados (caderno)', () => {
  let caderno: Aprendizados;
  let escritas: EscritaNoCaderno[];

  function abrir(itens: Aprendizado[]): void {
    const fixture = TestBed.createComponent(Aprendizados);
    caderno = fixture.componentInstance;
    caderno.dia = { data: DIA, rotulo: '', itens } as DiaDeAprendizado;
    escritas = [];
    caderno.escrever.subscribe((e) => escritas.push(e));
  }

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideZonelessChangeDetection()],
      imports: [Aprendizados],
    });
  });

  it('primeira linha curta do diário vira o título da anotação', () => {
    abrir([DO_DIARIO]);

    expect(caderno.entradas[0].titulo).toBe('Senhas');
    expect(caderno.entradas[0].corpo).toBe('Argon2 é o recomendado');
  });

  it('escrever na tarefa troca só o "o que aprendi" dela', () => {
    abrir([DA_TAREFA]);

    caderno.editar(DA_TAREFA);
    caderno.rascunho = 'Índice composto na ordem do filtro';
    caderno.concluir();

    expect(escritas).toEqual([{ data: DIA, texto: 'Índice composto na ordem do filtro', tarefa: TAREFA }]);
    expect(caderno.editando).toBeNull();
  });

  it('sair sem mudar nada não grava', () => {
    abrir([DO_DIARIO]);

    caderno.editar(DO_DIARIO);
    caderno.concluir();

    expect(escritas).toEqual([]);
  });

  it('Esc larga o rascunho, e o blur que vem depois não grava', () => {
    abrir([DO_DIARIO]);

    caderno.editar(DO_DIARIO);
    caderno.rascunho = 'outra coisa';
    caderno.desfazer();
    caderno.concluir();

    expect(escritas).toEqual([]);
  });

  it('dia sem diário oferece as linhas em branco, e o escrito vira o diário do dia', () => {
    abrir([DA_TAREFA]);
    expect(caderno.podeEscreverDiario).toBeTrue();

    caderno.escreverDiario();
    caderno.rascunho = 'Dia bom\n';
    caderno.concluir();

    expect(escritas).toEqual([{ data: DIA, texto: 'Dia bom', tarefa: undefined }]);
  });

  it('dia que já tem diário não oferece escrever outro', () => {
    abrir([DO_DIARIO, DA_TAREFA]);

    expect(caderno.podeEscreverDiario).toBeFalse();
  });

  it('trocar de anotação guarda a que estava sendo escrita', () => {
    abrir([DO_DIARIO, DA_TAREFA]);

    caderno.editar(DO_DIARIO);
    caderno.rascunho = 'Senhas\nArgon2id';
    caderno.editar(DA_TAREFA);

    expect(escritas.map((e) => e.texto)).toEqual(['Senhas\nArgon2id']);
    expect(caderno.editando).toBe('tarefa-5');
  });
});
