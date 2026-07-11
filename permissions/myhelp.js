const { ActionRowBuilder, ButtonBuilder, StringSelectMenuBuilder, StringSelectMenuOptionBuilder } = require('discord.js');
const { container, txt, sep, reply, FLAGS, ButtonStyle } = require('../../utils/v2');
const { getExactPermissionLevel } = require('../../utils/permissionUtils');
const fs   = require('fs');
const path = require('path');

const PER_PAGE = 8;

const CATEGORY_CONFIG = [
    { key: 'general',     label: 'Général',             emoji: '📋' },
    { key: 'utilitaire',  label: 'Utilitaires',          emoji: '🔧' },
    { key: 'gestion',     label: 'Gestion',              emoji: '⚙️' },
    { key: 'mods',        label: 'Modération',           emoji: '🔨' },
    { key: 'levels',      label: 'Niveaux & XP',         emoji: '⭐' },
    { key: 'fun',         label: 'Fun',                  emoji: '🎮' },
    { key: 'music',       label: 'Musique',              emoji: '🎵' },
    { key: 'casino',      label: 'Casino',               emoji: '🎲' },
    { key: 'credits',     label: 'Crédits',              emoji: '💰' },
    { key: 'osint',       label: 'OSINT',                emoji: '🔍' },
    { key: 'bot',         label: 'Bot',                  emoji: '🤖' },
    { key: 'admin',       label: 'Administration',       emoji: '👑' },
    { key: 'permissions', label: 'Permissions',          emoji: '🔒' },
    { key: 'invites',     label: 'Invitations',          emoji: '🔔' },
    { key: 'crush',       label: 'Crush & Profils',      emoji: '👤' },
    { key: 'superowner',  label: 'Super Owner',          emoji: '🛡️' },
    { key: 'owner',       label: 'Owner',                emoji: '🚫' },
];

function loadUserCommands(client, message, userLevel) {
    const result = {};
    const cmdPath = path.join(process.cwd(), 'commands');
    try {
        const folders = fs.readdirSync(cmdPath);
        for (const folder of folders) {
            const folderPath = path.join(cmdPath, folder);
            if (!fs.statSync(folderPath).isDirectory()) continue;
            const files = fs.readdirSync(folderPath).filter(f => f.endsWith('.js'));
            const cmds = [];
            for (const file of files) {
                try {
                    const mod = require(path.join(folderPath, file));
                    const cmd = (typeof mod === 'function' ? mod() : mod?.default || mod);
                    if (!cmd?.name) continue;
                    const level = cmd.level ?? cmd.requiredLevel ?? cmd.permissionLevel ?? 0;
                    if (level > userLevel) continue;
                    cmds.push({
                        name: cmd.name,
                        description: cmd.description || 'Aucune description.',
                        aliases: cmd.aliases || [],
                        level
                    });
                } catch { }
            }
            if (cmds.length > 0) {
                cmds.sort((a, b) => a.name.localeCompare(b.name));
                result[folder.toLowerCase()] = cmds;
            }
        }
    } catch { }
    return result;
}

module.exports = {
    name: 'myhelp',
    aliases: ['monhelp', 'mescommandes'],
    description: 'Affiche uniquement les commandes que vous pouvez utiliser',
    usage: '[catégorie]',
    level: 0,
    category: 'permissions',
    run: async (client, message, args) => {
        try {
            let userLevel = 0;
            try { userLevel = getExactPermissionLevel(client, message); } catch {}
            const prefix = client.config?.prefix || '+';

            const allCmds = loadUserCommands(client, message, userLevel);
            const availableCats = Object.keys(allCmds).filter(k => allCmds[k].length > 0);

            if (availableCats.length === 0) {
                return reply(message, container(
                    txt('## 📋 Mes Commandes'),
                    sep(),
                    txt('❌ Aucune commande accessible avec votre niveau de permission.')
                ));
            }

            const totalCmds = Object.values(allCmds).reduce((a, c) => a + c.length, 0);

            let selectedCat = args[0]?.toLowerCase();
            if (!selectedCat || !allCmds[selectedCat]) {
                selectedCat = CATEGORY_CONFIG.find(c => allCmds[c.key])?.key || availableCats[0];
            }
            let pageIdx = 0;

            const getCatInfo = (key) => CATEGORY_CONFIG.find(c => c.key === key) || { key, label: key.charAt(0).toUpperCase() + key.slice(1), emoji: '📁' };

            const buildSelectMenu = (currentKey) => {
                const options = CATEGORY_CONFIG
                    .filter(c => allCmds[c.key]?.length > 0)
                    .map(c => {
                        const count = allCmds[c.key].length;
                        const o = new StringSelectMenuOptionBuilder()
                            .setLabel(`${c.emoji} ${c.label}`)
                            .setValue(c.key)
                            .setDescription(`${count} commande${count > 1 ? 's' : ''}`)
                        if (c.key === currentKey) o.setDefault(true);
                        return o;
                    });
                availableCats.forEach(key => {
                    if (!CATEGORY_CONFIG.find(c => c.key === key)) {
                        const count = allCmds[key].length;
                        const o = new StringSelectMenuOptionBuilder()
                            .setLabel(key.charAt(0).toUpperCase() + key.slice(1))
                            .setValue(key)
                            .setDescription(`${count} commande${count > 1 ? 's' : ''}`);
                        if (key === currentKey) o.setDefault(true);
                        options.push(o);
                    }
                });
                return new StringSelectMenuBuilder()
                    .setCustomId(`mh_cat_${message.author.id}`)
                    .setPlaceholder('› Choisir une catégorie...')
                    .addOptions(options.slice(0, 25));
            };

            const buildPage = (cat, idx) => {
                const cmds = allCmds[cat] || [];
                const totalPages = Math.max(1, Math.ceil(cmds.length / PER_PAGE));
                if (idx >= totalPages) idx = 0;
                const slice = cmds.slice(idx * PER_PAGE, (idx + 1) * PER_PAGE);
                const info = getCatInfo(cat);
                const cmdLines = slice.length
                    ? slice.map(cmd => {
                        const aliases = cmd.aliases.length ? ` *(${cmd.aliases.slice(0, 2).map(a => `\`${a}\``).join(', ')})*` : '';
                        return `**${info.emoji} \`${prefix}${cmd.name}\`**${aliases}\n${cmd.description}`;
                    }).join('\n\n')
                    : '*Aucune commande.*';

                const selectRow = new ActionRowBuilder().addComponents(buildSelectMenu(cat));
                const navRow    = new ActionRowBuilder().addComponents(
                    new ButtonBuilder().setCustomId(`mh_first_${message.author.id}`).setEmoji('⏮').setStyle(ButtonStyle.Secondary).setDisabled(idx === 0),
                    new ButtonBuilder().setCustomId(`mh_prev_${message.author.id}`).setEmoji('◀').setStyle(ButtonStyle.Primary).setDisabled(idx === 0),
                    new ButtonBuilder().setCustomId(`mh_info_${message.author.id}`).setLabel(`${idx + 1}/${totalPages}`).setStyle(ButtonStyle.Secondary).setDisabled(true),
                    new ButtonBuilder().setCustomId(`mh_next_${message.author.id}`).setEmoji('▶').setStyle(ButtonStyle.Primary).setDisabled(idx >= totalPages - 1),
                    new ButtonBuilder().setCustomId(`mh_last_${message.author.id}`).setEmoji('⏭').setStyle(ButtonStyle.Secondary).setDisabled(idx >= totalPages - 1)
                );

                return container(
                    txt(`## ${info.emoji} ${info.label} — Mes Commandes`),
                    sep(),
                    txt(`**Niveau :** ${userLevel} • **Commandes accessibles :** ${totalCmds}`),
                    sep(),
                    txt(cmdLines),
                    sep(),
                    txt(`*Page ${idx + 1}/${totalPages} • ${cmds.length} commande${cmds.length > 1 ? 's' : ''} dans cette catégorie*`),
                    { _type: 'row', row: selectRow },
                    { _type: 'row', row: navRow }
                );
            };

            const sent = await reply(message, buildPage(selectedCat, pageIdx));

            const collector = sent.createMessageComponentCollector({
                filter: i => i.user.id === message.author.id,
                time: 300_000
            });

            collector.on('collect', async (interaction) => {
                await interaction.deferUpdate().catch(() => {});
                const id = interaction.customId;
                if (id.startsWith('mh_cat_')) {
                    selectedCat = interaction.values[0];
                    pageIdx = 0;
                } else {
                    const maxPages = Math.max(1, Math.ceil((allCmds[selectedCat] || []).length / PER_PAGE));
                    if (id.startsWith('mh_next_'))  pageIdx = Math.min(pageIdx + 1, maxPages - 1);
                    else if (id.startsWith('mh_prev_'))  pageIdx = Math.max(pageIdx - 1, 0);
                    else if (id.startsWith('mh_first_')) pageIdx = 0;
                    else if (id.startsWith('mh_last_'))  pageIdx = maxPages - 1;
                }
                await sent.edit({ components: [buildPage(selectedCat, pageIdx)], flags: FLAGS }).catch(() => {});
            });

            collector.on('end', () => sent.edit({ components: [] }).catch(() => {}));

        } catch (err) {
            console.error('[myhelp]', err);
            return reply(message, container(txt('## ❌ Erreur'), sep(), txt(`\`${err.message}\``)));
        }
    }
};
