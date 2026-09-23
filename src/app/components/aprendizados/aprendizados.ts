import {
  Component,
  ElementRef,
  EventEmitter,
  Injector,
  Input,
  Output,
  ViewChild,
  afterNextRender,
  inject,
} from '@angular/core';
import { MatIconModule } from '@angular/material/icon';

import { Aprendizado, DiaDeAprendizado } from '../../models/aprendizado';
import { Tarefa } from '../../models/tarefa';
import { diaDoMes } from '../../services/datas';

// um aprendizado já separado em título e corpo para ir para a página
interface Entrada {
  item: Aprendizado;
  titulo: string;
  corpo: string;
}

/**
 * O que foi escrito direto no caderno. Com tarefa, o texto é o "o que
 * aprendi" dela; sem, é o diário inteiro do dia (texto vazio apaga).
 */
export interface EscritaNoCaderno {
  data: string;
  texto: string;
  tarefa?: Tarefa;
}

// chave do diário que ainda não existe, escrito nas linhas em branco do dia
const DIARIO_NOVO = 'diario-novo';

// o mesmo maxlength do formulário = limite do validator: acima disso daria 422,
// e a fila descarta 4xx sem avisar
const LIMITE = 5000;

/**
 * A aba Aprendizados: um caderno aberto em duas páginas, um dia por vez.
 *
 * O texto corre da página da esquerda para a da direita sozinho (colunas do
 * CSS), então um dia com muita coisa continua na outra página em vez de
 * cortar. Tocar numa anotação escreve em cima da própria pauta; o formulário
 * completo fica no ícone ao lado da etiqueta. Quem grava é a agenda: aqui só
 * se avisa o que foi escrito.
 */
@Component({
  standalone: true,
  selector: 'app-aprendizados',
  imports: [MatIconModule],
  templateUrl: './aprendizados.html',
  styleUrl: './aprendizados.css',
})
export class Aprendizados {
  private injector = inject(Injector);

  @Input() dia: DiaDeAprendizado | null = null;
  // número da página da esquerda; a da direita é a seguinte
  @Input() pagina = 1;
  @Input() meses: { chave: string; rotulo: string }[] = [];

  @Output() abrir = new EventEmitter<Aprendizado>();
  @Output() irParaMes = new EventEmitter<string>();
  @Output() escrever = new EventEmitter<EscritaNoCaderno>();

  // o parágrafo em que se escreve (contenteditable, não textarea: ver comecar)
  @ViewChild('campo') campo?: ElementRef<HTMLElement>;

  // chave da anotação sendo escrita (ou DIARIO_NOVO); null = só lendo
  editando: string | null = null;
  rascunho = '';
  protected diarioNovo = DIARIO_NOVO;

  get titulo(): string {
    return this.dia?.data ? diaDoMes(this.dia.data) : 'Sem data';
  }

  get mesAberto(): string {
    return this.dia?.data.slice(0, 7) ?? '';
  }

  get entradas(): Entrada[] {
    return (this.dia?.itens ?? []).map((item) => this.separar(item));
  }

  // o dia ainda não tem diário: as linhas em branco do fim convidam a escrever
  get podeEscreverDiario(): boolean {
    return !!this.dia?.data && !this.dia.itens.some((item) => item.origem === 'diario');
  }

  // "#banco-de-dados": área, tipo e objetivo das tarefas do dia, sem repetir
  get etiquetas(): string[] {
    const nomes = (this.dia?.itens ?? []).flatMap((item) =>
      item.tarefa ? [item.tarefa.area, item.tarefa.tipo, item.tarefa.objetivo] : [],
    );

    return [...new Set(nomes.filter(Boolean).map((nome) => `#${nome.toLowerCase().replace(/\s+/g, '-')}`))];
  }

  // ---------- escrever na pauta ----------

  editar(item: Aprendizado): void {
    this.comecar(item.chave, item.texto);
  }

  escreverDiario(): void {
    this.comecar(DIARIO_NOVO, '');
  }

  /** Guarda o que foi escrito. Sair do campo também guarda, como no papel. */
  concluir(): void {
    const chave = this.editando;
    if (!chave || !this.dia) {
      return;
    }
    this.editando = null;

    const texto = this.rascunho.trimEnd().slice(0, LIMITE);
    const item = this.dia.itens.find((i) => i.chave === chave);

    // não mexeu: não vai para a fila à toa
    if (texto === (item?.texto ?? '')) {
      return;
    }

    this.escrever.emit({ data: this.dia.data, texto, tarefa: item?.tarefa });
  }

  /** Esc: larga o rascunho e volta ao que estava escrito. */
  desfazer(): void {
    this.editando = null;
  }

  aoDigitar(): void {
    const el = this.campo?.nativeElement;
    if (!el) {
      return;
    }

    // o parágrafo editável não tem maxlength: o excesso é cortado na hora
    if (el.innerText.length > LIMITE) {
      el.innerText = el.innerText.slice(0, LIMITE);
      this.cursorNoFim(el);
    }
    this.rascunho = el.innerText;
  }

  /**
   * Escreve num parágrafo editável, não num textarea: o textarea é uma caixa
   * que não se parte entre colunas, então a anotação inteira pulava para a
   * página da direita. O parágrafo é texto comum e corre pelas duas páginas
   * como na leitura. O texto entra uma vez aqui, e não por binding, para o
   * Angular não reescrevê-lo (e mover o cursor) a cada letra.
   */
  private comecar(chave: string, texto: string): void {
    // trocar de anotação guarda a anterior antes
    this.concluir();
    this.editando = chave;
    this.rascunho = texto;

    afterNextRender(
      () => {
        const el = this.campo?.nativeElement;
        if (!el) {
          return;
        }

        el.innerText = texto;
        el.focus();
        this.cursorNoFim(el);
      },
      { injector: this.injector },
    );
  }

  // cursor no fim do texto, onde se continua escrevendo
  private cursorNoFim(el: HTMLElement): void {
    const fim = document.createRange();
    fim.selectNodeContents(el);
    fim.collapse(false);
    window.getSelection()?.removeAllRanges();
    window.getSelection()?.addRange(fim);
  }

  /**
   * Tarefa: o nome dela é o título. Diário: se a primeira linha é curta, ela
   * vira o título (quem escreve "Senhas" numa linha e o texto embaixo está
   * dando nome ao assunto); senão o texto entra inteiro, sem título.
   */
  private separar(item: Aprendizado): Entrada {
    if (item.origem === 'tarefa') {
      return { item, titulo: item.titulo, corpo: item.texto };
    }

    const [primeira, ...resto] = item.texto.trim().split('\n');
    const corpo = resto.join('\n').trim();

    return primeira.length <= 80 && corpo
      ? { item, titulo: primeira, corpo }
      : { item, titulo: '', corpo: item.texto.trim() };
  }
}
