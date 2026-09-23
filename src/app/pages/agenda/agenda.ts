import { ChangeDetectorRef, Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { MatIconModule } from '@angular/material/icon';
import {
  CdkDragDrop,
  DragDropModule,
  moveItemInArray,
  transferArrayItem,
} from '@angular/cdk/drag-drop';

import { ETAPAS, Etapa, Tarefa, classeEtapa, tarefaVazia } from '../../models/tarefa';
import { Nota } from '../../models/nota';
import { Aprendizado, DiaDeAprendizado } from '../../models/aprendizado';
import { OpcaoSeletor, Seletor } from '../../components/seletor/seletor';
import { Aprendizados } from '../../components/aprendizados/aprendizados';
import { TarefasService } from '../../services/tarefas-service';
import { NotasService } from '../../services/notas-service';
import { CadastrosService } from '../../services/cadastros-service';
import {
  aconteceEm,
  dataParaIso,
  diaMes,
  diasDaTarefa,
  esteveNaEtapa,
  hojeISO,
  isoParaBR,
  isoParaData,
  rotuloDaSemana,
  rotuloDoDia,
  rotuloDoMes,
  segundaDa,
  somarDias,
} from '../../services/datas';

interface Coluna {
  etapa: Etapa;
  tarefas: Tarefa[];
}

export type VisaoAgenda = 'calendario' | 'quadro' | 'aprendizados';

interface DiaCalendario {
  iso: string;
  numero: number;
  diaSemana: string;
  hoje: boolean;
  tarefas: Tarefa[];
  nota: Nota | null;
}

interface SemanaCalendario {
  dias: DiaCalendario[];
  contemHoje: boolean;
  // preenchido só quando a semana começa um mês novo, para virar cabeçalho
  rotuloMes: string | null;
  // "8 a 14 de setembro": cabeçalho de cada semana na agenda do celular, onde
  // não existe grade de 7 colunas dizendo sozinha onde a semana termina
  rotuloSemana: string;
}

// o diário aberto no formulário: a nota é do dia, então o dia vem sempre junto
export interface NotaEditando {
  data: string;
  texto: string;
  existe: boolean;
}

const DIAS_SEMANA = ['SEG', 'TER', 'QUA', 'QUI', 'SEX', 'SAB', 'DOM'];

// quanto o calendário mostra além da semana atual, e quanto cresce por clique
const SEMANAS_ADIANTE = 8;
const SEMANAS_POR_CLIQUE = 4;

// o filtro de objetivo é conveniência de quem usa: fica só neste aparelho
const CHAVE_FILTRO = 'agenda-filtro-objetivo';
const CHAVE_SO_FAZENDO = 'agenda-filtro-fazendo';

@Component({
  standalone: true,
  selector: 'app-agenda',
  imports: [
    CommonModule,
    RouterModule,
    FormsModule,
    MatIconModule,
    DragDropModule,
    Seletor,
    Aprendizados,
  ],
  templateUrl: './agenda.html',
  styleUrl: './agenda.css',
})
export class Agenda {
  colunas: Coluna[] = [];
  protected etapas = ETAPAS;
  protected classeEtapa = classeEtapa;
  protected isoParaBR = isoParaBR;
  protected rotuloDoDia = rotuloDoDia;

  // null = formulário fechado
  editando: Tarefa | null = null;
  notaEditando: NotaEditando | null = null;

  /**
   * Calendário é o padrão.
   *
   * O quadro continua existindo porque mostra o andamento por etapa, mas no
   * celular ele exige rolagem lateral e um arrastar entre colunas fora da
   * tela — gesto que praticamente não se completa no dedo.
   */
  visao: VisaoAgenda = 'calendario';

  /**
   * De qual dia do calendário o formulário foi aberto.
   *
   * É o que permite "tirar só deste dia": pelo quadro e pelos aprendizados
   * não existe dia nenhum em jogo, então lá fica null e o botão não aparece.
   */
  diaClicado: string | null = null;

  semanas: SemanaCalendario[] = [];
  // quantas semanas antes da atual já foram carregadas
  private semanasAntes = 1;

  aprendizados: DiaDeAprendizado[] = [];

  // '' = todos os objetivos
  filtroObjetivo = localStorage.getItem(CHAVE_FILTRO) ?? '';
  progresso = { feitas: 0, total: 0 };

  /**
   * Calendário do que foi feito, não do que foi planejado.
   *
   * Ligado, cada tarefa aparece nos dias em que esteve em Fazendo (pelo
   * histórico de etapas), e não nos dias de início a fim.
   */
  soFazendo = localStorage.getItem(CHAVE_SO_FAZENDO) === '1';

  areas: string[] = [];
  tipos: string[] = [];
  objetivos: string[] = [];
  opcoesFiltro: OpcaoSeletor[] = [];

  constructor(
    private tarefasService: TarefasService,
    private notasService: NotasService,
    private cadastros: CadastrosService,
    private cd: ChangeDetectorRef,
  ) {
    // mostra o cache na hora e busca o servidor em seguida
    this.carregarCadastros();
    this.carregar();
    this.sincronizar();
  }

  private async sincronizar(): Promise<void> {
    await this.cadastros.carregarDoServidor();
    await this.tarefasService.carregarDoServidor();
    await this.notasService.carregarDoServidor();

    this.carregarCadastros();
    this.carregar();

    // zoneless: o que muda depois do await não é percebido sozinho
    this.cd.markForCheck();
  }

  carregarCadastros(): void {
    this.areas = this.cadastros.listarNomes('areas');
    this.tipos = this.cadastros.listarNomes('tipos');
    this.objetivos = this.cadastros.listarNomes('objetivos');

    // um objetivo que saiu do cadastro continua filtrável enquanto estiver escolhido
    const nomes =
      this.filtroObjetivo && !this.objetivos.includes(this.filtroObjetivo)
        ? [this.filtroObjetivo, ...this.objetivos]
        : this.objetivos;

    this.opcoesFiltro = [
      { valor: '', rotulo: 'Todos os objetivos' },
      ...nomes.map((nome) => ({ valor: nome, rotulo: nome })),
    ];
  }

  /**
   * Opções de um campo de lista no formulário.
   *
   * "Nenhum" vem primeiro: nenhum dos três campos é obrigatório, e sem essa
   * opção não haveria como desfazer uma escolha. E se a tarefa foi salva com
   * um valor que depois saiu do cadastro, ele continua na lista para não sumir
   * calado ao editar.
   */
  opcoes(lista: string[], atual: string): OpcaoSeletor[] {
    const nomes = atual && !lista.includes(atual) ? [atual, ...lista] : lista;

    return [{ valor: '', rotulo: 'Nenhum' }, ...nomes.map((nome) => ({ valor: nome, rotulo: nome }))];
  }

  carregar(): void {
    const todas = this.tarefasService.listar();
    const tarefas = this.filtroObjetivo
      ? todas.filter((tarefa) => tarefa.objetivo === this.filtroObjetivo)
      : todas;
    const notas = this.notasService.listar();

    this.colunas = ETAPAS.map((etapa) => ({
      etapa,
      tarefas: tarefas.filter((tarefa) => tarefa.etapa === etapa),
    }));

    this.progresso = {
      feitas: tarefas.filter((tarefa) => tarefa.etapa === 'Feito').length,
      total: tarefas.length,
    };

    // o diário é do dia, não de um objetivo: no calendário ele aparece sempre,
    // mas nos aprendizados filtrados sobra só o que veio das tarefas
    this.montarCalendario(tarefas, notas);
    this.montarAprendizados(tarefas, this.filtroObjetivo ? [] : notas);
  }

  filtrar(objetivo: string): void {
    this.filtroObjetivo = objetivo ?? '';
    localStorage.setItem(CHAVE_FILTRO, this.filtroObjetivo);
    this.carregar();
  }

  alternarSoFazendo(): void {
    this.soFazendo = !this.soFazendo;
    localStorage.setItem(CHAVE_SO_FAZENDO, this.soFazendo ? '1' : '0');
    this.carregar();
  }

  get percentualFeito(): number {
    return this.progresso.total
      ? Math.round((this.progresso.feitas / this.progresso.total) * 100)
      : 0;
  }

  trocarVisao(visao: VisaoAgenda): void {
    this.visao = visao;
  }

  // ---------- calendário ----------

  carregarSemanaAnterior(): void {
    this.semanasAntes += SEMANAS_POR_CLIQUE;
    this.carregar();
  }

  private montarCalendario(tarefas: Tarefa[], notas: Nota[]): void {
    const hojeIso = hojeISO();
    const inicio = somarDias(segundaDa(isoParaData(hojeIso)), -7 * this.semanasAntes);

    // a primeira vence, igual ao doDia do service: a criada offline vem antes
    const notaDoDia = new Map<string, Nota>();
    notas.forEach((nota) => {
      if (!notaDoDia.has(nota.data)) {
        notaDoDia.set(nota.data, nota);
      }
    });

    const total = this.semanasAntes + SEMANAS_ADIANTE;
    const semanas: SemanaCalendario[] = [];
    let mesAnterior = -1;

    for (let s = 0; s < total; s++) {
      const segunda = somarDias(inicio, s * 7);
      const dias: DiaCalendario[] = [];

      for (let d = 0; d < 7; d++) {
        const data = somarDias(segunda, d);
        const iso = dataParaIso(data);

        dias.push({
          iso,
          numero: data.getUTCDate(),
          diaSemana: DIAS_SEMANA[d],
          hoje: iso === hojeIso,
          tarefas: tarefas.filter((tarefa) =>
            this.soFazendo
              ? esteveNaEtapa(tarefa, 'Fazendo', iso, hojeIso)
              : aconteceEm(tarefa, iso),
          ),
          nota: notaDoDia.get(iso) ?? null,
        });
      }

      // o cabeçalho do mês sai na primeira semana que começa nele
      const mes = segunda.getUTCMonth();
      const novoMes = mes !== mesAnterior;
      mesAnterior = mes;

      semanas.push({
        dias,
        contemHoje: dias.some((dia) => dia.hoje),
        rotuloMes: novoMes ? rotuloDoMes(segunda) : null,
        rotuloSemana: rotuloDaSemana(segunda, somarDias(segunda, 6)),
      });
    }

    this.semanas = semanas;
  }

  tituloDaEtiqueta(tarefa: Tarefa): string {
    const nome = tarefa.titulo || tarefa.tipo || 'Sem título';
    const objetivo = tarefa.objetivo ? ` — ${tarefa.objetivo}` : '';

    return `${nome}${objetivo} (${tarefa.etapa})`;
  }

  juntar(...partes: string[]): string {
    return partes.filter(Boolean).join(' · ');
  }

  // ---------- aprendizados ----------

  private montarAprendizados(tarefas: Tarefa[], notas: Nota[]): void {
    const porDia = new Map<string, Aprendizado[]>();
    const incluir = (data: string, item: Aprendizado) =>
      porDia.set(data, [...(porDia.get(data) ?? []), item]);

    // o diário entra antes: dentro do dia ele é o resumo, as tarefas vêm depois
    notas.forEach((nota) => {
      if (nota.texto.trim()) {
        incluir(nota.data, {
          chave: `nota-${nota.id}`,
          origem: 'diario',
          titulo: 'Diário do dia',
          detalhe: '',
          texto: nota.texto,
          nota,
        });
      }
    });

    tarefas.forEach((tarefa) => {
      if (!tarefa.aprendizado.trim()) {
        return;
      }

      // a tarefa entra no último dia em que aconteceu: é quando o aprendizado fecha
      const dias = diasDaTarefa(tarefa);

      incluir(dias[dias.length - 1] ?? tarefa.dataInicio, {
        chave: `tarefa-${tarefa.id}`,
        origem: 'tarefa',
        titulo: tarefa.titulo || tarefa.tipo || 'Tarefa',
        detalhe: this.juntar(tarefa.objetivo, tarefa.area),
        texto: tarefa.aprendizado,
        tarefa,
      });
    });

    // do mais recente para o mais antigo; tarefa sem data ('') fica no fim
    this.aprendizados = [...porDia.entries()]
      .sort(([a], [b]) => b.localeCompare(a))
      .map(([data, itens]) => ({ data, rotulo: data ? rotuloDoDia(data) : 'Sem data', itens }));
  }

  abrirAprendizado(item: Aprendizado): void {
    if (item.nota) {
      this.abrirNota(item.nota.data);
    } else if (item.tarefa) {
      this.editar(item.tarefa);
    }
  }

  // ---------- diário ----------

  abrirNota(iso: string): void {
    const nota = this.notasService.doDia(iso);
    this.notaEditando = { data: iso, texto: nota?.texto ?? '', existe: !!nota };
  }

  salvarNota(): void {
    if (!this.notaEditando) {
      return;
    }

    // texto vazio numa nota que existe apaga: o service cuida disso
    this.notasService.salvarDoDia(this.notaEditando.data, this.notaEditando.texto);
    this.fecharNota();
    this.carregar();
  }

  apagarNota(): void {
    if (!this.notaEditando) {
      return;
    }

    this.notasService.salvarDoDia(this.notaEditando.data, '');
    this.fecharNota();
    this.carregar();
  }

  fecharNota(): void {
    this.notaEditando = null;
  }

  // ---------- tirar um dia ----------

  // o botão só faz sentido quando sobra dia: tirar o único dia seria apagar.
  // e o dia precisa ser da tarefa: com "só Fazendo" ligado ela aparece em
  // dias que não são os planejados, e ali não há o que tirar
  get podeTirarDoDia(): boolean {
    if (!this.editando || !this.diaClicado) {
      return false;
    }

    const dias = diasDaTarefa(this.editando);
    return dias.length > 1 && dias.includes(this.diaClicado);
  }

  get rotuloDiaClicado(): string {
    return this.diaClicado ? diaMes(this.diaClicado) : '';
  }

  /**
   * Tira da tarefa só o dia aberto, mantendo o resto do intervalo.
   *
   * Ponta encolhe, meio vira buraco. Guardar "pulei o primeiro dia" deixaria
   * um buraco invisível, que reapareceria torto se depois se esticasse a
   * data. E dias[1] (não início + 1) resolve a ponta vizinha a um dia já
   * pulado: tirar a segunda com a terça pulada leva o início para a quarta.
   */
  tirarDoDia(): void {
    const tarefa = this.editando;

    if (!tarefa || !this.diaClicado) {
      return;
    }

    const dias = diasDaTarefa(tarefa);
    const iso = this.diaClicado;

    if (dias.length <= 1 || !dias.includes(iso)) {
      return;
    }

    if (iso === dias[0]) {
      tarefa.dataInicio = dias[1];
    } else if (iso === dias[dias.length - 1]) {
      tarefa.dataFim = dias[dias.length - 2];
    } else {
      tarefa.diasPulados = [...tarefa.diasPulados, iso].sort();
    }

    // depois de encolher, o que caiu fora do intervalo virou lixo
    const fim = tarefa.dataFim || tarefa.dataInicio;
    tarefa.diasPulados = tarefa.diasPulados.filter(
      (pulado) => pulado > tarefa.dataInicio && pulado < fim,
    );

    this.tarefasService.salvar(tarefa);
    this.fechar();
    this.carregar();
  }

  // ---------- formulário da tarefa ----------

  // tocar num dia já abre o formulário com a data preenchida; com filtro
  // ligado, a tarefa nova já nasce no objetivo que está na tela
  novoNoDia(iso: string): void {
    // tarefa nova não tem o que tirar: o botão do dia fica fora
    this.diaClicado = null;
    this.editando = tarefaVazia(iso, this.filtroObjetivo);
  }

  novo(): void {
    this.novoNoDia(hojeISO());
  }

  // iso vem do calendário, onde o toque aconteceu num dia; do quadro vem vazio
  editar(tarefa: Tarefa, iso?: string): void {
    this.diaClicado = iso ?? null;

    // clone: se cancelar, a tarefa da tela não fica alterada pela metade.
    // o array também é copiado, senão tirar um dia e cancelar já teria mexido
    // na tarefa que está no cache
    this.editando = { ...tarefa, diasPulados: [...(tarefa.diasPulados ?? [])] };
  }

  salvar(): void {
    if (!this.editando) {
      return;
    }

    this.tarefasService.salvar(this.editando);
    this.fechar();
    this.carregar();
  }

  apagar(tarefa: Tarefa): void {
    this.tarefasService.apagar(tarefa.id);
    this.fechar();
    this.carregar();
  }

  fechar(): void {
    this.editando = null;
    this.diaClicado = null;
  }

  // ---------- quadro ----------

  soltar(evento: CdkDragDrop<Tarefa[]>, etapa: Etapa): void {
    const mudouDeEtapa = evento.previousContainer !== evento.container;

    if (mudouDeEtapa) {
      transferArrayItem(
        evento.previousContainer.data,
        evento.container.data,
        evento.previousIndex,
        evento.currentIndex,
      );

      const tarefa = evento.container.data[evento.currentIndex];
      tarefa.etapa = etapa;

      // mudar de etapa é alteração de dado, então vai para a fila
      this.tarefasService.salvar(tarefa);
    } else {
      moveItemInArray(evento.container.data, evento.previousIndex, evento.currentIndex);
    }

    // reordenar dentro da coluna é só posição na tela
    this.tarefasService.reordenar(this.colunas.flatMap((coluna) => coluna.tarefas.map((t) => t.id)));

    if (mudouDeEtapa) {
      // progresso e calendário acompanham a etapa nova
      this.carregar();
    }
  }
}
