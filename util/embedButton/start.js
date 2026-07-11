const { ActionRowBuilder, ButtonBuilder } = require('../../utils/discord-buttons-compat');
const db = require("../../utils/simpledb");
const Discord = require('discord.js');

const buttonInteraction = async function (interaction, client) {
    
    if (interaction.customId == 'next-page' || interaction.customId == 'back-page') {
        const interactionData = client.interactions.get(interaction.message.id);
        if (!interactionData) return false;
        if (interaction.user.id !== interactionData.interactor.id) return true; // Handled (ignored)
        if (interaction.customId == 'next-page') {
            (interactionData.currentPage + 1 == interactionData.embeds.length ? interactionData.currentPage = 0 : interactionData.currentPage += 1);
            interaction.message.edit({ embeds: [interactionData.embeds[interactionData.currentPage]], components: [interactionData.components.build()] });
            interaction.deferUpdate();
        } else if (interaction.customId == 'back-page') {
            (interactionData.currentPage - 1 < 0 ? interactionData.currentPage = interactionData.embeds.length - 1 : interactionData.currentPage -= 1);
            interaction.message.edit({ embeds: [interactionData.embeds[interactionData.currentPage]], components: [interactionData.components.build()] });
            interaction.deferUpdate();
        }
        return true;
    }

    
    if (interaction.customId === 'create_ticket') {
        await handleCreateTicket(interaction);
        return true;
    } else if (interaction.customId === 'close_ticket') {
        await handleCloseTicket(interaction);
        return true;
    }

    
    if (interaction.customId === 'ticket_config_menu') {
        
        return true;
    }
    if (interaction.customId === 'remove_staff_menu') {
        
        return true;
    }

    // Si on arrive ici, l'interaction n'est pas gérée par ce fichier.
    return false;
}


const ButtonPages = async function (client, message, embeds, duration, buttonStyle, rightEmoji, leftEmoji) {
    console.log('ButtonPages called with', embeds.length, 'embeds');

    if (!client.interactions) client.interactions = new Map();

    if (!['red', 'green', 'blurple', "gray"].includes(buttonStyle)) throw new TypeError(`Button style incorect`);
    if (!rightEmoji) throw new TypeError(`Emoji pour le 1er boutous n'est pas fournis`);
    if (!leftEmoji) throw new TypeError(`Emoji pour le 2eme boutous n'est pas fournis`);

    if (!Array.isArray(embeds) || embeds.length === 0) {
        try { await message.reply({ content: '❌ Aucune page à afficher.' }); } catch (_) {}
        return;
    }

    const button1 = new ButtonBuilder()
        .setLabel(rightEmoji)
        .setStyle(buttonStyle)
        .setCustomId('next-page');

    const button2 = new ButtonBuilder()
        .setLabel(leftEmoji)
        .setStyle(buttonStyle)
        .setCustomId('back-page');

    const interactiveButtons = new ActionRowBuilder()
        .addComponents(button2, button1);

    await message.channel.send({ components: [interactiveButtons.build()], embeds: [embeds[0]] }).then((m) => {
        console.log('Embed sent successfully, message id:', m.id);
        const interactionData = {
            message: m,
            embeds: embeds,
            currentPage: 0,
            interactor: message.author,
            components: interactiveButtons
        };
        client.interactions.set(m.id, interactionData);
        setTimeout(() => {
            try {
                m.edit({ components: [], embeds: [interactionData.embeds[interactionData.currentPage]] });
            } catch (e) { console.error('ButtonPages timeout edit error:', e); }
            client.interactions.delete(m.id);
        }, 60000 * 5);

    }).catch(error => {
        console.error('Error sending embed in ButtonPages:', error);
    });


}




async function handleCreateTicket(interaction) {
    const config = db.get(`ticket_config_${interaction.guild.id}`) || {};

    if (!config.categoryId) {
        return interaction.reply({
            content: '❌ Le système de tickets n\'est pas configuré.',
            ephemeral: true
        });
    }

    const ticketNumber = Math.floor(Math.random() * 9000) + 1000;
    const category = interaction.guild.channels.cache.get(config.categoryId);

    try {
        const ticketChannel = await interaction.guild.channels.create({
            name: `ticket-${ticketNumber}`,
            type: Discord.ChannelType.GuildText,
            parent: category,
            permissionOverwrites: [
                {
                    id: interaction.guild.id,
                    deny: [Discord.PermissionsBitField.Flags.ViewChannel]
                },
                {
                    id: interaction.user.id,
                    allow: [
                        Discord.PermissionsBitField.Flags.ViewChannel,
                        Discord.PermissionsBitField.Flags.SendMessages,
                        Discord.PermissionsBitField.Flags.AttachFiles,
                        Discord.PermissionsBitField.Flags.ReadMessageHistory
                    ]
                }
            ]
        });

        
        if (config.staffRoles) {
            for (const roleId of config.staffRoles) {
                await ticketChannel.permissionOverwrites.edit(roleId, {
                    ViewChannel: true,
                    SendMessages: true,
                    AttachFiles: true,
                    ReadMessageHistory: true,
                    ManageMessages: true
                });
            }
        }

        const embed = new Discord.EmbedBuilder()
            .setColor('#00ff00')
            .setTitle(`🎫 Ticket #${ticketNumber}`)
            .setDescription(`Bonjour ${interaction.user}, le staff vous répondra bientôt.\nUtilisez \`+close\` pour fermer ce ticket.`)
            .addFields(
                { name: '👤 Créateur', value: interaction.user.tag, inline: true },
                { name: '📅 Date', value: `<t:${Math.floor(Date.now() / 1000)}:R>`, inline: true }
            );

        const closeButton = new Discord.ButtonBuilder()
            .setCustomId('close_ticket')
            .setLabel('Fermer')
            .setStyle(Discord.ButtonStyle.Danger)
            .setEmoji('🔒');

        const row = new Discord.ActionRowBuilder().addComponents(closeButton);

        await ticketChannel.send({
            content: `${interaction.user} ${config.staffRoles?.map(r => `<@&${r}>`).join(' ') || ''}`,
            embeds: [embed],
            components: [row]
        });

        await interaction.reply({
            content: `✅ Ticket créé: ${ticketChannel}`,
            ephemeral: true
        });

    } catch (error) {
        console.error(error);
        await interaction.reply({
            content: '❌ Erreur lors de la création du ticket.',
            ephemeral: true
        });
    }
}

async function handleCloseTicket(interaction) {
    const config = db.get(`ticket_config_${interaction.guild.id}`) || {};
    const hasPermission = await checkTicketPermission(interaction, config);

    if (!hasPermission) {
        return interaction.reply({
            content: '❌ Permission refusée.',
            ephemeral: true
        });
    }

    try {
        await interaction.channel.delete();
    } catch (error) {
        console.error(error);
        await interaction.reply({
            content: '❌ Erreur lors de la fermeture.',
            ephemeral: true
        });
    }
}

async function checkTicketPermission(interaction, config) {
    
    let isAdmin = false;
    interaction.member.roles.cache.forEach(role => {
        if (db.get(`admin_${interaction.guild.id}_${role.id}`)) isAdmin = true;
        if (db.get(`ownerp_${interaction.guild.id}_${role.id}`)) isAdmin = true;
    });

    if (isAdmin || interaction.client.config.owner.includes(interaction.user.id) || db.get(`ownermd_${interaction.client.user.id}_${interaction.user.id}`)) {
        return true;
    }

    
    if (config.staffRoles && interaction.member.roles.cache.some(r => config.staffRoles.includes(r.id))) {
        return true;
    }

    return false;
}

module.exports = {
    ButtonPages,
    buttonInteraction
}
