const http = require('http'), fs = require('fs'), path = require('path'), crypto = require('crypto'), zlib = require('zlib');
const { WebSocketServer } = require('ws');
const PORT = process.env.PORT || 3000;
const ADMIN = process.env.ADMIN_PASSWORD || 'MG-4kZ9-Rw27'; // поменяй через ADMIN_PASSWORD
const DIR = __dirname, DB_FILE = path.join(DIR, 'data.json'), UP = path.join(DIR, 'uploads');
fs.mkdirSync(UP, { recursive: true });
let db = { ops: [], opsess: {}, users: {}, msgs: [], chats: [], sessions: {}, nextId: 1, uid: 1000, gifts: [], catalog: null, nfts: [], appeals: [], logs: [], reports: [], domains: [], auctions: [] };
try { db = Object.assign(db, JSON.parse(fs.readFileSync(DB_FILE))); } catch {}
const BADGES = ['gem', 'star', 'crown', 'bolt'], BOT = 'sixsevenbot', SUP = 'minigram_support', SUP_PHONE = '+4277', SUP_NAME = 'Поддержка MiniGram';
const DEF = { heart: ['Сердце', 30, 0], cake: ['Торт', 80, 0], rocket: ['Ракета', 100, 0], trophy: ['Кубок', 300, 0], crown: ['Корона', 500, 100], diamond: ['Алмаз', 1000, 50] };
const rc = () => crypto.randomBytes(6).toString('hex'), low = s => String(s || '').toLowerCase();
if (!db.catalog) { db.catalog = {}; for (const [id, [n, p, s]] of Object.entries(DEF)) db.catalog[id] = { n, p, s, sold: (db.sold && db.sold[id]) || 0, img: '/a/g-' + id + '.png' }; }
if (db.groups) { for (const g of db.groups) db.chats.push({ id: g.id, type: 'group', title: g.name, desc: '', username: null, private: true, invite: rc(), approval: false, owner: g.owner, admins: [g.owner], members: Object.keys(db.users), prefixes: {}, requests: [] }); delete db.groups; }
const mkChat = o => Object.assign({ desc: '', username: null, private: false, invite: rc(), approval: false, owner: null, admins: [], members: [], prefixes: {}, requests: [], paid: false, price: 0, payReact: false, balance: 0, comments: true }, o);
if (!db.chats.some(c => c.id === 'general')) db.chats.push(mkChat({ id: 'general', type: 'group', title: 'MiniGram', desc: 'Официальный чат MiniGram', username: 'minigramchat', official: true, verified: true }));
if (!db.chats.some(c => c.id === 'official')) db.chats.push(mkChat({ id: 'official', type: 'channel', title: 'MiniGram', desc: 'Официальный канал MiniGram', username: 'minigram', official: true, verified: true }));
const COMMISSION = 0.05, ANTISNIPE = process.env.ANTISNIPE_MS !== undefined ? Number(process.env.ANTISNIPE_MS) : 3 * 60e3;
const defBackdrops = () => [
  { id: 'black', n: 'Чёрный', c1: '#3a3a42', c2: '#08080a', w: 8 }, { id: 'pearl', n: 'Жемчужный', c1: '#ffffff', c2: '#c3cbdb', w: 60 },
  { id: 'green', n: 'Зелёный', c1: '#7be8a8', c2: '#1d9a60', w: 110 }, { id: 'blue', n: 'Синий', c1: '#74b9ff', c2: '#2563d6', w: 120 },
  { id: 'yellow', n: 'Жёлтый', c1: '#ffe27a', c2: '#e0a21a', w: 100 }, { id: 'orange', n: 'Оранжевый', c1: '#ffb27a', c2: '#e0661c', w: 100 },
  { id: 'pink', n: 'Розовый', c1: '#ff9ec7', c2: '#d63a82', w: 100 }, { id: 'red', n: 'Красный', c1: '#ff7b7b', c2: '#b81d2a', w: 70 },
  { id: 'purple', n: 'Фиолетовый', c1: '#b78cff', c2: '#5a2de0', w: 70 }, { id: 'teal', n: 'Бирюзовый', c1: '#6ff0e0', c2: '#14958a', w: 60 },
  { id: 'lime', n: 'Лаймовый', c1: '#d4f26f', c2: '#7da31a', w: 40 }, { id: 'brown', n: 'Коричневый', c1: '#c99a6b', c2: '#6b4423', w: 30 },
  { id: 'graphite', n: 'Графитовый', c1: '#9aa3b6', c2: '#3d4558', w: 25 }, { id: 'indigo', n: 'Индиго', c1: '#8a9cff', c2: '#2b3aa8', w: 60 },
  { id: 'coral', n: 'Коралловый', c1: '#ffa08a', c2: '#d6452c', w: 55 }];
const defPatterns = () => [['dots', 'Точки', 200], ['stars', 'Звёзды', 160], ['diamonds', 'Ромбы', 140], ['hearts', 'Сердца', 120], ['rings', 'Кольца', 100], ['crosses', 'Крестики', 80], ['waves', 'Волны', 70], ['flowers', 'Цветы', 60], ['snow', 'Снежинки', 40], ['bolts', 'Молнии', 30]].map(([id, n, w]) => ({ id, n, w, url: '/a/p-' + id + '.png' }));
if (!db.backdrops) db.backdrops = defBackdrops();
if (!db.patterns) db.patterns = defPatterns();
if (!db.verifs) db.verifs = [];
for (const g of Object.values(db.catalog)) { if (g.on === undefined) g.on = true; if (!g.up) g.up = { enabled: true, cost: 50, name: g.n, models: [], count: 0 }; }
for (const x of db.gifts) { if (x.listed === undefined) x.listed = 0; if (x.note === undefined) x.note = ''; if (!x.up) x.up = null; }
for (const x of db.nfts) { if (!x.ts) x.ts = Date.now(); if (x.gram && !x.ton) x.ton = x.gram; delete x.gram; }
for (const u of Object.values(db.users)) { if (Array.isArray(u.numbers)) for (const n of u.numbers) { if (n.gram && !n.ton) n.ton = n.gram; delete n.gram; } delete u.gram; }
if (!db.fixedG) { for (const c of db.chats) if (!c.official && /^g:/.test(c.id)) c.members = [c.owner].filter(Boolean); db.fixedG = true; }
for (const c of db.chats) { if (c.paid === undefined) Object.assign(c, { paid: false, price: 0, payReact: false, balance: 0 }); if (c.official && c.title === 'MiniGram') c.title = c.type === 'channel' ? 'MiniGram Канал' : 'MiniGram Чат'; }
const userDefaults = (k, u) => Object.assign(u, { id: u.id || ++db.uid, stars: typeof u.stars === 'number' ? u.stars : 0, hist: u.hist || [], badge: BADGES.includes(u.badge) ? u.badge : 'gem', title: u.title || '', bio: u.bio || '', numbers: (u.numbers || []).map(n => Object.assign({ ts: u.created || Date.now() }, n)), wear: u.wear || null, pins: u.pins || [], avatar: u.avatar || '', blocked: u.blocked || [], contacts: u.contacts || {}, ton: Number(u.ton) || 0, wallet: u.wallet || null, wh: u.wh || [], seen: u.seen || 0, nft: u.nft || [], handle: u.handle || '', wearnum: u.wearnum || null, cverif: Array.isArray(u.cverif) ? u.cverif : [], rating: Math.max(0, Math.round(Number(u.rating) || 0)),
  username: u.username || k, birthday: u.birthday || '', bg: typeof u.bg === 'number' ? u.bg : null, twofa: u.twofa || null, frozen: u.frozen || null, verif: !!u.verif, dev: !!u.dev, dms: u.dms || [] });
if (!db.users[BOT]) db.users[BOT] = { bot: true, id: 67, created: Date.now(), banned: false, title: '67', bio: '67', username: BOT };
if (!db.users[SUP]) db.users[SUP] = { bot: true, support: true, id: 4277, created: Date.now(), banned: false };
Object.assign(db.users[SUP], { bot: true, support: true, id: 4277, phone: SUP_PHONE, username: SUP_NAME, title: SUP_NAME, bio: 'Официальная поддержка MiniGram. Отсюда приходят коды входа, важные уведомления и рассылки.', verif: true, banned: false, frozen: null, avatar: '/a/support.png' });
for (const [k, u] of Object.entries(db.users)) userDefaults(k, u);
const getChat = id => db.chats.find(c => c.id === id);
for (const g of db.gifts) { const c = db.catalog[g.gid]; if (g.listed > 0 && c && !(c.s > 0)) g.listed = 0; }
const role = (c, n) => c.owner === n ? 'owner' : c.admins.includes(n) ? 'admin' : c.members.includes(n) ? 'member' : null;
function syncOfficial() {
  const k = Object.keys(db.users).find(x => db.users[x].id === 1004);
  if (k) { db.users[k].verif = true; db.users[k].dev = true; for (const c of db.chats) if (c.official) { c.owner = k; if (!c.admins.includes(k)) c.admins.push(k); } }
  for (const [k2, u] of Object.entries(db.users)) { if (u.bot) continue; for (const id of ['general', 'official']) { const c = getChat(id); if (!c.members.includes(k2)) c.members.push(k2); } if (!u.dms.includes(BOT)) u.dms.push(BOT); if (!u.dms.includes(SUP)) u.dms.unshift(SUP); }
}
syncOfficial();
let timer, firstDirty = 0, writing = false;
function flush(sync) {
  clearTimeout(timer); firstDirty = 0;
  if (writing && !sync) { timer = setTimeout(() => flush(), 400); return; }
  let data; try { data = JSON.stringify(db); } catch (e) { console.error('save', e); return; }
  const tmp = DB_FILE + '.tmp';
  if (sync) { try { fs.writeFileSync(tmp, data); fs.renameSync(tmp, DB_FILE); } catch (e) { console.error('save', e); } return; }
  writing = true; fs.writeFile(tmp, data, e => { if (e) { writing = false; return; } fs.rename(tmp, DB_FILE, () => { writing = false; }); });
}
const save = () => { if (!firstDirty) firstDirty = Date.now(); clearTimeout(timer); timer = setTimeout(() => flush(), Date.now() - firstDirty > 4000 ? 0 : 900); };
for (const sg of ['SIGINT', 'SIGTERM']) process.on(sg, () => { flush(true); process.exit(0); });
const hash = (p, s) => crypto.scryptSync(p, s, 32).toString('hex');
const json = (res, c, o) => { res.writeHead(c, { 'Content-Type': 'application/json' }); res.end(JSON.stringify(o)); };
const body = (req, lim = 1e5) => new Promise(r => { let b = '', n = 0; req.on('data', d => { n += d.length; if (n > lim) { r({}); req.destroy(); } else b += d; }); req.on('end', () => { try { r(JSON.parse(b || '{}')); } catch { r({}); } }); });
const NAME = /^[a-zA-Z0-9_]{3,20}$/, norm = s => String(s || '').replace(/[\s()-]/g, '');
const online = new Map(), codes = Object.create(null), fails = Object.create(null);
const send = (ws, o) => ws.readyState === 1 && ws.send(JSON.stringify(o));
const broadcast = o => { for (const w of online.keys()) send(w, o); };
const sendTo = (n, o) => { for (const [w, x] of online) if (x === n) send(w, o); };
const members = chat => chat.startsWith('dm:') ? chat.slice(3).split('|') : (getChat(chat) || { members: [] }).members;
const canSee = (chat, n) => typeof chat === 'string' && members(chat).includes(n);
const toChat = (chat, o) => { const m = members(chat); for (const [w, n] of online) if (m.includes(n)) send(w, o); };
const kick = name => { for (const [w, n] of online) if (n === name) { send(w, { t: 'kick' }); w.close(); } };
const TON_USD = Number(process.env.TON_USD) || 1.0436, usdOf = t => Math.round(t * TON_USD * 100) / 100;
const walletAddr = u => u.wallet ? 'UQ' + crypto.createHash('sha256').update('addr:' + u.wallet.nick + ':' + u.wallet.salt).digest('base64url').slice(0, 46) : null;
const walletOf = q => { q = String(q || '').trim(); if (!q) return null; if (/^[a-z0-9-]+\.ton$/i.test(q)) { const d = db.domains.find(x => x.name === low(q) && x.owner && db.users[x.owner] && db.users[x.owner].wallet); return d ? d.owner : null; } const lq = low(q).replace(/^@/, ''); return Object.keys(db.users).find(k => { const u = db.users[k]; return !u.bot && u.wallet && (u.wallet.nick === lq || walletAddr(u) === q || low(u.username) === lq); }) || null; };
const wstate = n => { const u = db.users[n]; return { nick: u.wallet ? u.wallet.nick : null, addr: walletAddr(u), ton: u.ton, hist: u.wh, open: !!u.wallet, rate: TON_USD, domains: db.domains.filter(d => d.owner === n).map(d => d.name) }; };
const lastMap = n => { const o = {}, ok = new Map(); for (let i = db.msgs.length - 1; i >= 0; i--) { const x = db.msgs[i]; if (x.post || o[x.chat]) continue; if (!ok.has(x.chat)) ok.set(x.chat, canSee(x.chat, n)); if (!ok.get(x.chat)) continue; o[x.chat] = { ts: x.ts, from: x.from, text: x.text || (x.file ? '[файл]' : x.gift ? '🎁 Подарок' : '') }; } return o; };
const wallet = n => ({ t: 'wallet', stars: db.users[n].stars, hist: db.users[n].hist });
const pushWallet = n => sendTo(n, wallet(n));
const addHist = (u, amount, from) => { u.hist.unshift({ amount, from, ts: Date.now() }); u.hist.length = Math.min(u.hist.length, 50); if (amount < 0 && from !== 'Админ') u.rating = (u.rating || 0) + Math.round(-amount); };
const nm = k => { const u = db.users[k]; return u ? '«' + (u.username || k) + '» (ID ' + u.id + ')' : '«' + String(k).replace(/^ch:/, 'канал ') + '»'; };
const gname = g => g.up ? g.up.name + ' #' + g.up.num : (db.catalog[g.gid] ? db.catalog[g.gid].n : 'подарок');
const alog = (kind, text, users, actor) => { db.logs.push({ ts: Date.now(), kind, text, users: [...new Set((users || []).filter(Boolean))], actor: actor || null }); if (db.logs.length > 6000) db.logs.splice(0, db.logs.length - 6000); };
const log = (w, act, d) => alog('system', w + ': ' + act + ' ' + d, []);
for (const x of db.logs) if (!x.text) { x.kind = 'system'; x.text = (x.who || '') + ': ' + (x.act || '') + ' ' + (x.d || ''); x.users = []; }
const WORDS = 'apple arrow anchor autumn badge baker banjo basil beach berry bike bird blade blast bloom boat bolt bone book boot brave bread brick brook cabin cable cactus camel candy canoe cargo castle cedar chair chalk charm chess chief cider circle clay cliff clock cloud clover coast cobra coin comet coral couch crab crane crown cube curve daisy dance delta denim desk diary diver dove dragon dream drift drum eagle earth echo elbow elder ember engine fable falcon fancy feast fence fern ferry field finch flame flint float flute forest fossil frost fruit gadget galaxy garden garlic gecko giant ginger glider globe goat gold grape grass grove guitar hammer harbor hazel heart hedge heron honey humble icon igloo indigo iris island ivory jacket jaguar jelly jewel jungle kayak kettle kiwi kite koala ladder lagoon lamp lantern laser lemon lilac linen lion lotus lunar magic mango maple marble meadow melon mirror mist moose mosaic motor mouse nectar nest noble north novel oasis ocean olive onion opal orbit orchid otter oval owl paddle palm panda paper parrot peach pearl pepper piano pilot pine pixel planet plum polar pond poppy prism puzzle quartz quest quiet quilt rabbit radar rain raven reef ribbon river robin rocket rose ruby saddle sage sail salmon sand scarf shadow shell silver sketch smile snow solar spark spice spider spoon spring squid star stone storm sugar summer sunset swan tango tiger timber tomato topaz tower trail tulip tunnel turtle umbrella valley velvet violet violin walnut water whale willow window winter wizard yacht yarn yellow zebra zenith zephyr'.split(' ');
// ---- цены доменов .ton ----
const EXTRA_WORDS = 'hello world my your our the and free best top new big small blue red green black white pink sun moon sky fire water wind light dark day night time life work home city land sea road street bridge music video photo news blog club team group party friend family people man woman boy girl kid baby dog cat fish bird horse lion bear wolf fox game play win luck rich cash money dollar euro gold silver bronze iron steel stone rock sand hill mountain river lake forest tree flower garden fruit food pizza burger coffee tea beer wine milk bread cake candy sweet cool hot cold fast slow smart bright happy sad crazy wild brave strong power force speed turbo super mega ultra hyper max mini micro nano pro plus prime first last one two three four five six seven eight nine ten zero hundred thousand million star planet space galaxy universe rocket robot cyber digital data code tech soft web net link site page book shop store market trade deal sale buy sell pay card bank coin token chain block crypto bitcoin wallet vault safe lock key door gate wall house room bed table chair phone mobile screen photo camera clock watch ring crown king queen prince knight dragon wizard magic ghost angel devil hero legend master boss chief leader captain pilot driver rider runner fighter hunter killer ninja pirate soldier agent spy ace joker jack john mike alex anna maria love heart soul mind dream hope peace war fight dance sing smile laugh kiss hug brand shine glow spark flash storm thunder rain snow ice frost summer winter spring autumn east west north south left right up down in out on off high low long short wide deep sky cloud'.split(' ');
const EW = new Set([...WORDS, ...EXTRA_WORDS]);
const PREMIUM = new Set('crypto bank vip wallet gold ton bitcoin btc eth money cash pay shop game casino bet nft token coin exchange invest trade market store cloud ai bot love king queen win rich diamond dollar usd vault chain block dao defi swap pro max'.split(' '));
const LEN_BASE = [0, 100000, 30000, 5000, 900, 200, 48, 16, 6, 4, 3, 2], NUM_BASE = [0, 100000, 40000, 8000, 1200, 250, 60, 20, 8, 5, 3, 2];
const LUCKY = ['777', '888', '999', '666', '007', '1337', '420', '1000', '2026'];
function domQuote(raw) {
  const name = low(raw).trim().replace(/\.ton$/, '');
  if (!name) return { error: 'Введите имя домена' };
  if (name.length > 30) return { error: 'Не больше 30 символов' };
  if (!/^[a-z0-9-]+$/.test(name)) return { error: 'Допустимы только английские буквы a–z, цифры 0–9 и дефис' };
  if (/^-|-$|--/.test(name)) return { error: 'Дефис нельзя ставить в начале, в конце или два подряд' };
  const core = name.replace(/-/g, ''), len = name.length, digits = /^\d+$/.test(core), letters = /^[a-z]+$/.test(core), f = [];
  if (!core) return { error: 'В имени должна быть хотя бы одна буква или цифра' };
  const idx = Math.min(len, 11), base = (digits ? NUM_BASE : LEN_BASE)[idx] * (len >= 16 ? 0.5 : 1);
  if (digits) {
    if (core.length >= 2 && new Set(core).size === 1) f.push(['одинаковые цифры', 4]);
    const asc = [...core].every((c, i) => i === 0 || +c === +core[i - 1] + 1), desc = [...core].every((c, i) => i === 0 || +c === +core[i - 1] - 1);
    if (core.length >= 3 && (asc || desc)) f.push(['цифры идут подряд', 3]);
    if (core.length >= 3 && new Set(core).size > 1 && core === [...core].reverse().join('')) f.push(['число-палиндром', 1.8]);
    const lk = LUCKY.find(x => core.includes(x)); if (lk && !(f.length && f[0][1] === 4)) f.push(['счастливая комбинация «' + lk + '»', 2]);
    if (core.length >= 3 && /00$/.test(core) && new Set(core).size > 1) f.push(['круглое число', 1.5]);
  } else if (letters) {
    if (PREMIUM.has(core)) f.push(['премиум-слово «' + core + '»', 9]);
    else if (EW.has(core)) f.push(['английское слово', 2.5]);
    else { for (let i = 2; i <= core.length - 2; i++) { const a = core.slice(0, i), b2 = core.slice(i); if (EW.has(a) && EW.has(b2)) { f.push(['составное слово «' + a + ' + ' + b2 + '»', 1.6]); break; } } }
    if (core.length >= 3 && new Set(core).size === 1) f.push(['повторяющаяся буква', 3]);
  } else { f.push(['буквы и цифры вместе', 0.6]); const w = core.replace(/\d+/g, ''); if (PREMIUM.has(w)) f.push(['слово «' + w + '» с цифрами', 2]); }
  if (name.includes('-')) f.push(['дефис в имени', 0.7]);
  let price = base * f.reduce((a, x) => a * x[1], 1); price = Math.max(1, Math.round(Math.min(price, 5e6)));
  return { name: name + '.ton', len, base: Math.round(base), kind: digits ? 'digits' : letters ? 'letters' : 'mixed', factors: f.map(([k, m]) => ({ k, m })), price, usd: usdOf(price) };
}
const domInfo = (raw, me) => {
  const input = low(raw).trim().replace(/\.ton$/, ''), q = domQuote(raw); q.input = input; if (q.error) return q;
  const d = db.domains.find(x => x.name === q.name);
  if (d && d.owner) { q.taken = true; q.owner = db.users[d.owner] ? db.users[d.owner].username : ''; q.mine = d.owner === me; }
  else if (d) { q.price = d.price; q.usd = usdOf(d.price); q.factors = [{ k: 'цена задана администрацией', m: null }]; }
  return q;
};
const viewMsg = (x, me) => (x.gift && x.gift.anon && x.from !== me) ? Object.assign({}, x, { from: 'anon' }) : x;
function unzip(buf) {
  const out = []; let eocd = -1;
  for (let i = buf.length - 22; i >= Math.max(0, buf.length - 65557); i--) if (buf.readUInt32LE(i) === 0x06054b50) { eocd = i; break; }
  if (eocd < 0) throw new Error('not zip');
  const n = Math.min(buf.readUInt16LE(eocd + 10), 600); let p = buf.readUInt32LE(eocd + 16);
  for (let k = 0; k < n; k++) {
    if (buf.readUInt32LE(p) !== 0x02014b50) break;
    const method = buf.readUInt16LE(p + 10), csize = buf.readUInt32LE(p + 20), nl = buf.readUInt16LE(p + 28), el = buf.readUInt16LE(p + 30), cl = buf.readUInt16LE(p + 32), off = buf.readUInt32LE(p + 42);
    const name = buf.slice(p + 46, p + 46 + nl).toString('utf8'); p += 46 + nl + el + cl;
    if (name.endsWith('/') || name.includes('__MACOSX')) continue;
    const start = off + 30 + buf.readUInt16LE(off + 26) + buf.readUInt16LE(off + 28), raw = buf.slice(start, start + csize);
    let data = null; try { data = method === 0 ? raw : method === 8 ? zlib.inflateRawSync(raw) : null; } catch {}
    if (data && data.length <= 8e6) out.push({ name, data });
  }
  return out;
}
const pickW = list => { const t = list.reduce((s, x) => s + x.w, 0); let r = Math.random() * t; for (const x of list) { r -= x.w; if (r <= 0) return x; } return list[list.length - 1]; };
const pct = (list, x) => Math.round(x.w / list.reduce((s, y) => s + y.w, 0) * 1000) / 10;
const pubCat = () => Object.fromEntries(Object.entries(db.catalog).map(([id, g]) => [id, { n: g.n, p: g.p, s: g.s, sold: g.sold, img: g.img, lottie: g.lottie || null, on: g.on, up: { enabled: g.up.enabled, cost: g.up.cost } }]));
const marketList = () => db.gifts.filter(x => x.listed > 0 && db.catalog[x.gid]).sort((a, b) => a.listed - b.listed).slice(0, 100).map(giftView);
const REACTIONS = ['👍', '👎', '❤️', '🔥', '🥰', '👏', '😂', '😮', '😢', '🤔', '🎉', '🤩', '🙏', '👌'];
const chOf = g => (typeof g.owner === 'string' && g.owner.startsWith('ch:')) ? getChat(g.owner.slice(3)) : null;
const actor = (g, n) => g.owner === n || (() => { const c = chOf(g); return !!c && ['owner', 'admin'].includes(role(c, n)); })();
const floorMap = () => { const o = {}; for (const g of db.gifts) if (g.listed > 0 && db.catalog[g.gid]) { const f = o[g.gid] || (o[g.gid] = { min: g.listed, n: 0 }); f.min = Math.min(f.min, g.listed); f.n++; } return o; };
const marketMsg = gid => ({ t: 'market', gid: gid || null, floors: floorMap(), list: db.gifts.filter(x => x.listed > 0 && db.catalog[x.gid] && (!gid || x.gid === gid)).sort((a, b) => a.listed - b.listed).slice(0, 100).map(giftView) });
const giftView = g => { const c = db.catalog[g.gid], o = db.users[g.owner]; return { id: g.id, gid: g.gid, n: c.n, img: c.img, lottie: c.lottie || null, serial: g.serial, from: g.from, note: g.note || '', ts: g.ts, listed: g.listed || 0, up: g.up, link: g.up ? 'gift/' + g.gid + '-' + g.up.num : null, canUp: !g.up && c.up.enabled, cost: c.up.cost, of: c.s || 0, sold: c.sold || 0, upCount: (c.up && c.up.count) || 0, owner: o ? o.username : (chOf(g) ? chOf(g).title : g.owner), ownerKey: g.owner }; };
const wearById = id => { const x = id && db.gifts.find(g => g.id === id && g.up); return x ? { id: x.id, img: x.up.model.lottie ? db.catalog[x.gid].img : x.up.model.url, lottie: x.up.model.lottie ? x.up.model.url : null, bg: x.up.bg, pat: x.up.pat } : null; };
const wearFull = u => wearById(u.wear);
function wearInfo(u) { const w = wearFull(u); return w ? { id: w.id, img: w.img, lottie: w.lottie } : null; }
function releaseGift(g) { const ch = chOf(g); if (ch && ch.wear === g.id) { ch.wear = null; pushChat(ch); } const o = db.users[g.owner]; if (o) { o.pins = o.pins.filter(x => x !== g.id); if (o.wear === g.id) { o.wear = null; broadcast({ t: 'user', user: pub(g.owner, o) }); } } g.listed = 0; }
function rollUp(c, opt = {}) {
  const models = c.up.models.length ? c.up.models : [{ id: 'base', n: 'Классика', w: 1, url: c.lottie || c.img, lottie: !!c.lottie }];
  const m = opt.model ? models.find(x => x.id === opt.model) : pickW(models), b = opt.bg ? db.backdrops.find(x => x.id === opt.bg) : pickW(db.backdrops), p = opt.pat ? db.patterns.find(x => x.id === opt.pat) : pickW(db.patterns);
  if (!m || !b || !p) return null;
  return { num: ++c.up.count, name: c.up.name || c.n, ts: Date.now(), model: { n: m.n, url: m.url, lottie: !!m.lottie, pct: pct(models, m) }, bg: { n: b.n, c1: b.c1, c2: b.c2, pct: pct(db.backdrops, b) }, pat: { n: p.n, url: p.url, pct: pct(db.patterns, p) } };
}
function resolveUser(q) { q = low(String(q || '').trim().replace(/^@/, '')); if (!q) return null; return Object.keys(db.users).find(k => !db.users[k].bot && (low(k) === q || low(db.users[k].username) === q || low(db.users[k].handle) === q)) || null; }
const nftList = () => db.nfts.map(x => ({ h: x.h, price: x.price, owner: x.owner, hold: !!x.hold, tonPrice: x.tonPrice || 0, ts: x.ts, ton: x.ton, usd: x.usd }));
const isTaken = (h, selfKey, selfChat) => { h = low(h); return Object.entries(db.users).some(([k, u]) => k !== selfKey && (low(k) === h || low(u.username) === h || low(u.handle) === h)) || db.nfts.some(x => x.h === h && x.owner !== selfKey) || db.chats.some(c => c.id !== selfChat && low(c.username) === h) || ['admin', 'api', 'a', 'u'].includes(h); };
const cvOf = u => (u.cverif || []).map(id => db.verifs.find(v => v.id === id)).filter(Boolean);
const pub = (k, u) => ({ cv: cvOf(u).map(v => ({ id: v.id, img: v.img, name: v.name })), avatar: u.avatar, wear: wearInfo(u), name: k, id: u.id, username: u.username, handle: u.handle, title: u.title, badge: u.badge, verif: u.verif, dev: u.dev, frozen: !!u.frozen, bot: !!u.bot, sup: !!u.support, bg: u.bg, cn: countryOf(u) });
const chatInfo = (c, me) => { const r = role(c, me); return { id: c.id, type: c.type, title: c.title, desc: c.desc, username: c.username, private: c.private, approval: c.approval, count: c.members.length, role: r, verified: !!c.verified, official: !!c.official, pending: c.requests.includes(me), paid: c.paid, price: c.price, payReact: c.payReact, comments: c.comments !== false, wear: wearById(c.wear), balance: r === 'owner' ? c.balance : undefined, invite: r === 'owner' || r === 'admin' ? c.invite : undefined }; };
const pushChat = c => { for (const [w, n] of online) if (c.members.includes(n)) send(w, { t: 'chat', c: chatInfo(c, n) }); };
const profile = (n, viewer) => {
  const u = db.users[n], real = norm(u.phone), worn = u.wearnum && u.numbers.some(x => norm(x.num) === norm(u.wearnum)) ? u.wearnum : null, ph = worn ? norm(worn) : real, own = viewer === n;
  return Object.assign(pub(n, u), { seen: u.seen, iBlocked: !!(db.users[viewer] && db.users[viewer].blocked.includes(n)), blocked: own ? u.blocked : undefined, contact: db.users[viewer] && db.users[viewer].contacts[n], bio: u.bio, birthday: u.birthday, created: u.created, online: u.bot ? false : [...online.values()].includes(n),
    phone: u.support ? SUP_PHONE : u.bot ? '' : worn ? worn : own ? ph : (ph ? ph.slice(0, -4).replace(/\d/g, '•') + ph.slice(-4) : ''), rating: u.rating || 0, cverifs: cvOf(u), phoneAnon: !!worn, realPhone: own ? real : undefined, wornNum: own ? worn : undefined, numbers: u.numbers, nfts: u.nft.map(h => { const x = db.nfts.find(y => y.h === h); return x ? { h, ts: x.ts, ton: x.ton, usd: x.usd, price: x.price } : { h }; }), pins: u.pins, wear: wearFull(u), twofa: own ? !!u.twofa : undefined,
    gifts: db.gifts.filter(g => g.owner === n && db.catalog[g.gid]).slice(-100).map(giftView) });
};
const newUser = (extra, key) => { const u = userDefaults(key, Object.assign({ created: Date.now(), banned: false }, extra)); u.dms = [SUP, BOT]; return u; };
const login = (res, key) => { const token = crypto.randomBytes(24).toString('hex'); db.sessions[token] = key; alog('account', 'Игрок ' + nm(key) + ' вошёл в аккаунт', [key], key); save(); json(res, 200, { token, name: key }); };

// страна телефона определяется по коду номера; анонимные номера (+888 или надетый коллекционный номер) = «Анонимный»
function countryOf(u) {
  if (!u || u.bot) return null;
  const worn = u.wearnum && Array.isArray(u.numbers) && u.numbers.some(x => norm(x.num) === norm(u.wearnum)) ? norm(u.wearnum) : null, ph = worn || norm(u.phone);
  if (!ph) return null;
  if (worn || ph.startsWith('+888')) return { n: 'Анонимный', f: '🏴‍☠️', anon: true };
  if (ph.startsWith('+7')) return ph[2] === '7' || ph[2] === '6' ? { n: 'Казахстан', f: '🇰🇿' } : { n: 'Россия', f: '🇷🇺' };
  if (ph.startsWith('+98')) return { n: 'Иран', f: '🇮🇷' };
  if (ph.startsWith('+1')) return { n: 'США / Канада', f: '🇺🇸' };
  return null;
}
function checkPhone(ph) {
  if (!/^\+\d{8,15}$/.test(ph)) return { error: 'Введите номер в формате +7..., +1... или +98...' };
  let reg, nat;
  if (ph.startsWith('+7')) { reg = 'Россия / Казахстан'; nat = ph.slice(2); if (!/^[79]\d{9}$/.test(nat)) return { error: 'Номер +7: нужно 10 цифр, мобильный начинается с 9 или 7' }; }
  else if (ph.startsWith('+98')) { reg = 'Иран'; nat = ph.slice(3); if (!/^9\d{9}$/.test(nat)) return { error: 'Номер +98: мобильный начинается с 9, всего 10 цифр' }; }
  else if (ph.startsWith('+1')) { reg = 'США / Канада'; nat = ph.slice(2); if (!/^[2-9]\d{2}[2-9]\d{6}$/.test(nat)) return { error: 'Номер +1: 10 цифр, код региона не с 0 или 1' }; }
  else return { error: 'Принимаются только номера +7, +1 и +98' };
  if (new Set(nat).size <= 3 || /(\d)\1{4,}/.test(nat) || /^(\d\d)\1{3,}/.test(nat.slice(1)) || '01234567890'.includes(nat.slice(1, 8)) || '09876543210'.includes(nat.slice(1, 8))) return { error: 'Такие номера недопустимы (повторяющиеся или подряд идущие цифры)' };
  return { region: reg };
}
const findPhone = ph => Object.keys(db.users).find(k => !db.users[k].bot && (norm(db.users[k].phone) === ph || db.users[k].numbers.some(n => norm(n.num) === ph)));
function deleteUser(k) {
  const u = db.users[k]; if (!u || u.bot) return; kick(k);
  for (const t of Object.keys(db.sessions)) if (db.sessions[t] === k) delete db.sessions[t];
  for (const x of db.nfts) if (x.owner === k) x.owner = null;
  db.gifts = db.gifts.filter(g => g.owner !== k);
  for (const c of db.chats) { c.members = c.members.filter(x => x !== k); c.admins = c.admins.filter(x => x !== k); c.requests = c.requests.filter(x => x !== k); delete c.prefixes[k]; if (c.owner === k) c.owner = c.official ? null : (c.admins[0] || null); }
  db.msgs = db.msgs.filter(m => m.from !== k && !(m.chat.startsWith('dm:') && m.chat.slice(3).split('|').includes(k)));
  for (const o of Object.values(db.users)) o.dms = (o.dms || []).filter(x => x !== k);
  db.appeals = db.appeals.filter(a => a.user !== k); delete db.users[k]; save(); broadcast({ t: 'gone', name: k });
}

// ---- админ-панель: операторы и права ----
const PERMS = { view: 'Просмотр игроков и статистики', logs: 'Журнал действий', economy: 'Звёзды, TON, рейтинг', gifts: 'Подарки и улучшения', fragment: 'Юзернеймы, номера, домены, аукционы', moderation: 'Бан, заморозка, верификации, жалобы', chats: 'Чаты и сообщения', broadcast: 'Рассылка игрокам и в канал', support: 'Поддержка: чаты с игроками', users: 'Аккаунты: номер, сессии, удаление' };
const ROUTE = { stats: '*', me: '*', users: 'view', player: 'view', logs: 'logs', userlogs: 'logs', msgs: 'chats', chats: 'chats', delmsg: 'chats', gifts: 'gifts', upinfo: 'gifts', upgrades: 'gifts', gift: 'gifts', giftset: 'gifts', grantgift: 'gifts', nfts: 'fragment', nft: 'fragment', grantnft: 'fragment', grantnum: 'fragment', domains: 'fragment', domain: 'fragment', domdel: 'fragment', auctions: 'fragment', auction: 'fragment', wallet: 'economy', stars: 'economy', rating: 'economy', verifs: 'moderation', verifnew: 'moderation', verifgive: 'moderation', verifdel: 'moderation', appeals: 'moderation', reports: 'moderation', ban: 'moderation', freeze: 'moderation', unfreeze: 'moderation', verify: 'moderation', broadcast: 'broadcast', support: 'support', supthread: 'support', supreply: 'support', phone: 'users', resetsessions: 'users', delete: 'users' };
const canDo = (op, a) => { if (op.owner) return true; const need = ROUTE[a]; return need === '*' || (!!need && op.perms.includes(need)); };
function opInfo(login) { if (login === 'owner') return { login: 'owner', name: 'Владелец', owner: true, perms: Object.keys(PERMS), max: 0, permNames: PERMS }; const o = db.ops.find(x => x.login === login); return o ? { login: o.login, name: o.name || o.login, owner: false, perms: o.perms, max: o.max || 0, permNames: PERMS } : null; }
function adminAuth(tok) { if (!tok) return null; if (tok === ADMIN) return Object.assign(opInfo('owner'), { owner: true }); const lg = db.opsess[tok]; if (!lg) return null; const o = lg === 'owner' ? { login: 'owner' } : db.ops.find(x => x.login === lg && !x.disabled); return o ? opInfo(o.login) : null; }
const keyOf = w => { if (w === undefined || w === null || w === '' || w === 'all') return null; return resolveUser(w) || Object.keys(db.users).find(x => !db.users[x].bot && String(db.users[x].id) === String(w).trim()) || null; };
function adminText(a, b, tk, all) {
  const t = all ? 'всех игроков' : tk ? nm(tk) : '«' + (b.who || '?') + '»', n = Number(b.amount);
  switch (a) {
    case 'stars': return all ? (n > 0 ? 'выдал каждому игроку по ' + n + ' ⭐ (всем ' + all + ')' : 'забрал у каждого игрока по ' + Math.abs(n) + ' ⭐') : (n > 0 ? 'начислил игроку ' + t + ' ' + n + ' ⭐' : 'списал у игрока ' + t + ' ' + Math.abs(n) + ' ⭐');
    case 'rating': return all ? 'изменил рейтинг всем игрокам на ' + n : 'изменил рейтинг игрока ' + t + ' на ' + (n > 0 ? '+' : '') + n;
    case 'wallet': return n > 0 ? 'начислил игроку ' + t + ' ' + n + ' TON' : 'списал у игрока ' + t + ' ' + Math.abs(n) + ' TON';
    case 'grantgift': return 'выдал игроку ' + t + ' улучшенный подарок «' + ((db.catalog[b.gid] || {}).n || b.gid) + '»';
    case 'grantnft': return 'выдал игроку ' + t + ' коллекционный юзернейм @' + low(b.h).replace(/^@/, '') + (Number(b.ton) ? ' (цена ' + b.ton + ' TON)' : '');
    case 'grantnum': return 'выдал игроку ' + t + ' анонимный номер ' + b.num;
    case 'nft': return 'выпустил в продажу юзернейм @' + low(b.h) + ' за ' + b.price + ' ⭐';
    case 'gift': return 'добавил в магазин новый подарок «' + b.name + '» за ' + b.price + ' ⭐ (тираж ' + (b.supply || 'без лимита') + ')';
    case 'giftset': { const g = db.catalog[b.gid]; return 'изменил настройки подарка «' + (g ? g.n : b.gid) + '»' + (typeof b.on === 'boolean' ? (b.on ? ': включил продажу' : ': выключил продажу') : '') + (typeof b.upEnabled === 'boolean' ? (b.upEnabled ? ': включил улучшение' : ': выключил улучшение') : '') + (b.cost !== undefined ? ': цена улучшения ' + b.cost + ' ⭐' : '') + (b.uname ? ': имя улучшения «' + b.uname + '»' : ''); }
    case 'domain': return 'задал особую цену ' + b.price + ' TON для домена ' + b.name;
    case 'domdel': return 'убрал домен ' + b.name + ' (освободил)';
    case 'auction': return 'запустил аукцион на юзернейм @' + low(b.h).replace(/^@/, '') + ', старт ' + b.start + ' TON, ' + (b.hours || 24) + ' ч.';
    case 'broadcast': return 'отправил рассылку от «' + SUP_NAME + '»' + (b.channel ? ' (и в официальный канал)' : '') + ': «' + String(b.text || '').slice(0, 80) + '»';
    case 'supreply': return 'ответил от «' + SUP_NAME + '» игроку ' + t + ': «' + String(b.text || '').slice(0, 80) + '»';
    case 'ban': return (b.banned ? 'заблокировал' : 'разблокировал') + ' игрока ' + t;
    case 'freeze': return 'заморозил аккаунт ' + t + (b.reason ? '. Причина: «' + b.reason + '»' : '');
    case 'unfreeze': return 'разморозил аккаунт ' + t;
    case 'delete': return 'УДАЛИЛ аккаунт ' + t;
    case 'verify': return 'изменил верификацию игрока ' + t + (b.verif ? ' (галочка)' : '') + (b.dev ? ' (разработчик)' : '') + (!b.verif && !b.dev ? ' (снял)' : '');
    case 'resetsessions': return 'завершил все сессии игрока ' + t;
    case 'phone': return 'сменил номер телефона игроку ' + t + ' на ' + b.phone;
    case 'verifnew': return 'создал верификацию «' + b.name + '»';
    case 'verifgive': { const v = db.verifs.find(x => x.id === b.id); return (b.on === false ? 'забрал' : 'выдал') + ' верификацию «' + (v ? v.name : b.id) + '» ' + (b.who === 'all' ? 'у всех игроков' : 'игроку ' + t); }
    case 'verifdel': { const v = db.verifs.find(x => x.id === b.id); return 'удалил верификацию «' + (v ? v.name : b.id) + '»'; }
    case 'resetall': return 'ОБНУЛИЛ балансы и прогресс у всех игроков';
    case 'delmsg': return 'удалил сообщение #' + b.id;
  }
  return null;
}
const ensureDm = (a, b) => { for (const [x, y] of [[a, b], [b, a]]) { const u = db.users[x]; if (u && !u.bot && !u.dms.includes(y)) { u.dms.push(y); sendTo(x, { t: 'peer', user: pub(y, db.users[y]) }); } } };

const dmId = (a, b) => 'dm:' + [a, b].sort().join('|');
// сообщение от аккаунта «Поддержка MiniGram» (+4277) в личный чат игроку
function supportSend(to, text, opts) {
  const u = db.users[to]; if (!u || u.bot) return null;
  ensureDm(to, SUP);
  const chat = dmId(SUP, to), msg = { id: db.nextId++, chat, from: SUP, text: String(text).slice(0, 2000), ts: Date.now() };
  if (opts && opts.code) msg.sys = 'code';
  db.msgs.push(msg); if (db.msgs.length > 30000) db.msgs.shift();
  toChat(chat, { t: 'msg', msg, u: pub(SUP, db.users[SUP]) });
  return msg;
}
const MIME = { png: 'image/png', jpg: 'image/jpeg', jpeg: 'image/jpeg', gif: 'image/gif', webp: 'image/webp', mp4: 'video/mp4', webm: 'video/webm', mov: 'video/quicktime', mp3: 'audio/mpeg', ogg: 'audio/ogg', wav: 'audio/wav', pdf: 'application/pdf', json: 'application/json' };
const PAGE = { json: 'application/json', js: 'text/javascript', html: 'text/html; charset=utf-8', png: 'image/png' };
const pages = { '/': 'index.html', '/admin': 'admin.html', '/manifest.json': 'manifest.json', '/sw.js': 'sw.js', '/icon-192.png': 'icon-192.png', '/icon-512.png': 'icon-512.png' };
const GZ = new Map();
function serve(req, res, file, mime, cache) {
  fs.stat(file, (e, st) => {
    if (e || !st.isFile()) { res.writeHead(404); return res.end(); }
    const type = mime[path.extname(file).slice(1).toLowerCase()];
    const h = { 'Content-Type': type || 'application/octet-stream', 'Accept-Ranges': 'bytes', 'X-Content-Type-Options': 'nosniff', 'Cache-Control': cache ? 'public, max-age=3600' : 'no-cache' };
    if (!type) h['Content-Disposition'] = 'attachment';
    if (type && type.startsWith('text/html')) { h['Content-Security-Policy'] = "default-src 'self'; script-src 'self' 'unsafe-inline' https://cdnjs.cloudflare.com; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob:; media-src 'self' blob:; connect-src 'self' ws: wss: https://api.mymemory.translated.net; object-src 'none'; base-uri 'self'; frame-ancestors 'none'"; h['X-Frame-Options'] = 'DENY'; h['Referrer-Policy'] = 'no-referrer'; }
    let start = 0, end = st.size - 1, code = 200; const r = /bytes=(\d*)-(\d*)/.exec(req.headers.range || '');
    if (r && (r[1] || r[2])) {
      if (r[1]) { start = +r[1]; if (r[2]) end = Math.min(+r[2], end); } else start = Math.max(0, st.size - +r[2]);
      if (start > end) { res.writeHead(416); return res.end(); }
      code = 206; h['Content-Range'] = `bytes ${start}-${end}/${st.size}`;
    }
    if (type && /^(text|application\/json)/.test(type) && code === 200 && /\bgzip\b/.test(req.headers['accept-encoding'] || '')) {
      let c = GZ.get(file);
      if (!c || c.m !== st.mtimeMs) { c = { m: st.mtimeMs, buf: zlib.gzipSync(fs.readFileSync(file), { level: 6 }) }; GZ.set(file, c); }
      h['Content-Encoding'] = 'gzip'; h['Content-Length'] = c.buf.length; h['Vary'] = 'Accept-Encoding'; delete h['Accept-Ranges']; res.writeHead(200, h); return res.end(c.buf);
    }
    h['Content-Length'] = end - start + 1; res.writeHead(code, h); fs.createReadStream(file, { start, end }).pipe(res);
  });
}

async function route(req, res) {
  const u = req.url.split('?')[0];
  if (req.method === 'GET') {
    if (pages[u]) return serve(req, res, path.join(DIR, pages[u]), PAGE, false);
    if (u.startsWith('/a/')) return serve(req, res, path.join(DIR, 'assets', path.basename(u)), PAGE, true);
    if (u.startsWith('/u/')) return serve(req, res, path.join(UP, path.basename(u)), MIME, true);
    if (/^\/(\+?[A-Za-z0-9_]{3,40}|gift\/[A-Za-z0-9_-]{3,60})$/.test(u)) return serve(req, res, path.join(DIR, 'index.html'), PAGE, false);
  }
  if (req.method === 'POST' && u === '/api/upload') {
    const me = db.sessions[req.headers['x-token']]; if (!me || db.users[me].banned || db.users[me].frozen) return json(res, 401, { error: 'Нет доступа' });
    const chunks = []; let n = 0;
    for await (const c of req) { n += c.length; if (n > 25e6) return json(res, 413, { error: 'Файл больше 25 МБ' }); chunks.push(c); }
    let orig = 'file'; try { orig = decodeURIComponent(req.headers['x-fname'] || 'file').slice(0, 100); } catch {}
    const ext = (orig.split('.').pop() || '').toLowerCase().replace(/[^a-z0-9]/g, '').slice(0, 5) || 'bin';
    const file = crypto.randomBytes(8).toString('hex') + '.' + ext;
    fs.writeFileSync(path.join(UP, file), Buffer.concat(chunks));
    const kind = ['png', 'jpg', 'jpeg', 'gif', 'webp'].includes(ext) ? 'image' : ['mp4', 'webm', 'mov'].includes(ext) ? 'video' : ['mp3', 'ogg', 'wav'].includes(ext) ? 'audio' : 'file';
    return json(res, 200, { url: '/u/' + file, name: orig, kind, size: n });
  }
  if (u.startsWith('/api/admin/')) {
    const a = u.slice(11);
    if (a === 'login' && req.method === 'POST') {
      const { login: lg, pass } = await body(req), l = low(lg || '').trim() || 'owner', f = fails['adm:' + l] || { n: 0, t: 0 };
      if (Date.now() - f.t > 6e5) f.n = 0; if (f.n >= 6) return json(res, 429, { error: 'Слишком много попыток. Подождите 10 минут.' });
      let who = null;
      if (l === 'owner') { if (typeof pass === 'string' && pass === ADMIN) who = { login: 'owner', name: 'Владелец', owner: true }; }
      else { const o = db.ops.find(x => x.login === l); if (o && !o.disabled && typeof pass === 'string' && hash(pass, o.salt) === o.hash) { who = { login: o.login, name: o.name || o.login, owner: false }; o.last = Date.now(); } }
      if (!who) { f.n++; f.t = Date.now(); fails['adm:' + l] = f; alog('system', 'Неудачная попытка входа в админ-панель (логин «' + l + '»)', []); return json(res, 401, { error: 'Неверный логин или пароль' }); }
      const token = crypto.randomBytes(24).toString('hex'); db.opsess[token] = who.login; alog('admin', (who.owner ? 'Владелец' : 'Оператор «' + who.name + '»') + ' вошёл в админ-панель', [], 'op:' + who.login); save();
      return json(res, 200, { token, op: opInfo(who.login) });
    }
    const op = adminAuth(req.headers['x-admin']); if (!op) return json(res, 401, { error: 'Нужно войти в админ-панель' });
    if (!canDo(op, a)) return json(res, 403, { error: 'У вас нет прав на этот раздел' });
    if (a === 'me') return json(res, 200, opInfo(op.login));
    const humans = Object.entries(db.users).filter(([, x]) => !x.bot);
    if (a === 'stats') return json(res, 200, { users: humans.length, online: new Set(online.values()).size, msgs: db.msgs.length, chats: db.chats.length, gifts: db.gifts.length, nfts: db.nfts.length, frozen: humans.filter(([, x]) => x.frozen).length, appeals: db.appeals.length, comments: db.msgs.filter(m => m.post).length, domains: db.domains.filter(d => d.owner).length, ton: Math.round(humans.reduce((s, [, x]) => s + x.ton, 0) * 100) / 100, stars: humans.reduce((s, [, x]) => s + x.stars, 0), rate: TON_USD, support: db.users[SUP] ? 1 : 0 });
    if (a === 'users') return json(res, 200, humans.map(([name, x]) => ({ name, id: x.id, username: x.username, stars: x.stars, rating: x.rating || 0, phone: x.phone || '', handle: x.handle, banned: x.banned, frozen: x.frozen, verif: x.verif, dev: x.dev, twofa: !!x.twofa, online: [...online.values()].includes(name) })));
    if (a === 'msgs') return json(res, 200, db.msgs.slice(-100).reverse());
    if (a === 'gifts') return json(res, 200, db.catalog);
    if (a === 'nfts') return json(res, 200, nftList());
    if (a === 'verifs') return json(res, 200, db.verifs.map(v => Object.assign({}, v, { holders: humans.filter(([, x]) => (x.cverif || []).includes(v.id)).length })));
    if (a === 'appeals') return json(res, 200, db.appeals);
    if (a === 'logs' || a === 'userlogs') {
      const qs = new URLSearchParams(req.url.split('?')[1] || ''), kind = qs.get('kind'), usr = qs.get('user'), q = low(qs.get('q') || ''), lim = Math.min(500, Number(qs.get('limit')) || 150), before = Number(qs.get('before')) || Infinity;
      const out = []; for (let i = db.logs.length - 1; i >= 0 && out.length < lim; i--) { const x = db.logs[i]; if (x.ts >= before) continue; if (kind && kind !== 'all' && x.kind !== kind) continue; if (usr && !(x.users || []).includes(usr)) continue; if (q && !low(x.text).includes(q)) continue; out.push(x); }
      return json(res, 200, { list: out, total: db.logs.length });
    }
    if (a === 'player') {
      const k = keyOf(new URLSearchParams(req.url.split('?')[1] || '').get('u')), x = k && db.users[k]; if (!x) return json(res, 404, { error: 'Не найден' });
      return json(res, 200, { name: k, id: x.id, username: x.username, handle: x.handle, phone: x.phone || '', stars: x.stars, ton: x.ton, rating: x.rating || 0, created: x.created, seen: x.seen, banned: x.banned, frozen: x.frozen, wallet: x.wallet ? x.wallet.nick : null,
        gifts: db.gifts.filter(g => g.owner === k && db.catalog[g.gid]).map(gname), nfts: x.nft, numbers: x.numbers.map(n => n.num), domains: db.domains.filter(d => d.owner === k).map(d => d.name), chats: db.chats.filter(c => c.members.includes(k)).map(c => c.title), online: [...online.values()].includes(k) });
    }
    if (a === 'reports') return json(res, 200, db.reports.slice(-100).reverse());
    if (a === 'domains') return json(res, 200, db.domains.map(d => Object.assign({}, d, { usd: usdOf(d.price) })));
    if (a === 'auctions') return json(res, 200, db.auctions.map(x => ({ h: x.h, start: x.start, end: x.end, done: x.done, top: x.bids.length ? x.bids[x.bids.length - 1] : null, bids: x.bids.length })));
    if (a === 'chats') return json(res, 200, db.chats.map(c => ({ id: c.id, type: c.type, title: c.title, username: c.username, members: c.members.length, owner: c.owner, private: c.private, verified: !!c.verified, comments: c.comments !== false })));
    if (a === 'upgrades') {
      const qs = new URLSearchParams(req.url.split('?')[1] || ''), kind = qs.get('kind'), c = db.catalog[qs.get('gift')];
      const chunks = []; let n = 0; for await (const ch of req) { n += ch.length; if (n > 60e6) return json(res, 413, { error: 'Больше 60 МБ' }); chunks.push(ch); }
      if (kind === 'models' && !c) return json(res, 400, { error: 'Подарок не найден' });
      let files; try { files = unzip(Buffer.concat(chunks)); } catch { return json(res, 400, { error: 'Это не zip-файл' }); }
      const out = [];
      for (const f of files.filter(x => /\.(tgs|json|png|gif|webp)$/i.test(x.name)).slice(0, 300)) {
        const ext = f.name.split('.').pop().toLowerCase(); let data = f.data, e = ext, lottie = false;
        if (ext === 'tgs') { try { data = zlib.gunzipSync(f.data); JSON.parse(data.toString()); e = 'json'; lottie = true; } catch { continue; } }
        else if (ext === 'json') { try { JSON.parse(data.toString()); lottie = true; } catch { continue; } }
        if (kind === 'patterns' && lottie) continue;
        const file = 'u' + rc() + '.' + e; fs.writeFileSync(path.join(UP, file), data);
        out.push({ id: (kind === 'patterns' ? 'p' : 'm') + db.nextId++, n: path.basename(f.name).replace(/\.[^.]+$/, '').slice(0, 40), url: '/u/' + file, lottie });
      }
      if (!out.length) return json(res, 400, { error: 'В архиве нет подходящих файлов (.tgs, .json, .png, .gif, .webp)' });
      out.forEach((x, i) => { x.w = Math.max(5, Math.round(1000 / (i + 1))); });
      if (kind === 'models') c.up.models = out; else db.patterns = db.patterns.concat(out.map(x => ({ id: x.id, n: x.n, url: x.url, w: x.w })));
      save(); const tot = out.reduce((s2, x) => s2 + x.w, 0);
      return json(res, 200, { ok: 1, count: out.length, items: out.map(x => ({ n: x.n, pct: Math.round(x.w / tot * 1000) / 10 })) });
    }
    const b = req.method === 'POST' ? await body(req, a === 'gift' || a === 'verifnew' ? 9e6 : 1e5) : {};
    if (req.method === 'POST') {
      if (!op.owner && (b.who === 'all')) return json(res, 403, { error: 'Массовые действия «всем» доступны только владельцу' });
      if (!op.owner && ['stars', 'wallet', 'rating'].includes(a) && op.max && Math.abs(Number(b.amount) || 0) > op.max) return json(res, 403, { error: 'Ваш лимит на одно действие: ' + op.max });
      const tk = keyOf(b.who), allN = b.who === 'all' ? humans.length : 0, wh = res.writeHead.bind(res);
      res.writeHead = (c, ...r) => { if (c === 200) { const t = adminText(a, b, tk, allN); if (t) alog('admin', (op.owner ? 'Владелец' : 'Оператор «' + op.name + '»') + ' ' + t, [tk], 'op:' + op.login); } return wh(c, ...r); };
    }
    if (a === 'ops' && op.owner) return json(res, 200, { perms: PERMS, list: db.ops.map(o => ({ login: o.login, name: o.name, perms: o.perms, max: o.max || 0, disabled: !!o.disabled, created: o.created, last: o.last || 0, online: Object.entries(db.opsess).some(([, l]) => l === o.login) })) });
    if (a === 'opadd' && op.owner) {
      const l = low(b.login).trim(), pass = String(b.pass || ''); if (!/^[a-z0-9_.-]{3,24}$/.test(l) || l === 'owner') return json(res, 400, { error: 'Логин: 3–24 символа, a-z, 0-9, _ . -' });
      if (pass.length < 6) return json(res, 400, { error: 'Пароль от 6 символов' }); if (db.ops.some(x => x.login === l)) return json(res, 400, { error: 'Такой логин уже есть' });
      const salt = rc(); db.ops.push({ login: l, name: String(b.name || l).slice(0, 30), salt, hash: hash(pass, salt), perms: (b.perms || []).filter(p => PERMS[p]), max: Math.max(0, Number(b.max) || 0), created: Date.now(), disabled: false });
      alog('admin', 'Владелец создал оператора «' + l + '» с правами: ' + ((b.perms || []).filter(p => PERMS[p]).map(p => PERMS[p]).join(', ') || 'без прав'), [], 'op:owner'); save(); return json(res, 200, { ok: 1 });
    }
    if (a === 'opset' && op.owner) {
      const o = db.ops.find(x => x.login === low(b.login)); if (!o) return json(res, 400, { error: 'Оператор не найден' });
      if (typeof b.name === 'string' && b.name.trim()) o.name = b.name.trim().slice(0, 30);
      if (Array.isArray(b.perms)) o.perms = b.perms.filter(p => PERMS[p]); if (b.max !== undefined) o.max = Math.max(0, Number(b.max) || 0);
      let kill = false; if (typeof b.disabled === 'boolean') { o.disabled = b.disabled; if (b.disabled) kill = true; }
      if (typeof b.pass === 'string' && b.pass) { if (b.pass.length < 6) return json(res, 400, { error: 'Пароль от 6 символов' }); o.salt = rc(); o.hash = hash(b.pass, o.salt); kill = true; }
      if (kill) for (const t of Object.keys(db.opsess)) if (db.opsess[t] === o.login) delete db.opsess[t];
      alog('admin', 'Владелец изменил оператора «' + o.login + '»' + (typeof b.disabled === 'boolean' ? (b.disabled ? ': отключил доступ' : ': включил доступ') : '') + (b.pass ? ': сменил пароль' : '') + (Array.isArray(b.perms) ? ': права = ' + (o.perms.map(p => PERMS[p]).join(', ') || 'нет') : '') + (b.max !== undefined ? ': лимит ' + (o.max || 'нет') : ''), [], 'op:owner'); save(); return json(res, 200, { ok: 1 });
    }
    if (a === 'opdel' && op.owner) {
      const i = db.ops.findIndex(x => x.login === low(b.login)); if (i < 0) return json(res, 400, { error: 'Оператор не найден' }); const l = db.ops[i].login; db.ops.splice(i, 1);
      for (const t of Object.keys(db.opsess)) if (db.opsess[t] === l) delete db.opsess[t]; alog('admin', 'Владелец удалил оператора «' + l + '»', [], 'op:owner'); save(); return json(res, 200, { ok: 1 });
    }
    if (a === 'delmsg') { db.msgs = db.msgs.filter(m => m.id !== b.id && m.post !== b.id); save(); broadcast({ t: 'del', id: b.id }); return json(res, 200, { ok: 1 }); }
    if (a === 'nft') {
      const h = low(b.h).trim(), price = Math.trunc(Number(b.price));
      if (!/^[a-z0-9_]{3,20}$/.test(h) || !(price >= 0) || isTaken(h)) return json(res, 400, { error: 'Занято или неверно' });
      db.nfts.push({ h, price, owner: null }); save(); broadcast({ t: 'nfts', list: nftList() }); return json(res, 200, { ok: 1 });
    }
    if (a === 'gift') {
      const price = Math.trunc(Number(b.price)), sup = Math.max(0, Math.trunc(Number(b.supply) || 0)), fname = String(b.fname || 'x.png').toLowerCase(), ext = fname.split('.').pop();
      if (!b.name || !(price > 0) || !b.data) return json(res, 400, { error: 'Нужны название, цена и файл' });
      let buf = Buffer.from(String(b.data).split(',').pop(), 'base64'); if (buf.length > 7e6) return json(res, 400, { error: 'Файл больше 7 МБ' });
      let lottie = null, img = '/a/g-anim.png', file;
      if (ext === 'tgs' || ext === 'json') {
        try { if (ext === 'tgs') buf = zlib.gunzipSync(buf); JSON.parse(buf.toString()); } catch { return json(res, 400, { error: 'Файл анимации повреждён' }); }
        file = 'g' + rc() + '.json'; lottie = '/u/' + file;
      } else if (['png', 'gif', 'webp', 'jpg', 'jpeg'].includes(ext)) { file = 'g' + rc() + '.' + (ext === 'jpeg' ? 'jpg' : ext); img = '/u/' + file; }
      else return json(res, 400, { error: 'Нужен .tgs, .json, .png, .gif или .webp' });
      fs.writeFileSync(path.join(UP, file), buf);
      let id = low(b.slug).replace(/[^a-z0-9]/g, '').slice(0, 20); if (!id || db.catalog[id]) id = 'g' + db.nextId++;
      const name = String(b.name).slice(0, 30);
      db.catalog[id] = { n: name, p: price, s: sup, sold: 0, img, lottie, on: true, up: { enabled: true, cost: Math.max(0, Math.trunc(Number(b.cost) || 50)), name: String(b.uname || name).slice(0, 30), models: [], count: 0 } };
      save(); broadcast({ t: 'catalog', catalog: pubCat() }); return json(res, 200, { id });
    }
    if (a === 'giftset') {
      const c = db.catalog[b.gid]; if (!c) return json(res, 400, { error: 'Подарок не найден' });
      if (typeof b.on === 'boolean') c.on = b.on; if (typeof b.upEnabled === 'boolean') c.up.enabled = b.upEnabled;
      if (b.cost !== undefined && Number.isFinite(Number(b.cost))) c.up.cost = Math.max(0, Math.trunc(Number(b.cost)));
      if (typeof b.uname === 'string' && b.uname.trim()) c.up.name = b.uname.trim().slice(0, 30);
      save(); broadcast({ t: 'catalog', catalog: pubCat() }); return json(res, 200, { ok: 1 });
    }
    if (a === 'upinfo') return json(res, 200, { backdrops: db.backdrops.map(x => Object.assign({ pct: pct(db.backdrops, x) }, x)), patterns: db.patterns.map(x => Object.assign({ pct: pct(db.patterns, x) }, x)) });
    if (a === 'grantgift') {
      const k = resolveUser(b.who) || Object.keys(db.users).find(x => String(db.users[x].id) === String(b.who).trim()), c = db.catalog[b.gid];
      if (!k || !c) return json(res, 400, { error: 'Пользователь или подарок не найден' });
      const up = rollUp(c, { model: b.model && b.model !== 'random' ? b.model : undefined, bg: b.bg && b.bg !== 'random' ? b.bg : undefined, pat: b.pat && b.pat !== 'random' ? b.pat : undefined });
      if (!up) return json(res, 400, { error: 'Модель, фон или узор не найдены' });
      const inst = { id: db.nextId++, gid: b.gid, serial: 0, owner: k, from: 'MiniGram', ts: Date.now(), note: '', listed: 0, up }; db.gifts.push(inst); save();
      sendTo(k, { t: 'ok', text: 'Вам выдан подарок «' + up.name + ' #' + up.num + '»' }); sendTo(k, { t: 'me', p: profile(k, k) });
      return json(res, 200, { id: inst.id, name: up.name + ' #' + up.num, link: 'gift/' + b.gid + '-' + up.num });
    }
    if (a === 'grantnft') {
      const k = resolveUser(b.who) || Object.keys(db.users).find(x => String(db.users[x].id) === String(b.who).trim()), h = low(b.h).replace(/^@/, '').trim();
      if (!k) return json(res, 400, { error: 'Пользователь не найден' });
      if (!/^[a-z0-9_]{3,20}$/.test(h)) return json(res, 400, { error: 'Неверный юзернейм (a-z, 0-9, _, 3-20)' });
      let x = db.nfts.find(y => y.h === h);
      if (x && x.owner) return json(res, 400, { error: 'Этот юзернейм уже занят' });
      if (!x && isTaken(h)) return json(res, 400, { error: 'Этот юзернейм уже занят' });
      if (!x) { x = { h, price: 0 }; db.nfts.push(x); }
      const tonP = Number(b.ton) || 0; Object.assign(x, { owner: k, ts: Number(b.ts) || Date.now(), ton: tonP, usd: Number(b.usd) || usdOf(tonP) });
      const u2 = db.users[k]; u2.nft.push(h); if (!u2.handle) u2.handle = h;
      save(); broadcast({ t: 'nfts', list: nftList() }); broadcast({ t: 'user', user: pub(k, u2) }); sendTo(k, { t: 'me', p: profile(k, k) }); sendTo(k, { t: 'ok', text: 'Вам выдан юзернейм @' + h });
      return json(res, 200, { ok: 1 });
    }
    if (a === 'grantnum') {
      const k = resolveUser(b.who) || Object.keys(db.users).find(x => String(db.users[x].id) === String(b.who).trim()), ph = norm(b.num);
      if (!k) return json(res, 400, { error: 'Пользователь не найден' });
      if (!/^\+\d{5,15}$/.test(ph)) return json(res, 400, { error: 'Номер в формате +888... (5-15 цифр)' });
      if (findPhone(ph)) return json(res, 400, { error: 'Этот номер уже занят' });
      const tonP = Number(b.ton) || 0; db.users[k].numbers.push({ num: String(b.num).trim(), ts: Number(b.ts) || Date.now(), ton: tonP, usd: Number(b.usd) || usdOf(tonP) }); save();
      sendTo(k, { t: 'me', p: profile(k, k) }); sendTo(k, { t: 'ok', text: 'Вам выдан анонимный номер ' + String(b.num).trim() });
      return json(res, 200, { ok: 1 });
    }
    if (a === 'wallet') {
      const k = resolveUser(b.who) || Object.keys(db.users).find(x => String(db.users[x].id) === String(b.who).trim()), n = Number(b.amount);
      if (!k || !Number.isFinite(n) || n === 0 || Math.abs(n) > 1e9) return json(res, 400, { error: 'Проверьте поля' });
      const u2 = db.users[k]; u2.ton = Math.max(0, Math.round((u2.ton + n) * 1e6) / 1e6); u2.wh.unshift({ ts: Date.now(), text: 'Админ', amount: n, cur: 'ton' }); u2.wh.length = Math.min(u2.wh.length, 60); save(); sendTo(k, { t: 'wstate', w: wstate(k) });
      return json(res, 200, { name: k, balance: u2.ton });
    }
    if (a === 'domain') {
      const name = low(b.name).trim(), price = Number(b.price);
      if (!/^[a-z0-9-]{1,30}\.ton$/.test(name) || !(price >= 0) || db.domains.some(d => d.name === name)) return json(res, 400, { error: 'Домен занят или неверный (пример: 666.ton)' });
      db.domains.push({ name, price, owner: null, ts: 0 }); save(); return json(res, 200, { ok: 1 });
    }
    if (a === 'domdel') { const i = db.domains.findIndex(d => d.name === low(b.name)); if (i < 0) return json(res, 400, { error: 'Домен не найден' }); db.domains.splice(i, 1); save(); return json(res, 200, { ok: 1 }); }
    if (a === 'auction') {
      const h = low(b.h).replace(/^@/, '').trim(), start = Number(b.start), hours = Number(b.hours) || 24;
      if (!/^[a-z0-9_]{3,20}$/.test(h) || !(start >= 0) || db.auctions.some(x => x.h === h && !x.done)) return json(res, 400, { error: 'Неверный юзернейм или аукцион уже идёт' });
      let x = db.nfts.find(y => y.h === h); if (x && x.owner) return json(res, 400, { error: 'Юзернейм занят' }); if (!x && isTaken(h)) return json(res, 400, { error: 'Юзернейм занят' });
      if (!x) db.nfts.push({ h, price: 0, owner: null, ts: Date.now(), hold: true }); else x.hold = true;
      db.auctions.push({ h, start, end: Date.now() + hours * 3600e3, bids: [], done: false }); save(); broadcast({ t: 'nfts', list: nftList() }); return json(res, 200, { ok: 1 });
    }
    if (a === 'broadcast') {
      const text = String(b.text || '').trim().slice(0, 2000); if (!text) return json(res, 400, { error: 'Введите текст рассылки' });
      let n = 0; for (const [k] of humans) { if (db.users[k].banned) continue; supportSend(k, text); n++; }
      if (b.channel) { const msg = { id: db.nextId++, chat: 'official', from: 'MiniGram', text, ts: Date.now() }; db.msgs.push(msg); toChat('official', { t: 'msg', msg }); }
      save(); return json(res, 200, { ok: 1, sent: n });
    }
    if (a === 'support') {
      const out = [];
      for (const [k, x] of humans) { const chat = dmId(SUP, k), ms = db.msgs.filter(m => m.chat === chat); const incoming = ms.filter(m => m.from === k); if (!incoming.length) continue; const last = ms[ms.length - 1]; out.push({ name: k, id: x.id, username: x.username, last: last.text || '[файл]', ts: last.ts, fromUser: last.from === k, count: incoming.length }); }
      return json(res, 200, out.sort((p, q) => q.ts - p.ts));
    }
    if (a === 'supthread') {
      const k = keyOf(new URLSearchParams(req.url.split('?')[1] || '').get('u')); if (!k) return json(res, 404, { error: 'Игрок не найден' });
      return json(res, 200, db.msgs.filter(m => m.chat === dmId(SUP, k)).slice(-100).map(m => ({ id: m.id, mine: m.from === SUP, text: m.text || (m.file ? '[файл] ' + m.file.name : ''), ts: m.ts })));
    }
    if (a === 'supreply') {
      const k = keyOf(b.who), text = String(b.text || '').trim().slice(0, 2000); if (!k || !text) return json(res, 400, { error: 'Нет игрока или текста' });
      supportSend(k, text); save(); return json(res, 200, { ok: 1 });
    }
        const who = String(b.who || '').trim(), key = Object.keys(db.users).find(k => !db.users[k].bot && (k === who || String(db.users[k].id) === who));
    if (a === 'stars') {
      const n = Math.trunc(Number(b.amount)); if (!Number.isFinite(n) || n === 0 || Math.abs(n) > 1e9) return json(res, 400, { error: 'bad' });
      const targets = who === 'all' ? humans.map(([k]) => k) : key ? [key] : []; if (!targets.length) return json(res, 400, { error: 'bad' });
      for (const k of targets) { const usr = db.users[k]; usr.stars = Math.max(0, usr.stars + n); addHist(usr, n, 'Админ'); pushWallet(k); } save();
      return json(res, 200, { users: targets.length, stars: key ? db.users[key].stars : undefined });
    }
    if (a === 'rating') {
      const n = Math.trunc(Number(b.amount)); if (!Number.isFinite(n) || n === 0 || Math.abs(n) > 1e9) return json(res, 400, { error: 'bad' });
      const targets = who === 'all' ? humans.map(([k]) => k) : key ? [key] : []; if (!targets.length) return json(res, 400, { error: 'bad' });
      for (const k of targets) { const usr = db.users[k]; usr.rating = Math.max(0, (usr.rating || 0) + n); sendTo(k, { t: 'me', p: profile(k, k) }); } save();
      return json(res, 200, { users: targets.length, rating: key ? db.users[key].rating : undefined });
    }
    if (a === 'verifnew') {
      const name = String(b.name || '').trim().slice(0, 30), text = String(b.text || '').trim().slice(0, 80), fname = String(b.fname || 'x.png').toLowerCase(), ext = fname.split('.').pop();
      if (!name || !b.data) return json(res, 400, { error: 'Нужны название и картинка' });
      if (!['png', 'jpg', 'jpeg', 'webp', 'gif'].includes(ext)) return json(res, 400, { error: 'Нужна картинка PNG, JPG, WEBP или GIF' });
      const buf = Buffer.from(String(b.data).split(',').pop(), 'base64'); if (!buf.length || buf.length > 2e6) return json(res, 400, { error: 'Картинка до 2 МБ' });
      const file = 'v' + rc() + '.' + (ext === 'jpeg' ? 'jpg' : ext); fs.writeFileSync(path.join(UP, file), buf);
      const v = { id: 'v' + db.nextId++, name, text, img: '/u/' + file }; db.verifs.push(v); save(); return json(res, 200, { id: v.id });
    }
    if (a === 'verifgive') {
      const v = db.verifs.find(x => x.id === b.id); if (!v) return json(res, 400, { error: 'Верификация не найдена' });
      const targets = who === 'all' ? humans.map(([k]) => k) : key ? [key] : []; if (!targets.length) return json(res, 400, { error: 'Пользователь не найден' });
      for (const k of targets) { const usr = db.users[k]; usr.cverif = (usr.cverif || []).filter(x => x !== v.id); if (b.on !== false) usr.cverif.push(v.id); broadcast({ t: 'user', user: pub(k, usr) }); sendTo(k, { t: 'me', p: profile(k, k) }); }
      save(); return json(res, 200, { users: targets.length });
    }
    if (a === 'verifdel') {
      const i = db.verifs.findIndex(x => x.id === b.id); if (i < 0) return json(res, 400, { error: 'Не найдено' });
      const [v] = db.verifs.splice(i, 1); for (const [k, usr] of humans) if ((usr.cverif || []).includes(v.id)) { usr.cverif = usr.cverif.filter(x => x !== v.id); broadcast({ t: 'user', user: pub(k, usr) }); sendTo(k, { t: 'me', p: profile(k, k) }); }
      save(); return json(res, 200, { ok: 1 });
    }
    if (a === 'resetall') {
      if (b.confirm !== 'ОБНУЛИТЬ') return json(res, 400, { error: 'Нужно подтверждение' });
      for (const [k, usr] of humans) { Object.assign(usr, { stars: 0, hist: [], rating: 0, ton: 0, wh: [], pins: [], wear: null }); }
      db.gifts = []; db.msgs = db.msgs.filter(x => !x.gift);
      for (const g of Object.values(db.catalog)) { g.sold = 0; if (g.up) g.up.count = 0; }
      for (const d of db.domains) d.owner = null; db.domains = db.domains.filter(d => d.price > 0 || d.owner);
      for (const x of db.nfts) x.tonPrice = 0;
      for (const x of db.auctions) if (!x.done) x.bids = [];
      for (const c of db.chats) c.balance = 0;
      save();
      broadcast({ t: 'catalog', catalog: pubCat() }); broadcast({ t: 'nfts', list: nftList() });
      for (const [k] of humans) { sendTo(k, { t: 'me', p: profile(k, k) }); pushWallet(k); sendTo(k, { t: 'wstate', w: wstate(k) }); sendTo(k, { t: 'ok', text: 'Администрация обнулила балансы и прогресс. Юзернеймы и номера остались' }); }
      return json(res, 200, { users: humans.length });
    }
    if (!key) return json(res, 400, { error: 'Пользователь не найден' });
    const usr = db.users[key];
    if (a === 'ban') { usr.banned = !!b.banned; save(); if (b.banned) kick(key); return json(res, 200, { ok: 1 }); }
    if (a === 'resetsessions') { for (const t of Object.keys(db.sessions)) if (db.sessions[t] === key) delete db.sessions[t]; kick(key); save(); return json(res, 200, { ok: 1 }); }
    if (a === 'phone') {
      const ph = norm(b.phone), c = checkPhone(ph); if (c.error) return json(res, 400, { error: c.error });
      const o = findPhone(ph); if (o && o !== key) return json(res, 400, { error: 'Номер уже занят' });
      usr.phone = ph; save(); return json(res, 200, { ok: 1, phone: ph });
    }
    if (a === 'freeze') { usr.frozen = { reason: String(b.reason || '').slice(0, 200), ts: Date.now() }; save(); broadcast({ t: 'user', user: pub(key, usr) }); sendTo(key, { t: 'frozen', frozen: usr.frozen, appealed: false }); return json(res, 200, { ok: 1 }); }
    if (a === 'unfreeze') { usr.frozen = null; db.appeals = db.appeals.filter(x => x.user !== key); save(); broadcast({ t: 'user', user: pub(key, usr) }); sendTo(key, { t: 'frozen', frozen: null }); return json(res, 200, { ok: 1 }); }
    if (a === 'delete') { deleteUser(key); return json(res, 200, { ok: 1 }); }
    if (a === 'verify') { usr.verif = !!b.verif; usr.dev = !!b.dev; save(); broadcast({ t: 'user', user: pub(key, usr) }); return json(res, 200, { ok: 1 }); }
    return json(res, 404, {});
  }
  if (req.method === 'POST' && u === '/api/sendcode') {
    const { phone } = await body(req), ph = norm(phone); let region = '';
    if (!findPhone(ph)) { const c = checkPhone(ph); if (c.error) return json(res, 400, { error: c.error }); region = c.region; }
    const code = String(crypto.randomInt(10000, 100000)); codes[ph] = { code, exp: Date.now() + 5 * 60e3 };
    const ex = findPhone(ph);
    if (ex) { // код приходит в чат «Поддержка MiniGram» (+4277) на устройство, где уже выполнен вход
      if (db.users[ex].banned) return json(res, 403, { error: 'Аккаунт заблокирован' });
      supportSend(ex, 'Код для входа в MiniGram: ' + code + '\n\nНикому не говорите этот код, даже сотрудникам поддержки. Действует 5 минут. Если вы не запрашивали вход, просто проигнорируйте это сообщение.', { code: 1 }); save();
      // нет SMS-провайдера: если аккаунт сейчас ни на одном устройстве не в сети, увидеть код в чате негде — показываем на экране (отключается CODE_FALLBACK=0)
      const offline = ![...online.values()].includes(ex) && process.env.CODE_FALLBACK !== '0';
      return json(res, 200, { phone: ph, viaSupport: true, support: SUP_NAME, supportPhone: SUP_PHONE, code: offline ? code : undefined });
    }
    return json(res, 200, { phone: ph, code, region, support: SUP_NAME }); // новый номер: чата ещё нет, поэтому код показываем на экране
  }
  if (req.method === 'POST' && u === '/api/verify') {
    const { phone, code, name, pw } = await body(req), c = codes[phone];
    if (!c || c.exp < Date.now() || c.code !== String(code).trim()) return json(res, 401, { error: 'Неверный код' });
    let key = findPhone(phone);
    if (key && db.users[key].twofa) {
      const f = fails[key] || { n: 0, t: 0 }; if (Date.now() - f.t > 6e5) f.n = 0;
      if (f.n >= 5) return json(res, 429, { error: 'Слишком много попыток, подожди 10 минут' });
      if (!pw) return json(res, 200, { need2fa: true });
      const tf = db.users[key].twofa;
      if (hash(String(pw), tf.salt) !== tf.hash) { f.n++; f.t = Date.now(); fails[key] = f; return json(res, 401, { error: 'Неверный облачный пароль' }); }
    }
    if (!key) {
      if (!name) return json(res, 200, { needName: true });
      if (!NAME.test(name) || isTaken(name)) return json(res, 400, { error: 'Имя занято или неверное (a-z, 0-9, _, 3-20)' });
      key = name; db.users[key] = newUser({ phone, username: name }, key); syncOfficial(); alog('account', 'Новый игрок ' + nm(key) + ' зарегистрировался', [key], key); save();
    }
    if (db.users[key].banned) return json(res, 403, { error: 'Аккаунт заблокирован' });
    delete codes[phone]; return login(res, key);
  }
  if (req.method === 'POST' && u === '/api/login') {
    const { name, pass } = await body(req), usr = Object.hasOwn(db.users, name) ? db.users[name] : null;
    if (!usr || !usr.hash || typeof pass !== 'string' || usr.hash !== hash(pass, usr.salt)) return json(res, 401, { error: 'Неверное имя или пароль' });
    if (usr.banned) return json(res, 403, { error: 'Аккаунт заблокирован' });
    return login(res, name);
  }
  json(res, 404, { error: 'not found' });
}
const server = http.createServer((req, res) => { route(req, res).catch(e => { console.error(e); if (!res.headersSent) json(res, 500, { error: 'server' }); }); });

const q0 = q => low(String(q || '').trim()).replace(/^https?:\/\/[^/]+\//, '').replace(/^minigram\//, '').replace(/^[@/]+/, '');
const wss = new WebSocketServer({ server });
wss.on('connection', ws => {
  let wOK = false;
  ws.on('message', raw => {
    let m; try { m = JSON.parse(raw); } catch { return; }
    if (m.t === 'auth') {
      const n = db.sessions[m.token], usr = db.users[n];
      if (!usr || usr.banned) { send(ws, { t: 'kick' }); return ws.close(); }
      online.set(ws, n); wOK = !!usr.wallet;
      send(ws, { t: 'init', me: n, id: usr.id, users: [n, ...usr.dms].filter(k => db.users[k]).map(k => pub(k, db.users[k])), chats: db.chats.filter(c => c.members.includes(n)).map(c => chatInfo(c, n)),
        catalog: pubCat(), last: lastMap(n), contacts: usr.contacts, nfts: nftList(), badges: BADGES, frozen: usr.frozen, appealed: db.appeals.some(a => a.user === n) });
      send(ws, { t: 'me', p: profile(n, n) }); return send(ws, wallet(n));
    }
    const me = online.get(ws); if (!me) return;
    const mine = db.users[me], err = text => send(ws, { t: 'err', text });
    if (mine.banned) { send(ws, { t: 'kick' }); return ws.close(); }
    if (mine.frozen && !['appeal', 'profile', 'hist', 'read', 'find', 'link', 'members'].includes(m.t)) return err('Аккаунт заморожен');
    if (m.t === 'appeal') {
      if (!mine.frozen || db.appeals.some(a => a.user === me)) return;
      db.appeals.push({ user: me, text: String(m.text || '').slice(0, 500), ts: Date.now() }); save(); return send(ws, { t: 'frozen', frozen: mine.frozen, appealed: true });
    }
    if (m.t === 'hist' && canSee(m.chat, me)) { const cnt = {}; for (const x of db.msgs) if (x.post && x.chat === m.chat) cnt[x.post] = (cnt[x.post] || 0) + 1; const ms = db.msgs.filter(x => x.chat === m.chat && !x.post).slice(-50).map(x => cnt[x.id] ? Object.assign({}, x, { cc: cnt[x.id] }) : x), us = {}; for (const x of ms) if (db.users[x.from]) us[x.from] = pub(x.from, db.users[x.from]); return send(ws, { t: 'hist', chat: m.chat, msgs: ms.map(x => viewMsg(x, me)), users: us }); }
    if (m.t === 'msg' && canSee(m.chat, me)) {
      const isDm = m.chat.startsWith('dm:'), ch = isDm ? null : getChat(m.chat);
      if (ch && ch.type === 'channel' && !['owner', 'admin'].includes(role(ch, me))) return err('В канале пишут только администраторы');
      const peer = isDm ? members(m.chat).find(x => x !== me) : null;
      if (isDm && !db.users[peer]) return err('Пользователь недоступен');
      if (isDm && db.users[peer].blocked.includes(me)) return err('Пользователь ограничил вам доступ к сообщениям');
      if (isDm && mine.blocked.includes(peer)) return err('Вы заблокировали этого пользователя. Разблокируйте его в профиле');
      const text = typeof m.text === 'string' ? m.text.slice(0, 2000) : '';
      let file = null;
      if (m.file && /^\/u\/[a-f0-9]{16}\.[a-z0-9]{1,5}$/.test(String(m.file.url))) file = { url: m.file.url, name: String(m.file.name || 'file').slice(0, 100), kind: ['image', 'video', 'audio'].includes(m.file.kind) ? m.file.kind : 'file', size: Number(m.file.size) || 0 };
      if (!text.trim() && !file) return;
      const msg = { id: db.nextId++, chat: m.chat, from: me, text, ts: Date.now() }; if (file) msg.file = file;
      if (m.voice === true && file && file.kind === 'audio') msg.voice = true; if (m.circle === true && file && file.kind === 'video') msg.circle = true;
      if (m.reply) { const o = db.msgs.find(y => y.id === m.reply && y.chat === m.chat); if (o) msg.reply = { id: o.id, from: o.from, text: (o.text || (o.file ? '[файл]' : o.gift ? '[подарок]' : '')).slice(0, 80) }; }
      if (m.fwd && typeof m.fwd.from === 'string') msg.fwd = { from: m.fwd.from.slice(0, 40) };
      if (ch && ch.prefixes[me]) msg.pre = ch.prefixes[me];
      if (isDm && peer === BOT) msg.read = true;
      db.msgs.push(msg); if (db.msgs.length > 30000) db.msgs.shift();
      if (isDm) ensureDm(me, peer);
      toChat(m.chat, { t: 'msg', msg, u: pub(me, mine) });
      if (isDm && peer === BOT) { const rep = { id: db.nextId++, chat: m.chat, from: BOT, text: '67', ts: Date.now() }; db.msgs.push(rep); toChat(m.chat, { t: 'msg', msg: rep, u: pub(BOT, db.users[BOT]) }); }
      save(); return;
    }
    if (m.t === 'comments') {
      const post = db.msgs.find(x => x.id === m.post && !x.post), ch = post && !post.chat.startsWith('dm:') && getChat(post.chat);
      if (!post || !ch || ch.type !== 'channel' || !ch.members.includes(me)) return err('Пост не найден');
      const list = db.msgs.filter(x => x.post === post.id).slice(-150), us = {}; for (const x of list) if (db.users[x.from]) us[x.from] = pub(x.from, db.users[x.from]);
      return send(ws, { t: 'comments', post: viewMsg(post, me), chat: ch.id, on: ch.comments !== false, msgs: list, users: us });
    }
    if (m.t === 'cmsg') {
      const post = db.msgs.find(x => x.id === m.post && !x.post), ch = post && !post.chat.startsWith('dm:') && getChat(post.chat);
      if (!post || !ch || ch.type !== 'channel' || !ch.members.includes(me)) return err('Пост не найден');
      if (ch.comments === false) return err('Комментарии в этом канале отключены');
      const text = typeof m.text === 'string' ? m.text.trim().slice(0, 1000) : ''; if (!text) return;
      const msg = { id: db.nextId++, chat: ch.id, post: post.id, from: me, text, ts: Date.now() };
      if (m.reply) { const o = db.msgs.find(y => y.id === m.reply && y.post === post.id); if (o) msg.reply = { id: o.id, from: o.from, text: o.text.slice(0, 80) }; }
      if (ch.prefixes[me]) msg.pre = ch.prefixes[me];
      db.msgs.push(msg); if (db.msgs.length > 30000) db.msgs.shift(); save();
      return toChat(ch.id, { t: 'cmsg', msg, u: pub(me, mine), n: db.msgs.filter(y => y.post === post.id).length });
    }
    if (m.t === 'read' && typeof m.chat === 'string' && m.chat.startsWith('dm:') && canSee(m.chat, me)) {
      const ids = []; for (const x of db.msgs) if (x.chat === m.chat && x.from !== me && !x.read) { x.read = true; ids.push(x.id); }
      if (ids.length) { save(); for (const [w, n] of online) if (n !== me && canSee(m.chat, n)) send(w, { t: 'read', chat: m.chat, ids }); }
      return;
    }
    if (m.t === 'send') {
      const n = Math.trunc(Number(m.amount)), to = resolveUser(m.to);
      if (!to || to === me) return err('Получатель не найден: введите логин или @username');
      if (!Number.isFinite(n) || n <= 0 || n > mine.stars) return err('Проверьте сумму и баланс');
      mine.stars -= n; db.users[to].stars += n; addHist(mine, -n, 'Кому: ' + db.users[to].username); addHist(db.users[to], n, 'От: ' + mine.username); alog('stars', 'Игрок ' + nm(me) + ' перевёл ' + n + ' ⭐ игроку ' + nm(to), [me, to], me);
      save(); pushWallet(me); pushWallet(to); return;
    }
    if (m.t === 'profile') {
      const q = low(m.name), key = Object.hasOwn(db.users, m.name) ? m.name : Object.keys(db.users).find(k => low(k) === q || low(db.users[k].username) === q || low(db.users[k].handle) === q);
      return key ? send(ws, { t: 'profile', p: profile(key, me) }) : err('Не найдено');
    }
    if (m.t === 'find' || m.t === 'link') {
      const q = q0(m.q || m.key); if (!q) return;
      const us = [], cs = [];
      if (q.startsWith('+')) { const c = db.chats.find(x => '+' + x.invite === q); if (c) cs.push(Object.assign(chatInfo(c, me), { inviteKey: q })); }
      else {
        for (const [k, u] of Object.entries(db.users)) if (low(k) === q || low(u.username) === q || low(u.handle) === q) us.push(pub(k, u));
        for (const c of db.chats) if (!c.private && low(c.username) === q) cs.push(chatInfo(c, me));
      }
      return send(ws, { t: 'found', users: us, chats: cs, open: m.t === 'link' });
    }
    if (m.t === 'setprofile') {
      if (typeof m.title === 'string') mine.title = m.title.trim().slice(0, 30);
      if (typeof m.bio === 'string') mine.bio = m.bio.trim().slice(0, 140);
      if (typeof m.birthday === 'string' && (m.birthday === '' || (/^\d{4}-\d{2}-\d{2}$/.test(m.birthday) && m.birthday > '1900-01-01' && m.birthday < '2030-01-01'))) mine.birthday = m.birthday;
      if (m.bg === null || (Number.isFinite(m.bg) && m.bg >= 0 && m.bg <= 360)) mine.bg = m.bg === null ? null : Math.round(m.bg);
      if (BADGES.includes(m.badge)) mine.badge = m.badge;
      if (typeof m.username === 'string' && m.username !== mine.username) {
        const h = m.username.trim();
        if (!NAME.test(h) || isTaken(h, me)) return err('Username занят или неверный (a-z, 0-9, _, 3-20)');
        mine.username = h;
      }
      save(); broadcast({ t: 'user', user: pub(me, mine) }); return send(ws, { t: 'profile', p: profile(me, me) });
    }
    if (m.t === 'set2fa') {
      if (typeof m.pass !== 'string' || m.pass.length < 6) return err('Пароль от 6 символов');
      if (mine.twofa && hash(String(m.old || ''), mine.twofa.salt) !== mine.twofa.hash) return err('Старый пароль неверный');
      const salt = rc(); mine.twofa = { salt, hash: hash(m.pass, salt) }; save(); send(ws, { t: 'ok', text: 'Двухфакторная защита включена' }); return send(ws, { t: 'me', p: profile(me, me) });
    }
    if (m.t === 'rm2fa') {
      if (!mine.twofa || hash(String(m.pass || ''), mine.twofa.salt) !== mine.twofa.hash) return err('Пароль неверный');
      mine.twofa = null; save(); send(ws, { t: 'ok', text: 'Двухфакторная защита отключена' }); return send(ws, { t: 'me', p: profile(me, me) });
    }
    if (m.t === 'cgifts') {
      const c = getChat(m.id); if (!c || (c.private && !c.members.includes(me))) return err('Канал не найден');
      return send(ws, { t: 'cgifts', id: c.id, gifts: db.gifts.filter(x => x.owner === 'ch:' + c.id && db.catalog[x.gid]).map(giftView) });
    }
    if (m.t === 'gift' && typeof m.to === 'string' && m.to.startsWith('#ch:')) {
      const g = Object.hasOwn(db.catalog, m.gid) ? db.catalog[m.gid] : null, c = getChat(m.to.slice(4));
      if (!g || !g.on) return err('Выберите подарок из магазина');
      if (!c || (c.private && !c.members.includes(me))) return err('Канал не найден');
      if (g.s && g.sold >= g.s) return err('Этот подарок закончился');
      if (mine.stars < g.p) return err('Не хватает звёзд');
      mine.stars -= g.p; addHist(mine, -g.p, 'Подарок для «' + c.title + '»');
      g.sold++; const serial = g.s ? g.sold : 0, note = String(m.note || '').trim().slice(0, 120), anon = m.anon === true;
      const inst = { id: db.nextId++, gid: m.gid, serial, owner: 'ch:' + c.id, from: anon ? 'Аноним' : mine.username, ts: Date.now(), note, listed: 0, up: null }; db.gifts.push(inst);
      const msg = { id: db.nextId++, chat: c.id, from: me, text: '', gift: { iid: inst.id, img: g.img, lottie: g.lottie || null, n: g.n, serial, of: g.s || 0, note, anon }, ts: Date.now() };
      db.msgs.push(msg); save(); pushWallet(me);
      for (const [w, n] of online) if (c.members.includes(n)) send(w, { t: 'msg', msg: viewMsg(msg, n), u: anon && n !== me ? undefined : pub(me, mine) });
      return send(ws, { t: 'ok', text: 'Подарок «' + g.n + '» отправлен в «' + c.title + '»' });
    }
    if (m.t === 'gift') {
      const g = Object.hasOwn(db.catalog, m.gid) ? db.catalog[m.gid] : null, to = resolveUser(m.to);
      if (!g || !g.on) return err('Выберите подарок из магазина');
      if (!to) return err('Получатель не найден: введите логин или @username');
      if (g.s && g.sold >= g.s) return err('Этот подарок закончился');
      if (mine.stars < g.p) return err('Не хватает звёзд');
      mine.stars -= g.p; addHist(mine, -g.p, 'Подарок для ' + db.users[to].username); alog('gift', to === me ? 'Игрок ' + nm(me) + ' купил подарок «' + g.n + '» себе за ' + g.p + ' ⭐' : 'Игрок ' + nm(me) + ' подарил подарок «' + g.n + '» игроку ' + nm(to) + ' за ' + g.p + ' ⭐' + (m.anon === true ? ' (анонимно)' : ''), [me, to], me);
      g.sold++; const serial = g.s ? g.sold : 0, note = String(m.note || '').trim().slice(0, 120), anon = m.anon === true;
      const inst = { id: db.nextId++, gid: m.gid, serial, owner: to, from: anon ? 'Аноним' : mine.username, ts: Date.now(), note, listed: 0, up: null }; db.gifts.push(inst);
      if (to === me) { save(); pushWallet(me); send(ws, { t: 'ok', text: 'Подарок «' + g.n + '» добавлен в ваш профиль' }); return send(ws, { t: 'me', p: profile(me, me) }); }
      const msg = { id: db.nextId++, chat: 'dm:' + [me, to].sort().join('|'), from: me, text: '', gift: { iid: inst.id, img: g.img, lottie: g.lottie || null, n: g.n, serial, of: g.s || 0, note, anon }, ts: Date.now() };
      db.msgs.push(msg); ensureDm(me, to); save(); pushWallet(me);
      for (const [w, n] of online) if (members(msg.chat).includes(n)) send(w, { t: 'msg', msg: viewMsg(msg, n), u: anon && n !== me ? undefined : pub(me, mine) });
      sendTo(to, { t: 'ok', text: (anon ? 'Аноним' : mine.username) + ' подарил вам «' + g.n + '»' }); return;
    }
    if (m.t === 'buynft') {
      const x = db.nfts.find(y => y.h === m.h && !y.owner && !y.hold);
      if (!x) return err('Юзернейм недоступен'); if (mine.stars < x.price) return err('Не хватает звёзд');
      mine.stars -= x.price; addHist(mine, -x.price, 'Юзернейм @' + x.h); alog('ton', 'Игрок ' + nm(me) + ' купил юзернейм @' + x.h + ' за ' + x.price + ' ⭐', [me], me); x.owner = me; x.ts = Date.now(); mine.nft.push(x.h); if (!mine.handle) mine.handle = x.h;
      save(); pushWallet(me); broadcast({ t: 'nfts', list: nftList() }); broadcast({ t: 'user', user: pub(me, mine) });
      return send(ws, { t: 'ok', text: 'Юзернейм @' + x.h + ' теперь ваш' });
    }
    if (m.t === 'sethandle') {
      if (m.h && !mine.nft.includes(m.h)) return err('Это не ваш юзернейм');
      mine.handle = m.h || ''; save(); broadcast({ t: 'user', user: pub(me, mine) }); return send(ws, { t: 'me', p: profile(me, me) });
    }
    if (m.t === 'nftsend') {
      const x = db.nfts.find(y => y.h === m.h && y.owner === me), to = resolveUser(m.to);
      if (!x || !to || to === me) return err('Нельзя передать: проверьте получателя');
      alog('ton', 'Игрок ' + nm(me) + ' передал юзернейм @' + m.h + ' игроку ' + nm(to), [me, to], me); x.owner = to; mine.nft = mine.nft.filter(h => h !== m.h); if (mine.handle === m.h) mine.handle = ''; db.users[to].nft.push(m.h);
      save(); broadcast({ t: 'nfts', list: nftList() }); broadcast({ t: 'user', user: pub(me, mine) }); sendTo(to, { t: 'me', p: profile(to, to) }); sendTo(to, { t: 'ok', text: mine.username + ' передал вам @' + m.h });
      return send(ws, { t: 'me', p: profile(me, me) });
    }
    if (m.t === 'ginfo') { const g = db.gifts.find(x => x.id === m.id && db.catalog[x.gid]); return g ? send(ws, { t: 'ginfo', g: giftView(g) }) : err('Подарок не найден'); }
    if (m.t === 'giftlink') { const mm = /^gift\/([a-z0-9]+)-(\d+)$/.exec(low(m.key)), g = mm && db.gifts.find(x => x.gid === mm[1] && x.up && x.up.num === +mm[2]); return g ? send(ws, { t: 'ginfo', g: giftView(g) }) : err('Подарок не найден'); }
    if (m.t === 'market') return send(ws, marketMsg(typeof m.gid === 'string' && Object.hasOwn(db.catalog, m.gid) ? m.gid : null));
    if (m.t === 'sellgift') {
      const g = db.gifts.find(x => x.id === m.id && actor(x, me)), p = Math.trunc(Number(m.price));
      if (!g) return err('Это не ваш подарок'); if (!Number.isFinite(p) || p < 0 || p > 1e7) return err('Неверная цена');
      if (p > 0 && !(db.catalog[g.gid] && db.catalog[g.gid].s > 0)) return err('Подарки с неограниченным тиражом нельзя выставлять на маркет');
      if (p) { const ch = chOf(g); if (ch && ch.wear === g.id) { ch.wear = null; pushChat(ch); } if (g.owner === me) { mine.pins = mine.pins.filter(x => x !== g.id); if (mine.wear === g.id) { mine.wear = null; broadcast({ t: 'user', user: pub(me, mine) }); } } }
      alog('gift', 'Игрок ' + nm(me) + (p ? ' выставил подарок «' + gname(g) + '» на маркет за ' + p + ' ⭐' : ' снял с продажи подарок «' + gname(g) + '»'), [me], me); g.listed = p;
      save(); send(ws, { t: 'ok', text: p ? 'Выставлено за ' + p + ' зв. Вы получите ' + Math.floor(p * (1 - COMMISSION)) + ' зв. (комиссия ' + Math.round(COMMISSION * 100) + '%)' : 'Снято с продажи' });
      return send(ws, { t: 'me', p: profile(me, me) });
    }
    if (m.t === 'buygift') {
      const g = db.gifts.find(x => x.id === m.id && x.listed > 0);
      if (!g) { send(ws, marketMsg()); return err('Уже продано или снято с продажи'); } if (g.owner === me) return err('Это ваш подарок'); if (mine.stars < g.listed) return err('Не хватает звёзд');
      const old = g.owner, seller = db.users[old], sch = chOf(g), price = g.listed, gain = Math.floor(price * (1 - COMMISSION));
      mine.stars -= price; addHist(mine, -price, 'Покупка подарка'); alog('gift', 'Игрок ' + nm(me) + ' купил на маркете подарок «' + gname(g) + '» у ' + nm(old) + ' за ' + price + ' ⭐ (продавец получил ' + gain + ' ⭐, комиссия ' + (price - gain) + ' ⭐)', [me, old], me);
      if (seller) { seller.stars += gain; addHist(seller, gain, 'Продажа подарка (комиссия ' + Math.round(COMMISSION * 100) + '%)'); pushWallet(old); sendTo(old, { t: 'ok', text: 'Ваш подарок куплен: +' + gain + ' зв.' }); }
      if (sch) { sch.balance = (sch.balance || 0) + gain; }
      releaseGift(g); g.owner = me; g.listed = 0; save(); pushWallet(me); if (seller) sendTo(old, { t: 'me', p: profile(old, old) });
      send(ws, { t: 'bought', g: giftView(g) }); return send(ws, marketMsg(g.gid));
    }
    if (m.t === 'givegift') {
      const g = db.gifts.find(x => x.id === m.id && actor(x, me)), to = resolveUser(m.to);
      if (!g) return err('Это не ваш подарок'); if (!to || to === me) return err('Получатель не найден');
      alog('gift', 'Игрок ' + nm(me) + ' передал подарок «' + gname(g) + '» игроку ' + nm(to), [me, to], me); releaseGift(g); g.owner = to; g.from = mine.username; save();
      sendTo(to, { t: 'ok', text: mine.username + ' передал вам подарок «' + (g.up ? g.up.name + ' #' + g.up.num : db.catalog[g.gid].n) + '»' }); sendTo(to, { t: 'me', p: profile(to, to) });
      send(ws, { t: 'ok', text: 'Подарок передан' }); return send(ws, { t: 'me', p: profile(me, me) });
    }
    if (m.t === 'pin') {
      const g = db.gifts.find(x => x.id === m.id && x.owner === me); if (!g) return;
      mine.pins = mine.pins.filter(x => x !== g.id); if (m.on) { if (mine.pins.length >= 6) return err('Можно закрепить до 6 подарков'); mine.pins.unshift(g.id); }
      save(); return send(ws, { t: 'me', p: profile(me, me) });
    }
    if (m.t === 'wear' && m.chat) {
      const c = getChat(m.chat); if (!c || !['owner', 'admin'].includes(role(c, me))) return err('Нет прав');
      if (m.id === null) c.wear = null; else { const g = db.gifts.find(x => x.id === m.id && x.owner === 'ch:' + c.id && x.up); if (!g) return err('Носить можно только улучшенный подарок канала'); c.wear = g.id; }
      save(); return pushChat(c);
    }
    if (m.t === 'wear') {
      if (m.id === null) mine.wear = null;
      else { const g = db.gifts.find(x => x.id === m.id && x.owner === me && x.up); if (!g) return err('Носить можно только улучшенный подарок'); mine.wear = g.id; }
      save(); broadcast({ t: 'user', user: pub(me, mine) }); return send(ws, { t: 'me', p: profile(me, me) });
    }
    if (m.t === 'upgrade') {
      const g = db.gifts.find(x => x.id === m.id && actor(x, me)); if (!g || g.up) return err('Этот подарок нельзя улучшить');
      const c = db.catalog[g.gid]; if (!c.up.enabled) return err('Улучшение этого подарка недоступно');
      if (mine.stars < c.up.cost) return err('Нужно ' + c.up.cost + ' зв.');
      mine.stars -= c.up.cost; addHist(mine, -c.up.cost, 'Улучшение подарка'); g.up = rollUp(c); alog('gift', 'Игрок ' + nm(me) + ' улучшил подарок «' + c.n + '» за ' + c.up.cost + ' ⭐ → получился «' + g.up.name + ' #' + g.up.num + '»', [me], me); g.listed = 0; save(); pushWallet(me);
      const models = c.up.models.length ? c.up.models : [{ id: 'base', n: 'Классика', url: c.lottie || c.img, lottie: !!c.lottie }];
      return send(ws, { t: 'upgraded', g: giftView(g), pool: { bgs: db.backdrops, pats: db.patterns, models: models.slice(0, 40), poster: c.img } });
    }
    if (m.t === 'react') {
      const x = db.msgs.find(y => y.id === m.id);
      if (!x || !canSee(x.chat, me) || !REACTIONS.includes(m.e)) return;
      x.rx = x.rx || {}; const a = x.rx[m.e] || []; x.rx[m.e] = a.includes(me) ? a.filter(u => u !== me) : [...a, me]; if (!x.rx[m.e].length) delete x.rx[m.e];
      save(); toChat(x.chat, { t: 'rx', id: x.id, rx: x.rx }); return;
    }
    if (m.t === 'edit') {
      const x = db.msgs.find(y => y.id === m.id && y.from === me && canSee(y.chat, me)), t = typeof m.text === 'string' ? m.text.slice(0, 2000) : '';
      if (!x || x.gift || !t.trim()) return err('Нельзя изменить сообщение'); x.text = t; x.edited = true; save(); return toChat(x.chat, { t: 'edit', id: x.id, text: t });
    }
    if (m.t === 'delmsg') {
      const x = db.msgs.find(y => y.id === m.id); if (!x || !canSee(x.chat, me)) return;
      const c = x.chat.startsWith('dm:') ? null : getChat(x.chat), r = c && role(c, me);
      if (x.from !== me && !(r === 'owner' || r === 'admin')) return err('Нет прав удалить это сообщение');
      db.msgs = db.msgs.filter(y => y.id !== x.id && y.post !== x.id); save(); toChat(x.chat, { t: 'del', id: x.id }); if (x.post) toChat(x.chat, { t: 'cc', id: x.post, n: db.msgs.filter(y => y.post === x.post).length }); return;
    }
    if (m.t === 'block') { const k = resolveUser(m.user); if (!k || k === me) return; mine.blocked = mine.blocked.filter(x => x !== k); if (m.on) mine.blocked.push(k); alog('account', 'Игрок ' + nm(me) + (m.on ? ' заблокировал ' : ' разблокировал ') + nm(k), [me, k], me); save(); send(ws, { t: 'ok', text: m.on ? 'Пользователь заблокирован' : 'Пользователь разблокирован' }); return send(ws, { t: 'me', p: profile(me, me) }); }
    if (m.t === 'report') { const k = resolveUser(m.user); if (!k) return; alog('account', 'Игрок ' + nm(me) + ' пожаловался на ' + nm(k) + ': «' + String(m.reason || 'без причины').slice(0, 120) + '»', [me, k], me); db.reports.push({ ts: Date.now(), from: me, user: k, reason: String(m.reason || '').slice(0, 300) }); save(); return send(ws, { t: 'ok', text: 'Жалоба отправлена модераторам' }); }
    if (m.t === 'setavatar') {
      if (m.url === '') mine.avatar = ''; else if (/^\/u\/[a-f0-9]{16}\.(png|jpg|jpeg|webp|gif)$/.test(String(m.url))) mine.avatar = m.url; else return err('Нужна картинка');
      save(); broadcast({ t: 'user', user: pub(me, mine) }); return send(ws, { t: 'profile', p: profile(me, me) });
    }
    if (m.t === 'contact') {
      const k = resolveUser(m.user); if (!k || k === me) return; const nm = String(m.name || '').trim().slice(0, 30);
      if (m.on === false) delete mine.contacts[k]; else mine.contacts[k] = nm || db.users[k].username; save(); return send(ws, { t: 'contacts', c: mine.contacts });
    }
    if (m.t === 'numsend') {
      const i = mine.numbers.findIndex(x => norm(x.num) === norm(m.num)), to = resolveUser(m.to);
      if (i < 0 || !to || to === me) return err('Нельзя передать номер'); if (mine.wearnum && norm(mine.wearnum) === norm(m.num)) mine.wearnum = null; alog('ton', 'Игрок ' + nm(me) + ' передал анонимный номер ' + mine.numbers[i].num + ' игроку ' + nm(to), [me, to], me); db.users[to].numbers.push(mine.numbers.splice(i, 1)[0]); save();
      sendTo(to, { t: 'me', p: profile(to, to) }); sendTo(to, { t: 'ok', text: 'Вам передан номер от ' + mine.username }); return send(ws, { t: 'me', p: profile(me, me) });
    }
    if (m.t === 'top') {
      const list = Object.entries(db.users).filter(([, u]) => !u.bot && !u.banned).map(([k, u]) => ({ name: k, rating: u.rating || 0 })).sort((a, b) => b.rating - a.rating).slice(0, 30);
      const mineRank = Object.entries(db.users).filter(([, u]) => !u.bot && !u.banned && (u.rating || 0) > (mine.rating || 0)).length + 1;
      return send(ws, { t: 'top', list: list.map(x => ({ u: pub(x.name, db.users[x.name]), rating: x.rating })), me: { rating: mine.rating || 0, rank: mineRank } });
    }
    if (m.t === 'numwear') {
      if (m.num === null || m.num === undefined || m.num === '') { mine.wearnum = null; save(); send(ws, { t: 'ok', text: 'Анонимный номер снят — в профиле снова ваш обычный номер' }); return send(ws, { t: 'me', p: profile(me, me) }); }
      const n = mine.numbers.find(x => norm(x.num) === norm(m.num)); if (!n) return err('Это не ваш анонимный номер');
      mine.wearnum = n.num; save(); send(ws, { t: 'ok', text: 'Номер ' + n.num + ' надет — теперь он виден в профиле' }); return send(ws, { t: 'me', p: profile(me, me) });
    }
    // ---- кошелёк, Fragment ----
    if (m.t === 'wstate') return send(ws, { t: 'wstate', w: wstate(me) });
    if (m.t === 'wcreate') {
      const nick = low(m.nick).trim();
      if (mine.wallet) return err('Кошелёк уже создан'); if (!/^[a-z0-9_]{3,20}$/.test(nick) || Object.values(db.users).some(u => u.wallet && u.wallet.nick === nick)) return err('Ник занят или неверный (a-z, 0-9, _)');
      if (typeof m.pass !== 'string' || m.pass.length < 6) return err('Пароль кошелька от 6 символов');
      const words = Array.from({ length: 12 }, () => WORDS[crypto.randomInt(WORDS.length)]), salt = rc();
      alog('account', 'Игрок ' + nm(me) + ' создал кошелёк Fragment (ник «' + nick + '»)', [me], me); mine.wallet = { nick, salt, hash: hash(m.pass, salt), wh: hash(words.join(' '), salt) }; wOK = true; save(); send(ws, { t: 'wwords', words }); return send(ws, { t: 'wstate', w: wstate(me) });
    }
    if (m.t === 'wopen') {
      if (!mine.wallet) return err('Сначала создайте кошелёк'); const f = fails['w' + me] || { n: 0, t: 0 }; if (Date.now() - f.t > 6e5) f.n = 0; if (f.n >= 5) return err('Слишком много попыток, подождите 10 минут');
      if (hash(String(m.pass || ''), mine.wallet.salt) !== mine.wallet.hash) { f.n++; f.t = Date.now(); fails['w' + me] = f; return err('Неверный пароль кошелька'); }
      wOK = true; return send(ws, { t: 'wstate', w: wstate(me) });
    }
    if (m.t === 'wrecover') {
      if (!mine.wallet || typeof m.pass !== 'string' || m.pass.length < 6) return err('Проверьте данные');
      if (hash(String(m.words || '').trim().toLowerCase().split(/\s+/).join(' '), mine.wallet.salt) !== mine.wallet.wh) return err('Кодовые слова неверные');
      mine.wallet.hash = hash(m.pass, mine.wallet.salt); wOK = true; save(); send(ws, { t: 'ok', text: 'Пароль кошелька изменён' }); return send(ws, { t: 'wstate', w: wstate(me) });
    }
    if (['wsend', 'domsend', 'buydomain', 'bid', 'nftlist', 'nftbuy', 'domains', 'auctions', 'domquote'].includes(m.t)) {
      if (m.t === 'domquote') return send(ws, { t: 'domquote', q: domInfo(m.name, me) });
      if (m.t === 'domains') return send(ws, { t: 'domains', mine: db.domains.filter(d => d.owner === me).map(d => ({ name: d.name, ts: d.ts, price: d.price })), list: db.domains.filter(d => !d.owner).map(d => ({ name: d.name, price: d.price, usd: usdOf(d.price) })), rate: TON_USD });
      if (m.t === 'auctions') return send(ws, { t: 'auctions', list: db.auctions.filter(x => !x.done).map(x => ({ h: x.h, start: x.start, end: x.end, top: x.bids.length ? { amount: x.bids[x.bids.length - 1].amount, user: db.users[x.bids[x.bids.length - 1].user] ? db.users[x.bids[x.bids.length - 1].user].username : '' } : null })) });
      if (!mine.wallet || !wOK) return err('Откройте кошелёк (пароль) во вкладке Кошелёк');
      const addW = (u, text, amount, cur) => { u.wh.unshift({ ts: Date.now(), text, amount, cur }); u.wh.length = Math.min(u.wh.length, 60); };
      if (m.t === 'wsend') {
        const cur = 'ton', n = Math.round(Number(m.amount) * 1e6) / 1e6, to = walletOf(m.to);
        if (!to || to === me) return err(to === me ? 'Нельзя отправить самому себе' : 'Кошелёк получателя не найден. Укажите адрес или ник кошелька'); if (!(n > 0)) return err('Введите сумму больше нуля'); if (n > mine[cur]) return err('Недостаточно TON: на балансе ' + mine[cur]);
        mine[cur] = Math.round((mine[cur] - n) * 1e6) / 1e6; db.users[to][cur] = Math.round((db.users[to][cur] + n) * 1e6) / 1e6; addW(mine, 'Перевод → ' + db.users[to].wallet.nick, -n, cur); addW(db.users[to], 'Перевод ← ' + mine.wallet.nick, n, cur); alog('ton', 'Игрок ' + nm(me) + ' перевёл ' + n + ' TON игроку ' + nm(to), [me, to], me);
        save(); send(ws, { t: 'wstate', w: wstate(me) }); sendTo(to, { t: 'wstate', w: wstate(to) }); sendTo(to, { t: 'wrecv', amount: n, from: mine.wallet.nick });
        return send(ws, { t: 'wsent', via: /\.ton$/i.test(String(m.to).trim()) ? low(String(m.to).trim()) : undefined, amount: n, to: db.users[to].wallet.nick, addr: walletAddr(db.users[to]), ts: Date.now(), usd: usdOf(n), fee: 0, id: crypto.randomBytes(6).toString('hex') });
      }
      if (m.t === 'domsend') {
        const dn = low(m.name).trim(), d = db.domains.find(x => x.name === dn && x.owner === me); if (!d) return err('Это не ваш домен');
        const q = String(m.to || '').trim(), to = walletOf(q) || resolveUser(q); if (!to) return err('Получатель не найден. Укажите адрес, ник кошелька или имя игрока'); if (to === me) return err('Нельзя передать самому себе');
        d.owner = to; d.ts = Date.now(); alog('ton', 'Игрок ' + nm(me) + ' передал домен ' + d.name + ' игроку ' + nm(to), [me, to], me); save();
        send(ws, { t: 'wstate', w: wstate(me) }); sendTo(to, { t: 'wstate', w: wstate(to) }); sendTo(to, { t: 'wrecv', domain: d.name, from: mine.wallet.nick }); for (const k of [me, to]) sendTo(k, { t: 'dommine' });
        return send(ws, { t: 'domsent', name: d.name, to: db.users[to].wallet ? db.users[to].wallet.nick : db.users[to].username, addr: walletAddr(db.users[to]), ts: Date.now(), id: crypto.randomBytes(6).toString('hex') });
      }
      if (m.t === 'buydomain') {
        const q = domInfo(m.name, me); if (q.error) return err(q.error); if (q.taken) return err('Домен ' + q.name + ' уже занят');
        if (mine.ton < q.price) return err('Не хватает TON: нужно ' + q.price + ', у вас ' + mine.ton);
        mine.ton = Math.round((mine.ton - q.price) * 1e6) / 1e6; let d = db.domains.find(x => x.name === q.name); if (!d) { d = { name: q.name, price: q.price }; db.domains.push(d); }
        d.owner = me; d.ts = Date.now(); d.price = q.price; addW(mine, 'Домен ' + d.name, -q.price, 'ton'); alog('ton', 'Игрок ' + nm(me) + ' купил домен ' + d.name + ' за ' + q.price + ' TON (≈ $' + usdOf(q.price) + ')', [me], me); save(); send(ws, { t: 'wstate', w: wstate(me) }); send(ws, { t: 'domquote', q: domInfo(d.name, me) });
        send(ws, { t: 'domains', mine: db.domains.filter(x => x.owner === me).map(x => ({ name: x.name, ts: x.ts, price: x.price })), list: db.domains.filter(x => !x.owner).map(x => ({ name: x.name, price: x.price, usd: usdOf(x.price) })), rate: TON_USD });
        return send(ws, { t: 'ok', text: 'Домен ' + d.name + ' теперь ваш' });
      }
      if (m.t === 'bid') {
        const x = db.auctions.find(y => y.h === m.h && !y.done), n = Math.round(Number(m.amount) * 100) / 100; if (!x || x.end < Date.now()) return err('Аукцион завершён');
        const top = x.bids.length ? x.bids[x.bids.length - 1].amount : 0, min = top ? Math.round(top * 1.05 * 100) / 100 : x.start;
        if (!(n >= min)) return err('Минимальная ставка: ' + min + ' TON'); if (n > mine.ton) return err('Не хватает TON'); x.bids.push({ user: me, amount: n, ts: Date.now() }); alog('ton', 'Игрок ' + nm(me) + ' сделал ставку ' + n + ' TON на юзернейм @' + x.h + ' (аукцион)', [me], me);
        if (ANTISNIPE && x.end - Date.now() < ANTISNIPE) x.end += ANTISNIPE; save(); return send(ws, { t: 'ok', text: 'Ставка принята: ' + n + ' TON' });
      }
      if (m.t === 'nftlist') { const x = db.nfts.find(y => y.h === m.h && y.owner === me), p = Number(m.price); if (!x || !(p >= 0)) return err('Нельзя выставить'); alog('ton', 'Игрок ' + nm(me) + (p ? ' выставил юзернейм @' + x.h + ' на продажу за ' + p + ' TON' : ' снял с продажи юзернейм @' + x.h), [me], me); x.tonPrice = p; save(); broadcast({ t: 'nfts', list: nftList() }); return send(ws, { t: 'ok', text: p ? 'Выставлено за ' + p + ' TON' : 'Снято с продажи' }); }
      if (m.t === 'nftbuy') {
        const x = db.nfts.find(y => y.h === m.h && y.owner && y.tonPrice > 0); if (!x || x.owner === me) return err('Недоступно'); if (mine.ton < x.tonPrice) return err('Не хватает TON');
        const old = db.users[x.owner]; mine.ton = Math.round((mine.ton - x.tonPrice) * 1e6) / 1e6; old.ton = Math.round((old.ton + x.tonPrice) * 1e6) / 1e6; addW(mine, 'Юзернейм @' + x.h, -x.tonPrice, 'ton'); addW(old, 'Продажа @' + x.h, x.tonPrice, 'ton'); alog('ton', 'Игрок ' + nm(me) + ' купил юзернейм @' + x.h + ' за ' + x.tonPrice + ' TON у игрока ' + nm(x.owner), [me, x.owner], me);
        const ok2 = x.owner; old.nft = old.nft.filter(h => h !== x.h); if (old.handle === x.h) old.handle = ''; const paid = x.tonPrice; x.owner = me; x.ts = Date.now(); x.ton = paid; x.usd = usdOf(paid); x.tonPrice = 0; mine.nft.push(x.h); if (!mine.handle) mine.handle = x.h;
        save(); broadcast({ t: 'nfts', list: nftList() }); broadcast({ t: 'user', user: pub(me, mine) }); sendTo(ok2, { t: 'me', p: profile(ok2, ok2) }); sendTo(ok2, { t: 'wstate', w: wstate(ok2) }); send(ws, { t: 'me', p: profile(me, me) }); return send(ws, { t: 'wstate', w: wstate(me) });
      }
    }
    // ---- платные каналы ----
    if (m.t === 'paidreact') {
      const x = db.msgs.find(y => y.id === m.id), c = x && !x.chat.startsWith('dm:') && getChat(x.chat), n = Math.trunc(Number(m.n));
      if (!c || !c.members.includes(me) || !c.payReact) return err('Платные реакции отключены'); if (!(n >= 1 && n <= 2500) || n > mine.stars) return err('Проверьте количество звёзд');
      mine.stars -= n; addHist(mine, -n, 'Реакция в «' + c.title + '»'); alog('stars', 'Игрок ' + nm(me) + ' поставил платную реакцию на ' + n + ' ⭐ в «' + c.title + '»', [me], me); c.balance += n; x.prx = x.prx || {}; x.prx[me] = (x.prx[me] || 0) + n; save(); pushWallet(me); return toChat(x.chat, { t: 'prx', id: x.id, prx: x.prx });
    }
    if (m.t === 'withdraw') {
      const c = getChat(m.id); if (!c || c.owner !== me) return err('Только владелец'); if (c.balance < 1) return err('На балансе канала нет звёзд');
      const n = c.balance; c.balance = 0; mine.stars += n; addHist(mine, n, 'Вывод с «' + c.title + '»'); alog('stars', 'Игрок ' + nm(me) + ' вывел с баланса «' + c.title + '» ' + n + ' ⭐', [me], me); save(); pushWallet(me); pushChat(c); return send(ws, { t: 'ok', text: 'Выведено ' + n + ' зв. на ваш баланс (без комиссии)' });
    }
    // ---- чаты и каналы ----
    if (m.t === 'newchat') {
      const type = m.type === 'channel' ? 'channel' : 'group', title = String(m.title || '').trim().slice(0, 40); if (!title) return err('Введите название');
      let username = null; if (m.username) { const h = low(m.username); if (!NAME.test(h) || isTaken(h)) return err('Username занят или неверный'); username = h; }
      const c = mkChat({ id: 'c' + db.nextId++, type, title, username, private: !username, owner: me, admins: [me], members: [me] }); db.chats.push(c); alog('chat', 'Игрок ' + nm(me) + ' создал ' + (type === 'channel' ? 'канал' : 'чат') + ' «' + title + '»', [me], me); save();
      return send(ws, { t: 'chat', c: chatInfo(c, me), open: true });
    }
    if (m.t === 'join') {
      const c = m.invite ? db.chats.find(x => '+' + x.invite === m.invite) : getChat(m.id);
      if (!c || (!m.invite && c.private)) return err('Чат не найден');
      if (c.members.includes(me)) return send(ws, { t: 'chat', c: chatInfo(c, me), open: true });
      if (c.paid && c.price > 0 && !c.members.includes(me)) {
        if (m.pay !== true) return send(ws, { t: 'payreq', c: Object.assign(chatInfo(c, me), { inviteKey: m.invite }) });
        if (mine.stars < c.price) return err('Не хватает звёзд для входа (' + c.price + ')');
        mine.stars -= c.price; addHist(mine, -c.price, 'Вход в «' + c.title + '»'); c.balance += c.price; c.members.push(me); alog('stars', 'Игрок ' + nm(me) + ' вступил в платный ' + (c.type === 'channel' ? 'канал' : 'чат') + ' «' + c.title + '» за ' + c.price + ' ⭐', [me], me); save(); pushWallet(me);
        return send(ws, { t: 'chat', c: chatInfo(c, me), open: true });
      }
      if (c.approval) {
        if (!c.requests.includes(me)) c.requests.push(me); save();
        for (const a of new Set([c.owner, ...c.admins])) if (a) sendTo(a, { t: 'ok', text: mine.username + ' хочет вступить в «' + c.title + '»' });
        return send(ws, { t: 'ok', text: 'Заявка отправлена' });
      }
      c.members.push(me); save(); send(ws, { t: 'chat', c: chatInfo(c, me), open: true }); return;
    }
    if (m.t === 'leave') {
      const c = getChat(m.id); if (!c || !c.members.includes(me)) return;
      if (c.official) return err('Официальный чат нельзя покинуть'); if (c.owner === me) return err('Владелец не может выйти');
      c.members = c.members.filter(x => x !== me); c.admins = c.admins.filter(x => x !== me); save(); return send(ws, { t: 'left', id: c.id });
    }
    if (m.t === 'members') {
      const c = getChat(m.id); if (!c || !c.members.includes(me)) return;
      const r = role(c, me), list = c.official && r !== 'owner' && r !== 'admin' ? [] : c.members.slice(0, 200).filter(k => db.users[k]).map(k => ({ u: pub(k, db.users[k]), role: role(c, k), pre: c.prefixes[k] || '' }));
      const reqs = r === 'owner' || r === 'admin' ? c.requests.filter(k => db.users[k]).map(k => pub(k, db.users[k])) : [];
      return send(ws, { t: 'members', id: c.id, list, reqs });
    }
    if (['chatset', 'chatadmin', 'chatprefix', 'reqdo'].includes(m.t)) {
      const c = getChat(m.id), r = c && role(c, me); if (!r || r === 'member') return err('Нет прав');
      if (m.t === 'chatset') {
        if (typeof m.title === 'string' && m.title.trim()) c.title = m.title.trim().slice(0, 40);
        if (typeof m.desc === 'string') c.desc = m.desc.slice(0, 200);
        if (typeof m.comments === 'boolean' && c.type === 'channel') c.comments = m.comments;
        if (r === 'owner') {
          if (typeof m.approval === 'boolean') c.approval = m.approval;
          if (typeof m.paid === 'boolean') { c.paid = m.paid; if (m.paid) { const p = Math.trunc(Number(m.price)); if (!(p >= 1 && p <= 100000)) return err('Укажите цену входа в звёздах (1–100000)'); c.price = p; } }
          if (typeof m.payReact === 'boolean') c.payReact = m.payReact;
          if (m.regen) c.invite = rc();
          if (m.private === true) { c.private = true; c.username = null; }
          else if (m.private === false || (typeof m.username === 'string' && !c.private)) {
            const h = low(m.username || c.username);
            if (!NAME.test(h) || isTaken(h, null, c.id)) return err('Username занят или неверный');
            c.private = false; c.username = h;
          }
        }
        save(); return pushChat(c);
      }
      if (m.t === 'reqdo') {
        if (!c.requests.includes(m.user)) return;
        c.requests = c.requests.filter(x => x !== m.user);
        if (m.ok && db.users[m.user]) { c.members.push(m.user); sendTo(m.user, { t: 'chat', c: chatInfo(c, m.user), open: false }); sendTo(m.user, { t: 'ok', text: 'Вас приняли в «' + c.title + '»' }); }
        save(); return pushChat(c);
      }
      if (!c.members.includes(m.user)) return err('Не участник');
      if (m.t === 'chatadmin') {
        if (r !== 'owner' || m.user === c.owner) return err('Только владелец');
        c.admins = c.admins.filter(x => x !== m.user); if (m.on) c.admins.push(m.user); save(); return pushChat(c);
      }
      if (m.t === 'chatprefix') {
        const p = String(m.prefix || '').trim().slice(0, 16); if (p) c.prefixes[m.user] = p; else delete c.prefixes[m.user]; save(); return send(ws, { t: 'ok', text: 'Префикс сохранён' });
      }
    }
  });
  ws.on('close', () => { const n = online.get(ws); if (n && db.users[n]) db.users[n].seen = Date.now(); online.delete(ws); });
});
setInterval(() => {
  for (const x of db.auctions) {
    if (x.done || x.end > Date.now()) continue; x.done = true; const nf = db.nfts.find(y => y.h === x.h);
    const bids = [...x.bids].reverse(); let win = null;
    for (const b of bids) { const u = db.users[b.user]; if (u && u.ton >= b.amount) { win = b; break; } }
    if (win && nf) { const u = db.users[win.user]; u.ton = Math.round((u.ton - win.amount) * 1e6) / 1e6; u.wh.unshift({ ts: Date.now(), text: 'Аукцион @' + x.h, amount: -win.amount, cur: 'ton' }); nf.owner = win.user; nf.hold = false; nf.ts = Date.now(); nf.ton = win.amount; nf.usd = usdOf(win.amount); u.nft.push(x.h); if (!u.handle) u.handle = x.h;
      alog('ton', 'Аукцион на юзернейм @' + x.h + ' завершён: победил ' + nm(win.user) + ', ставка ' + win.amount + ' TON', [win.user], 'system'); broadcast({ t: 'user', user: pub(win.user, u) }); sendTo(win.user, { t: 'me', p: profile(win.user, win.user) }); sendTo(win.user, { t: 'wstate', w: wstate(win.user) }); sendTo(win.user, { t: 'ok', text: 'Вы выиграли аукцион: @' + x.h }); }
    else { if (nf) nf.hold = false; alog('ton', 'Аукцион на юзернейм @' + x.h + ' завершён без победителя', [], 'system'); }
    save(); broadcast({ t: 'nfts', list: nftList() });
  }
}, 15000);
server.listen(PORT, () => console.log('MiniGram on port ' + PORT));
