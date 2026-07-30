import { useState } from 'react';
import { useJarvisStore } from './stores/jarvis.store';
import { Backdrop } from './theme/Backdrop';
import { OrbBridge } from './app/OrbBridge';
import { StatusPill } from './ui/StatusPill';
import { MetaBar } from './ui/MetaBar';
import { Nav } from './ui/Nav';
import { CommandPalette } from './ui/CommandPalette';
import { useKeyboardShortcuts } from './hooks/useKeyboardShortcuts';
import { Voice } from './screens/Voice';
import { ChatScreen } from './screens/ChatScreen';
import { SettingsScreen } from './screens/SettingsScreen';

type Screen = 'voice' | 'chat' | 'settings';

export function App() {
  const view = useJarvisStore((s) => s.view) as Screen;
  const setView = useJarvisStore((s) => s.setView);
  const [paletteOpen, setPaletteOpen] = useState(false);

  useKeyboardShortcuts();

  return (
    <>
      <Backdrop />
      <OrbBridge />
      <StatusPill />
      <MetaBar onOpenPalette={() => setPaletteOpen(true)} />
      <div style={{ position: 'relative', zIndex: 3, minHeight: '100vh' }}>
        {view === 'voice' ? <Voice /> :
         view === 'settings' ? <SettingsScreen /> :
         <ChatScreen />}
      </div>
      <Nav active={view} onNavigate={(s) => setView(s)} />
      <CommandPalette externalOpen={paletteOpen} onExternalOpenChange={setPaletteOpen} />
    </>
  );
}
