'use client'

import { useScene, useValidation } from '@pascal-app/core'
import {
  Building2,
  Calculator,
  Check,
  Fan,
  GitBranch,
  SquareDashedBottom,
  Thermometer,
} from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import { AnimatePresence, motion } from 'motion/react'
import { useMemo } from 'react'
import { cn } from '../../lib/utils'
import useEditor, { type ArchitecturePhase, type HvacPhase } from '../../store/use-editor'

// ─── Architecture Phases ──────────────────────────────────────────

const ARCHITECTURE_PHASE_TABS: { phase: ArchitecturePhase; label: string }[] = [
  { phase: 'site', label: 'Site' },
  { phase: 'structure', label: 'Structure' },
  { phase: 'furnish', label: 'Furnish' },
]

// ─── HVAC Phases (enhanced) ───────────────────────────────────────

type HvacPhaseTab = {
  phase: HvacPhase
  step: number
  icon: LucideIcon
  jaLabel: string
  description: string
}

const HVAC_PHASE_TABS: HvacPhaseTab[] = [
  {
    phase: 'zone',
    step: 1,
    icon: SquareDashedBottom,
    jaLabel: 'ゾーン設定',
    description: '空調ゾーンを定義',
  },
  {
    phase: 'equip',
    step: 2,
    icon: Fan,
    jaLabel: '機器配置',
    description: 'AHU・制気口を配置',
  },
  {
    phase: 'route',
    step: 3,
    icon: GitBranch,
    jaLabel: '配管ルート',
    description: 'ダクト・配管を接続',
  },
  {
    phase: 'calc',
    step: 4,
    icon: Calculator,
    jaLabel: '検証計算',
    description: '負荷計算と検証',
  },
]

// ─── Phase Guidance ───────────────────────────────────────────────

type PhaseGuidanceConfig = {
  instruction: string
  nextPhase: HvacPhase | null
  nextLabel: string | null
}

const PHASE_GUIDANCE: Record<HvacPhase, PhaseGuidanceConfig> = {
  zone: {
    instruction: 'Build(B)モードでフロアにゾーンを描画してください',
    nextPhase: 'equip',
    nextLabel: '機器配置へ',
  },
  equip: {
    instruction: 'AHUと制気口をゾーンに配置してください',
    nextPhase: 'route',
    nextLabel: '配管ルートへ',
  },
  route: {
    instruction: 'AHUポートからダクト・配管を接続してください',
    nextPhase: 'calc',
    nextLabel: '検証計算へ',
  },
  calc: {
    instruction: '再計算を実行して設計を検証してください',
    nextPhase: null,
    nextLabel: null,
  },
}

// ─── Phase Completion Hook ────────────────────────────────────────

function usePhaseCompletion(): Record<HvacPhase, boolean> {
  const nodes = useScene((s) => s.nodes)
  const warnings = useValidation((s) => s.warnings)

  return useMemo(() => {
    const values = Object.values(nodes)
    const hasType = (type: string) => values.some((n: any) => n.type === type)

    return {
      zone: hasType('hvac_zone'),
      equip: hasType('ahu') && hasType('diffuser'),
      route: hasType('duct_segment'),
      calc: warnings.length === 0 && hasType('hvac_zone'),
    }
  }, [nodes, warnings])
}

// ─── Phase Summary Hook ──────────────────────────────────────────

function usePhaseSummary(phase: HvacPhase): string | null {
  const nodes = useScene((s) => s.nodes)

  return useMemo(() => {
    const values = Object.values(nodes)
    const countType = (type: string) => values.filter((n: any) => n.type === type).length

    switch (phase) {
      case 'zone': {
        const count = countType('hvac_zone')
        if (count === 0) return null
        const withCalc = values.filter(
          (n: any) => n.type === 'hvac_zone' && n.calcResult?.status === 'success',
        ).length
        return `${count}ゾーン定義済み${withCalc > 0 ? ` / ${withCalc}件 負荷計算完了` : ''}`
      }
      case 'equip': {
        const ahuCount = countType('ahu')
        const diffCount = countType('diffuser')
        if (ahuCount === 0 && diffCount === 0) return null
        return `AHU ${ahuCount}台 / 制気口 ${diffCount}台`
      }
      case 'route': {
        const ductCount = countType('duct_segment')
        const pipeCount = countType('pipe_segment')
        if (ductCount === 0 && pipeCount === 0) return null
        return `ダクト ${ductCount}区間 / 配管 ${pipeCount}区間`
      }
      case 'calc': {
        const warnings = useValidation.getState().warnings
        if (warnings.length === 0) return '検証完了 — 警告なし'
        return `警告 ${warnings.length}件`
      }
    }
  }, [nodes, phase])
}

// ─── Mode Switcher (建築/HVAC) ───────────────────────────────────

export function ModeSwitcher() {
  const editorMode = useEditor((s) => s.editorMode)
  const setEditorMode = useEditor((s) => s.setEditorMode)

  return (
    <div className="mode-switcher flex items-center gap-1 rounded-lg border border-border/50 bg-background/60 p-0.5">
      <button
        className={cn(
          'flex items-center gap-1.5 rounded px-3 py-1.5 text-sm font-medium transition-colors',
          'data-[active=false]:text-muted-foreground data-[active=false]:hover:text-foreground',
          'data-[active=true]:bg-blue-500/15 data-[active=true]:text-blue-400',
        )}
        data-active={editorMode === 'architecture'}
        onClick={() => setEditorMode('architecture')}
        type="button"
      >
        <Building2 className="size-4" />
        建築
      </button>
      <button
        className={cn(
          'flex items-center gap-1.5 rounded px-3 py-1.5 text-sm font-medium transition-colors',
          'data-[active=false]:text-muted-foreground data-[active=false]:hover:text-foreground',
          'data-[active=true]:bg-orange-500/15 data-[active=true]:text-orange-400',
        )}
        data-active={editorMode === 'hvac'}
        onClick={() => setEditorMode('hvac')}
        type="button"
      >
        <Thermometer className="size-4" />
        HVAC
      </button>
    </div>
  )
}

// ─── Phase Tabs ──────────────────────────────────────────────────

export function PhaseTabs() {
  const editorMode = useEditor((s) => s.editorMode)
  const phase = useEditor((s) => s.phase)
  const setPhase = useEditor((s) => s.setPhase)

  if (editorMode === 'hvac') {
    return <HvacPhaseStepper activePhase={phase as HvacPhase} onPhaseChange={setPhase} />
  }

  return (
    <div className="phase-tabs flex items-center gap-0.5">
      {ARCHITECTURE_PHASE_TABS.map((tab) => (
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

// ─── HVAC Phase Stepper ──────────────────────────────────────────

function HvacPhaseStepper({
  activePhase,
  onPhaseChange,
}: {
  activePhase: HvacPhase
  onPhaseChange: (phase: HvacPhase) => void
}) {
  const completion = usePhaseCompletion()
  const activeIndex = HVAC_PHASE_TABS.findIndex((t) => t.phase === activePhase)

  return (
    <div className="phase-tabs flex flex-col gap-1 py-1">
      {HVAC_PHASE_TABS.map((tab, index) => {
        const isActive = activePhase === tab.phase
        const isCompleted = completion[tab.phase]
        const isPast = index < activeIndex
        const Icon = tab.icon

        return (
          <div key={tab.phase} className="flex flex-col">
            <button
              className={cn(
                'group flex items-center gap-2.5 rounded-lg px-2.5 py-2 text-left transition-all',
                isActive
                  ? 'bg-accent/80 text-foreground'
                  : 'text-muted-foreground hover:bg-accent/40 hover:text-foreground',
              )}
              onClick={() => onPhaseChange(tab.phase)}
              type="button"
            >
              {/* Step indicator circle */}
              <div
                className={cn(
                  'relative flex size-7 shrink-0 items-center justify-center rounded-full text-xs font-bold transition-all',
                  isCompleted && !isActive && 'bg-emerald-500/20 text-emerald-400',
                  isActive && !isCompleted && 'bg-blue-500/25 text-blue-400 ring-2 ring-blue-500/30',
                  isActive && isCompleted && 'bg-emerald-500/25 text-emerald-400 ring-2 ring-emerald-500/30',
                  !isActive && !isCompleted && isPast && 'bg-muted text-muted-foreground',
                  !isActive && !isCompleted && !isPast && 'bg-muted/50 text-muted-foreground/60',
                )}
              >
                {isCompleted ? (
                  <Check className="size-3.5" strokeWidth={3} />
                ) : (
                  <span>{tab.step}</span>
                )}
                {isActive && !isCompleted && (
                  <span className="absolute inset-0 animate-ping rounded-full bg-blue-500/20" />
                )}
              </div>

              {/* Label and description */}
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-1.5">
                  <Icon className="size-3.5 shrink-0 opacity-70" />
                  <span className="truncate text-sm font-medium">{tab.jaLabel}</span>
                </div>
                <p
                  className={cn(
                    'mt-0.5 truncate text-[11px] leading-tight',
                    isActive ? 'text-muted-foreground' : 'text-muted-foreground/60',
                  )}
                >
                  {tab.description}
                </p>
              </div>
            </button>

            {/* Connector line between steps */}
            {index < HVAC_PHASE_TABS.length - 1 && (
              <div className="ml-[21px] h-1 w-px bg-border/40" />
            )}
          </div>
        )
      })}
    </div>
  )
}

// ─── Phase Guidance Banner ───────────────────────────────────────

export function PhaseGuidanceBanner() {
  const editorMode = useEditor((s) => s.editorMode)
  const phase = useEditor((s) => s.phase)
  const setPhase = useEditor((s) => s.setPhase)
  const completion = usePhaseCompletion()
  const summary = usePhaseSummary(phase as HvacPhase)

  if (editorMode !== 'hvac') return null

  const hvacPhase = phase as HvacPhase
  const guidance = PHASE_GUIDANCE[hvacPhase]
  const isCompleted = completion[hvacPhase]

  return (
    <AnimatePresence mode="wait">
      <motion.div
        animate={{ opacity: 1, height: 'auto' }}
        className="overflow-hidden rounded-lg border border-border/30 bg-accent/30"
        exit={{ opacity: 0, height: 0 }}
        initial={{ opacity: 0, height: 0 }}
        key={hvacPhase}
        transition={{ duration: 0.2 }}
      >
        <div className="px-3 py-2.5">
          {/* Instruction or completion message */}
          <p className="text-xs text-muted-foreground">
            {isCompleted && guidance.nextPhase
              ? '完了しました'
              : guidance.instruction}
          </p>

          {/* Summary stats */}
          {summary && (
            <p className="mt-1 text-[11px] font-medium text-foreground/70">
              {summary}
            </p>
          )}

          {/* Next step button */}
          {isCompleted && guidance.nextPhase && (
            <button
              className="mt-2 flex items-center gap-1 rounded-md bg-blue-500/15 px-2.5 py-1 text-xs font-medium text-blue-400 transition-colors hover:bg-blue-500/25"
              onClick={() => setPhase(guidance.nextPhase!)}
              type="button"
            >
              {guidance.nextLabel} →
            </button>
          )}
        </div>
      </motion.div>
    </AnimatePresence>
  )
}
