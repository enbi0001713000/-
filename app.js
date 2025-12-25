/* app.js
 * - 合言葉ゲート（0217）
 * - 25問（5教科×5問）ランダム出題
 * - 難易度比：優しい20% / 標準50% / 難しい30%（25問 → 5 / 12 / 8）
 * - 提出後：結果＋分析＋レーダーチャート
 * - 問題番号クリックで解説表示（提出後のみ）
 * - コピー：Clipboard API + フォールバック
 */

(() => {
  "use strict";

  // ===== PWA (Service Worker) =====
  if ("serviceWorker" in navigator) {
    window.addEventListener("load", () => {
      navigator.serviceWorker.register("./sw.js").catch(() => {});
    });
  }

  // ===== Constants =====
  const PASSPHRASE = "0217";
  const SUBJECTS = ["国語", "数学", "英語", "理科", "社会"];
  const DIFFS = ["基礎", "標準", "発展"];
  const LEVELS = ["小", "中"];

  // ===== Utilities =====
  const $ = (id) => document.getElementById(id);

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

  function fmtTime(sec) {
    const m = String(Math.floor(sec / 60)).padStart(2, "0");
    const s = String(sec % 60).padStart(2, "0");
    return `${m}:${s}`;
  }

  function escapeHtml(s) {
    return String(s)
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;")
      .replaceAll("'", "&#39;");
  }

  function toast(msg) {
    const el = $("toast");
    if (!el) return;
    el.textContent = msg;
    el.style.display = "block";
    clearTimeout(toast._t);
    toast._t = setTimeout(() => (el.style.display = "none"), 1700);
  }

  function safeNumber(n) {
    return Number.isFinite(n) ? n : 0;
  }

  function copyTextFallback(text) {
    const ta = document.createElement("textarea");
    ta.value = text;
    ta.style.position = "fixed";
    ta.style.left = "-9999px";
    ta.style.top = "-9999px";
    document.body.appendChild(ta);
    ta.focus();
    ta.select();
    try {
      document.execCommand("copy");
      document.body.removeChild(ta);
      return true;
    } catch {
      document.body.removeChild(ta);
      return false;
    }
  }

  // ===== Gate =====
  function renderGate() {
    document.body.innerHTML = `
      <div style="max-width:760px;margin:70px auto;padding:18px;font-family:system-ui;color:#0B1B3A;">
        <div style="padding:18px;border:1px solid rgba(11,27,58,.18);border-radius:16px;background:rgba(255,255,255,.78);
                    box-shadow:0 14px 36px rgba(11,27,58,.12);">
          <h2 style="margin:0 0 10px;">合言葉が必要です</h2>
          <p style="margin:0 0 14px;color:rgba(11,27,58,.70);">
            このクイズは合言葉を知っている人だけ遊べます。
          </p>

          <div style="display:flex;gap:10px;flex-wrap:wrap;align-items:center;">
            <input id="pw" inputmode="numeric" placeholder="合言葉（4桁）"
                   style="padding:12px 14px;border-radius:12px;border:1px solid rgba(11,27,58,.20);
                          background:rgba(255,255,255,.85);color:#0B1B3A;font-size:16px;outline:none;">
            <button id="enter"
                    style="padding:12px 14px;border-radius:12px;border:1px solid rgba(11,27,58,.28);
                           background:rgba(11,27,58,.86);color:#fff;font-weight:900;cursor:pointer;">
              入室
            </button>
          </div>

          <div id="msg" style="margin-top:10px;color:rgba(220,53,69,.95);display:none;font-weight:900;">
            合言葉が違います。
          </div>

          <hr style="border:none;height:1px;background:rgba(11,27,58,.14);margin:16px 0;">
          <div style="font-size:12px;color:rgba(11,27,58,.65);">
            ※同じタブでは通過状態を保持（タブを閉じると再入力）。
          </div>
        </div>
      </div>
    `;

    const input = document.getElementById("pw");
    const btn = document.getElementById("enter");
    const msg = document.getElementById("msg");

    function tryEnter() {
      if (input.value === PASSPHRASE) {
        sessionStorage.setItem("quiz_passed", "1");
        location.reload();
      } else {
        msg.style.display = "block";
        input.select();
      }
    }
    btn.addEventListener("click", tryEnter);
    input.addEventListener("keydown", (e) => {
      if (e.key === "Enter") tryEnter();
    });
    input.focus();
  }

  function ensurePass() {
    const forceGate = new URLSearchParams(location.search).get("gate") === "1";
    const passed = sessionStorage.getItem("quiz_passed") === "1";
    if (forceGate || !passed) {
      renderGate();
      return false;
    }
    return true;
  }

  // ===== State =====
  const state = {
    seedStr: "",
    seed: 0,
    rng: null,
    bank: [],
    questions: [],
    answers: new Map(), // qid -> {choiceIndex, startedAtMs, timeSpentSec}
    submitted: false,
    startedAtMs: 0,
    elapsedSec: 0,
    timerHandle: null,
    chart: null,
  };

  // ===== Filters =====
  function getFilters() {
    const lvls = [];
    if ($("lvlE")?.checked) lvls.push("小");
    if ($("lvlJ")?.checked) lvls.push("中");

    const diffs = [];
    if ($("dB")?.checked) diffs.push("基礎");
    if ($("dS")?.checked) diffs.push("標準");
    if ($("dA")?.checked) diffs.push("発展");

    // 全OFF事故を自動救済
    if (lvls.length === 0) {
      lvls.push("小", "中");
      toast("学年が全OFFだったため、小＋中で出題します");
    }
    if (diffs.length === 0) {
      diffs.push("基礎", "標準", "発展");
      toast("難易度が全OFFだったため、基礎＋標準＋発展で出題します");
    }
    return { lvls, diffs };
  }

  // ===== Bank & Selection =====
  function ensureBankLoaded() {
    if (!window.SchoolQuizBank) {
      alert("bank.js が読み込めていません（SchoolQuizBank未定義）");
      return false;
    }
    if (!state.bank.length) {
      // 各教科500問 → 合計2500問
      state.bank = window.SchoolQuizBank.buildAll(500);
    }
    return true;
  }

  function diffPlanPerSubject(rng) {
    // 25問で 5/12/8 にしたい（基礎/標準/発展）
    // 5教科×5問なので、
    // 3教科：基礎1/標準2/発展2
    // 2教科：基礎1/標準3/発展1
    const pickTwo = shuffle(SUBJECTS, rng).slice(0, 2);
    const setTwo = new Set(pickTwo);
    const plan = {};
    for (const s of SUBJECTS) {
      plan[s] = setTwo.has(s)
        ? { 基礎: 1, 標準: 3, 発展: 1 }
        : { 基礎: 1, 標準: 2, 発展: 2 };
    }
    return plan;
  }

  function takeFromPool(pool, count, rng, usedKeys) {
    const candidates = pool.filter((q) => !usedKeys.has(q.key));
    const picked = shuffle(candidates, rng).slice(0, count);
    for (const q of picked) usedKeys.add(q.key);
    return picked;
  }

  function buildQuiz() {
    if (!ensureBankLoaded()) return;

    // Seed
    const seedStr = `${Date.now()}-${Math.random().toString(16).slice(2)}`;
    const seed = hashSeed(seedStr);
    const rng = mulberry32(seed);

    state.seedStr = seedStr;
    state.seed = seed;
    state.rng = rng;

    // Reset runtime state
    state.answers = new Map();
    state.submitted = false;
    state.startedAtMs = Date.now();
    state.elapsedSec = 0;

    $("seedPill").textContent = `Seed: ${seed.toString(16)}`;
    $("timerPill").textContent = `Time: 00:00`;
    $("progressPill").textContent = `Answered: 0 / 25`;
    $("btnSubmit").disabled = true;
    $("btnCopy").disabled = true;

    setKpisPlaceholders();
    renderAnalysisPlaceholder();
    destroyChart();
    $("numStrip").innerHTML = "";
    $("quizRoot").innerHTML = "";

    // Filters
    const filters = getFilters();

    // Plan
    const plan = diffPlanPerSubject(rng);
    const usedKeys = new Set();
    const questions = [];

    for (const sub of SUBJECTS) {
      // diff counts (5問/教科)
      const counts = plan[sub]; // {基礎,標準,発展}

      for (const diff of DIFFS) {
        // diff がフィルタで許可されていない場合は後で補填
        if (!filters.diffs.includes(diff)) continue;

        const pool = state.bank.filter(
          (q) => q.sub === sub && q.diff === diff && filters.lvls.includes(q.level)
        );

        const need = counts[diff];
        const got = takeFromPool(pool, need, rng, usedKeys);
        for (const q of got) {
          questions.push({
            ...q,
            id: cryptoId(),
          });
        }
      }

      // 補填：教科5問に満たない場合（フィルタで削れた等）
      const current = questions.filter((q) => q.sub === sub).length;
      const missing = 5 - current;
      if (missing > 0) {
        // まず同教科＋学年のみ一致（難易度は緩和）
        const pool2 = state.bank.filter(
          (q) => q.sub === sub && filters.lvls.includes(q.level)
        );
        let got2 = takeFromPool(pool2, missing, rng, usedKeys);

        // それでも不足なら同教科なら何でも
        if (got2.length < missing) {
          const pool3 = state.bank.filter((q) => q.sub === sub);
          got2 = got2.concat(takeFromPool(pool3, missing - got2.length, rng, usedKeys));
        }

        if (got2.length) toast(`設定の都合で ${sub} を補填出題しました`);
        for (const q of got2) questions.push({ ...q, id: cryptoId() });
      }
    }

    // 最終 25問に整形＆シャッフル
    const finalQs = shuffle(questions, rng).slice(0, 25).map((q, i) => ({
      ...q,
      no: i + 1,
    }));

    state.questions = finalQs;

    renderQuestions();
    renderNumStrip(); // 提出前は disabled にする
    startTimer();
    updateProgress();
    toast("新しいクイズを生成しました");
  }

  function cryptoId() {
    const a = new Uint8Array(8);
    crypto.getRandomValues(a);
    return Array.from(a)
      .map((b) => b.toString(16).padStart(2, "0"))
      .join("");
  }

  // ===== Rendering =====
  function setKpisPlaceholders() {
    const k = $("kpiGrid");
    k.innerHTML = `
      <div class="kpi"><div class="v">-</div><div class="k">総合スコア</div></div>
      <div class="kpi"><div class="v">-</div><div class="k">正答率</div></div>
      <div class="kpi"><div class="v">-</div><div class="k">平均回答時間</div></div>
      <div class="kpi"><div class="v">-</div><div class="k">弱点教科</div></div>
    `;
  }

  function renderAnalysisPlaceholder() {
    $("analysisBox").innerHTML = `
      <b>提出すると</b>、ここに分析が出ます。
      <ul>
        <li>教科別：得点・傾向</li>
        <li>難易度別：得点（基礎/標準/発展）</li>
        <li>学年別：得点（小/中）</li>
      </ul>
      <div class="muted tiny">※番号ボタンで解説は提出後に表示</div>
    `;
  }

  function renderQuestions() {
    const root = $("quizRoot");
    root.innerHTML = "";

    for (const item of state.questions) {
      const qEl = document.createElement("div");
      qEl.className = "q";
      qEl.dataset.qid = item.id;

      const top = document.createElement("div");
      top.className = "qtop";

      const left = document.createElement("div");
      left.innerHTML = `
        <div class="qtitle">Q${item.no}. ${escapeHtml(item.q)}</div>
        <div class="qmeta">
          <span class="tag">${escapeHtml(item.sub)}</span>
          <span class="tag">${escapeHtml(item.level)}</span>
          <span class="tag">${escapeHtml(item.diff)}</span>
        </div>
      `;

      const right = document.createElement("div");
      const statusTag = document.createElement("span");
      statusTag.className = "tag warn";
      statusTag.textContent = "未採点";
      statusTag.id = `status-${item.id}`;

      const ansTag = document.createElement("span");
      ansTag.className = "tag";
      ansTag.textContent = "未回答";
      ansTag.id = `ans-${item.id}`;
      right.appendChild(statusTag);
      right.appendChild(ansTag);

      top.appendChild(left);
      top.appendChild(right);

      const choices = document.createElement("div");
      choices.className = "choices";

      item.c.forEach((text, idx) => {
        const label = document.createElement("label");
        label.className = "choice";
        label.innerHTML = `
          <input type="radio" name="q-${item.id}" value="${idx}" />
          <div><b>${String.fromCharCode(65 + idx)}.</b> ${escapeHtml(text)}</div>
        `;

        label.addEventListener("click", () => {
          if (state.submitted) return;

          // 初回クリックで開始時刻を記録
          const prev = state.answers.get(item.id);
          if (!prev) {
            state.answers.set(item.id, {
              choiceIndex: idx,
              startedAtMs: Date.now(),
              timeSpentSec: 0,
            });
          } else {
            prev.choiceIndex = idx;
          }

          // UI
          const box = root.querySelector(`.q[data-qid="${item.id}"]`);
          box.querySelectorAll(".choice").forEach((ch) => ch.classList.remove("selected"));
          label.classList.add("selected");
          $("ans-" + item.id).textContent = `回答: ${String.fromCharCode(65 + idx)}`;

          updateProgress();
        });

        choices.appendChild(label);
      });

      qEl.appendChild(top);
      qEl.appendChild(choices);
      root.appendChild(qEl);
    }
  }

  function updateProgress() {
    const answered = state.answers.size;
    $("progressPill").textContent = `Answered: ${answered} / 25`;
    $("btnSubmit").disabled = answered < 25 || state.submitted;
    if (!state.submitted) renderNumStrip();
  }

  function renderNumStrip() {
    const strip = $("numStrip");
    strip.innerHTML = "";
    for (const item of state.questions) {
      const btn = document.createElement("button");
      btn.textContent = item.no;

      // 提出前は無効
      btn.disabled = !state.submitted;
      btn.className = "neutral";

      if (state.submitted) {
        const ok = isCorrect(item.id);
        btn.className = ok ? "good" : "bad";
      }

      btn.addEventListener("click", () => {
        if (!state.submitted) return;
        openExplanation(item.no);
      });

      strip.appendChild(btn);
    }
  }

  // ===== Timer =====
  function startTimer() {
    if (state.timerHandle) clearInterval(state.timerHandle);
    state.timerHandle = setInterval(() => {
      state.elapsedSec = Math.floor((Date.now() - state.startedAtMs) / 1000);
      $("timerPill").textContent = `Time: ${fmtTime(state.elapsedSec)}`;
    }, 250);
  }

  // ===== Scoring =====
  function isCorrect(qid) {
    const q = state.questions.find((x) => x.id === qid);
    const a = state.answers.get(qid);
    if (!q || !a) return false;
    return a.choiceIndex === q.a;
  }

  function finalizeTimes() {
    const now = Date.now();
    for (const q of state.questions) {
      const a = state.answers.get(q.id);
      if (!a) continue;
      // 「最初に選んだ時刻」から「提出時刻」までを雑に時間として扱う（練習用の目安）
      const started = safeNumber(a.startedAtMs);
      a.timeSpentSec = started ? Math.max(0, Math.round((now - started) / 1000)) : 0;
    }
  }

  function submit() {
    if (state.submitted) return;
    if (state.answers.size < 25) {
      toast("全問回答してから提出してください");
      return;
    }

    finalizeTimes();
    state.submitted = true;

    $("btnSubmit").disabled = true;
    $("btnCopy").disabled = false;

    const root = $("quizRoot");

    for (const item of state.questions) {
      const box = root.querySelector(`.q[data-qid="${item.id}"]`);
      const choices = Array.from(box.querySelectorAll(".choice"));
      const radios = Array.from(box.querySelectorAll('input[type="radio"]'));
      radios.forEach((r) => (r.disabled = true));

      const ans = state.answers.get(item.id);
      const chosen = ans.choiceIndex;
      const correct = item.a;

      choices.forEach((ch, idx) => {
        ch.classList.remove("selected", "correct", "wrong");
        if (idx === chosen) ch.classList.add("selected");
        if (idx === correct) ch.classList.add("correct");
        if (idx === chosen && chosen !== correct) ch.classList.add("wrong");
      });

      const ok = chosen === correct;
      const st = $("status-" + item.id);
      st.className = `tag ${ok ? "good" : "bad"}`;
      st.textContent = ok ? "正解" : "不正解";
    }

    renderNumStrip();
    renderResultsAndAnalysis();
    toast("採点しました（番号から解説が開けます）");
  }

  function renderResultsAndAnalysis() {
    const bySub = Object.fromEntries(SUBJECTS.map((s) => [s, { correct: 0, total: 0, time: 0 }]));
    const byDiff = Object.fromEntries(DIFFS.map((d) => [d, { correct: 0, total: 0 }]));
    const byLvl = Object.fromEntries(LEVELS.map((l) => [l, { correct: 0, total: 0 }]));

    let totalCorrect = 0;
    let totalTime = 0;

    for (const q of state.questions) {
      const a = state.answers.get(q.id);
      const ok = a.choiceIndex === q.a;

      bySub[q.sub].total++;
      bySub[q.sub].time += safeNumber(a.timeSpentSec);

      byDiff[q.diff].total++;
      byLvl[q.level].total++;

      if (ok) {
        totalCorrect++;
        bySub[q.sub].correct++;
        byDiff[q.diff].correct++;
        byLvl[q.level].correct++;
      }

      totalTime += safeNumber(a.timeSpentSec);
    }

    const pct = Math.round((totalCorrect / 25) * 100);
    const avgTime = Math.round(totalTime / 25);

    const weakest = SUBJECTS.slice().sort(
      (a, b) => bySub[a].correct - bySub[b].correct
    )[0];
    const strongest = SUBJECTS.slice().sort(
      (a, b) => bySub[b].correct - bySub[a].correct
    )[0];

    // KPI
    $("kpiGrid").innerHTML = "";
    const kpis = [
      { v: `${totalCorrect} / 25`, k: "総合スコア" },
      { v: `${pct}%`, k: "正答率" },
      { v: `${avgTime}秒/問`, k: "平均回答時間" },
      { v: `${weakest}（${bySub[weakest].correct}/5）`, k: "弱点教科" },
    ];
    for (const x of kpis) {
      const el = document.createElement("div");
      el.className = "kpi";
      el.innerHTML = `<div class="v">${escapeHtml(x.v)}</div><div class="k">${escapeHtml(
        x.k
      )}</div>`;
      $("kpiGrid").appendChild(el);
    }

    // Analysis text
    const lines = [];
    lines.push(`<b>分析サマリ</b>`);
    lines.push(`強み：<b>${escapeHtml(strongest)}</b> ／ 弱点：<b>${escapeHtml(weakest)}</b>`);
    lines.push(`<div class="hr"></div>`);
    lines.push(`<b>教科別</b>`);
    for (const s of SUBJECTS) {
      lines.push(
        `・${escapeHtml(s)}：${bySub[s].correct}/5（平均 ${Math.round(bySub[s].time / 5)}秒/問）`
      );
    }
    lines.push(`<div class="hr"></div>`);
    lines.push(`<b>難易度別</b>`);
    for (const d of DIFFS) {
      const t = byDiff[d].total || 1;
      lines.push(`・${escapeHtml(d)}：${byDiff[d].correct}/${byDiff[d].total}（${Math.round((byDiff[d].correct / t) * 100)}%）`);
    }
    lines.push(`<div class="hr"></div>`);
    lines.push(`<b>学年別</b>`);
    for (const l of LEVELS) {
      const t = byLvl[l].total || 1;
      lines.push(`・${escapeHtml(l)}：${byLvl[l].correct}/${byLvl[l].total}（${Math.round((byLvl[l].correct / t) * 100)}%）`);
    }

    $("analysisBox").innerHTML = lines.join("<br>");

    // Radar
    drawRadar(SUBJECTS.map((s) => bySub[s].correct));
  }

  function destroyChart() {
    if (state.chart) {
      state.chart.destroy();
      state.chart = null;
    }
  }

  function drawRadar(scores) {
    const canvas = $("radar");
    destroyChart();

    if (!window.Chart) {
      toast("Chart.js が読み込めないため、レーダーチャートを省略しました");
      return;
    }

    state.chart = new Chart(canvas, {
      type: "radar",
      data: {
        labels: SUBJECTS,
        datasets: [
          {
            label: "得点（各5点満点）",
            data: scores,
            fill: true,
            borderWidth: 2,
            pointRadius: 3,
          },
        ],
      },
      options: {
        responsive: true,
        plugins: { legend: { display: false } },
        scales: {
          r: {
            min: 0,
            max: 5,
            ticks: { stepSize: 1 },
            pointLabels: { font: { size: 12, weight: "600" } },
          },
        },
      },
    });
  }

  // ===== Explanation Modal =====
  function openExplanation(no) {
    const item = state.questions.find((x) => x.no === no);
    if (!item) return;

    const ans = state.answers.get(item.id);
    const yourIdx = ans?.choiceIndex;
    const correctIdx = item.a;

    const your =
      yourIdx === undefined
        ? "未回答"
        : `${String.fromCharCode(65 + yourIdx)}. ${item.c[yourIdx]}`;
    const corr = `${String.fromCharCode(65 + correctIdx)}. ${item.c[correctIdx]}`;
    const ok = yourIdx === correctIdx;

    $("modalSub").textContent = `Q${item.no} / ${item.sub} / ${item.level} / ${item.diff} / ${
      ok ? "正解" : "不正解"
    }`;
    $("modalBody").innerHTML = `
      <div style="font-weight:900;font-size:16px;">${escapeHtml(item.q)}</div>
      <div class="hr"></div>
      <div><b>あなたの回答：</b> ${escapeHtml(your)}</div>
      <div><b>正解：</b> ${escapeHtml(corr)}</div>
      <div class="hr"></div>
      <div><b>解説：</b><br>${escapeHtml(item.exp)}</div>
      <div class="hr"></div>
      <div class="muted tiny">※提出後のみ閲覧可</div>
    `;

    $("modalBack").style.display = "flex";
    $("modalBack").setAttribute("aria-hidden", "false");
  }

  function closeModal() {
    $("modalBack").style.display = "none";
    $("modalBack").setAttribute("aria-hidden", "true");
  }

  // ===== Copy Results =====
  async function copyResults() {
    if (!state.submitted) {
      toast("提出後にコピーできます");
      return;
    }

    // 文章化
    let totalCorrect = 0;
    for (const q of state.questions) if (isCorrect(q.id)) totalCorrect++;

    const lines = [];
    lines.push("【義務教育5教科クイズ 結果】");
    lines.push(`Seed: ${state.seed.toString(16)}`);
    lines.push(`Time: ${fmtTime(state.elapsedSec)}`);
    lines.push(`Score: ${totalCorrect}/25`);
    lines.push("");

    for (const q of state.questions) {
      const a = state.answers.get(q.id);
      const your = String.fromCharCode(65 + a.choiceIndex);
      const corr = String.fromCharCode(65 + q.a);
      const ok = your === corr ? "〇" : "×";
      lines.push(
        `Q${q.no} [${q.sub}/${q.level}/${q.diff}] ${ok} あなた:${your} 正解:${corr}`
      );
      lines.push(`  問: ${q.q}`);
      lines.push(`  解説: ${q.exp}`);
      lines.push("");
    }

    const text = lines.join("\n");

    // Clipboard API → fallback
    try {
      await navigator.clipboard.writeText(text);
      toast("結果をコピーしました");
    } catch {
      const ok = copyTextFallback(text);
      ok ? toast("結果をコピーしました") : toast("コピーできませんでした");
    }
  }

  // ===== Reset =====
  function resetAnswers() {
    state.answers = new Map();
    state.submitted = false;

    $("btnCopy").disabled = true;
    $("btnSubmit").disabled = true;
    setKpisPlaceholders();
    renderAnalysisPlaceholder();
    destroyChart();
    renderQuestions();
    renderNumStrip();
    updateProgress();
    toast("回答をリセットしました");
  }

  // ===== Events =====
  function wireEvents() {
    $("btnNew").addEventListener("click", buildQuiz);
    $("btnReset").addEventListener("click", resetAnswers);
    $("btnSubmit").addEventListener("click", submit);
    $("btnCopy").addEventListener("click", copyResults);

    $("btnCloseModal").addEventListener("click", closeModal);
    $("modalBack").addEventListener("click", (e) => {
      if (e.target.id === "modalBack") closeModal();
    });
    document.addEventListener("keydown", (e) => {
      if (e.key === "Escape") closeModal();
    });

    ["lvlE", "lvlJ", "dB", "dS", "dA"].forEach((id) => {
      const el = $(id);
      if (!el) return;
      el.addEventListener("change", () => {
        toast("設定を変更しました（新しいクイズで反映）");
      });
    });
  }

  // ===== Boot =====
  if (!ensurePass()) return;
  wireEvents();
  buildQuiz();
})();
