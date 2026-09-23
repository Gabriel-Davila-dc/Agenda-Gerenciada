import { provideRouter } from '@angular/router';
import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { provideZonelessChangeDetection } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { CdkDragDrop } from '@angular/cdk/drag-drop';

import { Agenda } from './agenda';
import { Etapa, Tarefa } from '../../models/tarefa';
import { Nota } from '../../models/nota';
import { TarefasService } from '../../services/tarefas-service';
import { NotasService } from '../../services/notas-service';
import { SincronizacaoService } from '../../services/sincronizacao-service';
import { aconteceEm } from '../../services/datas';

// segunda a sexta da mesma semana, o caso que motivou os dias pulados
const SEGUNDA = '2026-09-07';
const TERCA = '2026-09-08';
const QUARTA = '2026-09-09';
const QUINTA = '2026-09-10';
const SEXTA = '2026-09-11';

const ESTUDO: Tarefa = {
  id: 7,
  titulo: 'Estudar RxJS',
  area: 'Estudo',
  tipo: 'Projeto',
  objetivo: 'Dominar Angular',
  dataInicio: SEGUNDA,
  dataFim: SEXTA,
  diasPulados: [],
  descricao: '',
  aprendizado: '',
  etapa: 'Fazendo',
  historicoEtapas: [{ etapa: 'Fazendo', data: SEGUNDA }],
};

const CORRIDA: Tarefa = {
  id: 8,
  titulo: 'Correr 3 km',
  area: 'Saúde',
  tipo: 'Hábito',
  objetivo: 'Correr 5 km',
  dataInicio: QUARTA,
  dataFim: QUARTA,
  diasPulados: [],
  descricao: '',
  aprendizado: '',
  etapa: 'A fazer',
  historicoEtapas: [{ etapa: 'A fazer', data: SEGUNDA }],
};

describe('Agenda', () => {
  let component: Agenda;
  let tarefasService: TarefasService;
  let notasService: NotasService;
  let sincronizacao: SincronizacaoService;

  // a tarefa salva no cache, que é de onde a tela lê
  const salva = (id = ESTUDO.id): Tarefa => tarefasService.listar().find((t) => t.id === id)!;
  const operacoesDe = (recurso: string) =>
    sincronizacao.fila().filter((operacao) => operacao.recurso === recurso);

  beforeEach(async () => {
    localStorage.clear();

    await TestBed.configureTestingModule({
      // o HttpClient de teste segura as requisições: a sincronização que o
      // componente dispara ao abrir fica parada e não mexe no cache no meio
      providers: [
        provideZonelessChangeDetection(),
        provideHttpClient(),
        provideHttpClientTesting(),
        provideRouter([]),
      ],
      imports: [Agenda],
    }).compileComponents();
  });

  afterEach(() => localStorage.clear());

  // semeado antes de criar o componente, que lê o cache no construtor
  function abrir(tarefas: Tarefa[], notas: Nota[] = []): void {
    localStorage.setItem('tarefas-cache', JSON.stringify(tarefas));
    localStorage.setItem('notas-cache', JSON.stringify(notas));

    component = TestBed.createComponent(Agenda).componentInstance;
    tarefasService = TestBed.inject(TarefasService);
    notasService = TestBed.inject(NotasService);
    sincronizacao = TestBed.inject(SincronizacaoService);
  }

  describe('tirar um dia da tarefa', () => {
    beforeEach(() => abrir([ESTUDO]));

    it('tira o dia do meio sem mexer nas pontas', () => {
      component.editar(ESTUDO, QUARTA);
      component.tirarDoDia();

      expect(salva().dataInicio).toBe(SEGUNDA);
      expect(salva().dataFim).toBe(SEXTA);
      expect(salva().diasPulados).toEqual([QUARTA]);
    });

    it('some do dia tirado e continua nos outros', () => {
      component.editar(ESTUDO, QUARTA);
      component.tirarDoDia();

      expect(aconteceEm(salva(), QUARTA)).toBeFalse();
      expect(aconteceEm(salva(), TERCA)).toBeTrue();
      expect(aconteceEm(salva(), QUINTA)).toBeTrue();
    });

    // encolher a ponta em vez de pular: um buraco na borda seria invisível e
    // reapareceria torto se a data fosse esticada depois
    it('encolhe o início quando o dia tirado é o primeiro', () => {
      component.editar(ESTUDO, SEGUNDA);
      component.tirarDoDia();

      expect(salva().dataInicio).toBe(TERCA);
      expect(salva().dataFim).toBe(SEXTA);
      expect(salva().diasPulados).toEqual([]);
    });

    it('encolhe o fim quando o dia tirado é o último', () => {
      component.editar(ESTUDO, SEXTA);
      component.tirarDoDia();

      expect(salva().dataInicio).toBe(SEGUNDA);
      expect(salva().dataFim).toBe(QUINTA);
      expect(salva().diasPulados).toEqual([]);
    });

    it('tirar a ponta ao lado de um dia já pulado pula o buraco e não deixa lixo', () => {
      component.editar(ESTUDO, TERCA);
      component.tirarDoDia();

      // agora segunda é a ponta e terça está pulada: tirar a segunda precisa
      // levar o início para a quarta, não para a terça que já não existe
      component.editar(salva(), SEGUNDA);
      component.tirarDoDia();

      expect(salva().dataInicio).toBe(QUARTA);
      expect(salva().diasPulados).toEqual([]);
    });

    it('não oferece tirar o dia quando a tarefa é de um dia só', () => {
      component.editar({ ...ESTUDO, dataInicio: QUARTA, dataFim: QUARTA }, QUARTA);

      expect(component.podeTirarDoDia).toBeFalse();
    });

    it('não oferece tirar o dia quando o formulário veio do quadro', () => {
      component.editar(ESTUDO);

      expect(component.diaClicado).toBeNull();
      expect(component.podeTirarDoDia).toBeFalse();
    });

    it('cancelar depois de mexer não altera a tarefa guardada', () => {
      component.editar(ESTUDO, QUARTA);
      component.editando!.diasPulados.push(QUINTA);
      component.fechar();

      expect(salva().diasPulados).toEqual([]);
    });
  });

  describe('quadro', () => {
    beforeEach(() => abrir([ESTUDO, CORRIDA]));

    function arrastar(de: Etapa, para: Etapa): void {
      const origem = component.colunas.find((coluna) => coluna.etapa === de)!.tarefas;
      const destino = component.colunas.find((coluna) => coluna.etapa === para)!.tarefas;

      component.soltar(
        {
          previousContainer: { data: origem },
          container: { data: destino },
          previousIndex: 0,
          currentIndex: 0,
        } as unknown as CdkDragDrop<Tarefa[]>,
        para,
      );
    }

    it('arrastar muda só a etapa da tarefa arrastada', () => {
      arrastar('A fazer', 'Feito');

      expect(tarefasService.listar().length).toBe(2);
      expect(salva(CORRIDA.id).etapa).toBe('Feito');
      expect(salva(ESTUDO.id).etapa).toBe('Fazendo');
    });

    // o quadro filtrado só tem parte das tarefas; guardar o que está na tela
    // como se fosse tudo apagaria as outras do cache
    it('arrastar com a pesquisa ligada não apaga as tarefas que ela esconde', () => {
      component.pesquisar('correr');
      arrastar('A fazer', 'Feito');

      expect(tarefasService.listar().length).toBe(2);
      expect(salva(CORRIDA.id).etapa).toBe('Feito');
      expect(salva(ESTUDO.id).etapa).toBe('Fazendo');
    });

    it('a pesquisa filtra o calendário e, limpa, mostra tudo de novo', () => {
      const noCalendario = () =>
        new Set(component.semanas.flatMap((s) => s.dias.flatMap((d) => d.tarefas.map((t) => t.id))));

      // o calendário mostra as semanas em volta de hoje: hoje é a semana das tarefas
      jasmine.clock().install();
      jasmine.clock().mockDate(new Date(`${QUARTA}T12:00:00`));

      try {
        component.pesquisar('rxjs');
        expect([...noCalendario()]).toEqual([ESTUDO.id]);

        component.pesquisar('');
        expect(noCalendario()).toEqual(new Set([ESTUDO.id, CORRIDA.id]));
      } finally {
        jasmine.clock().uninstall();
      }
    });

    it('mudar de etapa entra na fila como edição', () => {
      arrastar('A fazer', 'Travado');

      const operacoes = operacoesDe('tarefas');

      expect(operacoes.length).toBe(1);
      expect(operacoes[0].tipo).toBe('editar');
      expect((operacoes[0].dados as Tarefa).etapa).toBe('Travado');
    });
  });

  describe('clique no espaço livre do dia', () => {
    beforeEach(() => abrir([ESTUDO]));

    // o clique chega no .dia vindo de onde o dedo tocou
    const clique = (alvo: HTMLElement) => ({ target: alvo }) as unknown as MouseEvent;

    it('abre tarefa nova naquele dia', () => {
      component.clicarNoDia(clique(document.createElement('div')), QUARTA);

      expect(component.editando!.id).toBeFalsy();
      expect(component.editando!.dataInicio).toBe(QUARTA);
    });

    it('não abre tarefa nova quando o toque foi numa etiqueta ou botão', () => {
      const etiqueta = document.createElement('button');
      const nome = document.createElement('span');
      etiqueta.appendChild(nome);

      component.clicarNoDia(clique(nome), QUARTA);

      expect(component.editando).toBeNull();
    });
  });

  describe('só o que estava em Fazendo', () => {
    // hoje é o sábado; o planejado era segunda a sexta
    const SABADO = '2026-09-12';

    // em que dias do calendário a tarefa aparece
    const diasCom = (id: number) =>
      component.semanas
        .flatMap((semana) => semana.dias)
        .filter((dia) => dia.tarefas.some((t) => t.id === id))
        .map((dia) => dia.iso);

    beforeEach(() => {
      jasmine.clock().install();
      jasmine.clock().mockDate(new Date(`${SABADO}T12:00:00`));
    });
    afterEach(() => jasmine.clock().uninstall());

    // planejado de segunda a sexta, mas só foi feito na terça e na quarta
    const ESTUDO_REAL: Tarefa = {
      ...ESTUDO,
      etapa: 'Feito',
      historicoEtapas: [
        { etapa: 'A fazer', data: SEGUNDA },
        { etapa: 'Fazendo', data: TERCA },
        { etapa: 'Feito', data: QUARTA },
      ],
    };

    it('mostra a tarefa nos dias em que esteve em Fazendo, e não nos planejados', () => {
      abrir([ESTUDO_REAL]);
      expect(diasCom(ESTUDO.id)).toEqual([SEGUNDA, TERCA, QUARTA, QUINTA, SEXTA]);

      component.alternarSoFazendo();

      expect(diasCom(ESTUDO.id)).toEqual([TERCA, QUARTA]);
    });

    it('a que ainda está em Fazendo vai até hoje, e o filtro fica guardado', () => {
      abrir([{ ...ESTUDO, historicoEtapas: [{ etapa: 'Fazendo', data: QUINTA }] }, CORRIDA]);

      component.alternarSoFazendo();

      expect(diasCom(ESTUDO.id)).toEqual([QUINTA, SEXTA, SABADO]);
      expect(diasCom(CORRIDA.id)).toEqual([]);
      expect(localStorage.getItem('agenda-filtro-fazendo')).toBe('1');
    });

    // com o filtro a tarefa aparece fora do intervalo planejado: ali não há dia para tirar
    it('não oferece tirar o dia quando o dia não é dos planejados', () => {
      abrir([{ ...ESTUDO_REAL, dataInicio: QUARTA, dataFim: SEXTA }]);
      component.alternarSoFazendo();

      component.editar(salva(), TERCA);

      expect(component.podeTirarDoDia).toBeFalse();
    });
  });

  describe('aprendizados', () => {
    it('junta diário e tarefa no dia em que ela terminou, com o diário primeiro', () => {
      abrir(
        [{ ...ESTUDO, aprendizado: 'switchMap cancela o anterior' }],
        [
          { id: 3, data: SEXTA, texto: 'Dia produtivo' },
          { id: 4, data: QUARTA, texto: 'Revisei tudo' },
        ],
      );

      expect(component.aprendizados.map((dia) => dia.data)).toEqual([SEXTA, QUARTA]);
      expect(component.aprendizados[0].itens.map((item) => item.origem)).toEqual([
        'diario',
        'tarefa',
      ]);
    });

    it('tarefa sem aprendizado não entra', () => {
      abrir([ESTUDO, CORRIDA]);

      expect(component.aprendizados).toEqual([]);
    });

    describe('caderno', () => {
      // três dias com anotação, em dois meses
      beforeEach(() =>
        abrir(
          [],
          [
            { id: 1, data: '2026-08-20', texto: 'Agosto' },
            { id: 2, data: QUARTA, texto: 'Quarta' },
            { id: 3, data: SEXTA, texto: 'Sexta' },
          ],
        ),
      );

      it('abre no dia mais recente, numerado do começo', () => {
        expect(component.diaCaderno!.data).toBe(SEXTA);
        // o mais antigo seria 1 e 2; o terceiro dia abre em 5 e 6
        expect(component.paginaCaderno).toBe(5);
      });

      it('folheia sem passar das pontas', () => {
        component.folhear(-1);
        expect(component.diaCaderno!.data).toBe(SEXTA);

        component.folhear(1);
        component.folhear(1);
        component.folhear(1);
        expect(component.diaCaderno!.data).toBe('2026-08-20');
        expect(component.paginaCaderno).toBe(1);
      });

      it('um marcador por mês, e ele leva ao dia mais recente do mês', () => {
        expect(component.mesesCaderno).toEqual([
          { chave: '2026-09', rotulo: 'SET' },
          { chave: '2026-08', rotulo: 'AGO' },
        ]);

        component.irParaMes('2026-08');
        expect(component.diaCaderno!.data).toBe('2026-08-20');

        component.irParaMes('2026-09');
        expect(component.diaCaderno!.data).toBe(SEXTA);
      });

      it('sem anotação nenhuma, o caderno fica vazio', () => {
        abrir([], []);

        expect(component.diaCaderno).toBeNull();
        expect(component.mesesCaderno).toEqual([]);
      });
    });

    it('tocar num aprendizado abre o formulário certo', () => {
      abrir([{ ...ESTUDO, aprendizado: 'Signals' }], [{ id: 3, data: QUARTA, texto: 'Dia' }]);

      const [doDiario] = component.aprendizados.find((dia) => dia.data === QUARTA)!.itens;
      component.abrirAprendizado(doDiario);
      expect(component.notaEditando?.data).toBe(QUARTA);

      component.fecharNota();
      const [daTarefa] = component.aprendizados.find((dia) => dia.data === SEXTA)!.itens;
      component.abrirAprendizado(daTarefa);
      expect(component.editando?.id).toBe(ESTUDO.id);
      // aberto fora do calendário: não há dia para tirar
      expect(component.diaClicado).toBeNull();
    });
  });

  describe('diário', () => {
    beforeEach(() => abrir([]));

    it('dia sem nota abre vazio, e salvar cria a nota do dia', () => {
      component.abrirNota(QUARTA);
      expect(component.notaEditando).toEqual({ data: QUARTA, texto: '', existe: false });

      component.notaEditando!.texto = 'Aprendi a usar o CDK';
      component.salvarNota();

      expect(notasService.doDia(QUARTA)?.texto).toBe('Aprendi a usar o CDK');
      expect(component.notaEditando).toBeNull();
    });

    it('dia com nota abre com o texto, e apagar tira a nota', () => {
      component.abrirNota(QUARTA);
      component.notaEditando!.texto = 'Primeira versão';
      component.salvarNota();

      component.abrirNota(QUARTA);
      expect(component.notaEditando).toEqual({
        data: QUARTA,
        texto: 'Primeira versão',
        existe: true,
      });

      component.apagarNota();
      expect(notasService.doDia(QUARTA)).toBeUndefined();
    });

    it('cancelar não grava nada', () => {
      component.abrirNota(QUARTA);
      component.notaEditando!.texto = 'Rascunho';
      component.fecharNota();

      expect(notasService.doDia(QUARTA)).toBeUndefined();
      expect(operacoesDe('notas')).toEqual([]);
    });
  });
});
