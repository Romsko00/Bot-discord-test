const Discord = require('discord.js');
const db = require('../../utils/simpledb');
const { checkOsintPermission } = require('../../utils/osintHelpers');
const EMOJIS = require('../../utils/emojis');
const { EMOJIS: EMB } = require('../../utils/embedBuilder');
const { container, txt, sep, FLAGS } = require('../../utils/v2');

const RESOURCE_CATEGORIES = {
  search_engines: {
    name: 'Moteurs & Dorking',
    emoji: EMOJIS.BUG,
    items: [
      { name: 'Google', url: 'https://www.google.com', desc: 'Recherche + opérateurs (site:, filetype:, inurl:, intitle:)', dork: true },
      { name: 'DuckDuckGo', url: 'https://duckduckgo.com', desc: 'Alternative, moins de blocage', dork: true },
      { name: 'Bing', url: 'https://www.bing.com', desc: 'Parfois des résultats différents', dork: true },
      { name: 'Shodan', url: 'https://www.shodan.io', desc: 'Moteur pour appareils connectés, IP, ports' },
      { name: 'Censys', url: 'https://search.censys.io', desc: 'Certificats, hosts, surfaces d\'attaque' },
      { name: 'ZoomEye', url: 'https://www.zoomeye.org', desc: 'Recherche d\'actifs (type Shodan)' },
      { name: 'Onyphe', url: 'https://www.onyphe.io', desc: 'Données d\'exposition (FR)' }
    ]
  },
  breach_leaks: {
    name: 'Fuites & Breaches',
    emoji: EMB.alerte,
    items: [
      { name: 'Have I Been Pwned', url: 'https://haveibeenpwned.com', desc: 'Email / domaine compromis' },
      { name: 'LeakCheck', url: 'https://leakcheck.io', desc: 'Recherche dans fuites (API dispo)' },
      { name: 'DeHashed', url: 'https://dehashed.com', desc: 'Payant — fuites massives' },
      { name: 'Snusbase', url: 'https://snusbase.com', desc: 'DB fuites (intégrable au bot)' },
      { name: 'IntelX', url: 'https://intelx.io', desc: 'Index de fuites / pastes (API)' },
      { name: 'Pastebin search', url: 'https://psbdmp.ws', desc: 'Recherche dans pastes' }
    ]
  },
  domain_ip: {
    name: 'Domaine & IP',
    emoji: EMOJIS.WIFI,
    items: [
      { name: 'WHOIS', url: 'https://whois.domaintools.com', desc: 'WHOIS détaillé' },
      { name: 'SecurityTrails', url: 'https://securitytrails.com', desc: 'DNS, sous-domaines, historique' },
      { name: 'ViewDNS', url: 'https://viewdns.info', desc: 'Reverse IP, DNS, whois' },
      { name: 'Robtex', url: 'https://www.robtex.com', desc: 'IP ↔ domaine, DNS' },
      { name: 'crt.sh', url: 'https://crt.sh', desc: 'Certificats = sous-domaines' },
      { name: 'urlscan.io', url: 'https://urlscan.io', desc: 'Scans d\'URL, screenshots' },
      { name: 'VirusTotal', url: 'https://www.virustotal.com', desc: 'URL / IP / hash / domaine' }
    ]
  },
  social_people: {
    name: 'Réseaux & Personnes',
    emoji: EMOJIS.USER,
    items: [
      { name: 'Namechk', url: 'https://namechk.com', desc: 'Dispo username sur plateformes' },
      { name: 'KnowEm', url: 'https://knowem.com', desc: 'Vérif pseudo sur 500+ sites' },
      { name: 'Sherlock (GitHub)', url: 'https://github.com/sherlock-project/sherlock', desc: 'CLI username search' },
      { name: 'WhatsMyName', url: 'https://whatsmyname.app', desc: 'Usernames sur sites' },
      { name: 'Pipl', url: 'https://pipl.com', desc: 'Recherche de personnes' }
    ]
  },
  docs_files: {
    name: 'Documents & Fichiers',
    emoji: EMB.fichier,
    items: [
      { name: 'Google (filetype:)', url: 'https://www.google.com', desc: 'filetype:pdf, doc, xls, etc.' },
      { name: 'FOCA', url: 'https://github.com/ElevenPaths/FOCA', desc: 'Métadonnées documents' },
      { name: 'Archive.org', url: 'https://archive.org', desc: 'Wayback Machine, fichiers archivés' },
      { name: 'Google Drive search', desc: 'site:drive.google.com filetype:pdf' }
    ]
  },
  dork_presets: {
    name: 'Dorks utiles (à copier)',
    emoji: EMOJIS.FOLDER,
    items: [
      { name: 'Fichiers sensibles', desc: 'filetype:pdf | filetype:xls | filetype:sql | filetype:log' },
      { name: 'Configs', desc: 'inurl:config | inurl:.env | intitle:"index of" .git' },
      { name: 'Logs', desc: 'filetype:log | inurl:error.log | intext:"stack trace"' },
      { name: 'Emails', desc: 'filetype:csv email | filetype:xlsx "password"' },
      { name: 'Admin', desc: 'intitle:"admin login" | inurl:wp-admin | inurl:administrator' }
    ]
  }
};

module.exports = {
  name: 'osint_resources',
  aliases: ['ressources', 'osint_ressources', 'osintlinks', 'osint_links'],
  description: 'Liste de ressources OSINT (outils, liens, dorks) par catégorie',
  category: 'osint',
  run: async (client, message, args, prefix, color) => {
    if (!checkOsintPermission(client, message)) return;

    const categoryKey = (args[0] || '').toLowerCase().trim();
    const categories = Object.entries(RESOURCE_CATEGORIES);

    if (!categoryKey) {
      const list = categories.map(([key, cat]) => `${cat.emoji} **${key}** — ${cat.name}`).join('\n');
      return message.channel.send({
        components: [container(
          txt(`## ${EMB.fichier} Ressources OSINT`),
          sep(),
          txt([
            'Choisissez une catégorie pour afficher les liens et outils :',
            '',
            list,
            '',
            `**Usage :** \`${prefix}osint_resources <catégorie>\``,
            'Ex: `+ressources breach_leaks` | `+ressources domain_ip`',
            '',
            '*Ressources à usage légal et éthique uniquement*'
          ].join('\n'))
        )],
        flags: FLAGS
      }).catch(() => {});
    }

    const [key, cat] = categories.find(([k]) => k === categoryKey) || [];
    if (!cat) {
      return message.reply(`Catégorie inconnue. Utilisez \`${prefix}osint_resources\` sans argument pour la liste.`);
    }

    const lines = cat.items.map((item) => {
      const urlPart = item.url ? ` — [Lien](${item.url})` : '';
      return `• **${item.name}**${urlPart}\n  ${item.desc || ''}`;
    });

    await message.channel.send({
      components: [container(
        txt(`## ${cat.emoji} ${cat.name}`),
        sep(),
        txt(lines.join('\n\n').slice(0, 3900))
      )],
      flags: FLAGS
    }).catch(() => {});
  }
};
