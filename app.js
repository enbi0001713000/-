/* app.js
   義務教育 5教科クイズ（25問）— 出題/採点/解説/分析/履歴（この端末）/レーダー/最近10回推移
   重要：index.html 側のIDが環境により異なる可能性があるため、複数候補IDに対応する“防御的実装”です。
*/

(() => {
  "use strict";

  /* =========================
   * 設定（合言葉・保存キー等）
   * ========================= */
  // 合言葉（0217）を“見えにくく”して保持（完全秘匿ではありません：クライアントのみの簡易ロック）
  const PASSPHRASE = String.fromCharCode(48, 50, 49, 55); // "0217"

  const LS_UNLOCK = "quiz_unlock_v1";
  const LS_HISTORY = "quiz_history_v1";

  // 履歴保持数（端末内）
  const HISTORY_MAX = 50;

  // 出題数
  const SUBJECTS = ["国語", "数学", "英語", "理科", "社会"];
  const QUIZ_PER_SUBJECT = 5;
  const TOTAL_Q = SUBJECTS.length * QUIZ_PER_SUBJECT;

  // 難易度比率（基礎2割・標準5割・発展3割）
  const DIFF_TARGET = { "基礎": 0.2, "標準": 0.5, "発展": 0.3 };
  const DIFFS = ["基礎", "標準", "発展"];

  /* =========================
   * DOM ユーティリティ
   * ========================= */
  const byId = (id) => document.getElementById(id);

  const firstEl = (...candidates) => {
    for (const c of candidates.flat()) {
      if (!c) continue;
      const el = typeof c === "string" ? byId(c) : c;
      if (el) return el;
    }
    return null;
  };

  const firstBtnByText = (needle) => {
    const btns = [...document.querySelectorAll("button")];
    return btns.find((b) => (b.textContent || "").trim().includes(needle)) || null;
  };

  const showEl = (el) => { if (el) el.style.display = ""; };
  const hideEl = (el) => { if (el) el.style.display = "none"; };

  const safeSetText = (el, txt) => { if (el) el.textContent = txt; };
  const safeSetHTML = (el, html) => { if (el) el.innerHTML = html; };

  const clamp01 = (x) => Math.max(0, Math.min(1, x));

  const nowMs = () => Date.now();

  /* =========================
   * 要素参照（候補IDを広めに）
   * ========================= */
  const UI = {
    // ロック解除
    unlockCard: () => firstEl("unlockCard", "cardUnlock", "unlockSection", "sectionUnlock"),
    passInput: () => firstEl("passInput", "passphrase", "unlockInput", "pass"),
    btnUnlock: () => firstEl("btnUnlock", "unlockBtn", "btnPass", "btnUnlockPass") || firstBtnByText("ロック解除"),

    // フィルタ
    filterCard: () => firstEl("filterCard", "filtersCard", "tagCard", "sectionFilters"),
    // 学年帯
    chkGradeE: () => firstEl("chkGradeE", "gradeE", "tagGradeE", "chkElementary"),
    chkGradeJ: () => firstEl("chkGradeJ", "gradeJ", "tagGradeJ", "chkJunior"),
    // 難易度
    chkDiffB: () => firstEl("chkDiffB", "diffBasic", "tagDiffBasic"),
    chkDiffN: () => firstEl("chkDiffN", "diffNormal", "tagDiffNormal"),
    chkDiffA: () => firstEl("chkDiffA", "diffAdvanced", "tagDiffAdvanced"),
    // オプション
    chkAvoidSimilar: () => firstEl("chkAvoidSimilar", "avoidSimilar", "tagAvoidSimilar"),
    chkNoDup: () => firstEl("chkNoDup", "noDupIn25", "tagNoDup"),

    // トップボタン
    btnNew: () => firstEl("btnNew", "btnNewQuiz") || firstBtnByText("新しいクイズ"),
    btnReset: () => firstEl("btnReset", "btnResetAnswers") || firstBtnByText("解答リセット"),
    btnGrade: () => firstEl("btnGrade", "btnToResult", "btnScore") || firstBtnByText("採点して結果へ"),
    // 追加：右上に置く「履歴」ボタン（index.html側で追加）
    btnHistoryTop: () => firstEl("btnHistoryTop") || firstBtnByText("履歴"),

    // 画面領域
    quizView: () => firstEl("viewQuiz", "quizView", "sectionQuiz", "quizSection"),
    resultView: () => firstEl("viewResult", "resultView", "sectionResult", "resultSection"),
    // クイズ表示
    qNo: () => firstEl("qNo", "quizNo", "questionNo"),
    qMeta: () => firstEl("qMeta", "quizMeta", "questionMeta"),
    qText: () => firstEl("qText", "quizText", "questionText"),
    choices: () => firstEl("choices", "choiceList", "options"),
    btnPrev: () => firstEl("btnPrev", "prevBtn") || firstBtnByText("前へ"),
    btnNext: () => firstEl("btnNext", "nextBtn") || firstBtnByText("次へ"),

    // 結果表示
    resultSummary: () => firstEl("resultSummary", "summary", "scoreSummary"),
    radarCanvas: () => firstEl("radarCanvas", "radar", "radarChart"),
    analysisText: () => firstEl("analysisText", "aiAnalysis", "analysis"),
    breakdown: () => firstEl("breakdown", "detailBreakdown", "resultBreakdown"),
    explainList: () => firstEl("explainList", "explanations", "explainButtons"),
    explainBox: () => firstEl("explainBox", "explainDetail", "explainPanel"),

    // 履歴
    btnToggleHistory: () => firstEl("btnToggleHistory", "btnHistory", "btnHistoryOpen") || firstBtnByText("履歴を表示"),
    historyPanel: () => firstEl("historyPanel", "historySection", "history", "panelHistory"),
    historyStats: () => firstEl("historyStats", "historySummary", "historyAverages"),
    historyList: () => firstEl("historyList", "historyItems"),
    historyCanvas: () => firstEl("historyCanvas", "historyChart", "lineCanvas"),
    btnClearHistory: () => firstEl("btnClearHistory", "historyClear") || firstBtnByText("履歴を全削除"),
  };

  /* =========================
   * データ（bank.js 互換ロード）
   * ========================= */
  function loadBank() {
    // 想定：bank.js が以下のいずれかを提供
    // 1) window.BANK = [q,...]
    // 2) window.getBank() => [q,...]
    // 3) window.buildBank() => [q,...]
    // 4) window.BANK_BY_SUBJECT = {国語:[...], ...} など
    let bank = null;

    if (Array.isArray(window.BANK)) bank = window.BANK;
    if (!bank && typeof window.getBank === "function") bank = window.getBank();
    if (!bank && typeof window.buildBank === "function") bank = window.buildBank();

    if (!bank && window.BANK_BY_SUBJECT && typeof window.BANK_BY_SUBJECT === "object") {
      const arr = [];
      for (const k of Object.keys(window.BANK_BY_SUBJECT)) {
        const v = window.BANK_BY_SUBJECT[k];
        if (Array.isArray(v)) arr.push(...v);
      }
      bank = arr;
    }

    if (!Array.isArray(bank)) {
      console.error("[app.js] 問題バンクを読み込めませんでした。bank.js の公開API（BANK / getBank / buildBank 等）を確認してください。");
      return [];
    }

    // key が無い場合は付与（重複排除用）
    bank.forEach((q, i) => {
      if (!q) return;
      if (!q.key) q.key = `${q.sub || "?"}|${q.level || "?"}|${q.diff || "?"}|${q.pattern || "p"}|${(q.q || "").slice(0, 20)}|${i}`;
    });

    return bank;
  }

  const BANK = loadBank();

  /* =========================
   * 状態
   * ========================= */
  const state = {
    unlocked: false,
    quiz: [],           // 25問
    answers: [],        // { chosen, timeMs, visits }
    i: 0,               // 現在問
    shownAt: 0,         // 表示開始時刻
    startedAt: 0,       // クイズ開始
    graded: false,
  };

  /* =========================
   * LocalStorage（履歴）
   * ========================= */
  function loadHistory() {
    try {
      const raw = localStorage.getItem(LS_HISTORY);
      const arr = raw ? JSON.parse(raw) : [];
      return Array.isArray(arr) ? arr : [];
    } catch {
      return [];
    }
  }

  function saveHistory(arr) {
    try {
      localStorage.setItem(LS_HISTORY, JSON.stringify(arr));
    } catch {}
  }

  function appendHistory(snapshot) {
    const arr = loadHistory();
    arr.unshift(snapshot);
    if (arr.length > HISTORY_MAX) arr.length = HISTORY_MAX;
    saveHistory(arr);
  }

  /* =========================
   * ロック解除
   * ========================= */
  function isUnlocked() {
    return localStorage.getItem(LS_UNLOCK) === "1";
  }

  function setUnlocked() {
    localStorage.setItem(LS_UNLOCK, "1");
  }

  function updateLockUI() {
    const unlockCard = UI.unlockCard();
    const filterCard = UI.filterCard();
    const quizView = UI.quizView();
    const resultView = UI.resultView();

    if (state.unlocked) {
      hideEl(unlockCard);
      showEl(filterCard);
      showEl(quizView);
      // resultは採点時に表示でもOK。ここでは非表示に戻しておく。
      if (resultView) resultView.style.display = "none";
    } else {
      showEl(unlockCard);
      // 未解除なら操作を抑制
      // フィルタ/クイズは見せる実装でも良いが、誤操作防止で隠す
      hideEl(filterCard);
      hideEl(quizView);
      hideEl(resultView);
    }
  }

  function onUnlock() {
    const input = UI.passInput();
    const pass = (input?.value || "").trim();
    if (pass === PASSPHRASE) {
      setUnlocked();
      state.unlocked = true;
      updateLockUI();
      // 解除後すぐにクイズ生成（UX良し）
      if (!state.quiz.length) newQuiz();
    } else {
      alert("合言葉が違います。");
    }
  }

  /* =========================
   * フィルタ取得
   * ========================= */
  function getSelectedGrades() {
    const e = UI.chkGradeE();
    const j = UI.chkGradeJ();
    const res = [];
    if (!e && !j) return ["小", "中"]; // 要素が見つからない場合は全対象
    if (e && e.checked) res.push("小");
    if (j && j.checked) res.push("中");
    return res.length ? res : ["小", "中"];
  }

  function getSelectedDiffs() {
    const b = UI.chkDiffB();
    const n = UI.chkDiffN();
    const a = UI.chkDiffA();
    const res = [];
    if (!b && !n && !a) return ["基礎", "標準", "発展"];
    if (b && b.checked) res.push("基礎");
    if (n && n.checked) res.push("標準");
    if (a && a.checked) res.push("発展");
    return res.length ? res : ["基礎", "標準", "発展"];
  }

  function getOptions() {
    const avoidSimilar = UI.chkAvoidSimilar();
    const noDup = UI.chkNoDup();
    return {
      avoidSimilar: avoidSimilar ? !!avoidSimilar.checked : true,
      noDup: noDup ? !!noDup.checked : true,
    };
  }

  /* =========================
   * 出題ロジック
   * ========================= */
  function shuffle(arr) {
    for (let i = arr.length - 1; i > 0; i--) {
      const j = (Math.random() * (i + 1)) | 0;
      [arr[i], arr[j]] = [arr[j], arr[i]];
    }
    return arr;
  }

  function scoreCandidate(q, usedKeys, patternCount, opts) {
    // 低いほど良い（選ばれやすい）
    let s = 0;

    if (opts.noDup && usedKeys.has(q.key)) s += 1e9;

    if (opts.avoidSimilar) {
      const p = q.pattern || "p";
      s += (patternCount.get(p) || 0) * 10;
    }

    // わずかにランダムノイズ
    s += Math.random();
    return s;
  }

  function pickByDifficulty(cands, n, selectedDiffs) {
    // selectedDiffs の中で、比率に沿うように n 問選ぶ（足りない場合は埋める）
    const pools = new Map(DIFFS.map((d) => [d, []]));
    for (const q of cands) {
      if (!selectedDiffs.includes(q.diff)) continue;
      pools.get(q.diff)?.push(q);
    }
    for (const d of DIFFS) shuffle(pools.get(d));

    const target = {};
    // 理想配分（丸め）
    for (const d of DIFFS) target[d] = Math.round(n * (DIFF_TARGET[d] || 0));
    // 端数調整
    let sum = DIFFS.reduce((t, d) => t + target[d], 0);
    while (sum < n) { target["標準"] += 1; sum++; }
    while (sum > n) { target["標準"] -= 1; sum--; }

    const out = [];
    // まず目標通り
    for (const d of DIFFS) {
      const pool = pools.get(d) || [];
      const k = Math.min(target[d], pool.length);
      out.push(...pool.slice(0, k));
      pools.set(d, pool.slice(k));
    }
    // 足りない分は残りから埋める
    while (out.length < n) {
      const rest = [];
      for (const d of DIFFS) rest.push(...(pools.get(d) || []));
      if (!rest.length) break;
      out.push(rest.shift());
      // rest を消費した分を pools 側にも反映（雑でもOK：埋め優先）
      // 再構築
      for (const d of DIFFS) pools.set(d, (pools.get(d) || []).filter((q) => q !== out[out.length - 1]));
    }
    return out;
  }

  function buildQuiz() {
    const grades = getSelectedGrades();      // ["小","中"]
    const diffs = getSelectedDiffs();        // ["基礎","標準","発展"]
    const opts = getOptions();

    const usedKeys = new Set();
    const patternCount = new Map();
    const quiz = [];

    for (const sub of SUBJECTS) {
      // 候補抽出
      let cands = BANK.filter((q) =>
        q &&
        q.sub === sub &&
        grades.includes(q.level) &&
        diffs.includes(q.diff) &&
        Array.isArray(q.c) && q.c.length === 4 &&
        typeof q.a === "number"
      );

      // まず難易度配分で下準備（候補が極端に少ない場合に備えつつ）
      // ※ここで pickByDifficulty すると重複排除・pattern抑制が効きにくいので、
      //   先に“候補を拡げ”、選択時にスコアで調整する。
      if (cands.length < QUIZ_PER_SUBJECT) {
        // diffs を広げる／gradesを広げるなどは仕様次第だが、
        // ここでは不足を明示
        throw new Error(`${sub} の問題が不足しています（条件：${grades.join("/")}, ${diffs.join("/")}）`);
      }

      // 1教科5問をスコア方式で選ぶ
      for (let k = 0; k < QUIZ_PER_SUBJECT; k++) {
        // 毎回、難易度目標に寄せるためのバイアス：不足diffを優先する
        const current = quiz.filter((q) => q.sub === sub);
        const counts = { "基礎": 0, "標準": 0, "発展": 0 };
        current.forEach((q) => counts[q.diff]++);
        const ideal = {
          "基礎": Math.round(QUIZ_PER_SUBJECT * DIFF_TARGET["基礎"]),
          "標準": Math.round(QUIZ_PER_SUBJECT * DIFF_TARGET["標準"]),
          "発展": QUIZ_PER_SUBJECT - (Math.round(QUIZ_PER_SUBJECT * DIFF_TARGET["基礎"]) + Math.round(QUIZ_PER_SUBJECT * DIFF_TARGET["標準"])),
        };
        const need = DIFFS.filter((d) => diffs.includes(d)).sort((a, b) => (ideal[b] - counts[b]) - (ideal[a] - counts[a]));
        const preferredDiff = need[0];

        // preferredDiff候補を優先、足りないなら全diff候補
        let pool = cands.filter((q) => q.diff === preferredDiff);
        if (pool.length < 1) pool = cands.slice();

        // スコアで最良を選ぶ
        let best = null;
        let bestScore = Infinity;
        for (const q of pool) {
          const s = scoreCandidate(q, usedKeys, patternCount, opts);
          if (s < bestScore) { bestScore = s; best = q; }
        }

        if (!best) break;

        quiz.push(best);
        usedKeys.add(best.key);

        const p = best.pattern || "p";
        patternCount.set(p, (patternCount.get(p) || 0) + 1);

        // 使った問題は候補から除外（同教科内重複防止）
        cands = cands.filter((q) => q.key !== best.key);
      }
    }

    // 教科ごとに固めたので、全体をシャッフル
    shuffle(quiz);

    // 念のためサイズ調整
    if (quiz.length !== TOTAL_Q) {
      throw new Error(`出題の生成に失敗しました（生成数：${quiz.length}/${TOTAL_Q}）`);
    }

    return quiz;
  }

  function newQuiz() {
    if (!state.unlocked) {
      alert("先に合言葉でロック解除してください。");
      return;
    }

    try {
      state.quiz = buildQuiz();
    } catch (e) {
      alert(String(e?.message || e));
      return;
    }

    state.answers = state.quiz.map(() => ({ chosen: null, timeMs: 0, visits: 0 }));
    state.i = 0;
    state.graded = false;
    state.startedAt = nowMs();
    state.shownAt = nowMs();

    // 表示をクイズに寄せる
    const quizView = UI.quizView();
    const resultView = UI.resultView();
    showEl(quizView);
    hideEl(resultView);

    renderQuestion();
  }

  /* =========================
   * 時間計測
   * ========================= */
  function accumulateTime() {
    if (!state.quiz.length) return;
    const a = state.answers[state.i];
    if (!a) return;
    const dt = nowMs() - (state.shownAt || nowMs());
    if (dt > 0 && dt < 60 * 60 * 1000) a.timeMs += dt;
    state.shownAt = nowMs();
  }

  /* =========================
   * クイズ描画
   * ========================= */
  function renderQuestion() {
    if (!state.quiz.length) return;

    const q = state.quiz[state.i];
    const a = state.answers[state.i];

    safeSetText(UI.qNo(), `Q${state.i + 1} / ${TOTAL_Q}`);

    const meta = [];
    if (q.sub) meta.push(q.sub);
    if (q.level) meta.push(q.level);
    if (q.diff) meta.push(q.diff);
    safeSetText(UI.qMeta(), meta.join(" ・ "));

    safeSetText(UI.qText(), q.q || "");

    // choices
    const wrap = UI.choices();
    if (wrap) {
      wrap.innerHTML = "";
      q.c.forEach((txt, idx) => {
        const btn = document.createElement("button");
        btn.type = "button";
        btn.className = "choice";
        btn.textContent = txt;

        if (a.chosen === idx) btn.classList.add("selected");

        btn.addEventListener("click", () => {
          if (!state.unlocked) return;
          // 採点後でも選び直し禁止（仕様に合わせるなら可にしてもOK）
          if (state.graded) return;
          a.chosen = idx;
          renderQuestion();
        });

        wrap.appendChild(btn);
      });
    }

    // prev/next
    const prev = UI.btnPrev();
    const next = UI.btnNext();
    if (prev) prev.disabled = state.i === 0;
    if (next) next.disabled = state.i === TOTAL_Q - 1;

    // visits
    a.visits = (a.visits || 0) + 1;
  }

  function goPrev() {
    if (!state.quiz.length) return;
    accumulateTime();
    if (state.i > 0) state.i--;
    state.shownAt = nowMs();
    renderQuestion();
  }

  function goNext() {
    if (!state.quiz.length) return;
    accumulateTime();
    if (state.i < TOTAL_Q - 1) state.i++;
    state.shownAt = nowMs();
    renderQuestion();
  }

  function resetAnswers() {
    if (!state.quiz.length) return;
    if (!state.unlocked) return;
    if (!confirm("このクイズの解答をリセットしますか？")) return;

    state.answers = state.quiz.map(() => ({ chosen: null, timeMs: 0, visits: 0 }));
    state.i = 0;
    state.graded = false;
    state.startedAt = nowMs();
    state.shownAt = nowMs();
    renderQuestion();
  }

  /* =========================
   * 採点・集計
   * ========================= */
  function gradeQuiz() {
    if (!state.quiz.length) return;
    if (!state.unlocked) return;

    // 最終滞在分を加算
    accumulateTime();

    // 未回答がある場合の扱い：そのまま採点（未回答は誤答）
    const result = computeResult();
    state.graded = true;

    // 履歴保存
    appendHistory(result.snapshot);

    // 結果表示
    renderResult(result);

    // 画面切替
    const quizView = UI.quizView();
    const resultView = UI.resultView();
    if (resultView) showEl(resultView);
    if (quizView) hideEl(quizView);
  }

  function computeResult() {
    const perSub = Object.fromEntries(SUBJECTS.map((s) => [s, { total: 0, correct: 0, timeMs: 0 }]));
    const perDiff = Object.fromEntries(DIFFS.map((d) => [d, { total: 0, correct: 0, timeMs: 0 }]));

    let correct = 0;
    let totalTime = 0;

    const times = [];

    for (let i = 0; i < state.quiz.length; i++) {
      const q = state.quiz[i];
      const a = state.answers[i];

      const chosen = a?.chosen;
      const ok = (chosen !== null && chosen === q.a);

      const t = a?.timeMs || 0;
      totalTime += t;
      times.push(t);

      if (ok) correct++;

      if (perSub[q.sub]) {
        perSub[q.sub].total++;
        if (ok) perSub[q.sub].correct++;
        perSub[q.sub].timeMs += t;
      }
      if (perDiff[q.diff]) {
        perDiff[q.diff].total++;
        if (ok) perDiff[q.diff].correct++;
        perDiff[q.diff].timeMs += t;
      }
    }

    const acc = correct / TOTAL_Q;
    const avgTime = totalTime / TOTAL_Q;

    const perSubComputed = {};
    SUBJECTS.forEach((s) => {
      const p = perSub[s];
      perSubComputed[s] = {
        total: p.total,
        correct: p.correct,
        acc: p.total ? p.correct / p.total : 0,
        avgTime: p.total ? p.timeMs / p.total : 0,
      };
    });

    const perDiffComputed = {};
    DIFFS.forEach((d) => {
      const p = perDiff[d];
      perDiffComputed[d] = {
        total: p.total,
        correct: p.correct,
        acc: p.total ? p.correct / p.total : 0,
        avgTime: p.total ? p.timeMs / p.total : 0,
      };
    });

    // 相対時間（中央値）で「速い/遅い」を判断（端末差を吸収）
    const sorted = times.slice().sort((a, b) => a - b);
    const median = sorted.length ? sorted[(sorted.length / 2) | 0] : 0;

    const analysis = buildAnalysisText(perSubComputed, acc, avgTime, median);

    const snapshot = {
      ts: new Date().toISOString(),
      total: TOTAL_Q,
      correct,
      acc,
      totalTime,
      avgTime,
      perSub: perSubComputed,
      perDiff: perDiffComputed,
    };

    return { correct, acc, totalTime, avgTime, perSub: perSubComputed, perDiff: perDiffComputed, analysis, snapshot, median };
  }

  function fmtPct(x) {
    return `${Math.round(clamp01(x) * 100)}%`;
  }

  function fmtSec(ms) {
    return `${Math.round((ms || 0) / 1000)}秒`;
  }

  function buildAnalysisText(perSub, totalAcc, avgTime, medianMs) {
    // 文章分析（軽量で“それっぽい”より実用優先）
    // 速い/遅い判定：中央値との比
    const speed = medianMs ? avgTime / medianMs : 1;

    // 弱点候補：平均より低い教科を抽出（ただし差が小さいなら「弱点なし」）
    const accs = SUBJECTS.map((s) => perSub[s]?.acc ?? 0);
    const avgAccSub = accs.reduce((a, b) => a + b, 0) / SUBJECTS.length;
    const worst = SUBJECTS
      .map((s) => ({ s, acc: perSub[s]?.acc ?? 0 }))
      .sort((a, b) => a.acc - b.acc)[0];

    const gap = avgAccSub - (worst?.acc ?? 0);

    const lines = [];
    lines.push(`総合：正答率 ${fmtPct(totalAcc)}、平均解答時間 ${fmtSec(avgTime * 1000)}（目安）。`);

    if (speed < 0.85) {
      lines.push("解答ペースは速めです。速さを維持しつつ、誤答が出やすい設問では見落とし防止（条件・単位・否定語の確認）を入れると安定します。");
    } else if (speed > 1.15) {
      lines.push("解答ペースは慎重寄りです。正解率が高ければ強みですが、時間がかかる設問では方針決定（何を使うか）を先に固定すると改善しやすいです。");
    } else {
      lines.push("解答ペースは標準的です。正確さとスピードのバランスが取れています。");
    }

    // 弱点の有無
    if (gap < 0.12) {
      lines.push("教科別の偏りは小さく、現状は「弱点なし（大きな凹みなし）」と判断できます。");
    } else {
      lines.push(`相対的に弱め：${worst.s}（${fmtPct(worst.acc)}）。同教科は「基礎→標準」の取りこぼしを潰すと伸びが出やすいです。`);
    }

    // 教科別の一言（短く）
    const top = SUBJECTS
      .map((s) => ({ s, acc: perSub[s].acc, t: perSub[s].avgTime }))
      .sort((a, b) => b.acc - a.acc)[0];
    if (top) lines.push(`強み候補：${top.s}（${fmtPct(top.acc)}）。この教科の解き方を他教科にも転用できると全体が底上げされます。`);

    return lines.join("\n");
  }

  /* =========================
   * 結果描画（サマリ・内訳・解説）
   * ========================= */
  function renderResult(res) {
    // サマリ
    const summary = UI.resultSummary();
    if (summary) {
      const html = `
        <div class="scoreBig">${res.correct} / ${TOTAL_Q}（${fmtPct(res.acc)}）</div>
        <div class="muted">合計時間：${fmtSec(res.totalTime)}　平均：${fmtSec(res.avgTime * 1000)}</div>
      `;
      safeSetHTML(summary, html);
    }

    // 分析文章
    safeSetText(UI.analysisText(), res.analysis || "");

    // 内訳
    const bd = UI.breakdown();
    if (bd) {
      let h = `<h3>教科別</h3><div class="grid">`;
      SUBJECTS.forEach((s) => {
        const p = res.perSub[s];
        h += `
          <div class="cardMini">
            <div class="k">${s}</div>
            <div class="v">${p.correct}/${p.total}（${fmtPct(p.acc)}）</div>
            <div class="muted">平均 ${fmtSec(p.avgTime)}</div>
          </div>
        `;
      });
      h += `</div>`;

      h += `<h3>難易度別</h3><div class="grid">`;
      DIFFS.forEach((d) => {
        const p = res.perDiff[d];
        h += `
          <div class="cardMini">
            <div class="k">${d}</div>
            <div class="v">${p.correct}/${p.total}（${fmtPct(p.acc)}）</div>
            <div class="muted">平均 ${fmtSec(p.avgTime)}</div>
          </div>
        `;
      });
      h += `</div>`;

      safeSetHTML(bd, h);
    }

    // レーダー
    drawRadar(UI.radarCanvas(), SUBJECTS.map((s) => res.perSub[s].acc));

    // 解説ボタン一覧
    const list = UI.explainList();
    if (list) {
      list.innerHTML = "";
      state.quiz.forEach((q, idx) => {
        const btn = document.createElement("button");
        btn.type = "button";
        btn.className = "mini";
        btn.textContent = `${idx + 1}`;
        btn.addEventListener("click", () => renderExplanation(idx));
        list.appendChild(btn);
      });
    }

    // 履歴パネル更新（結果表示時に同期）
    renderHistory();
  }

  function renderExplanation(idx) {
    const box = UI.explainBox();
    if (!box) return;
    const q = state.quiz[idx];
    const a = state.answers[idx];
    const chosen = a?.chosen;

    const your = (chosen === null) ? "未回答" : q.c[chosen];
    const correct = q.c[q.a];
    const ok = chosen !== null && chosen === q.a;

    const html = `
      <div class="exTitle">Q${idx + 1}：${q.sub} / ${q.level} / ${q.diff}</div>
      <div class="exQ">${escapeHtml(q.q || "")}</div>
      <div class="exRow"><span class="tag ${ok ? "ok" : "ng"}">${ok ? "正解" : "不正解"}</span></div>
      <div class="exRow"><b>あなた：</b>${escapeHtml(your)}</div>
      <div class="exRow"><b>正解：</b>${escapeHtml(correct)}</div>
      <div class="exExp"><b>解説：</b><br>${escapeHtml(q.exp || "（解説なし）").replace(/\n/g, "<br>")}</div>
    `;
    safeSetHTML(box, html);
    showEl(box);
    box.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  function escapeHtml(s) {
    return String(s)
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;")
      .replaceAll("'", "&#039;");
  }

  /* =========================
   * 履歴描画（この端末）
   * ========================= */
  function renderHistory() {
    const panel = UI.historyPanel();
    const stats = UI.historyStats();
    const list = UI.historyList();
    const canvas = UI.historyCanvas();

    const hist = loadHistory();

    // stats（全期間平均）
    if (stats) {
      if (!hist.length) {
        safeSetHTML(stats, `<div class="muted">履歴はまだありません（この端末で採点すると保存されます）。</div>`);
      } else {
        const avgOverall = hist.reduce((t, h) => t + (h.acc || 0), 0) / hist.length;

        const avgPerSub = {};
        SUBJECTS.forEach((s) => {
          const vals = hist.map((h) => h.perSub?.[s]?.acc).filter((x) => typeof x === "number");
          avgPerSub[s] = vals.length ? vals.reduce((a, b) => a + b, 0) / vals.length : 0;
        });

        let htm = `
          <div class="muted">全期間（${hist.length}回）の平均</div>
          <div class="scoreBig">${fmtPct(avgOverall)}</div>
          <div class="grid">
        `;
        SUBJECTS.forEach((s) => {
          htm += `
            <div class="cardMini">
              <div class="k">${s}</div>
              <div class="v">${fmtPct(avgPerSub[s])}</div>
            </div>
          `;
        });
        htm += `</div>`;
        safeSetHTML(stats, htm);
      }
    }

    // list（直近一覧）
    if (list) {
      list.innerHTML = "";
      hist.slice(0, 10).forEach((h, idx) => {
        const d = new Date(h.ts);
        const row = document.createElement("div");
        row.className = "historyRow";
        row.innerHTML = `
          <div class="hL">${idx + 1}</div>
          <div class="hM">
            <div class="hTop">${d.toLocaleString()}</div>
            <div class="muted">正答率 ${fmtPct(h.acc)}（${h.correct}/${h.total}）</div>
          </div>
        `;
        list.appendChild(row);
      });
    }

    // 最近10回折れ線
    drawHistoryLine(canvas, hist);

    // panelが表示されていても中身は更新される
    if (panel && hist.length === 0) {
      // 表示は任意（ここは静かに）
    }
  }

  function toggleHistory(openForce = null) {
    const panel = UI.historyPanel();
    if (!panel) return;

    const isHidden = panel.style.display === "none" || getComputedStyle(panel).display === "none";
    const open = openForce === null ? isHidden : !!openForce;

    if (open) {
      showEl(panel);
      renderHistory();
      panel.scrollIntoView({ behavior: "smooth", block: "start" });
    } else {
      hideEl(panel);
    }
  }

  function clearHistory() {
    if (!confirm("この端末の履歴を全削除しますか？")) return;
    localStorage.removeItem(LS_HISTORY);
    renderHistory();
  }

  /* =========================
   * 追加要望：右上「履歴」ボタンで未プレイでも開く
   * ========================= */
  function openHistoryFromTop() {
    // ロック未解除でも「履歴閲覧」はOKにするか？
    // 仕様上、履歴だけ見られても致命ではないのでOK（合言葉で“プレイ開始”を制御）
    // ただし、完全に見せたくないなら以下を有効化：
    // if (!state.unlocked) { alert("先にロック解除してください。"); return; }

    // 結果ビューがあれば表示（履歴パネルが結果側にある構成に対応）
    const resultView = UI.resultView();
    const quizView = UI.quizView();

    if (resultView) showEl(resultView);
    if (quizView) hideEl(quizView);

    // 既存の履歴トグルボタンがあればそれを使う
    const inner = UI.btnToggleHistory();
    if (inner) inner.click();
    else toggleHistory(true);
  }

  /* =========================
   * チャート描画（canvas）
   * ========================= */
  function drawRadar(canvas, values01) {
    if (!canvas || !canvas.getContext) return;

    const ctx = canvas.getContext("2d");
    const w = canvas.width = canvas.clientWidth || 360;
    const h = canvas.height = canvas.clientHeight || 260;

    ctx.clearRect(0, 0, w, h);

    const cx = w / 2;
    const cy = h / 2 + 10;
    const R = Math.min(w, h) * 0.33;

    // ガイド（5段）
    ctx.strokeStyle = "rgba(0,0,0,0.12)";
    for (let k = 1; k <= 5; k++) {
      const r = (R * k) / 5;
      ctx.beginPath();
      for (let i = 0; i < 5; i++) {
        const ang = (-Math.PI / 2) + (i * 2 * Math.PI) / 5;
        const x = cx + r * Math.cos(ang);
        const y = cy + r * Math.sin(ang);
        if (i === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      }
      ctx.closePath();
      ctx.stroke();
    }

    // 軸＋ラベル
    ctx.fillStyle = "rgba(0,0,0,0.72)";
    ctx.font = "12px sans-serif";
    SUBJECTS.forEach((label, i) => {
      const ang = (-Math.PI / 2) + (i * 2 * Math.PI) / 5;
      const x = cx + (R + 18) * Math.cos(ang);
      const y = cy + (R + 18) * Math.sin(ang);
      ctx.beginPath();
      ctx.moveTo(cx, cy);
      ctx.lineTo(cx + R * Math.cos(ang), cy + R * Math.sin(ang));
      ctx.strokeStyle = "rgba(0,0,0,0.12)";
      ctx.stroke();
      ctx.fillText(label, x - 10, y + 4);
    });

    // データポリゴン
    ctx.beginPath();
    values01.forEach((v, i) => {
      const ang = (-Math.PI / 2) + (i * 2 * Math.PI) / 5;
      const r = R * clamp01(v);
      const x = cx + r * Math.cos(ang);
      const y = cy + r * Math.sin(ang);
      if (i === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    });
    ctx.closePath();
    ctx.fillStyle = "rgba(20,60,160,0.18)";
    ctx.strokeStyle = "rgba(20,60,160,0.55)";
    ctx.lineWidth = 2;
    ctx.fill();
    ctx.stroke();
  }

  function drawHistoryLine(canvas, hist) {
    if (!canvas || !canvas.getContext) return;

    const ctx = canvas.getContext("2d");
    const w = canvas.width = canvas.clientWidth || 520;
    const h = canvas.height = canvas.clientHeight || 220;

    ctx.clearRect(0, 0, w, h);

    const data = hist.slice(0, 10).reverse(); // 古い→新しい
    if (!data.length) {
      ctx.fillStyle = "rgba(0,0,0,0.5)";
      ctx.font = "12px sans-serif";
      ctx.fillText("履歴がまだありません。", 12, 24);
      return;
    }

    const padL = 36, padR = 14, padT = 14, padB = 26;
    const plotW = w - padL - padR;
    const plotH = h - padT - padB;

    // 軸
    ctx.strokeStyle = "rgba(0,0,0,0.12)";
    ctx.beginPath();
    ctx.moveTo(padL, padT);
    ctx.lineTo(padL, padT + plotH);
    ctx.lineTo(padL + plotW, padT + plotH);
    ctx.stroke();

    // 0/50/100
    ctx.fillStyle = "rgba(0,0,0,0.55)";
    ctx.font = "11px sans-serif";
    [0, 0.5, 1].forEach((p) => {
      const y = padT + plotH * (1 - p);
      ctx.strokeStyle = "rgba(0,0,0,0.08)";
      ctx.beginPath();
      ctx.moveTo(padL, y);
      ctx.lineTo(padL + plotW, y);
      ctx.stroke();
      ctx.fillText(`${Math.round(p * 100)}%`, 6, y + 4);
    });

    const xs = data.map((_, i) => padL + (plotW * i) / (data.length - 1 || 1));
    const ys = data.map((d) => padT + plotH * (1 - clamp01(d.acc)));

    // 折れ線
    ctx.strokeStyle = "rgba(20,60,160,0.65)";
    ctx.lineWidth = 2;
    ctx.beginPath();
    xs.forEach((x, i) => {
      const y = ys[i];
      if (i === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    });
    ctx.stroke();

    // 点
    ctx.fillStyle = "rgba(20,60,160,0.75)";
    xs.forEach((x, i) => {
      ctx.beginPath();
      ctx.arc(x, ys[i], 3, 0, Math.PI * 2);
      ctx.fill();
    });

    // Xラベル（回数）
    ctx.fillStyle = "rgba(0,0,0,0.55)";
    ctx.font = "11px sans-serif";
    data.forEach((_, i) => {
      if (data.length > 6 && i % 2 === 1) return;
      ctx.fillText(`${i + 1}`, xs[i] - 3, padT + plotH + 18);
    });
    ctx.fillText("（最近10回）", padL + plotW - 70, padT + plotH + 18);
  }

  /* =========================
   * イベントバインド
   * ========================= */
  function bind() {
    // ロック
    UI.btnUnlock()?.addEventListener("click", onUnlock);
    UI.passInput()?.addEventListener("keydown", (e) => {
      if (e.key === "Enter") onUnlock();
    });

    // クイズ操作
    UI.btnNew()?.addEventListener("click", newQuiz);
    UI.btnReset()?.addEventListener("click", resetAnswers);
    UI.btnGrade()?.addEventListener("click", gradeQuiz);
    UI.btnPrev()?.addEventListener("click", goPrev);
    UI.btnNext()?.addEventListener("click", goNext);

    // 履歴（結果内）
    UI.btnToggleHistory()?.addEventListener("click", () => toggleHistory());
    UI.btnClearHistory()?.addEventListener("click", clearHistory);

    // 右上の履歴ボタン
    UI.btnHistoryTop()?.addEventListener("click", openHistoryFromTop);

    // 初期表示
    state.unlocked = isUnlocked();
    updateLockUI();

    // 解除済みなら初回クイズ生成
    if (state.unlocked) {
      // フィルタカード/クイズビューが見える構成に合わせてクイズ生成
      newQuiz();
    } else {
      // 未解除でも履歴は見たい人がいるので、履歴だけ先に描画
      renderHistory();
    }
  }

  document.addEventListener("DOMContentLoaded", bind);
})();
