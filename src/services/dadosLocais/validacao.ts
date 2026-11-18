/** Validação de documentos (CNPJ do cliente e CPF do colaborador). */

/**
 * Valida CNPJ (dígitos verificadores). Aceita também o CNPJ alfanumérico
 * (letras + números), em que cada caractere vale "código ASCII − 48".
 */
export function cnpjValido(cnpj: string): boolean {
  if (!/^[0-9A-Z]{12}\d{2}$/.test(cnpj) || /^(.)\1{13}$/.test(cnpj)) return false;
  const digito = (pesos: number[]) => {
    const soma = pesos.reduce((acc, peso, i) => acc + (cnpj.charCodeAt(i) - 48) * peso, 0);
    const resto = soma % 11;
    return resto < 2 ? 0 : 11 - resto;
  };
  return (
    digito([5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2]) === Number(cnpj[12]) &&
    digito([6, 5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2]) === Number(cnpj[13])
  );
}

/** Valida CPF (11 dígitos e dígitos verificadores; recusa todos iguais, como 111.111.111-11). */
export function cpfValido(cpf: string): boolean {
  if (!/^\d{11}$/.test(cpf) || /^(\d)\1{10}$/.test(cpf)) return false;
  const digito = (tamanho: number) => {
    const soma = [...cpf.slice(0, tamanho)].reduce((acc, d, i) => acc + Number(d) * (tamanho + 1 - i), 0);
    const resto = (soma * 10) % 11;
    return resto === 10 ? 0 : resto;
  };
  return digito(9) === Number(cpf[9]) && digito(10) === Number(cpf[10]);
}
