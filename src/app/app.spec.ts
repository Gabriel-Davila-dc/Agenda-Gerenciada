import { provideRouter } from '@angular/router';
import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { provideZonelessChangeDetection } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { App } from './app';
import { UserService } from './services/user-service';
import { AlertService } from './services/alert-service';

/**
 * O ngOnInit do App espera uma chamada HTTP e só então abre um snackbar.
 *
 * Com o UserService real, essa promessa resolvia depois que o TestBed já
 * havia destruído o injector, e o MatSnackBar estourava NG0205 no meio de
 * outro teste. Os dois substitutos resolvem na hora e não tocam em HTTP.
 */
class UserServiceFalso {
  async estadoDoToken(): Promise<'valido'> {
    return 'valido';
  }
}

class AlertServiceFalso {
  message(): void {}
}

describe('App', () => {
  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [App],
      providers: [
        provideZonelessChangeDetection(),
        provideHttpClient(),
        provideHttpClientTesting(),
        provideRouter([]),
        { provide: UserService, useClass: UserServiceFalso },
        { provide: AlertService, useClass: AlertServiceFalso },
      ],
    }).compileComponents();
  });

  it('monta a tela sem quebrar', () => {
    const fixture = TestBed.createComponent(App);
    fixture.detectChanges();
    const tela = fixture.nativeElement as HTMLElement;

    expect(tela.querySelector('router-outlet')).toBeTruthy();
  });
});
