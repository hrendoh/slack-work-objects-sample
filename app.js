require("dotenv").config();
const { App } = require("@slack/bolt");

const app = new App({
  token: process.env.SLACK_BOT_TOKEN,
  signingSecret: process.env.SLACK_SIGNING_SECRET,
  socketMode: true,
  appToken: process.env.SLACK_APP_TOKEN,
});

// デバッグ: すべてのイベントをログ出力
app.event(/.+/, async ({ event }) => {
  console.log("Event received:", event.type, event);
});

// デバッグ: message イベントでも確認
app.event("message", async ({ event }) => {
  console.log("Message event received:", event);
});

app.event("link_shared", async ({ event, client }) => {
  try {
    console.log("Link shared event received:", event);

    const links = event.links;
    const entities = [];

    for (const link of links) {
      const url = link.url;

      if (url.includes("example.com/task/")) {
        const taskId = url.split("/").pop();

        const entity = {
          app_unfurl_url: url,
          url: url,
          external_ref: {
            id: taskId,
            type: "task",
          },
          entity_type: "slack#/entities/task",
          entity_payload: {
            attributes: {
              title: {
                text: `タスク #${taskId}`,
              },
              display_id: taskId,
              display_type: "Task",
              product_name: "サンプルタスクマネージャー",
            },
            fields: {
              status: {
                value: "open",
                label: "ステータス",
              },
              priority: {
                value: "Hot",
                label: "重要度",
              },
            },
            display_order: ["status"],
          },
        };

        entities.push(entity);
        console.log("Task entity added:", taskId);
      } else if (url.includes("example.com/file/")) {
        const fileId = url.split("/").pop();

        const entity = {
          app_unfurl_url: url,
          url: url,
          external_ref: {
            id: fileId,
            type: "document",
          },
          entity_type: "slack#/entities/file",
          entity_payload: {
            attributes: {
              title: {
                text: `ドキュメント ${fileId}`,
              },
              display_id: fileId,
              product_name: "サンプルドキュメント管理",
            },
            fields: {
              preview: {
                type: "slack#/types/image",
                alt_text: `ドキュメント ${fileId} プレビュー画像`,
                image_url: "https://media.connpass.com/thumbs/59/40/5940cfd8a5040dc8ce6c7d10ddd24ee9.png",
              },
              file_type: {
                value: "PDF",
                label: "ファイル形式",
              },
              owner: {
                type: "slack#/types/user",
                label: "所有者",
                user: {
                  user_id: event.user,
                },
              },
              size: {
                value: "2.5 MB",
                label: "サイズ",
              },
            },
            display_order: ["preview", "file_type", "owner", "size"],
          },
        };

        entities.push(entity);
        console.log("File entity added:", fileId);
      }
    }

    if (entities.length > 0) {
      const metadata = {
        entities: entities,
      };

      console.log(
        "Sending unfurl with metadata:",
        JSON.stringify(metadata, null, 2)
      );

      await client.chat.unfurl({
        channel: event.channel,
        ts: event.message_ts,
        metadata: metadata,
      });

      console.log(`Unfurl sent successfully for ${entities.length} entities`);
    }
  } catch (error) {
    console.error("Error handling link_shared event:", error);
    console.error("Error details:", JSON.stringify(error, null, 2));
    if (error.data) {
      console.error("Error data:", JSON.stringify(error.data, null, 2));
    }
  }
});

app.event("entity_details_requested", async ({ event, client }) => {
  try {
    console.log("Entity details requested:", JSON.stringify(event, null, 2));

    // イベントから直接情報を取得
    const externalRef = event.external_ref;
    const entityUrl = event.entity_url || event.app_unfurl_url;

    // URLからentity_typeを判定
    let entityType;
    if (entityUrl && entityUrl.includes('/task/')) {
      entityType = 'slack#/entities/task';
    } else if (entityUrl && entityUrl.includes('/file/')) {
      entityType = 'slack#/entities/file';
    } else {
      console.error('Unknown entity type from URL:', entityUrl);
      return;
    }

    let entityPayload;

    if (entityType === "slack#/entities/task") {
      const assigneeUser = event.user_id
        ? { user_id: event.user_id }
        : { text: "担当未設定" };
      const dueDateTimestamp =
        Math.floor(Date.now() / 1000) + 7 * 24 * 60 * 60;

      entityPayload = {
        attributes: {
          title: {
            text: `タスク #${externalRef.id} - 詳細ビュー`,
          },
          display_id: externalRef.id,
          product_name: "サンプルタスクマネージャー",
        },
        fields: {
          status: {
            value: "in_progress",
            label: "ステータス",
            tag_color: "yellow",
          },
          assignee: {
            type: "slack#/types/user",
            label: "担当者",
            user: assigneeUser,
          },
          priority: {
            value: "high",
            label: "優先度",
            tag_color: "red",
          },
          description: {
            value:
              "これはサンプルタスクの詳細な説明です。Flexpaneで表示されています。",
            label: "説明",
            edit: {
              enabled: true,
              text: {
                max_length: 500,
              },
            },
          },
          due_date: {
            type: "slack#/types/timestamp",
            label: "期日",
            value: dueDateTimestamp,
          },
        },
        custom_fields: [
          {
            key: "created_at",
            label: "作成日時",
            value: new Date().toLocaleString("ja-JP"),
            type: "string",
          },
          {
            key: "project",
            label: "プロジェクト",
            value: "サンプルプロジェクト",
            type: "string",
          },
        ],
        display_order: [
          "status",
          "priority",
          "assignee",
          "description",
          "due_date",
        ],
        actions: {
          primary_actions: [
            {
              action_id: "complete_task",
              text: "タスクを完了",
            },
          ],
          overflow_actions: [
            {
              action_id: "edit_task",
              text: "タスクを編集",
            },
            {
              action_id: "delete_task",
              text: "タスクを削除",
            },
          ],
        },
      };
    } else if (entityType === "slack#/entities/file") {
      entityPayload = {
        attributes: {
          title: {
            text: `ドキュメント ${externalRef.id} - 詳細ビュー`,
          },
          display_id: externalRef.id,
          product_name: "サンプルドキュメント管理",
        },
        fields: {
          preview: {
            type: "slack#/types/image",
            alt_text: `ドキュメント ${externalRef.id} プレビュー画像`,
            image_url: "https://media.connpass.com/thumbs/59/40/5940cfd8a5040dc8ce6c7d10ddd24ee9.png",
          },
          file_type: {
            value: "PDF",
            label: "ファイル形式",
          },
          owner: {
            type: "slack#/types/user",
            label: "所有者",
            user: {
              user_id: event.user_id,
            },
          },
          size: {
            value: "2.5 MB",
            label: "サイズ",
          },
          modified: {
            value: new Date().toLocaleString("ja-JP"),
            label: "最終更新",
          },
        },
        custom_fields: [
          {
            key: "version",
            label: "バージョン",
            value: "1.0",
            type: "string",
          },
        ],
        display_order: ["preview", "file_type", "owner", "size", "modified"],
        actions: {
          primary_actions: [
            {
              action_id: "download_file",
              text: "ダウンロード",
            },
          ],
          overflow_actions: [
            {
              action_id: "share_file",
              text: "共有",
            },
          ],
        },
      };
    }

    const payload = {
      trigger_id: event.trigger_id,
      metadata: {
        entity_type: entityType,
        entity_payload: entityPayload,
        url: entityUrl,
        external_ref: externalRef,
      },
    };

    console.log(
      "Presenting entity details with payload:",
      JSON.stringify(payload, null, 2)
    );

    // entity.presentDetailsを直接APIコールで呼び出す
    await client.entity.presentDetails(payload);

    console.log("Entity details presented successfully");
  } catch (error) {
    console.error("Error handling entity_details_requested event:", error);
    console.error("Error details:", JSON.stringify(error, null, 2));
    if (error.data) {
      console.error("Error data:", JSON.stringify(error.data, null, 2));
    }
  }
});

app.action("complete_task", async ({ ack, body, client }) => {
  await ack();

  try {
    console.log("Complete task action triggered");

    await client.chat.postMessage({
      channel: body.user.id,
      text: `タスクを完了しました！`,
    });
  } catch (error) {
    console.error("Error handling complete_task action:", error);
  }
});

app.action("edit_task", async ({ ack, body, client }) => {
  await ack();

  try {
    console.log("Edit task action triggered");

    await client.chat.postMessage({
      channel: body.user.id,
      text: `タスクの編集機能はここに実装します`,
    });
  } catch (error) {
    console.error("Error handling edit_task action:", error);
  }
});

app.action("delete_task", async ({ ack, body, client }) => {
  await ack();

  try {
    console.log("Delete task action triggered");

    await client.chat.postMessage({
      channel: body.user.id,
      text: `タスクの削除機能はここに実装します`,
    });
  } catch (error) {
    console.error("Error handling delete_task action:", error);
  }
});

app.action("download_file", async ({ ack, body, client }) => {
  await ack();

  try {
    console.log("Download file action triggered");

    await client.chat.postMessage({
      channel: body.user.id,
      text: `ファイルのダウンロード機能はここに実装します`,
    });
  } catch (error) {
    console.error("Error handling download_file action:", error);
  }
});

app.action("share_file", async ({ ack, body, client }) => {
  await ack();

  try {
    console.log("Share file action triggered");

    await client.chat.postMessage({
      channel: body.user.id,
      text: `ファイルの共有機能はここに実装します`,
    });
  } catch (error) {
    console.error("Error handling share_file action:", error);
  }
});

(async () => {
  await app.start();
  console.log("⚡️ Bolt app is running!");
})();
