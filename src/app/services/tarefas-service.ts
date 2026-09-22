import { Injectable } from '@angular/core';
import { Etapa, MudancaEtapa, Tarefa } from '../models/tarefa';
import type { TipoCadastro } from '../models/item-cadastro';
import { SincronizacaoService } from './sincronizacao-service';
import { TarefasApi } from './tarefas-api';
import { hojeISO } from './datas';

export const RECURSO_TAREFAS = 'tarefas';

const CHAVE = 'tarefas-cache';

// qual campo da tarefa guarda o nome de cada lista de cadastro
const CAMPO: Record<TipoCadastro, 'area' | 'tipo' | 'objetivo'> = {
  areas: 'area',
  tipos: 'tipo',
  objetivos: 'objetivo',
};

/**
 * O histórico com a tarefa entrando em `etapa` no dia `hoje`.
 *
 * Idas e vindas no mesmo dia viram no máximo uma entrada por etapa, com a
 * etapa em que o dia terminou por último. Para o calendário basta saber por
 * quais etapas a tarefa passou naquele dia e em qual ela ficou; sem juntar,
 * arrastar o card de um lado para o outro faria a lista crescer sem fim.
 */
export function registrarEtapa(historico: MudancaEtapa[], etapa: Etapa, hoje: string): MudancaEtapa[] {
  if (historico[historico.length - 1]?.etapa === etapa) {
    return historico;
  }

  const antes = historico.filter((mudanca) => mudanca.data !== hoje);
  const doDia = [...historico.filter((mudanca) => mudanca.data === hoje), { etapa, data: hoje }];

  // a primeira vez de cada etapa no dia, com a de agora indo para o fim
  const etapasDoDia = [...new Set(doDia.map((mudanca) => mudanca.etapa))].filter((e) => e !== etapa);
  const juntas = [...etapasDoDia, etapa].map((e) => ({ etapa: e, data: hoje }));

  // continuar na etapa em que o dia anterior terminou não é mudança
  if (juntas[0].etapa === antes[antes.length - 1]?.etapa) {
    juntas.shift();
  }

  return [...antes, ...juntas];
}

@Injectable({
  providedIn: 'root',
})
export class TarefasService {
  constructor(
    private sincronizacao: SincronizacaoService,
    private api: TarefasApi,
  ) {
    this.sincronizacao.registrar(RECURSO_TAREFAS, {
      criar: (dados) => this.api.criar(dados as Tarefa),
      editar: (dados) => this.api.editar(dados as Tarefa),
      apagar: (id) => this.api.apagar(id),
      aoTrocarId: (idLocal, idServidor) => this.trocarId(idLocal, idServidor),
    });
  }

  // busca no servidor e junta com o que ainda está na fila
  async carregarDoServidor(): Promise<void> {
    await this.sincronizacao.sincronizar();

    try {
      const doServidor = await this.api.listar();
      this.guardar(this.sincronizacao.mesclar(RECURSO_TAREFAS, this.listar(), doServidor));
    } catch {
      // sem servidor: segue com o cache do aparelho
    }
  }

  private trocarId(idLocal: number, idServidor: number): void {
    const tarefas = this.listar();
    const tarefa = tarefas.find((item) => item.id === idLocal);

    if (tarefa) {
      tarefa.id = idServidor;
      this.guardar(tarefas);
    }
  }

  listar(): Tarefa[] {
    const salvas = localStorage.getItem(CHAVE);

    // sem exemplos na primeira vez: a agenda é pessoal, e exemplo com data
    // fixa envelheceria e subiria para o servidor como se fosse tarefa de verdade
    if (!salvas) {
      return [];
    }

    // todo campo que entrar depois precisa de valor padrão aqui: quem já tinha
    // tarefa salva traz o campo ausente, e todo uso adiante quebraria no undefined
    return (JSON.parse(salvas) as Tarefa[]).map((tarefa) => ({
      ...tarefa,
      titulo: tarefa.titulo ?? '',
      diasPulados: tarefa.diasPulados ?? [],
      aprendizado: tarefa.aprendizado ?? '',
      historicoEtapas: tarefa.historicoEtapas ?? [],
    }));
  }

  salvar(tarefa: Tarefa): void {
    const tarefas = this.listar();
    const index = tarefas.findIndex((t) => t.id === tarefa.id);

    // comparado com o cache, e não com a tela: formulário e quadro mexem na
    // etapa antes de chegar aqui, então só o guardado sabe qual era a anterior
    const anterior = tarefas[index];
    if (!anterior || anterior.etapa !== tarefa.etapa) {
      tarefa.historicoEtapas = registrarEtapa(anterior?.historicoEtapas ?? [], tarefa.etapa, hojeISO());
    }

    if (index === -1) {
      // negativo: nunca colide com o autoincremento do banco
      tarefa.id = -Date.now();
      tarefas.push(tarefa);
      this.sincronizacao.enfileirar(RECURSO_TAREFAS, 'criar', tarefa.id, tarefa);
    } else {
      tarefas[index] = tarefa;
      this.registrarEdicao(tarefa);
    }

    this.guardar(tarefas);
  }

  registrarEdicao(tarefa: Tarefa): void {
    const criacao = this.sincronizacao.criacaoPendente(RECURSO_TAREFAS, tarefa.id);

    if (criacao) {
      // ainda não existe no servidor: atualiza o conteúdo da criação pendente
      this.sincronizacao.atualizarDados(criacao.id, tarefa);
    } else {
      this.sincronizacao.enfileirar(RECURSO_TAREFAS, 'editar', tarefa.id, tarefa);
    }
  }

  apagar(id: number): void {
    this.guardar(this.listar().filter((t) => t.id !== id));

    const naoEnviada = !!this.sincronizacao.criacaoPendente(RECURSO_TAREFAS, id);
    this.sincronizacao.removerDoRegistro(RECURSO_TAREFAS, id);

    if (!naoEnviada) {
      this.sincronizacao.enfileirar(RECURSO_TAREFAS, 'apagar', id);
    }
  }

  /**
   * Guarda a ordem dos cards depois de arrastar no quadro.
   *
   * A ordem é só posição na tela: fica no aparelho e não vai para a fila. As
   * tarefas que não vieram na lista (escondidas pelo filtro de objetivo) vão
   * para o fim, na ordem em que já estavam — sobrescrever o cache só com as
   * visíveis apagaria as outras.
   */
  reordenar(ids: number[]): void {
    const posicao = new Map(ids.map((id, indice) => [id, indice]));
    const fim = ids.length;

    this.guardar(
      [...this.listar()].sort(
        (a, b) => (posicao.get(a.id) ?? fim) - (posicao.get(b.id) ?? fim),
      ),
    );
  }

  /**
   * Um item do cadastro foi renomeado: as tarefas que usavam o nome antigo
   * acompanham.
   *
   * Cada tarefa alterada entra na fila como edição. Mudar só o cache não
   * bastaria: o próximo carregarDoServidor traria de volta a versão do
   * servidor, com o nome antigo, se a renomeação do cadastro não tivesse
   * passado (bug que o app da banana tem e que aqui fica corrigido).
   */
  atualizarReferencia(tipo: TipoCadastro, antigo: string, novo: string): void {
    const campo = CAMPO[tipo];
    const tarefas = this.listar();
    const alteradas = tarefas.filter((tarefa) => tarefa[campo] === antigo);

    if (alteradas.length === 0) {
      return;
    }

    alteradas.forEach((tarefa) => (tarefa[campo] = novo));
    this.guardar(tarefas);
    alteradas.forEach((tarefa) => this.registrarEdicao(tarefa));
  }

  private guardar(tarefas: Tarefa[]): void {
    localStorage.setItem(CHAVE, JSON.stringify(tarefas));
  }
}
