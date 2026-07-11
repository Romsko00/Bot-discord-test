const whois = require('whois-json');
const dns = require('dns').promises;
const db = require('../../utils/simpledb');
const { checkOsintPermission } = require('../../utils/osintHelpers');
const EMOJIS = require('../../utils/emojis');
const { container, txt, sep, FLAGS } = require('../../utils/v2');

module.exports = {
    name: 'whoisdomain',
    aliases: ['domain', 'dns', 'whois'],
    description: 'Récupère les informations WHOIS et DNS d\'un domaine',
    run: async (client, message, args) => {
        if (!checkOsintPermission(client, message)) return;

        const cost = 5;
        const level = db.get(`guild_${message.guild.id}_level_${message.author.id}`) || 1;
        const totalCredits = (db.get(`user_credits_${message.author.id}`) || 0) + (db.get(`daily_credits_${message.author.id}`) || 0) + level * 2;

        const domain = args[0];
        if (!domain) return message.reply({ content: '<a:_:1483497365863399536> Veuillez spécifier un domaine.', allowedMentions: { repliedUser: false } });

        if (totalCredits < cost) {
            return message.channel.send({
                components: [container(txt('## ❌ Crédits insuffisants'), sep(), txt(`**Coût :** ${cost} crédits\n**Vos crédits :** ${totalCredits} crédits`))],
                flags: FLAGS
            });
        }
        db.subtract(`user_credits_${message.author.id}`, cost);

        const loadingMsg = await message.channel.send({
            components: [container(txt('## 🔍 Recherche WHOIS...'), sep(), txt(`Scan enrichi WHOIS, DNS, réputation pour **${domain}**...`))],
            flags: FLAGS
        });

        try {
            const whoisData = await whois(domain);
            let dnsRecords = {};
            try {
                dnsRecords.A = await dns.resolve4(domain).catch(() => []);
                dnsRecords.AAAA = await dns.resolve6(domain).catch(() => []);
                dnsRecords.MX = await dns.resolveMx(domain).catch(() => []);
                dnsRecords.TXT = await dns.resolveTxt(domain).catch(() => []);
                dnsRecords.NS = await dns.resolveNs(domain).catch(() => []);
            } catch {}

            let reputation = 'N/A', blacklist = 'N/A', technologies = [], registrant = 'N/A', status = 'N/A', dnssec = 'N/A', history = 'N/A';
            const errorDetails = [];

            try {
                const viewdns = await require('axios').get(`https://api.viewdns.info/reputation/?domain=${domain}&apikey=${process.env.VIEWDNS_API_KEY || ''}&output=json`, { timeout: 10000 });
                reputation = viewdns.data.response.reputation_score || 'N/A';
                blacklist = viewdns.data.response.blacklist_status || 'N/A';
            } catch (e) { errorDetails.push('ViewDNS: ' + (e.response?.data?.message || e.message)); }

            try {
                const secTrails = await require('axios').get(`https://api.securitytrails.com/v1/domain/${domain}`, { headers: { 'APIKEY': process.env.SECURITYTRAILS_API_KEY || '' }, timeout: 10000 });
                technologies = secTrails.data?.technology || [];
                history = secTrails.data?.whois?.history || 'N/A';
                dnssec = secTrails.data?.dnssec || 'N/A';
            } catch (e) { errorDetails.push('SecurityTrails: ' + (e.response?.data?.message || e.message)); }

            try {
                const whoisxml = await require('axios').get(`https://www.whoisxmlapi.com/whoisserver/WhoisService?apiKey=${process.env.WHOISXML_API_KEY || ''}&domainName=${domain}&outputFormat=JSON`, { timeout: 10000 });
                registrant = whoisxml.data.WhoisRecord?.registrant?.name || 'N/A';
                status = whoisxml.data.WhoisRecord?.status || 'N/A';
            } catch (e) { errorDetails.push('WhoisXML: ' + (e.response?.data?.message || e.message)); }

            const lines = [
                `**Domaine :** ${whoisData.domainName || domain}`,
                `**Registrar :** ${whoisData.registrar || 'N/A'}`,
                `**Création :** ${whoisData.creationDate ? new Date(whoisData.creationDate).toLocaleDateString('fr-FR') : 'N/A'}`,
                `**Expiration :** ${whoisData.expirationDate ? new Date(whoisData.expirationDate).toLocaleDateString('fr-FR') : 'N/A'}`,
                `**Pays :** ${whoisData.country || 'N/A'}`,
                `**Registrant :** ${registrant}`,
                `**Statut :** ${status}`,
                `**DNSSEC :** ${dnssec}`,
                `**Réputation :** ${reputation} | **Blacklist :** ${blacklist}`,
                ''
            ];

            if (dnsRecords.A?.length) lines.push(`**IP (A) :** ${dnsRecords.A.slice(0, 5).join(', ')}`);
            if (dnsRecords.MX?.length) lines.push(`**MX :** ${dnsRecords.MX.slice(0, 3).map(mx => `${mx.exchange} (prio ${mx.priority})`).join(', ')}`);
            if (whoisData.nameServers) {
                const ns = Array.isArray(whoisData.nameServers) ? whoisData.nameServers : [whoisData.nameServers];
                lines.push(`**NS :** ${ns.slice(0, 3).join(', ')}`);
            }
            if (technologies.length) lines.push(`**Technologies :** ${technologies.slice(0, 5).join(', ')}`);
            if (errorDetails.length) lines.push(`\n*Erreurs API : ${errorDetails.join(', ')}*`);

            const fileManager = require('../../utils/fileManager');
            await fileManager.sendResultsToUser(message.author, message.channel,
                lines.join('\n'), domain, 'whoisdomain').catch(() => {});

            await loadingMsg.edit({
                components: [container(
                    txt(`## 🌐 WHOIS — ${domain}`),
                    sep(),
                    txt(lines.join('\n').slice(0, 3800))
                )],
                flags: FLAGS
            });
        } catch (error) {
            console.error('WHOIS Error:', error);
            await loadingMsg.edit({
                components: [container(txt('## ❌ Erreur WHOIS'), sep(), txt('Domaine invalide ou non enregistré.'))],
                flags: FLAGS
            }).catch(() => {});
        }
    }
};
