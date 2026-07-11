const db = require('./simpledb');
const logger = require('./logger');
const Casino = require('./casino');

/**
 * SYSTÈME DE MINING
 * Permet aux utilisateurs de miner des ressources et de les vendre
 */

class Mining {
    constructor() {
        this.resources = {
            coal: {
                name: 'Charbon',
                icon: '⚫',
                rarity: 'common',
                value: 50,
                xpGain: 10,
                dropRate: 0.6
            },
            iron: {
                name: 'Fer',
                icon: '<:_:1483497382279643207>',
                rarity: 'common',
                value: 100,
                xpGain: 15,
                dropRate: 0.4
            },
            gold: {
                name: 'Or',
                icon: '<:_:1483497407915495527>',
                rarity: 'uncommon',
                value: 500,
                xpGain: 30,
                dropRate: 0.15
            },
            diamond: {
                name: 'Diamant',
                icon: '💎',
                rarity: 'rare',
                value: 2000,
                xpGain: 100,
                dropRate: 0.05
            },
            emerald: {
                name: 'Émeraude',
                icon: '💚',
                rarity: 'rare',
                value: 3000,
                xpGain: 150,
                dropRate: 0.03
            },
            ruby: {
                name: 'Rubis',
                icon: '<:_:1483497397542850570>',
                rarity: 'epic',
                value: 5000,
                xpGain: 200,
                dropRate: 0.015
            },
            mythril: {
                name: 'Mythril',
                icon: '✨',
                rarity: 'legendary',
                value: 15000,
                xpGain: 500,
                dropRate: 0.005
            },
            adamantite: {
                name: 'Adamantite',
                icon: '🌟',
                rarity: 'mythic',
                value: 50000,
                xpGain: 1000,
                dropRate: 0.001
            }
        };

        this.tools = {
            wooden_pickaxe: {
                name: 'Pioche en bois',
                icon: '🪓',
                price: 500,
                durability: 50,
                efficiency: 1.0,
                bonusDropRate: 0
            },
            stone_pickaxe: {
                name: 'Pioche en pierre',
                icon: '⛏️',
                price: 2000,
                durability: 100,
                efficiency: 1.2,
                bonusDropRate: 0.05
            },
            iron_pickaxe: {
                name: 'Pioche en fer',
                icon: '⚒️',
                price: 5000,
                durability: 200,
                efficiency: 1.5,
                bonusDropRate: 0.1
            },
            diamond_pickaxe: {
                name: 'Pioche en diamant',
                icon: '💎⛏️',
                price: 20000,
                durability: 500,
                efficiency: 2.0,
                bonusDropRate: 0.2
            },
            legendary_pickaxe: {
                name: 'Pioche légendaire',
                icon: '⚡⛏️',
                price: 100000,
                durability: -1, // Infini
                efficiency: 3.0,
                bonusDropRate: 0.5
            }
        };
    }

    /**
     * Récupère le niveau de minage d'un utilisateur
     */
    getMiningLevel(userId) {
        const xp = db.get(`mining_xp_${userId}`) || 0;
        return this.calculateLevel(xp);
    }

    /**
     * Calcule le niveau basé sur l'XP
     */
    calculateLevel(xp) {
        let level = 1;
        let requiredXp = 500;
        let totalXp = 0;

        while (totalXp + requiredXp <= xp && level < 100) {
            totalXp += requiredXp;
            level++;
            requiredXp = level * 500; // XP requis augmente avec le niveau
        }

        return level;
    }

    /**
     * Récupère l'XP de minage d'un utilisateur
     */
    getMiningXP(userId) {
        return db.get(`mining_xp_${userId}`) || 0;
    }

    /**
     * Ajoute de l'XP de minage
     */
    addMiningXP(userId, amount) {
        const current = this.getMiningXP(userId);
        const oldLevel = this.getMiningLevel(userId);

        db.set(`mining_xp_${userId}`, current + amount);

        const newLevel = this.getMiningLevel(userId);

        // Retourner si level up
        return {
            levelUp: newLevel > oldLevel,
            oldLevel,
            newLevel,
            xpGained: amount
        };
    }

    /**
     * Récupère l'outil équipé par un utilisateur
     */
    getEquippedTool(userId) {
        return db.get(`mining_tool_${userId}`) || null;
    }

    /**
     * Équipe un outil
     */
    equipTool(userId, toolId) {
        if (!this.tools[toolId]) {
            return { ok: false, error: 'Outil invalide' };
        }

        db.set(`mining_tool_${userId}`, toolId);
        return { ok: true, tool: this.tools[toolId] };
    }

    /**
     * Récupère la durabilité d'un outil
     */
    getToolDurability(userId, toolId) {
        const key = `mining_tool_durability_${userId}_${toolId}`;
        const durability = db.get(key);

        if (durability === undefined) {
            // Première utilisation, initialiser
            const tool = this.tools[toolId];
            if (tool && tool.durability > 0) {
                db.set(key, tool.durability);
                return tool.durability;
            }
            return -1; // Infini
        }

        return durability;
    }

    /**
     * Réduit la durabilité d'un outil
     */
    reduceDurability(userId, toolId) {
        const tool = this.tools[toolId];
        if (!tool || tool.durability === -1) return true; // Outil infini

        const key = `mining_tool_durability_${userId}_${toolId}`;
        const current = this.getToolDurability(userId, toolId);

        if (current <= 1) {
            // Outil cassé
            db.delete(key);
            db.delete(`mining_tool_${userId}`); // Déséquiper
            return false;
        }

        db.set(key, current - 1);
        return true;
    }

    /**
     * Mine une ressource
     */
    mine(userId) {
        try {
            // Vérifier le cooldown
            const lastMine = db.get(`mining_cooldown_${userId}`) || 0;
            const now = Date.now();
            const cooldown = 5000; // 5 secondes

            if (now - lastMine < cooldown) {
                const remaining = Math.ceil((cooldown - (now - lastMine)) / 1000);
                return {
                    ok: false,
                    error: `Cooldown actif. Réessayez dans ${remaining}s`
                };
            }

            // Récupérer l'outil équipé
            const toolId = this.getEquippedTool(userId);
            const tool = toolId ? this.tools[toolId] : null;

            // Calculer les bonus
            const level = this.getMiningLevel(userId);
            let bonusDropRate = 0;

            // Bonus de niveau
            if (level >= 10) bonusDropRate += 0.05;
            if (level >= 25) bonusDropRate += 0.05;
            if (level >= 50) bonusDropRate += 0.1;
            if (level >= 75) bonusDropRate += 0.1;
            if (level >= 100) bonusDropRate += 0.2;

            // Bonus d'outil
            if (tool) {
                bonusDropRate += tool.bonusDropRate;
            }

            // Déterminer la ressource minée
            const minedResource = this.rollResource(bonusDropRate);

            if (!minedResource) {
                db.set(`mining_cooldown_${userId}`, now);
                return {
                    ok: true,
                    nothing: true,
                    message: 'Vous n\'avez rien trouvé cette fois...'
                };
            }

            // Ajouter la ressource à l'inventaire
            const inventoryKey = `mining_inventory_${userId}_${minedResource.id}`;
            const current = db.get(inventoryKey) || 0;
            db.set(inventoryKey, current + 1);

            // Ajouter de l'XP
            const xpResult = this.addMiningXP(userId, minedResource.xpGain);

            // Réduire la durabilité de l'outil
            let toolBroken = false;
            if (toolId) {
                const stillUsable = this.reduceDurability(userId, toolId);
                if (!stillUsable) {
                    toolBroken = true;
                }
            }

            // Mettre à jour le cooldown
            db.set(`mining_cooldown_${userId}`, now);

            return {
                ok: true,
                resource: minedResource,
                xpGained: minedResource.xpGain,
                levelUp: xpResult.levelUp,
                newLevel: xpResult.newLevel,
                toolBroken,
                toolName: tool ? tool.name : null
            };

        } catch (error) {
            logger.error('[MINING] Erreur mine:', error);
            return { ok: false, error: 'Une erreur est survenue' };
        }
    }

    /**
     * Détermine quelle ressource est minée
     */
    rollResource(bonusDropRate) {
        const roll = Math.random();
        let cumulativeRate = 0;

        // Trier les ressources par rareté (du plus rare au plus commun)
        const sortedResources = Object.entries(this.resources).sort((a, b) => {
            return a[1].dropRate - b[1].dropRate;
        });

        for (const [id, resource] of sortedResources) {
            const adjustedRate = Math.min(1, resource.dropRate + bonusDropRate);
            cumulativeRate += adjustedRate;

            if (roll <= cumulativeRate) {
                return { id, ...resource };
            }
        }

        return null; // Rien trouvé
    }

    /**
     * Récupère l'inventaire de ressources d'un utilisateur
     */
    getInventory(userId) {
        const inventory = {};

        for (const resourceId of Object.keys(this.resources)) {
            const amount = db.get(`mining_inventory_${userId}_${resourceId}`) || 0;
            if (amount > 0) {
                inventory[resourceId] = amount;
            }
        }

        return inventory;
    }

    /**
     * Vend des ressources
     */
    sellResource(userId, resourceId, amount) {
        const resource = this.resources[resourceId];
        if (!resource) {
            return { ok: false, error: 'Ressource invalide' };
        }

        const inventoryKey = `mining_inventory_${userId}_${resourceId}`;
        const current = db.get(inventoryKey) || 0;

        if (current < amount) {
            return { ok: false, error: 'Quantité insuffisante' };
        }

        // Calculer le prix total
        const totalValue = resource.value * amount;

        // Retirer les ressources
        db.set(inventoryKey, current - amount);

        // Ajouter les crédits
        Casino.addCasinoCredits(userId, totalValue);

        return {
            ok: true,
            resource,
            amount,
            totalValue
        };
    }

    /**
     * Achète un outil
     */
    buyTool(userId, toolId) {
        const tool = this.tools[toolId];
        if (!tool) {
            return { ok: false, error: 'Outil invalide' };
        }

        // Vérifier si l'utilisateur a déjà cet outil
        const ownedKey = `mining_owns_${userId}_${toolId}`;
        if (db.get(ownedKey)) {
            return { ok: false, error: 'Vous possédez déjà cet outil' };
        }

        // Vérifier le solde
        const balance = Casino.getCasinoBalance(userId);
        if (balance < tool.price) {
            return { ok: false, error: 'Fonds insuffisants' };
        }

        // Déduire le prix
        Casino.deductCasinoCredits(userId, tool.price);

        // Marquer comme possédé
        db.set(ownedKey, true);

        // Équiper automatiquement si c'est le premier outil
        if (!this.getEquippedTool(userId)) {
            this.equipTool(userId, toolId);
        }

        return { ok: true, tool };
    }

    /**
     * Récupère les outils possédés par un utilisateur
     */
    getOwnedTools(userId) {
        const owned = [];

        for (const toolId of Object.keys(this.tools)) {
            if (db.get(`mining_owns_${userId}_${toolId}`)) {
                owned.push({
                    id: toolId,
                    ...this.tools[toolId],
                    durability: this.getToolDurability(userId, toolId)
                });
            }
        }

        return owned;
    }
}

// Instance singleton
const mining = new Mining();

module.exports = mining;
