import { routes } from './../../app.routes';
import { Component } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Router } from '@angular/router';
import { RouterModule } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { MatInputModule } from '@angular/material/input';
import { MatFormFieldModule } from '@angular/material/form-field';
import { ChangeDetectorRef } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { UserService } from '../../services/user-service';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'app-login-page',
  imports: [
    MatInputModule,
    MatFormFieldModule,
    MatButtonModule,
    FormsModule,
    CommonModule,
    RouterModule,
  ],
  templateUrl: './login-page.html',
  styleUrl: './login-page.css',
})
export class LoginPage {
  email = '';
  password = '';
  error = '';

  constructor(
    private userService: UserService,
    private cdr: ChangeDetectorRef,
    private router: Router,
  ) {}

  logar() {
    const erro = this.verificarCredenciais(this.email, this.password);

    if (erro) {
      this.error = erro;
      this.cdr.detectChanges();
      return;
    }
    this.error = '';

    this.userService.getUserLogin(this.email, this.password).subscribe({
      next: (usuario) => {
        console.log('Usuário logado:', usuario);
        this.error = '';
        this.router.navigate(['/']).then(() => {
          window.location.reload();
        });
      },
      error: (err) => {
        localStorage.removeItem('token'); // limpa token antigo
        localStorage.removeItem('email'); // limpa e-mail antigo
        this.error = err.error?.message || 'Erro ao fazer Login';
        this.cdr.detectChanges();
      },
    });
  }

  verificarCredenciais(email: string, senha: string): string | null {
    if (!email || !senha) {
      return 'Preencha e-mail e senha!';
    }

    if (!email.includes('@') || !email.includes('.')) {
      return 'E-mail inválido!';
    }

    if (senha.length < 6) {
      return 'A senha deve ter no mínimo 6 caracteres!';
    }

    return null; // tudo ok
  }
}
