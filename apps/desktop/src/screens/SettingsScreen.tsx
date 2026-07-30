import { useEffect, useState, useCallback, useRef } from 'react'
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
  { name: 'Calendar', on: true },
  { name: 'Mail', on: true },
  { name: 'Files', on: true },
  { name: 'Shell', on: true },
  { name: 'Browser', on: true },
  { name: 'Payments', on: false },
  { name: 'Smart home', on: false },
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

function AgentGroup() {
  const { updateSetting } = useSocket()
  const settings = useJarvisStore((s) => s.settings)

  return (
    <Group title="Agent">
      <Row label="Persona" description="How much personality the replies carry.">
        <Segmented
          options={[
            { value: 'warm', label: 'Warm' },
            { value: 'terse', label: 'Terse' },
            { value: 'dry', label: 'Dry' },
          ]}
          value={settings['agent.persona'] ?? 'terse'}
          onChange={(v) => updateSetting('agent.persona', v)}
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
    </Group>
  )
}

// ─── Voice ───────────────────────────────────────────────────

function VoiceGroup() {
  const { updateSetting } = useSocket()
  const settings = useJarvisStore((s) => s.settings)

  return (
    <Group title="Voice">
      <Row label="Speech rate" description="Playback speed of synthesized replies.">
        <Slider
          value={parseInt(settings['voice.speechRate'] ?? '112')}
          min={60} max={180} suffix="%"
          onChange={(v) => updateSetting('voice.speechRate', String(v))}
        />
      </Row>
      <Row label="Turn detection" description="How eagerly it decides you stopped talking.">
        <Slider
          value={parseInt(settings['voice.turnDetection'] ?? '64')}
          min={0} max={100}
          onChange={(v) => updateSetting('voice.turnDetection', String(v))}
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
              cursor: 'pointer',
              fontFamily: 'var(--f)',
              transition: '.2s',
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
      overflow: 'hidden',
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
