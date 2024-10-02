import { Composer, Scenes } from "telegraf";
import { sanitizeMarkdown } from "telegram-markdown-sanitizer";
import { db } from "../../drizzle/connection.js";
import { credentials, subscriptions } from "../../drizzle/schema.js";
import { eq, sql, SQL } from "drizzle-orm";

const chatIdComposer = new Composer();

chatIdComposer.hears(/^-\d+$/, async (ctx) => {
  const targetChatId = ctx.message.text;
  ctx.scene.state.targetChatId = targetChatId;

  const subscriptionEntries = await db
    .selectDistinct()
    .from(subscriptions)
    .where(eq(subscriptions.chatId, targetChatId));

  if (subscriptionEntries.length > 0) {
    await Promise.all([
      ctx.deleteMessage(),
      ctx.telegram.editMessageText(
        ctx.chat.id,
        ctx.scene.state.botMessageId,
        undefined,
        `⚠️ *В данный чат уже приходит рассылка о дедлайнах*

Вы можете попробовать ввести ID другого чата или вернуться в главное меню`,
        {
          reply_markup: {
            inline_keyboard: [[{ text: "Отменить", callback_data: "cancel" }]],
          },
          parse_mode: "MarkdownV2",
        },
      ),
    ]);
    return;
  }

  const [chatInfo, botChatMember] = await Promise.all([
    ctx.telegram.getChat(targetChatId).catch(() => null),
    ctx.telegram.getChatMember(targetChatId, ctx.botInfo.id).catch(() => null),
  ]);

  if (
    botChatMember === null ||
    (chatInfo.type === "channel" &&
      (botChatMember.status !== "administrator" ||
        botChatMember.can_post_messages === false))
  ) {
    await Promise.all([
      ctx.deleteMessage(),
      ctx.telegram.editMessageText(
        ctx.chat.id,
        ctx.scene.state.botMessageId,
        undefined,
        `⚠️ *Для корректной работы боты необходимо, чтобы бот был участником чата/канала и имел права администратора*

Вы можете попробовать ввести ID другого чата или вернуться в главное меню`,
        {
          reply_markup: {
            inline_keyboard: [[{ text: "Отменить", callback_data: "cancel" }]],
          },
          parse_mode: "MarkdownV2",
        },
      ),
    ]);
    return;
  }

  await Promise.all([
    ctx.deleteMessage(),
    ctx.telegram.editMessageText(
      ctx.chat.id,
      ctx.scene.state.botMessageId,
      undefined,
      `💬 *ID чата:* ${sanitizeMarkdown(targetChatId)}

⬇️ *Введите отображаемое имя для данного чата \\(Например: "беседа группы" \\)\\. Максимально допустимая длина названия \\- 32 символа\\.*`,
      {
        reply_markup: {
          inline_keyboard: [[{ text: "Отменить", callback_data: "cancel" }]],
        },
        parse_mode: "MarkdownV2",
      },
    ),
  ]);

  ctx.wizard.next();
});

chatIdComposer.action("use_this_chat", async (ctx) => {
  const targetChatId = ctx.chat.id.toString();
  ctx.scene.state.targetChatId = targetChatId;

  const subscriptionEntries = await db
    .selectDistinct()
    .from(subscriptions)
    .where(eq(subscriptions.chatId, targetChatId));

  if (subscriptionEntries.length > 0) {
    await ctx.telegram.editMessageText(
      ctx.chat.id,
      ctx.scene.state.botMessageId,
      undefined,
      `⚠️ *В данный чат уже приходит рассылка о дедлайнах*

Вы можете попробовать ввести ID другого чата или вернуться в главное меню`,
      {
        reply_markup: {
          inline_keyboard: [[{ text: "Отменить", callback_data: "cancel" }]],
        },
        parse_mode: "MarkdownV2",
      },
    );

    return;
  }

  await ctx.telegram.editMessageText(
    ctx.chat.id,
    ctx.scene.state.botMessageId,
    undefined,
    `💬 *ID чата:* ${sanitizeMarkdown(targetChatId)}

⬇️ *Введите отображаемое имя для данного чата \\(Например: "беседа группы" \\)\\. Максимально допустимая длина названия \\- 32 символа\\.*`,
    {
      reply_markup: {
        inline_keyboard: [[{ text: "Отменить", callback_data: "cancel" }]],
      },
      parse_mode: "MarkdownV2",
    },
  );

  ctx.wizard.next();
});

const displayNameComposer = new Composer();

displayNameComposer.hears(/^.{1,32}$/, async (ctx) => {
  const displayName = ctx.message.text;
  ctx.scene.state.displayName = displayName;

  await Promise.all([
    ctx.deleteMessage(),
    ctx.telegram.editMessageText(
      ctx.chat.id,
      ctx.scene.state.botMessageId,
      undefined,
      `💬 *ID чата:* ${sanitizeMarkdown(ctx.scene.state.targetChatId)}
📝 *Название чата*: ${sanitizeMarkdown(displayName)}

⬇️ *Подтвердите добавление чата*`,
      {
        reply_markup: {
          inline_keyboard: [
            [{ text: "Подтвердить", callback_data: "confirm_chat_addition" }],
            [{ text: "Отменить", callback_data: "cancel" }],
          ],
        },
        parse_mode: "MarkdownV2",
      },
    ),
  ]);

  ctx.wizard.next();
});

const confirmationComposer = new Composer();

confirmationComposer.action("confirm_chat_addition", async (ctx) => {
  const currentDate = new Date();

  let nextNotifyDate = new Date();
  nextNotifyDate.setHours(9, 0, 0);

  if (currentDate.getHours() >= 9) {
    nextNotifyDate = new Date(nextNotifyDate.getTime() + 24 * 60 * 60 * 1000);
  }

  const credentialsEntries = await db
    .selectDistinct({ id: credentials.id })
    .from(credentials)
    .where(eq(credentials.userId, ctx.from.id));

  await db.insert(subscriptions).values({
    displayName: ctx.scene.state.displayName,
    chatId: ctx.scene.state.targetChatId,
    nextNotifyAt: nextNotifyDate,
    credentialsId: credentialsEntries[0].id,
  });

  await Promise.all([
    ctx.editMessageText(
      `🥳 *Чат успешно добавлен, следующее уведомление о дедлайнах будет отправлено в ${sanitizeMarkdown(nextNotifyDate.toLocaleString("ru-ru", { year: "numeric", month: "numeric", day: "numeric", hour: "numeric", minute: "numeric" }))}*`,
      {
        reply_markup: {
          inline_keyboard: [
            [{ text: "Вернуться в главное меню", callback_data: "main_menu" }],
          ],
        },
        parse_mode: "MarkdownV2",
      },
    ),
    ctx.scene.leave(),
  ]);
});

export const addChatScene = new Scenes.WizardScene(
  "ADD_CHAT_SCENE",
  async (ctx) => {
    const messageInstance = await ctx.editMessageText(
      "⬇️ *Введите ID чата, куда будут присылаться уведомления о дедлайнах*",
      {
        reply_markup: {
          inline_keyboard: [
            [
              {
                text: "Узнать ID чата",
                url: "https://t.me/username_to_id_bot",
              },
            ],
            [
              {
                text: "Использовать этот чат",
                callback_data: "use_this_chat",
              },
            ],
            [{ text: "Отменить", callback_data: "cancel" }],
          ],
        },
        parse_mode: "MarkdownV2",
      },
    );

    ctx.scene.state.botMessageId = messageInstance.message_id;
    ctx.wizard.next();
  },
  chatIdComposer,
  displayNameComposer,
  confirmationComposer,
);
