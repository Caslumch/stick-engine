/* ----------------------------------------------------------------
   orbDrag — estado compartilhado de drag do orb.
   O Voice.tsx escreve via pointer events no overlay,
   o JarvisOrb lê no useFrame.
   Ref simples, sem React state (precisa ser síncrono no frame loop).
   ---------------------------------------------------------------- */

export const orbDrag = {
  active: false,
  /** Velocidade angular acumulada (inércia) */
  velX: 0,
  velY: 0,
  /** Rotação do usuário */
  userX: 0,
  userY: 0,
  /** Posição anterior do pointer */
  prevX: 0,
  prevY: 0,
}

export function orbDragStart(clientX: number, clientY: number) {
  orbDrag.active = true
  orbDrag.prevX = clientX
  orbDrag.prevY = clientY
  orbDrag.velX = 0
  orbDrag.velY = 0
}

export function orbDragMove(clientX: number, clientY: number) {
  if (!orbDrag.active) return
  const dx = (clientX - orbDrag.prevX) * 0.006
  const dy = (clientY - orbDrag.prevY) * 0.006
  orbDrag.userY += dx
  orbDrag.userX += dy
  orbDrag.userX = Math.max(-Math.PI / 3, Math.min(Math.PI / 3, orbDrag.userX))
  orbDrag.velX = dy * 0.5
  orbDrag.velY = dx * 0.5
  orbDrag.prevX = clientX
  orbDrag.prevY = clientY
}

export function orbDragEnd() {
  orbDrag.active = false
}
