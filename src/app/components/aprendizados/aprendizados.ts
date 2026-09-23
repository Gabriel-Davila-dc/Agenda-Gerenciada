import { Component, EventEmitter, Input, Output } from '@angular/core';
import { MatIconModule } from '@angular/material/icon';

import { Aprendizado, DiaDeAprendizado } from '../../models/aprendizado';
import { diaDoMes } from '../../services/datas';

// um aprendizado já separado em título e corpo para ir para a página
interface Entrada {
  item: Aprendizado;
  titulo: string;
  corpo: string;
}

/**
 * A aba Aprendizados: um caderno aberto em duas páginas, um dia por vez.
 *
 * O texto corre da página da esquerda para a da direita sozinho (colunas do
 * CSS), então um dia com muita coisa continua na outra página em vez de
 * cortar. Só mostra: quem escolhe o dia, folheia e abre o formulário é a
 * agenda — aqui o toque só avisa qual item ou qual marcador foi.
 */
@Component({
  standalone: true,
  selector: 'app-aprendizados',
  imports: [MatIconModule],
  templateUrl: './aprendizados.html',
  styleUrl: './aprendizados.css',
})
export class Aprendizados {
  @Input() dia: DiaDeAprendizado | null = null;
  // número da página da esquerda; a da direita é a seguinte
  @Input() pagina = 1;
  @Input() meses: { chave: string; rotulo: string }[] = [];

  @Output() abrir = new EventEmitter<Aprendizado>();
  @Output() irParaMes = new EventEmitter<string>();

  get titulo(): string {
    return this.dia?.data ? diaDoMes(this.dia.data) : 'Sem data';
  }

  get mesAberto(): string {
    return this.dia?.data.slice(0, 7) ?? '';
  }

  get entradas(): Entrada[] {
    return (this.dia?.itens ?? []).map((item) => this.separar(item));
  }

  // "#banco-de-dados": área, tipo e objetivo das tarefas do dia, sem repetir
  get etiquetas(): string[] {
    const nomes = (this.dia?.itens ?? []).flatMap((item) =>
      item.tarefa ? [item.tarefa.area, item.tarefa.tipo, item.tarefa.objetivo] : [],
    );

    return [...new Set(nomes.filter(Boolean).map((nome) => `#${nome.toLowerCase().replace(/\s+/g, '-')}`))];
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
