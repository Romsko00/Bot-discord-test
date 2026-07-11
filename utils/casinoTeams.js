const db = require('./simpledb');
const Casino = require('./casino');


const TEAM_KEY = (teamId) => `casino_team_${teamId}`;
const TEAM_OF_USER = (userId) => `casino_team_of_${userId}`;
const TEAM_NAME_INDEX = (guildId, nameLower) => `casino_team_name_${guildId}_${nameLower}`;
const TEAM_TAG_INDEX = (guildId, tagLower) => `casino_team_tag_${guildId}_${tagLower}`;
const TEAM_COUNTER = (guildId) => `casino_team_counter_${guildId}`;
const INVITE_KEY = (userId) => `casino_team_inv_${userId}`;


const CFG_MAX_MEMBERS = (guildId) => `casino_team_cfg_maxmembers_${guildId}`;
const CFG_CREATION_COST = (guildId) => `casino_team_cfg_creation_cost_${guildId}`;
const CFG_COOLDOWN_LEAVE_DAYS = (guildId) => `casino_team_cfg_cooldown_days_${guildId}`;
const CFG_MAX_TEAMS = (guildId) => `casino_team_cfg_maxteams_${guildId}`;
const LEAVE_AT_KEY = (userId) => `casino_team_leave_at_${userId}`;

function now() {return Date.now();}

function getConfig(guildId) {
  return {
    maxMembers: db.get(CFG_MAX_MEMBERS(guildId)) || 20,
    creationCost: db.get(CFG_CREATION_COST(guildId)) || 10000,
    cooldownLeaveDays: db.get(CFG_COOLDOWN_LEAVE_DAYS(guildId)) || 7,
    maxTeams: db.get(CFG_MAX_TEAMS(guildId)) || 0
  };
}

function setConfig(guildId, patch) {
  if (patch.maxMembers != null) db.set(CFG_MAX_MEMBERS(guildId), Number(patch.maxMembers));
  if (patch.creationCost != null) db.set(CFG_CREATION_COST(guildId), Number(patch.creationCost));
  if (patch.cooldownLeaveDays != null) db.set(CFG_COOLDOWN_LEAVE_DAYS(guildId), Number(patch.cooldownLeaveDays));
  if (patch.maxTeams != null) db.set(CFG_MAX_TEAMS(guildId), Number(patch.maxTeams));
}

function genTeamId(guildId) {
  const n = (db.get(TEAM_COUNTER(guildId)) || 0) + 1;
  db.set(TEAM_COUNTER(guildId), n);
  return `${guildId}-${n}`;
}

function getTeam(teamId) {
  return db.get(TEAM_KEY(teamId)) || null;
}

function saveTeam(team) {
  db.set(TEAM_KEY(team.id), team);
}

function getUserTeamId(userId) {
  return db.get(TEAM_OF_USER(userId)) || null;
}

function setUserTeam(userId, teamId) {
  if (!teamId) db.delete(TEAM_OF_USER(userId));else
  db.set(TEAM_OF_USER(userId), teamId);
}

function isNameAvailable(guildId, name) {
  const key = TEAM_NAME_INDEX(guildId, String(name).toLowerCase());
  return !db.get(key);
}

function isTagAvailable(guildId, tag) {
  if (!tag) return true;
  const key = TEAM_TAG_INDEX(guildId, String(tag).toLowerCase());
  return !db.get(key);
}

function reserveName(guildId, teamId, name) {
  db.set(TEAM_NAME_INDEX(guildId, String(name).toLowerCase()), teamId);
}

function releaseName(guildId, name) {
  db.delete(TEAM_NAME_INDEX(guildId, String(name).toLowerCase()));
}

function reserveTag(guildId, teamId, tag) {
  if (!tag) return;
  db.set(TEAM_TAG_INDEX(guildId, String(tag).toLowerCase()), teamId);
}

function releaseTag(guildId, tag) {
  if (!tag) return;
  db.delete(TEAM_TAG_INDEX(guildId, String(tag).toLowerCase()));
}

function createTeam({ guildId, leaderId, name, tag }) {
  const cfg = getConfig(guildId);

  const lastLeave = db.get(LEAVE_AT_KEY(leaderId)) || 0;
  if (cfg.cooldownLeaveDays > 0 && lastLeave) {
    const remain = lastLeave + cfg.cooldownLeaveDays * 24 * 60 * 60 * 1000 - now();
    if (remain > 0) return { ok: false, error: 'Tu dois attendre avant de rejoindre/créer une team à nouveau.' };
  }

  const currentTeams = listTeams(guildId).length;
  if (cfg.maxTeams > 0 && currentTeams >= cfg.maxTeams) {
    return { ok: false, error: 'Nombre maximum de teams atteint sur ce serveur.' };
  }
  if (!isNameAvailable(guildId, name)) return { ok: false, error: 'Nom déjà pris' };
  if (!isTagAvailable(guildId, tag)) return { ok: false, error: 'Tag déjà pris' };
  const id = genTeamId(guildId);
  const t = {
    id,
    guildId,
    name,
    tag: tag || null,
    leaderId,
    officers: [],
    members: [leaderId],
    bank: 0,
    payroll: 0,
    createdAt: now(),
    customize: { banner: null, thumb: null, color: null, desc: '', emoji: null, tag: tag || null, visibility: 'public' },
    xp: 0,
    logs: [],
    lastPayrollAt: 0
  };
  saveTeam(t);
  setUserTeam(leaderId, id);
  reserveName(guildId, id, name);
  reserveTag(guildId, id, tag);
  logTeam(t, 'create', { by: leaderId });
  return { ok: true, team: t };
}

function deleteTeam(teamId) {
  const t = getTeam(teamId);
  if (!t) return false;
  releaseName(t.guildId, t.name);
  releaseTag(t.guildId, t.tag);
  for (const uid of t.members || []) setUserTeam(uid, null);
  db.delete(TEAM_KEY(teamId));
  return true;
}

function logTeam(team, type, extra) {
  const entry = { ts: now(), type, ...(extra || {}) };
  team.logs = [entry, ...(team.logs || [])].slice(0, 200);
  saveTeam(team);
}

function canManage(team, userId) {
  return team.leaderId === userId || (team.officers || []).includes(userId);
}

function isLeader(team, userId) {return team.leaderId === userId;}

function hasMember(team, userId) {return (team.members || []).includes(userId);}

function addMember(team, userId) {
  if (!hasMember(team, userId)) team.members.push(userId);
  saveTeam(team);
}

function removeMember(team, userId) {
  team.members = (team.members || []).filter((u) => u !== userId);
  team.officers = (team.officers || []).filter((u) => u !== userId);
  if (team.leaderId === userId) team.leaderId = null;
  saveTeam(team);
}

function inviteUser(team, inviterId, userId, minutes = 10) {
  const expiresAt = now() + minutes * 60 * 1000;
  db.set(INVITE_KEY(userId), { teamId: team.id, invitedBy: inviterId, expiresAt });
  logTeam(team, 'invite', { by: inviterId, userId });
  return { teamId: team.id, invitedBy: inviterId, expiresAt };
}

function getInvite(userId) {
  const inv = db.get(INVITE_KEY(userId));
  if (!inv) return null;
  if (inv.expiresAt && inv.expiresAt < now()) {db.delete(INVITE_KEY(userId));return null;}
  return inv;
}

function acceptInvite(userId) {
  const inv = getInvite(userId);
  if (!inv) return { ok: false, error: 'Aucune invitation active.' };
  db.delete(INVITE_KEY(userId));
  const team = getTeam(inv.teamId);
  if (!team) return { ok: false, error: 'Team introuvable.' };
  const cfg = getConfig(team.guildId);

  const lastLeave = db.get(LEAVE_AT_KEY(userId)) || 0;
  if (cfg.cooldownLeaveDays > 0 && lastLeave) {
    const remain = lastLeave + cfg.cooldownLeaveDays * 24 * 60 * 60 * 1000 - now();
    if (remain > 0) return { ok: false, error: 'Tu dois attendre avant de rejoindre une team.' };
  }
  if ((team.members || []).length >= cfg.maxMembers) return { ok: false, error: 'Team pleine.' };
  if (getUserTeamId(userId)) return { ok: false, error: 'Déjà dans une team.' };
  addMember(team, userId);
  setUserTeam(userId, team.id);
  logTeam(team, 'join', { userId, via: 'invite' });
  return { ok: true, team };
}

function leaveTeam(userId) {
  const teamId = getUserTeamId(userId);
  if (!teamId) return { ok: false, error: 'Aucune team.' };
  const team = getTeam(teamId);
  if (!team) {setUserTeam(userId, null);return { ok: true };}
  if (team.leaderId === userId) return { ok: false, error: 'Leader doit transférer ou dissoudre.' };
  removeMember(team, userId);
  setUserTeam(userId, null);

  db.set(LEAVE_AT_KEY(userId), now());
  logTeam(team, 'leave', { userId });
  return { ok: true, team };
}

function kickMember(team, byId, userId) {
  if (!canManage(team, byId)) return { ok: false, error: 'Permission insuffisante.' };
  if (!hasMember(team, userId)) return { ok: false, error: 'Membre introuvable.' };
  if (userId === team.leaderId) return { ok: false, error: 'Impossible de kick le leader.' };
  removeMember(team, userId);
  setUserTeam(userId, null);
  logTeam(team, 'kick', { by: byId, userId });
  return { ok: true };
}

function promoteLeader(team, byId, userId) {
  if (team.leaderId !== byId) return { ok: false, error: 'Seul le leader peut promouvoir.' };
  if (!hasMember(team, userId)) return { ok: false, error: 'Membre introuvable.' };
  team.leaderId = userId;
  saveTeam(team);
  logTeam(team, 'promote', { by: byId, userId });
  return { ok: true };
}

function addOfficer(team, byId, userId) {
  if (team.leaderId !== byId) return { ok: false, error: 'Seul le leader peut gérer les officiers.' };
  if (!hasMember(team, userId)) return { ok: false, error: 'L\'utilisateur doit être membre.' };
  team.officers = Array.isArray(team.officers) ? team.officers : [];
  if (team.officers.includes(userId)) return { ok: false, error: 'Déjà officier.' };
  if (userId === team.leaderId) return { ok: false, error: 'Le leader est déjà au sommet.' };
  team.officers.push(userId);
  saveTeam(team);
  logTeam(team, 'officer_add', { by: byId, userId });
  return { ok: true };
}

function removeOfficer(team, byId, userId) {
  if (team.leaderId !== byId) return { ok: false, error: 'Seul le leader peut gérer les officiers.' };
  team.officers = Array.isArray(team.officers) ? team.officers : [];
  if (!team.officers.includes(userId)) return { ok: false, error: 'N\'est pas officier.' };
  team.officers = team.officers.filter((u) => u !== userId);
  saveTeam(team);
  logTeam(team, 'officer_remove', { by: byId, userId });
  return { ok: true };
}

function disbandTeam(team, byId) {
  if (team.leaderId !== byId) return { ok: false, error: 'Seul le leader peut dissoudre.' };
  const ok = deleteTeam(team.id);
  return { ok };
}

function setPayroll(team, byId, amount) {
  if (!isLeader(team, byId)) return { ok: false, error: 'Seul le leader.' };
  const a = Math.max(0, Math.floor(Number(amount) || 0));
  team.payroll = a;
  saveTeam(team);
  logTeam(team, 'payroll_set', { by: byId, amount: a });
  return { ok: true, amount: a };
}

function deposit(team, userId, amount) {
  const a = Math.max(1, Math.floor(Number(amount) || 0));
  if (!hasMember(team, userId)) return { ok: false, error: 'Pas dans la team.' };
  if (!Casino.hasEnoughCasino(userId, a)) return { ok: false, error: 'Fonds personnels insuffisants.' };
  Casino.deductCasinoCredits(userId, a);
  team.bank = (team.bank || 0) + a;
  saveTeam(team);
  logTeam(team, 'bank_deposit', { by: userId, amount: a });
  return { ok: true, bank: team.bank };
}

function withdraw(team, byId, amount) {
  if (!isLeader(team, byId)) return { ok: false, error: 'Leader uniquement.' };
  const a = Math.max(1, Math.floor(Number(amount) || 0));
  if ((team.bank || 0) < a) return { ok: false, error: 'Fonds team insuffisants.' };
  team.bank = (team.bank || 0) - a;
  Casino.addCasinoCredits(byId, a);
  saveTeam(team);
  logTeam(team, 'bank_withdraw', { by: byId, amount: a });
  return { ok: true, bank: team.bank };
}

function addXp(team, amount) {
  const a = Math.max(0, Math.floor(Number(amount) || 0));
  team.xp = (team.xp || 0) + a;
  saveTeam(team);
}

function grantActivityXp(userId, context) {
  const teamId = getUserTeamId(userId);
  if (!teamId) return;
  const team = getTeam(teamId);
  if (!team) return;

  const base = Math.max(1, Math.floor((context.bet || 0) / 50));
  const winBonus = context.win ? 2 : 0;
  addXp(team, base + winBonus);
}

function listTeams(guildId) {
  const all = db.all();
  const res = [];
  for (const row of all) {
    if (!row.ID.startsWith('casino_team_')) continue;
    const t = row.data;
    if (t.guildId === guildId) res.push(t);
  }
  return res;
}

function topTeams(guildId, by = 'bank') {
  const list = listTeams(guildId);
  const sorters = {
    bank: (a, b) => (b.bank || 0) - (a.bank || 0),
    members: (a, b) => (b.members?.length || 0) - (a.members?.length || 0),
    xp: (a, b) => (b.xp || 0) - (a.xp || 0)
  };
  list.sort(sorters[by] || sorters.bank);
  return list.slice(0, 10);
}

function customize(team, byId, patch) {
  if (!canManage(team, byId)) return { ok: false, error: 'Permission insuffisante.' };

  const isImgUrl = (u) => typeof u === 'string' && /^https?:\/\//i.test(u) && /(\.png|\.jpg|\.jpeg|\.gif|\.webp|\.bmp)(\?|#|$)/i.test(u);
  if (patch?.banner != null && patch.banner && !isImgUrl(patch.banner)) return { ok: false, error: 'URL bannière invalide.' };
  if (patch?.thumb != null && patch.thumb && !isImgUrl(patch.thumb)) return { ok: false, error: 'URL miniature invalide.' };
  if (patch?.color != null && patch.color) {
    const c = String(patch.color).trim();
    const hex = c.startsWith('#') ? c.slice(1) : c;
    if (!/^[0-9a-fA-F]{3}([0-9a-fA-F]{3})?$/.test(hex)) return { ok: false, error: 'Couleur invalide (hex attendu).' };
  }
  if (patch?.tag != null && patch.tag) {
    const t = String(patch.tag).toUpperCase();
    if (!/^[A-Z0-9]{2,6}$/.test(t)) return { ok: false, error: 'Tag invalide (2-6 caractères alphanumériques).' };
  }
  team.customize = Object.assign({}, team.customize || {}, patch || {});
  if (patch?.tag != null) {

    releaseTag(team.guildId, team.tag);
    if (!isTagAvailable(team.guildId, patch.tag)) return { ok: false, error: 'Tag déjà pris' };
    team.tag = patch.tag;
    reserveTag(team.guildId, team.id, patch.tag);
  }
  saveTeam(team);
  logTeam(team, 'customize', { by: byId, patch });
  return { ok: true, team };
}

module.exports = {
  getConfig,
  setConfig,
  createTeam,
  deleteTeam,
  getTeam,
  saveTeam,
  getUserTeamId,
  setUserTeam,
  isNameAvailable,
  isTagAvailable,
  inviteUser,
  getInvite,
  acceptInvite,
  leaveTeam,
  kickMember,
  promoteLeader,
  addOfficer,
  removeOfficer,
  disbandTeam,
  canManage,
  setPayroll,
  deposit,
  withdraw,
  grantActivityXp,
  listTeams,
  topTeams,
  customize
};
