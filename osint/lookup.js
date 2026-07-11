const Discord = require('discord.js');
const { checkOsintPermission, getCredits, deductCredits, replyInsufficientCredits } = require('../../utils/osintHelpers');
const { EMOJIS: EMB } = require('../../utils/embedBuilder');
const EMOJIS = require('../../utils/emojis');
const { ActionRowBuilder, ButtonBuilder, ButtonStyle, StringSelectMenuBuilder, StringSelectMenuOptionBuilder } = Discord;
const { container, txt, sep, FLAGS } = require('../../utils/v2');

/** Chargement paresseux pour éviter erreurs au démarrage (lookupSources peut être lourd) */
function getLookupSources() {
  try {
    return require('../../utils/lookupSources');
  } catch (e) {
    return null;
  }
}

const LOOKUP_COST = 100;
const MAX_EMBED_TITLE = 256;
const MAX_SELECT_LABEL = 100;
const MAX_SELECT_PLACEHOLDER = 150;
const MAX_EMBED_FOOTER = 2048;
const MAX_FIELD_VALUE = 1024;

function trunc(str, max = 1024) {
  if (str == null) return '';
  const s = String(str);
  return s.length > max ? s.slice(0, max - 3) + '...' : s;
}

const QUERY_TYPE_LABELS = {
  email: 'Email',
  ip: 'Adresse IP',
  domain: 'Domaine',
  phone: 'Numéro de téléphone',
  username: 'Username / Identifiant',
  discord_id: 'ID Discord'
};

/** Extrait l'ID d'un emoji Discord (<a:name:id> ou <:name:id>) */
function emojiId(emojiStr) {
  if (!emojiStr || typeof emojiStr !== 'string') return null;
  const m = emojiStr.match(/:(\d+)>/);
  return m ? m[1] : null;
}

/** Emojis personnalisés par section (embedBuilder + emojis) — IDs pour le menu et chaînes pour l'embed */
const LOOKUP_SECTION_EMOJIS = {
  breach: { id: emojiId(EMB.alerte) || '1452687389293023362', str: EMB.alerte },
  intel: { id: emojiId(EMB.fleche) || '1452686535483719854', str: EMB.fleche },
  pastebin: { id: emojiId(EMB.fichier) || '1454241990630838495', str: EMB.fichier },
  snusbase: { id: emojiId(EMOJIS.DB) || '1452686710344519721', str: EMOJIS.DB },
  geoip: { id: emojiId(EMOJIS.WIFI) || '1452687638325891113', str: EMOJIS.WIFI },
  vpn: { id: emojiId(EMOJIS.PROTECT) || '1452687574593437777', str: EMOJIS.PROTECT },
  reverseip: { id: emojiId(EMB.fleche) || '1452686535483719854', str: EMB.fleche },
  internetdb: { id: emojiId(EMOJIS.BUG) || '1452686699544051754', str: EMOJIS.BUG },
  abuseipdb: { id: emojiId(EMOJIS.WARNING) || '1452687389293023362', str: EMOJIS.WARNING },
  whois: { id: emojiId(EMOJIS.FOLDER) || '1452686731936665691', str: EMOJIS.FOLDER },
  subdomains: { id: emojiId(EMB.reglement) || '1452687851362844764', str: EMB.reglement },
  urlscan: { id: emojiId(EMOJIS.STATS) || '1452687954798706739', str: EMOJIS.STATS },
  phone: { id: emojiId(EMB.cloche) || '1452687826150752330', str: EMB.cloche },
  nazapi_phone: { id: emojiId(EMOJIS.NOTIF) || '1452687826150752330', str: EMOJIS.NOTIF },
  discord_profile: { id: emojiId(EMOJIS.USER) || '1452686892708528380', str: EMOJIS.USER },
  robtex: { id: emojiId(EMB.fleche) || '1452686535483719854', str: EMB.fleche },
  social: { id: emojiId(EMOJIS.USER) || '1452686892708528380', str: EMOJIS.USER },
  none: { id: emojiId(EMOJIS.ERROR) || '1452686931828670674', str: EMOJIS.ERROR }
};
function getSectionEmoji(sectionId) {
  return LOOKUP_SECTION_EMOJIS[sectionId] || LOOKUP_SECTION_EMOJIS.none;
}

/** Store partagé : messageId -> state (pour que n'importe quel client puisse traiter les clics du menu) */
const LOOKUP_STATE_BY_MESSAGE_ID = new Map();
const LOOKUP_STATE_TTL_MS = 300000;

function getLookupState(messageId) {
  return LOOKUP_STATE_BY_MESSAGE_ID.get(messageId) || null;
}

function setLookupState(messageId, state) {
  LOOKUP_STATE_BY_MESSAGE_ID.set(messageId, state);
  if (state._ttlTimer) clearTimeout(state._ttlTimer);
  state._ttlTimer = setTimeout(() => {
    LOOKUP_STATE_BY_MESSAGE_ID.delete(messageId);
  }, LOOKUP_STATE_TTL_MS);
}

/**
 * Construit le container V2 à partir d'un state (pour le handler global interactionCreate).
 * @param {object} state - { sections, queryType, sectionIndex, pageIndex, query, authorId, embedColor }
 * @param {object} client - Client Discord (pour avatar)
 */
function buildLookupEmbedFromState(state, client) {
  const { sections, queryType, sectionIndex, pageIndex, query } = state;
  const sec = sections[sectionIndex] || sections[0];
  const totalPages = Math.max(1, (sec?.contentPages || []).length);
  const typeLabel = QUERY_TYPE_LABELS[queryType] || queryType;
  const secEmoji = getSectionEmoji(sec?.id);
  const pages = sec?.contentPages || [];
  const content = trunc((pages[Math.min(pageIndex, pages.length - 1)] || '*Aucune donnée*'), MAX_FIELD_VALUE) || '*Vide*';

  const lines = [
    `## ${secEmoji?.str || ''} ${trunc(sec?.name || 'Section', 100)}`,
    `${EMOJIS.ARROW} **Requête :** \`${query}\`  |  **Type :** ${typeLabel}`,
    '',
    content,
    '',
    `*Section ${sectionIndex + 1}/${sections.length} • Page ${pageIndex + 1}/${totalPages} • ${LOOKUP_COST} crédits*`
  ];

  return container(txt(lines.join('\n')));
}

function buildLookupComponentsFromState(state) {
  const { sections, sectionIndex, pageIndex, authorId } = state;
  const sec = sections[sectionIndex] || sections[0];
  const totalPages = Math.max(1, (sec?.contentPages || []).length);
  const uid = authorId;

  const selectOptions = sections.map((s, i) => {
    const e = getSectionEmoji(s.id);
    const opt = new StringSelectMenuOptionBuilder()
      .setLabel(trunc(s.name || 'Section', MAX_SELECT_LABEL))
      .setValue(`section_${i}`)
      .setDefault(i === sectionIndex);
    if (e && e.id) opt.setEmoji({ id: e.id });
    return opt;
  });

  const selectMenu = new StringSelectMenuBuilder()
    .setCustomId(trunc(`lookup_section_${uid}`, 100))
    .setPlaceholder(trunc(`Choisir une section • ${sec?.name || '...'}`, MAX_SELECT_PLACEHOLDER))
    .addOptions(selectOptions);

  const firstBtn = new ButtonBuilder()
    .setCustomId(`lookup_first_${uid}`)
    .setEmoji({ id: emojiId(EMB.precedent) || '1457021755985105099' })
    .setStyle(ButtonStyle.Secondary)
    .setDisabled(pageIndex === 0);

  const prevBtn = new ButtonBuilder()
    .setCustomId(`lookup_prev_${uid}`)
    .setEmoji({ id: emojiId(EMB.precedent) || '1457021755985105099' })
    .setStyle(ButtonStyle.Primary)
    .setDisabled(pageIndex === 0);

  const nextBtn = new ButtonBuilder()
    .setCustomId(`lookup_next_${uid}`)
    .setEmoji({ id: emojiId(EMB.suivant) || '1457021759336349696' })
    .setStyle(ButtonStyle.Primary)
    .setDisabled(pageIndex >= totalPages - 1);

  const lastBtn = new ButtonBuilder()
    .setCustomId(`lookup_last_${uid}`)
    .setEmoji({ id: emojiId(EMB.suivant) || '1457021759336349696' })
    .setStyle(ButtonStyle.Secondary)
    .setDisabled(pageIndex >= totalPages - 1);

  return [
    new ActionRowBuilder().addComponents(selectMenu),
    new ActionRowBuilder().addComponents(firstBtn, prevBtn, nextBtn, lastBtn)
  ];
}

module.exports = {
  name: 'lookup',
  aliases: ['osint', 'search', 'recherche'],
  description: 'Recherche OSINT universelle : saisissez un email, IP, domaine, numéro ou username — résultat en embed avec pagination',
  category: 'osint',
  usage: 'lookup <email|ip|domaine|numéro|username>',
  getLookupState,
  setLookupState,
  buildLookupEmbedFromState,
  buildLookupComponentsFromState,
  LOOKUP_STATE_TTL_MS,
  run: async (client, message, args, prefix, color) => {
    const guild = message.guild;
    const authorId = message.author?.id;
    const channel = message.channel;

    if (!guild || !message.member) {
      return message.reply('<a:_:1483497365863399536> Cette commande est utilisable uniquement sur un serveur.');
    }

    if (!checkOsintPermission(client, message)) {
      return message.reply('<a:_:1483497365863399536> Permission refusée. Utilisez un salon autorisé OSINT ou contactez un admin.');
    }

    const totalCredits = getCredits(authorId, guild.id);
    if (totalCredits < LOOKUP_COST) {
      return replyInsufficientCredits(
        (opt) => message.reply(opt).catch(() => channel.send(opt)),
        LOOKUP_COST,
        totalCredits
      );
    }

    const query = args.join(' ').trim();
    if (!query) {
      return message.reply(`<a:_:1483497365863399536> Utilisation : \`${prefix}lookup <email|ip|domaine|numéro|username>\``);
    }

    const lookupSources = getLookupSources();
    if (!lookupSources || typeof lookupSources.getQueryType !== 'function' || typeof lookupSources.runAllLookups !== 'function') {
      return message.reply('<a:_:1483497365863399536> Module lookup indisponible (lookupSources non chargé). Vérifiez les logs.').catch(() => {});
    }

    const loadingMsg = await channel.send(`${EMOJIS.BUG} **Lookup en cours sur plusieurs sources…**`);

    let sections = [];
    let queryType = 'username';

    try {
      queryType = lookupSources.getQueryType(query);
      const { sections: s } = await lookupSources.runAllLookups(query, queryType);
      sections = s;

      if (queryType === 'discord_id') {
        try {
          const discordUser = await client.users.fetch(query).catch(() => null);
          if (discordUser) {
            const created = discordUser.createdAt ? discordUser.createdAt.toLocaleString('fr-FR', { dateStyle: 'medium', timeStyle: 'short' }) : 'N/A';
            const content = [
              `**Profil Discord**`,
              `• **Tag :** ${discordUser.tag}`,
              `• **ID :** \`${discordUser.id}\``,
              `• **Compte créé :** ${created}`,
              `• **Bot :** ${discordUser.bot ? 'Oui' : 'Non'}`,
              discordUser.displayAvatarURL() ? `• **Avatar :** ${discordUser.displayAvatarURL({ size: 256 })}` : ''
            ].filter(Boolean).join('\n');
            sections.unshift({ id: 'discord_profile', name: 'Profil Discord', emoji: EMOJIS.USER, contentPages: [content] });
          } else {
            sections.unshift({ id: 'discord_profile', name: 'Profil Discord', emoji: EMOJIS.USER, contentPages: ['Utilisateur non trouvé (ID invalide ou bot sans accès).'] });
          }
        } catch (_) {
          sections.unshift({ id: 'discord_profile', name: 'Profil Discord', emoji: EMOJIS.USER, contentPages: ['Impossible de récupérer le profil (cache ou permissions).'] });
        }
      }

      deductCredits(authorId, LOOKUP_COST);
    } catch (err) {
      console.error('Lookup error:', err);
      return loadingMsg.edit('<a:_:1483497365863399536> Erreur lors de la recherche.').catch(() => {});
    }

    if (!sections.length) {
      return loadingMsg.edit('Aucun résultat trouvé pour cette requête.').catch(() => {});
    }

    let sectionIndex = 0;
    let pageIndex = 0;

    const embedColor = color || client.config?.color || client.config?.SETTINGS?.EMBED_COLOR || COLORS.INFO;

    function getCurrentSection() {
      return sections[sectionIndex] || sections[0];
    }

    function getCurrentPageContent() {
      const sec = getCurrentSection();
      const pages = sec.contentPages || [];
      const idx = Math.min(pageIndex, Math.max(0, pages.length - 1));
      return pages[idx] || '*Aucune donnée*';
    }

    function generateEmbed() {
      const sec = getCurrentSection();
      const totalPages = Math.max(1, (sec.contentPages || []).length);
      const typeLabel = QUERY_TYPE_LABELS[queryType] || queryType;
      const secEmoji = getSectionEmoji(sec.id);
      const content = trunc(getCurrentPageContent(), MAX_FIELD_VALUE) || '*Vide*';

      const lines = [
        `## ${secEmoji?.str || ''} ${trunc(sec.name, 100)}`,
        `${EMOJIS.ARROW} **Requête :** \`${query}\`  |  **Type :** ${typeLabel}`,
        '',
        content,
        '',
        `*Section ${sectionIndex + 1}/${sections.length} • Page ${pageIndex + 1}/${totalPages} • ${LOOKUP_COST} crédits*`
      ];

      return container(txt(lines.join('\n')));
    }

    function generateComponents() {
      const sec = getCurrentSection();
      const totalPages = Math.max(1, (sec.contentPages || []).length);
      const uid = authorId;

      const selectOptions = sections.map((s, i) => {
        const e = getSectionEmoji(s.id);
        const opt = new StringSelectMenuOptionBuilder()
          .setLabel(trunc(s.name || 'Section', MAX_SELECT_LABEL))
          .setValue(`section_${i}`)
          .setDefault(i === sectionIndex);
        if (e && e.id) opt.setEmoji({ id: e.id });
        return opt;
      });

      const selectMenu = new StringSelectMenuBuilder()
        .setCustomId(trunc(`lookup_section_${uid}`, 100))
        .setPlaceholder(trunc(`Choisir une section • ${sec.name}`, MAX_SELECT_PLACEHOLDER))
        .addOptions(selectOptions);

      const firstBtn = new ButtonBuilder()
        .setCustomId(`lookup_first_${uid}`)
        .setEmoji({ id: emojiId(EMB.precedent) || '1457021755985105099' })
        .setStyle(ButtonStyle.Secondary)
        .setDisabled(pageIndex === 0);

      const prevBtn = new ButtonBuilder()
        .setCustomId(`lookup_prev_${uid}`)
        .setEmoji({ id: emojiId(EMB.precedent) || '1457021755985105099' })
        .setStyle(ButtonStyle.Primary)
        .setDisabled(pageIndex === 0);

      const nextBtn = new ButtonBuilder()
        .setCustomId(`lookup_next_${uid}`)
        .setEmoji({ id: emojiId(EMB.suivant) || '1457021759336349696' })
        .setStyle(ButtonStyle.Primary)
        .setDisabled(pageIndex >= totalPages - 1);

      const lastBtn = new ButtonBuilder()
        .setCustomId(`lookup_last_${uid}`)
        .setEmoji({ id: emojiId(EMB.suivant) || '1457021759336349696' })
        .setStyle(ButtonStyle.Secondary)
        .setDisabled(pageIndex >= totalPages - 1);

      const row1 = new ActionRowBuilder().addComponents(selectMenu);
      const row2 = new ActionRowBuilder().addComponents(firstBtn, prevBtn, nextBtn, lastBtn);

      return [row1, row2];
    }

    await loadingMsg.edit({
      content: null,
      components: [generateEmbed(), ...generateComponents()],
      flags: FLAGS
    }).catch(() => {});

    const sentMessage = loadingMsg;
    const messageId = sentMessage?.id;
    if (messageId) {
      setLookupState(messageId, {
        sections,
        queryType,
        sectionIndex,
        pageIndex,
        query,
        authorId,
        embedColor
      });
    }

    const collector = sentMessage.createMessageComponentCollector?.({ time: LOOKUP_STATE_TTL_MS });

    if (collector) {
      collector.on('collect', async (interaction) => {
      if (interaction.user.id !== authorId) {
        return interaction.reply({ content: 'Ce menu est réservé à l’auteur de la commande.', ephemeral: true }).catch(() => {});
      }

      const customId = interaction.customId || '';

      if (interaction.isStringSelectMenu() && customId === `lookup_section_${authorId}`) {
        const val = interaction.values[0] || '';
        const idx = parseInt(val.replace('section_', ''), 10);
        if (!Number.isNaN(idx)) {
          sectionIndex = Math.min(Math.max(0, idx), sections.length - 1);
          pageIndex = 0;
        }
      } else {
        const payload = customId.replace(/^lookup_/, '').split('_');
        const action = payload[0];
        const sec = getCurrentSection();
        const totalPages = Math.max(1, (sec.contentPages || []).length);

        switch (action) {
          case 'first':
            pageIndex = 0;
            break;
          case 'prev':
            pageIndex = Math.max(0, pageIndex - 1);
            break;
          case 'next':
            pageIndex = Math.min(totalPages - 1, pageIndex + 1);
            break;
          case 'last':
            pageIndex = Math.max(0, totalPages - 1);
            break;
          default:
            break;
        }
      }

        if (messageId) {
          const st = getLookupState(messageId);
          if (st) {
            st.sectionIndex = sectionIndex;
            st.pageIndex = pageIndex;
          }
        }
      await interaction.update({
        components: [generateEmbed(), ...generateComponents()],
        flags: FLAGS
      }).catch(() => {});
    });

      collector.on('end', () => {
        if (messageId) LOOKUP_STATE_BY_MESSAGE_ID.delete(messageId);
        sentMessage.edit?.({ components: [] }).catch(() => {});
      });
    }
  }
};
