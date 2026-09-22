import {
  ApplicationConfig,
  provideBrowserGlobalErrorListeners,
  provideZonelessChangeDetection,
} from '@angular/core';
import { MAT_DATE_LOCALE } from '@angular/material/core';

import { provideHttpClient, withInterceptors } from '@angular/common/http';

import { provideRouter } from '@angular/router';

import { routes } from './app.routes';

import { FormsModule } from '@angular/forms';
import { importProvidersFrom } from '@angular/core';
import { authInterceptor } from './interceptors/auth-interceptor';

export const appConfig: ApplicationConfig = {
  providers: [
    { provide: MAT_DATE_LOCALE, useValue: 'pt-BR' },
    provideBrowserGlobalErrorListeners(),
    provideZonelessChangeDetection(),
    // a rolagem por fragmento é feita na própria tela que usa âncora
    // (pages/sobre), porque o anchorScrolling do Router não surtiu efeito aqui
    provideRouter(routes),
    provideHttpClient(withInterceptors([authInterceptor])),
    importProvidersFrom(FormsModule),
  ],
};
