import {
  type HvacZoneNode,
  useRegistry,
  useScene,
  ZONE_DEFAULT_COLOR,
  ZONE_USAGE_COLORS,
} from '@pascal-app/core'
import { useFrame } from '@react-three/fiber'
import { useEffect, useMemo, useRef } from 'react'
import { Color, DoubleSide, ExtrudeGeometry, type Mesh, type MeshBasicMaterial, Shape } from 'three'
import { useNodeEvents } from '../../../hooks/use-node-events'
import { ZONE_LAYER } from '../../../lib/layers'

export { ZONE_DEFAULT_COLOR, ZONE_USAGE_COLORS }

const ZONE_OPACITY = 0.3

// 【アニメーション設定】: フェードイン所要時間 0.5秒
const FADE_DURATION = 0.5
const FADE_SPEED = 1 / FADE_DURATION // 2.0

/**
 * 【ヘルパー関数】: ease-out イージング関数
 * 【数式】: f(t) = 1 - (1-t)² — 開始は速く、終端に向かってゆっくり減速
 * 【REQ-1602】: フェードインアニメーションの自然な減速感を実現
 * 🟡 信頼性レベル: TASK-0018 テスト6に明示
 * @param t - 正規化された時間値（0.0〜1.0）
 * @returns イージング後の値（0.0〜1.0）
 */
export function easeOut(t: number): number {
  return 1 - (1 - t) ** 2
}

export function createZoneShape(boundary: [number, number][]): Shape {
  const shape = new Shape()
  if (boundary.length < 3) return shape
  // boundary is [x, y] tuples; shape is in X-Y plane, rotated to XZ plane in JSX
  shape.moveTo(boundary[0]![0]!, -boundary[0]![1]!)
  for (let i = 1; i < boundary.length; i++) {
    shape.lineTo(boundary[i]![0]!, -boundary[i]![1]!)
  }
  shape.closePath()
  return shape
}

export function getZoneColor(node: HvacZoneNode): string {
  if (!node.calcResult) return ZONE_DEFAULT_COLOR
  return ZONE_USAGE_COLORS[node.usage] ?? ZONE_DEFAULT_COLOR
}

interface HvacZoneRendererProps {
  nodeId: string
}

export function HvacZoneRenderer({ nodeId }: HvacZoneRendererProps) {
  const ref = useRef<Mesh>(null!)
  const materialRef = useRef<MeshBasicMaterial>(null!)
  const node = useScene((s) => s.nodes[nodeId as HvacZoneNode['id']]) as HvacZoneNode | undefined

  useRegistry(nodeId, 'hvac_zone', ref)
  const handlers = useNodeEvents(node!, 'hvac_zone')

  const geometry = useMemo(() => {
    if (!node?.boundary || node.boundary.length < 3) return null
    const shape = createZoneShape(node.boundary)
    return new ExtrudeGeometry(shape, { depth: node.ceilingHeight, bevelEnabled: false })
  }, [node?.boundary, node?.ceilingHeight])

  const targetColor = useMemo(() => {
    if (!node) return ZONE_DEFAULT_COLOR
    return getZoneColor(node)
  }, [node?.calcResult, node?.usage, node])

  // 【フェードイン制御】: calcResult が null → non-null に変化したときにアニメーションを起動
  // fadeProgress: 0.0 = 開始, 1.0 = 完了
  const fadeProgress = useRef(1) // 初期は1（既存のcalcResultに対してアニメーション不要）
  const prevCalcResultRef = useRef<boolean>(!!node?.calcResult)

  useEffect(() => {
    const hasCalcResult = !!node?.calcResult
    if (hasCalcResult && !prevCalcResultRef.current) {
      // 【フェードイン開始】: calcResult が新たに設定された → グレーから用途別カラーへフェード
      fadeProgress.current = 0
    } else if (!hasCalcResult && materialRef.current) {
      // 【calcResult クリア】: グレーに戻す
      materialRef.current.color.set(ZONE_DEFAULT_COLOR)
      fadeProgress.current = 1
    }
    prevCalcResultRef.current = hasCalcResult
  }, [node?.calcResult])

  // 【マテリアル初期色設定】: マウント時・targetColor変更時にマテリアル色を同期
  useEffect(() => {
    if (materialRef.current && fadeProgress.current >= 1) {
      materialRef.current.color.set(targetColor)
    }
  }, [targetColor])

  // 【アニメーション更新】: useFrame でフレームごとにカラーを補間
  // 【パフォーマンス】: fadeProgress >= 1 の場合はスキップ
  useFrame((_, delta) => {
    if (!materialRef.current || fadeProgress.current >= 1) return

    fadeProgress.current = Math.min(fadeProgress.current + delta * FADE_SPEED, 1)
    const easedProgress = easeOut(fadeProgress.current)

    const fromColor = new Color(ZONE_DEFAULT_COLOR)
    const toColor = new Color(targetColor)
    fromColor.lerp(toColor, easedProgress)

    materialRef.current.color.copy(fromColor)
  })

  if (!node || !geometry) return null

  return (
    <mesh
      ref={ref}
      layers={ZONE_LAYER}
      position={[0, node.floorHeight, 0]}
      rotation={[-Math.PI / 2, 0, 0]}
      {...handlers}
    >
      <primitive object={geometry} attach="geometry" />
      {/* 【カラー管理】: useEffect/useFrame が materialRef を通じて直接カラーを制御する */}
      <meshBasicMaterial
        ref={materialRef}
        color={targetColor}
        opacity={ZONE_OPACITY}
        side={DoubleSide}
        transparent
      />
    </mesh>
  )
}
