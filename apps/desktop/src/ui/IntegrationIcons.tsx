/* ----------------------------------------------------------------
   Ícones das integrações — SVG de traço, no lugar dos emojis.
   Herdam a cor do contexto (currentColor) e o tamanho por prop.
   ---------------------------------------------------------------- */

type IconProps = { size?: number }

const base = (size: number) => ({
  width: size,
  height: size,
  viewBox: '0 0 24 24',
  fill: 'none',
  stroke: 'currentColor',
  strokeWidth: 1.6,
  strokeLinecap: 'round' as const,
  strokeLinejoin: 'round' as const,
})

/** Busca na web */
export function SearchIcon({ size = 22 }: IconProps) {
  return (
    <svg {...base(size)}>
      <circle cx="11" cy="11" r="7" />
      <path d="M20 20l-3.5-3.5" />
    </svg>
  )
}

/** Mensagens / notificações */
export function ChatIcon({ size = 22 }: IconProps) {
  return (
    <svg {...base(size)}>
      <path d="M21 11.5a8.4 8.4 0 0 1-9 8.4 8.9 8.9 0 0 1-4-.9L3 21l1.9-4.6A8.4 8.4 0 0 1 12 3.1a8.4 8.4 0 0 1 9 8.4z" />
    </svg>
  )
}

/** Finanças */
export function WalletIcon({ size = 22 }: IconProps) {
  return (
    <svg {...base(size)}>
      <path d="M3 7.5A2.5 2.5 0 0 1 5.5 5H18a1 1 0 0 1 1 1v1.5" />
      <path d="M3 7.5v9A2.5 2.5 0 0 0 5.5 19H19a1 1 0 0 0 1-1v-8a1 1 0 0 0-1-1H5.5A2.5 2.5 0 0 1 3 7.5z" />
      <circle cx="16" cy="14" r="1.1" />
    </svg>
  )
}

/** Casa inteligente */
export function HomeIcon({ size = 22 }: IconProps) {
  return (
    <svg {...base(size)}>
      <path d="M3 10.5 12 3l9 7.5" />
      <path d="M5.5 9.5V20h13V9.5" />
      <path d="M10 20v-5h4v5" />
    </svg>
  )
}

/** Música */
export function MusicIcon({ size = 22 }: IconProps) {
  return (
    <svg {...base(size)}>
      <path d="M9 18V5l12-2v13" />
      <circle cx="6" cy="18" r="3" />
      <circle cx="18" cy="16" r="3" />
    </svg>
  )
}

/** Servidor / MCP */
export function ServerIcon({ size = 22 }: IconProps) {
  return (
    <svg {...base(size)}>
      <rect x="3" y="4" width="18" height="7" rx="1.5" />
      <rect x="3" y="13" width="18" height="7" rx="1.5" />
      <path d="M7 7.5h.01M7 16.5h.01" />
    </svg>
  )
}

const BY_ID: Record<string, (p: IconProps) => React.ReactElement> = {
  tavily: SearchIcon,
  telegram: ChatIcon,
  lemonfin: WalletIcon,
  tuya: HomeIcon,
  spotify: MusicIcon,
  mcp: ServerIcon,
}

/** Ícone da integração pelo id; cai num genérico se o id for desconhecido. */
export function IntegrationIcon({ id, size = 22 }: { id: string; size?: number }) {
  const Icon = BY_ID[id] ?? ServerIcon
  return <Icon size={size} />
}
