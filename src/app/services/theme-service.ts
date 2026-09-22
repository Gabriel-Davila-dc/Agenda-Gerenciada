import { DOCUMENT, Injectable, computed, effect, inject, signal } from '@angular/core';

export type Tema = 'claro' | 'escuro';

/** Mesma chave lida pelo script do index.html, que aplica o tema antes do app carregar. */
const CHAVE_TEMA = 'tema';
const COR_TEMA: Record<Tema, string> = { claro: '#2f4b7c', escuro: '#10141d' };

/**
 * Tema claro/escuro. Sem escolha gravada, segue o sistema; ao escolher um
 * tema, grava `data-theme="escuro"` no <html> (as cores ficam nos tokens de
 * styles.css e custom-theme.scss).
 */
@Injectable({ providedIn: 'root' })
export class ThemeService {
  private readonly document = inject(DOCUMENT);
  private readonly escolhido = signal<Tema | null>(lerTema());
  private readonly sistemaEscuro = signal(false);

  /** Tema escolhido de propósito, ou `null` se estiver seguindo o sistema. */
  readonly temaEscolhido = this.escolhido.asReadonly();
  /** Tema em vigor agora (o escolhido, ou o padrão do modo do sistema). */
  readonly tema = computed<Tema>(() => this.escolhido() ?? (this.sistemaEscuro() ? 'escuro' : 'claro'));

  constructor() {
    const view = this.document.defaultView;
    if (typeof view?.matchMedia === 'function') {
      const query = view.matchMedia('(prefers-color-scheme: dark)');
      this.sistemaEscuro.set(query.matches);
      query.addEventListener('change', (evento) => this.sistemaEscuro.set(evento.matches));
    }

    effect(() => {
      const raiz = this.document.documentElement;
      const escolhido = this.escolhido();
      if (escolhido) {
        raiz.dataset['theme'] = escolhido;
      } else {
        delete raiz.dataset['theme'];
      }
      this.document.querySelector('meta[name="theme-color"]')?.setAttribute('content', COR_TEMA[this.tema()]);
    });
  }

  /** Escolhe um tema fixo, ou `null` para voltar a seguir o sistema. */
  escolher(tema: Tema | null): void {
    this.escolhido.set(tema);
    try {
      if (tema) {
        localStorage.setItem(CHAVE_TEMA, tema);
      } else {
        localStorage.removeItem(CHAVE_TEMA);
      }
    } catch {
      // preferência de tela: perder o valor não é crítico
    }
  }
}

function lerTema(): Tema | null {
  try {
    const valor = localStorage.getItem('tema');
    return valor === 'claro' || valor === 'escuro' ? valor : null;
  } catch {
    return null;
  }
}
