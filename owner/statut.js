const {
    ActionRowBuilder,
    ButtonBuilder,
    ButtonStyle,
    StringSelectMenuBuilder,
    StringSelectMenuOptionBuilder,
    ModalBuilder,
    TextInputBuilder,
    TextInputStyle,
    ActivityType
} = require('discord.js');
const db = require('../../utils/simpledb');
const { hasPermissionLevel, AccessLevels } = require('../../utils/permissionUtils');
const { container, txt, sep, FLAGS } = require('../../utils/v2');

const TIMEOUT_MS = 180_000;

const KEY_LIST   = (botId) => `statut_list_${botId}`;
const KEY_ACTIVE = (botId) => `statut_active_${botId}`;
const KEY_INDEX  = (botId) => `statut_index_${botId}`;

const rotatorIntervals = new Map();

const ACTIVITY_TYPES = {
    Playing:   { value: ActivityType.Playing,   label: 'Playing',   emoji: '🎮' },
    Streaming: { value: ActivityType.Streaming, label: 'Streaming', emoji: '📡' },
    Listening: { value: ActivityType.Listening, label: 'Listening', emoji: '🎵' },
    Watching:  { value: ActivityType.Watching,  label: 'Watching',  emoji: '👁️' },
    Competing: { value: ActivityType.Competing, label: 'Competing', emoji: '🏆' }
};

function resolveVars(text, client) {
    return text
        .replace(/\{guilds\}/gi,   String(client.guilds?.cache?.size ?? 0))
        .replace(/\{members\}/gi,  String([...(client.guilds?.cache?.values() ?? [])].reduce((a, g) => a + (g.memberCount || 0), 0)))
        .replace(/\{ping\}/gi,     String(client.ws?.ping ?? 0))
        .replace(/\{commands\}/gi, String(client.commands?.size ?? 0));
}

function startRotation(client) {
    const botId = client.user?.id;
    if (!botId) return;
    stopRotation(botId);
    const list = db.get(KEY_LIST(botId)) || [];
    if (!list.length) return;
    applyStatus(client, list, botId);
    const entry = list[db.get(KEY_INDEX(botId)) || 0];
    const intervalMs = (entry?.duration || 10) * 1000;
    const handle = setInterval(() => {
        const currentList = db.get(KEY_LIST(botId)) || [];
        if (!currentList.length) { stopRotation(botId); return; }
        applyStatus(client, currentList, botId);
    }, intervalMs);
    rotatorIntervals.set(botId, handle);
}

function stopRotation(botId) {
    if (rotatorIntervals.has(botId)) {
        clearInterval(rotatorIntervals.get(botId));
        rotatorIntervals.delete(botId);
    }
}

function applyStatus(client, list, botId) {
    if (!list.length) return;
    let idx = db.get(KEY_INDEX(botId)) || 0;
    if (idx >= list.length) idx = 0;
    const entry = list[idx];
    const text  = resolveVars(entry.text, client);
    const type  = ACTIVITY_TYPES[entry.type]?.value ?? ActivityType.Playing;
    const options = { type };
    if (entry.type === 'Streaming') options.url = 'https://twitch.tv/monstercat';
    try { client.user.setActivity(text, options); } catch (_) {}
    db.set(KEY_INDEX(botId), (idx + 1) % list.length);
    const currentHandle = rotatorIntervals.get(botId);
    if (currentHandle) {
        clearInterval(currentHandle);
        const handle = setInterval(() => {
            const updatedList = db.get(KEY_LIST(botId)) || [];
            if (!updatedList.length) { stopRotation(botId); return; }
            applyStatus(client, updatedList, botId);
        }, entry.duration * 1000);
        rotatorIntervals.set(botId, handle);
    }
}

function buildListContainer(list, botId, active) {
    const total = 25;
    const isActive = active ?? db.get(KEY_ACTIVE(botId)) ?? false;
    const statusLine = isActive ? '🟢 **Actif**' : '🔴 **Inactif**';
    const lines = [
        `**Statut Rotator** — ${list.length}/${total} statuts`,
        `**État :** ${statusLine}`,
        '',
        list.length
            ? list.map((e, i) => `\`${String(i + 1).padStart(2, '0')}\` **${e.text}** — ${e.type} — ${e.duration}s`).join('\n')
            : '*Aucun statut configuré. Cliquez sur **+** pour en ajouter un.*'
    ].join('\n');
    return container(txt('## 📡 Statut Rotator'), sep(), txt(lines));
}

function buildAddContainer(draft) {
    const lines = [
        `**Statut :** ${draft.text ? `\`${draft.text}\`` : '*Non défini (requis)*'}`,
        `**Type :** ${draft.type ? `${ACTIVITY_TYPES[draft.type]?.emoji ?? ''} ${draft.type}` : '*Non défini (requis)*'}`,
        `**Durée :** ${draft.duration ?? 10} secondes`,
    ].join('\n');
    return container(txt('## ➕ Ajouter un Statut'), sep(), txt(lines));
}

function buildMainRow(active) {
    return new ActionRowBuilder().addComponents(
        new ButtonBuilder()
            .setCustomId('sr_toggle')
            .setLabel(active ? 'Désactiver' : 'Activer')
            .setStyle(active ? ButtonStyle.Danger : ButtonStyle.Success),
        new ButtonBuilder()
            .setCustomId('sr_add')
            .setLabel('+')
            .setStyle(ButtonStyle.Secondary)
    );
}

function buildDeleteMenu(list) {
    if (!list.length) return null;
    const menu = new StringSelectMenuBuilder()
        .setCustomId('sr_delete')
        .setPlaceholder('Supprimer un statut...')
        .addOptions(
            list.slice(0, 25).map((e, i) =>
                new StringSelectMenuOptionBuilder()
                    .setLabel(`${i + 1}. ${e.text.slice(0, 50)}`)
                    .setValue(String(i))
            )
        );
    return new ActionRowBuilder().addComponents(menu);
}

function buildTypeMenu() {
    return new ActionRowBuilder().addComponents(
        new StringSelectMenuBuilder()
            .setCustomId('sr_type')
            .setPlaceholder('Type de statut...')
            .addOptions(Object.entries(ACTIVITY_TYPES).map(([key, val]) =>
                new StringSelectMenuOptionBuilder()
                    .setLabel(`${val.emoji} ${val.label}`)
                    .setValue(key)
            ))
    );
}

function buildDurationMenu() {
    const durations = [5, 10, 15, 20, 30, 45, 60, 120, 300];
    return new ActionRowBuilder().addComponents(
        new StringSelectMenuBuilder()
            .setCustomId('sr_duration')
            .setPlaceholder("Durée d'affichage...")
            .addOptions(durations.map(d =>
                new StringSelectMenuOptionBuilder()
                    .setLabel(`${d} secondes`)
                    .setValue(String(d))
            ))
    );
}

function buildAddRow() {
    return new ActionRowBuilder().addComponents(
        new ButtonBuilder().setCustomId('sr_settext').setLabel('Statut').setStyle(ButtonStyle.Primary),
        new ButtonBuilder().setCustomId('sr_save').setLabel('Sauvegarder').setStyle(ButtonStyle.Success),
        new ButtonBuilder().setCustomId('sr_cancel').setLabel('Annuler').setStyle(ButtonStyle.Secondary)
    );
}

module.exports = {
    name: 'statut',
    aliases: ['status', 'rotator', 'statusrotator'],
    description: 'Configure le rotateur automatique de statuts du bot.',

    run: async (client, message) => {
        if (!hasPermissionLevel(client, message, AccessLevels.OWNER)) {
            return message.reply({
                components: [container(txt('## ❌ Permission Refusée'), sep(), txt('Niveau de permission requis : `7` (Owner)'))],
                flags: FLAGS
            });
        }

        const botId  = client.user.id;
        let list     = db.get(KEY_LIST(botId)) || [];
        let active   = db.get(KEY_ACTIVE(botId)) ?? false;
        let draft    = { text: '', type: '', duration: 10 };

        const deleteMenu = buildDeleteMenu(list);
        const msg = await message.reply({
            components: [...(deleteMenu ? [deleteMenu] : []), buildListContainer(list, botId, active), buildMainRow(active)],
            flags: FLAGS
        });

        const collector = msg.createMessageComponentCollector({
            time:   TIMEOUT_MS,
            filter: i => i.user.id === message.author.id
        });

        async function showList() {
            draft  = { text: '', type: '', duration: 10 };
            list   = db.get(KEY_LIST(botId)) || [];
            active = db.get(KEY_ACTIVE(botId)) ?? false;
            const del = buildDeleteMenu(list);
            await msg.edit({
                components: [...(del ? [del] : []), buildListContainer(list, botId, active), buildMainRow(active)],
                flags: FLAGS
            }).catch(() => {});
        }

        async function showAdd() {
            await msg.edit({
                components: [buildAddContainer(draft), buildTypeMenu(), buildDurationMenu(), buildAddRow()],
                flags: FLAGS
            }).catch(() => {});
        }

        collector.on('collect', async (interaction) => {
            const id = interaction.customId;

            if (id === 'sr_toggle') {
                await interaction.deferUpdate().catch(() => {});
                active = !active;
                db.set(KEY_ACTIVE(botId), active);
                if (active) { startRotation(client); }
                else { stopRotation(botId); try { client.user.setActivity(null); } catch (_) {} }
                await showList();
                return;
            }

            if (id === 'sr_add') {
                await interaction.deferUpdate().catch(() => {});
                if (list.length >= 25) {
                    await msg.edit({
                        components: [container(txt('## ⚠️ Limite Atteinte'), sep(), txt('Vous ne pouvez pas ajouter plus de **25 statuts**.'))],
                        flags: FLAGS
                    }).catch(() => {});
                    return;
                }
                await showAdd();
                return;
            }

            if (id === 'sr_cancel') {
                await interaction.deferUpdate().catch(() => {});
                await showList();
                return;
            }

            if (id === 'sr_settext') {
                const modal = new ModalBuilder().setCustomId('sr_modal_text').setTitle('Texte du statut');
                modal.addComponents(new ActionRowBuilder().addComponents(
                    new TextInputBuilder()
                        .setCustomId('statut_text')
                        .setLabel('Texte affiché')
                        .setStyle(TextInputStyle.Short)
                        .setPlaceholder('Ex: on {guilds} servers | managed {members} members')
                        .setMaxLength(128)
                        .setRequired(true)
                        .setValue(draft.text || '')
                ));
                await interaction.showModal(modal);
                let submit;
                try {
                    submit = await interaction.awaitModalSubmit({
                        filter: i => i.customId === 'sr_modal_text' && i.user.id === message.author.id,
                        time: 60_000
                    });
                } catch { return; }
                draft.text = submit.fields.getTextInputValue('statut_text').trim();
                await submit.deferUpdate().catch(() => {});
                await showAdd();
                return;
            }

            if (id === 'sr_type') {
                await interaction.deferUpdate().catch(() => {});
                draft.type = interaction.values[0];
                await showAdd();
                return;
            }

            if (id === 'sr_duration') {
                await interaction.deferUpdate().catch(() => {});
                draft.duration = parseInt(interaction.values[0]);
                await showAdd();
                return;
            }

            if (id === 'sr_save') {
                await interaction.deferUpdate().catch(() => {});
                if (!draft.text) {
                    await msg.edit({ components: [container(txt('## ⚠️ Texte requis'), sep(), txt('**Vous devez définir un texte de statut.**')), buildTypeMenu(), buildDurationMenu(), buildAddRow()], flags: FLAGS }).catch(() => {});
                    return;
                }
                if (!draft.type) {
                    await msg.edit({ components: [container(txt('## ⚠️ Type requis'), sep(), txt('**Vous devez sélectionner un type de statut.**')), buildTypeMenu(), buildDurationMenu(), buildAddRow()], flags: FLAGS }).catch(() => {});
                    return;
                }
                list = db.get(KEY_LIST(botId)) || [];
                list.push({ text: draft.text, type: draft.type, duration: draft.duration });
                db.set(KEY_LIST(botId), list);
                if (db.get(KEY_ACTIVE(botId))) startRotation(client);
                await showList();
                return;
            }

            if (id === 'sr_delete') {
                await interaction.deferUpdate().catch(() => {});
                const idx = parseInt(interaction.values[0]);
                list = db.get(KEY_LIST(botId)) || [];
                list.splice(idx, 1);
                db.set(KEY_LIST(botId), list);
                const curIdx = db.get(KEY_INDEX(botId)) || 0;
                if (curIdx >= list.length) db.set(KEY_INDEX(botId), 0);
                if (db.get(KEY_ACTIVE(botId)) && list.length) startRotation(client);
                else if (!list.length) { stopRotation(botId); try { client.user.setActivity(null); } catch (_) {} }
                await showList();
                return;
            }
        });

        collector.on('end', async (_, reason) => {
            if (reason !== 'messageDelete') await msg.edit({ components: [] }).catch(() => {});
        });
    },

    startRotation,
    stopRotation
};
