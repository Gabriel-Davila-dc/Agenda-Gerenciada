import { Component, HostListener, inject, signal } from '@angular/core';
import { Router, RouterModule } from '@angular/router';
import { MatIconModule } from '@angular/material/icon';

import { Tema, ThemeService } from '../../services/theme-service';
import { UserService } from '../../services/user-service';

interface OpcaoTema {
  valor: Tema | null;
  titulo: string;
  icone: string;
}

/**
 * Painel de Configurações: sobe pela lateral direita, por cima do resto da
 * tela. Aberto pelo botão de engrenagem do header (ver app.html), guarda o
 * próprio estado — quem abre só chama `abrir()` num `#painel` de template.
 */
@Component({
  standalone: true,
  selector: 'app-painel-configuracoes',
  imports: [RouterModule, MatIconModule],
  templateUrl: './painel-configuracoes.html',
  styleUrl: './painel-configuracoes.css',
})
export class PainelConfiguracoes {
  protected readonly theme = inject(ThemeService);
  private readonly userService = inject(UserService);
  private readonly router = inject(Router);

  protected readonly aberto = signal(false);

  protected readonly opcoesTema: OpcaoTema[] = [
    { valor: null, titulo: 'Automático', icone: 'brightness_auto' },
    { valor: 'claro', titulo: 'Claro', icone: 'light_mode' },
    { valor: 'escuro', titulo: 'Escuro', icone: 'dark_mode' },
    { valor: 'onix', titulo: 'Ônix', icone: 'star' },
    { valor: 'nebulosa', titulo: 'Nebulosa', icone: 'auto_awesome' },
  ];

  abrir(): void {
    this.aberto.set(true);
  }

  protected fechar(): void {
    this.aberto.set(false);
  }

  /** Fecha ao tocar no fundo escuro; o painel em si para a propagação (ver template). */
  protected fecharPeloFundo(evento: MouseEvent): void {
    evento.stopPropagation();
    this.fechar();
  }

  @HostListener('document:keydown.escape')
  protected aoApertarEsc(): void {
    if (this.aberto()) {
      this.fechar();
    }
  }

  protected async sair(): Promise<void> {
    await this.userService.logout();
    this.router.navigate(['/login']).then(() => window.location.reload());
  }
}
