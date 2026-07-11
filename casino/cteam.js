const { ComponentType, PermissionsBitField, ModalBuilder, TextInputBuilder, TextInputStyle, ActionRowBuilder: DjsActionRowBuilder } = require('discord.js');
const { ActionRowBuilder, ButtonBuilder, ButtonStyle, StringSelectMenuBuilder } = require('discord.js');
const { container, txt, sep, reply, errorContainer, FLAGS } = require('../../utils/v2');
const Casino = require('../../utils/casino');
const Teams = require('../../utils/casinoTeams');

function fmtUser(id) { return `<@${id}>`; }

async function syncTeamChannelsPermissions(guild, team) {
  try {
    if (!team.channels) return;
    const everyone = guild.roles.everyone;
    const memberIds = new Set(team.members || []);
    const overwrites = [{ id: everyone.id, deny: [PermissionsBitField.Flags.ViewChannel] }];
    for (const uid of memberIds) overwrites.push({ id: uid, allow: [PermissionsBitField.Flags.ViewChannel, PermissionsBitField.Flags.SendMessages, PermissionsBitField.Flags.ReadMessageHistory, PermissionsBitField.Flags.Connect, PermissionsBitField.Flags.Speak] });
    const apply = async (chId) => { if (!chId) return; const ch = guild.channels.cache.get(chId); if (!ch) return; await ch.permissionOverwrites.set(overwrites.map(o => ({ id: o.id, allow: o.allow || [], deny: o.deny || [] }))).catch(() => {}); };
    await apply(team.channels.textId);
    await apply(team.channels.voiceId);
  } catch {}
}

module.exports = {
  name: 'cteam',
  aliases: ['team'],
  usage: '+cteam help',
  category: 'casino',
  run: async (client, message, args) => {
    if (!message.guild) return;
    const sub = (args[0] || 'help').toLowerCase();
    const meId = message.author.id;
    const guildId = message.guild.id;
    const cfg = Teams.getConfig(guildId);
    const replyErr = (msg) => reply(message, errorContainer(msg));

    if (sub === 'help') {
      return reply(message, container(
        txt('## 🔥 Système de Teams — Zoom Casino'),
        sep(),
        txt([
          '**Création & Gestion**',
          '`+cteam create <nom>` • Créer | `+cteam invite <@user>` • Inviter | `+cteam accept` • Accepter',
          '`+cteam leave` • Quitter | `+cteam kick <@user>` • Expulser | `+cteam promote <@user>` • Leader',
          '`+cteam disband` • Dissoudre | `+cteam officer add/remove <@user>` • Officiers',
          '',
          '**Infos**',
          '`+cteam profile` • Profil | `+cteam members` • Membres | `+cteam xp` • XP | `+cteam top [bank|members|xp]`',
          '',
          '**Banque & Paye**',
          '`+cteam bank deposit <montant>` | `+cteam bank withdraw <montant>` | `+cteam payroll set <montant>`',
          '',
          '**Personnalisation**',
          '`+cteam customize banner/thumb/color/desc/emoji/tag/visibility <valeur>`',
          '',
          '**Panel**',
          '`+cteam panel` • Panneau interactif',
          `\n**Max membres:** ${cfg.maxMembers} | **Coût création:** ${cfg.creationCost}`
        ].join('\n'))
      ));
    }

    if (sub === 'panel') {
      try {
        const teamId = Teams.getUserTeamId(meId);
        if (!teamId) return replyErr('Tu n\'as pas de team.');
        const team = Teams.getTeam(teamId);
        if (!team) return replyErr('Team introuvable.');
        if (!Teams.canManage(team, meId)) return replyErr('Permission insuffisante.');
        const render = () => {
          const t = Teams.getTeam(team.id) || team;
          return container(txt(`## ${t.customize?.emoji || '🔰'} Panel — ${t.name}`), sep(), txt([`**Banque :** ${t.bank || 0} JTN | **Paye/jour :** ${t.payroll || 0} | **Membres :** ${t.members?.length || 0}`].join('\n')));
        };
        const idBase = `ctp_${message.id}_${Date.now()}`;
        const row1 = new ActionRowBuilder().addComponents(
          new ButtonBuilder().setCustomId(`${idBase}_customize`).setLabel('🎨 Personnaliser').setStyle(ButtonStyle.Primary),
          new ButtonBuilder().setCustomId(`${idBase}_payroll`).setLabel('💸 Paye').setStyle(ButtonStyle.Secondary),
          new ButtonBuilder().setCustomId(`${idBase}_deposit`).setLabel('🏦 Déposer').setStyle(ButtonStyle.Success),
          new ButtonBuilder().setCustomId(`${idBase}_withdraw`).setLabel('🏧 Retirer').setStyle(ButtonStyle.Danger)
        );
        const row2 = new ActionRowBuilder().addComponents(
          new ButtonBuilder().setCustomId(`${idBase}_syncpriv`).setLabel('🔒 Sync privés').setStyle(ButtonStyle.Secondary),
          new ButtonBuilder().setCustomId(`${idBase}_close`).setLabel('✖ Fermer').setStyle(ButtonStyle.Danger)
        );
        const msg = await message.channel.send({ components: [render(), row1, row2], flags: FLAGS });
        const collector = msg.createMessageComponentCollector({ time: 5 * 60 * 1000, filter: i => i.user.id === meId });
        const ask = async (q) => {
          await message.reply({ content: `${q} (30s)`, allowedMentions: { repliedUser: false } }).catch(() => {});
          const coll = await message.channel.awaitMessages({ filter: m => m.author.id === meId, max: 1, time: 30000 }).catch(() => null);
          const m = coll && coll.first();
          return m ? m.content.trim() : null;
        };
        collector.on('collect', async i => {
          if (!i.customId.startsWith(idBase)) return i.deferUpdate().catch(() => {});
          const action = i.customId.slice(idBase.length + 1);
          if (action === 'close') { collector.stop('close'); return i.update({ components: [render()], flags: FLAGS }); }
          if (action === 'syncpriv') { await syncTeamChannelsPermissions(message.guild, team); return i.reply({ content: '✅ Permissions synchronisées.', ephemeral: true }).catch(() => {}); }
          try { await i.deferUpdate(); } catch {}
          if (action === 'payroll') { const val = await ask('Entre le montant de la paye journalière'); if (!val) return; const r = Teams.setPayroll(team, meId, parseInt(val, 10)); if (!r.ok) return message.reply(`❌ ${r.error}`); await msg.edit({ components: [render(), row1, row2], flags: FLAGS }).catch(() => {}); return; }
          if (action === 'deposit') { const val = await ask('Montant à déposer dans la banque de la team'); if (!val) return; const r = Teams.deposit(team, meId, parseInt(val, 10)); if (!r.ok) return message.reply(`❌ ${r.error}`); await msg.edit({ components: [render(), row1, row2], flags: FLAGS }).catch(() => {}); return; }
          if (action === 'withdraw') { const val = await ask('Montant à retirer (leader uniquement)'); if (!val) return; const r = Teams.withdraw(team, meId, parseInt(val, 10)); if (!r.ok) return message.reply(`❌ ${r.error}`); await msg.edit({ components: [render(), row1, row2], flags: FLAGS }).catch(() => {}); return; }
          if (action === 'customize') {
            const selectId = `${idBase}_csel`;
            const menu = new StringSelectMenuBuilder().setCustomId(selectId).setPlaceholder('Choisis un champ').addOptions([
              { label: 'Bannière (URL)', value: 'banner' }, { label: 'Miniature (URL)', value: 'thumb' },
              { label: 'Couleur (hex)', value: 'color' }, { label: 'Description', value: 'desc' },
              { label: 'Emoji', value: 'emoji' }, { label: 'Tag', value: 'tag' }, { label: 'Visibilité', value: 'visibility' }
            ]);
            const selMsg = await i.followUp({ content: 'Sélectionne le champ à personnaliser:', components: [new ActionRowBuilder().addComponents(menu)], ephemeral: true }).catch(() => null);
            if (!selMsg) return;
            const selCol = selMsg.createMessageComponentCollector({ time: 60000, filter: ii => ii.user.id === meId && ii.customId === selectId });
            selCol.on('collect', async ii => {
              try {
                const chosen = Array.isArray(ii.values) ? ii.values[0] : null;
                if (!chosen) return ii.update({ content: 'Sélection invalide.', components: [] });
                let value;
                if (chosen === 'visibility') {
                  const visId = `${idBase}_vsel`;
                  const vmenu = new StringSelectMenuBuilder().setCustomId(visId).setPlaceholder('Visibilité').addOptions([{ label: 'public', value: 'public' }, { label: 'private', value: 'private' }]);
                  const vMsg = await i.followUp({ content: 'Visibilité:', components: [new ActionRowBuilder().addComponents(vmenu)], ephemeral: true }).catch(() => null);
                  if (vMsg) {
                    const vCol = vMsg.createMessageComponentCollector({ time: 30000, filter: vi => vi.user.id === meId && vi.customId === visId });
                    value = await new Promise(resolve => { vCol.on('collect', async vi => { try { resolve(vi.values[0]); await vi.update({ components: [] }); } catch { resolve(null); } }); vCol.on('end', () => resolve(null)); });
                  }
                } else {
                  const modalId = `${idBase}_modal_${chosen}`;
                  const modal = new ModalBuilder().setCustomId(modalId).setTitle(`Modifier ${chosen}`);
                  const input = new TextInputBuilder().setCustomId('val').setLabel('Nouvelle valeur').setStyle(TextInputStyle.Short).setRequired(true).setMaxLength(chosen === 'desc' ? 500 : 200);
                  modal.addComponents(new DjsActionRowBuilder().addComponents(input));
                  try {
                    await ii.showModal(modal);
                    const submitted = await ii.awaitModalSubmit({ time: 60000, filter: m => m.user.id === meId && m.customId === modalId }).catch(() => null);
                    if (!submitted) return;
                    value = submitted.fields.getTextInputValue('val');
                    try { await submitted.reply({ content: '✅ Valeur reçue !', ephemeral: true }); } catch {}
                  } catch { value = null; }
                }
                if (!value) return;
                const patch = {}; patch[chosen] = value;
                const r = Teams.customize(team, meId, patch);
                if (!r.ok) return message.reply(`❌ ${r.error}`);
                await msg.edit({ components: [render(), row1, row2], flags: FLAGS }).catch(() => {});
              } catch {}
            });
          }
        });
        collector.on('end', async () => { try { await msg.edit({ components: [render()], flags: FLAGS }); } catch {} });
        return;
      } catch (err) { return replyErr(`Panel erreur: ${err?.message || err}`); }
    }

    if (sub === 'create') {
      const name = args.slice(1).join(' ').trim();
      if (!name) return replyErr('Nom requis: `+cteam create <nom>`');
      if (Teams.getUserTeamId(meId)) return replyErr('Tu es déjà dans une team.');
      const cost = cfg.creationCost;
      if (!Casino.hasEnoughCasino(meId, cost)) return replyErr(`Fonds insuffisants (${Casino.getCasinoBalance(meId)}) — coût: ${cost}`);
      if (!Teams.isNameAvailable(guildId, name)) return replyErr('Nom déjà pris.');
      const res = Teams.createTeam({ guildId, leaderId: meId, name, tag: null });
      if (!res.ok) return replyErr(res.error || 'Création impossible.');
      Casino.deductCasinoCredits(meId, cost);
      return reply(message, container(txt('## ✅ Team Créée'), sep(), txt([`**Nom :** ${res.team.name} | **ID :** ${res.team.id}`, `**Leader :** ${fmtUser(meId)}`, 'Utilise `+cteam invite @membre` pour recruter.'].join('\n'))));
    }

    if (sub === 'invite') {
      const teamId = Teams.getUserTeamId(meId);
      if (!teamId) return replyErr('Tu dois être dans une team.');
      const team = Teams.getTeam(teamId);
      if (!team) return replyErr('Team introuvable.');
      if (!Teams.canManage(team, meId)) return replyErr('Seul le leader/officiers peuvent inviter.');
      const target = message.mentions.users.first();
      if (!target) return replyErr('Mentionne un utilisateur: `+cteam invite @user`');
      if (Teams.getUserTeamId(target.id)) return replyErr('Cet utilisateur est déjà dans une team.');
      Teams.inviteUser(team, meId, target.id, 10);
      const acceptId = `ct_acc_${message.id}_${target.id}`, declineId = `ct_dec_${message.id}_${target.id}`;
      const row = new ActionRowBuilder().addComponents(
        new ButtonBuilder().setCustomId(acceptId).setLabel('✅ Accepter').setStyle(ButtonStyle.Success),
        new ButtonBuilder().setCustomId(declineId).setLabel('❌ Refuser').setStyle(ButtonStyle.Danger)
      );
      const msg = await message.channel.send({ components: [container(txt(`## 📨 Invitation — ${team.name}`), sep(), txt(`${fmtUser(target.id)} tu es invité(e) par ${fmtUser(meId)}. Expire dans 10 min.`)), row], flags: FLAGS });
      const collector = msg.createMessageComponentCollector({ componentType: ComponentType.Button, time: 10 * 60 * 1000 });
      collector.on('collect', async i => {
        try {
          if (i.user.id !== target.id) return i.reply({ content: 'Non autorisé.', ephemeral: true });
          if (i.customId === acceptId) {
            const r = Teams.acceptInvite(target.id);
            if (!r.ok) return i.reply({ content: `❌ ${r.error}`, ephemeral: true });
            await i.update({ components: [container(txt('## ✅ Invitation Acceptée'), sep(), txt(`${fmtUser(target.id)} a rejoint **${r.team.name}** !`))], flags: FLAGS });
            await syncTeamChannelsPermissions(message.guild, r.team);
          } else {
            await i.update({ components: [container(txt('## ❌ Invitation Refusée'), sep(), txt(`${fmtUser(target.id)} a refusé l'invitation.`))], flags: FLAGS });
          }
          collector.stop();
        } catch { try { await i.deferUpdate(); } catch {} }
      });
      collector.on('end', async () => { try { await msg.edit({ components: [container(txt('## 📨 Invitation expirée.'))], flags: FLAGS }); } catch {} });
      return;
    }

    if (sub === 'accept') { const r = Teams.acceptInvite(meId); if (!r.ok) return replyErr(r.error); return reply(message, container(txt('## ✅ Bienvenue !'), sep(), txt(`Tu as rejoint **${r.team.name}** !`))); }

    if (sub === 'leave') { const r = Teams.leaveTeam(meId); if (!r.ok) return replyErr(r.error); if (r.team) await syncTeamChannelsPermissions(message.guild, r.team); return reply(message, container(txt('## 👋 Team Quittée'), sep(), txt('Tu as quitté ta team.'))); }

    if (sub === 'kick') {
      const teamId = Teams.getUserTeamId(meId); if (!teamId) return replyErr('Tu dois être dans une team.');
      const team = Teams.getTeam(teamId); if (!Teams.canManage(team, meId)) return replyErr('Permission insuffisante.');
      const target = message.mentions.users.first(); if (!target) return replyErr('Mentionne un utilisateur.');
      const r = Teams.kickMember(team, meId, target.id); if (!r.ok) return replyErr(r.error);
      await syncTeamChannelsPermissions(message.guild, team);
      return reply(message, container(txt('## ✅ Membre Expulsé'), sep(), txt(`${fmtUser(target.id)} a été expulsé de la team.`)));
    }

    if (sub === 'promote') {
      const teamId = Teams.getUserTeamId(meId); if (!teamId) return replyErr('Tu dois être dans une team.');
      const team = Teams.getTeam(teamId);
      const target = message.mentions.users.first(); if (!target) return replyErr('Mentionne un utilisateur.');
      const r = Teams.promoteLeader(team, meId, target.id); if (!r.ok) return replyErr(r.error);
      return reply(message, container(txt('## 👑 Nouveau Leader'), sep(), txt(`${fmtUser(target.id)} est maintenant le leader.`)));
    }

    if (sub === 'officer') {
      const action = (args[1] || '').toLowerCase(); const target = message.mentions.users.first();
      const teamId = Teams.getUserTeamId(meId); if (!teamId) return replyErr('Tu dois être dans une team.');
      const team = Teams.getTeam(teamId); if (team.leaderId !== meId) return replyErr('Seul le leader peut gérer les officiers.');
      if (!['add', 'remove', 'del'].includes(action) || !target) return replyErr('Usage: `+cteam officer <add|remove> <@user>`');
      const r = action === 'add' ? Teams.addOfficer(team, meId, target.id) : Teams.removeOfficer(team, meId, target.id);
      if (!r.ok) return replyErr(r.error);
      await syncTeamChannelsPermissions(message.guild, team);
      return reply(message, container(txt(`## 🛡️ Officier ${action === 'add' ? 'Ajouté' : 'Retiré'}`), sep(), txt(`${fmtUser(target.id)} ${action === 'add' ? 'est maintenant officier.' : 'n\'est plus officier.'}`)));
    }

    if (sub === 'disband') {
      const teamId = Teams.getUserTeamId(meId); if (!teamId) return replyErr('Tu dois être dans une team.');
      const team = Teams.getTeam(teamId); if (team.leaderId !== meId) return replyErr('Seul le leader peut dissoudre.');
      if (team.channels) {
        try { const ch = message.guild.channels.cache.get(team.channels.textId); if (ch) await ch.delete('Team disband'); } catch {}
        try { const ch = message.guild.channels.cache.get(team.channels.voiceId); if (ch) await ch.delete('Team disband'); } catch {}
      }
      const r = Teams.disbandTeam(team, meId); if (!r.ok) return replyErr('Échec.');
      return reply(message, container(txt('## 💣 Team Dissoute'), sep(), txt('La team a été dissoute.')));
    }

    if (sub === 'profile') {
      const teamId = Teams.getUserTeamId(meId); if (!teamId) return replyErr('Tu n\'as pas de team.');
      const t = Teams.getTeam(teamId);
      return reply(message, container(txt(`## ${t.customize?.emoji || '🔰'} ${t.name}${t.tag ? ` [${t.tag}]` : ''}`), sep(), txt([t.customize?.desc || '', `**Leader :** ${fmtUser(t.leaderId)} | **Membres :** ${t.members?.length || 0}`, `**Banque :** ${t.bank || 0} JTN | **Paye/jour :** ${t.payroll || 0} | **XP :** ${t.xp || 0}`, `**Créée :** ${new Date(t.createdAt).toLocaleString('fr-FR')}`].filter(Boolean).join('\n'))));
    }

    if (sub === 'members') {
      const teamId = Teams.getUserTeamId(meId); if (!teamId) return replyErr('Tu n\'as pas de team.');
      const t = Teams.getTeam(teamId);
      const lines = (t.members || []).map(uid => { const role = uid === t.leaderId ? '👑 Leader' : (t.officers || []).includes(uid) ? '🛡️ Officier' : '👤 Membre'; return `• ${fmtUser(uid)} — ${role} — solde: ${Casino.getCasinoBalance(uid)} JTN`; });
      return reply(message, container(txt(`## 👥 Membres — ${t.name}`), sep(), txt(lines.join('\n') || 'Aucun.')));
    }

    if (sub === 'xp') {
      const teamId = Teams.getUserTeamId(meId); if (!teamId) return replyErr('Tu n\'as pas de team.');
      const t = Teams.getTeam(teamId);
      return reply(message, container(txt(`## 📈 XP — ${t.name}`), sep(), txt(`**XP total :** ${t.xp || 0}`)));
    }

    if (sub === 'top') {
      const by = (args[1] || 'bank').toLowerCase();
      const list = Teams.topTeams(guildId, by);
      const lines = list.map((t, i) => { const metric = by === 'members' ? t.members?.length || 0 : by === 'xp' ? t.xp || 0 : t.bank || 0; return `**#${i+1}** ${t.customize?.emoji || '🔰'} **${t.name}**${t.tag ? ` [${t.tag}]` : ''} — ${metric}`; });
      return reply(message, container(txt(`## 🏆 Classement Teams — ${by}`), sep(), txt(lines.join('\n') || 'Aucune team.')));
    }

    if (sub === 'customize') {
      const teamId = Teams.getUserTeamId(meId); if (!teamId) return replyErr('Tu n\'as pas de team.');
      const team = Teams.getTeam(teamId);
      const field = (args[1] || '').toLowerCase(), value = args.slice(2).join(' ').trim();
      if (!field || !value) return replyErr('Usage: `+cteam customize <banner|thumb|color|desc|emoji|tag|visibility> <valeur>`');
      const patch = {};
      if (field === 'banner') patch.banner = value;
      else if (field === 'thumb') patch.thumb = value;
      else if (field === 'color') patch.color = value;
      else if (field === 'desc') patch.desc = value.slice(0, 500);
      else if (field === 'emoji') patch.emoji = value;
      else if (field === 'tag') patch.tag = value.slice(0, 6).toUpperCase();
      else if (field === 'visibility') patch.visibility = ['public', 'private'].includes(value.toLowerCase()) ? value.toLowerCase() : 'public';
      else return replyErr('Champ inconnu. Options: `banner, thumb, color, desc, emoji, tag, visibility`');
      const r = Teams.customize(team, meId, patch); if (!r.ok) return replyErr(r.error);
      return reply(message, container(txt('## ✅ Personnalisation Mise à Jour'), sep(), txt(`Champ **${field}** modifié.`)));
    }

    if (sub === 'payroll') {
      const action = (args[1] || '').toLowerCase(); if (action !== 'set') return replyErr('Usage: `+cteam payroll set <montant>`');
      const teamId = Teams.getUserTeamId(meId); if (!teamId) return replyErr('Tu n\'as pas de team.');
      const team = Teams.getTeam(teamId);
      const r = Teams.setPayroll(team, meId, parseInt(args[2], 10)); if (!r.ok) return replyErr(r.error);
      return reply(message, container(txt('## ✅ Paye Réglée'), sep(), txt(`Paye journalière : **${r.amount} JTN**`)));
    }

    if (sub === 'bank') {
      const action = (args[1] || '').toLowerCase(), amount = parseInt(args[2], 10);
      const teamId = Teams.getUserTeamId(meId); if (!teamId) return replyErr('Tu n\'as pas de team.');
      const team = Teams.getTeam(teamId);
      if (action === 'deposit') { const r = Teams.deposit(team, meId, amount); if (!r.ok) return replyErr(r.error); return reply(message, container(txt('## ✅ Dépôt Effectué'), sep(), txt(`Banque : **${r.bank} JTN**`))); }
      if (action === 'withdraw') { const r = Teams.withdraw(team, meId, amount); if (!r.ok) return replyErr(r.error); return reply(message, container(txt('## ✅ Retrait Effectué'), sep(), txt(`Banque : **${r.bank} JTN**`))); }
      return replyErr('Usage: `+cteam bank deposit <montant>` | `+cteam bank withdraw <montant>`');
    }

    if (sub === 'private') {
      const action = (args[1] || '').toLowerCase(), which = (args[2] || '').toLowerCase(), name = args.slice(3).join(' ').trim();
      const teamId = Teams.getUserTeamId(meId); if (!teamId) return replyErr('Tu dois être dans une team.');
      const team = Teams.getTeam(teamId); if (!Teams.canManage(team, meId)) return replyErr('Permission insuffisante.');
      if (!['create', 'delete', 'del', 'sync'].includes(action)) return replyErr('Usage: `+cteam private <create|delete|sync> [text|voice] [nom]`');
      if (action === 'sync') { await syncTeamChannelsPermissions(message.guild, team); return reply(message, container(txt('## ✅ Permissions Synchronisées'), sep(), txt('Salons privés mis à jour.'))); }
      if (!['text', 'voice'].includes(which)) return replyErr('Spécifie `text` ou `voice`.');
      const everyone = message.guild.roles.everyone;
      const overwrites = [{ id: everyone.id, deny: [PermissionsBitField.Flags.ViewChannel] }, ...(team.members || []).map(uid => ({ id: uid, allow: [PermissionsBitField.Flags.ViewChannel, PermissionsBitField.Flags.SendMessages, PermissionsBitField.Flags.ReadMessageHistory, PermissionsBitField.Flags.Connect, PermissionsBitField.Flags.Speak] }))];
      if (['create'].includes(action)) {
        if (!team.channels) team.channels = { textId: null, voiceId: null };
        if (which === 'text' && team.channels.textId) return replyErr('Salon texte déjà créé.');
        if (which === 'voice' && team.channels.voiceId) return replyErr('Salon vocal déjà créé.');
        const baseName = name || `${team.tag || 'team'}-${which}`;
        const ch = await message.guild.channels.create({ name: baseName, type: which === 'text' ? 0 : 2, permissionOverwrites: overwrites }).catch(() => null);
        if (!ch) return replyErr('Création échouée.');
        if (which === 'text') team.channels.textId = ch.id; else team.channels.voiceId = ch.id;
        Teams.saveTeam(team);
        return reply(message, container(txt('## ✅ Salon Privé Créé'), sep(), txt(`Salon **${ch.name}** créé pour la team.`)));
      } else {
        if (!team.channels) return replyErr('Aucun salon enregistré.');
        const chId = which === 'text' ? team.channels.textId : team.channels.voiceId;
        if (!chId) return replyErr('Aucun salon de ce type.');
        try { const ch = message.guild.channels.cache.get(chId); if (ch) await ch.delete('Team private delete'); } catch {}
        if (which === 'text') team.channels.textId = null; else team.channels.voiceId = null;
        Teams.saveTeam(team);
        return reply(message, container(txt('## ✅ Salon Supprimé'), sep(), txt('Salon privé supprimé.')));
      }
    }

    return reply(message, errorContainer('Utilise `+cteam help` pour voir les commandes.'));
  }
};
