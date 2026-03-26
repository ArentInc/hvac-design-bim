'use client'

/**
 * TASK-0045: useToast — トースト通知フック
 *
 * 【機能概要】: toast({ message, type, duration }) でトースト表示・自動消去を管理するZustandストア
 * 【設計方針】: editorパッケージに配置。viewer/coreへの逆依存禁止。
 * 【対応要件】: REQ-1604（保存完了トースト通知）
 * 🔵 信頼性レベル: TASK-0045 REQ-1604に明示
 */

import { nanoid } from 'nanoid'
import { create } from 'zustand'

export type ToastType = 'success' | 'error' | 'info' | 'warning'

export interface Toast {
  id: string
  message: string
  type: ToastType
  duration: number
}

interface ToastState {
  toasts: Toast[]
  addToast: (opts: { message: string; type?: ToastType; duration?: number }) => string
  removeToast: (id: string) => void
}

const useToast = create<ToastState>((set) => ({
  toasts: [],

  addToast: ({ message, type = 'info', duration = 3000 }) => {
    const id = nanoid()
    set((s) => ({ toasts: [...s.toasts, { id, message, type, duration }] }))

    if (duration > 0) {
      setTimeout(() => {
        set((s) => ({ toasts: s.toasts.filter((t) => t.id !== id) }))
      }, duration)
    }

    return id
  },

  removeToast: (id) => {
    set((s) => ({ toasts: s.toasts.filter((t) => t.id !== id) }))
  },
}))

export default useToast

/** 利便性ラッパー: コンポーネント外から呼び出し可能 */
export const toast = (opts: { message: string; type?: ToastType; duration?: number }) =>
  useToast.getState().addToast(opts)

/** 保存完了トースト — REQ-1604 */
export const toastSaveComplete = () =>
  toast({ message: 'プロジェクトを保存しました', type: 'success', duration: 3000 })
