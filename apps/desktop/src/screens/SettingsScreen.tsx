import { useEffect, useState, useCallback, useRef } from 'react'
import { createPortal } from 'react-dom'
import { useJarvisStore } from '../stores/jarvis.store'
import { useSocket } from '../hooks/useSocket'
import { useTheme, type ThemeMode } from '../theme/ThemeProvider'

/**
 * Tela de settings — tabs no topo, cards de vidro, modal de integrações.
 * Seção 11 do DESIGN_SYSTEM.md.
 */

type SettingsTab = 'general' | 'voice' | 'integrations' | 'shortcuts'

const TABS: { id: SettingsTab; label: string }[] = [
  { id: 'general', label: 'General' },
  { id: 'voice', label: 'Voice' },
  { id: 'integrations', label: 'Integrations' },
  { id: 'shortcuts', label: 'Shortcuts' },
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
  { name: 'Open app', on: true, desc: 'Abrir programas instalados' },
  { name: 'Run command', on: true, desc: 'Executar comandos no terminal' },
  { name: 'Manage files', on: true, desc: 'Criar, ler, mover e deletar arquivos' },
  { name: 'Search', on: true, desc: 'Pesquisa web via Tavily' },
  { name: 'Reminders', on: true, desc: 'Lembretes e notificações agendadas' },
  { name: 'Telegram', on: true, desc: 'Enviar mensagens via Telegram' },
  { name: 'Finance', on: true, desc: 'Consultar finanças (LemonFin)' },
  { name: 'Smart home', on: true, desc: 'Controlar luzes e dispositivos (Tuya)' },
  { name: 'Spotify', on: true, desc: 'Pesquisar e controlar música' },
]

const LLM_MODELS = [
  { value: 'llama3.1', label: 'Llama 3.1', desc: 'Meta. Melhor em seguir instruções e PT-BR. 8B params.' },
  { value: 'llama3.2', label: 'Llama 3.2', desc: 'Meta. Versão compacta, rápida. 3B params.' },
  { value: 'qwen2.5:14b', label: 'Qwen 2.5 14B', desc: 'Alibaba. Tool calling robusto, raciocínio forte. 14B params.' },
  { value: 'qwen2.5', label: 'Qwen 2.5 7B', desc: 'Alibaba. Compacto, bom em código. 7B params.' },
  { value: 'mistral', label: 'Mistral', desc: 'Mistral AI. Rápido e eficiente. 7B params.' },
  { value: 'gemma2', label: 'Gemma 2', desc: 'Google. Compacto e preciso. 9B params.' },
  { value: 'phi3', label: 'Phi-3', desc: 'Microsoft. Otimizado pra tarefas curtas. 3.8B params.' },
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
          Settings
        </h1>
        <p style={{ fontSize: 15, color: 'var(--t-low)', marginBottom: 24 }}>
          Everything applies the moment you change it.
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
    <Group title="Appearance">
      <Row label="Theme" description="Auto follows your system.">
        <Segmented
          options={[
            { value: 'light', label: 'Light' },
            { value: 'dark', label: 'Dark' },
            { value: 'auto', label: 'Auto' },
          ]}
          value={mode}
          onChange={(v) => setMode(v as ThemeMode)}
        />
      </Row>
      <Row label="Accent" description="Base colour when the agent is idle. States override it.">
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
      <Row label="Background" description="Sits behind the glass. Custom loads from your machine.">
        <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
          <Segmented
            options={[
              { value: 'none', label: 'None' },
              { value: 'mesh', label: 'Mesh' },
              { value: 'dusk', label: 'Dusk' },
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
            Custom…
          </button>
          <input ref={fileRef} type="file" accept="image/*" hidden onChange={handleFile} />
        </div>
      </Row>
      <Row label="Background blur" description="More blur keeps text legible over busy photos.">
        <Slider value={bgBlur} min={0} max={60} suffix="px" onChange={(v) => { updateSetting('ui.bgBlur', String(v)); document.documentElement.style.setProperty('--bg-blur', v + 'px') }} />
      </Row>
      <Row label="Background dim" description="How much of the base colour sits on top.">
        <Slider value={bgDim} min={0} max={95} suffix="%" onChange={(v) => { updateSetting('ui.bgDim', String(v)); document.documentElement.style.setProperty('--bg-dim', String(v / 100)) }} />
      </Row>
    </Group>
  )
}

function AgentGroup() {
  const { updateSetting } = useSocket()
  const settings = useJarvisStore((s) => s.settings)
  const currentModel = settings['llm.ollama.model'] || 'llama3.1'
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
    <Group title="Agent">
      <Row label="LLM model" description={
        modelInfo?.desc
          ? `${modelInfo.desc}${!isInstalled ? ' — rode: ollama pull ' + currentModel : ''}`
          : 'Local model via Ollama.'
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
      <Row label="Web Search (cloud)" description="Busca na internet via OpenAI quando usando modelo cloud.">
        <Toggle
          value={settings['openai.webSearch'] !== 'false'}
          onChange={(v) => updateSetting('openai.webSearch', String(v))}
        />
      </Row>
      <Row label="Tone" description="How the agent sounds — friendly, formal, or casual.">
        <Segmented
          options={[
            { value: 'friendly', label: 'Friendly' },
            { value: 'formal', label: 'Formal' },
            { value: 'casual', label: 'Casual' },
          ]}
          value={settings['personality.tone'] ?? 'friendly'}
          onChange={(v) => updateSetting('personality.tone', v)}
        />
      </Row>
      <Row label="Proactivity" description="How eagerly the agent offers suggestions.">
        <Segmented
          options={[
            { value: 'low', label: 'Low' },
            { value: 'medium', label: 'Medium' },
            { value: 'high', label: 'High' },
          ]}
          value={settings['personality.proactivity'] ?? 'medium'}
          onChange={(v) => updateSetting('personality.proactivity', v)}
        />
      </Row>
      <Row label="Verbosity" description="How detailed the answers are.">
        <Segmented
          options={[
            { value: 'concise', label: 'Concise' },
            { value: 'balanced', label: 'Balanced' },
            { value: 'detailed', label: 'Detailed' },
          ]}
          value={settings['personality.verbosity'] ?? 'concise'}
          onChange={(v) => updateSetting('personality.verbosity', v)}
        />
      </Row>
      <Row label="Wake word" description="Always-on hotword detection, running locally.">
        <Toggle
          value={settings['voice.wakeWord'] !== 'false'}
          onChange={(v) => updateSetting('voice.wakeWord', String(v))}
        />
      </Row>
      <Row label="Memory" description="Carry context between sessions.">
        <Toggle
          value={settings['agent.memory'] !== 'false'}
          onChange={(v) => updateSetting('agent.memory', String(v))}
        />
      </Row>
      <AutostartRow />
      <Row label="Global hotkey" description="Show/hide Jarvis from anywhere.">
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
    <Row label="Autostart" description="Launch Jarvis when you log in.">
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
      <Row label="Particle density" description="Drop it if the fans spin up.">
        <Segmented
          options={[
            { value: 'low', label: 'Low' },
            { value: 'medium', label: 'Medium' },
            { value: 'high', label: 'High' },
          ]}
          value={settings['orb.density'] ?? 'medium'}
          onChange={(v) => updateSetting('orb.density', v)}
        />
      </Row>
      <Row label="Glow" description="Additive bloom pass around the orb.">
        <Toggle
          value={settings['orb.glow'] !== 'false'}
          onChange={(v) => updateSetting('orb.glow', String(v))}
        />
      </Row>
      <Row label="Ambient mode" description="Full-screen orb with a clock. Good for a second monitor.">
        <button
          onClick={() => useJarvisStore.getState().setAmbient(true)}
          style={{
            height: 32, padding: '0 14px', borderRadius: 'var(--r-pill)',
            fontSize: 13, color: 'var(--t-hi)', background: 'var(--fill-2)',
            border: '1px solid var(--g-edge)', cursor: 'pointer',
            fontFamily: 'var(--f)', transition: '.2s',
          }}
        >
          Enter
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
    <Group title="Tools">
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
      <Group title="TTS Engine">
        <Row label="Engine" description="Which voice engine synthesizes the agent's speech.">
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
        <Row label="Voice" description={
          ttsEngine === 'edge' ? 'Microsoft neural voice.' :
          ttsEngine === 'kokoro' ? 'Local neural voice.' :
          ttsEngine === 'qwen' ? 'Premium voice (slow).' :
          'Local lightweight voice.'
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
      <Group title="Speech">
        <Row label="Speed" description="Base speed. Dynamic mode adjusts per content type.">
          <Segmented
            options={[
              { value: 'slow', label: 'Slow' },
              { value: 'normal', label: 'Normal' },
              { value: 'fast', label: 'Fast' },
            ]}
            value={settings['tts.speed'] ?? 'normal'}
            onChange={(v) => updateSetting('tts.speed', v)}
          />
        </Row>
        <Row label="Dynamic speed" description="Lists faster, explanations slower, questions clearer.">
          <Toggle
            value={settings['tts.dynamicSpeed'] !== 'false'}
            onChange={(v) => updateSetting('tts.dynamicSpeed', String(v))}
          />
        </Row>
        <Row label="Barge-in" description="Interrupt the agent by speaking over it.">
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
  icon: string
  description: string
  fields: { key: string; label: string; placeholder: string; password?: boolean }[]
}

const INTEGRATIONS: Integration[] = [
  {
    id: 'tavily',
    name: 'Tavily',
    icon: '🔍',
    description: 'Web search for the agent. Free tier available.',
    fields: [
      { key: 'search.tavilyApiKey', label: 'API Key', placeholder: 'tvly-...', password: true },
    ],
  },
  {
    id: 'telegram',
    name: 'Telegram',
    icon: '💬',
    description: 'Send messages and notifications.',
    fields: [
      { key: 'notifications.telegramBotToken', label: 'Bot Token', placeholder: '123456:ABC...', password: true },
      { key: 'notifications.telegramChatId', label: 'Chat ID', placeholder: '-100...' },
    ],
  },
  {
    id: 'lemonfin',
    name: 'LemonFin',
    icon: '💰',
    description: 'Personal finance — expenses, income, categories.',
    fields: [
      { key: 'finance.email', label: 'Email', placeholder: 'email@example.com' },
      { key: 'finance.password', label: 'Password', placeholder: '••••••••', password: true },
      { key: 'finance.apiUrl', label: 'API URL', placeholder: 'https://lemonfin-api.onrender.com' },
    ],
  },
  {
    id: 'tuya',
    name: 'Smart Home',
    icon: '💡',
    description: 'Control lights and devices via Tuya (Positivo, Smart Life).',
    fields: [
      { key: 'home.tuyaAccessId', label: 'Access ID', placeholder: 'Access ID' },
      { key: 'home.tuyaAccessSecret', label: 'Access Secret', placeholder: 'Secret', password: true },
      { key: 'home.tuyaUid', label: 'User ID', placeholder: 'UID from Tuya' },
      { key: 'home.tuyaRegion', label: 'Region', placeholder: 'us / eu / cn' },
    ],
  },
  {
    id: 'spotify',
    name: 'Spotify',
    icon: '🎵',
    description: 'Search and control music playback.',
    fields: [
      { key: 'spotify.clientId', label: 'Client ID', placeholder: 'Client ID' },
      { key: 'spotify.clientSecret', label: 'Client Secret', placeholder: 'Secret', password: true },
    ],
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
              <div style={{ fontSize: 28, marginBottom: 10 }}>{integration.icon}</div>
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
  const backdropRef = useRef<HTMLDivElement>(null)

  return (
    <div
      ref={backdropRef}
      onClick={(e) => { if (e.target === backdropRef.current) onClose() }}
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
          <span style={{ fontSize: 32 }}>{integration.icon}</span>
          <div>
            <div style={{ fontSize: 18, fontWeight: 500, color: 'var(--t-hi)' }}>
              {integration.name}
            </div>
            <div style={{ fontSize: 13, color: 'var(--t-low)' }}>
              {integration.description}
            </div>
          </div>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          {integration.fields.map((field) => (
            <ModalField
              key={field.key}
              label={field.label}
              value={settings[field.key] ?? ''}
              placeholder={field.placeholder}
              password={field.password}
              onChange={(v) => updateSetting(field.key, v)}
            />
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
          Done
        </button>
      </div>
    </div>
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
        {saved && <span style={{ color: 'var(--st-executing)', marginLeft: 8, textTransform: 'none' }}>Saved</span>}
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
    <Group title="MCP Servers">
      {servers.length === 0 && !adding && (
        <div style={{ padding: '16px 20px', fontSize: 13, color: 'var(--t-low)' }}>
          No MCP servers configured. Add one to extend the agent's capabilities.
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
              {s.transport} · {s.tools?.length ?? 0} tools
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
            Reconnect
          </button>
          <button
            onClick={() => handleRemove(s.id)}
            style={{
              height: 28, padding: '0 10px', borderRadius: 'var(--r-pill)',
              fontSize: 11, color: 'var(--st-error)', background: 'rgba(255,107,107,.08)',
              border: '1px solid rgba(255,107,107,.2)', cursor: 'pointer', fontFamily: 'var(--f)',
            }}
          >
            Remove
          </button>
        </div>
      ))}

      {adding ? (
        <div style={{ padding: '16px 20px', borderTop: '1px solid var(--hair)', display: 'flex', flexDirection: 'column', gap: 12 }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
            <input
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              placeholder="Server name"
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
                placeholder="Command (e.g. npx, node)"
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
              placeholder="Server URL (e.g. http://localhost:3002/mcp)"
              style={mcpInputStyle}
            />
          )}
          <input
            type="password"
            value={form.apiKey}
            onChange={(e) => setForm({ ...form, apiKey: e.target.value })}
            placeholder="API Key (optional)"
            style={mcpInputStyle}
          />
          <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
            <button onClick={() => setAdding(false)} style={mcpBtnStyle}>Cancel</button>
            <button onClick={handleAdd} style={{ ...mcpBtnStyle, color: 'var(--t-hi)', borderColor: 'var(--g-edge)' }}>
              Connect
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
            + Add MCP Server
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
    <Group title="Keyboard shortcuts">
      <Row label="Show / hide (global)"><Kbd keys={['Ctrl', '⇧', 'J']} /></Row>
      <Row label="Command palette"><Kbd keys={['⌘', 'K']} /></Row>
      <Row label="Push to talk"><Kbd keys={['space']} /></Row>
      <Row label="Switch screen"><Kbd keys={['1', '2', '3']} /></Row>
      <Row label="Theme"><Kbd keys={['T']} /></Row>
      <Row label="Ambient mode"><Kbd keys={['A']} /></Row>
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
                      not installed
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
