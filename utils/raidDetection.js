const LogSystem = require('./logSystem');

class RaidDetection {
  constructor(client) {
    this.client = client;
    this.logSystem = new LogSystem(client);
    this.joinTimes = new Map(); // guildId -> array de timestamps
    this.leaveTimes = new Map(); // guildId -> array de timestamps
    this.memberCounts = new Map(); // guildId -> count
    this.raidThresholds = {
      maxJoinsPerMinute: 10,
      maxLeavesPerMinute: 8,
      checkInterval: 60000 // 1 minute
    };
    
    // Démarrer la surveillance
    this.startMonitoring();
  }

  startMonitoring() {
    setInterval(() => {
      this.checkForRaids();
    }, this.raidThresholds.checkInterval);
  }

  recordJoin(guild) {
    const now = Date.now();
    const guildId = guild.id;
    
    if (!this.joinTimes.has(guildId)) {
      this.joinTimes.set(guildId, []);
    }
    
    const joins = this.joinTimes.get(guildId);
    joins.push(now);
    
    // Garder seulement les joins de la dernière minute
    const oneMinuteAgo = now - 60000;
    const recentJoins = joins.filter(time => time > oneMinuteAgo);
    this.joinTimes.set(guildId, recentJoins);
    
    // Mettre à jour le compteur de membres
    const currentCount = this.memberCounts.get(guildId) || 0;
    this.memberCounts.set(guildId, currentCount + 1);
    
    // Vérifier immédiatement si le seuil est dépassé
    if (recentJoins.length >= this.raidThresholds.maxJoinsPerMinute) {
      this.handleRaidDetection(guild, 'mass_join', {
        count: recentJoins.length,
        timeframe: '1 minute'
      });
    }
  }

  recordLeave(guild) {
    const now = Date.now();
    const guildId = guild.id;
    
    if (!this.leaveTimes.has(guildId)) {
      this.leaveTimes.set(guildId, []);
    }
    
    const leaves = this.leaveTimes.get(guildId);
    leaves.push(now);
    
    // Garder seulement les leaves de la dernière minute
    const oneMinuteAgo = now - 60000;
    const recentLeaves = leaves.filter(time => time > oneMinuteAgo);
    this.leaveTimes.set(guildId, recentLeaves);
    
    // Mettre à jour le compteur de membres
    const currentCount = this.memberCounts.get(guildId) || 0;
    this.memberCounts.set(guildId, Math.max(0, currentCount - 1));
    
    // Vérifier immédiatement si le seuil est dépassé
    if (recentLeaves.length >= this.raidThresholds.maxLeavesPerMinute) {
      this.handleRaidDetection(guild, 'mass_leave', {
        count: recentLeaves.length,
        timeframe: '1 minute'
      });
    }
  }

  checkForRaids() {
    const now = Date.now();
    const oneMinuteAgo = now - 60000;
    
    // Vérifier les joins
    for (const [guildId, joins] of this.joinTimes.entries()) {
      const recentJoins = joins.filter(time => time > oneMinuteAgo);
      this.joinTimes.set(guildId, recentJoins);
      
      if (recentJoins.length >= this.raidThresholds.maxJoinsPerMinute) {
        const guild = this.client.guilds.cache.get(guildId);
        if (guild) {
          this.handleRaidDetection(guild, 'mass_join', {
            count: recentJoins.length,
            timeframe: '1 minute'
          });
        }
      }
    }
    
    // Vérifier les leaves
    for (const [guildId, leaves] of this.leaveTimes.entries()) {
      const recentLeaves = leaves.filter(time => time > oneMinuteAgo);
      this.leaveTimes.set(guildId, recentLeaves);
      
      if (recentLeaves.length >= this.raidThresholds.maxLeavesPerMinute) {
        const guild = this.client.guilds.cache.get(guildId);
        if (guild) {
          this.handleRaidDetection(guild, 'mass_leave', {
            count: recentLeaves.length,
            timeframe: '1 minute'
          });
        }
      }
    }
  }

  async handleRaidDetection(guild, type, data) {
    const threatLevel = this.calculateThreatLevel(type, data);
    const actions = this.determineActions(threatLevel);
    
    await this.logSystem.logRaid(guild, type, {
      ...data,
      threatLevel,
      actions: actions.join(', ')
    });
    
    // Exécuter les actions automatiques si nécessaire
    if (threatLevel === 'Élevé') {
      await this.executeAutoActions(guild, type, data);
    }
  }

  calculateThreatLevel(type, data) {
    const count = data.count;
    
    if (count >= 20) {
      return 'Élevé';
    } else if (count >= 10) {
      return 'Moyen';
    } else {
      return 'Faible';
    }
  }

  determineActions(threatLevel) {
    const actions = [];
    
    switch (threatLevel) {
      case 'Élevé':
        actions.push('Vérification manuelle requise', 'Mode raid activé si disponible');
        break;
      case 'Moyen':
        actions.push('Surveillance augmentée');
        break;
      case 'Faible':
        actions.push('Monitoring normal');
        break;
    }
    
    return actions;
  }

  async executeAutoActions(guild, type, data) {
    // Ici, vous pouvez ajouter des actions automatiques
    // Par exemple: activer un mode raid, notifier les admins, etc.
    
    try {
      // Notifier les propriétaires du serveur
      const owner = await guild.fetchOwner();
      if (owner) {
        const { createEmbed, COLORS } = require('./embedDesign');
        const embed = createEmbed({
          title: '🚨 Alerte de Raid',
          description: `Une activité suspecte a été détectée sur votre serveur **${guild.name}**`,
          color: COLORS.ERROR,
          fields: [
            { name: 'Type', value: type === 'mass_join' ? 'Join en masse' : 'Leave en masse', inline: true },
            { name: 'Nombre', value: data.count.toString(), inline: true },
            { name: 'Période', value: data.timeframe, inline: true }
          ],
          footer: {
            text: 'Zoom Bot • Système de sécurité'
          },
          timestamp: true
        });
        
        await owner.send({ embeds: [embed] });
      }
    } catch (error) {
      console.error('Erreur lors de la notification du propriétaire:', error);
    }
  }

  // Méthode pour configurer les seuils
  setThresholds(newThresholds) {
    this.raidThresholds = { ...this.raidThresholds, ...newThresholds };
  }

  // Méthode pour obtenir les statistiques actuelles
  getStats(guildId) {
    const now = Date.now();
    const oneMinuteAgo = now - 60000;
    
    const joins = this.joinTimes.get(guildId) || [];
    const leaves = this.leaveTimes.get(guildId) || [];
    
    const recentJoins = joins.filter(time => time > oneMinuteAgo);
    const recentLeaves = leaves.filter(time => time > oneMinuteAgo);
    
    return {
      joins: recentJoins.length,
      leaves: recentLeaves.length,
      totalMembers: this.memberCounts.get(guildId) || 0
    };
  }
}

module.exports = RaidDetection;
