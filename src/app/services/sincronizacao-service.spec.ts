import { provideZonelessChangeDetection } from '@angular/core';
import { TestBed } from '@angular/core/testing';

import { HandlerSincronizacao, SincronizacaoService } from './sincronizacao-service';

const RECURSO = 'vendas';

interface HandlerEspiao extends HandlerSincronizacao {
  criar: jasmine.Spy;
  editar: jasmine.Spy;
  apagar: jasmine.Spy;
  aoTrocarId: jasmine.Spy;
}

function handlerEspiao(idDoServidor = 100): HandlerEspiao {
  return {
    criar: jasmine.createSpy('criar').and.resolveTo(idDoServidor),
    editar: jasmine.createSpy('editar').and.resolveTo(undefined),
    apagar: jasmine.createSpy('apagar').and.resolveTo(undefined),
    aoTrocarId: jasmine.createSpy('aoTrocarId'),
  };
}

// o servidor respondeu com um status; sem status seria falha de rede
function respostaComStatus(status: number): Promise<never> {
  return Promise.reject({ status });
}

describe('SincronizacaoService', () => {
  let sinc: SincronizacaoService;
  let handler: HandlerEspiao;

  const fila = () => sinc.fila();

  beforeEach(() => {
    localStorage.clear();
    // o setTimeout de 30s da retentativa não pode ficar solto entre os testes
    jasmine.clock().install();

    TestBed.configureTestingModule({ providers: [provideZonelessChangeDetection()] });
    sinc = TestBed.inject(SincronizacaoService);

    handler = handlerEspiao();
    sinc.registrar(RECURSO, handler);
  });

  afterEach(() => {
    jasmine.clock().uninstall();
    localStorage.clear();
    restaurarConexao();
  });

  // navigator.onLine é só de leitura: para fingir o bananal sem sinal, troca-se
  // o getter e devolve-se ele no fim
  function fingirSemSinal(): void {
    Object.defineProperty(navigator, 'onLine', { configurable: true, get: () => false });
  }

  function restaurarConexao(): void {
    Object.defineProperty(navigator, 'onLine', { configurable: true, get: () => true });
  }

  // ---------- a fila em si ----------

  describe('fila', () => {
    it('guarda a operação e sobrevive ao recarregar a página', () => {
      sinc.enfileirar(RECURSO, 'criar', -1, { id: -1, nome: 'Zé' });

      // o service novo lê o mesmo localStorage, como faria depois de um F5
      const outraSessao = TestBed.inject(SincronizacaoService);

      expect(outraSessao.fila().length).toBe(1);
      expect(outraSessao.fila()[0]).toEqual(
        jasmine.objectContaining({ recurso: RECURSO, tipo: 'criar', idLocal: -1 }),
      );
    });

    it('acha a criação ainda não enviada de um registro', () => {
      sinc.enfileirar(RECURSO, 'criar', -1, { id: -1 });

      expect(sinc.criacaoPendente(RECURSO, -1)).toBeTruthy();
      expect(sinc.criacaoPendente(RECURSO, -2)).toBeUndefined();
      expect(sinc.criacaoPendente('servicos', -1)).toBeUndefined();
    });

    // editar algo que ainda nem subiu troca o conteúdo da criação, senão a
    // edição chegaria ao servidor antes do registro existir
    it('troca o conteúdo da criação pendente em vez de enfileirar uma edição', () => {
      sinc.enfileirar(RECURSO, 'criar', -1, { id: -1, nome: 'Zé' });
      const pendente = sinc.criacaoPendente(RECURSO, -1)!;

      sinc.atualizarDados(pendente.id, { id: -1, nome: 'Zé Maria' });

      expect(fila().length).toBe(1);
      expect(fila()[0].dados).toEqual({ id: -1, nome: 'Zé Maria' });
    });

    it('apaga da fila tudo que era daquele registro', () => {
      sinc.enfileirar(RECURSO, 'criar', -1, { id: -1 });
      sinc.enfileirar(RECURSO, 'editar', -1, { id: -1 });
      sinc.enfileirar(RECURSO, 'criar', -2, { id: -2 });

      sinc.removerDoRegistro(RECURSO, -1);

      expect(fila().length).toBe(1);
      expect(fila()[0].idLocal).toBe(-2);
    });

    it('sabe dizer o que tem pendência e quais ids têm cada operação', () => {
      sinc.enfileirar(RECURSO, 'criar', -1, { id: -1 });
      sinc.enfileirar(RECURSO, 'apagar', 7);

      expect(sinc.temPendencia(RECURSO, -1)).toBeTrue();
      expect(sinc.temPendencia(RECURSO, 99)).toBeFalse();
      expect(sinc.idsComOperacao(RECURSO, 'apagar')).toEqual([7]);
    });

    /**
     * Venda criada offline apontando para um comprador também criado offline: o
     * comprador sobe primeiro e ganha id real, e a venda que ainda está na fila
     * precisa deixar de apontar para o id negativo, que o servidor recusaria.
     */
    it('troca a referência ao registro que ganhou id de verdade', () => {
      sinc.enfileirar(RECURSO, 'criar', -1, { id: -1, compradorId: -50 });
      sinc.enfileirar(RECURSO, 'criar', -2, { id: -2, compradorId: -99 });

      sinc.substituirValorNaFila(RECURSO, 'compradorId', -50, 12);

      expect((fila()[0].dados as { compradorId: number }).compradorId).toBe(12);
      expect((fila()[1].dados as { compradorId: number }).compradorId).toBe(-99);
    });
  });

  // ---------- enviar o que está parado ----------

  describe('sincronizar', () => {
    it('envia a criação, avisa o id do servidor e esvazia a fila', async () => {
      sinc.enfileirar(RECURSO, 'criar', -1, { id: -1, nome: 'Zé' });

      const resultado = await sinc.sincronizar();

      expect(handler.criar).toHaveBeenCalledWith({ id: -1, nome: 'Zé' });
      expect(handler.aoTrocarId).toHaveBeenCalledWith(-1, 100);
      expect(resultado).toEqual({ enviadas: 1, pendentes: 0 });
      expect(fila()).toEqual([]);
    });

    /**
     * O id negativo precisa sumir das operações seguintes do mesmo registro:
     * sem isso, a edição enfileirada logo depois da criação tentaria editar o
     * registro -1, que não existe no servidor.
     */
    it('substitui o id temporário nas operações seguintes do mesmo registro', async () => {
      sinc.enfileirar(RECURSO, 'criar', -1, { id: -1, nome: 'Zé' });
      sinc.enfileirar(RECURSO, 'editar', -1, { id: -1, nome: 'Zé Maria' });

      // a edição falha de rede, então sobra na fila para ser inspecionada
      handler.editar.and.returnValue(Promise.reject({}));

      await sinc.sincronizar();

      expect(fila().length).toBe(1);
      expect(fila()[0].idLocal).toBe(100);
      expect((fila()[0].dados as { id: number }).id).toBe(100);
    });

    it('manda editar e apagar para o handler certo', async () => {
      sinc.enfileirar(RECURSO, 'editar', 7, { id: 7, nome: 'Novo' });
      sinc.enfileirar(RECURSO, 'apagar', 8);

      await sinc.sincronizar();

      expect(handler.editar).toHaveBeenCalledWith({ id: 7, nome: 'Novo' });
      expect(handler.apagar).toHaveBeenCalledWith(8);
      expect(fila()).toEqual([]);
    });

    it('sem sinal não tenta nada e mantém a fila', async () => {
      sinc.enfileirar(RECURSO, 'criar', -1, { id: -1 });
      fingirSemSinal();

      const resultado = await sinc.sincronizar();

      expect(handler.criar).not.toHaveBeenCalled();
      expect(resultado).toEqual({ enviadas: 0, pendentes: 1 });
      expect(fila().length).toBe(1);
    });

    // recurso cujo backend ainda não existe: não trava os outros nem se perde
    it('pula o recurso sem handler, sem descartá-lo', async () => {
      sinc.enfileirar('recurso-sem-backend', 'criar', -1, { id: -1 });
      sinc.enfileirar(RECURSO, 'criar', -2, { id: -2 });

      const resultado = await sinc.sincronizar();

      expect(handler.criar).toHaveBeenCalledTimes(1);
      expect(resultado.enviadas).toBe(1);
      expect(fila().length).toBe(1);
      expect(fila()[0].recurso).toBe('recurso-sem-backend');
    });

    it('não roda duas vezes ao mesmo tempo', async () => {
      sinc.enfileirar(RECURSO, 'criar', -1, { id: -1 });

      const [primeira, segunda] = await Promise.all([sinc.sincronizar(), sinc.sincronizar()]);

      expect(handler.criar).toHaveBeenCalledTimes(1);
      expect(primeira.enviadas + segunda.enviadas).toBe(1);
    });
  });

  // ---------- o que fazer quando o servidor recusa ----------

  describe('erro do servidor', () => {
    /**
     * 4xx é recusa de conteúdo: retentar daria no mesmo, e como o laço para na
     * primeira falha para preservar a ordem, a operação travaria tudo que vem
     * atrás. Sai da fila, mas fica registrada para não sumir calada.
     */
    it('descarta o que o servidor recusou de vez, e guarda o rastro', async () => {
      sinc.enfileirar(RECURSO, 'criar', -1, { id: -1 });
      sinc.enfileirar(RECURSO, 'criar', -2, { id: -2 });
      handler.criar.and.returnValues(respostaComStatus(422), Promise.resolve(100));

      const resultado = await sinc.sincronizar();

      // a segunda passou: a recusa não travou a fila
      expect(resultado.enviadas).toBe(1);
      expect(fila()).toEqual([]);
      expect(sinc.descartadas().length).toBe(1);
      expect(sinc.descartadas()[0].idLocal).toBe(-1);
    });

    it('mantém na fila o que ainda pode dar certo depois (401, 408 e 429)', async () => {
      for (const status of [401, 408, 429]) {
        localStorage.clear();
        sinc.enfileirar(RECURSO, 'criar', -1, { id: -1 });
        handler.criar.and.returnValue(respostaComStatus(status));

        await sinc.sincronizar();

        expect(fila().length)
          .withContext(`status ${status} não podia descartar`)
          .toBe(1);
        expect(sinc.descartadas().length).withContext(`status ${status}`).toBe(0);
      }
    });

    it('falha de rede não gasta tentativa nem descarta', async () => {
      sinc.enfileirar(RECURSO, 'criar', -1, { id: -1 });
      // erro sem status: o aparelho nem chegou ao servidor
      handler.criar.and.returnValue(Promise.reject(new Error('offline')));

      for (let tentativa = 0; tentativa < 10; tentativa++) {
        await sinc.sincronizar();
      }

      expect(fila().length).toBe(1);
      expect(fila()[0].tentativas).toBeUndefined();
      expect(sinc.descartadas()).toEqual([]);
    });

    /**
     * 5xx pode ser instabilidade passageira, então vale retentar — mas com
     * teto, senão um payload que o servidor nunca digere retenta a cada 30s
     * para sempre, segurando todas as operações atrás dele.
     */
    it('retenta o erro do servidor até o limite e então desiste', async () => {
      sinc.enfileirar(RECURSO, 'criar', -1, { id: -1 });
      handler.criar.and.callFake(() => respostaComStatus(500));

      // as quatro primeiras seguram a operação na fila
      for (let tentativa = 1; tentativa <= 4; tentativa++) {
        await sinc.sincronizar();

        expect(fila().length).withContext(`tentativa ${tentativa}`).toBe(1);
        expect(fila()[0].tentativas).withContext(`tentativa ${tentativa}`).toBe(tentativa);
      }

      // a quinta estoura o limite
      await sinc.sincronizar();

      expect(fila()).toEqual([]);
      expect(sinc.descartadas().length).toBe(1);
    });

    // o laço para na primeira falha de rede: o que vem depois pode depender dela
    it('para na primeira falha de rede, preservando a ordem', async () => {
      sinc.enfileirar(RECURSO, 'criar', -1, { id: -1 });
      sinc.enfileirar(RECURSO, 'criar', -2, { id: -2 });
      handler.criar.and.returnValue(Promise.reject(new Error('offline')));

      await sinc.sincronizar();

      expect(handler.criar).toHaveBeenCalledTimes(1);
      expect(fila().length).toBe(2);
    });
  });

  // ---------- juntar servidor com o que ainda não subiu ----------

  describe('mesclar', () => {
    it('mantém o que foi criado offline, que só existe no aparelho', () => {
      sinc.enfileirar(RECURSO, 'criar', -1, { id: -1 });
      const cache = [{ id: -1, nome: 'Criada na roça' }];
      const servidor = [{ id: 7, nome: 'Já salva' }];

      const resultado = sinc.mesclar(RECURSO, cache, servidor);

      expect(resultado.length).toBe(2);
      expect(resultado[0].id).toBe(-1);
    });

    it('não deixa reaparecer o que foi apagado offline', () => {
      sinc.enfileirar(RECURSO, 'apagar', 7);
      const resultado = sinc.mesclar(RECURSO, [], [{ id: 7 }, { id: 8 }]);

      expect(resultado.map((item) => item.id)).toEqual([8]);
    });

    // conflito: o aparelho vence
    it('faz a edição pendente prevalecer sobre a versão do servidor', () => {
      sinc.enfileirar(RECURSO, 'editar', 7, { id: 7, nome: 'Editada offline' });
      const cache = [{ id: 7, nome: 'Editada offline' }];
      const servidor = [{ id: 7, nome: 'Versão do servidor' }];

      const resultado = sinc.mesclar(RECURSO, cache, servidor);

      expect(resultado).toEqual([{ id: 7, nome: 'Editada offline' }]);
    });

    it('sem nada pendente, o servidor manda', () => {
      const resultado = sinc.mesclar(RECURSO, [{ id: 7, nome: 'Antiga' }], [
        { id: 7, nome: 'Atual' },
      ]);

      expect(resultado).toEqual([{ id: 7, nome: 'Atual' }]);
    });
  });
});
