/**
 * TASK-0038: useValidation — 警告配列 Zustand ストア
 *
 * 【機能概要】: ValidationSystemが生成したWarning配列を保持する軽量ストア
 * 【設計方針】: Coreパッケージ内のシンプルなZustandストア。Three.js依存なし
 * 【対応要件】: REQ-1201（警告配列の参照可能性）
 */

import { create } from 'zustand'
import type { Warning } from '../schema/hvac/warning'

type ValidationState = {
  warnings: Warning[]
  setWarnings: (warnings: Warning[]) => void
}

const useValidation = create<ValidationState>((set) => ({
  warnings: [],
  setWarnings: (warnings) => set({ warnings }),
}))

export default useValidation
