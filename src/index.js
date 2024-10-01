import { Composer, session, Telegraf } from "telegraf";
import * as suai from "./suai/index.js";
import { stage } from "./scenes/index.js";
import { connectToDatabase, db } from "../drizzle/connection.js";
import { credentialsAddedOnlyMiddleware } from "./middlewares/credentials-added-only.js";
import { mainMenuKeyboard } from "./keyboards/main-menu.js";
import { greetingMessage } from "./messages/greeting.js";
import { credentials, subscriptions } from "../drizzle/schema.js";
import { eq } from "drizzle-orm";
import { sanitizeMarkdown } from "telegram-markdown-sanitizer";
import { registerReminderCron } from "./cron/reminder.js";
import { createServer } from "http";

const bot = new Telegraf(process.env.BOT_TOKEN);

const composer = new Composer();

composer.start(async (ctx) => {
  await ctx.replyWithMarkdownV2(greetingMessage, {
    reply_markup: {
      inline_keyboard: mainMenuKeyboard,
    },
  });
});

composer.command("feedback", async (ctx) => {
  await ctx.replyWithMarkdownV2(`💬 *Контакты для обратной связи*`, {
    reply_markup: {
      inline_keyboard: [[{ text: "👨🏻‍💻 Codev", url: "https://t.me/notcodev" }]],
    },
  });
});

composer.action("main_menu", async (ctx) => {
  await ctx.editMessageText(greetingMessage, {
    reply_markup: {
      inline_keyboard: mainMenuKeyboard,
    },
    parse_mode: "MarkdownV2",
  });
});

composer.action("add_credentials", (ctx) => {
  return ctx.scene.enter("ADD_CREDENTIALS_SCENE");
});

composer.action("delete_credentials", async (ctx) => {
  await db.delete(credentials).where(eq(credentials.id, ctx.from.id));

  await ctx.editMessageText(
    "✅ *Данные для входа в PRO.GUAP были успешно удалены*",
    {
      reply_markup: {
        inline_keyboard: [
          [
            {
              text: "Вернуться в главное меню",
              callback_data: "main_menu",
            },
          ],
        ],
      },
      parse_mode: "MarkdownV2",
    },
  );
});

composer.action("credentials", async (ctx) => {
  const credentialsEntry = await db
    .select()
    .from(credentials)
    .where(eq(credentials.userId, ctx.from.id))
    .then((entries) => entries.at(0));

  if (!credentialsEntry) {
    await ctx.editMessageText("😢 *Данные для входа отсутствуют*", {
      parse_mode: "MarkdownV2",
      reply_markup: {
        inline_keyboard: [
          [
            {
              text: "Добавить данные для входа",
              callback_data: "add_credentials",
            },
          ],
          [{ text: "Вернуться в главное меню", callback_data: "main_menu" }],
        ],
      },
    });
    return;
  }

  await ctx.editMessageText(
    `👤 *Имя пользователя:* ||${sanitizeMarkdown(credentialsEntry.suaiUsername)}||
🔑 *Пароль:* ||${sanitizeMarkdown(credentialsEntry.suaiPassword)}||`,
    {
      reply_markup: {
        inline_keyboard: [
          // [{ text: "Обновить данные", callback_data: "main_menu" }],
          [{ text: "Удалить данные", callback_data: "delete_credentials" }],
          [{ text: "Вернуться в главное меню", callback_data: "main_menu" }],
        ],
      },
      parse_mode: "MarkdownV2",
    },
  );
});

composer.use(credentialsAddedOnlyMiddleware);
composer.action("chats", async (ctx) => {
  const result = await db
    .select({
      id: subscriptions.id,
      displayName: subscriptions.displayName,
      chatId: subscriptions.chatId,
    })
    .from(subscriptions)
    .innerJoin(credentials, eq(credentials.id, subscriptions.credentialsId))
    .where(eq(credentials.userId, ctx.from.id));

  await ctx.editMessageText(
    `⬇️ *Выберите один из имеющихся чатов или добавьте новый*`,
    {
      reply_markup: {
        inline_keyboard: result
          .map((entry) => [
            {
              text: `${entry.displayName} – ${entry.chatId} ${ctx.chat.id.toString() === entry.chatId ? "(Этот чат)" : ""}`,
              callback_data: `open_chat:${entry.id}`,
            },
          ])
          .concat([
            [
              { text: "Добавить чат", callback_data: "add_chat" },
              { text: "Назад", callback_data: "main_menu" },
            ],
          ]),
      },
      parse_mode: "MarkdownV2",
    },
  );
});
composer.action(/^open_chat:(\d+)$/, async (ctx) => {
  const subscriptionEntry = await db
    .selectDistinct()
    .from(subscriptions)
    .where(eq(subscriptions.id, ctx.match[1]))
    .then((entries) => entries[0]);

  await ctx.editMessageText(
    `💬 *ID чата:* ${sanitizeMarkdown(subscriptionEntry.chatId)}
📝 *Название чата*: ${sanitizeMarkdown(subscriptionEntry.displayName)}

🔔 *Следующее уведомление о дедлайнах:* ${sanitizeMarkdown(subscriptionEntry.nextNotifyAt.toLocaleString("ru-ru", { year: "numeric", month: "numeric", day: "numeric", hour: "numeric", minute: "numeric" }))}`,
    {
      parse_mode: "MarkdownV2",
      reply_markup: {
        inline_keyboard: [
          [
            {
              text: "Удалить",
              callback_data: `delete_chat:${subscriptionEntry.id}`,
            },
          ],
          [
            {
              text: "Вернуться к списку чатов",
              callback_data: "chats",
            },
          ],
        ],
      },
    },
  );
});

composer.action(/^delete_chat:(\d+)$/, async (ctx) => {
  await db.delete(subscriptions).where(eq(subscriptions.id, ctx.match[1]));

  await ctx.editMessageText("✅ *Чат был успешно удален*", {
    reply_markup: {
      inline_keyboard: [
        [
          {
            text: "Вернуться к списку чатов",
            callback_data: "chats",
          },
        ],
      ],
    },
    parse_mode: "MarkdownV2",
  });
});

composer.action("add_chat", (ctx) => ctx.scene.enter("ADD_CHAT_SCENE"));

bot.use(session());
bot.use(stage.middleware());
bot.use(Composer.privateChat(composer));

registerReminderCron(bot);

bot.catch(async (err, ctx) => {
  console.error(err);
  await ctx.scene?.leave();
});

await connectToDatabase();

if (process.env.NODE_ENV === "development") {
  bot.launch(() => console.log("Bot successfully started"));
} else {
  const HOST = "0.0.0.0";
  const PORT = 8080;

  createServer(await bot.createWebhook({ domain: process.env.DOMAIN })).listen(
    PORT,
    HOST,
  );
  console.log(`Bot successfully started at http://${HOST}:${PORT}`);
}
