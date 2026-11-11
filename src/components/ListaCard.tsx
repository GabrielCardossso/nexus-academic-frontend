export type ItemLista = { chave: string; titulo: string; detalhes: string[] };

interface ListaCardProps {
  titulo: string;
  textoBotao: string;
  itens: ItemLista[] | null; // null = ainda não listou
  carregando: boolean;
  erro: string | null;
  onListar: () => void;
}

/** Card de listagem: botão "Listar" + os itens retornados. */
export default function ListaCard({ titulo, textoBotao, itens, carregando, erro, onListar }: ListaCardProps) {
  return (
    <section className="card">
      <h2>{titulo}</h2>
      {erro && <p className="msg erro">{erro}</p>}
      {itens && itens.length === 0 && <p className="vazio">Nenhum registro encontrado.</p>}
      {itens && itens.length > 0 && (
        <ul className="lista">
          {itens.map((item) => (
            <li key={item.chave}>
              <strong>{item.titulo}</strong>
              {item.detalhes.map((detalhe, i) => (
                <span key={i}>{detalhe}</span>
              ))}
            </li>
          ))}
        </ul>
      )}
      <button type="button" onClick={onListar} disabled={carregando}>
        {carregando ? 'Carregando...' : textoBotao}
      </button>
    </section>
  );
}
