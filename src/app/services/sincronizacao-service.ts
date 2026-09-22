import { Injectable } from '@angular/core';

export type TipoOperacao = 'criar' | 'editar' | 'apagar';

export interface Operacao {
  // id da operação em si, não do registro
  id: string;
  recurso: string;
  tipo: TipoOperacao;
  // id do registro no cache local; negativo = criado offline, ainda sem id do servidor
  idLocal: number;
  dados?: unknown;
  // quantas vezes o SERVIDOR já respondeu erro para esta operação.
  // Falha de rede não conta: ficar offline uma semana não pode descartar nada.
  tentativas?: number;
}

export interface HandlerSincronizacao {
  // devolve o id que o servidor atribuiu
  criar(dados: unknown): Promise<number>;
  editar(dados: unknown): Promise<void>;
  apagar(id: number): Promise<void>;
  // chamado quando o registro criado offline recebe o id definitivo
  aoTrocarId(idLocal: number, idServidor: number): void;
}

const CHAVE_FILA = 'fila-sincronizacao';
const CHAVE_DESCARTADAS = 'sincronizacao-descartadas';

// quantas respostas de erro do servidor (5xx) uma operação aguenta antes de ser
// dada como perdida. Sem esse teto, um payload que o servidor nunca aceita vira
// uma "poison message": retenta a cada 30s para sempre e trava a fila inteira,
// porque o laço para na primeira falha para preservar a ordem das operações.
const LIMITE_TENTATIVAS = 5;

/**
 * Fila de operações pendentes (outbox).
 *
 * Toda alteração é aplicada no cache local na hora e entra nesta fila.
 * A fila só perde um item quando o servidor confirma, então nada se perde
 * se a internet cair no meio ou o app for fechado.
 */
@Injectable({
  providedIn: 'root',
})
export class SincronizacaoService {
  private handlers = new Map<string, HandlerSincronizacao>();
  private sincronizando = false;
  private retentativa: ReturnType<typeof setTimeout> | null = null;

  constructor() {
    // quando a conexão volta, tenta enviar o que ficou parado
    window.addEventListener('online', () => this.sincronizar());
  }

  /**
   * Sobrou coisa na fila (sem internet, ou o servidor pediu calma com um 429):
   * marca nova tentativa. Sem isso a fila ficaria parada até o usuário navegar
   * ou fazer outra ação, o que pode não acontecer tão cedo.
   */
  private agendarRetentativa(): void {
    if (this.retentativa) {
      return;
    }

    this.retentativa = setTimeout(() => {
      this.retentativa = null;
      this.sincronizar();
    }, 30_000);
  }

  registrar(recurso: string, handler: HandlerSincronizacao): void {
    this.handlers.set(recurso, handler);
  }

  fila(): Operacao[] {
    const salva = localStorage.getItem(CHAVE_FILA);
    return salva ? JSON.parse(salva) : [];
  }

  enfileirar(recurso: string, tipo: TipoOperacao, idLocal: number, dados?: unknown): void {
    const fila = this.fila();

    fila.push({
      id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      recurso,
      tipo,
      idLocal,
      dados,
    });

    this.guardar(fila);
  }

  // criação daquele registro que ainda não foi enviada
  criacaoPendente(recurso: string, idLocal: number): Operacao | undefined {
    return this.fila().find(
      (op) => op.recurso === recurso && op.idLocal === idLocal && op.tipo === 'criar',
    );
  }

  // editar algo que ainda nem foi criado no servidor: troca o conteúdo da
  // criação pendente, em vez de enfileirar uma edição que chegaria antes
  atualizarDados(operacaoId: string, dados: unknown): void {
    const fila = this.fila();
    const op = fila.find((item) => item.id === operacaoId);

    if (op) {
      op.dados = dados;
      this.guardar(fila);
    }
  }

  /**
   * Troca o valor de um campo dentro dos payloads que ainda estão na fila.
   *
   * Serve para quando um registro referenciado ganha o id definitivo: uma venda
   * criada offline aponta para o comprador pelo id temporário negativo, e
   * enviá-la assim seria recusada pelo servidor.
   */
  substituirValorNaFila(recurso: string, campo: string, antigo: unknown, novo: unknown): void {
    const fila = this.fila();
    let mudou = false;

    fila.forEach((op) => {
      const dados = op.dados as Record<string, unknown> | undefined;

      if (op.recurso === recurso && dados && dados[campo] === antigo) {
        dados[campo] = novo;
        mudou = true;
      }
    });

    if (mudou) {
      this.guardar(fila);
    }
  }

  // tudo que está na fila para aquele registro (usado ao apagar algo não enviado)
  removerDoRegistro(recurso: string, idLocal: number): void {
    this.guardar(this.fila().filter((op) => !(op.recurso === recurso && op.idLocal === idLocal)));
  }

  idsComOperacao(recurso: string, tipo: TipoOperacao): number[] {
    return this.fila()
      .filter((op) => op.recurso === recurso && op.tipo === tipo)
      .map((op) => op.idLocal);
  }

  temPendencia(recurso: string, idLocal: number): boolean {
    return this.fila().some((op) => op.recurso === recurso && op.idLocal === idLocal);
  }

  /**
   * Junta o que veio do servidor com o que ainda está na fila.
   *
   * Regras: o que foi criado offline sobrevive (só existe aqui); o que foi
   * apagado offline não pode reaparecer; e, em conflito, o aparelho vence -
   * havendo edição pendente, ela prevalece sobre a versão do servidor.
   */
  mesclar<T extends { id?: number }>(recurso: string, cache: T[], doServidor: T[]): T[] {
    const naoEnviados = cache.filter((item) => this.criacaoPendente(recurso, item.id!));
    const apagados = this.idsComOperacao(recurso, 'apagar');
    const editados = this.idsComOperacao(recurso, 'editar');

    const doServidorValidos = doServidor
      .filter((item) => !apagados.includes(item.id!))
      .map((item) => {
        if (!editados.includes(item.id!)) {
          return item;
        }

        return cache.find((local) => local.id === item.id) ?? item;
      });

    return [...naoEnviados, ...doServidorValidos];
  }

  async sincronizar(): Promise<{ enviadas: number; pendentes: number }> {
    if (this.sincronizando || !navigator.onLine) {
      return { enviadas: 0, pendentes: this.fila().length };
    }

    this.sincronizando = true;
    let enviadas = 0;

    try {
      for (const op of this.fila()) {
        const handler = this.handlers.get(op.recurso);

        // recurso ainda sem backend: fica na fila esperando existir
        if (!handler) {
          continue;
        }

        try {
          if (op.tipo === 'criar') {
            const idServidor = await handler.criar(op.dados);
            handler.aoTrocarId(op.idLocal, idServidor);
            this.trocarIdNaFila(op.recurso, op.idLocal, idServidor);
          } else if (op.tipo === 'editar') {
            await handler.editar(op.dados);
          } else {
            await handler.apagar(op.idLocal);
          }

          this.remover(op.id);
          enviadas++;
        } catch (erro) {
          if (this.recusaDefinitiva(erro)) {
            // o servidor rejeitou o conteúdo: tentar de novo daria no mesmo e
            // a operação travaria a fila para sempre
            this.remover(op.id);
            this.registrarDescartada(op);
            continue;
          }

          // o servidor respondeu, mas quebrou (5xx). Pode ser instabilidade
          // passageira, então ainda vale retentar - só que com teto, senão um
          // erro que nunca passa segura todas as operações atrás desta.
          if (this.erroDoServidor(erro) && this.contarTentativa(op.id) >= LIMITE_TENTATIVAS) {
            this.remover(op.id);
            this.registrarDescartada(op);
            continue;
          }

          // provavelmente sem conexão: mantém na fila e para por aqui, porque
          // as próximas operações podem depender desta ter passado
          break;
        }
      }
    } finally {
      this.sincronizando = false;
    }

    const pendentes = this.fila().length;

    if (pendentes > 0 && navigator.onLine) {
      this.agendarRetentativa();
    }

    return { enviadas, pendentes };
  }

  // erro do lado do cliente (dado inválido, registro que não existe mais).
  // 401, 408 e 429 ficam de fora: valem nova tentativa depois.
  private recusaDefinitiva(erro: unknown): boolean {
    const status = (erro as { status?: number })?.status;

    if (!status) {
      return false;
    }

    return status >= 400 && status < 500 && ![401, 408, 429].includes(status);
  }

  // o servidor respondeu e quebrou. Sem status é falha de rede, que não conta.
  private erroDoServidor(erro: unknown): boolean {
    const status = (erro as { status?: number })?.status;
    return !!status && status >= 500;
  }

  // registra mais uma resposta de erro do servidor e devolve o total
  private contarTentativa(operacaoId: string): number {
    const fila = this.fila();
    const op = fila.find((item) => item.id === operacaoId);

    if (!op) {
      return 0;
    }

    op.tentativas = (op.tentativas ?? 0) + 1;
    this.guardar(fila);

    return op.tentativas;
  }

  // guarda o que foi descartado, para não sumir sem deixar rastro
  private registrarDescartada(op: Operacao): void {
    const salvas = localStorage.getItem(CHAVE_DESCARTADAS);
    const descartadas: Operacao[] = salvas ? JSON.parse(salvas) : [];

    descartadas.push(op);
    localStorage.setItem(CHAVE_DESCARTADAS, JSON.stringify(descartadas));
  }

  descartadas(): Operacao[] {
    const salvas = localStorage.getItem(CHAVE_DESCARTADAS);
    return salvas ? JSON.parse(salvas) : [];
  }

  private trocarIdNaFila(recurso: string, idLocal: number, idServidor: number): void {
    const fila = this.fila();

    fila.forEach((op) => {
      if (op.recurso === recurso && op.idLocal === idLocal) {
        op.idLocal = idServidor;

        if (op.dados && typeof op.dados === 'object') {
          (op.dados as { id?: number }).id = idServidor;
        }
      }
    });

    this.guardar(fila);
  }

  private remover(operacaoId: string): void {
    this.guardar(this.fila().filter((op) => op.id !== operacaoId));
  }

  private guardar(fila: Operacao[]): void {
    localStorage.setItem(CHAVE_FILA, JSON.stringify(fila));
  }
}
