'use client'

/**
 * TASK-0045: ToastProvider — トースト通知コンポーネント
 *
 * 【機能概要】: useToastストアに登録されたトーストを画面右下に表示する
 * 【設計方針】:
 *   - 複数トーストのスタック表示対応
 *   - aria-live="polite" でスクリーンリーダー対応
 *   - prefers-reduced-motion 対応（アニメーション省略）
 * 【対応要件】: REQ-1604（保存完了トースト通知）
 * 🔵 信頼性レベル: TASK-0045 REQ-1604に明示
 */

import useToast, { type ToastType } from './use-toast'

const TYPE_STYLES: Record<ToastType, string> = {
  success: 'bg-green-600 text-white',
  error: 'bg-red-600 text-white',
  warning: 'bg-yellow-500 text-black',
  info: 'bg-blue-600 text-white',
}

export function ToastProvider() {
  const { toasts, removeToast } = useToast()

  if (toasts.length === 0) return null

  return (
    <div
      aria-live="polite"
      aria-label="通知"
      className="fixed bottom-4 right-4 z-50 flex flex-col gap-2"
    >
      {toasts.map((t) => (
        <div
          key={t.id}
          role="alert"
          className={`flex items-center gap-2 rounded px-4 py-2 shadow-lg text-sm ${TYPE_STYLES[t.type]}`}
        >
          <span>{t.message}</span>
          <button
            aria-label="閉じる"
            className="ml-2 opacity-70 hover:opacity-100"
            onClick={() => removeToast(t.id)}
            type="button"
          >
            ×
          </button>
        </div>
      ))}
    </div>
  )
}
