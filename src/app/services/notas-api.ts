import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';
import { environment } from '../../environments/environment';
import { Nota } from '../models/nota';

/**
 * Conversa com /notas (o diário). Deixa o erro subir de propósito: quem
 * chama é a fila de sincronização.
 */
@Injectable({
  providedIn: 'root',
})
export class NotasApi {
  private apiUrl = `${environment.apiUrl}/notas`;

  constructor(private http: HttpClient) {}

  async listar(): Promise<Nota[]> {
    const resposta = await firstValueFrom(this.http.get<{ notas: Nota[] }>(this.apiUrl));

    return resposta.notas.map((nota) => ({ ...nota, texto: nota.texto ?? '' }));
  }

  async criar(nota: Nota): Promise<number> {
    const resposta = await firstValueFrom(
      this.http.post<{ nota: Nota }>(this.apiUrl, { data: nota.data, texto: nota.texto }),
    );

    // se o dia já tinha nota no servidor (escrita em outro aparelho), ele
    // junta as duas e devolve a que existia: é esse id que passa a valer aqui
    return resposta.nota.id;
  }

  async editar(nota: Nota): Promise<void> {
    await firstValueFrom(this.http.put(`${this.apiUrl}/${nota.id}`, { texto: nota.texto }));
  }

  async apagar(id: number): Promise<void> {
    await firstValueFrom(this.http.delete(`${this.apiUrl}/${id}`));
  }
}
