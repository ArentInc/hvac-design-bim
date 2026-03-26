# hvac-bim-mvp コンテキストノート

**生成日**: 2026-03-26
**要件名**: 空調設計BIMツール MVP（Kühl）

## 技術スタック

- **フレームワーク**: Next.js 16.2 + React 19.2
- **3Dレンダリング**: Three.js 0.183 + React Three Fiber 9 + Drei 10
- **状態管理**: Zustand 5 + Zundo 2（50ステップ undo/redo）
- **スキーマ**: Zod 4
- **CSS**: Tailwind CSS 4
- **UI**: Radix UI
- **パッケージマネージャー**: Bun 1.3
- **モノレポ**: Turborepo 2.8
- **リンター**: Biome 2.4
- **永続化**: IndexedDB（idb-keyval）— MVP期間
- **将来のバックエンド**: Supabase（PostgreSQL + Storage + Auth）— MVP後導入

## モノレポ構成

```
apps/editor/         → Next.js 16 app
packages/core/       → @pascal-app/core: スキーマ、状態管理、計算システム
packages/viewer/     → @pascal-app/viewer: 3Dキャンバス + レンダラー
packages/editor/     → @pascal-app/editor: ツール、サイドバー、メニュー
packages/ui/         → @pascal-app/ui: 共有UIプリミティブ
```

## 開発ルール

### アーキテクチャルール
- **依存方向**: apps/editor → @pascal-app/editor → @pascal-app/viewer → @pascal-app/core
- **Viewer隔離**: @pascal-app/viewer は apps/editor や @pascal-app/editor からインポートしてはならない
- **ノード作成**: 必ず `NodeType.parse({...})` → `createNode(node, parentId)` のパターン
- **IDプレフィックス**: `<type>_<16-char-nanoid>`（例: `hvac_zone_a1b2c3d4e5f6g7h8`）

### 3ストアパターン
| ストア | パッケージ | 目的 |
|---|---|---|
| useScene | core | ノードCRUD、dirtyNodes、undo/redo |
| useViewer | viewer | 選択パス、カメラ、テーマ |
| useEditor | editor | フェーズ、モード、アクティブツール |

### Dirty Node パターン
- createNode/updateNode/deleteNode → 自動的にdirtyマーク
- Systems が useFrame でdirtyノードを検出 → ジオメトリ再計算 → dirtyクリア

### レイヤ構成
- SCENE_LAYER = 0: 通常ジオメトリ
- EDITOR_LAYER = 1: エディタヘルパー
- ZONE_LAYER = 2: ゾーンフロアフィル

## 既存実装の状況

### 実装済み（建築要素）
- 14ノードタイプ: Site, Building, Level, Wall, Slab, Ceiling, Roof, RoofSegment, Item, Zone, Window, Door, Guide, Scan
- 各ノードに対応するシステム、レンダラー、ツール
- エディタフェーズ: site / structure / furnish
- イベントバス（mitt）、シーンレジストリ、空間グリッド

### 未実装（HVAC関連 — 全て新規）
- HVACノードスキーマ（HvacZone, System, AHU, Diffuser, DuctSegment, PipeSegment）
- HVAC計算システム（負荷計算、ダクトサイジング、圧損計算等）
- HVACレンダラー、ツール
- HVACフェーズ（zone/equip/route/calc）
- サンプルデータ（機器カタログ、標準サイズ表）

## ヒアリングで確定した方針

- **ZoneNodeとHvacZoneNode**: 完全分離（別ノードタイプ）
- **フェーズ共存**: 「建築モード」と「HVACモード」の2モード制
- **建築参照**: 既存シーン参照 + サンプルJSON読込の両方対応
- **永続化**: IndexedDBのみ（Supabase はMVP後）
- **スキーマバージョニング**: 後回し（MVP期間はスキーマ安定後に導入）
- **既存コードへの影響**: 許容（必要なリファクタリングはOK）

## 注意事項

- テストフレームワーク未導入（vitest/jest なし）
- PRD v2.4 が確定版
- 全4機能領域が Must Have（ゾーニング、系統構成、ダクト、配管）
- デモシナリオ（セクション21）もスコープに含む
