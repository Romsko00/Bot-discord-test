/**
 * Définitions des commandes slash OSINT pour Discord.
 * Enregistrées au démarrage et gérées dans interactionCreate.
 */

const { SlashCommandBuilder } = require('discord.js');

const OSINT_SLASH_DEFINITIONS = [
  {
    name: 'abonnement',
    description: 'Ajoute un utilisateur aux abonnés OSINT avec des crédits (superadmin only)',
    options: [
      { name: 'user', type: 6, description: 'Utilisateur à abonner', required: true },
      { name: 'credit', type: 4, description: 'Nombre de crédits à attribuer', required: true }
    ]
  },
  {
    name: 'breach',
    description: 'Recherche de fuites de données (email ou username)',
    options: [{ name: 'query', type: 3, description: 'Email ou nom d\'utilisateur', required: true }]
  },
  {
    name: 'geoip',
    description: 'Analyse et géolocalisation d\'une adresse IP',
    options: [{ name: 'ip', type: 3, description: 'Adresse IP à analyser', required: true }]
  },
  {
    name: 'intel',
    description: 'Recherche Intel-X (email, domaine, username, hash ou ID)',
    options: [{ name: 'terme', type: 3, description: 'Terme de recherche', required: true }]
  },
  {
    name: 'pastebin',
    description: 'Recherche sur Pastebin, Ghostbin, Dumpz',
    options: [{ name: 'recherche', type: 3, description: 'Email, username ou mot-clé', required: true }]
  },
  {
    name: 'phoneinfo',
    description: 'Analyse d\'un numéro de téléphone',
    options: [{ name: 'numero', type: 3, description: 'Numéro de téléphone', required: true }]
  },
  {
    name: 'snusbase',
    description: 'Recherche Snusbase (email, username, IP, hash, domaine)',
    options: [{ name: 'query', type: 3, description: 'Terme de recherche', required: true }]
  },
  {
    name: 'vpncheck',
    description: 'Vérifie si une IP est VPN/Proxy',
    options: [{ name: 'ip', type: 3, description: 'Adresse IP', required: true }]
  },
  {
    name: 'whoisdomain',
    description: 'Informations WHOIS et DNS d\'un domaine',
    options: [{ name: 'domaine', type: 3, description: 'Nom de domaine', required: true }]
  },
  {
    name: 'lookup',
    description: 'Recherche OSINT universelle (email, IP, domaine, numéro, username) — résultat paginé',
    options: [{ name: 'query', type: 3, description: 'Email, IP, domaine, numéro ou username', required: true }]
  },
  {
    name: 'msgsearch',
    description: 'Recherche des messages dans ce salon par auteur ou mot-clé (scraper)',
    options: [
      { name: 'query', type: 3, description: 'Utilisateur (@mention ou ID) ou mot-clé à rechercher', required: true },
      { name: 'limit', type: 4, description: 'Nombre de messages à analyser (10-200, défaut 100)', required: false }
    ]
  },
  {
    name: 'hashlookup',
    description: 'Identifie et recherche un hash (MD5, SHA1, SHA256) dans des bases de fuites',
    options: [{ name: 'hash', type: 3, description: 'Hash à rechercher (MD5, SHA1 ou SHA256)', required: true }]
  },
  {
    name: 'username',
    description: 'Recherche un username sur plusieurs sources (fuites, pastes, réseaux)',
    options: [{ name: 'pseudo', type: 3, description: 'Nom d\'utilisateur à rechercher', required: true }]
  },
  {
    name: 'emailinfo',
    description: 'Informations complètes sur un email (fuites, validation, réputation)',
    options: [{ name: 'email', type: 3, description: 'Adresse email à analyser', required: true }]
  },
  {
    name: 'socialsearch',
    description: 'Vérifie la disponibilité d\'un username sur plusieurs réseaux (liens directs)',
    options: [{ name: 'pseudo', type: 3, description: 'Nom d\'utilisateur à vérifier', required: true }]
  },
  {
    name: 'urlinfo',
    description: 'Analyse une URL (domaine, redirections, sécurité, historique)',
    options: [{ name: 'url', type: 3, description: 'URL à analyser', required: true }]
  },
  {
    name: 'dork',
    description: 'Génère des requêtes dork (Google/DuckDuckGo) avec filtres et préréglages',
    options: [
      { name: 'query', type: 3, description: 'Préset + terme (ex: files password) ou requête | filetype:pdf', required: true }
    ]
  },
  {
    name: 'osint_resources',
    description: 'Liste de ressources OSINT (outils, liens, dorks) par catégorie',
    options: [
      { name: 'categorie', type: 3, description: 'search_engines | breach_leaks | domain_ip | social_people | docs_files | dork_presets', required: false }
    ]
  }
];

/** Noms des commandes slash OSINT (pour le routage dans interactionCreate). */
const OSINT_SLASH_NAMES = OSINT_SLASH_DEFINITIONS.map((c) => c.name);

/**
 * Retourne le tableau de commandes au format API Discord (pour REST.put).
 * type 3 = STRING
 */
function getOsintSlashCommandsJson() {
  return OSINT_SLASH_DEFINITIONS.map((def) => ({
    name: def.name,
    description: def.description,
    options: (def.options || []).map((opt) => ({
      name: opt.name,
      type: opt.type,
      description: opt.description,
      required: opt.required !== false
    }))
  }));
}

/**
 * Construit les args pour command.run() à partir des options de l'interaction.
 */
function getArgsFromInteraction(interaction) {
  const name = interaction.commandName;
  const options = interaction.options;
  const str = (opt) => (options.getString(opt) ?? '').trim();

  switch (name) {
    case 'abonnement': return [options.getUser('user')?.id || '', options.getInteger('credit') ?? 0];
    case 'breach': return [str('query')];
    case 'geoip': return [str('ip')];
    case 'intel': return [str('terme')];
    case 'pastebin': return [str('recherche')];
    case 'phoneinfo': return [str('numero')];
    case 'snusbase': return [str('query')];
    case 'vpncheck': return [str('ip')];
    case 'whoisdomain': return [str('domaine')];
    case 'lookup': return [str('query')];
    case 'msgsearch': {
      const query = str('query');
      const limit = options.getInteger('limit');
      return limit ? [query, limit] : [query];
    }
    case 'hashlookup': return [str('hash')];
    case 'username': return [str('pseudo')];
    case 'emailinfo': return [str('email')];
    case 'socialsearch': return [str('pseudo')];
    case 'urlinfo': return [str('url')];
    case 'dork': return str('query') ? str('query').split(/\s+/) : [];
    case 'osint_resources': return [str('categorie')];
    default: return [];
  }
}

module.exports = {
  OSINT_SLASH_DEFINITIONS,
  OSINT_SLASH_NAMES,
  getOsintSlashCommandsJson,
  getArgsFromInteraction
};
