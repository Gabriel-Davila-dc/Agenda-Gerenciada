import { Injectable } from '@angular/core';
import { Nota } from '../models/nota';
import { SincronizacaoService } from './sincronizacao-service';
import { NotasApi } from './notas-api';

export const RECURSO_NOTAS = 'notas';

const CHAVE = 'notas-cache';

@Injectable({
  providedIn: 'root',
})
export class NotasService {
  constructor(
    private sincronizacao: SincronizacaoService,
    private api: NotasApi,
  ) {
    this.sincronizacao.registrar(RECURSO_NOTAS, {
      criar: (dados) => this.api.criar(dados as Nota),
      editar: (dados) => this.api.editar(dados as Nota),
      apagar: (id) => this.api.apagar(id),
      aoTrocarId: (idLocal, idServidor) => this.trocarId(idLocal, idServidor),
    });
  }

  async carregarDoServidor(): Promise<void> {
    await this.sincronizacao.sincronizar();

    try {
      const doServidor = await this.api.listar();
      this.guardar(this.sincronizacao.mesclar(RECURSO_NOTAS, this.listar(), doServidor));
    } catch {
      // sem servidor: segue com o cache do aparelho
    }
  }

  listar(): Nota[] {
    const salvas = localStorage.getItem(CHAVE);
    return salvas ? JSON.parse(salvas) : [];
  }

  // a primeira da lista vence: a criada offline vem antes da do servidor
  // (é assim que o mesclar monta), e em conflito o aparelho vence
  doDia(data: string): Nota | undefined {
    return this.listar().find((nota) => nota.data === data);
  }

  /**
   * Grava o diário de um dia.
   *
   * O dia é a chave: se já tem nota nele, edita a que existe em vez de criar
   * outra. Texto vazio apaga — uma nota em branco só ocuparia o dia.
   */
  salvarDoDia(data: string, texto: string): void {
    const limpo = texto.trim();
    const notas = this.listar();
    const existente = notas.find((nota) => nota.data === data);

    if (!limpo) {
      if (existente) {
        this.apagar(existente.id);
      }

      return;
    }

    if (existente) {
      existente.texto = limpo;
      this.guardar(notas);
      this.registrarEdicao(existente);
      return;
    }

    const nova: Nota = { id: -Date.now(), data, texto: limpo };
    this.guardar([...notas, nova]);
    this.sincronizacao.enfileirar(RECURSO_NOTAS, 'criar', nova.id, nova);
  }

  apagar(id: number): void {
    this.guardar(this.listar().filter((nota) => nota.id !== id));

    const naoEnviada = !!this.sincronizacao.criacaoPendente(RECURSO_NOTAS, id);
    this.sincronizacao.removerDoRegistro(RECURSO_NOTAS, id);

    if (!naoEnviada) {
      this.sincronizacao.enfileirar(RECURSO_NOTAS, 'apagar', id);
    }
  }

  private registrarEdicao(nota: Nota): void {
    const criacao = this.sincronizacao.criacaoPendente(RECURSO_NOTAS, nota.id);

    if (criacao) {
      this.sincronizacao.atualizarDados(criacao.id, nota);
    } else {
      this.sincronizacao.enfileirar(RECURSO_NOTAS, 'editar', nota.id, nota);
    }
  }

  /**
   * A nota criada offline ganhou o id do servidor.
   *
   * Esse id pode ser de uma nota que já está no cache: o servidor junta as
   * notas do mesmo dia, então a escrita aqui pode ter caído na que veio do
   * outro aparelho. Sem tirar a antiga, o dia ficaria com duas notas iguais.
   */
  private trocarId(idLocal: number, idServidor: number): void {
    const notas = this.listar();
    const nota = notas.find((item) => item.id === idLocal);

    if (nota) {
      nota.id = idServidor;
      this.guardar(notas.filter((item) => item === nota || item.id !== idServidor));
    }
  }

  private guardar(notas: Nota[]): void {
    localStorage.setItem(CHAVE, JSON.stringify(notas));
  }
}
