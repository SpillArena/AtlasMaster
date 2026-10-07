import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { OCEAN_VIEWS } from '../../game/oceanViews'
import { MapCanvas } from './MapCanvas'
import type { ComponentProps } from 'react'

/** Keep the whole round active while the player chooses a closer map view. */
export function OceanMap(props: ComponentProps<typeof MapCanvas>) {
  const { t } = useTranslation()
  const [selection, setSelection] = useState({ id: 'world', target: props.highlightId })
  // A new choice/typing question starts from the world view so its highlighted
  // place cannot be hidden by the previous question's regional crop.
  const viewId = selection.target === props.highlightId ? selection.id : 'world'
  const view = OCEAN_VIEWS.find((v) => v.id === viewId) ?? OCEAN_VIEWS[0]
  return (
    <div className="flex h-full flex-col">
      <div role="group" aria-label={t('game.oceanViews')}
        className="flex shrink-0 gap-1 overflow-x-auto border-b px-2 py-1.5"
        style={{ background: 'var(--surface-card)', borderColor: 'var(--border)' }}>
        {OCEAN_VIEWS.map((v) => (
          <button key={v.id} type="button" aria-pressed={viewId === v.id}
            onClick={() => setSelection({ id: v.id, target: props.highlightId })}
            className="min-h-11 shrink-0 rounded-lg px-3 text-xs font-semibold transition-colors hover:bg-[var(--map-idle-hover)]"
            style={{ color: viewId === v.id ? 'var(--text)' : 'var(--text-muted)',
              background: viewId === v.id ? 'var(--map-idle)' : undefined }}>
            {t(`game.oceanView.${v.id}`)}
          </button>
        ))}
      </div>
      <div className="min-h-0 flex-1">
        <MapCanvas key={view.id} {...props} projectionSpec={view.projection}
          fitData={view.fit ?? props.fitData} />
      </div>
    </div>
  )
}
