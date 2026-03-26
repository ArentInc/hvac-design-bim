# プロジェクト技術スタック定義

## 生成情報
- **生成日**: 2026-03-26
- **生成ツール**: init-tech-stack
- **プロジェクトタイプ**: Webアプリケーション（3D BIM エディタ）
- **チーム規模**: 個人開発（AI アシスト）
- **開発期間**: プロトタイプ/MVP（1-2ヶ月）

## プロジェクト要件サマリー
- **パフォーマンス**: 中負荷（100-300ノード、30fps+、再計算5秒以内）
- **セキュリティ**: 基本レベル（MVP は匿名認証、将来的にメール/SSO 追加）
- **技術スキル**: JavaScript/TypeScript, React, Three.js, データベース設計
- **学習コスト許容度**: 積極的に新技術
- **デプロイ先**: PaaS（Vercel + Supabase）
- **予算**: コスト最小化（Supabase 無料枠で MVP 期間をカバー）

## フロントエンド
- **フレームワーク**: Next.js 16.2
- **言語**: TypeScript 5.9
- **UI ライブラリ**: React 19.2
- **3D レンダリング**: Three.js 0.183 + React Three Fiber 9 + Drei 10
- **状態管理**: Zustand 5 + Zundo 2（50ステップ undo/redo）
- **スキーマバリデーション**: Zod 4
- **CSS**: Tailwind CSS 4 + tailwind-merge
- **UI コンポーネント**: Radix UI（Dialog, Select, Dropdown, Popover, Tooltip 等）
- **アイコン**: Lucide React + Iconify
- **アニメーション**: Motion 12
- **コマンドパレット**: cmdk 1
- **バンドラー**: Next.js 内蔵（Turbopack）

### 選択理由
- Pascal Editor の既存基盤を最大限活用し、フォーク元との差分を最小化
- Next.js 16 の App Router でルーティング・SSR・API Route を統合
- R3F 9 + Drei 10 で Three.js の React 統合が成熟しており、WebGPU 対応

## バックエンド
- **BaaS**: Supabase（PostgreSQL + Storage + Auth + Realtime）
- **認証**: Supabase Auth（MVP: 匿名認証、将来: メール/SSO）
- **ファイルストレージ**: Supabase Storage
- **リアルタイム**: Supabase Realtime（MVP では不使用、将来的な同時編集用）
- **Edge Functions**: MVP では不使用（将来的なサーバーサイド計算用）

### 選択理由
- BaaS により MVP の開発速度を最大化（バックエンド実装不要）
- PostgreSQL のフル機能（JSONB、RLS）をマネージドで利用可能
- 無料枠（500MB DB、1GB Storage）で MVP 期間のデータ量を十分カバー

## データベース設計
- **メインDB**: PostgreSQL 17+（Supabase マネージド）
- **ファイルストレージ**: Supabase Storage（建築参照モデル、プリセットデータ）
- **ローカルキャッシュ**: IndexedDB（idb-keyval）— エディタ操作のオフライン継続用

### テーブル構成（MVP 最小）

| テーブル | 用途 |
|---|---|
| `projects` | プロジェクトメタ情報（名前、作成日、更新日、スキーマバージョン） |
| `project_data` | ノード、接続、計算結果の JSONB 保存 |

### Storage バケット

| バケット | 用途 | アクセス |
|---|---|---|
| `architecture-refs` | 建築参照モデル | Private |
| `presets` | プリセット JSON（機器カタログ、サイズ表等） | Public Read |

### 設計方針
- プロジェクトデータは PostgreSQL の JSONB カラムに保存（柔軟なスキーマ変更に対応）
- スキーマバージョニング + migration runner で保存データの互換性を維持
- RLS（Row Level Security）でデータアクセスを制御
- JSON export/import も併用可能（ローカルバックアップ用）

## 開発環境
- **パッケージマネージャー**: Bun 1.3
- **モノレポ**: Turborepo 2.8
- **ランタイム**: Node.js >= 18（Bun 互換）

### モノレポ構成

```
apps/editor/         → Next.js 16 app（全パッケージを統合）
packages/core/       → @pascal-app/core: スキーマ、状態管理、計算システム、イベント（UI/レンダリングなし）
packages/viewer/     → @pascal-app/viewer: 3D キャンバス + レンダラー（エディタ非依存、再利用可能）
packages/editor/     → @pascal-app/editor: ツール、サイドバー、メニュー（ワークスペース専用）
packages/ui/         → @pascal-app/ui: 共有 UI プリミティブ
```

**依存方向**: `apps/editor` → `@pascal-app/editor` → `@pascal-app/viewer` → `@pascal-app/core`

### 開発ツール
- **リンター/フォーマッター**: Biome 2.4（ESLint/Prettier 不要、オールインワン）
  - 2スペースインデント、シングルクォート、セミコロンなし（ASI 危険箇所除く）、トレーリングカンマ、100文字幅
  - import 自動整理
- **型チェック**: TypeScript 5.9（tsc --noEmit）
- **テストフレームワーク**: 未導入（MVP 後に Vitest 2+ 導入予定）
- **E2E テスト**: 未導入（MVP 後に Playwright 導入予定）

### 主要コマンド

```bash
bun install                          # 依存関係インストール
bun dev                              # パッケージビルド + Next.js dev サーバー起動（ポート 3002）+ watch
bun run build                        # 全パッケージビルド（turbo）
bun run check                        # Biome チェック（format + lint + organize imports）
bun run check:fix                    # Biome 自動修正
bun run check-types                  # TypeScript 型チェック（全パッケージ）
```

### CI/CD
- **CI/CD**: Vercel Git Integration（GitHub 連携自動デプロイ）
- **コード品質**: Biome（lint + format）、TypeScript（型チェック）
- **プレビュー**: PR ごとに Vercel プレビュー URL 自動生成
- **本番デプロイ**: main ブランチマージで自動デプロイ

## インフラ・デプロイ

| 環境 | フロントエンド | バックエンド | 用途 |
|---|---|---|---|
| development | localhost:3002 | ローカル Supabase（supabase start） | 開発 |
| preview | PR プレビュー URL | Staging Supabase プロジェクト | レビュー・デモ |
| production | kuhl.vercel.app（仮） | Production Supabase プロジェクト | 本番・ユーザーテスト |

### MCP によるインフラ管理

| MCP サーバー | 用途 |
|---|---|
| Vercel MCP | プロジェクト作成、デプロイ、環境変数設定 |
| Supabase MCP | DB スキーマ管理、Storage バケット、RLS、Auth 設定 |

## セキュリティ
- **HTTPS**: 必須（Vercel 自動証明書）
- **認証**: Supabase Auth（MVP: 匿名認証）
- **RLS**: Supabase Row Level Security でデータアクセス制御
- **CORS**: Vercel + Supabase のデフォルト設定
- **環境変数**: Vercel Environment Variables で管理（Supabase URL / anon key）
- **依存関係**: Bun の lockfile でバージョン固定

## 品質基準
- **テストカバレッジ**: MVP では未設定（MVP 後に 80% 目標）
- **コード品質**: Biome 2.4（lint + format 統合）
- **型安全性**: TypeScript strict mode + Zod ランタイムバリデーション
- **パフォーマンス**: 30fps+（100-300ノード）、再計算5秒以内
- **ブラウザ**: Chrome 最新版（WebGPU 対応必須）

## 主要依存パッケージ一覧

### packages/core
| パッケージ | バージョン | 用途 |
|---|---|---|
| zustand | ^5 | 状態管理 |
| zundo | ^2.3 | Undo/Redo |
| zod | ^4.3 | スキーマバリデーション |
| mitt | ^3.0 | イベントバス |
| nanoid | ^5.1 | ID 生成 |
| idb-keyval | ^6.2 | IndexedDB 永続化 |
| three-bvh-csg | ^0.0.18 | CSG 演算 |
| three-mesh-bvh | ^0.9.8 | BVH 空間クエリ |

### packages/viewer
| パッケージ | バージョン | 用途 |
|---|---|---|
| polygon-clipping | ^0.15.7 | ポリゴン演算 |
| zustand | ^5 | ビューアー状態管理 |

### packages/editor
| パッケージ | バージョン | 用途 |
|---|---|---|
| @radix-ui/* | 各種 | UI コンポーネント |
| lucide-react | ^0.562 | アイコン |
| motion | ^12.34 | アニメーション |
| cmdk | ^1.1 | コマンドパレット |
| howler | ^2.2 | サウンド |
| class-variance-authority | ^0.7 | CSS バリアント管理 |

## セットアップ手順

### 1. 開発環境準備
```bash
# Bun のインストール（未インストールの場合）
curl -fsSL https://bun.sh/install | bash

# リポジトリクローン
git clone <repository-url>
cd hvac-design-bim

# 依存関係インストール
bun install

# Supabase CLI インストール（ローカル開発時）
npm install -g supabase

# Supabase ローカル環境起動
npx supabase start

# 環境変数設定
cp .env.example .env.local
# .env.local に Supabase URL / anon key を設定

# 開発サーバー起動
bun dev
# → http://localhost:3002
```

### 2. 主要コマンド
```bash
bun dev              # 開発サーバー起動（全パッケージ watch）
bun run build        # プロダクションビルド
bun run check        # Biome チェック
bun run check:fix    # Biome 自動修正
bun run check-types  # TypeScript 型チェック
```

## カスタマイズ方法

このファイルはプロジェクトの進行に応じて更新してください:

1. **技術の追加**: テストフレームワーク（Vitest）、E2E（Playwright）の導入時
2. **要件の変更**: パフォーマンス・セキュリティ要件の更新
3. **インフラの変更**: Supabase Pro プラン移行、カスタムドメイン設定
4. **認証強化**: 匿名認証からメール/SSO への移行時

## 更新履歴
- 2026-03-26: 初回生成 (init-tech-stack により自動生成)
