/** Tipos de colaborador (quem aprova ou reprova os descontos). Espelham dtos/Colaborador*.java. */

/** POST /colaboradores e PUT /colaboradores/{id}/editar ("name" no back). */
export interface ColaboradorCriarRequest {
  nome: string;
  cpf: string; // só dígitos
  email: string;
}

/**
 * GET /colaboradores devolve id, name, cpf e email. O `ativo` só os dados locais preenchem (o back não
 * lista desativados).
 */
export interface Colaborador extends ColaboradorCriarRequest {
  id: number;
  ativo?: boolean; // false = desativado (soft delete no back). Ausente = ativo.
}
