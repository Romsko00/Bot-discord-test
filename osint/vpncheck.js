const Discord = require('discord.js');
const axios = require('axios');
const db = require('../../utils/simpledb');
const { checkOsintPermission } = require('../../utils/osintHelpers');
const EMOJIS = require('../../utils/emojis');
const { EMOJIS: EMB } = require('../../utils/embedBuilder');
const { container, txt, sep, FLAGS } = require('../../utils/v2');

module.exports = {
  name: 'vpncheck',
  aliases: ['vpn', 'proxycheck'],
  description: 'Vérifie si une IP est associée à un VPN, proxy ou serveur',
  run: async (client, message, args, prefix, color) => {
    if (!checkOsintPermission(client, message)) return;

    const cost = 5;
    const level = db.get(`guild_${message.guild.id}_level_${message.author.id}`) || 1;
    const baseCredits = db.get(`user_credits_${message.author.id}`) || 0;
    const dailyCredits = db.get(`daily_credits_${message.author.id}`) || 0;
    const levelBonus = level * 2;
    const totalCredits = baseCredits + dailyCredits + levelBonus;
    const ip = args[0];
    if (!ip) return message.reply('<a:_:1483497365863399536> Veuillez spécifier une **adresse IP**.');
    if (totalCredits < cost) {
      return message.channel.send({
        components: [container(
          txt('## ❌ Crédits insuffisants'),
          sep(),
          txt(`**Coût :** ${cost} crédits\n**Vos crédits :** ${totalCredits}`)
        )],
        flags: FLAGS
      });
    }
    db.subtract(`user_credits_${message.author.id}`, cost);
    const ipRegex = /^(\d{1,3}\.){3}\d{1,3}$/;
    if (!ipRegex.test(ip)) return message.reply('<a:_:1483497365863399536> Format d\'IP invalide.');
    const loadingMsg = await message.channel.send(`${EMOJIS.BUG} **Analyse de l'IP en cours...**`);

    try {
      const response = await axios.get(`http://v2.api.iphub.info/ip/${ip}`, {
        headers: { 'X-Key': process.env.IPHUB_API_KEY || 'free' },
        timeout: 10000
      });

      const data = response.data;
      const isVPN = data.block === 1;
      const lines = [
        `## 【 Vérification VPN / Proxy 】`,
        `Adresse IP analysée : **${ip}**`,
        '',
        `**【 Fournisseur 】** ${data.isp || 'Inconnu'}`,
        `**【 Pays 】** ${data.countryName || 'Inconnu'}`,
        `**【 Ville 】** ${data.city || 'Inconnue'}`,
        `**【 Statut 】** ${isVPN ? `${EMB.alerte} VPN / Proxy détecté` : 'IP normale'}`,
        `**【 Type 】** ${getIPType(data)}`
      ];
      if (isVPN) {
        lines.push('', '⚠️ Cette IP est probablement utilisée pour masquer l\'identité ou contourner des restrictions géographiques.');
      }

      await loadingMsg.edit({
        content: null,
        components: [container(txt(lines.join('\n')))],
        flags: FLAGS
      });

    } catch (error) {
      console.error('VPN Check Error:', error);
      await loadingMsg.edit({
        content: null,
        components: [container(
          txt('## 【 Informations IP Limitées 】'),
          sep(),
          txt(`Adresse IP : **${ip}**\n\n⚠️ Analyse VPN/Proxy indisponible — API IPHub non accessible.`)
        )],
        flags: FLAGS
      });
    }
  }
};

function getIPType(data) {
  if (data.block === 0) return 'Residentiel';
  if (data.block === 1) return 'VPN / Proxy';
  if (data.block === 2) return 'Serveur';
  return 'Inconnu';
}
