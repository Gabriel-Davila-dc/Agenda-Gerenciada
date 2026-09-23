import { Component, inject } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { NavigationEnd, Router, RouterOutlet } from '@angular/router';
import { filter, map } from 'rxjs';
import { Header } from './components/header/header';
import { PainelConfiguracoes } from './components/painel-configuracoes/painel-configuracoes';
import { AlertService } from './services/alert-service';
import { UserService } from './services/user-service';
import { TarefasService } from './services/tarefas-service';
import { NotasService } from './services/notas-service';
import { CadastrosService } from './services/cadastros-service';
import { ThemeService } from './services/theme-service';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [RouterOutlet, Header, PainelConfiguracoes],
  templateUrl: './app.html',
  styleUrl: './app.css',
})
export class App {
  private userService = inject(UserService);
  private alert = inject(AlertService);
  private router = inject(Router);

  /** Login e criar conta desenham a própria marca no cartão, por cima do calendário de fundo. */
  semTopo = toSignal(
    this.router.events.pipe(
      filter((e) => e instanceof NavigationEnd),
      map(() => ['/login', '/register'].some((rota) => this.router.url.startsWith(rota))),
    ),
    { initialValue: false },
  );

  constructor() {
    // cada service registra seu handler na fila no construtor. Criados aqui,
    // a fila sabe enviar tudo desde a abertura, qualquer que seja a tela —
    // inclusive quando a conexão volta com o app parado no login.
    inject(TarefasService);
    inject(NotasService);
    inject(CadastrosService);
    inject(ThemeService);
  }

  async ngOnInit(): Promise<void> {
    // sem token é a tela de login: não há o que avisar
    if (!localStorage.getItem('token')) {
      return;
    }

    if ((await this.userService.estadoDoToken()) === 'fora-do-ar') {
      this.alert.message('Sem conexão: o que você anotar fica guardado e sobe depois', 'alert');
    }
  }
}
