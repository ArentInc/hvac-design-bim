'use client'

import { useCallback } from 'react'
import { useViewer } from '@pascal-app/viewer'
import { cn } from '../../../../lib/utils'
import { PanelWrapper } from '../panel-wrapper'

type ViewerSelectionLike = {
  selection?: {
    selectedIds?: string[]
  }
  selectedIds?: string[]
}

interface HvacPanelShellProps {
  title: string
  children: React.ReactNode
  width?: number | string
  onClose?: () => void
  dataTestId?: string
}

interface HvacPanelSectionProps {
  title: string
  children: React.ReactNode
  className?: string
}

interface HvacFieldProps {
  label: string
  value: React.ReactNode
  className?: string
}

interface HvacStackFieldProps {
  label: string
  children: React.ReactNode
  className?: string
}

export function getViewerSelectedIds(state: ViewerSelectionLike): string[] {
  return state.selection?.selectedIds ?? state.selectedIds ?? []
}

export function HvacPanelShell({
  title,
  children,
  width,
  onClose,
  dataTestId,
}: HvacPanelShellProps) {
  const setSelection = useViewer((state) => state.setSelection)

  const handleClose = useCallback(() => {
    setSelection?.({ selectedIds: [] })
    onClose?.()
  }, [onClose, setSelection])

  return (
    <PanelWrapper dataTestId={dataTestId} onClose={handleClose} title={title} width={width}>
      {children}
    </PanelWrapper>
  )
}

export function HvacPanelBody({ children }: { children: React.ReactNode }) {
  return <div className="flex flex-col gap-3 p-3">{children}</div>
}

export function HvacPanelSection({ title, children, className }: HvacPanelSectionProps) {
  return (
    <section className={cn('rounded-lg border border-border/40 bg-background/30', className)}>
      <div className="border-border/40 border-b px-3 py-2">
        <h3 className="font-medium text-foreground text-sm">{title}</h3>
      </div>
      <div className="flex flex-col gap-3 p-3">{children}</div>
    </section>
  )
}

export function HvacField({ label, value, className }: HvacFieldProps) {
  return (
    <div className={cn('grid grid-cols-[108px_minmax(0,1fr)] items-center gap-3', className)}>
      <span className="font-medium text-[11px] text-muted-foreground uppercase tracking-[0.03em]">
        {label}
      </span>
      <div className="min-w-0 text-foreground text-sm">{value}</div>
    </div>
  )
}

export function HvacStackField({ label, children, className }: HvacStackFieldProps) {
  return (
    <label className={cn('flex flex-col gap-1.5', className)}>
      <span className="font-medium text-[11px] text-muted-foreground uppercase tracking-[0.03em]">
        {label}
      </span>
      {children}
    </label>
  )
}

export function HvacInput({
  className,
  ...props
}: React.ComponentProps<'input'>) {
  return (
    <input
      className={cn(
        'h-9 w-full rounded-md border border-border/50 bg-background/70 px-3 text-foreground text-sm outline-hidden transition-colors focus:border-primary/60',
        className,
      )}
      {...props}
    />
  )
}

export function HvacSelect({
  className,
  ...props
}: React.ComponentProps<'select'>) {
  return (
    <select
      className={cn(
        'h-9 w-full rounded-md border border-border/50 bg-background/70 px-3 text-foreground text-sm outline-hidden transition-colors focus:border-primary/60',
        className,
      )}
      {...props}
    />
  )
}

export function HvacEmptyState({ children }: { children: React.ReactNode }) {
  return (
    <div className="rounded-md border border-dashed border-border/50 bg-background/20 px-3 py-2 text-muted-foreground text-sm">
      {children}
    </div>
  )
}
