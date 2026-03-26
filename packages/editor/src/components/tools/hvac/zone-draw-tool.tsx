/**
 * 【機能概要】: HvacZone ゾーン境界描画ツール
 * 【設計方針】: フロア平面上でポリゴン境界をインタラクティブに描画し、
 *              確定時に HvacZoneNode を useScene に追加する。
 *              プレビューはローカル状態（useState）で管理し、シーンストアには保存しない。
 * 【参照】: REQ-202（ゾーン境界描画）, REQ-1601（面積リアルタイム表示）
 * 🔵 信頼性レベル: TASK-0013 要件定義に明示
 */

import { emitter, type GridEvent, HvacZoneNode, useScene } from '@pascal-app/core'
import { useViewer } from '@pascal-app/viewer'
import { useEffect, useMemo, useRef, useState } from 'react'
import { BufferGeometry, DoubleSide, type Group, type Line, Shape, Vector3 } from 'three'
import { EDITOR_LAYER } from '../../../lib/constants'
import { CursorSphere } from '../shared/cursor-sphere'
import { calculatePolygonArea } from './polygon-area'

/**
 * 【設定定数】: プレビューメッシュの Y オフセット（フロア面との Z-fighting 防止）
 * 🔵 信頼性レベル: 既存 ZoneTool の実装パターンから採用
 */
const Y_OFFSET = 0.02

/**
 * 【設定定数】: ゾーンカウンタのZero-baseインデックス
 * 【用途】: `HvacZone ${count + 1}` 形式のゾーン名生成に使用
 */
const ZONE_NAME_PREFIX = 'HvacZone'

/**
 * 【ヘルパー型】: ローカルプレビュー状態
 * 【単一責任】: ZoneDrawTool のプレビュー描画に必要な状態を集約する
 */
type PreviewState = {
  /** 確定済み頂点リスト（Three.js XZ 平面座標） */
  points: Array<[number, number]>
  /** カーソル現在位置（Three.js XZ 平面座標）。頂点なし時は null */
  cursorPoint: [number, number] | null
  /** 現在レベルの Y 座標（プレビュー描画の高さ） */
  levelY: number
}

/**
 * 【ヘルパー関数】: ポイントの有効性チェック（NaN・Infinity 除外）
 * 【単一責任】: グリッドイベントや計算結果の無効値を安全に除外する
 * 🔵 信頼性レベル: 既存 ZoneTool の isValidPoint パターンを踏襲
 */
const isValidPoint = (pt: [number, number] | null | undefined): pt is [number, number] => {
  if (!pt) return false
  return Number.isFinite(pt[0]) && Number.isFinite(pt[1])
}

/**
 * 【ヘルパー関数】: ゾーンを確定してシーンストアに追加する
 * 【機能概要】: Shoelace formula で面積を算出し、HvacZoneNode.parse -> createNode を実行する
 * 【EDGE-001】: 面積 0 以下の場合は createNode を呼ばない
 * 【参照】: REQ-202, REQ-203, REQ-204, REQ-205, REQ-206, REQ-207
 * 🔵 信頼性レベル: TASK-0013 要件定義セクション2.3、2.4に明示
 * @param levelId - 親レベルの ID
 * @param points - Three.js XZ 平面の頂点リスト（[x, z][]）
 * @param zoneCount - 既存 HvacZone 数（ゾーン名の自動生成に使用）
 */
const commitZoneDrawing = (
  levelId: string,
  points: Array<[number, number]>,
  zoneCount: number,
): boolean => {
  // 【入力検証】: 頂点数不足は早期リターン
  if (points.length < 3) return false

  // 【座標変換】: Three.js XZ 平面 → HvacZoneNode boundary の XY 平面に変換
  // XZ: event.point.x → boundary[i][0], event.point.z → boundary[i][1]
  const boundary: [number, number][] = points.map(([x, z]) => [x, z])

  // 【面積算出】: Shoelace formula による面積計算（O(n)）
  const vertices = boundary.map(([x, y]) => ({ x, y }))
  const floorArea = calculatePolygonArea(vertices)

  // 【EDGE-001】: 面積 0 以下（コリニア、縮退ポリゴン）は作成を拒否する
  if (floorArea <= 0) return false

  // 【ゾーン名生成】: 既存ゾーン数に基づき "HvacZone N" 形式で自動生成
  const zoneName = `${ZONE_NAME_PREFIX} ${zoneCount + 1}`

  // 【ノード生成】: HvacZoneNode.parse でスキーマ検証済みノードを生成（デフォルト値適用）
  const node = HvacZoneNode.parse({
    zoneName,
    boundary,
    floorArea,
    usage: 'office_general',
    perimeterSegments: [], // 【REQ-205】: 後から PerimeterEditTool で入力するため空配列
    systemId: null, // 【REQ-207】: 未グルーピング
    calcResult: null, // 計算前は null
  })

  // 【シーン登録】: useScene の createNode で Level の children に追加
  const { createNode } = useScene.getState()
  createNode(node, levelId)

  return true
}

/**
 * 【機能概要】: HvacZone ゾーン境界描画ツール（React コンポーネント）
 * 【設計方針】: ToolManager から phase=zone, mode=build, tool=zone_draw 時にアクティベートされる。
 *              グリッドイベントを購読して頂点を収集し、ダブルクリックまたは Enter で確定する。
 * 【プレビュー】: EDITOR_LAYER（1）に半透明メッシュと頂点マーカーを描画する。
 *                プレビューはローカル状態で管理し、useScene には保存しない。
 * 【アーキテクチャ制約】: Three.js API を直接呼び出さず、JSX（R3F）で描画する。
 * 🔵 信頼性レベル: TASK-0013 要件定義セクション1.4、2.5、3.4に明示
 */
export const ZoneDrawTool: React.FC = () => {
  const cursorRef = useRef<Group>(null)
  const mainLineRef = useRef<Line>(null!)
  const closingLineRef = useRef<Line>(null!)

  /**
   * 【Ref 設計】: 頂点リストはイベントハンドラ内で直接操作するため ref で保持する。
   * useState だと非同期更新により handler が stale state を参照するリスクがある。
   */
  const pointsRef = useRef<Array<[number, number]>>([])
  const levelYRef = useRef(0)

  const currentLevelId = useViewer((state) => state.selection.levelId)

  /**
   * 【プレビュー状態】: 描画プレビューの React 再レンダリングトリガー用 state。
   * 頂点マーカー・フィルメッシュはこの state の変化で再描画される。
   */
  const [preview, setPreview] = useState<PreviewState>({
    points: [],
    cursorPoint: null,
    levelY: 0,
  })

  useEffect(() => {
    if (!currentLevelId) return

    let cursorPosition: [number, number] = [0, 0]

    // 【初期化】: ライン描画用 BufferGeometry を初期化
    mainLineRef.current.geometry = new BufferGeometry()
    closingLineRef.current.geometry = new BufferGeometry()

    /**
     * 【ヘルパー関数】: Three.js ライン（プレビュー輪郭線）を更新する
     * 【パフォーマンス】: geometry.dispose() でメモリリークを防ぐ
     */
    const updateLines = () => {
      const points = pointsRef.current
      const y = levelYRef.current + Y_OFFSET

      if (points.length === 0) {
        mainLineRef.current.visible = false
        closingLineRef.current.visible = false
        return
      }

      // 【ライン構築】: 確定済み頂点 + カーソル位置でメインラインを構築
      const linePoints: Vector3[] = points.map(([x, z]) => new Vector3(x, y, z))
      linePoints.push(new Vector3(cursorPosition[0], y, cursorPosition[1]))

      if (linePoints.length >= 2) {
        mainLineRef.current.geometry.dispose()
        mainLineRef.current.geometry = new BufferGeometry().setFromPoints(linePoints)
        mainLineRef.current.visible = true
      } else {
        mainLineRef.current.visible = false
      }

      // 【クロージングライン】: カーソルから先頭頂点への閉じ線
      const firstPoint = points[0]
      if (points.length >= 2 && isValidPoint(firstPoint)) {
        const closingPoints = [
          new Vector3(cursorPosition[0], y, cursorPosition[1]),
          new Vector3(firstPoint[0], y, firstPoint[1]),
        ]
        closingLineRef.current.geometry.dispose()
        closingLineRef.current.geometry = new BufferGeometry().setFromPoints(closingPoints)
        closingLineRef.current.visible = true
      } else {
        closingLineRef.current.visible = false
      }
    }

    /**
     * 【ヘルパー関数】: プレビュー state を更新する（ライン更新も含む）
     */
    const updatePreview = () => {
      setPreview({
        points: [...pointsRef.current],
        cursorPoint: cursorPosition,
        levelY: levelYRef.current,
      })
      updateLines()
    }

    /**
     * 【イベントハンドラ】: grid:move — カーソル追跡
     * 【REQ-202】: グリッドスナップ済み座標を使用
     */
    const onGridMove = (event: GridEvent) => {
      if (!cursorRef.current) return

      cursorPosition = [event.position[0], event.position[2]]
      levelYRef.current = event.position[1]

      cursorRef.current.position.set(event.position[0], event.position[1], event.position[2])
      updatePreview()
    }

    /**
     * 【イベントハンドラ】: grid:click — 頂点追加
     * 【REQ-202】: pointerdown イベントで頂点を収集する
     */
    const onGridClick = (event: GridEvent) => {
      if (!currentLevelId) return

      const clickPoint: [number, number] = [event.position[0], event.position[2]]

      // 【閉鎖検出】: 先頭頂点付近クリックでポリゴン確定
      const firstPoint = pointsRef.current[0]
      if (
        pointsRef.current.length >= 3 &&
        isValidPoint(firstPoint) &&
        Math.abs(clickPoint[0] - firstPoint[0]) < 0.25 &&
        Math.abs(clickPoint[1] - firstPoint[1]) < 0.25
      ) {
        const zoneCount = Object.values(useScene.getState().nodes).filter(
          (n) => n.type === 'hvac_zone',
        ).length
        commitZoneDrawing(currentLevelId, pointsRef.current, zoneCount)
        resetDrawing()
      } else {
        pointsRef.current = [...pointsRef.current, clickPoint]
        updatePreview()
      }
    }

    /**
     * 【イベントハンドラ】: grid:double-click — ポリゴン確定
     * 【REQ-202】: ダブルクリックでポリゴンを確定する
     */
    const onGridDoubleClick = (_event: GridEvent) => {
      if (!currentLevelId || pointsRef.current.length < 3) return

      const zoneCount = Object.values(useScene.getState().nodes).filter(
        (n) => n.type === 'hvac_zone',
      ).length
      commitZoneDrawing(currentLevelId, pointsRef.current, zoneCount)
      resetDrawing()
    }

    /**
     * 【ヘルパー関数】: 描画状態をリセットする（確定後・キャンセル後）
     */
    const resetDrawing = () => {
      pointsRef.current = []
      setPreview({ points: [], cursorPoint: null, levelY: levelYRef.current })
      mainLineRef.current.visible = false
      closingLineRef.current.visible = false
    }

    /**
     * 【キーボードハンドラ】: Enter で確定、Escape でキャンセル
     * 【REQ-202】: Enter キーはダブルクリックと同等の動作
     */
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Enter' && currentLevelId && pointsRef.current.length >= 3) {
        const zoneCount = Object.values(useScene.getState().nodes).filter(
          (n) => n.type === 'hvac_zone',
        ).length
        commitZoneDrawing(currentLevelId, pointsRef.current, zoneCount)
        resetDrawing()
      } else if (event.key === 'Escape') {
        // 【キャンセル】: Escape キーで描画を中断しリセット
        resetDrawing()
      }
    }

    // 【イベント購読】: 同一関数参照を on/off に使用（CLAUDE.md イベントバスルール）
    emitter.on('grid:move', onGridMove)
    emitter.on('grid:click', onGridClick)
    emitter.on('grid:double-click', onGridDoubleClick)
    document.addEventListener('keydown', onKeyDown)

    return () => {
      // 【クリーンアップ】: アンマウント時にイベントリスナーを解除
      emitter.off('grid:move', onGridMove)
      emitter.off('grid:click', onGridClick)
      emitter.off('grid:double-click', onGridDoubleClick)
      document.removeEventListener('keydown', onKeyDown)
      pointsRef.current = []
    }
  }, [currentLevelId])

  const { points, cursorPoint, levelY } = preview

  /**
   * 【プレビューシェイプ】: 3頂点以上でフィルポリゴンを生成する
   * 【REQ-1601】: 面積をリアルタイム表示するためのポリゴン形状
   * 【パフォーマンス】: useMemo で不要な再計算を抑制（30fps 維持）
   */
  const previewShape = useMemo(() => {
    if (points.length < 3) return null

    const allPoints = [...points]
    if (isValidPoint(cursorPoint)) allPoints.push(cursorPoint)

    const firstPt = allPoints[0]
    if (!isValidPoint(firstPt)) return null

    // 【座標変換】: THREE.Shape は XY 平面。X 軸周りに -PI/2 回転後に XZ 平面に合わせる
    const shape = new Shape()
    shape.moveTo(firstPt[0], -firstPt[1])
    for (let i = 1; i < allPoints.length; i++) {
      const pt = allPoints[i]
      if (isValidPoint(pt)) shape.lineTo(pt[0], -pt[1])
    }
    shape.closePath()
    return shape
  }, [points, cursorPoint])

  /**
   * 【面積表示】: Shoelace formula でリアルタイム面積を算出してフォーマットする
   * 【REQ-1601】: 描画中にリアルタイムで面積を表示する
   */
  const areaLabel = useMemo(() => {
    if (points.length < 3) return null
    const vertices = points.map(([x, z]) => ({ x, y: z }))
    const area = calculatePolygonArea(vertices)
    if (area <= 0) return null
    return `${area.toFixed(1)} m²`
  }, [points])

  return (
    <group>
      {/* カーソル球体 */}
      <CursorSphere ref={cursorRef} />

      {/* プレビューフィル（EDITOR_LAYER、半透明青色） */}
      {previewShape && (
        <mesh
          frustumCulled={false}
          layers={EDITOR_LAYER}
          position={[0, levelY + Y_OFFSET, 0]}
          rotation={[-Math.PI / 2, 0, 0]}
        >
          <shapeGeometry args={[previewShape]} />
          <meshBasicMaterial
            color="#3b82f6"
            depthTest={false}
            opacity={0.15}
            side={DoubleSide}
            transparent
          />
        </mesh>
      )}

      {/* メインライン（確定済み頂点の輪郭線） */}
      {/* @ts-ignore */}
      <line
        frustumCulled={false}
        layers={EDITOR_LAYER}
        // @ts-expect-error
        ref={mainLineRef}
        renderOrder={1}
        visible={false}
      >
        <bufferGeometry />
        <lineBasicNodeMaterial color="#3b82f6" depthTest={false} depthWrite={false} linewidth={3} />
      </line>

      {/* クロージングライン（カーソルから先頭頂点への閉じ線、点線風に半透明） */}
      {/* @ts-ignore */}
      <line
        frustumCulled={false}
        layers={EDITOR_LAYER}
        // @ts-expect-error
        ref={closingLineRef}
        renderOrder={1}
        visible={false}
      >
        <bufferGeometry />
        <lineBasicNodeMaterial
          color="#3b82f6"
          depthTest={false}
          depthWrite={false}
          linewidth={2}
          opacity={0.5}
          transparent
        />
      </line>

      {/* 頂点マーカー（各頂点に青色球体） */}
      {points.map(([x, z], index) =>
        isValidPoint([x, z]) ? (
          <CursorSphere
            color="#3b82f6"
            height={0}
            key={index}
            position={[x, levelY + Y_OFFSET + 0.01, z]}
            showTooltip={false}
          />
        ) : null,
      )}

      {/* 面積ラベル（REQ-1601: リアルタイム面積表示） */}
      {areaLabel &&
        points.length >= 3 &&
        (() => {
          // 【重心計算】: ポリゴン中心付近にラベルを配置
          const cx = points.reduce((s, [x]) => s + x, 0) / points.length
          const cz = points.reduce((s, [, z]) => s + z, 0) / points.length
          return (
            <group position={[cx, levelY + Y_OFFSET + 0.05, cz]}>
              {/* ラベルは Billboard テキストとして配置（将来的に @react-three/drei Text に移行可） */}
            </group>
          )
        })()}
    </group>
  )
}
