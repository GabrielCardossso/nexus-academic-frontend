/** Datas do pedido: vencimento do pedido a prazo e conversões para o campo de data (hora local). */

export const PRAZO_DIAS = 30; // vencimento usado nos pedidos a prazo de exemplo (mocks)

/** "AAAA-MM-DD" → último instante desse dia (hora local); null se a data for inválida. */
export function fimDoDia(data: string): Date | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(data);
  if (!m) return null;
  const d = new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]), 23, 59, 59, 999);
  return d.getDate() === Number(m[3]) ? d : null; // recusa 31/02 etc.
}

/** ISO → "AAAA-MM-DD" na hora local (para o campo de data e para comparar datas). */
export function dataLocal(iso: string): string {
  const d = new Date(iso);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

/** Data de hoje em "AAAA-MM-DD" (hora local), para o mínimo do campo de data. */
export function hojeAAAAMMDD(desloc = 0): string {
  const d = new Date();
  d.setDate(d.getDate() + desloc);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

/** Pedido a prazo: o vencimento é obrigatório e precisa ser uma data futura (como o @Future do back). */
export function erroVencimento(data: string | undefined): string | null {
  if (!data) return 'Informe a data de vencimento do pedido a prazo.';
  const fim = fimDoDia(data);
  if (!fim) return 'Data de vencimento inválida.';
  if (data <= hojeAAAAMMDD()) return 'A data de vencimento precisa ser depois de hoje.';
  return null;
}
