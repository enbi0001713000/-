/* bank.js（全文置き換え版：ヒント括弧排除／設問成立監査／uid短IDで衝突回避）
  - 5教科：国語/数学/英語/理科/社会
  - 必須schema：sub/level/diff/patternGroup/pattern/q/c/a/exp
  - 4択品質：空・重複・メタ選択肢排除、aは0-3、c[a]が正答
  - 「ヒント括弧」(経度15°=1h 等 / 力÷面積 等) は q から削除し exp に寄せる
  - “答えが問題文に書かれている”系（例：余りが4→余りは？）は生成しない
  - uid を短い連番IDにして、uid衝突や同型判定の誤爆を抑制（出題の偏り対策）
*/

(function () {
  "use strict";

  const SUBJECTS = ["国語", "数学", "英語", "理科", "社会"];
  const GRADES = ["小", "中"];
  const DIFFS = ["基礎", "標準", "発展"];

  // 生成量（多様性を優先：patternGroup を分散）
  const TARGET = {
    国語: 320,
    数学: 520,
    英語: 360,
    理科: 520,
    社会: 520,
  };

  // 不足事故の保険
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
   * 4択品質
   * ========================= */
  function isBadChoiceText(s) {
    const t = String(s ?? "").trim();
    if (!t) return true;

    // メタ選択肢は不採用
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

  function force4Unique(rnd, correct, wrongPool, extraPool = []) {
    const c0 = String(correct ?? "").trim();

    let pool = uniqKeep(wrongPool)
      .filter((x) => x && x !== c0 && !isBadChoiceText(x));
    let extra = uniqKeep(extraPool)
      .filter((x) => x && x !== c0 && !isBadChoiceText(x));

    pool = shuffleWith(rnd, pool);
    extra = shuffleWith(rnd, extra);

    const picked = [];
    for (const w of pool.concat(extra)) {
      if (picked.length >= 3) break;
      if (w === c0) continue;
      if (picked.includes(w)) continue;
      picked.push(w);
    }

    // 保険（極力使われない）
    const safe = ["0", "1", "2", "3", "4", "5", "10", "20", "30", "100"];
    for (const w of safe) {
      if (picked.length >= 3) break;
      if (w === c0) continue;
      if (!picked.includes(w)) picked.push(w);
    }

    const final = uniqKeep([c0, ...picked]).slice(0, 4);
    while (final.length < 4) final.push(`(${final.length})`);

    const shuffled = shuffleWith(rnd, final);
    const a = shuffled.indexOf(c0);
    return { c: shuffled, a };
  }

  /* =========================
   * スキーマ検査
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
    if (typeof q.exp !== "string" || !q.exp.trim()) return false;

    const choices = q.c.map((x) => String(x ?? "").trim());
    if (choices.some(isBadChoiceText)) return false;

    const set = new Set(choices);
    if (set.size !== 4) return false;

    if (!choices[q.a]) return false;

    // “答えが問題文に書かれている”系を排除（典型：余りが4→余りは？）
    const text = q.q.replace(/\s+/g, "");
    if (text.includes("余りが") && text.includes("余りは")) {
      // ただし「N+○を割った余り」のように問いが変わっていればOK
      const hasTransform = /N[＋+]\d+/.test(q.q) || /2N|3N|Nの2倍|Nの3倍/.test(q.q);
      if (!hasTransform) return false;
    }

    // 括弧内ヒント（例：経度15°で1時間、力÷面積）はここで弾く
    const hintBans = ["経度15", "1時間", "力÷面積", "V=IR", "v=ir", "力/面積"];
    for (const h of hintBans) {
      if (q.q.includes("(" + h) || q.q.includes("（" + h)) return false;
    }

    return true;
  }

  /* =========================
   * uid/追加
   * ========================= */
  function add(bank, q) {
    q._id = q._id || ("Q" + String(bank.length + 1).padStart(6, "0")); // 短い一意ID
    q.uid = q.uid || q._id; // app側がuidで重複排除しても衝突しない
    q.key = q.key || q._id;
    bank.push(q);
  }

  /* =========================
   * 数学：補助（分数）
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
   * 社会：時刻/経度
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
   * 国語：四字熟語/ことわざ/語彙/SPI言語風/漢字
   * ========================= */
  function genJapanese(bank, n, seedBase) {
    const idioms = [
      { y: "一石二鳥", m: "一つの行為で二つの利益を得る", w: ["努力しても報われない", "危険を冒して挑む", "勢いに任せて行う"] },
      { y: "温故知新", m: "昔のことを学び新しい知見を得る", w: ["新しいことだけを追う", "過去を忘れる", "感情で判断する"] },
      { y: "臨機応変", m: "状況に応じて適切に対応する", w: ["一切方針を変えない", "無計画に動く", "思いつきだけで行動する"] },
      { y: "破釜沈舟", m: "覚悟を決めて全力でやり抜く", w: ["途中で引き返す", "様子を見る", "運に任せる"] },
    ];

    const proverbs = [
      { q: "「石の上にも（　）」の（　）に入る語は？", a: "三年", w: ["一日", "百年", "十分"], exp: "辛抱すれば成果が出る、の意味。" },
      { q: "「急がば（　）」の（　）に入る語は？", a: "回れ", w: ["走れ", "飛べ", "止まれ"], exp: "急ぐときほど確実な方法を、の意味。" },
      { q: "「（　）も木から落ちる」の（　）に入る語は？", a: "猿", w: ["犬", "猫", "鳥"], exp: "名人でも失敗する、の意味。" },
    ];

    const kanji = [
      { k: "精査", r: "せいさ", w: ["せいしゃ", "しょうさ", "せんさ"] },
      { k: "顕著", r: "けんちょ", w: ["けんしょ", "けんちゃく", "けんちょう"] },
      { k: "逸脱", r: "いつだつ", w: ["いちだつ", "いったつ", "いつたつ"] },
      { k: "概ね", r: "おおむね", w: ["おおまね", "おおね", "おおむめ"] },
    ];

    const spiLike = [
      { q: "次の語の意味として最も近いものは？「本質」", a: "物事の中心となる性質", w: ["表面上の印象", "偶然の出来事", "細部の違い"] },
      { q: "次の語の意味として最も近いものは？「妥当」", a: "筋が通っていて適切", w: ["強引で押し切る", "曖昧で不明確", "極端で偏っている"] },
      { q: "次の語の意味として最も近いものは？「逆説」", a: "一見矛盾するようで真理を含む表現", w: ["単なる同義反復", "無関係な説明", "事実の羅列"] },
    ];

    for (let i = 0; i < n; i++) {
      const rnd = mulberry32(seedBase + i);
      const kind = i % 4;

      if (kind === 0) {
        const it = pick(rnd, idioms);
        const { c, a } = force4Unique(rnd, it.m, it.w);
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
        const { c, a } = force4Unique(rnd, it.a, it.w);
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
        const { c, a } = force4Unique(rnd, it.r, it.w);
        add(bank, {
          sub: "国語", level: "中", diff: "発展",
          pattern: "kanji",
          patternGroup: "ja_kanji_reading",
          q: `次の漢字の読みとして正しいものは？「${it.k}」`,
          c, a,
          exp: `「${it.k}」は「${it.r}」。`,
        });
      } else {
        const it = pick(rnd, spiLike);
        const { c, a } = force4Unique(rnd, it.a, it.w);
        add(bank, {
          sub: "国語", level: "中", diff: "標準",
          pattern: "vocab",
          patternGroup: "ja_spi_like",
          q: it.q,
          c, a,
          exp: `語の定義を押さえて選ぶ。`,
        });
      }
    }
  }

  /* =========================
   * 数学：思考系＋“成立しない設問”を作らない
   * ========================= */
  function genMathHard(bank, n, seedBase) {
    for (let i = 0; i < n; i++) {
      const rnd = mulberry32(seedBase + i);
      const kind = i % 10;

      if (kind === 0) {
        // 確率：単発当たり（必ず 1/N を含む）
        const N = pick(rnd, [6, 8, 10, 12, 15]);
        const correct = frac(1, N);
        const wrong = [frac(1, N - 1), frac(2, N), frac(N - 1, N), frac(1, N + 1)];
        const { c, a } = force4Unique(rnd, correct, wrong);
        add(bank, {
          sub: "数学", level: "中", diff: "標準",
          pattern: "prob",
          patternGroup: "math_prob_single_hit",
          q: `${N}枚のカードのうち1枚だけ当たりがある。1回引いて当たりを引く確率は？`,
          c, a,
          exp: `当たりは1通り、全体は${N}通りなので 1/${N}。`,
        });
      } else if (kind === 1) {
        // “余りが4”の情報は、必ず別の問いに変換する（成立させる）
        const addk = pick(rnd, [3, 6, 8, 11, 14, 19]);
        const rem = (4 + addk) % 15;
        const correct = `${rem}`;
        const wrong = [`${(rem + 1) % 15}`, `${(rem + 14) % 15}`, `${(rem + 2) % 15}`, `${(rem + 3) % 15}`];
        const { c, a } = force4Unique(rnd, correct, wrong);
        add(bank, {
          sub: "数学", level: "中", diff: "発展",
          pattern: "number",
          patternGroup: "math_remainder_transform",
          q: `ある整数Nは15で割ると余りが4である。N+${addk}を15で割ったときの余りは？`,
          c, a,
          exp: `N≡4 (mod 15)。両辺に${addk}を足して余りを求める。4+${addk}≡${rem} (mod 15)。`,
        });
      } else if (kind === 2) {
        // 場合の数：重複なしの3桁
        const digits = pick(rnd, [[1,2,3,4,5], [0,1,2,3,4,5], [2,3,4,6,7]]);
        const set = digits.slice();
        const hasZero = set.includes(0);
        let count;
        if (!hasZero) {
          count = set.length * (set.length - 1) * (set.length - 2);
        } else {
          count = (set.length - 1) * (set.length - 1) * (set.length - 2);
        }
        const correct = `${count}`;
        const wrong = [`${count + set.length}`, `${Math.max(1, count - set.length)}`, `${set.length ** 3}`, `${(set.length - 1) * (set.length - 2) * (set.length - 3)}`];
        const { c, a } = force4Unique(rnd, correct, wrong);
        add(bank, {
          sub: "数学", level: "中", diff: "発展",
          pattern: "count",
          patternGroup: "math_count_3digit_no_repeat",
          q: `次の数字だけを使って、同じ数字を2回使わない3桁の整数を作る。作れる数は何通りか？（使える数字：${set.join(", ")}）`,
          c, a,
          exp: `先頭が0にならない条件と、重複なしの積の法則で数える。`,
        });
      } else if (kind === 3) {
        // 規則性：等差
        const a1 = pick(rnd, [2, 3, 5]);
        const d = pick(rnd, [3, 4, 6]);
        const n0 = pick(rnd, [8, 10, 12, 15]);
        const an = a1 + (n0 - 1) * d;
        const correct = `${an}`;
        const wrong = [`${a1 + n0 * d}`, `${a1 + (n0 - 2) * d}`, `${an + d}`, `${an - d}`];
        const { c, a } = force4Unique(rnd, correct, wrong);
        add(bank, {
          sub: "数学", level: "中", diff: "標準",
          pattern: "sequence",
          patternGroup: "math_sequence_arithmetic",
          q: `数列 ${a1}, ${a1 + d}, ${a1 + 2*d}, ... の第${n0}項は？`,
          c, a,
          exp: `等差数列。第n項＝初項＋(n-1)×公差。`,
        });
      } else if (kind === 4) {
        // 整数：余り（3桁回文）
        const m = pick(rnd, [5, 7, 9, 11]);
        const a0 = pick(rnd, [2, 3, 4]);
        const b0 = pick(rnd, [3, 4, 5]);
        const N = a0 * 100 + b0 * 10 + a0;
        const rem = ((N % m) + m) % m;
        const correct = `${rem}`;
        const wrong = [`${(rem + 1) % m}`, `${(rem + m - 1) % m}`, `${(rem + 2) % m}`, `${(rem + 3) % m}`];
        const { c, a } = force4Unique(rnd, correct, wrong);
        add(bank, {
          sub: "数学", level: "中", diff: "発展",
          pattern: "number",
          patternGroup: "math_mod_remainder",
          q: `${a0}${b0}${a0} を ${m} で割った余りは？`,
          c, a,
          exp: `割り算で余りを求める。余りは 0〜${m-1}。`,
        });
      } else if (kind === 5) {
        // 追いつき
        const vA = pick(rnd, [60, 72, 80]);
        const vB = pick(rnd, [48, 54, 64]);
        const head = pick(rnd, [6, 8, 10, 12]);
        const diff = vA - vB;
        const t = head / diff;
        const correct = `${t}時間`;
        const wrong = [`${head / vA}時間`, `${head / vB}時間`, `${(head / diff) * 60}分`, `${t + 1}時間`];
        const { c, a } = force4Unique(rnd, correct, wrong);
        add(bank, {
          sub: "数学", level: "中", diff: "発展",
          pattern: "word",
          patternGroup: "math_speed_catchup",
          q: `Aは時速${vA}km、Bは時速${vB}kmで同じ方向に進む。Bが${head}km先にいるとき、AがBに追いつくまでの時間は？`,
          c, a,
          exp: `時間＝先行距離÷(速さの差)。`,
        });
      } else if (kind === 6) {
        // 相似：面積比
        const s = pick(rnd, [2, 3, 4, 5]);
        const correct = `${s * s}:1`;
        const wrong = [`${s}:1`, `1:${s * s}`, `${s * s}:${s}`, `${s}:${s * s}`];
        const { c, a } = force4Unique(rnd, correct, wrong);
        add(bank, {
          sub: "数学", level: "中", diff: "発展",
          pattern: "geometry",
          patternGroup: "math_similarity_area_ratio",
          q: `2つの相似な図形があり、対応する辺の比が ${s}:1 である。面積の比は？`,
          c, a,
          exp: `相似比が ${s}:1 なら面積比は ${s}^2:1。`,
        });
      } else if (kind === 7) {
        // 平均更新
        const n0 = pick(rnd, [5, 6, 8, 10]);
        const avg = pick(rnd, [62, 65, 68, 70, 72]);
        const sum = n0 * avg;
        const addScore = pick(rnd, [55, 60, 75, 80]);
        const newAvg = Math.round(((sum + addScore) / (n0 + 1)) * 10) / 10;
        const correct = `${newAvg}`;
        const wrong = [`${avg}`, `${Math.round((avg + addScore) / 2 * 10) / 10}`, `${newAvg + 1}`, `${Math.max(0, newAvg - 1)}`];
        const { c, a } = force4Unique(rnd, correct, wrong);
        add(bank, {
          sub: "数学", level: "中", diff: "標準",
          pattern: "stats",
          patternGroup: "math_average_update",
          q: `${n0}人の平均点が${avg}点だった。そこに${addScore}点の人が1人加わると、新しい平均点は？`,
          c, a,
          exp: `平均×人数＝合計点。合計に追加して人数で割る。`,
        });
      } else if (kind === 8) {
        // 濃度（希釈）
        const total = pick(rnd, [200, 250, 300, 400]);
        const pct = pick(rnd, [8, 10, 12, 15, 20]);
        const solute = Math.round(total * pct / 100);
        const addWater = pick(rnd, [50, 100, 150]);
        const newPct = Math.round((solute / (total + addWater)) * 1000) / 10;
        const correct = `${newPct}%`;
        const wrong = [`${pct}%`, `${Math.max(0, newPct - 2)}%`, `${newPct + 2}%`, `${Math.round((addWater / (total + addWater)) * 1000) / 10}%`];
        const { c, a } = force4Unique(rnd, correct, wrong);
        add(bank, {
          sub: "数学", level: "中", diff: "発展",
          pattern: "word",
          patternGroup: "math_concentration_dilution",
          q: `${pct}%の食塩水が${total}gある。水を${addWater}g加えたときの濃度は？`,
          c, a,
          exp: `食塩の量は一定。食塩量=${solute}g。濃度＝${solute}/(${total}+${addWater})×100。`,
        });
      } else {
        // 小問：一次関数の読み
        const a = pick(rnd, [2, -2, 3, -3]);
        const b = pick(rnd, [-5, -2, 1, 4, 7]);
        const x = pick(rnd, [-2, -1, 0, 1, 2, 3]);
        const y = a * x + b;
        const correct = `${y}`;
        const wrong = [`${a + b}`, `${a * (x + 1) + b}`, `${a * x + (b + 1)}`, `${y + 2}`];
        const { c, a: idx } = force4Unique(rnd, correct, wrong);
        add(bank, {
          sub: "数学", level: "中", diff: "標準",
          pattern: "function",
          patternGroup: "math_linear_value",
          q: `一次関数 y = ${a}x + ${b} で、x=${x}のときのyの値は？`,
          c, a: idx,
          exp: `x=${x}を代入する。y=${a}×${x}+${b}=${y}。`,
        });
      }
    }
  }

  /* =========================
   * 英語：文法の自然さ＋読解は内容把握
   * ========================= */
  function genEnglish(bank, n, seedBase) {
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
        const v = pick(rnd, verbs);
        const correct = `is ${v.ing}`;
        const wrongs = [v.base, v.third, v.past, `are ${v.ing}`];
        const { c, a } = force4Unique(rnd, correct, wrongs);
        add(bank, {
          sub: "英語", level: "中", diff: "標準",
          pattern: "grammar",
          patternGroup: "eng_present_progressive",
          q: `(   )に入る最も適切な語句は？ She (   ) ${v.base} now.`,
          c, a,
          exp: `now があるので現在進行形。主語がSheなので is + -ing。`,
        });
      } else if (kind === 1) {
        const correct = "wrote";
        const wrongs = ["write", "writes", "is writing", "will write"];
        const { c, a } = force4Unique(rnd, correct, wrongs);
        add(bank, {
          sub: "英語", level: "中", diff: "標準",
          pattern: "grammar",
          patternGroup: "eng_past_simple",
          q: `(   )に入る最も適切な語句は？ He (   ) a letter yesterday.`,
          c, a,
          exp: `yesterday があるので過去形。writeの過去形は wrote。`,
        });
      } else if (kind === 2) {
        const v = pick(rnd, verbs);
        const correct = v.third;
        const wrongs = [v.base, v.past, `is ${v.ing}`, `will ${v.base}`];
        const { c, a } = force4Unique(rnd, correct, wrongs);
        add(bank, {
          sub: "英語", level: "中", diff: "標準",
          pattern: "grammar",
          patternGroup: "eng_third_person",
          q: `(   )に入る最も適切な語は？ My brother (   ) soccer every day.`,
          c, a,
          exp: `三人称単数の現在形なので動詞に-s。`,
        });
      } else if (kind === 3) {
        const ad = pick(rnd, adjectives);
        const correct = ad.comp;
        const wrongs = [ad.base, ad.sup, `most ${ad.base}`, `more ${ad.base}`].filter((x) => x !== correct);
        const { c, a } = force4Unique(rnd, correct, wrongs);
        add(bank, {
          sub: "英語", level: "中", diff: "発展",
          pattern: "grammar",
          patternGroup: "eng_comparative",
          q: `(   )に入る最も適切な語句は？ This backpack is (   ) than that one.`,
          c, a,
          exp: `than があるので比較級。${ad.base} の比較級は ${correct}。`,
        });
      } else if (kind === 4) {
        const items = [
          { sent: "We meet (   ) 7 o'clock.", correct: "at", wrongs: ["in", "on", "to"], exp: "時刻は at" },
          { sent: "I was born (   ) April.", correct: "in", wrongs: ["at", "on", "to"], exp: "月は in" },
          { sent: "She studies (   ) the library.", correct: "in", wrongs: ["at", "on", "to"], exp: "内部の場所は in" },
          { sent: "I go to school (   ) bus.", correct: "by", wrongs: ["in", "on", "at"], exp: "交通手段は by" },
        ];
        const it = pick(rnd, items);
        const { c, a } = force4Unique(rnd, it.correct, it.wrongs);
        add(bank, {
          sub: "英語", level: "中", diff: "標準",
          pattern: "grammar",
          patternGroup: "eng_preposition",
          q: `(   )に入る最も適切な語は？ ${it.sent}`,
          c, a,
          exp: it.exp,
        });
      } else {
        const p = pick(rnd, readingPassages);
        const qx = (i % 2 === 0) ? p.q1 : p.q2;
        const { c, a } = force4Unique(rnd, qx.correct, qx.wrongs);
        add(bank, {
          sub: "英語", level: "中", diff: "発展",
          pattern: "reading",
          patternGroup: "eng_reading_content",
          q: `次の英文を読んで質問に答えなさい。\n\n"${p.text}"\n\nQ: ${qx.ask}`,
          c, a,
          exp: `本文の内容（因果・言い換え）に基づいて選ぶ。`,
        });
      }
    }
  }

  /* =========================
   * 理科：括弧ヒント排除（力÷面積 等はexpへ）
   * ========================= */
  function genScienceHard(bank, n, seedBase) {
    for (let i = 0; i < n; i++) {
      const rnd = mulberry32(seedBase + i);
      const kind = i % 10;

      if (kind === 0) {
        // 圧力：括弧ヒントなし
        const F = pick(rnd, [80, 100, 120, 150, 200, 240, 300]);
        const area_cm2 = pick(rnd, [5, 8, 10, 12, 15, 20]);
        const area_m2 = area_cm2 * 1e-4;
        const p = Math.round(F / area_m2);

        const { c, a } = force4Unique(
          rnd, `${p}`,
          [`${p * 10}`, `${Math.max(1, Math.round(p / 10))}`, `${p + 5000}`, `${Math.max(1, p - 5000)}`]
        );
        add(bank, {
          sub: "理科", level: "中", diff: "発展",
          pattern: "physics",
          patternGroup: "sci_pressure_unitconv",
          q: `力が${F}N、面積が${area_cm2}cm²のとき、圧力の値は？（数値のみ）`,
          c, a,
          exp: `面積をm²に直す（${area_cm2}cm²=${area_m2}m²）。圧力＝力/面積なので ${F}/${area_m2}=${p}。`,
        });
      } else if (kind === 1) {
        const densityObj = pick(rnd, [0.8, 0.9, 1.1, 1.2, 2.7, 7.9]);
        const densityLiq = pick(rnd, [1.0, 1.2, 1.4]);
        const correct = (densityObj < densityLiq) ? "浮く" : (densityObj > densityLiq ? "沈む" : "静止する");
        const wrongs = ["沈む", "浮く", "静止する"].filter((x) => x !== correct);
        const { c, a } = force4Unique(rnd, correct, wrongs);
        add(bank, {
          sub: "理科", level: "中", diff: "発展",
          pattern: "physics",
          patternGroup: "sci_density_float",
          q: `密度が${densityObj}g/cm³の物体を、密度が${densityLiq}g/cm³の液体に入れた。物体のようすとして最も適切なものは？`,
          c, a,
          exp: `物体の密度が液体より小さいと浮き、大きいと沈む。等しい場合は静止する。`,
        });
      } else if (kind === 2) {
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
        const { c, a } = force4Unique(rnd, correct, wrongs);
        add(bank, {
          sub: "理科", level: "中", diff: "発展",
          pattern: "physics",
          patternGroup: mode === "series" ? "sci_circuit_series_eqR" : "sci_circuit_parallel_eqR",
          q: `抵抗${R1}Ωと抵抗${R2}Ωを${mode === "series" ? "直列" : "並列"}につないだときの合成抵抗は？`,
          c, a,
          exp: mode === "series"
            ? `直列の合成抵抗は和。${R1}+${R2}=${eq}Ω。`
            : `並列は 1/R = 1/R1 + 1/R2。計算して ${eq}Ω。`,
        });
      } else if (kind === 3) {
        const R = pick(rnd, [3, 4, 5, 6, 8, 10, 12]);
        const I = pick(rnd, [0.2, 0.3, 0.5, 0.8, 1.0, 1.2]);
        const V = Math.round(R * I * 10) / 10;

        const { c, a } = force4Unique(
          rnd, `${V}V`,
          [`${R}V`, `${I}V`, `${Math.round((V + 1) * 10) / 10}V`, `${Math.max(0, Math.round((V - 1) * 10) / 10)}V`]
        );
        add(bank, {
          sub: "理科", level: "中", diff: "発展",
          pattern: "physics",
          patternGroup: "sci_ohm_basic",
          q: `抵抗が${R}Ω、電流が${I}Aのとき、電圧は？`,
          c, a,
          exp: `電圧・電流・抵抗の関係より V＝IR。${R}×${I}=${V}V。`,
        });
      } else {
        // 概念・実験計画・地学など（省略せず生成量確保）
        const pack = [
          {
            q: `密閉した容器内で化学変化が起きた。最も適切な説明はどれか？`,
            correct: "反応前後で全体の質量は変わらない",
            wrongs: ["反応後は必ず質量が増える", "反応後は必ず質量が減る", "反応は質量と無関係に起きる"],
            patternGroup: "sci_mass_conservation",
            exp: "密閉系では外へ出入りがないため質量保存が成り立つ。",
            pattern: "chemistry",
          },
          {
            q: `実験で「原因と結果」を確かめるときの条件設定として最も適切なものは？`,
            correct: "他の条件をそろえて、1つの条件だけを変えて比較する",
            wrongs: ["条件を同時にいくつも変えて結果を比べる", "毎回違う道具を使う", "測定は1回だけ行い平均は取らない"],
            patternGroup: "sci_experiment_control_variable",
            exp: "対照実験は変数を1つに絞り、他条件を統一する。",
            pattern: "experiment",
          },
          {
            q: `前線と天気の変化について最も適切なものは？`,
            correct: "寒冷前線の通過では、短時間に強い雨が降りやすい",
            wrongs: ["寒冷前線の通過では、層状の雲が広がりやすい", "温暖前線の通過では、急に雷雨が起こりやすい", "前線は天気の変化に影響しない"],
            patternGroup: "sci_earth_front_weather",
            exp: "寒冷前線は積乱雲が発達し短時間強雨、温暖前線は層状雲・長雨になりやすい。",
            pattern: "earth",
          },
        ];
        const it = pick(rnd, pack);
        const { c, a } = force4Unique(rnd, it.correct, it.wrongs);
        add(bank, {
          sub: "理科", level: "中", diff: "発展",
          pattern: it.pattern,
          patternGroup: it.patternGroup,
          q: it.q,
          c, a,
          exp: it.exp,
        });
      }
    }
  }

  /* =========================
   * 社会：経度問題は東経西経明示＆ヒント括弧なし
   * ========================= */
  function genSocialHard(bank, n, seedBase) {
    for (let i = 0; i < n; i++) {
      const rnd = mulberry32(seedBase + i);
      const kind = i % 10;

      if (kind === 0) {
        // ご指定のタイプ：120→60（ヒント括弧なし、東経/西経明示）
        const start = { dir: "E", deg: 120 };
        const end = { dir: "E", deg: 60 };
        const diffDeg = lonToDeg(end) - lonToDeg(start); // -60
        const hours = diffDeg / 15; // -4
        const correct = "4時間遅れる";
        const wrongs = ["4時間進む", "2時間遅れる", "2時間進む"];
        const { c, a } = force4Unique(rnd, correct, wrongs);
        add(bank, {
          sub: "社会", level: "中", diff: "標準",
          pattern: "geo",
          patternGroup: "soc_geo_timezone_basic_move",
          q: `${formatLon(start)}の地点から${formatLon(end)}の地点へ移動した。時刻は一般にどうなる？`,
          c, a,
          exp: `経度差は${Math.abs(diffDeg)}°。西へ移動すると時刻は遅れる。15°で1時間分なので、${Math.abs(hours)}時間遅れる。`,
        });
      } else if (kind === 1) {
        // 旅行型（東経西経明示／括弧ヒントなし）
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
        const diffMin = Math.round((diffDeg / 15) * 60);
        const japanTimeAtArr = fromMin(arrLocal - diffMin);

        const wrongs = [
          fromMin(toMin(depH + flightH + 2, depM)),
          fromMin(toMin(depH + flightH - 2, depM)),
          fromMin(toMin(depH + flightH + 4, depM)),
          fromMin(toMin(depH + flightH - 4, depM)),
        ];
        const { c, a } = force4Unique(rnd, japanTimeAtArr, wrongs);
        add(bank, {
          sub: "社会", level: "中", diff: "発展",
          pattern: "geo",
          patternGroup: "soc_geo_timezone_travel",
          q: `日本（${formatLon(jp)}）を${fromMin(depMin)}に出発し、${formatLon(dest)}の都市に現地時刻で${fromMin(arrLocal)}に到着した（飛行時間${flightH}時間）。到着時の日本の時刻は？`,
          c, a,
          exp: `経度差から時差を求め、現地時刻を日本時刻へ換算する。15°で1時間ぶんの差。答えは ${japanTimeAtArr}。`,
        });
      } else {
        // 公民/地理/歴史（難化：資料・因果の比率を維持）
        const pack = [
          {
            q: "行政が国会の定めた法律に基づき政策を実行する。これはどの働きか？",
            correct: "行政",
            wrongs: ["立法", "司法", "自治"],
            patternGroup: "soc_civics_case_admin",
            pattern: "civics",
            exp: "法律を執行するのが行政。",
          },
          {
            q:
`次の表はある地域の年齢区分別人口（千人）である。高齢化率（65歳以上人口/総人口）として最も近いものは？

【表】
0〜14歳：150
15〜64歳：650
65歳以上：300`,
            correct: "27.3%",
            wrongs: ["18.2%", "54.5%", "72.7%"],
            patternGroup: "soc_geo_population_aging_rate_fixed",
            pattern: "geo",
            exp: "総人口=1100。300/1100×100=27.27…% ≈ 27.3%。",
          },
          {
            q:
`次の記録がある。
「今年は収穫が少ないのに、納める量は変わらない。家の者が食べる米が足りぬ。」
この記録から考えられる状況として最も適切なものは？`,
            correct: "年貢などの負担が増え、生活が苦しくなる可能性がある",
            wrongs: ["税がなくなり生活が必ず豊かになる", "武士がいなくなり戦争が必ず起きる", "外国との貿易が必ず停止する"],
            patternGroup: "soc_hist_source_inference",
            pattern: "history",
            exp: "不作でも負担が固定されると生活が逼迫する。因果を読む。",
          },
          {
            q: "ある商品の人気が急上昇し、買いたい人が増えた。市場の変化として最も適切な説明はどれか？",
            correct: "需要が増えると、一般に価格と取引量は増える方向に働く",
            wrongs: ["需要が増えると、一般に価格と取引量は減る方向に働く", "供給が増えると、一般に価格は上がる方向に働く", "需要と供給は価格に影響しない"],
            patternGroup: "soc_econ_supply_demand",
            pattern: "civics",
            exp: "需要増は需要曲線が右へ。均衡価格・取引量が上がる方向。",
          },
        ];
        const it = pick(rnd, pack);
        const { c, a } = force4Unique(rnd, it.correct, it.wrongs);
        add(bank, {
          sub: "社会", level: "中", diff: "発展",
          pattern: it.pattern,
          patternGroup: it.patternGroup,
          q: it.q,
          c, a,
          exp: it.exp,
        });
      }
    }
  }

  /* =========================
   * 固定（最低限）
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

    FIXED.forEach((q) => add(bank, q));

    genJapanese(bank, TARGET.国語, 1100);
    genMathHard(bank, TARGET.数学, 2100);
    genEnglish(bank, TARGET.英語, 3100);
    genScienceHard(bank, TARGET.理科, 4100);
    genSocialHard(bank, TARGET.社会, 5100);

    // 検品で落とす
    bank = bank.filter(validateQuestion);

    // 不足補填
    function countSub(sub) {
      return bank.filter((q) => q.sub === sub).length;
    }
    function topUp(sub) {
      const need = Math.max(0, MIN_PER_SUBJECT - countSub(sub));
      if (need <= 0) return;
      const tmp = [];
      if (sub === "国語") genJapanese(tmp, need + 80, 12000);
      if (sub === "数学") genMathHard(tmp, need + 120, 22000);
      if (sub === "英語") genEnglish(tmp, need + 80, 32000);
      if (sub === "理科") genScienceHard(tmp, need + 120, 42000);
      if (sub === "社会") genSocialHard(tmp, need + 120, 52000);
      tmp.filter(validateQuestion).forEach((q) => add(bank, q));
    }
    SUBJECTS.forEach(topUp);

    // 統計ログ
    const stats = {};
    SUBJECTS.forEach((s) => {
      stats[s] = bank.filter((q) => q.sub === s).length;
    });
    const groups = {};
    bank.forEach((q) => {
      groups[q.patternGroup] = (groups[q.patternGroup] || 0) + 1;
    });

    console.log("[BANK stats]", stats, "total:", bank.length);
    console.log("[BANK patternGroup TOP25]",
      Object.entries(groups).sort((a, b) => b[1] - a[1]).slice(0, 25)
    );

    // uidユニーク性チェック
    const uniq = new Set(bank.map(q => q.uid));
    console.log("[BANK] unique(uid):", uniq.size);

    return bank;
  }

  window.BANK = buildBank();
})();
