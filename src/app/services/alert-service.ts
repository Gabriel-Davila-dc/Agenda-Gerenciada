import { MatSnackBar } from '@angular/material/snack-bar';
import { Injectable } from '@angular/core';
import { Alert } from '../components/alert/alert';

@Injectable({
  providedIn: 'root',
})
export class AlertService {
  constructor(private snackBar: MatSnackBar) {}

  message(message: String, tipos: 'sucess' | 'alert' | 'warning') {
    this.snackBar.openFromComponent(Alert, {
      duration: 3000,
      data: {
        message: message,
        tipo: tipos,
      },
      verticalPosition: 'top',
      horizontalPosition: 'center',
      panelClass: ['custom-snackbar'],
    });
  }
}
