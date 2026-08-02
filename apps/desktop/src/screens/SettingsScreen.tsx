import { useEffect, useState, useCallback, useRef } from 'react'
import { createPortal } from 'react-dom'
import { useJarvisStore } from '../stores/jarvis.store'
import { useSocket } from '../hooks/useSocket'
import { useTheme, type ThemeMode } from '../theme/ThemeProvider'

/**
 * Tela de settings — grupos em cards de vidro, Appearance primeiro.
 * Espelha fielmente o stick.html (screenshots de referência).
 * Seção 11 do DESIGN_SYSTEM.md.
 */

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
  { name: 'Calendar', on: false, desc: 'Lembretes e compromissos (em breve)' },
  { name: 'Search', on: false, desc: 'Pesquisa web (em breve)' },
  { name: 'Notifications', on: false, desc: 'Telegram, email (em breve)' },
  { name: 'Smart home', on: false, desc: 'Luzes, tomadas (em breve)' },
]

export function SettingsScreen() {
  const { loadSettings } = useSocket()

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
        <p style={{ fontSize: 15, color: 'var(--t-low)', marginBottom: 34 }}>
          Everything applies the moment you change it.
        </p>

        <AppearanceGroup />
        <AgentGroup />
        <VoiceGroup />
        <OrbGroup />
        <ToolsGroup />
        <ShortcutsGroup />
      </div>
    </div>
  )
}

// ─── Appearance ──────────────────────────────────────────────

function AppearanceGroup() {
  const { mode, setMode } = useTheme()
  const [accent, setAccent] = useState(ACCENT_SWATCHES[0])
  const [bgPreset, setBgPreset] = useState('none')
  const [bgBlur, setBgBlur] = useState(18)
  const [bgDim, setBgDim] = useState(55)
  const fileRef = useRef<HTMLInputElement>(null)

  const applyAccent = (color: string) => {
    setAccent(color)
    // Só aplica em idle (outros estados sobrescrevem)
    const state = useJarvisStore.getState().state
    if (state === 'idle') {
      document.documentElement.style.setProperty('--accent', color)
      const n = parseInt(color.slice(1), 16)
      document.documentElement.style.setProperty('--accent-rgb',
        `${(n >> 16) & 255}, ${(n >> 8) & 255}, ${n & 255}`)
    }
  }

  const applyBg = (key: string) => {
    setBgPreset(key)
    const hasImg = key !== 'none'
    document.documentElement.style.setProperty('--bg-img', BG_PRESETS[key] ?? key)
    document.documentElement.style.setProperty('--blob-op', hasImg ? '.35' : '1')
    const photo = document.querySelector('.backdrop-photo') as HTMLElement | null
    if (photo) {
      if (hasImg) photo.setAttribute('data-active', '')
      else photo.removeAttribute('data-active')
    }
  }

  const handleFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0]
    if (!f) return
    const reader = new FileReader()
    reader.onload = () => {
      applyBg(`url("${reader.result}")`)
      setBgPreset('custom')
    }
    reader.readAsDataURL(f)
  }

  const applyBlur = (v: number) => {
    setBgBlur(v)
    document.documentElement.style.setProperty('--bg-blur', v + 'px')
  }

  const applyDim = (v: number) => {
    setBgDim(v)
    document.documentElement.style.setProperty('--bg-dim', String(v / 100))
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
                width: 26,
                height: 26,
                borderRadius: '50%',
                border: accent === c ? '2px solid var(--t-hi)' : '2px solid transparent',
                background: 'none',
                cursor: 'pointer',
                position: 'relative',
                transition: 'transform .22s var(--sp)',
                padding: 0,
              }}
            >
              <span style={{
                position: 'absolute',
                inset: 3,
                borderRadius: '50%',
                background: c,
              }} />
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
              height: 32,
              padding: '0 14px',
              borderRadius: 'var(--r-pill)',
              fontSize: 13,
              color: 'var(--t-hi)',
              background: 'var(--fill-2)',
              border: '1px solid var(--g-edge)',
              cursor: 'pointer',
              fontFamily: 'var(--f)',
              transition: '.2s',
            }}
          >
            Custom…
          </button>
          <input ref={fileRef} type="file" accept="image/*" hidden onChange={handleFile} />
        </div>
      </Row>
      <Row label="Background blur" description="More blur keeps text legible over busy photos.">
        <Slider value={bgBlur} min={0} max={60} suffix="px" onChange={applyBlur} />
      </Row>
      <Row label="Background dim" description="How much of the base colour sits on top.">
        <Slider value={bgDim} min={0} max={95} suffix="%" onChange={applyDim} />
      </Row>
    </Group>
  )
}

// ─── Agent ───────────────────────────────────────────────────

const LLM_MODELS = [
  { value: 'llama3.1', label: 'Llama 3.1', desc: 'Meta. Melhor em seguir instruções e PT-BR. 8B params.' },
  { value: 'llama3.2', label: 'Llama 3.2', desc: 'Meta. Versão compacta, rápida. 3B params.' },
  { value: 'qwen2.5', label: 'Qwen 2.5', desc: 'Alibaba. Bom em código e raciocínio. 7B params.' },
  { value: 'mistral', label: 'Mistral', desc: 'Mistral AI. Rápido e eficiente. 7B params.' },
  { value: 'gemma2', label: 'Gemma 2', desc: 'Google. Compacto e preciso. 9B params.' },
  { value: 'phi3', label: 'Phi-3', desc: 'Microsoft. Otimizado pra tarefas curtas. 3.8B params.' },
  { value: 'deepseek-r1', label: 'DeepSeek R1', desc: 'DeepSeek. Forte em raciocínio lógico. 7B params.' },
]

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
            // Pré-carregar modelo no Ollama pra não demorar na primeira mensagem
            fetch('http://localhost:11434/api/generate', {
              method: 'POST',
              body: JSON.stringify({ model: v, prompt: '', keep_alive: '10m' }),
            }).catch(() => {})
          }}
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

const IN_TAURI = typeof window !== 'undefined' && '__TAURI_INTERNALS__' in window

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
      setEnabled(!v) // revert on error
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

// ─── Voice ───────────────────────────────────────────────────

function VoiceGroup() {
  const { updateSetting } = useSocket()
  const settings = useJarvisStore((s) => s.settings)

  const ttsEngine = settings['tts.engine'] || 'edge'

  return (
    <Group title="Voice">
      <Row label="TTS engine" description="Which voice engine synthesizes the agent's speech.">
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
            // Limpar voice ao trocar engine
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
      <Row label="Speech speed" description="Base speed. Dynamic mode adjusts per content type.">
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
  )
}

// ─── Orb ─────────────────────────────────────────────────────

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
            height: 32,
            padding: '0 14px',
            borderRadius: 'var(--r-pill)',
            fontSize: 13,
            color: 'var(--t-hi)',
            background: 'var(--fill-2)',
            border: '1px solid var(--g-edge)',
            cursor: 'pointer',
            fontFamily: 'var(--f)',
            transition: '.2s',
          }}
        >
          Enter
        </button>
      </Row>
    </Group>
  )
}

// ─── Tools ───────────────────────────────────────────────────

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
              height: 32,
              padding: '0 14px',
              borderRadius: 'var(--r-pill)',
              display: 'flex',
              alignItems: 'center',
              gap: 8,
              fontSize: 13,
              color: t.on ? 'var(--t-mid)' : 'var(--t-ghost)',
              background: 'var(--fill-1)',
              border: '1px solid var(--hair)',
              cursor: t.on ? 'pointer' : 'default',
              fontFamily: 'var(--f)',
              transition: '.2s',
              opacity: t.on ? 1 : 0.6,
            }}
          >
            <span style={{
              width: 6,
              height: 6,
              borderRadius: '50%',
              background: t.on ? 'var(--st-executing)' : 'var(--fill-3)',
            }} />
            {t.name}
          </button>
        ))}
      </div>
    </Group>
  )
}

// ─── Shortcuts ───────────────────────────────────────────────

function ShortcutsGroup() {
  return (
    <Group title="Shortcuts">
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
// Primitivos
// ═══════════════════════════════════════════════════════════════

function Group({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="glass" style={{
      borderRadius: 'var(--r-md)',
      marginBottom: 16,
    }}>
      <div style={{
        padding: '16px 20px 6px',
        fontSize: 12.5,
        fontWeight: 500,
        color: 'var(--t-low)',
      }}>
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
      display: 'grid',
      gridTemplateColumns: '1fr auto',
      gap: 22,
      alignItems: 'center',
      padding: '15px 20px',
      borderTop: '1px solid var(--hair)',
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
        width: 44,
        height: 26,
        borderRadius: 'var(--r-pill)',
        background: value ? 'rgba(var(--accent-rgb), .30)' : 'var(--fill-2)',
        border: `1px solid ${value ? 'rgba(var(--accent-rgb), .5)' : 'var(--g-edge)'}`,
        position: 'relative',
        cursor: 'pointer',
        transition: '.3s',
        padding: 0,
      }}
    >
      <span style={{
        position: 'absolute',
        top: 2,
        left: 2,
        width: 20,
        height: 20,
        borderRadius: '50%',
        background: value ? '#fff' : 'var(--knob)',
        transform: value ? 'translateX(18px)' : 'none',
        transition: 'transform .38s var(--sp-morph), background .3s',
        boxShadow: value
          ? '0 0 12px rgba(var(--accent-rgb), .7)'
          : '0 1px 3px rgba(0,0,0,.25)',
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
      display: 'flex',
      position: 'relative',
      padding: 3,
      borderRadius: 'var(--r-pill)',
      background: 'var(--fill-1)',
      border: '1px solid var(--hair)',
    }}>
      <span style={{
        position: 'absolute',
        top: 3,
        left: 0,
        height: 'calc(100% - 6px)',
        borderRadius: 'var(--r-pill)',
        background: 'var(--fill-3)',
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
            position: 'relative',
            zIndex: 1,
            height: 28,
            padding: '0 15px',
            borderRadius: 'var(--r-pill)',
            fontSize: 12.5,
            color: opt.value === value ? 'var(--t-hi)' : 'var(--t-low)',
            fontWeight: 450,
            transition: 'color .22s',
            whiteSpace: 'nowrap',
            background: 'none',
            border: 'none',
            cursor: 'pointer',
            fontFamily: 'var(--f)',
          }}
        >
          {opt.label}
        </button>
      ))}
    </div>
  )
}

function Slider({ value, min, max, suffix, onChange }: {
  value: number
  min: number
  max: number
  suffix?: string
  onChange: (v: number) => void
}) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 14, width: 206 }}>
      <input
        type="range"
        min={min}
        max={max}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        style={{
          flex: 1,
          height: 4,
          borderRadius: 4,
          background: 'var(--fill-3)',
          appearance: 'none',
          WebkitAppearance: 'none',
        }}
      />
      <span style={{
        fontFamily: 'var(--f-mono)',
        fontSize: 12.5,
        color: 'var(--t-mid)',
        width: 44,
        textAlign: 'right',
      }}>
        {value}{suffix ?? ''}
      </span>
    </div>
  )
}

function ModelSelect({ models, value, installed, onChange }: {
  models: { value: string; label: string; desc: string }[]
  value: string
  installed: string[]
  onChange: (v: string) => void
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
        ref={btnRef}
        onClick={handleOpen}
        style={{
          height: 32,
          padding: '0 14px',
          borderRadius: 'var(--r-pill)',
          fontSize: 13,
          color: isAvailable(value) ? 'var(--t-hi)' : 'var(--st-error)',
          background: 'var(--fill-1)',
          border: `1px solid ${isAvailable(value) ? 'var(--g-edge)' : 'rgba(255,107,107,.3)'}`,
          cursor: 'pointer',
          fontFamily: 'var(--f)',
          display: 'flex',
          alignItems: 'center',
          gap: 8,
          transition: '.2s',
        }}
      >
        {current?.label || value}
        <svg width={10} height={10} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round">
          <path d={open ? 'M18 15l-6-6-6 6' : 'M6 9l6 6 6-6'} />
        </svg>
      </button>

      {open && createPortal(
        <div
          ref={menuRef}
          style={{
            position: 'fixed',
            top: pos.top,
            right: pos.right,
            width: 280,
            borderRadius: 'var(--r-sm)',
            background: 'var(--bg)',
            border: '1px solid var(--g-edge)',
            boxShadow: '0 18px 50px -10px rgba(0,0,0,.6)',
            maxHeight: 360,
            overflowY: 'auto',
            zIndex: 200,
          }}
        >
          {models.map((m) => {
            const avail = isAvailable(m.value)
            const active = m.value === value
            return (
              <button
                key={m.value}
                onClick={() => { onChange(m.value); setOpen(false) }}
                style={{
                  width: '100%',
                  textAlign: 'left',
                  padding: '10px 14px',
                  background: active ? 'var(--fill-2)' : 'none',
                  border: 'none',
                  borderBottom: '1px solid var(--hair)',
                  cursor: 'pointer',
                  fontFamily: 'var(--f)',
                  transition: 'background .15s',
                }}
                onMouseEnter={(e) => { if (!active) e.currentTarget.style.background = 'var(--fill-1)' }}
                onMouseLeave={(e) => { if (!active) e.currentTarget.style.background = 'none' }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <span style={{
                    fontSize: 13,
                    fontWeight: active ? 500 : 400,
                    color: avail ? 'var(--t-hi)' : 'var(--t-low)',
                  }}>
                    {m.label}
                  </span>
                  {!avail && (
                    <span style={{
                      fontSize: 10,
                      color: 'var(--st-error)',
                      padding: '1px 6px',
                      borderRadius: 'var(--r-pill)',
                      background: 'rgba(255,107,107,.12)',
                      fontWeight: 500,
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
                <div style={{
                  fontSize: 11.5,
                  color: 'var(--t-low)',
                  marginTop: 2,
                  lineHeight: 1.35,
                }}>
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
          fontFamily: 'var(--f-mono)',
          fontSize: 11.5,
          color: 'var(--t-mid)',
          padding: '4px 9px',
          borderRadius: 7,
          background: 'var(--fill-1)',
          border: '1px solid var(--hair)',
        }}>
          {k}
        </span>
      ))}
    </div>
  )
}
