'use client'

import { type AnyNodeId, useScene, useValidation } from '@pascal-app/core'
import { useViewer } from '@pascal-app/viewer'
import useEditor from '../../../store/use-editor'
import { DuctPanel } from '../../sidebars/hvac/duct-panel'
import { PipePanel } from '../../sidebars/hvac/pipe-panel'
import { CeilingPanel } from './ceiling-panel'
import { DoorPanel } from './door-panel'
import { AhuPanel } from './hvac/ahu-panel'
import { CalcResultPanel } from './hvac/calc-result-panel'
import { DiffuserPanel } from './hvac/diffuser-panel'
import { EquipmentCatalogPanel } from './hvac/equipment-catalog-panel'
import { HvacPhaseWelcomePanel } from './hvac/phase-welcome-panel'
import { HvacZonePanel } from './hvac/hvac-zone-panel'
import { SystemPanel } from './hvac/system-panel'
import { ItemPanel } from './item-panel'
import { ReferencePanel } from './reference-panel'
import { RoofPanel } from './roof-panel'
import { RoofSegmentPanel } from './roof-segment-panel'
import { SlabPanel } from './slab-panel'
import { WallPanel } from './wall-panel'
import { WarningListPanel } from '../sidebar/panels/warning-list-panel'
import { WindowPanel } from './window-panel'

export function PanelManager() {
  const selectedIds = useViewer((s) => s.selection.selectedIds)
  const selectedReferenceId = useEditor((s) => s.selectedReferenceId)
  const editorMode = useEditor((s) => s.editorMode)
  const phase = useEditor((s) => s.phase)
  const nodes = useScene((s) => s.nodes)

  // Show reference panel if a reference is selected
  if (selectedReferenceId) {
    return <ReferencePanel />
  }

  // Show appropriate panel based on selected node type
  if (selectedIds.length === 1) {
    const selectedNode = selectedIds[0]
    const node = nodes[selectedNode as AnyNodeId]
    if (node) {
      switch (node.type) {
        case 'item':
          return <ItemPanel />
        case 'roof':
          return <RoofPanel />
        case 'roof-segment':
          return <RoofSegmentPanel />
        case 'slab':
          return <SlabPanel />
        case 'ceiling':
          return <CeilingPanel />
        case 'wall':
          return <WallPanel />
        case 'door':
          return <DoorPanel />
        case 'window':
          return <WindowPanel />
        case 'hvac_zone':
          return phase === 'calc' ? <CalcResultPanel /> : <HvacZonePanel />
        case 'system':
          return <SystemPanel nodeId={selectedNode} />
        case 'ahu':
          return <AhuPanel nodeId={selectedNode} />
        case 'diffuser':
          return <DiffuserPanel nodeId={selectedNode} />
        case 'duct_segment':
          return <DuctPanel />
        case 'pipe_segment':
          return <PipePanel />
      }
    }
  }

  // HVAC mode default panels when nothing is selected
  if (editorMode === 'hvac') {
    if (phase === 'equip') return <EquipmentCatalogPanel />
    if (phase === 'calc') return <WarningListPanel />
    return <HvacPhaseWelcomePanel phase={phase as any} />
  }

  return null
}
