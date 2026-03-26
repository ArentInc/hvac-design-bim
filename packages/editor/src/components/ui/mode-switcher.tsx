'use client'

import useEditor, { type ArchitecturePhase, type HvacPhase } from '../../store/use-editor'

const ARCHITECTURE_PHASE_TABS: { phase: ArchitecturePhase; label: string }[] = [
  { phase: 'site', label: 'Site' },
  { phase: 'structure', label: 'Structure' },
  { phase: 'furnish', label: 'Furnish' },
]

const HVAC_PHASE_TABS: { phase: HvacPhase; label: string }[] = [
  { phase: 'zone', label: 'Zone' },
  { phase: 'equip', label: 'Equip' },
  { phase: 'route', label: 'Route' },
  { phase: 'calc', label: 'Calc' },
]

export function ModeSwitcher() {
  const editorMode = useEditor((s) => s.editorMode)
  const setEditorMode = useEditor((s) => s.setEditorMode)

  return (
    <div className="mode-switcher flex items-center gap-1 rounded-lg border border-border/50 bg-background/60 p-0.5">
      <button
        className="rounded px-3 py-1 text-sm font-medium transition-colors data-[active=true]:bg-accent data-[active=false]:text-muted-foreground data-[active=false]:hover:text-foreground"
        data-active={editorMode === 'architecture'}
        onClick={() => setEditorMode('architecture')}
        type="button"
      >
        建築
      </button>
      <button
        className="rounded px-3 py-1 text-sm font-medium transition-colors data-[active=true]:bg-accent data-[active=false]:text-muted-foreground data-[active=false]:hover:text-foreground"
        data-active={editorMode === 'hvac'}
        onClick={() => setEditorMode('hvac')}
        type="button"
      >
        HVAC
      </button>
    </div>
  )
}

export function PhaseTabs() {
  const editorMode = useEditor((s) => s.editorMode)
  const phase = useEditor((s) => s.phase)
  const setPhase = useEditor((s) => s.setPhase)

  const tabs = editorMode === 'hvac' ? HVAC_PHASE_TABS : ARCHITECTURE_PHASE_TABS

  return (
    <div className="phase-tabs flex items-center gap-0.5">
      {tabs.map((tab) => (
        <button
          className="rounded px-3 py-1 text-sm font-medium transition-colors data-[active=true]:bg-accent data-[active=false]:text-muted-foreground data-[active=false]:hover:text-foreground"
          data-active={phase === tab.phase}
          key={tab.phase}
          onClick={() => setPhase(tab.phase)}
          type="button"
        >
          {tab.label}
        </button>
      ))}
    </div>
  )
}
