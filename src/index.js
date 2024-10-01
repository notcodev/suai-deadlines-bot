import { Composer, session, Telegraf } from "telegraf";
import * as suai from "./suai/index.js";
import { stage } from "./scenes/index.js";
import { connectToDatabase, db } from "../drizzle/connection.js";
import { credentialsAddedOnlyMiddleware } from "./middlewares/credentials-added-only.js";
import { mainMenuKeyboard } from "./keyboards/main-menu.js";
import { greetingMessage } from "./messages/greeting.js";
import { credentials, subscriptions } from "../drizzle/schema.js";
import { eq } from "drizzle-orm";

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
    `⬇️ *Выберите один из имеющихся чатом или добавьте новый*`,
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

composer.action("add_chat", (ctx) => ctx.scene.enter("ADD_CHAT_SCENE"));

bot.use(session());
bot.use(stage.middleware());
bot.use(Composer.privateChat(composer));

await connectToDatabase();
bot.launch(() => console.log("Bot successfully started"));
