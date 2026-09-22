import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { provideZonelessChangeDetection } from '@angular/core';
import { TestBed } from '@angular/core/testing';

import { Nota } from '../models/nota';
import { NotasService, RECURSO_NOTAS } from './notas-service';
import { SincronizacaoService } from './sincronizacao-service';

const QUARTA = '2026-09-09';

describe('NotasService', () => {
  let service: NotasService;
  let sincronizacao: SincronizacaoService;

  const operacoes = () =>
    sincronizacao.fila().filter((operacao) => operacao.recurso === RECURSO_NOTAS);

  function comCache(notas: Nota[]): void {
    localStorage.setItem('notas-cache', JSON.stringify(notas));
  }

  beforeEach(() => {
    localStorage.clear();
    TestBed.configureTestingModule({
      providers: [provideZonelessChangeDetection(), provideHttpClient(), provideHttpClientTesting()],
    });

    service = TestBed.inject(NotasService);
    sincronizacao = TestBed.inject(SincronizacaoService);
  });

  afterEach(() => localStorage.clear());

  it('a primeira nota do dia nasce com id negativo e entra na fila como criação', () => {
    service.salvarDoDia(QUARTA, '  Aprendi a usar o CDK  ');

    const [nota] = service.listar();
    expect(nota.id).toBeLessThan(0);
    expect(nota.texto).toBe('Aprendi a usar o CDK');
    expect(operacoes().map((operacao) => operacao.tipo)).toEqual(['criar']);
  });

  // o dia é a chave: escrever de novo não pode virar uma segunda nota
  it('escrever de novo no mesmo dia edita a mesma nota', () => {
    service.salvarDoDia(QUARTA, 'Primeira');
    service.salvarDoDia(QUARTA, 'Segunda');

    expect(service.listar().length).toBe(1);
    // ainda não subiu: troca o conteúdo da criação, sem enfileirar edição
    expect(operacoes().length).toBe(1);
    expect((operacoes()[0].dados as Nota).texto).toBe('Segunda');
  });

  it('nota que já subiu vira edição na fila', () => {
    comCache([{ id: 12, data: QUARTA, texto: 'Antiga' }]);

    service.salvarDoDia(QUARTA, 'Nova');

    expect(operacoes().map((operacao) => operacao.tipo)).toEqual(['editar']);
    expect(service.doDia(QUARTA)?.texto).toBe('Nova');
  });

  it('texto vazio numa nota que nunca subiu apaga sem mandar nada ao servidor', () => {
    service.salvarDoDia(QUARTA, 'Rascunho');
    service.salvarDoDia(QUARTA, '   ');

    expect(service.listar()).toEqual([]);
    expect(operacoes()).toEqual([]);
  });

  it('texto vazio numa nota que já subiu enfileira o apagar', () => {
    comCache([{ id: 12, data: QUARTA, texto: 'Antiga' }]);

    service.salvarDoDia(QUARTA, '');

    expect(service.listar()).toEqual([]);
    expect(operacoes().map((operacao) => operacao.tipo)).toEqual(['apagar']);
  });

  /**
   * O servidor junta notas do mesmo dia: a escrita offline daqui pode cair na
   * nota que veio do outro aparelho e já estava no cache. O id devolvido é o
   * dela, e o dia não pode ficar com duas.
   */
  it('quando o servidor junta com uma nota do cache, o dia fica com uma só', () => {
    comCache([
      { id: -1, data: QUARTA, texto: 'Escrita offline' },
      { id: 55, data: QUARTA, texto: 'Do outro aparelho' },
    ]);

    (service as unknown as { trocarId(idLocal: number, idServidor: number): void }).trocarId(-1, 55);

    expect(service.listar()).toEqual([{ id: 55, data: QUARTA, texto: 'Escrita offline' }]);
  });
});
