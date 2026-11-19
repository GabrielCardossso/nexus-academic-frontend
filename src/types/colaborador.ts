/** Tipos de colaborador (quem aprova ou reprova os descontos). Espelham dtos/Colaborador*.java. */

/** POST /colaboradores e PUT /colaboradores/{id}/editar ("name" no back). */
export interface ColaboradorCriarRequest {
  nome: string;
  cpf: string; // só dígitos
  email: string;
}

/**
 * GET /colaboradores devolve name, cpf e email. O `id` (que a decisão de desconto exige) e o `ativo`
 * vêm dos dados locais; com o back real o id é provisório (negativo) até o back devolver.
 */
export interface Colaborador extends ColaboradorCriarRequest {
  id: number;
  ativo?: boolean; // false = desativado (soft delete no back). Ausente = ativo.
}
