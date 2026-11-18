/** Pedidos e descontos: por enquanto só nos dados locais (ver exigirModoLocal em http.ts). */
import type { PedidoCriarRequest } from '../../types';
import {
  cancelarPedidoLocal,
  confirmarPedidoLocal,
  criarPedidoLocal,
  decidirDescontoLocal,
  devolverPedidoLocal,
  editarPedidoLocal,
  listarPedidosLocal,
  pagarPedidoLocal,
} from '../dadosLocais';
import { exigirModoLocal } from './http';

export async function listarPedidos() {
  exigirModoLocal();
  return listarPedidosLocal();
}

export async function criarPedido(pedido: PedidoCriarRequest) {
  exigirModoLocal();
  return criarPedidoLocal(pedido);
}

export async function editarPedido(pedidoId: number, pedido: PedidoCriarRequest) {
  exigirModoLocal();
  return editarPedidoLocal(pedidoId, pedido);
}

export async function cancelarPedido(pedidoId: number) {
  exigirModoLocal();
  return cancelarPedidoLocal(pedidoId);
}

export async function confirmarPedido(pedidoId: number) {
  exigirModoLocal();
  return confirmarPedidoLocal(pedidoId);
}

export async function pagarPedido(pedidoId: number) {
  exigirModoLocal();
  return pagarPedidoLocal(pedidoId);
}

export async function devolverPedido(pedidoId: number) {
  exigirModoLocal();
  return devolverPedidoLocal(pedidoId);
}

export async function decidirDesconto(pedidoId: number, aprovar: boolean, colaboradorId: number) {
  exigirModoLocal();
  return decidirDescontoLocal(pedidoId, aprovar, colaboradorId);
}
