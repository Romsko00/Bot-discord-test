const Discord = require('discord.js');
const db = require('../../utils/simpledb');
const EMOJIS = require('../../utils/emojis');
const { hasPermissionLevel } = require('../../utils/permissionUtils');

module.exports = {
  name: 'piconly',
  aliases: ['imageonly'],
  description: 'Définit un salon où il est uniquement possible de mettre des images.',
  category: 'utilitaire',
  usage: 'piconly <channel/off>',
  permissionLevel: 1, // Require perm
  run: async (client, message, args) => {
    // Permission check
    if (!hasPermissionLevel(client, message, 2)) return message.reply(`${EMOJIS.ERROR} Vous n'avez pas la permission.`);

    // Delete command message to keep clean if successful?
    message.delete().catch(() => { });

    if (!args[0]) {
      return message.channel.send(`${EMOJIS.WARNING} Usage: \`piconly <#salon/off>\``);
    }

    const commandName = args[0].toLowerCase();

    // Check if channel provided or "off"
    // Case 1: piconly off <channel?>
    if (commandName === 'off') {
      const channel = message.mentions.channels.first() || message.guild.channels.cache.get(args[1]) || message.channel;
      const currentList = db.get(`piconly_${message.guild.id}`) || [];

      if (!currentList.includes(channel.id)) {
        return message.channel.send(`${EMOJIS.WARNING} Le salon ${channel} n'est pas en mode Image-Only.`);
      }

      const newList = currentList.filter(id => id !== channel.id);
      db.set(`piconly_${message.guild.id}`, newList);
      return message.channel.send(`${EMOJIS.SUCCESS} Mode Image-Only désactivé pour ${channel}.`);
    }

    // Case 2: piconly <channel> or just piconly (current)
    const channel = message.mentions.channels.first() || message.guild.channels.cache.get(args[0]) || message.channel;

    // Check if text channel
    if (!channel.isTextBased()) {
      return message.channel.send(`${EMOJIS.ERROR} Ce n'est pas un salon textuel.`);
    }

    const currentList = db.get(`piconly_${message.guild.id}`) || [];
    if (currentList.includes(channel.id)) {
      return message.channel.send(`${EMOJIS.WARNING} Le salon ${channel} est déjà en mode Image-Only.`);
    }

    currentList.push(channel.id);
    db.set(`piconly_${message.guild.id}`, currentList);

    message.channel.send(`${EMOJIS.SUCCESS} Le salon ${channel} est maintenant en mode **Image-Only**.`).then(m => {
      setTimeout(() => m.delete().catch(() => { }), 5000);
    });
  }
};
