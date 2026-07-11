const {
  ContainerBuilder,
  TextDisplayBuilder,
  SeparatorBuilder,
  SectionBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  MessageFlags,
  StringSelectMenuBuilder,
  StringSelectMenuOptionBuilder,
  MediaGalleryBuilder,
  MediaGalleryItemBuilder,
  ChannelSelectMenuBuilder,
  RoleSelectMenuBuilder,
  UserSelectMenuBuilder
} = require('discord.js');

function container(...components) {
  const c = new ContainerBuilder();
  for (const comp of components) {
    if (!comp) continue;
    if (comp._type === 'text') {
      c.addTextDisplayComponents(new TextDisplayBuilder().setContent(comp.content));
    } else if (comp._type === 'sep') {
      c.addSeparatorComponents(new SeparatorBuilder());
    } else if (comp._type === 'section') {
      c.addSectionComponents(comp.section);
    } else if (comp._type === 'row') {
      c.addActionRowComponents(comp.row);
    } else if (comp._type === 'media') {
      c.addMediaGalleryComponents(comp.gallery);
    }
  }
  return c;
}

function txt(content) {
  return { _type: 'text', content };
}

function sep() {
  return { _type: 'sep' };
}

function section(text, btnComp) {
  const s = new SectionBuilder()
    .addTextDisplayComponents(new TextDisplayBuilder().setContent(text))
    .setButtonAccessory(btnComp);
  return { _type: 'section', section: s };
}

function row(...components) {
  const r = new ActionRowBuilder().addComponents(...components);
  return { _type: 'row', row: r };
}

function media(urls) {
  const g = new MediaGalleryBuilder();
  for (const url of (Array.isArray(urls) ? urls : [urls])) {
    g.addItems(new MediaGalleryItemBuilder().setURL(url));
  }
  return { _type: 'media', gallery: g };
}

function btn(customId, label, style = ButtonStyle.Secondary, emoji = null, disabled = false) {
  const b = new ButtonBuilder()
    .setCustomId(customId)
    .setLabel(label)
    .setStyle(style)
    .setDisabled(disabled);
  if (emoji) b.setEmoji(emoji);
  return b;
}

function linkBtn(url, label, emoji = null) {
  const b = new ButtonBuilder()
    .setURL(url)
    .setLabel(label)
    .setStyle(ButtonStyle.Link);
  if (emoji) b.setEmoji(emoji);
  return b;
}

function selectMenu(customId, placeholder, options, minValues = 1, maxValues = 1) {
  const menu = new StringSelectMenuBuilder()
    .setCustomId(customId)
    .setPlaceholder(placeholder)
    .setMinValues(minValues)
    .setMaxValues(maxValues);
  for (const opt of options) {
    const o = new StringSelectMenuOptionBuilder()
      .setLabel(opt.label)
      .setValue(opt.value);
    if (opt.description) o.setDescription(opt.description);
    if (opt.emoji) o.setEmoji(opt.emoji);
    if (opt.default) o.setDefault(true);
    menu.addOptions(o);
  }
  return menu;
}

function selectRow(menu) {
  return new ActionRowBuilder().addComponents(menu);
}

const FLAGS = MessageFlags.IsComponentsV2 ?? (1 << 15);

function send(target, c, ephemeral = false) {
  const opts = { components: [c], flags: FLAGS };
  if (ephemeral) opts.flags |= MessageFlags.Ephemeral;
  if (target.reply && !target.replied && !target.deferred) {
    return target.reply(opts);
  }
  return target.channel ? target.channel.send(opts) : target.send(opts);
}

function reply(message, c) {
  return message.reply({ components: [c], flags: FLAGS });
}

function progress(current, total, width = 20) {
  const pct = total > 0 ? current / total : 0;
  const filled = Math.round(pct * width);
  const empty = width - filled;
  return '█'.repeat(filled) + '░'.repeat(empty) + ` ${Math.round(pct * 100)}%`;
}

function formatNumber(n) {
  return Number(n || 0).toLocaleString('fr-FR');
}

function formatDuration(ms) {
  if (ms < 0) return '0s';
  const s = Math.floor(ms / 1000);
  const m = Math.floor(s / 60);
  const h = Math.floor(m / 60);
  const d = Math.floor(h / 24);
  if (d > 0) return `${d}j ${h % 24}h ${m % 60}m`;
  if (h > 0) return `${h}h ${m % 60}m`;
  if (m > 0) return `${m}m ${s % 60}s`;
  return `${s}s`;
}

function formatDate(ts) {
  return new Date(ts).toLocaleDateString('fr-FR', {
    day: '2-digit', month: '2-digit', year: 'numeric',
    hour: '2-digit', minute: '2-digit'
  });
}

function errorContainer(msg) {
  return container(
    txt(`## ❌ Erreur`),
    sep(),
    txt(msg)
  );
}

function successContainer(title, lines) {
  return container(
    txt(`## ${title}`),
    sep(),
    txt(Array.isArray(lines) ? lines.join('\n') : lines)
  );
}

function confirmContainer(title, desc, confirmId, cancelId, confirmLabel = 'Confirmer', cancelLabel = 'Annuler') {
  return container(
    txt(`## ⚠️ ${title}`),
    sep(),
    txt(desc),
    row(
      btn(confirmId, confirmLabel, ButtonStyle.Success),
      btn(cancelId, cancelLabel, ButtonStyle.Danger)
    )
  );
}

function noPermContainer() {
  return errorContainer(`**Permission insuffisante**\nVous n'avez pas le niveau requis pour cette commande.`);
}

function paginationRow(page, totalPages, prevId, nextId, extraBtns = []) {
  const btns = [
    btn(prevId, '‹', ButtonStyle.Secondary, null, page <= 1),
    btn('page_info', `Page ${page}/${totalPages}`, ButtonStyle.Secondary, null, true),
    btn(nextId, '›', ButtonStyle.Secondary, null, page >= totalPages),
    ...extraBtns
  ];
  return row(...btns);
}

module.exports = {
  container, txt, sep, section, row, media,
  btn, linkBtn, selectMenu, selectRow,
  FLAGS, send, reply,
  progress, formatNumber, formatDuration, formatDate,
  errorContainer, successContainer, confirmContainer, noPermContainer,
  paginationRow, ButtonStyle, MessageFlags,
  ChannelSelectMenuBuilder, RoleSelectMenuBuilder, UserSelectMenuBuilder,
  ActionRowBuilder, StringSelectMenuBuilder, StringSelectMenuOptionBuilder
};
