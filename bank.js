/* bank.js
   品質重視：
   - 理社の固有名詞系は「固定問題」で担保（生成で事実を作らない）
   - 生成は数学（思考系を増量）・理科計算・英/国の自作読解/穴埋め中心
   - 選択肢の妥当性チェックを必須化
*/
(function () {
  "use strict";

  // ========= 基本ユーティリティ =========
  const randInt = (a, b) => Math.floor(Math.random() * (b - a + 1)) + a;
  const shuffle = (arr) => {
    const a = arr.slice();
    for (let i = a.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [a[i], a[j]] = [a[j], a[i]];
    }
    return a;
  };
  const uniq = (arr) => [...new Set(arr)];
  const pick = (arr) => arr[Math.floor(Math.random() * arr.length)];

  // 不適切語フィルタ（最低限）
  const BLOCKLIST = [
    "死ね", "殺", "自殺", "暴力", "差別", "奴隷", "レイプ", "性的", "侮辱", "民族",
  ];
  const hasBlocked = (s) => BLOCKLIST.some(w => String(s).includes(w));

  function makeKey(q) {
    const t = (q.q || "").slice(0, 80);
    let h = 2166136261 >>> 0;
    const base = `${q.sub}|${q.pattern}|${t}`;
    for (let i = 0; i < base.length; i++) {
      h ^= base.charCodeAt(i);
      h = Math.imul(h, 16777619);
    }
    return `${q.sub}_${q.pattern}_${(h >>> 0).toString(16)}`;
  }

  function validateQuestion(q) {
    const errs = [];
    if (!q.sub || !q.level || !q.diff || !q.pattern) errs.push("meta不足");
    if (!q.q || typeof q.q !== "string") errs.push("本文なし");
    if (!Array.isArray(q.c) || q.c.length !== 4) errs.push("選択肢は4つ必須");
    if (typeof q.a !== "number" || q.a < 0 || q.a > 3) errs.push("a(正解index)不正");
    if (q.c) {
      if (uniq(q.c).length !== 4) errs.push("選択肢が重複");
      if (q.c.some(x => String(x).trim().length === 0)) errs.push("空選択肢あり");
      if (q.c.some(x => hasBlocked(x))) errs.push("不適切語を含む選択肢");
    }
    if (q.q && hasBlocked(q.q)) errs.push("不適切語を含む本文");
    return errs;
  }

  function pushQ(list, q) {
    q.key = q.key || makeKey(q);
    const errs = validateQuestion(q);
    if (errs.length) {
      throw new Error(`[bank.js] invalid question (${q.sub}/${q.pattern}): ${errs.join(", ")}\n${q.q}`);
    }
    list.push(q);
  }

  // ========= 「迷う誤答」を作る小道具 =========
  function nearNumberMistakes(ans, opts = {}) {
    const { allowNeg = true, asInt = false } = opts;
    const a = Number(ans);
    const cands = [
      a + 1, a - 1,
      a * 2, a / 2,
      a + 10, a - 10,
      -a,
    ];
    let out = cands
      .filter(x => Number.isFinite(x))
      .map(x => asInt ? Math.round(x) : x);

    if (!allowNeg) out = out.filter(x => x >= 0);
    out = uniq(out.map(x => asInt ? String(Math.round(x)) : String(Number(x))));
    return out;
  }

  function makeMCQ({ sub, level, diff, pattern, stem, answer, distractors, exp }) {
    const aStr = String(answer);
    let pool = [aStr, ...(distractors || []).map(String)].filter(x => x && x.trim());
    pool = uniq(pool).filter(x => !hasBlocked(x));

    // 4択に満たない場合は補完（数値系のみ）
    if (pool.length < 4) {
      const num = Number(aStr);
      if (Number.isFinite(num)) {
        pool = uniq(pool.concat(nearNumberMistakes(num, { asInt: false })));
      }
    }
    pool = uniq(pool).slice(0, 30);

    const wrongs = pool.filter(x => x !== aStr);
    const pickedWrongs = shuffle(wrongs).slice(0, 3);
    if (pickedWrongs.length < 3) {
      throw new Error(`[bank.js] distractor不足: ${sub}/${pattern}\n${stem}`);
    }

    const choices = shuffle([aStr, ...pickedWrongs]);
    const aIndex = choices.indexOf(aStr);

    return { sub, level, diff, pattern, q: stem, c: choices, a: aIndex, exp: exp || "" };
  }

  // ========= 固定問題（理社など：事実を生成しない） =========
  const FIXED = {
    社会: [
      {
        sub: "社会", level: "中", diff: "標準", pattern: "hist_meiji",
        q: "【歴史】明治政府が「学制」を公布した目的として最も適切なものはどれ？",
        c: ["全国的に学校制度を整え、教育を広めるため", "武士だけを対象に軍事教育を行うため", "寺子屋を禁止して宗教教育に統一するため", "海外留学を全面的に禁止するため"],
        a: 0,
        exp: "近代国家づくりの一環として全国的な学校制度を整備し、教育の普及を図った。",
      },
      {
        sub: "社会", level: "中", diff: "標準", pattern: "civ_constitution",
        q: "【公民】日本国憲法の三大原則として正しい組み合わせはどれ？",
        c: ["国民主権・基本的人権の尊重・平和主義", "天皇主権・軍国主義・基本的人権の制限", "地方主権・議院内閣制・武力行使", "国民主権・三権未分立・平和主義"],
        a: 0,
        exp: "三大原則は「国民主権」「基本的人権の尊重」「平和主義」。",
      },
      {
        sub: "社会", level: "中", diff: "発展", pattern: "geo_industry",
        q: "【地理】太平洋ベルトに工業が集積した主な理由として最も適切なのはどれ？",
        c: ["大消費地に近く、港湾・交通の利便性が高いから", "降水量が少なく稲作に不向きだから", "地震がほとんど起きないから", "冬でも積雪が少なく暖房費が不要だから"],
        a: 0,
        exp: "原料輸入・製品輸送に有利な港湾、人口集中による市場、交通網などが要因。",
      },
      {
        sub: "社会", level: "中", diff: "標準", pattern: "civ_election",
        q: "【公民】選挙で「一票の格差」が問題になるのは、何の不平等に関する議論か？",
        c: ["投票の価値が選挙区によって異なる不平等", "立候補者の年齢制限がある不平等", "政党に所属しないと投票できない不平等", "同日に投票できない人がいる不平等"],
        a: 0,
        exp: "人口に比して議員数が偏ると、1票の価値が異なる＝投票価値の不平等。",
      },
    ],

    理科: [
      {
        sub: "理科", level: "中", diff: "標準", pattern: "phy_ohm",
        q: "【物理】抵抗が 6Ω、電圧が 12V のとき、電流は何A？（オームの法則）",
        c: ["2A", "0.5A", "6A", "72A"],
        a: 0,
        exp: "I=V/R=12/6=2A。",
      },
      {
        sub: "理科", level: "中", diff: "標準", pattern: "chem_mass",
        q: "【化学】化学変化の前後で成り立つ法則として正しいものはどれ？",
        c: ["質量保存の法則", "万有引力の法則", "運動の第三法則", "作用反作用の法則（化学専用）"],
        a: 0,
        exp: "密閉系では反応前後で全体の質量は変わらない（質量保存）。",
      },
      {
        sub: "理科", level: "中", diff: "発展", pattern: "bio_photosyn",
        q: "【生物】光合成で主に取り込まれ、主に放出される気体の組み合わせとして正しいものはどれ？",
        c: ["二酸化炭素を取り込み、酸素を放出する", "酸素を取り込み、二酸化炭素を放出する", "窒素を取り込み、酸素を放出する", "水素を取り込み、二酸化炭素を放出する"],
        a: 0,
        exp: "光合成は CO2 を材料にして有機物を作り、O2 を放出する。",
      },
      {
        sub: "理科", level: "中", diff: "標準", pattern: "earth_front",
        q: "【地学】温暖前線が近づくときの天気の変化として一般的に正しいものはどれ？",
        c: ["雲が広がり、弱い雨が長く降りやすい", "急に積乱雲が発達し、短時間の激しい雨になりやすい", "常に快晴が続く", "必ず雷が発生する"],
        a: 0,
        exp: "温暖前線は層状の雲が広がり、穏やかな雨が続きやすい。",
      },
    ],

    数学: [
      {
        sub: "数学", level: "中", diff: "標準", pattern: "geo_pythagoras_sqrt_fixed",
        q: "直角三角形で、直角をはさむ2辺が 6 と 8 のとき、斜辺の長さは？（√のまま）",
        c: ["10", "√100", "√28", "14"],
        a: 1,
        exp: "6^2+8^2=36+64=100より、斜辺=√100=10。選択肢では√表記が正。",
      },
      {
        sub: "数学", level: "中", diff: "発展", pattern: "logic_proof_fixed",
        q: "「三角形の内角の和が180°である」ことを使って説明するのに最も適切なのはどれ？",
        c: ["平行線の性質（同位角・錯角）を用いる", "円周角の定理を用いる", "相似の条件だけで示す", "素因数分解を用いる"],
        a: 0,
        exp: "平行線を引き、同位角・錯角を使って内角の和を180°に導くのが基本。",
      },
      // 証明の穴埋め（理由選択）固定例
      {
        sub: "数学", level: "中", diff: "標準", pattern: "proof_fill_triangle",
        q:
`【証明の穴埋め】\n三角形ABCで、AB=AC のとき、∠B=∠C である。\n\nこのとき、根拠として最も適切なのはどれ？`,
        c: ["二等辺三角形の性質（底角は等しい）", "平行線の同位角は等しい", "円周角は同じ弧に対して等しい", "直角三角形の合同条件（斜辺と他の1辺）"],
        a: 0,
        exp: "AB=ACなら二等辺三角形。底角が等しい。",
      },
    ],

    国語: [
      {
        sub: "国語", level: "中", diff: "標準", pattern: "jpn_read_infer",
        q:
`【文章】\n新しい道具は便利だが、使い方を考えずに導入すると、かえって手間が増えることがある。\n大切なのは「何を楽にしたいのか」を先に決め、その目的に合わせて道具を選ぶことだ。\n\n問：筆者が最も言いたいこととして適切なのはどれ？`,
        c: ["目的を先に定めてから道具を選ぶべきだ", "新しい道具は必ず手間を増やす", "便利さより価格を最優先すべきだ", "道具は使わず手作業に戻すべきだ"],
        a: 0,
        exp: "本文の中心は「目的→道具選択」の順序の重要性。",
      },
      {
        sub: "国語", level: "中", diff: "発展", pattern: "kobun_aux",
        q: "【古文】助動詞「けり」の意味として最も適切なのはどれ？",
        c: ["過去・詠嘆", "推量", "打消", "完了"],
        a: 0,
        exp: "けり：過去・詠嘆（気づき）。",
      },
      {
        sub: "国語", level: "中", diff: "発展", pattern: "kanbun_order",
        q: "【漢文】「学而時習之」の返り点の読みとして適切なのはどれ？",
        c: ["学びて時にこれを習ふ", "学びてこれを時に習ふ", "時に学びてこれを習ふ", "これを学びて時に習ふ"],
        a: 0,
        exp: "基本の訓読：「学びて時にこれを習ふ」。",
      },
    ],

    英語: [
      {
        sub: "英語", level: "中", diff: "標準", pattern: "eng_cloze_grammar",
        q:
`【Cloze】\nI was tired, (  ) I finished my homework before dinner.\n\n( ) に入る最も適切な語は？`,
        c: ["but", "because", "so", "and"],
        a: 0,
        exp: "「疲れていたが、宿題を終えた」→逆接 but。",
      },
      {
        sub: "英語", level: "中", diff: "発展", pattern: "eng_read_mainidea",
        q:
`【Reading】\nA small change can make a big difference. For example, turning off lights for just five minutes may seem minor, but many people doing it every day can reduce energy use.\n\n問：筆者の主張に最も近いのはどれ？`,
        c: ["小さな行動でも多くの人が続ければ影響が大きくなる", "節電の唯一の方法は照明を使わないことだ", "5分の節電は意味がない", "節電は個人では不可能だ"],
        a: 0,
        exp: "主旨は「小さな行動×継続×多数＝大きな差」。",
      },
    ],
  };

  // ========= 生成問題（数学強化：関数/相似/円周角/作図理由/証明穴埋め） =========
  function genMathTemplates(out, n) {
    const patterns = [
      // --- 連立（xだけ問う） ---
      () => {
        const x = randInt(-5, 8);
        const y = randInt(-5, 8);
        const a1 = randInt(1, 4), b1 = randInt(1, 4);
        const a2 = randInt(1, 4), b2 = randInt(1, 4);
        if (a1 * b2 === a2 * b1) return null;
        const c1 = a1 * x + b1 * y;
        const c2 = a2 * x + b2 * y;

        const stem = `連立方程式を解け。\n${a1}x + ${b1}y = ${c1}\n${a2}x + ${b2}y = ${c2}\n\nx の値は？`;
        const ans = String(x);
        const d = nearNumberMistakes(x, { asInt: true, allowNeg: true });
        return makeMCQ({
          sub: "数学", level: "中", diff: "標準", pattern: "alg_system_x",
          stem, answer: ans, distractors: d,
          exp: "加減法または代入法で解く。ここではxのみを問う。"
        });
      },

      // --- 三平方（√表記） ---
      () => {
        const a = randInt(3, 10);
        const b = randInt(3, 10);
        const s = a * a + b * b;
        const stem = `直角三角形で、直角をはさむ2辺が ${a} と ${b} のとき、斜辺の長さは？（√のまま）`;
        const ans = `√${s}`;
        const d = [
          `√${Math.abs(a * a - b * b) || 1}`,
          String(a + b),
          `√${s + randInt(1, 5)}`
        ];
        return makeMCQ({
          sub: "数学", level: "中", diff: "標準", pattern: "geo_pythagoras_root",
          stem, answer: ans, distractors: d,
          exp: "斜辺^2＝a^2+b^2。"
        });
      },

      // --- 関数：変化の割合（2点） ---
      () => {
        const x1 = randInt(-4, 2);
        const x2 = randInt(3, 7);
        const m = pick([-3, -2, -1, 1, 2, 3]);
        const b = randInt(-6, 6);
        const y1 = m * x1 + b;
        const y2 = m * x2 + b;

        const stem = `一次関数で、点A(${x1}, ${y1}) と点B(${x2}, ${y2}) を通る。\n変化の割合は？`;
        const ans = String(m);
        const d = [
          String((y2 - y1) / (x2 + x1)), // 足してしまう誤り
          String((x2 - x1) / (y2 - y1)), // 逆数
          String(-m)                     // 符号ミス
        ];
        return makeMCQ({
          sub: "数学", level: "中", diff: "標準", pattern: "func_slope_two_points",
          stem, answer: ans, distractors: d,
          exp: "変化の割合＝(y2−y1)/(x2−x1)。"
        });
      },

      // --- 関数：y=ax+b の解釈（切片） ---
      () => {
        const a = pick([-3, -2, -1, 1, 2, 3]);
        const b = randInt(-6, 6);
        const stem =
`一次関数 y = ${a}x + (${b}) について、次の説明のうち正しいものはどれ？`;
        const ans = "x=0のときのyの値が切片である";
        const d = [
          "切片は常に正の数である",
          "xが1増えるとyは常にbだけ増える",
          "aはy切片を表す"
        ];
        return makeMCQ({
          sub: "数学", level: "中", diff: "標準", pattern: "func_interpret_ab",
          stem, answer: ans, distractors: d,
          exp: "bはx=0のときの値（y切片）。aは変化の割合。"
        });
      },

      // --- 関数：交点（x座標） ---
      () => {
        // y=ax+b と y=cx+d の交点
        const a = pick([-2, -1, 1, 2, 3]);
        let c = pick([-3, -2, -1, 1, 2, 3]);
        if (c === a) c = a + 1;
        const b = randInt(-6, 6);
        const d = randInt(-6, 6);
        if (b === d) return null;

        // ax+b = cx+d → (a-c)x = d-b
        const num = (d - b);
        const den = (a - c);

        // 分数を簡単にする（符号も整える）
        let n0 = num, d0 = den;
        if (d0 < 0) { d0 = -d0; n0 = -n0; }
        const g = gcd(Math.abs(n0), Math.abs(d0));
        n0 /= g; d0 /= g;
        const xAns = (d0 === 1) ? String(n0) : `${n0}/${d0}`;

        const stem =
`2つの一次関数\n  y = ${a}x + (${b})\n  y = ${c}x + (${d})\nの交点の x 座標は？（分数のまま可）`;
        const dists = [
          (d0 === 1) ? String(-n0) : `${-n0}/${d0}`,      // 符号ミス
          (d0 === 1) ? String(n0 + 1) : `${n0}/${d0}+1`,  // 雑な誤答（表示用）
          (d0 === 1) ? String(n0 * 2) : `${n0 * 2}/${d0}` // 倍
        ].map(s => String(s).replace("+1","（+1）"));

        return makeMCQ({
          sub: "数学", level: "中", diff: "発展", pattern: "func_intersection_x",
          stem, answer: xAns, distractors: dists,
          exp: "連立して ax+b=cx+d を解く。"
        });
      },

      // --- 図形：相似（比） ---
      () => {
        // 相似な三角形：対応する辺の比
        const kNum = pick([2, 3, 4, 5]);
        const kDen = pick([2, 3, 4, 5]);
        if (kNum === kDen) return null;

        const base = randInt(3, 10);
        const big = base * kNum;
        const small = base * kDen;

        // 「相似比（大:小）」を問う
        const stem =
`相似な三角形で、対応する辺の長さが\n大：${big}、小：${small}\nである。\n相似比（大：小）として正しいものはどれ？`;
        const ans = `${kNum}:${kDen}`;
        const dists = [
          `${kDen}:${kNum}`,                  // 逆
          `${big}:${small}`,                  // 約分し忘れ（見た目は同値だが、ここは「最も適切」を避けるため別にする）
          `${kNum + 1}:${kDen}`               // ずらし
        ];
        // 約分し忘れが同値になると二正解なので、big:small が既に既約なら外す
        const g = gcd(big, small);
        const safeD = dists.filter(x => x !== ans);
        const finalD = (g === 1) ? safeD.filter(x => x !== `${big}:${small}`) : safeD;

        return makeMCQ({
          sub: "数学", level: "中", diff: "標準", pattern: "geo_similarity_ratio",
          stem, answer: ans, distractors: finalD.length >= 3 ? finalD : [`${kDen}:${kNum}`, `${kNum}:${kDen + 1}`, `${kNum + 1}:${kDen}`],
          exp: "相似比は対応する辺の比。まず約分して表す。"
        });
      },

      // --- 図形：円周角（同じ弧） ---
      () => {
        // 中心角 -> 円周角 = 中心角/2
        const center = pick([60, 80, 100, 120, 140, 160]);
        const ins = center / 2;

        const stem =
`円Oで、同じ弧ABに対する中心角が ${center}° のとき、\n弧ABに対する円周角は何度？`;
        const ans = String(ins);
        const dists = [String(center), String(ins + 10), String(ins - 10)];
        return makeMCQ({
          sub: "数学", level: "中", diff: "標準", pattern: "geo_inscribed_angle",
          stem, answer: ans, distractors: dists,
          exp: "円周角は同じ弧に対する中心角の半分。"
        });
      },

      // --- 図形：作図の理由（垂直二等分線） ---
      () => {
        const stem =
`【作図の理由】\n線分ABの垂直二等分線上の点Pについて、必ず成り立つこととして正しいのはどれ？`;
        const ans = "PA=PB が成り立つ";
        const dists = [
          "∠PAB=∠PBA が成り立つ",
          "AP+BP が最小になる",
          "点Pは必ず線分AB上にある"
        ];
        return makeMCQ({
          sub: "数学", level: "中", diff: "標準", pattern: "geo_construction_perp_bisector",
          stem, answer: ans, distractors: dists,
          exp: "垂直二等分線上の点はAとBから等距離。"
        });
      },

      // --- 証明穴埋め：相似の理由（角） ---
      () => {
        const stem =
`【証明の穴埋め】\n三角形ABCと三角形DEFで、∠A=∠D、∠B=∠E である。\nこのとき、三角形ABCと三角形DEFが相似である理由として最も適切なのはどれ？`;
        const ans = "2組の角がそれぞれ等しい（AA）";
        const dists = [
          "3辺がそれぞれ等しい（SSS）",
          "1組の辺とその両端の角がそれぞれ等しい（ASA）",
          "直角三角形で斜辺と他の1辺が等しい（HL）"
        ];
        return makeMCQ({
          sub: "数学", level: "中", diff: "標準", pattern: "proof_fill_similarity_AA",
          stem, answer: ans, distractors: dists,
          exp: "相似条件：2組の角がそれぞれ等しい（AA）。"
        });
      },

      // --- 証明穴埋め：平行線の角（同位角/錯角） ---
      () => {
        const kind = pick(["同位角", "錯角"]);
        const stem =
`【証明の穴埋め】\n2直線 l と m が平行で、これらを1本の直線が横切るとき、\n対応する ${kind} は等しい。\n\nこの性質を何という？`;
        const ans = "平行線の性質";
        const dists = ["円周角の定理", "三平方の定理", "相加相乗平均の関係"];
        return makeMCQ({
          sub: "数学", level: "中", diff: "標準", pattern: "proof_fill_parallel",
          stem, answer: ans, distractors: dists,
          exp: "平行線を横切る直線が作る同位角・錯角は等しい。"
        });
      },
    ];

    while (out.length < n) {
      const f = patterns[randInt(0, patterns.length - 1)];
      const q = f();
      if (q) pushQ(out, q);
    }
  }

  function genScienceCalc(out, n) {
    const patterns = [
      () => {
        const m = randInt(60, 250);      // g
        const v = randInt(20, 100);      // cm^3
        const d = (m / v);
        const ans = String(Number(d.toFixed(2)));
        const stem = `物体の質量が ${m}g、体積が ${v}cm³ のとき、密度は？（g/cm³、四捨五入して小数第2位まで）`;
        const dists = [
          String(Number((m / (v + 10)).toFixed(2))),
          String(Number(((m + 10) / v).toFixed(2))),
          String(Number((v / m).toFixed(2)))
        ];
        return makeMCQ({
          sub: "理科", level: "中", diff: "標準", pattern: "phy_density",
          stem, answer: ans, distractors: dists,
          exp: "密度＝質量÷体積。"
        });
      },
      () => {
        const R = randInt(2, 12);
        const I = randInt(1, 4);
        const V = R * I;
        const stem = `抵抗が ${R}Ω の回路に ${V}V を加えた。電流は？`;
        const ans = String(I);
        const dists = [String(V), String(R), String(Number((V / (R + 1)).toFixed(2)))];
        return makeMCQ({
          sub: "理科", level: "中", diff: "標準", pattern: "phy_ohm_calc",
          stem, answer: ans, distractors: dists,
          exp: "I=V/R。"
        });
      },
      () => {
        const solute = randInt(5, 20);       // g
        const solution = randInt(solute + 30, solute + 200); // g
        const p = (solute / solution) * 100;
        const ans = String(Number(p.toFixed(1)));
        const stem = `${solution}g の食塩水に食塩が ${solute}g 溶けている。濃度は何%？（小数第1位まで）`;
        const dists = [
          String(Number((solute / (solution - solute) * 100).toFixed(1))),
          String(Number((solution / solute).toFixed(1))),
          String(Number((p + 1).toFixed(1)))
        ];
        return makeMCQ({
          sub: "理科", level: "中", diff: "標準", pattern: "chem_percent",
          stem, answer: ans, distractors: dists,
          exp: "濃度(%)＝溶質÷溶液×100。"
        });
      },
    ];

    while (out.length < n) {
      const f = patterns[randInt(0, patterns.length - 1)];
      const q = f();
      if (q) pushQ(out, q);
    }
  }

  function genEnglishCloze(out, n) {
    const bank = [
      { stem: "I checked the answer (  ).", a: "carefully", d: ["careful", "care", "cared"], exp: "副詞：carefully" },
      { stem: "I went out (  ) it was raining.", a: "although", d: ["because", "so", "and"], exp: "逆接：although" },
      { stem: "This book is (  ) interesting than that one.", a: "more", d: ["most", "many", "much"], exp: "比較：more" },
      { stem: "I want (  ) study harder.", a: "to", d: ["for", "at", "in"], exp: "不定詞：to" },
    ];
    while (out.length < n) {
      const p = pick(bank);
      const q = makeMCQ({
        sub: "英語", level: "中", diff: "標準", pattern: "eng_cloze_vocab",
        stem: `【Cloze】\nChoose the best word.\n\n${p.stem}`,
        answer: p.a, distractors: p.d,
        exp: p.exp
      });
      pushQ(out, q);
    }
  }

  function genJapaneseReading(out, n) {
    const passages = [
      {
        text:
`【文章】\n「正しさ」を守ることは大切だ。しかし、正しさの示し方を誤ると、相手を黙らせる道具にもなる。\n議論の目的が問題解決なら、相手の立場を確認し、共通の前提を探すべきだ。\n\n問：本文の趣旨として最も適切なのはどれ？`,
        a: "正しさの押し付けではなく、問題解決のため共通前提を探すべきだ",
        ds: ["正しさは状況により不要である", "議論では相手を黙らせるのが効果的だ", "立場の確認は議論を遅らせるので避けるべきだ"],
        exp: "正しさの扱い方（目的志向）が主題。"
      },
      {
        text:
`【文章】\n人は情報が多いほど判断が良くなると思いがちだが、選択肢が増えすぎると決められなくなる。\nだから「必要な情報」を絞ることが、実は意思決定を速くする。\n\n問：本文と合致するものはどれ？`,
        a: "情報を絞ることが意思決定を速くする場合がある",
        ds: ["情報が多いほど必ず判断は正確になる", "選択肢を増やすほど決断は早くなる", "意思決定では直感だけが重要だ"],
        exp: "多すぎる情報が決断を遅らせる→絞ると速くなる。"
      },
    ];
    while (out.length < n) {
      const p = pick(passages);
      const q = makeMCQ({
        sub: "国語", level: "中", diff: "標準", pattern: "jpn_read_main",
        stem: p.text, answer: p.a, distractors: p.ds, exp: p.exp
      });
      pushQ(out, q);
    }
  }

  function gcd(a, b) {
    a = Math.abs(a); b = Math.abs(b);
    while (b !== 0) {
      const t = a % b;
      a = b;
      b = t;
    }
    return a || 1;
  }

  // ========= 公開API =========
  function buildAll(targetPerSub = 500) {
    const out = [];

    // 1) 固定を積む
    for (const sub of ["国語", "数学", "英語", "理科", "社会"]) {
      const fixed = (FIXED[sub] || []);
      for (const q of fixed) pushQ(out, q);
    }

    // 2) 生成で水増し（確定的に正誤が決まる範囲に寄せる）
    const bySub = (sub) => out.filter(q => q.sub === sub);

    // 数学：思考系をテンプレで増やす
    if (bySub("数学").length < targetPerSub) {
      const need = targetPerSub - bySub("数学").length;
      const buf = [];
      genMathTemplates(buf, need);
      for (const q of buf) pushQ(out, q);
    }

    // 理科：計算系を追加（安全に増やせる）
    if (bySub("理科").length < targetPerSub) {
      const need = targetPerSub - bySub("理科").length;
      const buf = [];
      genScienceCalc(buf, need);
      for (const q of buf) pushQ(out, q);
    }

    // 英語：自作穴埋め（安全）
    if (bySub("英語").length < targetPerSub) {
      const need = targetPerSub - bySub("英語").length;
      const buf = [];
      genEnglishCloze(buf, need);
      for (const q of buf) pushQ(out, q);
    }

    // 国語：自作読解（安全）
    if (bySub("国語").length < targetPerSub) {
      const need = targetPerSub - bySub("国語").length;
      const buf = [];
      genJapaneseReading(buf, need);
      for (const q of buf) pushQ(out, q);
    }

    // 社会：固有名詞・年号などの誤情報リスクが高いので、生成で無理に増やさない
    // → FIXED.社会 を増やす運用で品質を担保

    // 3) 最終検証
    const keys = new Set();
    for (const q of out) {
      if (keys.has(q.key)) throw new Error(`[bank.js] duplicate key: ${q.key}`);
      keys.add(q.key);
      const errs = validateQuestion(q);
      if (errs.length) throw new Error(`[bank.js] invalid after build: ${errs.join(", ")}`);
    }

    return out;
  }

  window.SchoolQuizBank = {
    buildAll,
    _validateQuestion: validateQuestion,
  };
})();
