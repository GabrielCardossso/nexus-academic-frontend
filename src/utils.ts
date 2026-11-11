import type { ChangeEvent } from 'react';

export type Mensagem = { tipo: 'sucesso' | 'erro'; texto: string } | null;

export const moeda = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' });
export const dataBR = (iso: string) => new Date(iso).toLocaleDateString('pt-BR');
export const dataHoraBR = (iso: string) =>
  new Date(iso).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' });

/** Atualiza um campo do formulário pelo atributo name do input/select. */
export function campo<T extends Record<string, string>>(setForm: (fn: (f: T) => T) => void) {
  return (e: ChangeEvent<HTMLInputElement | HTMLSelectElement>) =>
    setForm((f) => ({ ...f, [e.target.name]: e.target.value }));
}
