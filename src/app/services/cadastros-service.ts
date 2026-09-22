import { Injectable } from '@angular/core';
import { ItemCadastro, TipoCadastro } from '../models/item-cadastro';
import { SincronizacaoService } from './sincronizacao-service';
import { CadastrosApi } from './cadastros-api';

export type { TipoCadastro } from '../models/item-cadastro';

export const RECURSO_CADASTROS = 'cadastros';

const CHAVE = 'cadastros-cache';

/**
 * Listas iniciais, pra tela não abrir vazia. O usuário pode apagar e criar as dele.
 *
 * Objetivos começam vazios de propósito: são pessoais, e um exemplo inventado
 * apareceria no filtro da agenda como se fosse meta de verdade.
 */
const PADROES: Record<TipoCadastro, string[]> = {
  areas: ['Casa', 'Estudo', 'Finanças', 'Pessoal', 'Saúde', 'Trabalho'],
  tipos: ['Hábito', 'Leitura', 'Projeto', 'Revisão', 'Tarefa'],
  objetivos: [],
};

@Injectable({
  providedIn: 'root',
})
export class CadastrosService {
  constructor(
    private sincronizacao: SincronizacaoService,
    private api: CadastrosApi,
  ) {
    this.sincronizacao.registrar(RECURSO_CADASTROS, {
      criar: (dados) => this.api.criar(dados as ItemCadastro),
      editar: (dados) => this.api.editar(dados as ItemCadastro),
      apagar: (id) => this.api.apagar(id),
      aoTrocarId: (idLocal, idServidor) => this.trocarId(idLocal, idServidor),
    });
  }

  // ----- leitura (síncrona, direto do cache) -----

  listar(tipo: TipoCadastro): ItemCadastro[] {
    const itens = this.cache().filter((item) => item.tipo === tipo);
    return itens.sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR'));
  }

  // para os campos que só precisam do nome
  listarNomes(tipo: TipoCadastro): string[] {
    return this.listar(tipo).map((item) => item.nome);
  }

  // ----- escrita -----

  adicionar(tipo: TipoCadastro, nome: string): ItemCadastro[] {
    const limpo = nome.trim();

    if (!limpo) {
      return this.listar(tipo);
    }

    // compara sem diferenciar maiúscula, senão "Estudo" e "estudo" viram dois
    const jaExiste = this.listar(tipo).some(
      (item) => item.nome.toLowerCase() === limpo.toLowerCase(),
    );

    if (!jaExiste) {
      const novo: ItemCadastro = { id: -Date.now(), tipo, nome: limpo };

      this.guardar([...this.cache(), novo]);
      this.sincronizacao.enfileirar(RECURSO_CADASTROS, 'criar', novo.id, novo);
    }

    return this.listar(tipo);
  }

  renomear(tipo: TipoCadastro, id: number, novoNome: string): ItemCadastro[] {
    const nome = novoNome.trim();
    const cache = this.cache();
    const item = cache.find((registro) => registro.id === id);

    if (!nome || !item || item.nome === nome) {
      return this.listar(tipo);
    }

    // renomeou para um nome que já existe: junta os dois, tirando este
    const duplicado = cache.find(
      (registro) =>
        registro.tipo === tipo &&
        registro.id !== id &&
        registro.nome.toLowerCase() === nome.toLowerCase(),
    );

    if (duplicado) {
      return this.remover(tipo, id);
    }

    item.nome = nome;
    this.guardar(cache);

    const criacao = this.sincronizacao.criacaoPendente(RECURSO_CADASTROS, id);

    if (criacao) {
      // ainda não existe no servidor: muda o conteúdo da criação pendente
      this.sincronizacao.atualizarDados(criacao.id, item);
    } else {
      this.sincronizacao.enfileirar(RECURSO_CADASTROS, 'editar', id, item);
    }

    return this.listar(tipo);
  }

  remover(tipo: TipoCadastro, id: number): ItemCadastro[] {
    this.guardar(this.cache().filter((item) => item.id !== id));

    const naoEnviado = !!this.sincronizacao.criacaoPendente(RECURSO_CADASTROS, id);
    this.sincronizacao.removerDoRegistro(RECURSO_CADASTROS, id);

    if (!naoEnviado) {
      this.sincronizacao.enfileirar(RECURSO_CADASTROS, 'apagar', id);
    }

    return this.listar(tipo);
  }

  // ----- servidor -----

  async carregarDoServidor(): Promise<void> {
    await this.sincronizacao.sincronizar();

    try {
      const doServidor = await this.api.listar();
      this.guardar(this.sincronizacao.mesclar(RECURSO_CADASTROS, this.cache(), doServidor));
    } catch {
      // sem servidor: segue com o cache do aparelho
    }
  }

  // ----- interno -----

  private trocarId(idLocal: number, idServidor: number): void {
    const cache = this.cache();
    const item = cache.find((registro) => registro.id === idLocal);

    if (item) {
      item.id = idServidor;
      this.guardar(cache);
    }
  }

  private cache(): ItemCadastro[] {
    const salvo = localStorage.getItem(CHAVE);

    if (salvo) {
      return JSON.parse(salvo);
    }

    // primeira vez: semeia os padrões como itens criados offline. Se outro
    // aparelho já semeou, o servidor devolve o que existe em vez de duplicar.
    const iniciais: ItemCadastro[] = [];

    (Object.keys(PADROES) as TipoCadastro[]).forEach((tipo) => {
      PADROES[tipo].forEach((nome) => {
        iniciais.push({ id: -(Date.now() + iniciais.length), tipo, nome });
      });
    });

    this.guardar(iniciais);
    iniciais.forEach((item) =>
      this.sincronizacao.enfileirar(RECURSO_CADASTROS, 'criar', item.id, item),
    );

    return iniciais;
  }

  private guardar(itens: ItemCadastro[]): void {
    localStorage.setItem(CHAVE, JSON.stringify(itens));
  }
}
