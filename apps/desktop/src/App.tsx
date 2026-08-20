import { useState } from 'react';
import { useJarvisStore } from './stores/jarvis.store';
import { Backdrop } from './theme/Backdrop';
import { OrbBridge } from './app/OrbBridge';
import { StatusPill } from './ui/StatusPill';
import { MetaBar } from './ui/MetaBar';
import { Nav } from './ui/Nav';
import { CommandPalette } from './ui/CommandPalette';
import { Ambient } from './screens/Ambient';
import { useKeyboardShortcuts } from './hooks/useKeyboardShortcuts';
import { useGlobalShortcut } from './hooks/useGlobalShortcut';
import { useMinimizeToTray } from './hooks/useMinimizeToTray';
import { useRestoreVisuals } from './hooks/useRestoreVisuals';
import { useWelcome } from './hooks/useWelcome';
import { ToastContainer } from './ui/Toast';
import { Voice } from './screens/Voice';
import { ChatScreen } from './screens/ChatScreen';
import { SettingsScreen } from './screens/SettingsScreen';

type Screen = 'voice' | 'chat' | 'settings';

export function App() {
  const view = useJarvisStore((s) => s.view) as Screen;
  const setView = useJarvisStore((s) => s.setView);
  const isAmbient = useJarvisStore((s) => s.isAmbient);
  const [paletteOpen, setPaletteOpen] = useState(false);

  useKeyboardShortcuts();
  useGlobalShortcut();
  useMinimizeToTray();
  useRestoreVisuals();
  useWelcome();

  const hideUI = isAmbient;

  return (
    <>
      <Backdrop />
      <OrbBridge />
      <div style={{
        opacity: hideUI ? 0 : 1,
        pointerEvents: hideUI ? 'none' : 'auto',
        transition: 'opacity .36s linear',
      }}>
        <StatusPill />
        <MetaBar onOpenPalette={() => setPaletteOpen(true)} />
        <div style={{ position: 'relative', zIndex: 3, minHeight: '100vh' }}>
          {view === 'voice' ? <Voice /> :
           view === 'settings' ? <SettingsScreen /> :
           <ChatScreen />}
        </div>
        <Nav active={view} onNavigate={(s) => setView(s)} />
      </div>
      <Ambient />
      <CommandPalette externalOpen={paletteOpen} onExternalOpenChange={setPaletteOpen} />
      <ToastContainer />
    </>
  );
}
