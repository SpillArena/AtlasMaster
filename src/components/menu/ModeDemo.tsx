import { motion } from 'framer-motion'
import type { Mode } from '../../game/types'

/**
 * Små skjematiske demoer som viser hvordan du faktisk svarer i hver modus.
 * De sier mer enn et ikon: du ser kontrollen før du velger den.
 */

function ClickDemo() {
  return (
    <svg viewBox="0 0 120 80" className="h-full w-full" aria-hidden>
      {/* landflate — antydning av et kart, ikke et ekte omriss */}
      <path
        d="M28 62 L22 44 L30 30 L44 20 L58 24 L66 14 L78 20 L84 36 L76 52 L60 64 L42 68 Z"
        fill="var(--map-idle)"
        stroke="var(--border)"
        strokeWidth="1.5"
      />
      <path
        d="M58 24 L66 14 L78 20 L84 36 L76 52 L64 46 Z"
        fill="color-mix(in srgb, var(--accent) 45%, transparent)"
      />
      {/* markøren sikter seg inn */}
      <motion.g
        animate={{ x: [0, 6, 0], y: [0, -4, 0] }}
        transition={{ duration: 2.4, repeat: Infinity, ease: 'easeInOut' }}
      >
        <motion.circle
          cx="72"
          cy="34"
          fill="none"
          stroke="var(--accent)"
          strokeWidth="2"
          initial={{ r: 8 }}
          animate={{ r: [8, 14, 8], opacity: [0.9, 0, 0.9] }}
          transition={{ duration: 1.8, repeat: Infinity }}
        />
        <circle cx="72" cy="34" r="3.5" fill="var(--accent)" />
        <path
          d="M72 22 v6 M72 40 v6 M60 34 h6 M78 34 h6"
          stroke="var(--accent)"
          strokeWidth="1.6"
          strokeLinecap="round"
        />
      </motion.g>
    </svg>
  )
}

function ChoiceDemo() {
  return (
    <svg viewBox="0 0 120 80" className="h-full w-full" aria-hidden>
      {[0, 1, 2, 3].map((i) => {
        const y = 8 + i * 18
        const isAnswer = i === 2
        return (
          <g key={i}>
            <rect
              x="10"
              y={y}
              width="100"
              height="13"
              rx="6.5"
              fill={isAnswer ? 'color-mix(in srgb, var(--accent) 22%, transparent)' : 'var(--map-idle)'}
              stroke={isAnswer ? 'var(--accent)' : 'var(--border)'}
              strokeWidth="1.4"
            />
            <rect
              x="18"
              y={y + 4.5}
              width={isAnswer ? 52 : 34 + i * 8}
              height="4"
              rx="2"
              fill={isAnswer ? 'var(--accent)' : 'var(--text-subtle)'}
              opacity={isAnswer ? 0.9 : 0.4}
            />
            {isAnswer && (
              <motion.rect
                x="10"
                y={y}
                width="100"
                height="13"
                rx="6.5"
                fill="none"
                stroke="var(--accent)"
                strokeWidth="2"
                animate={{ opacity: [0, 1, 0] }}
                transition={{ duration: 2, repeat: Infinity }}
              />
            )}
          </g>
        )
      })}
    </svg>
  )
}

function TypeDemo() {
  const letters = 'TROMSØ'.split('')
  return (
    <svg viewBox="0 0 120 80" className="h-full w-full" aria-hidden>
      <rect
        x="10"
        y="26"
        width="100"
        height="28"
        rx="8"
        fill="var(--map-idle)"
        stroke="var(--border)"
        strokeWidth="1.4"
      />
      {letters.map((letter, i) => (
        <motion.text
          key={letter + i}
          x={21 + i * 12}
          y="45"
          className="numeric"
          fontSize="12"
          fontWeight="700"
          fill="var(--text)"
          initial={{ opacity: 0 }}
          animate={{ opacity: [0, 0, 1, 1, 0] }}
          transition={{
            duration: 3.6,
            repeat: Infinity,
            times: [0, 0.08 + i * 0.07, 0.16 + i * 0.07, 0.86, 0.95],
          }}
        >
          {letter}
        </motion.text>
      ))}
      {/* skrivemarkør */}
      <motion.rect
        y="34"
        width="2"
        height="13"
        fill="var(--accent)"
        animate={{
          x: [21, 21 + letters.length * 12, 21],
          opacity: [1, 1, 0.2, 1],
        }}
        transition={{ duration: 3.6, repeat: Infinity, times: [0, 0.5, 0.9, 1] }}
      />
    </svg>
  )
}

const DEMOS: Record<Mode, () => React.JSX.Element> = {
  click: ClickDemo,
  choice: ChoiceDemo,
  type: TypeDemo,
}

export function ModeDemo({ mode }: { mode: Mode }) {
  const Demo = DEMOS[mode]
  return <Demo />
}
