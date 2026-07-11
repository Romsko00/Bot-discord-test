const Discord = require('discord.js');
const { NazAPI } = require('../../utils/nazapi');
const db = require('../../utils/simpledb');
const { checkOsintPermission } = require('../../utils/osintHelpers');
const { EMOJIS: EMB } = require('../../utils/embedBuilder');
const EMOJIS = require('../../utils/emojis');
const { container, txt, sep, FLAGS } = require('../../utils/v2');

const nazapi = new NazAPI();

module.exports = {
  name: 'geoip',
  aliases: ['geo', 'ip'],
  description: 'Analyse et informations détaillées sur une adresse IP (OSINT)',
  run: async (client, message, args, prefix, color) => {
    if (!checkOsintPermission(client, message)) return;

    const cost = 5;
    const level = db.get(`guild_${message.guild.id}_level_${message.author.id}`) || 1;
    const baseCredits = db.get(`user_credits_${message.author.id}`) || 0;
    const dailyCredits = db.get(`daily_credits_${message.author.id}`) || 0;
    const levelBonus = level * 2;
    const totalCredits = baseCredits + dailyCredits + levelBonus;
    const axios = require('axios');
    if (!args[0]) {
      return message.channel.send('<a:_:1483497365863399536> Veuillez fournir une adresse IP.');
    }
    const ip = args[0];
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
    try {

      let nazResult = null;
      try {
        if (typeof nazapi.geoip === 'function') nazResult = await nazapi.geoip(ip);
      } catch (e) { }

      let ipinfoResult = null;
      try {
        const ipinfoRes = await axios.get(`https://ipinfo.io/${ip}/json?token=${process.env.IPINFO_TOKEN || ''}`);
        ipinfoResult = ipinfoRes.data;
      } catch (e) { }

      let ipapiResult = null;
      try {
        const ipapiRes = await axios.get(`http://ip-api.com/json/${ip}`);
        ipapiResult = ipapiRes.data;
      } catch (e) { }

      let reputation = null;
      try {
        const repRes = await axios.get(`http://v2.api.iphub.info/ip/${ip}`, {
          headers: { 'X-Key': process.env.IPHUB_API_KEY || 'free' },
          timeout: 10000
        });
        reputation = repRes.data;
      } catch (e) { }

      const lines = [`## 【 IP : ${ip} 】`, ''];

      const locLines = [
        nazResult?.country ? `• Pays : ${nazResult.country}` : null,
        ipinfoResult?.region ? `• Région : ${ipinfoResult.region}` : null,
        ipapiResult?.city ? `• Ville : ${ipapiResult.city}` : null,
        nazResult?.loc ? `• Coordonnées : ${nazResult.loc}` : null,
        ipinfoResult?.timezone ? `• Fuseau : ${ipinfoResult.timezone}` : null
      ].filter(Boolean);
      if (locLines.length) { lines.push('**【 Localisation 】**'); lines.push(...locLines); lines.push(''); }

      const netLines = [
        nazResult ? `• IP : ${nazResult.ip || ip}` : `• IP : ${ip}`,
        nazResult?.org ? `• ASN / Opérateur : ${nazResult.org}` : null,
        ipinfoResult?.org ? `• Organisation : ${ipinfoResult.org}` : null,
        ipapiResult?.isp ? `• ISP : ${ipapiResult.isp}` : null
      ].filter(Boolean);
      if (netLines.length) { lines.push('**【 Réseau 】**'); lines.push(...netLines); lines.push(''); }

      if (reputation) {
        lines.push('**【 Réputation / VPN / Proxy 】**');
        lines.push(
          `• Fournisseur : ${reputation.isp || 'N/A'}`,
          `• Pays : ${reputation.countryName || 'N/A'}`,
          `• Ville : ${reputation.city || 'N/A'}`,
          `• Statut : ${reputation.block === 1 ? `${EMB.alerte} VPN / Proxy détecté` : 'IP normale'}`,
          `• Type : ${reputation.type || 'N/A'}`
        );
        lines.push('');
      }

      lines.push(`**【 Crédits 】**\n• Coût : ${cost} crédits\n• Restants : ${totalCredits - cost} crédits`);

      await message.channel.send({ components: [container(txt(lines.join('\n')))], flags: FLAGS });
    } catch (error) {
      await message.channel.send('<a:_:1483497365863399536> Erreur lors de la récupération des informations IP.');
      console.error('GeoIP Error:', error);
    }
  }
};
