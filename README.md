# 🎰 Zoom BOT - Bot Discord Complet avec Casino

## 🌟 Fonctionnalités

### 🔧 Systèmes de Gestion
- ✅ **Bienvenue** - Messages personnalisables, rôles auto, MP
- ✅ **Tickets** - Système de support avec catégories
- ✅ **Soutien** - Détection automatique de statuts Discord
- ✅ **Modération** - Commandes admin complètes
- ✅ **Logs** - Tracking de toutes les actions

### 🎰 Casino (Système Avancé)
- ✅ **15+ Jeux** - Slots, Blackjack, Roulette, Poker, et plus
- ✅ **Économie** - Système de crédits (JTN)
- ✅ **Niveaux & XP** - Progression des joueurs
- ✅ **Achievements** - Succès débloquables
- ✅ **Boutique** - Items et bonus
- ✅ **Métiers** - Système de jobs avec compétences
- ✅ **Teams** - Guildes de joueurs
- ✅ **Leaderboards** - Classements multiples
- ✅ **Logs Avancés** - Tracking détaillé de toute l'activité

### 📊 Statistiques & Tracking
- ✅ **Logs Catégorisés** - 9 catégories (jeux, transactions, admin, etc.)
- ✅ **Rotation Automatique** - Archivage des logs
- ✅ **Stats Détaillées** - Utilisateur, serveur, global
- ✅ **Dashboard** - Vue d'ensemble de l'économie

### 🎮 Autres Systèmes
- ✅ **Niveaux** - Système XP avec récompenses
- ✅ **Économie** - Crédits avec commandes dédiées
- ✅ **Musique** - Lecteur audio (en développement)
- ✅ **OSINT** - Outils de recherche
- ✅ **Fun** - Commandes amusantes

---

## 🚀 Installation

### Prérequis
- Node.js 16+ 
- npm ou yarn
- Discord Bot Token

### Étapes

1. **Cloner le repo**
```bash
git clone <votre-repo>
cd ZoomBOT
```

2. **Installer les dépendances**
```bash
npm install
```

3. **Configurer**
```bash
# Copier le fichier de configuration
cp config.example.json config.json

# Éditer avec votre token et settings
nano config.json
```

4. **Démarrer le bot**
```bash
# Mode développement
npm start

# Avec PM2 (production)
pm2 start ecosystem.config.js
```

---

## ⚙️ Configuration

### config.json
```json
{
  "DISCORD": {
    "TOKEN": ["votre-token-ici"],
    "PREFIX": "+"
  },
  "CASINO": {
    "DAILY_AMOUNT": 500,
    "VIP_ROLE": "VIP"
  },
  "LEVELS": {
    "XP_PER_MESSAGE": { "MIN": 5, "MAX": 10 },
    "XP_REQUIRED_PER_LEVEL": 500
  }
}
```

### Permissions Discord Requises
- Gérer les messages
- Gérer les rôles
- Gérer les salons
- Voir les salons
- Envoyer des messages
- Intégrer des liens
- Ajouter des réactions

### Intents Discord Requis
- ✅ MESSAGE CONTENT INTENT
- ✅ GUILD MESSAGES
- ✅ GUILD MEMBERS
- ✅ GUILD PRESENCES

---

## 📚 Documentation

### Guides Essentiels
| Document | Description |
|----------|-------------|
| [START_HERE.md](START_HERE.md) | 🌟 Point de départ |
| [GUIDE_TEST_COMPLET.md](GUIDE_TEST_COMPLET.md) | Tests systèmes de base |
| [GUIDE_CASINO_RAPIDE.md](GUIDE_CASINO_RAPIDE.md) | Tests casino |
| [RECAP_COMPLET.md](RECAP_COMPLET.md) | Récapitulatif complet |

### Documentation Technique
- [AMELIORATIONS_CASINO.md](AMELIORATIONS_CASINO.md) - Détails casino
- [RESUME_FINAL_CORRECTIONS.md](RESUME_FINAL_CORRECTIONS.md) - Corrections appliquées

### Scripts Utiles
- `verify-all.js` - Vérification automatique
- `check-bot.js` - Vérification basique

---

## 🎯 Commandes Principales

### Casino
```
+casino help          # Aide complète du casino
+cstats              # Vos statistiques
+cstats global       # Stats du serveur
+cclaim              # Claim quotidien (500 JTN + bonus)
+ctop                # Leaderboard (6 types)
+cbalance            # Votre solde
+cslots <mise>       # Machine à sous
+cblackjack <mise>   # Blackjack
+croulette <mise>    # Roulette
```

### Gestion
```
+welcome             # Configurer le système de bienvenue
+ticket config       # Configurer les tickets
+soutien             # Configurer la détection de soutien
```

### Utilitaires
```
+help                # Aide générale
+serverinfo          # Infos du serveur
+userinfo [@user]    # Infos d'un utilisateur
+ping                # Latence du bot
```

---

## 🎨 Système de Logs Casino

### Catégories
- `game` - Toutes les parties jouées
- `transaction` - Crédits ajoutés/retirés
- `admin` - Actions des administrateurs
- `team` - Activités des teams
- `shop` - Achats dans la boutique
- `job` - Métiers et compétences
- `achievement` - Succès débloqués
- `security` - Alertes de sécurité
- `error` - Erreurs système

### Stockage
```
logs/
├── combined.log          # Logs généraux du bot
├── error.log             # Erreurs du bot
└── casino/              # Logs casino
    ├── game_*.log       # Parties
    ├── transaction_*.log # Transactions
    ├── shop_*.log       # Boutique
    └── archives/        # Logs archivés (>5MB)
```

---

## 🏆 Système de Niveaux Casino

### Progression
- **Base:** 500 JTN/jour
- **Bonus Niveau:** +1% par niveau (max 50%)
- **Bonus VIP:** +20%
- **Bonus Streak:** +5% par jour consécutif (max 100%)

### Milestones
- **7 jours:** Message spécial
- **30 jours:** +5,000 JTN bonus
- **100 jours:** +25,000 JTN bonus + titre légendaire

### Achievements
- Débloquez des succès en jouant
- Récompenses en JTN
- Badges affichés sur votre profil

---

## 🛠️ Administration

### Commandes Admin Casino
```
+casino grant @user <montant>    # Donner des JTN
+casino take @user <montant>     # Retirer des JTN
+casino setbal @user <montant>   # Définir le solde
+casino metrics                  # Métriques économie
+casino auditlog                 # Historique des actions
+casino config                   # Panel de configuration
```

### Monitoring
```bash
# Logs en temps réel
tail -f logs/combined.log

# Logs casino
tail -f logs/casino/game_*.log

# Statistiques
+cstats logs  # Dans Discord (admin)
```

---

## 🔧 Développement

### Structure du Projet
```
ZoomBOT/
├── commands/          # Commandes par catégorie
│   ├── casino/       # Commandes casino
│   ├── gestion/      # Commandes gestion
│   ├── admin/        # Commandes admin
│   └── ...
├── events/           # Gestionnaires d'événements
│   ├── client/       # Événements principaux
│   └── gestion/      # Événements gestion
├── utils/            # Utilitaires
│   ├── casino.js     # Système casino
│   ├── casinoLogger.js  # Logs casino
│   ├── simpledb.js   # Base de données
│   └── logger.js     # Logger principal
├── logs/             # Fichiers de logs
└── config.json       # Configuration
```

### Ajouter une Commande Casino
```javascript
// commands/casino/monJeu.js
const Casino = require('../../utils/casino');
const casinoLogger = require('../../utils/casinoLogger');

module.exports = {
  name: 'monjeu',
  category: 'casino',
  run: async (client, message, args) => {
    // Votre logique de jeu
    
    // Logger la partie
    casinoLogger.logGame(userId, 'monjeu', {
      bet: mise,
      payout: gain,
      win: aGagne,
      balance: nouveauSolde
    });
  }
};
```

---

## 🐛 Troubleshooting

### Le bot ne démarre pas
```bash
# Vérifier les erreurs
cat logs/error.log

# Réinstaller les dépendances
rm -rf node_modules
npm install
```

### Commandes ne répondent pas
```bash
# Vérifier les logs
tail -f logs/combined.log

# Lancer la vérification
node verify-all.js
```

### Logs casino non créés
```bash
# Créer le dossier
mkdir -p logs/casino

# Vérifier les permissions
chmod 755 logs/casino
```

---

## 📊 Statistiques

### Performance
- ⚡ Temps de réponse: <100ms
- 📊 Logs structurés: 9 catégories
- 🔄 Rotation automatique: 5 MB max
- 🗄️ Conservation: 30 jours

### Capacités
- 🎮 **15+** jeux casino
- 📈 **6** types de leaderboard
- 🏆 **50+** achievements
- 👥 Supporte **1000+** joueurs simultanés

---

## 🤝 Contribution

Les contributions sont les bienvenues !

1. Fork le projet
2. Créez votre branche (`git checkout -b feature/AmazingFeature`)
3. Commit vos changements (`git commit -m 'Add AmazingFeature'`)
4. Push vers la branche (`git push origin feature/AmazingFeature`)
5. Ouvrez une Pull Request

---

## 📜 Licence

Ce projet est sous licence MIT. Voir le fichier [LICENSE](LICENSE) pour plus de détails.

---

## 🙏 Remerciements

- Discord.js pour l'API
- Tous les contributeurs
- La communauté Discord

---

## 📞 Support

- 📧 Email: votre-email@example.com
- 💬 Discord: Votre serveur Discord
- 🐛 Issues: [GitHub Issues](https://github.com/votre-repo/issues)

---

**Version:** 3.0 (Casino 2.0)  
**Dernière mise à jour:** 27 Novembre 2024  
**Status:** ✅ Production Ready

**Profitez de votre bot Zoom amélioré !** 🎉
