'use strict';

// P02 presentation and guided posting. Existing journal, inventory and correction APIs remain authoritative.
const p02OperatorPreviousOperations = pageOperations;
const p02OperatorPreviousModal = palayModal;
const p02OperatorPreviousSave = savePalay;
const p02OperatorPreviousDispatch = consignmentDispatchModal;
const p02OperatorPreviousCollect = consignmentCollectModal;
const p02LegacySettlementModal = consignmentSettlementModal;
const p02OperatorPreviousProjectSettlement = projectSettlementModal;
const p02OperatorPreviousSaveProjectSettlement = saveProjectSettlement;
const p02OperatorPreviousSettlementBalance = refreshSettlementBalance;
const p02OperatorPreviousRegisterLoader = loadProjectOperationsRegister;
const p02OperatorPreviousClose = closeModal, p02OperatorPreviousRequestClose = requestCloseModal;
const p02OperatorPreviousModalFactory = modal;
let p02View = 'overview', p02ViewKey = '', p02Data = null, p02LoadSequence = 0;
let p02RecordSequence = 0, p02Pending = null, p02Posting = false, p02ReceiveRequest = '', p02DispatchStock = null, p02DispatchSequence = 0, p02SaleSequence = 0, p02BalanceSequence = 0;
let p02DialogSequence=0;
modal = function(...args){++p02DialogSequence;p02Pending=null;return p02OperatorPreviousModalFactory(...args);};
closeModal = function() { if(p02Posting)return; ++p02DialogSequence;p02Pending=null; return p02OperatorPreviousClose(); };
requestCloseModal = function() { if(p02Posting)return; return p02OperatorPreviousRequestClose(); };
loadProjectOperationsRegister = async function() {
  await p02OperatorPreviousRegisterLoader();
  if(p02IsProject()&&$('p02RecordHost')&&p02Value('p02RecordType')==='operations'){p02CollapseCorrectionActions($('p02RecordHost'));p02PrepareMenus($('p02RecordHost'));}
};
const p02OperatorPreviousDashboard = pageDashboard, p02OperatorPreviousNav = navItems, p02OperatorPreviousMobileNav = mobileNavItems;
navItems = function() { return p02IsProject() ? p02OperatorPreviousNav().filter(x=>!['dashboard','audit'].includes(x[1])).map(x=>x[1]==='operations'?[x[0],x[1],x[2],'Palay Workspace']:x) : p02OperatorPreviousNav(); };
mobileNavItems = function() { return p02IsProject() ? [['operations','◎','Palay'],['money','₱','Money'],['financials','▤','Finance']] : p02OperatorPreviousMobileNav(); };
pageDashboard = async function() {
  if(!p02IsProject())return p02OperatorPreviousDashboard();
  state.page='operations';p02View='overview';document.querySelectorAll('.nav-btn[data-page]').forEach(x=>x.classList.toggle('active',x.dataset.page==='operations'));syncAdaptiveNav();return pageOperations();
};
const p02Value = id => $(id)?.value || '';
const p02Numeric = id => Number(p02Value(id));
const p02IsProject = () => currentProjectObj()?.code === 'P02';
const p02CanSetup = () => roleIs('SUPERADMIN', 'PROJECT_MANAGER', 'MANAGER', 'ADMIN');
const p02NameKey = v => String(v || '').normalize('NFKC').trim().toUpperCase().replace(/\s+/g, '');
refreshSettlementBalance = async function(kind) {
  if(!p02IsProject()||!['AR','AP'].includes(kind))return p02OperatorPreviousSettlementBalance(kind);
  const form=$('settleDate');if(!form)return;
  const seq=++p02BalanceSequence,date=form.value||today(),pid=currentPid();
  const current=()=>seq===p02BalanceSequence&&form===$('settleDate')&&form.isConnected&&(form.value||today())===date&&currentPid()===pid;
  window.projectSettlementBalance=0;
  if($('settleBal'))$('settleBal').value='Loading…';
  try{
    const [r,cs]=await Promise.all([api(`/api/reports?projectId=${pid}&from=1900-01-01&to=${date}`),kind==='AR'?api(`/api/palay/consignment?projectId=${pid}&to=${date}`):Promise.resolve(null)]);
    if(!current())return;
    const rows=kind==='AR'?r.balance_sheet.assets:r.balance_sheet.liabilities,code=kind==='AR'?'1100':'2000';
    const balance=Math.max(0,Number(rows.find(x=>x.code===code)?.amount||0)-Number(cs?.totals.unremitted_ar||0));
    window.projectSettlementBalance=balance;$('settleBal').value=money(balance);if(!Number($('settleAmt').value))$('settleAmt').value=balance?balance.toFixed(2):'';
  }catch(e){if(!current())return;window.projectSettlementBalance=0;if($('settleBal'))$('settleBal').value='Unable to check balance';toast(p02PlainError(e),'error');}
};
const p02AsOf = () => fy().to < today() ? fy().to : today();
const p02OptionLabel = id => $(id)?.selectedOptions?.[0]?.textContent || p02Value(id);
function p02PlainError(e) {
  const msg = String(e?.message || e || '');
  if (/SQLITE|database|constraint|stack|internal server/i.test(msg)) return 'The transaction could not be posted. Try again or ask your manager to check the system.';
  if (/fetch|network|connect|timeout/i.test(msg)) return 'Unable to reach the server. Check your connection before trying again.';
  return msg || 'Unable to complete this action. Please try again.';
}
function p02Empty(message) { return `<div class="p02-empty">${esc(message)}</div>`; }
function p02MarkModal() { $('modalRoot')?.querySelector('.modal')?.classList.add('p02-modal'); }
function p02PrepareMenus(host=$('content')) {
  for(const menu of host?.querySelectorAll('.p02-overflow')||[]) {
    const buttons=[...menu.children].filter(x=>x.tagName!=='SUMMARY'&&x.tagName!=='DIV');if(!buttons.length)continue;
    const panel=document.createElement('div');buttons.forEach(x=>panel.appendChild(x));menu.appendChild(panel);
  }
}
function p02Field(id, label, value = '', type = 'text', extra = '') {
  return `<div class="field"><label for="${id}">${esc(label)}</label><input class="input" id="${id}" type="${type}" value="${esc(value)}" ${extra}></div>`;
}
function p02ActionButton(kind, title, subtitle, available, number) {
  return `<button class="p02-action" data-p02-action="${kind}" onclick="p02OpenAction('${kind}')" ${available ? '' : 'disabled'}><span class="p02-action-number">${number}</span><strong>${title}</strong><small>${esc(subtitle)}</small></button>`;
}
async function p02LoadData() {
  const pid = currentPid(), to = p02AsOf();
  const [b, inv, cs, cfg, pools, report, ...availability] = await Promise.all([
    api(`/api/palay/batches?projectId=${pid}&to=${to}`), api(`/api/palay/inventory?projectId=${pid}&to=${to}`),
    api(`/api/palay/consignment?projectId=${pid}&to=${to}`), api(`/api/palay/settings?projectId=${pid}`),
    api(`/api/palay/workflow/pools?projectId=${pid}&to=${to}`), api(`/api/reports?projectId=${pid}&from=1900-01-01&to=${to}`),
    ...['RICE', 'BRAN', 'BROKEN'].map(itemId => api(`/api/palay/sale-availability?projectId=${pid}&itemId=${itemId}&to=${to}`))
  ]);
  return { pid, to, batches: b.batches || [], inventory: inv.inventory || [], cs, cfg, pools: pools.pools || [],
    totalAr: Math.max(0, Number(report.balance_sheet.assets.find(x => x.code === '1100')?.amount || 0)),
    ar: Math.max(0, Number(report.balance_sheet.assets.find(x => x.code === '1100')?.amount || 0)-Number(cs.totals.unremitted_ar||0)),
    warehouse: Object.fromEntries(['RICE', 'BRAN', 'BROKEN'].map((code, i) => [code, availability[i]])) };
}
pageOperations = async function () {
  if (!p02IsProject()) return p02OperatorPreviousOperations();
  const key = `${currentPid()}-${state.year}`;
  if (p02ViewKey !== key) { p02ViewKey = key; p02View = 'overview'; }
  const seq = ++p02LoadSequence;
  try {
    const data = await p02LoadData();
    if (seq !== p02LoadSequence || !p02IsProject() || state.page !== 'operations' || key !== `${currentPid()}-${state.year}`) return;
    p02Data = data; window.palayBatches = data.batches; window.palayInventory = data.inventory;
    window.consignmentData = data.cs; window.p02Settings = data.cfg;
    p02RenderWorkspace();
    if (p02View === 'records') await p02LoadRecords();
  } catch (e) {
    if (seq !== p02LoadSequence || !p02IsProject() || state.page !== 'operations') return;
    p02Data=null;
    $('content').innerHTML = `<section class="p02-workspace"><h2>Palay Operations</h2>${p02Empty(p02PlainError(e))}<button class="btn primary" onclick="pageOperations()">Try Again</button></section>`;
  }
};
function p02Totals() {
  const fresh = p02Data.batches.filter(b => b.status === 'ACTIVE' && b.batch_kind !== 'MILLING_RUN').reduce((s, b) => s + Number(batchInv(b, 'FRESH').bag_qty || 0), 0);
  const dry = p02Data.pools.filter(p => p.millable).reduce((s, p) => s + Number(p.available_bags || 0), 0);
  const products = Object.values(p02Data.warehouse).reduce((s, x) => s + Number(x.total_warehouse_qty || 0), 0);
  const settles = p02Data.cs.dispatches.filter(d => Number(d.outstanding_qty) > .005);
  const storeAr = p02Data.cs.dispatches.filter(d => Number(d.unremitted_ar) > .005);
  return { fresh, dry, products, settles, storeAr };
}
function p02RenderWorkspace() {
  if (!p02Data) return;
  const nav = [['overview', 'Overview'], ['processing', 'Processing'], ['sales', 'Sales & Consignment'], ['records', 'Records']];
  $('content').innerHTML = `<section class="p02-workspace" id="p02Workspace"><div class="p02-topbar"><div class="p02-heading"><small>P02 · PALAY MARKETING</small><h2>Palay Operations</h2><p>Stock as of ${esc(dmy(p02Data.to))}</p></div><div class="p02-tools"><button class="btn soft" onclick="p02HowItWorks()">ⓘ How This Works</button>${p02CanSetup() ? '<button class="btn soft" onclick="p02SetupModal()">⚙ Manager Setup</button>' : ''}</div></div><nav class="p02-nav" aria-label="P02 sections">${nav.map(([v, label]) => `<button class="p02-nav-item ${p02View === v ? 'active' : ''}" aria-current="${p02View === v ? 'page' : 'false'}" onclick="p02SelectView('${v}')">${label}</button>`).join('')}</nav><div id="p02ViewContent">${p02View === 'overview' ? p02OverviewMarkup() : p02View === 'processing' ? p02ProcessingMarkup() : p02View === 'sales' ? p02SalesMarkup() : p02RecordsMarkup()}</div></section>`;
  p02PrepareMenus();
}
async function p02SelectView(view) {
  if (!['overview', 'processing', 'sales', 'records'].includes(view)) return;
  p02View = view; ++p02RecordSequence; p02RenderWorkspace();
  if (view === 'records') await p02LoadRecords();
}
function p02OverviewMarkup() {
  const t = p02Totals(), rows = [];
  if (t.fresh > .005) rows.push(p02Attention(`${numFmt(t.fresh)} fresh bags ready for drying`, 'Choose the source batch and labor group.', "p02OpenAction('dry')"));
  if (t.dry > .005) rows.push(p02Attention(`${numFmt(t.dry)} dry bags ready for milling`, 'Choose the variety to process.', "p02OpenAction('mill')"));
  if (t.settles.length) rows.push(p02Attention(`${t.settles.length} store consignment${t.settles.length === 1 ? '' : 's'} need settlement`, 'Record what was sold or returned.', 'p02ChooseConsignment(\'settle\')'));
  const ar = p02Data.totalAr;
  if (ar > .005) rows.push(p02Attention(`${money(ar)} receivable needs collection`, 'Record money received from a store or customer.', 'p02ChooseCollection()'));
  const blocked = p02Data.pools.filter(p => !p.millable && p.available_bags > .005);
  if (blocked.length && p02CanSetup()) rows.push(p02Attention('Dry stock needs a variety check', 'Review unassigned or inactive varieties.', 'p02SetupModal()'));
  return `<div class="p02-actions">${p02ActionButton('receive', 'Receive / Buy Palay', 'Record palay received from a farmer or supplier.', true, '01')}${p02ActionButton('dry', 'Dry Palay', t.fresh > .005 ? `${numFmt(t.fresh)} fresh bags available` : 'No fresh palay available', t.fresh > .005, '02')}${p02ActionButton('mill', 'Mill Palay', t.dry > .005 ? `${numFmt(t.dry)} dry bags available` : 'No dried stock available', t.dry > .005, '03')}${p02ActionButton('sell', 'Sell / Release Products', t.products > .005 ? `${numFmt(t.products / 50)} bags available in warehouse` : 'No finished products available', t.products > .005, '04')}</div><section class="p02-section"><div class="p02-section-head"><h3>Needs Attention</h3></div><div class="p02-attention">${rows.join('') || p02Empty('All caught up. Receive palay to start the next batch.')}</div></section><div class="p02-summary"><span><strong>${p02Data.batches.filter(b => b.status === 'ACTIVE').length}</strong> active batches</span><span><strong>${numFmt(t.fresh)}</strong> fresh bags</span><span><strong>${numFmt(t.dry)}</strong> dry bags ready</span></div>`;
}
function p02Attention(title, detail, action) {
  return `<button class="p02-attention-row" onclick="${action}"><span><strong>${esc(title)}</strong><small>${esc(detail)}</small></span><span aria-hidden="true">→</span></button>`;
}
function p02WarehouseForBatch(batchId) {
  return Object.values(p02Data.warehouse).reduce((sum, x) => sum + Number((x.batches || []).find(b => Number(b.id || b.batch_id) === Number(batchId))?.warehouse_qty || 0), 0);
}
function p02BatchNext(b) {
  if (b.status !== 'ACTIVE') return { label: 'Inactive', action: '' };
  if (Number(batchInv(b, 'FRESH').bag_qty) > .005 && b.batch_kind !== 'MILLING_RUN') return { label: 'Ready for drying', action: 'dry' };
  if (Number(batchInv(b, 'DRY').bag_qty || batchInv(b, 'DRY').qty / 50) > .005) {
    return p02Data.pools.some(p => p.millable && p02NameKey(p.variety) === p02NameKey(b.variety)) ? { label: 'Ready for milling', action: 'mill' } : { label: 'Variety needs manager review', action: '' };
  }
  if (p02WarehouseForBatch(b.id) > .005) return { label: 'Ready for sale / release', action: 'sell' };
  const owned = ['RICE', 'BRAN', 'BROKEN'].reduce((s, c) => s + Number(batchInv(b, c).qty || 0), 0);
  return { label: owned > .005 ? 'Stock is with stores' : 'No stock to process', action: '' };
}
function p02ProcessingMarkup() {
  const batches = p02Data.batches.filter(b => b.status === 'ACTIVE');
  return `<section class="p02-section"><div class="p02-section-head"><h3>Active Batches</h3><button class="btn soft" onclick="p02OpenProcessingHistory()">Processing History</button></div><div class="p02-batch-grid">${batches.map(b => {
    const next = p02BatchNext(b), fresh = batchInv(b, 'FRESH'), dry = batchInv(b, 'DRY');
    return `<article class="p02-batch-card"><div class="p02-card-head"><div><strong>${esc(b.batch_code)}</strong><p>${esc(b.variety || 'Variety not assigned')}</p><small>${esc(b.location)}${b.source_name ? ' · ' + esc(b.source_name) : ''}</small></div><span class="status ${next.action ? 'posted' : 'closed'}">${esc(next.label)}</span></div><div class="p02-stock-row"><span>Fresh <strong>${numFmt(fresh.bag_qty || 0)} bags</strong></span><span>Dry <strong>${numFmt(dry.bag_qty || dry.qty / 50 || 0)} bags</strong></span>${['RICE', 'BRAN', 'BROKEN'].filter(c => batchInv(b, c).qty > .005).map(c => `<span>${esc(batchInv(b, c).name)} <strong>${numFmt(batchInv(b, c).qty / 50)} bags</strong></span>`).join('')}</div><div class="p02-card-actions">${next.action ? `<button class="btn primary" onclick="p02OpenAction('${next.action}',${b.id})">Continue →</button>` : `<span class="muted">${esc(next.label)}</span>`}<details class="p02-overflow"><summary aria-label="More options for ${esc(b.batch_code)}">⋯</summary><button onclick="p02BatchDetails(${b.id})">View Details / History</button>${p02CanSetup() && next.action === 'dry' && Number(dry.qty) > .005 ? `<button onclick="p02OpenAction('mill',${b.id})">Mill Existing Dry Stock</button>` : ''}</details></div></article>`;
  }).join('') || p02Empty('No active batches. Receive palay from the Overview to begin.')}</div></section>`;
}
function p02SalesMarkup() {
  const rows = p02Data.cs.dispatches || [], ar = p02Data.ar;
  return `<section class="p02-section"><div class="p02-section-head"><h3>Sales & Consignment</h3><button class="btn primary" onclick="p02OpenAction('sell')" ${p02Totals().products > .005 ? '' : 'disabled'}>Sell / Release Products</button></div><div class="p02-summary"><span>Warehouse <strong>${numFmt(p02Totals().products / 50)} bags</strong></span><span>With stores <strong>${numFmt(p02Data.cs.totals.outstanding_qty / 50)} bags</strong></span><span>Store balance <strong>${money(p02Data.cs.totals.unremitted_ar || 0)}</strong></span></div><h4>Store Consignments</h4><div class="p02-list">${rows.map(d => `<article class="p02-store-card"><div class="p02-card-head"><div><strong>${esc(d.store_name)}</strong><p>${esc(d.item_name)} · ${esc(d.dispatch_no)}</p><small>Outstanding ${numFmt(d.outstanding_qty / 50)} bags${d.unremitted_ar > .005 ? ' · Balance ' + money(d.unremitted_ar) : ''}</small></div><span class="status ${d.outstanding_qty <= .005 && d.unremitted_ar <= .005 ? 'reconciled' : 'pending'}">${d.outstanding_qty <= .005 && d.unremitted_ar <= .005 ? 'Completed' : d.outstanding_qty > .005 ? 'Needs settlement' : 'Needs collection'}</span></div><div class="p02-card-actions">${d.outstanding_qty > .005 ? `<button class="btn primary" onclick="consignmentSettlementModal(${d.id})">Settle Store</button>` : d.unremitted_ar > .005 ? `<button class="btn primary" onclick="consignmentCollectModal(${d.id})">Collect Balance</button>` : '<span class="muted">Completed</span>'}<details class="p02-overflow"><summary aria-label="More options for ${esc(d.dispatch_no)}">⋯</summary><button onclick="p02ConsignmentDetails(${d.id})">View Details / History</button>${d.outstanding_qty > .005 && d.unremitted_ar > .005 ? `<button onclick="consignmentCollectModal(${d.id})">Collect Existing Balance</button>` : ''}</details></div></article>`).join('') || p02Empty('No store consignments yet.')}</div><h4>Customer Receivables</h4>${ar > .005 ? p02Attention(`${money(ar)} outstanding customer balance`, 'Collect payment for previous credit sales.', "projectSettlementModal('AR')") : p02Empty('No outstanding customer receivables.')}<button class="btn soft" onclick="p02OpenSalesHistory()">Sales & Collection History</button></section>`;
}
function p02RecordsMarkup() {
  return `<section class="p02-section"><div class="p02-section-head"><h3>Records</h3><details class="p02-overflow"><summary>Download / Print ▾</summary><button onclick="p02ExportWorkflow('excel')">Drying & Milling Excel</button><button onclick="p02ExportWorkflow('pdf','drying')">Drying PDF</button><button onclick="p02ExportWorkflow('pdf','milling')">Milling PDF</button><button onclick="printProjectOperations()">Print Filtered Operations</button><button onclick="downloadProjectOperationsExcel()">Operations Excel</button><button onclick="printFieldRecordingTemplates()">Print Blank Field Forms</button><button onclick="downloadFieldRecordingTemplate()">Field Template Excel</button></details></div><div class="p02-record-tools"><div class="field"><label for="p02RecordType">Show</label><select class="select" id="p02RecordType" onchange="p02LoadRecords()"><option value="drying">Drying Register</option><option value="milling">Milling Register</option><option value="operations">Project Operations</option><option value="audit">Audit Trail</option><option value="summary">Processing Summary</option></select></div>${p02Field('p02RegFrom','From Date',fy().from,'date')}${p02Field('p02RegTo','To Date',fy().to,'date')}<div class="field"><label for="p02RegVariety">Variety</label><select class="select" id="p02RegVariety"><option value="">All varieties</option>${p02Data.pools.map(p => `<option>${esc(p.variety)}</option>`).join('')}</select></div><div class="field"><label for="p02RegLabor">Labor Group</label><select class="select" id="p02RegLabor"><option value="">All labor groups</option></select></div><button class="btn soft" onclick="p02LoadRecords()">Apply Filters</button></div><div class="p02-record-host" id="p02RecordHost"></div><button class="btn soft" onclick="navigate('financials')">Accounting Reports</button></section>`;
}
async function p02LoadRecords() {
  const host = $('p02RecordHost'); if (!host) return;
  const seq = ++p02RecordSequence, type = p02Value('p02RecordType'), from = p02Value('p02RegFrom'), to = p02Value('p02RegTo'), pid = currentPid();
  host.innerHTML = p02Empty('Loading records…');
  try {
    if (!from || !to || from > to) throw new Error('Choose a valid From Date and To Date.');
    const masters = await p02Masters();
    if (seq !== p02RecordSequence || !host.isConnected) return;
    const variety = p02Value('p02RegVariety'), labor = p02Value('p02RegLabor');
    $('p02RegLabor').innerHTML = '<option value="">All labor groups</option>' + masters.labor_groups.map(g => `<option value="${g.id}">${esc(g.name)}</option>`).join(''); $('p02RegLabor').value = labor;
    $('p02RegVariety').innerHTML = '<option value="">All varieties</option>' + [...new Set([...masters.varieties.map(v => v.name), ...p02Data.pools.map(p => p.variety)])].map(v => `<option>${esc(v)}</option>`).join(''); $('p02RegVariety').value = variety;
    $('p02RegVariety').closest('.field').hidden = ['audit','operations'].includes(type); $('p02RegLabor').closest('.field').hidden = !['drying','summary'].includes(type);
    const ops = opsServerState(); ops.from = from; ops.to = to;
    if (type === 'operations') {
      host.innerHTML = p02OperationsMarkup(ops);
      // Existing full-dataset pagination, correction actions and export handlers.
      await loadProjectOperationsRegister();
      if(seq!==p02RecordSequence||!host.isConnected)return;
      p02CollapseCorrectionActions(host); p02PrepareMenus(host); return;
    }
    if (type === 'audit') {
      const r = await api(`/api/audit?projectId=${pid}`); if (seq !== p02RecordSequence || !host.isConnected) return;
      const rows = (r.audit || []).filter(x => { const d = String(x.created_at || x.timestamp || '').slice(0,10); return !d || d >= from && d <= to; });
      host.innerHTML = rows.length ? auditHtml(rows) : p02Empty('No audit records in this date range.'); return;
    }
    const r = await api('/api/palay/workflow/register?' + p02RegisterQuery()); if (seq !== p02RecordSequence || !host.isConnected) return;
    if (type === 'drying') host.innerHTML = p02RegisterTable(['Date','Batch','Variety','Labor Group','Fresh Bags','Dry Bags','Loss','Status','Details'],r.drying.map(x => [esc(dmy(x.date)),esc(x.source_batch),esc(x.variety),esc(x.labor_group),numFmt(x.fresh_bags),numFmt(x.dry_bags),x.loss_bags == null ? 'Legacy' : numFmt(x.loss_bags),esc(x.status),`<button class="btn soft" onclick="showTransaction(${x.id})">View Details</button>`]));
    else if (type === 'milling') host.innerHTML = p02RegisterTable(['Date','Variety','Run','Input','Rice','Bran','Broken','Loss','Status','Details'],r.milling.map(x => [esc(dmy(x.date)),esc(x.variety),esc(x.run_no),numFmt(x.input_bags),numFmt(x.rice_bags),numFmt(x.bran_bags),numFmt(x.broken_bags),numFmt(x.loss_bags),esc(x.status),`<details class="p02-overflow"><summary>Details ▾</summary><button onclick="showTransaction(${x.id})">Transaction</button>${x.run_id ? `<button onclick="p02ViewSources(${x.run_id})">Source Allocation</button>` : ''}</details>`]));
    else host.innerHTML = `<h4>Drying by Labor Group</h4>${p02RegisterTable(['Labor Group','Fresh Bags','Dry Bags','Loss'],r.summary.labor_groups.map(x => [esc(x.labor_group),numFmt(x.fresh_bags),numFmt(x.dry_bags),numFmt(x.loss_bags)]))}<details class="p02-extra"><summary>Milling by Variety</summary>${p02RegisterTable(['Variety','Input','Rice','Bran','Broken','Loss','Recovery %'],r.summary.varieties.map(x => [esc(x.variety),numFmt(x.input_bags),numFmt(x.rice_bags),numFmt(x.bran_bags),numFmt(x.broken_bags),numFmt(x.loss_bags),numFmt(x.recovery_pct)]))}</details>`;
    p02PrepareMenus(host);
  } catch(e) { if (seq === p02RecordSequence && host.isConnected) host.innerHTML = p02Empty(p02PlainError(e)); }
}
function p02OperationsMarkup(s) {
  return `<div class="p02-record-tools"><div class="field"><label for="opsServerSearch">Search all operations</label><input class="input" id="opsServerSearch" type="search" value="${esc(s.q||'')}" placeholder="Reference, batch, customer…" oninput="opsServerSearch(this.value)"></div><div class="field"><label for="p02OpsLimit">Rows per page</label><select class="select" id="p02OpsLimit" onchange="opsServerLimit(this.value)">${[10,20,50,100].map(n=>`<option ${s.limit===n?'selected':''}>${n}</option>`).join('')}</select></div><span class="ops-filter-summary" id="opsServerSummary"></span></div><div class="table-wrap"><table class="table"><thead><tr><th>Date</th><th>Reference</th><th>Operation</th><th>Description</th><th>Amount</th><th>Status</th><th>Details</th></tr></thead><tbody id="opsServerRows"></tbody></table></div><div class="ops-pager"><span id="opsServerPageLabel"></span><div class="ops-page-buttons"><button class="btn soft" id="opsServerPrev" onclick="opsServerPage(-1)">‹ Previous</button><button class="btn soft" id="opsServerNext" onclick="opsServerPage(1)">Next ›</button></div></div>`;
}
function p02CollapseCorrectionActions(host) {
  for (const cell of host.querySelectorAll('td:last-child')) {
    const actions = cell.querySelector('.quick-actions'); if (!actions || actions.children.length < 2 || actions.querySelector(':scope > details.p02-overflow')) continue;
    const menu = document.createElement('details'); menu.className = 'p02-overflow'; menu.innerHTML = '<summary>⋯</summary>';
    while (actions.children.length > 1) menu.appendChild(actions.children[1]); actions.appendChild(menu);
  }
}
async function p02OpenProcessingHistory() { await p02SelectView('records'); }
async function p02OpenSalesHistory() { await p02SelectView('records'); $('p02RecordType').value = 'operations'; await p02LoadRecords(); }
function p02HowItWorks() {
  modal('How This Works','<ol><li><strong>Receive / Buy Palay:</strong> enter the farmer, weighing and payment.</li><li><strong>Dry Palay:</strong> choose fresh bags and the labor group.</li><li><strong>Mill Palay:</strong> choose a variety and record the product bags.</li><li><strong>Sell / Release:</strong> sell to a customer or send products to a store.</li></ol><p>Review the details before posting. Records and corrections remain available in Records. For processing costs, use the existing Money Center.</p>','<button class="btn primary" onclick="closeModal()">Got It</button>'); p02MarkModal();
}
async function p02OpenAction(action, batchId = null) {
  if (!p02IsProject() || !p02Data) return;
  const t = p02Totals();
  if (action === 'receive') return p02ReceiveModal(batchId);
  if (action === 'dry' && t.fresh <= .005) return toast('No fresh palay available for drying.','error');
  if (action === 'mill' && t.dry <= .005) return toast('No dried palay available for milling.','error');
  if (action === 'sell') {
    if (t.products <= .005) return toast('No finished products available for sale.','error');
    modal('Sell / Release Products',`<div class="p02-sales-choices"><button class="p02-action" onclick="p02OpenWalkIn(${Number(batchId) || 'null'})"><strong>Walk-in Customer</strong><small>Sell products and record the payment.</small></button><button class="p02-action" onclick="p02OpenStoreDispatch(${Number(batchId) || 'null'})" ${p02Data.cs.consignees.length ? '' : 'disabled'}><strong>Send to Store / Consignment</strong><small>${p02Data.cs.consignees.length ? 'Leave products with a store for sale.' : 'Ask your manager to add a store first.'}</small></button></div>`,'<button class="btn soft" onclick="closeModal()">Back</button>'); p02MarkModal(); return;
  }
  if (action === 'dry' || action === 'mill') { await palayModal(action, batchId); p02MarkModal(); }
}
palayModal = async function(type,batchId=null,dateOverride='') {
  if (!p02IsProject()) return p02OperatorPreviousModal(type,batchId,dateOverride);
  if (type === 'purchase' && !p02CorrectionMetadata && !correctionIdFor('PALAY_PURCHASE')) return p02ReceiveModal(batchId);
  const seq=++p02DialogSequence,pid=currentPid();
  await p02OperatorPreviousModal(type,batchId,dateOverride);if(seq+1!==p02DialogSequence||currentPid()!==pid)return; if(type==='sale')p02SimplifyExistingModal('sale');else p02MarkModal();
};
function p02NewRequestId() { return globalThis.crypto?.randomUUID?.() || `${Date.now()}-${Math.random().toString(36).slice(2)}`; }
async function p02ReceiveModal(batchId=null) {
  const seq=++p02DialogSequence,pid=currentPid();
  try {
    const masters = await p02Masters(), b = p02Data.batches.find(x => Number(x.id) === Number(batchId));
    if(seq!==p02DialogSequence||pid!==currentPid()||!p02IsProject())return;
    p02ReceiveRequest = p02NewRequestId(); window.p02WeighRows = [{bags:10,kg:0}];
    modal('Receive / Buy Palay',`<div class="form-grid">${p02Field('prDate','Date',today(),'date')}${p02Field('prSupplier','Farmer / Supplier',b?.source_name || '', 'text','maxlength="200"')}${p02Field('prLocation','Location / Source',b?.location || '', 'text','maxlength="200"')}<div class="field"><label for="prVariety">Variety</label><select class="select" id="prVariety"><option value="">Select variety</option>${masters.varieties.filter(v => v.active).map(v => `<option ${p02NameKey(v.name) === p02NameKey(b?.variety) ? 'selected' : ''}>${esc(v.name)}</option>`).join('')}</select></div></div><h4>Weighings</h4><div class="p02-weighings" id="ppWeighRows"></div><button class="btn soft" type="button" onclick="p02AddWeigh(10)">+ Add Weighing</button><div class="form-grid">${p02Field('ppDeduction','Deductions — KG',0,'number','min="0" step="0.001"')}${p02Field('ppPrice','Price per KG','','number','min="0.01" step="0.01"')}<div class="field"><label for="prPay">Payment</label><select class="select" id="prPay"><option value="CASH">Cash — paid now</option><option value="CREDIT">Credit — pay supplier later</option></select></div></div><div class="p02-calculation" id="p02ReceiveCalculation" aria-live="polite"></div><details class="p02-extra"><summary>Batch options</summary><div class="field"><label for="prBatchMode">Batch</label><select class="select" id="prBatchMode"><option value="AUTO">Automatic — match farmer, location, variety and date</option><option value="NEW">Create a new batch</option>${p02Data.batches.filter(x => x.status === 'ACTIVE' && x.batch_kind !== 'MILLING_RUN').map(x => `<option value="${x.id}" ${Number(batchId) === x.id ? 'selected' : ''}>${esc(x.batch_code+' · '+x.source_name+' · '+x.location+' · '+x.variety)}</option>`).join('')}</select></div></details><p id="p02ReceiveBatchNote" class="p02-input-note"></p><div hidden>${['ppBags','ppKg','ppNetKg','ppTotal'].map(id => p02Field(id,id,'','text','readonly')).join('')}</div>${masters.varieties.some(v=>v.active) ? '' : '<p class="notice info">Ask your manager to add a variety before receiving palay.</p>'}`,`<button class="btn soft" onclick="closeModal()">Cancel</button><button class="btn primary" id="ppPost" onclick="p02ReviewCurrent('receive')">Review</button>`);
    p02MarkModal(); p02RenderWeighings();
    for (const id of ['prDate','prSupplier','prLocation','prVariety','prBatchMode','prPay','ppDeduction','ppPrice']) $(id).addEventListener('input',p02ReceiveTotals);
    p02ReceiveTotals();
  } catch(e) { toast(p02PlainError(e),'error'); }
}
const p02OriginalRenderWeighings = p02RenderWeighings, p02OriginalUpdatePurchaseTotals = p02UpdatePurchaseTotals;
p02RenderWeighings = function() {
  if (!$('prDate')) return p02OriginalRenderWeighings();
  $('ppWeighRows').innerHTML = (window.p02WeighRows || []).map((r,i) => `<div class="p02-weigh-row"><div class="field"><label for="prBags${i}">Bags</label><input class="input" id="prBags${i}" type="number" min="0.01" step="0.01" value="${esc(r.bags)}" oninput="p02ReceiveWeigh(${i},'bags',this.value)"></div><div class="field"><label for="prWeight${i}">Gross Weight — KG</label><input class="input" id="prWeight${i}" type="number" min="0.001" step="0.001" value="${esc(r.kg || '')}" oninput="p02ReceiveWeigh(${i},'kg',this.value)"></div><button class="btn soft" onclick="p02RemoveWeigh(${i})" aria-label="Remove weighing ${i+1}">×</button></div>`).join('') || p02Empty('Add a weighing to record the bags received.'); p02ReceiveTotals();
};
p02UpdatePurchaseTotals = function() { if ($('prDate')) return p02ReceiveTotals(); return p02OriginalUpdatePurchaseTotals(); };
function p02ReceiveWeigh(i,key,value) { window.p02WeighRows[i][key] = Number(value); p02ReceiveTotals(); }
function p02ReceiveBatch() {
  const mode = p02Value('prBatchMode');
  if (mode === 'NEW') return null;
  if (mode !== 'AUTO') return p02Data.batches.find(b => b.id === Number(mode));
  return p02Data.batches.find(b => b.status === 'ACTIVE' && b.batch_kind !== 'MILLING_RUN' && b.harvest_date === p02Value('prDate') && p02NameKey(b.source_name) === p02NameKey(p02Value('prSupplier')) && p02NameKey(b.location) === p02NameKey(p02Value('prLocation')) && p02NameKey(b.variety) === p02NameKey(p02Value('prVariety')));
}
function p02ReceiveTotals() {
  if (!$('prDate')) return;
  const rows = window.p02WeighRows || [], bags = p02Round(rows.reduce((s,r)=>s+Number(r.bags||0),0)), gross = p02Round(rows.reduce((s,r)=>s+p02Round(Number(r.kg||0)),0)), deduction = p02Round(p02Numeric('ppDeduction')), price = p02Round(p02Numeric('ppPrice')), net = p02Round(gross-deduction), b = p02ReceiveBatch();
  const valid = rows.length && rows.every(r=>Number.isFinite(r.bags)&&r.bags>0&&Number.isFinite(r.kg)&&r.kg>0) && Number.isFinite(deduction)&&deduction>=0&&net>0&&Number.isFinite(price)&&price>0 && p02Value('prDate')&&p02Value('prSupplier').trim()&&p02Value('prLocation').trim()&&p02Value('prVariety');
  $('ppBags').value = bags; $('ppKg').value = gross; $('ppNetKg').value = net; $('ppTotal').value = money(net*price);
  $('p02ReceiveCalculation').innerHTML = `<div><small>Bags received</small><strong>${numFmt(bags)}</strong></div><div><small>Gross weight</small><strong>${numFmt(gross)} KG</strong></div><div><small>Net weight</small><strong>${numFmt(Math.max(0,net))} KG</strong></div><div><small>Purchase amount</small><strong>${money(Math.max(0,net)*price)}</strong></div>`;
  $('p02ReceiveBatchNote').textContent = b ? `This receipt will use ${b.batch_code}.` : 'A new batch will be created when you post.';
  $('ppPost').disabled = !valid;
}
async function p02OpenWalkIn(batchId=null) {
  await palayModal('sale',batchId);
}
async function p02OpenStoreDispatch(batchId=null) {
  return consignmentDispatchModal(batchId);
}
function p02SimplifyExistingModal(kind) {
  p02MarkModal();
  const root = $('modalRoot'), body = root.querySelector('.modal-body'); if (!body) return;
  const advanced = document.createElement('details'); advanced.className = 'p02-extra'; advanced.innerHTML = '<summary>More details</summary>';
  body.querySelectorAll('.notice,.guide').forEach(n=>n.id?advanced.appendChild(n):n.remove());
  const ids = kind === 'sale' ? ['psBatch','psKg','psPerKg','psCF'] : kind === 'dispatch' ? ['cdKg','cdPerKg','cdValue','cdCommission','cdNet','cdNotes'] : kind === 'collect' ? ['ccCF'] : ['settleCF','settleDesc'];
  for (const id of ids) { const field = $(id)?.closest('.field'); if(field) advanced.appendChild(field); }
  if(advanced.children.length>1)body.appendChild(advanced);
  const btn = root.querySelector('.modal-foot .btn.primary'); if(btn)btn.textContent='Review';
  if(kind==='sale'&&btn){btn.id='p02SaleReview';for(const id of ['psDate','psBatch','psCustomer','psItem','psQty','psUnit','psPrice'])$(id)?.addEventListener('input',p02ValidateSale);p02ValidateSale();}
}
refreshP02SaleAvailability = async function() {
  const form=$('psDate');if(!form||!$('psItem'))return;const seq=++p02SaleSequence,date=form.value,batch=p02Value('psBatch'),pid=currentPid();if(p02IsProject()){const button=$('modalRoot').querySelector('.modal-foot .btn.primary');if(button){button.id='p02SaleReview';button.textContent='Review';}}window.p02SaleAvailability={};p02ValidateSale();if(!date)return;
  try{
    const codes=['RICE','BRAN','BROKEN'],responses=await Promise.all(codes.map(code=>api(`/api/palay/sale-availability?projectId=${pid}&itemId=${code}&to=${date}${batch?`&batchId=${batch}`:''}`)));
    if(seq!==p02SaleSequence||form!==$('psDate')||!form.isConnected||form.value!==date||p02Value('psBatch')!==batch||currentPid()!==pid)return;
    window.p02SaleAvailability=Object.fromEntries(codes.map((code,i)=>[code,responses[i]]));
    codes.forEach((code,i)=>{const option=[...$('psItem').options].find(o=>o.value===code);if(option)option.textContent=`${responses[i].item.name} — ${numFmt(responses[i].total_warehouse_qty)} KG available`;});
    updateP02SaleAvailabilityDisplay();p02ValidateSale();
  }catch(e){if(seq!==p02SaleSequence||form!==$('psDate')||!form.isConnected)return;if($('psAvail'))$('psAvail').value=p02PlainError(e);if($('psStockNote'))$('psStockNote').textContent=p02PlainError(e);p02ValidateSale();}
};
function p02ValidateSale(){
  const button=$('p02SaleReview');if(!button)return;const av=window.p02SaleAvailability?.[p02Value('psItem')],qty=p02Numeric('psQty'),price=p02Numeric('psPrice'),factor=p02UnitFactor(p02Value('psUnit'));
  button.disabled=!(av&&av.as_of===p02Value('psDate')&&Number(av.batch_id||0)===p02Numeric('psBatch')&&p02Value('psCustomer').trim()&&Number.isFinite(qty)&&qty>0&&Number.isFinite(price)&&price>0&&qty*factor<=av.total_warehouse_qty+.0001);
}
consignmentDispatchModal = async function(batchId=null) {
  if(!p02IsProject())return p02OperatorPreviousDispatch();
  const stores=window.consignmentData?.consignees||[];if(!stores.length)return toast('Ask your manager to add a store before sending products.','error');
  p02DispatchStock=null;
  const codes=['RICE','BRAN','BROKEN'];
  const defaultItem=(batchId?codes.find(code=>(p02Data?.warehouse[code]?.batches||[]).some(b=>Number(b.batch_id||b.id)===Number(batchId)&&Number(b.warehouse_qty)>.005)):null)||codes.find(code=>Number(p02Data?.warehouse[code]?.total_warehouse_qty)>0)||'RICE';
  modal('Send to Store / Consignment',`<div class="form-grid">${p02Field('cdDate','Date',today(),'date')}<div class="field"><label for="cdStore">Store / Consignee</label><select class="select" id="cdStore">${stores.map(s=>`<option value="${s.id}">${esc(s.store_name)}</option>`).join('')}</select></div><div class="field"><label for="cdItem">Product</label><select class="select" id="cdItem">${['RICE','BRAN','BROKEN'].map(code=>`<option value="${code}" ${code===defaultItem?'selected':''}>${esc((window.palayInventory||[]).find(x=>x.code===code)?.name||code)}</option>`).join('')}</select></div>${p02Field('cdQty','Quantity','','number','min="0.001" step="0.001"')}<div class="field"><label for="cdUnit">Unit</label><select class="select" id="cdUnit">${p02UnitOptions('BAG')}</select></div>${p02Field('cdPrice','Selling Price per Selected Unit','','number','min="0.01" step="0.01"')}</div><p class="p02-input-note" id="p02DispatchAvailability" role="status">Checking warehouse stock…</p><div class="p02-calculation" id="p02DispatchCalculation" aria-live="polite"></div><details class="p02-extra"><summary>Source / Notes</summary><div class="field"><label for="cdBatch">Product Source</label><select class="select" id="cdBatch"></select></div>${p02Field('cdNotes','Notes','','text','maxlength="300"')}</details><div hidden>${['cdAvail','cdKg','cdPerKg','cdValue','cdCommission','cdNet'].map(id=>p02Field(id,id,'','text','readonly')).join('')}</div>`,`<button class="btn soft" onclick="closeModal()">Cancel</button><button class="btn primary" id="p02DispatchReview" onclick="saveConsignmentDispatch()" disabled>Review</button>`);p02MarkModal();
  $('cdDate').onchange=p02LoadDispatchStock;$('cdItem').onchange=p02LoadDispatchStock;$('cdBatch').onchange=p02CalculateDispatch;
  for(const id of ['cdQty','cdPrice','cdUnit'])$(id).addEventListener('input',p02CalculateDispatch);
  await p02LoadDispatchStock(batchId);
};
async function p02LoadDispatchStock(preferredBatchId=null){
  const form=$('cdDate');if(!form)return;const seq=++p02DispatchSequence,date=form.value,item=p02Value('cdItem'),previous=typeof preferredBatchId==='number'||typeof preferredBatchId==='string'?String(preferredBatchId):p02Value('cdBatch'),pid=currentPid();p02DispatchStock=null;p02CalculateDispatch();if(!date)return;
  try{
    const r=await api(`/api/palay/sale-availability?projectId=${pid}&itemId=${item}&to=${date}`);
    if(seq!==p02DispatchSequence||form!==$('cdDate')||!form.isConnected||form.value!==date||p02Value('cdItem')!==item||currentPid()!==pid)return;
    p02DispatchStock=r;const rows=r.batches.filter(b=>b.warehouse_qty>.005);$('cdBatch').innerHTML=rows.map(b=>`<option value="${b.batch_id}">${esc(b.location+' · '+b.batch_code)} · ${numFmt(b.warehouse_qty/50)} bags</option>`).join('');if(rows.some(b=>b.batch_id===Number(previous)))$('cdBatch').value=previous;
    p02CalculateDispatch();
  }catch(e){if(seq===p02DispatchSequence&&form===$('cdDate')&&form.isConnected){$('p02DispatchAvailability').textContent=p02PlainError(e);p02CalculateDispatch();}}
}
function p02CalculateDispatch(){
  if(!$('cdQty'))return;const qty=p02Numeric('cdQty'),price=p02Numeric('cdPrice'),factor=p02UnitFactor(p02Value('cdUnit')),row=p02DispatchStock?.batches.find(b=>b.batch_id===p02Numeric('cdBatch')),available=Number(row?.warehouse_qty||0),gross=p02Round(qty*price),share=p02Round(gross*Number(window.p02Settings.consignee_commission_pct||0)/100),net=p02Round(gross-share);
  $('cdAvail').value=available;$('cdKg').value=qty*factor;$('cdPerKg').value=price/factor;$('cdValue').value=money(gross);$('cdCommission').value=money(share);$('cdNet').value=money(net);
  $('p02DispatchAvailability').textContent=p02DispatchStock?available>0?`${numFmt(available/factor)} ${p02UnitLabel(p02Value('cdUnit'))} available from the selected source.`:'No warehouse stock available for this product on this date.':'Checking warehouse stock…';
  $('p02DispatchCalculation').innerHTML=`<div><small>Retail value</small><strong>${money(gross)}</strong></div><div><small>Expected coop share</small><strong>${money(net)}</strong></div>`;
  $('p02DispatchReview').disabled=!(row&&p02DispatchStock.as_of===p02Value('cdDate')&&Number.isFinite(qty)&&qty>0&&qty*factor<=available+.0001&&Number.isFinite(price)&&price>0&&p02Value('cdStore'));
}
consignmentCollectModal = function(id) { p02OperatorPreviousCollect(id); if(p02IsProject())p02SimplifyExistingModal('collect'); };
projectSettlementModal = async function(kind) { if(!p02IsProject())return p02OperatorPreviousProjectSettlement(kind);const pid=currentPid(),opening=p02OperatorPreviousProjectSettlement(kind),form=$('settleDate');await opening;if(form&&form===$('settleDate')&&form.isConnected&&currentPid()===pid&&p02IsProject())p02SimplifyExistingModal('project-collect'); };
consignmentSettlementModal = function(id) {
  if (!p02IsProject()) return p02LegacySettlementModal(id);
  const d = (window.consignmentData?.dispatches || []).find(x=>Number(x.id)===Number(id)); if(!d)return toast('Store consignment not found.','error');
  modal('Settle Store',`<p><strong>${esc(d.store_name)}</strong> · ${esc(d.item_name)}</p><p class="p02-input-note">${numFmt(d.outstanding_qty/50)} bags (${numFmt(d.outstanding_qty)} KG) outstanding.</p><div class="form-grid">${p02Field('csDate','Date',today(),'date')}<div class="field"><label for="csUnit">Unit</label><select class="select" id="csUnit">${p02UnitOptions(d.qty_unit || 'KG')}</select></div>${p02Field('csSold','Quantity Sold',0,'number','min="0" step="0.001"')}${p02Field('csReturn','Unsold Quantity Returned',0,'number','min="0" step="0.001"')}${p02Field('csPaid','Amount Received',0,'number','min="0" step="0.01"')}</div><div class="p02-calculation" id="p02SettlementCalculation" aria-live="polite"></div><p class="p02-input-note" id="p02SettlementError" role="status"></p><div hidden>${['csKg','csGross','csCommission','csNet','csAR'].map(x=>p02Field(x,x,'','text','readonly')).join('')}</div>`,`<button class="btn soft" onclick="closeModal()">Cancel</button><button class="btn primary" id="p02SettleReview" onclick="saveConsignmentSettlement(${id})">Review</button>`); p02MarkModal();
  let paidManual=false;
  const calc=()=>{
    if(!$('csSold'))return;
    const f=p02UnitFactor(p02Value('csUnit'),d.sack_kg||50), sold=p02Numeric('csSold'), returned=p02Numeric('csReturn'), gross=sold*f*Number(d.unit_price), share=gross*Number(d.commission_rate||0)/100, net=p02Round(gross-share);
    if(!paidManual)$('csPaid').value=Math.max(0,net).toFixed(2);
    const paid=p02Numeric('csPaid'), valid=[sold,returned,paid].every(Number.isFinite)&&sold>=0&&returned>=0&&sold+returned>0&&(sold+returned)*f<=Number(d.outstanding_qty)+.0001&&paid>=0&&paid<=net+.005;
    $('csKg').value=`Sold ${numFmt(sold*f)} KG · Returned ${numFmt(returned*f)} KG`; $('csGross').value=money(gross);$('csCommission').value=money(share);$('csNet').value=money(net);$('csAR').value=money(Math.max(0,net-paid));
    $('p02SettlementCalculation').innerHTML=`<div><small>Amount due to coop</small><strong>${money(net)}</strong></div><div><small>Remaining balance</small><strong>${money(Math.max(0,net-paid))}</strong></div>`;
    $('p02SettlementError').textContent=(sold+returned)*f>Number(d.outstanding_qty)+.0001?'Sold and returned quantities exceed the stock at this store.':paid>net+.005?'Payment exceeds the amount due for this settlement.':'';
    $('p02SettleReview').disabled=!valid;
  };
  for(const id of ['csSold','csReturn','csUnit'])$(id).addEventListener('input',calc);$('csPaid').oninput=()=>{paidManual=true;calc()};calc();
};
// Retain the original handler for other project contexts.
function p02BuildTransaction(kind,id) {
  const body={projectId:currentPid()}, rows=[], add=(label,value)=>rows.push([label,String(value)]); let route, next='';
  const dateId={receive:'prDate',purchase:'ppDate',dry:'pdDate',mill:'pmDate',sale:'psDate',dispatch:'cdDate',settle:'csDate',collect:'ccDate',ar:'settleDate',ap:'settleDate'}[kind]; body.date=p02Value(dateId);
  if(!body.date)throw new Error('Choose a transaction date.');
  add('Transaction',{receive:'Receive / Buy Palay',purchase:'Purchase Correction',dry:'Dry Palay',mill:'Mill Palay',sale:'Walk-in Sale',dispatch:'Send to Store',settle:'Settle Store',collect:'Collect Store Balance',ar:'Collect Customer Balance',ap:'Pay Supplier'}[kind]);add('Date',dmy(body.date));
  if(kind==='receive'||kind==='purchase') {
    const weighings=(window.p02WeighRows||[]).map(r=>({bags:Number(r.bags),kg:Number(r.kg)})),supplier=p02Value(kind==='receive'?'prSupplier':'ppSupplier').trim(),gross=p02Round(weighings.reduce((s,r)=>s+p02Round(r.kg),0)),bags=p02Round(weighings.reduce((s,r)=>s+r.bags,0)),deduction=p02Round(p02Numeric('ppDeduction')),price=p02Round(p02Numeric('ppPrice'));
    if(!supplier||!weighings.length||weighings.some(r=>!Number.isFinite(r.bags)||r.bags<=0||!Number.isFinite(r.kg)||r.kg<=0)||!Number.isFinite(deduction)||deduction<0||deduction>=gross||!Number.isFinite(price)||price<=0)throw new Error('Check the farmer, weighings, deductions and price before reviewing.');
    Object.assign(body,{supplier,weighings,deduction_kg:deduction,price_per_kg:price,payment_type:p02Value(kind==='receive'?'prPay':'ppPay')});
    if(kind==='receive') { const batch=p02ReceiveBatch();Object.assign(body,{location:p02Value('prLocation').trim(),variety:p02Value('prVariety'),request_id:p02ReceiveRequest});if(!body.location||!body.variety)throw new Error('Enter the location and select a variety.');if(batch)body.existingBatchId=batch.id;route='/api/palay/receive';add('Batch',batch?batch.batch_code:'Created automatically when posted');add('Variety / Source',`${body.variety} · ${body.location}`); }
    else {body.batchId=p02Numeric('ppBatch');body.correction_of=correctionIdFor('PALAY_PURCHASE')||null;route='/api/palay/purchase';}
    add('Farmer / Supplier',supplier);add('Quantity',`${numFmt(bags)} bags · ${numFmt(gross-deduction)} net KG`);add('Amount',money((gross-deduction)*price));add('Payment',body.payment_type);add('Stock Effect',`Fresh palay +${numFmt(bags)} bags`);next='dry';
  } else if(kind==='dry') {
    Object.assign(body,{batchId:p02Numeric('pdBatch'),input_bags:p02Numeric('pdBags'),correction_of:correctionIdFor('PALAY_DRYING')||null});
    if(p02FormVersion===1)Object.assign(body,{input_qty:p02Numeric('pdIn'),output_bags:p02Numeric('pdOutBags')});else Object.assign(body,{labor_group_id:p02Numeric('pdLabor'),notes:p02Value('pdNotes')});
    if($('pdPost')?.disabled||!(body.input_bags>0))throw new Error('Choose available fresh bags and a labor group.');route='/api/palay/dry';add('Source',p02OptionLabel('pdBatch'));if($('pdLabor'))add('Labor Group',p02OptionLabel('pdLabor'));add('Quantity',`${numFmt(body.input_bags)} fresh bags`);add('Stock Effect',`Fresh −${numFmt(body.input_bags)} bags · Dry +${numFmt(p02Numeric('pdOutBags'))} bags`);add('Amount','Stock conversion; no payment recorded');next='mill';
  } else if(kind==='mill') {
    Object.assign(body,{input_bags:p02Numeric('pmBags'),rice_bags:p02Numeric('pmRice'),bran_bags:p02Numeric('pmBran'),broken_bags:p02Numeric('pmBroken'),correction_of:correctionIdFor('PALAY_MILLING')||null});
    if(p02FormVersion===1)body.batchId=p02Numeric('pmBatch');else {body.variety=p02Value('pmVariety');body.notes=p02Value('pmNotes');}
    if($('pmPost')?.disabled||body.input_bags<=0)throw new Error('Check the available dry bags and product output quantities.');route='/api/palay/mill';add('Source',body.variety||p02OptionLabel('pmBatch'));add('Quantity',`${numFmt(body.input_bags)} dry bags`);add('Stock Effect',`Dry −${numFmt(body.input_bags)} · Rice +${numFmt(body.rice_bags)} · Bran +${numFmt(body.bran_bags)} · Broken +${numFmt(body.broken_bags)} bags`);add('Amount','Stock conversion; no payment recorded');next='sell';
  } else if(kind==='sale'||kind==='dispatch') {
    const prefix=kind==='sale'?'ps':'cd';Object.assign(body,{itemId:p02Value(prefix+'Item'),qty:p02Numeric(prefix+'Qty'),qty_unit:p02Value(prefix+'Unit'),unit_price:p02Numeric(prefix+'Price')});
    if(!(body.qty>0)||!Number.isFinite(body.qty)||!(body.unit_price>0)||!Number.isFinite(body.unit_price))throw new Error('Enter a positive quantity and price.');
    if(kind==='sale'&&$('p02SaleReview')?.disabled||kind==='dispatch'&&$('p02DispatchReview')?.disabled)throw new Error('Check the warehouse stock, quantity and required details before reviewing.');
    if(kind==='sale'){Object.assign(body,{customer:p02Value('psCustomer').trim(),payment_type:p02Value('psPay'),correction_of:correctionIdFor('PALAY_SALE')||null});if(!body.customer)throw new Error('Enter the customer name.');if(p02Value('psBatch'))body.batchId=p02Numeric('psBatch');route='/api/palay/sale';add('Customer',body.customer);add('Payment',body.payment_type);}
    else {Object.assign(body,{consigneeId:p02Numeric('cdStore'),batchId:p02Numeric('cdBatch'),notes:p02Value('cdNotes')});route='/api/palay/consignment/dispatch';add('Store',p02OptionLabel('cdStore'));add('Source',p02OptionLabel('cdBatch'));}
    add('Product',p02OptionLabel(prefix+'Item'));add('Quantity',`${numFmt(body.qty)} ${body.qty_unit}`);add('Amount',money(body.qty*body.unit_price));add('Stock Effect',`${kind==='sale'?'Warehouse stock decreases':'Warehouse → store'} by ${numFmt(body.qty*p02UnitFactor(body.qty_unit))} KG`);
  } else if(kind==='settle'||kind==='collect') {
    const d=p02Data.cs.dispatches.find(x=>Number(x.id)===Number(id));if(!d)throw new Error('Store consignment not found.');body.dispatchId=Number(id);add('Store / Source',`${d.store_name} · ${d.dispatch_no}`);
    if(kind==='settle'){Object.assign(body,{sold_qty:p02Numeric('csSold'),returned_qty:p02Numeric('csReturn'),qty_unit:p02Value('csUnit'),amount_received:p02Numeric('csPaid'),correction_of:correctionIdFor('CONSIGNMENT_SETTLEMENT')||null});const factor=p02UnitFactor(body.qty_unit,d.sack_kg||50),net=p02Round(body.sold_qty*factor*d.unit_price*(1-Number(d.commission_rate||0)/100));if(![body.sold_qty,body.returned_qty,body.amount_received].every(Number.isFinite)||body.sold_qty<0||body.returned_qty<0||body.sold_qty+body.returned_qty<=0||(body.sold_qty+body.returned_qty)*factor>d.outstanding_qty+.0001||body.amount_received<0||body.amount_received>net+.005)throw new Error('Check sold, returned and payment amounts.');route='/api/palay/consignment/settle';add('Quantity',`${numFmt(body.sold_qty)} sold · ${numFmt(body.returned_qty)} returned ${body.qty_unit}`);add('Amount Received',money(body.amount_received));add('Remaining New Balance',money(net-body.amount_received));add('Stock Effect',`Store stock −${numFmt((body.sold_qty+body.returned_qty)*factor)} KG · Warehouse +${numFmt(body.returned_qty*factor)} KG`);}
    else {body.amount=p02Numeric('ccAmt');body.correction_of=correctionIdFor('CONSIGNMENT_COLLECTION')||null;if(!Number.isFinite(body.amount)||body.amount<=0||body.amount>d.unremitted_ar+.005)throw new Error('Enter a collection within the outstanding balance.');route='/api/palay/consignment/collect';add('Amount Received',money(body.amount));add('Remaining Balance',money(d.unremitted_ar-body.amount));add('Stock Effect','No stock change');}
  } else {body.amount=p02Numeric('settleAmt');body.description=p02Value('settleDesc');if(!Number.isFinite(body.amount)||body.amount<=0||body.amount>Number(window.projectSettlementBalance||0)+.005)throw new Error('Enter an amount within the available balance.');route=kind==='ar'?'/api/ar/collect':'/api/ap/pay';add('Source','Project customer / supplier balance');add('Amount',money(body.amount));add('Stock Effect','No stock change');}
  return {kind,id,route,body,rows,next,pid:currentPid()};
}
function p02ReviewCurrent(kind,id=null) {
  if(p02Posting||p02Pending||$('p02ReviewStep'))return;
  try {
    const pending=p02BuildTransaction(kind,id), root=$('modalRoot'), body=root.querySelector('.modal-body'), foot=root.querySelector('.modal-foot');if(!body||!foot)return;
    const input=document.createElement('div');input.id='p02InputStep';while(body.firstChild)input.appendChild(body.firstChild);input.hidden=true;body.appendChild(input);
    pending.input=input;pending.originalFooter=foot.innerHTML;p02Pending=pending;
    const review=document.createElement('section');review.id='p02ReviewStep';review.className='p02-review';review.innerHTML=`<h4>Review Transaction</h4><dl>${pending.rows.map(([label,value])=>`<div class="p02-review-row"><dt>${esc(label)}</dt><dd>${esc(value)}</dd></div>`).join('')}</dl><p class="p02-input-note">Confirm these details, then post once.</p><p id="p02PostError" class="p02-review-warning" role="alert"></p>`;body.appendChild(review);body.scrollTop=0;
    foot.innerHTML='<button class="btn soft" onclick="p02BackToInput()">Back</button><button class="btn primary" id="p02FinalPost" onclick="p02PostReviewed()">Post Transaction</button>';p02MarkModal();
  } catch(e) { toast(p02PlainError(e),'error'); }
}
function p02BackToInput() {
  if(p02Posting||!p02Pending)return;const root=$('modalRoot'), input=p02Pending.input, body=root.querySelector('.modal-body');root.querySelector('#p02ReviewStep')?.remove();while(input.firstChild)body.insertBefore(input.firstChild,input);input.remove();root.querySelector('.modal-foot').innerHTML=p02Pending.originalFooter;p02Pending=null;
  // Restore each form's calculations and disabled state after the footer is recreated.
  if($('prDate'))p02ReceiveTotals();else if($('pdLabor'))p02CalculateDry();else if($('pmVariety'))p02CalculateMill();
}
async function p02PostReviewed() {
  if(p02Posting||!p02Pending||!$('p02FinalPost'))return;
  const pending=p02Pending;if(currentPid()!==pending.pid)return toast('Return to the original project before posting.','error');
  const review=$('p02ReviewStep'),activeModal=review?.closest('.modal');
  const sameDialog=()=>review?.isConnected&&activeModal===$('modalRoot').querySelector('.modal');
  p02Posting=true;$('p02FinalPost').disabled=true;$('p02FinalPost').textContent='Posting…';$('modalRoot').querySelectorAll('.modal-head button,.modal-foot button').forEach(b=>b.disabled=true);
  try {
    const result=await api(pending.route,{method:'POST',body:JSON.stringify(pending.body)});
    if(p02Pending===pending)p02Pending=null;
    if(sameDialog()) {
      window.modalDirty=false;const seq=++p02DialogSequence;p02OperatorPreviousClose();
      if(currentPid()===pending.pid&&p02IsProject()){await pageOperations();if(currentPid()===pending.pid&&p02IsProject()&&seq===p02DialogSequence&&!$('modalRoot').querySelector('.modal'))p02ShowSuccess(pending,result);else toast('Transaction posted successfully. Review it in the original P02 project.');}else toast('Transaction posted successfully. Review it in the original P02 project.');
    } else toast('Transaction posted successfully. Review it in the original P02 project.');
  } catch(e) {
    if(sameDialog()){
      if($('p02PostError'))$('p02PostError').textContent=p02PlainError(e);
      if($('p02FinalPost')){$('p02FinalPost').disabled=false;$('p02FinalPost').textContent='Post Transaction';}
      activeModal.querySelectorAll('.modal-head button,.modal-foot button').forEach(b=>b.disabled=false);
    }else {if(p02Pending===pending)p02Pending=null;toast(p02PlainError(e),'error');}
  } finally {p02Posting=false;}
}
function p02ShowSuccess(pending,result) {
  const entry=result.entry||result.journal||result,ref=entry.ref||result.run?.run_no||result.dispatch?.dispatch_no||result.dispatch_no||'Saved';
  const t=p02Data?p02Totals():null,summary=t?pending.next==='dry'?`Fresh palay: ${numFmt(t.fresh)} bags available.`:pending.next==='mill'?`Dry palay: ${numFmt(t.dry)} bags ready for milling.`:pending.next==='sell'||['sale','dispatch'].includes(pending.kind)?`Finished products: ${numFmt(t.products/50)} bags in warehouse.`:pending.kind==='settle'||pending.kind==='collect'?`Store receivables: ${money(p02Data.cs.totals.unremitted_ar||0)}.`:pending.kind==='ar'?`Customer receivables: ${money(p02Data.ar)}.`:'Your records and stock have been refreshed.':'Transaction saved. Refresh the Overview to see current stock.';
  const available=t&&(pending.next==='dry'?t.fresh>0:pending.next==='mill'?t.dry>0:pending.next==='sell'?t.products>0:false);
  modal('Transaction Posted',`<div class="p02-success"><span class="p02-success-mark">✓</span><h3>Transaction Posted</h3><p><strong>${esc(ref)}</strong></p><p>${esc(pending.rows.find(r=>r[0]==='Stock Effect')?.[1]||pending.rows.find(r=>r[0]==='Amount')?.[1]||'Payment recorded.')}</p><p>${esc(summary)}</p></div>`,`<button class="btn soft" onclick="p02ReturnOverview()">Back to Overview</button>${available?`<button class="btn primary" onclick="closeModal();p02OpenAction('${pending.next}',${result.batch?.id||pending.body.batchId||'null'})">${pending.next==='dry'?'Dry Palay':pending.next==='mill'?'Mill Palay':'Sell / Release'}</button>`:''}`);p02MarkModal();
}
function p02ReturnOverview(){closeModal();p02SelectView('overview');}
savePalay=async function(type){if(!p02IsProject())return p02OperatorPreviousSave(type);return p02ReviewCurrent(type);};
const p02OriginalSaveDispatch=saveConsignmentDispatch,p02OriginalSaveSettlement=saveConsignmentSettlement,p02OriginalSaveCollection=saveConsignmentCollection;
saveConsignmentDispatch=async function(){return p02IsProject()?p02ReviewCurrent('dispatch'):p02OriginalSaveDispatch();};
saveConsignmentSettlement=async function(id){return p02IsProject()?p02ReviewCurrent('settle',id):p02OriginalSaveSettlement(id);};
saveConsignmentCollection=async function(id){return p02IsProject()?p02ReviewCurrent('collect',id):p02OriginalSaveCollection(id);};
saveProjectSettlement=async function(kind){return p02IsProject()?p02ReviewCurrent(kind==='AR'?'ar':'ap'):p02OperatorPreviousSaveProjectSettlement(kind);};
function p02ChooseConsignment(mode){
  const rows=p02Data.cs.dispatches.filter(d=>mode==='settle'?d.outstanding_qty>.005:d.unremitted_ar>.005);
  if(rows.length===1)return mode==='settle'?consignmentSettlementModal(rows[0].id):consignmentCollectModal(rows[0].id);
  modal(mode==='settle'?'Choose Store to Settle':'Choose Store Balance',`<div class="p02-attention">${rows.map(d=>p02Attention(d.store_name,`${d.dispatch_no} · ${mode==='settle'?numFmt(d.outstanding_qty/50)+' bags outstanding':money(d.unremitted_ar)+' balance'}`,`${mode==='settle'?'consignmentSettlementModal':'consignmentCollectModal'}(${d.id})`)).join('')||p02Empty(mode==='settle'?'No consignments need settlement.':'No outstanding store receivables.')}</div>`,'<button class="btn soft" onclick="closeModal()">Back</button>');p02MarkModal();
}
function p02ChooseCollection(){
  const store=p02Totals().storeAr,ordinary=p02Data.ar>.005;
  if(!ordinary)return p02ChooseConsignment('collect');if(!store.length)return projectSettlementModal('AR');
  modal('Collect Balance',`<div class="p02-attention">${p02Attention('Store balances',money(store.reduce((s,d)=>s+Number(d.unremitted_ar),0)),"p02ChooseConsignment('collect')")}${p02Attention('Customer balances',money(p02Data.ar),"projectSettlementModal('AR')")}</div>`,'<button class="btn soft" onclick="closeModal()">Back</button>');p02MarkModal();
}
async function p02BatchDetails(id){
  const b=p02Data.batches.find(x=>Number(x.id)===Number(id));if(!b)return;
  modal('Batch Details',`<dl class="p02-review">${[['Batch',b.batch_code],['Variety',b.variety||'Unassigned'],['Source',b.source_name||'—'],['Location',b.location],['Date',dmy(b.harvest_date)],['Stock Value',money(b.inventory_value)]].map(([a,v])=>`<div class="p02-review-row"><dt>${esc(a)}</dt><dd>${esc(v)}</dd></div>`).join('')}</dl>${p02RegisterTable(['Stock','Bags','KG','Value'],b.inventory.map(x=>[esc(x.name),numFmt(x.bag_qty||x.qty/50),numFmt(x.qty),money(x.cost)]))}`,`<button class="btn soft" onclick="closeModal()">Close</button><button class="btn primary" onclick="closeModal();p02BatchHistory(${b.id})">View History / Corrections</button>`);p02MarkModal();
}
async function p02BatchHistory(id){await p02SelectView('records');$('p02RecordType').value='operations';const s=opsServerState();s.q=p02Data.batches.find(b=>b.id===Number(id))?.batch_code||'';s.page=1;await p02LoadRecords();}
function p02ConsignmentDetails(id){const d=p02Data.cs.dispatches.find(x=>Number(x.id)===Number(id));if(!d)return;modal('Store Consignment Details',`<dl>${[['Reference',d.dispatch_no],['Store',d.store_name],['Product / Batch',`${d.item_name} · ${d.batch_code}`],['Sent',`${numFmt(d.qty_sent)} KG`],['Sold',`${numFmt(d.sold_qty)} KG`],['Returned',`${numFmt(d.returned_qty)} KG`],['Outstanding',`${numFmt(d.outstanding_qty)} KG`],['Balance',money(d.unremitted_ar)],['Store Share',`${numFmt(d.commission_rate)}%`]].map(([a,v])=>`<div class="p02-review-row"><dt>${esc(a)}</dt><dd>${esc(v)}</dd></div>`).join('')}</dl>`,`<button class="btn soft" onclick="closeModal()">Close</button><button class="btn primary" onclick="closeModal();p02OpenSalesHistory()">History / Corrections</button>`);p02MarkModal();}
async function p02SetupModal(){
  if(!p02CanSetup())return;
  const seq=++p02DialogSequence,pid=currentPid();
  try{const masters=await p02Masters();if(seq!==p02DialogSequence||pid!==currentPid()||!p02IsProject()||!p02CanSetup())return;modal('Manager Setup',`<details class="p02-extra"><summary>Varieties & Labor Groups</summary>${p02MasterMarkup(masters,currentPid())}</details><details class="p02-extra"><summary>Stores / Consignees</summary>${p02Data.cs.consignees.map(s=>`<div class="p02-card-actions"><span>${esc(s.store_name)}</span><button class="btn soft" onclick="consigneeModal(${s.id})">Edit</button></div>`).join('')||p02Empty('No stores added yet.')}<button class="btn soft" onclick="consigneeModal()">Add Store</button></details><details class="p02-extra"><summary>Unassigned Variety</summary><button class="btn soft" onclick="p02AssignVarietyModal()">Assign Source Batch Variety</button></details><details class="p02-extra"><summary>Recovery & Consignment Defaults</summary><p>Drying recovery: ${numFmt(p02Data.cfg.drying_recovery_rate_pct)}%</p><p>Store share: ${numFmt(p02Data.cfg.consignee_commission_pct)}%</p>${roleIs('SUPERADMIN')?'<button class="btn soft" onclick="closeModal();openProjectSettings(\'P02\')">Edit System Defaults</button>':'<p>Ask the Super Admin to change these defaults.</p>'}</details>`,'<button class="btn primary" onclick="closeModal()">Done</button>',true);p02MarkModal();}catch(e){toast(p02PlainError(e),'error');}
}
