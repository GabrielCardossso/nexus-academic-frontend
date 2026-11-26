/**
 * Hover que "preenche" o botão a partir do ponto onde o mouse entrou (e esvazia em direção ao ponto
 * onde saiu), trazido do hora-control (js/app.js + css/Interacoes.css). Vale para os botões com a
 * classe `destaque`. No toque (celular) não roda: não existe hover de verdade.
 *
 * O CSS (classe .preenchendo em App.css) desenha um círculo com radial-gradient e anima o raio pela
 * variável --preenchimento-raio (registrada com @property para poder ter transição).
 */
const SELETOR = 'button.destaque';

const botaoDoEfeito = (alvo: EventTarget | null) =>
  alvo instanceof Element ? alvo.closest<HTMLButtonElement>(SELETOR) : null;

/** Coloca o centro do círculo no ponto do mouse e devolve o raio que cobre o botão inteiro. */
function posicionar(botao: HTMLElement, e: PointerEvent): number {
  const area = botao.getBoundingClientRect();
  const x = Math.max(0, Math.min(area.width, e.clientX - area.left));
  const y = Math.max(0, Math.min(area.height, e.clientY - area.top));
  botao.style.setProperty('--preenchimento-x', `${x}px`);
  botao.style.setProperty('--preenchimento-y', `${y}px`);
  return Math.ceil(Math.hypot(area.width, area.height) * 1.15);
}

/** Liga o efeito na página inteira. Devolve a função que desliga (para o useEffect). */
export function instalarPreenchimentoHover(): () => void {
  const quadros = new WeakMap<HTMLElement, number>();

  const entrar = (e: PointerEvent) => {
    const botao = botaoDoEfeito(e.target);
    if (!botao || botao.disabled || e.pointerType === 'touch' || botao.contains(e.relatedTarget as Node | null)) return;
    cancelAnimationFrame(quadros.get(botao) ?? 0);
    botao.classList.add('preenchendo');
    const raio = posicionar(botao, e);
    botao.style.setProperty('--preenchimento-raio', '0px');
    // Dois quadros: o navegador precisa "ver" o raio 0 no ponto novo antes de crescer, senão não anima.
    quadros.set(
      botao,
      requestAnimationFrame(() =>
        quadros.set(
          botao,
          requestAnimationFrame(() => {
            if (botao.matches(':hover')) botao.style.setProperty('--preenchimento-raio', `${raio}px`);
          }),
        ),
      ),
    );
  };

  const sair = (e: PointerEvent) => {
    const botao = botaoDoEfeito(e.target);
    if (!botao || e.pointerType === 'touch' || botao.contains(e.relatedTarget as Node | null)) return;
    cancelAnimationFrame(quadros.get(botao) ?? 0);
    posicionar(botao, e); // esvazia em direção ao ponto de saída
    botao.style.setProperty('--preenchimento-raio', '0px');
  };

  document.addEventListener('pointerover', entrar);
  document.addEventListener('pointerout', sair);
  return () => {
    document.removeEventListener('pointerover', entrar);
    document.removeEventListener('pointerout', sair);
  };
}
