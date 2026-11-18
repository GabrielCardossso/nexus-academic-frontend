/** Tipos de colaborador (quem aprova ou rejeita os descontos). */

export interface ColaboradorCriarRequest {
  nome: string;
  cpf: string; // só dígitos
  email: string;
}

export interface Colaborador extends ColaboradorCriarRequest {
  id: number;
  ativo?: boolean; // false = desativado (não decide descontos). Ausente = ativo.
}
