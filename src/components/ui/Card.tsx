interface Props extends React.HTMLAttributes<HTMLDivElement> {
  /*
   * `glass` er flata som flyt over kartet — halvgjennomsiktig og sløra.
   * `solid` er arket: opakt, billig å teikne. Standarden er arket, fordi
   * sløring kostar ei ny utrekning per frame og skal vere eit val.
   */
  surface?: 'solid' | 'glass'
  /** fade inn og eit lite løft når kortet blir montert */
  animate?: boolean
  as?: 'div' | 'section' | 'article'
}

export function Card({
  surface = 'solid',
  animate = false,
  as: Tag = 'div',
  className = '',
  ...rest
}: Props) {
  const base = surface === 'glass' ? 'panel rounded-atlas-lg' : 'card'
  return <Tag className={`${base} ${animate ? 'panel-in' : ''} ${className}`} {...rest} />
}
