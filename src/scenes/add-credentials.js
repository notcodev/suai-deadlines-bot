import { Composer, Scenes } from "telegraf";
import { message } from "telegraf/filters";
import { sanitizeMarkdown } from "telegram-markdown-sanitizer";
import { db } from "../../drizzle/connection.js";
import { credentials } from "../../drizzle/schema.js";

const usernameComposer = new Composer();

usernameComposer.on(message("text"), async (ctx) => {
  const username = ctx.message.text;

  ctx.scene.state.username = username;

  await Promise.all([
    ctx.deleteMessage(),
    ctx.telegram.editMessageText(
      ctx.chat.id,
      ctx.scene.state.botMessageId,
      undefined,
      `👤 *Имя пользователя:* ||${sanitizeMarkdown(username)}||

⬇️ *Укажите пароль от личного кабинета PRO\\.GUAP*`,
      {
        parse_mode: "MarkdownV2",
        reply_markup: {
          inline_keyboard: [[{ text: "Отменить", callback_data: "cancel" }]],
        },
      },
    ),
  ]);

  ctx.wizard.next();
});

const passwordComposer = new Composer();

passwordComposer.on(message("text"), async (ctx) => {
  const password = ctx.message.text;

  ctx.scene.state.password = password;

  await Promise.all([
    ctx.deleteMessage(),
    ctx.telegram.editMessageText(
      ctx.chat.id,
      ctx.scene.state.botMessageId,
      undefined,
      `👤 *Имя пользователя:* ||${sanitizeMarkdown(ctx.scene.state.username)}||
🔑 *Пароль:* ||${sanitizeMarkdown(password)}||

⬇️ *Пожалуйста, проверьте корректность данных для входа и выберите действие*`,
      {
        parse_mode: "MarkdownV2",
        reply_markup: {
          inline_keyboard: [
            [{ text: "Данные введены верно", callback_data: "confirm" }],
            [{ text: "Отменить", callback_data: "cancel" }],
          ],
        },
      },
    ),
  ]);

  ctx.wizard.next();
});

const confirmComposer = new Composer();

confirmComposer.action("confirm", async (ctx) => {
  await db.insert(credentials).values({
    suaiUsername: ctx.scene.state.username,
    suaiPassword: ctx.scene.state.password,
    userId: ctx.from.id,
  });

  await Promise.all([
    ctx.editMessageText(`🥳 *Данные для входа успешно добавлены\\!*`, {
      reply_markup: {
        inline_keyboard: [
          [{ text: "Перейти к чатам", callback_data: "chats" }],
          [{ text: "Вернуться в главное меню", callback_data: "main_menu" }],
        ],
      },
      parse_mode: "MarkdownV2",
    }),
    ctx.scene.leave(),
  ]);
});

export const addCredentialsScene = new Scenes.WizardScene(
  "ADD_CREDENTIALS_SCENE",
  async (ctx) => {
    const messageInstance = await ctx.editMessageText(
      `⬇️ *Укажите имя пользователя от личного кабинета PRO\\.GUAP*`,
      {
        parse_mode: "MarkdownV2",
        reply_markup: {
          inline_keyboard: [[{ text: "Отменить", callback_data: "cancel" }]],
        },
      },
    );

    ctx.scene.state.botMessageId = messageInstance.message_id;
    ctx.wizard.next();
  },
  usernameComposer,
  passwordComposer,
  confirmComposer,
);
