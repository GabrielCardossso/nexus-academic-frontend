/** Formatação de valores para mostrar na tela (moeda, datas e CPF) e arredondamento de centavos. */

export const moeda = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' });
export const dataBR = (iso: string) => new Date(iso).toLocaleDateString('pt-BR');
export const dataHoraBR = (iso: string) =>
  new Date(iso).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' });

/** 12345678909 → 123.456.789-09 */
export const formatarCpf = (cpf: string) => cpf.replace(/^(\d{3})(\d{3})(\d{3})(\d{2})$/, '$1.$2.$3-$4');

/** Arredonda para centavos (2 casas). */
export const arredondar = (n: number) => Math.round(n * 100) / 100;
