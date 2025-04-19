const { Telegraf } = require("telegraf");
const express = require("express");

const bot = new Telegraf(process.env.BOT_TOKEN);

bot.start((ctx) => {
  ctx.reply("Welcome! Tap the button below to open the mini app.", {
    reply_markup: {
      inline_keyboard: [
        [
          {
            text: "Open Mini App",
            web_app: {
              url: "https://ilifalk.github.io/BooksPlayer/"
            }
          }
        ]
      ]
    }
  });
});

// Express server to keep Render awake
const app = express();
app.use(bot.webhookCallback("/secret-path"));
app.get("/", (req, res) => res.send("Bot is running"));
app.listen(3000, () => console.log("Server running"));
