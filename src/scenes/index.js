import { Scenes } from "telegraf";
import { addCredentialsScene } from "./add-credentials.js";

export const stage = new Scenes.Stage([addCredentialsScene]);

stage.action("cancel", (ctx) =>
  Promise.all([ctx.scene.leave(), ctx.editMessageText("Отменено")]),
);
