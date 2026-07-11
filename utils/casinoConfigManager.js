const db = require('./simpledb');
const logger = require('./logger');

/**
 * Système de configuration complet pour le casino
 * Permet une personnalisation totale de A à Z
 */

class CasinoConfigManager {
  constructor() {
    this.defaultConfig = this.getDefaultConfig();
  }

  /**
   * Configuration par défaut complète
   */
  getDefaultConfig() {
    return {
      // === GÉNÉRAL ===
      general: {
        enabled: true,
        currency: {
          name: 'JTN',
          symbol: '💰',
          emoji: '🎰'
        },
        prefix: '+c',
        language: 'fr',
        timezone: 'Europe/Paris'
      },

      // === ÉCONOMIE ===
      economy: {
        startingBalance: 1000,
        maxBalance: 999999999,
        minBet: 10,
        maxBet: 100000,
        bankruptcyProtection: {
          enabled: true,
          minBalance: 0,
          resetAmount: 500
        },
        inflation: {
          enabled: false,
          rate: 0.01, // 1% par semaine
          interval: 604800000 // 7 jours en ms
        }
      },

      // === GAINS QUOTIDIENS (DAILY) ===
      daily: {
        enabled: true,
        baseAmount: 500,
        cooldown: 86400000, // 24h en ms
        streak: {
          enabled: true,
          bonusPerDay: 50, // +50 par jour
          maxBonus: 2000,
          resetOnMiss: true
        },
        bonuses: {
          level: {
            enabled: true,
            percentPerLevel: 1, // 1% par niveau
            maxPercent: 50 // Max 50%
          },
          vip: {
            enabled: true,
            multiplier: 1.2 // x1.2
          },
          role: [] // [{roleId, multiplier}]
        },
        milestones: [
          { days: 7, reward: 1000, message: '🎉 Une semaine de suite !' },
          { days: 30, reward: 5000, message: '🏆 Un mois complet !' },
          { days: 100, reward: 25000, message: '🌟 Centenaire légendaire !' },
          { days: 365, reward: 100000, message: '<:_:1483497499489603747> Un an de fidélité !' }
        ]
      },

      // === SYSTÈME DE NIVEAUX ===
      levels: {
        enabled: true,
        xpPerGame: {
          min: 5,
          max: 15
        },
        xpPerWin: {
          min: 10,
          max: 30
        },
        xpRequiredFormula: 'level * 1000', // XP = niveau × 1000
        maxLevel: 100,
        rewards: {
          perLevel: {
            currency: 100,
            multiplier: 1.01 // +1% par niveau
          },
          milestones: [
            { level: 10, reward: 5000, role: null },
            { level: 25, reward: 15000, role: null },
            { level: 50, reward: 50000, role: null },
            { level: 100, reward: 250000, role: null }
          ]
        }
      },

      // === MULTIPLICATEURS GLOBAUX ===
      multipliers: {
        global: 1.0,
        weekend: {
          enabled: true,
          multiplier: 1.5
        },
        events: {
          enabled: true,
          active: false,
          multiplier: 2.0,
          endDate: null
        },
        happyHour: {
          enabled: false,
          hours: [18, 19, 20], // 18h-21h
          multiplier: 1.3
        }
      },

      // === JACKPOT ===
      jackpot: {
        enabled: true,
        starting: 10000,
        contributionRate: 0.02, // 2% de chaque mise
        minWin: 1000000, // Minimum pour gagner le jackpot
        resetAfterWin: true,
        resetAmount: 10000,
        maxSize: 10000000
      },

      // === JEUX - MACHINES À SOUS ===
      games: {
        slots: {
          enabled: true,
          minBet: 10,
          maxBet: 10000,
          cooldown: 3000,
          rtp: 0.96, // Return to player 96%
          symbols: [
            { symbol: '🍒', weight: 30, payout: 2 },
            { symbol: '🍋', weight: 25, payout: 3 },
            { symbol: '🍊', weight: 20, payout: 5 },
            { symbol: '🍇', weight: 15, payout: 10 },
            { symbol: '💎', weight: 8, payout: 20 },
            { symbol: '🎰', weight: 2, payout: 50 }
          ],
          bonusFeatures: {
            freeSpins: {
              enabled: true,
              trigger: ['🎰', '🎰', '🎰'],
              amount: 10
            }
          }
        },

        // === BLACKJACK ===
        blackjack: {
          enabled: true,
          minBet: 50,
          maxBet: 50000,
          cooldown: 5000,
          payouts: {
            win: 2,
            blackjack: 2.5,
            push: 1,
            insurance: 2
          },
          rules: {
            dealerStandsOn: 17,
            allowDoubleDown: true,
            allowSplit: true,
            allowInsurance: true,
            maxSplits: 1
          },
          bonuses: {
            blackjackBonus: 0, // Bonus supplémentaire
            suited21: 0
          }
        },

        // === ROULETTE ===
        roulette: {
          enabled: true,
          minBet: 10,
          maxBet: 25000,
          cooldown: 4000,
          payouts: {
            straight: 35, // Un numéro
            split: 17, // Deux numéros
            street: 11, // Trois numéros
            corner: 8, // Quatre numéros
            line: 5, // Six numéros
            dozen: 2, // Douzaine
            column: 2, // Colonne
            redBlack: 2, // Rouge/Noir
            oddEven: 2, // Pair/Impair
            highLow: 2 // 1-18/19-36
          },
          wheelType: 'european' // european (37) ou american (38)
        },

        // === COINFLIP ===
        coinflip: {
          enabled: true,
          minBet: 10,
          maxBet: 50000,
          cooldown: 2000,
          payout: 2,
          houseEdge: 0.01 // 1%
        },

        // === DICE ===
        dice: {
          enabled: true,
          minBet: 10,
          maxBet: 30000,
          cooldown: 2000,
          sides: 6,
          payouts: {
            exact: 6, // Deviner le nombre exact
            over: 2, // Plus de X
            under: 2 // Moins de X
          }
        },

        // === CRASH ===
        crash: {
          enabled: true,
          minBet: 50,
          maxBet: 100000,
          cooldown: 10000,
          minMultiplier: 1.01,
          maxMultiplier: 100,
          crashChance: 0.01 // 1% de crash à chaque tick
        },

        // === MINES ===
        mines: {
          enabled: true,
          minBet: 20,
          maxBet: 20000,
          cooldown: 3000,
          gridSize: 25, // 5x5
          minesCount: {
            min: 1,
            max: 24
          },
          multiplierFormula: '1 + (mines * 0.3) * (revealed / (25 - mines))'
        },

        // === PLINKO ===
        plinko: {
          enabled: true,
          minBet: 10,
          maxBet: 15000,
          cooldown: 3000,
          rows: 16,
          risk: {
            low: [0, 0.5, 1, 1.5, 2, 3, 2, 1.5, 1, 0.5, 0],
            medium: [0, 0.3, 0.5, 1, 2, 5, 10, 5, 2, 1, 0.5, 0.3, 0],
            high: [0, 0, 0.2, 0.5, 1, 5, 15, 50, 15, 5, 1, 0.5, 0.2, 0, 0]
          }
        },

        // === WHEEL ===
        wheel: {
          enabled: true,
          minBet: 25,
          maxBet: 20000,
          cooldown: 5000,
          segments: [
            { multiplier: 0, weight: 30, color: 'red' },
            { multiplier: 1.2, weight: 25, color: 'blue' },
            { multiplier: 1.5, weight: 20, color: 'green' },
            { multiplier: 2, weight: 15, color: 'yellow' },
            { multiplier: 5, weight: 8, color: 'purple' },
            { multiplier: 10, weight: 2, color: 'gold' }
          ]
        },

        // === POKER ===
        poker: {
          enabled: true,
          minBet: 100,
          maxBet: 50000,
          cooldown: 10000,
          payouts: {
            royalFlush: 800,
            straightFlush: 50,
            fourOfKind: 25,
            fullHouse: 9,
            flush: 6,
            straight: 4,
            threeOfKind: 3,
            twoPair: 2,
            pair: 1
          }
        }
      },

      // === BOUTIQUE ===
      shop: {
        enabled: true,
        items: [
          {
            id: 'vip_7d',
            name: 'VIP 7 jours',
            price: 5000,
            description: '+20% sur tous les gains',
            duration: 604800000,
            icon: '💎',
            category: 'vip',
            stock: -1 // -1 = illimité
          },
          {
            id: 'vip_30d',
            name: 'VIP 30 jours',
            price: 15000,
            description: '+20% sur tous les gains',
            duration: 2592000000,
            icon: '💎',
            category: 'vip',
            stock: -1
          },
          {
            id: 'xp_boost',
            name: 'Boost XP (1h)',
            price: 800,
            description: '+50% XP pendant 1 heure',
            duration: 3600000,
            icon: '⚡',
            category: 'boost',
            stock: -1
          },
          {
            id: 'luck_charm',
            name: 'Porte-bonheur',
            price: 2000,
            description: '+5% de chance sur les jeux',
            duration: 7200000,
            icon: '🍀',
            category: 'boost',
            stock: -1
          },
          {
            id: 'insurance',
            name: 'Assurance',
            price: 1000,
            description: 'Récupère 50% de ta prochaine perte',
            duration: 0,
            icon: '<:_:1483497431135162539>',
            category: 'protection',
            stock: -1
          }
        ],
        discounts: {
          vip: 0.1, // 10% de réduction pour VIP
          level10: 0.05, // 5% à partir du niveau 10
          level25: 0.1, // 10% à partir du niveau 25
          level50: 0.15 // 15% à partir du niveau 50
        }
      },

      // === MÉTIERS (JOBS) ===
      jobs: {
        enabled: true,
        changeCooldown: 604800000, // 7 jours
        list: [
          {
            id: 'banker',
            name: 'Banquier',
            icon: '🏦',
            salary: { min: 1500, max: 2000 },
            cooldown: 86400000, // 24h
            skill: 'finance',
            bonuses: {
              blackjackWin: 0.01 // +1% sur blackjack
            }
          },
          {
            id: 'dealer',
            name: 'Croupier',
            icon: '🎰',
            salary: { min: 1000, max: 1500 },
            cooldown: 86400000,
            skill: 'luck',
            bonuses: {
              slotsWin: 0.02 // +2% sur slots
            }
          },
          {
            id: 'hacker',
            name: 'Hacker',
            icon: '💻',
            salary: { min: 1200, max: 1800 },
            cooldown: 86400000,
            skill: 'intelligence',
            bonuses: {
              dailyBonus: 0.15 // +15% daily
            }
          },
          {
            id: 'merchant',
            name: 'Marchand',
            icon: '🏪',
            salary: { min: 900, max: 1400 },
            cooldown: 86400000,
            skill: 'charisma',
            bonuses: {
              shopDiscount: 0.1 // -10% boutique
            }
          }
        ],
        skills: {
          maxLevel: 100,
          xpFormula: 'level * 500'
        }
      },

      // === ACHIEVEMENTS (SUCCÈS) ===
      achievements: {
        enabled: true,
        list: [
          {
            id: 'first_win',
            name: 'Première victoire',
            description: 'Gagnez votre première partie',
            reward: 500,
            icon: '🎉',
            hidden: false
          },
          {
            id: 'millionaire',
            name: 'Millionnaire',
            description: 'Atteignez 1,000,000 de crédits',
            reward: 50000,
            icon: '💰',
            hidden: false
          },
          {
            id: 'high_roller',
            name: 'Flambeur',
            description: 'Misez plus de 100,000 en une partie',
            reward: 10000,
            icon: '🎲',
            hidden: false
          },
          {
            id: 'lucky_streak',
            name: 'Série chanceuse',
            description: 'Gagnez 10 parties d\'affilée',
            reward: 5000,
            icon: '🍀',
            hidden: false
          },
          {
            id: 'jackpot_winner',
            name: 'Jackpot !',
            description: 'Gagnez le jackpot',
            reward: 100000,
            icon: '🏆',
            hidden: false
          }
        ],
        notifications: {
          dm: true,
          channel: true
        }
      },

      // === TEAMS (GUILDES) ===
      teams: {
        enabled: true,
        creation: {
          cost: 50000,
          minLevel: 10,
          maxMembers: 20,
          nameMinLength: 3,
          nameMaxLength: 20
        },
        features: {
          bank: true,
          chat: true,
          competitions: true,
          customization: true
        },
        bonuses: {
          memberBonus: 0.02, // +2% par membre
          maxBonus: 0.2 // Max 20%
        },
        payroll: {
          enabled: true,
          frequency: 604800000, // 7 jours
          formula: 'members * 500'
        }
      },

      // === RESTRICTIONS ===
      restrictions: {
        channels: {
          whitelist: [], // Vide = tous les salons
          blacklist: []
        },
        roles: {
          whitelist: [],
          blacklist: [],
          requiredToPlay: []
        },
        users: {
          banned: []
        },
        rateLimit: {
          enabled: true,
          maxCommands: 30,
          timeWindow: 60000 // 30 commandes par minute
        }
      },

      // === NOTIFICATIONS ===
      notifications: {
        bigWin: {
          enabled: true,
          threshold: 50000,
          channel: null
        },
        levelUp: {
          enabled: true,
          channel: null
        },
        achievements: {
          enabled: true,
          channel: null
        },
        jackpot: {
          enabled: true,
          channel: null
        }
      },

      // === SÉCURITÉ & ANTI-TRICHE ===
      security: {
        antiCheat: {
          enabled: true,
          maxWinStreak: 50,
          suspiciousWinRate: 0.9, // 90%+ suspect
          autoSuspend: false,
          logChannel: null
        },
        cooldowns: {
          enforced: true,
          bypassRoles: []
        },
        limits: {
          maxDailyLoss: 1000000, // Protection perte
          maxDailyWin: 10000000, // Protection gain excessif
          resetDaily: true
        }
      },

      // === LOGS ===
      logs: {
        enabled: true,
        categories: {
          games: true,
          transactions: true,
          admin: true,
          security: true,
          errors: true
        },
        retention: 30, // Jours
        detailLevel: 'full' // minimal, normal, full
      },

      // === GAINS AUTOMATIQUES ===
      autoEarnings: {
        text: {
          enabled: false, // Désactivé par défaut
          channels: {
            // Exemple de configuration:
            // 'channelId': {
            //   enabled: true,
            //   coinsPerMessage: 5,
            //   cooldownMs: 60000,
            //   maxPerHour: 300,
            //   maxPerDay: 2000,
            //   minMessageLength: 10,
            //   bonusLongMessage: {
            //     threshold: 100,
            //     multiplier: 1.5
            //   },
            //   notifyUser: false
            // }
          }
        },
        voice: {
          enabled: false, // Désactivé par défaut
          channels: {
            // Exemple de configuration:
            // 'channelId': {
            //   enabled: true,
            //   coinsPerMinute: 10,
            //   bonusStreaming: 0.5,
            //   bonusCamera: 0.3,
            //   maxPerHour: 600,
            //   maxPerDay: 5000,
            //   requireUnmuted: true,
            //   requireUndeafened: true
            // }
          }
        }
      },

      // === INTERFACE ===
      interface: {
        embedColor: '#FFD700',
        thumbnails: true,
        animations: true,
        reactions: true,
        buttons: true,
        language: 'fr',
        customEmojis: {
          currency: null,
          win: null,
          lose: null,
          jackpot: null
        }
      }
    };
  }

  /**
   * Récupère la configuration d'une guilde
   */
  getGuildConfig(guildId) {
    const saved = db.get(`casino_full_config_${guildId}`);
    if (saved) {
      return this.mergeWithDefaults(saved);
    }
    return this.defaultConfig;
  }

  /**
   * Fusionne la config sauvegardée avec les valeurs par défaut
   */
  mergeWithDefaults(savedConfig) {
    return this.deepMerge(this.defaultConfig, savedConfig);
  }

  /**
   * Fusion profonde de deux objets
   */
  deepMerge(target, source) {
    const output = { ...target };
    if (this.isObject(target) && this.isObject(source)) {
      Object.keys(source).forEach(key => {
        if (this.isObject(source[key])) {
          if (!(key in target)) {
            output[key] = source[key];
          } else {
            output[key] = this.deepMerge(target[key], source[key]);
          }
        } else {
          output[key] = source[key];
        }
      });
    }
    return output;
  }

  isObject(item) {
    return item && typeof item === 'object' && !Array.isArray(item);
  }

  /**
   * Sauvegarde la configuration d'une guilde
   */
  saveGuildConfig(guildId, config) {
    try {
      db.set(`casino_full_config_${guildId}`, config);
      logger.info(`[CASINO-CONFIG] Configuration sauvegardée pour ${guildId}`);
      return true;
    } catch (error) {
      logger.error('[CASINO-CONFIG] Erreur sauvegarde:', error);
      return false;
    }
  }

  /**
   * Met à jour une valeur spécifique dans la config
   */
  updateConfigValue(guildId, path, value) {
    const config = this.getGuildConfig(guildId);
    const keys = path.split('.');
    let current = config;

    for (let i = 0; i < keys.length - 1; i++) {
      if (!current[keys[i]]) {
        current[keys[i]] = {};
      }
      current = current[keys[i]];
    }

    current[keys[keys.length - 1]] = value;
    return this.saveGuildConfig(guildId, config);
  }

  /**
   * Récupère une valeur spécifique de la config
   */
  getConfigValue(guildId, path, defaultValue = null) {
    const config = this.getGuildConfig(guildId);
    const keys = path.split('.');
    let current = config;

    for (const key of keys) {
      if (current[key] === undefined) {
        return defaultValue;
      }
      current = current[key];
    }

    return current;
  }

  /**
   * Réinitialise la config aux valeurs par défaut
   */
  resetGuildConfig(guildId) {
    db.delete(`casino_full_config_${guildId}`);
    logger.info(`[CASINO-CONFIG] Configuration réinitialisée pour ${guildId}`);
    return true;
  }

  /**
   * Exporte la configuration en JSON
   */
  exportConfig(guildId) {
    const config = this.getGuildConfig(guildId);
    return JSON.stringify(config, null, 2);
  }

  /**
   * Importe une configuration depuis JSON
   */
  importConfig(guildId, jsonString) {
    try {
      const config = JSON.parse(jsonString);
      return this.saveGuildConfig(guildId, config);
    } catch (error) {
      logger.error('[CASINO-CONFIG] Erreur import:', error);
      return false;
    }
  }
}

// Instance singleton
const configManager = new CasinoConfigManager();

module.exports = configManager;
