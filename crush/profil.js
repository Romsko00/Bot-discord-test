const {
  ActionRowBuilder, ButtonBuilder, ButtonStyle,
  ModalBuilder, TextInputBuilder, TextInputStyle,
  StringSelectMenuBuilder, StringSelectMenuOptionBuilder
} = require('discord.js');
const { container, txt, sep, row, btn, media, reply, errorContainer, FLAGS } = require('../../utils/v2');
const { hasPermissionLevel } = require('../../utils/permissionUtils');
const db = require('../../utils/simpledb');

// ══════════════════════════════════════════════════════════════════
//  HELPERS
// ══════════════════════════════════════════════════════════════════

function isValidUrl(s) {
  try { new URL(s); return true; } catch { return false; }
}
function isImgUrl(s) {
  try { return /\.(jpe?g|png|gif|webp|avif)($|\?)/i.test(new URL(s).pathname); } catch { return false; }
}

function gKey(gid, uid)  { return `crush_profile_${gid}_${uid}`; }
function tmp1Key(gid, uid){ return `crush_modal1_${gid}_${uid}`; }
function likeKey(gid, uid){ return `crush_likes_${gid}_${uid}`; }
function likersKey(gid, uid){ return `crush_likers_${gid}_${uid}`; }
function pendingKey(gid, uid){ return `crush_pending_${gid}_${uid}`; }
function cfgKey(gid)     { return `crush_config_${gid}`; }

function getConfig(gid) {
  return db.get(cfgKey(gid)) || {
    chanHomme: null, chanFemme: null, chanAutre: null,
    chanReport: null, chanMatch: null,
    requireApproval: false, allowLikes: true, allowEdit: true,
    minAge: 16, maxAge: 99
  };
}
function saveConfig(gid, cfg) { db.set(cfgKey(gid), cfg); }

function genreToType(genre) {
  const g = genre.toLowerCase();
  if (g.includes('homme') || g === 'h' || g === 'm' || g === 'man' || g === 'male') return 'homme';
  if (g.includes('femme') || g === 'f' || g === 'w' || g === 'woman' || g === 'female') return 'femme';
  return 'autre';
}

function getChanForType(cfg, type) {
  if (type === 'homme') return cfg.chanHomme;
  if (type === 'femme') return cfg.chanFemme;
  return cfg.chanAutre;
}

// ── Construit la carte profil complète ──────────────────────────────
function buildProfileCard(profile, guild) {
  const member = guild?.members?.cache?.get(profile.userId);
  const displayName = member ? member.displayName : profile.prenom;
  const likes = (db.get(likeKey(guild?.id, profile.userId)) || []).length;

  const info = [
    `**Prénom :** ${profile.prenom}`,
    `**Genre :** ${profile.genre}`,
    `**Âge :** ${profile.age} ans`,
    `**Ville :** ${profile.ville}`,
    `**Origine :** ${profile.origine}`,
  ].join('\n');

  const stats = [
    `**Publié le :** <t:${Math.floor(profile.createdAt / 1000)}:D>`,
    `**Likes :** ❤️ ${likes}`,
    profile.editedAt ? `**Modifié le :** <t:${Math.floor(profile.editedAt / 1000)}:R>` : ''
  ].filter(Boolean).join('\n');

  const parts = [
    txt(`## 💘 Profil — ${displayName} (${profile.genre})`),
    sep(),
    txt(info),
    sep(),
    txt(profile.description),
    sep(),
    txt(`💕 **Recherche :** ${profile.recherche}`),
    sep(),
    txt(stats)
  ];

  if (profile.photo && isImgUrl(profile.photo)) {
    parts.push(media([profile.photo]));
  }

  return container(...parts);
}

// ── Boutons affichés sous un profil public ──────────────────────────
function profileActionRow(userId, gid, viewerIsOwner, cfg) {
  const btns = [];
  if (!viewerIsOwner && cfg.allowLikes) {
    btns.push(btn(`crush_like_${userId}`, 'Like', ButtonStyle.Success, '❤️'));
  }
  if (viewerIsOwner && cfg.allowEdit) {
    btns.push(btn(`crush_edit_${userId}`, 'Modifier', ButtonStyle.Primary, '✏️'));
    btns.push(btn(`crush_delete_${userId}`, 'Supprimer', ButtonStyle.Danger, '🗑️'));
  }
  if (!viewerIsOwner) {
    btns.push(btn(`crush_report_${userId}`, 'Signaler', ButtonStyle.Secondary, '🚨'));
  }
  if (!btns.length) return null;
  return new ActionRowBuilder().addComponents(...btns);
}

// ══════════════════════════════════════════════════════════════════
//  PANEL DE CONFIGURATION
// ══════════════════════════════════════════════════════════════════

async function showAdminPanel(client, message) {
  const gid = message.guild.id;
  const cfg = getConfig(gid);

  const chanName = (id) => id
    ? (message.guild.channels.cache.get(id)?.name ? `#${message.guild.channels.cache.get(id).name}` : `~~salon supprimé~~`)
    : '*(non configuré)*';

  const overview = container(
    txt('## ⚙️ Configuration — Profils Crush'),
    sep(),
    txt([
      `**Salon Hommes :** ${chanName(cfg.chanHomme)}`,
      `**Salon Femmes :** ${chanName(cfg.chanFemme)}`,
      `**Salon Autres :** ${chanName(cfg.chanAutre)}`,
      `**Salon Reports :** ${chanName(cfg.chanReport)}`,
      `**Salon Matchs :** ${chanName(cfg.chanMatch)}`,
    ].join('\n')),
    sep(),
    txt([
      `**Approbation requise :** ${cfg.requireApproval ? '✅ Oui' : '❌ Non'}`,
      `**Likes activés :** ${cfg.allowLikes ? '✅ Oui' : '❌ Non'}`,
      `**Modification activée :** ${cfg.allowEdit ? '✅ Oui' : '❌ Non'}`,
      `**Âge minimum :** ${cfg.minAge} ans`,
      `**Âge maximum :** ${cfg.maxAge} ans`,
    ].join('\n')),
    row(
      btn('cp_chan',    'Salons',   ButtonStyle.Primary, '📺'),
      btn('cp_opts',   'Options',  ButtonStyle.Primary, '🔧'),
      btn('cp_panel',  'Poster le panel',  ButtonStyle.Success, '📮'),
      btn('cp_stats',  'Stats',    ButtonStyle.Secondary, '📊')
    )
  );

  const msg = await message.reply({ components: [overview], flags: FLAGS, allowedMentions: { repliedUser: false } });
  const col = msg.createMessageComponentCollector({ time: 300_000, filter: i => i.user.id === message.author.id });

  async function refresh(i) {
    const c2 = getConfig(gid);
    const cn = (id) => id
      ? (message.guild.channels.cache.get(id)?.name ? `#${message.guild.channels.cache.get(id).name}` : `~~supprimé~~`)
      : '*(non configuré)*';
    const refreshed = container(
      txt('## ⚙️ Configuration — Profils Crush'),
      sep(),
      txt([
        `**Salon Hommes :** ${cn(c2.chanHomme)}`,
        `**Salon Femmes :** ${cn(c2.chanFemme)}`,
        `**Salon Autres :** ${cn(c2.chanAutre)}`,
        `**Salon Reports :** ${cn(c2.chanReport)}`,
        `**Salon Matchs :** ${cn(c2.chanMatch)}`,
      ].join('\n')),
      sep(),
      txt([
        `**Approbation requise :** ${c2.requireApproval ? '✅ Oui' : '❌ Non'}`,
        `**Likes activés :** ${c2.allowLikes ? '✅ Oui' : '❌ Non'}`,
        `**Modification activée :** ${c2.allowEdit ? '✅ Oui' : '❌ Non'}`,
        `**Âge minimum :** ${c2.minAge} ans`,
        `**Âge maximum :** ${c2.maxAge} ans`,
      ].join('\n')),
      row(
        btn('cp_chan',   'Salons',         ButtonStyle.Primary, '📺'),
        btn('cp_opts',  'Options',         ButtonStyle.Primary, '🔧'),
        btn('cp_panel', 'Poster le panel', ButtonStyle.Success, '📮'),
        btn('cp_stats', 'Stats',           ButtonStyle.Secondary, '📊')
      )
    );
    if (i) await i.deferUpdate().catch(() => {});
    await msg.edit({ components: [refreshed], flags: FLAGS }).catch(() => {});
  }

  col.on('collect', async i => {
    try {
      if (i.customId === 'cp_chan') {
        await i.deferUpdate();
        const chanSelectMenu = new ActionRowBuilder().addComponents(
          new StringSelectMenuBuilder()
            .setCustomId('cp_chan_pick')
            .setPlaceholder('Quel salon configurer ?')
            .addOptions(
              { label: 'Salon Hommes', value: 'homme', emoji: '👨' },
              { label: 'Salon Femmes', value: 'femme', emoji: '👩' },
              { label: 'Salon Autres / NB', value: 'autre', emoji: '🌈' },
              { label: 'Salon Signalements', value: 'report', emoji: '🚨' },
              { label: 'Salon Matchs', value: 'match', emoji: '💞' }
            )
        );
        await msg.edit({
          components: [
            container(
              txt('## 📺 Configuration des Salons'),
              sep(),
              txt('Sélectionnez le type de salon à configurer.\nLe **salon actuel** sera utilisé comme cible.'),
              row(btn('cp_back', 'Retour', ButtonStyle.Secondary, '↩️'))
            ),
            chanSelectMenu
          ],
          flags: FLAGS
        }).catch(() => {});
        return;
      }

      if (i.customId === 'cp_chan_pick') {
        await i.deferUpdate();
        const type = i.values[0];
        const chanId = message.channel.id;
        const chanName2 = message.channel.name;
        const c2 = getConfig(gid);
        const labelMap = { homme: 'chanHomme', femme: 'chanFemme', autre: 'chanAutre', report: 'chanReport', match: 'chanMatch' };
        c2[labelMap[type]] = chanId;
        saveConfig(gid, c2);
        await msg.edit({
          components: [container(
            txt('## ✅ Salon Configuré'),
            sep(),
            txt(`Salon **#${chanName2}** configuré pour **${type}**.`)
          )],
          flags: FLAGS
        }).catch(() => {});
        setTimeout(() => refresh(null), 1500);
        return;
      }

      if (i.customId === 'cp_opts') {
        const modal = new ModalBuilder().setCustomId('cp_opts_modal').setTitle('Options du système Crush');
        const c2 = getConfig(gid);
        modal.addComponents(
          new ActionRowBuilder().addComponents(
            new TextInputBuilder().setCustomId('min_age').setLabel('Âge minimum').setValue(String(c2.minAge)).setStyle(TextInputStyle.Short).setRequired(true).setMaxLength(3)
          ),
          new ActionRowBuilder().addComponents(
            new TextInputBuilder().setCustomId('max_age').setLabel('Âge maximum').setValue(String(c2.maxAge)).setStyle(TextInputStyle.Short).setRequired(true).setMaxLength(3)
          ),
          new ActionRowBuilder().addComponents(
            new TextInputBuilder().setCustomId('require_approval').setLabel('Approbation admin requise ? (oui/non)').setValue(c2.requireApproval ? 'oui' : 'non').setStyle(TextInputStyle.Short).setRequired(true).setMaxLength(3)
          ),
          new ActionRowBuilder().addComponents(
            new TextInputBuilder().setCustomId('allow_likes').setLabel('Activer les likes ? (oui/non)').setValue(c2.allowLikes ? 'oui' : 'non').setStyle(TextInputStyle.Short).setRequired(true).setMaxLength(3)
          ),
          new ActionRowBuilder().addComponents(
            new TextInputBuilder().setCustomId('allow_edit').setLabel('Permettre la modification ? (oui/non)').setValue(c2.allowEdit ? 'oui' : 'non').setStyle(TextInputStyle.Short).setRequired(true).setMaxLength(3)
          )
        );
        await i.showModal(modal);

        const sub = await i.awaitModalSubmit({ time: 120_000, filter: x => x.user.id === message.author.id }).catch(() => null);
        if (!sub) return;
        await sub.deferUpdate();
        const c3 = getConfig(gid);
        c3.minAge = Math.max(13, parseInt(sub.fields.getTextInputValue('min_age')) || 16);
        c3.maxAge = Math.min(100, parseInt(sub.fields.getTextInputValue('max_age')) || 99);
        c3.requireApproval = sub.fields.getTextInputValue('require_approval').toLowerCase().startsWith('o');
        c3.allowLikes      = sub.fields.getTextInputValue('allow_likes').toLowerCase().startsWith('o');
        c3.allowEdit       = sub.fields.getTextInputValue('allow_edit').toLowerCase().startsWith('o');
        saveConfig(gid, c3);
        await refresh(null);
        return;
      }

      if (i.customId === 'cp_panel') {
        await i.deferUpdate();
        await postInscriptionPanel(message.channel);
        await msg.edit({
          components: [container(txt('## ✅ Panel Posté'), sep(), txt('Le panel d\'inscription a été posté dans ce salon.'))],
          flags: FLAGS
        }).catch(() => {});
        setTimeout(() => refresh(null), 2000);
        return;
      }

      if (i.customId === 'cp_stats') {
        await i.deferUpdate();
        const allKeys = db.all ? db.all() : [];
        const profiles = allKeys.filter(e => e.ID.startsWith(`crush_profile_${gid}_`));
        const pending  = allKeys.filter(e => e.ID.startsWith(`crush_pending_${gid}_`));
        const likes    = allKeys.filter(e => e.ID.startsWith(`crush_likes_${gid}_`));
        const totalLikes = likes.reduce((acc, e) => acc + (Array.isArray(e.data) ? e.data.length : 0), 0);
        await msg.edit({
          components: [container(
            txt('## 📊 Statistiques Crush'),
            sep(),
            txt([
              `**Profils actifs :** ${profiles.length}`,
              `**En attente d'approbation :** ${pending.length}`,
              `**Total likes reçus :** ❤️ ${totalLikes}`,
            ].join('\n')),
            row(btn('cp_back', 'Retour', ButtonStyle.Secondary, '↩️'))
          )],
          flags: FLAGS
        }).catch(() => {});
        return;
      }

      if (i.customId === 'cp_back') {
        await refresh(i);
        return;
      }
    } catch (err) {
      console.error('[CRUSH-ADMIN]', err);
    }
  });
}

// ══════════════════════════════════════════════════════════════════
//  PANEL PUBLIC (inscription)
// ══════════════════════════════════════════════════════════════════

async function postInscriptionPanel(channel) {
  const gid = channel.guild.id;
  const cfg = getConfig(gid);
  await channel.send({
    components: [
      container(
        txt('## 💘 Profils & Crush — Inscription'),
        sep(),
        txt([
          '**Bienvenue dans l\'espace Profils & Crush !**',
          'Ici tu peux créer ton profil, rencontrer d\'autres membres et potentiellement trouver ton crush 🥰',
          '',
          '**📝 Pour créer ton profil :**',
          '→ Clique sur **Créer mon profil** ci-dessous',
          '→ Remplis les informations demandées en **2 étapes**',
          '→ Ton profil sera publié automatiquement dans le salon correspondant',
          '',
          '**⚠️ Règles importantes :**',
          '• Sois honnête(e) dans tes informations',
          '• Les photos doivent être décentes',
          `• Âge minimum : **${cfg.minAge} ans**`,
          '• Tout profil ne respectant pas les règles sera supprimé',
          '',
          cfg.requireApproval ? '🔍 Tes informations seront **vérifiées par un admin** avant publication.' : '✅ Ton profil sera **publié immédiatement** après soumission.'
        ].join('\n')),
        row(
          btn('crush_start_profil', 'Créer mon profil', ButtonStyle.Primary, '💘'),
          btn('crush_view_own', 'Voir mon profil', ButtonStyle.Secondary, '👤'),
          btn('crush_delete_own', 'Supprimer mon profil', ButtonStyle.Danger, '🗑️')
        )
      )
    ],
    flags: FLAGS
  });
}

// ══════════════════════════════════════════════════════════════════
//  MODAL FLOW — CREATION / EDITION
// ══════════════════════════════════════════════════════════════════

async function openCreateModal(interaction) {
  const modal = new ModalBuilder().setCustomId('crush_modal_1').setTitle('Profil — Étape 1/2 (Identité)');
  modal.addComponents(
    new ActionRowBuilder().addComponents(
      new TextInputBuilder().setCustomId('prenom').setLabel('Ton prénom').setStyle(TextInputStyle.Short).setRequired(true).setMaxLength(50).setPlaceholder('Ex : Léa, Karim...')
    ),
    new ActionRowBuilder().addComponents(
      new TextInputBuilder().setCustomId('genre').setLabel('Genre (Homme, Femme, Non-binaire...)').setStyle(TextInputStyle.Short).setRequired(true).setMaxLength(30).setPlaceholder('Homme / Femme / Non-binaire / Autre')
    ),
    new ActionRowBuilder().addComponents(
      new TextInputBuilder().setCustomId('photo').setLabel('Photo (lien URL direct .jpg/.png/.gif)').setStyle(TextInputStyle.Short).setRequired(false).setPlaceholder('https://i.imgur.com/...')
    ),
    new ActionRowBuilder().addComponents(
      new TextInputBuilder().setCustomId('description').setLabel('Présentation').setStyle(TextInputStyle.Paragraph).setRequired(true).setMaxLength(800).setPlaceholder('Parle de toi, de tes passions...')
    ),
    new ActionRowBuilder().addComponents(
      new TextInputBuilder().setCustomId('ville').setLabel('Ville / Département / Pays').setStyle(TextInputStyle.Short).setRequired(true).setMaxLength(100).setPlaceholder('Ex : Paris, 75, France')
    )
  );
  await interaction.showModal(modal);
}

async function openEditModal(interaction, existing) {
  const modal = new ModalBuilder().setCustomId('crush_modal_edit_1').setTitle('Modifier mon profil — Étape 1/2');
  modal.addComponents(
    new ActionRowBuilder().addComponents(
      new TextInputBuilder().setCustomId('prenom').setLabel('Prénom').setValue(existing.prenom || '').setStyle(TextInputStyle.Short).setRequired(true).setMaxLength(50)
    ),
    new ActionRowBuilder().addComponents(
      new TextInputBuilder().setCustomId('genre').setLabel('Genre').setValue(existing.genre || '').setStyle(TextInputStyle.Short).setRequired(true).setMaxLength(30)
    ),
    new ActionRowBuilder().addComponents(
      new TextInputBuilder().setCustomId('photo').setLabel('Photo (URL)').setValue(existing.photo || '').setStyle(TextInputStyle.Short).setRequired(false).setMaxLength(500)
    ),
    new ActionRowBuilder().addComponents(
      new TextInputBuilder().setCustomId('description').setLabel('Présentation').setValue(existing.description || '').setStyle(TextInputStyle.Paragraph).setRequired(true).setMaxLength(800)
    ),
    new ActionRowBuilder().addComponents(
      new TextInputBuilder().setCustomId('ville').setLabel('Ville / Région').setValue(existing.ville || '').setStyle(TextInputStyle.Short).setRequired(true).setMaxLength(100)
    )
  );
  await interaction.showModal(modal);
}

// ══════════════════════════════════════════════════════════════════
//  PUBLICATION DU PROFIL
// ══════════════════════════════════════════════════════════════════

async function publishProfile(interaction, profile, isEdit = false) {
  const gid = interaction.guild.id;
  const cfg = getConfig(gid);
  const chanId = getChanForType(cfg, profile.channelType);
  if (!chanId) {
    return interaction.reply({
      content: `❌ Aucun salon configuré pour le genre **${profile.genre}**. Demande à un admin d'exécuter \`+profil\` pour configurer les salons.`,
      ephemeral: true
    });
  }

  let ch;
  try { ch = await interaction.client.channels.fetch(chanId); } catch {
    return interaction.reply({ content: '❌ Le salon configuré est introuvable. Contacte un admin.', ephemeral: true });
  }
  if (!ch) return interaction.reply({ content: '❌ Impossible d\'accéder au salon des profils.', ephemeral: true });

  // Supprimer l'ancien message si édition
  if (isEdit && profile.messageId && profile.channelId) {
    try {
      const oldCh = await interaction.client.channels.fetch(profile.channelId).catch(() => null);
      if (oldCh) await oldCh.messages.delete(profile.messageId).catch(() => {});
    } catch {}
  }

  const card = buildProfileCard(profile, interaction.guild);
  const actionRow = new ActionRowBuilder().addComponents(
    ...[
      cfg.allowLikes && new ButtonBuilder().setCustomId(`crush_like_${profile.userId}`).setLabel('Like').setStyle(ButtonStyle.Success).setEmoji('❤️'),
      new ButtonBuilder().setCustomId(`crush_report_${profile.userId}`).setLabel('Signaler').setStyle(ButtonStyle.Secondary).setEmoji('🚨')
    ].filter(Boolean)
  );

  let msg;
  try {
    msg = await ch.send({
      components: [card, actionRow],
      flags: FLAGS
    });
  } catch (err) {
    console.error('[CRUSH] Erreur envoi profil:', err);
    return interaction.reply({ content: `❌ Erreur lors de l\'envoi du profil : \`${err.message}\``, ephemeral: true });
  }

  profile.messageId = msg.id;
  profile.channelId = ch.id;
  db.set(gKey(gid, profile.userId), profile);
  db.delete(pendingKey(gid, profile.userId));
  db.delete(tmp1Key(gid, profile.userId));

  await interaction.reply({
    content: `✅ Ton profil a été ${isEdit ? 'mis à jour' : 'créé et publié'} dans <#${ch.id}> !`,
    ephemeral: true
  });
}

async function submitForApproval(interaction, profile) {
  const gid = interaction.guild.id;
  const cfg = getConfig(gid);
  db.set(pendingKey(gid, profile.userId), profile);
  db.delete(tmp1Key(gid, profile.userId));

  if (cfg.chanReport) {
    try {
      const reportCh = await interaction.client.channels.fetch(cfg.chanReport).catch(() => null);
      if (reportCh) {
        const approveRow = new ActionRowBuilder().addComponents(
          new ButtonBuilder().setCustomId(`crush_approve_${profile.userId}`).setLabel('Approuver').setStyle(ButtonStyle.Success).setEmoji('✅'),
          new ButtonBuilder().setCustomId(`crush_reject_${profile.userId}`).setLabel('Rejeter').setStyle(ButtonStyle.Danger).setEmoji('❌')
        );
        await reportCh.send({
          components: [
            container(
              txt('## 🔍 Nouveau profil en attente d\'approbation'),
              sep(),
              txt([
                `**Utilisateur :** <@${profile.userId}> (\`${profile.userId}\`)`,
                `**Prénom :** ${profile.prenom}`,
                `**Genre :** ${profile.genre} | **Âge :** ${profile.age} ans`,
                `**Ville :** ${profile.ville}`,
                '',
                profile.description
              ].join('\n'))
            ),
            approveRow
          ],
          flags: FLAGS
        });
      }
    } catch (err) { console.error('[CRUSH] Notification approbation:', err); }
  }

  await interaction.reply({ content: '⏳ Ton profil a été soumis et est en attente d\'approbation par un admin !', ephemeral: true });
}

// ══════════════════════════════════════════════════════════════════
//  COMMANDE PRINCIPALE
// ══════════════════════════════════════════════════════════════════

module.exports = {
  name: 'profil',
  aliases: ['crushpanel', 'inscription', 'crushconfig', 'configcrush'],
  description: 'Panneau de config Crush (admin) ou affichage profil.',
  category: 'crush',
  level: 0,

  run: async (client, message, args, prefix) => {
    const gid = message.guild.id;
    const cfg = getConfig(gid);
    const isAdmin = hasPermissionLevel(client, message, 4);

    // +profil @user — voir le profil de quelqu'un
    if (args[0] && message.mentions.users.first()) {
      const target = message.mentions.members.first();
      if (!target) return reply(message, errorContainer('Membre introuvable.'));
      const profile = db.get(gKey(gid, target.id));
      if (!profile) return reply(message, errorContainer(`**${target.displayName}** n'a pas de profil crush.`));
      const card = buildProfileCard(profile, message.guild);
      const actionRow = profileActionRow(target.id, gid, false, cfg);
      return message.reply({ components: actionRow ? [card, actionRow] : [card], flags: FLAGS });
    }

    // +profil (sans arg) : admins → panel config, autres → voir leur propre profil
    if (isAdmin) {
      return showAdminPanel(client, message);
    }

    // Utilisateur normal : voir son propre profil ou guide
    const own = db.get(gKey(gid, message.author.id));
    if (own) {
      const card = buildProfileCard(own, message.guild);
      const actionRow = profileActionRow(message.author.id, gid, true, cfg);
      return message.reply({ components: actionRow ? [card, actionRow] : [card], flags: FLAGS });
    }

    // Pas de profil → afficher un guide rapide
    return message.reply({
      components: [container(
        txt('## 💘 Profils & Crush'),
        sep(),
        txt([
          'Tu n\'as pas encore de profil.',
          '',
          '→ Rends-toi dans le salon d\'inscription et clique sur **Créer mon profil**.',
          `→ Ou utilise \`${prefix}profil @membre\` pour voir le profil de quelqu'un.`
        ].join('\n'))
      )],
      flags: FLAGS
    });
  },

  // ════════════════════════════════════════════════════════════════
  //  GESTION DES INTERACTIONS
  // ════════════════════════════════════════════════════════════════

  async handleInteraction(interaction) {
    const cid = interaction.customId || '';
    if (!cid.startsWith('crush_') && cid !== 'cp_chan' && cid !== 'cp_opts' && cid !== 'cp_panel' && cid !== 'cp_back' && cid !== 'cp_stats' && cid !== 'cp_chan_pick') {
      return false;
    }

    const gid  = interaction.guild?.id;
    const uid  = interaction.user?.id;
    if (!gid || !uid) {
      await interaction.reply({ content: 'Disponible uniquement sur un serveur.', ephemeral: true }).catch(() => {});
      return true;
    }

    const cfg = getConfig(gid);

    try {
      // ── Bouton "Créer mon profil" ──────────────────────────────
      if (interaction.isButton() && cid === 'crush_start_profil') {
        const existing = db.get(gKey(gid, uid));
        if (existing) {
          await interaction.reply({ content: '💡 Tu as déjà un profil ! Tu peux le modifier ou le supprimer depuis le panel.', ephemeral: true });
          return true;
        }
        const pending = db.get(pendingKey(gid, uid));
        if (pending) {
          await interaction.reply({ content: '⏳ Ton profil est déjà en attente d\'approbation !', ephemeral: true });
          return true;
        }
        await openCreateModal(interaction);
        return true;
      }

      // ── Bouton "Voir mon profil" ───────────────────────────────
      if (interaction.isButton() && cid === 'crush_view_own') {
        const own = db.get(gKey(gid, uid));
        if (!own) {
          await interaction.reply({ content: '❌ Tu n\'as pas encore de profil. Clique sur **Créer mon profil** !', ephemeral: true });
          return true;
        }
        const card = buildProfileCard(own, interaction.guild);
        const actionRow = profileActionRow(uid, gid, true, cfg);
        await interaction.reply({ components: actionRow ? [card, actionRow] : [card], flags: FLAGS | 64, ephemeral: true });
        return true;
      }

      // ── Bouton "Supprimer mon profil" (depuis panel) ──────────
      if (interaction.isButton() && cid === 'crush_delete_own') {
        const own = db.get(gKey(gid, uid));
        if (!own) { await interaction.reply({ content: 'Tu n\'as pas de profil à supprimer.', ephemeral: true }); return true; }
        if (own.messageId && own.channelId) {
          try {
            const ch = await interaction.client.channels.fetch(own.channelId).catch(() => null);
            if (ch) await ch.messages.delete(own.messageId).catch(() => {});
          } catch {}
        }
        db.delete(gKey(gid, uid));
        await interaction.reply({ content: '✅ Ton profil a été supprimé.', ephemeral: true });
        return true;
      }

      // ── Bouton "Supprimer" (sur une carte profil) ─────────────
      if (interaction.isButton() && cid.startsWith('crush_delete_')) {
        const targetId = cid.replace('crush_delete_', '');
        if (targetId !== uid) {
          await interaction.reply({ content: '❌ Tu ne peux supprimer que ton propre profil.', ephemeral: true });
          return true;
        }
        const own = db.get(gKey(gid, uid));
        if (!own) { await interaction.reply({ content: 'Profil introuvable.', ephemeral: true }); return true; }
        if (own.messageId && own.channelId) {
          try {
            const ch = await interaction.client.channels.fetch(own.channelId).catch(() => null);
            if (ch) await ch.messages.delete(own.messageId).catch(() => {});
          } catch {}
        }
        db.delete(gKey(gid, uid));
        await interaction.reply({ content: '✅ Ton profil a été supprimé.', ephemeral: true });
        return true;
      }

      // ── Bouton "Modifier" ──────────────────────────────────────
      if (interaction.isButton() && cid.startsWith('crush_edit_')) {
        if (!cfg.allowEdit) { await interaction.reply({ content: '❌ La modification de profil est désactivée.', ephemeral: true }); return true; }
        const targetId = cid.replace('crush_edit_', '');
        if (targetId !== uid) { await interaction.reply({ content: '❌ Tu ne peux modifier que ton propre profil.', ephemeral: true }); return true; }
        const existing = db.get(gKey(gid, uid));
        if (!existing) { await interaction.reply({ content: '❌ Profil introuvable.', ephemeral: true }); return true; }
        db.set(tmp1Key(gid, uid), { ...existing, isEdit: true });
        await openEditModal(interaction, existing);
        return true;
      }

      // ── Like ──────────────────────────────────────────────────
      if (interaction.isButton() && cid.startsWith('crush_like_')) {
        if (!cfg.allowLikes) { await interaction.reply({ content: '❌ Les likes sont désactivés.', ephemeral: true }); return true; }
        const targetId = cid.replace('crush_like_', '');
        if (targetId === uid) { await interaction.reply({ content: '❌ Tu ne peux pas te liker toi-même !', ephemeral: true }); return true; }
        const targetProfile = db.get(gKey(gid, targetId));
        if (!targetProfile) { await interaction.reply({ content: '❌ Ce profil n\'existe plus.', ephemeral: true }); return true; }

        const myLikes    = db.get(likeKey(gid, uid)) || [];
        const targetLikers = db.get(likersKey(gid, targetId)) || [];

        if (myLikes.includes(targetId)) {
          // Unlike
          db.set(likeKey(gid, uid), myLikes.filter(id => id !== targetId));
          db.set(likersKey(gid, targetId), targetLikers.filter(id => id !== uid));
          await interaction.reply({ content: '💔 Like retiré.', ephemeral: true });
        } else {
          // Like
          myLikes.push(targetId);
          targetLikers.push(uid);
          db.set(likeKey(gid, uid), myLikes);
          db.set(likersKey(gid, targetId), targetLikers);

          // Vérifier si match (target a aussi liké uid)
          const targetLikes = db.get(likeKey(gid, targetId)) || [];
          const isMatch = targetLikes.includes(uid);

          if (isMatch && cfg.chanMatch) {
            try {
              const matchCh = await interaction.client.channels.fetch(cfg.chanMatch).catch(() => null);
              if (matchCh) {
                const myProfile = db.get(gKey(gid, uid));
                await matchCh.send({
                  components: [container(
                    txt('## 💞 Nouveau Match !'),
                    sep(),
                    txt([
                      `<@${uid}> et <@${targetId}> se sont **matchés** !`,
                      '',
                      `**${myProfile?.prenom || uid}** ❤️ **${targetProfile.prenom}**`,
                      '',
                      'Envoyez-vous un message privé pour commencer à vous parler ! 🥰'
                    ].join('\n'))
                  )],
                  flags: FLAGS
                });
              }
            } catch {}
            await interaction.reply({ content: `💞 **Match !** Tu as matché avec **${targetProfile.prenom}** ! Consultez vos DMs ou regardez le salon des matchs 🎉`, ephemeral: true });
          } else {
            await interaction.reply({ content: `❤️ Tu as liké le profil de **${targetProfile.prenom}** !`, ephemeral: true });
          }
        }
        return true;
      }

      // ── Signalement ───────────────────────────────────────────
      if (interaction.isButton() && cid.startsWith('crush_report_')) {
        const targetId = cid.replace('crush_report_', '');
        if (targetId === uid) { await interaction.reply({ content: '❌ Tu ne peux pas te signaler toi-même.', ephemeral: true }); return true; }
        if (!cfg.chanReport) { await interaction.reply({ content: '❌ Salon de signalements non configuré.', ephemeral: true }); return true; }

        const modal = new ModalBuilder().setCustomId(`crush_report_modal_${targetId}`).setTitle('Signalement de profil');
        modal.addComponents(
          new ActionRowBuilder().addComponents(
            new TextInputBuilder().setCustomId('reason').setLabel('Raison du signalement').setStyle(TextInputStyle.Paragraph).setRequired(true).setMaxLength(500).setPlaceholder('Décris pourquoi tu signales ce profil...')
          )
        );
        await interaction.showModal(modal);
        return true;
      }

      if (interaction.isModalSubmit() && cid.startsWith('crush_report_modal_')) {
        const targetId = cid.replace('crush_report_modal_', '');
        const reason = interaction.fields.getTextInputValue('reason');
        try {
          const reportCh = await interaction.client.channels.fetch(cfg.chanReport).catch(() => null);
          if (reportCh) {
            await reportCh.send({
              components: [container(
                txt('## 🚨 Signalement de Profil'),
                sep(),
                txt([
                  `**Signalé par :** <@${uid}> (\`${uid}\`)`,
                  `**Profil signalé :** <@${targetId}> (\`${targetId}\`)`,
                  `**Message :** [Voir le message](${interaction.message?.url || 'N/A'})`,
                  '',
                  `**Raison :** ${reason}`
                ].join('\n')),
                row(
                  btn(`crush_admin_ban_${targetId}`, 'Supprimer profil', ButtonStyle.Danger, '🗑️'),
                  btn(`crush_admin_ok_${targetId}`, 'Ignorer', ButtonStyle.Secondary, '✅')
                )
              )],
              flags: FLAGS
            });
          }
        } catch (err) { console.error('[CRUSH] Rapport:', err); }
        await interaction.reply({ content: '✅ Signalement envoyé aux modérateurs. Merci !', ephemeral: true });
        return true;
      }

      // ── Admin : supprimer depuis un signalement ───────────────
      if (interaction.isButton() && cid.startsWith('crush_admin_ban_')) {
        const targetId = cid.replace('crush_admin_ban_', '');
        const prof = db.get(gKey(gid, targetId));
        if (prof?.messageId && prof?.channelId) {
          try {
            const ch2 = await interaction.client.channels.fetch(prof.channelId).catch(() => null);
            if (ch2) await ch2.messages.delete(prof.messageId).catch(() => {});
          } catch {}
        }
        db.delete(gKey(gid, targetId));
        await interaction.update({
          components: [container(txt('## ✅ Profil supprimé'), sep(), txt(`Le profil de <@${targetId}> a été supprimé.`))],
          flags: FLAGS
        }).catch(() => interaction.reply({ content: `Profil de <@${targetId}> supprimé.`, ephemeral: true }));
        return true;
      }

      if (interaction.isButton() && cid.startsWith('crush_admin_ok_')) {
        await interaction.update({
          components: [container(txt('## ✅ Signalement ignoré'), sep(), txt('Ce signalement a été ignoré.'))],
          flags: FLAGS
        }).catch(() => interaction.reply({ content: 'Signalement ignoré.', ephemeral: true }));
        return true;
      }

      // ── Admin : approuver / rejeter ───────────────────────────
      if (interaction.isButton() && cid.startsWith('crush_approve_')) {
        const targetId = cid.replace('crush_approve_', '');
        const pending = db.get(pendingKey(gid, targetId));
        if (!pending) {
          await interaction.update({ components: [container(txt('⚠️ Profil introuvable ou déjà traité.'))], flags: FLAGS }).catch(() => {});
          return true;
        }
        await interaction.deferUpdate();
        await publishProfile(interaction, pending, false);
        await interaction.message.edit({
          components: [container(txt('## ✅ Profil approuvé'), sep(), txt(`Profil de <@${targetId}> approuvé et publié.`))],
          flags: FLAGS
        }).catch(() => {});
        return true;
      }

      if (interaction.isButton() && cid.startsWith('crush_reject_')) {
        const targetId = cid.replace('crush_reject_', '');
        db.delete(pendingKey(gid, targetId));
        try {
          const u = await interaction.client.users.fetch(targetId).catch(() => null);
          if (u) await u.send('❌ Ton profil Crush a été **refusé** par un modérateur. Contacte un admin pour plus d\'informations.').catch(() => {});
        } catch {}
        await interaction.update({
          components: [container(txt('## ❌ Profil rejeté'), sep(), txt(`Profil de <@${targetId}> rejeté.`))],
          flags: FLAGS
        }).catch(() => interaction.reply({ content: `Profil rejeté.`, ephemeral: true }));
        return true;
      }

      // ── Modal Étape 1 (création) ───────────────────────────────
      // Discord interdit showModal() depuis un ModalSubmitInteraction.
      // Solution : répondre avec un message éphémère + bouton → modal 2.
      if (interaction.isModalSubmit() && (cid === 'crush_modal_1')) {
        const prenom      = interaction.fields.getTextInputValue('prenom').trim();
        const genre       = interaction.fields.getTextInputValue('genre').trim();
        const photo       = interaction.fields.getTextInputValue('photo').trim();
        const description = interaction.fields.getTextInputValue('description').trim();
        const ville       = interaction.fields.getTextInputValue('ville').trim();
        const channelType = genreToType(genre);

        db.set(tmp1Key(gid, uid), { prenom, genre, photo, description, ville, channelType, isEdit: false });

        await interaction.reply({
          components: [
            container(
              txt('## ✅ Étape 1/2 complète !'),
              sep(),
              txt([
                `**Prénom :** ${prenom}`,
                `**Genre :** ${genre}`,
                `**Ville :** ${ville}`,
                '',
                'Clique sur **Continuer** pour remplir les derniers détails.'
              ].join('\n')),
              row(btn('crush_step2', 'Continuer →', ButtonStyle.Primary, '📝'))
            )
          ],
          flags: FLAGS | 64
        });
        return true;
      }

      // ── Bouton "Continuer" étape 2 (création) ─────────────────
      if (interaction.isButton() && cid === 'crush_step2') {
        const tmp = db.get(tmp1Key(gid, uid));
        if (!tmp) {
          await interaction.reply({ content: '❌ Session expirée. Recommence en cliquant sur **Créer mon profil**.', ephemeral: true });
          return true;
        }
        const modal2 = new ModalBuilder().setCustomId('crush_modal_2').setTitle('Profil — Étape 2/2 (Détails)');
        modal2.addComponents(
          new ActionRowBuilder().addComponents(
            new TextInputBuilder().setCustomId('age').setLabel('Ton âge').setStyle(TextInputStyle.Short).setRequired(true).setMaxLength(3).setPlaceholder('Ex : 22')
          ),
          new ActionRowBuilder().addComponents(
            new TextInputBuilder().setCustomId('recherche').setLabel('Ce que tu recherches').setStyle(TextInputStyle.Paragraph).setRequired(true).setMaxLength(500).setPlaceholder('Ex : Une relation sérieuse, des amis, un crush...')
          ),
          new ActionRowBuilder().addComponents(
            new TextInputBuilder().setCustomId('origine').setLabel('Ton origine / Nationalité').setStyle(TextInputStyle.Short).setRequired(true).setMaxLength(100).setPlaceholder('Ex : Française, Algérienne...')
          )
        );
        await interaction.showModal(modal2);
        return true;
      }

      // ── Modal Étape 1 (édition) ────────────────────────────────
      if (interaction.isModalSubmit() && cid === 'crush_modal_edit_1') {
        const tmp = db.get(tmp1Key(gid, uid));
        const prenom      = interaction.fields.getTextInputValue('prenom').trim();
        const genre       = interaction.fields.getTextInputValue('genre').trim();
        const photo       = interaction.fields.getTextInputValue('photo').trim();
        const description = interaction.fields.getTextInputValue('description').trim();
        const ville       = interaction.fields.getTextInputValue('ville').trim();
        const channelType = genreToType(genre);
        db.set(tmp1Key(gid, uid), { ...(tmp || {}), prenom, genre, photo, description, ville, channelType, isEdit: true });

        await interaction.reply({
          components: [
            container(
              txt('## ✅ Étape 1/2 enregistrée !'),
              sep(),
              txt([
                `**Prénom :** ${prenom}`,
                `**Genre :** ${genre}`,
                `**Ville :** ${ville}`,
                '',
                'Clique sur **Continuer** pour modifier les détails restants.'
              ].join('\n')),
              row(btn('crush_edit_step2', 'Continuer →', ButtonStyle.Primary, '✏️'))
            )
          ],
          flags: FLAGS | 64
        });
        return true;
      }

      // ── Bouton "Continuer" étape 2 (édition) ──────────────────
      if (interaction.isButton() && cid === 'crush_edit_step2') {
        const tmp = db.get(tmp1Key(gid, uid));
        if (!tmp) {
          await interaction.reply({ content: '❌ Session expirée. Recommence depuis ton profil.', ephemeral: true });
          return true;
        }
        const existing = db.get(gKey(gid, uid)) || {};
        const modal2 = new ModalBuilder().setCustomId('crush_modal_edit_2').setTitle('Modifier mon profil — Étape 2/2');
        modal2.addComponents(
          new ActionRowBuilder().addComponents(
            new TextInputBuilder().setCustomId('age').setLabel('Âge').setValue(existing.age || '').setStyle(TextInputStyle.Short).setRequired(true).setMaxLength(3)
          ),
          new ActionRowBuilder().addComponents(
            new TextInputBuilder().setCustomId('recherche').setLabel('Ce que tu recherches').setValue(existing.recherche || '').setStyle(TextInputStyle.Paragraph).setRequired(true).setMaxLength(500)
          ),
          new ActionRowBuilder().addComponents(
            new TextInputBuilder().setCustomId('origine').setLabel('Origine / Nationalité').setValue(existing.origine || '').setStyle(TextInputStyle.Short).setRequired(true).setMaxLength(100)
          )
        );
        await interaction.showModal(modal2);
        return true;
      }

      // ── Modal Étape 2 (création) ───────────────────────────────
      if (interaction.isModalSubmit() && cid === 'crush_modal_2') {
        const data1 = db.get(tmp1Key(gid, uid));
        if (!data1) {
          await interaction.reply({ content: '❌ Session expirée. Recommence en cliquant sur **Créer mon profil**.', ephemeral: true });
          return true;
        }

        const age       = interaction.fields.getTextInputValue('age').trim();
        const recherche = interaction.fields.getTextInputValue('recherche').trim();
        const origine   = interaction.fields.getTextInputValue('origine').trim();

        // Validation de l'âge
        const ageNum = parseInt(age);
        if (isNaN(ageNum) || ageNum < cfg.minAge || ageNum > cfg.maxAge) {
          await interaction.reply({ content: `❌ Âge invalide. L'âge doit être compris entre **${cfg.minAge}** et **${cfg.maxAge}** ans.`, ephemeral: true });
          return true;
        }

        const profile = {
          userId: uid,
          ...data1,
          age,
          recherche,
          origine,
          createdAt: Date.now()
        };

        if (cfg.requireApproval) {
          await submitForApproval(interaction, profile);
        } else {
          await publishProfile(interaction, profile, false);
        }
        return true;
      }

      // ── Modal Étape 2 (édition) ────────────────────────────────
      if (interaction.isModalSubmit() && cid === 'crush_modal_edit_2') {
        const data1 = db.get(tmp1Key(gid, uid));
        if (!data1) {
          await interaction.reply({ content: '❌ Session expirée. Recommence depuis ton profil.', ephemeral: true });
          return true;
        }

        const age       = interaction.fields.getTextInputValue('age').trim();
        const recherche = interaction.fields.getTextInputValue('recherche').trim();
        const origine   = interaction.fields.getTextInputValue('origine').trim();

        const ageNum = parseInt(age);
        if (isNaN(ageNum) || ageNum < cfg.minAge || ageNum > cfg.maxAge) {
          await interaction.reply({ content: `❌ Âge invalide (${cfg.minAge}-${cfg.maxAge} ans).`, ephemeral: true });
          return true;
        }

        const existing = db.get(gKey(gid, uid)) || {};
        const profile = {
          ...existing,
          ...data1,
          age, recherche, origine,
          editedAt: Date.now()
        };

        await publishProfile(interaction, profile, true);
        return true;
      }

    } catch (err) {
      console.error('[CRUSH-INTERACTION] Erreur:', err);
      if (!interaction.replied && !interaction.deferred) {
        await interaction.reply({ content: `❌ Une erreur est survenue : \`${err.message}\``, ephemeral: true }).catch(() => {});
      }
    }

    return false;
  }
};
