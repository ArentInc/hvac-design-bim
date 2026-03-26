# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Pascal Editor forked for HVAC basic design BIM. Turborepo monorepo with three packages and one app, using Bun as the package manager.

## Commands

```bash
bun install                          # Install dependencies
bun dev                              # Build packages + start Next.js dev server (port 3002) with watch
bun run build                        # Build all packages (turbo)
bun run check                        # Biome check (format + lint + organize imports)
bun run check:fix                    # Auto-fix all Biome issues
bun run check-types                  # TypeScript type checking across all packages
bun run lint                         # Biome lint only
bun run format                       # Biome format (write)

# Filtered builds
npx turbo build --filter=@pascal-app/core
npx turbo build --filter=@pascal-app/viewer
```

There is **no test framework** configured in this project currently. No vitest, jest, or similar.

## Monorepo Architecture

```text
apps/editor/         → Next.js 16 app, composes all packages
packages/core/       → @pascal-app/core: schemas, state, systems, events (NO UI, NO rendering)
packages/viewer/     → @pascal-app/viewer: 3D canvas + renderers (editor-agnostic, reusable)
packages/editor/     → @pascal-app/editor: tools, sidebars, menus (workspace-only, not published)
packages/ui/         → @pascal-app/ui: shared UI primitives
```

**Dependency direction**: `apps/editor` → `@pascal-app/editor` → `@pascal-app/viewer` → `@pascal-app/core`

`bun dev` must be run from root. It builds core and viewer first, then watches all packages + starts Next.js.

## Three-Store Pattern

| Store | Package | Purpose |
| --- | --- | --- |
| `useScene` | core | Node CRUD, `dirtyNodes` set, undo/redo (Zundo 50-step). Persisted to IndexedDB. |
| `useViewer` | viewer | Selection path (`buildingId`/`levelId`/`zoneId`/`selectedIds`), camera mode, level display mode, theme |
| `useEditor` | editor | Phase (`site`/`structure`/`furnish`), mode (`select`/`edit`/`delete`/`build`), active tool |

Access outside React: `useScene.getState().nodes[id]`

## Flat Node Model

All nodes stored in `Record<id, AnyNode>`. Hierarchy via `parentId` and `children` arrays. Discriminated union on `type` field.

**Hierarchy**: Site → Building → Level → {Wall, Slab, Ceiling, Roof, Zone, Scan, Guide} → Wall can parent {Door, Window, Item}

**Node creation**: Always `NodeType.parse({...})` then `createNode(node, parentId)`. Never construct raw objects. IDs are auto-generated with type prefix (`wall_xxx`, `item_xxx`).

**Schemas**: Zod-based, all in `packages/core/src/schema/nodes/`. New types must be added to `AnyNode` union in `types.ts`.

## Dirty Node System

`useScene.dirtyNodes: Set<string>` tracks which nodes need geometry recomputation.

`createNode`/`updateNode`/`deleteNode` auto-mark nodes dirty → Systems detect in `useFrame` → recompute geometry → clear dirty flag.

## Systems vs Renderers

**Systems** = React components rendering `null`, running logic in `useFrame`:

- **Core systems** (`packages/core/src/systems/`): Pure geometry generation (WallSystem, SlabSystem, etc.). No Three.js rendering, no imports from viewer.
- **Viewer systems** (`packages/viewer/src/systems/`): Rendering side-effects via sceneRegistry (LevelSystem, ZoneSystem, InteractiveSystem).

**Renderers** (`packages/viewer/src/components/renderers/`): One per node type. Create placeholder meshes, register with `useRegistry()`, emit events via `useNodeEvents()`. Must NOT run geometry generation (that's Systems' job).

## Scene Registry

`sceneRegistry.nodes: Map<id, Object3D>` + `sceneRegistry.byType: { wall: Set<id>, ... }`

Every renderer calls `useRegistry(nodeId, nodeType, ref)` (synchronous via `useLayoutEffect`). Systems and selection managers are read-only consumers.

## Event Bus

Typed mitt emitter. Format: `<nodeType>:<suffix>` (e.g., `wall:click`, `item:enter`, `grid:pointerdown`).

Renderers emit only (via `useNodeEvents`), never listen. Grid events fire on empty-space interaction. Listeners must clean up with same function reference in `useEffect`.

## Viewer Isolation (Critical Rule)

`@pascal-app/viewer` must NEVER import from `apps/editor` or `@pascal-app/editor`. It must not reference `useEditor`, phase, mode, or any editor-specific concept.

Editor injects behavior via: props, callbacks (`onSelect`, `onExport`), and children passed to `<Viewer>`.

Test: "Does this make sense in a read-only viewer?" If no, it belongs in the editor package.

## Tools

React components in `packages/editor/src/components/tools/`. Capture user input → mutate `useScene`. Managed by `ToolManager` based on phase/mode/selection.

Tools must NOT: call Three.js APIs directly, import from `@pascal-app/viewer`, contain business logic. Preview geometry is local state in the tool component, not in the scene store.

## Three.js Layers

- `SCENE_LAYER = 0` — regular geometry
- `EDITOR_LAYER = 1` — editor-only helpers (grid, tool previews, snap guides)
- `ZONE_LAYER = 2` — zone floor fills (composited separately for transparency)

Use named constants, never hardcode layer numbers.

## Selection

Two separate SelectionManagers:

- **Viewer's**: Hierarchical navigation (Building → Level → Zone → Elements), viewer state only
- **Editor's**: Phase-aware, adds edit/delete/build modes

Selection path: `{buildingId, levelId, zoneId, selectedIds[]}`. Setting a parent resets children. Multi-select via Ctrl/Meta + click.

## Spatial Grid

`useSpatialQuery()` for placement validation: `canPlaceOnFloor()`, `canPlaceOnWall()`, `canPlaceOnCeiling()`. Always pass `[item.id]` in `ignoreIds` to exclude self. Use `adjustedY` from wall placement (snapped height), not raw cursor Y.

## Code Style

Biome (not ESLint/Prettier): 2-space indent, single quotes, no semicolons (except ASI hazards), trailing commas, 100-char line width. Organize imports automatically.

## Task Progress Tracking

When a HVAC-BIM task is completed, **always** update the following in order. This is mandatory — never skip.

1. **Individual task file** (`docs/tasks/hvac-bim-mvp/TASK-XXXX.md`):
   - Edit the title (line 1) to append `✅ **完了**`
   - Example: `# TASK-0031: AirflowDistributionSystem — 風量自動配分 ✅ **完了**`

2. **overview.md** (`docs/tasks/hvac-bim-mvp/overview.md`):
   - Change `- [ ]` to `- [x]` for the completed task entry in the phase task list.
   - If **all tasks in a phase** are `[x]`, update the phase line in `## 全体進捗` to `- [x]`.
   - Remove any `*(TASK-XXXX のみ未完了)*` notes once those tasks are done.

Do both updates immediately after confirming implementation exists — do not wait for the user to ask.

## HVAC Domain Context

This fork extends Pascal Editor for HVAC basic design workflows. MVP spec is in `.cursor/docs/hvac_bim_mvp.md`. Key additions planned:

- HVAC node schemas (zones, equipment, ducts, pipes)
- Load calculation system (with orientation-based envelope correction)
- Duct routing with auto airflow distribution and sizing
- Pipe routing with auto diameter selection
- HVAC property panels and warning system
