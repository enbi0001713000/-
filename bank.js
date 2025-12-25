/* bank.js
 * SchoolQuizBank.buildAll(perSubjectCount=500) -> [{sub, level, diff, q, c, a, exp, key}]
 * level: "小"|"中"
 * diff : "基礎"|"標準"|"発展"
 */
(function(){
  function mulberry32(seed){ let t = seed>>>0; return function(){ t += 0x6D2B79F5; let r = Math.imul(t ^ (t>>>15), 1|t); r ^= r + Math.imul(r ^ (r>>>7), 61|r); return ((r ^ (r>>>14))>>>0)/4294967296; }; }
  function shuffle(arr, rng){ const a=arr.slice(); for(let i=a.length-1;i>0;i--){ const j=Math.floor(rng()*(i+1)); [a[i],a[j]]=[a[j],a[i]]; } return a; }
  function pickDistinct(arr, k, rng, forbid=new Set()){
    const pool = arr.filter(x=>!forbid.has(x));
    return shuffle(pool, rng).slice(0, k);
  }
  function uniqPush(out, seen, qObj){
    if (!qObj || !qObj.q || !qObj.c || qObj.c.length!==4) return false;
    if (qObj.a<0 || qObj.a>3) return false;
    if (seen.has(qObj.key)) return false;
    seen.add(qObj.key);
    out.push(qObj);
    return true;
  }
  function makeMCQ({sub, level, diff, q, correct, distractors, exp}){
    const rng = makeMCQ._rng || (makeMCQ._rng = mulberry32(1234567));
    let ds = (distractors||[]).filter(x=>x!==correct);
    while (ds.length < 3) ds.push(`（誤）${ds.length+1}`);
    ds = ds.slice(0,3);
    const choices = shuffle([correct, ...ds], rng);
    return {
      sub, level, diff,
      q,
      c: choices,
      a: choices.indexOf(correct),
      exp: exp || "",
      key: `${sub}|${level}|${diff}|${q}|${choices.join("::")}`
    };
  }

  const SUBJECTS = ["国語","数学","英語","理科","社会"];
  const DIFFS = ["基礎","標準","発展"];
  const LEVELS = ["小","中"];

  /* =========================
     国語：語彙・漢字・慣用句・文法（固定データ増量）
  ========================= */
  const JP_VOCAB_BASIC = [
    ["確認","かくにん","たしかめること"],
    ["理由","りゆう","わけ"],
    ["安全","あんぜん","危険がないこと"],
    ["整理","せいり","まとめて整えること"],
    ["反対","はんたい","逆のこと"],
    ["比較","ひかく","くらべること"],
    ["実験","じっけん","たしかめるためにやること"],
    ["観察","かんさつ","よく見て調べること"],
    ["意見","いけん","考え"],
    ["結果","けっか","最後に出た答え"],
    ["原因","げんいん","起こった理由"],
    ["協力","きょうりょく","力を合わせること"],
    ["努力","どりょく","がんばること"],
    ["必要","ひつよう","なくてはならないこと"],
    ["重要","じゅうよう","大切なこと"],
    ["計画","けいかく","前もって決めること"],
    ["説明","せつめい","わかるように述べること"],
    ["注意","ちゅうい","気をつけること"],
    ["利益","りえき","得になること"],
    ["損失","そんしつ","損になること"],
    ["増加","ぞうか","増えること"],
    ["減少","げんしょう","減ること"],
    ["合計","ごうけい","全部合わせた数"],
    ["平均","へいきん","ならした値"],
    ["参加","さんか","加わること"],
    ["準備","じゅんび","前もって用意すること"]
  ];

  const JP_VOCAB_STD = [
    ["抽象","ちゅうしょう","一般化して表すこと"],
    ["具体","ぐたい","はっきりした内容"],
    ["根拠","こんきょ","理由となる材料"],
    ["主張","しゅちょう","言い分"],
    ["要旨","ようし","最も言いたいこと"],
    ["課題","かだい","取り組むべき問題"],
    ["影響","えいきょう","及ぼす働き"],
    ["対策","たいさく","防ぐための手段"],
    ["改善","かいぜん","よりよくすること"],
    ["提案","ていあん","案を出すこと"],
    ["仮説","かせつ","まず立てる見通し"],
    ["検証","けんしょう","正しいか確かめること"],
    ["議論","ぎろん","意見を出し合うこと"],
    ["反論","はんろん","反対の意見を述べること"],
    ["結論","けつろん","最終的な判断"],
    ["前提","ぜんてい","出発点となる条件"],
    ["傾向","けいこう","かたより"],
    ["統計","とうけい","データをまとめて扱うこと"],
    ["因果","いんが","原因と結果の関係"],
    ["再現","さいげん","同じ結果をもう一度出すこと"],
    ["客観","きゃっかん","だれが見ても同じ"],
    ["主観","しゅかん","個人の感じ方"],
    ["妥当","だとう","適切であること"],
    ["効率","こうりつ","むだが少ないこと"],
    ["優先","ゆうせん","先にすること"]
  ];

  const JP_VOCAB_ADV = [
    ["本質","ほんしつ","最も大切な中身"],
    ["体系","たいけい","全体を筋道立てた構造"],
    ["相対","そうたい","他と比べて決まること"],
    ["普遍","ふへん","広く当てはまること"],
    ["概念","がいねん","考えの枠組み"],
    ["言及","げんきゅう","話題として触れること"],
    ["批判","ひはん","よしあしを論じること"],
    ["検討","けんとう","よく考えて調べること"],
    ["省察","せいさつ","自分をふり返ること"],
    ["合意","ごうい","意見が一致すること"],
    ["見解","けんかい","ものの見方"],
    ["論理","ろんり","筋道立てた考え方"],
    ["矛盾","むじゅん","つじつまが合わないこと"],
    ["反証","はんしょう","仮説をくつがえす根拠"],
    ["帰結","きけつ","そこから導かれる結果"],
    ["暫定","ざんてい","仮のもの"],
    ["顕在","けんざい","表に現れていること"],
    ["潜在","せんざい","内にひそんでいること"],
    ["逸脱","いつだつ","決まりから外れること"],
    ["抑制","よくせい","おさえこむこと"],
    ["相関","そうかん","一緒に変化する関係"],
    ["因果関係","いんがかんけい","原因と結果のつながり"],
    ["最適化","さいてきか","最もよい形にすること"],
    ["外挿","がいそう","範囲外へ推し広げて推定"],
    ["内包","ないほう","中に含むこと"]
  ];

  const JP_IDIOMS = [
    ["頭が上がらない","感謝や負い目で逆らえない"],
    ["目を通す","ざっと読む"],
    ["手がかりをつかむ","解決の糸口を得る"],
    ["胸を張る","自信をもつ"],
    ["顔を出す","姿を見せる"],
    ["口をそろえる","みんな同じことを言う"],
    ["耳を傾ける","よく聞く"],
    ["肩を並べる","同じくらいの立場になる"],
    ["足を運ぶ","行ってみる"],
    ["気が向く","その気になる"],
    ["目に見える","はっきり分かる"],
    ["骨が折れる","大変だ"],
    ["釘を刺す","念を押す"],
    ["白紙に戻す","いったん取り消す"],
    ["一目置く","一段上だと認める"]
  ];

  const JP_GRAMMAR = [
    { level:"小", diff:"基礎", q:"『要旨』として適切なのは？（要旨＝文章全体で最も言いたいこと）", ans:"筆者の主張の核", ds:["細部の具体例","登場人物の気持ち","比喩表現の一覧"], exp:"要旨は“筆者が最も言いたい中心”。細部ではなく核をつかむ。" },
    { level:"小", diff:"基礎", q:"原因（理由）→結果（結論）に合う接続詞は？『雨が降った。＿＿＿、試合は中止だ。』", ans:"だから", ds:["しかし","それでも","ところで"], exp:"原因→結果なので「だから」。" },
    { level:"小", diff:"標準", q:"『指示語』として最も適切なのは？", ans:"これ", ds:["だから","そして","しかし"], exp:"指示語は「これ／それ／あれ／この／その／あの」など。" },
    { level:"中", diff:"標準", q:"説明文で重要なのは？", ans:"主張と根拠の関係", ds:["登場人物の相関図","場面転換","セリフの言い回し"], exp:"説明文は“結論（主張）”と“理由（根拠）”のつながりで読む。" },
    { level:"中", diff:"発展", q:"論説文の基本構成として一般的なのは？", ans:"結論→理由→具体例", ds:["起承転結のみ","会話→場面転換→オチ","人物紹介→事件→解決"], exp:"論説文は結論（主張）を理由・具体例で支える構造が多い。" }
  ];

  function buildJapanese(perCount, rng){
    const out = [];
    const seen = new Set();

    const makeReadingQ = (entry, level, diff)=>{
      const [w, r, m] = entry;
      const allReadings = JP_VOCAB_BASIC.concat(JP_VOCAB_STD, JP_VOCAB_ADV).map(x=>x[1]);
      const ds = pickDistinct(allReadings, 3, rng, new Set([r]));
      return makeMCQ({
        sub:"国語", level, diff,
        q:`次の漢字の読みとして正しいものは？『${w}』`,
        correct:r, distractors:ds,
        exp:`『${w}』の読みは「${r}」。意味：${m}`
      });
    };
    const makeMeaningQ = (entry, level, diff)=>{
      const [w, r, m] = entry;
      const allMeanings = JP_VOCAB_BASIC.concat(JP_VOCAB_STD, JP_VOCAB_ADV).map(x=>x[2]);
      const ds = pickDistinct(allMeanings, 3, rng, new Set([m]));
      return makeMCQ({
        sub:"国語", level, diff,
        q:`次の語の意味として最も適切なのは？『${w}』`,
        correct:m, distractors:ds,
        exp:`『${w}』＝${m}（読み：${r}）`
      });
    };
    const makeIdiomQ = (entry)=>{
      const [idiom, meaning] = entry;
      const ds = pickDistinct(JP_IDIOMS.map(x=>x[1]), 3, rng, new Set([meaning]));
      return makeMCQ({
        sub:"国語", level:"中", diff:"標準",
        q:`慣用句『${idiom}』の意味は？`,
        correct:meaning, distractors:ds,
        exp:`『${idiom}』＝${meaning}`
      });
    };

    for (const g of JP_GRAMMAR){
      uniqPush(out, seen, makeMCQ({sub:"国語", level:g.level, diff:g.diff, q:g.q, correct:g.ans, distractors:g.ds, exp:g.exp}));
    }

    const basic = JP_VOCAB_BASIC;
    const std   = JP_VOCAB_STD;
    const adv   = JP_VOCAB_ADV;

    const target = {
      "基礎": Math.round(perCount*0.20),
      "標準": Math.round(perCount*0.50),
      "発展": perCount - Math.round(perCount*0.20) - Math.round(perCount*0.50)
    };

    function fill(diff, n){
      while (out.filter(x=>x.sub==="国語" && x.diff===diff).length < n){
        let entry, level;
        if (diff==="基礎"){ entry = basic[Math.floor(rng()*basic.length)]; level="小"; }
        else if (diff==="標準"){ entry = std[Math.floor(rng()*std.length)]; level = (rng()<0.25)?"小":"中"; }
        else { entry = adv[Math.floor(rng()*adv.length)]; level="中"; }

        const mode = rng();
        const qObj = (mode < 0.50) ? makeReadingQ(entry, level, diff) : makeMeaningQ(entry, level, diff);
        uniqPush(out, seen, qObj);

        if (diff!=="基礎" && rng()<0.12){
          uniqPush(out, seen, makeIdiomQ(JP_IDIOMS[Math.floor(rng()*JP_IDIOMS.length)]));
        }
      }
    }

    fill("基礎", target["基礎"]);
    fill("標準", target["標準"]);
    fill("発展", target["発展"]);

    while (out.length < perCount){
      const entry = std[Math.floor(rng()*std.length)];
      uniqPush(out, seen, makeMeaningQ(entry, "中", "標準"));
    }

    return out.slice(0, perCount);
  }

  /* =========================
     数学：自動生成（難易度・小/中タグ）
  ========================= */
  function buildMath(perCount, rng){
    const out=[]; const seen=new Set();

    function genBasic(){
      const kind = Math.floor(rng()*6);
      if (kind===0){
        const a=10+Math.floor(rng()*90), b=10+Math.floor(rng()*90);
        const q = `${a}+${b} の答えは？`;
        const correct = a+b;
        const ds = [correct+1, correct-1, correct+10].map(String);
        return makeMCQ({sub:"数学", level:"小", diff:"基礎", q, correct:String(correct), distractors:ds, exp:`${a}+${b}=${correct}`});
      }
      if (kind===1){
        const a=10+Math.floor(rng()*90), b=2+Math.floor(rng()*9);
        const q = `${a}÷${b} の商（整数）として正しいのは？`;
        const correct = Math.floor(a/b);
        const ds=[correct+1, correct-1, correct+2].map(String);
        return makeMCQ({sub:"数学", level:"小", diff:"基礎", q, correct:String(correct), distractors:ds, exp:`割り算の商（整数部分）に注目。`});
      }
      if (kind===2){
        const base = (5+Math.floor(rng()*16))*100;
        const off = [5,10,15,20,25,30][Math.floor(rng()*6)];
        const price = Math.round(base*(100-off)/100);
        const q = `${base}円の商品を${off}%引きで買う。支払いはいくら？`;
        const ds=[base, price+100, price-100].map(v=>`${v}円`);
        return makeMCQ({sub:"数学", level:"小", diff:"基礎", q, correct:`${price}円`, distractors:ds, exp:`支払い＝${base}×${100-off}%＝${price}円`});
      }
      if (kind===3){
        const r = 2+Math.floor(rng()*9);
        const corr = +(2*3.14*r).toFixed(2);
        const q = `円周率を3.14として、半径${r}cmの円の円周は？`;
        const ds=[(corr+3.14).toFixed(2),(corr-3.14).toFixed(2),(corr+6.28).toFixed(2)].map(v=>`${v}cm`);
        return makeMCQ({sub:"数学", level:"中", diff:"基礎", q, correct:`${corr}cm`, distractors:ds, exp:`円周=2πr=2×3.14×${r}=${corr}cm`});
      }
      if (kind===4){
        const x = 1+Math.floor(rng()*12);
        const a = 2+Math.floor(rng()*8);
        const b = Math.floor(rng()*21)-10;
        const c = a*x + b;
        const q = `一次方程式 ${a}x ${b>=0?"+":"-"} ${Math.abs(b)} = ${c} の解は？`;
        const correct = `x=${x}`;
        const ds=[`x=${x+1}`,`x=${x-1}`,`x=${x+2}`];
        return makeMCQ({sub:"数学", level:"中", diff:"基礎", q, correct, distractors:ds, exp:`${a}x=${c-b} → x=${x}`});
      }
      return makeMCQ({sub:"数学", level:"小", diff:"基礎", q:"三角形の内角の和は？", correct:"180°", distractors:["360°","90°","270°"], exp:"三角形の内角和は180°。"});
    }

    function genStd(){
      const kind = Math.floor(rng()*7);
      if (kind===0){
        const k = 2+Math.floor(rng()*7), x = 2+Math.floor(rng()*9), y=k*x;
        const q = `比例 y=${k}x のとき、x=${x}のときのyは？`;
        const ds=[y+k,y-k,y+2*k].map(String);
        return makeMCQ({sub:"数学", level:"中", diff:"標準", q, correct:String(y), distractors:ds, exp:`y=${k}×${x}=${y}`});
      }
      if (kind===1){
        const x = 2+Math.floor(rng()*9), y = 2+Math.floor(rng()*9), m=x*y;
        const q = `反比例 y=${m}/x のとき、x=${x}のときのyは？`;
        const ds=[y+1,y-1,y+2].map(String);
        return makeMCQ({sub:"数学", level:"中", diff:"標準", q, correct:String(y), distractors:ds, exp:`y=${m}÷${x}=${y}`});
      }
      if (kind===2){
        const a = -3 + Math.floor(rng()*7);
        const b = -3 + Math.floor(rng()*7);
        if (a===0) return genStd();
        const q = `一次関数 y=${a}x${b>=0?"+":"-"}${Math.abs(b)} の切片（y切片）は？`;
        const correct = String(b);
        const ds=[b+1,b-1,b+2].map(String);
        return makeMCQ({sub:"数学", level:"中", diff:"標準", q, correct, distractors:ds, exp:`x=0のときy=${b} → 切片は${b}`});
      }
      if (kind===3){
        const arr = shuffle([2,3,7,9,10,12,15].slice(0,5), rng).sort((x,y)=>x-y);
        const med = arr[2];
        const q = `中央値（メディアン）はどれ？ ${arr.join(", ")}`;
        const ds = [arr[1], arr[3], Math.round(arr.reduce((s,v)=>s+v,0)/5)].map(String);
        return makeMCQ({sub:"数学", level:"中", diff:"標準", q, correct:String(med), distractors:ds, exp:`並べたとき中央の値（5個なら3番目）。`});
      }
      if (kind===4){
        const ok = [[2,4,6,"偶数"],[3,6,"3の倍数"],[1,6,"1または6"]][Math.floor(rng()*3)];
        const favorable = ok.length-1;
        const label = ok[ok.length-1];
        const q = `サイコロを1回投げる。${label}が出る確率は？`;
        const corr = favorable===3 ? "1/2" : favorable===2 ? "1/3" : "1/6";
        const ds = pickDistinct(["1/2","1/3","1/6","2/3"], 3, rng, new Set([corr]));
        return makeMCQ({sub:"数学", level:"中", diff:"標準", q, correct:corr, distractors:ds, exp:`有利${favorable}通り／全体6通り → ${corr}`});
      }
      if (kind===5){
        const avg = 4+Math.floor(rng()*11), n=5, sum=avg*n;
        const q = `平均が${avg}、データ数が${n}。合計は？`;
        const ds=[sum+5,sum-5,sum+10].map(String);
        return makeMCQ({sub:"数学", level:"中", diff:"標準", q, correct:String(sum), distractors:ds, exp:`合計=平均×個数=${avg}×${n}=${sum}`});
      }
      const a=2, b=5, k=2+Math.floor(rng()*8);
      const q = `a:b=2:5、a=${2*k}のときbは？`;
      const correct = String(5*k);
      const ds=[5*k+2,5*k-2,5*k+5].map(String);
      return makeMCQ({sub:"数学", level:"中", diff:"標準", q, correct, distractors:ds, exp:`a=2k → k=${k}、b=5k=${5*k}`});
    }

    function genAdv(){
      const kind = Math.floor(rng()*6);
      if (kind===0){
        const x = 1+Math.floor(rng()*7);
        const y = 1+Math.floor(rng()*7);
        const q = `連立方程式 x+y=${x+y}, x-y=${x-y} の解は？`;
        const correct = `x=${x}, y=${y}`;
        const ds = [`x=${y}, y=${x}`, `x=${x+1}, y=${y-1}`, `x=${x-1}, y=${y+1}`];
        return makeMCQ({sub:"数学", level:"中", diff:"発展", q, correct, distractors:ds, exp:`加減法で解く（加えると2x）。`});
      }
      if (kind===1){
        const p = 1+Math.floor(rng()*5);
        const qv = 1+Math.floor(rng()*5);
        const B = -(p+qv);
        const C = p*qv;
        const q = `二次式 x^2${B>=0?"+":"-"}${Math.abs(B)}x+${C} を因数分解すると？`;
        const correct = `(x-${p})(x-${qv})`;
        const ds = [`(x+${p})(x+${qv})`, `(x-${p})(x+${qv})`, `(x+${p})(x-${qv})`];
        return makeMCQ({sub:"数学", level:"中", diff:"発展", q, correct, distractors:ds, exp:`積が${C}、和が${p+qv}になる2数。`});
      }
      if (kind===2){
        return makeMCQ({sub:"数学", level:"中", diff:"発展", q:"袋に赤2個・青3個。1個取り出して赤の確率は？", correct:"2/5", distractors:["1/5","3/5","1/2"], exp:"全体5個中、赤2個 → 2/5。"});
      }
      if (kind===3){
        return makeMCQ({sub:"数学", level:"中", diff:"発展", q:"三角形の外角＝その角に隣り合わない2内角の和。正しい？", correct:"正しい", distractors:["誤り","条件による","外角は内角の差"], exp:"外角定理：外角＝隣り合わない2内角の和。"});
      }
      if (kind===4){
        return makeMCQ({sub:"数学", level:"中", diff:"発展", q:"円周角は同じ弧に対する中心角の何倍？", correct:"1/2", distractors:["2倍","同じ","1/3"], exp:"円周角＝中心角の半分。"});
      }
      const a = 2+Math.floor(rng()*7);
      const b = 1+Math.floor(rng()*7);
      const q = `展開：(${a}x+${b})^2 は？`;
      const correct = `${a*a}x^2+${2*a*b}x+${b*b}`;
      const ds = [`${a*a}x^2+${a*b}x+${b*b}`, `${a*a}x^2+${2*a*b}x-${b*b}`, `${a}x^2+${2*a*b}x+${b*b}`];
      return makeMCQ({sub:"数学", level:"中", diff:"発展", q, correct, distractors:ds, exp:`(ax+b)^2=a^2x^2+2abx+b^2`});
    }

    const diffTargets = {
      "基礎": Math.round(perCount*0.20),
      "標準": Math.round(perCount*0.50),
      "発展": perCount - Math.round(perCount*0.20) - Math.round(perCount*0.50)
    };

    while (out.filter(x=>x.diff==="基礎").length < diffTargets["基礎"]) uniqPush(out, seen, genBasic());
    while (out.filter(x=>x.diff==="標準").length < diffTargets["標準"]) uniqPush(out, seen, genStd());
    while (out.filter(x=>x.diff==="発展").length < diffTargets["発展"]) uniqPush(out, seen, genAdv());
    while (out.length < perCount) uniqPush(out, seen, genStd());
    return out.slice(0, perCount);
  }

  /* =========================
     英語：固定知識×テンプレ
  ========================= */
  function buildEnglish(perCount, rng){
    const out=[]; const seen=new Set();

    const diffTargets = {
      "基礎": Math.round(perCount*0.20),
      "標準": Math.round(perCount*0.50),
      "発展": perCount - Math.round(perCount*0.20) - Math.round(perCount*0.50)
    };

    const subjects = ["I","You","He","She","We","They"];
    const verbs = ["play soccer","study English","like music","watch TV","go to school","read books"];
    const pastIrreg = [
      ["go","went"],["eat","ate"],["see","saw"],["have","had"],["buy","bought"],
      ["make","made"],["take","took"],["come","came"],["write","wrote"],["run","ran"]
    ];

    function genBasic(){
      const k = Math.floor(rng()*6);
      if (k===0){
        const s = subjects[Math.floor(rng()*subjects.length)];
        const comp = ["a student","from Japan","happy","busy"][Math.floor(rng()*4)];
        const correct = (s==="I")?"am":(s==="He"||s==="She")?"is":"are";
        const q = `${s} ___ ${comp}. 空所に入るのは？`;
        return makeMCQ({sub:"英語", level:"小", diff:"基礎", q, correct, distractors: pickDistinct(["am","is","are","be"],3,rng,new Set([correct])), exp:`主語${s}のbe動詞は ${correct}`});
      }
      if (k===1){
        const s = ["He","She"][Math.floor(rng()*2)];
        const v = verbs[Math.floor(rng()*verbs.length)];
        const base = v.split(" ")[0];
        const third = (base==="go") ? "goes" :
                      (base.endsWith("y")) ? base.slice(0,-1)+"ies" :
                      (base==="watch") ? "watches" :
                      base+"s";
        const q = `${s} ___ ${v} every day.（三単現）`;
        const choices = shuffle([base, third, base+"ed", base+"ing"], rng);
        return {
          sub:"英語", level:"中", diff:"基礎",
          q, c:choices, a:choices.indexOf(third),
          exp:`三単現の現在形は動詞にs/es → ${third}`,
          key:`英語|中|基礎|${q}|${choices.join("::")}`
        };
      }
      if (k===2){
        return makeMCQ({sub:"英語", level:"小", diff:"基礎", q:"前置詞 on の基本的な意味は？", correct:"〜の上に（接して）", distractors:["〜の下に","〜の中に","〜の前に"], exp:"on＝上に（接触）。"});
      }
      if (k===3){
        return makeMCQ({sub:"英語", level:"小", diff:"基礎", q:"疑問詞『いつ』はどれ？", correct:"When", distractors:["Where","Who","Why"], exp:"When＝いつ。"});
      }
      if (k===4){
        return makeMCQ({sub:"英語", level:"中", diff:"基礎", q:"There ___ a book on the desk. 空所は？", correct:"is", distractors:["are","am","be"], exp:"a book（単数）なのでis。"});
      }
      return makeMCQ({sub:"英語", level:"中", diff:"基礎", q:"助動詞 can の意味として最も近いのは？", correct:"〜できる", distractors:["〜しなければならない","〜してよい","〜したい"], exp:"canは能力・可能。"});
    }

    function genStd(){
      const k = Math.floor(rng()*7);
      if (k===0){
        const [base,past] = pastIrreg[Math.floor(rng()*pastIrreg.length)];
        const q = `次のうち『${base}』の過去形はどれ？`;
        const ds = pickDistinct(pastIrreg.map(x=>x[1]), 3, rng, new Set([past]));
        return makeMCQ({sub:"英語", level:"中", diff:"標準", q, correct:past, distractors:ds, exp:`${base} の過去形は ${past}`});
      }
      if (k===1){
        const v = ["like music","play tennis","study English"][Math.floor(rng()*3)];
        const q = `You ${v}. を疑問文にすると？`;
        const correct = `Do you ${v}?`;
        const ds = [`Are you ${v}?`,`Did you ${v}?`,`You do ${v}?`];
        return makeMCQ({sub:"英語", level:"中", diff:"標準", q, correct, distractors:ds, exp:"一般動詞の現在疑問文は Do + 主語 + 動詞原形。"});
      }
      if (k===2){
        const s = ["He","She"][Math.floor(rng()*2)];
        const base = ["play","like","study"][Math.floor(rng()*3)];
        const v = base==="study" ? "studies" : base+"s";
        const q = `${s} ${v} tennis. を否定文にすると？`;
        const correct = `${s} doesn't ${base} tennis.`;
        const ds = [`${s} don't ${base} tennis.`, `${s} not ${v} tennis.`, `${s} isn't ${base} tennis.`];
        return makeMCQ({sub:"英語", level:"中", diff:"標準", q, correct, distractors:ds, exp:"三単現の否定は doesn't + 動詞原形。"});
      }
      if (k===3){
        return makeMCQ({sub:"英語", level:"中", diff:"標準", q:"現在進行形の形として正しいのは？", correct:"be動詞 + 動詞ing", distractors:["be動詞 + 動詞原形","助動詞 + 動詞ing","動詞 + to"], exp:"現在進行形＝be動詞 + 動詞ing。"});
      }
      if (k===4){
        return makeMCQ({sub:"英語", level:"中", diff:"標準", q:"比較級として正しいのは？", correct:"better", distractors:["good","best","well"], exp:"goodの比較級はbetter。"});
      }
      if (k===5){
        return makeMCQ({sub:"英語", level:"中", diff:"標準", q:"『〜してください』に近い丁寧表現は？", correct:"Please open the window.", distractors:["Open the window you.","You open please.","Opens the window."], exp:"Please + 動詞原形で丁寧な依頼。"});
      }
      return makeMCQ({sub:"英語", level:"中", diff:"標準", q:"be動詞 are の過去形は？", correct:"were", distractors:["is","was","been"], exp:"areの過去形はwere。"});
    }

    function genAdv(){
      const k = Math.floor(rng()*6);
      if (k===0){
        return makeMCQ({sub:"英語", level:"中", diff:"発展", q:"現在完了（have/has + 過去分詞）の基本的な意味として最も近いのは？", correct:"経験・完了・継続など", distractors:["命令だけ","未来だけ","受動だけ"], exp:"現在完了は経験・完了・継続など。"});
      }
      if (k===1){
        return makeMCQ({sub:"英語", level:"中", diff:"発展", q:"受動態の基本形はどれ？", correct:"be動詞 + 過去分詞", distractors:["have + 動詞","will + 動詞","to + 動詞"], exp:"受動＝be + 過去分詞。"});
      }
      if (k===2){
        return makeMCQ({sub:"英語", level:"中", diff:"発展", q:"関係代名詞 that の基本的な役割として最も近いのは？", correct:"名詞を説明する節をつなぐ", distractors:["動詞を過去にする","疑問文にする","命令文にする"], exp:"関係代名詞は名詞を説明する節をつなぐ。"});
      }
      if (k===3){
        return makeMCQ({sub:"英語", level:"中", diff:"発展", q:"『〜しなければならない』に最も近い助動詞は？", correct:"must", distractors:["can","may","will"], exp:"must＝〜しなければならない。"});
      }
      if (k===4){
        return makeMCQ({sub:"英語", level:"中", diff:"発展", q:"未来の予定『〜するつもりだ』に近い表現は？", correct:"be going to", distractors:["have to","used to","need to"], exp:"be going to は予定・意図。"});
      }
      return makeMCQ({sub:"英語", level:"中", diff:"発展", q:"間接疑問文の語順として正しいのは？", correct:"主語→動詞（平叙文の語順）", distractors:["疑問文の語順","命令文の語順","語順は自由"], exp:"間接疑問は平叙文の語順に戻る。"});
    }

    while (out.filter(x=>x.diff==="基礎").length < diffTargets["基礎"]) uniqPush(out, seen, genBasic());
    while (out.filter(x=>x.diff==="標準").length < diffTargets["標準"]) uniqPush(out, seen, genStd());
    while (out.filter(x=>x.diff==="発展").length < diffTargets["発展"]) uniqPush(out, seen, genAdv());
    while (out.length < perCount) uniqPush(out, seen, genStd());
    return out.slice(0, perCount);
  }

  /* =========================
     理科：固定テーブルを増量して知識密度UP
  ========================= */
  const SCI_FACTS = [
    {level:"小", diff:"基礎", q:"植物の光合成で作られる主な物質は？", ans:"酸素とデンプン", ds:["二酸化炭素","窒素","水"], exp:"光合成で養分（デンプンなど）を作り、酸素を放出。"},
    {level:"小", diff:"基礎", q:"水が0℃で起こす変化は？（標準気圧）", ans:"凝固（凍る）", ds:["沸騰","昇華","融解"], exp:"水は0℃で凍る（凝固）。"},
    {level:"中", diff:"基礎", q:"電流の単位は？", ans:"A（アンペア）", ds:["V（ボルト）","W（ワット）","Ω（オーム）"], exp:"電流=A、電圧=V、電力=W、抵抗=Ω。"},
    {level:"中", diff:"基礎", q:"地球の自転によって起こる現象は？", ans:"昼夜の交代", ds:["季節の変化","月の満ち欠け","潮の満ち引き"], exp:"自転→昼夜。季節は公転＋地軸の傾き。"},
    {level:"中", diff:"基礎", q:"酸性の水溶液で青色リトマス紙はどうなる？", ans:"赤になる", ds:["青のまま","緑になる","黄色になる"], exp:"酸性で青→赤。"},
    {level:"中", diff:"基礎", q:"中和でできる物質は？", ans:"水と塩", ds:["酸素と水","二酸化炭素と水","塩素と水"], exp:"酸＋アルカリ → 水＋塩。"},
    {level:"中", diff:"基礎", q:"音が伝わるのに必要なものは？", ans:"媒質（空気など）", ds:["真空","光","磁石"], exp:"音は媒質が必要。真空では伝わらない。"},
    {level:"中", diff:"標準", q:"血液中で酸素を運ぶ主成分は？", ans:"赤血球", ds:["血しょう","白血球","血小板"], exp:"赤血球のヘモグロビンが酸素を運ぶ。"},
    {level:"中", diff:"標準", q:"質量保存の法則：化学反応の前後で保存されるのは？", ans:"質量", ds:["体積","温度","色"], exp:"閉じた系では質量は等しい。"},
    {level:"中", diff:"標準", q:"雲ができる主な理由は？", ans:"水蒸気が冷えて凝結", ds:["二酸化炭素が増える","酸素が減る","地球が自転する"], exp:"冷えて水蒸気が凝結し水滴・氷晶になる。"},
    {level:"中", diff:"標準", q:"電圧を測る計器は？", ans:"電圧計", ds:["電流計","温度計","圧力計"], exp:"電圧計は並列につなぐ。"},
    {level:"中", diff:"標準", q:"電流を測る計器は？", ans:"電流計", ds:["電圧計","抵抗計","湿度計"], exp:"電流計は直列につなぐ。"},
    {level:"中", diff:"標準", q:"星が日周運動して見える主な原因は？", ans:"地球の自転", ds:["地球の公転","月の公転","星の移動"], exp:"自転で天体が動いて見える。"},
    {level:"中", diff:"標準", q:"消化でデンプンを分解する酵素は？", ans:"アミラーゼ", ds:["ペプシン","リパーゼ","トリプシン"], exp:"デンプンはアミラーゼ。"},
    {level:"中", diff:"標準", q:"金属が酸素と結びつく変化は？", ans:"酸化", ds:["蒸発","凝固","中和"], exp:"酸素と結合＝酸化。"},
    {level:"中", diff:"標準", q:"ばねの伸びは力に比例（一定範囲）。これは？", ans:"フックの法則", ds:["ボイルの法則","オームの法則","慣性の法則"], exp:"ばねの伸び∝力＝フックの法則。"},
    {level:"中", diff:"発展", q:"凸レンズで焦点より外に物体を置くとできる像は？", ans:"実像", ds:["虚像","像はできない","必ず拡大のみ"], exp:"焦点外→スクリーンに写る実像。"},
    {level:"中", diff:"発展", q:"てこがつり合う条件は？", ans:"力×腕の長さが左右で等しい", ds:["重さが等しい","距離が等しい","支点が動く"], exp:"モーメント（力×距離）が等しい。"}
  ];

  const SCI_UNITS = [
    ["電流","A（アンペア）",["V（ボルト）","W（ワット）","Ω（オーム）"]],
    ["電圧","V（ボルト）",["A（アンペア）","W（ワット）","Ω（オーム）"]],
    ["電力","W（ワット）",["V（ボルト）","A（アンペア）","Ω（オーム）"]],
    ["抵抗","Ω（オーム）",["V（ボルト）","A（アンペア）","W（ワット）"]],
    ["質量","g（グラム）",["m（メートル）","L（リットル）","s（秒）"]],
    ["体積","L（リットル）",["g（グラム）","m（メートル）","℃（度）"]],
    ["長さ","m（メートル）",["g（グラム）","L（リットル）","W（ワット）"]],
    ["時間","s（秒）",["m（メートル）","g（グラム）","℃（度）"]],
    ["温度","℃（度）",["m（メートル）","g（グラム）","L（リットル）"]],
  ];

  function buildScience(perCount, rng){
    const out=[]; const seen=new Set();
    const diffTargets = {
      "基礎": Math.round(perCount*0.20),
      "標準": Math.round(perCount*0.50),
      "発展": perCount - Math.round(perCount*0.20) - Math.round(perCount*0.50)
    };

    for (const f of SCI_FACTS){
      uniqPush(out, seen, makeMCQ({sub:"理科", level:f.level, diff:f.diff, q:f.q, correct:f.ans, distractors:f.ds, exp:f.exp}));
    }

    function genUnit(diff){
      const u = SCI_UNITS[Math.floor(rng()*SCI_UNITS.length)];
      const [name, ans, ds] = u;
      return makeMCQ({sub:"理科", level:"中", diff, q:`${name}の単位として正しいのは？`, correct:ans, distractors:ds, exp:`${name}の単位は${ans}。`});
    }
    function genStd(){
      if (rng()<0.55) return genUnit("標準");
      const pick = SCI_FACTS.filter(x=>x.diff!=="発展")[Math.floor(rng()*SCI_FACTS.filter(x=>x.diff!=="発展").length)];
      return makeMCQ({sub:"理科", level:pick.level, diff:"標準", q:pick.q, correct:pick.ans, distractors:pick.ds, exp:pick.exp});
    }
    function genBasic(){
      if (rng()<0.7){
        const pick = SCI_FACTS.filter(x=>x.diff==="基礎")[Math.floor(rng()*SCI_FACTS.filter(x=>x.diff==="基礎").length)];
        return makeMCQ({sub:"理科", level:pick.level, diff:"基礎", q:pick.q, correct:pick.ans, distractors:pick.ds, exp:pick.exp});
      }
      return genUnit("基礎");
    }
    function genAdv(){
      if (rng()<0.5){
        const pick = SCI_FACTS.filter(x=>x.diff==="発展")[Math.floor(rng()*SCI_FACTS.filter(x=>x.diff==="発展").length)];
        return makeMCQ({sub:"理科", level:"中", diff:"発展", q:pick.q, correct:pick.ans, distractors:pick.ds, exp:pick.exp});
      }
      return makeMCQ({sub:"理科", level:"中", diff:"発展", q:"オームの法則の関係として正しいものは？（V=電圧, I=電流, R=抵抗）", correct:"V=IR", distractors:["I=VR","R=VI","V=I/R"], exp:"オームの法則：V=IR。"});
    }

    while (out.filter(x=>x.diff==="基礎").length < diffTargets["基礎"]) uniqPush(out, seen, genBasic());
    while (out.filter(x=>x.diff==="標準").length < diffTargets["標準"]) uniqPush(out, seen, genStd());
    while (out.filter(x=>x.diff==="発展").length < diffTargets["発展"]) uniqPush(out, seen, genAdv());
    while (out.length < perCount) uniqPush(out, seen, genStd());
    return out.slice(0, perCount);
  }

  /* =========================
     社会：固定知識（現職人物など“変動”は避ける）
  ========================= */
  const SOC_FACTS = [
    {level:"中", diff:"基礎", q:"日本国憲法の三大原則は？", ans:"国民主権・基本的人権の尊重・平和主義", ds:["三権分立","五箇条の御誓文","権利章典"], exp:"日本国憲法の三大原則。"},
    {level:"中", diff:"基礎", q:"国会の主な役割は？", ans:"法律を作る", ds:["裁判をする","税を集める","外交だけを行う"], exp:"国会＝立法府。"},
    {level:"中", diff:"基礎", q:"三権分立で行政を担うのは？", ans:"内閣", ds:["国会","裁判所","地方議会"], exp:"行政＝内閣。"},
    {level:"中", diff:"基礎", q:"三権分立で司法を担うのは？", ans:"裁判所", ds:["国会","内閣","地方議会"], exp:"司法＝裁判所。"},
    {level:"中", diff:"基礎", q:"緯度0°の線は？", ans:"赤道", ds:["本初子午線","北回帰線","国境線"], exp:"緯度0°＝赤道。"},
    {level:"中", diff:"基礎", q:"貿易で輸出額が輸入額より多い状態は？", ans:"貿易黒字", ds:["貿易赤字","関税","自由貿易"], exp:"輸出＞輸入＝貿易黒字。"},
    {level:"小", diff:"基礎", q:"地図記号：郵便局はどれ？", ans:"〒", ds:["×","卍","H"], exp:"郵便局は〒。"},
    {level:"中", diff:"標準", q:"地方自治の基本原則として正しいのは？", ans:"住民自治と団体自治", ds:["中央集権","独裁政治","軍事優先"], exp:"地方自治＝住民自治＋団体自治。"},
    {level:"中", diff:"標準", q:"需要が増え、供給が一定のとき価格はどうなりやすい？", ans:"上がりやすい", ds:["下がりやすい","変わらない","必ず0になる"], exp:"不足が起きると価格は上がりやすい。"},
    {level:"中", diff:"標準", q:"江戸幕府を開いた人物は？", ans:"徳川家康", ds:["織田信長","豊臣秀吉","足利尊氏"], exp:"徳川家康が江戸幕府を開いた。"},
    {level:"中", diff:"標準", q:"鎌倉幕府の政治の中心となった役職は？", ans:"執権", ds:["関白","征夷大将軍","太政大臣"], exp:"鎌倉では執権（北条氏）が実権を握った。"},
    {level:"中", diff:"標準", q:"冬に日本海側で雪が多い主な理由は？", ans:"季節風が日本海で水蒸気を含み雪になる", ds:["フェーン現象だけ","台風が来るから","偏西風だけ"], exp:"冬の季節風→日本海で水蒸気→山地で雪。"},
    {level:"中", diff:"発展", q:"選挙で得票数の多い候補が当選する仕組みを何という？", ans:"多数代表制（小選挙区など）", ds:["比例代表制","くじ引き制","年功序列制"], exp:"最多得票の候補が当選する方式。"},
    {level:"中", diff:"発展", q:"GDPが表すのは？", ans:"国内総生産", ds:["人口密度","輸出額","物価指数"], exp:"GDP＝国内総生産。"}
  ];

  function buildSocial(perCount, rng){
    const out=[]; const seen=new Set();
    const diffTargets = {
      "基礎": Math.round(perCount*0.20),
      "標準": Math.round(perCount*0.50),
      "発展": perCount - Math.round(perCount*0.20) - Math.round(perCount*0.50)
    };

    for (const f of SOC_FACTS){
      uniqPush(out, seen, makeMCQ({sub:"社会", level:f.level, diff:f.diff, q:f.q, correct:f.ans, distractors:f.ds, exp:f.exp}));
    }

    const PREFS = [
      "北海道","青森県","岩手県","宮城県","秋田県","山形県","福島県","茨城県","栃木県","群馬県","埼玉県","千葉県",
      "東京都","神奈川県","新潟県","富山県","石川県","福井県","山梨県","長野県","岐阜県","静岡県","愛知県",
      "三重県","滋賀県","京都府","大阪府","兵庫県","奈良県","和歌山県","鳥取県","島根県","岡山県","広島県","山口県",
      "徳島県","香川県","愛媛県","高知県","福岡県","佐賀県","長崎県","熊本県","大分県","宮崎県","鹿児島県","沖縄県"
    ];

    function genBasic(){
      const k = Math.floor(rng()*4);
      if (k===0) return makeMCQ({sub:"社会", level:"小", diff:"基礎", q:"日本の都道府県の数は？", correct:"47", distractors:["46","48","45"], exp:"都道府県は47。"});
      if (k===1) return makeMCQ({sub:"社会", level:"中", diff:"基礎", q:"本初子午線は経度何度？", correct:"0°", distractors:["90°","180°","360°"], exp:"経度0°が本初子午線。"});
      if (k===2) return makeMCQ({sub:"社会", level:"中", diff:"基礎", q:"日本の国会は何院制？", correct:"二院制", distractors:["一院制","三院制","四院制"], exp:"衆議院と参議院の二院制。"});
      return makeMCQ({sub:"社会", level:"小", diff:"基礎", q:"地図で方位を表すNはどの方角？", correct:"北", distractors:["南","東","西"], exp:"N=North=北。"});
    }

    function genStd(){
      const k = Math.floor(rng()*5);
      if (k===0){
        const correct = PREFS[Math.floor(rng()*PREFS.length)];
        const ds = pickDistinct(PREFS, 3, rng, new Set([correct]));
        return makeMCQ({sub:"社会", level:"小", diff:"標準", q:"次のうち都道府県名として正しいのはどれ？", correct, distractors:ds, exp:`例：${correct} は都道府県名。`});
      }
      if (k===1) return makeMCQ({sub:"社会", level:"中", diff:"標準", q:"法律に違反したかどうかを判断するのは？", correct:"裁判所", distractors:["国会","内閣","警察だけ"], exp:"司法（裁判所）が判断する。"});
      if (k===2) return makeMCQ({sub:"社会", level:"中", diff:"標準", q:"SDGsの目的として最も近いのは？", correct:"世界共通の持続可能な目標", distractors:["国内だけの経済成長","宇宙移住計画","軍拡"], exp:"SDGs＝持続可能な開発目標。"});
      if (k===3) return makeMCQ({sub:"社会", level:"中", diff:"標準", q:"日清戦争の講和条約は？", correct:"下関条約", distractors:["ポーツマス条約","ベルサイユ条約","日米和親条約"], exp:"日清戦争→下関条約。"});
      return makeMCQ({sub:"社会", level:"中", diff:"標準", q:"世界の三大宗教に含まれるのは？", correct:"仏教", distractors:["神道","儒教","道教"], exp:"一般にキリスト教・イスラム教・仏教を三大宗教と呼ぶ。"});
    }

    function genAdv(){
      const k = Math.floor(rng()*5);
      if (k===0) return makeMCQ({sub:"社会", level:"中", diff:"発展", q:"財やサービスの価格が全体的に上がり続ける現象は？", correct:"インフレーション", distractors:["デフレーション","関税","均衡"], exp:"物価が上がる＝インフレ。"});
      if (k===1) return makeMCQ({sub:"社会", level:"中", diff:"発展", q:"国連安全保障理事会で拒否権を持つのは？", correct:"常任理事国", distractors:["非常任理事国","加盟国すべて","事務総長"], exp:"拒否権は安保理の常任理事国。"});
      if (k===2) return makeMCQ({sub:"社会", level:"中", diff:"発展", q:"プレート境界で起こりやすいのは？", correct:"地震や火山活動", distractors:["虹","極夜","海流のみ"], exp:"プレート境界は地震・火山が多い。"});
      if (k===3) return makeMCQ({sub:"社会", level:"中", diff:"発展", q:"貿易で輸入が輸出を上回る状態は？", correct:"貿易赤字", distractors:["貿易黒字","自由貿易","固定相場"], exp:"輸入＞輸出＝貿易赤字。"});
      return makeMCQ({sub:"社会", level:"中", diff:"発展", q:"選挙の方式で『政党の得票率に応じて議席を配分』するのは？", correct:"比例代表制", distractors:["多数代表制","くじ引き制","世襲制"], exp:"得票率に応じて議席配分＝比例代表制。"});
    }

    while (out.filter(x=>x.diff==="基礎").length < diffTargets["基礎"]) uniqPush(out, seen, genBasic());
    while (out.filter(x=>x.diff==="標準").length < diffTargets["標準"]) uniqPush(out, seen, genStd());
    while (out.filter(x=>x.diff==="発展").length < diffTargets["発展"]) uniqPush(out, seen, genAdv());
    while (out.length < perCount) uniqPush(out, seen, genStd());
    return out.slice(0, perCount);
  }

  /* =========================
     buildAll
  ========================= */
  function buildAll(perSubjectCount=500){
    const rng = mulberry32(987654321); // 共有されるバンク集合の固定seed
    const bank = [];
    const pushMany = (arr)=> arr.forEach(x=>bank.push(x));

    pushMany(buildJapanese(perSubjectCount, rng));
    pushMany(buildMath(perSubjectCount, rng));
    pushMany(buildEnglish(perSubjectCount, rng));
    pushMany(buildScience(perSubjectCount, rng));
    pushMany(buildSocial(perSubjectCount, rng));

    // 軽い検証
    for (const s of SUBJECTS){
      const n = bank.filter(q=>q.sub===s).length;
      if (n < perSubjectCount) console.warn(`${s} が不足: ${n}/${perSubjectCount}`);
    }
    return bank;
  }

  window.SchoolQuizBank = { buildAll };
})();
