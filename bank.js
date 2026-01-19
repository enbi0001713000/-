/* bank.js（全文置き換え版：理社さらに難化／数学も思考系へ強化）
  目的：
  - 5教科（国語/数学/英語/理科/社会）を自動生成
  - 理科・社会：資料読解・条件整理・因果推論を厚めにして難化
  - 数学：中学受験～高校受験の「考えさせる」典型（場合の数・規則性・整数・図形比・条件付き確率など）
  - patternGroup を細分化して同型連発を抑制（app.js 側の avoidSimilar が効く前提）
  - 問題文に公式ヒント（15°=1h, V=IR, 力/面積 等）を直接書かない（exp側にのみ根拠）
  - 4択品質：空/重複/メタ選択肢排除、aは0-3、c[a]が正答として妥当

  使い方：
  - このファイルを bank.js として丸ごと置き換え
  - Pages更新 → スーパーリロード → console の [BANK stats] を確認
*/

(function () {
  "use strict";

  /* =========================
   * 定数
   * ========================= */
  const SUBJECTS = ["国語", "数学", "英語", "理科", "社会"];
  const GRADES = ["小", "中"];
  const DIFFS = ["基礎", "標準", "発展"];

  // 生成量（ランタイムで生成される。ファイル自体は肥大しない）
  // ※理科・社会・数学は難化＆多様化のため増量
  const TARGET = {
    国語: 320,
    数学: 520,
    英語: 360,
    理科: 520,
    社会: 520,
  };

  // 教科別の最低保証（不足事故の保険）
  const MIN_PER_SUBJECT = 220;

  /* =========================
   * 乱数（再現性のある擬似乱数）
   * ========================= */
  function mulberry32(seed) {
    let a = seed >>> 0;
    return function () {
      a |= 0;
      a = (a + 0x6D2B79F5) | 0;
      let t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }
  const rint = (rnd, n) => (rnd() * n) | 0;
  const pick = (rnd, arr) => arr[rint(rnd, arr.length)];

  function shuffleWith(rnd, arr) {
    const a = arr.slice();
    for (let i = a.length - 1; i > 0; i--) {
      const j = (rnd() * (i + 1)) | 0;
      [a[i], a[j]] = [a[j], a[i]];
    }
    return a;
  }

  /* =========================
   * 文字正規化・uid
   * ========================= */
  function normalizeText(s) {
    return String(s ?? "")
      .normalize("NFKC")
      .toLowerCase()
      .replace(/\s+/g, " ")
      .trim();
  }

  function makeUid(q) {
    const sub = normalizeText(q?.sub);
    const qt = normalizeText(q?.q);
    const choices = Array.isArray(q?.c) ? q.c.map(normalizeText).join("||") : "";
    const a = Number.isFinite(q?.a) ? q.a : -1;
    return `${sub}::${qt}::${choices}::a=${a}`;
  }

  /* =========================
   * 4択生成（ユニーク保証）
   * ========================= */
  function isBadChoiceText(s) {
    const t = String(s ?? "").trim();
    if (!t) return true;

    // メタ選択肢（避ける）
    const banned = [
      "不明",
      "わからない",
      "どれでもない",
      "上のいずれでもない",
      "該当なし",
      "全部",
      "すべて",
      "この中にはない",
      "not mentioned",
      "not stated",
    ];
    const tl = t.toLowerCase();
    if (banned.includes(t) || banned.includes(tl)) return true;

    return false;
  }

  function uniqKeep(arr) {
    const out = [];
    const seen = new Set();
    for (const x of arr) {
      const t = String(x ?? "").trim();
      if (!t) continue;
      if (seen.has(t)) continue;
      seen.add(t);
      out.push(t);
    }
    return out;
  }

  // correct を含む4択を作る
  function force4Unique(rnd, correct, wrongPool, extraPool = []) {
    const c0 = String(correct ?? "").trim();
    const pool = uniqKeep(wrongPool)
      .filter((x) => x && x !== c0 && !isBadChoiceText(x));
    const extra = uniqKeep(extraPool)
      .filter((x) => x && x !== c0 && !isBadChoiceText(x));

    let wrongs = [];
    wrongs = wrongs.concat(shuffleWith(rnd, pool));
    wrongs = wrongs.concat(shuffleWith(rnd, extra));

    // 保険（極力使われない）
    const safe = ["0", "1", "2", "3", "4", "5", "10", "20", "30", "100"];
    wrongs = wrongs.concat(safe.filter((x) => x !== c0));

    const picked = [];
    for (const w of wrongs) {
      if (picked.length >= 3) break;
      if (w === c0) continue;
      if (picked.includes(w)) continue;
      picked.push(w);
    }

    const cands = [c0, ...picked];
    const final = uniqKeep(cands).slice(0, 4);
    while (final.length < 4) final.push(`(${final.length})`);

    const shuffled = shuffleWith(rnd, final);
    const a = shuffled.indexOf(c0);
    return { c: shuffled, a };
  }

  /* =========================
   * スキーマ検証
   * ========================= */
  function validateQuestion(q) {
    if (!q) return false;
    if (!SUBJECTS.includes(q.sub)) return false;
    if (!GRADES.includes(q.level)) return false;
    if (!DIFFS.includes(q.diff)) return false;

    if (typeof q.patternGroup !== "string" || !q.patternGroup.trim()) return false;
    if (typeof q.pattern !== "string" || !q.pattern.trim()) return false;

    if (typeof q.q !== "string" || !q.q.trim()) return false;
    if (!Array.isArray(q.c) || q.c.length !== 4) return false;
    if (typeof q.a !== "number" || q.a < 0 || q.a > 3) return false;

    const choices = q.c.map((x) => String(x ?? "").trim());
    if (choices.some(isBadChoiceText)) return false;

    const set = new Set(choices);
    if (set.size !== 4) return false;

    if (!choices[q.a]) return false;
    return true;
  }

  /* =========================
   * 追加（key/uid付与）
   * ========================= */
  function toKey(q, i) {
    return q.key || `${q.sub}|${q.level}|${q.diff}|${q.patternGroup}|${(q.q || "").slice(0, 48)}|${i}`;
  }

  function add(bank, q) {
    const i = bank.length;
    q.key = toKey(q, i);
    q.uid = q.uid || makeUid(q);
    bank.push(q);
  }

  /* =========================
   * ユーティリティ：分数/最大公約数
   * ========================= */
  function gcd(a, b) {
    a = Math.abs(a); b = Math.abs(b);
    while (b) [a, b] = [b, a % b];
    return a;
  }
  function frac(n, d) {
    const g = gcd(n, d);
    n /= g; d /= g;
    if (d === 1) return `${n}`;
    return `${n}/${d}`;
  }

  /* =========================
   * 時刻/経度（社会）
   * ========================= */
  const pad2 = (n) => String(n).padStart(2, "0");
  function toMin(h, m) {
    return ((h * 60 + m) % (24 * 60) + (24 * 60)) % (24 * 60);
  }
  function fromMin(min) {
    const x = ((min % (24 * 60)) + (24 * 60)) % (24 * 60);
    const h = (x / 60) | 0;
    const m = x % 60;
    return `${pad2(h)}:${pad2(m)}`;
  }
  function lonToDeg(lon) {
    return lon.dir === "E" ? lon.deg : -lon.deg;
  }
  function formatLon(lon) {
    return `${lon.dir === "E" ? "東経" : "西経"}${lon.deg}°`;
  }

  /* =========================
   * 国語：多様化（四字熟語/ことわざ/語彙/漢字/文脈/SPI言語風）
   * ========================= */
  function genJapanese(bank, n, seedBase = 1000) {
    const idioms = [
      { y: "一石二鳥", m: "一つの行為で二つの利益を得る", w: ["努力しても報われない", "危険を冒して挑む", "勢いに任せて行う"] },
      { y: "臥薪嘗胆", m: "目的のため苦労に耐えて努力する", w: ["すぐにあきらめる", "うまくいった時に油断する", "他人に頼り切る"] },
      { y: "優柔不断", m: "決断がはっきりしない", w: ["考えずに即断する", "強い意志で貫く", "判断が正確で迷わない"] },
      { y: "温故知新", m: "昔のことを学び新しい知見を得る", w: ["新しいことだけを追う", "過去を忘れる", "感情で判断する"] },
      { y: "疑心暗鬼", m: "疑う気持ちが強くなり何でも怪しく思う", w: ["冷静に事実を確認する", "信頼を深める", "安心して任せる"] },
      { y: "破釜沈舟", m: "覚悟を決めて全力でやり抜く", w: ["途中で引き返す", "様子を見る", "運に任せる"] },
      { y: "公明正大", m: "私心がなく正しく公平である", w: ["自分の利益を優先する", "不正を隠す", "議論を避ける"] },
      { y: "臨機応変", m: "状況に応じて適切に対応する", w: ["一切方針を変えない", "無計画に動く", "思いつきだけで行動する"] },
    ];

    const proverbs = [
      { q: "「石の上にも（　）」の（　）に入る語は？", a: "三年", w: ["一日", "百年", "十分"], exp: "辛抱すれば成果が出る、の意味。" },
      { q: "「（　）も木から落ちる」の（　）に入る語は？", a: "猿", w: ["犬", "猫", "鳥"], exp: "名人でも失敗する、の意味。" },
      { q: "「急がば（　）」の（　）に入る語は？", a: "回れ", w: ["走れ", "飛べ", "止まれ"], exp: "急ぐときほど確実な方法を、の意味。" },
      { q: "「（　）に水」の（　）に入る語は？", a: "焼け石", w: ["木の葉", "土", "氷"], exp: "効果がほとんどない、の意味。" },
    ];

    const kanji = [
      { k: "精査", r: "せいさ", w: ["せいしゃ", "しょうさ", "せんさ"] },
      { k: "端的", r: "たんてき", w: ["たんてい", "はたんてき", "たんていき"] },
      { k: "逸脱", r: "いつだつ", w: ["いちだつ", "いったつ", "いつたつ"] },
      { k: "概ね", r: "おおむね", w: ["おおまね", "おおね", "おおむめ"] },
      { k: "憂慮", r: "ゆうりょ", w: ["ゆりょ", "ゆうろ", "ようりょ"] },
      { k: "即応", r: "そくおう", w: ["そくお", "しょくおう", "そくよう"] },
      { k: "緻密", r: "ちみつ", w: ["ちみち", "しみつ", "ちみちつ"] },
      { k: "顕著", r: "けんちょ", w: ["けんしょ", "けんちゃく", "けんちょう"] },
    ];

    const contextFill = [
      { q: "次の文の（　）に入る語として最も適切なものは？\n「議論が（　）して論点が見えにくくなった。」", a: "拡散", w: ["収束", "固定", "一貫"] },
      { q: "次の文の（　）に入る語として最も適切なものは？\n「結論はデータから（　）される。」", a: "導出", w: ["装飾", "回避", "放置"] },
      { q: "次の文の（　）に入る語として最も適切なものは？\n「根拠が（　）な主張は説得力に欠ける。」", a: "薄い", w: ["濃い", "鋭い", "重い"] },
      { q: "次の文の（　）に入る語として最も適切なものは？\n「説明は（　）で、要点がすぐ伝わった。」", a: "簡潔", w: ["冗長", "散漫", "唐突"] },
    ];

    const spiLike = [
      { q: "次の語の意味として最も近いものは？「本質」", a: "物事の中心となる性質", w: ["表面上の印象", "偶然の出来事", "細部の違い"] },
      { q: "次の語の意味として最も近いものは？「妥当」", a: "筋が通っていて適切", w: ["強引で押し切る", "曖昧で不明確", "極端で偏っている"] },
      { q: "次の語の意味として最も近いものは？「逆説」", a: "一見矛盾するようで真理を含む表現", w: ["単なる同義反復", "無関係な説明", "事実の羅列"] },
      { q: "次の語の意味として最も近いものは？「補足」", a: "不足を補って付け加えること", w: ["内容を削ること", "結論を先に言うこと", "無関係な話題に変えること"] },
    ];

    for (let i = 0; i < n; i++) {
      const rnd = mulberry32(seedBase + i);
      const kind = i % 5;

      if (kind === 0) {
        const it = pick(rnd, idioms);
        const { c, a } = force4Unique(rnd, it.m, it.w, ["状況に合っている", "筋が通っている", "意味が明確である"]);
        add(bank, {
          sub: "国語", level: "中", diff: "標準",
          pattern: "vocab",
          patternGroup: "ja_idiom_meaning",
          q: `「${it.y}」の意味として最も近いものは？`,
          c, a,
          exp: `「${it.y}」＝「${it.m}」。`,
        });
      } else if (kind === 1) {
        const it = pick(rnd, proverbs);
        const { c, a } = force4Unique(rnd, it.a, it.w, ["一週間", "十年", "三日"]);
        add(bank, {
          sub: "国語", level: "中", diff: "標準",
          pattern: "vocab",
          patternGroup: "ja_proverb",
          q: it.q,
          c, a,
          exp: it.exp,
        });
      } else if (kind === 2) {
        const it = pick(rnd, kanji);
        const { c, a } = force4Unique(rnd, it.r, it.w, ["けんしゅ", "ちみち", "ゆうりょう"]);
        add(bank, {
          sub: "国語", level: "中", diff: "発展",
          pattern: "kanji",
          patternGroup: "ja_kanji_reading",
          q: `次の漢字の読みとして正しいものは？「${it.k}」`,
          c, a,
          exp: `「${it.k}」は「${it.r}」。`,
        });
      } else if (kind === 3) {
        const it = pick(rnd, contextFill);
        const { c, a } = force4Unique(rnd, it.a, it.w, ["適切", "明確", "丁寧"]);
        add(bank, {
          sub: "国語", level: "中", diff: "発展",
          pattern: "reading",
          patternGroup: "ja_context_fill",
          q: it.q,
          c, a,
          exp: `文脈上、自然な語を選ぶ。正解は「${it.a}」。`,
        });
      } else {
        const it = pick(rnd, spiLike);
        const { c, a } = force4Unique(rnd, it.a, it.w, ["具体例", "感情", "単なる偶然"]);
        add(bank, {
          sub: "国語", level: "中", diff: "標準",
          pattern: "vocab",
          patternGroup: "ja_spi_like",
          q: it.q,
          c, a,
          exp: `語の定義を押さえる。`,
        });
      }
    }
  }

  /* =========================
   * 数学：思考系を厚く（場合の数/確率/整数/図形比/規則性/条件整理）
   * ========================= */
  function genMathHard(bank, n, seedBase = 2000) {
    for (let i = 0; i < n; i++) {
      const rnd = mulberry32(seedBase + i);
      const kind = i % 10;

      if (kind === 0) {
        // 確率：単発当たり（正解が必ず選択肢に入る）
        const N = pick(rnd, [6, 8, 10, 12, 15]);
        const correct = frac(1, N);
        const wrong = [frac(1, N - 1), frac(2, N), frac(N - 1, N), frac(1, N + 1)];
        const { c, a } = force4Unique(rnd, correct, wrong, []);
        add(bank, {
          sub: "数学", level: "中", diff: "標準",
          pattern: "prob",
          patternGroup: "math_prob_single_hit",
          q: `${N}枚のカードのうち1枚だけ当たりがある。1回引いて当たりを引く確率は？`,
          c, a,
          exp: `当たりは1通り、全体は${N}通りなので 1/${N}。`,
        });
      } else if (kind === 1) {
        // 条件付き確率：余事象（少なくとも1回）
        const total = pick(rnd, [8, 10, 12]);
        const red = pick(rnd, [3, 4, 5]);
        const blue = total - red;
        const num0 = blue * (blue - 1);
        const den = total * (total - 1);
        const correct = `1 - ${frac(num0, den)}`;
        const wrong = [`${frac(num0, den)}`, `1 - ${frac(red * (red - 1), den)}`, `1 - ${frac(blue, total)}`, `${frac(red, total)}`];
        const { c, a } = force4Unique(rnd, correct, wrong, []);
        add(bank, {
          sub: "数学", level: "中", diff: "発展",
          pattern: "prob",
          patternGroup: "math_prob_complement",
          q: `赤玉${red}個、青玉${blue}個が入った袋から、戻さずに2回取り出す。「少なくとも1回赤玉」を取り出す確率として正しい式は？`,
          c, a,
          exp: `余事象を用いる。「赤が0回」＝2回とも青。よって 1 - (青/全体)×((青-1)/(全体-1))。`,
        });
      } else if (kind === 2) {
        // 場合の数：重複なしの3桁
        const digits = pick(rnd, [[1,2,3,4,5], [0,1,2,3,4,5], [2,3,4,6,7]]);
        const set = digits.slice();
        const hasZero = set.includes(0);
        // 先頭0不可、同じ数字は使わない
        let count;
        if (!hasZero) {
          count = set.length * (set.length - 1) * (set.length - 2);
        } else {
          // 先頭：0以外
          count = (set.length - 1) * (set.length - 1) * (set.length - 2);
        }
        const correct = `${count}`;
        const wrong = [`${count + set.length}`, `${Math.max(1, count - set.length)}`, `${set.length * set.length * set.length}`, `${(set.length - 1) * (set.length - 2) * (set.length - 3)}`];
        const { c, a } = force4Unique(rnd, correct, wrong, []);
        add(bank, {
          sub: "数学", level: "中", diff: "発展",
          pattern: "count",
          patternGroup: "math_count_3digit_no_repeat",
          q: `次の数字だけを使って、同じ数字を2回使わない3桁の整数を作る。作れる数は何通りか？（使える数字：${set.join(", ")}）`,
          c, a,
          exp: `先頭に0が来ない条件と、重複なしの積の法則で数える。`,
        });
      } else if (kind === 3) {
        // 規則性：n番目（受験典型）
        const a1 = pick(rnd, [2, 3, 5]);
        const d = pick(rnd, [3, 4, 6]);
        const n0 = pick(rnd, [8, 10, 12, 15]);
        const an = a1 + (n0 - 1) * d;
        const correct = `${an}`;
        const wrong = [`${a1 + n0 * d}`, `${a1 + (n0 - 2) * d}`, `${an + d}`, `${an - d}`];
        const { c, a } = force4Unique(rnd, correct, wrong, []);
        add(bank, {
          sub: "数学", level: "中", diff: "標準",
          pattern: "sequence",
          patternGroup: "math_sequence_arithmetic",
          q: `数列 ${a1}, ${a1 + d}, ${a1 + 2*d}, ... の第${n0}項は？`,
          c, a,
          exp: `等差数列。第n項＝初項＋(n-1)×公差。`,
        });
      } else if (kind === 4) {
        // 整数：余り（合同の発想）
        const m = pick(rnd, [5, 7, 9, 11]);
        const a0 = pick(rnd, [2, 3, 4]);
        const b0 = pick(rnd, [3, 4, 5]);
        // (a0*100 + b0*10 + a0) の mでの余り
        const N = a0 * 100 + b0 * 10 + a0;
        const rem = ((N % m) + m) % m;
        const correct = `${rem}`;
        const wrong = [`${(rem + 1) % m}`, `${(rem + m - 1) % m}`, `${(rem + 2) % m}`, `${(rem + 3) % m}`];
        const { c, a } = force4Unique(rnd, correct, wrong, []);
        add(bank, {
          sub: "数学", level: "中", diff: "発展",
          pattern: "number",
          patternGroup: "math_mod_remainder",
          q: `${a0}${b0}${a0} を ${m} で割った余りは？`,
          c, a,
          exp: `余りの性質（合同）で計算する。実際に割ってもよいが、位の寄与に注目すると速い。`,
        });
      } else if (kind === 5) {
        // 方程式：整数解（思考）
        const a = pick(rnd, [3, 4, 5]);
        const b = pick(rnd, [6, 7, 8, 9]);
        const x = pick(rnd, [1, 2, 3]);
        const y = pick(rnd, [1, 2, 4]);
        const cst = a * x + b * y;
        const correct = `(${x},${y})`;
        const wrong = [`(${y},${x})`, `(${x + 1},${y})`, `(${x},${y + 1})`, `(${x - 1},${y})`];
        const { c, a: aidx } = force4Unique(rnd, correct, wrong, []);
        add(bank, {
          sub: "数学", level: "中", diff: "発展",
          pattern: "algebra",
          patternGroup: "math_diophantine_small",
          q: `整数 x, y が ${a}x + ${b}y = ${cst} を満たす。次のうち成り立つ組はどれ？`,
          c, a: aidx,
          exp: `左辺に代入して一致するものを選ぶ。条件が整数なので候補を丁寧に検証する。`,
        });
      } else if (kind === 6) {
        // 速さ：追いつき（条件整理）
        const vA = pick(rnd, [60, 72, 80]);
        const vB = pick(rnd, [48, 54, 64]);
        const head = pick(rnd, [6, 8, 10, 12]); // km
        const diff = vA - vB;
        const t = head / diff; // hours
        const correct = `${t}時間`;
        const wrong = [`${head / vA}時間`, `${head / vB}時間`, `${(head / diff) * 60}分`, `${t + 1}時間`];
        const { c, a } = force4Unique(rnd, correct, wrong, []);
        add(bank, {
          sub: "数学", level: "中", diff: "発展",
          pattern: "word",
          patternGroup: "math_speed_catchup",
          q: `Aは時速${vA}km、Bは時速${vB}kmで同じ方向に進む。Bが${head}km先にいるとき、AがBに追いつくまでの時間は？`,
          c, a,
          exp: `相対速度（差）で距離を詰める。時間＝先行距離÷(速さの差)。`,
        });
      } else if (kind === 7) {
        // 図形：相似の比（受験典型）
        const k = pick(rnd, [2, 3, 4, 5]);
        const s = pick(rnd, [2, 3]); // 相似比の倍率
        const area1 = k * k;
        const area2 = area1 * s * s;
        const correct = `${area2}:${area1}`;
        const wrong = [`${s}:${1}`, `${s * s}:${1}`, `${area1}:${area2}`, `${area2}:${s}`];
        const { c, a } = force4Unique(rnd, `${s * s}:1`, wrong, [correct]);
        add(bank, {
          sub: "数学", level: "中", diff: "発展",
          pattern: "geometry",
          patternGroup: "math_similarity_area_ratio",
          q: `2つの相似な図形があり、対応する辺の比が ${s}:1 である。面積の比は？`,
          c, a,
          exp: `相似比が s:1 なら面積比は s^2:1。`,
        });
      } else if (kind === 8) {
        // 条件付き：平均と合計（思考）
        const n0 = pick(rnd, [5, 6, 8, 10]);
        const avg = pick(rnd, [62, 65, 68, 70, 72]);
        const sum = n0 * avg;
        const addScore = pick(rnd, [55, 60, 75, 80]);
        const newAvg = Math.round(((sum + addScore) / (n0 + 1)) * 10) / 10;
        const correct = `${newAvg}`;
        const wrong = [`${avg}`, `${Math.round(((sum - addScore) / (n0 - 1)) * 10) / 10}`, `${Math.round((avg + addScore) / 2 * 10) / 10}`, `${newAvg + 1}`];
        const { c, a } = force4Unique(rnd, correct, wrong, []);
        add(bank, {
          sub: "数学", level: "中", diff: "標準",
          pattern: "stats",
          patternGroup: "math_average_update",
          q: `${n0}人の平均点が${avg}点だった。そこに${addScore}点の人が1人加わると、新しい平均点は？`,
          c, a,
          exp: `平均×人数＝合計点。合計に追加して人数で割る。`,
        });
      } else {
        // 文章題：濃度（条件整理）
        const total = pick(rnd, [200, 250, 300, 400]);
        const pct = pick(rnd, [8, 10, 12, 15, 20]);
        const solute = Math.round(total * pct / 100);
        const addWater = pick(rnd, [50, 100, 150]);
        const newPct = Math.round((solute / (total + addWater)) * 1000) / 10;
        const correct = `${newPct}%`;
        const wrong = [`${pct}%`, `${Math.max(0, newPct - 2)}%`, `${newPct + 2}%`, `${Math.round((addWater / (total + addWater)) * 1000) / 10}%`];
        const { c, a } = force4Unique(rnd, correct, wrong, []);
        add(bank, {
          sub: "数学", level: "中", diff: "発展",
          pattern: "word",
          patternGroup: "math_concentration_dilution",
          q: `${pct}%の食塩水が${total}gある。水を${addWater}g加えたときの濃度は？`,
          c, a,
          exp: `食塩の量は変わらない。食塩量＝${total}×${pct}/100=${solute}g。濃度＝${solute}/(${total}+${addWater})×100。`,
        });
      }
    }
  }

  /* =========================
   * 英語：文法の自然さ重視＋読解は内容把握（メタ選択肢なし）
   * ========================= */
  function genEnglish(bank, n, seedBase = 3000) {
    const verbs = [
      { base: "run", ing: "running", past: "ran", third: "runs" },
      { base: "study", ing: "studying", past: "studied", third: "studies" },
      { base: "play", ing: "playing", past: "played", third: "plays" },
      { base: "write", ing: "writing", past: "wrote", third: "writes" },
      { base: "make", ing: "making", past: "made", third: "makes" },
    ];
    const adjectives = [
      { base: "tall", comp: "taller", sup: "tallest" },
      { base: "fast", comp: "faster", sup: "fastest" },
      { base: "easy", comp: "easier", sup: "easiest" },
      { base: "careful", comp: "more careful", sup: "most careful" },
      { base: "useful", comp: "more useful", sup: "most useful" },
    ];

    const readingPassages = [
      {
        text:
          "Aya used to dislike math, but she started solving one problem every day. " +
          "After a month, she noticed she could understand formulas more quickly. " +
          "Now she studies with her friend and explains her ideas aloud.",
        q1: { ask: "Why did Aya improve in math?", correct: "She practiced regularly and reflected on her learning.", wrongs: [
          "She stopped studying and took more breaks.",
          "She only memorized answers without understanding.",
          "She avoided difficult problems completely.",
        ]},
        q2: { ask: "What does Aya do now when she studies?", correct: "She studies with a friend and explains her ideas aloud.", wrongs: [
          "She studies alone and never speaks.",
          "She only watches videos without solving problems.",
          "She reads novels instead of studying.",
        ]},
      },
      {
        text:
          "Tom missed the train because he left home late. " +
          "He decided to prepare his bag the night before. " +
          "Since then, he has arrived at the station on time.",
        q1: { ask: "What caused Tom to miss the train?", correct: "He left home late.", wrongs: [
          "He arrived too early.",
          "He forgot where the station was.",
          "He refused to take the train.",
        ]},
        q2: { ask: "What change helped Tom arrive on time?", correct: "He prepared his bag the night before.", wrongs: [
          "He stopped using a bag.",
          "He decided to walk to another city.",
          "He never checked the time again.",
        ]},
      },
    ];

    for (let i = 0; i < n; i++) {
      const rnd = mulberry32(seedBase + i);
      const kind = i % 6;

      if (kind === 0) {
        // 現在進行形（now）
        const v = pick(rnd, verbs);
        const correct = `is ${v.ing}`;
        const wrongs = [v.base, v.third, v.past, `are ${v.ing}`];
        const { c, a } = force4Unique(rnd, correct, wrongs, [`was ${v.ing}`]);
        add(bank, {
          sub: "英語", level: "中", diff: "標準",
          pattern: "grammar",
          patternGroup: "eng_present_progressive",
          q: `(   )に入る最も適切な語句は？ She (   ) ${v.base} now.`,
          c, a,
          exp: `now があるので現在進行形。主語が She なので is + -ing。`,
        });
      } else if (kind === 1) {
        // 過去形（yesterday）※動詞は固定でwrite系にして不自然を避ける
        const correct = "wrote";
        const wrongs = ["write", "writes", "is writing", "will write"];
        const { c, a } = force4Unique(rnd, correct, wrongs, ["was writing"]);
        add(bank, {
          sub: "英語", level: "中", diff: "標準",
          pattern: "grammar",
          patternGroup: "eng_past_simple",
          q: `(   )に入る最も適切な語句は？ He (   ) a letter yesterday.`,
          c, a,
          exp: `yesterday があるので過去形。write の過去形は wrote。`,
        });
      } else if (kind === 2) {
        // 三単現
        const v = pick(rnd, verbs);
        const correct = v.third;
        const wrongs = [v.base, v.past, `is ${v.ing}`, `will ${v.base}`];
        const { c, a } = force4Unique(rnd, correct, wrongs, []);
        add(bank, {
          sub: "英語", level: "中", diff: "標準",
          pattern: "grammar",
          patternGroup: "eng_third_person",
          q: `(   )に入る最も適切な語は？ My brother (   ) soccer every day.`,
          c, a,
          exp: `主語が三人称単数なので動詞に-s が付く。`,
        });
      } else if (kind === 3) {
        // 比較級（文意が通る形：backpackなどでも成立する形容詞に限定）
        const ad = pick(rnd, adjectives);
        const correct = ad.comp;
        const wrongs = [ad.base, ad.sup, `most ${ad.base}`, `more ${ad.base}`].filter((x) => x !== correct);
        const { c, a } = force4Unique(rnd, correct, wrongs, []);
        add(bank, {
          sub: "英語", level: "中", diff: "発展",
          pattern: "grammar",
          patternGroup: "eng_comparative",
          q: `(   )に入る最も適切な語句は？ This backpack is (   ) than that one.`,
          c, a,
          exp: `than があるので比較級。${ad.base} の比較級は ${correct}。`,
        });
      } else if (kind === 4) {
        // 前置詞（時間・場所）
        const items = [
          { sent: "We meet (   ) 7 o'clock.", correct: "at", wrongs: ["in", "on", "to"], exp: "時刻は at" },
          { sent: "I was born (   ) April.", correct: "in", wrongs: ["at", "on", "to"], exp: "月は in" },
          { sent: "She studies (   ) the library.", correct: "in", wrongs: ["at", "on", "to"], exp: "内部の場所は in" },
          { sent: "I go to school (   ) bus.", correct: "by", wrongs: ["in", "on", "at"], exp: "交通手段は by" },
        ];
        const it = pick(rnd, items);
        const { c, a } = force4Unique(rnd, it.correct, it.wrongs, ["from", "for", "with"]);
        add(bank, {
          sub: "英語", level: "中", diff: "標準",
          pattern: "grammar",
          patternGroup: "eng_preposition",
          q: `(   )に入る最も適切な語は？ ${it.sent}`,
          c, a,
          exp: it.exp,
        });
      } else {
        // 読解（内容把握）
        const p = pick(rnd, readingPassages);
        const qx = (i % 2 === 0) ? p.q1 : p.q2;
        const { c, a } = force4Unique(rnd, qx.correct, qx.wrongs, []);
        add(bank, {
          sub: "英語", level: "中", diff: "発展",
          pattern: "reading",
          patternGroup: "eng_reading_content",
          q: `次の英文を読んで質問に答えなさい。\n\n"${p.text}"\n\nQ: ${qx.ask}`,
          c, a,
          exp: `本文の根拠に基づいて選ぶ（言い換えに注意）。`,
        });
      }
    }
  }

  /* =========================
   * 理科：さらに難化（多段推論・資料読解・実験計画）
   * - 公式ヒントは問題文に書かない
   * ========================= */
  function genScienceHard(bank, n, seedBase = 4000) {
    for (let i = 0; i < n; i++) {
      const rnd = mulberry32(seedBase + i);
      const kind = i % 10;

      if (kind === 0) {
        // 圧力：単位変換（Pa）
        const F = pick(rnd, [120, 150, 180, 200, 240, 300, 360, 450]);
        const area_cm2 = pick(rnd, [4, 5, 6, 8, 10, 12, 15, 18, 20]);
        const area_m2 = area_cm2 * 1e-4;
        const p = Math.round(F / area_m2);

        const { c, a } = force4Unique(
          rnd, `${p}Pa`,
          [`${p * 10}Pa`, `${Math.max(1, Math.round(p / 10))}Pa`, `${p + 5000}Pa`, `${Math.max(1, p - 5000)}Pa`],
          []
        );
        add(bank, {
          sub: "理科", level: "中", diff: "発展",
          pattern: "physics",
          patternGroup: "sci_pressure_unitconv",
          q: `力が${F}Nで、面積が${area_cm2}cm²のときの圧力をPaで求めよ。`,
          c, a,
          exp: `面積をm²に直す（${area_cm2}cm²=${area_m2}m²）。圧力＝力/面積なので ${F}/${area_m2}=${p}Pa。`,
        });
      } else if (kind === 1) {
        // 密度：浮沈（思考）
        const densityObj = pick(rnd, [0.8, 0.9, 1.1, 1.2, 2.7, 7.9]);
        const densityLiq = pick(rnd, [1.0, 1.2, 1.4]);
        const correct = (densityObj < densityLiq) ? "浮く" : (densityObj > densityLiq ? "沈む" : "静止する");
        const wrongs = ["沈む", "浮く", "静止する"].filter((x) => x !== correct);
        const { c, a } = force4Unique(rnd, correct, wrongs, []);
        add(bank, {
          sub: "理科", level: "中", diff: "発展",
          pattern: "physics",
          patternGroup: "sci_density_float",
          q: `密度が${densityObj}g/cm³の物体を、密度が${densityLiq}g/cm³の液体に入れた。物体のようすとして最も適切なものは？`,
          c, a,
          exp: `物体の密度が液体より小さいと浮き、大きいと沈む。等しい場合は静止する。`,
        });
      } else if (kind === 2) {
        // 電気：直列・並列の合成抵抗（計算）
        const R1 = pick(rnd, [2, 3, 4, 5, 6]);
        const R2 = pick(rnd, [2, 3, 4, 6, 8]);
        const mode = pick(rnd, ["series", "parallel"]);
        const eq = (mode === "series") ? (R1 + R2) : (Math.round((R1 * R2) / (R1 + R2) * 10) / 10);

        const correct = `${eq}Ω`;
        const wrongs = [
          `${Math.round((R1 * R2) * 10) / 10}Ω`,
          `${Math.round((R1 / R2) * 10) / 10}Ω`,
          `${Math.round((R2 / R1) * 10) / 10}Ω`,
          `${Math.round((R1 + R2 + 1) * 10) / 10}Ω`,
        ];
        const { c, a } = force4Unique(rnd, correct, wrongs, []);
        add(bank, {
          sub: "理科", level: "中", diff: "発展",
          pattern: "physics",
          patternGroup: mode === "series" ? "sci_circuit_series_eqR" : "sci_circuit_parallel_eqR",
          q: `抵抗${R1}Ωと抵抗${R2}Ωを${mode === "series" ? "直列" : "並列"}につないだときの合成抵抗は？`,
          c, a,
          exp: mode === "series"
            ? `直列の合成抵抗は和。${R1}+${R2}=${eq}Ω。`
            : `並列の合成抵抗は 1/R = 1/R1 + 1/R2。計算して ${eq}Ω。`,
        });
      } else if (kind === 3) {
        // オーム：電圧/電流/抵抗（式ヒントはexpへ）
        const R = pick(rnd, [3, 4, 5, 6, 8, 10, 12]);
        const I = pick(rnd, [0.2, 0.3, 0.5, 0.8, 1.0, 1.2]);
        const V = Math.round(R * I * 10) / 10;

        const { c, a } = force4Unique(
          rnd, `${V}V`,
          [`${R}V`, `${I}V`, `${Math.round((V + 1) * 10) / 10}V`, `${Math.max(0, Math.round((V - 1) * 10) / 10)}V`],
          []
        );
        add(bank, {
          sub: "理科", level: "中", diff: "発展",
          pattern: "physics",
          patternGroup: "sci_ohm_basic",
          q: `抵抗が${R}Ω、電流が${I}Aのとき、電圧は？`,
          c, a,
          exp: `電圧・電流・抵抗の関係より V＝IR。${R}×${I}=${V}V。`,
        });
      } else if (kind === 4) {
        // 化学：質量保存＋反応の読み（概念）
        const correct = "反応前後で全体の質量は変わらない";
        const wrongs = [
          "反応後は必ず質量が増える",
          "反応後は必ず質量が減る",
          "反応は質量と無関係に起きる",
        ];
        const { c, a } = force4Unique(rnd, correct, wrongs, []);
        add(bank, {
          sub: "理科", level: "中", diff: "標準",
          pattern: "chemistry",
          patternGroup: "sci_mass_conservation",
          q: `密閉した容器内で化学変化が起きた。最も適切な説明はどれか？`,
          c, a,
          exp: `密閉系では質量保存が成り立つ（外へ出入りがない）。`,
        });
      } else if (kind === 5) {
        // 溶解度：表読解＋推論（文中に表を埋め込む）
        const t1 = pick(rnd, [10, 15, 20]);
        const t2 = t1 + pick(rnd, [10, 15, 20]);
        const v1 = pick(rnd, [18, 22, 26, 30]);
        const v2 = v1 + pick(rnd, [8, 12, 16]);
        const correct = "温度が上がると溶ける量が増える";
        const wrongs = [
          "温度が上がると溶ける量が減る",
          "温度と溶ける量は無関係",
          "温度が上がると必ず沈殿が増える",
        ];
        const { c, a } = force4Unique(rnd, correct, wrongs, []);
        add(bank, {
          sub: "理科", level: "中", diff: "発展",
          pattern: "experiment",
          patternGroup: "sci_solubility_table_inference",
          q:
`次の表は「水100gに溶ける物質Xの量（g）」である。表から言えることとして最も適切なものは？

【表】
温度 ${t1}℃：${v1}g
温度 ${t2}℃：${v2}g`,
          c, a,
          exp: `表の増減から、温度上昇で溶解度が増えると判断できる。`,
        });
      } else if (kind === 6) {
        // 実験計画：変える条件・そろえる条件（思考）
        const correct = "他の条件をそろえて、1つの条件だけを変えて比較する";
        const wrongs = [
          "条件を同時にいくつも変えて結果を比べる",
          "結果が出やすいように毎回違う道具を使う",
          "測定は1回だけ行い平均は取らない",
        ];
        const { c, a } = force4Unique(rnd, correct, wrongs, []);
        add(bank, {
          sub: "理科", level: "中", diff: "発展",
          pattern: "experiment",
          patternGroup: "sci_experiment_control_variable",
          q: `実験で「原因と結果」を確かめるときの条件設定として最も適切なものは？`,
          c, a,
          exp: `フェアな比較（対照実験）では、変数を1つに絞り、それ以外を統一する。`,
        });
      } else if (kind === 7) {
        // 生物：光合成・呼吸（概念）
        const correct = "光合成では二酸化炭素を取り入れ、酸素を放出する";
        const wrongs = [
          "光合成では酸素を取り入れ、二酸化炭素を放出する",
          "呼吸では酸素を放出し、二酸化炭素を取り入れる",
          "呼吸も光合成も酸素だけを取り入れる",
        ];
        const { c, a } = force4Unique(rnd, correct, wrongs, []);
        add(bank, {
          sub: "理科", level: "中", diff: "標準",
          pattern: "biology",
          patternGroup: "sci_bio_photosynthesis",
          q: `植物の光合成について最も適切な説明はどれか？`,
          c, a,
          exp: `光合成は二酸化炭素と水から養分をつくり、酸素を放出する（条件：光）。`,
        });
      } else if (kind === 8) {
        // 地学：前線と天気（思考）
        const correct = "寒冷前線の通過では、短時間に強い雨が降りやすい";
        const wrongs = [
          "寒冷前線の通過では、雲が層状に広がりやすい",
          "温暖前線の通過では、急に雷雨が起こりやすい",
          "前線は天気の変化に影響しない",
        ];
        const { c, a } = force4Unique(rnd, correct, wrongs, []);
        add(bank, {
          sub: "理科", level: "中", diff: "発展",
          pattern: "earth",
          patternGroup: "sci_earth_front_weather",
          q: `前線と天気の変化について最も適切なものは？`,
          c, a,
          exp: `寒冷前線は積乱雲が発達しやすく、短時間強雨になりやすい。温暖前線は層状雲・長雨になりやすい。`,
        });
      } else {
        // エネルギー：仕事量・効率（思考）
        const inE = pick(rnd, [200, 250, 300, 360, 400]);
        const eff = pick(rnd, [0.6, 0.7, 0.75, 0.8]);
        const outE = Math.round(inE * eff);
        const correct = `${outE}J`;
        const wrongs = [`${inE}J`, `${Math.round(inE * (1 - eff))}J`, `${outE + 50}J`, `${Math.max(1, outE - 50)}J`];
        const { c, a } = force4Unique(rnd, correct, wrongs, []);
        add(bank, {
          sub: "理科", level: "中", diff: "発展",
          pattern: "physics",
          patternGroup: "sci_energy_efficiency",
          q: `ある装置に${inE}Jのエネルギーを与えたところ、効率が${Math.round(eff * 100)}%だった。外に取り出せた有効なエネルギーは？`,
          c, a,
          exp: `効率＝有効/入力。よって有効＝入力×効率＝${inE}×${eff}=${outE}J。`,
        });
      }
    }
  }

  /* =========================
   * 社会：さらに難化（時差は東経西経必須・資料読解・公民の事例適用・経済の因果）
   * ========================= */
  function genSocialHard(bank, n, seedBase = 5000) {
    const histOrder = [
      {
        items: ["鎌倉幕府の成立", "室町幕府の成立", "江戸幕府の成立", "明治維新"],
        correct: "鎌倉→室町→江戸→明治",
        wrongs: ["室町→鎌倉→江戸→明治", "江戸→室町→鎌倉→明治", "鎌倉→江戸→室町→明治"],
        exp: "幕府成立の順と明治維新（1868）を押さえる。",
      },
      {
        items: ["日清戦争", "日露戦争", "第一次世界大戦", "第二次世界大戦"],
        correct: "日清→日露→第一次→第二次",
        wrongs: ["日露→日清→第一次→第二次", "第一次→日清→日露→第二次", "日清→第一次→日露→第二次"],
        exp: "近代戦争の並びを整理する。",
      },
    ];

    const civicsCases = [
      { q: "行政が国会の定めた法律に基づき政策を実行する。これはどの働きか？", correct: "行政", wrongs: ["立法", "司法", "自治"], exp: "法律を執行するのが行政。"},
      { q: "憲法に反するかどうかを最終的に判断するのはどこか？", correct: "裁判所", wrongs: ["内閣", "国会", "都道府県"], exp: "違憲審査制は司法の役割。"},
      { q: "地方公共団体が条例を定める根拠となる考え方は？", correct: "地方自治", wrongs: ["議院内閣制", "三権分立", "国民主権"], exp: "地域のことを地域で決める。"},
      { q: "報道機関が政府の不正を追及する役割は、民主政治において何と呼ばれることが多いか？", correct: "第四の権力", wrongs: ["租税法律主義", "国政調査権", "地方分権"], exp: "メディアが権力監視を担う比喩。"},
    ];

    for (let i = 0; i < n; i++) {
      const rnd = mulberry32(seedBase + i);
      const kind = i % 10;

      if (kind === 0) {
        // 時差：旅行型（東経西経明示・日付またぎ要素）
        const jp = { dir: "E", deg: 135 };
        const dest = pick(rnd, [
          { dir: "E", deg: 90 },
          { dir: "E", deg: 150 },
          { dir: "W", deg: 60 },
          { dir: "W", deg: 90 },
          { dir: "E", deg: 0 },
        ]);

        const depH = pick(rnd, [18, 19, 20, 21, 22, 23]);
        const depM = pick(rnd, [0, 10, 20, 30, 40, 50]);
        const flightH = pick(rnd, [6, 7, 8, 9, 10, 11]);

        const depMin = toMin(depH, depM);
        const arrLocal = toMin(depH + flightH, depM);

        const diffDeg = lonToDeg(dest) - lonToDeg(jp);
        const diffMin = Math.round((diffDeg / 15) * 60); // 15°で1h はexp側で言語化
        const japanTimeAtArr = fromMin(arrLocal - diffMin);

        const wrongs = [
          fromMin(toMin(depH + flightH + 2, depM)),
          fromMin(toMin(depH + flightH - 2, depM)),
          fromMin(toMin(depH + flightH + 4, depM)),
          fromMin(toMin(depH + flightH - 4, depM)),
        ];
        const { c, a } = force4Unique(rnd, japanTimeAtArr, wrongs, []);
        add(bank, {
          sub: "社会", level: "中", diff: "発展",
          pattern: "geo",
          patternGroup: "soc_geo_timezone_travel_overnight",
          q: `日本（${formatLon(jp)}）を${fromMin(depMin)}に出発し、${formatLon(dest)}の都市に現地時刻で${fromMin(arrLocal)}に到着した（飛行時間${flightH}時間）。到着時の日本の時刻は？`,
          c, a,
          exp: `経度差から時差を求め、現地時刻を日本時刻へ換算する。経度の差は15°ごとに1時間。計算すると ${japanTimeAtArr}。`,
        });
      } else if (kind === 1) {
        // 統計：高齢化率（表読解）
        const u15 = pick(rnd, [120, 150, 180, 210, 240]);
        const w15_64 = pick(rnd, [520, 600, 680, 720, 800]);
        const o65 = pick(rnd, [200, 240, 280, 320, 360]);
        const total = u15 + w15_64 + o65;
        const rate = Math.round((o65 / total) * 1000) / 10;

        const { c, a } = force4Unique(
          rnd,
          `${rate}%`,
          [`${Math.max(0, rate - 5)}%`, `${rate + 5}%`, `${Math.round((u15 / total) * 1000) / 10}%`, `${Math.round((w15_64 / total) * 1000) / 10}%`],
          []
        );
        add(bank, {
          sub: "社会", level: "中", diff: "発展",
          pattern: "geo",
          patternGroup: "soc_geo_population_aging_rate",
          q:
`次の表はある地域の年齢区分別人口（千人）である。高齢化率（65歳以上人口/総人口）として最も近いものは？

【表】
0〜14歳：${u15}
15〜64歳：${w15_64}
65歳以上：${o65}`,
          c, a,
          exp: `総人口=${total}。高齢化率=${o65}/${total}×100=${rate}%。`,
        });
      } else if (kind === 2) {
        // 地理：産業構造（資料読解＋推論）
        const p1 = pick(rnd, [4, 6, 8, 10, 12]);
        const p2 = pick(rnd, [18, 22, 28, 32, 38]);
        const p3 = 100 - p1 - p2;
        const correct = p3 > p2 ? "第三次産業の割合が第二次産業より高い" : "第三次産業の割合が第二次産業より低い";
        const wrongs = [
          "第一次産業の割合が最も高い",
          "第二次産業の割合が最も高い",
          "どの産業も同じ割合である",
        ];
        const { c, a } = force4Unique(rnd, correct, wrongs, []);
        add(bank, {
          sub: "社会", level: "中", diff: "発展",
          pattern: "geo",
          patternGroup: "soc_geo_industry_inference",
          q:
`次の割合（%）はA地域の就業者の産業別構成である。表から言えることとして最も適切なものは？

第一次産業：${p1}%
第二次産業：${p2}%
第三次産業：${p3}%`,
          c, a,
          exp: `第三次と第二次を比較して判断する。`,
        });
      } else if (kind === 3) {
        // 歴史：並べ替え（知識＋整理）
        const it = pick(rnd, histOrder);
        const { c, a } = force4Unique(rnd, it.correct, it.wrongs, []);
        add(bank, {
          sub: "社会", level: "中", diff: "発展",
          pattern: "history",
          patternGroup: "soc_hist_order",
          q: `次の出来事を古い順に並べたものとして正しいものは？\n（${it.items.join("／")}）`,
          c, a,
          exp: it.exp,
        });
      } else if (kind === 4) {
        // 歴史：史料読解（短い文の解釈）
        const correct = "年貢などの負担が増え、生活が苦しくなる可能性がある";
        const wrongs = [
          "税がなくなり生活が必ず豊かになる",
          "武士がいなくなり戦争が必ず起きる",
          "外国との貿易が必ず停止する",
        ];
        const { c, a } = force4Unique(rnd, correct, wrongs, []);
        add(bank, {
          sub: "社会", level: "中", diff: "発展",
          pattern: "history",
          patternGroup: "soc_hist_source_inference",
          q:
`次のような記録がある。
「今年は収穫が少ないのに、納める量は変わらない。家の者が食べる米が足りぬ。」
この記録から考えられる状況として最も適切なものは？`,
          c, a,
          exp: `不作でも負担が固定されると生活が逼迫する。記録の因果を読み取る。`,
        });
      } else if (kind === 5) {
        // 公民：事例適用
        const it = pick(rnd, civicsCases);
        const { c, a } = force4Unique(rnd, it.correct, it.wrongs, []);
        add(bank, {
          sub: "社会", level: "中", diff: "発展",
          pattern: "civics",
          patternGroup: "soc_civics_case",
          q: it.q,
          c, a,
          exp: it.exp,
        });
      } else if (kind === 6) {
        // 経済：需要・供給の変化（グラフなしで因果）
        const correct = "需要が増えると、一般に価格と取引量は増える方向に働く";
        const wrongs = [
          "需要が増えると、一般に価格と取引量は減る方向に働く",
          "供給が増えると、一般に価格は上がる方向に働く",
          "需要と供給は価格に影響しない",
        ];
        const { c, a } = force4Unique(rnd, correct, wrongs, []);
        add(bank, {
          sub: "社会", level: "中", diff: "発展",
          pattern: "civics",
          patternGroup: "soc_econ_supply_demand_shift",
          q: `ある商品の人気が急上昇し、買いたい人が増えた。市場の変化として最も適切な説明はどれか？`,
          c, a,
          exp: `需要増＝需要曲線が右へ。均衡では価格・取引量が増える方向。`,
        });
      } else if (kind === 7) {
        // 地理：気候（降水差・季節性）
        const rainy = pick(rnd, [220, 180, 160, 140, 120]);
        const dry = pick(rnd, [20, 30, 40, 50, 60]);
        const correct = "雨の多い季節と少ない季節の差が大きい";
        const wrongs = [
          "一年を通して降水量はほぼ一定である",
          "乾季の方が雨季より降水量が多い",
          "降水量は地形の影響を受けない",
        ];
        const { c, a } = force4Unique(rnd, correct, wrongs, []);
        add(bank, {
          sub: "社会", level: "中", diff: "発展",
          pattern: "geo",
          patternGroup: "soc_geo_climate_seasonality",
          q: `ある地域の降水量（mm）が、雨の多い季節：${rainy}mm、雨の少ない季節：${dry}mmであった。このデータから言えることとして最も適切なものは？`,
          c, a,
          exp: `季節による降水差が大きい＝雨季・乾季のような季節性が強い可能性。`,
        });
      } else if (kind === 8) {
        // 国際：輸出入のバランス（表読解）
        const ex = pick(rnd, [80, 90, 100, 110, 120]);
        const im = pick(rnd, [70, 85, 95, 105, 130]);
        const correct = ex > im ? "貿易黒字" : (ex < im ? "貿易赤字" : "貿易収支は均衡");
        const wrongs = ["貿易黒字", "貿易赤字", "貿易収支は均衡"].filter(x => x !== correct);
        const { c, a } = force4Unique(rnd, correct, wrongs, []);
        add(bank, {
          sub: "社会", level: "中", diff: "発展",
          pattern: "geo",
          patternGroup: "soc_geo_trade_balance",
          q:
`次のデータ（単位：兆円）がある。
輸出：${ex}
輸入：${im}
このときの貿易収支の状態として最も適切なものは？`,
          c, a,
          exp: `輸出>輸入なら黒字、輸出<輸入なら赤字、等しければ均衡。`,
        });
      } else {
        // 公民：税の役割（ただの暗記で終わらせず説明型）
        const correct = "公共サービスの費用を社会全体で負担する仕組みの一つになる";
        const wrongs = [
          "税は必ず個人に全額払い戻される仕組みである",
          "税は裁判所が自由に決めることができる",
          "税は払うほど所得が増える制度である",
        ];
        const { c, a } = force4Unique(rnd, correct, wrongs, []);
        add(bank, {
          sub: "社会", level: "中", diff: "標準",
          pattern: "civics",
          patternGroup: "soc_civics_tax_role_explain",
          q: `税について最も適切な説明はどれか？`,
          c, a,
          exp: `税は教育・医療・インフラなどの公共サービスの財源。公平性や負担の配分が論点になる。`,
        });
      }
    }
  }

  /* =========================
   * 固定（最低限の代表）
   * ========================= */
  const FIXED = [
    { sub: "国語", level: "中", diff: "標準", pattern: "vocab", patternGroup: "ja_fixed", q: "「一目瞭然」の意味として最も近いものは？", c: ["見ただけではっきり分かる", "一度見ても覚えられない", "目で見るのが難しい", "見ない方がよい"], a: 0, exp: "一目で明らか、という意味。" },
    { sub: "数学", level: "中", diff: "標準", pattern: "function", patternGroup: "math_fixed", q: "一次関数 y = 2x + 1 の y切片は？", c: ["1", "2", "-1", "0"], a: 0, exp: "x=0のとき y=1。" },
    { sub: "英語", level: "中", diff: "標準", pattern: "grammar", patternGroup: "eng_fixed", q: "(   )に入る最も適切な語は？ I (   ) to school every day.", c: ["go", "goes", "went", "going"], a: 0, exp: "I は三単現ではないので go。" },
    { sub: "理科", level: "中", diff: "標準", pattern: "physics", patternGroup: "sci_fixed", q: "質量が一定のまま体積が小さくなると、密度はどうなるか？", c: ["大きくなる", "小さくなる", "変わらない", "0になる"], a: 0, exp: "密度＝質量/体積。体積が減ると密度は増える。" },
    { sub: "社会", level: "中", diff: "標準", pattern: "civics", patternGroup: "soc_fixed", q: "国会が法律を定める働きを何という？", c: ["立法", "行政", "司法", "自治"], a: 0, exp: "法律をつくる＝立法。" },
  ];

  /* =========================
   * BANK 組み立て
   * ========================= */
  function buildBank() {
    let bank = [];

    // 固定
    FIXED.forEach((q) => add(bank, q));

    // 生成（難化版）
    genJapanese(bank, TARGET.国語, 1100);
    genMathHard(bank, TARGET.数学, 2100);
    genEnglish(bank, TARGET.英語, 3100);
    genScienceHard(bank, TARGET.理科, 4100);
    genSocialHard(bank, TARGET.社会, 5100);

    // 検品
    bank = bank.filter(validateQuestion);

    // 教科別不足があれば追い足し（安全策）
    function countSub(sub) {
      return bank.filter((q) => q.sub === sub).length;
    }
    function topUp(sub) {
      const need = Math.max(0, MIN_PER_SUBJECT - countSub(sub));
      if (need <= 0) return;

      const tmp = [];
      if (sub === "国語") genJapanese(tmp, need + 60, 12000);
      if (sub === "数学") genMathHard(tmp, need + 80, 22000);
      if (sub === "英語") genEnglish(tmp, need + 60, 32000);
      if (sub === "理科") genScienceHard(tmp, need + 100, 42000);
      if (sub === "社会") genSocialHard(tmp, need + 100, 52000);

      tmp.filter(validateQuestion).forEach((q) => add(bank, q));
    }
    SUBJECTS.forEach(topUp);

    // uid再付与（念のため）
    bank.forEach((q) => {
      if (!q.uid) q.uid = makeUid(q);
    });

    // 統計（確認用）
    const stats = {};
    SUBJECTS.forEach((s) => {
      stats[s] = bank.filter((q) => q.sub === s).length;
    });
    const groups = {};
    bank.forEach((q) => {
      groups[q.patternGroup] = (groups[q.patternGroup] || 0) + 1;
    });

    console.log("[BANK stats]", stats, "total:", bank.length);
    console.log("[BANK patternGroup count TOP25]", Object.entries(groups).sort((a, b) => b[1] - a[1]).slice(0, 25));

    return bank;
  }

  window.BANK = buildBank();
})();
