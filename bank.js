/* bank.js（全文）
 * - 5教科500問規模（テンプレ生成＋固定新作）
 * - 理科/社会：固定問題を大幅増量（完全新作）
 * - 数学：証明（合同・平行線・角の性質）を選択肢式で追加
 */

(() => {
  "use strict";

  // ===== RNG =====
  function mulberry32(seed) {
    let t = seed >>> 0;
    return function () {
      t += 0x6d2b79f5;
      let r = Math.imul(t ^ (t >>> 15), 1 | t);
      r ^= r + Math.imul(r ^ (r >>> 7), 61 | r);
      return ((r ^ (r >>> 14)) >>> 0) / 4294967296;
    };
  }
  function hashSeed(str) {
    let h = 2166136261 >>> 0;
    for (let i = 0; i < str.length; i++) {
      h ^= str.charCodeAt(i);
      h = Math.imul(h, 16777619);
    }
    return h >>> 0;
  }
  function shuffle(arr, rng) {
    const a = arr.slice();
    for (let i = a.length - 1; i > 0; i--) {
      const j = Math.floor(rng() * (i + 1));
      [a[i], a[j]] = [a[j], a[i]];
    }
    return a;
  }
  function pick(arr, rng) {
    return arr[Math.floor(rng() * arr.length)];
  }
  function ri(a, b, rng) {
    return a + Math.floor(rng() * (b - a + 1));
  }
  function gcd(a, b) {
    a = Math.abs(a); b = Math.abs(b);
    while (b !== 0) [a, b] = [b, a % b];
    return a || 1;
  }
  function fracStr(n, d) {
    if (d === 0) return "定義できない";
    const g = gcd(n, d);
    n /= g; d /= g;
    if (d < 0) { n *= -1; d *= -1; }
    return `${n}/${d}`;
  }

  // ===== MCQ builder =====
  function makeMCQ({ key, sub, level, diff, pattern, q, correct, wrongs, exp }, rng) {
    const seen = new Set();
    const opts = [];
    function add(x) {
      const v = String(x);
      if (!v) return;
      if (seen.has(v)) return;
      seen.add(v);
      opts.push(v);
    }
    add(correct);
    for (const w of wrongs || []) add(w);

    const fillers = {
      国語: ["どれも当てはまらない", "文脈によって変わる", "表現として不自然"],
      数学: ["上のどれでもない", "条件が足りない", "解が存在しない"],
      英語: ["いずれでもない", "文脈による", "語順が不適切"],
      理科: ["条件によって異なる", "他の要因が必要", "変化しない"],
      社会: ["時代が違う", "地域が違う", "用語の使い方が不適切"],
    };
    while (opts.length < 4) {
      const f = fillers[sub] || ["上のどれでもない"];
      add(f[Math.floor(rng() * f.length)]);
    }

    let options = opts.slice(0, 4);
    if (!options.includes(String(correct))) options[0] = String(correct);

    for (let i = options.length - 1; i > 0; i--) {
      const j = Math.floor(rng() * (i + 1));
      [options[i], options[j]] = [options[j], options[i]];
    }
    const a = options.indexOf(String(correct));
    return { key, sub, level, diff, pattern, q, c: options, a, exp };
  }

  // ===== Difficulty distribution =====
  function diffCounts(n) {
    const b = Math.round(n * 0.2);
    const s = Math.round(n * 0.5);
    const a = Math.max(0, n - b - s);
    return { 基礎: b, 標準: s, 発展: a };
  }

  // =========================
  // 国語（前バージョン簡略：増やしたい場合は後で拡張OK）
  // =========================
  const JP_VOCAB = [
    { w: "端的", m: "要点をついて簡潔なさま", ds: ["回りくどいさま", "派手で目立つさま", "時間がかかるさま"] },
    { w: "妥当", m: "適切で筋が通っていること", ds: ["無関係であること", "無理があること", "気まぐれであること"] },
    { w: "看過", m: "見過ごすこと", ds: ["厳密に検査すること", "強く非難すること", "大切に守ること"] },
    { w: "斟酌", m: "事情をくみ取ること", ds: ["一切考えないこと", "断定すること", "言い換えること"] },
    { w: "帰結", m: "結果としてそうなること", ds: ["原因", "過程", "前提"] },
    { w: "嚆矢", m: "物事の始まり", ds: ["最終段階", "例外", "途中経過"] },
  ];

  const KOBUN_AUX = [
    { aux: "けり", m: "過去・詠嘆", ds: ["推量", "完了", "打消"] },
    { aux: "き", m: "過去（直接経験）", ds: ["伝聞", "推量", "意志"] },
    { aux: "む", m: "推量・意志・勧誘", ds: ["過去", "完了", "尊敬"] },
    { aux: "けむ", m: "過去推量（〜だったのだろう）", ds: ["現在推量", "意志", "可能"] },
    { aux: "まし", m: "反実仮想", ds: ["完了", "当然", "尊敬"] },
  ];

  const KANBUN = [
    { q: "漢文で「レ点」のはたらきとして正しいのは？", a: "直前の字の後に返って読む", ds: ["その字を読まない", "必ず音読みする", "送り仮名を削る"], exp: "レ点は返り点で、戻って読む指示。" },
    { q: "漢文で「未（いまだ）〜ず」の意味は？", a: "まだ〜ない", ds: ["すでに〜した", "必ず〜する", "〜したくない"], exp: "未だ〜ず＝まだ〜ない。" },
    { q: "漢文で「則（すなわ）ち」の意味は？", a: "つまり／そこで", ds: ["しかし", "だからこそ", "たとえば"], exp: "則ち＝順接・言い換え。" },
    { q: "漢文で「於A（Aに於いて）」の意味は？", a: "Aで／Aにおいて", ds: ["Aへ", "Aから", "Aより"], exp: "於は場所・対象などを表す。" },
  ];

  function genJapanese(rng, countByDiff) {
    const out = [];
    const vocabPool = shuffle(JP_VOCAB, rng);
    const auxPool = shuffle(KOBUN_AUX, rng);
    const kanbunPool = shuffle(KANBUN, rng);

    let v = 0, a = 0, b = 0;

    function pushVocab(diff) {
      const x = vocabPool[v++ % vocabPool.length];
      out.push(makeMCQ({
        key: `JP_vocab_${diff}_${v}`, sub: "国語", level: "中", diff, pattern: "vocab",
        q: `「${x.w}」の意味として最も適切なのは？`, correct: x.m, wrongs: x.ds,
        exp: `「${x.w}」＝${x.m}。`,
      }, rng));
    }
    function pushKobun(diff) {
      const x = auxPool[a++ % auxPool.length];
      out.push(makeMCQ({
        key: `JP_kobun_${diff}_${a}`, sub: "国語", level: "中", diff, pattern: "kobun_aux",
        q: `古文の助動詞「${x.aux}」の意味として適切なのは？`, correct: x.m, wrongs: x.ds,
        exp: `「${x.aux}」＝${x.m}。`,
      }, rng));
    }
    function pushKanbun(diff) {
      const x = kanbunPool[b++ % kanbunPool.length];
      out.push(makeMCQ({
        key: `JP_kanbun_${diff}_${b}`, sub: "国語", level: "中", diff, pattern: "kanbun",
        q: x.q, correct: x.a, wrongs: x.ds, exp: x.exp,
      }, rng));
    }

    const total = countByDiff["基礎"] + countByDiff["標準"] + countByDiff["発展"];
    for (const diff of ["基礎", "標準", "発展"]) {
      const need = countByDiff[diff];
      for (let i = 0; i < need; i++) {
        const t = (i + (diff === "発展" ? 2 : 0)) % 5;
        if (t <= 1) pushVocab(diff);
        else if (t === 2) pushKanbun(diff);
        else pushKobun(diff);
      }
    }
    return out.slice(0, total);
  }

  // =========================
  // 英語（難化）
  // =========================
  const EN_VOCAB = [
    { w: "suggest", m: "提案する／示唆する", ds: ["拒否する", "隠す", "破壊する"] },
    { w: "depend", m: "〜次第である", ds: ["必ず決まる", "関係ない", "増やす"] },
    { w: "manage", m: "なんとかやり遂げる", ds: ["失敗する", "止める", "拒否する"] },
    { w: "avoid", m: "避ける", ds: ["集める", "増やす", "続ける"] },
    { w: "require", m: "必要とする", ds: ["提供する", "減らす", "祝う"] },
    { w: "consider", m: "考慮する", ds: ["無視する", "壊す", "運ぶ"] },
    { w: "improve", m: "改善する", ds: ["悪化させる", "放置する", "分解する"] },
  ];
  const EN_GRAM = [
    { q: "This is the book (    ) I bought yesterday.", a: "that", ds: ["what", "who", "where"], exp: "関係代名詞：the book that ..." },
    { q: "English is (    ) in many countries.", a: "spoken", ds: ["speaks", "speaking", "spoke"], exp: "受動態：be + 過去分詞。" },
    { q: "Do you know (    ) she lives?", a: "where", ds: ["what", "why", "which"], exp: "間接疑問：Do you know where S V ...?" },
    { q: "I have never (    ) sushi.", a: "eaten", ds: ["ate", "eat", "eating"], exp: "現在完了：have eaten。" },
    { q: "He stopped (    ) because he was tired.", a: "running", ds: ["to run", "run", "ran"], exp: "stop ~ing＝やめる。" },
    { q: "If it (    ) tomorrow, we'll cancel the game.", a: "rains", ds: ["rain", "rained", "will rain"], exp: "条件節は現在形。" },
  ];
  function genEnglish(rng, countByDiff) {
    const out = [];
    const vpool = shuffle(EN_VOCAB, rng);
    let vi = 0;
    const total = countByDiff["基礎"] + countByDiff["標準"] + countByDiff["発展"];

    function pushV(diff) {
      const x = vpool[vi++ % vpool.length];
      out.push(makeMCQ({
        key: `EN_vocab_${diff}_${vi}`, sub:"英語", level:"中", diff, pattern:"vocab",
        q: `「${x.w}」の意味として正しいのは？`, correct:x.m, wrongs:x.ds,
        exp: `${x.w}＝${x.m}。`
      }, rng));
    }
    function pushG(diff, i) {
      const x = EN_GRAM[i % EN_GRAM.length];
      out.push(makeMCQ({
        key: `EN_gram_${diff}_${i}`, sub:"英語", level:"中", diff, pattern:"grammar",
        q: x.q, correct:x.a, wrongs:x.ds, exp:x.exp
      }, rng));
    }

    for (const diff of ["基礎","標準","発展"]) {
      const need = countByDiff[diff];
      for (let i=0;i<need;i++){
        const t = (i + (diff==="発展"?1:0)) % 3;
        if (t===0) pushV(diff);
        else pushG(diff, i);
      }
    }
    return out.slice(0,total);
  }

  // =========================
  // 数学（大幅難化 + 証明 MCQ）
  // =========================
  function genMath(rng, countByDiff) {
    const out = [];

    function numDistractors(correct, makers) {
      const w = [];
      for (const fn of makers) w.push(String(fn()));
      if (typeof correct === "number") w.push(String(correct + ri(7, 35, rng)));
      return w;
    }

    // --- 証明（選択肢式） ---
    const PROOF_BANK = [
      {
        q: "【証明】△ABCと△DEFで、AB=DE、BC=EF、∠B=∠E が与えられた。\nこのとき、2つの三角形が合同だと言える理由として正しいのは？",
        a: "二辺とその間の角（SAS）",
        ds: ["三辺（SSS）", "一辺とその両端の角（ASA）", "直角三角形の斜辺と他の一辺（HL）"],
        exp: "AB=DE、BC=EF、∠B=∠E は「二辺とその間の角」。"
      },
      {
        q: "【証明】直線l // m のとき、錯角が等しいことを用いて言えることとして正しいのは？",
        a: "錯角は等しい",
        ds: ["同位角は必ず直角", "内角の和は必ず90°", "対頂角は平行線が必要"],
        exp: "平行線の基本性質：錯角・同位角が等しい。"
      },
      {
        q: "【証明】∠1と∠2が対頂角である。結論として正しいのは？",
        a: "∠1=∠2",
        ds: ["∠1+∠2=180°", "∠1は必ず90°", "∠1=180°-∠2 は平行線が必要"],
        exp: "対頂角は常に等しい。"
      },
      {
        q: "【証明】△ABCと△A'B'C'で、∠A=∠A'、∠B=∠B'、AB=A'B'。\n合同条件として正しいのは？",
        a: "一辺とその両端の角（ASA）",
        ds: ["三辺（SSS）", "二辺とその間の角（SAS）", "二角（AA）だけで合同"],
        exp: "AB が角A・角Bの間の辺で、ASA。"
      },
      {
        q: "【証明（穴埋め）】△ABCで、AB=AC（二等辺三角形）。\nこのとき ∠B=∠C を言うために使う定理として適切なのは？",
        a: "二等辺三角形の底角は等しい",
        ds: ["三角形の内角和", "平行線の同位角", "円周角の定理"],
        exp: "二等辺三角形：等しい辺に対する角（底角）が等しい。"
      },
      {
        q: "【証明】△ABCと△ADCで、∠ABC=∠CDA、∠ACB=∠CAD が成り立つ。\nこのとき言えることとして最も適切なのは？",
        a: "△ABC ∽ △ADC",
        ds: ["△ABC ≡ △ADC", "AB=CD", "BC=AD は常に言える"],
        exp: "2組の角が等しい→相似（AA）。合同とは限らない。"
      },
      {
        q: "【証明】平行線l // m があるとき、同位角について正しいのは？",
        a: "同位角は等しい",
        ds: ["同位角の和は180°", "同位角は必ず45°", "同位角は平行でなくても等しい"],
        exp: "平行線の性質：同位角は等しい。"
      },
      {
        q: "【証明（合同）】直角三角形△ABCと△DEFで、∠C=∠F=90°、AB=DE、BC=EF。\n合同条件として最も適切なのは？",
        a: "直角三角形の斜辺と他の一辺（HL）",
        ds: ["二辺とその間の角（SAS）", "三辺（SSS）", "一辺とその両端の角（ASA）"],
        exp: "直角＋斜辺＋他の一辺→HL。"
      },
    ];

    function pushProof(diff, i) {
      const x = PROOF_BANK[i % PROOF_BANK.length];
      out.push(makeMCQ({
        key:`MA_proof_${diff}_${i}`,
        sub:"数学", level:"中", diff, pattern:"proof",
        q:x.q, correct:x.a, wrongs:x.ds, exp:x.exp
      }, rng));
    }

    // --- 基礎（でも薄すぎない） ---
    for (let i = 0; i < countByDiff["基礎"]; i++) {
      const t = i % 5;
      if (t === 0) {
        const a = ri(20, 120, rng), b = ri(2, 15, rng);
        const op = pick(["+", "-", "×", "÷"], rng);
        let correct;
        if (op === "+") correct = a + b;
        if (op === "-") correct = a - b;
        if (op === "×") correct = a * b;
        if (op === "÷") correct = (a - (a % b)) / b;
        out.push(makeMCQ({
          key: `MA_basic_calc_${op}_${a}_${b}_${i}`,
          sub:"数学", level:"小", diff:"基礎", pattern:"calc",
          q: `${a} ${op} ${b} の答えは？`,
          correct: String(correct),
          wrongs: numDistractors(correct,[()=>correct+1,()=>correct-1,()=>correct+b,()=>correct-b]),
          exp: `計算して ${correct}。`
        }, rng));
      } else if (t === 1) {
        const base = ri(200, 900, rng);
        const pct = pick([12, 15, 20, 25, 30, 40], rng);
        const correct = Math.round(base * pct / 100);
        out.push(makeMCQ({
          key:`MA_basic_pct_${base}_${pct}_${i}`,
          sub:"数学", level:"小", diff:"基礎", pattern:"percent",
          q:`${base} の ${pct}% は？`,
          correct:String(correct),
          wrongs:[String(pct),String(base+pct),String(correct+ri(5,25,rng)),String(base-correct)],
          exp:`${base}×${pct}/100=${correct}。`
        }, rng));
      } else if (t === 2) {
        const n = ri(1, 9, rng), d = pick([2,3,4,5,6,8,10], rng);
        const n2 = ri(1, 9, rng), d2 = pick([2,3,4,5,6,8,10], rng);
        const num = n * d2 + n2 * d;
        const den = d * d2;
        const correct = fracStr(num, den);
        out.push(makeMCQ({
          key:`MA_basic_frac_${n}_${d}_${n2}_${d2}_${i}`,
          sub:"数学", level:"中", diff:"基礎", pattern:"fraction",
          q:`${n}/${d} + ${n2}/${d2} を最も簡単な分数で表すと？`,
          correct,
          wrongs:[`${num}/${den}`, fracStr(num+1,den), fracStr(num,den+1), fracStr(n+n2,d+d2)],
          exp:`通分して ${num}/${den} → 約分して ${correct}。`
        }, rng));
      } else if (t === 3) {
        const a = ri(30, 110, rng), b = ri(20, 100, rng);
        const correct = 180 - (a + b);
        out.push(makeMCQ({
          key:`MA_basic_angle_${a}_${b}_${i}`,
          sub:"数学", level:"中", diff:"基礎", pattern:"angle",
          q:`三角形の内角が ${a}° と ${b}° のとき、残りの角は？`,
          correct:String(correct),
          wrongs:[String(180-a),String(180-b),String(a+b),String(correct+10)],
          exp:`内角和180°→180-(${a}+${b})=${correct}。`
        }, rng));
      } else {
        // 図形：円周角（基礎寄り）
        const center = pick([60, 80, 100, 120, 140], rng);
        out.push(makeMCQ({
          key:`MA_basic_circle_${center}_${i}`,
          sub:"数学", level:"中", diff:"基礎", pattern:"geometry_circle",
          q:`同じ弧に対する円周角は中心角の何分のいくつ？（中心角${center}°のとき円周角は？）`,
          correct:String(center/2),
          wrongs:[String(center),String(center*2),String(180-center),String(center/2+10)],
          exp:`円周角＝中心角の1/2 → ${center/2}°。`
        }, rng));
      }
    }

    // --- 標準（図形/関数/連立/確率） ---
    for (let i = 0; i < countByDiff["標準"]; i++) {
      const t = i % 9;
      if (t === 0) {
        const x = ri(1, 18, rng), m = ri(2, 9, rng), k = ri(1, 30, rng);
        const rhs = m * x + k;
        out.push(makeMCQ({
          key:`MA_std_eq_${m}_${k}_${rhs}_${i}`,
          sub:"数学", level:"中", diff:"標準", pattern:"equation",
          q:`方程式：${m}x + ${k} = ${rhs} の解 x は？`,
          correct:String(x),
          wrongs:[String((rhs+k)/m),String((rhs-k)*m),String(x+1),String(x-1)],
          exp:`${m}x=${rhs}-${k}=${m*x}→x=${x}。`
        }, rng));
      } else if (t === 1) {
        const x = ri(1, 9, rng), y = ri(1, 9, rng);
        const A = 3*x + 2*y, B = x - y;
        out.push(makeMCQ({
          key:`MA_std_system_${A}_${B}_${i}`,
          sub:"数学", level:"中", diff:"標準", pattern:"system",
          q:`連立：3x+2y=${A}, x-y=${B} の (x,y) は？`,
          correct:`(${x},${y})`,
          wrongs:[`(${y},${x})`,`(${x+1},${y})`,`(${x},${y+1})`],
          exp:`x=y+${B} を代入して解く。`
        }, rng));
      } else if (t === 2) {
        const a = pick([2,3,4,-2,-3], rng), x = ri(1, 6, rng);
        const y = a*x;
        out.push(makeMCQ({
          key:`MA_std_func_${a}_${x}_${i}`,
          sub:"数学", level:"中", diff:"標準", pattern:"function",
          q:`y=${a}x のとき x=${x} の y は？`,
          correct:String(y),
          wrongs:[String(a+x),String(a-x),String(-y),String(y+ri(1,5,rng))],
          exp:`代入：y=${a}×${x}=${y}。`
        }, rng));
      } else if (t === 3) {
        // 三平方
        const A = pick([3,5,6,8], rng);
        const B = pick([4,12,8,15], rng);
        const C = Math.sqrt(A*A + B*B);
        out.push(makeMCQ({
          key:`MA_std_pyth_${A}_${B}_${i}`,
          sub:"数学", level:"中", diff:"標準", pattern:"pythagoras",
          q:`直角三角形で、直角をはさむ2辺が ${A}, ${B} のとき斜辺は？`,
          correct:String(C),
          wrongs:[String(A+B),String(Math.abs(A-B)),String(A*A+B*B),String(C+1)],
          exp:`c^2=a^2+b^2 → c=√(${A*A}+${B*B})=${C}。`
        }, rng));
      } else if (t === 4) {
        // 確率：戻さない
        const red = ri(3, 7, rng), blue = ri(3, 7, rng);
        const total = red+blue;
        const num = red*(red-1);
        const den = total*(total-1);
        out.push(makeMCQ({
          key:`MA_std_prob_${red}_${blue}_${i}`,
          sub:"数学", level:"中", diff:"標準", pattern:"probability",
          q:`赤${red}個・青${blue}個から戻さず2回。2回とも赤の確率は？`,
          correct:fracStr(num,den),
          wrongs:[fracStr(red,total),fracStr(red*red,total*total),fracStr(red-1,total-1),fracStr(num+1,den)],
          exp:`(red/total)×((red-1)/(total-1))。`
        }, rng));
      } else if (t === 5) {
        // 相似：面積比
        const k = pick([2,3,4], rng);
        out.push(makeMCQ({
          key:`MA_std_sim_${k}_${i}`,
          sub:"数学", level:"中", diff:"標準", pattern:"similarity",
          q:`相似な図形で、辺の比が 1:${k} のとき面積比は？`,
          correct:`1:${k*k}`,
          wrongs:[`1:${k}`,`1:${k+1}`,`1:${k*k+1}`],
          exp:"面積比は辺比の2乗。"
        }, rng));
      } else if (t === 6) {
        // 証明（標準から混ぜる）
        pushProof("標準", i);
      } else if (t === 7) {
        // 円：接線
        out.push(makeMCQ({
          key:`MA_std_tangent_${i}`,
          sub:"数学", level:"中", diff:"標準", pattern:"geometry_circle",
          q:"円の接線と、その接点における半径の関係は？",
          correct:"垂直（直角）",
          wrongs:["平行","必ず等しい","45°"],
          exp:"接線は接点で半径に垂直。"
        }, rng));
      } else {
        // データ：中央値
        const arr = [ri(1,9,rng),ri(1,9,rng),ri(1,9,rng),ri(1,9,rng),ri(1,9,rng)].sort((x,y)=>x-y);
        out.push(makeMCQ({
          key:`MA_std_median_${arr.join("_")}_${i}`,
          sub:"数学", level:"中", diff:"標準", pattern:"stats",
          q:`5つの数 ${arr.join(",")} の中央値は？`,
          correct:String(arr[2]),
          wrongs:[String(arr[0]),String(arr[4]),String(Math.round((arr[0]+arr[4])/2)),String(arr[2]+1)],
          exp:"小さい順に並べて真ん中（3番目）。"
        }, rng));
      }
    }

    // --- 発展（証明比率を上げる） ---
    for (let i = 0; i < countByDiff["発展"]; i++) {
      const t = i % 7;
      if (t <= 2) {
        pushProof("発展", i + 20);
      } else if (t === 3) {
        // 二次
        const r1 = ri(1, 7, rng), r2 = ri(1, 7, rng);
        const b = -(r1+r2), c = r1*r2;
        out.push(makeMCQ({
          key:`MA_adv_quad_${b}_${c}_${i}`,
          sub:"数学", level:"中", diff:"発展", pattern:"quadratic",
          q:`方程式：x^2 ${b>=0?"+":""}${b}x + ${c}=0 の解は？`,
          correct:`${r1} と ${r2}`,
          wrongs:[`${-r1} と ${-r2}`,`${r1+r2} と ${c}`,`${c} と ${b}`],
          exp:`(x-${r1})(x-${r2})=0。`
        }, rng));
      } else if (t === 4) {
        // 追いつき
        const v1 = ri(3,8,rng);
        const v2 = v1 + ri(2,6,rng);
        const head = ri(1,6,rng);
        const tHr = head / (v2 - v1);
        out.push(makeMCQ({
          key:`MA_adv_chase_${v1}_${v2}_${head}_${i}`,
          sub:"数学", level:"中", diff:"発展", pattern:"word",
          q:`Aが時速${v1}kmで出発。${head}km後にBが時速${v2}kmで追う。追いつくまで何時間？`,
          correct:String(tHr),
          wrongs:[String(head/v2),String(head/v1),String((v2-v1)/head),String(tHr+1)],
          exp:`差は${v2-v1}km/h。時間=距離/差=${head}/${v2-v1}=${tHr}。`
        }, rng));
      } else if (t === 5) {
        // 不等式
        const a = ri(2, 6, rng), b = ri(1, 10, rng), x = ri(2, 9, rng);
        const rhs = a*x + b;
        out.push(makeMCQ({
          key:`MA_adv_ineq_${a}_${b}_${rhs}_${i}`,
          sub:"数学", level:"中", diff:"発展", pattern:"inequality",
          q:`${a}x + ${b} < ${rhs} を満たす整数xの最大は？`,
          correct:String(x-1),
          wrongs:[String(x),String(x-2),String(x+1)],
          exp:`x<${x} → 最大は${x-1}。`
        }, rng));
      } else {
        // 場合の数
        const n = pick([5,6,7], rng);
        const fact = (k)=> (k<=1?1:k*fact(k-1));
        const ans = fact(n);
        out.push(makeMCQ({
          key:`MA_adv_perm_${n}_${i}`,
          sub:"数学", level:"中", diff:"発展", pattern:"counting",
          q:`${n}人を一列に並べる並べ方は何通り？`,
          correct:String(ans),
          wrongs:[String(ans/n),String(n*n),String(ans*n),String(n+ans)],
          exp:`${n}! 通り。`
        }, rng));
      }
    }

    return out;
  }

  // =========================
  // 理科：固定新作を増量（完全新作）
  // =========================
  const SCI_FIXED = [
    // 物理・計算
    { diff:"標準", level:"中", pattern:"calc_density", q:"質量120g、体積30cm³の物体の密度は？", a:"4", ds:["0.25","90","150"], exp:"密度=質量/体積=120/30=4。" },
    { diff:"標準", level:"中", pattern:"calc_ohm", q:"電流2A、抵抗6Ωの電圧は？", a:"12", ds:["3","8","16"], exp:"V=IR=2×6=12。" },
    { diff:"発展", level:"中", pattern:"calc_power", q:"電圧9V、電流0.5Aの電力は？", a:"4.5", ds:["18","9.5","0.45"], exp:"P=VI=9×0.5=4.5W。" },
    { diff:"標準", level:"中", pattern:"calc_speed", q:"150mを25秒で走る速さは？（m/s）", a:"6", ds:["3.75","25/150","7"], exp:"速さ=150/25=6。" },
    { diff:"発展", level:"中", pattern:"calc_work", q:"力10Nで物体を3m動かした。仕事は？", a:"30", ds:["13","7","300"], exp:"仕事=力×距離=10×3=30J。" },

    // 実験・データ
    { diff:"標準", level:"中", pattern:"experiment", q:"実験で、1つの条件だけを変えて結果を比べる理由は？", a:"原因と結果の関係を明確にするため", ds:["見た目をよくするため","必ず成功するため","時間を短くするため"], exp:"変数を1つにして因果を見やすくする。" },
    { diff:"標準", level:"中", pattern:"graph", q:"横軸を時間、縦軸を温度にした折れ線グラフで、傾きが大きい区間は何を表す？", a:"温度変化が速い", ds:["温度が低い","時間が短い","必ず沸騰している"], exp:"傾き＝単位時間あたりの変化量。" },
    { diff:"発展", level:"中", pattern:"experiment", q:"同じ実験を複数回行い平均をとる主な目的は？", a:"偶然のばらつきを小さくするため", ds:["結果を変えるため","条件を増やすため","必ず最大値を得るため"], exp:"誤差・偶然の影響を減らす。" },

    // 化学
    { diff:"基礎", level:"中", pattern:"chem", q:"酸性の水溶液を青色リトマス紙につけると？", a:"赤色になる", ds:["青のまま","緑になる","必ず破れる"], exp:"酸性で青→赤。" },
    { diff:"標準", level:"中", pattern:"chem", q:"中和でできる物質として一般に正しい組み合わせは？", a:"塩と水", ds:["酸と水","アルカリと塩","金属と酸素"], exp:"酸＋アルカリ→塩＋水（一般）。" },
    { diff:"発展", level:"中", pattern:"chem", q:"水の電気分解で、気体の発生量（体積比）として正しいのは？", a:"水素：酸素=2：1", ds:["1：2","1：1","2：2"], exp:"反応式 2H2O→2H2+O2。" },

    // 生物
    { diff:"基礎", level:"小", pattern:"bio", q:"植物が光を利用して養分をつくるはたらきは？", a:"光合成", ds:["呼吸","消化","分解"], exp:"光合成で養分をつくる。" },
    { diff:"標準", level:"中", pattern:"bio", q:"食物連鎖で、植物を食べる動物は一般に？", a:"一次消費者", ds:["生産者","分解者","二次消費者"], exp:"植物（生産者）→草食（一次）。" },
    { diff:"発展", level:"中", pattern:"bio", q:"遺伝で、形質を決める情報をもつ単位は？", a:"遺伝子", ds:["細胞壁","血しょう","葉緑体"], exp:"遺伝子が情報をもつ。" },

    // 地学
    { diff:"基礎", level:"小", pattern:"earth", q:"地球の自転によって起こる現象は？", a:"昼と夜", ds:["季節","月の満ち欠け","潮の満ち引き"], exp:"季節は公転＋地軸の傾き。" },
    { diff:"標準", level:"中", pattern:"earth", q:"月が満ち欠けして見える主な理由は？", a:"太陽光の当たる部分の見え方が変わる", ds:["月が自ら光る","地球が光る","月の大きさが変わる"], exp:"照らされる部分の見え方の違い。" },
    { diff:"発展", level:"中", pattern:"geo", q:"火山灰などが固まってできる岩石は？", a:"凝灰岩", ds:["花こう岩","石灰岩","大理石"], exp:"凝灰岩は火山灰が固結。" },
  ];

  function genScience(rng, countByDiff) {
    const out = [];
    const fixedAll = shuffle(SCI_FIXED, rng).map((x, i) =>
      makeMCQ({
        key:`SC_fixed_${x.diff}_${x.pattern}_${i}`,
        sub:"理科", level:x.level, diff:x.diff, pattern:x.pattern,
        q:x.q, correct:x.a, wrongs:x.ds, exp:x.exp
      }, rng)
    );

    function pushTemplate(diff, i) {
      const t = i % 8;
      if (t === 0) {
        const m = ri(60, 240, rng);
        const v = ri(10, 60, rng);
        out.push(makeMCQ({
          key:`SC_t_density_${diff}_${i}`, sub:"理科", level:"中", diff, pattern:"calc_density",
          q:`質量${m}g、体積${v}cm³の密度は？`,
          correct:String(m/v),
          wrongs:[String(v/m),String(m*v),String(m/v+1)],
          exp:`密度=質量/体積=${m}/${v}=${m/v}。`
        }, rng));
      } else if (t === 1) {
        const I = ri(1, 5, rng), R = ri(2, 12, rng);
        out.push(makeMCQ({
          key:`SC_t_ohm_${diff}_${i}`, sub:"理科", level:"中", diff, pattern:"calc_ohm",
          q:`電流${I}A、抵抗${R}Ωの電圧は？`,
          correct:String(I*R),
          wrongs:[String(I+R),String(I/R),String(I*R+2)],
          exp:`V=IR=${I}×${R}=${I*R}。`
        }, rng));
      } else if (t === 2) {
        const V = ri(3, 18, rng), I = ri(1, 6, rng);
        out.push(makeMCQ({
          key:`SC_t_power_${diff}_${i}`, sub:"理科", level:"中", diff, pattern:"calc_power",
          q:`電圧${V}V、電流${I}Aの電力は？`,
          correct:String(V*I),
          wrongs:[String(V+I),String(V/I),String(V*I+5)],
          exp:`P=VI=${V}×${I}=${V*I}W。`
        }, rng));
      } else if (t === 3) {
        out.push(makeMCQ({
          key:`SC_t_neutral_${diff}_${i}`, sub:"理科", level:"中", diff, pattern:"chem",
          q:"酸性とアルカリ性を混ぜて性質が打ち消し合う反応は？",
          correct:"中和",
          wrongs:["燃焼","酸化","分解"],
          exp:"酸とアルカリが互いの性質を打ち消す。"
        }, rng));
      } else if (t === 4) {
        out.push(makeMCQ({
          key:`SC_t_graph_${diff}_${i}`, sub:"理科", level:"中", diff, pattern:"graph",
          q:"折れ線グラフで、傾きが0の区間が表すのは？",
          correct:"値が変化していない",
          wrongs:["値が急増している","値が急減している","必ず誤差"],
          exp:"傾き0＝変化なし。"
        }, rng));
      } else if (t === 5) {
        out.push(makeMCQ({
          key:`SC_t_bio_${diff}_${i}`, sub:"理科", level: diff==="基礎" ? "小":"中", diff, pattern:"bio",
          q:"生態系で分解者として適切なのは？",
          correct:"菌類や細菌",
          wrongs:["植物","草食動物","肉食動物"],
          exp:"分解者は有機物を無機物に分解する。"
        }, rng));
      } else if (t === 6) {
        out.push(makeMCQ({
          key:`SC_t_earth_${diff}_${i}`, sub:"理科", level:"中", diff, pattern:"earth",
          q:"季節が生じる主な理由として最も適切なのは？",
          correct:"地球の公転と地軸の傾き",
          wrongs:["地球の自転だけ","月の公転","太陽が動くから"],
          exp:"公転＋地軸の傾きで日照角が変わる。"
        }, rng));
      } else {
        out.push(makeMCQ({
          key:`SC_t_exp_${diff}_${i}`, sub:"理科", level:"中", diff, pattern:"experiment",
          q:"実験で、比較のために変えない条件を何という？",
          correct:"統一条件（一定にする条件）",
          wrongs:["操作変数","結果（従属）変数","仮説"],
          exp:"変えない条件をそろえて公平な比較をする。"
        }, rng));
      }
    }

    const total = countByDiff["基礎"] + countByDiff["標準"] + countByDiff["発展"];
    const fixedByDiff = { 基礎: [], 標準: [], 発展: [] };
    for (const q of fixedAll) fixedByDiff[q.diff].push(q);

    for (const diff of ["基礎","標準","発展"]) {
      const need = countByDiff[diff];
      const take = fixedByDiff[diff].slice(0, Math.min(need, fixedByDiff[diff].length));
      out.push(...take);
      let remain = need - take.length;
      for (let i=0;i<remain;i++) pushTemplate(diff, i + out.length);
    }

    return out.slice(0, total);
  }

  // =========================
  // 社会：固定新作を増量（完全新作）
  // =========================
  const SOC_FIXED = [
    // 歴史（細かめ）
    { diff:"基礎", level:"小", pattern:"history", q:"鎌倉幕府を開いた人物は？", a:"源頼朝", ds:["徳川家康","足利尊氏","豊臣秀吉"], exp:"1192（諸説あり）頃、源頼朝。" },
    { diff:"標準", level:"中", pattern:"history", q:"大化の改新で中心となった改革として適切なのは？", a:"公地公民", ds:["鎖国","班田収授","武家諸法度"], exp:"土地と人民を国家のものとする方針。" },
    { diff:"発展", level:"中", pattern:"history", q:"明治初期の地租改正の特徴として適切なのは？", a:"地価を基準に現金で納める", ds:["米で納める","年齢で税が決まる","税が完全に無くなる"], exp:"地価を基準に現金納税へ。" },
    { diff:"標準", level:"中", pattern:"history", q:"江戸幕府が大名を統制する制度は？", a:"参勤交代", ds:["墾田永年私財法","班田収授法","地租改正"], exp:"江戸と領地を交代で。" },
    { diff:"発展", level:"中", pattern:"history", q:"室町時代の土一揆が求めたものとして多いのは？", a:"徳政令", ds:["鎖国","征夷大将軍","廃藩置県"], exp:"借金帳消し（徳政）要求。" },

    // 地理（難化）
    { diff:"基礎", level:"小", pattern:"geo", q:"等高線が密なところの地形は？", a:"傾斜が急", ds:["傾斜が緩","必ず平地","必ず海面下"], exp:"詰むほど急。" },
    { diff:"標準", level:"中", pattern:"geo", q:"黒潮（日本海流）の特徴は？", a:"暖流で太平洋側を北上する", ds:["寒流で南下","暖流で日本海側を南下","寒流で日本海側を北上"], exp:"黒潮＝暖流。" },
    { diff:"標準", level:"中", pattern:"geo", q:"親潮（千島海流）の特徴は？", a:"寒流で太平洋側を南下する", ds:["暖流で北上","寒流で日本海側を北上","暖流で日本海側を南下"], exp:"親潮＝寒流。" },
    { diff:"発展", level:"中", pattern:"geo", q:"経度が15°東へ移動すると、時刻は一般に？", a:"1時間進む", ds:["1時間戻る","15時間進む","変化しない"], exp:"360°/24h=15°/h。" },
    { diff:"発展", level:"中", pattern:"geo", q:"冬に日本海側で雪が多くなる主因は？", a:"季節風が日本海で水蒸気を含む", ds:["偏西風が消える","黒潮が止まる","海抜が低い"], exp:"季節風＋日本海→雪。" },

    // 公民（増量）
    { diff:"基礎", level:"小", pattern:"civics", q:"日本の国会は何から成る？", a:"衆議院と参議院", ds:["内閣と裁判所","都道府県と市町村","総理と大臣"], exp:"国会は二院制。" },
    { diff:"標準", level:"中", pattern:"civics", q:"裁判所が法律等が憲法に反するか判断する権限は？", a:"違憲審査権", ds:["条例制定権","予算編成権","行政指導権"], exp:"司法のチェック機能。" },
    { diff:"標準", level:"中", pattern:"civics", q:"三権分立に含まれないのは？", a:"報道", ds:["立法","行政","司法"], exp:"三権は立法・行政・司法。" },
    { diff:"発展", level:"中", pattern:"civics", q:"地方自治の二つの原則として正しい組は？", a:"住民自治と団体自治", ds:["王政と共和制","中央集権と封建制","議院内閣制と三権分立"], exp:"地方自治の基本は住民自治・団体自治。" },
    { diff:"発展", level:"中", pattern:"economy", q:"円高になると一般に起こりやすいのは？", a:"輸入品が安くなる", ds:["輸入品が高くなる","海外旅行が高くなる","外国通貨が安くなる"], exp:"円の価値↑で輸入が有利。" },
  ];

  function genSocial(rng, countByDiff) {
    const out = [];
    const fixedAll = shuffle(SOC_FIXED, rng).map((x, i) =>
      makeMCQ({
        key:`SO_fixed_${x.diff}_${x.pattern}_${i}`,
        sub:"社会", level:x.level, diff:x.diff, pattern:x.pattern,
        q:x.q, correct:x.a, wrongs:x.ds, exp:x.exp
      }, rng)
    );

    const histTpl = [
      { q:"律令国家の基本法として整えられたものは？", a:"大宝律令", ds:["武家諸法度","明治憲法","十七条の憲法"], exp:"律令政治の骨格。", diff:"発展" },
      { q:"第一次世界大戦後、国際協調を目指して成立した組織は？", a:"国際連盟", ds:["国際連合","EU","ASEAN"], exp:"戦間期の国際秩序。", diff:"標準" },
      { q:"江戸時代の身分制度で、武士の次に位置づけられたのは？", a:"農民", ds:["商人","職人","公家"], exp:"士農工商（※教科書的整理）。", diff:"標準" },
    ];
    const geoTpl = [
      { q:"工業立地で原料費の比重が大きい工業が集まりやすいのは？", a:"臨海部（港の近く）", ds:["山頂","砂漠","人口ゼロ地帯"], exp:"輸送費低下のため。", diff:"発展" },
      { q:"熱帯の気候の特徴として一般に正しいのは？", a:"高温で降水量が多い", ds:["低温で乾燥","四季の寒暖差が大きい","一年中雪が多い"], exp:"熱帯は高温多雨。", diff:"基礎" },
    ];
    const civTpl = [
      { q:"行政権を担うのは？", a:"内閣", ds:["国会","最高裁判所","地方議会"], exp:"行政＝内閣。", diff:"標準" },
      { q:"選挙で一人の有権者が持つ票の数は基本的に？", a:"1票", ds:["2票","年齢に比例","税額に比例"], exp:"普通選挙＝基本1人1票。", diff:"基礎" },
      { q:"日本銀行の金融政策の目的として適切なのは？", a:"物価の安定など", ds:["法律の制定","外交交渉","教育課程の作成"], exp:"金利・通貨量などで調整。", diff:"発展" },
    ];

    function pushTemplate(diff, i) {
      const t = i % 9;
      if (t <= 3) {
        const x = pick(histTpl, rng);
        out.push(makeMCQ({
          key:`SO_t_hist_${diff}_${i}`, sub:"社会", level: diff==="基礎"?"小":"中", diff, pattern:"history",
          q:x.q, correct:x.a, wrongs:x.ds, exp:x.exp
        }, rng));
      } else if (t <= 6) {
        const x = pick(geoTpl, rng);
        out.push(makeMCQ({
          key:`SO_t_geo_${diff}_${i}`, sub:"社会", level: diff==="基礎"?"小":"中", diff, pattern:"geo",
          q:x.q, correct:x.a, wrongs:x.ds, exp:x.exp
        }, rng));
      } else {
        const x = pick(civTpl, rng);
        out.push(makeMCQ({
          key:`SO_t_civ_${diff}_${i}`, sub:"社会", level: diff==="基礎"?"小":"中", diff, pattern:"civics",
          q:x.q, correct:x.a, wrongs:x.ds, exp:x.exp
        }, rng));
      }
    }

    const total = countByDiff["基礎"] + countByDiff["標準"] + countByDiff["発展"];
    const fixedByDiff = { 基礎: [], 標準: [], 発展: [] };
    for (const q of fixedAll) fixedByDiff[q.diff].push(q);

    for (const diff of ["基礎","標準","発展"]) {
      const need = countByDiff[diff];
      const take = fixedByDiff[diff].slice(0, Math.min(need, fixedByDiff[diff].length));
      out.push(...take);
      let remain = need - take.length;
      for (let i=0;i<remain;i++) pushTemplate(diff, i + out.length);
    }

    return out.slice(0, total);
  }

  // =========================
  // buildAll（500/教科）
  // =========================
  function buildSubject(subject, n, rng) {
    const counts = diffCounts(n);
    if (subject === "国語") return genJapanese(rng, counts);
    if (subject === "数学") return genMath(rng, counts);
    if (subject === "英語") return genEnglish(rng, counts);
    if (subject === "理科") return genScience(rng, counts);
    if (subject === "社会") return genSocial(rng, counts);
    return [];
  }

  const SchoolQuizBank = {
    buildAll(perSubjectCount = 500) {
      const seed = hashSeed(`bank-${Date.now()}-${Math.random().toString(16).slice(2)}`);
      const rng = mulberry32(seed);

      const subjects = ["国語","数学","英語","理科","社会"];
      let all = [];
      for (const sub of subjects) all = all.concat(buildSubject(sub, perSubjectCount, rng));

      // key重複除去
      const seen = new Set();
      const uniq = [];
      for (const q of all) {
        const k = String(q.key || "");
        if (!k || seen.has(k)) continue;
        seen.add(k);
        uniq.push(q);
      }
      return shuffle(uniq, rng);
    },
  };

  window.SchoolQuizBank = SchoolQuizBank;
})();
