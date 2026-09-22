import { provideHttpClient } from '@angular/common/http';
import { provideZonelessChangeDetection } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { MAT_SNACK_BAR_DATA } from '@angular/material/snack-bar';

import { Alert } from './alert';

describe('Alert', () => {
  let component: Alert;
  let fixture: ComponentFixture<Alert>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      providers: [
        provideZonelessChangeDetection(),
        provideHttpClient(),
        // o componente é criado pelo MatSnackBar, que injeta esses dados;
        // fora do snackbar é preciso fornecê-los à mão
        { provide: MAT_SNACK_BAR_DATA, useValue: { message: 'teste', tipo: 'sucess' } },
      ],
      imports: [Alert]
    })
    .compileComponents();

    fixture = TestBed.createComponent(Alert);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
