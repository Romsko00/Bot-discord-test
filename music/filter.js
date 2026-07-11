const { ActionRowBuilder, StringSelectMenuBuilder } = require('discord.js');
const { getQueue, setFilter } = require('../../utils/musicQueue');
const filters = require('../../utils/audioFilters');
const { container, txt, sep, FLAGS } = require('../../utils/v2');

module.exports = {
    name: 'filter',
    aliases: ['filters', 'f', 'effect', 'effects'],
    description: 'Applique un filtre audio à la musique',
    usage: '+filter <nom|off|list>',
    category: 'music',
    run: async (client, message, args) => {
        try {
            const voiceChannel = message.member?.voice?.channel;
            if (!voiceChannel) {
                return message.reply({ content: '<a:_:1483497365863399536> Vous devez être dans un salon vocal.', allowedMentions: { repliedUser: false } });
            }

            const queue = getQueue(message.guild.id);
            if (!queue.songs.length) {
                return message.reply({ content: '<a:_:1483497365863399536> Aucune musique en cours.', allowedMentions: { repliedUser: false } });
            }

            const filterName = (args[0] || '').toLowerCase();

            if (!filterName || filterName === 'list') {
                const options = Object.keys(filters).slice(0, 24).map(f => ({
                    label: f.charAt(0).toUpperCase() + f.slice(1),
                    value: f,
                    description: `Appliquer le filtre ${f}`,
                    emoji: '🎚️'
                }));
                options.unshift({ label: 'Désactiver (Off)', value: 'off', description: 'Retirer tous les filtres', emoji: '❌' });

                const currentFilter = queue.filters && queue.filters.length > 0 ? queue.filters[0] : 'Aucun';

                const selectMenu = new StringSelectMenuBuilder()
                    .setCustomId('filter_select')
                    .setPlaceholder('Sélectionnez un filtre')
                    .addOptions(options);

                const row = new ActionRowBuilder().addComponents(selectMenu);

                const buildC = (current) => container(
                    txt('## 🎚️ Filtres Audio'),
                    sep(),
                    txt(`**Filtre actuel :** ${current}\n*L'application d'un filtre redémarre la musique en cours.*`)
                );

                const msg = await message.channel.send({ components: [buildC(currentFilter), row], flags: FLAGS });

                const collector = msg.createMessageComponentCollector({ time: 60000 });
                collector.on('collect', async (interaction) => {
                    if (interaction.user.id !== message.author.id) {
                        return interaction.reply({ content: '<:_:1483497503713394719> Cette interface est réservée au créateur.', ephemeral: true }).catch(() => {});
                    }
                    const selected = interaction.values[0];
                    if (selected === 'off') {
                        setFilter(queue, []);
                    } else {
                        setFilter(queue, [selected]);
                    }
                    const newLabel = selected === 'off' ? 'Aucun' : selected;
                    await interaction.update({ components: [buildC(newLabel), row], flags: FLAGS });
                });
                collector.on('end', () => msg.edit({ components: [buildC(queue.filters?.[0] || 'Aucun')], flags: FLAGS }).catch(() => {}));
                return;
            }

            if (filterName === 'off' || filterName === 'disable' || filterName === 'none') {
                setFilter(queue, []);
                return message.channel.send({
                    components: [container(txt('## 🎚️ Filtres'), sep(), txt('Tous les filtres ont été désactivés.'))],
                    flags: FLAGS
                });
            }

            if (filters[filterName]) {
                setFilter(queue, [filterName]);
                return message.channel.send({
                    components: [container(txt('## 🎚️ Filtre Appliqué'), sep(), txt(`Filtre **${filterName}** appliqué. La musique va redémarrer...`))],
                    flags: FLAGS
                });
            } else {
                return message.reply({ content: '<a:_:1483497365863399536> Filtre inconnu. Utilisez `+filter list` pour voir les options.', allowedMentions: { repliedUser: false } });
            }

        } catch (error) {
            console.error('[FILTER] Erreur:', error);
            return message.reply({ content: '<a:_:1483497365863399536> Une erreur est survenue.', allowedMentions: { repliedUser: false } });
        }
    }
};
