const db = require('./simpledb');
const logger = require('./logger');
const Casino = require('./casino');

/**
 * SYSTÈME CRIMINEL
 * Gère les activités criminelles (vols, braquages, etc.)
 */

class CriminalSystem {
    constructor() {
        this.jailDuration = 3600000; // 1 heure par défaut
    }

    /**
     * Vérifie si un utilisateur est en prison
     */
    isInJail(userId) {
        const jailUntil = db.get(`criminal_jail_${userId}`);
        if (!jailUntil) return false;

        if (Date.now() >= jailUntil) {
            // Libérer
            db.delete(`criminal_jail_${userId}`);
            return false;
        }

        return true;
    }

    /**
     * Met un utilisateur en prison
     */
    sendToJail(userId, duration) {
        const until = Date.now() + duration;
        db.set(`criminal_jail_${userId}`, until);

        return {
            until,
            duration,
            message: `Vous êtes en prison pour ${Math.ceil(duration / 60000)} minutes`
        };
    }

    /**
     * Récupère le temps restant en prison
     */
    getJailTimeRemaining(userId) {
        const jailUntil = db.get(`criminal_jail_${userId}`);
        if (!jailUntil) return 0;

        const remaining = jailUntil - Date.now();
        return Math.max(0, remaining);
    }

    /**
     * Tente de voler un utilisateur
     */
    async rob(robberId, targetId, guild) {
        try {
            // Vérifier si le voleur est en prison
            if (this.isInJail(robberId)) {
                const remaining = this.getJailTimeRemaining(robberId);
                return {
                    ok: false,
                    error: `Vous êtes en prison pour encore ${Math.ceil(remaining / 60000)} minutes`
                };
            }

            // Vérifier le cooldown
            const lastRob = db.get(`criminal_rob_cooldown_${robberId}`) || 0;
            const cooldown = 43200000; // 12 heures
            const now = Date.now();

            if (now - lastRob < cooldown) {
                const remaining = Math.ceil((cooldown - (now - lastRob)) / 3600000);
                return {
                    ok: false,
                    error: `Vous devez attendre encore ${remaining}h avant de pouvoir voler à nouveau`
                };
            }

            // Vérifier que la cible n'est pas le voleur
            if (robberId === targetId) {
                return { ok: false, error: 'Vous ne pouvez pas vous voler vous-même' };
            }

            // Récupérer les soldes
            const robberBalance = Casino.getCasinoBalance(robberId);
            const targetBalance = Casino.getCasinoBalance(targetId);

            // Vérifier que la cible a assez d'argent
            if (targetBalance < 100) {
                return { ok: false, error: 'Cette personne est trop pauvre pour être volée' };
            }

            // Calculer le taux de réussite
            const robberLevel = Casino.getLevel(robberId);
            let successRate = 0.4; // 40% de base

            // Bonus selon le niveau
            successRate += robberLevel * 0.005; // +0.5% par niveau
            successRate = Math.min(0.75, successRate); // Max 75%

            // Tenter le vol
            const success = Math.random() < successRate;

            if (success) {
                // Vol réussi
                const minSteal = 100;
                const maxSteal = Math.min(5000, targetBalance * 0.2); // Max 20% du solde
                const stolen = Math.floor(Math.random() * (maxSteal - minSteal + 1)) + minSteal;

                // Transférer l'argent
                Casino.deductCasinoCredits(targetId, stolen);
                Casino.addCasinoCredits(robberId, stolen);

                // Mettre à jour le cooldown
                db.set(`criminal_rob_cooldown_${robberId}`, now);

                // Statistiques
                const totalRobbed = db.get(`criminal_total_robbed_${robberId}`) || 0;
                db.set(`criminal_total_robbed_${robberId}`, totalRobbed + stolen);

                return {
                    ok: true,
                    success: true,
                    stolen,
                    message: `Vous avez volé **${stolen} 💰** avec succès !`
                };

            } else {
                // Vol échoué
                const penalty = 1000;
                const jailTime = 3600000; // 1 heure

                // Appliquer la pénalité
                if (robberBalance >= penalty) {
                    Casino.deductCasinoCredits(robberId, penalty);
                }

                // Envoyer en prison
                this.sendToJail(robberId, jailTime);

                // Mettre à jour le cooldown quand même
                db.set(`criminal_rob_cooldown_${robberId}`, now);

                return {
                    ok: true,
                    success: false,
                    penalty,
                    jailTime,
                    message: `Vous vous êtes fait prendre ! Amende de ${penalty} 💰 et 1h de prison`
                };
            }

        } catch (error) {
            logger.error('[CRIMINAL] Erreur rob:', error);
            return { ok: false, error: 'Une erreur est survenue' };
        }
    }

    /**
     * Tente de braquer la banque
     */
    async heist(userId) {
        try {
            // Vérifier si l'utilisateur est en prison
            if (this.isInJail(userId)) {
                const remaining = this.getJailTimeRemaining(userId);
                return {
                    ok: false,
                    error: `Vous êtes en prison pour encore ${Math.ceil(remaining / 60000)} minutes`
                };
            }

            // Vérifier le cooldown
            const lastHeist = db.get(`criminal_heist_cooldown_${userId}`) || 0;
            const cooldown = 86400000; // 24 heures
            const now = Date.now();

            if (now - lastHeist < cooldown) {
                const remaining = Math.ceil((cooldown - (now - lastHeist)) / 3600000);
                return {
                    ok: false,
                    error: `Vous devez attendre encore ${remaining}h avant de pouvoir braquer à nouveau`
                };
            }

            // Vérifier le solde (besoin d'équipement)
            const balance = Casino.getCasinoBalance(userId);
            const equipmentCost = 5000;

            if (balance < equipmentCost) {
                return {
                    ok: false,
                    error: `Vous avez besoin de ${equipmentCost} 💰 pour acheter l'équipement nécessaire`
                };
            }

            // Calculer le taux de réussite
            const level = Casino.getLevel(userId);
            let successRate = 0.2; // 20% de base

            // Bonus selon le niveau
            successRate += level * 0.003; // +0.3% par niveau
            successRate = Math.min(0.5, successRate); // Max 50%

            // Déduire le coût de l'équipement
            Casino.deductCasinoCredits(userId, equipmentCost);

            // Tenter le braquage
            const success = Math.random() < successRate;

            if (success) {
                // Braquage réussi
                const minSteal = 10000;
                const maxSteal = 100000;
                const stolen = Math.floor(Math.random() * (maxSteal - minSteal + 1)) + minSteal;

                // Ajouter l'argent
                Casino.addCasinoCredits(userId, stolen);

                // Mettre à jour le cooldown
                db.set(`criminal_heist_cooldown_${userId}`, now);

                // Statistiques
                const totalHeisted = db.get(`criminal_total_heisted_${userId}`) || 0;
                db.set(`criminal_total_heisted_${userId}`, totalHeisted + stolen);

                return {
                    ok: true,
                    success: true,
                    stolen,
                    equipmentCost,
                    profit: stolen - equipmentCost,
                    message: `Braquage réussi ! Vous avez volé **${stolen} 💰** !`
                };

            } else {
                // Braquage échoué
                const penalty = 50000;
                const jailTime = 7200000; // 2 heures

                // Appliquer la pénalité
                if (balance >= penalty) {
                    Casino.deductCasinoCredits(userId, penalty);
                }

                // Envoyer en prison
                this.sendToJail(userId, jailTime);

                // Mettre à jour le cooldown quand même
                db.set(`criminal_heist_cooldown_${userId}`, now);

                return {
                    ok: true,
                    success: false,
                    penalty,
                    jailTime,
                    equipmentCost,
                    message: `Braquage échoué ! Amende de ${penalty} 💰 et 2h de prison`
                };
            }

        } catch (error) {
            logger.error('[CRIMINAL] Erreur heist:', error);
            return { ok: false, error: 'Une erreur est survenue' };
        }
    }

    /**
     * Récupère les statistiques criminelles d'un utilisateur
     */
    getStats(userId) {
        return {
            totalRobbed: db.get(`criminal_total_robbed_${userId}`) || 0,
            totalHeisted: db.get(`criminal_total_heisted_${userId}`) || 0,
            inJail: this.isInJail(userId),
            jailTimeRemaining: this.getJailTimeRemaining(userId)
        };
    }
}

// Instance singleton
const criminalSystem = new CriminalSystem();

module.exports = criminalSystem;
