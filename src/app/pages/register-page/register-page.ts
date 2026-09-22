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
  selector: 'app-register-page',
  imports: [
    MatInputModule,
    MatFormFieldModule,
    MatButtonModule,
    FormsModule,
    CommonModule,
    RouterModule,
  ],
  templateUrl: './register-page.html',
  styleUrl: './register-page.css',
})
export class RegisterPage {
  email = '';
  password = '';
  error = '';

  constructor(
    private userService: UserService,
    private cdr: ChangeDetectorRef,
    private router: Router
  ) {}

  Cadastrar() {
    const erro = this.verificarCredenciais(this.email, this.password);

    if (erro) {
      this.error = erro;
      this.cdr.detectChanges();
      return;
    }
    this.error = '';

    this.userService.postUserRegister(this.email, this.password).subscribe({
      next: (usuario) => {
        console.log('Usuário criado:', usuario);
        this.error = '';
        // redireciona para outra página
        this.router.navigate(['/login']);
      },
      error: (err) => {
        this.error = err.error?.message || 'Erro ao criar sua conta!';
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
