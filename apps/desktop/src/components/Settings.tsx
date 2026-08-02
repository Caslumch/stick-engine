import { useEffect, useState } from 'react';
import { useJarvisStore } from '../stores/jarvis.store';
import { useSocket } from '../hooks/useSocket';

function SettingInput({
  label,
  settingKey,
  type = 'text',
  placeholder,
}: {
  label: string;
  settingKey: string;
  type?: 'text' | 'password';
  placeholder?: string;
}) {
  const value = useJarvisStore((s) => s.settings[settingKey] ?? '');
  const { updateSetting } = useSocket();
  const [local, setLocal] = useState(value);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    setLocal(value);
  }, [value]);

  const handleBlur = () => {
    if (local !== value) {
      updateSetting(settingKey, local);
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    }
  };

  return (
    <div className="space-y-1">
      <label className="text-xs text-jarvis-muted uppercase tracking-wider">{label}</label>
      <div className="relative">
        <input
          type={type}
          value={local}
          onChange={(e) => setLocal(e.target.value)}
          onBlur={handleBlur}
          onKeyDown={(e) => e.key === 'Enter' && handleBlur()}
          placeholder={placeholder}
          className="w-full px-3 py-2 rounded-lg text-sm bg-jarvis-bg text-jarvis-text border border-jarvis-border focus:ring-1 focus:ring-jarvis-primary/50 outline-none transition-all"
        />
        {saved && (
          <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-jarvis-success">
            Salvo
          </span>
        )}
      </div>
    </div>
  );
}

function SettingToggle({
  label,
  settingKey,
}: {
  label: string;
  settingKey: string;
}) {
  const value = useJarvisStore((s) => s.settings[settingKey] ?? 'true');
  const { updateSetting } = useSocket();
  const isOn = value === 'true';

  return (
    <div className="flex items-center justify-between">
      <span className="text-sm text-jarvis-text">{label}</span>
      <button
        onClick={() => updateSetting(settingKey, isOn ? 'false' : 'true')}
        className={`w-10 h-5 rounded-full transition-colors relative ${
          isOn ? 'bg-jarvis-primary' : 'bg-jarvis-border'
        }`}
      >
        <div
          className={`w-4 h-4 rounded-full bg-white absolute top-0.5 transition-transform ${
            isOn ? 'translate-x-5' : 'translate-x-0.5'
          }`}
        />
      </button>
    </div>
  );
}

function SettingSelect({
  label,
  settingKey,
  options,
}: {
  label: string;
  settingKey: string;
  options: { value: string; label: string }[];
}) {
  const value = useJarvisStore((s) => s.settings[settingKey] ?? options[0]?.value ?? '');
  const { updateSetting } = useSocket();

  return (
    <div className="flex items-center justify-between">
      <span className="text-sm text-jarvis-text">{label}</span>
      <select
        value={value}
        onChange={(e) => updateSetting(settingKey, e.target.value)}
        className="px-3 py-1.5 rounded-lg text-sm bg-jarvis-bg text-jarvis-text border border-jarvis-border focus:ring-1 focus:ring-jarvis-primary/50 outline-none transition-all"
      >
        {options.map((opt) => (
          <option key={opt.value} value={opt.value}>{opt.label}</option>
        ))}
      </select>
    </div>
  );
}

export function Settings() {
  const { setView } = useJarvisStore();
  const { loadSettings } = useSocket();

  useEffect(() => {
    loadSettings();
  }, [loadSettings]);

  return (
    <div className="flex flex-col min-h-screen p-6 bg-jarvis-bg">
      {/* Header */}
      <div className="flex items-center justify-between mb-8">
        <button
          onClick={() => setView('chat')}
          className="text-sm text-jarvis-muted hover:text-jarvis-text transition-colors"
        >
          ← Voltar
        </button>
        <h1 className="text-lg font-light text-jarvis-text">Configuracoes</h1>
        <div className="w-12" />
      </div>

      <div className="max-w-lg mx-auto w-full space-y-8">
        {/* LLM Local */}
        <section className="space-y-4">
          <h2 className="text-sm font-medium text-jarvis-primary uppercase tracking-wider">
            LLM Local (Ollama)
          </h2>
          <div className="p-4 rounded-xl bg-jarvis-surface border border-jarvis-border space-y-4">
            <SettingInput
              label="URL do Ollama"
              settingKey="llm.ollama.url"
              placeholder="http://localhost:11434"
            />
            <SettingInput
              label="Modelo"
              settingKey="llm.ollama.model"
              placeholder="qwen2.5"
            />
          </div>
        </section>

        {/* LLM Cloud */}
        <section className="space-y-4">
          <h2 className="text-sm font-medium text-jarvis-primary uppercase tracking-wider">
            LLM Cloud (OpenAI)
          </h2>
          <div className="p-4 rounded-xl bg-jarvis-surface border border-jarvis-border space-y-4">
            <SettingInput
              label="API Key"
              settingKey="llm.openai.apiKey"
              type="password"
              placeholder="sk-..."
            />
            <SettingInput
              label="Modelo"
              settingKey="llm.openai.model"
              placeholder="gpt-4o-mini"
            />
          </div>
        </section>

        {/* Personalidade */}
        <section className="space-y-4">
          <h2 className="text-sm font-medium text-jarvis-primary uppercase tracking-wider">
            Personalidade
          </h2>
          <div className="p-4 rounded-xl bg-jarvis-surface border border-jarvis-border space-y-4">
            <SettingSelect
              label="Tom"
              settingKey="personality.tone"
              options={[
                { value: 'friendly', label: 'Amigável' },
                { value: 'formal', label: 'Formal' },
                { value: 'casual', label: 'Descontraído' },
              ]}
            />
            <SettingSelect
              label="Proatividade"
              settingKey="personality.proactivity"
              options={[
                { value: 'low', label: 'Baixa' },
                { value: 'medium', label: 'Média' },
                { value: 'high', label: 'Alta' },
              ]}
            />
            <SettingSelect
              label="Detalhamento"
              settingKey="personality.verbosity"
              options={[
                { value: 'concise', label: 'Conciso' },
                { value: 'balanced', label: 'Equilibrado' },
                { value: 'detailed', label: 'Detalhado' },
              ]}
            />
          </div>
        </section>

        {/* Decision Engine */}
        <section className="space-y-4">
          <h2 className="text-sm font-medium text-jarvis-primary uppercase tracking-wider">
            Decision Engine
          </h2>
          <div className="p-4 rounded-xl bg-jarvis-surface border border-jarvis-border space-y-4">
            <SettingToggle
              label="Preferir LLM local"
              settingKey="llm.preferLocal"
            />
            <SettingInput
              label="Threshold de caracteres (cloud)"
              settingKey="decision.tokenThreshold"
              placeholder="2000"
            />
            <SettingInput
              label="Keywords de pesquisa (separadas por virgula)"
              settingKey="decision.searchKeywords"
              placeholder="pesquisa,busca,google..."
            />
          </div>
        </section>
      </div>
    </div>
  );
}
