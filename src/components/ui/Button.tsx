import { forwardRef } from 'react'

export type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'danger'
export type ButtonSize = 'sm' | 'md' | 'lg'

interface Props extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant
  size?: ButtonSize
  /** fyller bredden til forelderen — brukes for hovedhandlinger på mobil */
  block?: boolean
}

/*
 * Feltbok-knappen. `primary`/`danger` er et presset messing-/lakkstempel med
 * en tynn innerlinje som på en gravert plate. `secondary` er en bagasjelapp.
 * `ghost` er bare tekst. Størrelsene følger handoff-en; `lg` er den ene
 * knappen en skjerm handler om («Sett i gang», «Ny ekspedisjon»).
 */
const SIZES: Record<ButtonSize, string> = {
  sm: 'px-3.5 py-2 text-sm',
  md: 'px-5 py-3 text-[0.9375rem]',
  lg: 'px-7 py-4 text-lg tracking-[0.02em]',
}

const BASE =
  'inline-flex items-center justify-center gap-2 rounded-atlas font-semibold ' +
  'transition-[transform,background-color,border-color,color,filter,box-shadow] duration-150 ease-out ' +
  'active:scale-[0.98] disabled:pointer-events-none disabled:opacity-40'

const STAMPED =
  'text-[var(--color-surface)] shadow-[inset_0_0_0_1.5px_color-mix(in_srgb,var(--color-surface)_35%,transparent),0_2px_0_color-mix(in_srgb,var(--ink)_45%,transparent)] hover:brightness-[1.04]'

export const Button = forwardRef<HTMLButtonElement, Props>(function Button(
  { variant = 'primary', size = 'md', block = false, className = '', style, ...rest },
  ref,
) {
  const variantClass =
    variant === 'primary' || variant === 'danger'
      ? STAMPED
      : variant === 'secondary'
        ? 'tag border font-semibold hover:-translate-y-[1px] hover:border-[var(--border-hover)]'
        : 'hover:bg-[var(--map-idle)]'

  const variantStyle: React.CSSProperties =
    variant === 'primary'
      ? { background: 'var(--accent)' }
      : variant === 'danger'
        ? { background: 'var(--danger)' }
        : variant === 'secondary'
          ? { background: 'var(--surface-card)', color: 'var(--text)' }
          : { color: 'var(--text-muted)' }

  return (
    <button
      ref={ref}
      type={rest.type ?? 'button'}
      className={`${BASE} ${SIZES[size]} ${variantClass} ${block ? 'w-full' : ''} ${className}`}
      style={{ ...variantStyle, ...style }}
      {...rest}
    />
  )
})
