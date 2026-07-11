const Discord = require('discord.js');
const axios = require('axios');
const db = require('../../utils/simpledb');
const { checkOsintPermission } = require('../../utils/osintHelpers');
const EMOJIS = require('../../utils/emojis');
const { EMOJIS: EMB } = require('../../utils/embedBuilder');
const { container, txt, sep, FLAGS } = require('../../utils/v2');

const COST = 5;
const TIMEOUT = 12000;

function isEmail(str) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test((str || '').trim());
}

module.exports = {
  name: 'emailinfo',
  aliases: ['email', 'emailcheck', 'verifyemail'],
  description: 'Informations complètes sur un email (fuites, validation, réputation)',
  category: 'osint',
  run: async (client, message, args, prefix, color) => {
    if (!checkOsintPermission(client, message)) return;

    const guild = message.guild;
    const level = db.get(`guild_${guild?.id}_level_${message.author.id}`) || 1;
    const baseCredits = db.get(`user_credits_${message.author.id}`) || 0;
    const dailyCredits = db.get(`daily_credits_${message.author.id}`) || 0;
    const totalCredits = baseCredits + dailyCredits + level * 2;
    if (totalCredits < COST) {
      return message.channel.send({
        components: [container(
          txt('## ❌ Crédits insuffisants'),
          sep(),
          txt(`**Coût :** ${COST} crédits\n**Vos crédits :** ${totalCredits}`)
        )],
        flags: FLAGS
      });
    }

    const email = (args[0] || '').trim();
    if (!email || !isEmail(email)) {
      return message.reply(`**Utilisation :** \`${prefix}emailinfo <adresse@email.com>\``);
    }

    db.subtract(`user_credits_${message.author.id}`, COST);

    const loading = await message.channel.send(`${EMB.cloche} **Analyse de l'email en cours…**`);

    let out = `**Email :** \`${email}\`\n\n`;

    try {
      const lookupSources = require('../../utils/lookupSources');
      const breach = await lookupSources.runAllLookups(email, 'email');
      (breach.sections || []).forEach((s) => {
        out += `**${s.name}**\n${(s.contentPages || [])[0] || '—'}\n\n`;
      });

      if (process.env.EMAILREP_API_KEY) {
        try {
          const er = await axios.get(`https://emailrep.io/${encodeURIComponent(email)}`, {
            headers: { 'Key': process.env.EMAILREP_API_KEY },
            timeout: TIMEOUT
          });
          const d = er.data || {};
          out += '**EmailRep (réputation)**\n';
          out += `Réputation: ${d.reputation || 'N/A'} | Suspect: ${d.suspicious ? 'Oui' : 'Non'}\n`;
          if (d.breaches) out += `Fuites: ${d.breaches}\n`;
        } catch (_) {}
      }

      if (process.env.HUNTER_API_KEY) {
        try {
          const hu = await axios.get('https://api.hunter.io/v2/email-verifier', {
            params: { email, api_key: process.env.HUNTER_API_KEY },
            timeout: TIMEOUT
          });
          const h = hu.data?.data || {};
          out += '\n**Hunter.io**\n';
          out += `Valide: ${h.status === 'valid' ? 'Oui' : h.status || 'N/A'} | Score: ${h.score ?? 'N/A'} | SMTP: ${h.smtp_check ? 'Oui' : 'Non'}\n`;
        } catch (_) {}
      }

      await loading.edit({
        content: null,
        components: [container(
          txt(`## ${EMB.cloche} Email Info`),
          sep(),
          txt(out.slice(0, 3900))
        )],
        flags: FLAGS
      }).catch(() => {});
    } catch (err) {
      console.error('[EMAILINFO]', err);
      await loading.edit('<a:_:1483497365863399536> Erreur lors de l\'analyse.').catch(() => {});
    }
  }
};
