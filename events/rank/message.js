const axios = require('axios');
const db = require("../../utils/simpledb");
const { EmbedBuilder } = require("discord.js");
const ms = require("ms");

module.exports = async (client, message) => {
  if (!message.guild) return;
  if (message.author.bot) return;

  if (!client.isCommandHandler) return;


  db.add(`msg_${message.guild.id}_${message.author.id}`, 1);
  xp(message);


  async function xp(message) {

    let prefix = db.get(`prefix_${message.guild.id}`) === null ? client.config.prefix : db.get(`prefix_${message.guild.id}`);
    if (message.content.startsWith(prefix)) return;
    const randomNumber = Math.floor(Math.random() * 10) + 15;
    db.add(`guild_${message.guild.id}_xp_${message.author.id}`, randomNumber);
    db.add(`guild_${message.guild.id}_xptotal_${message.guild.id}`, randomNumber);


    var level = db.get(`guild_${message.guild.id}_level_${message.author.id}`) || 1;
    var xp = db.get(`guild_${message.guild.id}_xp_${message.author.id}`);
    var xpNeeded = level * 500;
    let messagefetch = db.get(`msg_${message.guild.id}_${message.author.id}`);
    if (xpNeeded < xp) {

      var newLevel = db.add(`guild_${message.guild.id}_level_${message.author.id}`, 1);

      let money = db.all().filter((data) => data.ID.startsWith(`rewardlevel_${message.guild.id}`)).sort((a, b) => b.data - a.data);
      money.filter((x) => message.guild.roles.cache.get(x.ID.split('_')[2])).map((m, i) => {
        if (newLevel === m.ID.split('_')[3] && !message.member.roles.cache.has(m.ID.split('_')[2])) {
          message.member.roles.add(m.ID.split('_')[2]).catch();
        }
      });
      db.subtract(`guild_${message.guild.id}_xp_${message.author.id}`, xpNeeded);
      let channel = await client.channels.fetch(db.get(`levelchannel_${message.guild.id}`)).catch((err) => {});

      if (db.get(`levelmessageembed_${message.guild.id}`) !== null) {
        let embedj = db.get(`levelmessageembed_${message.guild.id}`);

        // Helper to cleanly replace all variables without chaining 40 replace() calls
        function formatMessage(text) {
          if (!text) return "";
          return text.replace(/{user}/g, message.author.toString())
                     .replace(/{user:username}/g, message.author.username)
                     .replace(/{user:tag}/g, message.author.tag)
                     .replace(/{user:id}/g, message.author.id)
                     .replace(/{guild:name}/g, message.guild.name)
                     .replace(/{guild:member}/g, message.guild.memberCount)
                     .replace(/{level}/g, newLevel)
                     .replace(/{xp}/g, xp)
                     .replace(/{message}/g, messagefetch);
        }

        if (embedj.description) embedj.description = formatMessage(embedj.description);
        if (embedj.title) embedj.title = formatMessage(embedj.title);
        if (embedj.footer && embedj.footer.text) embedj.footer.text = formatMessage(embedj.footer.text);

        if (channel) channel.send({ embeds: [embedj] });
      } else {
        let joinmessage = db.get(`levelmsg_${message.guild.id}`);
        if (joinmessage === null) joinmessage = client.config.defaultLevelmessage || `Félicitations {user}, tu viens de passer au niveau {level} !`;
        let toSend = formatMessage(joinmessage);

        if (channel) channel.send(toSend);
      }




    }
  }
};
