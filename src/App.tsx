import { useState } from 'react';
import ClientesTela from './telas/ClientesTela';
import ColaboradoresTela from './telas/ColaboradoresTela';
import PedidosTela from './telas/PedidosTela';
import ProdutosTela from './telas/ProdutosTela';

type AbaId = 'clientes' | 'produtos' | 'pedidos' | 'colaboradores';

// Menu lateral: grupos com seus itens
const MENU: { grupo: string; itens: { id: AbaId; rotulo: string; icone: string }[] }[] = [
  {
    grupo: 'Cadastros',
    itens: [
      { id: 'clientes', rotulo: 'Clientes', icone: 'corporate.svg' },
      { id: 'produtos', rotulo: 'Produtos', icone: 'box-open.svg' },
    ],
  },
  { grupo: 'Vendas', itens: [{ id: 'pedidos', rotulo: 'Pedidos', icone: 'shopping-cart.svg' }] },
  { grupo: 'Gestão', itens: [{ id: 'colaboradores', rotulo: 'Colaboradores', icone: 'user-check.svg' }] },
];

export default function App() {
  const [aba, setAba] = useState<AbaId>('clientes');
  const [recolhida, setRecolhida] = useState(false); // menu lateral só com ícones

  return (
    <div className="layout">
      <aside className={`sidebar ${recolhida ? 'recolhida' : ''}`}>
        <div className="marca">
          <img src="/icons/circle-nodes.svg" alt="" width={26} height={26} />
          <span className="texto">Nexus</span>
        </div>
        <nav>
          {MENU.map((g) => (
            <div key={g.grupo} className="menu-grupo">
              <span className="menu-titulo">{g.grupo}</span>
              {g.itens.map((item) => (
                <button
                  key={item.id}
                  type="button"
                  className={aba === item.id ? 'ativa' : ''}
                  onClick={() => setAba(item.id)}
                  title={item.rotulo}
                >
                  <img src={`/icons/${item.icone}`} alt="" width={18} height={18} />
                  <span className="texto">{item.rotulo}</span>
                </button>
              ))}
            </div>
          ))}
        </nav>

        <button
  type="button"
  className="btn-recolher"
  onClick={() => setRecolhida((r) => !r)}
  title={recolhida ? 'Expandir menu' : 'Recolher menu'}
>
  <img 
    src={`/icons/${recolhida ? 'angle-double-small-right.svg' : 'angle-double-small-left.svg'}`} 
    alt="" 
    width={18} 
    height={18} 
  />
</button>
      </aside>

      <main className="conteudo">
        {aba === 'clientes' && <ClientesTela />}
        {aba === 'produtos' && <ProdutosTela />}
        {aba === 'pedidos' && <PedidosTela />}
        {aba === 'colaboradores' && <ColaboradoresTela />}
      </main>
    </div>
  );
}