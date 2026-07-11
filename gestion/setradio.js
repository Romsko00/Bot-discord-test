const Discord = require('discord.js');
const { container, txt, sep, reply, errorContainer, FLAGS } = require('../../utils/v2');
const db = require('../../utils/simpledb');

function crypt(str, mask, n = 1) { if (!str) return 'Non défini'; return ('' + str).slice(0, -n).replace(/./g, mask) + ('' + str).slice(-n); }
function radioLabel(r) { return { nrj: '1️⃣ NRJ', sky: '2️⃣ Skyrock', nost: '3️⃣ Nostalgie', virgin: '6️⃣ Virgin Radio', mouv: "3️⃣ Mouv'", rapfr: '4️⃣ Rap FR' }[r] || 'Non défini'; }
function getRadioUrl(r) { return { nrj: 'https://cdn.nrjaudio.fm/audio1/fr/30001/mp3_128.mp3', sky: 'https://icecast.skyrock.net/s/natio_mp3_128k', nost: 'https://direct.nostalgie.fr/nostalgie.mp3', virgin: 'https://virginradio.ice.infomaniak.ch/virginradio.mp3', mouv: 'https://direct.mouv.fr/live/mouv-midfi.mp3', rapfr: 'https://streaming.radio.rtl.fr/rtl2-1-44-128' }[r]; }

function buildRadioContainer(message) {
  const g = message.guild.id;
  const token = db.get(`tokenradio_${g}`);
  const radioVal = db.get(`radioj_${g}`);
  const channelId = db.get(`salonradio_${g}`);
  return container(
    txt('## 📻 Configuration Radio'),
    sep(),
    txt([
      `**Token :** ${token ? `\`${crypt(token, '●', 25)}\`` : 'Non défini'}`,
      `**Radio :** ${radioLabel(radioVal)}`,
      `**Salon vocal :** ${channelId ? `<#${channelId}>` : 'Non défini'}`,
    ].join('\n'))
  );
}

function buildMainRow() {
  return new Discord.ActionRowBuilder().addComponents(
    new Discord.StringSelectMenuBuilder().setCustomId('radio_main_menu').setPlaceholder('Sélectionnez une action').addOptions([
      { label: 'Ajouter une radio', value: 'add_radio', emoji: '➕' },
      { label: 'Enlever une radio', value: 'remove_radio', emoji: '➖' }
    ])
  );
}

function buildSetupRows() {
  return [
    new Discord.ActionRowBuilder().addComponents(
      new Discord.StringSelectMenuBuilder().setCustomId('radio_setup_menu').setPlaceholder('Configurer la radio').addOptions([
        { label: 'Changer le token', value: 'change_token', emoji: '📡' },
        { label: 'Changer la radio', value: 'change_radio', emoji: '📻' },
        { label: 'Changer le salon vocal', value: 'change_channel', emoji: '🎧' }
      ])
    ),
    new Discord.ActionRowBuilder().addComponents(
      new Discord.ButtonBuilder().setCustomId('radio_validate').setLabel('Valider').setEmoji('✅').setStyle(Discord.ButtonStyle.Success),
      new Discord.ButtonBuilder().setCustomId('radio_cancel').setLabel('Annuler').setEmoji('❌').setStyle(Discord.ButtonStyle.Secondary)
    ),
  ];
}

module.exports = {
  name: 'setradio',
  aliases: [],
  description: 'Configure une radio',
  run: async (client, message) => {
    let hasPermission = false;
    for (const role of message.member.roles.cache.values()) { if (db.get(`ownerp_${message.guild.id}_${role.id}`)) { hasPermission = true; break; } }
    if (!client.config.superadmin?.includes(message.author.id) && !client.config.owners?.includes(message.author.id) && !db.get(`ownermd_${client.user.id}_${message.author.id}`) && !hasPermission)
      return reply(message, errorContainer('Vous n\'avez pas la permission.'));

    const configMessage = await message.channel.send({ components: [buildRadioContainer(message), buildMainRow()], flags: FLAGS });
    const updateSetupView = () => configMessage.edit({ components: [buildRadioContainer(message), ...buildSetupRows()], flags: FLAGS }).catch(() => {});
    const updateMainView = () => configMessage.edit({ components: [buildRadioContainer(message), buildMainRow()], flags: FLAGS }).catch(() => {});

    const ask = async (prompt) => {
      const q = await message.channel.send(prompt);
      try {
        const r = await message.channel.awaitMessages({ filter: m => m.author.id === message.author.id, max: 1, time: 60000, errors: ['time'] });
        const resp = r.first(); await q.delete().catch(() => {}); await resp.delete().catch(() => {}); return resp;
      } catch { await q.edit('⏰ Temps écoulé.').catch(() => {}); setTimeout(() => q.delete().catch(() => {}), 2000); return null; }
    };

    const collector = configMessage.createMessageComponentCollector({ time: 300000, filter: i => i.user.id === message.author.id });
    collector.on('collect', async interaction => {
      if (interaction.isStringSelectMenu()) {
        await interaction.deferUpdate();
        if (interaction.customId === 'radio_main_menu') {
          if (interaction.values[0] === 'add_radio') await updateSetupView();
          else if (interaction.values[0] === 'remove_radio') {
            const q = await ask('Mentionnez le bot à enlever ou envoyez son ID :');
            if (!q) return;
            const botMember = message.guild.members.cache.get(q.content) || q.mentions.members?.first();
            if (!botMember?.user.bot) return message.channel.send('Bot introuvable.').then(m=>setTimeout(()=>m.delete().catch(()=>{}),3000));
            if (!botMember.voice.channel) return message.channel.send('Ce bot n\'est pas en vocal.').then(m=>setTimeout(()=>m.delete().catch(()=>{}),3000));
            try { await botMember.voice.disconnect(); await message.channel.send('✅ Bot déconnecté.').then(m=>setTimeout(()=>m.delete().catch(()=>{}),3000)); } catch { await message.channel.send('❌ Impossible de déconnecter.').then(m=>setTimeout(()=>m.delete().catch(()=>{}),3000)); }
            await updateMainView();
          }
        } else if (interaction.customId === 'radio_setup_menu') {
          const val = interaction.values[0];
          if (val === 'change_token') {
            const resp = await ask('Envoyez le token du bot radio :');
            if (!resp) return;
            const token = resp.content.trim();
            if (token.length < 50) return message.channel.send('Token invalide (trop court).').then(m=>setTimeout(()=>m.delete().catch(()=>{}),3000));
            try {
              const testClient = new Discord.Client({ intents: [] });
              await testClient.login(token);
              testClient.destroy();
              db.set(`tokenradio_${message.guild.id}`, token);
              await message.channel.send('✅ Token validé.').then(m=>setTimeout(()=>m.delete().catch(()=>{}),3000));
            } catch { await message.channel.send('❌ Token invalide.').then(m=>setTimeout(()=>m.delete().catch(()=>{}),3000)); }
            await updateSetupView();
          } else if (val === 'change_radio') {
            const radioMsg = await message.channel.send({ components: [container(txt('## 📻 Sélection Radio'), sep(), txt('1️⃣ NRJ · 2️⃣ Skyrock · 3️⃣ Mouv\' · 4️⃣ Rap FR · 5️⃣ Nostalgie · 6️⃣ Virgin')), new Discord.ActionRowBuilder().addComponents(new Discord.StringSelectMenuBuilder().setCustomId('radio_selection').setPlaceholder('Choisissez une radio').addOptions([{label:'NRJ',value:'nrj',emoji:'1️⃣'},{label:'Skyrock',value:'sky',emoji:'2️⃣'},{label:"Mouv'",value:'mouv',emoji:'3️⃣'},{label:'Rap FR',value:'rapfr',emoji:'4️⃣'},{label:'Nostalgie',value:'nost',emoji:'5️⃣'},{label:'Virgin Radio',value:'virgin',emoji:'6️⃣'}]))], flags: FLAGS });
            try {
              const sel = await radioMsg.awaitMessageComponent({ filter: i => i.user.id === message.author.id, time: 60000 });
              db.set(`radioj_${message.guild.id}`, sel.values[0]);
              await sel.deferUpdate();
              await radioMsg.delete().catch(() => {});
              await message.channel.send(`✅ Radio : ${radioLabel(sel.values[0])}`).then(m=>setTimeout(()=>m.delete().catch(()=>{}),3000));
            } catch { await radioMsg.delete().catch(() => {}); }
            await updateSetupView();
          } else if (val === 'change_channel') {
            const resp = await ask('Mentionnez le salon vocal ou envoyez son ID :');
            if (!resp) return;
            const ch = resp.mentions.channels.first() || message.guild.channels.cache.get(resp.content.trim());
            if (!ch?.isVoiceBased()) return message.channel.send('Salon vocal invalide.').then(m=>setTimeout(()=>m.delete().catch(()=>{}),3000));
            db.set(`salonradio_${message.guild.id}`, ch.id);
            await message.channel.send(`✅ Salon vocal défini : ${ch}`).then(m=>setTimeout(()=>m.delete().catch(()=>{}),3000));
            await updateSetupView();
          }
        }
      } else if (interaction.isButton()) {
        await interaction.deferUpdate();
        if (interaction.customId === 'radio_cancel') { await configMessage.delete().catch(() => {}); collector.stop(); }
        else if (interaction.customId === 'radio_validate') {
          const g = message.guild.id;
          if (!db.get(`tokenradio_${g}`)) return message.channel.send('❌ Aucun token configuré.').then(m=>setTimeout(()=>m.delete().catch(()=>{}),3000));
          if (!db.get(`radioj_${g}`)) return message.channel.send('❌ Aucune radio sélectionnée.').then(m=>setTimeout(()=>m.delete().catch(()=>{}),3000));
          if (!db.get(`salonradio_${g}`)) return message.channel.send('❌ Aucun salon vocal configuré.').then(m=>setTimeout(()=>m.delete().catch(()=>{}),3000));
          const token = db.get(`tokenradio_${g}`), radioValue = db.get(`radioj_${g}`), channelId = db.get(`salonradio_${g}`);
          const radioUrl = getRadioUrl(radioValue);
          if (!radioUrl) return message.channel.send('❌ URL de radio invalide.').then(m=>setTimeout(()=>m.delete().catch(()=>{}),3000));
          const channel = message.guild.channels.cache.get(channelId);
          if (!channel) return message.channel.send('❌ Salon vocal introuvable.').then(m=>setTimeout(()=>m.delete().catch(()=>{}),3000));
          try {
            const radioClient = new Discord.Client({ intents: [Discord.GatewayIntentBits.Guilds, Discord.GatewayIntentBits.GuildVoiceStates] });
            await radioClient.login(token);
            radioClient.once('clientReady', async () => {
              try {
                const targetGuild = radioClient.guilds.cache.get(g);
                if (!targetGuild) { await message.channel.send('❌ Le bot radio n\'est pas sur ce serveur.'); radioClient.destroy(); return; }
                const vc = targetGuild.channels.cache.get(channelId);
                if (!vc) { await message.channel.send('❌ Salon vocal introuvable.'); radioClient.destroy(); return; }
                const connection = await vc.join();
                const player = connection.play(radioUrl);
                player.on('error', e => { console.error('Radio error:', e); message.channel.send('❌ Erreur lecture radio.'); });
                await message.channel.send(`✅ Radio démarrée : ${radioLabel(radioValue)} dans ${vc}`);
              } catch (e) { console.error('[setradio]', e); await message.channel.send('❌ Erreur démarrage radio.'); radioClient.destroy(); }
            });
            db.set(`radioclient_${g}`, radioClient);
            await configMessage.delete().catch(() => {}); collector.stop();
          } catch (e) { console.error('[setradio] login:', e); await message.channel.send('❌ Erreur de connexion.'); }
        }
      }
    });
    collector.on('end', () => configMessage.edit({ components: [buildRadioContainer(message)], flags: FLAGS }).catch(() => {}));
  }
};
