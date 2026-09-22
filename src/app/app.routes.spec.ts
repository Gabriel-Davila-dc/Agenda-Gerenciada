import { Route } from '@angular/router';

import { routes } from './app.routes';

/**
 * Cada tela é carregada sob demanda, e um caminho ou nome de export errado no
 * loadComponent só apareceria quando alguém navegasse até lá. Aqui todas as
 * rotas são carregadas de uma vez.
 */
function todasAsRotas(lista: Route[], prefixo = ''): { caminho: string; rota: Route }[] {
  return lista.flatMap((rota) => {
    const caminho = `${prefixo}/${rota.path ?? ''}`.replace(/\/+/g, '/');
    const filhas = rota.children ? todasAsRotas(rota.children, caminho) : [];

    return [{ caminho, rota }, ...filhas];
  });
}

describe('Rotas', () => {
  const rotas = todasAsRotas(routes);

  it('toda rota aponta para uma tela ou redireciona', () => {
    const semDestino = rotas.filter(
      ({ rota }) => !rota.loadComponent && !rota.component && !rota.children && !rota.redirectTo,
    );

    expect(semDestino.map((item) => item.caminho)).toEqual([]);
  });

  // agenda, cadastros, login e cadastro de conta
  it('encontrou todas as telas esperadas', () => {
    const comTela = rotas.filter(({ rota }) => rota.loadComponent || rota.component);

    expect(comTela.length).toBe(4);
  });

  it('agenda e cadastros exigem login', () => {
    const protegidas = rotas
      .filter(({ rota }) => rota.canActivate?.length)
      .map(({ caminho }) => caminho);

    expect(protegidas).toEqual(['/agenda', '/cadastros']);
  });

  for (const { caminho, rota } of todasAsRotas(routes)) {
    if (!rota.loadComponent) {
      continue;
    }

    it(`carrega a tela de ${caminho}`, async () => {
      const carregado = await (rota.loadComponent as () => Promise<unknown>)();

      expect(carregado).withContext(`${caminho} não resolveu para um componente`).toBeTruthy();
      expect(typeof carregado).toBe('function');
    });
  }
});
