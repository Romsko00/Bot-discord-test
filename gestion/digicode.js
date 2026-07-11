const { ActionRowBuilder, ButtonBuilder, ButtonStyle, ComponentType } = require('discord.js');
const db = require('../../utils/simpledb');
const { hasPermissionLevel, AccessLevels } = require('../../utils/permissionUtils');
const { container, txt, sep, reply, errorContainer, successContainer, FLAGS } = require('../../utils/v2');

const KEY_CONFIG = (guildId) => `digicode_config_${guildId}`;
function getConfig(guildId) { return db.get(KEY_CONFIG(guildId)) || null; }

function buildPadRows() {
  return [['1','2','3'],['4','5','6'],['7','8','9'],['CL','0','✔']].map(row => new ActionRowBuilder().addComponents(...row.map(d => new ButtonBuilder().setCustomId(`digi_pad_${d}`).setLabel(d).setStyle(d==='CL'?ButtonStyle.Danger:d==='✔'?ButtonStyle.Success:ButtonStyle.Primary))));
}

module.exports = {
  name: 'digicode',
  aliases: ['digi', 'confdigi'],
  description: 'Système de digicode pour protéger l\'accès à un salon ou un rôle.',
  category: 'gestion',
  run: async (client, message, args) => {
    const guildId = message.guild.id;
    const sub = args[0]?.toLowerCase();

    if (sub === 'config' || sub === 'confdigi' || sub === 'setup') {
      if (!hasPermissionLevel(client, message, AccessLevels?.PERM6 || 6)) return reply(message, errorContainer('Permission insuffisante (niveau 6).'));
      const config = getConfig(guildId);
      const buildCfgC = () => {
        const info = config ? `Code: défini | Fonction: ${config.type==='channel'?'# salon':'@ rôle'} | Cible: ${config.type==='channel'?`<#${config.targetId}>`:`\`${config.targetId}\``}` : 'Aucun digicode configuré.';
        return container(txt('## 🔐 Digicode — Configuration'), sep(), txt(info));
      };
      const funcRow = new ActionRowBuilder().addComponents(
        new ButtonBuilder().setCustomId('digi_conf_channel').setLabel('# Accès à un salon').setStyle(ButtonStyle.Secondary),
        new ButtonBuilder().setCustomId('digi_conf_role').setLabel('🎓 Attribution d\'un rôle').setStyle(ButtonStyle.Secondary)
      );
      const msg = await message.channel.send({ components: [buildCfgC(), funcRow], flags: FLAGS });
      const filter1 = m => m.author.id === message.author.id && m.channel.id === message.channel.id;
      const collector = msg.createMessageComponentCollector({ componentType: ComponentType.Button, time: 120000, filter: i => i.user.id === message.author.id });
      collector.on('collect', async interaction => {
        await interaction.deferUpdate().catch(()=>{});
        const id = interaction.customId;
        if (id !== 'digi_conf_channel' && id !== 'digi_conf_role') return;
        const selectedType = id === 'digi_conf_channel' ? 'channel' : 'role';
        await msg.edit({ components: [container(txt('## 🔐 Digicode — Étape 1/2'), sep(), txt(`Mentionnez ${selectedType==='channel'?'le salon':'le rôle'} à protéger (ID ou mention) :`)), ], flags: FLAGS }).catch(()=>{});
        const c1 = await message.channel.awaitMessages({ filter: filter1, max: 1, time: 30000 }).catch(()=>null);
        if (!c1?.size) { await msg.edit({ components: [container(txt('## ⏰ Annulé'), sep(), txt('Délai dépassé.'))], flags: FLAGS }).catch(()=>{}); collector.stop(); return; }
        const resp = c1.first();
        const targetId = selectedType==='channel' ? (resp.mentions.channels.first()?.id||resp.content.replace(/\D/g,'')) : (resp.mentions.roles.first()?.id||resp.content.replace(/\D/g,''));
        resp.delete().catch(()=>{});
        const valid = selectedType==='channel' ? !!message.guild.channels.cache.get(targetId) : !!message.guild.roles.cache.get(targetId);
        if (!valid) { await msg.edit({ components: [container(txt('## ❌ Introuvable'), sep(), txt('Cible invalide. Relancez `+digicode config`.'))], flags: FLAGS }).catch(()=>{}); collector.stop(); return; }
        await msg.edit({ components: [container(txt('## 🔐 Digicode — Étape 2/2'), sep(), txt('Définissez le code PIN (**4 à 8 chiffres**):')), ], flags: FLAGS }).catch(()=>{});
        const c2 = await message.channel.awaitMessages({ filter: filter1, max: 1, time: 30000 }).catch(()=>null);
        if (!c2?.size) { await msg.edit({ components: [container(txt('## ⏰ Annulé'), sep(), txt('Délai dépassé.'))], flags: FLAGS }).catch(()=>{}); collector.stop(); return; }
        const codeMsg = c2.first(); const code = codeMsg.content.trim(); codeMsg.delete().catch(()=>{});
        if (!/^\d{4,8}$/.test(code)) { await msg.edit({ components: [container(txt('## ❌ Code Invalide'), sep(), txt('Le code doit contenir entre **4 et 8 chiffres** uniquement.'))], flags: FLAGS }).catch(()=>{}); collector.stop(); return; }
        db.set(KEY_CONFIG(guildId), { code, type: selectedType, targetId });
        await msg.edit({ components: [container(txt('## ✅ Digicode Configuré'), sep(), txt(`Fonction: **${selectedType==='channel'?'Salon':'Rôle'}** | Cible: ${selectedType==='channel'?`<#${targetId}>`:`\`${targetId}\``}`))], flags: FLAGS }).catch(()=>{});
        collector.stop('done');
      });
      collector.on('end', async (_,r) => { if (r!=='done'&&r!=='messageDelete') await msg.edit({ components: [buildCfgC()] }).catch(()=>{}); });
      return;
    }

    const config = getConfig(guildId);
    if (!config) return reply(message, errorContainer('Aucun digicode configuré. Utilisez `+digicode config`.'));
    let input = '';
    const buildPadC = () => container(txt('## 🔐 Digicode'), sep(), txt(`\`\`\`\n${input.length ? '●'.repeat(input.length) : '> Saisissez votre code'}\n\`\`\``));
    const msg = await message.channel.send({ components: [buildPadC(), ...buildPadRows()], flags: FLAGS });
    const collector = msg.createMessageComponentCollector({ componentType: ComponentType.Button, time: 120000, filter: i => i.user.id === message.author.id });
    collector.on('collect', async interaction => {
      await interaction.deferUpdate().catch(()=>{});
      const btn = interaction.customId.replace('digi_pad_','');
      if (btn === 'CL') { input=''; await msg.edit({ components: [buildPadC(),...buildPadRows()], flags: FLAGS }).catch(()=>{}); return; }
      if (btn === '✔') {
        if (input === config.code) {
          let actionMsg = 'Accès accordé.';
          if (config.type==='channel') { const channel=message.guild.channels.cache.get(config.targetId); if (channel) { await channel.permissionOverwrites.edit(message.author.id,{ViewChannel:true,SendMessages:true}).catch(()=>{}); actionMsg=`Accès accordé à <#${config.targetId}>.`; } }
          else { const member=await message.guild.members.fetch(message.author.id).catch(()=>null); const role=message.guild.roles.cache.get(config.targetId); if (member&&role) { await member.roles.add(role).catch(()=>{}); actionMsg=`Rôle **${role.name}** (\`${config.targetId}\`) attribué.`; } }
          await msg.edit({ components: [container(txt('## ✅ Accès Accordé'), sep(), txt(actionMsg))], flags: FLAGS }).catch(()=>{}); collector.stop('success');
        } else {
          input=''; await msg.edit({ components: [container(txt('## ❌ Code Incorrect'), sep(), txt('Code erroné. Réessayez.')),...buildPadRows()], flags: FLAGS }).catch(()=>{});
          setTimeout(async () => { await msg.edit({ components: [buildPadC(),...buildPadRows()], flags: FLAGS }).catch(()=>{}); }, 1500);
        }
        return;
      }
      if (input.length < 8) { input+=btn; await msg.edit({ components: [buildPadC(),...buildPadRows()], flags: FLAGS }).catch(()=>{}); }
    });
    collector.on('end', async (_,r) => { if (r!=='success'&&r!=='messageDelete') await msg.edit({ components: [buildPadC()], flags: FLAGS }).catch(()=>{}); });
  }
};
