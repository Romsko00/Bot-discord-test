const Discord = require('discord.js');
const { container, txt, sep, reply, errorContainer, FLAGS } = require('../../utils/v2');
const db = require('../../utils/simpledb');

module.exports = {
  name: 'tempvoc',
  aliases: ['tempo'],
  description: 'Salons vocaux temporaires',
  run: async (client, message) => {
    let hasPermission = false;
    for (const role of message.member.roles.cache.values()) { if (db.get(`ownerp_${message.guild.id}_${role.id}`)) { hasPermission = true; break; } }
    if (!client.config.superadmin?.includes(message.author.id) && !client.config.owners?.includes(message.author.id) && !db.get(`ownermd_${client.user.id}_${message.author.id}`) && !hasPermission)
      return reply(message, errorContainer('Vous n\'avez pas la permission.'));
    await showTempVocConfiguration(client, message);
  }
};

function getChannelDisplay(guild, channelId) {
  if (!channelId) return '❌ Non configuré';
  const ch = guild.channels.cache.get(channelId);
  return ch ? `${ch} (\`${channelId}\`)` : '❌ Salon introuvable';
}

function buildConfigContainer(message) {
  const g = message.guild.id;
  const voiceChannelId = db.get(`jc_${g}`);
  const categoryId     = db.get(`catggg_${g}`);
  const emoji          = db.get(`emote_${g}`);
  const enabled        = db.get(`tempomodule_${g}`);
  return container(
    txt('## 🎤 Configuration Salons Vocaux Temporaires'),
    sep(),
    txt([
      `**Statut :** ${enabled ? '🟢 Activé' : '🔴 Désactivé'}`,
      `**Salon vocal de création :** ${getChannelDisplay(message.guild, voiceChannelId)}`,
      `**Catégorie :** ${getChannelDisplay(message.guild, categoryId)}`,
      `**Préfixe du nom :** ${emoji ? `\`${emoji}\`` : '`Salon de`'}`,
    ].join('\n'))
  );
}

function createComponents() {
  const selectMenu = new Discord.StringSelectMenuBuilder()
    .setCustomId('tempvoc_config_menu')
    .setPlaceholder('Configurer les salons temporaires')
    .addOptions([
      { label: 'Configuration automatique', value: 'auto_setup',      emoji: '🔰' },
      { label: 'Modifier salon vocal',       value: 'edit_voice',      emoji: '🏷️' },
      { label: 'Supprimer salon vocal',      value: 'delete_voice',    emoji: '🗑️' },
      { label: 'Modifier catégorie',         value: 'edit_category',   emoji: '📁' },
      { label: 'Supprimer catégorie',        value: 'delete_category', emoji: '🗑️' },
      { label: 'Modifier préfixe du nom',    value: 'edit_emoji',      emoji: '✏️' },
      { label: 'Supprimer préfixe du nom',   value: 'delete_emoji',    emoji: '🗑️' },
    ]);
  return [
    new Discord.ActionRowBuilder().addComponents(selectMenu),
    new Discord.ActionRowBuilder().addComponents(
      new Discord.ButtonBuilder().setCustomId('tempvoc_refresh').setLabel('Rafraîchir').setEmoji('🔄').setStyle(Discord.ButtonStyle.Secondary)
    ),
  ];
}

async function showTempVocConfiguration(client, message) {
  const configMessage = await message.channel.send({ components: [buildConfigContainer(message), ...createComponents()], flags: FLAGS });

  async function updateContainer() {
    await configMessage.edit({ components: [buildConfigContainer(message), ...createComponents()], flags: FLAGS }).catch(() => {});
  }

  const collector = configMessage.createMessageComponentCollector({ time: 300_000, filter: i => i.user.id === message.author.id });

  async function ask(interaction, prompt) {
    await interaction.followUp({ content: prompt, ephemeral: true });
    try {
      const col  = await message.channel.awaitMessages({ filter: m => m.author.id === message.author.id, max: 1, time: 60_000, errors: ['time'] });
      const resp = col.first();
      await resp.delete().catch(() => {});
      return resp;
    } catch {
      await message.channel.send('⏰ Temps écoulé.').then(m => setTimeout(() => m.delete().catch(() => {}), 3_000));
      return null;
    }
  }

  async function notify(text) {
    const m = await message.channel.send({ components: [container(txt(text))], flags: FLAGS }).catch(() => null);
    if (m) setTimeout(() => m.delete().catch(() => {}), 4_000);
  }

  collector.on('collect', async (interaction) => {
    await interaction.deferUpdate().catch(() => {});
    if (interaction.isButton()) { if (interaction.customId === 'tempvoc_refresh') await updateContainer(); return; }
    if (!interaction.isStringSelectMenu()) return;
    switch (interaction.values[0]) {
      case 'auto_setup': {
        const status = await message.channel.send({ components: [container(txt('⏳ Configuration automatique en cours...'))], flags: FLAGS });
        try {
          const category = await message.guild.channels.create({ name: 'Salons Temporaires', type: Discord.ChannelType.GuildCategory, permissionOverwrites: [{ id: message.guild.id, allow: [Discord.PermissionsBitField.Flags.ViewChannel, Discord.PermissionsBitField.Flags.Connect, Discord.PermissionsBitField.Flags.Speak] }], reason: 'Configuration automatique des salons temporaires' });
          db.set(`catggg_${message.guild.id}`, category.id);
          const voiceChannel = await message.guild.channels.create({ name: '➕ Créer ton salon', type: Discord.ChannelType.GuildVoice, parent: category.id, permissionOverwrites: [{ id: message.guild.id, allow: [Discord.PermissionsBitField.Flags.ViewChannel, Discord.PermissionsBitField.Flags.Connect, Discord.PermissionsBitField.Flags.Speak] }], reason: 'Salon de création des salons temporaires' });
          db.set(`jc_${message.guild.id}`, voiceChannel.id);
          db.set(`tempomodule_${message.guild.id}`, true);
          await status.edit({ components: [container(txt('✅ Configuration automatique terminée !'))], flags: FLAGS });
        } catch (err) {
          console.error('[tempvoc] auto_setup:', err);
          await status.edit({ components: [container(txt(`❌ Erreur : ${err.message}`))], flags: FLAGS });
        }
        setTimeout(() => status.delete().catch(() => {}), 4_000);
        await updateContainer(); break;
      }
      case 'edit_voice': {
        const resp = await ask(interaction, 'Mentionnez le salon vocal de création ou envoyez son ID :');
        if (!resp) { await updateContainer(); break; }
        const ch = resp.mentions.channels.first() || message.guild.channels.cache.get(resp.content.trim());
        if (!ch) await notify('❌ Salon introuvable.');
        else if (ch.type !== Discord.ChannelType.GuildVoice) await notify('❌ Ce salon doit être un salon vocal.');
        else { db.set(`jc_${message.guild.id}`, ch.id); db.set(`tempomodule_${message.guild.id}`, true); await notify(`✅ Salon vocal défini : ${ch}`); }
        await updateContainer(); break;
      }
      case 'delete_voice': { db.delete(`jc_${message.guild.id}`); await notify('✅ Salon vocal supprimé.'); await updateContainer(); break; }
      case 'edit_category': {
        const resp = await ask(interaction, 'Mentionnez la catégorie ou envoyez son ID :');
        if (!resp) { await updateContainer(); break; }
        const ch = resp.mentions.channels.first() || message.guild.channels.cache.get(resp.content.trim());
        if (!ch) await notify('❌ Catégorie introuvable.');
        else if (ch.type !== Discord.ChannelType.GuildCategory) await notify('❌ Ce salon doit être une catégorie.');
        else { db.set(`catggg_${message.guild.id}`, ch.id); await notify(`✅ Catégorie définie : ${ch.name}`); }
        await updateContainer(); break;
      }
      case 'delete_category': { db.delete(`catggg_${message.guild.id}`); await notify('✅ Catégorie supprimée.'); await updateContainer(); break; }
      case 'edit_emoji': {
        const resp = await ask(interaction, 'Envoyez le préfixe/emoji pour les noms des salons (max 20 car.) :');
        if (!resp) { await updateContainer(); break; }
        const val = resp.content.trim().slice(0, 20);
        db.set(`emote_${message.guild.id}`, val);
        await notify(`✅ Préfixe défini : \`${val}\``);
        await updateContainer(); break;
      }
      case 'delete_emoji': { db.delete(`emote_${message.guild.id}`); await notify('✅ Préfixe supprimé (retour à `Salon de`).'); await updateContainer(); break; }
    }
  });
  collector.on('end', () => configMessage.edit({ components: [buildConfigContainer(message)], flags: FLAGS }).catch(() => {}));
}

async function handleTempVoiceChannels(client) {
  client.on('voiceStateUpdate', async (oldState, newState) => {
    if (!db.get(`tempomodule_${newState.guild.id}`)) return;
    const joinChannelId = db.get(`jc_${newState.guild.id}`);
    const categoryId    = db.get(`catggg_${newState.guild.id}`);
    const prefix        = db.get(`emote_${newState.guild.id}`) || 'Salon de';
    if (!joinChannelId || !categoryId) return;
    if (newState.channelId === joinChannelId && newState.channel) {
      try {
        const member   = newState.member;
        const baseName = `${prefix} ${member.displayName}`.slice(0, 100);
        const tempChannel = await newState.guild.channels.create({ name: baseName, type: Discord.ChannelType.GuildVoice, parent: categoryId, permissionOverwrites: [{ id: member.id, allow: [Discord.PermissionsBitField.Flags.ManageChannels, Discord.PermissionsBitField.Flags.MoveMembers] }, { id: newState.guild.id, allow: [Discord.PermissionsBitField.Flags.ViewChannel, Discord.PermissionsBitField.Flags.Connect, Discord.PermissionsBitField.Flags.Speak] }], reason: `Salon temporaire pour ${member.user.tag}` });
        await member.voice.setChannel(tempChannel);
        db.set(`tempchannel_${tempChannel.id}`, { owner: member.id, created: Date.now(), guild: newState.guild.id });
      } catch (err) { console.error('[tempvoc] création:', err); }
    }
    if (oldState.channel && oldState.channel.parentId === categoryId && oldState.channelId !== joinChannelId) {
      const channelInfo = db.get(`tempchannel_${oldState.channel.id}`);
      if (channelInfo && oldState.channel.members.size === 0) {
        try { await oldState.channel.delete('Salon temporaire vide'); db.delete(`tempchannel_${oldState.channel.id}`); }
        catch (err) { console.error('[tempvoc] suppression:', err); }
      }
    }
  });
}

module.exports.handleTempVoiceChannels = handleTempVoiceChannels;
module.exports.initializeTempVoice = (client) => { handleTempVoiceChannels(client); console.log('✅ Module salons vocaux temporaires initialisé'); };
