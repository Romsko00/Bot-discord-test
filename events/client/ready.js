const Discord = require("discord.js");
const db = require("../../utils/simpledb");
const logger = require('../../utils/logger');

module.exports = async (client) => {
  try {
    logger.info(`<a:_:1483497369315315786> Connecté en tant que ${client.user.tag} (${client.user.id})`);
    logger.info(`📊 Je suis présent sur ${client.guilds.cache.size} serveurs`);


    client.user.setPresence({
      activities: [{
        name: `${client.guilds.cache.size} serveurs | +help`,
        type: Discord.ActivityType.Watching
      }],
      status: 'online'
    });


    logger.info('<:_:1483497480556642546> Récupération des membres des serveurs...');
    const promises = [];

    client.guilds.cache.forEach((guild) => {
      const promise = guild.members.fetch().
        then(() => {
          logger.debug(`<a:_:1483497369315315786> Membres récupérés pour ${guild.name} (${guild.id})`);
        }).
        catch((error) => {
          logger.error(`<a:_:1483497365863399536> Erreur lors de la récupération des membres pour ${guild.name} (${guild.id}):`, error);
        });
      promises.push(promise);
    });

    await Promise.allSettled(promises);
    logger.info('<a:_:1483497369315315786> Tous les membres ont été récupérés avec succès');

    // Charger les boutons VN1 persistés depuis la DB afin qu'ils fonctionnent après redémarrage
    try {
      if (!client.vn1Buttons) client.vn1Buttons = new Map();
      const all = db.all();
      const vnKeys = all.filter(k => k.ID.startsWith('vn1_buttons_'));
      for (const entry of vnKeys) {
        try {
          const payload = entry.data;
          if (!payload || !payload.messageId || !Array.isArray(payload.buttons)) continue;
          for (const b of payload.buttons) {
            if (b.customid) {
              const cfg = Object.assign({}, b, { messageId: payload.messageId, guildId: payload.guildId || payload.channelId && payload.channelId.split && payload.channelId.split(':')[0] });
              client.vn1Buttons.set(b.customid, cfg);
            }
          }
        } catch (e) { logger.error('Erreur lors du chargement VN1:', e); }
      }
      logger.info(`<a:_:1483497369315315786> VN1 buttons chargés: ${client.vn1Buttons.size}`);
    } catch (e) { logger.error('Erreur lors du chargement des VN1 persistés:', e); }

  } catch (error) {
    logger.error('<a:_:1483497365863399536> Erreur dans l\'événement ready:', error);
  }
};
