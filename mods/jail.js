/**
 * +jail — Système de prison
 */

const {
    ActionRowBuilder,
    ButtonBuilder,
    ButtonStyle,
    ChannelSelectMenuBuilder,
    RoleSelectMenuBuilder,
    ChannelType,
    PermissionFlagsBits,
} = require('discord.js');
const db = require('../../utils/simpledb');
const EMOJIS = require('../../utils/emojis');
const { container, txt, sep, FLAGS } = require('../../utils/v2');

const DB_ROLE = (g) => `jail_role_${g}`;
const DB_CHAN = (g) => `jail_channel_${g}`;
const DB_CATEGORY = (g) => `jail_category_${g}`;
const DB_DATA = (g, u) => `jail_data_${g}_${u}`;

function parseDuration(str) {
    if (!str) return null;
    const map = { s: 1000, m: 60_000, h: 3_600_000, d: 86_400_000 };
    const match = str.match(/^(\d+)([smhd])$/i);
    if (!match) return null;
    return parseInt(match[1]) * (map[match[2].toLowerCase()] || 0);
}

function humanDuration(ms) {
    const s = Math.floor(ms / 1000);
    const m = Math.floor(s / 60);
    const h = Math.floor(m / 60);
    const d = Math.floor(h / 24);
    if (d > 0) return `${d}j ${h % 24}h`;
    if (h > 0) return `${h}h ${m % 60}m`;
    if (m > 0) return `${m}m`;
    return `${s}s`;
}

async function applyJailPermissions(guild, role) {
    const jailChanId = db.get(DB_CHAN(guild.id));
    const jailCatId = db.get(DB_CATEGORY(guild.id));

    for (const channel of guild.channels.cache.values()) {
        if ([ChannelType.GuildText, ChannelType.GuildVoice, ChannelType.GuildAnnouncement].includes(channel.type)) {
            await channel.permissionOverwrites.edit(role, {
                ViewChannel: false, SendMessages: false, AddReactions: false,
                Speak: false, Stream: false, Connect: false,
            }).catch(() => {});
        }
    }

    if (jailCatId) {
        const category = guild.channels.cache.get(jailCatId);
        if (category?.type === ChannelType.GuildCategory) {
            await category.permissionOverwrites.edit(role, {
                ViewChannel: true, SendMessages: true, ReadMessageHistory: true,
                AddReactions: false, Connect: true, Speak: false,
            }).catch(() => {});
            for (const ch of guild.channels.cache.values()) {
                if (ch.parentId !== jailCatId) continue;
                if ([ChannelType.GuildText, ChannelType.GuildAnnouncement].includes(ch.type)) {
                    await ch.permissionOverwrites.edit(role, { ViewChannel: true, SendMessages: true, ReadMessageHistory: true }).catch(() => {});
                } else if (ch.type === ChannelType.GuildVoice) {
                    await ch.permissionOverwrites.edit(role, { ViewChannel: true, Connect: true, Speak: false }).catch(() => {});
                }
            }
        }
    }

    if (jailChanId) {
        const jailChan = guild.channels.cache.get(jailChanId);
        if (jailChan) await jailChan.permissionOverwrites.edit(role, { ViewChannel: true, SendMessages: true, ReadMessageHistory: true, AddReactions: false }).catch(() => {});
    }
}

async function ensureJailRole(guild) {
    const roleId = db.get(DB_ROLE(guild.id));
    if (roleId) {
        const existing = guild.roles.cache.get(roleId);
        if (existing) { await applyJailPermissions(guild, existing); return existing; }
    }
    const role = await guild.roles.create({ name: '🔒 Prisonnier', color: 0x808080, permissions: [], reason: 'Système de prison — rôle créé automatiquement' });
    db.set(DB_ROLE(guild.id), role.id);
    await applyJailPermissions(guild, role);
    return role;
}

async function jailMember(guild, target, mod, reason, duration) {
    const jailRole = await ensureJailRole(guild);
    const savedRoles = target.roles.cache.filter(r => r.id !== guild.id && r.id !== jailRole.id).map(r => r.id);

    db.set(DB_DATA(guild.id, target.id), {
        savedRoles, mod: mod.id, reason: reason || 'Aucune raison spécifiée',
        jailedAt: Date.now(), duration: duration || null, releasedAt: duration ? Date.now() + duration : null,
    });

    try { await target.roles.set([guild.id, jailRole.id]); } catch {
        try { await target.roles.remove(savedRoles); } catch {}
        try { await target.roles.add(jailRole); } catch {}
    }

    if (target.voice?.channel) {
        const jailCatId = db.get(DB_CATEGORY(guild.id));
        const jailChanId = db.get(DB_CHAN(guild.id));
        let dest = null;
        if (jailCatId) dest = guild.channels.cache.find(c => c.parentId === jailCatId && c.type === ChannelType.GuildVoice) || null;
        if (!dest && jailChanId) { const ch = guild.channels.cache.get(jailChanId); if (ch?.type === ChannelType.GuildVoice) dest = ch; }
        if (dest) await target.voice.setChannel(dest).catch(() => {});
    }

    if (duration) setTimeout(() => unjailMember(guild, target.id), Math.min(duration, 2_147_483_647));
}

async function unjailMember(guild, targetId) {
    const data = db.get(DB_DATA(guild.id, targetId));
    if (!data) return { success: false };
    const target = guild.members.cache.get(targetId) || await guild.members.fetch(targetId).catch(() => null);
    if (!target) { db.delete(DB_DATA(guild.id, targetId)); return { success: true, target: null }; }
    const jailRoleId = db.get(DB_ROLE(guild.id));
    const rolesToRestore = (data.savedRoles || []).filter(id => guild.roles.cache.has(id));
    try { await target.roles.set([guild.id, ...rolesToRestore]); } catch { if (jailRoleId) await target.roles.remove(jailRoleId).catch(() => {}); }
    db.delete(DB_DATA(guild.id, targetId));
    return { success: true, target, data };
}

function buildConfigContainer(guild) {
    const guildId = guild.id;
    const roleId = db.get(DB_ROLE(guildId));
    const chanId = db.get(DB_CHAN(guildId));
    const catId = db.get(DB_CATEGORY(guildId));
    const jailed = db.all().filter(e => e.ID.startsWith(`jail_data_${guildId}_`)).length;

    let accessValue = `${EMOJIS.ERROR} Non configuré`;
    if (catId) {
        const cat = guild.channels.cache.get(catId);
        const childCount = guild.channels.cache.filter(c => c.parentId === catId).size;
        accessValue = `📁 Catégorie : **${cat?.name || catId}** (${childCount} salon(s))`;
        if (chanId) accessValue += `\n${EMOJIS.ARROW} <#${chanId}> (salon additionnel)`;
    } else if (chanId) {
        accessValue = `${EMOJIS.ARROW} Salon unique : <#${chanId}>`;
    }

    return container(
        txt(`## ${EMOJIS.LOCK} Configuration Prison`),
        sep(),
        txt([
            `${EMOJIS.ROLE} **Rôle Prisonnier :** ${roleId ? (() => { const _jr = guild.roles.cache.get(roleId); return _jr ? `${_jr.name} (\`${roleId}\`)` : `~~${roleId}~~`; })() : `${EMOJIS.WARNING} Aucun (sera créé auto)`}`,
            `🔓 **Accès prison :** ${accessValue}`,
            `${EMOJIS.USER} **Membres en prison :** **${jailed}** membre(s)`,
            '',
            `${EMOJIS.RULES} **Usage :** \`+jail @user [durée] [raison]\`\n\`+unjail @user\`\nDurées : \`30m\` \`2h\` \`7d\``
        ].join('\n'))
    );
}

function buildConfigButtons() {
    return [
        new ActionRowBuilder().addComponents(
            new ButtonBuilder().setCustomId('jail_set_role').setLabel('Rôle Prisonnier').setEmoji('🎭').setStyle(ButtonStyle.Secondary),
            new ButtonBuilder().setCustomId('jail_create_role').setLabel('Créer rôle auto').setEmoji('✨').setStyle(ButtonStyle.Success),
            new ButtonBuilder().setCustomId('jail_list').setLabel('Prisonniers').setEmoji('📋').setStyle(ButtonStyle.Secondary),
        ),
        new ActionRowBuilder().addComponents(
            new ButtonBuilder().setCustomId('jail_set_chan').setLabel('Salon unique').setEmoji('📍').setStyle(ButtonStyle.Secondary),
            new ButtonBuilder().setCustomId('jail_set_cat').setLabel('Catégorie entière').setEmoji('📁').setStyle(ButtonStyle.Primary),
            new ButtonBuilder().setCustomId('jail_del_access').setLabel('Supprimer accès').setEmoji('🗑️').setStyle(ButtonStyle.Danger),
        ),
    ];
}

function buildBackRow() {
    return new ActionRowBuilder().addComponents(new ButtonBuilder().setCustomId('jail_back').setEmoji('↩️').setStyle(ButtonStyle.Secondary));
}

module.exports = {
    name: 'jail',
    aliases: ['prison', 'emprisonner'],
    description: 'Met un membre en prison (retire ses rôles, l\'isole)',
    usage: '@user [durée: 30m/2h/7d] [raison] | config',
    jailMember,
    unjailMember,

    run: async (client, message, args) => {
        let perm = false;
        message.member.roles.cache.forEach(r => { if (db.get(`ownerp_${message.guild.id}_${r.id}`)) perm = true; });
        const isStaff = client.config.superadmin.includes(message.author.id)
            || client.config.owners.includes(message.author.id)
            || db.get(`ownermd_${client.user.id}_${message.author.id}`)
            || perm
            || message.member.permissions.has(PermissionFlagsBits.ModerateMembers);

        if (!isStaff) return message.reply({ content: `${EMOJIS.DENIED} Permission refusée.`, allowedMentions: { repliedUser: false } });

        const guildId = message.guild.id;

        if (!args[0]) {
            return message.reply({
                content: `${EMOJIS.INFO} **Usage :** \`+jail @user [durée] [raison]\` — emprisonner un membre\n${EMOJIS.SETTINGS} \`+jail config\` — configurer le système`,
                allowedMentions: { repliedUser: false },
            });
        }

        if (args[0].toLowerCase() === 'config') {
            const msg = await message.reply({
                components: [buildConfigContainer(message.guild), ...buildConfigButtons()],
                flags: FLAGS,
                allowedMentions: { repliedUser: false },
            });

            async function refreshConfig() {
                await msg.edit({ components: [buildConfigContainer(message.guild), ...buildConfigButtons()], flags: FLAGS }).catch(() => {});
            }

            const col = msg.createMessageComponentCollector({ time: 180_000, filter: i => i.user.id === message.author.id });

            col.on('collect', async i => {
                const id = i.customId;

                if (id === 'jail_set_role') {
                    await i.deferUpdate();
                    await msg.edit({ components: [container(txt(`${EMOJIS.INFO} Quel rôle utiliser comme rôle Prisonnier ?`)), new ActionRowBuilder().addComponents(new RoleSelectMenuBuilder().setCustomId('jail_role_sel').setPlaceholder('Sélectionner un rôle')), buildBackRow()], flags: FLAGS }).catch(() => {});
                    return;
                }

                if (id === 'jail_create_role') {
                    await i.deferUpdate();
                    const status = await message.channel.send({ components: [container(txt(`${EMOJIS.LOADING} Création du rôle et application des permissions...`))], flags: FLAGS });
                    try {
                        const role = await ensureJailRole(message.guild);
                        const catId = db.get(DB_CATEGORY(guildId));
                        const chanId = db.get(DB_CHAN(guildId));
                        const dest = catId ? `catégorie **${message.guild.channels.cache.get(catId)?.name || catId}**` : chanId ? `<#${chanId}>` : 'aucune cible configurée';
                        await status.edit({ components: [container(txt(`${EMOJIS.SUCCESS} Rôle **${role.name}** (\`${role.id}\`) créé. Accès : ${dest}.`))], flags: FLAGS });
                    } catch (e) { await status.edit({ components: [container(txt(`${EMOJIS.ERROR} Erreur : ${e.message}`))], flags: FLAGS }); }
                    setTimeout(() => status.delete().catch(() => {}), 6_000);
                    await refreshConfig();
                    return;
                }

                if (id === 'jail_set_chan') {
                    await i.deferUpdate();
                    await msg.edit({ components: [container(txt(`${EMOJIS.INFO} Quel salon les prisonniers pourront-ils voir et utiliser ?`)), new ActionRowBuilder().addComponents(new ChannelSelectMenuBuilder().setCustomId('jail_chan_sel').setPlaceholder('Sélectionner un salon texte').setChannelTypes(ChannelType.GuildText, ChannelType.GuildAnnouncement)), buildBackRow()], flags: FLAGS }).catch(() => {});
                    return;
                }

                if (id === 'jail_set_cat') {
                    await i.deferUpdate();
                    await msg.edit({ components: [container(txt(`${EMOJIS.INFO} Quelle catégorie les prisonniers pourront-ils accéder ?`)), new ActionRowBuilder().addComponents(new ChannelSelectMenuBuilder().setCustomId('jail_cat_sel').setPlaceholder('Sélectionner une catégorie').setChannelTypes(ChannelType.GuildCategory)), buildBackRow()], flags: FLAGS }).catch(() => {});
                    return;
                }

                if (id === 'jail_del_access') { await i.deferUpdate(); db.delete(DB_CHAN(guildId)); db.delete(DB_CATEGORY(guildId)); await refreshConfig(); return; }
                if (id === 'jail_back') { await i.deferUpdate(); await refreshConfig(); return; }

                if (id === 'jail_role_sel') { await i.deferUpdate(); db.set(DB_ROLE(guildId), i.values[0]); await refreshConfig(); return; }
                if (id === 'jail_chan_sel') { await i.deferUpdate(); db.set(DB_CHAN(guildId), i.values[0]); await refreshConfig(); return; }

                if (id === 'jail_cat_sel') {
                    await i.deferUpdate();
                    const catId = i.values[0];
                    db.set(DB_CATEGORY(guildId), catId);
                    const roleId = db.get(DB_ROLE(guildId));
                    if (roleId) {
                        const role = message.guild.roles.cache.get(roleId);
                        if (role) {
                            const status = await message.channel.send({ components: [container(txt(`${EMOJIS.LOADING} Application des permissions sur la catégorie...`))], flags: FLAGS });
                            try {
                                await applyJailPermissions(message.guild, role);
                                const childCount = message.guild.channels.cache.filter(c => c.parentId === catId).size;
                                await status.edit({ components: [container(txt(`${EMOJIS.SUCCESS} Catégorie configurée — **${childCount}** salon(s) accessible(s).`))], flags: FLAGS });
                            } catch (e) { await status.edit({ components: [container(txt(`${EMOJIS.ERROR} Erreur : ${e.message}`))], flags: FLAGS }); }
                            setTimeout(() => status.delete().catch(() => {}), 5_000);
                        }
                    }
                    await refreshConfig();
                    return;
                }

                if (id === 'jail_list') {
                    await i.deferUpdate();
                    const jailed = db.all().filter(e => e.ID.startsWith(`jail_data_${guildId}_`));
                    if (!jailed.length) {
                        const m = await message.channel.send({ components: [container(txt(`${EMOJIS.INFO} Aucun membre en prison actuellement.`))], flags: FLAGS });
                        setTimeout(() => m.delete().catch(() => {}), 4_000);
                        return;
                    }
                    const lines = jailed.map(e => {
                        const uid = e.ID.replace(`jail_data_${guildId}_`, '');
                        const data = e.data;
                        const member = message.guild.members.cache.get(uid);
                        const name = member?.displayName || `<@${uid}>`;
                        const time = data.releasedAt ? `libéré <t:${Math.floor(data.releasedAt / 1000)}:R>` : 'durée indéfinie';
                        return `🔒 ${name} ${EMOJIS.ARROW} ${data.reason} (${time})`;
                    }).join('\n');
                    const m = await message.channel.send({
                        components: [container(txt(`## ${EMOJIS.STAFF} Membres en prison`), sep(), txt(lines.slice(0, 3800)))],
                        flags: FLAGS
                    });
                    setTimeout(() => m.delete().catch(() => {}), 15_000);
                    return;
                }
            });

            col.on('end', () => msg.edit({ components: [] }).catch(() => {}));
            return;
        }

        let target = message.mentions.members.first() || null;
        if (!target && args[0] && /^\d{17,20}$/.test(args[0])) target = await message.guild.members.fetch(args[0]).catch(() => null);

        if (!target) return message.reply({ content: `${EMOJIS.ERROR} Membre introuvable.\n${EMOJIS.INFO} \`+jail config\` pour configurer le système.`, allowedMentions: { repliedUser: false } });
        if (target.id === message.author.id) return message.reply({ content: `${EMOJIS.ERROR} Vous ne pouvez pas vous mettre en prison vous-même.`, allowedMentions: { repliedUser: false } });
        if (target.id === client.user.id) return message.reply({ content: `${EMOJIS.ERROR} Je ne peux pas me mettre en prison.`, allowedMentions: { repliedUser: false } });
        if (target.roles.highest.position >= message.member.roles.highest.position) return message.reply({ content: `${EMOJIS.ERROR} Hiérarchie insuffisante — ce membre a un rôle plus haut que le vôtre.`, allowedMentions: { repliedUser: false } });
        if (db.get(DB_DATA(guildId, target.id))) return message.reply({ content: `${EMOJIS.WARNING} Ce membre est déjà en prison. Utilisez \`+unjail @user\` pour le libérer.`, allowedMentions: { repliedUser: false } });

        let durationMs = null;
        let reasonStart = 1;
        if (args[1]) { durationMs = parseDuration(args[1]); if (durationMs !== null) reasonStart = 2; }
        const reason = args.slice(reasonStart).join(' ') || 'Aucune raison spécifiée';

        try {
            await jailMember(message.guild, target, message.author, reason, durationMs);

            const durationStr = durationMs ? ` (${humanDuration(durationMs)})` : '';
            await message.channel.send({
                components: [container(
                    txt('## 🔒 Membre Emprisonné'),
                    sep(),
                    txt([
                        `**Cible :** ${target.user.tag} (\`${target.id}\`)`,
                        `**Modérateur :** ${message.author.tag}`,
                        durationMs ? `**Durée :** ${humanDuration(durationMs)}` : null,
                        `**Raison :** ${reason}`
                    ].filter(Boolean).join('\n'))
                )],
                flags: FLAGS
            });

            const logChannelId = db.get(`logchannel_${guildId}`);
            if (logChannelId) {
                const logCh = message.guild.channels.cache.get(logChannelId);
                if (logCh) await logCh.send({
                    components: [container(
                        txt('## 🔒 Emprisonnement'),
                        sep(),
                        txt([
                            `**Cible :** ${target.user.tag} (\`${target.id}\`)`,
                            `**Modérateur :** ${message.author.tag}`,
                            durationMs ? `**Durée :** ${humanDuration(durationMs)}` : null,
                            `**Raison :** ${reason}`
                        ].filter(Boolean).join('\n'))
                    )],
                    flags: FLAGS
                }).catch(() => {});
            }
        } catch (e) {
            console.error('[jail]', e);
            message.reply({ content: `${EMOJIS.ERROR} Une erreur est survenue : ${e.message}`, allowedMentions: { repliedUser: false } });
        }
    },
};
