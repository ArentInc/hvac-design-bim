'use client'

import type { HvacPhase } from '../../../../store/use-editor'
import useEditor from '../../../../store/use-editor'
import { EquipmentCatalogPanel } from '../../panels/hvac/equipment-catalog-panel'
import { SystemTreePanel } from '../../panels/hvac/system-tree-panel'
import { WarningListPanel } from './warning-list-panel'
import { ZoneListPanel } from './zone-list-panel'

function SidebarSection({
  children,
  dataTestId,
  withBorder = false,
}: {
  children: React.ReactNode
  dataTestId: string
  withBorder?: boolean
}) {
  return (
    <section
      className={withBorder ? 'border-border/50 border-t px-3 py-3' : 'px-3 py-3'}
      data-testid={dataTestId}
    >
      {children}
    </section>
  )
}

export function HvacSidebarContent() {
  const phase = useEditor((state) => state.phase) as HvacPhase

  return (
    <div className="flex h-full min-h-0 flex-col" data-testid="hvac-sidebar-content">
      <div className="subtle-scrollbar min-h-0 flex-1 overflow-y-auto overflow-x-hidden">
        {phase === 'zone' && (
          <SidebarSection dataTestId="hvac-sidebar-zone">
            <ZoneListPanel />
          </SidebarSection>
        )}

        {phase === 'equip' && (
          <>
            <SidebarSection dataTestId="hvac-sidebar-system-tree">
              <SystemTreePanel />
            </SidebarSection>
            <SidebarSection dataTestId="hvac-sidebar-equipment-catalog" withBorder>
              <EquipmentCatalogPanel />
            </SidebarSection>
          </>
        )}

        {phase === 'route' && (
          <SidebarSection dataTestId="hvac-sidebar-route">
            <SystemTreePanel />
          </SidebarSection>
        )}

        {phase === 'calc' && (
          <SidebarSection dataTestId="hvac-sidebar-calc">
            <WarningListPanel />
          </SidebarSection>
        )}
      </div>
    </div>
  )
}
