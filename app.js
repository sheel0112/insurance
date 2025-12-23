// Bermuda UW Companion (offline-capable PWA)
// All calculations are transparent + stored locally.

const $ = (sel) => document.querySelector(sel);
const page = $("#page");
const tabsEl = $("#tabs");
const presetSelect = $("#presetSelect");
const stressSelect = $("#stressSelect");
const ccySelect = $("#ccySelect");

const storageKey = "bw_uw_companion_v1";
const state = loadState();

// ---- helpers
function fmtMoney(x, ccy){
  if (x === null || x === undefined || isNaN(x)) return "—";
  const abs = Math.abs(x);
  const digits = abs >= 1e6 ? 0 : (abs >= 1e3 ? 0 : 2);
  return new Intl.NumberFormat(undefined, {style:"currency", currency: ccy, maximumFractionDigits: digits}).format(x);
}
function fmtPct(x){
  if (x === null || x === undefined || isNaN(x)) return "—";
  return (x*100).toFixed(2) + "%";
}
function num(v, fallback=0){
  const n = Number(String(v).replace(/,/g,""));
  return isFinite(n) ? n : fallback;
}
function clamp(x, a, b){ return Math.max(a, Math.min(b, x)); }
function saveState(){ localStorage.setItem(storageKey, JSON.stringify(state)); }
function loadState(){
  try{
    const raw = localStorage.getItem(storageKey);
    if (!raw) return { activeTab:"uw", preset:"bm_property_cat", stress:"normal", ccy:"USD", inputs:{} };
    return JSON.parse(raw);
  }catch{ return { activeTab:"uw", preset:"bm_property_cat", stress:"normal", ccy:"USD", inputs:{} }; }
}
function setInput(id, value){
  state.inputs[id] = value;
  saveState();
  render();
}
function getInput(id, def){ return (state.inputs[id] ?? def); }

// ---- presets (Bermuda-flavoured learning numbers, not market quotes)
const presets = {
  bm_property_cat: {
    name: "Bermuda Property Cat (XoL layer)",
    chips: ["Property cat", "Occ XoL", "Bermuda market framing"],
    set: {
      // XoL
      "xol.loss": 25000000,
      "xol.attach": 10000000,
      "xol.limit": 20000000,
      // ROL
      "rol.premium": 3500000,
      "rol.limit": 20000000,
      "rol.expLoss": 1800000,
      // BC
      "bc.layerLosses": 9000000,
      "bc.years": 5,
      "bc.premium": 3500000,
      "bc.load": 0.20,
      // CR
      "cr.losses": 12000000,
      "cr.earnedPrem": 18000000,
      "cr.expenses": 4500000,
      // ROE
      "roe.netIncome": 2400000,
      "roe.equity": 30000000,
      // QS
      "qs.gwp": 18000000,
      "qs.share": 0.25,
      "qs.losses": 12000000,
      // Surplus
      "ss.sumInsured": 10000000,
      "ss.retention": 2000000,
      "ss.lines": 4,
      "ss.loss": 1500000,
      // ELC
      "elc.subPrem": 18000000,
      "elc.elr": 0.62,
      "elc.layerFactor": 0.14,
      // Decision tool
      "uw.targetROL": 0.18,
      "uw.maxPayback": 2.5,
      "uw.maxCR": 1.00,
      "uw.minROE": 0.10,
      "uw.useStructure": "xol" // xol or qs
    }
  },
  bm_casualty_xol: {
    name: "Bermuda Casualty (XoL, attritional + large loss)",
    chips: ["Casualty", "XoL", "Long-tail lens"],
    set: {
      "xol.loss": 6000000,
      "xol.attach": 2000000,
      "xol.limit": 5000000,
      "rol.premium": 950000,
      "rol.limit": 5000000,
      "rol.expLoss": 550000,
      "bc.layerLosses": 2800000,
      "bc.years": 7,
      "bc.premium": 950000,
      "bc.load": 0.25,
      "cr.losses": 7200000,
      "cr.earnedPrem": 9000000,
      "cr.expenses": 2400000,
      "roe.netIncome": 700000,
      "roe.equity": 8000000,
      "qs.gwp": 9000000,
      "qs.share": 0.15,
      "qs.losses": 7200000,
      "ss.sumInsured": 5000000,
      "ss.retention": 1000000,
      "ss.lines": 5,
      "ss.loss": 900000,
      "elc.subPrem": 9000000,
      "elc.elr": 0.80,
      "elc.layerFactor": 0.10,
      "uw.targetROL": 0.20,
      "uw.maxPayback": 3.0,
      "uw.maxCR": 1.02,
      "uw.minROE": 0.08,
      "uw.useStructure": "xol"
    }
  },
  bm_qs_portfolio: {
    name: "Bermuda Quota Share (portfolio support)",
    chips: ["Quota share", "Capital relief / growth"],
    set: {
      "qs.gwp": 25000000,
      "qs.share": 0.30,
      "qs.losses": 14000000,
      "cr.losses": 14000000,
      "cr.earnedPrem": 22000000,
      "cr.expenses": 5500000,
      "roe.netIncome": 1500000,
      "roe.equity": 15000000,
      "elc.subPrem": 25000000,
      "elc.elr": 0.58,
      "elc.layerFactor": 1.00,
      "uw.targetROL": 0.00,
      "uw.maxPayback": 0.0,
      "uw.maxCR": 0.98,
      "uw.minROE": 0.10,
      "uw.useStructure": "qs"
    }
  }
};

// ---- stress adjustments (simple learning knobs)
function applyStressToValue(id, v, mode){
  // We keep it intentionally lightweight & explainable.
  if (mode === "normal") return v;

  // Cat year: push severity/occurrence losses higher; keep premium unchanged to see effect.
  if (mode === "cat"){
    if (id.includes("loss") || id.includes("losses") || id === "cr.losses" || id === "xol.loss") return v * 1.35;
    if (id === "elc.elr") return clamp(v * 1.10, 0, 0.999);
    return v;
  }

  // Bad development: loss ratio creep (especially long-tail); modest expense creep.
  if (mode === "baddev"){
    if (id.includes("loss") || id.includes("losses") || id === "cr.losses") return v * 1.18;
    if (id === "cr.expenses") return v * 1.06;
    if (id === "elc.elr") return clamp(v * 1.08, 0, 0.999);
    return v;
  }

  return v;
}

function get(id, def){
  const raw = getInput(id, def);
  const v = typeof raw === "string" ? num(raw, def) : raw;
  return applyStressToValue(id, v, state.stress);
}

// ---- pages / formulas
const tabs = [
  {id:"uw", label:"Decision Tool"},
  {id:"xol", label:"XoL Layer"},
  {id:"rol", label:"ROL & Payback"},
  {id:"bc", label:"Burning Cost"},
  {id:"qs", label:"Quota Share"},
  {id:"ss", label:"Surplus Share"},
  {id:"elc", label:"Exposure Loss Cost"},
  {id:"cr", label:"Combined Ratio"},
  {id:"roe", label:"ROE"},
];

function inputField({id,label,help,type="number",step="any"}){
  const val = getInput(id,"");
  const shown = (val === null || val === undefined) ? "" : val;
  return `
    <div class="col">
      <label class="label">${label}</label>
      <input class="input" inputmode="decimal" type="${type}" step="${step}"
        value="${String(shown).replaceAll('"','&quot;')}"
        oninput="window.__set('${id}', this.value)" />
      <small class="help">${help}</small>
    </div>
  `;
}

function kv(k,v){ return `<div class="kv"><div class="k">${k}</div><div class="v">${v}</div></div>`; }

function renderUW(){
  // Choose structure: QS vs XoL driven learning.
  const useStructure = String(getInput("uw.useStructure","xol"));
  const targetROL = num(getInput("uw.targetROL", 0.18));
  const maxPayback = num(getInput("uw.maxPayback", 2.5));
  const maxCR = num(getInput("uw.maxCR", 1.00));
  const minROE = num(getInput("uw.minROE", 0.10));

  // Derived metrics from existing pages
  const ccy = state.ccy;

  // XoL metrics
  const rol = calcROL();
  const payback = calcPayback();
  // Portfolio metrics
  const cr = calcCR();
  const roe = calcROE();

  // Simple decision logic
  let score = 0;
  let checks = [];

  if (useStructure === "xol"){
    const rolOk = rol.rol <= targetROL;
    const pbOk = payback.years <= maxPayback;
    checks.push({name:"ROL vs target", ok: rolOk, detail:`${fmtPct(rol.rol)} vs target ${fmtPct(targetROL)}`});
    checks.push({name:"Payback vs max", ok: pbOk, detail:`${payback.years.toFixed(2)} yrs vs max ${maxPayback.toFixed(2)} yrs`});
    score += (rolOk ? 1 : 0);
    score += (pbOk ? 1 : 0);
  } else {
    const qs = calcQS();
    checks.push({name:"Ceded share sanity", ok: (qs.share>0 && qs.share<0.6), detail:`QS share ${fmtPct(qs.share)} (learning check)`});
    score += ((qs.share>0 && qs.share<0.6) ? 1 : 0);
  }

  const crOk = cr.combined <= maxCR;
  const roeOk = roe.roe >= minROE;
  checks.push({name:"Combined Ratio", ok: crOk, detail:`${fmtPct(cr.combined)} vs max ${fmtPct(maxCR)}`});
  checks.push({name:"ROE", ok: roeOk, detail:`${fmtPct(roe.roe)} vs min ${fmtPct(minROE)}`});
  score += (crOk ? 1 : 0);
  score += (roeOk ? 1 : 0);

  const decision = (score >= 4) ? "PASS" : (score >= 2 ? "REVIEW" : "DECLINE");
  const badgeClass = (decision === "PASS") ? "ok" : (decision === "REVIEW" ? "warn" : "bad");

  const structureHelp = useStructure === "xol"
    ? "Use this when you’re evaluating an occurrence layer (common in Bermuda property cat)."
    : "Use this when you’re learning portfolio support / growth via proportional reinsurance.";

  return `
    <div class="grid">
      <div>
        <div class="h2">Mini Underwriting Decision Tool</div>
        <div class="muted">A learning scaffold: set targets, stress the scenario, and see if the structure still holds.</div>
        <div class="hr"></div>

        <div class="row gap">
          <div class="col">
            <label class="label">Structure</label>
            <select class="input" onchange="window.__set('uw.useStructure', this.value)">
              <option value="xol" ${useStructure==="xol"?"selected":""}>XoL Layer</option>
              <option value="qs" ${useStructure==="qs"?"selected":""}>Quota Share</option>
            </select>
            <small class="help">${structureHelp}</small>
          </div>
          ${useStructure==="xol" ? `
            ${inputField({
              id:"uw.targetROL",
              label:"Target ROL (max)",
              help:"Your acceptable premium ÷ limit. Lower = cheaper protection. Learning target ~15–25% varies by class/market.",
              type:"number", step:"0.001"
            })}
            ${inputField({
              id:"uw.maxPayback",
              label:"Max Payback (years)",
              help:"Premium ÷ expected annual loss. Lower = faster expected recovery.",
              type:"number", step:"0.01"
            })}
          ` : ``}
        </div>

        <div class="row gap" style="margin-top:10px">
          ${inputField({
            id:"uw.maxCR",
            label:"Max Combined Ratio",
            help:"Underwriting-only profitability hurdle. <100% is underwriting profit.",
            type:"number", step:"0.001"
          })}
          ${inputField({
            id:"uw.minROE",
            label:"Min ROE",
            help:"Capital efficiency hurdle. Bermuda conversations often tie ROE to deployed capital + volatility.",
            type:"number", step:"0.001"
          })}
        </div>

        <div class="hr"></div>

        <div class="row" style="justify-content:space-between; align-items:center; gap:10px">
          <div class="badge ${badgeClass}">Decision: ${decision}</div>
          <div class="muted">Score: ${score} / 4</div>
        </div>

        <div class="chips">
          ${checks.map(c => `<div class="chip">${c.ok ? "✅" : "⚠️"} <b style="color:var(--text)">${c.name}</b>: ${c.detail}</div>`).join("")}
        </div>

        <div class="hr"></div>
        <div class="muted">
          <b>How to use for learning:</b> flip Stress Mode to “Cat year” and watch which hurdle breaks first.
          That’s usually where underwriting focus goes (price, attachment, limit, or portfolio mix).
        </div>
      </div>

      <div>
        <div class="h2">Key outputs at a glance</div>
        <div class="muted">Pulled from the other pages using your current inputs.</div>
        <div class="hr"></div>
        ${kv("Combined Ratio", fmtPct(cr.combined))}
        ${kv("ROE", fmtPct(roe.roe))}
        ${useStructure==="xol" ? `
          ${kv("ROL", fmtPct(rol.rol))}
          ${kv("Payback", isFinite(payback.years) ? (payback.years.toFixed(2)+" yrs") : "—")}
          ${kv("Example Layer Payout (current loss)", fmtMoney(calcXOL().payout, ccy))}
        ` : `
          ${kv("Ceded Premium (QS)", fmtMoney(calcQS().cededPrem, ccy))}
          ${kv("Ceded Loss (QS)", fmtMoney(calcQS().cededLoss, ccy))}
        `}
      </div>
    </div>
  `;
}

function calcXOL(){
  const loss = get("xol.loss", 0);
  const attach = get("xol.attach", 0);
  const limit = get("xol.limit", 0);
  const payout = Math.min(Math.max(loss - attach, 0), limit);
  return {loss, attach, limit, payout};
}
function renderXOL(){
  const ccy = state.ccy;
  const r = calcXOL();
  return `
    <div class="h2">Excess of Loss (XoL) Layer</div>
    <div class="muted">Payout = min(max(Loss − Attachment, 0), Limit)</div>
    <div class="hr"></div>

    <div class="row gap">
      ${inputField({id:"xol.loss", label:"Loss Amount (Occurrence)", help:"The claim amount for the event. For property cat, think hurricane occurrence loss.", step:"1"})}
      ${inputField({id:"xol.attach", label:"Attachment", help:"Reinsurer starts paying above this point (insurer retains up to here).", step:"1"})}
      ${inputField({id:"xol.limit", label:"Limit", help:"Maximum the layer pays above attachment.", step:"1"})}
    </div>

    <div class="hr"></div>
    ${kv("Layer payout", fmtMoney(r.payout, ccy))}
    <div class="chips">
      <div class="chip">Bermuda lens: property cat pricing often framed around layer view (attachment/limit) + ROL.</div>
      <div class="chip">Try Stress Mode “Cat year”: watch payout increase when loss moves deeper into the layer.</div>
    </div>
  `;
}

function calcROL(){
  const premium = get("rol.premium", 0);
  const limit = get("rol.limit", 0);
  const rol = (limit>0) ? premium/limit : NaN;
  return {premium, limit, rol};
}
function calcPayback(){
  const premium = get("rol.premium", 0);
  const expLoss = get("rol.expLoss", 0);
  const years = (expLoss>0) ? premium/expLoss : NaN;
  return {premium, expLoss, years};
}
function renderROL(){
  const ccy = state.ccy;
  const r = calcROL();
  const pb = calcPayback();
  return `
    <div class="h2">Rate on Line (ROL) & Payback</div>
    <div class="muted">ROL = Reinsurance Premium ÷ Limit. Payback = Premium ÷ Expected Annual Loss.</div>
    <div class="hr"></div>

    <div class="row gap">
      ${inputField({id:"rol.premium", label:"Reinsurance Premium", help:"What you pay for this layer (annual).", step:"1"})}
      ${inputField({id:"rol.limit", label:"Limit", help:"Layer limit (same as XoL limit).", step:"1"})}
      ${inputField({id:"rol.expLoss", label:"Expected Annual Loss (layer)", help:"Modelled / burning-cost expected loss in the layer.", step:"1"})}
    </div>

    <div class="hr"></div>
    ${kv("ROL", fmtPct(r.rol))}
    ${kv("Payback", isFinite(pb.years) ? (pb.years.toFixed(2) + " years") : "—")}
    <div class="chips">
      <div class="chip">Bermuda lens: traders/underwriters often compare ROL across placements & seasons, then sanity-check against expected loss & volatility.</div>
      <div class="chip">Lower payback is generally better, but attachment/volatility matter.</div>
    </div>
  `;
}

function renderBC(){
  const ccy = state.ccy;
  const layerLosses = get("bc.layerLosses", 0);
  const years = get("bc.years", 1);
  const premium = get("bc.premium", 0);
  const load = num(getInput("bc.load", 0.20));
  const burningCost = (years>0) ? (layerLosses/years) : NaN;
  const bcRate = (premium>0) ? (burningCost/premium) : NaN;
  const loadedRate = bcRate * (1+load);

  return `
    <div class="h2">Burning Cost</div>
    <div class="muted">Annualised layer loss cost from history. Then compare to premium and apply a load for uncertainty/profit.</div>
    <div class="hr"></div>

    <div class="row gap">
      ${inputField({id:"bc.layerLosses", label:"Historical Losses in Layer (sum)", help:"Total historical claims that would have hit THIS exact layer.", step:"1"})}
      ${inputField({id:"bc.years", label:"Exposure Period (years)", help:"Number of years of credible history (e.g., 5–10).", step:"0.1"})}
      ${inputField({id:"bc.premium", label:"Layer Premium", help:"Annual premium charged for this layer.", step:"1"})}
    </div>

    <div class="row gap" style="margin-top:10px">
      ${inputField({id:"bc.load", label:"Load Factor (0–1)", help:"Margin for volatility, model uncertainty, expenses, profit. Example: 0.20 = +20%.", step:"0.01"})}
      <div class="col"></div><div class="col"></div>
    </div>

    <div class="hr"></div>
    ${kv("Annualised burning cost", fmtMoney(burningCost, ccy))}
    ${kv("Burning cost rate (BC ÷ Premium)", fmtPct(bcRate))}
    ${kv("Loaded BC rate", fmtPct(loadedRate))}
    <div class="chips">
      <div class="chip">Bermuda lens: cat layers often need extra load for tail risk + climate uncertainty, not just history.</div>
    </div>
  `;
}

function calcQS(){
  const gwp = get("qs.gwp", 0);
  const share = num(getInput("qs.share", 0.25));
  const losses = get("qs.losses", 0);
  const cededPrem = gwp * share;
  const cededLoss = losses * share;
  const netPrem = gwp - cededPrem;
  const netLoss = losses - cededLoss;
  return {gwp, share, losses, cededPrem, cededLoss, netPrem, netLoss};
}
function renderQS(){
  const ccy = state.ccy;
  const r = calcQS();
  return `
    <div class="h2">Quota Share (QS)</div>
    <div class="muted">Proportional: reinsurer takes a fixed % of premium and the same % of losses.</div>
    <div class="hr"></div>

    <div class="row gap">
      ${inputField({id:"qs.gwp", label:"Gross Written Premium (GWP)", help:"Total premium written before reinsurance.", step:"1"})}
      ${inputField({id:"qs.share", label:"Quota Share % (0–1)", help:"Fraction ceded to reinsurer. 0.30 = 30% of every policy.", step:"0.01"})}
      ${inputField({id:"qs.losses", label:"Gross Losses", help:"Total losses incurred before reinsurance (same portfolio as GWP).", step:"1"})}
    </div>

    <div class="hr"></div>
    ${kv("Ceded premium", fmtMoney(r.cededPrem, ccy))}
    ${kv("Ceded losses", fmtMoney(r.cededLoss, ccy))}
    ${kv("Net premium (after QS)", fmtMoney(r.netPrem, ccy))}
    ${kv("Net losses (after QS)", fmtMoney(r.netLoss, ccy))}
    <div class="chips">
      <div class="chip">Bermuda lens: QS can be used for growth, capital relief, and stabilising results — but it shares upside too.</div>
    </div>
  `;
}

function renderSS(){
  const ccy = state.ccy;
  const sumInsured = get("ss.sumInsured", 0);
  const retention = get("ss.retention", 0);
  const lines = get("ss.lines", 0);
  const loss = get("ss.loss", 0);

  const maxCeded = retention * lines;
  const cededShare = (sumInsured>0) ? clamp((sumInsured - retention) / sumInsured, 0, maxCeded/sumInsured) : 0;
  const cededLoss = loss * cededShare;
  const netLoss = loss - cededLoss;

  return `
    <div class="h2">Surplus Share</div>
    <div class="muted">Ceded share depends on policy size: you keep a retention, reinsurer takes the surplus up to a number of lines.</div>
    <div class="hr"></div>

    <div class="row gap">
      ${inputField({id:"ss.sumInsured", label:"Policy Sum Insured", help:"The insured value/limit of a single policy.", step:"1"})}
      ${inputField({id:"ss.retention", label:"Retention (Net line)", help:"Max amount you keep per policy before ceding begins.", step:"1"})}
      ${inputField({id:"ss.lines", label:"Number of Lines", help:"Multiples of retention the reinsurer will accept as surplus.", step:"1"})}
    </div>

    <div class="row gap" style="margin-top:10px">
      ${inputField({id:"ss.loss", label:"Policy Loss", help:"Loss on this policy (for allocation example).", step:"1"})}
      <div class="col"></div><div class="col"></div>
    </div>

    <div class="hr"></div>
    ${kv("Max ceded capacity", fmtMoney(maxCeded, ccy))}
    ${kv("Ceded share (approx)", fmtPct(cededShare))}
    ${kv("Ceded loss", fmtMoney(cededLoss, ccy))}
    ${kv("Net loss", fmtMoney(netLoss, ccy))}
    <div class="chips">
      <div class="chip">Use for learning proportional sizing — unlike QS, the cession varies with policy limit.</div>
    </div>
  `;
}

function renderELC(){
  const ccy = state.ccy;
  const subPrem = get("elc.subPrem", 0);
  const elr = get("elc.elr", 0.60);
  const layerFactor = get("elc.layerFactor", 0.10);
  const expGrossLoss = subPrem * elr;
  const expLayerLoss = expGrossLoss * layerFactor;

  return `
    <div class="h2">Exposure Loss Cost</div>
    <div class="muted">Expected layer loss = Subject Premium × ELR × Layer Factor (useful when loss history is thin).</div>
    <div class="hr"></div>

    <div class="row gap">
      ${inputField({id:"elc.subPrem", label:"Subject Premium", help:"Premium exposed to the risk (gross or net depending on context).", step:"1"})}
      ${inputField({id:"elc.elr", label:"Expected Loss Ratio (ELR)", help:"Expected % of premium that becomes losses (0–1).", step:"0.01"})}
      ${inputField({id:"elc.layerFactor", label:"Layer Factor", help:"Share of total losses expected to fall into the layer (0–1).", step:"0.01"})}
    </div>

    <div class="hr"></div>
    ${kv("Expected gross losses", fmtMoney(expGrossLoss, ccy))}
    ${kv("Expected layer losses", fmtMoney(expLayerLoss, ccy))}
    <div class="chips">
      <div class="chip">Bermuda lens: layer factors are often derived from curves, modelling, or benchmarking, especially for cat layers.</div>
    </div>
  `;
}

function calcCR(){
  const losses = get("cr.losses", 0);
  const earnedPrem = get("cr.earnedPrem", 0);
  const expenses = get("cr.expenses", 0);
  const lossRatio = (earnedPrem>0) ? losses/earnedPrem : NaN;
  const expRatio = (earnedPrem>0) ? expenses/earnedPrem : NaN;
  const combined = lossRatio + expRatio;
  return {losses, earnedPrem, expenses, lossRatio, expRatio, combined};
}
function renderCR(){
  const ccy = state.ccy;
  const r = calcCR();
  return `
    <div class="h2">Combined Ratio</div>
    <div class="muted">Combined = Loss Ratio + Expense Ratio. Underwriting profitability: &lt; 100% is profit (before investment income).</div>
    <div class="hr"></div>

    <div class="row gap">
      ${inputField({id:"cr.losses", label:"Losses Incurred", help:"Claims paid + case reserves + IBNR (period).", step:"1"})}
      ${inputField({id:"cr.earnedPrem", label:"Earned Premium", help:"Premium earned over the period (not written).", step:"1"})}
      ${inputField({id:"cr.expenses", label:"Expenses", help:"Acquisition + admin + brokerage/commissions (period).", step:"1"})}
    </div>

    <div class="hr"></div>
    ${kv("Loss ratio", fmtPct(r.lossRatio))}
    ${kv("Expense ratio", fmtPct(r.expRatio))}
    ${kv("Combined ratio", fmtPct(r.combined))}
    <div class="chips">
      <div class="chip">Bermuda lens: many conversations separate underwriting result vs investment/float return, especially for cat.</div>
    </div>
  `;
}

function calcROE(){
  const netIncome = get("roe.netIncome", 0);
  const equity = get("roe.equity", 0);
  const roe = (equity>0) ? netIncome/equity : NaN;
  return {netIncome, equity, roe};
}
function renderROE(){
  const ccy = state.ccy;
  const r = calcROE();
  return `
    <div class="h2">Return on Equity (ROE)</div>
    <div class="muted">ROE = Net Income ÷ Equity. Measures capital efficiency (not just underwriting quality).</div>
    <div class="hr"></div>

    <div class="row gap">
      ${inputField({id:"roe.netIncome", label:"Net Income", help:"Profit after losses, expenses, reinsurance costs (period).", step:"1"})}
      ${inputField({id:"roe.equity", label:"Equity / Capital", help:"Capital supporting the book/layer. In Bermuda: closely tied to volatility & rating constraints.", step:"1"})}
      <div class="col"></div>
    </div>

    <div class="hr"></div>
    ${kv("ROE", fmtPct(r.roe))}
    <div class="chips">
      <div class="chip">Learning: ROE can look great with low equity — but volatility may be unacceptable; stress it.</div>
    </div>
  `;
}

// ---- router render
function render(){
  // header controls
  stressSelect.value = state.stress;
  ccySelect.value = state.ccy;

  // tabs
  tabsEl.innerHTML = tabs.map(t => `
    <div class="tab ${t.id===state.activeTab ? "active":""}" onclick="window.__nav('${t.id}')">${t.label}</div>
  `).join("");

  // page
  const t = state.activeTab;
  if (t==="uw") page.innerHTML = renderUW();
  else if (t==="xol") page.innerHTML = renderXOL();
  else if (t==="rol") page.innerHTML = renderROL();
  else if (t==="bc") page.innerHTML = renderBC();
  else if (t==="qs") page.innerHTML = renderQS();
  else if (t==="ss") page.innerHTML = renderSS();
  else if (t==="elc") page.innerHTML = renderELC();
  else if (t==="cr") page.innerHTML = renderCR();
  else if (t==="roe") page.innerHTML = renderROE();
  else page.innerHTML = "<div class='h2'>Not found</div>";
}

// expose setters for inline handlers
window.__set = (id, v) => setInput(id, v);
window.__nav = (tabId) => { state.activeTab = tabId; saveState(); render(); };

// ---- preset wiring
function loadPresets(){
  const keys = Object.keys(presets);
  presetSelect.innerHTML = keys.map(k => `<option value="${k}">${presets[k].name}</option>`).join("");
  presetSelect.value = state.preset in presets ? state.preset : keys[0];
}
function applyPreset(key){
  const p = presets[key];
  if (!p) return;
  Object.entries(p.set).forEach(([k,v]) => { state.inputs[k] = v; });
  state.preset = key;
  saveState();
  render();
  // Render chips on current page by inserting into page header? Keep it simple: add chips under tabs card.
  const chipsWrap = document.createElement("div");
  chipsWrap.className = "chips";
  chipsWrap.innerHTML = p.chips.map(x => `<div class="chip">${x}</div>`).join("");
  // Insert chips after tabs in first card
  const card = document.querySelector(".card");
  const existing = card.querySelector(".chips");
  if (existing) existing.remove();
  card.appendChild(chipsWrap);
}

presetSelect.addEventListener("change", (e)=> applyPreset(e.target.value));
stressSelect.addEventListener("change", (e)=> { state.stress = e.target.value; saveState(); render(); });
ccySelect.addEventListener("change", (e)=> { state.ccy = e.target.value; saveState(); render(); });

// ---- install prompt
let deferredPrompt = null;
window.addEventListener("beforeinstallprompt", (e) => {
  e.preventDefault();
  deferredPrompt = e;
  const btn = $("#installBtn");
  btn.hidden = false;
  btn.onclick = async () => {
    btn.hidden = true;
    deferredPrompt.prompt();
    await deferredPrompt.userChoice;
    deferredPrompt = null;
  };
});

// init
state.stress = state.stress || "normal";
state.ccy = state.ccy || "USD";
loadPresets();
applyPreset(presetSelect.value);
state.activeTab = state.activeTab || "uw";
render();
