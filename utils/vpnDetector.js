const https = require('https');

class VPNDetector {
    constructor() {
        this.apiKey = process.env.IPQUALITY_KEY || '';
    }

    /**
     * Effectue une requête HTTPS simple sans dépendances externes
     */
    _fetch(url) {
        return new Promise((resolve, reject) => {
            https.get(url, { timeout: 5000 }, (res) => {
                let data = '';
                res.on('data', chunk => data += chunk);
                res.on('end', () => {
                    try { resolve(JSON.parse(data)); }
                    catch (e) { reject(e); }
                });
            }).on('error', reject).on('timeout', () => reject(new Error('timeout')));
        });
    }

    /**
     * Vérifie si une IP est un VPN / proxy / tor
     * Retourne { isVPN, score, isp, country, error }
     */
    async checkVPN(ip) {
        // IP locales — ignorer
        if (!ip || ip === '127.0.0.1' || ip === '::1' ||
            ip.startsWith('192.168.') || ip.startsWith('10.') || ip.startsWith('172.')) {
            return { isVPN: false, score: 0 };
        }

        // Méthode 1 : ipqualityscore (si clé API configurée)
        if (this.apiKey) {
            try {
                const data = await this._fetch(
                    `https://ipqualityscore.com/api/json/ip/${this.apiKey}/${ip}?allow_public_access_points=true&fast=true&strictness=1`
                );
                if (data && data.success) {
                    return {
                        isVPN:    data.vpn || data.proxy || data.tor || false,
                        score:    data.fraud_score || 0,
                        isp:      data.ISP || 'Inconnu',
                        country:  data.country_code || 'Inconnu',
                        error:    false
                    };
                }
            } catch (_) {}
        }

        // Méthode 2 : ip-api.com (fallback gratuit, sans clé)
        try {
            const data = await this._fetch(
                `http://ip-api.com/json/${ip}?fields=status,isp,org,hosting,proxy,query`
            );
            if (data && data.status === 'success') {
                const suspectKeywords = ['vpn', 'proxy', 'tor', 'hosting', 'datacenter', 'cloud', 'server'];
                const orgLower = (data.org || '').toLowerCase();
                const ispLower = (data.isp || '').toLowerCase();
                const keywordMatch = suspectKeywords.some(k => orgLower.includes(k) || ispLower.includes(k));
                const isVPN = data.proxy === true || data.hosting === true || keywordMatch;
                return {
                    isVPN,
                    score:   isVPN ? 75 : 10,
                    isp:     data.isp || 'Inconnu',
                    country: data.country || 'Inconnu',
                    error:   false
                };
            }
        } catch (_) {}

        return { isVPN: false, score: 0, isp: 'Inconnu', country: 'Inconnu', error: true };
    }
}

module.exports = new VPNDetector();
