import { Component, inject } from '@angular/core';
import { MAT_SNACK_BAR_DATA, MatSnackBarRef } from '@angular/material/snack-bar';
import { MatIconModule } from '@angular/material/icon';

import { TipoAlerta } from '../../services/alert-service';

const ICONE: Record<TipoAlerta, string> = {
  sucesso: 'check_circle',
  aviso: 'info',
  erro: 'error',
};

@Component({
  selector: 'app-alert',
  imports: [MatIconModule],
  templateUrl: './alert.html',
  styleUrl: './alert.css',
})
export class Alert {
  protected data = inject<{ message: string; tipo: TipoAlerta }>(MAT_SNACK_BAR_DATA);
  protected ref = inject(MatSnackBarRef);
  protected icone = ICONE[this.data.tipo];
}
