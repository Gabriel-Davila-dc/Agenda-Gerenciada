import { Component, EventEmitter, Input, Output } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { MatIconModule } from '@angular/material/icon';

/**
 * Campo de pesquisa da agenda. É um filtro, não uma lista de resultados: a
 * cada letra avisa a agenda, que deixa no calendário, no quadro e no caderno
 * só o que é relevante (services/busca.ts).
 */
@Component({
  selector: 'app-busca',
  standalone: true,
  imports: [FormsModule, MatIconModule],
  templateUrl: './busca.html',
  styleUrl: './busca.css',
})
export class Busca {
  @Input() consulta = '';
  @Output() consultaChange = new EventEmitter<string>();

  mudar(consulta: string): void {
    this.consulta = consulta;
    this.consultaChange.emit(consulta);
  }
}
