import cron from "node-cron";
import { db } from "../../drizzle/connection.js";
import { credentials, subscriptions } from "../../drizzle/schema.js";
import { eq, lt } from "drizzle-orm";
import * as suai from "../suai/index.js";
import assert from "node:assert";
import { sanitizeMarkdown } from "telegram-markdown-sanitizer";

export const sessionsStore = new Map();

export function registerReminderCron(bot) {
  cron.schedule(
    "*/5 * * * *",
    async () => {
      const subscriptionEntries = await db
        .select({
          id: subscriptions.id,
          chatId: subscriptions.chatId,
          nextNotifyAt: subscriptions.nextNotifyAt,
          suaiUsername: credentials.suaiUsername,
          suaiPassword: credentials.suaiPassword,
          userId: credentials.userId,
        })
        .from(subscriptions)
        .innerJoin(credentials, eq(credentials.id, subscriptions.credentialsId))
        .where(lt(subscriptions.nextNotifyAt, new Date()));

      async function fillSessionCookies({ userId, username, password }) {
        const storeEntry = sessionsStore.get(userId);

        if (!storeEntry || storeEntry.expiresAt < Date.now()) {
          const cookieString = await suai.login({
            username,
            password,
          });

          sessionsStore.set(userId, {
            cookieString,
            expiresAt: Date.now() + 12 * 60 * 60 * 1000,
          });
        }
      }

      async function getTasks({ sessionCookies, minTimestamp, maxTimestamp }) {
        const fetchedTasks = await suai.getTasks(sessionCookies);

        return fetchedTasks.filter(
          (entry) =>
            entry.deadlineTimestamp !== null &&
            entry.deadlineTimestamp >= minTimestamp &&
            entry.deadlineTimestamp <= maxTimestamp,
        );
      }

      async function sendInvalidCredentialsMessage(userId) {
        await bot.telegram.sendMessage(
          userId,
          "⚠️ *Уведомления не могут быть отправлены поскольку у вас указаны неверные имя пользователя или пароль*",
          {
            reply_markup: {
              inline_keyboard: [
                [
                  {
                    text: "Данные для входа в PRO.GUAP",
                    callback_data: "credentials",
                  },
                ],
              ],
            },
            parse_mode: "MarkdownV2",
          },
        );
      }

      const usersWithInvalidCredentials = new Set();

      const credentialsWithUserId = subscriptionEntries.reduce(
        (acc, value) => {
          if (!acc.addedUsers.has(value.userId)) {
            acc.result.push({
              username: value.suaiUsername,
              password: value.suaiPassword,
              userId: value.userId,
            });
            acc.addedUsers.add(value.userId);
          }
          return acc;
        },
        { addedUsers: new Set(), result: [] },
      ).result;

      await Promise.allSettled(
        credentialsWithUserId.map(async (data) => {
          try {
            await fillSessionCookies(data);
          } catch (error) {
            if (error instanceof InvalidCredentialsError) {
              usersWithInvalidCredentials.add(data.userId);
              await sendInvalidCredentialsMessage(data.userId);
              return;
            }
            console.error(error);
          }
        }),
      );

      await Promise.allSettled(
        subscriptionEntries.map(async (subscriptionEntry) => {
          try {
            if (usersWithInvalidCredentials.has(subscriptionEntry.userId)) {
              return;
            }

            await db
              .update(subscriptions)
              .set({
                nextNotifyAt: new Date(
                  subscriptionEntry.nextNotifyAt.getTime() +
                    24 * 60 * 60 * 1000,
                ),
              })
              .where(eq(subscriptions.id, subscriptionEntry.id));

            const sessionCookies = sessionsStore.get(
              subscriptionEntry.userId,
            )?.cookieString;

            assert(sessionCookies);

            const minTimestamp = Date.now();
            const maxTimestamp = Date.now() + 7 * 24 * 60 * 60 * 1000;

            const tasks = await getTasks({
              sessionCookies,
              minTimestamp,
              maxTimestamp,
            });

            await bot.telegram.sendMessage(
              subscriptionEntry.chatId,
              `📆 *Дедлайны \\(${sanitizeMarkdown(new Date(minTimestamp).toLocaleString("ru-ru", { day: "numeric", month: "numeric" }))} – ${sanitizeMarkdown(new Date(maxTimestamp).toLocaleString("ru-ru", { day: "numeric", month: "numeric" }))}\\)*

  ${tasks
    .map(
      (
        task,
      ) => `🕒 *${sanitizeMarkdown(new Date(task.deadlineTimestamp).toLocaleString("ru-ru", { day: "numeric", month: "numeric" }))} – ${sanitizeMarkdown(task.name)}*
  ${sanitizeMarkdown(task.discipline.name)} *\\([Открыть задание](${task.url})\\)*`,
    )
    .join("\n\n")}`,
              {
                parse_mode: "MarkdownV2",
              },
            );
          } catch (error) {
            console.error(error);
          }
        }),
      );
    },
    { runOnInit: true },
  );
}
