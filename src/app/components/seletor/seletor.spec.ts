import { Component, provideZonelessChangeDetection } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';

import { Seletor } from './seletor';

describe('Seletor', () => {
  let fixture: ComponentFixture<Seletor>;
  let component: Seletor;
  // o componente é um ControlValueAccessor: o que a tela vê é o que ele emite
  let escolhido: unknown;

  const abrir = () => (fixture.nativeElement as HTMLElement).querySelector<HTMLButtonElement>('.campo')!.click();
  const opcoes = () =>
    Array.from((fixture.nativeElement as HTMLElement).querySelectorAll<HTMLElement>('.opcao'));
  const campo = () => (fixture.nativeElement as HTMLElement).querySelector('.campo-texto')!.textContent!.trim();
  const folha = () => (fixture.nativeElement as HTMLElement).querySelector('.folha');

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      providers: [provideZonelessChangeDetection()],
      imports: [Seletor],
    }).compileComponents();

    fixture = TestBed.createComponent(Seletor);
    component = fixture.componentInstance;

    escolhido = undefined;
    component.registerOnChange((valor) => (escolhido = valor));
    fixture.componentRef.setInput('opcoes', ['Talhão do Córrego', 'Bananal da Serra', 'Talhão Novo']);
    fixture.detectChanges();
  });

  it('mostra o placeholder enquanto nada foi escolhido', () => {
    fixture.componentRef.setInput('placeholder', 'Selecione');
    fixture.detectChanges();

    expect(campo()).toBe('Selecione');
    expect(folha()).toBeNull();
  });

  it('abre a lista e escolhe uma opção', async () => {
    abrir();
    await fixture.whenStable();
    fixture.detectChanges();

    expect(opcoes().length).toBe(3);

    opcoes()[1].click();
    await fixture.whenStable();
    fixture.detectChanges();

    expect(escolhido).toBe('Bananal da Serra');
    expect(campo()).toBe('Bananal da Serra');
    // escolher fecha: a folha não pode ficar por cima do formulário
    expect(folha()).toBeNull();
  });

  it('marca a opção que já está escolhida', async () => {
    component.writeValue('Talhão Novo');
    abrir();
    await fixture.whenStable();
    fixture.detectChanges();

    const marcadas = opcoes().filter((opcao) => opcao.classList.contains('opcao-marcada'));

    expect(marcadas.length).toBe(1);
    expect(marcadas[0].textContent).toContain('Talhão Novo');
  });

  it('aceita opções com rótulo diferente do valor', async () => {
    fixture.componentRef.setInput('opcoes', [
      { valor: null, rotulo: 'Não informar' },
      { valor: 7, rotulo: 'Cooperativa' },
    ]);
    fixture.detectChanges();

    abrir();
    await fixture.whenStable();
    fixture.detectChanges();
    opcoes()[1].click();
    await fixture.whenStable();
    fixture.detectChanges();

    // o valor emitido é o id, não o texto mostrado
    expect(escolhido).toBe(7);
    expect(campo()).toBe('Cooperativa');
  });

  // lista curta não ganha campo de busca, que só ocuparia espaço da tela
  it('só mostra a busca quando a lista é longa', async () => {
    abrir();
    await fixture.whenStable();
    fixture.detectChanges();
    expect((fixture.nativeElement as HTMLElement).querySelector('.busca')).toBeNull();

    const muitos = Array.from({ length: 12 }, (_, i) => `Bananal ${i + 1}`);
    fixture.componentRef.setInput('opcoes', muitos);
    fixture.detectChanges();

    expect((fixture.nativeElement as HTMLElement).querySelector('.busca')).not.toBeNull();
  });

  it('filtra pela busca sem diferenciar maiúscula', async () => {
    fixture.componentRef.setInput(
      'opcoes',
      Array.from({ length: 12 }, (_, i) => `Bananal ${i + 1}`).concat('Serra'),
    );
    fixture.detectChanges();

    abrir();
    await fixture.whenStable();
    fixture.detectChanges();

    const busca = (fixture.nativeElement as HTMLElement).querySelector<HTMLInputElement>('.busca input')!;
    busca.value = 'serra';
    busca.dispatchEvent(new Event('input'));
    await fixture.whenStable();
    fixture.detectChanges();

    expect(opcoes().length).toBe(1);
    expect(opcoes()[0].textContent).toContain('Serra');
  });

  it('não abre quando está desabilitado', async () => {
    component.setDisabledState(true);
    fixture.detectChanges();

    abrir();
    await fixture.whenStable();
    fixture.detectChanges();

    expect(folha()).toBeNull();
  });
});

/**
   Nos formulários o seletor vive dentro de um <label>, e <button> é elemento
   rotulável: o clique que sobe até o label volta como clique no campo. Sem
   travar a propagação, fechar pelo fundo reabria a lista no mesmo toque.
 */
@Component({
  standalone: true,
  imports: [Seletor],
  template: `
    <label>
      Bananal
      <app-seletor [opcoes]="opcoes" />
    </label>
  `,
})
class HospedeiroComLabel {
  opcoes = ['Talhão do Córrego', 'Bananal da Serra'];
}

describe('Seletor dentro de um label', () => {
  let fixture: ComponentFixture<HospedeiroComLabel>;

  const elemento = () => fixture.nativeElement as HTMLElement;
  const folha = () => elemento().querySelector('.folha');

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      providers: [provideZonelessChangeDetection()],
      imports: [HospedeiroComLabel],
    }).compileComponents();

    fixture = TestBed.createComponent(HospedeiroComLabel);
    fixture.detectChanges();

    elemento().querySelector<HTMLButtonElement>('.campo')!.click();
    await fixture.whenStable();
    fixture.detectChanges();
  });

  it('abre normalmente', () => {
    expect(folha()).not.toBeNull();
  });

  it('fecha ao tocar no fundo, sem o label reabrir', async () => {
    elemento().querySelector<HTMLElement>('.fundo')!.click();
    await fixture.whenStable();
    fixture.detectChanges();

    expect(folha()).toBeNull();
  });

  it('fecha ao escolher uma opção', async () => {
    elemento().querySelector<HTMLElement>('.opcao')!.click();
    await fixture.whenStable();
    fixture.detectChanges();

    expect(folha()).toBeNull();
  });
});
