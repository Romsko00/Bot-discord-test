const { EmbedBuilder } = require('discord.js');
const db = require('../../utils/simpledb');
const vpnDetector = require('../../utils/vpnDetector');

const KEY_LIST  = (guildId) => `banip_list_${guildId}`;
const KEY_ENTRY = (guildId, ip) => `banip_${guildId}_${ip.replace(/\./g, '_').replace(/:/g, '_')}`;

/**
 * Récupère l'IP stockée d'un membre si elle a été enregistrée précédemment.
 * Discord ne fournit pas l'IP via son API — ce champ est renseigné uniquement
 * si un système externe (reverse proxy, portail de vérification, etc.) l'a
 * enregistrée via db.set(`userip_<guildId>_<userId>`, ip).
 */
function getStoredIP(guildId, userId) {
    return db.get(`userip_${guildId}_${userId}`) || null;
}

module.exports = async (client, member) => {
    const guildId = member.guild.id;

    // Récupérer l'IP stockée pour ce membre
    const userIP = getStoredIP(guildId, member.user.id);
    if (!userIP) return; // Pas d'IP connue — impossible de vérifier

    try {
        // ── 1. Vérification liste noire IP ─────────────────────────────────────
        const bannedEntry = db.get(KEY_ENTRY(guildId, userIP));

        if (bannedEntry) {
            await member.ban({
                reason: `[BAN IP AUTOMATIQUE] ${bannedEntry.reason} (IP : ${userIP})`
            }).catch(() => {});

            // Log
            const logSystem = new (require('../../utils/logSystem'))(client);
            await logSystem.logModeration(
                member.guild,
                'Ban IP Automatique',
                { id: client.user.id, tag: client.user.tag }, // auteur = bot
                member.user,
                `IP bannie détectée à la connexion (${userIP})`,
                {
                    caseId: Date.now().toString(),
                    extraFields: [
                        { name: 'IP',             value: `\`${userIP}\``,                                  inline: true },
                        { name: 'Raison origine', value: bannedEntry.reason,                               inline: true },
                        { name: 'Ban initial',    value: `<t:${Math.floor(bannedEntry.date / 1000)}:F>`,   inline: true }
                    ]
                }
            ).catch(() => {});
            return;
        }

        // ── 2. Vérification VPN ────────────────────────────────────────────────
        const vpnCheck = await vpnDetector.checkVPN(userIP);

        // Seuil : score > 85 pour éviter les faux positifs
        if (vpnCheck.isVPN && vpnCheck.score > 85) {
            await member.ban({
                reason: `[VPN DÉTECTÉ] Score ${vpnCheck.score}/100 — ISP : ${vpnCheck.isp}`
            }).catch(() => {});

            const logSystem = new (require('../../utils/logSystem'))(client);
            await logSystem.logModeration(
                member.guild,
                'Ban VPN Automatique',
                { id: client.user.id, tag: client.user.tag },
                member.user,
                `VPN détecté à la connexion (score : ${vpnCheck.score}/100)`,
                {
                    caseId: Date.now().toString(),
                    extraFields: [
                        { name: 'IP',    value: `\`${userIP}\``,         inline: true },
                        { name: 'Score', value: `${vpnCheck.score}/100`, inline: true },
                        { name: 'ISP',   value: vpnCheck.isp,            inline: true }
                    ]
                }
            ).catch(() => {});
        }

    } catch (error) {
        console.error('[banip] Erreur vérification IP à l\'arrivée:', error);
    }
};
