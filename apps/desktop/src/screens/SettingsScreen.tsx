import { useEffect, useState, useCallback, useRef } from 'react'
import { createPortal } from 'react-dom'
import { useJarvisStore } from '../stores/jarvis.store'
import { useSocket } from '../hooks/useSocket'
import { useTheme, type ThemeMode } from '../theme/ThemeProvider'
import { IntegrationIcon } from '../ui/IntegrationIcons'
import { logUI } from '../hooks/logUI'

/**
 * Tela de settings — tabs no topo, cards de vidro, modal de integrações.
 * Seção 11 do DESIGN_SYSTEM.md.
 */

type SettingsTab = 'general' | 'voice' | 'integrations' | 'shortcuts'

const TABS: { id: SettingsTab; label: string }[] = [
  { id: 'general', label: 'Geral' },
  { id: 'voice', label: 'Voz' },
  { id: 'integrations', label: 'Integrações' },
  { id: 'shortcuts', label: 'Atalhos' },
]

const ACCENT_SWATCHES = [
  '#4ADFB0', '#57C8FF', '#8B7BFF', '#FF9B7B', '#FFD25C', '#E6ECE9',
]

const BG_PRESETS: Record<string, string> = {
  none: 'none',
  mesh: `radial-gradient(at 18% 20%,#2BD4A8 0px,transparent 52%),
         radial-gradient(at 78% 12%,#7B6BFF 0px,transparent 50%),
         radial-gradient(at 62% 82%,#57C8FF 0px,transparent 52%),
         radial-gradient(at 12% 86%,#FFB45C 0px,transparent 48%),
         linear-gradient(160deg,#123,#021)`,
  dusk: `radial-gradient(at 70% 18%,#FF9B7B 0px,transparent 46%),
         radial-gradient(at 22% 34%,#8B5CF6 0px,transparent 48%),
         radial-gradient(at 50% 92%,#1E3A5F 0px,transparent 56%),
         linear-gradient(200deg,#2A1B3D,#0B1020)`,
}

const TOOLS = [
  { name: 'Abrir app', on: true, desc: 'Abrir programas instalados' },
  { name: 'Executar comando', on: true, desc: 'Executar comandos no terminal' },
  { name: 'Gerenciar arquivos', on: true, desc: 'Criar, ler, mover e deletar arquivos' },
  { name: 'Buscar na web', on: true, desc: 'Pesquisa web via Tavily' },
  { name: 'Lembretes', on: true, desc: 'Lembretes e notificações agendadas' },
  { name: 'Telegram', on: true, desc: 'Enviar mensagens via Telegram' },
  { name: 'Finanças', on: true, desc: 'Consultar finanças (LemonFin)' },
  { name: 'Casa inteligente', on: true, desc: 'Controlar luzes e dispositivos (Tuya)' },
  { name: 'Spotify', on: true, desc: 'Pesquisar e controlar música' },
]

const LLM_MODELS = [
  { value: 'qwen3:8b', label: 'Qwen3 8B', desc: 'Recomendado. Tool calling excelente, PT-BR natural. 8B params.' },
  { value: 'qwen3:14b', label: 'Qwen3 14B', desc: 'Mais inteligente, tool calling top. Precisa de mais RAM. 14B params.' },
  { value: 'llama3.1', label: 'Llama 3.1', desc: 'Meta. Bom em seguir instruções e PT-BR. 8B params.' },
  { value: 'llama3.2', label: 'Llama 3.2', desc: 'Meta. Versão compacta, rápida. 3B params.' },
  { value: 'mistral', label: 'Mistral', desc: 'Mistral AI. Rápido e eficiente. 7B params.' },
  { value: 'gemma2', label: 'Gemma 2', desc: 'Google. Compacto e preciso. 9B params.' },
  { value: 'deepseek-r1', label: 'DeepSeek R1', desc: 'DeepSeek. Forte em raciocínio lógico. 7B params.' },
]

const IN_TAURI = typeof window !== 'undefined' && '__TAURI_INTERNALS__' in window

// ═══════════════════════════════════════════════════════════════
// Main
// ═══════════════════════════════════════════════════════════════

export function SettingsScreen() {
  const { loadSettings } = useSocket()
  const [tab, setTab] = useState<SettingsTab>('general')

  useEffect(() => {
    loadSettings()
  }, [loadSettings])

  return (
    <div style={{
      height: '100vh',
      overflowY: 'auto',
      padding: '96px 24px 210px',
      maskImage: 'linear-gradient(#000 calc(100% - 130px), transparent calc(100% - 26px))',
    }}>
      <div style={{ maxWidth: 680, margin: '0 auto' }}>
        <h1 style={{
          fontSize: 30,
          fontWeight: 500,
          color: 'var(--t-hi)',
          letterSpacing: '-.026em',
          marginBottom: 6,
        }}>
          Ajustes
        </h1>
        <p style={{ fontSize: 15, color: 'var(--t-low)', marginBottom: 24 }}>
          Tudo é aplicado assim que você muda.
        </p>

        {/* Tabs */}
        <div style={{
          display: 'flex',
          gap: 4,
          padding: 3,
          borderRadius: 'var(--r-pill)',
          background: 'var(--fill-1)',
          border: '1px solid var(--hair)',
          marginBottom: 24,
          position: 'relative',
        }}>
          <span style={{
            position: 'absolute',
            top: 3,
            left: 3,
            height: 'calc(100% - 6px)',
            borderRadius: 'var(--r-pill)',
            background: 'var(--fill-3)',
            border: '1px solid var(--g-edge)',
            transition: 'transform .44s var(--sp-morph), width .44s var(--sp-morph)',
            width: `${100 / TABS.length}%`,
            transform: `translateX(${TABS.findIndex(t => t.id === tab) * 100}%)`,
          }} />
          {TABS.map((t) => (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              style={{
                flex: 1,
                position: 'relative',
                zIndex: 1,
                height: 34,
                borderRadius: 'var(--r-pill)',
                fontSize: 13,
                fontWeight: 450,
                color: tab === t.id ? 'var(--t-hi)' : 'var(--t-low)',
                background: 'none',
                border: 'none',
                cursor: 'pointer',
                fontFamily: 'var(--f)',
                transition: 'color .22s',
              }}
            >
              {t.label}
            </button>
          ))}
        </div>

        {/* Tab Content */}
        {tab === 'general' && <GeneralTab />}
        {tab === 'voice' && <VoiceTab />}
        {tab === 'integrations' && <IntegrationsTab />}
        {tab === 'shortcuts' && <ShortcutsTab />}
      </div>
    </div>
  )
}

// ═══════════════════════════════════════════════════════════════
// Tab: General
// ═══════════════════════════════════════════════════════════════

function GeneralTab() {
  return (
    <>
      <AppearanceGroup />
      <AgentGroup />
      <OrbGroup />
      <ToolsGroup />
    </>
  )
}

function AppearanceGroup() {
  const { mode, setMode } = useTheme()
  const { updateSetting } = useSocket()
  const settings = useJarvisStore((s) => s.settings)

  const accent = settings['ui.accent'] || ACCENT_SWATCHES[0]
  const bgPreset = settings['ui.bgPreset'] || 'none'
  const bgBlur = parseInt(settings['ui.bgBlur'] || '18', 10)
  const bgDim = parseInt(settings['ui.bgDim'] || '55', 10)
  const fileRef = useRef<HTMLInputElement>(null)

  // Aplicar settings visuais ao montar (restaurar do banco)
  useEffect(() => {
    if (settings['ui.accent']) applyAccentCSS(settings['ui.accent'])
    if (settings['ui.bgPreset'] && settings['ui.bgPreset'] !== 'none') applyBgCSS(settings['ui.bgPreset'])
    if (settings['ui.bgBlur']) document.documentElement.style.setProperty('--bg-blur', settings['ui.bgBlur'] + 'px')
    if (settings['ui.bgDim']) document.documentElement.style.setProperty('--bg-dim', String(parseInt(settings['ui.bgDim'], 10) / 100))
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const applyAccentCSS = (color: string) => {
    const state = useJarvisStore.getState().state
    if (state === 'idle') {
      document.documentElement.style.setProperty('--accent', color)
      const n = parseInt(color.slice(1), 16)
      document.documentElement.style.setProperty('--accent-rgb',
        `${(n >> 16) & 255}, ${(n >> 8) & 255}, ${n & 255}`)
    }
  }

  const applyAccent = (color: string) => {
    applyAccentCSS(color)
    updateSetting('ui.accent', color)
  }

  const applyBgCSS = (key: string) => {
    const hasImg = key !== 'none' && key !== 'custom'
    document.documentElement.style.setProperty('--bg-img', BG_PRESETS[key] ?? key)
    document.documentElement.style.setProperty('--blob-op', hasImg ? '.35' : '1')
    const photo = document.querySelector('.backdrop-photo') as HTMLElement | null
    if (photo) {
      if (hasImg) photo.setAttribute('data-active', '')
      else photo.removeAttribute('data-active')
    }
  }

  const applyBg = (key: string) => {
    applyBgCSS(key)
    updateSetting('ui.bgPreset', key)
  }

  const handleFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0]
    if (!f) return
    const reader = new FileReader()
    reader.onload = () => {
      const dataUrl = `url("${reader.result}")`
      applyBgCSS(dataUrl)
      updateSetting('ui.bgPreset', dataUrl)
    }
    reader.readAsDataURL(f)
  }

  return (
    <Group title="Aparência">
      <Row label="Tema" description="Automático segue o sistema.">
        <Segmented
          options={[
            { value: 'light', label: 'Claro' },
            { value: 'dark', label: 'Escuro' },
            { value: 'auto', label: 'Automático' },
          ]}
          value={mode}
          onChange={(v) => setMode(v as ThemeMode)}
        />
      </Row>
      <Row label="Cor de destaque" description="Cor base quando o agente está parado. Os estados sobrepõem essa cor.">
        <div style={{ display: 'flex', gap: 8 }}>
          {ACCENT_SWATCHES.map((c) => (
            <button
              key={c}
              onClick={() => applyAccent(c)}
              style={{
                width: 26, height: 26, borderRadius: '50%',
                border: accent === c ? '2px solid var(--t-hi)' : '2px solid transparent',
                background: 'none', cursor: 'pointer', position: 'relative',
                transition: 'transform .22s var(--sp)', padding: 0,
              }}
            >
              <span style={{ position: 'absolute', inset: 3, borderRadius: '50%', background: c }} />
            </button>
          ))}
        </div>
      </Row>
      <Row label="Plano de fundo" description="Fica atrás do vidro. Personalizado carrega uma imagem do seu computador.">
        <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
          <Segmented
            options={[
              { value: 'none', label: 'Nenhum' },
              { value: 'mesh', label: 'Malha' },
              { value: 'dusk', label: 'Entardecer' },
            ]}
            value={bgPreset === 'custom' ? '' : bgPreset}
            onChange={applyBg}
          />
          <button
            onClick={() => fileRef.current?.click()}
            style={{
              height: 32, padding: '0 14px', borderRadius: 'var(--r-pill)',
              fontSize: 13, color: 'var(--t-hi)', background: 'var(--fill-2)',
              border: '1px solid var(--g-edge)', cursor: 'pointer',
              fontFamily: 'var(--f)', transition: '.2s',
            }}
          >
            Personalizado…
          </button>
          <input ref={fileRef} type="file" accept="image/*" hidden onChange={handleFile} />
        </div>
      </Row>
      <Row label="Desfoque do fundo" description="Mais desfoque mantém o texto legível sobre fotos carregadas.">
        <Slider value={bgBlur} min={0} max={60} suffix="px" onChange={(v) => { updateSetting('ui.bgBlur', String(v)); document.documentElement.style.setProperty('--bg-blur', v + 'px') }} />
      </Row>
      <Row label="Escurecer fundo" description="Quanto da cor base fica por cima da imagem.">
        <Slider value={bgDim} min={0} max={95} suffix="%" onChange={(v) => { updateSetting('ui.bgDim', String(v)); document.documentElement.style.setProperty('--bg-dim', String(v / 100)) }} />
      </Row>
    </Group>
  )
}

function AgentGroup() {
  const { updateSetting } = useSocket()
  const settings = useJarvisStore((s) => s.settings)
  const currentModel = settings['llm.ollama.model'] || 'qwen3:8b'
  const [installedModels, setInstalledModels] = useState<string[]>([])

  useEffect(() => {
    fetch('http://localhost:11434/api/tags')
      .then((r) => r.json())
      .then((data) => {
        const names = (data.models || []).map((m: { name: string }) => m.name.replace(':latest', ''))
        setInstalledModels(names)
      })
      .catch(() => setInstalledModels([]))
  }, [])

  const modelInfo = LLM_MODELS.find(m => m.value === currentModel)
  const isInstalled = installedModels.length === 0 || installedModels.some(m => m.startsWith(currentModel))

  return (
    <Group title="Agente">
      <Row label="Nome do agente" description="Como o assistente se apresenta e responde.">
        <input
          value={settings['agent.name'] ?? 'Jarvis'}
          onChange={(e) => updateSetting('agent.name', e.target.value)}
          placeholder="Jarvis"
          style={{
            width: 160,
            height: 32,
            padding: '0 12px',
            borderRadius: 'var(--r-xs)',
            background: 'var(--fill-1)',
            border: '1px solid var(--hair)',
            color: 'var(--t-hi)',
            fontSize: 14,
            fontFamily: 'var(--f)',
            fontWeight: 500,
            outline: 'none',
          }}
        />
      </Row>
      <Row label="Modelo de LLM" description={
        modelInfo?.desc
          ? `${modelInfo.desc}${!isInstalled ? ' — rode: ollama pull ' + currentModel : ''}`
          : 'Modelo local via Ollama.'
      }>
        <ModelSelect
          models={LLM_MODELS}
          value={currentModel}
          installed={installedModels}
          onChange={(v) => {
            updateSetting('llm.ollama.model', v)
            fetch('http://localhost:11434/api/generate', {
              method: 'POST',
              body: JSON.stringify({ model: v, prompt: '', keep_alive: '10m' }),
            }).catch(() => {})
          }}
        />
      </Row>
      <Row label="Preferir local" description="Quando ativo, usa Ollama. Desativado, usa OpenAI.">
        <Toggle
          value={settings['llm.preferLocal'] !== 'false'}
          onChange={(v) => updateSetting('llm.preferLocal', String(v))}
        />
      </Row>
      <Row label="OpenAI API Key" description="Necessária quando 'Preferir local' está desativado.">
        <input
          type="password"
          value={settings['openai.apiKey'] ?? ''}
          placeholder="sk-..."
          onChange={(e) => updateSetting('openai.apiKey', e.target.value)}
          style={{
            width: 206,
            height: 32,
            padding: '0 12px',
            borderRadius: 'var(--r-xs)',
            background: 'var(--fill-1)',
            border: '1px solid var(--hair)',
            color: 'var(--t-hi)',
            fontSize: 13,
            fontFamily: 'var(--f-mono)',
            outline: 'none',
          }}
        />
      </Row>
      <Row label="Busca na web (nuvem)" description="Busca na internet via OpenAI quando usando modelo cloud.">
        <Toggle
          value={settings['openai.webSearch'] !== 'false'}
          onChange={(v) => updateSetting('openai.webSearch', String(v))}
        />
      </Row>
      <Row label="Tom" description="Como o agente soa — amigável, formal ou descontraído.">
        <Segmented
          options={[
            { value: 'friendly', label: 'Amigável' },
            { value: 'formal', label: 'Formal' },
            { value: 'casual', label: 'Descontraído' },
          ]}
          value={settings['personality.tone'] ?? 'friendly'}
          onChange={(v) => updateSetting('personality.tone', v)}
        />
      </Row>
      <Row label="Proatividade" description="O quanto o agente se antecipa com sugestões.">
        <Segmented
          options={[
            { value: 'low', label: 'Baixa' },
            { value: 'medium', label: 'Média' },
            { value: 'high', label: 'Alta' },
          ]}
          value={settings['personality.proactivity'] ?? 'medium'}
          onChange={(v) => updateSetting('personality.proactivity', v)}
        />
      </Row>
      <Row label="Nível de detalhe" description="O quanto as respostas são detalhadas.">
        <Segmented
          options={[
            { value: 'concise', label: 'Conciso' },
            { value: 'balanced', label: 'Equilibrado' },
            { value: 'detailed', label: 'Detalhado' },
          ]}
          value={settings['personality.verbosity'] ?? 'concise'}
          onChange={(v) => updateSetting('personality.verbosity', v)}
        />
      </Row>
      <SystemPromptEditor />
      <Row label="Palavra de ativação" description="Detecção sempre ativa, rodando localmente.">
        <Toggle
          value={settings['voice.wakeWord'] !== 'false'}
          onChange={(v) => updateSetting('voice.wakeWord', String(v))}
        />
      </Row>
      <Row label="Memória" description="Mantém o contexto entre conversas.">
        <Toggle
          value={settings['agent.memory'] !== 'false'}
          onChange={(v) => updateSetting('agent.memory', String(v))}
        />
      </Row>
      <AutostartRow />
      <Row label="Atalho global" description="Mostra ou esconde o Jarvis de qualquer lugar.">
        <Kbd keys={['Ctrl', 'Shift', 'J']} />
      </Row>
    </Group>
  )
}

function AutostartRow() {
  const [enabled, setEnabled] = useState(false)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!IN_TAURI) { setLoading(false); return }
    import('@tauri-apps/plugin-autostart').then(({ isEnabled }) => {
      isEnabled().then(setEnabled).finally(() => setLoading(false))
    }).catch(() => setLoading(false))
  }, [])

  const toggle = useCallback(async (v: boolean) => {
    if (!IN_TAURI) return
    setEnabled(v)
    try {
      const { enable, disable } = await import('@tauri-apps/plugin-autostart')
      if (v) await enable()
      else await disable()
    } catch (err) {
      console.warn('[Autostart]', err)
      setEnabled(!v)
    }
  }, [])

  if (!IN_TAURI) return null

  return (
    <Row label="Iniciar com o sistema" description="Abre o Jarvis quando você faz login.">
      {loading ? (
        <span style={{ fontSize: 12, color: 'var(--t-low)' }}>...</span>
      ) : (
        <Toggle value={enabled} onChange={toggle} />
      )}
    </Row>
  )
}

function OrbGroup() {
  const { updateSetting } = useSocket()
  const settings = useJarvisStore((s) => s.settings)

  return (
    <Group title="Orb">
      <Row label="Densidade de partículas" description="Diminua se as ventoinhas dispararem.">
        <Segmented
          options={[
            { value: 'low', label: 'Baixa' },
            { value: 'medium', label: 'Média' },
            { value: 'high', label: 'Alta' },
          ]}
          value={settings['orb.density'] ?? 'medium'}
          onChange={(v) => updateSetting('orb.density', v)}
        />
      </Row>
      <Row label="Brilho" description="Efeito de bloom ao redor do orb.">
        <Toggle
          value={settings['orb.glow'] !== 'false'}
          onChange={(v) => updateSetting('orb.glow', String(v))}
        />
      </Row>
      <Row label="Modo ambiente" description="Orb em tela cheia com relógio. Ótimo para um segundo monitor.">
        <button
          onClick={() => useJarvisStore.getState().setAmbient(true)}
          style={{
            height: 32, padding: '0 14px', borderRadius: 'var(--r-pill)',
            fontSize: 13, color: 'var(--t-hi)', background: 'var(--fill-2)',
            border: '1px solid var(--g-edge)', cursor: 'pointer',
            fontFamily: 'var(--f)', transition: '.2s',
          }}
        >
          Entrar
        </button>
      </Row>
    </Group>
  )
}

function ToolsGroup() {
  const [tools, setTools] = useState(TOOLS)
  const toggle = (name: string) => {
    setTools(tools.map((t) => t.name === name ? { ...t, on: !t.on } : t))
  }

  return (
    <Group title="Ferramentas">
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, padding: '4px 20px 18px' }}>
        {tools.map((t) => (
          <button
            key={t.name}
            onClick={() => toggle(t.name)}
            title={t.desc}
            style={{
              height: 32, padding: '0 14px', borderRadius: 'var(--r-pill)',
              display: 'flex', alignItems: 'center', gap: 8, fontSize: 13,
              color: t.on ? 'var(--t-mid)' : 'var(--t-ghost)',
              background: 'var(--fill-1)', border: '1px solid var(--hair)',
              cursor: 'pointer', fontFamily: 'var(--f)', transition: '.2s',
              opacity: t.on ? 1 : 0.6,
            }}
          >
            <span style={{
              width: 6, height: 6, borderRadius: '50%',
              background: t.on ? 'var(--st-executing)' : 'var(--fill-3)',
            }} />
            {t.name}
          </button>
        ))}
      </div>
    </Group>
  )
}

// ═══════════════════════════════════════════════════════════════
// Tab: Voice
// ═══════════════════════════════════════════════════════════════

function VoiceTab() {
  const { updateSetting } = useSocket()
  const settings = useJarvisStore((s) => s.settings)
  const ttsEngine = settings['tts.engine'] || 'edge'

  return (
    <>
      <Group title="Motor de voz (TTS)">
        <Row label="Motor" description="Qual motor sintetiza a fala do agente.">
          <Segmented
            options={[
              { value: 'edge', label: 'Edge' },
              { value: 'kokoro', label: 'Kokoro' },
              { value: 'qwen', label: 'Qwen' },
              { value: 'piper', label: 'Piper' },
            ]}
            value={ttsEngine}
            onChange={(v) => {
              updateSetting('tts.engine', v)
              updateSetting('tts.voice', '')
            }}
          />
        </Row>
        <Row label="Voz" description={
          ttsEngine === 'edge' ? 'Voz neural da Microsoft.' :
          ttsEngine === 'kokoro' ? 'Voz neural local.' :
          ttsEngine === 'qwen' ? 'Voz premium (mais lenta).' :
          'Voz local leve.'
        }>
          <Segmented
            options={
              ttsEngine === 'edge' ? [
                { value: 'pt-BR-AntonioNeural', label: 'Antonio' },
                { value: 'pt-BR-FranciscaNeural', label: 'Francisca' },
                { value: 'pt-BR-ThalitaNeural', label: 'Thalita' },
              ] :
              ttsEngine === 'kokoro' ? [
                { value: 'pf_dora', label: 'Dora' },
                { value: 'pm_alex', label: 'Alex' },
                { value: 'pm_santa', label: 'Santa' },
              ] :
              ttsEngine === 'qwen' ? [
                { value: 'ryan', label: 'Ryan' },
                { value: 'serena', label: 'Serena' },
                { value: 'eric', label: 'Eric' },
              ] :
              [{ value: 'pt_BR-faber-medium', label: 'Faber' }]
            }
            value={settings['tts.voice'] || (
              ttsEngine === 'edge' ? 'pt-BR-AntonioNeural' :
              ttsEngine === 'kokoro' ? 'pf_dora' :
              ttsEngine === 'qwen' ? 'ryan' :
              'pt_BR-faber-medium'
            )}
            onChange={(v) => updateSetting('tts.voice', v)}
          />
        </Row>
      </Group>
      <Group title="Fala">
        <Row label="Velocidade" description="Velocidade base. O modo dinâmico ajusta conforme o conteúdo.">
          <Segmented
            options={[
              { value: 'slow', label: 'Lenta' },
              { value: 'normal', label: 'Normal' },
              { value: 'fast', label: 'Rápida' },
            ]}
            value={settings['tts.speed'] ?? 'normal'}
            onChange={(v) => updateSetting('tts.speed', v)}
          />
        </Row>
        <Row label="Velocidade dinâmica" description="Listas mais rápidas, explicações mais lentas, perguntas mais claras.">
          <Toggle
            value={settings['tts.dynamicSpeed'] !== 'false'}
            onChange={(v) => updateSetting('tts.dynamicSpeed', String(v))}
          />
        </Row>
        <Row label="Interromper falando" description="Corte o agente falando por cima dele.">
          <Toggle
            value={settings['voice.bargeIn'] !== 'false'}
            onChange={(v) => updateSetting('voice.bargeIn', String(v))}
          />
        </Row>
      </Group>
    </>
  )
}

// ═══════════════════════════════════════════════════════════════
// Tab: Integrations (cards + modal)
// ═══════════════════════════════════════════════════════════════

interface Integration {
  id: string
  name: string
  description: string
  fields: { key: string; label: string; placeholder: string; password?: boolean; toggle?: boolean }[]
  /** Integracao que exige OAuth — mostra o bloco de conexao no modal. */
  auth?: { statusUrl: string; loginUrl: string }
}

const INTEGRATIONS: Integration[] = [
  {
    id: 'tavily',
    name: 'Tavily',
    description: 'Busca na web para o agente. Tem plano gratuito.',
    fields: [
      { key: 'search.tavilyApiKey', label: 'Chave de API', placeholder: 'tvly-...', password: true },
    ],
  },
  {
    id: 'telegram',
    name: 'Telegram',
    description: 'Envie mensagens e notificações.',
    fields: [
      { key: 'notifications.telegramBotToken', label: 'Token do bot', placeholder: '123456:ABC...', password: true },
      { key: 'notifications.telegramChatId', label: 'ID do chat', placeholder: '-100...' },
    ],
  },
  {
    id: 'lemonfin',
    name: 'LemonFin',
    description: 'Finanças pessoais — despesas, receitas e categorias.',
    fields: [
      { key: 'finance.email', label: 'E-mail', placeholder: 'email@exemplo.com' },
      { key: 'finance.password', label: 'Senha', placeholder: '••••••••', password: true },
      { key: 'finance.apiUrl', label: 'URL da API', placeholder: 'https://lemonfin-api.onrender.com' },
    ],
  },
  {
    id: 'tuya',
    name: 'Casa Inteligente',
    description: 'Controle luzes e dispositivos via Tuya (Positivo, Smart Life).',
    fields: [
      { key: 'home.tuyaAccessId', label: 'ID de acesso', placeholder: 'ID de acesso' },
      { key: 'home.tuyaAccessSecret', label: 'Chave secreta', placeholder: 'Chave secreta', password: true },
      { key: 'home.tuyaUid', label: 'ID do usuário', placeholder: 'UID da Tuya' },
      { key: 'home.tuyaRegion', label: 'Região', placeholder: 'us / eu / cn' },
    ],
  },
  {
    id: 'spotify',
    name: 'Spotify',
    description: 'Pesquise e controle a reprodução de música.',
    fields: [
      { key: 'spotify.clientId', label: 'ID do cliente', placeholder: 'ID do cliente' },
      { key: 'spotify.clientSecret', label: 'Chave secreta', placeholder: 'Chave secreta', password: true },
      { key: 'spotify.player.enabled', label: 'Player no orb', placeholder: '', toggle: true },
      { key: 'spotify.player.autoplayUri', label: 'Tocar ao abrir', placeholder: 'Cole o link da playlist (opcional)' },
      { key: 'spotify.player.duckOnSpeech', label: 'Abaixar volume na fala', placeholder: '', toggle: true },
    ],
    auth: {
      statusUrl: 'http://localhost:3000/api/spotify/status',
      loginUrl: 'http://localhost:3000/api/spotify/login',
    },
  },
]

function IntegrationsTab() {
  const [openModal, setOpenModal] = useState<string | null>(null)
  const settings = useJarvisStore((s) => s.settings)

  const isConfigured = (integration: Integration) =>
    integration.fields.some((f) => !!settings[f.key])

  const active = INTEGRATIONS.find((i) => i.id === openModal)

  return (
    <>
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fill, minmax(190px, 1fr))',
        gap: 12,
      }}>
        {INTEGRATIONS.map((integration) => {
          const configured = isConfigured(integration)
          return (
            <button
              key={integration.id}
              onClick={() => setOpenModal(integration.id)}
              className="glass"
              style={{
                padding: '20px 18px',
                borderRadius: 'var(--r-md)',
                textAlign: 'left',
                cursor: 'pointer',
                border: 'none',
                fontFamily: 'var(--f)',
                transition: 'transform .22s var(--sp), box-shadow .22s',
                position: 'relative',
              }}
              onMouseEnter={(e) => { e.currentTarget.style.transform = 'translateY(-2px)' }}
              onMouseLeave={(e) => { e.currentTarget.style.transform = 'none' }}
            >
              <div style={{ marginBottom: 10, color: 'var(--t-mid)' }}>
                <IntegrationIcon id={integration.id} size={24} />
              </div>
              <div style={{ fontSize: 14.5, fontWeight: 500, color: 'var(--t-hi)', marginBottom: 4 }}>
                {integration.name}
              </div>
              <div style={{ fontSize: 12, color: 'var(--t-low)', lineHeight: 1.4 }}>
                {integration.description}
              </div>
              <span style={{
                position: 'absolute',
                top: 14,
                right: 14,
                width: 8,
                height: 8,
                borderRadius: '50%',
                background: configured ? 'var(--st-executing)' : 'var(--fill-3)',
                transition: 'background .3s',
              }} />
            </button>
          )
        })}
      </div>

      {/* Modal */}
      {active && createPortal(
        <IntegrationModal
          integration={active}
          onClose={() => setOpenModal(null)}
        />,
        document.body,
      )}

      {/* MCP Servers */}
      <div style={{ marginTop: 24 }}>
        <McpServersSection />
      </div>
    </>
  )
}

function IntegrationModal({ integration, onClose }: {
  integration: Integration
  onClose: () => void
}) {
  const { updateSetting } = useSocket()
  const settings = useJarvisStore((s) => s.settings)

  // Esc fecha. Clique fora NAO fecha: um clique acidental descartaria
  // o que voce estava preenchendo.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 300,
        display: 'grid',
        placeItems: 'center',
        background: 'rgba(0,0,0,.5)',
        backdropFilter: 'blur(8px)',
      }}
    >
      <div
        className="glass"
        style={{
          width: 420,
          maxWidth: '90vw',
          borderRadius: 'var(--r-lg)',
          padding: '28px 28px 22px',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 14, marginBottom: 20 }}>
          <span style={{ color: 'var(--t-mid)', display: 'grid', placeItems: 'center' }}>
            <IntegrationIcon id={integration.id} size={28} />
          </span>
          <div>
            <div style={{ fontSize: 18, fontWeight: 500, color: 'var(--t-hi)' }}>
              {integration.name}
            </div>
            <div style={{ fontSize: 13, color: 'var(--t-low)' }}>
              {integration.description}
            </div>
          </div>
          <button
            onClick={onClose}
            aria-label="Fechar"
            title="Fechar (Esc)"
            style={{
              marginLeft: 'auto',
              width: 28,
              height: 28,
              flexShrink: 0,
              borderRadius: 'var(--r-xs)',
              border: 'none',
              background: 'var(--fill-1)',
              color: 'var(--t-low)',
              cursor: 'pointer',
              fontSize: 15,
              lineHeight: 1,
              fontFamily: 'var(--f)',
            }}
          >
            ✕
          </button>
        </div>

        {integration.auth && (
          <AuthConnect statusUrl={integration.auth.statusUrl} loginUrl={integration.auth.loginUrl} />
        )}

        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          {integration.fields.map((field) => (
            field.toggle ? (
              <ModalToggle
                key={field.key}
                label={field.label}
                checked={settings[field.key] === 'true'}
                onChange={(v) => updateSetting(field.key, String(v))}
              />
            ) : (
              <ModalField
                key={field.key}
                label={field.label}
                value={settings[field.key] ?? ''}
                placeholder={field.placeholder}
                password={field.password}
                onChange={(v) => updateSetting(field.key, v)}
              />
            )
          ))}
        </div>

        <button
          onClick={onClose}
          style={{
            marginTop: 24,
            width: '100%',
            height: 38,
            borderRadius: 'var(--r-pill)',
            fontSize: 13,
            fontWeight: 500,
            color: 'var(--t-hi)',
            background: 'var(--fill-2)',
            border: '1px solid var(--g-edge)',
            cursor: 'pointer',
            fontFamily: 'var(--f)',
            transition: '.2s',
          }}
        >
          Concluído
        </button>
      </div>
    </div>
  )
}

/**
 * Bloco de conexao OAuth: mostra o estado e o botao de autorizar.
 * O consentimento tem que abrir no navegador — o Spotify recusa
 * a tela de login dentro de WebView embutido.
 */
function AuthConnect({ statusUrl, loginUrl }: { statusUrl: string; loginUrl: string }) {
  const [connected, setConnected] = useState<boolean | null>(null)
  const [aguardando, setAguardando] = useState(false)
  const [falha, setFalha] = useState('')

  const check = useCallback(async () => {
    try {
      const r = await fetch(statusUrl, { signal: AbortSignal.timeout(4000) })
      const d = await r.json()
      setConnected(!!d.connected)
      return !!d.connected
    } catch {
      setConnected(false)
      return false
    }
  }, [statusUrl])

  useEffect(() => { check() }, [check])

  const openLogin = async () => {
    setFalha('')
    setAguardando(true)

    // No Tauri, window.open nao abre o navegador do sistema
    let abriu = false
    if (typeof window !== 'undefined' && '__TAURI_INTERNALS__' in window) {
      try {
        const { openUrl } = await import('@tauri-apps/plugin-opener')
        await openUrl(loginUrl)
        abriu = true
      } catch (e) {
        // sem o log, essa falha some — foi o que aconteceu na primeira versão
        logUI('opener falhou: ' + String(e))
        try {
          const { invoke } = await import('@tauri-apps/api/core')
          await invoke('plugin:opener|open_url', { url: loginUrl })
          abriu = true
        } catch (e2) {
          logUI('invoke direto falhou: ' + String(e2))
          abriu = !!window.open(loginUrl, '_blank')
        }
      }
    } else {
      abriu = !!window.open(loginUrl, '_blank')
    }

    if (!abriu) {
      setAguardando(false)
      setFalha('Não consegui abrir o navegador. Acesse: ' + loginUrl)
      return
    }

    // A autorizacao acontece noutra janela: verificar ate conectar (60s).
    let tentativas = 0
    const id = setInterval(async () => {
      tentativas++
      const ok = await check()
      if (ok || tentativas >= 20) {
        clearInterval(id)
        setAguardando(false)
        if (!ok) setFalha('Não recebi a autorização. Tente de novo.')
      }
    }, 3000)
  }

  return (
    <div style={{
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between',
      gap: 12,
      padding: '12px 14px',
      marginBottom: 18,
      borderRadius: 'var(--r-sm)',
      background: 'var(--fill-1)',
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 9, minWidth: 0 }}>
        <span style={{
          width: 7,
          height: 7,
          flexShrink: 0,
          borderRadius: '50%',
          background: falha
            ? 'var(--st-error)'
            : connected ? 'var(--st-executing)' : 'var(--fill-3)',
          animation: aguardando ? 'pulse 1.2s infinite' : 'none',
        }} />
        <span style={{
          fontSize: 13,
          color: falha ? 'var(--st-error)' : connected ? 'var(--t-hi)' : 'var(--t-low)',
        }}>
          {falha
            ? falha
            : aguardando
              ? 'Aguardando autorização no navegador…'
              : connected === null
                ? 'Verificando…'
                : connected ? 'Conta conectada' : 'Conta não conectada'}
        </span>
      </div>
      <button
        onClick={openLogin}
        disabled={aguardando}
        style={{
          height: 30,
          flexShrink: 0,
          padding: '0 14px',
          borderRadius: 'var(--r-pill)',
          fontSize: 12.5,
          fontWeight: 500,
          color: 'var(--t-hi)',
          background: 'var(--fill-2)',
          border: '1px solid var(--g-edge)',
          cursor: aguardando ? 'default' : 'pointer',
          opacity: aguardando ? 0.5 : 1,
          fontFamily: 'var(--f)',
        }}
      >
        {aguardando ? 'Aguardando…' : connected ? 'Reconectar' : 'Conectar'}
      </button>
    </div>
  )
}

/** Campo booleano — switch em vez de digitar "true"/"false". */
function ModalToggle({ label, checked, onChange }: {
  label: string
  checked: boolean
  onChange: (v: boolean) => void
}) {
  return (
    <label style={{
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between',
      gap: 12,
      cursor: 'pointer',
    }}>
      <span style={{ fontSize: 13, color: 'var(--t-mid)' }}>{label}</span>
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        onClick={() => onChange(!checked)}
        style={{
          width: 40,
          height: 23,
          flexShrink: 0,
          borderRadius: 'var(--r-pill)',
          border: '1px solid var(--g-edge)',
          background: checked ? 'var(--accent)' : 'var(--fill-2)',
          cursor: 'pointer',
          padding: 0,
          position: 'relative',
          transition: 'background .22s var(--sp)',
        }}
      >
        <span style={{
          position: 'absolute',
          top: 2,
          left: checked ? 19 : 2,
          width: 17,
          height: 17,
          borderRadius: '50%',
          background: 'var(--t-hi)',
          transition: 'left .22s var(--sp)',
        }} />
      </button>
    </label>
  )
}

function ModalField({ label, value, placeholder, password, onChange }: {
  label: string
  value: string
  placeholder: string
  password?: boolean
  onChange: (v: string) => void
}) {
  const [local, setLocal] = useState(value)
  const [saved, setSaved] = useState(false)

  useEffect(() => { setLocal(value) }, [value])

  const save = () => {
    if (local !== value) {
      onChange(local)
      setSaved(true)
      setTimeout(() => setSaved(false), 2000)
    }
  }

  return (
    <div>
      <div style={{
        fontSize: 12,
        fontWeight: 500,
        color: 'var(--t-low)',
        marginBottom: 6,
        textTransform: 'uppercase',
        letterSpacing: '.04em',
      }}>
        {label}
        {saved && <span style={{ color: 'var(--st-executing)', marginLeft: 8, textTransform: 'none' }}>Salvo</span>}
      </div>
      <input
        type={password ? 'password' : 'text'}
        value={local}
        onChange={(e) => setLocal(e.target.value)}
        onBlur={save}
        onKeyDown={(e) => e.key === 'Enter' && save()}
        placeholder={placeholder}
        style={{
          width: '100%',
          height: 38,
          padding: '0 14px',
          borderRadius: 'var(--r-sm)',
          fontSize: 13,
          fontFamily: 'var(--f-mono)',
          color: 'var(--t-hi)',
          background: 'var(--fill-1)',
          border: '1px solid var(--hair)',
          outline: 'none',
          boxSizing: 'border-box',
        }}
      />
    </div>
  )
}

// ═══════════════════════════════════════════════════════════════
// ─── MCP Servers ────────────────────────────────────────────

function McpServersSection() {
  const { mcpList, mcpAdd, mcpRemove, mcpReconnect } = useSocket()
  const [servers, setServers] = useState<any[]>([])
  const [adding, setAdding] = useState(false)
  const [form, setForm] = useState({ name: '', transport: 'streamable-http', command: '', args: '', url: '', apiKey: '' })

  const refresh = useCallback(() => {
    mcpList().then(setServers)
  }, [mcpList])

  useEffect(() => { refresh() }, [refresh])

  const handleAdd = async () => {
    if (!form.name) return
    await mcpAdd({
      name: form.name,
      transport: form.transport,
      command: form.transport === 'stdio' ? form.command : undefined,
      args: form.transport === 'stdio' ? form.args : undefined,
      url: form.transport !== 'stdio' ? form.url : undefined,
      apiKey: form.apiKey || undefined,
    })
    setForm({ name: '', transport: 'streamable-http', command: '', args: '', url: '', apiKey: '' })
    setAdding(false)
    refresh()
  }

  const handleRemove = async (id: string) => {
    await mcpRemove(id)
    refresh()
  }

  const handleReconnect = async (id: string) => {
    await mcpReconnect(id)
    refresh()
  }

  return (
    <Group title="Servidores MCP">
      {servers.length === 0 && !adding && (
        <div style={{ padding: '16px 20px', fontSize: 13, color: 'var(--t-low)' }}>
          Nenhum servidor MCP configurado. Adicione um para ampliar o que o agente consegue fazer.
        </div>
      )}

      {servers.map((s) => (
        <div key={s.id} style={{
          display: 'flex', alignItems: 'center', gap: 12,
          padding: '12px 20px', borderTop: '1px solid var(--hair)',
        }}>
          <span style={{
            width: 8, height: 8, borderRadius: '50%',
            background: s.connected ? 'var(--st-executing)' : 'var(--st-error)',
            boxShadow: `0 0 8px ${s.connected ? 'var(--st-executing)' : 'var(--st-error)'}`,
          }} />
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 14, fontWeight: 450, color: 'var(--t-hi)' }}>{s.name}</div>
            <div style={{ fontSize: 11.5, color: 'var(--t-low)', fontFamily: 'var(--f-mono)' }}>
              {s.transport} · {s.tools?.length ?? 0} ferramentas
              {s.command && ` · ${s.command}`}
              {s.url && ` · ${s.url}`}
            </div>
          </div>
          <button
            onClick={() => handleReconnect(s.id)}
            style={{
              height: 28, padding: '0 10px', borderRadius: 'var(--r-pill)',
              fontSize: 11, color: 'var(--t-mid)', background: 'var(--fill-1)',
              border: '1px solid var(--hair)', cursor: 'pointer', fontFamily: 'var(--f)',
            }}
          >
            Reconectar
          </button>
          <button
            onClick={() => handleRemove(s.id)}
            style={{
              height: 28, padding: '0 10px', borderRadius: 'var(--r-pill)',
              fontSize: 11, color: 'var(--st-error)', background: 'rgba(255,107,107,.08)',
              border: '1px solid rgba(255,107,107,.2)', cursor: 'pointer', fontFamily: 'var(--f)',
            }}
          >
            Remover
          </button>
        </div>
      ))}

      {adding ? (
        <div style={{ padding: '16px 20px', borderTop: '1px solid var(--hair)', display: 'flex', flexDirection: 'column', gap: 12 }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
            <input
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              placeholder="Nome do servidor"
              style={mcpInputStyle}
            />
            <select
              value={form.transport}
              onChange={(e) => setForm({ ...form, transport: e.target.value })}
              style={mcpInputStyle}
            >
              <option value="stdio">stdio</option>
              <option value="sse">SSE</option>
              <option value="streamable-http">HTTP</option>
            </select>
          </div>
          {form.transport === 'stdio' ? (
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
              <input
                value={form.command}
                onChange={(e) => setForm({ ...form, command: e.target.value })}
                placeholder="Comando (ex: npx, node)"
                style={mcpInputStyle}
              />
              <input
                value={form.args}
                onChange={(e) => setForm({ ...form, args: e.target.value })}
                placeholder='Args JSON (e.g. ["-y","@mcp/server"])'
                style={mcpInputStyle}
              />
            </div>
          ) : (
            <input
              value={form.url}
              onChange={(e) => setForm({ ...form, url: e.target.value })}
              placeholder="URL do servidor (ex: http://localhost:3002/mcp)"
              style={mcpInputStyle}
            />
          )}
          <input
            type="password"
            value={form.apiKey}
            onChange={(e) => setForm({ ...form, apiKey: e.target.value })}
            placeholder="Chave de API (opcional)"
            style={mcpInputStyle}
          />
          <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
            <button onClick={() => setAdding(false)} style={mcpBtnStyle}>Cancelar</button>
            <button onClick={handleAdd} style={{ ...mcpBtnStyle, color: 'var(--t-hi)', borderColor: 'var(--g-edge)' }}>
              Conectar
            </button>
          </div>
        </div>
      ) : (
        <div style={{ padding: '12px 20px', borderTop: '1px solid var(--hair)' }}>
          <button
            onClick={() => setAdding(true)}
            style={{
              height: 34, padding: '0 16px', borderRadius: 'var(--r-pill)',
              fontSize: 13, color: 'var(--accent)', background: 'rgba(var(--accent-rgb), .08)',
              border: '1px solid rgba(var(--accent-rgb), .2)', cursor: 'pointer', fontFamily: 'var(--f)',
            }}
          >
            + Adicionar servidor MCP
          </button>
        </div>
      )}
    </Group>
  )
}

const mcpInputStyle: React.CSSProperties = {
  height: 34, padding: '0 12px', borderRadius: 'var(--r-sm)',
  fontSize: 12.5, fontFamily: 'var(--f-mono)', color: 'var(--t-hi)',
  background: 'var(--fill-1)', border: '1px solid var(--hair)', outline: 'none',
  boxSizing: 'border-box', width: '100%',
}

const mcpBtnStyle: React.CSSProperties = {
  height: 32, padding: '0 14px', borderRadius: 'var(--r-pill)',
  fontSize: 12, color: 'var(--t-low)', background: 'var(--fill-1)',
  border: '1px solid var(--hair)', cursor: 'pointer', fontFamily: 'var(--f)',
}

// Tab: Shortcuts
// ═══════════════════════════════════════════════════════════════

function ShortcutsTab() {
  return (
    <Group title="Atalhos de teclado">
      <Row label="Mostrar / esconder (global)"><Kbd keys={['Ctrl', '⇧', 'J']} /></Row>
      <Row label="Paleta de comandos"><Kbd keys={['⌘', 'K']} /></Row>
      <Row label="Pressione para falar"><Kbd keys={['space']} /></Row>
      <Row label="Trocar de tela"><Kbd keys={['1', '2', '3']} /></Row>
      <Row label="Tema"><Kbd keys={['T']} /></Row>
      <Row label="Modo ambiente"><Kbd keys={['A']} /></Row>
    </Group>
  )
}

// ═══════════════════════════════════════════════════════════════
// Primitives
// ═══════════════════════════════════════════════════════════════

function Group({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="glass" style={{ borderRadius: 'var(--r-md)', marginBottom: 16 }}>
      <div style={{ padding: '16px 20px 6px', fontSize: 12.5, fontWeight: 500, color: 'var(--t-low)' }}>
        {title}
      </div>
      {children}
    </div>
  )
}

function Row({ label, description, children }: {
  label: string
  description?: string
  children?: React.ReactNode
}) {
  return (
    <div style={{
      display: 'grid', gridTemplateColumns: '1fr auto', gap: 22,
      alignItems: 'center', padding: '15px 20px', borderTop: '1px solid var(--hair)',
    }}>
      <div>
        <div style={{ fontSize: 14.5, color: 'var(--t-hi)', fontWeight: 450, letterSpacing: '-.008em' }}>
          {label}
        </div>
        {description && (
          <div style={{ fontSize: 13, color: 'var(--t-low)', marginTop: 2, lineHeight: 1.45 }}>
            {description}
          </div>
        )}
      </div>
      {children}
    </div>
  )
}

function Toggle({ value, onChange }: { value: boolean; onChange: (v: boolean) => void }) {
  return (
    <button
      onClick={() => onChange(!value)}
      style={{
        width: 44, height: 26, borderRadius: 'var(--r-pill)',
        background: value ? 'rgba(var(--accent-rgb), .30)' : 'var(--fill-2)',
        border: `1px solid ${value ? 'rgba(var(--accent-rgb), .5)' : 'var(--g-edge)'}`,
        position: 'relative', cursor: 'pointer', transition: '.3s', padding: 0,
      }}
    >
      <span style={{
        position: 'absolute', top: 2, left: 2, width: 20, height: 20,
        borderRadius: '50%',
        background: value ? '#fff' : 'var(--knob)',
        transform: value ? 'translateX(18px)' : 'none',
        transition: 'transform .38s var(--sp-morph), background .3s',
        boxShadow: value ? '0 0 12px rgba(var(--accent-rgb), .7)' : '0 1px 3px rgba(0,0,0,.25)',
      }} />
    </button>
  )
}

function Segmented({ options, value, onChange }: {
  options: { value: string; label: string }[]
  value: string
  onChange: (v: string) => void
}) {
  const activeIdx = Math.max(0, options.findIndex((o) => o.value === value))
  return (
    <div style={{
      display: 'flex', position: 'relative', padding: 3,
      borderRadius: 'var(--r-pill)', background: 'var(--fill-1)', border: '1px solid var(--hair)',
    }}>
      <span style={{
        position: 'absolute', top: 3, left: 0, height: 'calc(100% - 6px)',
        borderRadius: 'var(--r-pill)', background: 'var(--fill-3)',
        border: '1px solid var(--g-edge)',
        transition: 'transform .44s var(--sp-morph), width .44s var(--sp-morph)',
        width: `${100 / options.length}%`,
        transform: `translateX(${activeIdx * 100}%)`,
      }} />
      {options.map((opt) => (
        <button
          key={opt.value}
          onClick={() => onChange(opt.value)}
          style={{
            position: 'relative', zIndex: 1, height: 28, padding: '0 15px',
            borderRadius: 'var(--r-pill)', fontSize: 12.5,
            color: opt.value === value ? 'var(--t-hi)' : 'var(--t-low)',
            fontWeight: 450, transition: 'color .22s', whiteSpace: 'nowrap',
            background: 'none', border: 'none', cursor: 'pointer', fontFamily: 'var(--f)',
          }}
        >
          {opt.label}
        </button>
      ))}
    </div>
  )
}

function Slider({ value, min, max, suffix, onChange }: {
  value: number; min: number; max: number; suffix?: string; onChange: (v: number) => void
}) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 14, width: 206 }}>
      <input
        type="range" min={min} max={max} value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        style={{ flex: 1, height: 4, borderRadius: 4, background: 'var(--fill-3)', appearance: 'none', WebkitAppearance: 'none' }}
      />
      <span style={{ fontFamily: 'var(--f-mono)', fontSize: 12.5, color: 'var(--t-mid)', width: 44, textAlign: 'right' }}>
        {value}{suffix ?? ''}
      </span>
    </div>
  )
}

function ModelSelect({ models, value, installed, onChange }: {
  models: { value: string; label: string; desc: string }[]
  value: string; installed: string[]; onChange: (v: string) => void
}) {
  const [open, setOpen] = useState(false)
  const btnRef = useRef<HTMLButtonElement>(null)
  const menuRef = useRef<HTMLDivElement>(null)
  const [pos, setPos] = useState({ top: 0, right: 0 })

  useEffect(() => {
    if (!open) return
    const handler = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node) &&
          btnRef.current && !btnRef.current.contains(e.target as Node)) {
        setOpen(false)
      }
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [open])

  const handleOpen = () => {
    if (btnRef.current) {
      const r = btnRef.current.getBoundingClientRect()
      setPos({ top: r.bottom + 6, right: window.innerWidth - r.right })
    }
    setOpen(!open)
  }

  const current = models.find((m) => m.value === value)
  const isAvailable = (v: string) => installed.length === 0 || installed.some(i => i.startsWith(v))

  return (
    <>
      <button
        ref={btnRef} onClick={handleOpen}
        style={{
          height: 32, padding: '0 14px', borderRadius: 'var(--r-pill)', fontSize: 13,
          color: isAvailable(value) ? 'var(--t-hi)' : 'var(--st-error)',
          background: 'var(--fill-1)',
          border: `1px solid ${isAvailable(value) ? 'var(--g-edge)' : 'rgba(255,107,107,.3)'}`,
          cursor: 'pointer', fontFamily: 'var(--f)', display: 'flex', alignItems: 'center', gap: 8, transition: '.2s',
        }}
      >
        {current?.label || value}
        <svg width={10} height={10} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round">
          <path d={open ? 'M18 15l-6-6-6 6' : 'M6 9l6 6 6-6'} />
        </svg>
      </button>
      {open && createPortal(
        <div ref={menuRef} style={{
          position: 'fixed', top: pos.top, right: pos.right, width: 280,
          borderRadius: 'var(--r-sm)', background: 'var(--bg)', border: '1px solid var(--g-edge)',
          boxShadow: '0 18px 50px -10px rgba(0,0,0,.6)', maxHeight: 360, overflowY: 'auto', zIndex: 200,
        }}>
          {models.map((m) => {
            const avail = isAvailable(m.value)
            const active = m.value === value
            return (
              <button
                key={m.value}
                onClick={() => { onChange(m.value); setOpen(false) }}
                style={{
                  width: '100%', textAlign: 'left', padding: '10px 14px',
                  background: active ? 'var(--fill-2)' : 'none', border: 'none',
                  borderBottom: '1px solid var(--hair)', cursor: 'pointer',
                  fontFamily: 'var(--f)', transition: 'background .15s',
                }}
                onMouseEnter={(e) => { if (!active) e.currentTarget.style.background = 'var(--fill-1)' }}
                onMouseLeave={(e) => { if (!active) e.currentTarget.style.background = 'none' }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <span style={{ fontSize: 13, fontWeight: active ? 500 : 400, color: avail ? 'var(--t-hi)' : 'var(--t-low)' }}>
                    {m.label}
                  </span>
                  {!avail && (
                    <span style={{
                      fontSize: 10, color: 'var(--st-error)', padding: '1px 6px',
                      borderRadius: 'var(--r-pill)', background: 'rgba(255,107,107,.12)', fontWeight: 500,
                    }}>
                      não instalado
                    </span>
                  )}
                  {active && (
                    <svg width={12} height={12} viewBox="0 0 24 24" fill="none" stroke="var(--accent)" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round" style={{ marginLeft: 'auto' }}>
                      <path d="M20 6L9 17l-5-5" />
                    </svg>
                  )}
                </div>
                <div style={{ fontSize: 11.5, color: 'var(--t-low)', marginTop: 2, lineHeight: 1.35 }}>
                  {m.desc}
                </div>
              </button>
            )
          })}
        </div>,
        document.body,
      )}
    </>
  )
}

function Kbd({ keys }: { keys: string[] }) {
  return (
    <div style={{ display: 'flex', gap: 6 }}>
      {keys.map((k) => (
        <span key={k} style={{
          fontFamily: 'var(--f-mono)', fontSize: 11.5, color: 'var(--t-mid)',
          padding: '4px 9px', borderRadius: 7, background: 'var(--fill-1)', border: '1px solid var(--hair)',
        }}>
          {k}
        </span>
      ))}
    </div>
  )
}

function SystemPromptEditor() {
  const { updateSetting } = useSocket()
  const settings = useJarvisStore((s) => s.settings)
  const [open, setOpen] = useState(false)
  const value = settings['agent.systemPrompt'] ?? ''

  return (
    <>
      <Row label="Prompt do sistema" description="Instruções adicionais pro agente.">
        <button
          onClick={() => setOpen(true)}
          style={{
            padding: '6px 16px',
            borderRadius: 'var(--r-xs)',
            background: 'var(--fill-1)',
            border: '1px solid var(--hair)',
            color: value ? 'var(--t-hi)' : 'var(--t-low)',
            fontSize: 13,
            fontFamily: 'var(--f-mono)',
            cursor: 'pointer',
          }}
        >
          {value ? `${value.slice(0, 30)}${value.length > 30 ? '...' : ''}` : 'Editar'}
        </button>
      </Row>

      {/* Modal fullscreen */}
      {open && (
        <div
          onClick={() => setOpen(false)}
          style={{
            position: 'fixed',
            inset: 0,
            zIndex: 200,
            background: 'rgba(0,0,0,.7)',
            backdropFilter: 'blur(8px)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: 40,
          }}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="glass"
            style={{
              width: '100%',
              maxWidth: 700,
              maxHeight: '80vh',
              borderRadius: 'var(--r-lg)',
              padding: 0,
              overflow: 'hidden',
              display: 'flex',
              flexDirection: 'column',
            }}
          >
            {/* Header */}
            <div style={{
              padding: '16px 24px',
              borderBottom: '1px solid var(--hair)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
            }}>
              <div>
                <h3 style={{ margin: 0, fontSize: 16, fontWeight: 600, color: 'var(--t-hi)' }}>
                  Prompt do sistema
                </h3>
                <p style={{ margin: '4px 0 0', fontSize: 12, color: 'var(--t-low)' }}>
                  Instruções adicionais pro agente. Adicionado ao final do prompt padrão.
                </p>
              </div>
              <button
                onClick={() => setOpen(false)}
                style={{
                  width: 32, height: 32, borderRadius: '50%',
                  background: 'var(--fill-1)', border: 'none',
                  color: 'var(--t-mid)', fontSize: 16, cursor: 'pointer',
                  display: 'grid', placeItems: 'center',
                }}
              >
                ✕
              </button>
            </div>

            {/* Textarea */}
            <textarea
              value={value}
              onChange={(e) => updateSetting('agent.systemPrompt', e.target.value)}
              placeholder={`Exemplo:\nMeu nome é Lucas.\nSempre me chame pelo nome.\nQuando eu pedir pra abrir um app, tente protocolo URI primeiro.\nPrefiro respostas curtas e diretas.`}
              style={{
                flex: 1,
                minHeight: 300,
                padding: '20px 24px',
                background: 'transparent',
                border: 'none',
                color: 'var(--t-hi)',
                fontSize: 14,
                fontFamily: 'var(--f-mono)',
                lineHeight: 1.6,
                resize: 'none',
                outline: 'none',
              }}
            />

            {/* Footer */}
            <div style={{
              padding: '12px 24px',
              borderTop: '1px solid var(--hair)',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
            }}>
              <span style={{ fontSize: 12, color: 'var(--t-ghost)', fontFamily: 'var(--f-mono)' }}>
                {value.length} caracteres · salva automaticamente
              </span>
              <button
                onClick={() => setOpen(false)}
                style={{
                  padding: '8px 20px',
                  borderRadius: 'var(--r-pill)',
                  background: 'var(--accent)',
                  border: 'none',
                  color: '#000',
                  fontSize: 13,
                  fontWeight: 600,
                  cursor: 'pointer',
                }}
              >
                Fechar
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
