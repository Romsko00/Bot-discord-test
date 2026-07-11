const { container, txt, sep, reply, row, btn, FLAGS, ButtonStyle } = require('../../utils/v2');
const { ActionRowBuilder, ButtonBuilder } = require('discord.js');
const db = require('../../utils/simpledb');

const PER_PAGE = 6;

const LEVEL_NAMES = {
    0: 'Public',
    1: 'Membre',
    2: 'Niveau 2',
    3: 'Niveau 3',
    4: 'Admin',
    5: 'Manager',
    6: 'Owner',
    7: 'Bot Owner',
    8: 'Buyer',
    9: 'Super Admin'
};

module.exports = {
    name: 'helpall',
    description: 'Affiche toutes les commandes classées par niveau de permission',
    category: 'permissions',
    level: 0,
    run: async (client, message) => {
        try {
            const levels = {};
            for (let i = 0; i <= 9; i++) levels[i] = [];

            if (!client.commands || client.commands.size === 0) {
                return reply(message, container(
                    txt('## 📚 Commandes par Niveau'),
                    sep(),
                    txt('❌ Aucune commande chargée.')
                ));
            }

            client.commands.forEach(cmd => {
                if (!cmd || !cmd.name) return;
                const dbLevel = db.get(`perm_req_${message.guild.id}_${cmd.name}`);
                const defaultLevel = cmd.level ?? cmd.requiredLevel ?? cmd.permissionLevel ?? 0;
                const finalLevel = (dbLevel !== undefined && dbLevel !== null) ? dbLevel : defaultLevel;
                const lvl = Math.max(0, Math.min(9, parseInt(finalLevel) || 0));
                if (!levels[lvl]) levels[lvl] = [];
                levels[lvl].push(cmd.name);
            });

            const entries = Object.entries(levels)
                .filter(([, cmds]) => cmds.length > 0)
                .map(([lvl, cmds]) => ({
                    lvl: parseInt(lvl),
                    name: LEVEL_NAMES[parseInt(lvl)] || `Niveau ${lvl}`,
                    cmds: cmds.sort()
                }));

            const pages = [];
            let currentPage = [];
            let currentLen = 0;

            for (const entry of entries) {
                const line = `**Niveau ${entry.lvl} — ${entry.name}**\n${entry.cmds.map(c => `\`${c}\``).join(', ')}`;
                if (currentLen + line.length > 1800 && currentPage.length > 0) {
                    pages.push(currentPage.join('\n\n'));
                    currentPage = [];
                    currentLen = 0;
                }
                currentPage.push(line);
                currentLen += line.length + 2;
            }
            if (currentPage.length > 0) pages.push(currentPage.join('\n\n'));
            if (pages.length === 0) pages.push('Aucune commande chargée.');

            const totalPages = pages.length;
            let pageIdx = 0;

            const buildPage = (idx) => {
                const navRow = new ActionRowBuilder().addComponents(
                    new ButtonBuilder().setCustomId('ha_prev').setEmoji('◀️').setStyle(ButtonStyle.Primary).setDisabled(idx <= 0),
                    new ButtonBuilder().setCustomId('ha_info').setLabel(`${idx + 1}/${totalPages}`).setStyle(ButtonStyle.Secondary).setDisabled(true),
                    new ButtonBuilder().setCustomId('ha_next').setEmoji('▶️').setStyle(ButtonStyle.Primary).setDisabled(idx >= totalPages - 1)
                );
                const comps = [
                    txt('## 📚 Commandes par Niveau de Permission'),
                    sep(),
                    txt(pages[idx] || '*Aucune donnée.*'),
                ];
                if (totalPages > 1) comps.push({ _type: 'row', row: navRow });
                return container(...comps);
            };

            const sent = await reply(message, buildPage(pageIdx));
            if (totalPages <= 1) return;

            const collector = sent.createMessageComponentCollector({ filter: i => i.user.id === message.author.id, time: 180_000 });
            collector.on('collect', async (interaction) => {
                await interaction.deferUpdate().catch(() => {});
                if (interaction.customId === 'ha_prev') pageIdx = Math.max(0, pageIdx - 1);
                else if (interaction.customId === 'ha_next') pageIdx = Math.min(totalPages - 1, pageIdx + 1);
                await sent.edit({ components: [buildPage(pageIdx)], flags: FLAGS }).catch(() => {});
            });
            collector.on('end', () => sent.edit({ components: [] }).catch(() => {}));

        } catch (err) {
            console.error('[helpall]', err);
            return reply(message, container(txt('## ❌ Erreur'), sep(), txt(`\`${err.message}\``)));
        }
    }
};
