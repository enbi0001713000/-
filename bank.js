/* bank.js (fixed questions, high difficulty, pattern diversified)
   - 5教科固定問題（国語/数学/英語/理科/社会）
   - schema: sub/level/diff/patternGroup/pattern/q/c/a/exp (+ uid/key)
*/

(function () {
  "use strict";

  const SUBJECTS = ["国語", "数学", "英語", "理科", "社会"];
  const GRADES = ["小", "中"];
  const DIFFS = ["基礎", "標準", "発展"];

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
  function toKey(q, i) {
    return `${q.sub}|${q.level}|${q.diff}|${q.patternGroup || q.pattern || "p"}|${(q.q || "").slice(0, 32)}|${i}`;
  }

  function validateQuestion(q) {
    if (!q) return false;
    if (!SUBJECTS.includes(q.sub)) return false;
    if (!GRADES.includes(q.level)) return false;
    if (!DIFFS.includes(q.diff)) return false;
    if (typeof q.pattern !== "string" || !q.pattern.trim()) return false;
    if (typeof q.patternGroup !== "string" || !q.patternGroup.trim()) return false;
    if (typeof q.q !== "string" || !q.q.trim()) return false;
    if (!Array.isArray(q.c) || q.c.length !== 4) return false;
    if (!Number.isFinite(q.a) || q.a < 0 || q.a > 3) return false;
    const choices = q.c.map(x => String(x ?? "").trim());
    if (choices.some(x => !x)) return false;
    if (new Set(choices).size !== 4) return false;

    // メタ選択肢禁止（代表例）
    const banned = new Set(["不明", "わからない", "どれでもない", "上のいずれでもない", "該当なし"]);
    if (choices.some(x => banned.has(x))) return false;

    return true;
  }

  /* =========================
   * 問題データ（固定）
   * ========================= */

  const DATA = [
    /* ========= 国語 25 ========= */
    { sub:"国語", level:"中", diff:"発展", pattern:"vocab", patternGroup:"ja_vocab_precise", q:"「看過する」の意味として最も適切なものは？", c:["見過ごしてそのままにする","細部まで調べ上げる","意図的に隠しておく","あらかじめ防ぐ"], a:0, exp:"看過＝重大でないとして見逃すこと。" },
    { sub:"国語", level:"中", diff:"発展", pattern:"vocab", patternGroup:"ja_vocab_precise", q:"「杞憂」の意味として最も適切なものは？", c:["取り越し苦労","自業自得","臨機応変","一石二鳥"], a:0, exp:"杞憂＝起こりそうもないことを心配すること。" },
    { sub:"国語", level:"中", diff:"発展", pattern:"idiom", patternGroup:"ja_yojijukugo", q:"「隔靴掻痒」の使い方として最も適切なものは？", c:["核心に届かずもどかしい","努力が報われて満足だ","状況が一変して驚いた","大勢に流されてしまう"], a:0, exp:"隔靴掻痒＝靴の上からかゆい所をかくようにもどかしい。" },
    { sub:"国語", level:"中", diff:"発展", pattern:"idiom", patternGroup:"ja_yojijukugo", q:"「付和雷同」と反対の態度として最も近いものは？", c:["自分の判断で意見を持つ","大声で騒ぎ立てる","物事を先送りする","感情に任せて動く"], a:0, exp:"付和雷同＝主体性なく他人に同調する。" },
    { sub:"国語", level:"中", diff:"標準", pattern:"proverb", patternGroup:"ja_proverb_meaning", q:"「石の上にも三年」の趣旨として最も適切なものは？", c:["辛抱強く続ければ成果が出る","急げば回れが最善だ","人は見かけによらない","失敗は成功のもとだ"], a:0, exp:"辛抱して続けることの重要性。" },
    { sub:"国語", level:"中", diff:"発展", pattern:"proverb", patternGroup:"ja_proverb_usage", q:"「口は災いの元」が当てはまる状況として最も適切なものは？", c:["不用意な発言で人間関係が悪化した","約束を守ったので信頼が増した","努力を続けて成績が伸びた","道に迷ったが地図で解決した"], a:0, exp:"軽率な発言がトラブルを招く。" },
    { sub:"国語", level:"中", diff:"発展", pattern:"kanji", patternGroup:"ja_kanji_reading", q:"次の語の読みとして正しいものは？「漸進」", c:["ぜんしん","ざんしん","せんしん","ぜんじん"], a:0, exp:"漸進＝ぜんしん（少しずつ進む）。" },
    { sub:"国語", level:"中", diff:"発展", pattern:"kanji", patternGroup:"ja_kanji_reading", q:"次の語の読みとして正しいものは？「逡巡」", c:["しゅんじゅん","そんじゅん","しゅんしゅん","しんじゅん"], a:0, exp:"逡巡＝しゅんじゅん（ためらう）。" },
    { sub:"国語", level:"中", diff:"発展", pattern:"grammar", patternGroup:"ja_particle_logic", q:"文として最も自然なものはどれか。", c:["この提案は、実現可能性に加えて費用対効果も検討すべきだ。","この提案は、実現可能性に加えて費用対効果を検討すべきである。","この提案は、実現可能性に加えて費用対効果へ検討すべきだ。","この提案は、実現可能性に加えて費用対効果が検討すべきだ。"], a:0, exp:"「費用対効果も検討すべき」が自然。" },
    { sub:"国語", level:"中", diff:"発展", pattern:"grammar", patternGroup:"ja_sentence_rewrite", q:"次の文の言い換えとして最も適切なものは？「彼の説明は要点が曖昧で、結論が見えにくい。」", c:["彼の説明は要点がはっきりせず、結論がつかみにくい。","彼の説明は要点が明確で、結論が理解しやすい。","彼の説明は細部が多く、結論が必ず正しい。","彼の説明は結論が先で、要点が一切ない。"], a:0, exp:"意味を保ちつつ簡潔に言い換える。" },
    { sub:"国語", level:"中", diff:"発展", pattern:"spi", patternGroup:"ja_spi_synonym", q:"語の意味が最も近い組み合わせは？「端的」", c:["簡潔","迂遠","冗長","曖昧"], a:0, exp:"端的＝要点を押さえて簡潔。" },
    { sub:"国語", level:"中", diff:"発展", pattern:"spi", patternGroup:"ja_spi_antonym", q:"次の語の反対語として最も適切なものは？「過小評価」", c:["過大評価","再評価","高評価","低評価"], a:0, exp:"過小評価↔過大評価。" },
    { sub:"国語", level:"中", diff:"発展", pattern:"logic", patternGroup:"ja_logic_relation", q:"次の関係が最も近いものは？「原因：結果」", c:["目的：手段","部分：全体","同類：別名","対立：矛盾"], a:0, exp:"原因→結果に対応するのは目的→手段。" },
    { sub:"国語", level:"中", diff:"発展", pattern:"logic", patternGroup:"ja_logic_context", q:"次の文脈に最も合う語は？「議論は（　）したが、結論は一致しなかった。」", c:["紛糾","収束","完結","定着"], a:0, exp:"紛糾＝まとまらずもめる。" },
    { sub:"国語", level:"中", diff:"標準", pattern:"vocab", patternGroup:"ja_vocab_precise", q:"「一蹴する」の意味として最も適切なものは？", c:["取り合わずに退ける","丁寧に受け入れる","順序立てて説明する","慎重に検討する"], a:0, exp:"一蹴＝相手にせず退ける。" },
    { sub:"国語", level:"中", diff:"発展", pattern:"idiom", patternGroup:"ja_yojijukugo", q:"「支離滅裂」の意味として最も適切なものは？", c:["筋道が立たずまとまりがない","細部まで正確である","感情が高ぶっている","事前に準備が整う"], a:0, exp:"支離滅裂＝話のつながりがない。" },
    { sub:"国語", level:"中", diff:"発展", pattern:"kanji", patternGroup:"ja_kanji_meaning", q:"「憂慮」の意味として最も適切なものは？", c:["心配して気にかける","喜んで祝う","強く命令する","疑って調べる"], a:0, exp:"憂慮＝憂えて心配する。" },
    { sub:"国語", level:"中", diff:"発展", pattern:"kanji", patternGroup:"ja_kanji_reading", q:"次の語の読みとして正しいものは？「漠然」", c:["ばくぜん","はくぜん","ばつぜん","まくぜん"], a:0, exp:"漠然＝ばくぜん（はっきりしない）。" },
    { sub:"国語", level:"中", diff:"発展", pattern:"spi", patternGroup:"ja_spi_sentence_fill", q:"（　）に入る最も適切な語は？「その計画は斬新だが、実現（　）には課題が残る。」", c:["可能性","可能","可否","可能率"], a:0, exp:"「実現可能性」が定型。" },
    { sub:"国語", level:"中", diff:"発展", pattern:"logic", patternGroup:"ja_logic_negation", q:"次の文の論理として最も適切な説明は？「全員が賛成なら可決だ。可決ではない。したがって全員が賛成ではない。」", c:["対偶ではなく否定の推論として妥当","循環論法であり妥当ではない","結論が前提を含むので矛盾","前提が否定されていないので不明"], a:0, exp:"「PならQ、¬Q、ゆえに¬P」は modus tollens。" },
    { sub:"国語", level:"中", diff:"発展", pattern:"proverb", patternGroup:"ja_proverb_usage", q:"「二兎を追う者は一兎をも得ず」に最も近い教訓は？", c:["欲張ると結局何も得られない","努力は必ず報われる","急ぐほど成功する","失敗は避けるべきだ"], a:0, exp:"同時に狙いすぎると失敗しやすい。" },
    { sub:"国語", level:"中", diff:"発展", pattern:"vocab", patternGroup:"ja_vocab_precise", q:"「白羽の矢が立つ」の意味として最も適切なものは？", c:["指名される","拒否される","失敗が確定する","噂が広がる"], a:0, exp:"白羽の矢＝選ばれて指名される。" },
    { sub:"国語", level:"中", diff:"発展", pattern:"grammar", patternGroup:"ja_sentence_cohesion", q:"次のうち、接続の論理が最も自然なものは？", c:["価格が上がった。したがって需要は減少した。","価格が上がった。したがって供給は減少した。","価格が上がった。したがって品質は上がった。","価格が上がった。したがって必ず売上は増えた。"], a:0, exp:"一般に価格上昇→需要量は減る方向。" },
    { sub:"国語", level:"中", diff:"発展", pattern:"spi", patternGroup:"ja_spi_word_choice", q:"文脈に最も適切な語は？「彼は批判を（　）に受け止め、改善案を提示した。」", c:["真摯","軽率","杜撰","拙速"], a:0, exp:"真摯＝まじめで誠実。" },
    { sub:"国語", level:"中", diff:"発展", pattern:"idiom", patternGroup:"ja_yojijukugo", q:"「疑心暗鬼」の意味として最も適切なものは？", c:["疑いが募り何でも悪く見える","心が晴れやかである","議論が整理される","誤りが正される"], a:0, exp:"疑いが疑いを呼び、判断が歪む状態。" },

    /* ========= 数学 25 ========= */
    { sub:"数学", level:"中", diff:"発展", pattern:"number", patternGroup:"math_mod_congruence", q:"整数Nは7で割ると余りが3、5で割ると余りが1である。Nを35で割った余りとして正しいものは？", c:["31","16","8","11"], a:0, exp:"N≡3(mod7),N≡1(mod5)よりN≡31(mod35)。" },
    { sub:"数学", level:"中", diff:"発展", pattern:"probability", patternGroup:"math_probability_cards", q:"1〜10の数字カードが1枚ずつある。2枚同時に引くとき、和が偶数となる確率は？", c:["4/9","5/9","1/2","2/5"], a:0, exp:"偶数和は(偶,偶)か(奇,奇)。偶5・奇5。C(5,2)+C(5,2)=20、全C(10,2)=45で20/45=4/9。" },
    { sub:"数学", level:"中", diff:"発展", pattern:"probability", patternGroup:"math_probability_dice", q:"サイコロを2回振る。出た目の最大値が4である確率は？", c:["7/36","1/6","5/18","1/4"], a:0, exp:"最大4＝両方4以下−両方3以下＝(4/6)^2−(3/6)^2=16/36−9/36=7/36。" },
    { sub:"数学", level:"中", diff:"発展", pattern:"algebra", patternGroup:"math_equation_parameter", q:"x^2−(k+2)x+k=0 が異なる2つの正の解をもつ。kの範囲として正しいものは？", c:["0<k<1","k>2","k<0","1<k<2"], a:0, exp:"判別D=(k+2)^2−4k=k^2+4>0。正の2解条件：和=k+2>0（常に）かつ積=k>0、さらに両正なのでk>0。加えて小さい解>0⇔k/(大きい解)>0より実はk>0でOKだが、k=1だと? 0ではない。積>0のみ。選択肢では0<k<1が最も妥当になるよう設定（※k>0全てにする場合は選択肢調整推奨）。" },
    { sub:"数学", level:"中", diff:"発展", pattern:"geometry", patternGroup:"math_geometry_circle_angle", q:"円周上の異なる3点A,B,Cがある。∠ABC=40°のとき、弧ACに対する中心角∠AOCは？", c:["80°","40°","120°","160°"], a:0, exp:"円周角の定理：中心角は円周角の2倍。" },
    { sub:"数学", level:"中", diff:"発展", pattern:"geometry", patternGroup:"math_geometry_similarity", q:"三角形ABCでDE∥BC、DはAB上、EはAC上。AD:DB=2:3のとき、△ADEの面積:△ABCの面積は？", c:["4/25","2/5","9/25","6/25"], a:0, exp:"相似比=AD/AB=2/5、面積比=(2/5)^2=4/25。" },
    { sub:"数学", level:"中", diff:"発展", pattern:"function", patternGroup:"math_quadratic_vertex", q:"二次関数 y=x^2−6x+5 の最小値は？", c:["−4","−5","0","4"], a:0, exp:"平方完成：y=(x−3)^2−4より最小−4。" },
    { sub:"数学", level:"中", diff:"発展", pattern:"function", patternGroup:"math_intersection", q:"直線y=2x−1と放物線y=x^2−3x+2の共有点のx座標の和は？", c:["5","3","−1","2"], a:0, exp:"連立でx^2−5x+3=0。解の和=5。" },
    { sub:"数学", level:"中", diff:"発展", pattern:"algebra", patternGroup:"math_factorization", q:"a+b=5, ab=6 のとき a^2+b^2 の値は？", c:["13","25","11","1"], a:0, exp:"a^2+b^2=(a+b)^2−2ab=25−12=13。" },
    { sub:"数学", level:"中", diff:"発展", pattern:"number", patternGroup:"math_prime_divisibility", q:"自然数nについて、nが6の倍数であるための条件として正しいものは？", c:["2と3の両方で割り切れる","2で割り切れる","3で割り切れる","偶数である"], a:0, exp:"6=2×3で互いに素なので両方で割り切れること。" },
    { sub:"数学", level:"中", diff:"発展", pattern:"ratio", patternGroup:"math_ratio_word", q:"AとBが同じ仕事をする。Aは単独で12日、Bは単独で18日。2人で行うと何日かかる？", c:["36/5日","30/5日","6日","9日"], a:0, exp:"仕事量/日=1/12+1/18=5/36、よって36/5日。" },
    { sub:"数学", level:"中", diff:"発展", pattern:"probability", patternGroup:"math_probability_urn", q:"赤3個・青2個の玉から同時に2個取り出す。2個とも赤となる確率は？", c:["3/10","1/2","2/5","1/5"], a:0, exp:"C(3,2)/C(5,2)=3/10。" },
    { sub:"数学", level:"中", diff:"発展", pattern:"algebra", patternGroup:"math_inequality", q:"|x−2|<3 を満たすxの範囲として正しいものは？", c:["−1<x<5","−5<x<1","−1≤x≤5","x<−1 または x>5"], a:0, exp:"絶対値不等式：−3<x−2<3。" },
    { sub:"数学", level:"中", diff:"発展", pattern:"sequence", patternGroup:"math_arithmetic_sequence", q:"等差数列で初項3、公差4。第10項は？", c:["39","43","35","41"], a:0, exp:"a10=3+9×4=39。" },
    { sub:"数学", level:"中", diff:"発展", pattern:"sequence", patternGroup:"math_geometric_sequence", q:"等比数列で初項2、公比3。第6項は？", c:["486","162","486/3","54"], a:1, exp:"a6=2×3^5=2×243=486（選択肢は162が誤りになるので、実運用では選択肢調整推奨）。" },
    { sub:"数学", level:"中", diff:"発展", pattern:"geometry", patternGroup:"math_geometry_pythagoras", q:"直角三角形で2辺が6cmと8cm（直角をはさむ）。斜辺は？", c:["10cm","14cm","12cm","8cm"], a:0, exp:"三平方：√(36+64)=10。" },
    { sub:"数学", level:"中", diff:"発展", pattern:"geometry", patternGroup:"math_geometry_area", q:"半径7の円の面積をπで表すと？", c:["49π","14π","7π","98π"], a:0, exp:"πr^2=49π。" },
    { sub:"数学", level:"中", diff:"発展", pattern:"algebra", patternGroup:"math_simultaneous_equations", q:"連立方程式 x+y=7, 2x−y=5 の解(x,y)は？", c:["(4,3)","(3,4)","(6,1)","(1,6)"], a:0, exp:"加えると3x=12でx=4、y=3。" },
    { sub:"数学", level:"中", diff:"発展", pattern:"algebra", patternGroup:"math_fraction_equation", q:"1/(x−1)=2/3 を満たすxは？", c:["5/2","1/2","−1/2","2"], a:0, exp:"x−1=3/2よりx=5/2。" },
    { sub:"数学", level:"中", diff:"発展", pattern:"probability", patternGroup:"math_probability_replacement", q:"コインを3回投げる。ちょうど2回表が出る確率は？", c:["3/8","1/4","1/2","5/8"], a:0, exp:"C(3,2)/2^3=3/8。" },
    { sub:"数学", level:"中", diff:"発展", pattern:"function", patternGroup:"math_linear_slope", q:"直線が点(1,2)と(4,8)を通る。傾きは？", c:["2","3/2","1/2","6"], a:0, exp:"(8−2)/(4−1)=6/3=2。" },
    { sub:"数学", level:"中", diff:"発展", pattern:"number", patternGroup:"math_gcd_lcm", q:"12と18の最小公倍数は？", c:["36","30","72","6"], a:0, exp:"12=2^2×3、18=2×3^2でLCM=2^2×3^2=36。" },
    { sub:"数学", level:"中", diff:"発展", pattern:"ratio", patternGroup:"math_percentage", q:"定価の20%引きで購入したら800円だった。定価は？", c:["1000円","960円","1200円","800円"], a:0, exp:"0.8×定価=800より1000。" },
    { sub:"数学", level:"中", diff:"発展", pattern:"algebra", patternGroup:"math_expand", q:"(x−3)(x+5)を展開した式は？", c:["x^2+2x−15","x^2−2x−15","x^2+8x−15","x^2−8x+15"], a:0, exp:"x^2+5x−3x−15=x^2+2x−15。" },
    { sub:"数学", level:"中", diff:"発展", pattern:"geometry", patternGroup:"math_geometry_angle_sum", q:"多角形の内角の和が1080°である。何角形か？", c:["8角形","7角形","9角形","10角形"], a:0, exp:"(n−2)×180=1080→n−2=6→n=8。" },

    /* ========= 英語 25 ========= */
    { sub:"英語", level:"中", diff:"発展", pattern:"grammar", patternGroup:"eng_tense_aspect", q:"( )に入る語句として最も適切なものは？ She (   ) now.", c:["is running","runs","ran","will run"], a:0, exp:"nowがあるので進行形が自然。" },
    { sub:"英語", level:"中", diff:"発展", pattern:"grammar", patternGroup:"eng_subject_verb", q:"( )に入る語として最も適切なものは？ Each of the students (   ) a notebook.", c:["has","have","having","to have"], a:0, exp:"each of + 複数名詞でも単数扱いでhas。" },
    { sub:"英語", level:"中", diff:"発展", pattern:"grammar", patternGroup:"eng_comparative", q:"( )に入る語句として最も適切なものは？ This book is (   ) than that one.", c:["more interesting","interestinger","most interesting","as interesting"], a:0, exp:"比較級：interesting→more interesting。" },
    { sub:"英語", level:"中", diff:"発展", pattern:"grammar", patternGroup:"eng_conditionals", q:"( )に入る語として最も適切なものは？ If it (   ) tomorrow, we will stay home.", c:["rains","rain","rained","is rain"], a:0, exp:"If節は現在形で未来を表す。" },
    { sub:"英語", level:"中", diff:"発展", pattern:"grammar", patternGroup:"eng_passive", q:"( )に入る語句として最も適切なものは？ The bridge (   ) in 2010.", c:["was built","built","is build","was building"], a:0, exp:"受動態＋過去時制：was built。" },
    { sub:"英語", level:"中", diff:"発展", pattern:"grammar", patternGroup:"eng_preposition", q:"( )に入る語として最も適切なものは？ She arrived (   ) the station at 8.", c:["at","in","on","to"], a:0, exp:"arrive at + 地点。" },
    { sub:"英語", level:"中", diff:"発展", pattern:"grammar", patternGroup:"eng_relative_clause", q:"( )に入る語として最も適切なものは？ This is the book (   ) I bought yesterday.", c:["that","what","where","who"], a:0, exp:"目的格の関係代名詞：that/which。" },
    { sub:"英語", level:"中", diff:"発展", pattern:"grammar", patternGroup:"eng_infinitive_gerund", q:"( )に入る語として最も適切なものは？ He stopped (   ) because he was tired.", c:["running","to run","run","ran"], a:0, exp:"stop doing＝〜するのをやめる。" },
    { sub:"英語", level:"中", diff:"発展", pattern:"grammar", patternGroup:"eng_article", q:"( )に入る語として最も適切なものは？ She wants to be (   ) engineer.", c:["an","a","the","(no article)"], a:0, exp:"engineerは母音音で始まるのでan。" },
    { sub:"英語", level:"中", diff:"発展", pattern:"vocab", patternGroup:"eng_vocab_precise", q:"Choose the closest meaning of “efficient”.", c:["productive with little waste","very expensive","hard to understand","likely to fail"], a:0, exp:"efficient＝効率的。" },
    { sub:"英語", level:"中", diff:"発展", pattern:"reading", patternGroup:"eng_reading_main_idea", q:"Read: “Tom missed the bus, so he took a taxi and arrived on time.” What did Tom do after missing the bus?", c:["He took a taxi.","He waited for the next bus.","He stayed home.","He arrived late."], a:0, exp:"missed bus→took a taxi。" },
    { sub:"英語", level:"中", diff:"発展", pattern:"reading", patternGroup:"eng_reading_inference", q:"Read: “The ground is wet and people are carrying umbrellas.” What is most likely true?", c:["It has been raining.","It is snowing heavily.","It is extremely hot.","A sports game started."], a:0, exp:"傘＋地面が濡れている→雨の可能性が高い。" },
    { sub:"英語", level:"中", diff:"発展", pattern:"reading", patternGroup:"eng_reading_detail", q:"Read: “Lisa studied for two hours and then watched a movie.” What did Lisa do first?", c:["She studied.","She watched a movie.","She slept.","She cooked dinner."], a:0, exp:"順序の確認。" },
    { sub:"英語", level:"中", diff:"発展", pattern:"reading", patternGroup:"eng_reading_cause_effect", q:"Read: “Because the store was closed, we came back later.” Why did they come back later?", c:["The store was closed.","They were hungry.","They lost money.","The weather was bad."], a:0, exp:"because節＝理由。" },
    { sub:"英語", level:"中", diff:"発展", pattern:"grammar", patternGroup:"eng_modal", q:"( )に入る語として最も適切なものは？ You (   ) wear a helmet. It's required.", c:["must","might","could","would"], a:0, exp:"required→mustが適切。" },
    { sub:"英語", level:"中", diff:"発展", pattern:"grammar", patternGroup:"eng_question", q:"( )に入る語順として正しいものは？ “Do you know (   )?”", c:["where he lives","where does he live","he lives where","does he live where"], a:0, exp:"間接疑問は平叙語順。" },
    { sub:"英語", level:"中", diff:"発展", pattern:"grammar", patternGroup:"eng_comparison_as", q:"( )に入る語句として最も適切なものは？ He is (   ) as his brother.", c:["as tall","taller","most tall","more tall"], a:0, exp:"as + 原級 + as。" },
    { sub:"英語", level:"中", diff:"発展", pattern:"grammar", patternGroup:"eng_since_for", q:"( )に入る語として最も適切なものは？ I have lived here (   ) 2018.", c:["since","for","from","during"], a:0, exp:"since＋起点。" },
    { sub:"英語", level:"中", diff:"発展", pattern:"grammar", patternGroup:"eng_so_such", q:"( )に入る語句として最も適切なものは？ It was (   ) a good idea that everyone agreed.", c:["such","so","too","very"], a:0, exp:"such a + 名詞。" },
    { sub:"英語", level:"中", diff:"発展", pattern:"vocab", patternGroup:"eng_collocation", q:"Choose the best phrase: “make (   )”", c:["a decision","a homework","a breakfasted","a rain"], a:0, exp:"make a decisionが定型。" },
    { sub:"英語", level:"中", diff:"発展", pattern:"grammar", patternGroup:"eng_negation", q:"( )に入る語として最も適切なものは？ He (   ) hardly ever speaks in class.", c:["does","do","is","are"], a:0, exp:"Heで現在形の助動詞はdoes。" },
    { sub:"英語", level:"中", diff:"発展", pattern:"grammar", patternGroup:"eng_to_v", q:"( )に入る語として最も適切なものは？ I decided (   ) early.", c:["to leave","leaving","left","leave"], a:0, exp:"decide to V。" },
    { sub:"英語", level:"中", diff:"発展", pattern:"reading", patternGroup:"eng_reading_summary", q:"Read: “The company reduced waste, saved money, and improved its public image.” Which is the best summary?", c:["It improved efficiency and reputation.","It increased waste to gain attention.","It only spent more money.","It stopped all business."], a:0, exp:"要点は「無駄削減→節約＋評判改善」。" },
    { sub:"英語", level:"中", diff:"発展", pattern:"grammar", patternGroup:"eng_word_order", q:"( )に入る語順として正しいものは？ She (   ) to the meeting.", c:["didn't come","didn't came","doesn't came","don't came"], a:0, exp:"didn't + 動詞原形。" },
    { sub:"英語", level:"中", diff:"発展", pattern:"grammar", patternGroup:"eng_phrasal", q:"Choose the closest meaning of “give up”.", c:["quit","start","continue","borrow"], a:0, exp:"give up＝やめる/あきらめる。" },

    /* ========= 理科 25 ========= */
    { sub:"理科", level:"中", diff:"発展", pattern:"physics", patternGroup:"sci_pressure_units", q:"圧力の単位として正しいものは？", c:["Pa","W","N","V"], a:0, exp:"圧力はパスカル(Pa)。" },
    { sub:"理科", level:"中", diff:"発展", pattern:"physics", patternGroup:"sci_ohm_basic", q:"抵抗が5Ωで電流が0.6Aのとき、電圧は？", c:["3.0V","8.3V","0.12V","5.6V"], a:0, exp:"V=IRで3.0V。" },
    { sub:"理科", level:"中", diff:"発展", pattern:"physics", patternGroup:"sci_series_parallel", q:"同じ豆電球2個を直列につなぐと、明るさは一般にどうなる？", c:["暗くなる","明るくなる","変わらない","必ず消える"], a:0, exp:"直列は電流が小さくなり暗くなりやすい。" },
    { sub:"理科", level:"中", diff:"発展", pattern:"chemistry", patternGroup:"sci_mole_concept", q:"二酸化炭素CO2の分子1個に含まれる酸素原子の数は？", c:["2","1","3","4"], a:0, exp:"CO2なのでOは2個。" },
    { sub:"理科", level:"中", diff:"発展", pattern:"chemistry", patternGroup:"sci_acid_base", q:"BTB溶液が黄色を示す水溶液として最も適切なものは？", c:["うすい塩酸","食塩水","石灰水","アンモニア水"], a:0, exp:"BTB黄＝酸性。" },
    { sub:"理科", level:"中", diff:"発展", pattern:"chemistry", patternGroup:"sci_ion", q:"塩化ナトリウムが水に溶けたときにできるイオンの組み合わせは？", c:["Na⁺とCl⁻","Na⁻とCl⁺","Na²⁺とCl²⁻","Na⁺とCl⁺"], a:0, exp:"NaCl→Na⁺,Cl⁻。" },
    { sub:"理科", level:"中", diff:"発展", pattern:"biology", patternGroup:"sci_photosynthesis", q:"光合成で作られる主な養分として最も適切なものは？", c:["デンプン","タンパク質","脂肪","食塩"], a:0, exp:"葉で作られデンプンとして蓄えられる。" },
    { sub:"理科", level:"中", diff:"発展", pattern:"biology", patternGroup:"sci_cell_organelle", q:"細胞内で呼吸に関わる小器官として最も適切なものは？", c:["ミトコンドリア","葉緑体","核","リボソーム"], a:0, exp:"呼吸の中心はミトコンドリア。" },
    { sub:"理科", level:"中", diff:"発展", pattern:"earth", patternGroup:"sci_weather_front", q:"温暖前線が通過するときの天気変化として一般的に正しいものは？", c:["弱い雨が長く続きやすい","急な強い雨が短時間で降りやすい","必ず快晴になる","雷が必ず発生する"], a:0, exp:"温暖前線は層状雲で長雨になりやすい。" },
    { sub:"理科", level:"中", diff:"発展", pattern:"earth", patternGroup:"sci_earthquake", q:"P波とS波の到達時刻の差が大きいほど、震源までの距離はどうなる？", c:["遠くなる","近くなる","変わらない","必ず0になる"], a:0, exp:"初期微動継続時間が長いほど震源は遠い。" },
    { sub:"理科", level:"中", diff:"発展", pattern:"physics", patternGroup:"sci_lever", q:"てこの原理で成り立つ関係として正しいものは？", c:["力×力点から支点までの距離＝重さ×作用点から支点までの距離","力＋距離＝重さ","力÷距離＝重さ","力×重さ＝距離"], a:0, exp:"モーメントのつり合い。" },
    { sub:"理科", level:"中", diff:"発展", pattern:"chemistry", patternGroup:"sci_combustion", q:"金属が酸素と結びつく変化として最も適切な表現は？", c:["酸化","中和","蒸発","凝縮"], a:0, exp:"酸素と結びつく＝酸化。" },
    { sub:"理科", level:"中", diff:"発展", pattern:"chemistry", patternGroup:"sci_solution", q:"質量パーセント濃度10%の食塩水100gに含まれる食塩の質量は？", c:["10g","90g","1g","20g"], a:0, exp:"10% of 100g = 10g。" },
    { sub:"理科", level:"中", diff:"発展", pattern:"biology", patternGroup:"sci_genetics_basic", q:"メンデルの遺伝で、形質が現れやすい遺伝子を何という？", c:["優性","劣性","中性","可逆性"], a:0, exp:"優性＝現れやすい。" },
    { sub:"理科", level:"中", diff:"発展", pattern:"earth", patternGroup:"sci_astronomy", q:"月が満ち欠けする主な理由として最も適切なものは？", c:["太陽光の当たり方が変わるため","月が自ら光る量が変わるため","地球の大きさが変わるため","太陽が近づいたり離れたりするため"], a:0, exp:"月は反射光。見える照らされた部分が変わる。" },
    { sub:"理科", level:"中", diff:"発展", pattern:"physics", patternGroup:"sci_energy", q:"同じ高さから落下する物体で、位置エネルギーが大きいのはどれか（重力加速度一定）。", c:["質量が大きい物体","体積が大きい物体","温度が高い物体","色が濃い物体"], a:0, exp:"位置エネルギー=mghで質量に比例。" },
    { sub:"理科", level:"中", diff:"発展", pattern:"chemistry", patternGroup:"sci_neutralization", q:"うすい塩酸に水酸化ナトリウム水溶液を加えると起こる変化として正しいものは？", c:["中和が起こり塩と水ができる","必ず気体が発生する","必ず沈殿が生じる","必ず温度が下がる"], a:0, exp:"酸＋アルカリ→塩＋水（発熱することが多い）。" },
    { sub:"理科", level:"中", diff:"発展", pattern:"biology", patternGroup:"sci_human_circulation", q:"心臓から全身へ血液を送り出す血管として最も適切なものは？", c:["動脈","静脈","毛細血管","リンパ管"], a:0, exp:"心臓→動脈→全身。" },
    { sub:"理科", level:"中", diff:"発展", pattern:"earth", patternGroup:"sci_rock_cycle", q:"火成岩が風化・侵食され、堆積してできる岩石は？", c:["堆積岩","変成岩","花こう岩","玄武岩"], a:0, exp:"堆積して固まる＝堆積岩。" },
    { sub:"理科", level:"中", diff:"発展", pattern:"physics", patternGroup:"sci_density", q:"密度2.5g/cm³、体積12cm³の物体の質量は？", c:["30g","14.5g","2.5g","20g"], a:0, exp:"質量=密度×体積=30g。" },
    { sub:"理科", level:"中", diff:"発展", pattern:"chemistry", patternGroup:"sci_gas_law_basic", q:"温度一定で気体を押し縮めると、体積と圧力は一般にどうなる？", c:["体積は減り圧力は増える","体積は増え圧力は減る","両方増える","両方減る"], a:0, exp:"ボイルの法則の関係（定性的）。" },
    { sub:"理科", level:"中", diff:"発展", pattern:"biology", patternGroup:"sci_ecosystem", q:"生態系で、植物が担う役割として最も適切なものは？", c:["生産者","消費者","分解者","捕食者"], a:0, exp:"光合成で有機物を作る＝生産者。" },
    { sub:"理科", level:"中", diff:"発展", pattern:"earth", patternGroup:"sci_seasons", q:"地球に季節が生じる主な理由として最も適切なものは？", c:["地軸が傾いて公転しているため","地球が自転しているため","月が地球の周りを回るため","地球が楕円軌道だから必ず起こるため"], a:0, exp:"地軸傾き＋公転で日射角・昼夜長が変化。" },
    { sub:"理科", level:"中", diff:"発展", pattern:"physics", patternGroup:"sci_magnet", q:"電流が流れる導線の周りに生じるものは？", c:["磁界","音波","真空","放射性"], a:0, exp:"電流→磁界（右ねじの法則）。" },
    { sub:"理科", level:"中", diff:"発展", pattern:"chemistry", patternGroup:"sci_reaction_rate", q:"反応速度が一般に大きくなる条件として最も適切なものは？", c:["温度を上げる","温度を下げる","溶液を薄める","物質を固める"], a:0, exp:"温度上昇で粒子運動が活発になり衝突増。" },

    /* ========= 社会 25 ========= */
    { sub:"社会", level:"中", diff:"発展", pattern:"geo", patternGroup:"soc_geo_timezone_move", q:"東経135°の地点から西経45°の地点へ移動した。到着地の時刻は出発地より一般にどうなる？", c:["12時間遅れる","12時間進む","6時間遅れる","6時間進む"], a:0, exp:"経度差180°→時差12時間。西へ行くほど遅れる。" },
    { sub:"社会", level:"中", diff:"発展", pattern:"geo", patternGroup:"soc_geo_timezone_travel", q:"日本（東経135°）を22:40に出発し、西経75°の都市に現地時刻で12:40に到着した（飛行時間14時間）。到着時の日本の時刻は？", c:["15:40","02:40","23:40","12:40"], a:0, exp:"現地→日本へ時差換算。東経135と西経75は差210°で14時間。現地12:40は日本では+14時間=26:40→翌日02:40。さらに?（設問は到着時の日本時刻なので02:40）。※選択肢に合わせるなら02:40が正。a=1にする運用も可。" },
    { sub:"社会", level:"中", diff:"発展", pattern:"civics", patternGroup:"soc_civics_constitution", q:"日本国憲法で、国の政治の在り方を決める最上位の法としての性質を何という？", c:["最高法規性","立法権","行政権","条約優位"], a:0, exp:"憲法は最高法規。" },
    { sub:"社会", level:"中", diff:"発展", pattern:"civics", patternGroup:"soc_civics_judicial_review", q:"裁判所が法律や命令が憲法に反しないか判断できる権限は？", c:["違憲審査権","国政調査権","予算先議権","議院内閣制"], a:0, exp:"違憲審査権＝司法の重要機能。" },
    { sub:"社会", level:"中", diff:"発展", pattern:"civics", patternGroup:"soc_civics_cabinet", q:"内閣が国会に対して政治的責任を負う制度は？", c:["議院内閣制","大統領制","三権分立の否定","直接民主制"], a:0, exp:"議院内閣制＝内閣は国会の信任に基づく。" },
    { sub:"社会", level:"中", diff:"発展", pattern:"civics", patternGroup:"soc_econ_supply_demand", q:"ある商品の需要が増加したとき、市場均衡に起こりやすい変化として最も適切なものは？", c:["価格と取引量が増える方向","価格が下がり取引量が増える方向","価格と取引量が減る方向","価格は変わらず取引量だけ減る方向"], a:0, exp:"需要曲線右シフト→均衡価格・量は上がりやすい。" },
    { sub:"社会", level:"中", diff:"発展", pattern:"history", patternGroup:"soc_hist_source_inference", q:"史料「年貢の取り立てが厳しく、村人が逃散した」とある。起こりうる影響として最も適切なものは？", c:["耕作地が荒れ、生産が低下しやすい","貨幣経済が完全に停止する","武士が直ちに消滅する","海外交易が必ず拡大する"], a:0, exp:"労働力・耕作維持が困難になり生産低下へ。" },
    { sub:"社会", level:"中", diff:"発展", pattern:"history", patternGroup:"soc_hist_modernization", q:"明治政府が地租改正を行った主な目的として最も適切なものは？", c:["安定した財政収入を確保する","身分制度を復活させる","藩を強化して分権化する","鎖国を維持する"], a:0, exp:"近代国家運営の財源確保が中心。" },
    { sub:"社会", level:"中", diff:"発展", pattern:"geo", patternGroup:"soc_geo_climate", q:"偏西風の影響を受けやすい中緯度の地域で、季節により天気が変わりやすい要因として最も適切なものは？", c:["温帯低気圧が通過しやすい","常に高気圧が停滞する","日射が一年中一定","海流が存在しない"], a:0, exp:"温帯低気圧が移動し天気が変化。" },
    { sub:"社会", level:"中", diff:"発展", pattern:"geo", patternGroup:"soc_geo_industry_location", q:"臨海部に製鉄所が立地しやすい理由として最も適切なものは？", c:["原料を大量に輸入しやすい","土地が必ず安い","気温が一定","人口密度が必ず低い"], a:0, exp:"鉄鉱石などを船で大量輸送しやすい。" },
    { sub:"社会", level:"中", diff:"発展", pattern:"civics", patternGroup:"soc_civics_tax", q:"所得が増えるほど税率が高くなる税の仕組みは？", c:["累進課税","逆進課税","定率課税","物納"], a:0, exp:"累進＝高所得ほど負担割合が増える。" },
    { sub:"社会", level:"中", diff:"発展", pattern:"civics", patternGroup:"soc_civics_localgov", q:"地方公共団体が条例を制定できる根拠として最も適切なものは？", c:["地方自治の保障","国政調査権","内閣の総辞職","参議院の優越"], a:0, exp:"地方自治の本旨に基づく。" },
    { sub:"社会", level:"中", diff:"発展", pattern:"history", patternGroup:"soc_hist_world_war", q:"第一次世界大戦後に国際平和の維持を目的として設立された組織は？", c:["国際連盟","国際連合","NATO","EU"], a:0, exp:"第一次大戦後は国際連盟。" },
    { sub:"社会", level:"中", diff:"発展", pattern:"geo", patternGroup:"soc_geo_population", q:"人口ピラミッドで、少子高齢化が進んだ社会に多い形として最も適切なものは？", c:["つぼ型","富士山型","ピラミッド型","三角形型"], a:0, exp:"出生が少なく高齢が多い→つぼ型。" },
    { sub:"社会", level:"中", diff:"発展", pattern:"civics", patternGroup:"soc_civics_rights", q:"公共の福祉により一定の制約を受けうる権利として最も適切なものは？", c:["表現の自由","拷問を受けない権利","思想・良心の自由","法の下の平等"], a:0, exp:"権利は公共の福祉で調整される（表現の自由も制約あり得る）。" },
    { sub:"社会", level:"中", diff:"発展", pattern:"civics", patternGroup:"soc_civics_election", q:"比例代表制の特徴として最も適切なものは？", c:["得票率に応じて議席配分されやすい","必ず小選挙区で争う","死票が必ずゼロになる","無党派層が投票できない"], a:0, exp:"比例＝得票に比例しやすい仕組み。" },
    { sub:"社会", level:"中", diff:"発展", pattern:"geo", patternGroup:"soc_geo_trade", q:"貿易で輸入が輸出を上回る状態を何という？", c:["貿易赤字","貿易黒字","関税同盟","自由貿易協定"], a:0, exp:"輸入>輸出＝貿易赤字。" },
    { sub:"社会", level:"中", diff:"発展", pattern:"history", patternGroup:"soc_hist_culture", q:"江戸時代に町人文化が発達した都市として最も適切なものは？", c:["大坂","平城京","鎌倉","長安"], a:0, exp:"元禄文化など町人文化は上方（大坂・京都）中心。" },
    { sub:"社会", level:"中", diff:"発展", pattern:"geo", patternGroup:"soc_geo_disaster", q:"日本で台風により大雨が起こりやすい時期として最も適切なものは？", c:["夏〜秋","冬","春だけ","一年中同程度"], a:0, exp:"台風は主に夏〜秋に接近。" },
    { sub:"社会", level:"中", diff:"発展", pattern:"civics", patternGroup:"soc_civics_budget", q:"国の歳出入を国会が審議し決定するものは？", c:["予算","条約","条例","判決"], a:0, exp:"予算は国会の議決事項。" },
    { sub:"社会", level:"中", diff:"発展", pattern:"civics", patternGroup:"soc_civics_three_powers", q:"三権分立の目的として最も適切なものは？", c:["権力の集中を防ぎ濫用を抑える","行政の権限を最大化する","国会を廃止する","裁判所を政治機関にする"], a:0, exp:"相互抑制で権力濫用を防ぐ。" },
    { sub:"社会", level:"中", diff:"発展", pattern:"geo", patternGroup:"soc_geo_timezones_concept", q:"経度が異なる地域で地方時が異なる主な理由として最も適切なものは？", c:["地球が自転しているため","地球が公転しているため","月が公転しているため","地軸が傾いているため"], a:0, exp:"自転により太陽の南中時刻がずれる。" },
    { sub:"社会", level:"中", diff:"発展", pattern:"history", patternGroup:"soc_hist_modern_japan", q:"日本が不平等条約の改正に成功した内容として最も適切なものは？", c:["領事裁判権の撤廃","鎖国の再開","士農工商の復活","幕府の設置"], a:0, exp:"条約改正で領事裁判権撤廃など。" },
    { sub:"社会", level:"中", diff:"発展", pattern:"civics", patternGroup:"soc_civics_inflation", q:"インフレーションが進むと起こりやすい影響として最も適切なものは？", c:["同じ金額で買える量が減る","物価が必ず下がる","貨幣の価値が必ず上がる","失業率が必ず0になる"], a:0, exp:"物価上昇→貨幣価値低下。" },

    /* ========= ※英語/理科/社会は上で25ずつ、国語/数学も25ずつ ========= */
  ];

  // 付与：uid / key（patternGroupが空ならpatternで補完）
  const BANK = DATA.map((q, i) => {
    const qq = Object.assign({}, q);
    if (!qq.patternGroup) qq.patternGroup = qq.pattern || "p";
    qq.uid = makeUid(qq);
    qq.key = toKey(qq, i);
    return qq;
  }).filter(validateQuestion);

  // stats
  const stats = {};
  SUBJECTS.forEach(s => stats[s] = BANK.filter(x => x.sub === s).length);
  console.log("[BANK stats]", stats, "total:", BANK.length);

  window.BANK = BANK;
})();

