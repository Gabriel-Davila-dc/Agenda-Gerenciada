import { Component, ElementRef, forwardRef, HostListener, Input, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule, NG_VALUE_ACCESSOR, ControlValueAccessor } from '@angular/forms';
import { MatIconModule } from '@angular/material/icon';

export interface OpcaoSeletor {
  valor: unknown;
  rotulo: string;
}

// a partir daqui a lista ganha campo de busca; abaixo disso o campo só atrapalha
const ITENS_PARA_BUSCA = 8;

/**
 * Lista de escolha com a cara do app.
 *
 * O <select> nativo abre a roleta do sistema no celular — enorme, cinza e sem
 * relação com o resto da tela. Aqui a lista sobe de baixo, com as opções altas
 * o bastante para o dedo de quem está no bananal.
 *
 * Funciona com [(ngModel)] igual ao select que substitui.
 */
@Component({
  standalone: true,
  selector: 'app-seletor',
  imports: [CommonModule, FormsModule, MatIconModule],
  templateUrl: './seletor.html',
  styleUrl: './seletor.css',
  providers: [
    {
      provide: NG_VALUE_ACCESSOR,
      useExisting: forwardRef(() => Seletor),
      multi: true,
    },
  ],
})
export class Seletor implements ControlValueAccessor {
  // título da folha; quando vazio, cai no placeholder
  @Input() titulo = '';
  @Input() placeholder = 'Selecione';

  /**
   * A barra de filtros do histórico usa campo em forma de pílula, e o resto
   * do app usa o campo retangular dos formulários. São os dois desenhos que
   * já existiam nos selects trocados.
   */
  @Input() aparencia: 'campo' | 'pilula' = 'campo';

  // aceita ['Bananal A', 'Bananal B'] ou [{ valor, rotulo }] — a maioria das
  // listas do app é de nomes, onde valor e rótulo são a mesma coisa
  @Input() set opcoes(lista: readonly (OpcaoSeletor | string)[] | null | undefined) {
    this.lista.set(
      (lista ?? []).map((item) =>
        typeof item === 'string' ? { valor: item, rotulo: item } : item,
      ),
    );
  }

  protected lista = signal<OpcaoSeletor[]>([]);
  protected valor = signal<unknown>(null);
  protected aberto = signal(false);
  protected busca = signal('');
  protected desabilitado = signal(false);

  private aoMudar: (valor: unknown) => void = () => {};
  private aoTocar: () => void = () => {};

  protected get rotuloAtual(): string {
    const escolhida = this.lista().find((opcao) => opcao.valor === this.valor());
    return escolhida?.rotulo ?? '';
  }

  protected get temBusca(): boolean {
    return this.lista().length > ITENS_PARA_BUSCA;
  }

  protected get visiveis(): OpcaoSeletor[] {
    const termo = this.busca().trim().toLowerCase();

    if (!termo) {
      return this.lista();
    }

    return this.lista().filter((opcao) => opcao.rotulo.toLowerCase().includes(termo));
  }

  protected abrir(): void {
    if (this.desabilitado()) {
      return;
    }

    this.busca.set('');
    this.aberto.set(true);
  }

  protected fechar(): void {
    this.aberto.set(false);
    this.aoTocar();
  }

  /**
   * Fecha ao tocar no fundo escuro.
   *
   * O clique precisa parar aqui: nos formulários o seletor fica dentro de um
   * <label>, e <button> é elemento rotulável — o clique que chegasse ao label
   * voltaria como clique no campo e reabriria a lista no mesmo toque.
   */
  protected fecharPeloFundo(evento: MouseEvent): void {
    evento.stopPropagation();
    evento.preventDefault();
    this.fechar();
  }

  protected escolher(opcao: OpcaoSeletor): void {
    this.valor.set(opcao.valor);
    this.aoMudar(opcao.valor);
    this.fechar();
  }

  protected selecionada(opcao: OpcaoSeletor): boolean {
    return opcao.valor === this.valor();
  }

  constructor(private elemento: ElementRef<HTMLElement>) {}

  /**
   * Clique fora fecha o dropdown do computador.
   *
   * No celular quem fecha é o próprio fundo escuro, que cobre a tela. No
   * computador não existe esse fundo — ele virou só o ancoradouro do
   * dropdown — então a checagem precisa ser aqui.
   */
  @HostListener('document:click', ['$event'])
  protected aoClicarFora(evento: MouseEvent): void {
    if (!this.aberto()) {
      return;
    }

    // o clique que abriu a lista nasce dentro do host e não pode fechá-la
    if (this.elemento.nativeElement.contains(evento.target as Node)) {
      return;
    }

    this.fechar();
  }

  // Esc fecha a lista antes de fechar o formulário que está atrás dela
  @HostListener('document:keydown.escape', ['$event'])
  protected aoApertarEsc(evento: Event): void {
    if (this.aberto()) {
      evento.stopPropagation();
      this.fechar();
    }
  }

  // ---------- ControlValueAccessor ----------

  writeValue(valor: unknown): void {
    this.valor.set(valor ?? null);
  }

  registerOnChange(fn: (valor: unknown) => void): void {
    this.aoMudar = fn;
  }

  registerOnTouched(fn: () => void): void {
    this.aoTocar = fn;
  }

  setDisabledState(desabilitado: boolean): void {
    this.desabilitado.set(desabilitado);
  }
}
