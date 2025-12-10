# Slack Work Objects サンプルアプリケーション

このプロジェクトは、Slack Work Objectsの基本的な使い方を示すNode.jsサンプルアプリケーションです。

## Work Objectsとは

Work Objectsは、外部のエンティティ（ファイル、タスク、インシデントなど）をSlackの会話内で標準化して表示する機能です。リンクを共有すると自動的にリッチプレビュー（Unfurl）が表示され、クリックすると詳細パネル（Flexpane）が開きます。

## 機能

このサンプルアプリは以下の機能を実装しています：

- **タスクのWork Object**: `https://example.com/task/{id}` 形式のリンクに対応
- **ファイルのWork Object**: `https://example.com/file/{id}` 形式のリンクに対応
- **リンクUnfurl**: リンクを共有すると自動的にリッチプレビューを表示
- **Flexpane詳細ビュー**: Unfurlをクリックすると詳細情報をサイドパネルに表示
- **アクション**: タスク完了、編集、削除などのアクションボタン

## セットアップ

### 1. Slackアプリの作成と設定

1. [Slack API](https://api.slack.com/apps)にアクセスして新しいアプリを作成
2. **OAuth & Permissions**で以下のBot Token Scopesを追加：
   - `links:read`
   - `links:write`
   - `chat:write`
   - `users:read`

3. **Event Subscriptions**を有効にして、以下のイベントをSubscribe：
   - `link_shared`イベントを追加
     - イベント追加時に「Add Domain」で`example.com`を入力して追加
     - 追加後、`link_shared`の右側に「App Unfurl Domains: example.com」と表示されることを確認
   - `entity_details_requested`イベントを追加
   - **設定を保存後、必ずアプリを再インストール**してください

4. **Work Object Previews**を有効化：
   - 左サイドバーの「Work Object Previews」をクリック
   - 機能トグルを有効化
   - エンティティタイプを選択：
     - `slack#/entities/task`
     - `slack#/entities/file`
   - 設定を保存
   - **設定変更後、必ずアプリを再インストール**してください

5. **Socket Mode**を有効化：
   - Socket Modeを有効にする
   - App-Level Tokenを生成（Scope: `connections:write`）

6. **Install App**でワークスペースにインストール
   - 初回インストールの場合：「Install to Workspace」ボタンをクリック
   - 設定変更後の場合：「Reinstall to Workspace」ボタンをクリック
   - 権限を承認してインストール完了

### 2. プロジェクトのセットアップ

```bash
npm install
```

### 3. 環境変数の設定

`.env.example`を`.env`にコピーして、必要な値を設定：

```bash
cp .env.example .env
```

`.env`ファイルを編集：

```
SLACK_BOT_TOKEN=xoxb-your-bot-token-here
SLACK_SIGNING_SECRET=your-signing-secret-here
SLACK_APP_TOKEN=xapp-your-app-token-here
```

- `SLACK_BOT_TOKEN`: OAuth & Permissionsページの「Bot User OAuth Token」
- `SLACK_SIGNING_SECRET`: Basic Informationページの「Signing Secret」
- `SLACK_APP_TOKEN`: Basic InformationページのApp-Level Token

### 4. アプリの起動

```bash
npm start
```

開発モード（自動リロード）：

```bash
npm run dev
```

## 使い方

1. アプリを起動
2. Slackのチャンネルで以下のようなリンクを投稿：
   - `https://example.com/task/123`
   - `https://example.com/file/456`
3. Work Objectのリッチプレビューが表示されます
4. プレビューをクリックすると、右側にFlexpaneが開き詳細情報が表示されます
5. Flexpane内のアクションボタンをクリックして操作を実行できます

## 実装のポイント

### Link Unfurl

`link_shared`イベントをリッスンして、`chat.unfurl`メソッドで**`metadata`を直接渡す**形式でWork Objectを送信します。

**重要**: Work Objectsでは、従来の`unfurls`パラメータではなく、`metadata`パラメータを直接使用します。複数のリンクがある場合は、`metadata.entities`配列に複数のエンティティをまとめて、1回の`chat.unfurl`呼び出しで処理します。

```javascript
app.event('link_shared', async ({ event, client }) => {
  const links = event.links;
  const entities = [];  // 複数エンティティを格納する配列

  // 各リンクを処理してentitiesに追加
  for (const link of links) {
    const url = link.url;

    if (url.includes('example.com/task/')) {
      const taskId = url.split('/').pop();

      const entity = {
        app_unfurl_url: url,
        url: url,
        external_ref: {
          id: taskId,
          type: 'task'
        },
        entity_type: 'slack#/entities/task',
        entity_payload: {
          attributes: {
            title: { text: `タスク #${taskId}` },
            display_id: taskId,
            display_type: 'Task',
            product_name: 'サンプルタスクマネージャー'
          },
          fields: {
            status: {
              value: 'open',
              label: 'ステータス'
            }
          },
          display_order: ['status']
        }
      };

      entities.push(entity);
    }
  }

  // エンティティが存在する場合のみ、1回だけunfurl呼び出し
  if (entities.length > 0) {
    const metadata = {
      entities: entities  // 複数エンティティをまとめて送信
    };

    await client.chat.unfurl({
      channel: event.channel,
      ts: event.message_ts,
      metadata: metadata
    });
  }
});
```

### Flexpane詳細表示

`entity_details_requested`イベントをリッスンして、`entity.presentDetails`メソッドで詳細情報を表示します。

```javascript
app.event('entity_details_requested', async ({ event, client }) => {
  const entity = event.entity;
  const entityType = entity.entity_type;
  const externalRef = entity.external_ref;

  const entityPayload = {
    attributes: {
      title: { text: `タスク #${externalRef.id} - 詳細ビュー` },
      display_id: externalRef.id,
      product_name: 'サンプルタスクマネージャー',
      subtitle: 'このタスクはサンプルです'
    },
    fields: {
      status: {
        value: 'in_progress',
        label: 'ステータス',
        tag_color: 'yellow'
      },
      assignee: {
        type: 'slack#/types/user',
        label: '担当者',
        user: { user_id: event.user_id }
      }
    },
    display_order: ['status', 'assignee'],
    actions: {
      primary: [
        { name: 'complete_task', label: 'タスクを完了', type: 'button' }
      ],
      overflow: [
        { name: 'edit_task', label: 'タスクを編集', type: 'button' }
      ]
    }
  };

  await client.entity.presentDetails({
    trigger_id: event.trigger_id,
    metadata: {
      entity_type: entityType,
      entity_payload: entityPayload,
      url: entity.url,
      external_ref: externalRef
    }
  });
});
```

### entity_payloadの構造

Work Objectのペイロードは以下の主要なプロパティで構成されます：

#### attributes（必須）
エンティティの基本情報を定義します。

- `title`: エンティティのタイトル（必須）
- `display_id`: 表示用のID
- `display_type`: エンティティの種類（例: "Task", "Document"）
- `product_name`: アプリケーション名
- `subtitle`: サブタイトル

#### fields（オプション）
エンティティの詳細情報をフィールドとして定義します。

- 基本フィールド: `{ value, label, tag_color }`
- ユーザーフィールド: `{ type: 'slack#/types/user', label, user: { user_id } }`
- 日付フィールド: `{ type: 'slack#/types/date', label, date: { start_date } }`

#### display_order（オプション）
fieldsの表示順序を指定します。

#### actions（オプション）
アクションボタンを定義します。

- `primary`: 主要なアクションボタン（最大2個）
- `overflow`: オーバーフローメニュー内のアクションボタン

### エンティティタイプ

- `slack#/entities/task`: タスク、チケット、To-Doアイテム
- `slack#/entities/file`: ドキュメント、スプレッドシート、画像
- `slack#/entities/incident`: サービス障害、インシデント
- `slack#/entities/content_item`: 記事、ページ
- `slack#/entities/item`: 汎用エンティティ

## トラブルシューティング

### リンクを投稿してもWork Objectが表示されない

1. **Event Subscriptionsの設定を確認**
   - `link_shared`イベントに`example.com`ドメインが追加されているか確認
   - `link_shared`の右側に「App Unfurl Domains: example.com」と表示されているか確認

2. **アプリを再インストール**
   - Event SubscriptionsやWork Object Previewsの設定を変更した場合、必ずアプリを再インストールする必要があります
   - Slack API設定画面の「Install App」ページで「Reinstall to Workspace」をクリック

3. **アプリの起動を確認**
   - コンソールに「⚡️ Bolt app is running!」が表示されているか確認
   - コンソールに「Now connected to Slack」が表示されているか確認

4. **リンクの投稿方法を確認**
   - 新しいメッセージとして投稿（メッセージの編集ではNG）
   - パブリックチャンネルで試す
   - 完全なURL（`https://example.com/task/123`）を投稿

5. **コンソールログを確認**
   - リンクを投稿したときに「Link shared event received:」というログが表示されるか確認
   - エラーが表示されている場合は、エラーメッセージを確認

### `cannot_parse_attachment`エラーが出る

- Work Objectsでは、`chat.unfurl`に`metadata`パラメータを直接渡す必要があります
- 従来の`unfurls`パラメータは使用しません
- このREADMEの「実装のポイント」セクションのコード例を参照してください

## カスタマイズ

実際のアプリケーションでは、以下をカスタマイズしてください：

- 実際のデータソース（データベース、API）との連携
- 認証とアクセス制御
- アクションボタンの実装（編集、削除など）
- エラーハンドリング
- ログと監視

## 参考資料

- [Slack Work Objects 公式ドキュメント](https://docs.slack.dev/messaging/work-objects)
- [Slack Bolt for JavaScript](https://slack.dev/bolt-js/)
- [Slack API Methods](https://api.slack.com/methods)

## ライセンス

MIT
