const { ActionRowBuilder, ButtonBuilder, ButtonStyle, ModalBuilder, TextInputBuilder, TextInputStyle, StringSelectMenuBuilder, StringSelectMenuOptionBuilder } = require('discord.js');
const db = require('../../utils/simpledb');
const EMOJIS = require('../../utils/emojis');
const fs = require('fs'), path = require('path');
const { container, txt, sep, reply, errorContainer, FLAGS } = require('../../utils/v2');

const CATEGORIES = [
  { name: 'Système', emojis: [{ key:'SUCCESS',label:'Succès' },{ key:'ERROR',label:'Erreur' },{ key:'DENIED',label:'Refusé' },{ key:'WARNING',label:'Avertissement' },{ key:'INFO',label:'Info' },{ key:'CHECK',label:'Check' },{ key:'ARROW',label:'Flèche' }] },
  { name: 'Statuts', emojis: [{ key:'ONLINE',label:'En ligne' },{ key:'IDLE',label:'Absent' },{ key:'DND',label:'DND' },{ key:'OFFLINE',label:'Hors ligne' },{ key:'STREAMING',label:'Streaming' }] },
  { name: 'Navigation', emojis: [{ key:'ON',label:'Activé' },{ key:'OFF',label:'Désactivé' },{ key:'PRECEDENT',label:'Précédent' },{ key:'SUIVANT',label:'Suivant' },{ key:'RETOUR',label:'Retour' },{ key:'RELOAD',label:'Recharger' }] },
  { name: 'Utilisateurs', emojis: [{ key:'USER',label:'Utilisateur' },{ key:'ROLE',label:'Rôle' },{ key:'STAFF',label:'Staff' },{ key:'ADMIN',label:'Admin' }] },
  { name: 'Modération', emojis: [{ key:'LOCK',label:'Verrouillage' },{ key:'UNLOCK',label:'Déverrouillage' },{ key:'BAN',label:'Bannissement' },{ key:'PROTECT',label:'Protection' },{ key:'TIMEOUT',label:'Timeout' }] },
  { name: 'Paramètres', emojis: [{ key:'SETTINGS',label:'Paramètres' },{ key:'STATS',label:'Stats' },{ key:'LEVEL',label:'Niveau' },{ key:'PEN',label:'Stylo' }] },
  { name: 'Extras', emojis: [{ key:'RULES',label:'Règlement' },{ key:'NOTIF',label:'Notification' },{ key:'BOOST',label:'Boost' },{ key:'MUSIC',label:'Musique' }] },
  { name: 'Casino', emojis: [{ key:'COIN',label:'Pièce' },{ key:'DICE',label:'Dé' },{ key:'TROPHY',label:'Trophée' },{ key:'CROWN',label:'Couronne' }] }
];
const ALL_EMOJIS = CATEGORIES.flatMap(c => c.emojis);

function loadBuyers() { try { const p = path.join(__dirname, '../../data/buyers.json'); return fs.existsSync(p) ? JSON.parse(fs.readFileSync(p,'utf8'))||{} : {}; } catch { return {}; } }
function getOverrides(guildId) { const data = {}; ALL_EMOJIS.forEach(item => { const v = db.get(`custemoji_${guildId}_${item.key}`); if (v) data[item.key] = v; }); return data; }

const MAX_SAVES = 5;
function getSaveKey(userId, slot) { return `custemoji_save_${userId}_${slot}`; }
function listSaves(userId) { const saves = []; for (let i=0;i<MAX_SAVES;i++) { const s = db.get(getSaveKey(userId,i)); if (s) saves.push({ slot:i,...s }); } return saves; }
function getNextSlot(userId) { for (let i=0;i<MAX_SAVES;i++) { if (!db.get(getSaveKey(userId,i))) return i; } return null; }

module.exports = {
  name: 'custemoji',
  aliases: ['customemoji', 'emojiset'],
  description: 'Personnalise les emojis du bot sur ce serveur.',
  category: 'gestion',
  run: async (client, message) => {
    const isOwner = client.config.owners?.includes(message.author.id) || client.config.superadmin?.includes(message.author.id);
    const isBuyer = !!loadBuyers()[message.author.id];
    if (!isOwner && !isBuyer) return reply(message, errorContainer('Cette commande est réservée aux propriétaires et acheteurs du bot.'));
    const userId = message.author.id, guildId = message.guild.id;
    let catIdx = 0, overrides = getOverrides(guildId);
    const buildC = () => {
      const cat = CATEGORIES[catIdx];
      const lines = cat.emojis.map(item => `• \`${item.key}\` **${item.label}** → ${overrides[item.key] || EMOJIS[item.key] || '—'}`);
      return container(txt(`## 🎨 Emojis — ${cat.name} (${catIdx+1}/${CATEGORIES.length})`), sep(), txt(lines.join('\n')));
    };
    const buildRows = () => {
      const cat = CATEGORIES[catIdx];
      const rows = [];
      for (let i=0;i<cat.emojis.length;i+=5) {
        if (rows.length >= 2) break;
        const chunk = cat.emojis.slice(i,i+5);
        rows.push(new ActionRowBuilder().addComponents(...chunk.map((item,ri) => { const gi = ALL_EMOJIS.findIndex(e => e.key===item.key); return new ButtonBuilder().setCustomId(`ce_edit_${gi}`).setLabel(`✏️ ${item.label}`).setStyle(ButtonStyle.Secondary); })));
      }
      rows.push(new ActionRowBuilder().addComponents(
        new ButtonBuilder().setCustomId('ce_prev').setLabel('◀').setStyle(ButtonStyle.Primary).setDisabled(catIdx<=0),
        new ButtonBuilder().setCustomId('ce_reset').setLabel('Reset').setStyle(ButtonStyle.Danger),
        new ButtonBuilder().setCustomId('ce_next').setLabel('▶').setStyle(ButtonStyle.Primary).setDisabled(catIdx>=CATEGORIES.length-1)
      ));
      rows.push(new ActionRowBuilder().addComponents(
        new ButtonBuilder().setCustomId('ce_save').setLabel('💾 Sauvegarder').setStyle(ButtonStyle.Success),
        new ButtonBuilder().setCustomId('ce_load').setLabel('📂 Charger').setStyle(ButtonStyle.Primary)
      ));
      return rows;
    };
    const msg = await message.channel.send({ components: [buildC(), ...buildRows()], flags: FLAGS });
    const refresh = () => { overrides = getOverrides(guildId); return msg.edit({ components: [buildC(), ...buildRows()], flags: FLAGS }).catch(()=>{}); };
    const col = msg.createMessageComponentCollector({ time: 180000, filter: i => i.user.id === userId });
    col.on('collect', async interaction => {
      const id = interaction.customId;
      if (id.startsWith('ce_edit_')) {
        const gi = parseInt(id.split('_')[2]); const item = ALL_EMOJIS[gi]; if (!item) return;
        const modal = new ModalBuilder().setCustomId(`ce_modal_${gi}`).setTitle(`Modifier : ${item.label}`).addComponents(new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('emoji_input').setLabel(`Emoji pour "${item.label}"`).setStyle(TextInputStyle.Short).setPlaceholder('Ex: <:nom:123456789> ou ✅').setValue(overrides[item.key]||EMOJIS[item.key]||'').setRequired(true)));
        await interaction.showModal(modal);
        try {
          const sub = await interaction.awaitModalSubmit({ filter: i => i.customId===`ce_modal_${gi}` && i.user.id===userId, time: 60000 });
          const newEmoji = sub.fields.getTextInputValue('emoji_input').trim();
          if (!newEmoji.length) { await sub.reply({ content: 'Emoji invalide.', ephemeral: true }); return; }
          db.set(`custemoji_${guildId}_${item.key}`, newEmoji);
          await sub.reply({ content: `✅ **${item.label}** mis à jour → ${newEmoji}`, ephemeral: true });
          await refresh();
        } catch {}
        return;
      }
      if (id === 'ce_prev') { await interaction.deferUpdate(); catIdx = Math.max(0,catIdx-1); await refresh(); return; }
      if (id === 'ce_next') { await interaction.deferUpdate(); catIdx = Math.min(CATEGORIES.length-1,catIdx+1); await refresh(); return; }
      if (id === 'ce_reset') { await interaction.deferUpdate(); ALL_EMOJIS.forEach(item => db.delete(`custemoji_${guildId}_${item.key}`)); await refresh(); return; }
      if (id === 'ce_save') {
        const snap = getOverrides(guildId);
        if (!Object.keys(snap).length) { await interaction.reply({ content: 'Aucune personnalisation à sauvegarder.', ephemeral: true }); return; }
        const slot = getNextSlot(userId);
        if (slot===null) { await interaction.reply({ content: `Limite de ${MAX_SAVES} sauvegardes atteinte.`, ephemeral: true }); return; }
        const modal = new ModalBuilder().setCustomId('ce_modal_save_name').setTitle('Nommer la sauvegarde').addComponents(new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('save_name').setLabel('Nom').setStyle(TextInputStyle.Short).setPlaceholder('Ex: Thème principal').setMaxLength(30).setRequired(true)));
        await interaction.showModal(modal);
        try {
          const sub = await interaction.awaitModalSubmit({ filter: i => i.customId==='ce_modal_save_name' && i.user.id===userId, time: 60000 });
          const name = sub.fields.getTextInputValue('save_name').trim();
          db.set(getSaveKey(userId,slot), { name, guildId, guildName: message.guild.name, data: snap, createdAt: Date.now() });
          await sub.reply({ content: `✅ Sauvegarde **"${name}"** créée (slot ${slot+1}).`, ephemeral: true });
        } catch {}
        return;
      }
      if (id === 'ce_load') {
        await interaction.deferUpdate();
        const saves = listSaves(userId);
        if (!saves.length) { await msg.edit({ components: [container(txt('## 📂 Sauvegardes'), sep(), txt('Aucune sauvegarde disponible.')), new ActionRowBuilder().addComponents(new ButtonBuilder().setCustomId('ce_back_from_saves').setLabel('↩ Retour').setStyle(ButtonStyle.Secondary))], flags: FLAGS }).catch(()=>{}); return; }
        const opts = saves.map(s => new StringSelectMenuOptionBuilder().setLabel(`Slot ${s.slot+1} — ${s.name}`).setValue(`load_${s.slot}`));
        const delOpts = saves.map(s => new StringSelectMenuOptionBuilder().setLabel(`🗑️ ${s.name}`).setValue(`delete_${s.slot}`));
        await msg.edit({ components: [container(txt(`## 📂 Sauvegardes (${saves.length}/${MAX_SAVES})`), sep(), txt(saves.map(s=>`**Slot ${s.slot+1}:** ${s.name} (${Object.keys(s.data).length} emojis)`).join('\n'))), new ActionRowBuilder().addComponents(new StringSelectMenuBuilder().setCustomId('ce_load_select').setPlaceholder('Charger...').addOptions(opts)), new ActionRowBuilder().addComponents(new StringSelectMenuBuilder().setCustomId('ce_delete_save_select').setPlaceholder('Supprimer...').addOptions(delOpts)), new ActionRowBuilder().addComponents(new ButtonBuilder().setCustomId('ce_back_from_saves').setLabel('↩ Retour').setStyle(ButtonStyle.Secondary))], flags: FLAGS }).catch(()=>{});
        return;
      }
      if (id === 'ce_back_from_saves') { await interaction.deferUpdate(); await refresh(); return; }
      if (id === 'ce_load_select') { await interaction.deferUpdate(); const slot = parseInt(interaction.values[0].replace('load_','')); const save = db.get(getSaveKey(userId,slot)); if (!save) return; Object.entries(save.data).forEach(([k,v]) => db.set(`custemoji_${guildId}_${k}`,v)); await refresh(); return; }
      if (id === 'ce_delete_save_select') { await interaction.deferUpdate(); const slot = parseInt(interaction.values[0].replace('delete_','')); db.delete(getSaveKey(userId,slot)); await refresh(); return; }
    });
    col.on('end', () => msg.edit({ components: [buildC()], flags: FLAGS }).catch(()=>{}));
  }
};
