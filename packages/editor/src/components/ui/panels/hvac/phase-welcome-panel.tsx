'use client'

import {
  Calculator,
  CircleDot,
  Columns3,
  Fan,
  GitBranch,
  PenTool,
  SquareDashedBottom,
} from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import type { HvacPhase } from '../../../../store/use-editor'
import useEditor from '../../../../store/use-editor'

type PhaseWelcomeConfig = {
  title: string
  description: string
  icon: LucideIcon
  actions: {
    label: string
    icon: LucideIcon
    tool: string
  }[]
}

const WELCOME_CONFIG: Partial<Record<HvacPhase, PhaseWelcomeConfig>> = {
  zone: {
    title: 'ゾーン設定を始めましょう',
    description:
      '空調ゾーンを定義して、各ゾーンの用途・設計条件を設定します。ゾーンを描画すると負荷計算が自動的に行われます。',
    icon: SquareDashedBottom,
    actions: [
      { label: 'ゾーンを描画', icon: PenTool, tool: 'zone_draw' },
    ],
  },
  route: {
    title: '配管ルートを作成しましょう',
    description:
      'AHUのポートからダクトや配管を接続します。ポートをクリックしてルーティングを開始してください。',
    icon: GitBranch,
    actions: [
      { label: 'ダクトを作成', icon: Columns3, tool: 'duct_route' },
      { label: '配管を作成', icon: GitBranch, tool: 'pipe_route' },
    ],
  },
}

export function HvacPhaseWelcomePanel({ phase }: { phase: HvacPhase }) {
  const config = WELCOME_CONFIG[phase]
  if (!config) return null

  const Icon = config.icon

  return (
    <div className="fixed top-4 right-4 z-30 w-72 rounded-xl border border-border/50 bg-background/95 p-4 shadow-lg backdrop-blur-md">
      <div className="flex items-start gap-3">
        <div className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-blue-500/10 text-blue-400">
          <Icon className="size-5" />
        </div>
        <div className="min-w-0 flex-1">
          <h3 className="text-sm font-semibold text-foreground">{config.title}</h3>
          <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
            {config.description}
          </p>
        </div>
      </div>

      <div className="mt-3 flex flex-col gap-1.5">
        {config.actions.map((action) => {
          const ActionIcon = action.icon
          return (
            <button
              className="flex items-center gap-2 rounded-lg bg-accent/50 px-3 py-2 text-xs font-medium text-foreground transition-colors hover:bg-accent"
              key={action.tool}
              onClick={() => {
                useEditor.getState().setTool(action.tool as any)
                if (useEditor.getState().mode !== 'build') {
                  useEditor.getState().setMode('build')
                }
              }}
              type="button"
            >
              <ActionIcon className="size-4 text-blue-400" />
              {action.label}
            </button>
          )
        })}
      </div>
    </div>
  )
}
