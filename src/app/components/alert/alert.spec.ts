import { provideZonelessChangeDetection } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { MAT_SNACK_BAR_DATA, MatSnackBarRef } from '@angular/material/snack-bar';

import { Alert } from './alert';
import { TipoAlerta } from '../../services/alert-service';

describe('Alert', () => {
  let fechar: jasmine.Spy;

  // o componente é criado pelo MatSnackBar, que injeta esses dados;
  // fora do snackbar é preciso fornecê-los à mão
  function abrir(tipo: TipoAlerta): HTMLElement {
    fechar = jasmine.createSpy('dismiss');

    TestBed.configureTestingModule({
      providers: [
        provideZonelessChangeDetection(),
        { provide: MAT_SNACK_BAR_DATA, useValue: { message: 'Sem conexão com o servidor.', tipo } },
        { provide: MatSnackBarRef, useValue: { dismiss: fechar } },
      ],
      imports: [Alert],
    });

    const fixture = TestBed.createComponent(Alert);
    fixture.detectChanges();
    return fixture.nativeElement as HTMLElement;
  }

  it('mostra a frase e o ícone do tipo, com a cor do tipo', () => {
    const alerta = abrir('erro');

    expect(alerta.textContent).toContain('Sem conexão com o servidor.');
    expect(alerta.querySelector('.icone')!.textContent!.trim()).toBe('error');
    expect(alerta.querySelector('.alerta')!.classList).toContain('alerta-erro');
  });

  it('cada tipo tem o seu ícone', () => {
    expect(abrir('sucesso').querySelector('.icone')!.textContent!.trim()).toBe('check_circle');
  });

  it('o botão de fechar tira o aviso na hora', () => {
    abrir('aviso').querySelector<HTMLButtonElement>('.fechar')!.click();

    expect(fechar).toHaveBeenCalled();
  });
});
