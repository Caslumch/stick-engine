/** Seção 9 do DESIGN_SYSTEM.md — nunca o contrário. */

export const spring = {
  snap:  { type: 'spring' as const, stiffness: 420, damping: 32, mass: 0.8 },
  morph: { type: 'spring' as const, stiffness: 260, damping: 30, mass: 1 },
  soft:  { type: 'spring' as const, stiffness: 140, damping: 26, mass: 1 },
  orb:   { type: 'spring' as const, stiffness: 55,  damping: 20, mass: 1.4 },
}

export const ease = {
  out: [0.22, 1, 0.36, 1] as const,
  morph: [0.3, 1.15, 0.35, 1] as const,
}

export const dur = { fast: 0.16, base: 0.26, slow: 0.46 }

export const stagger = 0.026
