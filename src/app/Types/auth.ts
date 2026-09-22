export interface LoginResponse {
  id: number;
  token: string;
  email: string;
}

export interface RegisterResponse {
  id: number;
  email: string;
  createdAt: string;
  updatedAt: string;
}
