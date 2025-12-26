/* bank.js
  - 教科ごとに最低100問以上を保証（固定 + 安全テンプレ生成）
  - 不適切な選択肢（"-" / メタ文言 / 空 / 重複）は validateQuestion で除外
  - pattern は内部コードのまま（表示の日本語化は app.js 側で対応）
*/

(function () {
  "use strict";

  const SUBJECTS = ["国語", "数学", "英語", "理科", "社会"];
  const GRADES = ["小", "中"];
  const DIFFS = ["基礎", "標準", "発展"];

  // ここを「100」にしておけば、各教科100以上になるまで自動で補充します
  const MIN_PER_SUBJECT = 110; // 余裕持たせ（フィルタで弾かれても不足しづらい）

  /* =========================
   * 共通ユーティリティ（決定的＝毎回同じ生成）
   * ========================= */
  const pick = (arr, i) => arr[i % arr.length];
  const uniq = (arr) => {
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
  };
  const toKey = (q, i) =>
    q.key || `${q.sub}|${q.level}|${q.diff}|${q.pattern || "p"}|${(q.q || "").slice(0, 30)}|${i}`;

  function isBadChoiceText(s) {
    const t = String(s ?? "").trim();
    if (!t) return true;
    if (t === "-" || t === "—" || t === "–") return true;

    // メタ文言（クイズの選択肢として成立しない）
    const banned = [
      "用語の使い方が不適切",
      "時代が違う",
      "地域が違う",
      "不明",
      "わからない",
      "どれでもない",
      "上のいずれでもない",
    ];
    if (banned.includes(t)) return true;

    return false;
  }

  function validateQuestion(q) {
    if (!q) return false;
    if (!SUBJECTS.includes(q.sub)) return false;
    if (!GRADES.includes(q.level)) return false;
    if (!DIFFS.includes(q.diff)) return false;
    if (typeof q.q !== "string" || !q.q.trim()) return false;
    if (!Array.isArray(q.c) || q.c.length !== 4) return false;
    if (typeof q.a !== "number" || q.a < 0 || q.a > 3) return false;

    const choices = q.c.map((x) => String(x ?? "").trim());
    if (choices.some(isBadChoiceText)) return false;

    const set = new Set(choices);
    if (set.size !== 4) return false;

    if (isBadChoiceText(choices[q.a])) return false;
    return true;
  }

  function force4Choices(correct, wrongs, i) {
    // wrongs は“筋が通る誤答候補”の配列（十分にある前提）
    const w1 = pick(wrongs, i);
    const w2 = pick(wrongs, i + 1);
    const w3 = pick(wrongs, i + 2);
    const c = uniq([correct, w1, w2, w3]).slice(0, 4);

    // 4未満なら追加（安全な範囲で）
    while (c.length < 4) c.push(pick(wrongs, i + 10 + c.length));

    // 正解を先頭に固定（採点が単純・検証しやすい）
    const idx = c.indexOf(correct);
    if (idx > 0) [c[0], c[idx]] = [c[idx], c[0]];
    return { c, a: 0 };
  }

  /* =========================
   * 固定問題（例：ここは増やしやすいように“パック”化）
   *  - まずは最低限の固定を入れて、足りない分は安全テンプレで補充
   * ========================= */
  const FIXED = {
    国語: [
      { level:"中", diff:"標準", pattern:"vocab",
        q:"「一目瞭然」の意味として最も近いものは？",
        c:["見ただけではっきり分かる","一度見ても覚えられない","目で見るのが難しい","見ない方がよい"], a:0,
        exp:"一目で明らか、という意味。"
      },
      { level:"中", diff:"標準", pattern:"kobun",
        q:"古文の助動詞「けり」が表す意味として代表的なのは？",
        c:["過去・詠嘆","推量","打消","完了"], a:0,
        exp:"「けり」は過去の回想や詠嘆を表すことが多い。"
      },
      { level:"中", diff:"発展", pattern:"kanbun",
        q:"漢文の返り点「レ点」は何を示す？",
        c:["その字を後から読む","同じ字を二度読む","その字を読まない","下から順に読む"], a:0,
        exp:"一字下を先に読み、その後でレ点の字を読む。"
      },
      { level:"小", diff:"標準", pattern:"vocab",
        q:"「反対（はんたい）」の意味は？",
        c:["向かい合って逆であること","同じ方向で進むこと","ゆっくり進むこと","遠くに行くこと"], a:0,
        exp:"反対＝逆・反対向き。"
      },
      { level:"中", diff:"標準", pattern:"reading",
        q:"文章で筆者が述べる「主張」として最も適切なのはどれ？（一般に、理由→結論の形で示される）",
        c:["理由を踏まえた結論部分","具体例の部分","導入のあいさつ部分","筆者の経歴部分"], a:0,
        exp:"主張は、理由を踏まえた結論部分に現れやすい。"
      },
    ],
    数学: [
      { level:"中", diff:"標準", pattern:"function",
        q:"一次関数 y = 2x + 1 の y切片は？",
        c:["1","2","-1","0"], a:0, exp:"x=0のときy=1。"
      },
      { level:"中", diff:"標準", pattern:"geometry",
        q:"直角三角形で、斜辺が5、他の一辺が3のとき、残りの一辺は？",
        c:["4","2","8","√34"], a:0, exp:"三平方：25=9+□^2→□=4。"
      },
      { level:"中", diff:"発展", pattern:"proof",
        q:"証明：AB=ACのとき∠B=∠C。根拠として正しいのは？",
        c:["二等辺三角形の性質（底角は等しい）","円周角の定理","平行線の錯角が等しい","対頂角が等しい"], a:0,
        exp:"AB=ACなら底角が等しい。"
      },
      { level:"小", diff:"標準", pattern:"calc",
        q:"3/4L のジュースが 2本あります。合わせて何L？",
        c:["1と1/2L","1と1/4L","1と3/4L","3/4L"], a:0,
        exp:"3/4+3/4=6/4=1と2/4=1と1/2。"
      },
      { level:"中", diff:"標準", pattern:"function",
        q:"y = -3x + 6 で x=2 のとき y は？",
        c:["0","12","-12","3"], a:0,
        exp:"y=-3×2+6=0。"
      },
    ],
    英語: [
      { level:"中", diff:"標準", pattern:"grammar",
        q:"(　) に入る最も適切な語は？ I (   ) to school every day.",
        c:["go","goes","went","going"], a:0,
        exp:"主語Iは三単現ではないので go。"
      },
      { level:"中", diff:"標準", pattern:"grammar",
        q:"次の文の(　)に入る語は？ She (   ) tennis on Sundays.",
        c:["plays","play","played","playing"], a:0,
        exp:"三単現：She plays。"
      },
      { level:"中", diff:"標準", pattern:"grammar",
        q:"次の文の(　)に入る語は？ I am (   ) than Ken.",
        c:["taller","tall","tallest","more tall"], a:0,
        exp:"比較級：taller。"
      },
      { level:"中", diff:"発展", pattern:"reading",
        q:"英文：\"Tom was tired, so he went to bed early.\" 下線部 so の意味は？",
        c:["だから","しかし","もし","そして"], a:0,
        exp:"so＝だから（原因→結果）。"
      },
      { level:"小", diff:"基礎", pattern:"grammar",
        q:"(　)に入る語は？ This is (   ) pen.",
        c:["a","an","the","to"], a:0,
        exp:"子音で始まる単数名詞の前：a。"
      },
    ],
    理科: [
      { level:"中", diff:"標準", pattern:"experiment",
        q:"光合成でデンプンができたことを確かめるため、ヨウ素液をかけると葉はどうなる？",
        c:["青紫色になる","赤色になる","無色になる","黄緑色になる"], a:0,
        exp:"ヨウ素液はデンプンに反応して青紫色。"
      },
      { level:"中", diff:"標準", pattern:"physics",
        q:"直列回路で豆電球を1個から2個に増やすと、電流の大きさは一般にどうなる？",
        c:["小さくなる","大きくなる","変わらない","0になる"], a:0,
        exp:"直列は抵抗が増えるので電流は小さくなる。"
      },
      { level:"中", diff:"標準", pattern:"calc",
        q:"密度2.0g/cm³の物体の体積が30cm³のとき、質量は？",
        c:["60g","15g","32g","90g"], a:0,
        exp:"質量=密度×体積=2.0×30=60g。"
      },
      { level:"小", diff:"標準", pattern:"biology",
        q:"植物が光を受けて養分をつくるはたらきを何という？",
        c:["光合成","呼吸","蒸散","消化"], a:0,
        exp:"光合成。"
      },
      { level:"中", diff:"標準", pattern:"chemistry",
        q:"酸性の水溶液に青色リトマス紙を入れるとどうなる？",
        c:["赤色になる","青色のまま","緑色になる","無色になる"], a:0,
        exp:"酸性で青→赤。"
      },
    ],
    社会: [
      { level:"中", diff:"標準", pattern:"civics",
        q:"裁判所が法律や命令などが憲法に反しないかを判断する権限は？",
        c:["違憲審査権","国政調査権","弾劾裁判所の権限","予算先議権"], a:0,
        exp:"裁判所が法令等を憲法に照らして判断する権限。"
      },
      { level:"中", diff:"標準", pattern:"geo",
        q:"経度が15°東へ移動すると、時刻は一般に？",
        c:["1時間進む","1時間遅れる","30分進む","2時間進む"], a:0,
        exp:"15°で1時間。東へ行くほど進む。"
      },
      { level:"中", diff:"標準", pattern:"history",
        q:"江戸時代、幕府が諸大名を江戸と領地に交代で住まわせた制度は？",
        c:["参勤交代","鎖国","楽市楽座","兵農分離"], a:0,
        exp:"参勤交代。"
      },
      { level:"中", diff:"標準", pattern:"civics",
        q:"国会が法律を定める働きを何という？",
        c:["立法","行政","司法","自治"], a:0,
        exp:"法律をつくる＝立法。"
      },
      { level:"中", diff:"発展", pattern:"geo",
        q:"日本の地形について正しい説明はどれ？",
        c:["山地が多く、河川は短く急流になりやすい","年中乾燥し砂漠が広がる","海に面していない内陸国である","高緯度で極夜が毎年ある"], a:0,
        exp:"山地が多く短い河川が急流になりやすい。"
      },
    ],
  };

  function packToQuestions(subject, pack) {
    return pack.map((x) => ({
      sub: subject,
      level: x.level,
      diff: x.diff,
      pattern: x.pattern || "p",
      q: x.q,
      c: x.c.slice(0, 4),
      a: x.a,
      exp: x.exp || "",
    }));
  }

  /* =========================
   * 安全テンプレ生成（おかしい選択肢が出ない範囲だけ）
   * ========================= */

  // --- 英語：文法穴埋め（助動詞・時制・前置詞・比較） ---
  function genEnglishGrammar(n) {
    const out = [];
    const templates = [
      // 三単現
      (i) => {
        const names = ["He", "She", "Ken", "My father"];
        const subj = pick(names, i);
        const verbs = [
          { base: "play", third: "plays", obj: "soccer" },
          { base: "study", third: "studies", obj: "English" },
          { base: "like", third: "likes", obj: "music" },
          { base: "watch", third: "watches", obj: "TV" },
        ];
        const v = pick(verbs, i);
        const correct = v.third;
        const wrongs = [v.base, v.base + "ed", v.base + "ing", "is " + v.base + "ing", "can " + v.base];
        const { c, a } = force4Choices(correct, wrongs, i);
        return {
          level: "中", diff: "標準", pattern: "grammar",
          q: `(　)に入る語は？ ${subj} (   ) ${v.obj}.`,
          c, a,
          exp: `三単現のs：${subj} は三人称単数なので ${correct}。`,
        };
      },
      // 過去形
      (i) => {
        const subj = pick(["I", "We", "They"], i);
        const v = pick([
          { base: "go", past: "went", tail: "to the park" },
          { base: "eat", past: "ate", tail: "lunch" },
          { base: "see", past: "saw", tail: "a movie" },
          { base: "buy", past: "bought", tail: "a book" },
        ], i);
        const correct = v.past;
        const wrongs = [v.base, v.base + "s", v.base + "ing", "will " + v.base, "has " + v.base];
        const { c, a } = force4Choices(correct, wrongs, i);
        return {
          level: "中", diff: "標準", pattern: "grammar",
          q: `(　)に入る語は？ ${subj} (   ) ${v.tail} yesterday.`,
          c, a,
          exp: `yesterday があるので過去形：${correct}。`,
        };
      },
      // 前置詞（in/on/at）
      (i) => {
        const pairs = [
          { blank: "at", phrase: "at 7 o'clock" },
          { blank: "on", phrase: "on Sunday" },
          { blank: "in", phrase: "in April" },
          { blank: "at", phrase: "at school" },
          { blank: "in", phrase: "in Japan" },
        ];
        const p = pick(pairs, i);
        const correct = p.blank;
        const wrongs = ["in", "on", "at", "to", "for"].filter(x => x !== correct).concat(["from"]);
        const { c, a } = force4Choices(correct, wrongs, i);
        return {
          level: "中", diff: "標準", pattern: "grammar",
          q: `(　)に入る最も適切な語は？ We meet (   ) ${p.phrase.replace(/^(in|on|at)\s/, "")}.`,
          c, a,
          exp: `前置詞の基本：${p.phrase}。`,
        };
      },
      // 比較級
      (i) => {
        const adj = pick([
          { base: "tall", comp: "taller" },
          { base: "fast", comp: "faster" },
          { base: "easy", comp: "easier" },
          { base: "interesting", comp: "more interesting" },
        ], i);
        const correct = adj.comp;
        const wrongs = [adj.base, adj.base + "est", "most " + adj.base, "more " + adj.base, "more " + adj.comp];
        const { c, a } = force4Choices(correct, wrongs, i);
        return {
          level: "中", diff: (i % 5 === 0 ? "発展" : "標準"), pattern: "grammar",
          q: `(　)に入る語は？ This book is (   ) than that one.`,
          c, a,
          exp: `比較級：${adj.base} → ${correct}。`,
        };
      },
    ];

    for (let i = 0; i < n; i++) {
      const t = pick(templates, i);
      const q = t(i);
      out.push({ sub: "英語", ...q });
    }
    return out;
  }

  // --- 英語：短文読解（接続語・指示語の意味） ---
  function genEnglishReading(n) {
    const out = [];
    const items = [
      {
        sent: "I was tired, so I went to bed early.",
        ask: "so の意味は？",
        correct: "だから",
        wrongs: ["しかし", "もし", "そして", "〜のとき", "たとえば"],
        exp: "so は原因→結果の「だから」。",
      },
      {
        sent: "I studied hard, but I couldn't solve the problem.",
        ask: "but の意味は？",
        correct: "しかし",
        wrongs: ["だから", "もし", "そして", "〜なので", "そのため"],
        exp: "but は逆接「しかし」。",
      },
      {
        sent: "I stayed home because it was raining.",
        ask: "because の意味は？",
        correct: "〜なので（なぜなら）",
        wrongs: ["しかし", "もし", "そして", "だから", "それでも"],
        exp: "because は理由「〜なので」。",
      },
    ];

    for (let i = 0; i < n; i++) {
      const it = pick(items, i);
      const { c, a } = force4Choices(it.correct, it.wrongs, i);
      out.push({
        sub: "英語",
        level: "中",
        diff: "標準",
        pattern: "reading",
        q: `英文："${it.sent}"\n質問：${it.ask}`,
        c, a,
        exp: it.exp,
      });
    }
    return out;
  }

  // --- 数学：一次関数（値代入） ---
  function genMathLinear(n) {
    const out = [];
    for (let i = 0; i < n; i++) {
      const a = pick([ -4, -3, -2, -1, 1, 2, 3, 4 ], i);
      const b = pick([ -6, -3, -1, 0, 2, 5, 7 ], i + 3);
      const x = pick([ -3, -2, -1, 0, 1, 2, 3 ], i + 5);
      const y = a * x + b;
      const correct = String(y);
      const wrongs = [String(y + 1), String(y - 1), String(a * (x + 1) + b), String(a * x - b), String(a + x + b)];
      const { c, a: ans } = force4Choices(correct, wrongs, i);
      out.push({
        sub: "数学", level: "中", diff: (i % 6 === 0 ? "発展" : "標準"), pattern: "function",
        q: `一次関数 y = ${a}x ${b >= 0 ? "+ " + b : "- " + Math.abs(b)} において、x=${x} のとき y は？`,
        c, a: ans,
        exp: `y=ax+b に代入：y=${a}×${x}${b >= 0 ? "+" + b : "-" + Math.abs(b)}=${y}。`,
      });
    }
    return out;
  }

  // --- 理科：密度・オームの法則（安全計算） ---
  function genScienceCalc(n) {
    const out = [];
    for (let i = 0; i < n; i++) {
      if (i % 2 === 0) {
        // 密度：質量=密度×体積
        const d = pick([0.8, 1.2, 2.0, 2.7, 7.9], i);
        const v = pick([10, 15, 20, 25, 30, 40], i + 1);
        const m = d * v;
        const correct = `${m}g`;
        const wrongs = [`${d + 1}g`, `${v}g`, `${m + d}g`, `${m + 10}g`, `${m - 10}g`];
        const { c, a } = force4Choices(correct, wrongs, i);
        out.push({
          sub:"理科", level:"中", diff:"標準", pattern:"calc",
          q:`密度${d}g/cm³の物体の体積が${v}cm³のとき、質量は？`,
          c, a,
          exp:`質量=密度×体積=${d}×${v}=${m}g。`,
        });
      } else {
        // オームの法則：V=IR
        const R = pick([2, 4, 5, 8, 10], i);
        const I = pick([0.2, 0.5, 1, 1.5, 2], i + 2);
        const V = R * I;
        const correct = `${V}V`;
        const wrongs = [`${R + I}V`, `${R}V`, `${I}V`, `${V + 2}V`, `${V - 1}V`];
        const { c, a } = force4Choices(correct, wrongs, i);
        out.push({
          sub:"理科", level:"中", diff:"発展", pattern:"physics",
          q:`抵抗${R}Ω、電流${I}Aのとき、電圧は？（V=IR）`,
          c, a,
          exp:`V=IR=${R}×${I}=${V}V。`,
        });
      }
    }
    return out;
  }

  // --- 社会：時差（経度15°=1時間）と公民の定義（安全領域） ---
  function genSocialTime(n) {
    const out = [];
    for (let i = 0; i < n; i++) {
      const step = pick([15, 30, 45, 60], i);
      const hours = step / 15;
      const dir = (i % 2 === 0) ? "東" : "西";
      const correct = (dir === "東") ? `${hours}時間進む` : `${hours}時間遅れる`;
      const wrongs = [
        (dir === "東") ? `${hours}時間遅れる` : `${hours}時間進む`,
        "30分進む",
        "30分遅れる",
        "2時間進む",
        "2時間遅れる",
      ];
      const { c, a } = force4Choices(correct, wrongs, i);
      out.push({
        sub:"社会", level:"中", diff:"標準", pattern:"geo",
        q:`経度が${step}°${dir}へ移動すると、時刻は一般に？`,
        c, a,
        exp:`15°で1時間。${dir}へ行くと時刻は${dir==="東"?"進む":"遅れる"}。`,
      });
    }
    return out;
  }

  function genSocialCivicsDefs(n) {
    const out = [];
    const items = [
      { q:"国会が法律を定めるはたらきは？", correct:"立法", wrongs:["行政","司法","自治"], exp:"法律をつくる＝立法。" },
      { q:"内閣が政治を行い、法律を実行するはたらきは？", correct:"行政", wrongs:["立法","司法","自治"], exp:"法律を実行する＝行政。" },
      { q:"裁判所が争いを法律に基づいて裁くはたらきは？", correct:"司法", wrongs:["立法","行政","自治"], exp:"裁く＝司法。" },
      { q:"地方公共団体が地域のことを自主的に行うしくみは？", correct:"地方自治", wrongs:["国民主権","三権分立","議院内閣制"], exp:"地域のことを地域で決める＝地方自治。" },
      { q:"裁判所が法令が憲法に反しないか判断する権限は？", correct:"違憲審査権", wrongs:["国政調査権","予算先議権","弾劾裁判所の権限"], exp:"憲法に照らして判断する権限。" },
    ];

    for (let i=0; i<n; i++) {
      const it = pick(items, i);
      const { c, a } = force4Choices(it.correct, it.wrongs, i);
      out.push({
        sub:"社会", level:"中", diff:"標準", pattern:"civics",
        q: it.q,
        c, a,
        exp: it.exp,
      });
    }
    return out;
  }

  // --- 国語：語彙（安全に作れる範囲） ---
  function genJapaneseVocab(n) {
    const out = [];
    const items = [
      ["適切","状況や目的に合っている","無関係","偶然","不可能"],
      ["抽象","形がなく概念的なこと","具体","偶然","部分"],
      ["根拠","理由やよりどころ","結論","感想","例外"],
      ["簡潔","むだがなく短いこと","複雑","曖昧","冗長"],
      ["顕著","目立ってはっきりしている","平凡","微妙","不明瞭"],
      ["慎重","注意深く行うこと","軽率","大胆","乱暴"],
      ["主張","自分の意見として強く述べること","例示","対比","説明"],
      ["要旨","文章の中心となる内容","感想","余談","結末"],
    ];
    for (let i=0; i<n; i++) {
      const it = pick(items, i);
      const word = it[0], correct = it[1];
      const wrongs = [it[2], it[3], it[4], "反対の意味", "細かい部分"];
      const { c, a } = force4Choices(correct, wrongs, i);
      out.push({
        sub:"国語", level:"中", diff:"標準", pattern:"vocab",
        q:`「${word}」の意味として最も近いものは？`,
        c, a,
        exp:`「${word}」＝「${correct}」。`,
      });
    }
    return out;
  }

  /* =========================
   * bank を組み立て、教科別に最低数まで補充
   * ========================= */
  function buildBank() {
    let bank = [];

    // 固定パック投入
    for (const s of SUBJECTS) {
      const pack = FIXED[s] || [];
      bank.push(...packToQuestions(s, pack));
    }

    // 生成パック（まず一定量を投入）
    bank.push(...genEnglishGrammar(140));
    bank.push(...genEnglishReading(60));
    bank.push(...genMathLinear(160));
    bank.push(...genScienceCalc(160));
    bank.push(...genSocialTime(120));
    bank.push(...genSocialCivicsDefs(120));
    bank.push(...genJapaneseVocab(160));

    // key 付与
    bank.forEach((q, i) => (q.key = toKey(q, i)));

    // 検品フィルタ
    bank = bank.filter(validateQuestion);

    // 教科別最低数保証：不足があれば “安全テンプレ” で追加して再検品
    const countBySub = () => {
      const m = new Map();
      SUBJECTS.forEach(s => m.set(s, 0));
      bank.forEach(q => m.set(q.sub, (m.get(q.sub) || 0) + 1));
      return m;
    };

    let counts = countBySub();
    const addAndRebuild = (more) => {
      const start = bank.length;
      bank.push(...more);
      bank.forEach((q, i) => { if (!q.key) q.key = toKey(q, start + i); });
      bank = bank.filter(validateQuestion);
      counts = countBySub();
    };

    // 補充（必要なら）
    // ※ここは「不足している教科だけ」足します
    if ((counts.get("英語") || 0) < MIN_PER_SUBJECT) addAndRebuild(genEnglishGrammar(120));
    if ((counts.get("国語") || 0) < MIN_PER_SUBJECT) addAndRebuild(genJapaneseVocab(120));
    if ((counts.get("数学") || 0) < MIN_PER_SUBJECT) addAndRebuild(genMathLinear(120));
    if ((counts.get("理科") || 0) < MIN_PER_SUBJECT) addAndRebuild(genScienceCalc(120));
    if ((counts.get("社会") || 0) < MIN_PER_SUBJECT) addAndRebuild(genSocialTime(80).concat(genSocialCivicsDefs(80)));

    // 最終チェック（不足はログに出す：出題停止の原因追跡用）
    counts = countBySub();
    for (const s of SUBJECTS) {
      if ((counts.get(s) || 0) < 50) {
        // ここに来るのは異常
        console.warn(`[bank] ${s} が極端に不足:`, counts.get(s));
      }
    }

    return bank;
  }

  window.BANK = buildBank();
})();
