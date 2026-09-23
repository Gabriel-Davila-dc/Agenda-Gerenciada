import { Component } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { RouterModule } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { ChangeDetectorRef, inject } from '@angular/core';
import { MatIconModule } from '@angular/material/icon';
import { UserService } from '../../services/user-service';
import { mensagemDeErro } from '../../services/erros';

/** Um quadradinho do calendário de enfeite atrás do cartão. */
interface DiaEnfeite {
  numero: number | null;
  hoje: boolean;
  tarefas: string[];
}

// tarefas de mentira, só para o fundo parecer uma agenda em uso
const TAREFAS_ENFEITE: Record<number, string[]> = {
  1: ['Criar branch da feature'],
  2: ['Code review do PR'],
  3: ['Academia', 'Configurar ESLint'],
  4: ['Migrar para signals'],
  5: ['Deploy da API'],
  6: ['Estudar RxJS'],
  7: ['Escrever testes unitários'],
  8: ['Revisar metas', 'Ler 20 páginas'],
  9: ['Corrigir bug do login', 'Atualizar Angular'],
  10: ['Modelar banco MySQL'],
  11: ['Daily às 9h', 'Refatorar service'],
  12: ['Estudar Angular'],
  13: ['Criar rota no Adonis'],
  14: ['Docker compose'],
  15: ['Validar com VineJS', 'Pair programming'],
  16: ['Revisar pull requests'],
  17: ['Reunião', 'Otimizar query'],
  18: ['Estudar TypeScript'],
  19: ['Configurar CI'],
  20: ['Documentar API'],
  21: ['Planejar semana', 'Resolver conflito git'],
  22: ['Implementar kanban'],
  23: ['Subir release', 'Testar no celular'],
  24: ['Estudar algoritmos'],
  25: ['Criar migration'],
  26: ['Curso de inglês', 'Revisar CSS'],
  27: ['Hackathon'],
  28: ['Ajustar tema escuro'],
  29: ['Testes de integração'],
  30: ['Retrospectiva da sprint'],
  31: ['Backup do banco'],
};

@Component({
  selector: 'app-login-page',
  imports: [MatIconModule, FormsModule, RouterModule],
  templateUrl: './login-page.html',
  styleUrl: './login-page.css',
})
/**
 * Entrar e criar conta são a mesma tela: o mesmo cartão sobre o calendário de
 * enfeite, só troca o texto e o que o botão faz. A rota diz o modo
 * (data.modo = 'criar' em /register), para as duas nunca saírem do padrão
 * uma da outra.
 */
export class LoginPage {
  criando = inject(ActivatedRoute).snapshot.data['modo'] === 'criar';

  email = '';
  password = '';
  error = '';

  /**
   * O que está acontecendo depois do clique, para o botão dizer. Criar conta são
   * dois pedidos seguidos (criar e entrar), e a API pode demorar alguns
   * segundos para acordar: sem isso a tela parecia não ter feito nada.
   */
  etapa: 'parado' | 'criando' | 'entrando' | 'abrindo' = 'parado';

  get ocupado(): boolean {
    return this.etapa !== 'parado';
  }

  get textoDoBotao(): string {
    switch (this.etapa) {
      case 'criando':
        return 'Criando sua conta…';
      case 'entrando':
        return 'Entrando…';
      case 'abrindo':
        return 'Abrindo sua agenda…';
      default:
        return this.criando ? 'Criar conta' : 'Entrar';
    }
  }

  /** "SETEMBRO DE 2026": o mês de hoje, em cima do título. */
  mesAtual = new Date()
    .toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' })
    .toUpperCase();

  dias = this.montarMes(new Date());

  constructor(
    private userService: UserService,
    private cdr: ChangeDetectorRef,
    private router: Router,
  ) {}

  enviar() {
    // segundo clique enquanto o primeiro ainda anda criaria a conta duas vezes
    if (this.ocupado) {
      return;
    }

    const erro = this.verificarCredenciais(this.email, this.password);

    if (erro) {
      this.error = erro;
      this.cdr.detectChanges();
      return;
    }
    this.error = '';

    if (this.criando) {
      this.criarConta();
    } else {
      this.logar();
    }
  }

  // conta criada já entra: pedir o e-mail e a senha de novo seria à toa
  private criarConta() {
    this.mudarEtapa('criando');
    this.userService.postUserRegister(this.email, this.password).subscribe({
      next: () => this.logar(),
      error: (err) => {
        this.error = mensagemDeErro(
          err,
          {
            409: 'Já existe uma conta com esse e-mail. Entre com ela.',
            422: 'Confira o e-mail e use uma senha com pelo menos 6 caracteres.',
          },
          'Não deu para criar a conta. Tente de novo.',
        );
        this.mudarEtapa('parado');
      },
    });
  }

  private logar() {
    this.mudarEtapa('entrando');
    this.userService.getUserLogin(this.email, this.password).subscribe({
      next: () => {
        this.error = '';
        // a agenda recarrega o app inteiro: o botão segue dizendo o que acontece
        this.mudarEtapa('abrindo');
        this.router.navigate(['/']).then(() => {
          window.location.reload();
        });
      },
      error: (err) => {
        localStorage.removeItem('token'); // limpa token antigo
        localStorage.removeItem('email'); // limpa e-mail antigo
        this.error = mensagemDeErro(
          err,
          { 401: 'E-mail ou senha incorretos.', 422: 'Confira o e-mail e a senha.' },
          'Não deu para entrar. Tente de novo.',
        );
        this.mudarEtapa('parado');
      },
    });
  }

  private mudarEtapa(etapa: LoginPage['etapa']) {
    this.etapa = etapa;
    this.cdr.detectChanges();
  }

  verificarCredenciais(email: string, senha: string): string | null {
    if (!email || !senha) {
      return 'Preencha o e-mail e a senha.';
    }

    if (!email.includes('@') || !email.includes('.')) {
      return 'Esse e-mail não parece válido. Confira se tem @ e o domínio.';
    }

    if (senha.length < 6) {
      return 'A senha precisa ter pelo menos 6 caracteres.';
    }

    return null; // tudo ok
  }

  /** Mês de hoje em grade de 7 colunas, com os dias vazios do começo. */
  private montarMes(hoje: Date): DiaEnfeite[] {
    const primeiro = new Date(hoje.getFullYear(), hoje.getMonth(), 1).getDay();
    const total = new Date(hoje.getFullYear(), hoje.getMonth() + 1, 0).getDate();
    const dias: DiaEnfeite[] = [];

    for (let i = 0; i < primeiro; i++) {
      dias.push({ numero: null, hoje: false, tarefas: [] });
    }
    for (let d = 1; d <= total; d++) {
      dias.push({ numero: d, hoje: d === hoje.getDate(), tarefas: TAREFAS_ENFEITE[d] ?? [] });
    }
    return dias;
  }
}
