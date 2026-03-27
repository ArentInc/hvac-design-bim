'use client'

/**
 * HVACフェーズ別ツールボタン — ActionMenu用
 *
 * zone: ゾーン描画
 * equip: AHU配置、制気口配置
 * route: ダクトルーティング、配管ルーティング
 * calc: 再計算実行
 */

import {
  aggregateSystemLoad,
  calcDuctSize,
  calculateZoneLoad,
  checkAirflowMismatch,
  checkAirflowNotSet,
  checkPipeNotConnected,
  checkPressureNotCalculated,
  checkSizeNotDetermined,
  checkUnconnectedPorts,
  checkVelocityExceeded,
  checkZoneNoSystem,
  distributeAirflow,
  findDirtyAirflowSystems,
  findDirtyDuctSegmentsForSizing,
  selectDuctVelocity,
  selectPipeSize,
  useScene,
  useValidation,
  type AnyNode,
} from '@pascal-app/core'
import {
  Calculator,
  CircleDot,
  Columns3,
  Fan,
  GitBranch,
  PenTool,
} from 'lucide-react'
import { cn } from '../../../lib/utils'
import useEditor, { type HvacTool } from '../../../store/use-editor'

type HvacToolConfig = {
  id: HvacTool
  icon: React.ReactNode
  label: string
  description: string
}

const ZONE_TOOLS: HvacToolConfig[] = [
  {
    id: 'zone_draw',
    icon: <PenTool className="size-5" />,
    label: 'ゾーン描画',
    description: 'フロアにゾーンを描画',
  },
]

const EQUIP_TOOLS: HvacToolConfig[] = [
  {
    id: 'ahu_place',
    icon: <Fan className="size-5" />,
    label: 'AHU配置',
    description: '空調機を配置',
  },
  {
    id: 'diffuser_place',
    icon: <CircleDot className="size-5" />,
    label: '制気口配置',
    description: '吹出口・吸込口を配置',
  },
]

const ROUTE_TOOLS: HvacToolConfig[] = [
  {
    id: 'duct_route',
    icon: <Columns3 className="size-5" />,
    label: 'ダクトルーティング',
    description: 'ダクト経路を作成',
  },
  {
    id: 'pipe_route',
    icon: <GitBranch className="size-5" />,
    label: '配管ルーティング',
    description: '冷温水配管を作成',
  },
]

function HvacToolButtons({ tools }: { tools: HvacToolConfig[] }) {
  const activeTool = useEditor((state) => state.tool)
  const setTool = useEditor((state) => state.setTool)

  return (
    <div className="flex items-center gap-2 px-1">
      {tools.map((tool) => {
        const isActive = activeTool === tool.id
        return (
          <button
            className={cn(
              'flex items-center gap-2.5 rounded-lg px-3 py-2 transition-all duration-200',
              isActive
                ? 'bg-white/10 text-foreground shadow-sm'
                : 'text-muted-foreground opacity-70 hover:bg-white/5 hover:text-foreground hover:opacity-100',
            )}
            key={tool.id}
            onClick={() => {
              if (!isActive) {
                setTool(tool.id)
                if (useEditor.getState().mode !== 'build') {
                  useEditor.getState().setMode('build')
                }
              }
            }}
            type="button"
          >
            <div
              className={cn(
                'flex size-8 shrink-0 items-center justify-center rounded-md',
                isActive ? 'bg-blue-500/20 text-blue-400' : 'bg-white/5',
              )}
            >
              {tool.icon}
            </div>
            <div className="text-left">
              <div className="text-xs font-medium leading-tight">{tool.label}</div>
              <div className="text-[10px] leading-tight text-muted-foreground/70">
                {tool.description}
              </div>
            </div>
          </button>
        )
      })}
    </div>
  )
}

/**
 * 再計算実行 — 全HVACパイプラインをカスケード実行
 */
function runFullRecalculation() {
  const { nodes, updateNode } = useScene.getState()
  const allNodes = nodes as Record<string, AnyNode>

  // 1. 全ゾーンの負荷再計算
  for (const node of Object.values(allNodes)) {
    if (node.type !== 'hvac_zone') continue
    const zone = node as any
    const result = calculateZoneLoad({
      floorArea: zone.floorArea,
      ceilingHeight: zone.ceilingHeight,
      usage: zone.usage,
      occupantDensity: zone.occupantDensity,
      designConditions: zone.designConditions,
      perimeterSegments: zone.perimeterSegments || [],
    })
    updateNode(zone.id, { calcResult: result } as any)
  }

  // 2. 全系統の再集計
  const updatedNodes = useScene.getState().nodes as Record<string, AnyNode>
  for (const node of Object.values(updatedNodes)) {
    if (node.type !== 'system') continue
    const sys = node as any
    const agg = aggregateSystemLoad(sys.servedZoneIds, updatedNodes)
    updateNode(sys.id, { aggregatedLoad: agg } as any)
  }

  // 3. 風量配分
  const nodesAfterAgg = useScene.getState().nodes as Record<string, AnyNode>
  const dirtySystems = findDirtyAirflowSystems(nodesAfterAgg)
  for (const systemId of dirtySystems) {
    distributeAirflow(systemId, nodesAfterAgg, (id, data) => updateNode(id, data as any))
  }

  // 4. ダクトサイジング
  const nodesAfterAirflow = useScene.getState().nodes as Record<string, AnyNode>
  const dirtyDucts = findDirtyDuctSegmentsForSizing(nodesAfterAirflow)
  for (const ductId of dirtyDucts) {
    const duct = nodesAfterAirflow[ductId] as any
    if (!duct || duct.type !== 'duct_segment' || !duct.airflowRate) continue
    const velocity = selectDuctVelocity(duct.airflowRate, nodesAfterAirflow, ductId)
    const size = calcDuctSize(duct.airflowRate, velocity)
    if (size) {
      updateNode(ductId, {
        width: size.widthMm,
        height: size.heightMm,
      } as any)
    }
  }

  // 5. 配管サイジング
  const nodesAfterDuct = useScene.getState().nodes as Record<string, AnyNode>
  for (const node of Object.values(nodesAfterDuct)) {
    if (node.type !== 'pipe_segment') continue
    const pipe = node as any
    // Find associated AHU cooling capacity for flow rate calculation
    const sys = Object.values(nodesAfterDuct).find(
      (n: any) => n.type === 'system' && n.id === pipe.systemId,
    ) as any
    if (!sys?.ahuId) continue
    const ahu = nodesAfterDuct[sys.ahuId] as any
    if (!ahu?.coolingCapacity) continue

    const result = selectPipeSize(ahu.coolingCapacity)
    if (result) {
      updateNode(pipe.id, {
        nominalSize: result.nominalSize,
        outerDiameter: result.outerDiameter,
        calcResult: {
          velocity: result.velocity,
          pressureDrop: result.pressureDrop,
        },
      } as any)
    }
  }

  // 6. バリデーション実行
  const finalNodes = useScene.getState().nodes as Record<string, AnyNode>
  const warnings = [
    ...checkUnconnectedPorts(finalNodes),
    ...checkAirflowNotSet(finalNodes),
    ...checkSizeNotDetermined(finalNodes),
    ...checkVelocityExceeded(finalNodes),
    ...checkPressureNotCalculated(finalNodes),
    ...checkZoneNoSystem(finalNodes),
    ...checkAirflowMismatch(finalNodes),
    ...checkPipeNotConnected(finalNodes),
  ]
  useValidation.getState().setWarnings(warnings)
}

export function HvacTools() {
  const phase = useEditor((state) => state.phase)
  const mode = useEditor((state) => state.mode)

  // calc フェーズは build モード不要で再計算ボタンを表示
  if (phase === 'calc') {
    return (
      <div className="flex items-center gap-2 px-1">
        <button
          className="flex items-center gap-2.5 rounded-lg px-3 py-2 text-muted-foreground opacity-80 transition-all hover:bg-white/5 hover:text-foreground hover:opacity-100"
          onClick={runFullRecalculation}
          type="button"
        >
          <div className="flex size-8 shrink-0 items-center justify-center rounded-md bg-white/5">
            <Calculator className="size-5" />
          </div>
          <div className="text-left">
            <div className="text-xs font-medium leading-tight">再計算</div>
            <div className="text-[10px] leading-tight text-muted-foreground/70">
              全系統の負荷計算と検証を実行
            </div>
          </div>
        </button>
      </div>
    )
  }

  // build モード以外はツールボタンを表示しない
  if (mode !== 'build') return null

  switch (phase) {
    case 'zone':
      return <HvacToolButtons tools={ZONE_TOOLS} />
    case 'equip':
      return <HvacToolButtons tools={EQUIP_TOOLS} />
    case 'route':
      return <HvacToolButtons tools={ROUTE_TOOLS} />
    default:
      return null
  }
}
