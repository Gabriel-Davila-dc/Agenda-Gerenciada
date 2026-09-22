import { Component, EventEmitter, Output } from '@angular/core';
import { RouterModule } from '@angular/router';
import { MatIconModule } from '@angular/material/icon';

@Component({
  selector: 'app-header',
  standalone: true,
  imports: [RouterModule, MatIconModule],
  templateUrl: './header.html',
  styleUrl: './header.css',
})
export class Header {
  logado = !!localStorage.getItem('token');

  /** Cadastros, tema e sair moraram para o painel lateral (app-painel-configuracoes). */
  @Output() abrirConfiguracoes = new EventEmitter<void>();
}
