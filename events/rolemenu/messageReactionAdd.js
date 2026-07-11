const axios = require('axios');
const db = require("../../utils/simpledb");
const { EmbedBuilder } = require("discord.js");
const ms = require("ms");
const { PermissionFlagsBits } = require('discord.js');

module.exports = async (client, reaction, user) => {
  if (reaction.message.partial) await reaction.message.fetch();
  if (reaction.partial) await reaction.fetch();
  if (user.bot) return;

  const { guild } = reaction.message;
  if (!guild) return;
  const me = guild.members.me;
  if (!me || !me.permissions.has(PermissionFlagsBits.ManageRoles)) return;
  const member = guild.members.cache.get(user.id);
  if (!member) return;
  const data = db.get(`reactions_${guild.id}`);
  if (!data) return;
  const reaction2 = data.find(
    (r) => r.emoji === reaction.emoji.toString() && r.msg === reaction.message.id
  );
  if (!reaction2) return;
  member.roles.add(reaction2.roleId).catch((err) => undefined);
};
