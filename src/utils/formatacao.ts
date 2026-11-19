/** Formatação de valores para mostrar na tela (moeda, datas e CPF) e arredondamento de centavos. */

export const moeda = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' });
/**
 * "AAAA-MM-DD" (LocalDate do back) → "DD/MM/AAAA". Não usa new Date("AAAA-MM-DD"), que lê como UTC e
 * mostraria o dia anterior no horário de Brasília.
 */
export function dataBR(data: string | null | undefined): string {
  if (!data) return '—';
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(data);
  return m ? `${m[3]}/${m[2]}/${m[1]}` : new Date(data).toLocaleDateString('pt-BR');
}
export const dataHoraBR = (iso: string) =>
  new Date(iso).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' });

/** 12345678909 → 123.456.789-09 */
export const formatarCpf = (cpf: string) => cpf.replace(/^(\d{3})(\d{3})(\d{3})(\d{2})$/, '$1.$2.$3-$4');

/** Arredonda para centavos (2 casas). */
export const arredondar = (n: number) => Math.round(n * 100) / 100;
