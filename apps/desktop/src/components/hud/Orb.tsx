import { motion } from 'framer-motion';
import type { JarvisState } from '@jarvis/shared';

const stateConfig: Record<JarvisState, { color: string; scale: number; shadow: string }> = {
  idle: {
    color: '#4ADFB0',
    scale: 1,
    shadow: '0 0 40px rgba(74, 223, 176, 0.3)',
  },
  listening: {
    color: '#57C8FF',
    scale: 1.15,
    shadow: '0 0 60px rgba(87, 200, 255, 0.5)',
  },
  thinking: {
    color: '#8B7BFF',
    scale: 1.05,
    shadow: '0 0 50px rgba(139, 123, 255, 0.5)',
  },
  speaking: {
    color: '#FFB45C',
    scale: 1.1,
    shadow: '0 0 50px rgba(255, 180, 92, 0.5)',
  },
  executing: {
    color: '#A6F05A',
    scale: 1.08,
    shadow: '0 0 50px rgba(166, 240, 90, 0.5)',
  },
  error: {
    color: '#FF6B6B',
    scale: 0.95,
    shadow: '0 0 50px rgba(255, 107, 107, 0.5)',
  },
  offline: {
    color: '#8A968F',
    scale: 0.9,
    shadow: '0 0 30px rgba(138, 150, 143, 0.3)',
  },
};

interface OrbProps {
  state: JarvisState;
}

export function Orb({ state }: OrbProps) {
  const config = stateConfig[state];

  return (
    <div className="flex items-center justify-center">
      <motion.div
        animate={{
          scale: [config.scale, config.scale * 1.05, config.scale],
          boxShadow: config.shadow,
        }}
        transition={{
          duration: state === 'thinking' ? 1.2 : 2.5,
          repeat: Infinity,
          ease: 'easeInOut',
        }}
        style={{
          width: 120,
          height: 120,
          borderRadius: '50%',
          background: `radial-gradient(circle at 35% 35%, ${config.color}88, ${config.color}22)`,
          border: `2px solid ${config.color}44`,
        }}
      />
    </div>
  );
}
