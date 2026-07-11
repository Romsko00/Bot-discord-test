
const axios = require('axios');
const db = require("../../utils/simpledb");
const { EmbedBuilder } = require("discord.js");
const ms = require("ms");

module.exports = async (client, member) => {


  const leavedm = db.get(`leavedmee_${member.guild.id}`);
  if (leavedm) {
    const u = member.user || member;
    const formatted = String(leavedm).
    replace("{user}", u.toString()).
    replace("{user:username}", u.username || u.user?.username || "").
    replace("{user:tag}", u.tag || u.user?.tag || "").
    replace("{user:id}", u.id || u.user?.id || "").
    replace("{guild:name}", member.guild.name).
    replace("{guild:member}", String(member.guild.memberCount));
    try {await member.send(formatted);} catch (_) {}
  }



};
