const db = require('./simpledb');
const Casino = require('./casino');


const JOB_DEF_KEY = (name) => `casino_jobdef_${name.toLowerCase()}`;
const JOB_LIST_KEY = `casino_jobdef_list`;
const USER_JOB_KEY = (uid) => `casino_user_job_${uid}`;
const USER_JOB_CHANGE_AT = (uid) => `casino_user_job_change_${uid}`;
const SKILL_KEY = (uid) => `casino_user_skills_${uid}`;
const SKILL_XP_KEY = (uid, skill) => `casino_user_skill_xp_${uid}_${skill}`;


const DEFAULT_JOBS = [
{ name: 'banquier', dailyMin: 1500, dailyMax: 1500, skill: 'gestion', bonus: 'bj_plus_1', desc: '+1% gains blackjack' },
{ name: 'croupier', dailyMin: 1000, dailyMax: 1000, skill: 'chance', bonus: 'edge_reduced', desc: 'Réduction house edge' },
{ name: 'ouvrier', dailyMin: 800, dailyMax: 800, skill: 'endurance', bonus: 'more_xp', desc: '+XP sur les jeux' },
{ name: 'voleur', dailyMin: 1200, dailyMax: 1200, skill: 'dexterite', bonus: 'steal', desc: 'Peut tenter des vols' },
{ name: 'hacker', dailyMin: 1000, dailyMax: 1000, skill: 'intelligence', bonus: 'exploit', desc: 'Peut tenter des exploits' },
{ name: 'alchimiste', dailyMin: 900, dailyMax: 900, skill: 'alchimie', bonus: 'potions', desc: 'Peut créer des potions bonus' },
{ name: 'marchand', dailyMin: 800, dailyMax: 800, skill: 'negoce', bonus: 'discount_shop', desc: 'Réductions dans le shop' }];


function ensureDefaults() {
  let list = db.get(JOB_LIST_KEY);
  if (!Array.isArray(list) || list.length === 0) {
    list = [];
    for (const j of DEFAULT_JOBS) {
      db.set(JOB_DEF_KEY(j.name), j);
      list.push(j.name);
    }
    db.set(JOB_LIST_KEY, list);
  }
}

function listJobs() {
  ensureDefaults();
  const names = db.get(JOB_LIST_KEY) || [];
  return names.map((n) => db.get(JOB_DEF_KEY(n))).filter(Boolean);
}

function getJob(name) {
  if (!name) return null;
  return db.get(JOB_DEF_KEY(String(name).toLowerCase())) || null;
}

function createJob(def) {
  ensureDefaults();
  const name = String(def?.name || '').toLowerCase();
  if (!name) return { ok: false, error: 'Nom requis' };
  if (db.get(JOB_DEF_KEY(name))) return { ok: false, error: 'Existe déjà' };
  const normalized = {
    name,
    dailyMin: Math.max(0, parseInt(def.dailyMin || 0, 10)),
    dailyMax: Math.max(0, parseInt(def.dailyMax || 0, 10)),
    skill: String(def.skill || '').toLowerCase() || 'metier',
    bonus: String(def.bonus || '') || '',
    desc: def.desc || ''
  };
  db.set(JOB_DEF_KEY(name), normalized);
  const list = db.get(JOB_LIST_KEY) || [];
  list.push(name);
  db.set(JOB_LIST_KEY, list);
  return { ok: true, job: normalized };
}

function deleteJob(name) {
  const key = JOB_DEF_KEY(name);
  if (!db.get(key)) return false;
  db.delete(key);
  const list = (db.get(JOB_LIST_KEY) || []).filter((n) => n !== String(name).toLowerCase());
  db.set(JOB_LIST_KEY, list);
  return true;
}

function getUserJob(uid) {
  return db.get(USER_JOB_KEY(uid)) || null;
}

function setUserJob(uid, name) {
  const job = getJob(name);
  if (!job) return { ok: false, error: 'Métier introuvable' };
  const now = Date.now();
  db.set(USER_JOB_KEY(uid), { name: job.name, since: now, lastWorkAt: 0 });
  db.set(USER_JOB_CHANGE_AT(uid), now);
  return { ok: true, job };
}

function canChangeJob(uid, days = 7) {
  const last = db.get(USER_JOB_CHANGE_AT(uid)) || 0;
  const next = last + days * 24 * 60 * 60 * 1000;
  const rem = Math.max(0, next - Date.now());
  return { ok: rem === 0, remaining: rem };
}

function getSkills(uid) {
  return db.get(SKILL_KEY(uid)) || {};
}

function setSkillLevel(uid, skill, level) {
  const lv = Math.max(1, Math.min(100, parseInt(level || 1, 10)));
  const s = getSkills(uid);
  s[String(skill).toLowerCase()] = lv;
  db.set(SKILL_KEY(uid), s);
  return lv;
}

function getSkillLevel(uid, skill) {
  const s = getSkills(uid);
  return s[String(skill).toLowerCase()] || 1;
}

function addSkillXp(uid, skill, xp) {
  const key = SKILL_XP_KEY(uid, String(skill).toLowerCase());
  const cur = db.get(key) || 0;
  const total = cur + Math.max(0, parseInt(xp || 0, 10));
  db.set(key, total);

  const newLevel = Math.min(100, Math.floor(total / 100) + 1);
  setSkillLevel(uid, skill, newLevel);
  return { xp: total, level: newLevel };
}

function work(uid) {
  const uj = getUserJob(uid);
  if (!uj) return { ok: false, error: 'Aucun métier choisi' };
  const job = getJob(uj.name);
  if (!job) return { ok: false, error: 'Métier invalide' };
  const now = Date.now();
  const last = uj.lastWorkAt || 0;
  const oneDay = 24 * 60 * 60 * 1000;
  if (now - last < oneDay) {
    return { ok: false, error: 'Déjà travaillé. Reviens demain.' };
  }

  const min = Math.min(job.dailyMin, job.dailyMax);
  const max = Math.max(job.dailyMin, job.dailyMax);
  let reward = Math.floor(min + Math.random() * (max - min + 1));

  if (Math.random() < 0.10) reward *= 2;

  if (Math.random() < 0.05) reward = 0;


  addSkillXp(uid, job.skill, 10 + Math.floor(reward / 100));


  Casino.addCasinoCredits(uid, reward);
  uj.lastWorkAt = now;
  db.set(USER_JOB_KEY(uid), uj);
  return { ok: true, reward, job };
}

module.exports = {
  listJobs,
  getJob,
  createJob,
  deleteJob,
  getUserJob,
  setUserJob,
  canChangeJob,
  getSkills,
  setSkillLevel,
  getSkillLevel,
  addSkillXp,
  work
};
