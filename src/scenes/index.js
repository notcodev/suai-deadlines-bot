import { Scenes } from "telegraf";
import { addCredentialsScene } from "./add-credentials.js";
import { greetingMessage } from "../messages/greeting.js";
import { mainMenuKeyboard } from "../keyboards/main-menu.js";
import { addChatScene } from "./add-chat.js";

export const stage = new Scenes.Stage([addCredentialsScene, addChatScene]);

stage.action("cancel", (ctx) =>
  Promise.all([
    ctx.scene.leave(),
    ctx.editMessageText(greetingMessage, {
      reply_markup: { inline_keyboard: mainMenuKeyboard },
      parse_mode: "MarkdownV2",
    }),
  ]),
);
