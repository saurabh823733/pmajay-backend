// src/recommendationEngine.js
// Single source of truth for profiling + NSQF trade recommendation.
// Used identically by the web app, IVR webhook, and WhatsApp webhook —
// this is the core reason a multi-channel assistant stays maintainable.

const TRADES = [
  { id: 'retail',  name: 'Retail Sales Associate',            sector: 'Retail',          nsqf: 4, dur: '2 months',   kw: ['shop','sale','market','dukan','vyapar','customer'], home: false, selfemp: false },
  { id: 'beauty',  name: 'Beauty & Wellness (Beautician)',    sector: 'Beauty & Wellness', nsqf: 4, dur: '3 months',  kw: ['beauty','salon','makeup','wellness','hair'], home: true, selfemp: true },
  { id: 'electric',name: 'Electrician / Solar Technician',    sector: 'Power',            nsqf: 4, dur: '3 months',  kw: ['electric','wiring','solar','repair','bijli'], home: false, selfemp: true },
  { id: 'plumb',   name: 'Plumbing Technician',               sector: 'Construction',     nsqf: 3, dur: '2 months',  kw: ['plumb','pipe','water','nal'], home: false, selfemp: true },
  { id: 'tailor',  name: 'Sewing Machine Operator / Tailoring',sector: 'Apparel',         nsqf: 3, dur: '2 months',  kw: ['tailor','stitch','sew','silai','cloth','embroid'], home: true, selfemp: true },
  { id: 'food',    name: 'Food Processing & Bakery',          sector: 'Food Processing',  nsqf: 4, dur: '2 months',  kw: ['cook','food','bakery','khana','catering'], home: true, selfemp: true },
  { id: 'agri',    name: 'Agri-Entrepreneurship / Dairy',     sector: 'Agriculture',      nsqf: 3, dur: '1.5 months',kw: ['farm','agri','kheti','dairy','animal','crop'], home: true, selfemp: true },
  { id: 'constr',  name: 'Construction — Mason / Bar Bender', sector: 'Construction',     nsqf: 3, dur: '2 months',  kw: ['construction','mason','building','labour','naya ghar'], home: false, selfemp: false },
  { id: 'ites',    name: 'IT-ITES — Data Entry / BPO',        sector: 'IT-ITeS',          nsqf: 4, dur: '3 months',  kw: ['computer','typing','digital','data','internet'], home: false, selfemp: false },
  { id: 'health',  name: 'General Duty Assistant (Healthcare)',sector: 'Healthcare',      nsqf: 4, dur: '3 months',  kw: ['health','care','hospital','nurse','patient'], home: false, selfemp: false },
  { id: 'craft',   name: 'Traditional Craft Upgradation',     sector: 'Handicrafts',      nsqf: 3, dur: '1.5 months',kw: ['craft','weav','handicraft','artisan','pottery','traditional'], home: true, selfemp: true },
  { id: 'driver',  name: 'Light/Heavy Vehicle Driving',       sector: 'Logistics',        nsqf: 3, dur: '1 month',   kw: ['drive','driving','vehicle','transport'], home: false, selfemp: true }
];

// Fields collected in order, same across all channels
const FIELDS = ['name_loc', 'education', 'family_occ', 'current_work', 'interest', 'mobility', 'emp_pref'];

function scoreTrades(answers) {
  const blob = `${answers.family_occ || ''} ${answers.current_work || ''} ${answers.interest || ''}`.toLowerCase();
  const lowMobility = /can't|cannot|nahi|difficult|hard|disab|old|health issue|problem/i.test(answers.mobility || '');
  const wantsSelf = /self|khud|swayam|swarozgar|own business|apna|swarojgar/i.test(answers.emp_pref || '');

  return TRADES.map(t => {
    let s = 0;
    t.kw.forEach(k => { if (blob.includes(k)) s += 3; });
    if (lowMobility && t.home) s += 2;
    if (wantsSelf && t.selfemp) s += 2;
    if (!wantsSelf && !t.selfemp) s += 1;
    s += Math.random() * 0.3; // tie-break, deterministic seeding can replace this in production
    return { ...t, score: s };
  }).sort((a, b) => b.score - a.score).slice(0, 3);
}

function nsqfEntryLevel(education = '') {
  const e = education.toLowerCase();
  if (/no formal|unedu|ashiksh|illiterate/.test(e)) return 'NSQF Level 1-2 (Bridge/RPL course recommended first)';
  if (/8|10th|10वीं/.test(e)) return 'NSQF Level 3 eligible';
  if (/12|graduate|स्नातक/.test(e)) return 'NSQF Level 4-5 eligible';
  return 'NSQF Level 3 eligible';
}

function buildRecommendation(answers) {
  const top3 = scoreTrades(answers);
  return {
    profile: { name_loc: answers.name_loc, education: answers.education },
    nsqfNote: nsqfEntryLevel(answers.education),
    preference: /self|khud|apna|swarojgar/i.test(answers.emp_pref || '') ? 'Self-employment' : 'Wage employment',
    recommendations: top3.map(t => ({
      name: t.name, sector: t.sector, nsqfLevel: t.nsqf, duration: t.dur,
      homeBased: t.home, selfEmploymentFit: t.selfemp
    }))
  };
}

module.exports = { TRADES, FIELDS, scoreTrades, nsqfEntryLevel, buildRecommendation };
