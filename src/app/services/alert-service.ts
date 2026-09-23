import { MatSnackBar } from '@angular/material/snack-bar';
import { Injectable } from '@angular/core';
import { Alert } from '../components/alert/alert';

export type TipoAlerta = 'sucesso' | 'aviso' | 'erro';

// erro fica mais tempo: é o que a pessoa mais precisa conseguir ler inteiro
const DURACAO: Record<TipoAlerta, number> = {
  sucesso: 3000,
  aviso: 5000,
  erro: 7000,
};

@Injectable({
  providedIn: 'root',
})
export class AlertService {
  constructor(private snackBar: MatSnackBar) {}

  message(message: string, tipo: TipoAlerta) {
    this.snackBar.openFromComponent(Alert, {
      duration: DURACAO[tipo],
      data: { message, tipo },
      verticalPosition: 'top',
      horizontalPosition: 'center',
      panelClass: ['custom-snackbar'],
      // leitor de tela lê o erro na hora; aviso e sucesso esperam a vez
      politeness: tipo === 'erro' ? 'assertive' : 'polite',
    });
  }
}
