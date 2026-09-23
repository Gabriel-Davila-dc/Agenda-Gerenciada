import { Component, inject } from '@angular/core';
import { takeUntilDestroyed, toSignal } from '@angular/core/rxjs-interop';
import { NavigationEnd, NavigationError, Router, RouterOutlet } from '@angular/router';
import { filter, map } from 'rxjs';
import { Header } from './components/header/header';
import { PainelConfiguracoes } from './components/painel-configuracoes/painel-configuracoes';
import { AlertService } from './services/alert-service';
import { UserService } from './services/user-service';
import { TarefasService } from './services/tarefas-service';
import { NotasService } from './services/notas-service';
import { CadastrosService } from './services/cadastros-service';
import { ThemeService } from './services/theme-service';
import { SincronizacaoService } from './services/sincronizacao-service';

const CHAVE_RECARGA = 'recarregou-por-deploy';

/**
 * Recarrega a página quando o erro foi um arquivo do build que sumiu. Só uma
 * vez por sessão da aba: se o arquivo faltar de verdade, recarregar em laço
 * travaria o app.
 */
export function recarregarSeFaltouArquivo(erro: unknown, url: string): boolean {
  const texto = String((erro as { message?: string })?.message ?? erro);
  const faltouArquivo = /dynamically imported module|Importing a module script failed|Loading chunk/i.test(texto);

  if (!faltouArquivo || sessionStorage.getItem(CHAVE_RECARGA)) {
    return false;
  }

  sessionStorage.setItem(CHAVE_RECARGA, '1');
  window.location.assign(url);
  return true;
}

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

    // saiu um deploy com o app aberto: as telas carregadas sob demanda do build
    // antigo já não existem no servidor, e a navegação falharia calada. Uma
    // carga completa do mesmo endereço pega o build novo.
    this.router.events
      .pipe(
        filter((e): e is NavigationError => e instanceof NavigationError),
        takeUntilDestroyed(),
      )
      .subscribe((e) => recarregarSeFaltouArquivo(e.error, e.url));

    // abriu uma tela: a recarga deu certo, e o próximo deploy pode recarregar de novo
    this.router.events
      .pipe(
        filter((e) => e instanceof NavigationEnd),
        takeUntilDestroyed(),
      )
      .subscribe(() => sessionStorage.removeItem(CHAVE_RECARGA));

    // o servidor recusou para sempre alguma alteração da fila: quem escreveu
    // precisa saber, senão ela some sem ninguém perceber
    inject(SincronizacaoService)
      .aoDescartar.pipe(takeUntilDestroyed())
      .subscribe((quantas) =>
        this.alert.message(
          quantas === 1
            ? 'Uma alteração foi recusada pelo servidor e não foi salva.'
            : `${quantas} alterações foram recusadas pelo servidor e não foram salvas.`,
          'erro',
        ),
      );
  }

  async ngOnInit(): Promise<void> {
    // sem token é a tela de login: não há o que avisar
    if (!localStorage.getItem('token')) {
      return;
    }

    if ((await this.userService.estadoDoToken()) === 'fora-do-ar') {
      this.alert.message(
        'Sem conexão com o servidor. O que você anotar fica guardado e sobe quando a conexão voltar.',
        'aviso',
      );
    }
  }
}
