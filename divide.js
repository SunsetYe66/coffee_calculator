document.addEventListener('DOMContentLoaded', function () {
  const totalGramsInput = document.getElementById('totalGrams');
  const maxLossInput = document.getElementById('maxLoss');
  const sizeInputs = [1, 2, 3, 4, 5].map(function (i) {
    return document.getElementById('size' + i);
  });
  const requiredSizeSelect = document.getElementById('requiredSize');
  const calculateButton = document.getElementById('calculate');
  const resultsSection = document.getElementById('results');
  const summaryEl = document.getElementById('summary');
  const tabsEl = document.getElementById('strategyTabs');
  const panelEl = document.getElementById('strategyPanel');

  const STRATEGIES = [
    {
      id: 'balance',
      name: '平衡',
      desc: '在可接受损失内，同时兼顾“尽量少浪费”与“包数尽量平均”的折中方案。'
    },
    {
      id: 'minwaste',
      name: '最少浪费',
      desc: '优先让剩余（损失）尽可能小；不限制包数分布，因此可能比较偏科。'
    },
    {
      id: 'even',
      name: '规格平均分配',
      desc: '在可接受损失内，让各规格的包数尽量接近（按包数平均分配）。'
    }
  ];
  const COLORS = ['#4e79a7', '#f28e2b', '#e15759', '#76b7b2', '#59a14f'];
  const EPS = 1e-6;
  const MAX_NODES = 400000;
  const STORE_LIMIT = 500;
  const MAX_SHOWN = 20;
  const MIN_DIVERGENCE = 0.2;
  const PAGE_SIZE = 15;

  let state = null;

  function fmt(x) {
    return (Math.round(x * 10) / 10).toFixed(1);
  }

  function trimNum(x) {
    return Number.isInteger(x) ? String(x) : String(Math.round(x * 10) / 10);
  }

  function updateSelectOptions() {
    const current = requiredSizeSelect.value;
    requiredSizeSelect.innerHTML = '<option value="none">无</option>';
    sizeInputs.forEach(function (input, index) {
      const val = input.value.trim();
      const size = val === '' ? 0 : parseFloat(val);
      if (!isNaN(size) && size > 0) {
        const option = document.createElement('option');
        option.value = 'size' + (index + 1);
        option.textContent = '规格' + (index + 1) + ' (' + trimNum(size) + 'g)';
        requiredSizeSelect.appendChild(option);
      }
    });
    const exists = Array.prototype.some.call(requiredSizeSelect.options, function (o) {
      return o.value === current;
    });
    if (exists) requiredSizeSelect.value = current;
  }

  function enumerate(total, active, requiredActiveIdx, maxLoss) {
    const k = active.length;
    const G = 10;
    const s = active.map(function (a) { return Math.round(a.size * G); });
    const T = Math.round(total * G);
    const band = Math.max(0, Math.round(maxLoss * G));

    const reach = new Uint8Array(T + 1);
    const parent = new Int16Array(T + 1);
    parent.fill(-1);
    reach[0] = 1;
    for (let v = 0; v <= T; v++) {
      if (!reach[v]) continue;
      for (let i = 0; i < k; i++) {
        const nv = v + s[i];
        if (nv <= T && !reach[nv]) { reach[nv] = 1; parent[nv] = i; }
      }
    }
    let bestUsed = T;
    while (bestUsed > 0 && !reach[bestUsed]) bestUsed--;

    let minUsed = T - band;
    if (minUsed < 0) minUsed = 0;
    if (bestUsed < minUsed) {
      const extra = Math.max(1, Math.round(Math.max(0.5, maxLoss * 0.1) * G));
      minUsed = Math.max(0, bestUsed - extra);
    }

    const reachSuf = new Array(k + 1);
    reachSuf[k] = new Uint8Array(T + 1);
    reachSuf[k][0] = 1;
    for (let i = k - 1; i >= 0; i--) {
      const cur = new Uint8Array(T + 1);
      const nxt = reachSuf[i + 1];
      const si = s[i];
      for (let v = 0; v <= T; v++) {
        cur[v] = (nxt[v] || (v >= si && cur[v - si])) ? 1 : 0;
      }
      reachSuf[i] = cur;
    }
    const sr = new Array(k + 1);
    for (let i = 0; i <= k; i++) {
      const arr = new Int32Array(T + 2);
      arr[T + 1] = T + 1;
      let nx = T + 1;
      for (let v = T; v >= 0; v--) {
        if (reachSuf[i][v]) nx = v;
        arr[v] = nx;
      }
      sr[i] = arr;
    }

    const list = [];
    const counts = new Array(k).fill(0);
    let nodes = 0;
    let capped = false;

    function push(usedScaled) {
      let mx = -Infinity;
      let mn = Infinity;
      let packs = 0;
      for (let j = 0; j < k; j++) {
        const c = counts[j];
        packs += c;
        if (c > mx) mx = c;
        if (c < mn) mn = c;
      }
      list.push({
        counts: counts.slice(),
        used: usedScaled / G,
        waste: total - usedScaled / G,
        packs: packs,
        imb: mx - mn
      });
    }

    function rec(i, remaining, used) {
      if (nodes++ > MAX_NODES) { capped = true; return; }
      const need = minUsed - used;
      if (need > 0 && sr[i][need > T ? T : need] > remaining) return;
      if (i === k) {
        if (used < minUsed) return;
        if (requiredActiveIdx >= 0 && counts[requiredActiveIdx] < 1) return;
        push(used);
        return;
      }
      const si = s[i];
      const maxN = Math.floor(remaining / si);
      for (let n = maxN; n >= 0; n--) {
        counts[i] = n;
        rec(i + 1, remaining - n * si, used + n * si);
      }
      counts[i] = 0;
    }

    rec(0, T, 0);

    const optCounts = new Array(k).fill(0);
    let vv = bestUsed;
    let optOk = true;
    while (vv > 0) {
      const i = parent[vv];
      if (i < 0) { optOk = false; break; }
      optCounts[i]++;
      vv -= s[i];
    }
    if (optOk && (requiredActiveIdx < 0 || optCounts[requiredActiveIdx] >= 1)) {
      let mx = -Infinity;
      let mn = Infinity;
      let packs = 0;
      for (let j = 0; j < k; j++) {
        const c = optCounts[j];
        packs += c;
        if (c > mx) mx = c;
        if (c < mn) mn = c;
      }
      list.push({
        counts: optCounts,
        used: bestUsed / G,
        waste: total - bestUsed / G,
        packs: packs,
        imb: mx - mn
      });
    }

    return { list: list, capped: capped };
  }

  function canonicalKey(sol, active) {
    const pairs = [];
    active.forEach(function (a, j) {
      if (sol.counts[j] > 0) pairs.push({ s: a.size, c: sol.counts[j] });
    });
    pairs.sort(function (x, y) { return x.s - y.s; });
    return pairs.map(function (p) { return p.s + ':' + p.c; }).join('|');
  }

  function topList(list, cmp, active) {
    const arr = list.slice().sort(cmp);
    const out = [];
    const seen = new Set();
    for (let i = 0; i < arr.length; i++) {
      const key = canonicalKey(arr[i], active);
      if (seen.has(key)) continue;
      seen.add(key);
      out.push(arr[i]);
      if (out.length >= STORE_LIMIT) break;
    }
    return out;
  }

  function featureVector(sol, active, total) {
    return active.map(function (a, j) {
      return (sol.counts[j] * a.size) / total;
    });
  }

  function l1(a, b) {
    let sum = 0;
    for (let i = 0; i < a.length; i++) sum += Math.abs(a[i] - b[i]);
    return sum;
  }

  function diversify(list, maxCount, active, total) {
    if (list.length <= maxCount) return list.slice();
    const feats = list.map(function (s) { return featureVector(s, active, total); });
    const n = list.length;
    const selected = new Array(n).fill(false);
    const minD = new Array(n).fill(Infinity);
    const out = [list[0]];
    selected[0] = true;
    for (let i = 1; i < n; i++) minD[i] = l1(feats[i], feats[0]);
    while (out.length < maxCount) {
      let best = -1;
      let bestD = -1;
      for (let i = 0; i < n; i++) {
        if (!selected[i] && minD[i] > bestD) { bestD = minD[i]; best = i; }
      }
      if (best < 0 || bestD < MIN_DIVERGENCE) break;
      selected[best] = true;
      out.push(list[best]);
      for (let i = 0; i < n; i++) {
        if (selected[i]) continue;
        const d = l1(feats[i], feats[best]);
        if (d < minD[i]) minD[i] = d;
      }
    }
    return out;
  }

  function compute() {
    const total = parseFloat(totalGramsInput.value);
    if (isNaN(total) || total <= 0) { alert('请输入有效的总克数'); return; }
    if (total * 10 > 1000000) { alert('总克数过大，请保持在 100000g 以内'); return; }
    const maxLossRaw = parseFloat(maxLossInput.value);
    const maxLoss = (isNaN(maxLossRaw) || maxLossRaw < 0) ? 0 : maxLossRaw;

    const sizes = sizeInputs.map(function (input) {
      const val = input.value.trim();
      if (val === '') return 0;
      const num = parseFloat(val);
      return (isNaN(num) || num < 0) ? 0 : num;
    });

    const active = [];
    sizes.forEach(function (size, index) {
      if (size > 0 && size <= total + EPS && Math.round(size * 10) > 0) {
        active.push({ size: size, origIndex: index, color: COLORS[active.length % COLORS.length] });
      }
    });
    if (active.length === 0) { alert('请至少输入一个不超过总克数的分装规格'); return; }

    const reqVal = requiredSizeSelect.value;
    let requiredOrigIdx = -1;
    if (reqVal && reqVal.indexOf('size') === 0) requiredOrigIdx = parseInt(reqVal.slice(4), 10) - 1;
    const requiredActiveIdx = active.findIndex(function (a) { return a.origIndex === requiredOrigIdx; });

    const result = enumerate(total, active, requiredActiveIdx, maxLoss);
    if (!result.list.length) { alert('没有可行的分装方案，请调整参数'); return; }

    function within(sol) { return sol.waste <= maxLoss + 1e-6; }
    const withinList = result.list.filter(within);
    const base = withinList.length ? withinList : result.list;

    const minSize = Math.min.apply(null, active.map(function (a) { return a.size; }));
    const imax = Math.max(1, Math.floor((total + EPS) / minSize));

    function balanceScore(sol) {
      const w = maxLoss > 0 ? sol.waste / maxLoss : (sol.waste > EPS ? 1e9 : 0);
      return w + sol.imb / imax;
    }

    let minWaste = Infinity;
    let minImb = Infinity;
    let minScore = Infinity;
    base.forEach(function (s) {
      if (s.waste < minWaste) minWaste = s.waste;
      if (s.imb < minImb) minImb = s.imb;
      const sc = balanceScore(s);
      if (sc < minScore) minScore = sc;
    });

    const WASTE_BAND = Math.max(0.5, maxLoss * 0.1);
    const IMB_BAND = 2;
    const SCORE_BAND = 0.15;

    const wasteLimit = minWaste <= 0.05 ? 0.5 : minWaste + WASTE_BAND;
    const minwasteList = base.filter(function (s) { return s.waste <= wasteLimit + 1e-9; });
    const evenList = base.filter(function (s) { return s.imb <= minImb + IMB_BAND; });
    const balanceList = base.filter(function (s) { return balanceScore(s) <= minScore + SCORE_BAND + 1e-9; });

    const strategies = {
      balance: {
        desc: STRATEGIES[0].desc + '（筛选：综合折中分 ≤ 最优 + ' + SCORE_BAND.toFixed(2) + '，并按差异精选）',
        list: diversify(topList(balanceList.length ? balanceList : base, function (a, b) {
          return balanceScore(a) - balanceScore(b) || a.waste - b.waste || a.imb - b.imb;
        }, active), MAX_SHOWN, active, total)
      },
      minwaste: {
        desc: STRATEGIES[1].desc + (minWaste <= 0.05
          ? '（存在 0 损失方案，仅保留损失 ≤ 0.5g 的方案，并按差异精选）'
          : '（筛选：损失 ≤ ' + fmt(wasteLimit) + 'g，并按差异精选）'),
        list: diversify(topList(minwasteList.length ? minwasteList : base, function (a, b) {
          return a.waste - b.waste || balanceScore(a) - balanceScore(b) || a.imb - b.imb || a.packs - b.packs;
        }, active), MAX_SHOWN, active, total)
      },
      even: {
        desc: STRATEGIES[2].desc + '（筛选：包数差 ≤ 最优 + ' + IMB_BAND + '，并按差异精选）',
        list: diversify(topList(evenList.length ? evenList : base, function (a, b) {
          return a.imb - b.imb || a.waste - b.waste || a.packs - b.packs;
        }, active), MAX_SHOWN, active, total)
      }
    };

    state = {
      total: total,
      maxLoss: maxLoss,
      active: active,
      strategies: strategies,
      current: 'balance',
      page: { balance: 1, minwaste: 1, even: 1 }
    };

    const specText = active.map(function (a) { return trimNum(a.size) + 'g'; }).join(' / ');
    summaryEl.textContent = '总克数 ' + fmt(total) + 'g · 规格 ' + specText + ' · 可接受损失 ' + fmt(maxLoss) + 'g'
      + (result.capped ? '（方案较多，已限制候选规模以保持计算速度）' : '');

    resultsSection.hidden = false;
    renderTabs();
    renderPanel();
    resultsSection.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  function titleHTML(sol, active) {
    const parts = [];
    active.forEach(function (a, j) {
      if (sol.counts[j] > 0) {
        parts.push('<span class="tv"><span class="dot" style="background:' + a.color + '"></span>'
          + trimNum(a.size) + 'g × ' + sol.counts[j] + '</span>');
      }
    });
    return parts.join('<span class="plus">+</span>');
  }

  function stackHTML(sol, total, active) {
    let html = '<div class="stack">';
    active.forEach(function (a, j) {
      const w = sol.counts[j] * a.size;
      if (w <= 0) return;
      const pct = (w / total) * 100;
      const label = pct > 9 ? String(sol.counts[j]) : '';
      html += '<div class="seg" style="width:' + pct.toFixed(3) + '%;background:' + a.color + '"'
        + ' title="' + trimNum(a.size) + 'g × ' + sol.counts[j] + ' = ' + fmt(w) + 'g">' + label + '</div>';
    });
    const loss = total - sol.used;
    if (loss > EPS) {
      const pct = (loss / total) * 100;
      const label = pct > 12 ? ('损失 ' + fmt(loss) + 'g') : '';
      html += '<div class="seg loss" style="width:' + pct.toFixed(3) + '%" title="损失 ' + fmt(loss) + 'g">' + label + '</div>';
    }
    html += '</div>';
    return html;
  }

  function metricsHTML(sol) {
    return '<div class="metrics">'
      + '<span>总量 <b>' + fmt(sol.used) + 'g</b></span>'
      + '<span>损失 <b>' + fmt(sol.waste) + 'g</b></span>'
      + '<span>包数 <b>' + sol.packs + '</b></span>'
      + '<span>包数差 <b>' + sol.imb + '</b></span>'
      + '</div>';
  }

  function bestHTML(sol, total, active) {
    return '<div class="best">'
      + '<div class="best-head"><span class="best-label">最佳方案</span><span class="badge">' + sol.packs + ' 包</span></div>'
      + '<div class="sol-title big">' + titleHTML(sol, active) + '</div>'
      + stackHTML(sol, total, active)
      + metricsHTML(sol)
      + '</div>';
  }

  function solHTML(sol, total, active) {
    return '<div class="sol">'
      + '<div class="sol-head"><span class="sol-title">' + titleHTML(sol, active) + '</span>'
      + '<span class="sol-meta">损失 ' + fmt(sol.waste) + 'g · 包数差 ' + sol.imb + '</span></div>'
      + stackHTML(sol, total, active)
      + metricsHTML(sol)
      + '</div>';
  }

  function renderTabs() {
    tabsEl.innerHTML = STRATEGIES.map(function (s) {
      return '<button class="tab" role="tab" data-id="' + s.id + '" aria-selected="'
        + (s.id === state.current) + '">' + s.name + '</button>';
    }).join('');
    Array.prototype.forEach.call(tabsEl.querySelectorAll('.tab'), function (btn) {
      btn.addEventListener('click', function () {
        state.current = btn.dataset.id;
        renderTabs();
        renderPanel();
      });
    });
  }

  function renderPanel() {
    const id = state.current;
    const st = state.strategies[id];
    const active = state.active;

    if (!st || !st.list.length) {
      panelEl.innerHTML = '<p class="hint">没有满足条件的方案。</p>';
      return;
    }

    const best = st.list[0];
    const alts = st.list.slice(1).sort(function (a, b) { return b.packs - a.packs; });
    const totalPages = Math.max(1, Math.ceil(alts.length / PAGE_SIZE));
    let page = state.page[id];
    if (page > totalPages) page = totalPages;
    if (page < 1) page = 1;
    state.page[id] = page;
    const start = (page - 1) * PAGE_SIZE;
    const visible = alts.slice(start, start + PAGE_SIZE);

    const groups = new Map();
    visible.forEach(function (s) {
      if (!groups.has(s.packs)) groups.set(s.packs, []);
      groups.get(s.packs).push(s);
    });
    const order = Array.from(groups.keys()).sort(function (a, b) { return b - a; });

    let groupsHTML = '';
    order.forEach(function (p) {
      const items = groups.get(p);
      groupsHTML += '<div class="group"><div class="group-title">共 ' + p + ' 包 · ' + items.length + ' 个方案</div>'
        + items.map(function (s) { return solHTML(s, state.total, active); }).join('')
        + '</div>';
    });

    let pagerHTML = '';
    if (totalPages > 1) {
      pagerHTML = '<div class="pager">'
        + '<button id="prevPage"' + (page <= 1 ? ' disabled' : '') + '>上一页</button>'
        + '<span class="page-info">第 ' + page + ' / ' + totalPages + ' 页（共 ' + alts.length + ' 个其他方案）</span>'
        + '<button id="nextPage"' + (page >= totalPages ? ' disabled' : '') + '>下一页</button>'
        + '</div>';
    }

    panelEl.innerHTML = '<p class="strategy-desc">' + st.desc + '</p>'
      + bestHTML(best, state.total, active)
      + (order.length ? '<div class="group-title" style="margin-top:8px">其他方案（按包数分组）</div>' : '')
      + groupsHTML
      + pagerHTML;

    const prevBtn = document.getElementById('prevPage');
    const nextBtn = document.getElementById('nextPage');
    if (prevBtn) {
      prevBtn.addEventListener('click', function () {
        state.page[id] = Math.max(1, state.page[id] - 1);
        renderPanel();
      });
    }
    if (nextBtn) {
      nextBtn.addEventListener('click', function () {
        state.page[id] = Math.min(totalPages, state.page[id] + 1);
        renderPanel();
      });
    }
  }

  sizeInputs.forEach(function (input) {
    input.addEventListener('input', updateSelectOptions);
    input.addEventListener('change', updateSelectOptions);
  });

  calculateButton.addEventListener('click', compute);

  updateSelectOptions();
});
