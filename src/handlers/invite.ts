import { Composer, type Context } from "grammy";
import { CB, inviteKeyboard } from "../bot/keyboards";
import { config } from "../config";
import { countReferrals, getUser } from "../db/users";
import { channelBotUsername } from "../services/channel";
import { referralLink, shareUrl } from "../services/referrals";

export const inviteHandler = new Composer();

async function showInvite(ctx: Context): Promise<void> {
  const userId = ctx.from!.id;
  const link = referralLink(channelBotUsername(ctx.me.username), userId);
  const { joined, active } = countReferrals(userId);
  const bonus = getUser(userId)?.bonus_questions ?? 0;

  await ctx.reply(
    [
      "🎁 <b>Invita a tus amigos</b>",
      "",
      `Comparte tu enlace. Tu amigo empieza con <b>${config.referralWelcomeBonus} preguntas extra</b> y, cuando responda sus primeras ${config.referralRequiredAnswers}, tú ganas <b>${config.referralBonus} preguntas extra</b>.`,
      "Las preguntas extra se usan cuando terminas las gratis del día y no caducan.",
      "",
      `🔗 Tu enlace: ${link}`,
      "",
      `👥 Amigos que han entrado: <b>${joined}</b> (practicando: ${active})`,
      `🎁 Tus preguntas extra: <b>${bonus}</b>`,
    ].join("\n"),
    { parse_mode: "HTML", reply_markup: inviteKeyboard(shareUrl(link)), link_preview_options: { is_disabled: true } }
  );
}

inviteHandler.callbackQuery(CB.invite, async (ctx) => {
  await ctx.answerCallbackQuery();
  await showInvite(ctx);
});

inviteHandler.command("invitar", (ctx) => showInvite(ctx));
