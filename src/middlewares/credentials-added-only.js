import { eq } from "drizzle-orm";
import { db } from "../../drizzle/connection.js";
import { credentials } from "../../drizzle/schema.js";

export async function credentialsAddedOnlyMiddleware(ctx, next) {
  const data = await db
    .selectDistinct()
    .from(credentials)
    .where(eq(credentials.userId, ctx.from.id));

  if (!data[0]) {
    await ctx.editMessageText(
      `😢 *Отсутствуют данные для входа*

Для того, чтобы продолжить необходимо добавить данные для входа`,
      {
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
      },
    );
    return;
  }

  next();
}
