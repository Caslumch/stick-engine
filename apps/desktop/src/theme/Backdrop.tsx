/**
 * Camada de fundo: manchas de cor desfocadas + tint radial + foto opcional.
 * Monta uma vez no topo do app e nunca desmonta.
 * Seções 2 e 2.1 do DESIGN_SYSTEM.md.
 */
export function Backdrop() {
  return (
    <>
      <div className="backdrop-photo" />
      <div className="backdrop-blobs">
        <span className="backdrop-blob backdrop-blob-1" />
        <span className="backdrop-blob backdrop-blob-2" />
        <span className="backdrop-blob backdrop-blob-3" />
        <span className="backdrop-blob backdrop-blob-4" />
      </div>
      <div className="backdrop-tint" />
    </>
  )
}
