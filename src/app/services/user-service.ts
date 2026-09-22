import { HttpClient } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { firstValueFrom, tap } from 'rxjs';
import { environment } from '../../environments/environment';
import { LoginResponse, RegisterResponse } from '../Types/auth';

/**
 * valido: o servidor aceitou o token.
 * invalido: o servidor recusou (401) — vencido, inventado ou deslogado.
 * fora-do-ar: o servidor nem respondeu direito. Não diz nada sobre o token.
 */
export type EstadoToken = 'valido' | 'invalido' | 'fora-do-ar';

@Injectable({
  providedIn: 'root',
})
export class UserService {
  private apiUrl = environment.apiUrl;

  constructor(private http: HttpClient) {}

  async estadoDoToken(): Promise<EstadoToken> {
    try {
      await firstValueFrom(this.http.get(`${this.apiUrl}/users/token`));
      return 'valido';
    } catch (erro) {
      // só o 401 é recusa do token; sem rede o status vem 0, e 5xx é o
      // servidor quebrado — nenhum dos dois pode tirar o usuário do app
      const status = (erro as { status?: number })?.status;
      return status === 401 ? 'invalido' : 'fora-do-ar';
    }
  }

  //Login--------------------------------------------------------------------------------------
  getUserLogin(email: string, password: string) {
    return this.http.post<LoginResponse>(`${this.apiUrl}/users/login`, { email, password }).pipe(
      tap((res) => {
        localStorage.setItem('token', res.token);
        localStorage.setItem('email', res.email);
      }),
    );
  }
  //Registrar------------------------------------------------------------------------------------
  postUserRegister(email: string, password: string) {
    return this.http.post<RegisterResponse>(`${this.apiUrl}/users`, { email, password });
  }
  //Logout---------------------------------------------------------------------------------------
  async logout(): Promise<void> {
    try {
      await firstValueFrom(this.http.post(`${this.apiUrl}/users/logout`, {}));
    } catch {
      // sem rede o servidor não fica sabendo, mas sair daqui não pode travar:
      // o token some deste aparelho de qualquer jeito e vence em 7 dias
    } finally {
      localStorage.removeItem('token');
      localStorage.removeItem('email');
    }
  }
}
