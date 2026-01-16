/* bank.js (clean patch)
 *
 * What this file guarantees
 * - No syntax-error fragments (e.g., stray ".xxx" tokens) and a single, valid IIFE.
 * - window.BANK is always defined as an Array.
 * - Each subject has enough questions across grade/difficulty filters, preventing
 *   "国語が不足しています"-type runtime errors.
 * - Adds key / uid / patternGroup (used by your app for "重複禁止" and "似たパターン回避").
 *
 * How it behaves
 * - If window.BANK already exists AND is reasonably large, it only enriches + validates it.
 * - Otherwise it builds a safe fallback bank.
 */

(function () {
  'use strict';

  const SUBJECTS = ['国語', '数学', '英語', '理科', '社会'];
  const GRADES = ['小', '中'];
  const DIFFS = ['基礎', '標準', '発展'];

  /* =========================
   * Utils
   * ========================= */
  const pick = (arr, i) => arr[i % arr.length];

  function normalizeText(s) {
    return String(s ?? '')
      .normalize('NFKC')
      .toLowerCase()
      .replace(/\s+/g, ' ')
      .trim();
  }

  function makeUid(q) {
    const sub = normalizeText(q?.sub);
    const qt = normalizeText(q?.q);
    const choices = Array.isArray(q?.c) ? q.c.map(normalizeText).join('||') : '';
    const a = Number.isInteger(q?.a) ? q.a : -1;
    // level/diff は含めない（同内容なら重複として扱う）
    return `${sub}::${qt}::${choices}::a=${a}`;
  }

  function toKey(q, i) {
    const qHead = String(q?.q ?? '').slice(0, 48);
    return q?.key || `${q?.sub || 'X'}|${q?.level || 'X'}|${q?.diff || 'X'}|${q?.pattern || 'p'}|${qHead}|${i}`;
  }

  function isBadChoiceText(s) {
    const t = String(s ?? '').trim();
    if (!t) return true;
    if (t === '-' || t === '—' || t === '–') return true;

    const bannedExact = [
      '不明',
      'わからない',
      'どれでもない',
      '上のいずれでもない',
      '該当なし',
      'なし',
    ];
    if (bannedExact.includes(t)) return true;

    const bannedContains = ['すべて正しい', 'すべて誤り', '上の中', '上のうち'];
    if (bannedContains.some(k => t.includes(k))) return true;

    return false;
  }

  function validateQuestion(q) {
    if (!q) return false;
    if (!SUBJECTS.includes(q.sub)) return false;
    if (!GRADES.includes(q.level)) return false;
    if (!DIFFS.includes(q.diff)) return false;
    if (typeof q.q !== 'string' || !q.q.trim()) return false;
    if (!Array.isArray(q.c) || q.c.length !== 4) return false;
    if (!Number.isInteger(q.a) || q.a < 0 || q.a > 3) return false;

    const choices = q.c.map(x => String(x ?? '').trim());
    if (choices.some(isBadChoiceText)) return false;
    if (new Set(choices).size !== 4) return false;

    const qn = normalizeText(q.q);
    const cn = choices.map(normalizeText);
    // 露骨なコピペ（問題文に選択肢全文が含まれる）を弾く
    if (cn.some(x => x.length >= 10 && qn.includes(x))) return false;

    return true;
  }

  function uniq(arr) {
    const out = [];
    const seen = new Set();
    for (const x of arr) {
      const t = String(x ?? '').trim();
      if (!t) continue;
      if (seen.has(t)) continue;
      seen.add(t);
      out.push(t);
    }
    return out;
  }

  // Correct + wrong pool -> unique 4 choices, correct fixed at index 0
  function force4Unique(correct, wrongPool, seed, extraPool = []) {
    const c0 = String(correct).trim();
    const pool = uniq((wrongPool || []).map(String)).filter(x => x && x !== c0);
    const extra = uniq((extraPool || []).map(String)).filter(x => x && x !== c0);

    const wrongs = [];
    for (let k = 0; k < pool.length && wrongs.length < 3; k++) {
      const w = pool[(seed + k) % pool.length];
      if (w !== c0 && !wrongs.includes(w)) wrongs.push(w);
    }
    for (let k = 0; k < extra.length && wrongs.length < 3; k++) {
      const w = extra[(seed + k) % extra.length];
      if (w !== c0 && !wrongs.includes(w)) wrongs.push(w);
    }

    // last-resort filler (rare)
    const safeFill = ['A', 'B', 'C', 'D', 'E', 'F', 'G'];
    for (let k = 0; k < safeFill.length && wrongs.length < 3; k++) {
      const w = safeFill[(seed + k) % safeFill.length];
      if (w !== c0 && !wrongs.includes(w)) wrongs.push(w);
    }

    const arr = uniq([c0, ...wrongs]).slice(0, 4);
    const idx = arr.indexOf(c0);
    if (idx > 0) [arr[0], arr[idx]] = [arr[idx], arr[0]];
    return { c: arr, a: 0 };
  }

  function enrich(bank) {
    bank.forEach((q, i) => {
      if (!q) return;
      q.key = toKey(q, i);
      if (!q.pattern) q.pattern = 'misc';
      if (!q.patternGroup) q.patternGroup = q.pattern;
      if (!q.uid) q.uid = makeUid(q);
      if (typeof q.exp !== 'string') q.exp = String(q.exp ?? '');
    });
    return bank;
  }

  function countBySubject(bank) {
    const out = Object.fromEntries(SUBJECTS.map(s => [s, 0]));
    for (const q of bank) out[q.sub] = (out[q.sub] || 0) + 1;
    return out;
  }

  function countByGroup(bank) {
    const m = new Map();
    for (const q of bank) {
      const g = q.patternGroup || q.pattern || 'p';
      m.set(g, (m.get(g) || 0) + 1);
    }
    return m;
  }

  function logStats(bank, tag = 'BANK') {
    // eslint-disable-next-line no-console
    console.log(
      `[${tag} stats]`,
      countBySubject(bank),
      'total:',
      bank.length,
      'patternGroups:',
      countByGroup(bank).size
    );
  }

  /* =========================
   * Fallback bank (safe, multi-template)
   * ========================= */

  // ---- 国語 ----
  const JA_VOCAB = [
    ['適切', '状況や目的に合っている', ['無関係', '偶然', '不可能', '反対の意味']],
    ['抽象', '形がなく概念的なこと', ['具体', '部分', '単純', '偶然']],
    ['根拠', '理由やよりどころ', ['結論', '感想', '例外', '余談']],
    ['簡潔', 'むだがなく短いこと', ['複雑', '曖昧', '冗長', '回りくどい']],
    ['顕著', '目立ってはっきりしている', ['平凡', '微妙', '不明瞭', '短時間']],
    ['慎重', '注意深く行うこと', ['軽率', '大胆', '乱暴', '無関心']],
    ['要旨', '文章の中心となる内容', ['感想', '余談', '結末', '例外']],
    ['主張', '自分の意見として強く述べること', ['例示', '対比', '説明', '装飾']],
    ['克服', '困難に打ち勝つこと', ['拒否', '放棄', '模倣', '延期']],
    ['推測', '根拠から考えて見当をつけること', ['確定', '否定', '証明', '強制']],
    ['持続', '長く続くこと', ['停止', '崩壊', '拡大', '逆転']],
    ['柔軟', '状況に応じて変えられること', ['硬直', '強制', '固定', '乱暴']],
    ['妥当', '道理にかなっている', ['不当', '無関係', '偶然', '強引']],
    ['一貫', '途中で変わらず通していること', ['例外', '矛盾', '混乱', '断片']],
    ['蓄積', '少しずつためること', ['分散', '消費', '中断', '逆転']],
    ['普及', '広く行き渡ること', ['衰退', '限定', '拒否', '停滞']],
    ['顧みる', '過去や自分の行為をふり返る', ['見下す', '見送る', '見上げる', '見落とす']],
    ['協調', '互いに合わせて調子を整える', ['対立', '孤立', '拒絶', '分断']],
    ['逸脱', '基準から外れること', ['一致', '適合', '安定', '持続']],
    ['概念', '物事の共通点をまとめた考え', ['具体例', '手順', '噂', '感想']],
    ['前提', '先に成り立っているとみなす条件', ['結論', '結果', '例外', '余談']],
    ['仮説', '確かめるために立てる仮の説', ['事実', '常識', '迷信', '余談']],
    ['検証', '確かめて正しいか調べる', ['想像', '装飾', '省略', '誇張']],
    ['強調', '大事な点を目立たせる', ['縮小', '否定', '混同', '省略']],
    ['端的', '要点をつかんで簡単なさま', ['冗長', '曖昧', '複雑', '回りくどい']],
    ['顕在', '表に現れてはっきりしている', ['潜在', '偶然', '短時間', '無関係']],
    ['促進', '進みを早めること', ['抑制', '停止', '回避', '逆転']],
    ['代替', 'かわりに用いること', ['固定', '反復', '拒否', '記憶']],
    ['整合', 'つじつまが合うこと', ['矛盾', '混乱', '例外', '偶然']],
    ['拡張', '広げて大きくする', ['縮小', '分解', '停止', '放棄']],
    ['収束', 'ばらつきが小さくまとまる', ['分散', '拡散', '混乱', '逆転']],
    ['把握', '内容を理解してつかむこと', ['放置', '拒否', '誇張', '忘却']],
    ['示唆', 'それとなく教え示す', ['断言', '否定', '放置', '忘却']],
    ['許容', '受け入れて認める', ['拒絶', '否定', '停止', '中断']],
    ['批判', '良し悪しを考え評価する', ['賛同', '模倣', '放置', '忘却']],
    ['客観', '個人の感情に左右されない見方', ['主観', '偶然', '例外', '余談']],
    ['具体', 'はっきりと形や内容があること', ['抽象', '曖昧', '偶然', '不明瞭']],
    ['概略', 'おおまかな内容', ['詳細', '例外', '余談', '誇張']],
    ['論理', '筋道を立てて考えること', ['感情', '偶然', '直感', '装飾']],
  ];

  const JA_KANJI = [
    ['依頼', 'いらい', ['いらよ', 'いらく', 'いらいん']],
    ['適用', 'てきよう', ['てきゆう', 'てきもち', 'てきおう']],
    ['概要', 'がいよう', ['がいよ', 'かいよう', 'がいゆう']],
    ['継続', 'けいぞく', ['けいそく', 'けぞく', 'けいしょく']],
    ['増加', 'ぞうか', ['そうか', 'ぞうが', 'ぞうけ']],
    ['削減', 'さくげん', ['さくけん', 'しゃくげん', 'さつげん']],
    ['比較', 'ひかく', ['ひがく', 'ひかん', 'ひこう']],
    ['検討', 'けんとう', ['けんと', 'けんどう', 'けんとお']],
    ['改善', 'かいぜん', ['がいぜん', 'かいせん', 'かいぜい']],
    ['解釈', 'かいしゃく', ['かいせき', 'かいじゃく', 'かいしゃくん']],
    ['要因', 'よういん', ['ようじん', 'ようえん', 'ようい']],
    ['傾向', 'けいこう', ['けいごう', 'けいこ', 'けいこうん']],
    ['根拠', 'こんきょ', ['こんきょう', 'こんぎょ', 'こんこ']],
    ['統計', 'とうけい', ['とうげい', 'とけい', 'とうけ']],
    ['妥当', 'だとう', ['だと', 'たとう', 'だどう']],
    ['顕著', 'けんちょ', ['けんしょ', 'けんちゅ', 'けんちょう']],
    ['抽象', 'ちゅうしょう', ['ちゅうじょう', 'ちゅうそう', 'ちゅしょう']],
    ['具体', 'ぐたい', ['くたい', 'ぐだい', 'ぐたいん']],
  ];

  const JA_CONNECTOR = [
    ['雨が降っている。したがって、外に出ない。', '「したがって」の意味として最も近いものは？', 'だから', ['しかし', 'もし', 'たとえば', 'そして']],
    ['努力した。しかし、結果が出なかった。', '「しかし」の意味として最も近いものは？', '逆に（けれども）', ['だから', 'もし', 'つまり', 'それでも']],
    ['疲れていたので、早く寝た。', '「ので」のはたらきとして適切なのは？', '原因・理由', ['例示', '対比', '結論', '条件']],
    ['彼は走った。それでも間に合わなかった。', '「それでも」の意味として最も近いものは？', 'にもかかわらず', ['だから', 'つまり', 'たとえば', 'そのため']],
    ['魚だけでなく、肉も食べる。', '「〜だけでなく」の働きとして適切なのは？', '追加（Aに加えてB）', ['対比', '原因', '結論', '条件']],
    ['本を読んだ。つまり、知識が増えた。', '「つまり」の意味として最も近いものは？', '言い換えると', ['だから', 'しかし', 'たとえば', 'それでも']],
  ];

  function genJapanese(grade, diff, n) {
    const out = [];

    // vocab
    for (let i = 0; i < n; i++) {
      const it = pick(JA_VOCAB, i);
      const { c, a } = force4Unique(it[1], it[2], i, ['意味が反対', '意味が同じ']);
      out.push({
        sub: '国語',
        level: grade,
        diff,
        pattern: 'vocab',
        patternGroup: 'ja_vocab_meaning',
        q: `「${it[0]}」の意味として最も近いものは？`,
        c,
        a,
        exp: `「${it[0]}」＝「${it[1]}」。`,
      });
    }

    // kanji reading
    for (let i = 0; i < Math.max(6, Math.floor(n / 2)); i++) {
      const it = pick(JA_KANJI, i + 7);
      const correct = it[1];
      const wrongs = it[2];
      const { c, a } = force4Unique(correct, wrongs, i, ['よみ', 'よむ']);
      out.push({
        sub: '国語',
        level: grade,
        diff,
        pattern: 'kanji',
        patternGroup: 'ja_kanji_reading',
        q: `次の語の読み方として正しいものは？「${it[0]}」`,
        c,
        a,
        exp: `「${it[0]}」は「${correct}」。`,
      });
    }

    // connectors
    for (let i = 0; i < Math.max(6, Math.floor(n / 2)); i++) {
      const it = pick(JA_CONNECTOR, i + 13);
      const { c, a } = force4Unique(it[2], it[3], i, ['結論', '理由']);
      out.push({
        sub: '国語',
        level: grade,
        diff,
        pattern: 'reading',
        patternGroup: 'ja_connector',
        q: `${it[0]}\n質問：${it[1]}`,
        c,
        a,
        exp: `接続語のはたらきを確認。正解は「${it[2]}」。`,
      });
    }

    return out;
  }

  // ---- 数学 ----
  function genMath(grade, diff, n) {
    const out = [];

    const ratios = [
      { ctx: 'ジュース', a: 2, b: 3, unit: '本' },
      { ctx: 'クラス', a: 3, b: 5, unit: '人' },
      { ctx: '地図', a: 1, b: 25000, unit: 'cm' },
      { ctx: '料理', a: 4, b: 5, unit: 'g' },
    ];

    for (let i = 0; i < n; i++) {
      const kind = i % 6;

      // 1) 割合
      if (kind === 0) {
        const base = 100 + (i % 7) * 20;
        const p = 10 + (i % 8) * 5; // 10..45
        const correct = `${(base * p) / 100}`;
        const wrongPool = [`${(base * (p + 5)) / 100}`, `${(base * (p - 5)) / 100}`, `${base + p}`, `${base - p}`];
        const { c, a } = force4Unique(correct, wrongPool, i, [`${base * p}`, `${p}`]);
        out.push({
          sub: '数学',
          level: grade,
          diff,
          pattern: 'percent',
          patternGroup: 'math_percent',
          q: `ある数${base}の${p}%は？`,
          c,
          a,
          exp: `${p}%＝${p}/100。${base}×${p}/100＝${correct}。`,
        });
      }

      // 2) 比
      if (kind === 1) {
        const r = pick(ratios, i);
        const k = 2 + (i % 5);
        const A = r.a * k;
        const B = r.b * k;
        const correct = `${A}:${B}`;
        const wrongPool = [`${B}:${A}`, `${r.a}:${r.b}`, `${A}:${A}`, `${B}:${B}`];
        const { c, a } = force4Unique(correct, wrongPool, i, [`${A + B}:${B}`]);
        out.push({
          sub: '数学',
          level: grade,
          diff,
          pattern: 'ratio',
          patternGroup: 'math_ratio',
          q: `${r.ctx}の量が${A}${r.unit}と${B}${r.unit}のとき、比（前:後）は？`,
          c,
          a,
          exp: `比は${A}:${B}。`,
        });
      }

      // 3) 一次式（小は四則, 中は一次関数）
      if (kind === 2) {
        if (grade === '小') {
          const x = 6 + (i % 9);
          const y = 3 + (i % 7);
          const correct = `${x * y}`;
          const wrongPool = [`${x + y}`, `${x - y}`, `${x * (y + 1)}`, `${(x + 1) * y}`];
          const { c, a } = force4Unique(correct, wrongPool, i);
          out.push({
            sub: '数学',
            level: grade,
            diff,
            pattern: 'calc',
            patternGroup: 'math_arithmetic',
            q: `${x}×${y} の答えは？`,
            c,
            a,
            exp: `かけ算：${x}×${y}＝${correct}。`,
          });
        } else {
          const aCoef = pick([-3, -2, -1, 1, 2, 3], i);
          const bConst = pick([-5, -2, 0, 3, 6], i + 3);
          const x = pick([-2, -1, 0, 1, 2, 3], i + 5);
          const y = aCoef * x + bConst;
          const correct = `${y}`;
          const wrongPool = [`${y + 1}`, `${y - 1}`, `${aCoef * (x + 1) + bConst}`, `${aCoef * x - bConst}`];
          const { c, a } = force4Unique(correct, wrongPool, i);
          out.push({
            sub: '数学',
            level: grade,
            diff,
            pattern: 'function',
            patternGroup: 'math_linear',
            q: `一次関数 y = ${aCoef}x ${bConst >= 0 ? '+ ' + bConst : '- ' + Math.abs(bConst)} において、x=${x} のとき y は？`,
            c,
            a,
            exp: `代入：y=${aCoef}×${x}${bConst >= 0 ? '+' + bConst : '-' + Math.abs(bConst)}＝${correct}。`,
          });
        }
      }

      // 4) 図形（角）
      if (kind === 3) {
        const base = 180;
        const a1 = 30 + (i % 7) * 10;
        const a2 = 40 + (i % 6) * 10;
        const x = base - a1 - a2;
        const correct = `${x}`;
        const wrongPool = [`${x + 10}`, `${x - 10}`, `${a1 + a2}`, `${base - a1}`];
        const { c, a } = force4Unique(correct, wrongPool, i);
        out.push({
          sub: '数学',
          level: grade,
          diff,
          pattern: 'geometry',
          patternGroup: 'math_angle',
          q: `三角形の内角の和は180°である。2つの角が${a1}°と${a2}°のとき、残りの角は何度？`,
          c,
          a,
          exp: `180−${a1}−${a2}＝${correct}。`,
        });
      }

      // 5) 確率（中のみ）
      if (kind === 4) {
        if (grade === '小') {
          const nA = 8 + (i % 7);
          const nB = 3 + (i % 5);
          const correct = `${nA - nB}`;
          const wrongPool = [`${nA + nB}`, `${nA * nB}`, `${nA}` , `${nB}`];
          const { c, a } = force4Unique(correct, wrongPool, i);
          out.push({
            sub: '数学',
            level: grade,
            diff,
            pattern: 'calc',
            patternGroup: 'math_arithmetic',
            q: `${nA}個のうち${nB}個を取りのぞくと、残りはいくつ？`,
            c,
            a,
            exp: `${nA}−${nB}＝${correct}。`,
          });
        } else {
          const red = 2 + (i % 4);
          const blue = 3 + (i % 5);
          const total = red + blue;
          const correct = `${red}/${total}`;
          const wrongPool = [`${blue}/${total}`, `${red}/${blue}`, `${total}/${red}`, `${1}/${total}`];
          const { c, a } = force4Unique(correct, wrongPool, i);
          out.push({
            sub: '数学',
            level: grade,
            diff,
            pattern: 'prob',
            patternGroup: 'math_probability',
            q: `赤玉${red}個、青玉${blue}個が入った袋から1個取り出す。赤玉を引く確率は？（分数で）`,
            c,
            a,
            exp: `全体${total}通り中、赤は${red}通り → ${red}/${total}。`,
          });
        }
      }

      // 6) 平均（中のみだが小でも可）
      if (kind === 5) {
        const nums = [
          40 + (i % 5) * 5,
          50 + (i % 7) * 3,
          60 + (i % 6) * 4,
          70 + (i % 4) * 6,
        ];
        const sum = nums.reduce((a, b) => a + b, 0);
        const avg = sum / nums.length;
        const correct = `${avg}`;
        const wrongPool = [`${avg + 1}`, `${avg - 1}`, `${sum}`, `${nums[0]}`];
        const { c, a } = force4Unique(correct, wrongPool, i);
        out.push({
          sub: '数学',
          level: grade,
          diff,
          pattern: 'stats',
          patternGroup: 'math_mean',
          q: `${nums.join('、')} の平均は？`,
          c,
          a,
          exp: `合計${sum}を${nums.length}で割る：${sum}/${nums.length}＝${avg}。`,
        });
      }
    }

    return out;
  }

  // ---- 英語 ----
  const ENG_VERBS = [
    { subj: 'He', base: 'play', third: 'plays', tail: 'soccer' },
    { subj: 'She', base: 'study', third: 'studies', tail: 'English' },
    { subj: 'Ken', base: 'like', third: 'likes', tail: 'music' },
    { subj: 'My father', base: 'watch', third: 'watches', tail: 'TV' },
  ];

  const ENG_PAST = [
    { subj: 'I', base: 'go', past: 'went', tail: 'to the park' },
    { subj: 'We', base: 'eat', past: 'ate', tail: 'lunch' },
    { subj: 'They', base: 'see', past: 'saw', tail: 'a movie' },
    { subj: 'I', base: 'buy', past: 'bought', tail: 'a book' },
  ];

  const ENG_PREP = [
    { correct: 'at', hint: '7 o\'clock', exp: '時刻は at' },
    { correct: 'on', hint: 'Sunday', exp: '曜日は on' },
    { correct: 'in', hint: 'April', exp: '月は in' },
    { correct: 'in', hint: 'Japan', exp: '国は in' },
    { correct: 'at', hint: 'school', exp: '地点（学校）は at' },
  ];

  const ENG_CONNECT = [
    { sent: 'I was tired, so I went to bed early.', ask: 'so の意味は？', correct: 'だから', wrongs: ['しかし', 'もし', 'そして', 'たとえば'] },
    { sent: 'I studied hard, but I couldn\'t solve the problem.', ask: 'but の意味は？', correct: 'しかし', wrongs: ['だから', 'もし', 'そして', 'そのため'] },
    { sent: 'I stayed home because it was raining.', ask: 'because の意味は？', correct: '〜なので（なぜなら）', wrongs: ['しかし', 'もし', 'そして', 'だから'] },
  ];

  const ENG_VOCAB = [
    { w: 'important', j: '重要な', wrongs: ['高価な', '難しい', '静かな'] },
    { w: 'different', j: '違う', wrongs: ['同じ', '便利な', '遅い'] },
    { w: 'decide', j: '決める', wrongs: ['助ける', '閉める', '守る'] },
    { w: 'arrive', j: '到着する', wrongs: ['出発する', '借りる', '答える'] },
    { w: 'borrow', j: '借りる', wrongs: ['貸す', '買う', '返す'] },
    { w: 'lend', j: '貸す', wrongs: ['借りる', '送る', '返す'] },
    { w: 'busy', j: '忙しい', wrongs: ['退屈な', '簡単な', '遅い'] },
    { w: 'always', j: 'いつも', wrongs: ['ときどき', '決して〜ない', 'すぐに'] },
  ];

  function genEnglish(grade, diff, n) {
    const out = [];

    for (let i = 0; i < n; i++) {
      const kind = i % 6;

      // 1) 三単現
      if (kind === 0) {
        const v = pick(ENG_VERBS, i);
        const correct = v.third;
        const wrongPool = [v.base, v.base + 'ed', v.base + 'ing', 'will ' + v.base, 'can ' + v.base];
        const { c, a } = force4Unique(correct, wrongPool, i, ['is ' + v.base + 'ing']);
        out.push({
          sub: '英語',
          level: grade,
          diff,
          pattern: 'grammar',
          patternGroup: 'eng_third_person',
          q: `(　)に入る語は？ ${v.subj} (   ) ${v.tail}.`,
          c,
          a,
          exp: `${v.subj} は三人称単数 → 動詞は ${correct}。`,
        });
      }

      // 2) 過去形
      if (kind === 1) {
        const v = pick(ENG_PAST, i);
        const correct = v.past;
        const wrongPool = [v.base, v.base + 's', v.base + 'ing', 'will ' + v.base, 'can ' + v.base];
        const { c, a } = force4Unique(correct, wrongPool, i, ['am ' + v.base + 'ing']);
        out.push({
          sub: '英語',
          level: grade,
          diff,
          pattern: 'grammar',
          patternGroup: 'eng_past',
          q: `(　)に入る語は？ ${v.subj} (   ) ${v.tail} yesterday.`,
          c,
          a,
          exp: `yesterday があるので過去形。`,
        });
      }

      // 3) 前置詞
      if (kind === 2) {
        const p = pick(ENG_PREP, i);
        const correct = p.correct;
        const wrongPool = ['in', 'on', 'at', 'to', 'for', 'with', 'from'].filter(x => x !== correct);
        const { c, a } = force4Unique(correct, wrongPool, i, ['by', 'about']);
        out.push({
          sub: '英語',
          level: grade,
          diff,
          pattern: 'grammar',
          patternGroup: 'eng_preposition',
          q: `(　)に入る語は？ We meet (   ) ${p.hint}.`,
          c,
          a,
          exp: p.exp,
        });
      }

      // 4) 比較級
      if (kind === 3) {
        const items = [
          { base: 'tall', comp: 'taller' },
          { base: 'fast', comp: 'faster' },
          { base: 'easy', comp: 'easier' },
          { base: 'interesting', comp: 'more interesting' },
          { base: 'beautiful', comp: 'more beautiful' },
        ];
        const ad = pick(items, i);
        const correct = ad.comp;
        const wrongPool = [ad.base, ad.base + 'est', 'the ' + ad.base + 'est', 'more ' + ad.base, 'most ' + ad.base].filter(x => x !== correct);
        const { c, a } = force4Unique(correct, wrongPool, i, ['as ' + ad.base + ' as', 'less ' + ad.base]);
        out.push({
          sub: '英語',
          level: grade,
          diff,
          pattern: 'grammar',
          patternGroup: 'eng_comparative',
          q: `(　)に入る語は？ This book is (   ) than that one.`,
          c,
          a,
          exp: `比較級：${ad.base} → ${correct}`,
        });
      }

      // 5) 接続語
      if (kind === 4) {
        const it = pick(ENG_CONNECT, i);
        const { c, a } = force4Unique(it.correct, it.wrongs, i, ['それにもかかわらず', 'したがって']);
        out.push({
          sub: '英語',
          level: grade,
          diff,
          pattern: 'reading',
          patternGroup: 'eng_reading_connector',
          q: `英文："${it.sent}"\n質問：${it.ask}`,
          c,
          a,
          exp: `正解：${it.correct}`,
        });
      }

      // 6) 語彙
      if (kind === 5) {
        const it = pick(ENG_VOCAB, i);
        const { c, a } = force4Unique(it.j, it.wrongs, i, ['〜ではない', '反対の意味']);
        out.push({
          sub: '英語',
          level: grade,
          diff,
          pattern: 'vocab',
          patternGroup: 'eng_vocab_basic',
          q: `次の英単語の意味として最も近いものは？ ${it.w}`,
          c,
          a,
          exp: `${it.w}＝${it.j}`,
        });
      }
    }

    return out;
  }

  // ---- 理科 ----
  function genScience(grade, diff, n) {
    const out = [];

    const chemSymbols = [
      { sym: 'H', name: '水素', wrongs: ['酸素', '窒素', '炭素'] },
      { sym: 'O', name: '酸素', wrongs: ['水素', '窒素', '塩素'] },
      { sym: 'C', name: '炭素', wrongs: ['カルシウム', '塩素', '銅'] },
      { sym: 'Na', name: 'ナトリウム', wrongs: ['窒素', 'ネオン', 'ニッケル'] },
      { sym: 'Fe', name: '鉄', wrongs: ['銀', '銅', '鉛'] },
    ];

    const bio = [
      { q: '光合成で主に作られる養分は？', correct: 'でんぷん', wrongs: ['たんぱく質', '脂肪', 'ビタミン'] },
      { q: '植物の細胞にあり、光合成に関わるつくりは？', correct: '葉緑体', wrongs: ['細胞膜', '核', '液胞'] },
      { q: '消化によって最終的にブドウ糖になる栄養素は？', correct: 'でんぷん', wrongs: ['脂肪', 'たんぱく質', 'ミネラル'] },
    ];

    const earth = [
      { q: '天気図で低気圧の近くでは一般にどのような天気になりやすい？', correct: '雲が多く雨になりやすい', wrongs: ['快晴になりやすい', '必ず雪になる', '必ず台風になる'] },
      { q: '地震の揺れで最初に伝わる波（縦波）を何という？', correct: 'P波', wrongs: ['S波', 'L波', 'T波'] },
      { q: '月が満月から次の満月までの期間はおよそ何日？', correct: '約29.5日', wrongs: ['約7日', '約15日', '約365日'] },
    ];

    for (let i = 0; i < n; i++) {
      const kind = i % 6;

      // 密度
      if (kind === 0) {
        const d = pick([0.8, 1.0, 1.2, 2.0, 2.7, 7.9], i);
        const v = pick([10, 15, 20, 25, 30, 40], i + 2);
        const m = d * v;
        const correct = `${m}g`;
        const wrongPool = [`${v}g`, `${(d + 1) * v}g`, `${m + 10}g`, `${Math.max(0, m - 10)}g`];
        const { c, a } = force4Unique(correct, wrongPool, i);
        out.push({
          sub: '理科',
          level: grade,
          diff,
          pattern: 'calc',
          patternGroup: 'sci_density',
          q: `密度${d}g/cm³の物体の体積が${v}cm³のとき、質量は？`,
          c,
          a,
          exp: `質量＝密度×体積＝${d}×${v}＝${m}g。`,
        });
      }

      // オームの法則
      if (kind === 1) {
        const R = pick([2, 4, 5, 8, 10], i);
        const I = pick([0.2, 0.5, 1.0, 1.5, 2.0], i + 3);
        const V = R * I;
        const correct = `${V}V`;
        const wrongPool = [`${R}V`, `${I}V`, `${V + 1}V`, `${Math.max(0, V - 1)}V`];
        const { c, a } = force4Unique(correct, wrongPool, i);
        out.push({
          sub: '理科',
          level: grade,
          diff,
          pattern: 'physics',
          patternGroup: 'sci_ohm',
          q: `抵抗${R}Ω、電流${I}Aのとき、電圧は？（V=IR）`,
          c,
          a,
          exp: `V=IR=${R}×${I}=${V}V。`,
        });
      }

      // 化学記号
      if (kind === 2) {
        const it = pick(chemSymbols, i);
        const { c, a } = force4Unique(it.name, it.wrongs, i);
        out.push({
          sub: '理科',
          level: grade,
          diff,
          pattern: 'chemistry',
          patternGroup: 'sci_symbol',
          q: `元素記号「${it.sym}」に対応する元素名は？`,
          c,
          a,
          exp: `${it.sym} は「${it.name}」。`,
        });
      }

      // 生物
      if (kind === 3) {
        const it = pick(bio, i);
        const { c, a } = force4Unique(it.correct, it.wrongs, i);
        out.push({
          sub: '理科',
          level: grade,
          diff,
          pattern: 'biology',
          patternGroup: 'sci_bio_basic',
          q: it.q,
          c,
          a,
          exp: `基本事項。正解：${it.correct}。`,
        });
      }

      // 地学
      if (kind === 4) {
        const it = pick(earth, i);
        const { c, a } = force4Unique(it.correct, it.wrongs, i);
        out.push({
          sub: '理科',
          level: grade,
          diff,
          pattern: 'earth',
          patternGroup: 'sci_earth_basic',
          q: it.q,
          c,
          a,
          exp: `基本事項。正解：${it.correct}。`,
        });
      }

      // 実験
      if (kind === 5) {
        const items = [
          { q: 'リトマス紙が赤色から青色に変わるのは、液体が何性のとき？', correct: 'アルカリ性', wrongs: ['酸性', '中性', '塩性'] },
          { q: '水に食塩が溶けた液体は何という？', correct: '食塩水', wrongs: ['砂糖水', '蒸留水', '純水'] },
          { q: '金属をこすると熱くなるのは主に何エネルギーが変化したため？', correct: '運動エネルギー', wrongs: ['位置エネルギー', '化学エネルギー', '光エネルギー'] },
        ];
        const it = pick(items, i);
        const { c, a } = force4Unique(it.correct, it.wrongs, i);
        out.push({
          sub: '理科',
          level: grade,
          diff,
          pattern: 'experiment',
          patternGroup: 'sci_experiment',
          q: it.q,
          c,
          a,
          exp: `基本事項。正解：${it.correct}。`,
        });
      }
    }

    return out;
  }

  // ---- 社会 ----
  function genSocial(grade, diff, n) {
    const out = [];

    const civics = [
      { q: '国会が法律を定めるはたらきを何という？', correct: '立法', wrongs: ['行政', '司法', '自治'] },
      { q: '内閣が政治を行い法律を実行するはたらきは？', correct: '行政', wrongs: ['立法', '司法', '自治'] },
      { q: '裁判所が争いを裁くはたらきは？', correct: '司法', wrongs: ['立法', '行政', '自治'] },
      { q: '裁判所が法令が憲法に反しないか判断する権限は？', correct: '違憲審査権', wrongs: ['国政調査権', '予算先議権', '地方自治'] },
      { q: '地方公共団体が地域のことを自主的に行うしくみは？', correct: '地方自治', wrongs: ['三権分立', '国民主権', '議院内閣制'] },
    ];

    const geo = [
      { q: '日本の最北端にある都道府県は？', correct: '北海道', wrongs: ['青森県', '岩手県', '秋田県'] },
      { q: '日本の首都は？', correct: '東京', wrongs: ['大阪', '京都', '名古屋'] },
      { q: '赤道付近の気候の特徴として適切なのは？', correct: '一年中高温で雨が多い', wrongs: ['一年中寒い', '雨がほとんど降らない', '四季の変化が大きい'] },
      { q: '水資源を確保するために造られる大きな貯水施設を何という？', correct: 'ダム', wrongs: ['運河', '堤防', '水門'] },
    ];

    const history = [
      { q: '鎌倉幕府を開いた人物は？', correct: '源頼朝', wrongs: ['足利尊氏', '徳川家康', '豊臣秀吉'] },
      { q: '江戸幕府を開いた人物は？', correct: '徳川家康', wrongs: ['織田信長', '豊臣秀吉', '源頼朝'] },
      { q: '明治時代に行われた身分制度の見直しなどの改革を何という？', correct: '明治維新', wrongs: ['大化の改新', '鎖国', '南北朝'] },
    ];

    for (let i = 0; i < n; i++) {
      const kind = i % 5;

      // 公民
      if (kind === 0) {
        const it = pick(civics, i);
        const { c, a } = force4Unique(it.correct, it.wrongs, i);
        out.push({
          sub: '社会',
          level: grade,
          diff,
          pattern: 'civics',
          patternGroup: 'soc_civics',
          q: it.q,
          c,
          a,
          exp: `基本用語。正解：${it.correct}。`,
        });
      }

      // 地理
      if (kind === 1) {
        const it = pick(geo, i);
        const { c, a } = force4Unique(it.correct, it.wrongs, i);
        out.push({
          sub: '社会',
          level: grade,
          diff,
          pattern: 'geo',
          patternGroup: 'soc_geo_basic',
          q: it.q,
          c,
          a,
          exp: `基本事項。`,
        });
      }

      // 時差（15°=1時間）
      if (kind === 2) {
        const step = pick([15, 30, 45, 60], i);
        const hours = step / 15;
        const dir = i % 2 === 0 ? '東' : '西';
        const correct = dir === '東' ? `${hours}時間進む` : `${hours}時間遅れる`;
        const wrongPool = [
          dir === '東' ? `${hours}時間遅れる` : `${hours}時間進む`,
          '30分進む',
          '30分遅れる',
          '2時間進む',
          '2時間遅れる',
        ];
        const { c, a } = force4Unique(correct, wrongPool, i);
        out.push({
          sub: '社会',
          level: grade,
          diff,
          pattern: 'geo',
          patternGroup: 'soc_time',
          q: `経度が${step}°${dir}へ移動すると、時刻は一般に？`,
          c,
          a,
          exp: `15°で1時間。東へ行くほど進み、西へ行くほど遅れる。`,
        });
      }

      // 歴史
      if (kind === 3) {
        const it = pick(history, i);
        const { c, a } = force4Unique(it.correct, it.wrongs, i);
        out.push({
          sub: '社会',
          level: grade,
          diff,
          pattern: 'history',
          patternGroup: 'soc_history_basic',
          q: it.q,
          c,
          a,
          exp: `基本事項。`,
        });
      }

      // 経済（需要供給の超基礎）
      if (kind === 4) {
        const items = [
          { q: 'ある商品の人気が高まり、買いたい人が増えた。このとき一般に価格はどうなりやすい？', correct: '上がりやすい', wrongs: ['下がりやすい', '必ず0になる', '変化しない'] },
          { q: '商品が大量に生産され、店に多く並んだ。このとき一般に価格はどうなりやすい？', correct: '下がりやすい', wrongs: ['上がりやすい', '必ず0になる', '変化しない'] },
        ];
        const it = pick(items, i);
        const { c, a } = force4Unique(it.correct, it.wrongs, i);
        out.push({
          sub: '社会',
          level: grade,
          diff,
          pattern: 'economy',
          patternGroup: 'soc_economy_basic',
          q: it.q,
          c,
          a,
          exp: '需要が増えると価格は上がりやすく、供給が増えると価格は下がりやすい。',
        });
      }
    }

    return out;
  }

  /* =========================
   * Build
   * ========================= */
  function buildFallbackBank() {
    let bank = [];

    // 各組み合わせで最低12問ずつ生成（= 6 combos * 12 = 72/subject 以上を保証）
    const MIN_PER_COMBO = 12;

    for (const g of GRADES) {
      for (const d of DIFFS) {
        bank.push(...genJapanese(g, d, MIN_PER_COMBO));
        bank.push(...genMath(g, d, MIN_PER_COMBO));
        bank.push(...genEnglish(g, d, MIN_PER_COMBO));
        bank.push(...genScience(g, d, MIN_PER_COMBO));
        bank.push(...genSocial(g, d, MIN_PER_COMBO));
      }
    }

    // enrich & validate
    bank = enrich(bank).filter(validateQuestion);

    // もし何かで削られても、各教科に最低 60 以上あることを保証
    const counts = countBySubject(bank);
    const need = (s) => Math.max(0, 60 - (counts[s] || 0));

    if (need('国語') > 0) bank.push(...genJapanese('中', '標準', need('国語') + 10));
    if (need('数学') > 0) bank.push(...genMath('中', '標準', need('数学') + 10));
    if (need('英語') > 0) bank.push(...genEnglish('中', '標準', need('英語') + 10));
    if (need('理科') > 0) bank.push(...genScience('中', '標準', need('理科') + 10));
    if (need('社会') > 0) bank.push(...genSocial('中', '標準', need('社会') + 10));

    bank = enrich(bank).filter(validateQuestion);
    return bank;
  }

  function main() {
    const existing = Array.isArray(window.BANK) ? window.BANK : null;

    // 既存のBANKが十分あるなら、上書きせずに enrich + 軽い検品だけする
    if (existing && existing.length >= 200) {
      const bank = enrich(existing).filter(validateQuestion);
      window.BANK = bank;
      logStats(bank, 'BANK(existing)');
      return;
    }

    // 無い/小さい場合は fallback を構築
    const bank = buildFallbackBank();
    window.BANK = bank;
    logStats(bank, 'BANK(fallback)');
  }

  main();
})();
