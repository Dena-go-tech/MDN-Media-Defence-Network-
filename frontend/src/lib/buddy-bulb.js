/*
 * BuddyAI Bulb: 2D vector character with poses, verdict shield and a word-driven emotion player.
 * Zero dependencies. ES module. Draws an inline <svg> (viewBox 0 0 320 380).
 * See IMPORT.md for usage.
 */
var INK = '#172033';
var BULB = 'M160 60C215 60 250 100 250 150C250 190 232 214 212 236C205 244 204 252 204 262L116 262C116 252 115 244 108 236C88 214 70 190 70 150C70 100 105 60 160 60Z';
var FONT = "'IBM Plex Sans','Segoe UI',Arial,sans-serif";

/* ---------- pose data ---------- */
var D = {
  bright: .95, halo: .7, bodyY: 0, tilt: 0, lookx: 0, looky: 0,
  elw: 10, elu: 11, eld: 11, elr: 0, erw: 10, eru: 11, erd: 11, err: 0,
  mw: 13, mc: 0, mt: 4, mb: 4,
  blY: 0, blR: 0, brY: 0, brR: 0,
  lhx: 70, lhy: 246, rhx: 250, rhy: 246, wave: 0,
  bob: 0, bobHz: 1.6, sway: 0, swayHz: .6, blink: 1, zap: 0,
  sg: 0, sr: 0, sa: 0, ik: 0, ix: 0, iq: 0, iw: 0,
  rt: 0, rg: 0, rr: 0, ra: 0, scan: 0, lens: 0, qm: 0, tri: 0
};
var RAW = {
  idle: {},
  hello: { mw: 15, mt: 6, mb: 12, blY: -3, brY: -3, rhx: 262, rhy: 150, wave: 1, tilt: -2, bright: 1, halo: .85 },
  analyze: { elw: 11, elu: 7, eld: 8, erw: 11, eru: 7, erd: 8, lookx: 5, looky: 3, blY: 2, blR: 6, brY: 2, brR: -6, mw: 10, mt: 0, mb: 0, rhx: 234, rhy: 216, lhx: 86, lhy: 238, rt: 1, scan: 1, lens: 1, tilt: 3, halo: .85 },
  verified: { mw: 15, mt: 6, mb: 6, blY: -2, brY: -2, sg: 1, ik: 1, rg: 1, bright: 1.05, halo: .95, lhx: 72, lhy: 240, rhx: 248, rhy: 240, bob: 2, bobHz: 1.1 },
  fake: { elw: 11, elu: 6, eld: 8, elr: 8, erw: 11, eru: 6, erd: 8, err: -8, blY: 5, blR: 14, brY: 5, brR: -14, mw: 12, mt: -4, mb: -4, mc: 2, sr: 1, ix: 1, rr: 1, lhx: 76, lhy: 240, rhx: 252, rhy: 126, bright: 1, halo: .8 },
  doubt: { elu: 8, eld: 9, eru: 6, erd: 6, blY: -8, blR: -6, brY: 3, brR: -10, lookx: 4, looky: -2, mw: 10, mt: -2, mb: -2, mc: 1, sa: 1, iq: 1, ra: .7, qm: 1, rhx: 214, rhy: 206, lhx: 72, lhy: 242, tilt: 5, halo: .65 },
  warning: { elw: 9, elu: 13, eld: 13, erw: 9, eru: 13, erd: 13, blY: -6, blR: -8, brY: -6, brR: 8, mw: 11, mt: -1, mb: 3, sa: 1, iw: 1, ra: 1, tri: 1, rhx: 256, rhy: 118, lhx: 70, lhy: 236, bright: 1.1, halo: .95, bob: 1.5, bobHz: 3 },
  explain: { mw: 15, mt: 5, mb: 12, blY: -3, brY: -3, lhx: 58, lhy: 216, rhx: 262, rhy: 208, bob: 1.5, bobHz: 1.4 },
  idea: { bright: 1.25, halo: 1.4, zap: 1, elu: 12, eld: 12, blY: -6, brY: -6, mw: 14, mt: 6, mb: 11, rhx: 248, rhy: 86, lhx: 80, lhy: 238, tilt: -2 },
  concern: { bright: .7, halo: .45, blY: 2, blR: -12, brY: 2, brR: 12, mw: 12, mt: -5, mb: -5, mc: 2, looky: 3, lhx: 78, lhy: 252, rhx: 242, rhy: 252, tilt: -2 },
  relief: { elw: 11, elu: 9, eld: -4, erw: 11, eru: 9, erd: -4, mw: 16, mt: 7, mb: 7, blY: -2, brY: -2, bob: 2.5, bobHz: 1.1, halo: .9, bright: 1 },
  think: { looky: -4, lookx: 4, blY: -5, blR: -4, brY: 2, brR: -6, mw: 9, mt: 0, mb: 0, rhx: 210, rhy: 210, lhx: 70, lhy: 244, tilt: 4, bright: .9 }
};
var ORDER = ['idle', 'hello', 'analyze', 'verified', 'fake', 'doubt', 'warning', 'explain', 'idea', 'concern', 'relief', 'think'];
var NAMES = { idle: 'Спокойный', hello: 'Приветствие', analyze: 'Анализ', verified: 'Проверено', fake: 'Фейк', doubt: 'Сомнение', warning: 'Тревога', explain: 'Объясняет', idea: 'Озарение', concern: 'Сочувствие', relief: 'Облегчение', think: 'Размышляет' };
var P = {};
ORDER.forEach(function (n) { P[n] = Object.assign({}, D, RAW[n]); });

/* Words ending in * match any ending. Russian first, then English. */
var LEX = {
  hello: ['привет*', 'здравств*', 'добрый', 'приветств*', 'hello', 'hi', 'hey', 'greetings', 'welcome'],
  analyze: ['провер*', 'анализ*', 'источник*', 'расследов*', 'изуч*', 'сверим', 'поищем', 'check*', 'analyz*', 'analys*', 'verify', 'search*', 'investigat*', 'source', 'sources'],
  verified: ['проверен*', 'подтвержд*', 'правда', 'достоверн*', 'факт*', 'надежн*', 'официальн*', 'истинн*', 'verified', 'confirmed', 'true', 'fact', 'facts', 'reliable', 'authentic', 'official', 'trusted'],
  fake: ['фейк*', 'ложь', 'лжив*', 'ложн*', 'вранье', 'дезинформац*', 'пропаганд*', 'обман*', 'подделк*', 'фальшив*', 'фальсиф*', 'fake*', 'false', 'hoax', 'lie', 'lies', 'misinformation', 'disinformation', 'propaganda', 'fraud'],
  doubt: ['возможно', 'вероятно', 'сомнен*', 'сомнительн*', 'слух*', 'утвержда*', 'якобы', 'непонятн*', 'неясн*', 'непровер*', 'подозрительн*', 'говорят', 'maybe', 'perhaps', 'unclear', 'unverified', 'claim*', 'rumor*', 'rumour*', 'allegedly', 'suspicious', 'supposedly', 'doubt*'],
  warning: ['опасн*', 'осторожн*', 'внимани*', 'мошенник*', 'угроз*', 'риск*', 'фишинг*', 'тревог*', 'берегитесь', 'предупрежд*', 'danger*', 'scam*', 'warning', 'careful', 'beware', 'risk*', 'alert', 'phishing'],
  explain: ['потому', 'объясн*', 'значит', 'например', 'причин*', 'поэтому', 'означа*', 'because', 'explain*', 'means', 'example', 'reason*', 'therefore'],
  idea: ['идея', 'идеи', 'идею', 'решение', 'озарени*', 'осенило', 'idea*', 'insight', 'solution', 'aha', 'eureka'],
  concern: ['жаль', 'сожален*', 'пострадавш*', 'вред*', 'печальн*', 'грустн*', 'обидно', 'sorry', 'unfortunately', 'sad', 'victims', 'harm', 'pity'],
  relief: ['безопасн*', 'спокойн*', 'спасибо', 'хорошо', 'отлично', 'здорово', 'рады', 'слава', 'safe', 'relax', 'thanks', 'thank', 'great', 'fine'],
  think: ['думаю', 'подума*', 'интересно', 'почему', 'как', 'зачем', 'размышл*', 'вопрос*', 'хм*', 'think*', 'hmm', 'wonder', 'why', 'how', 'question*']
};
var EXACT = {}, STEMS = [];
Object.keys(LEX).forEach(function (p) {
  LEX[p].forEach(function (w) {
    if (w.slice(-1) === '*') STEMS.push({ s: w.slice(0, -1), p: p }); else EXACT[w] = p;
  });
});
function match(w) {
  if (EXACT[w]) return EXACT[w];
  var best = null, bl = 0;
  STEMS.forEach(function (x) { if (w.indexOf(x.s) === 0 && x.s.length > bl) { best = x.p; bl = x.s.length; } });
  return best;
}

/* ---------- character ---------- */
function clamp(v, a, b) { return Math.min(b, Math.max(a, v)); }
function f(n) { return Math.round(n * 100) / 100; }

function markup(u) {
  var s = '';
  s += '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 320 380" width="320" height="380" style="overflow:visible" role="img" aria-label="Персонаж BuddyAI Bulb">';
  s += '<defs>';
  s += '<radialGradient id="halo' + u + '"><stop offset="0" stop-color="#F7CB55" stop-opacity=".5"/><stop offset=".55" stop-color="#F7CB55" stop-opacity=".16"/><stop offset="1" stop-color="#F7CB55" stop-opacity="0"/></radialGradient>';
  s += '<radialGradient id="core' + u + '" cx=".5" cy=".4" r=".7"><stop offset="0" stop-color="#FFEDB0"/><stop offset=".6" stop-color="#F7CB55"/><stop offset="1" stop-color="#EBA23B"/></radialGradient>';
  s += '<radialGradient id="bloom' + u + '" cx=".5" cy=".42" r=".55"><stop offset="0" stop-color="#FFFFFF"/><stop offset="1" stop-color="#FFF3B0" stop-opacity="0"/></radialGradient>';
  s += '<linearGradient id="scan' + u + '" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#2BB7B0" stop-opacity="0"/><stop offset="1" stop-color="#2BB7B0" stop-opacity=".45"/></linearGradient>';
  s += '<clipPath id="bc' + u + '"><path d="' + BULB + '"/></clipPath>';
  s += '</defs>';
  s += '<ellipse data-r="shadow" cx="160" cy="357" rx="54" ry="6" fill="' + INK + '" opacity=".14"/>';
  s += '<ellipse data-r="hover" cx="160" cy="341" rx="40" ry="5.5" fill="none" stroke="#2BB7B0" stroke-width="2" opacity=".45"/>';
  s += '<circle data-r="halo" cx="160" cy="150" r="150" fill="url(#halo' + u + ')"/>';
  s += '<g data-r="rings">';
  [['rt', '#2BB7B0'], ['rg', '#1FA971'], ['rr', '#D64545'], ['ra', '#E9A23B']].forEach(function (c) {
    s += '<circle data-r="' + c[0] + '" cx="160" cy="150" r="124" fill="none" stroke="' + c[1] + '" stroke-width="2.6" stroke-linecap="round" stroke-dasharray="3 10" opacity="0"/>';
  });
  s += '</g>';
  s += '<g data-r="body">';
  /* glass */
  s += '<path d="' + BULB + '" fill="#E9EEF6"/>';
  s += '<path data-r="glow" d="' + BULB + '" fill="url(#core' + u + ')"/>';
  s += '<path data-r="bloom" d="' + BULB + '" fill="url(#bloom' + u + ')"/>';
  s += '<path d="M106 112C111 92 125 80 143 74" fill="none" stroke="#fff" stroke-width="6" stroke-linecap="round" opacity=".6"/>';
  s += '<path d="M97 134L98 141" fill="none" stroke="#fff" stroke-width="5" stroke-linecap="round" opacity=".6"/>';
  s += '<path d="M238 122C246 140 246 164 240 184" fill="none" stroke="#fff" stroke-width="4" stroke-linecap="round" opacity=".4"/>';
  /* filament: tungsten coil on two posts */
  var coil = 'M136 114V102L142 86L148 102L154 86L160 102L166 86L172 102L178 86L184 102V114';
  s += '<g><path d="' + coil + '" fill="none" stroke="#D9772A" stroke-width="2.8" stroke-linecap="round" stroke-linejoin="round"/>';
  s += '<path data-r="zap" d="' + coil + '" fill="none" stroke="#fff" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>';
  s += '<circle cx="136" cy="114" r="2.4" fill="#D9772A"/><circle cx="184" cy="114" r="2.4" fill="#D9772A"/></g>';
  /* scan */
  s += '<g clip-path="url(#bc' + u + ')"><g data-r="scanG" opacity="0"><rect x="60" y="-30" width="200" height="30" fill="url(#scan' + u + ')"/><rect x="60" y="-1.5" width="200" height="2.6" fill="#2BB7B0"/></g></g>';
  /* face */
  ['L', 'R'].forEach(function (k) {
    s += '<g data-r="e' + k + '"><path data-r="e' + k + 'p" fill="' + INK + '"/><circle data-r="e' + k + 'h" fill="#fff"/></g>';
    s += '<g data-r="b' + k + '"><path d="M-12 0Q0 -2.5 12 0" fill="none" stroke="' + INK + '" stroke-width="4" stroke-linecap="round"/></g>';
  });
  s += '<path data-r="mouth" fill="' + INK + '" stroke="' + INK + '" stroke-width="3.6" stroke-linejoin="round" stroke-linecap="round"/>';
  /* outline, then base so it covers the glass bottom edge */
  s += '<path d="' + BULB + '" fill="none" stroke="' + INK + '" stroke-width="4.5" stroke-linejoin="round"/>';
  s += '<rect x="116" y="262" width="88" height="50" rx="8" fill="#8C9AB5" stroke="' + INK + '" stroke-width="4.5"/>';
  s += '<path d="M122 280H138M182 280H198M122 296H138M182 296H198" fill="none" stroke="' + INK + '" stroke-width="3" stroke-linecap="round" opacity=".5"/>';
  s += '<rect x="111" y="254" width="98" height="14" rx="7" fill="#6E7B99" stroke="' + INK + '" stroke-width="4"/>';
  s += '<path d="M122 259H138" stroke="#fff" stroke-width="2.5" stroke-linecap="round" opacity=".5"/>';
  s += '<path d="M142 312A18 10 0 0 0 178 312Z" fill="#3B4766" stroke="' + INK + '" stroke-width="4" stroke-linejoin="round"/>';
  /* shield */
  var SH = 'M160 273L176 279V292C176 301 169 306 160 309C151 306 144 301 144 292V279Z';
  s += '<path d="' + SH + '" fill="#2B3A5C"/>';
  s += '<path data-r="shG" d="' + SH + '" fill="#1FA971" opacity="0"/>';
  s += '<path data-r="shR" d="' + SH + '" fill="#D64545" opacity="0"/>';
  s += '<path data-r="shA" d="' + SH + '" fill="#E9A23B" opacity="0"/>';
  s += '<path d="' + SH + '" fill="none" stroke="' + INK + '" stroke-width="3" stroke-linejoin="round"/>';
  s += '<path data-r="ik" d="M151 289L158 296L170 281" fill="none" stroke="#fff" stroke-width="4" stroke-linecap="round" stroke-linejoin="round" opacity="0"/>';
  s += '<path data-r="ix" d="M153 283L167 297M167 283L153 297" fill="none" stroke="#fff" stroke-width="4" stroke-linecap="round" opacity="0"/>';
  s += '<g data-r="iq" opacity="0"><path d="M154 284Q154 277 160 277Q166 277 166 282Q166 286 160 288V291" fill="none" stroke="#14213D" stroke-width="3.6" stroke-linecap="round" stroke-linejoin="round"/><circle cx="160" cy="297" r="2.2" fill="#14213D"/></g>';
  s += '<g data-r="iw" opacity="0"><path d="M160 277V291" fill="none" stroke="#14213D" stroke-width="4" stroke-linecap="round"/><circle cx="160" cy="298" r="2.4" fill="#14213D"/></g>';
  /* arms */
  ['L', 'R'].forEach(function (k) {
    s += '<path data-r="arm' + k + '" fill="none" stroke="' + INK + '" stroke-width="5" stroke-linecap="round" stroke-linejoin="round"/>';
    s += '<circle data-r="elb' + k + '" r="3.4" fill="' + INK + '"/>';
    s += '<circle data-r="hand' + k + '" r="6.5" fill="#E9EEF6" stroke="' + INK + '" stroke-width="3.5"/>';
  });
  s += '<g data-r="lens" opacity="0"><path d="M-3 -3L-12 -20" stroke="' + INK + '" stroke-width="5" stroke-linecap="round"/><circle cx="-21" cy="-34" r="17" fill="#BFE9E6" fill-opacity=".4" stroke="' + INK + '" stroke-width="4"/><path d="M-30 -39Q-27 -46 -20 -47" fill="none" stroke="#fff" stroke-width="3" stroke-linecap="round" opacity=".85"/></g>';
  s += '</g>';
  /* floating marks */
  s += '<g data-r="qm" opacity="0"><text x="0" y="22" text-anchor="middle" font-family="' + FONT + '" font-weight="700" font-size="64" fill="#E9A23B" stroke="' + INK + '" stroke-width="5" paint-order="stroke" stroke-linejoin="round">?</text></g>';
  s += '<g data-r="tri" opacity="0"><path d="M0 -22L22 14H-22Z" fill="#E9A23B" stroke="' + INK + '" stroke-width="4" stroke-linejoin="round"/><path d="M0 -8V3" stroke="' + INK + '" stroke-width="4" stroke-linecap="round"/><circle cx="0" cy="9" r="2.4" fill="' + INK + '"/></g>';
  s += '</svg>';
  return s;
}

function ik(sx, sy, tx, ty, L1, L2, out) {
  var dx = tx - sx, dy = ty - sy, d = Math.hypot(dx, dy), maxR = L1 + L2 - .5;
  if (d > maxR) { dx *= maxR / d; dy *= maxR / d; d = maxR; }
  if (d < 6) { d = 6; dx = 0; dy = 6; }
  var a = (L1 * L1 - L2 * L2 + d * d) / (2 * d);
  var h = Math.sqrt(Math.max(0, L1 * L1 - a * a));
  var ux = dx / d, uy = dy / d, px = -uy, py = ux;
  var bx = sx + ux * a, by = sy + uy * a;
  var e1x = bx + px * h, e1y = by + py * h, e2x = bx - px * h, e2y = by - py * h;
  var s1 = (e1x - sx) * out + (e1y - sy) * .3, s2 = (e2x - sx) * out + (e2y - sy) * .3;
  return s1 >= s2 ? { ex: e1x, ey: e1y, hx: sx + dx, hy: sy + dy } : { ex: e2x, ey: e2y, hx: sx + dx, hy: sy + dy };
}

function eyePath(w, u, d, bl) {
  w = Math.max(w, 1);
  if (d > 0) { u = Math.max(u * bl, 1); d = Math.max(d * bl, 1); }
  return { d: 'M' + (-w) + ' 0C' + (-w) + ' ' + f(-u) + ' ' + w + ' ' + f(-u) + ' ' + w + ' 0C' + w + ' ' + f(d) + ' ' + (-w) + ' ' + f(d) + ' ' + (-w) + ' 0Z', H: .75 * (u + d), u: u, w: w };
}

function makeChar(host, uid) {
  host.innerHTML = markup(uid);
  var svg = host.firstChild;
  var R = {};
  svg.querySelectorAll('[data-r]').forEach(function (e) { R[e.getAttribute('data-r')] = e; });

  function eye(side, cx, p, x) {
    var S = side === 'L';
    var e = eyePath(p[S ? 'elw' : 'erw'], p[S ? 'elu' : 'eru'], p[S ? 'eld' : 'erd'], x.blinkF);
    var k = 'e' + side;
    R[k + 'p'].setAttribute('d', e.d);
    var h = R[k + 'h'];
    h.setAttribute('r', 2);
    h.setAttribute('cx', f(-e.w * .3));
    h.setAttribute('cy', f(-e.u * .4));
    h.setAttribute('opacity', e.H > 9 ? 1 : 0);
    R[k].setAttribute('transform', 'translate(' + f(cx + p.lookx) + ' ' + f(150 + p.looky) + ') rotate(' + f(p[S ? 'elr' : 'err']) + ')');
  }

  function draw(p, t, x) {
    x = x || {};
    var blinkF = 1;
    if (x.blink && p.blink > .5) {
      var ph = t % 3.9;
      if (ph > 3.7 && ph < 3.84) blinkF = 1 - Math.sin((ph - 3.7) / .14 * Math.PI) * .92;
    }
    x.blinkF = blinkF;
    var beat = x.beat || 0;
    var bobU = .5 + .5 * Math.sin(2 * Math.PI * p.bobHz * t);
    var by = p.bodyY - bobU * p.bob + Math.sin(t * 1.6) * 3 - beat * 3;
    var tilt = p.tilt + Math.sin(2 * Math.PI * p.swayHz * t) * p.sway;
    R.body.setAttribute('transform', 'translate(0 ' + f(by) + ') translate(160 200) rotate(' + f(tilt) + ') translate(-160 -200)');
    R.shadow.setAttribute('rx', f(54 + by * .7));
    R.shadow.setAttribute('opacity', f(.14 - by * .003));
    R.hover.setAttribute('opacity', f(.3 + .15 * Math.sin(t * 2.4)));
    R.hover.setAttribute('rx', f(40 + by * .5));

    /* glow */
    R.glow.setAttribute('opacity', f(clamp(p.bright, 0, 1)));
    R.bloom.setAttribute('opacity', f(clamp((p.bright - 1) * 1.6, 0, .75)));
    R.halo.setAttribute('opacity', f(clamp(.1 + p.halo * .5, 0, 1)));
    R.halo.setAttribute('transform', 'translate(160 150) scale(' + f((.72 + p.halo * .34) * (1 + Math.sin(t * 2.2) * .02)) + ') translate(-160 -150)');
    R.zap.setAttribute('opacity', f(clamp((p.bright - .8) * 1.4 + p.zap * (.7 + .3 * Math.sin(t * 18)), 0, 1)));

    /* face */
    eye('L', 134, p, x);
    eye('R', 186, p, x);
    R.bL.setAttribute('transform', 'translate(134 ' + f(130 + p.blY) + ') rotate(' + f(p.blR) + ')');
    R.bR.setAttribute('transform', 'translate(186 ' + f(130 + p.brY) + ') rotate(' + f(p.brR) + ')');
    var mt = p.mt, mb = p.mb, mw = p.mw;
    if (x.talk) {
      var o = (.5 + .5 * Math.sin(t * 15 + (x.ph || 0))) * (.55 + .45 * Math.sin(t * 6.3));
      mb += o * 9; mt -= o * 1.5; mw -= o;
    }
    mw = Math.max(mw, 4);
    var cy = 186, c = cy + p.mc;
    R.mouth.setAttribute('d', 'M' + f(160 - mw) + ' ' + f(c) + 'C' + f(160 - mw * .4) + ' ' + f(cy + mt) + ' ' + f(160 + mw * .4) + ' ' + f(cy + mt) + ' ' + f(160 + mw) + ' ' + f(c) +
      'C' + f(160 + mw * .4) + ' ' + f(cy + mb) + ' ' + f(160 - mw * .4) + ' ' + f(cy + mb) + ' ' + f(160 - mw) + ' ' + f(c) + 'Z');

    /* shield verdict */
    R.shG.setAttribute('opacity', f(clamp(p.sg, 0, 1)));
    R.shR.setAttribute('opacity', f(clamp(p.sr, 0, 1)));
    R.shA.setAttribute('opacity', f(clamp(p.sa, 0, 1)));
    R.ik.setAttribute('opacity', f(clamp(p.ik, 0, 1)));
    R.ix.setAttribute('opacity', f(clamp(p.ix, 0, 1)));
    R.iq.setAttribute('opacity', f(clamp(p.iq, 0, 1)));
    R.iw.setAttribute('opacity', f(clamp(p.iw, 0, 1)));

    /* arms */
    var wv = Math.sin(t * 8) * p.wave * 8;
    var A = ik(78, 182, p.lhx, p.lhy, 40, 36, -1);
    var B = ik(242, 182, p.rhx + wv, p.rhy, 40, 36, 1);
    R.armL.setAttribute('d', 'M78 182L' + f(A.ex) + ' ' + f(A.ey) + 'L' + f(A.hx) + ' ' + f(A.hy));
    R.armR.setAttribute('d', 'M242 182L' + f(B.ex) + ' ' + f(B.ey) + 'L' + f(B.hx) + ' ' + f(B.hy));
    R.elbL.setAttribute('cx', f(A.ex)); R.elbL.setAttribute('cy', f(A.ey));
    R.elbR.setAttribute('cx', f(B.ex)); R.elbR.setAttribute('cy', f(B.ey));
    R.handL.setAttribute('cx', f(A.hx)); R.handL.setAttribute('cy', f(A.hy));
    R.handR.setAttribute('cx', f(B.hx)); R.handR.setAttribute('cy', f(B.hy));
    R.lens.setAttribute('opacity', f(clamp(p.lens, 0, 1)));
    R.lens.setAttribute('transform', 'translate(' + f(B.hx) + ' ' + f(B.hy) + ') rotate(' + f(Math.sin(t * 2) * 3) + ')');

    /* rings and scan */
    R.rings.setAttribute('transform', 'rotate(' + f(t * 10) + ' 160 150)');
    var pr = .75 + .25 * Math.sin(t * 3);
    ['rt', 'rg', 'rr', 'ra'].forEach(function (n) { R[n].setAttribute('opacity', f(clamp(p[n], 0, 1) * pr)); });
    R.scanG.setAttribute('opacity', f(clamp(p.scan, 0, 1)));
    R.scanG.setAttribute('transform', 'translate(0 ' + f(70 + ((t * .8) % 1) * 190) + ')');

    /* marks */
    R.qm.setAttribute('opacity', f(clamp(p.qm, 0, 1)));
    R.qm.setAttribute('transform', 'translate(268 72) rotate(' + f(14 + Math.sin(t * 3) * 5) + ') scale(' + f(.92 + .06 * Math.sin(t * 5)) + ')');
    R.tri.setAttribute('opacity', f(clamp(p.tri, 0, 1)));
    R.tri.setAttribute('transform', 'translate(268 68) scale(' + f(.95 + .08 * Math.abs(Math.sin(t * 6))) + ')');
  }
  return { el: svg, draw: draw };
}


/* ---------- public API ---------- */
var EXPR = { rare: { gap: 8, hold: 4 }, some: { gap: 4, hold: 3 }, often: { gap: 0, hold: 3 } };
function clean(w) { return w.toLowerCase().replace(/ё/g, 'е').replace(/[^a-zа-я']/g, ''); }

/**
 * createBulb(host, options) -> controller
 * host: HTMLElement that will contain the <svg> (give it a width; height follows the 320:380 ratio).
 * options: { uid?: string, expressions?: 'rare'|'some'|'often', reducedMotion?: boolean, onPose?: (name) => void }
 */
export function createBulb(host, options) {
  var opts = options || {};
  var uid = opts.uid || ('b' + Math.random().toString(36).slice(2, 8));
  var RM = opts.reducedMotion != null ? opts.reducedMotion
    : (typeof matchMedia !== 'undefined' && matchMedia('(prefers-reduced-motion: reduce)').matches);
  var ch = makeChar(host, uid);
  var cur = Object.assign({}, P.idle), vel = {}, tgt = Object.assign({}, P.idle);
  Object.keys(D).forEach(function (k) { vel[k] = 0; });
  var poseName = 'idle', time = 0, beat = 0, talkOn = false, phase = 0;
  var alive = true, raf = 0, last = 0, mode = opts.expressions || 'rare';
  var pinned = false, timer = null, speaking = false, words = [], idx = 0, life = 0, cool = 0, talkTimer = null;

  function drawNow() { ch.draw(cur, RM ? 1.2 : time, { talk: talkOn, beat: RM ? 0 : beat, blink: !RM, ph: phase }); }
  function setPose(n) {
    if (!P[n]) return;
    poseName = n;
    tgt = Object.assign({}, P[n]);
    ch.el.setAttribute('aria-label', 'BuddyAI Bulb: ' + NAMES[n]);
    if (opts.onPose) opts.onPose(n);
    if (RM) { Object.assign(cur, tgt); drawNow(); }
  }
  function frame(now) {
    if (!alive) return;
    raf = requestAnimationFrame(frame);
    var dt = Math.min(.033, (now - (last || now)) / 1000);
    last = now; time += dt;
    for (var k in tgt) {
      var a = (tgt[k] - cur[k]) * 260 - vel[k] * 22;
      vel[k] += a * dt; cur[k] += vel[k] * dt;
    }
    beat *= Math.exp(-dt * 8);
    drawNow();
  }

  /* One word through the emotion rules. Returns what happened. */
  function processWord(raw) {
    var w = clean(raw), pz = match(w), cfg = EXPR[mode], fired = false, held = false;
    if (pz && cool <= 0 && !pinned) {
      setPose(pz); life = cfg.hold; cool = cfg.gap; fired = true;
    } else {
      if (pz) held = true;
      cool--; life--;
      if (life <= 0 && poseName !== 'idle' && !pinned) setPose('idle');
    }
    beat = fired ? 1 : .3;
    phase += 1.7;
    return { word: raw, pose: poseName, fired: fired, held: held, matched: pz };
  }
  function talkFor(ms) {
    talkOn = true;
    clearTimeout(talkTimer);
    talkTimer = setTimeout(function () { talkOn = false; }, ms);
  }

  function stop() {
    speaking = false;
    clearTimeout(timer); timer = null;
    clearTimeout(talkTimer); talkOn = false;
  }
  /* Play a text word by word. o: { pace (ms per word, default 440), talk (default true), onWord(info), onDone() } */
  function speak(input, o) {
    o = o || {};
    stop();
    words = Array.isArray(input) ? input.slice() : String(input).split(/\s+/).filter(Boolean);
    idx = 0; life = 0; cool = 0; speaking = true;
    var pace = o.pace || 440, talk = o.talk !== false;
    (function step() {
      if (!speaking) return;
      if (idx >= words.length) {
        speaking = false;
        if (!pinned) setPose('idle');
        if (o.onDone) o.onDone();
        return;
      }
      var raw = words[idx++];
      var info = processWord(raw);
      if (o.onWord) o.onWord(info, idx - 1);
      var d = pace * (.75 + clean(raw).length * .05);
      if (/[,;]$/.test(raw)) d += 180;
      if (/[.!?…]$/.test(raw)) d += 340;
      if (talk) talkFor(d * .8);
      timer = setTimeout(step, d);
    })();
  }
  /* Streaming: call feed(word) for every word/token chunk as it arrives. Mouth moves ~250 ms per call. */
  function feed(word, talk) {
    var info = processWord(String(word));
    if (talk !== false) talkFor(260);
    return info;
  }

  /* Hard verdict from your backend: 'verified' | 'fake' | 'doubt' | 'warning' | 'analyze' | any pose name. Stays until release(). */
  function pin(name) { pinned = true; setPose(name); }
  function release() { pinned = false; setPose('idle'); }

  function destroy() {
    alive = false; cancelAnimationFrame(raf); stop();
    host.innerHTML = '';
  }

  if (RM) drawNow(); else raf = requestAnimationFrame(frame);

  return {
    svg: ch.el,
    setPose: setPose,
    getPose: function () { return poseName; },
    pin: pin, release: release,
    speak: speak, feed: feed, stop: stop,
    setExpressions: function (m) { if (EXPR[m]) mode = m; },
    toSVG: function () { return new XMLSerializer().serializeToString(ch.el); },
    destroy: destroy
  };
}

/* Static render of one pose into a host (for pose pickers, thumbnails, docs). No animation loop. */
export function renderPose(host, name, uid) {
  var c = makeChar(host, uid || ('s' + Math.random().toString(36).slice(2, 8)));
  c.draw(P[name] || P.idle, 1.2, { talk: false, beat: 0, blink: false });
  return c.el;
}

export var POSES = P, POSE_NAMES = NAMES, POSE_ORDER = ORDER, LEXICON = LEX, matchPose = match;
export default createBulb;
