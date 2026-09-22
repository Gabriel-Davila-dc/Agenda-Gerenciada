import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';
import { environment } from '../../environments/environment';
import { ItemCadastro } from '../models/item-cadastro';

@Injectable({
  providedIn: 'root',
})
export class CadastrosApi {
  private apiUrl = `${environment.apiUrl}/cadastros`;

  constructor(private http: HttpClient) {}

  async listar(): Promise<ItemCadastro[]> {
    const resposta = await firstValueFrom(
      this.http.get<{ cadastros: ItemCadastro[] }>(this.apiUrl),
    );

    return resposta.cadastros;
  }

  async criar(item: ItemCadastro): Promise<number> {
    const resposta = await firstValueFrom(
      this.http.post<{ cadastro: ItemCadastro }>(this.apiUrl, {
        tipo: item.tipo,
        nome: item.nome,
      }),
    );

    // se o nome já existia, o servidor devolve o registro existente em vez de
    // recusar, e é esse id que passa a valer aqui
    return resposta.cadastro.id;
  }

  async editar(item: ItemCadastro): Promise<void> {
    await firstValueFrom(this.http.put(`${this.apiUrl}/${item.id}`, { nome: item.nome }));
  }

  async apagar(id: number): Promise<void> {
    await firstValueFrom(this.http.delete(`${this.apiUrl}/${id}`));
  }
}
