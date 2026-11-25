import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { contarSolicitacoesPendentes } from './services/api';
import { instalarPreenchimentoHover } from './utils/preenchimentoHover';
import ClientesTela from './telas/ClientesTela';
import ColaboradoresTela from './telas/ColaboradoresTela';
import DescontosTela from './telas/DescontosTela';
import PedidosTela from './telas/PedidosTela';
import ProdutosTela from './telas/ProdutosTela';

type AbaId = 'clientes' | 'produtos' | 'pedidos' | 'colaboradores' | 'descontos';

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
  {
    grupo: 'Gestão',
    itens: [
      { id: 'colaboradores', rotulo: 'Colaboradores', icone: 'user-check.svg' },
      { id: 'descontos', rotulo: 'Descontos', icone: 'percent.svg' },
    ],
  },
];

export default function App() {
  const [aba, setAba] = useState<AbaId>('clientes');
  const [recolhida, setRecolhida] = useState(false); // menu lateral só com ícones
  const [descontosPendentes, setDescontosPendentes] = useState(0); // contador no menu

  const atualizarContador = useCallback(async () => {
    try {
      setDescontosPendentes(await contarSolicitacoesPendentes());
    } catch {
      setDescontosPendentes(0); // back fora do ar: não mostra contador
    }
  }, []);

  // Pedidos novos (com solicitação) podem ter sido criados em outra tela.
  useEffect(() => {
    atualizarContador();
  }, [aba, atualizarContador]);

  const voltarAoTopo = () => {
    const semMovimento = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const comportamento = semMovimento ? 'auto' : 'smooth';
    // No celular quem rola é o <main> (a página fica parada por causa das barras do navegador); no PC, a página.
    document.querySelector('.conteudo')?.scrollTo({ top: 0, behavior: comportamento });
    window.scrollTo({ top: 0, behavior: comportamento });
  };

  // Hover que preenche os botões em destaque (+ Novo ...), igual ao hora-control.
  useEffect(() => instalarPreenchimentoHover(), []);

  // Fundo azul da aba ativa: um bloco só, que desliza de uma aba para a outra (PC e celular).
  const navRef = useRef<HTMLElement>(null);
  const jaMediu = useRef(false); // na primeira medida o bloco aparece no lugar, sem vir deslizando do canto
  const [indicador, setIndicador] = useState<{ x: number; y: number; w: number; h: number; animar: boolean }>();
  useLayoutEffect(() => {
    const nav = navRef.current;
    if (!nav) return;
    const medir = () => {
      const botao = nav.querySelector<HTMLElement>(`[data-aba="${aba}"]`);
      if (!botao) return;
      const n = nav.getBoundingClientRect();
      const b = botao.getBoundingClientRect();
      setIndicador({ x: b.left - n.left, y: b.top - n.top, w: b.width, h: b.height, animar: jaMediu.current });
      jaMediu.current = true;
    };
    medir();
    // Recolher o menu, girar o celular ou o contador de descontos mudam o tamanho dos botões.
    const observador = new ResizeObserver(medir);
    observador.observe(nav);
    nav.querySelectorAll('button').forEach((b) => observador.observe(b));
    return () => observador.disconnect();
  }, [aba, recolhida]);

  // Celular: no caminho até a aba nova, o vidro da lente estica e volta (como o vidro líquido da Apple).
  const abaAnterior = useRef(aba);
  useEffect(() => {
    if (abaAnterior.current === aba) return;
    abaAnterior.current = aba;
    const lente = navRef.current?.querySelector('.menu-indicador');
    const celular = window.matchMedia('(max-width: 760px)').matches;
    const semMovimento = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (!lente || !celular || semMovimento) return;
    const esticar = [
      { transform: 'scale(1, 1)' },
      { transform: 'scale(1.22, 0.86)', offset: 0.35 },
      { transform: 'scale(0.96, 1.05)', offset: 0.7 },
      { transform: 'scale(1, 1)' },
    ];
    const opcoes = { duration: 520, easing: 'ease-out' };
    lente.animate(esticar, { ...opcoes, pseudoElement: '::before' });
    lente.animate(esticar, { ...opcoes, pseudoElement: '::after' });
  }, [aba]);

  return (
    <div className="layout">
      <aside className={`sidebar ${recolhida ? 'recolhida' : ''}`}>
        {/* Tocar na logo volta para o topo da página (no celular ela é o círculo de vidro do topo). */}
        <div
          className="marca"
          role="button"
          tabIndex={0}
          title="Voltar ao topo"
          aria-label="Nexus: voltar ao topo"
          onClick={voltarAoTopo}
          onKeyDown={(e) => {
            if (e.key === 'Enter' || e.key === ' ') {
              e.preventDefault();
              voltarAoTopo();
            }
          }}
        >
          <img src="/icons/circle-nodes.svg" alt="" width={26} height={26} />
          <span className="texto">Nexus</span>
        </div>
        <nav ref={navRef}>
          {indicador && (
            <span
              className={`menu-indicador ${indicador.animar ? 'animar' : ''}`}
              aria-hidden="true"
              style={{
                width: indicador.w,
                height: indicador.h,
                transform: `translate(${indicador.x}px, ${indicador.y}px)`,
              }}
            />
          )}
          {MENU.map((g) => (
            <div key={g.grupo} className="menu-grupo">
              <span className="menu-titulo">{g.grupo}</span>
              {g.itens.map((item) => (
                <button
                  key={item.id}
                  type="button"
                  className={aba === item.id ? 'ativa' : ''}
                  data-aba={item.id}
                  aria-current={aba === item.id ? 'page' : undefined}
                  onClick={() => setAba(item.id)}
                  title={item.rotulo}
                >
                  <img src={`/icons/${item.icone}`} alt="" width={18} height={18} />
                  <span className="texto">{item.rotulo}</span>
                  {item.id === 'descontos' && descontosPendentes > 0 && (
                    <span className="contador" aria-label={`${descontosPendentes} pendentes`}>
                      {descontosPendentes}
                    </span>
                  )}
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
        {aba === 'descontos' && <DescontosTela onPendentesMudou={atualizarContador} />}
      </main>
    </div>
  );
}