/**
 * TASK-0040: WarningListPanel — 警告一覧 + ノード選択ズーム
 *
 * 【機能概要】: ValidationSystemが生成した全警告をseverity別にソートして表示し、
 *              各警告行クリックで該当ノードを選択する
 * 【設計方針】: editorパッケージ内コンポーネント。useValidation/useScene/useViewerを参照可能
 * 【対応要件】: REQ-1202（警告一覧）, REQ-1203（ノード選択ズーム）, REQ-1404（左パネル警告タブ）
 */

import { useScene, useValidation, type Warning, type WarningSeverity } from '@pascal-app/core'
import { useViewer } from '@pascal-app/viewer'
import { useState } from 'react'
import { cn } from '../../../../lib/utils'

const SEVERITY_ORDER: Record<WarningSeverity, number> = {
  error: 0,
  warning: 1,
  info: 2,
}

function SeverityIcon({ severity }: { severity: WarningSeverity }) {
  if (severity === 'error') {
    return (
      <span className="flex h-4 w-4 shrink-0 items-center justify-center rounded-full bg-red-500 text-[10px] text-white font-bold">
        !
      </span>
    )
  }
  if (severity === 'warning') {
    return <span className="shrink-0 text-yellow-500 text-sm leading-none">▲</span>
  }
  return <span className="shrink-0 text-blue-400 text-sm leading-none font-bold">i</span>
}

function WarningRow({
  warning,
  nodeName,
  onClick,
}: {
  warning: Warning
  nodeName: string
  onClick: () => void
}) {
  return (
    <div
      className={cn(
        'group/row mx-1 mb-0.5 flex cursor-pointer select-none items-center gap-2 rounded-lg border border-transparent px-2 py-1.5 text-xs transition-all duration-200',
        'hover:border-neutral-200/50 hover:bg-white/40 dark:hover:border-border/40 dark:hover:bg-accent/30',
      )}
      onClick={onClick}
    >
      <SeverityIcon severity={warning.severity} />
      <span className="shrink-0 font-medium text-foreground">{nodeName}</span>
      <span className="flex-1 truncate text-muted-foreground">{warning.message}</span>
    </div>
  )
}

export function WarningListPanel() {
  const warnings = useValidation((state) => state.warnings)
  const nodes = useScene((state) => state.nodes)
  const setSelection = useViewer((state) => state.setSelection)
  const [severityFilter, setSeverityFilter] = useState<WarningSeverity | null>(null)

  const getNodeName = (nodeId: string, nodeType: string): string => {
    const node = nodes[nodeId]
    if (node && 'name' in node && typeof node.name === 'string' && node.name) {
      return node.name
    }
    return `${nodeType}_${nodeId.slice(-4)}`
  }

  const handleClick = (warning: Warning) => {
    setSelection({ selectedIds: [warning.nodeId] })
  }

  const handleFilterToggle = (severity: WarningSeverity) => {
    setSeverityFilter((prev) => (prev === severity ? null : severity))
  }

  if (warnings.length === 0) {
    return (
      <div className="px-3 py-4 text-muted-foreground text-sm">警告なし</div>
    )
  }

  const sortedWarnings = [...warnings].sort(
    (a, b) => SEVERITY_ORDER[a.severity] - SEVERITY_ORDER[b.severity],
  )

  const displayedWarnings = severityFilter
    ? sortedWarnings.filter((w) => w.severity === severityFilter)
    : sortedWarnings

  const errorCount = warnings.filter((w) => w.severity === 'error').length
  const warningCount = warnings.filter((w) => w.severity === 'warning').length

  return (
    <div className="py-1">
      {/* Summary + filter header */}
      <div className="flex items-center gap-2 px-3 pb-1.5 pt-1">
        <button
          aria-label="filter-error"
          className={cn(
            'flex items-center gap-1 rounded px-1.5 py-0.5 text-xs transition-colors',
            severityFilter === 'error'
              ? 'bg-red-500/20 text-red-500'
              : 'text-red-500/70 hover:bg-red-500/10',
          )}
          onClick={() => handleFilterToggle('error')}
          type="button"
        >
          エラー: {errorCount}
        </button>
        <button
          aria-label="filter-warning"
          className={cn(
            'flex items-center gap-1 rounded px-1.5 py-0.5 text-xs transition-colors',
            severityFilter === 'warning'
              ? 'bg-yellow-500/20 text-yellow-500'
              : 'text-yellow-500/70 hover:bg-yellow-500/10',
          )}
          onClick={() => handleFilterToggle('warning')}
          type="button"
        >
          警告: {warningCount}
        </button>
      </div>

      {displayedWarnings.map((warning) => (
        <WarningRow
          key={warning.id}
          nodeName={getNodeName(warning.nodeId, warning.nodeType)}
          onClick={() => handleClick(warning)}
          warning={warning}
        />
      ))}
    </div>
  )
}
