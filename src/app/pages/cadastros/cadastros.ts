import { ChangeDetectorRef, Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { MatIconModule } from '@angular/material/icon';

import { ItemCadastro, TipoCadastro } from '../../models/item-cadastro';
import { CadastrosService } from '../../services/cadastros-service';
import { TarefasService } from '../../services/tarefas-service';

interface Grupo {
  tipo: TipoCadastro;
  titulo: string;
  descricao: string;
  icone: string;
  placeholder: string;
  itens: ItemCadastro[];
  novo: string;
}

@Component({
  standalone: true,
  selector: 'app-cadastros',
  imports: [CommonModule, RouterModule, FormsModule, MatIconModule],
  templateUrl: './cadastros.html',
  styleUrl: './cadastros.css',
})
export class Cadastros {
  grupos: Grupo[] = [
    {
      tipo: 'objetivos',
      titulo: 'Objetivos',
      descricao: 'Aonde você quer chegar. Cada tarefa pode apontar para um, e a agenda filtra por ele.',
      icone: 'flag',
      placeholder: 'Ex.: Dominar Angular',
      itens: [],
      novo: '',
    },
    {
      tipo: 'areas',
      titulo: 'Áreas',
      descricao: 'As partes da vida em que as tarefas acontecem.',
      icone: 'category',
      placeholder: 'Ex.: Estudo',
      itens: [],
      novo: '',
    },
    {
      tipo: 'tipos',
      titulo: 'Tipos',
      descricao: 'Que tipo de coisa é a tarefa: hábito, leitura, projeto...',
      icone: 'sell',
      placeholder: 'Ex.: Leitura',
      itens: [],
      novo: '',
    },
  ];

  // item que está sendo renomeado no momento
  editando: { id: number; valor: string } | null = null;

  constructor(
    private cadastros: CadastrosService,
    private tarefasService: TarefasService,
    private cd: ChangeDetectorRef,
  ) {
    this.recarregar();
    this.sincronizar();
  }

  private async sincronizar(): Promise<void> {
    await this.cadastros.carregarDoServidor();
    this.recarregar();

    // zoneless: o que muda depois do await não é percebido sozinho
    this.cd.markForCheck();
  }

  private recarregar(): void {
    this.grupos.forEach((grupo) => (grupo.itens = this.cadastros.listar(grupo.tipo)));
  }

  adicionar(grupo: Grupo): void {
    grupo.itens = this.cadastros.adicionar(grupo.tipo, grupo.novo);
    grupo.novo = '';
  }

  remover(grupo: Grupo, item: ItemCadastro): void {
    grupo.itens = this.cadastros.remover(grupo.tipo, item.id);
  }

  editar(item: ItemCadastro): void {
    this.editando = { id: item.id, valor: item.nome };
  }

  estaEditando(item: ItemCadastro): boolean {
    return this.editando?.id === item.id;
  }

  confirmarEdicao(grupo: Grupo): void {
    if (!this.editando) {
      return;
    }

    const { id, valor } = this.editando;
    const antigo = grupo.itens.find((item) => item.id === id)?.nome ?? '';
    const novo = valor.trim();

    if (novo && novo !== antigo) {
      grupo.itens = this.cadastros.renomear(grupo.tipo, id, novo);
      // leva o nome novo para as tarefas que já usavam o antigo
      this.tarefasService.atualizarReferencia(grupo.tipo, antigo, novo);
    }

    this.editando = null;
  }

  cancelarEdicao(): void {
    this.editando = null;
  }
}
