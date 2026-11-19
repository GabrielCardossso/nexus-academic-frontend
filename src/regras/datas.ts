/** Datas no formato do back (LocalDate = "AAAA-MM-DD"), sempre na hora local. */

/** Data de hoje (ou deslocada em dias) em "AAAA-MM-DD". */
export function hojeAAAAMMDD(desloc = 0): string {
  const d = new Date();
  d.setDate(d.getDate() + desloc);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

/** "AAAA-MM-DD" existe no calendário (recusa 31/02 etc.). */
export function dataValida(data: string): boolean {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(data);
  if (!m) return false;
  const d = new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
  return d.getMonth() === Number(m[2]) - 1 && d.getDate() === Number(m[3]);
}

/**
 * Data obrigatória e futura (como o @Future do back). `oQue` entra na mensagem:
 * "a data de vencimento do pedido", "a data de devolução do aluguel"...
 */
export function erroDataFutura(data: string | undefined | null, oQue: string): string | null {
  if (!data) return `Informe ${oQue}.`;
  if (!dataValida(data)) return `Data inválida: ${oQue}.`;
  if (data <= hojeAAAAMMDD()) return `${oQue[0].toUpperCase()}${oQue.slice(1)} precisa ser depois de hoje.`;
  return null;
}
