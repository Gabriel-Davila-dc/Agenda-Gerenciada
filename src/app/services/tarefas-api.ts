import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';
import { environment } from '../../environments/environment';
import { Tarefa } from '../models/tarefa';

/**
 * Conversa com /tarefas. Deixa o erro subir de propósito: quem chama é a
 * fila de sincronização, que precisa saber se falhou para tentar de novo.
 */
@Injectable({
  providedIn: 'root',
})
export class TarefasApi {
  private apiUrl = `${environment.apiUrl}/tarefas`;

  constructor(private http: HttpClient) {}

  async listar(): Promise<Tarefa[]> {
    const resposta = await firstValueFrom(this.http.get<{ tarefas: Tarefa[] }>(this.apiUrl));

    return resposta.tarefas.map((tarefa) => this.normalizar(tarefa));
  }

  async criar(tarefa: Tarefa): Promise<number> {
    const resposta = await firstValueFrom(
      this.http.post<{ tarefa: Tarefa }>(this.apiUrl, tarefa),
    );

    return resposta.tarefa.id;
  }

  async editar(tarefa: Tarefa): Promise<void> {
    await firstValueFrom(this.http.put(`${this.apiUrl}/${tarefa.id}`, tarefa));
  }

  async apagar(id: number): Promise<void> {
    await firstValueFrom(this.http.delete(`${this.apiUrl}/${id}`));
  }

  // o banco devolve null onde o formulário usa string vazia
  private normalizar(tarefa: Tarefa): Tarefa {
    return {
      ...tarefa,
      titulo: tarefa.titulo ?? '',
      area: tarefa.area ?? '',
      tipo: tarefa.tipo ?? '',
      objetivo: tarefa.objetivo ?? '',
      dataInicio: tarefa.dataInicio ?? '',
      dataFim: tarefa.dataFim ?? '',
      diasPulados: tarefa.diasPulados ?? [],
      descricao: tarefa.descricao ?? '',
      aprendizado: tarefa.aprendizado ?? '',
      historicoEtapas: tarefa.historicoEtapas ?? [],
    };
  }
}
