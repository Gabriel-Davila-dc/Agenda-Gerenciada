import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { provideZonelessChangeDetection } from '@angular/core';
import { TestBed } from '@angular/core/testing';

import { MudancaEtapa, Tarefa, tarefaVazia } from '../models/tarefa';
import { RECURSO_TAREFAS, TarefasService, registrarEtapa } from './tarefas-service';
import { SincronizacaoService } from './sincronizacao-service';

const QUARTA = '2026-09-09';

function tarefa(id: number, campos: Partial<Tarefa>): Tarefa {
  return { ...tarefaVazia(QUARTA), id, ...campos };
}

describe('TarefasService', () => {
  let service: TarefasService;
  let sincronizacao: SincronizacaoService;

  const operacoes = () =>
    sincronizacao.fila().filter((operacao) => operacao.recurso === RECURSO_TAREFAS);
  const doCache = (id: number) => service.listar().find((t) => t.id === id)!;

  function comCache(tarefas: Tarefa[]): void {
    localStorage.setItem('tarefas-cache', JSON.stringify(tarefas));
  }

  beforeEach(() => {
    localStorage.clear();
    TestBed.configureTestingModule({
      providers: [provideZonelessChangeDetection(), provideHttpClient(), provideHttpClientTesting()],
    });

    service = TestBed.inject(TarefasService);
    sincronizacao = TestBed.inject(SincronizacaoService);
  });

  afterEach(() => localStorage.clear());

  describe('renomear um item do cadastro', () => {
    /**
     * Só mudar o cache não bastava (o bug do app original): a versão do
     * servidor, com o nome antigo, voltava no próximo carregamento. Cada
     * tarefa alterada precisa entrar na fila.
     */
    it('leva o nome novo às tarefas e manda a edição para a fila', () => {
      comCache([
        tarefa(7, { objetivo: 'Angular' }),
        tarefa(8, { objetivo: 'Correr 5 km' }),
      ]);

      service.atualizarReferencia('objetivos', 'Angular', 'Dominar Angular');

      expect(doCache(7).objetivo).toBe('Dominar Angular');
      expect(operacoes().length).toBe(1);
      expect(operacoes()[0]).toEqual(
        jasmine.objectContaining({ tipo: 'editar', idLocal: 7 }),
      );
      expect((operacoes()[0].dados as Tarefa).objetivo).toBe('Dominar Angular');
    });

    it('tarefa que ainda não subiu leva o nome novo na própria criação', () => {
      const nova = tarefa(0, { objetivo: 'Angular' });
      service.salvar(nova);

      service.atualizarReferencia('objetivos', 'Angular', 'Dominar Angular');

      expect(operacoes().length).toBe(1);
      expect(operacoes()[0].tipo).toBe('criar');
      expect((operacoes()[0].dados as Tarefa).objetivo).toBe('Dominar Angular');
    });

    it('área e tipo também acompanham, cada um no seu campo', () => {
      comCache([tarefa(7, { area: 'Estudo', tipo: 'Estudo' })]);

      service.atualizarReferencia('areas', 'Estudo', 'Estudos');

      expect(doCache(7).area).toBe('Estudos');
      // o tipo tinha o mesmo texto, mas é de outra lista: não pode mudar junto
      expect(doCache(7).tipo).toBe('Estudo');
    });

    it('sem tarefa usando o nome, nada entra na fila', () => {
      comCache([tarefa(7, { objetivo: 'Correr 5 km' })]);

      service.atualizarReferencia('objetivos', 'Angular', 'Dominar Angular');

      expect(operacoes()).toEqual([]);
    });
  });

  it('dado salvo antes dos campos novos ganha valor padrão ao ler', () => {
    localStorage.setItem(
      'tarefas-cache',
      JSON.stringify([{ id: 1, area: '', tipo: 'Leitura', objetivo: '', dataInicio: QUARTA, dataFim: '', descricao: '', etapa: 'A fazer' }]),
    );

    const [antiga] = service.listar();

    expect(antiga.diasPulados).toEqual([]);
    expect(antiga.aprendizado).toBe('');
    expect(antiga.titulo).toBe('');
    expect(antiga.historicoEtapas).toEqual([]);
  });

  describe('histórico de etapas', () => {
    const SEGUNDA = '2026-09-14';
    const TERCA = '2026-09-15';

    function emDia(iso: string): void {
      jasmine.clock().mockDate(new Date(`${iso}T12:00:00`));
    }

    beforeEach(() => jasmine.clock().install());
    afterEach(() => jasmine.clock().uninstall());

    it('tarefa nova começa com a etapa de hoje', () => {
      emDia(SEGUNDA);
      const nova = tarefa(0, { etapa: 'Fazendo' });

      service.salvar(nova);

      expect(doCache(nova.id).historicoEtapas).toEqual([{ etapa: 'Fazendo', data: SEGUNDA }]);
    });

    // o que sobe para o servidor precisa levar o histórico junto
    it('mudar a etapa entra no histórico e na edição da fila', () => {
      comCache([tarefa(7, { etapa: 'A fazer', historicoEtapas: [{ etapa: 'A fazer', data: SEGUNDA }] })]);
      emDia(TERCA);

      service.salvar({ ...doCache(7), etapa: 'Fazendo' });

      const esperado: MudancaEtapa[] = [
        { etapa: 'A fazer', data: SEGUNDA },
        { etapa: 'Fazendo', data: TERCA },
      ];
      expect(doCache(7).historicoEtapas).toEqual(esperado);
      expect((operacoes()[0].dados as Tarefa).historicoEtapas).toEqual(esperado);
    });

    it('editar sem mudar a etapa não mexe no histórico', () => {
      comCache([tarefa(7, { etapa: 'Fazendo', historicoEtapas: [{ etapa: 'Fazendo', data: SEGUNDA }] })]);
      emDia(TERCA);

      service.salvar({ ...doCache(7), titulo: 'Outro nome' });

      expect(doCache(7).historicoEtapas).toEqual([{ etapa: 'Fazendo', data: SEGUNDA }]);
    });

    it('idas e vindas no mesmo dia guardam cada etapa uma vez, com a atual no fim', () => {
      let historico: MudancaEtapa[] = [{ etapa: 'A fazer', data: SEGUNDA }];

      historico = registrarEtapa(historico, 'Fazendo', TERCA);
      historico = registrarEtapa(historico, 'Feito', TERCA);
      historico = registrarEtapa(historico, 'Fazendo', TERCA);
      historico = registrarEtapa(historico, 'Feito', TERCA);

      expect(historico).toEqual([
        { etapa: 'A fazer', data: SEGUNDA },
        { etapa: 'Fazendo', data: TERCA },
        { etapa: 'Feito', data: TERCA },
      ]);
    });

    it('sair e voltar no mesmo dia guarda a passagem, e continuar não é mudança', () => {
      const historico = registrarEtapa(
        registrarEtapa([{ etapa: 'Fazendo', data: SEGUNDA }], 'Travado', TERCA),
        'Fazendo',
        TERCA,
      );

      expect(historico).toEqual([
        { etapa: 'Fazendo', data: SEGUNDA },
        { etapa: 'Travado', data: TERCA },
        { etapa: 'Fazendo', data: TERCA },
      ]);
      expect(registrarEtapa([{ etapa: 'Fazendo', data: SEGUNDA }], 'Fazendo', TERCA)).toEqual([
        { etapa: 'Fazendo', data: SEGUNDA },
      ]);
    });
  });

  // com filtro de objetivo o quadro só tem parte das tarefas
  it('reordenar parte das tarefas mantém as outras no cache', () => {
    comCache([tarefa(1, {}), tarefa(2, {}), tarefa(3, {})]);

    service.reordenar([3, 1]);

    expect(service.listar().map((t) => t.id)).toEqual([3, 1, 2]);
    // ordem é só posição na tela: não vai para o servidor
    expect(operacoes()).toEqual([]);
  });
});
