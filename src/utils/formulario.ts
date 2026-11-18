/** Ajudantes de formulário e das mensagens de aviso das telas. */
import type { ChangeEvent } from 'react';

/** Mensagem do aviso flutuante (sucesso ou erro); null = sem aviso. */
export type Mensagem = { tipo: 'sucesso' | 'erro'; texto: string } | null;

/** Atualiza um campo do formulário pelo atributo name do input/select. */
export function campo<T extends Record<string, string>>(setForm: (fn: (f: T) => T) => void) {
  return (e: ChangeEvent<HTMLInputElement | HTMLSelectElement>) =>
    setForm((f) => ({ ...f, [e.target.name]: e.target.value }));
}
