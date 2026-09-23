import {
  ChangeDetectorRef,
  Component,
  ElementRef,
  HostListener,
  Injector,
  ViewChild,
  afterNextRender,
  inject,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, RouterModule } from '@angular/router';
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
import { Aprendizados, EscritaNoCaderno } from '../../components/aprendizados/aprendizados';
import { Busca } from '../../components/busca/busca';
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
  MESES,
  rotuloCurtoDoDia,
  rotuloDaSemana,
  rotuloDoDia,
  rotuloDoMes,
  segundaDa,
  somarDias,
} from '../../services/datas';
import { filtrarPorBusca } from '../../services/busca';
import { VisaoAgenda, visaoDaUrl } from './visao';

interface Coluna {
  etapa: Etapa;
  tarefas: Tarefa[];
}

export type { VisaoAgenda };

interface DiaCalendario {
  iso: string;
  numero: number;
  diaSemana: string;
  hoje: boolean;
  fimDeSemana: boolean;
  // "OUT" no dia 1: marca a virada do mês dentro da grade
  mesCurto: string | null;
  tarefas: Tarefa[];
  nota: Nota | null;
}

interface SemanaCalendario {
  dias: DiaCalendario[];
  contemHoje: boolean;
  // preenchido só quando a semana começa um mês novo, para virar cabeçalho
  rotuloMes: string | null;
  // o mesmo cabeçalho em duas partes, para o ano sair apagado ao lado do mês
  nomeMes: string;
  ano: string;
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

const DIAS_SEMANA = ['SEG', 'TER', 'QUA', 'QUI', 'SEX', 'SÁB', 'DOM'];

// quanto o calendário mostra além da semana atual, e quanto cresce por clique
const SEMANAS_ADIANTE = 8;
const SEMANAS_POR_CLIQUE = 4;

// o filtro de objetivo é conveniência de quem usa: fica só neste aparelho
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
    Busca,
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
  protected rotuloCurtoDoDia = rotuloCurtoDoDia;
  protected diasSemana = DIAS_SEMANA;
  // "SETEMBRO DE 2026", em cima da agenda
  protected mesAtual = rotuloDoMes(isoParaData(hojeISO())).toUpperCase();

  // null = formulário fechado
  editando: Tarefa | null = null;
  notaEditando: NotaEditando | null = null;

  /**
   * Calendário é o padrão.
   *
   * O quadro continua existindo porque mostra o andamento por etapa, mas no
   * celular ele exige rolagem lateral e um arrastar entre colunas fora da
   * tela — gesto que praticamente não se completa no dedo.
   *
   * As abas ficam no Header; a visão chega aqui pelo `?visao=` da URL.
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

  // o texto do campo de pesquisa; '' = mostra tudo. Não fica gravado: abrir a
  // agenda com metade das tarefas escondida confundiria
  consulta = '';

  /**
   * O caderno abre um dia por vez: 0 é o mais recente, e folhear para trás
   * aumenta o índice. Os marcadores levam ao dia mais recente de cada mês.
   */
  indiceCaderno = 0;
  mesesCaderno: { chave: string; rotulo: string }[] = [];

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

  constructor(
    private tarefasService: TarefasService,
    private notasService: NotasService,
    private cadastros: CadastrosService,
    private cd: ChangeDetectorRef,
  ) {
    // mostra o cache na hora e busca o servidor em seguida
    inject(ActivatedRoute)
      .queryParamMap.pipe(takeUntilDestroyed())
      .subscribe((params) => {
        this.visao = visaoDaUrl(params.get('visao'));
        this.cd.markForCheck();
        // a lista do calendário só existe na aba dele: mede quando ela aparece
        afterNextRender(() => this.ajustarAltura(), { injector: this.injector });
      });

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
    // a pesquisa filtra as três visões: fica só o que é relevante para ela
    const { tarefas, notas } = filtrarPorBusca(
      this.consulta,
      this.tarefasService.listar(),
      this.notasService.listar(),
    );

    this.colunas = ETAPAS.map((etapa) => ({
      etapa,
      tarefas: tarefas.filter((tarefa) => tarefa.etapa === etapa),
    }));

    this.montarCalendario(tarefas, notas);
    this.montarAprendizados(tarefas, notas);
  }

  pesquisar(consulta: string): void {
    this.consulta = consulta;
    this.carregar();
  }

  alternarSoFazendo(): void {
    this.soFazendo = !this.soFazendo;
    localStorage.setItem(CHAVE_SO_FAZENDO, this.soFazendo ? '1' : '0');
    this.carregar();
  }

  // ---------- calendário ----------

  /**
   * O calendário rola sozinho, abaixo dos nomes SEG TER QUA...; o resto da
   * tela (topo, filtros) fica parado. Só na grade: no celular os dias vêm
   * empilhados e a página inteira rola, que é o gesto natural do dedo.
   */
  @ViewChild('rolagem') rolagem?: ElementRef<HTMLElement>;
  private injector = inject(Injector);
  private ultimoTopo = 0;

  /** Clique no vazio do dia abre tarefa nova nele; tarefa, diário e botões têm o próprio clique. */
  clicarNoDia(evento: MouseEvent, iso: string): void {
    if (!(evento.target as HTMLElement).closest('button')) {
      this.novoNoDia(iso);
    }
  }

  carregarSemanaAnterior(): void {
    this.semanasAntes += SEMANAS_POR_CLIQUE;
    this.carregar();
  }

  /**
   * Chegou no topo rolando para cima: entram as semanas anteriores.
   *
   * Elas entram em cima do que está na tela, então a rolagem é corrigida
   * pela diferença de altura; sem isso a lista pularia para o passado.
   */
  aoRolar(el: HTMLElement): void {
    const subindo = el.scrollTop < this.ultimoTopo;
    this.ultimoTopo = el.scrollTop;
    if (!subindo || el.scrollTop > 40) {
      return;
    }

    const doFim = el.scrollHeight - el.scrollTop;
    this.carregarSemanaAnterior();
    this.cd.markForCheck();
    afterNextRender(
      () => {
        el.scrollTop = el.scrollHeight - doFim;
        this.ultimoTopo = el.scrollTop;
      },
      { injector: this.injector },
    );
  }

  // a lista vai do topo dela até o pé da tela, seja qual for a altura do
  // cabeçalho e dos filtros em cima (que quebram linha em tela estreita)
  @HostListener('window:resize')
  ajustarAltura(): void {
    const el = this.rolagem?.nativeElement;
    if (el) {
      // quem rola a página é o body (styles.css), não a janela
      const rolado = document.body.scrollTop + window.scrollY;
      el.style.setProperty('--topo-rolagem', `${el.getBoundingClientRect().top + rolado}px`);
    }
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
          fimDeSemana: d >= 5,
          mesCurto: data.getUTCDate() === 1 ? rotuloDoMes(data).slice(0, 3).toUpperCase() : null,
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
      const [nomeMes, ano] = rotuloDoMes(segunda).split(' de ');

      semanas.push({
        dias,
        contemHoje: dias.some((dia) => dia.hoje),
        rotuloMes: novoMes ? rotuloDoMes(segunda) : null,
        nomeMes,
        ano,
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

    // o dia aberto pode ter sumido (último aprendizado apagado): volta para dentro
    this.folhear(0);

    // "SET", "AGO"...: um marcador por mês, dos mais recentes, no máximo seis
    const meses = [...new Set(this.aprendizados.map((dia) => dia.data.slice(0, 7)).filter(Boolean))];
    this.mesesCaderno = meses.slice(0, 6).map((chave) => ({
      chave,
      rotulo: MESES[Number(chave.slice(5)) - 1].slice(0, 3).toUpperCase(),
    }));
  }

  get diaCaderno(): DiaDeAprendizado | null {
    return this.aprendizados[this.indiceCaderno] ?? null;
  }

  // numerado do começo, como um caderno de verdade: o dia mais antigo abre nas páginas 1 e 2
  get paginaCaderno(): number {
    return (this.aprendizados.length - this.indiceCaderno) * 2 - 1;
  }

  folhear(passo: number): void {
    this.indiceCaderno = Math.max(0, Math.min(this.indiceCaderno + passo, this.aprendizados.length - 1));
  }

  irParaMes(chave: string): void {
    const indice = this.aprendizados.findIndex((dia) => dia.data.startsWith(chave));
    if (indice >= 0) {
      this.indiceCaderno = indice;
    }
  }

  /** Escrito direto na pauta do caderno: vai pelos services, como o formulário. */
  escreverNoCaderno(escrita: EscritaNoCaderno): void {
    if (escrita.tarefa) {
      this.tarefasService.salvar({ ...escrita.tarefa, aprendizado: escrita.texto });
    } else {
      // texto vazio apaga o diário do dia: o service cuida disso
      this.notasService.salvarDoDia(escrita.data, escrita.texto);
    }
    this.carregar();
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

  // tocar num dia já abre o formulário com a data preenchida
  novoNoDia(iso: string): void {
    // tarefa nova não tem o que tirar: o botão do dia fica fora
    this.diaClicado = null;
    this.editando = tarefaVazia(iso);
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
      // o calendário acompanha a etapa nova
      this.carregar();
    }
  }
}
