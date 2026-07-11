# Sources OSINT — Lookup & commandes OSINT

Toutes les ressources utilisées par la commande **lookup** (et les commandes breach, geoip, etc.).

---

## 1. Bases de données du projet (config.json)

À configurer dans `config.json` → `APIS` :

| Source     | Clé config              | Description                    |
|-----------|-------------------------|--------------------------------|
| **Snusbase** | `APIS.SNUSBASE.API_KEY` | Fuites email / username / IP / hash / domaine |
| **IntelX**   | `APIS.INTEL_X.API_KEY` | Recherche OSINT (email, domaine, username, hash) |
| **NazAPI**   | `APIS.NAZAPI.API_KEY`  | Email, username, téléphone     |

Sans ces clés, les sections correspondantes seront vides ou "non configuré".

---

## 2. Variables d’environnement (optionnel = plus de résultats)

### Breach / Email / Username
| Variable           | Service        | Gratuit / Limite        |
|--------------------|----------------|--------------------------|
| `HIBP_API_KEY`     | Have I Been Pwned | Tier payant ou clé test |
| `LEAKCHECK_API_KEY`| LeakCheck      | Public sans clé (1 req/s) ou Pro |
| `EMAILREP_API_KEY` | EmailRep       | 250 req/mois             |
| `HUNTER_API_KEY`   | Hunter.io      | 50 req/mois              |

### IP
| Variable            | Service       | Gratuit / Limite   |
|---------------------|---------------|--------------------|
| `IPINFO_TOKEN`      | IPInfo        | Tier gratuit       |
| `IPHUB_API_KEY`     | IPHub         | Tier gratuit       |
| `ABUSEIPDB_API_KEY` | AbuseIPDB     | 1000 checks/jour   |

### Domaine
| Variable           | Service     | Gratuit / Limite   |
|--------------------|------------|--------------------|
| `URLSCAN_API_KEY`  | urlscan.io | Quota gratuit avec compte |

### Téléphone
| Variable            | Service   | Gratuit / Limite |
|---------------------|-----------|------------------|
| `NUMVERIFY_API_KEY` | NumVerify | Limité           |
| `ABSTRACT_API_KEY`  | Abstract API | Tier gratuit  |

---

## 3. Sources 100 % gratuites (sans clé)

- **IP :** ip-api.com, ipwhois.app, Shodan InternetDB, HackerTarget (reverse IP, geoip), IPHub (tier free)
- **Domaine :** whois-json + dns (Node), HackerTarget (whois, dns), crt.sh (sous-domaines), urlscan.io (recherche sans clé limitée)
- **Pastes :** Psbdmp, Dumpz, Ghostbin
- **Breach :** LeakCheck (API publique, 1 req/s)

---

## 4. Fichiers du projet concernés

- `utils/lookupSources.js` — agrégation de toutes les sources pour la commande **lookup**
- `utils/osint_sources.json` — liste technique des sources et clés
- `utils/snusbase.js` — client Snusbase
- `utils/intelx.js` — client IntelX
- `utils/nazapi.js` — client NazAPI
- `commands/osint/` — breach, geoip, intel, pastebin, phoneinfo, snusbase, vpncheck, whoisdomain, lookup

---

## 5. Ajouter une nouvelle source

1. Créer ou utiliser un fetcher dans `utils/lookupSources.js` (ex. `fetchNouvelleSource(query)`).
2. L’appeler dans `runAllLookups()` pour le type de requête adapté (email, ip, domain, phone).
3. Documenter la clé ou l’URL dans ce fichier et dans `utils/osint_sources.json`.
