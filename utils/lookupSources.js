/**
 * Lookup OSINT — toutes les sources utilisées
 *
 * DB du projet (config.json APIS):
 *   Snusbase, IntelX, NazAPI
 *
 * Breach / Email / Username:
 *   HIBP, LeakCheck (public ou LEAKCHECK_API_KEY), EmailRep (EMAILREP_API_KEY), Hunter (HUNTER_API_KEY)
 *
 * IP:
 *   ip-api.com, ipwhois.app, ipinfo (IPINFO_TOKEN), IPHub (IPHUB_API_KEY), Shodan InternetDB (gratuit),
 *   HackerTarget reverse IP, AbuseIPDB (ABUSEIPDB_API_KEY)
 *
 * Domaine:
 *   whois-json + dns, HackerTarget (whois, dns), crt.sh (sous-domaines), urlscan.io (URLSCAN_API_KEY)
 *
 * Paste: Psbdmp, Dumpz, Ghostbin
 * Phone: NumVerify, AbstractAPI (clés optionnelles)
 */

const axios = require('axios');
const EMOJIS = require('./emojis');
const { EMOJIS: EMB } = require('./embedBuilder');

const CHUNK_SIZE = 950;
const REQUEST_TIMEOUT = 12000;

function chunkText(text, size = CHUNK_SIZE) {
  if (!text || text.length <= size) return [text || '*Aucune donnée*'];
  const pages = [];
  for (let i = 0; i < text.length; i += size) {
    pages.push(text.slice(i, i + size));
  }
  return pages;
}

function getQueryType(query) {
  if (!query || typeof query !== 'string') return 'username';
  const q = query.trim();
  if (/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(q)) return 'email';
  if (/^\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}$/.test(q)) return 'ip';
  if (/^\+?[\d\s\-\.\(\)]{8,20}$/.test(q.replace(/\s/g, ''))) return 'phone';
  if (/^([a-zA-Z0-9\-]+\.)+[a-zA-Z]{2,}$/.test(q) && !q.includes('@')) return 'domain';
  if (/^\d{17,19}$/.test(q)) return 'discord_id';
  return 'username';
}

// ——— BREACH / EMAIL / USERNAME ——— 
async function fetchBreach(query) {
  const isEmail = getQueryType(query) === 'email';
  let out = '';
  const opts = { timeout: REQUEST_TIMEOUT };

  // 1) HIBP (gratuit avec ou sans clé)
  try {
    if (isEmail) {
      const res = await axios.get(`https://haveibeenpwned.com/api/v3/breachedaccount/${encodeURIComponent(query)}`, {
        headers: { 'User-Agent': 'Discord-Bot-OSINT', 'hibp-api-key': process.env.HIBP_API_KEY || '' },
        ...opts
      });
      const breaches = res.data || [];
      if (breaches.length) {
        const byYear = {};
        breaches.forEach((b) => {
          const y = new Date(b.BreachDate).getFullYear();
          if (!byYear[y]) byYear[y] = [];
          byYear[y].push(b);
        });
        Object.keys(byYear).sort().reverse().forEach((year) => {
          byYear[year].forEach((b) => {
            out += `• ${b.Name} (${b.BreachDate}) — ${(b.PwnCount || 0).toLocaleString()} comptes | ${(b.DataClasses || []).join(', ')}\n`;
          });
        });
      } else out = 'Aucune fuite HIBP trouvée.';
    } else {
      out = 'HIBP ne recherche que des adresses email.';
    }
  } catch (e) {
    if (e.response?.status === 404) out = 'Aucune fuite HIBP trouvée.';
    else out = 'HIBP indisponible.';
  }

  // 2) Snusbase (DB du projet)
  try {
    const { SnusbaseAPI } = require('./snusbase');
    const api = new SnusbaseAPI();
    const data = isEmail ? await api.searchEmail(query) : await api.searchUsername(query);
    const results = data?.results || [];
    if (results.length) {
      out += '\n**Snusbase**\n';
      results.slice(0, 20).forEach((r, i) => {
        out += `${i + 1}. ${r.username || r.email || 'N/A'} | Email: ${r.email || 'N/A'} | IP: ${r.lastip || 'N/A'} | DB: ${r.database || 'N/A'}\n`;
      });
      if (results.length > 20) out += `… +${results.length - 20} autre(s).\n`;
    }
  } catch (_) {
    if (!out.includes('Snusbase')) out += '\nSnusbase non configuré ou erreur.';
  }

  // 3) NazAPI (DB du projet — config.APIS.NAZAPI)
  try {
    const config = require('../config.json');
    if (config?.APIS?.NAZAPI?.API_KEY) {
      const { NazAPI } = require('./nazapi');
      const naz = new NazAPI();
      const nazData = isEmail ? await naz.searchEmail(query) : await naz.searchUsername(query);
      const nazResults = nazData?.results || [];
      if (nazResults.length) {
        out += '\n**NazAPI**\n';
        nazResults.slice(0, 15).forEach((r, i) => {
          out += `${i + 1}. ${r.email || r.username || r.phone || 'N/A'} | Source: ${r.source || 'N/A'}\n`;
        });
        if (nazResults.length > 15) out += `… +${nazResults.length - 15}\n`;
      }
    }
  } catch (_) {}

  // 4) LeakCheck (public gratuit 1 req/s, ou Pro avec LEAKCHECK_API_KEY)
  try {
    const key = process.env.LEAKCHECK_API_KEY;
    const url = key
      ? `https://leakcheck.io/api/v2/query/${encodeURIComponent(query)}`
      : `https://leakcheck.io/api/public?check=${encodeURIComponent(query)}`;
    const headers = key ? { 'X-API-Key': key } : {};
    const lc = await axios.get(url, { headers, ...opts });
    const data = lc.data;
    const results = data?.result || data?.results || (Array.isArray(data) ? data : []);
    if (results.length) {
      out += '\n**LeakCheck**\n';
      (Array.isArray(results) ? results : [results]).slice(0, 15).forEach((r, i) => {
        const line = typeof r === 'string' ? r : (r.source || r.name || r.breach || JSON.stringify(r).slice(0, 80));
        out += `${i + 1}. ${line}\n`;
      });
    }
  } catch (_) {}

  // 5) Hunter.io (gratuit 50 req/mois — optionnel HUNTER_API_KEY, vérif email / domaine)
  if (isEmail && process.env.HUNTER_API_KEY) {
    try {
      const hu = await axios.get('https://api.hunter.io/v2/email-verifier', {
        params: { email: query, api_key: process.env.HUNTER_API_KEY },
        ...opts
      });
      const h = hu.data?.data || {};
      out += '\n**Hunter.io**\n';
      out += `Valide: ${h.status === 'valid' ? 'Oui' : h.status || 'N/A'} | Score: ${h.score ?? 'N/A'}\n`;
      out += `SMTP: ${h.smtp_check ? 'Oui' : 'Non'} | Catch-all: ${h.catch_all ? 'Oui' : 'Non'}\n`;
    } catch (_) {}
  }

  // 6) EmailRep (gratuit 250 req/mois — optionnel, clé dans EMAILREP_API_KEY)
  if (isEmail && process.env.EMAILREP_API_KEY) {
    try {
      const er = await axios.get(`https://emailrep.io/${encodeURIComponent(query)}`, {
        headers: { 'Key': process.env.EMAILREP_API_KEY },
        ...opts
      });
      const d = er.data;
      out += '\n**EmailRep**\n';
      out += `Réputation: ${d.reputation || 'N/A'} | Suspect: ${d.suspicious ? 'Oui' : 'Non'}\n`;
      if (d.breaches) out += `Fuites: ${d.breaches}\n`;
      if (d.details?.credentials_leaked) out += `Credentials leakés: Oui\n`;
    } catch (_) {}
  }

  // 7) BreachDirectory (gratuit — recherche email/username)
  try {
    const bd = await axios.post('https://breachdirectory.therealparzival.com/api', {
      query: query
    }, { ...opts, headers: { 'Content-Type': 'application/json' } });
    const bdData = bd.data || {};
    if (bdData.success && bdData.results && bdData.results.length) {
      out += '\n**BreachDirectory**\n';
      bdData.results.slice(0, 10).forEach((r, i) => {
        out += `${i + 1}. ${r.hash || 'N/A'} | Source: ${r.sources?.join(', ') || 'N/A'}\n`;
      });
    }
  } catch (_) {}

  // 8) WeLeakInfo (gratuit limité — optionnel WELEAKINFO_API_KEY)
  if (process.env.WELEAKINFO_API_KEY) {
    try {
      const wli = await axios.get(`https://api.weleakinfo.com/v3/public/email/${encodeURIComponent(query)}`, {
        headers: { 'x-api-key': process.env.WELEAKINFO_API_KEY },
        ...opts
      });
      const wliData = wli.data || {};
      if (wliData.success && wliData.results && wliData.results.length) {
        out += '\n**WeLeakInfo**\n';
        wliData.results.slice(0, 10).forEach((r, i) => {
          out += `${i + 1}. ${r.name || 'N/A'} | ${r.date || 'N/A'} | ${r.sources?.length || 0} source(s)\n`;
        });
      }
    } catch (_) {}
  }

  // 9) Leak-Lookup (gratuit — recherche email/username)
  try {
    const ll = await axios.get(`https://leak-lookup.com/api/search`, {
      params: { type: isEmail ? 'email' : 'username', query: query },
      ...opts
    });
    const llData = ll.data || {};
    if (llData.message === 'success' && llData.found && llData.sources) {
      out += '\n**Leak-Lookup**\n';
      Object.entries(llData.sources).slice(0, 10).forEach(([source, data], i) => {
        out += `${i + 1}. ${source}: ${data.breach || data.date || 'Trouvé'}\n`;
      });
    }
  } catch (_) {}

  // 10) SkidSearch (gratuit — recherche username/email)
  if (!isEmail) {
    try {
      const ss = await axios.get(`https://skidsearch.net/api/search`, {
        params: { query: query },
        ...opts
      });
      const ssData = ss.data || {};
      if (ssData.results && ssData.results.length) {
        out += '\n**SkidSearch**\n';
        ssData.results.slice(0, 10).forEach((r, i) => {
          out += `${i + 1}. ${r.platform || 'N/A'}: ${r.url || 'N/A'}\n`;
        });
      }
    } catch (_) {}
  }

  return out || 'Aucun résultat breach.';
}

// ——— GEO IP (gratuit: ip-api, ipwhois.app, ipinfo optionnel, iphub optionnel) ———
async function fetchGeoIP(ip) {
  let out = `**IP:** ${ip}\n\n`;
  const opts = { timeout: REQUEST_TIMEOUT };
  try {
    const [ipapi, ipwhois, ipinfo, iphub, ipapiCo, ipgeo, ipstack] = await Promise.all([
      axios.get(`http://ip-api.com/json/${ip}?fields=status,country,regionName,city,isp,org,as,lat,lon,timezone,proxy,hosting`, opts).then((r) => r.data).catch(() => null),
      axios.get(`https://ipwhois.app/json/${ip}`, opts).then((r) => r.data).catch(() => null),
      process.env.IPINFO_TOKEN ? axios.get(`https://ipinfo.io/${ip}/json?token=${process.env.IPINFO_TOKEN}`, opts).then((r) => r.data).catch(() => null) : null,
      axios.get(`http://v2.api.iphub.info/ip/${ip}`, { headers: { 'X-Key': process.env.IPHUB_API_KEY || 'free' }, ...opts }).then((r) => r.data).catch(() => null),
      axios.get(`https://ipapi.co/${ip}/json/`, opts).then((r) => r.data).catch(() => null),
      process.env.IPGEOLOCATION_API_KEY ? axios.get(`https://api.ipgeolocation.io/ipgeo?apiKey=${process.env.IPGEOLOCATION_API_KEY}&ip=${ip}`, opts).then((r) => r.data).catch(() => null) : null,
      process.env.IPSTACK_API_KEY ? axios.get(`http://api.ipstack.com/${ip}?access_key=${process.env.IPSTACK_API_KEY}`, opts).then((r) => r.data).catch(() => null) : null
    ]);
    out += '**Localisation**\n';
    if (ipapi && ipapi.country) out += `Pays: ${ipapi.country} | Région: ${ipapi.regionName || ''} | Ville: ${ipapi.city || ''}\nISP: ${ipapi.isp || ''}\nAS: ${ipapi.as || ''}\nTimezone: ${ipapi.timezone || ''}\n`;
    if (ipwhois) out += `(ipwhois) Pays: ${ipwhois.country || ''} | Ville: ${ipwhois.city || ''} | ISP: ${ipwhois.isp || ''}\n`;
    if (ipinfo) out += `(ipinfo) Org: ${ipinfo.org || ''}\n`;
    if (ipapiCo && ipapiCo.country_name) out += `(ipapi.co) Pays: ${ipapiCo.country_name} | Ville: ${ipapiCo.city || ''} | ISP: ${ipapiCo.org || ''}\n`;
    if (ipgeo) out += `(ipgeolocation) Pays: ${ipgeo.country_name || ''} | Ville: ${ipgeo.city || ''} | ISP: ${ipgeo.isp || ''}\n`;
    if (ipstack && ipstack.country_name) out += `(IPStack) Pays: ${ipstack.country_name} | Ville: ${ipstack.city || ''} | ISP: ${ipstack.connection?.isp || ''}\n`;
    out += '\n**Réseau / Réputation**\n';
    if (ipapi) out += `Proxy: ${ipapi.proxy ? 'Oui' : 'Non'} | Hosting: ${ipapi.hosting ? 'Oui' : 'Non'}\n`;
    if (iphub) out += `(IPHub) Statut: ${iphub.block === 1 ? 'VPN/Proxy' : 'Normal'} | Type: ${iphub.type || 'N/A'} | ISP: ${iphub.isp || 'N/A'}\n`;
    if (ipapiCo && ipapiCo.threat) out += `(ipapi.co) Threat: ${ipapiCo.threat.is_tor || ipapiCo.threat.is_proxy ? 'Oui' : 'Non'}\n`;
    if (ipstack && ipstack.security) out += `(IPStack) Proxy/VPN: ${ipstack.security.proxy || ipstack.security.vpn ? 'Oui' : 'Non'}\n`;
  } catch (_) {
    out += 'Erreur GeoIP.';
  }
  return out;
}

// ——— VPN / Proxy (IPHub gratuit tier) ———
async function fetchVPN(ip) {
  try {
    const res = await axios.get(`http://v2.api.iphub.info/ip/${ip}`, {
      headers: { 'X-Key': process.env.IPHUB_API_KEY || 'free' },
      timeout: REQUEST_TIMEOUT
    });
    const d = res.data;
    let out = `**IP:** ${ip}\n`;
    out += `Fournisseur: ${d.isp || 'Inconnu'}\n`;
    out += `Pays: ${d.countryName || 'N/A'} | Ville: ${d.city || 'N/A'}\n`;
    out += `Statut: ${d.block === 1 ? 'VPN / Proxy détecté' : 'IP normale'}\n`;
    out += `Type: ${d.block === 0 ? 'Résidentiel' : d.block === 1 ? 'VPN/Proxy' : d.block === 2 ? 'Serveur' : 'N/A'}\n`;
    return out;
  } catch (_) {
    return 'Vérification VPN/Proxy indisponible (IPHub).';
  }
}

// ——— Reverse IP (domaines sur la même IP — HackerTarget gratuit) ———
async function fetchReverseIP(ip) {
  const domains = new Set();
  try {
    const ht = await axios.get(`https://api.hackertarget.com/reverseiplookup/?q=${ip}`, { timeout: REQUEST_TIMEOUT });
    const htText = (ht.data || '').trim();
    if (htText && !htText.toLowerCase().includes('error') && !htText.toLowerCase().includes('limit')) {
      htText.split('\n').filter((l) => l.trim()).forEach((d) => domains.add(d.trim()));
    }
  } catch (_) {}
  try {
    const viewdns = await axios.get(`https://api.viewdns.info/reverseip/?host=${ip}&apikey=${process.env.VIEWDNS_API_KEY || 'demo'}&output=json`, { timeout: REQUEST_TIMEOUT });
    const vdData = viewdns.data?.response || {};
    if (vdData.domains && Array.isArray(vdData.domains)) {
      vdData.domains.forEach((d) => domains.add(d.name || d));
    }
  } catch (_) {}
  if (domains.size === 0) return 'Aucun domaine trouvé sur cette IP.';
  const list = [...domains].slice(0, 30);
  return '**Domaines sur cette IP:**\n' + list.join('\n') + (domains.size > 30 ? `\n… +${domains.size - 30}` : '');
}

// ——— Robtex (gratuit — IP ↔ domaine, passive DNS) ———
async function fetchRobtexIP(ip) {
  try {
    const res = await axios.get(`https://freeapi.robtex.com/ipquery/${ip}`, { timeout: REQUEST_TIMEOUT });
    const d = res.data || {};
    let out = '**Robtex (IP)**\n';
    if (d.rl) out += `Liste noire: ${d.rl}\n`;
    if (d.country) out += `Pays: ${d.country}\n`;
    const pdns = d.pdns || [];
    if (pdns.length) {
      out += 'Passive DNS: ' + pdns.slice(0, 15).map((x) => x.o || x.roa?.name).filter(Boolean).join(', ') + (pdns.length > 15 ? ` (+${pdns.length - 15})` : '') + '\n';
    }
    return out.trim() || '';
  } catch (_) {
    return '';
  }
}

async function fetchRobtexDomain(domain) {
  try {
    const res = await axios.get(`https://freeapi.robtex.com/pdns/forward/${encodeURIComponent(domain)}`, { timeout: REQUEST_TIMEOUT });
    const arr = res.data || [];
    if (!arr.length) return '';
    let out = '**Robtex (Passive DNS)**\n';
    const uniq = [...new Set(arr.slice(0, 25).map((x) => x.rrname || x.rdata).filter(Boolean))];
    out += uniq.join('\n').slice(0, 600) + (arr.length > 25 ? '\n…' : '');
    return out.trim() || '';
  } catch (_) {
    return '';
  }
}

// ——— Shodan InternetDB (gratuit, sans clé — ports, hostnames, vulns) ———
async function fetchShodanInternetDB(ip) {
  try {
    const res = await axios.get(`https://internetdb.shodan.io/${ip}`, { timeout: REQUEST_TIMEOUT });
    const d = res.data || {};
    let out = `**InternetDB (Shodan)** — ${ip}\n\n`;
    if (d.hostnames && d.hostnames.length) out += `Hostnames: ${d.hostnames.slice(0, 15).join(', ')}\n`;
    if (d.ports && d.ports.length) out += `Ports ouverts: ${d.ports.slice(0, 20).join(', ')}\n`;
    if (d.tags && d.tags.length) out += `Tags: ${d.tags.join(', ')}\n`;
    if (d.vulns && d.vulns.length) out += `Vulnérabilités (CVE): ${d.vulns.slice(0, 15).join(', ')}\n`;
    if (d.cpes && d.cpes.length) out += `CPE: ${d.cpes.slice(0, 5).join(', ')}\n`;
    return out.trim() || 'Aucune donnée InternetDB.';
  } catch (_) {
    return 'Shodan InternetDB indisponible.';
  }
}

// ——— AbuseIPDB (gratuit 1000/jour — optionnel ABUSEIPDB_API_KEY) ———
async function fetchAbuseIPDB(ip) {
  if (!process.env.ABUSEIPDB_API_KEY) return '';
  try {
    const res = await axios.get('https://api.abuseipdb.com/api/v2/check', {
      params: { ipAddress: ip, maxAgeInDays: 30 },
      headers: { 'Key': process.env.ABUSEIPDB_API_KEY, 'Accept': 'application/json' },
      timeout: REQUEST_TIMEOUT
    });
    const d = res.data?.data || {};
    let out = '**AbuseIPDB**\n';
    out += `Score abus: ${d.abuseConfidenceScore ?? 'N/A'}% | Pays: ${d.countryName || 'N/A'}\n`;
    out += `Domaine: ${d.domain || 'N/A'} | Usage: ${d.usageType || 'N/A'}\n`;
    if (d.totalReports) out += `Rapports: ${d.totalReports}\n`;
    return out;
  } catch (_) {
    return '';
  }
}

// ——— urlscan.io (recherche de scans par domaine — optionnel URLSCAN_API_KEY) ———
async function fetchUrlscan(domain) {
  try {
    const headers = process.env.URLSCAN_API_KEY ? { 'API-Key': process.env.URLSCAN_API_KEY } : {};
    const res = await axios.get('https://urlscan.io/api/v1/search/', {
      params: { q: `domain:${domain}` },
      headers,
      timeout: REQUEST_TIMEOUT
    });
    const results = res.data?.results || [];
    if (!results.length) return 'Aucun scan urlscan.io pour ce domaine.';
    let out = '**urlscan.io (scans récents)**\n';
    results.slice(0, 12).forEach((r, i) => {
      out += `${i + 1}. ${r.page?.url || r.task?.url || 'N/A'} | ${r.task?.visibility || ''}\n`;
    });
    return out;
  } catch (_) {
    return 'urlscan.io indisponible.';
  }
}

// ——— WHOIS / DNS (whois-json + dns Node + HackerTarget gratuit + crt.sh) ———
async function fetchWhois(domain) {
  let out = `**Domaine:** ${domain}\n\n`;
  const opts = { timeout: REQUEST_TIMEOUT };
  try {
    const whois = require('whois-json');
    const dns = require('dns').promises;
    const whoisData = await whois(domain).catch(() => ({}));
    out += `Registrar: ${whoisData.registrar || 'N/A'}\n`;
    out += `Création: ${whoisData.creationDate ? new Date(whoisData.creationDate).toLocaleDateString('fr-FR') : 'N/A'}\n`;
    out += `Expiration: ${whoisData.expirationDate ? new Date(whoisData.expirationDate).toLocaleDateString('fr-FR') : 'N/A'}\n`;
    out += `Pays: ${whoisData.country || 'N/A'}\n`;
    if (whoisData.nameServers) {
      const ns = Array.isArray(whoisData.nameServers) ? whoisData.nameServers : [whoisData.nameServers];
      out += `NS: ${ns.slice(0, 3).join(', ')}\n`;
    }
    const [a, mx] = await Promise.all([dns.resolve4(domain).catch(() => []), dns.resolveMx(domain).catch(() => [])]);
    if (a.length) out += `A: ${a.slice(0, 8).join(', ')}\n`;
    if (mx.length) out += `MX: ${mx.slice(0, 3).map((m) => m.exchange).join(', ')}\n`;
  } catch (_) {
    out += 'WHOIS/DNS (local) erreur.\n';
  }
  try {
    const ht = await axios.get(`https://api.hackertarget.com/whois/?q=${encodeURIComponent(domain)}`, opts);
    const htText = (ht.data || '').trim();
    if (htText && !htText.toLowerCase().includes('error')) out += '\n**HackerTarget WhoIS (extrait):**\n' + htText.slice(0, 500) + '\n';
  } catch (_) {}
  try {
    const dnsRes = await axios.get(`https://api.hackertarget.com/dnslookup/?q=${encodeURIComponent(domain)}`, opts);
    const dnsText = (dnsRes.data || '').trim();
    if (dnsText && !dnsText.toLowerCase().includes('error')) out += '\n**HackerTarget DNS:**\n' + dnsText.split('\n').slice(0, 15).join('\n') + '\n';
  } catch (_) {}
  try {
    const dnsdumpster = await axios.get(`https://dnsdumpster.com/`, opts);
    const html = (dnsdumpster.data || '').toString();
    if (html.includes(domain)) {
      out += '\n**DNSdumpster** (disponible — voir dnsdumpster.com)\n';
    }
  } catch (_) {}
  try {
    const dnslytics = await axios.get(`https://dnslytics.com/api/v1/domain/${encodeURIComponent(domain)}`, {
      headers: { 'X-API-Key': process.env.DNSLYTICS_API_KEY || '' },
      ...opts
    });
    const dlData = dnslytics.data || {};
    if (dlData.domain) {
      out += '\n**DNSlytics**\n';
      if (dlData.created) out += `Créé: ${dlData.created}\n`;
      if (dlData.registrar) out += `Registrar: ${dlData.registrar}\n`;
    }
  } catch (_) {}
  return out;
}

// ——— Sous-domaines (crt.sh — Certificate Transparency, gratuit) ———
async function fetchSubdomains(domain) {
  const names = new Set();
  try {
    const crt = await axios.get(`https://crt.sh/?q=%.${domain}&output=json`, { timeout: 15000 });
    const arr = Array.isArray(crt.data) ? crt.data : [];
    arr.forEach((c) => {
      const n = c.name_value || '';
      n.split('\n').forEach((s) => {
        const clean = s.trim().toLowerCase();
        if (clean && clean.endsWith(domain)) names.add(clean);
      });
    });
  } catch (_) {}
  try {
    const securitytrails = await axios.get(`https://api.securitytrails.com/v1/domain/${encodeURIComponent(domain)}/subdomains`, {
      headers: { 'APIKEY': process.env.SECURITYTRAILS_API_KEY || '' },
      timeout: REQUEST_TIMEOUT
    }).catch(() => null);
    if (securitytrails?.data?.subdomains && Array.isArray(securitytrails.data.subdomains)) {
      securitytrails.data.subdomains.forEach((s) => {
        const full = `${s}.${domain}`.toLowerCase();
        names.add(full);
      });
    }
  } catch (_) {}
  try {
    const hackertarget = await axios.get(`https://api.hackertarget.com/hostsearch/?q=${encodeURIComponent(domain)}`, { timeout: REQUEST_TIMEOUT });
    const htText = (hackertarget.data || '').trim();
    if (htText && !htText.toLowerCase().includes('error')) {
      htText.split('\n').forEach((line) => {
        const sub = line.split(',')[0]?.trim().toLowerCase();
        if (sub && sub.endsWith(domain)) names.add(sub);
      });
    }
  } catch (_) {}
  const list = [...names].sort();
  if (list.length === 0) return 'Aucun sous-domaine trouvé (crt.sh, SecurityTrails, HackerTarget).';
  return '**Sous-domaines:**\n' + list.slice(0, 80).join('\n') + (list.length > 80 ? `\n… +${list.length - 80}` : '');
}

// ——— Téléphone (NumVerify + AbstractAPI — gratuits limités) ———
async function fetchPhone(phone) {
  const clean = phone.replace(/\D/g, '');
  if (clean.length < 8) return 'Numéro invalide.';
  let out = `**Numéro:** ${clean}\n\n`;
  const opts = { timeout: REQUEST_TIMEOUT };
  try {
    const [numverify, abstract, numlookup] = await Promise.all([
      axios.get('http://apilayer.net/api/validate', { params: { access_key: process.env.NUMVERIFY_API_KEY || 'demo', number: clean, format: 1 }, ...opts }).then((r) => r.data).catch(() => null),
      axios.get(`https://phonevalidation.abstractapi.com/v1/?api_key=${process.env.ABSTRACT_API_KEY || ''}&phone=${clean}`, opts).then((r) => r.data).catch(() => null),
      axios.get(`https://numlookupapi.com/v1/validate/${clean}`, {
        headers: { 'apikey': process.env.NUMLOOKUP_API_KEY || '' },
        ...opts
      }).then((r) => r.data).catch(() => null)
    ]);
    if (numverify) {
      out += `Valide: ${numverify.valid ? 'Oui' : 'Non'}\n`;
      out += `Format int.: ${numverify.international_format || 'N/A'}\n`;
      out += `Pays: ${numverify.country_name || 'N/A'}\n`;
      out += `Opérateur: ${numverify.carrier || 'N/A'}\n`;
      out += `Type: ${numverify.line_type || 'N/A'}\n`;
    }
    if (abstract) {
      out += `\nRéputation: ${abstract.valid ? 'Valide' : 'Suspect'} | Type: ${abstract.type || 'N/A'} | VoIP: ${abstract.is_virtual ? 'Oui' : 'Non'}\n`;
    }
    if (numlookup && numlookup.valid) {
      out += `\n(NumLookup) Pays: ${numlookup.country || 'N/A'} | Opérateur: ${numlookup.carrier || 'N/A'}\n`;
    }
  } catch (_) {
    out += 'APIs téléphone indisponibles.';
  }
  return out;
}

// ——— Intel-X (DB du projet) ———
async function fetchIntel(term) {
  try {
    const { IntelXAPI } = require('./intelx');
    const api = new IntelXAPI();
    let result = null;
    if (term.length === 36 && /^[a-f0-9-]{36}$/i.test(term)) {
      result = await api.searchById(term);
    } else {
      const searchRes = await api.search(term);
      if (searchRes?.id) result = await api.searchById(searchRes.id);
      else result = searchRes;
    }
    const raw = typeof result === 'string' ? result : (result?.content ?? (typeof result === 'object' ? JSON.stringify(result).slice(0, 2000) : String(result)));
    return raw && raw.length ? raw.slice(0, 3000) : 'Aucun résultat Intel-X.';
  } catch (_) {
    return 'Intel-X non configuré ou erreur.';
  }
}

// ——— Pastes (tous gratuits: psbdmp, dumpz, ghostbin) ———
async function fetchPastebin(query) {
  let out = '';
  const opts = { timeout: 15000 };
  const q = encodeURIComponent(query);
  const results = [];
  try {
    const [psb, dumpz, ghost, pastebin] = await Promise.all([
      axios.get('https://psbdmp.ws/api/v3/search', { params: { q: query }, ...opts }).then((r) => (r.data?.data || []).map((p) => ({ ...p, source: 'Psbdmp' }))).catch(() => []),
      axios.get(`https://dumpz.org/api/search?q=${q}`, opts).then((r) => (Array.isArray(r.data?.results) ? r.data.results : []).map((p) => ({ ...p, source: 'Dumpz' }))).catch(() => []),
      axios.get(`https://ghostbin.com/search?q=${q}`, opts).then((r) => (Array.isArray(r.data?.results) ? r.data.results : []).map((p) => ({ ...p, source: 'Ghostbin' }))).catch(() => []),
      axios.get(`https://scrape.pastebin.com/api_scraping.php?limit=100`, opts).then((r) => {
        const pbData = r.data || [];
        return Array.isArray(pbData) ? pbData.filter((p) => (p.title || p.full_url || '').toLowerCase().includes(query.toLowerCase())).slice(0, 10).map((p) => ({ id: p.key, title: p.title, date: p.date, source: 'Pastebin' })) : [];
      }).catch(() => [])
    ]);
    results.push(...psb, ...dumpz, ...ghost, ...pastebin);
  } catch (_) {}
  try {
    const intelPaste = await axios.get(`https://2.intelx.io/phonebook/search?k=${process.env.INTEL_X_API_KEY || ''}&media=0&target=1&term=${q}&maxresults=10`, {
      headers: { 'User-Agent': 'Discord-OSINT-Bot' },
      ...opts
    }).catch(() => null);
    if (intelPaste?.data?.selectors) {
      intelPaste.data.selectors.slice(0, 5).forEach((s) => {
        results.push({ id: s.id || 'N/A', title: s.name || 'N/A', date: s.date || '', source: 'Intel-X Paste' });
      });
    }
  } catch (_) {}
  if (results.length === 0) return 'Aucun paste trouvé (Psbdmp, Dumpz, Ghostbin, Pastebin).';
  results.slice(0, 25).forEach((p, i) => {
    out += `${i + 1}. [${p.source}] ${p.id || p.slug || 'N/A'} | ${(p.title || p.content || '').toString().slice(0, 40)} | ${p.date || ''}\n`;
  });
  if (results.length > 25) out += `… +${results.length - 25} autre(s).\n`;
  return out;
}

// ——— Snusbase (DB du projet) ———
async function fetchSnusbase(query) {
  try {
    const { SnusbaseAPI } = require('./snusbase');
    const api = new SnusbaseAPI();
    let data = null;
    if (query.includes('@')) data = await api.searchEmail(query);
    else if (/^([a-zA-Z0-9\-]+\.)+[a-zA-Z]{2,}$/.test(query)) data = await api.searchAll(query);
    else if (/^\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}$/.test(query)) data = await api.searchIP(query);
    else if (/^[a-fA-F0-9]{32,64}$/.test(query)) data = await api.searchHash(query);
    else data = await api.searchUsername(query);
    const results = data?.results || [];
    if (!results.length) return 'Aucun résultat Snusbase.';
    let out = '';
    results.slice(0, 20).forEach((r, i) => {
      out += `${i + 1}. ${r.username || r.email || 'N/A'} | ${r.email || 'N/A'} | IP: ${r.lastip || 'N/A'} | ${r.database || 'N/A'}\n`;
    });
    if (results.length > 20) out += `… +${results.length - 20} autre(s).\n`;
    return out;
  } catch (_) {
    return 'Snusbase non configuré ou erreur.';
  }
}

// ——— Username Social Search (GitHub, GitLab, etc. — APIs publiques) ———
async function fetchUsernameSocial(query) {
  if (getQueryType(query) === 'email') return '';
  let out = '';
  const opts = { timeout: REQUEST_TIMEOUT, headers: { 'User-Agent': 'Discord-OSINT-Bot' } };
  try {
    const [gh, gl] = await Promise.all([
      axios.get(`https://api.github.com/users/${encodeURIComponent(query)}`, opts).then((r) => r.data).catch(() => null),
      axios.get(`https://gitlab.com/api/v4/users?username=${encodeURIComponent(query)}`, opts).then((r) => {
        const arr = Array.isArray(r.data) ? r.data : [];
        return arr.length ? arr[0] : null;
      }).catch(() => null)
    ]);
    if (gh && gh.login) {
      out += '**GitHub**\n';
      out += `Profil: ${gh.html_url || 'N/A'} | Repos: ${gh.public_repos ?? 'N/A'} | Followers: ${gh.followers ?? 'N/A'}\n`;
      if (gh.name) out += `Nom: ${gh.name} | Bio: ${(gh.bio || '').slice(0, 60)}\n`;
      if (gh.company) out += `Company: ${gh.company}\n`;
      if (gh.location) out += `Location: ${gh.location}\n`;
      out += '\n';
    }
    if (gl && gl.username) {
      out += '**GitLab**\n';
      out += `Profil: ${gl.web_url || 'N/A'} | Projets: ${gl.projects_count || 'N/A'}\n`;
      if (gl.name) out += `Nom: ${gl.name}\n`;
      out += '\n';
    }
  } catch (_) {}
  return out.trim() || '';
}

/**
 * Lance les lookups en parallèle selon le type. Utilise toutes les DB du projet + sources gratuites.
 */
async function runAllLookups(query, queryType) {
  const sections = [];
  const add = (id, name, emoji, content) => {
    const contentPages = chunkText(content);
    if (contentPages.length && contentPages[0] !== '*Aucune donnée*') {
      sections.push({ id, name, emoji, contentPages });
    }
  };

  const originalQueryType = queryType;
  if (queryType === 'discord_id') queryType = 'username';

  if (queryType === 'email' || queryType === 'username') {
    const [breach, intel, paste, snus, social] = await Promise.all([
      fetchBreach(query),
      fetchIntel(query),
      fetchPastebin(query),
      fetchSnusbase(query),
      fetchUsernameSocial(query)
    ]);
    add('breach', 'Fuites (HIBP, Snusbase, NazAPI, LeakCheck, BreachDirectory, WeLeakInfo, Leak-Lookup, SkidSearch, Hunter, EmailRep)', EMB.alerte, breach);
    add('intel', 'Intel-X', EMOJIS.BUG, intel);
    add('pastebin', 'Pastes (Psbdmp, Dumpz, Ghostbin, Pastebin, Intel-X)', EMB.fichier, paste);
    add('snusbase', 'Snusbase', EMOJIS.STATS, snus);
    if (social) add('social', 'Réseaux (GitHub, GitLab)', EMOJIS.USER, social);
  }

  if (queryType === 'ip') {
    const [geo, vpn, reverse, internetdb, abuseipdb, robtexIp] = await Promise.all([
      fetchGeoIP(query),
      fetchVPN(query),
      fetchReverseIP(query),
      fetchShodanInternetDB(query),
      fetchAbuseIPDB(query),
      fetchRobtexIP(query)
    ]);
    add('geoip', 'Géo IP (ip-api, ipwhois, ipinfo, IPHub, ipapi.co, ipgeolocation, IPStack)', EMOJIS.WIFI, geo);
    add('vpn', 'VPN / Proxy (IPHub)', EMOJIS.PROTECT, vpn);
    add('reverseip', 'Reverse IP (HackerTarget, ViewDNS)', EMB.fleche, reverse);
    add('internetdb', 'Shodan InternetDB (ports, vulns)', EMOJIS.PROTECT, internetdb);
    if (abuseipdb) add('abuseipdb', 'AbuseIPDB (réputation)', EMB.alerte, abuseipdb);
    if (robtexIp) add('robtex', 'Robtex (passive DNS, liste)', EMB.fleche, robtexIp);
  }

  if (queryType === 'domain') {
    const [who, subdomains, intel, urlscan, robtexDom] = await Promise.all([
      fetchWhois(query),
      fetchSubdomains(query),
      fetchIntel(query),
      fetchUrlscan(query),
      fetchRobtexDomain(query)
    ]);
    add('whois', 'WHOIS & DNS (local + HackerTarget, DNSdumpster, DNSlytics)', EMOJIS.FOLDER, who);
    add('subdomains', 'Sous-domaines (crt.sh, SecurityTrails, HackerTarget)', EMOJIS.PROTECT, subdomains);
    add('intel', 'Intel-X', EMOJIS.BUG, intel);
    if (urlscan && !urlscan.includes('indisponible')) add('urlscan', 'urlscan.io (scans)', EMOJIS.BUG, urlscan);
    if (robtexDom) add('robtex', 'Robtex (Passive DNS)', EMB.fleche, robtexDom);
  }

  if (queryType === 'phone') {
    const [phone, nazPhone] = await Promise.all([
      fetchPhone(query),
      (async () => {
        try {
          const config = require('../config.json');
          if (config?.APIS?.NAZAPI?.API_KEY) {
            const { NazAPI } = require('./nazapi');
            const naz = new NazAPI();
            const data = await naz.searchPhone(query.replace(/\D/g, ''));
            const results = data?.results || [];
            if (!results.length) return '';
            return '**NazAPI**\n' + results.slice(0, 10).map((r, i) => `${i + 1}. ${r.phone || r.email || 'N/A'} | ${r.source || ''}`).join('\n');
          }
        } catch (_) {}
        return '';
      })()
    ]);
    add('phone', 'Téléphone (NumVerify, AbstractAPI, NumLookup)', EMOJIS.NOTIF, phone);
    if (nazPhone) add('nazapi_phone', 'NazAPI (téléphone)', EMOJIS.NOTIF, nazPhone);
  }

  if (sections.length === 0) {
    sections.push({
      id: 'none',
      name: 'Aucun résultat',
      emoji: '<a:_:1483497365863399536>',
      contentPages: ['Aucune donnée trouvée. Vérifiez la requête ou les APIs (clés optionnelles).']
    });
  }

  return { sections, queryType: originalQueryType };
}

module.exports = {
  getQueryType,
  runAllLookups,
  chunkText
};
