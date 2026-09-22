export type TipoCadastro = 'areas' | 'tipos' | 'objetivos';

export interface ItemCadastro {
  id: number;
  tipo: TipoCadastro;
  nome: string;
}
