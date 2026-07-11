const Discord = require('discord.js');
const db = require('../../utils/simpledb');

module.exports = {
  name: 'reroll',
  aliases: ['gwreroll', 'gvreroll'],
  category: 'gestion',
  description: 'Reroll un giveaway existant (re-tirage des gagnants)',
  usage: '+reroll [messageId]',
  run: async (client, message, args, prefix, color) => {

    let perm = false;
    message.member?.roles?.cache?.forEach((role) => {
      if (db.get(`ownerp_${message.guild.id}_${role.id}`)) perm = true;
      if (db.get(`gvwp_${message.guild.id}_${role.id}`)) perm = true;
    });

    const canUse = perm ||
      (client.config.superadmin && client.config.superadmin.includes(message.author.id)) ||
      (client.config.owners && client.config.owners.includes(message.author.id)) ||
      db.get(`ownermd_${client.user.id}_${message.author.id}`);

    if (!canUse) {
      return message.reply({ content: 'Vous n\'avez pas la permission d\'utiliser cette commande.' });
    }

    let messageId;
    if (args[0]) {
      messageId = args[0];
    } else {
      messageId = db.get(`last${message.guild.id}`);
      if (!messageId) {
        return message.channel.send('Aucun giveaway récent trouvé. Utilisez : `giveaway reroll <message id>` ou `+reroll <message id>`.');
      }
    }

    try {
      const giveawayMessage = await message.channel.messages.fetch(messageId).catch(() => null);
      if (!giveawayMessage) {
        return message.channel.send('Message de giveaway non trouvé dans ce salon. Lancez la commande dans le bon salon ou donnez un ID valide.');
      }

      const reactionEmoji = db.get(`reactgv${message.guild.id}`) || '🎉';
      const reaction = findReaction(giveawayMessage, reactionEmoji);

      if (!reaction || reaction.count <= 1) {
        return message.channel.send('Aucun participant trouvé sur ce giveaway.');
      }

      const winnersCount = db.get(`winnergv${message.guild.id}`) || 1;
      const users = await reaction.users.fetch();
      const validUsers = users.filter((user) => !user.bot);

      if (validUsers.size === 0) {
        return message.channel.send('Aucun participant valide.');
      }

      let filteredUsers = validUsers;

      const imposedWinnerId = db.get(`imposer${message.guild.id}`);
      if (imposedWinnerId) {
        const imposedUser = validUsers.get(imposedWinnerId);
        if (imposedUser) {
          const col = new Discord.Collection();
          col.set(imposedUser.id, imposedUser);
          filteredUsers = col;
        }
      }

      if (db.get(`presencevocal${message.guild.id}`)) {
        filteredUsers = filteredUsers.filter((user) => {
          const member = message.guild.members.cache.get(user.id);
          return member && member.voice && member.voice.channel;
        });
      }

      const requiredRole = db.get(`roleobliga${message.guild.id}`);
      if (requiredRole) {
        filteredUsers = filteredUsers.filter((user) => {
          const member = message.guild.members.cache.get(user.id);
          return member && member.roles.cache.has(requiredRole);
        });
      }

      if (filteredUsers.size === 0) {
        return message.channel.send('Aucun participant valide après application des filtres.');
      }

      const winners = selectWinners(filteredUsers, winnersCount);
      const prize = db.get(`gain${message.guild.id}`) || 'le prix';

      return message.channel.send(`🔁 Nouveau tirage ! Félicitations à ${winners.join(', ')} qui gagne(nt) ${prize}`);
    } catch (error) {
      console.error('Erreur lors du reroll (commande reroll):', error);
      return message.channel.send('Une erreur s\'est produite lors du reroll.');
    }
  }
};

function selectWinners(users, count) {
  const userArray = Array.from(users.values());
  const winners = [];
  const selectedIndices = new Set();

  for (let i = 0; i < Math.min(count, userArray.length); i++) {
    let randomIndex;
    do {
      randomIndex = Math.floor(Math.random() * userArray.length);
    } while (selectedIndices.has(randomIndex));

    selectedIndices.add(randomIndex);
    winners.push(userArray[randomIndex]);
  }

  return winners.map((user) => user.toString());
}

function findReaction(message, emojiInput) {
  const byString = message.reactions.cache.find((r) => r.emoji && r.emoji.toString() === emojiInput);
  if (byString) return byString;
  const byName = message.reactions.cache.find((r) => r.emoji && r.emoji.name === emojiInput);
  if (byName) return byName;
  const byId = message.reactions.cache.find((r) => r.emoji && r.emoji.id === emojiInput);
  return byId || null;
}

