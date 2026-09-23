import { Component, EventEmitter, Output, computed, inject } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { NavigationEnd, Router, RouterModule } from '@angular/router';
import { MatIconModule } from '@angular/material/icon';
import { filter, map } from 'rxjs';

import { VisaoAgenda, visaoDaUrl } from '../../pages/agenda/visao';

@Component({
  selector: 'app-header',
  standalone: true,
  imports: [RouterModule, MatIconModule],
  templateUrl: './header.html',
  styleUrl: './header.css',
})
export class Header {
  private router = inject(Router);

  logado = !!localStorage.getItem('token');
  email = localStorage.getItem('email') ?? '';
  inicial = (this.email[0] ?? '?').toUpperCase();

  /** Cadastros, tema e sair moraram para o painel lateral (app-painel-configuracoes). */
  @Output() abrirConfiguracoes = new EventEmitter<void>();

  protected abas: { visao: VisaoAgenda; rotulo: string }[] = [
    { visao: 'calendario', rotulo: 'Calendário' },
    { visao: 'quadro', rotulo: 'Quadro' },
    { visao: 'aprendizados', rotulo: 'Aprendizados' },
  ];

  // a aba ativa vem da URL (?visao=quadro): a agenda lê o mesmo parâmetro
  private url = toSignal(
    this.router.events.pipe(
      filter((e) => e instanceof NavigationEnd),
      map(() => this.router.url),
    ),
    { initialValue: this.router.url },
  );

  protected naAgenda = computed(() => this.url().startsWith('/agenda'));
  protected visao = computed(() =>
    visaoDaUrl(this.router.parseUrl(this.url()).queryParamMap.get('visao')),
  );
}
