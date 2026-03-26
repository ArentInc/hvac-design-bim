/**
 * TASK-0042: PresetSelector — プリセット選択読込UI
 *
 * 【機能概要】: 5段階のHVAC設計プリセットをカード形式で表示し、
 *             選択するとシーンをプリセットデータで上書き復元する
 * 【設計方針】: editorパッケージ内コンポーネント。useSceneのsetSceneを使用
 * 【対応要件】: REQ-1701（5段階プリセット）, REQ-1702（プリセット読込UI）
 */

import { HVAC_PRESETS, type PresetData, useScene } from '@pascal-app/core'
import { useState } from 'react'
import { cn } from '../../lib/utils'

interface PresetMeta {
  stage: number
  label: string
  description: string
  data: PresetData
}

interface PresetSelectorProps {
  onClose?: () => void
}

export function PresetSelector({ onClose }: PresetSelectorProps) {
  const [loading, setLoading] = useState(false)
  const [confirm, setConfirm] = useState<PresetMeta | null>(null)

  const handleSelect = (preset: PresetMeta) => {
    setConfirm(preset)
  }

  const handleConfirm = () => {
    if (!confirm) return
    setLoading(true)

    try {
      const { nodes, rootNodeIds } = confirm.data
      useScene.getState().setScene(
        nodes as Parameters<ReturnType<typeof useScene.getState>['setScene']>[0],
        rootNodeIds as Parameters<ReturnType<typeof useScene.getState>['setScene']>[1],
      )
    } finally {
      setLoading(false)
      setConfirm(null)
      onClose?.()
    }
  }

  const handleCancel = () => {
    setConfirm(null)
  }

  return (
    <div className="flex flex-col gap-4 p-4">
      <div className="text-sm font-medium text-foreground">デモプリセットを選択</div>
      <p className="text-muted-foreground text-xs">
        選択したプリセットを読み込むと、現在のシーンは上書きされます。
      </p>

      <div className="grid grid-cols-1 gap-2">
        {HVAC_PRESETS.map((preset) => (
          <button
            className={cn(
              'flex cursor-pointer items-center gap-3 rounded-lg border border-border/50 bg-accent/20 px-3 py-2.5 text-left transition-all',
              'hover:border-primary/30 hover:bg-accent/40',
              confirm?.stage === preset.stage && 'border-primary/50 bg-primary/10',
            )}
            key={preset.stage}
            onClick={() => handleSelect(preset as PresetMeta)}
            type="button"
          >
            <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-primary/10 text-xs font-bold text-primary">
              {preset.stage}
            </div>
            <div className="flex flex-col gap-0.5">
              <span className="text-xs font-medium text-foreground">{preset.label}</span>
              <span className="text-muted-foreground text-xs">{preset.description}</span>
            </div>
          </button>
        ))}
      </div>

      {/* Confirmation dialog */}
      {confirm && (
        <div className="mt-2 rounded-lg border border-destructive/20 bg-destructive/5 p-3">
          <p className="mb-2 text-xs text-foreground">
            <span className="font-medium">「{confirm.description}」</span>
            を読み込みます。現在のシーンは失われます。
          </p>
          <div className="flex gap-2">
            <button
              className="flex-1 rounded-md bg-primary px-3 py-1.5 text-primary-foreground text-xs font-medium transition-colors hover:bg-primary/90 disabled:opacity-50"
              disabled={loading}
              onClick={handleConfirm}
              type="button"
            >
              {loading ? '読込中...' : '読み込む'}
            </button>
            <button
              className="rounded-md border border-border px-3 py-1.5 text-xs transition-colors hover:bg-accent"
              onClick={handleCancel}
              type="button"
            >
              キャンセル
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
