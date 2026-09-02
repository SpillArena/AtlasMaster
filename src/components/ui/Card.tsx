interface Props extends React.HTMLAttributes<HTMLDivElement> {
  /*
   * `vellum` flyter over kartet — halvgjennomsiktig og lett sløret. `plate` er
   * et kartblad: opakt papir med hjørnelinje. `cartouche` er den sydde rammen
   * til banner og dialoger. `solid` er det nakne arket. Standarden er `solid`,
   * fordi sløring koster en utregning per frame og skal være et valg.
   */
  surface?: 'solid' | 'glass' | 'vellum' | 'plate' | 'cartouche'
  /** fade inn og et lite løft når kortet blir montert */
  animate?: boolean
  as?: 'div' | 'section' | 'article'
}

const SURFACE: Record<NonNullable<Props['surface']>, string> = {
  solid: 'card',
  glass: 'panel rounded-atlas-lg',
  vellum: 'panel rounded-atlas-lg',
  plate: 'plate',
  cartouche: 'cartouche',
}

export function Card({
  surface = 'solid',
  animate = false,
  as: Tag = 'div',
  className = '',
  ...rest
}: Props) {
  return (
    <Tag className={`${SURFACE[surface]} ${animate ? 'panel-in' : ''} ${className}`} {...rest} />
  )
}
