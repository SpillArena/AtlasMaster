import { forwardRef } from 'react'

export type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'danger'
export type ButtonSize = 'sm' | 'md' | 'lg'

interface Props extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant
  size?: ButtonSize
  /** fyller breidda til forelderen — brukast for hovudhandlingar på mobil */
  block?: boolean
}

/*
 * Storleikane følgjer handoff-en: 12–14 px vertikalt, 20–24 px horisontalt på
 * standardknappen. `sm` er til baren og sekundære handlingar, `lg` til den eine
 * knappen ein skjerm handlar om (START, «Spel igjen»).
 */
const SIZES: Record<ButtonSize, string> = {
  sm: 'px-3.5 py-2 text-sm',
  md: 'px-5 py-3 text-[0.9375rem]',
  lg: 'px-6 py-4 text-lg',
}

/*
 * Trykk gjev scale 0.98 og slepper tilbake. Det ligg i CSS og ikkje i
 * framer-motion: ein transform på :active blir gjeven til kompositoren, og
 * knappane står ofte over kartet som skal rasteriserast i same augeblink.
 */
const BASE =
  'inline-flex items-center justify-center gap-2 rounded-atlas font-semibold ' +
  'transition-[transform,background-color,border-color,color,filter] duration-150 ease-out ' +
  'active:scale-[0.98] disabled:pointer-events-none disabled:opacity-40'

export const Button = forwardRef<HTMLButtonElement, Props>(function Button(
  { variant = 'primary', size = 'md', block = false, className = '', style, ...rest },
  ref,
) {
  const variantClass =
    variant === 'primary' || variant === 'danger'
      ? 'text-white hover:brightness-95'
      : variant === 'secondary'
        ? 'border hover:border-[var(--border-hover)]'
        : 'hover:bg-[var(--map-idle)]'

  const variantStyle: React.CSSProperties =
    variant === 'primary'
      ? { background: 'var(--accent)' }
      : variant === 'danger'
        ? { background: 'var(--danger)' }
        : variant === 'secondary'
          ? {
              background: 'var(--color-surface-elevated)',
              borderColor: 'var(--color-border)',
              color: 'var(--text)',
            }
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
