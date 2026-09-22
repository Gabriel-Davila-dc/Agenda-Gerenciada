import { Component, EventEmitter, Input, Output } from '@angular/core';
import { MatIconModule } from '@angular/material/icon';

import { Aprendizado, DiaDeAprendizado } from '../../models/aprendizado';

/**
 * A aba Aprendizados: o diário e o "o que aprendi" das tarefas, por dia.
 *
 * Só mostra. Quem monta a lista e abre o formulário é a agenda, que já tem
 * tarefas e notas carregadas — aqui o toque só avisa qual item foi.
 */
@Component({
  standalone: true,
  selector: 'app-aprendizados',
  imports: [MatIconModule],
  templateUrl: './aprendizados.html',
  styleUrl: './aprendizados.css',
})
export class Aprendizados {
  @Input() dias: DiaDeAprendizado[] = [];

  // com filtro de objetivo o diário sai da lista, e a tela avisa por quê
  @Input() filtroObjetivo = '';

  @Output() abrir = new EventEmitter<Aprendizado>();
}
