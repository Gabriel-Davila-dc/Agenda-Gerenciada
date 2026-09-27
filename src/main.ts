import { bootstrapApplication } from '@angular/platform-browser';
import { appConfig } from './app/app.config';
import { App } from './app/app';
import { registerLocaleData } from '@angular/common';
import localePt from '@angular/common/locales/pt';
import { inject as ligarAnalytics } from '@vercel/analytics';
import { environment } from './environments/environment';

registerLocaleData(localePt);

// Vercel Web Analytics: visitas e telas vistas, sem cookie. Só na versão
// publicada, para não contar os acessos de desenvolvimento. Cada troca de
// tela do Angular (pushState) já conta sozinha como uma página vista.
if (environment.production) {
  ligarAnalytics({ mode: 'production' });
}

bootstrapApplication(App, appConfig).catch((err) => console.error(err));
