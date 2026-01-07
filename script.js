// script.js
// 分离自 index.html 的脚本。包含必要注释与计算过程渲染（支持 KaTeX）。

// Helper formatting
const fmtWeight = v => (isFinite(v) ? v.toFixed(1) + ' g' : '-');
const fmtPct = v => (isFinite(v) ? v.toFixed(2) + ' %' : '-');

// 元素选择
const modeRadios = document.querySelectorAll('input[name="mode"]');
const doseEl = document.getElementById('dose');
const ratioEl = document.getElementById('ratio');
const beverageEl = document.getElementById('beverage');
const brewTypeEl = document.getElementById('brewType');
const tdsEl = document.getElementById('tds');
const targetTdsEl = document.getElementById('targetTds');

const ratioCol = document.getElementById('ratioCol');
const beverageCol = document.getElementById('beverageCol');

const outEy = document.getElementById('ey');
const outBeverage = document.getElementById('outBeverage');
const outBypass = document.getElementById('bypass');
const outSummary = document.getElementById('summary');
const calcStepsEl = document.getElementById('calcSteps');

// 返回当前模式：'ratio' 或 'beverage'
function getMode(){ return document.querySelector('input[name="mode"]:checked').value }

// 吸水系数：espresso=1.5，drip=2.0
function absorptionFor(type){
  return type === 'espresso' ? 1.5 : 2.0;
}

// 从输入元素读取浮点值，非法返回 NaN
function parseInput(el){
  const v = parseFloat(el.value);
  return isFinite(v) ? v : NaN;
}

// 将计算步骤渲染到页面；若 KaTeX 可用则渲染为数学公式
function renderSteps(context){
  // context 包含 dose, ratio, water, absorbed, beverage, tds, ey, totalSolids, targetBeverage, bypass
  const lines = [];

  // 公式：water = dose * ratio
  if (context.mode === 'ratio'){
    // 使用正确的反斜杠转义（JS 字符串中用 `\\` 表示单个反斜杠），
    // 这里在模板字符串中使用 `\\` 会产生 `\\` -> 结果字符串为 `\\`? 注意：在源文件中写 `\\` 会被解析为 `\\`。
    // 直接在模板字符串中写 `\\` 不必要；应写双反斜杠 `\\`? 实际上，写 `\\` 会在最终字符串中产生 `\\`，
    // 为简洁与可读性，下面使用双反斜杠 `\\` 以确保传入 KaTeX 的内容包含单个反斜杠转义序列（例如 `\times`）。
    // 在公式中加入中文注释：water(总水量), absorbed(粉吸收的水量)
    lines.push({tex: `water\\,\\text{(总水量)} = dose \\times ratio = ${context.dose} \\times ${context.ratio} = ${context.water.toFixed(1)}\\,g`} );
    lines.push({tex: `absorbed\\,\\text{(粉吸收的水量)} = dose \\times absorption = ${context.dose} \\times ${context.absorption} = ${context.absorbed.toFixed(1)}\\,g`} );
    lines.push({tex: `beverage\\,\\text{(咖啡液重)} = water - absorbed = ${context.water.toFixed(1)} - ${context.absorbed.toFixed(1)} = ${context.beverage.toFixed(1)}\\,g`} );
  } else {
    lines.push({tex: `beverage = ${context.beverage.toFixed(1)}\\,g (由输入给定)`});
  }

  // EY（萃取率）并加中文说明
  lines.push({tex: `EY\\,\\text{(萃取率)} = \\dfrac{beverage \\times tds}{dose} = \\dfrac{${context.beverage.toFixed(1)} \\times ${context.tds.toFixed(2)}\\%}{${context.dose.toFixed(1)}} = ${context.ey.toFixed(2)}\\%`} );

  if (isFinite(context.targetTds) && context.targetTds>0){
    // total_solids（溶解固体总量）、target_beverage（目标液重）、bypass（需要的 Bypass 水量）
    lines.push({tex: `total\\_solids\\,\\text{(溶解固体总量)} = beverage \\times tds = ${context.beverage.toFixed(1)} \\times ${context.tds.toFixed(2)}\\% = ${context.totalSolids.toFixed(3)}\\,g`} );
    lines.push({tex: `target\\_beverage\\,\\text{(目标液重)} = \\dfrac{total\\_solids}{target\\_tds} = \\dfrac{${context.totalSolids.toFixed(3)}}{${context.targetTds.toFixed(2)}\\%} = ${context.targetBeverage.toFixed(1)}\\,g`} );
    lines.push({tex: `bypass\\,\\text{(需要 bypass 的水量)} = target\\_beverage - beverage = ${context.targetBeverage.toFixed(1)} - ${context.beverage.toFixed(1)} = ${context.bypass.toFixed(1)}\\,g`} );
  }

  // 渲染逻辑：如果 KaTeX 可用，使用它；否则回退为纯文本
  if (window.katex && typeof window.katex.renderToString === 'function'){
    calcStepsEl.innerHTML = lines.map(l => katex.renderToString(l.tex, {throwOnError:false, displayMode:true})).join('\n');
  } else {
    // 回退：将 LaTeX 转为可读纯文本，避免显示原始命令（如 dfrac）
    function latexToPlain(s){
      return s
        // 保留 \text{} 中的中文并加空格/括号以提高可读性
        .replace(/\\text\{([^}]*)\}/g, ' ($1)')
        .replace(/\\dfrac\{([^}]*)\}\{([^}]*)\}/g, '($1)/($2)')
        .replace(/\\times/g, ' × ')
        .replace(/\\,/g, '')
        .replace(/\\%/g, '%')
        .replace(/\\_/g, '_')
        .replace(/\$/g,'')
        .replace(/\\/g,'');
    }
    calcStepsEl.innerHTML = lines.map(l => latexToPlain(l.tex)).join('<br>');
  }
}

// 渲染 NaN 状态（提示）
function renderNaN(msg){
  outEy.textContent = '-';
  outBeverage.textContent = '-';
  outBypass.textContent = '-';
  outSummary.textContent = msg || '-';
  calcStepsEl.textContent = msg || '-';
}

// 主计算函数，负责所有数值计算与 UI 更新
function compute(){
  const mode = getMode();
  const dose = parseInput(doseEl);
  const tds = parseInput(tdsEl);
  const targetTds = parseInput(targetTdsEl);
  const brewType = brewTypeEl.value;

  let beverage = NaN;
  let ey = NaN;

  if (!(dose>0 && tds>0)){
    renderNaN('请填写有效的 dose 与 tds');
    return;
  }

  let water = NaN;
  let absorbed = NaN;
  const absorption = absorptionFor(brewType);

  if (mode === 'ratio'){
    const ratio = parseInput(ratioEl);
    if (!(ratio>0)) { renderNaN('请填写有效的 ratio'); return }
    water = dose * ratio; // 注水量
    absorbed = dose * absorption;
    beverage = water - absorbed;
    if (!(beverage>0)) { renderNaN('根据吸水假设，推导出的 beverage 非正'); return }
    ey = (beverage * (tds/100)) / dose * 100; // ey in %
  } else {
    const bev = parseInput(beverageEl);
    if (!(bev>0)) { renderNaN('请填写有效的 beverage'); return }
    beverage = bev;
    ey = (beverage * (tds/100)) / dose * 100;
  }

  // Bypass calculation
  let bypass = NaN;
  let totalSolids = NaN;
  let targetBeverage = NaN;
  if (targetTds>0){
    totalSolids = beverage * (tds/100);
    targetBeverage = totalSolids / (targetTds/100);
    bypass = targetBeverage - beverage;
  }

  // Render outputs
  outEy.textContent = fmtPct(ey);
  outBeverage.textContent = fmtWeight(beverage);
  outBypass.textContent = isFinite(bypass) ? fmtWeight(bypass) : '-';
  outSummary.textContent = `${dose.toFixed(1)} g  / ` +
    (mode === 'ratio' ? `1:${ratioEl.value} / ${brewTypeEl.value}` : `${beverage.toFixed(1)} g`) +
    ` / tds ${tds.toFixed(2)}%`;

  // Build context 并渲染计算步骤
  const ctx = {
    mode, dose, ratio: parseFloat(ratioEl.value || NaN), water, absorption, absorbed, beverage, tds, ey, totalSolids, targetTds, targetBeverage, bypass
  };
  renderSteps(ctx);
}

// 模式切换逻辑：显示/隐藏 ratio/beverage 输入域
modeRadios.forEach(r => r.addEventListener('change', ()=>{
  const m = getMode();
  if (m === 'ratio'){
    ratioCol.style.display = '';
    beverageCol.style.display = 'none';
  } else {
    ratioCol.style.display = 'none';
    beverageCol.style.display = '';
  }
  compute();
}));

// 绑定输入监听器，实现即时响应
[doseEl, ratioEl, beverageEl, brewTypeEl, tdsEl, targetTdsEl].forEach(el=>{
  el.addEventListener('input', compute);
});

// 页面加载完成后首次计算
compute();
