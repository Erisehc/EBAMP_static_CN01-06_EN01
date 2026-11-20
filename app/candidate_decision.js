/* Read-only comparison of the six saved candidates. Scientific plots remain on demand. */
(() => {
  'use strict';
  const $ = id => document.getElementById(id);
  const make = (tag, value, cls) => { const node = document.createElement(tag); if (value !== undefined && value !== null) node.textContent = String(value); if (cls) node.className = cls; return node; };
  const finite = value => typeof value === 'number' && Number.isFinite(value);
  const num = (value, digits = 3) => finite(value) ? value.toFixed(digits) : '—';
  const pct = value => finite(value) ? (100 * value).toFixed(1) + '%' : '—';
  const qfmt = value => !finite(value) ? '未计算' : value === 0 ? '<10⁻³⁰⁰' : value < .001 ? value.toExponential(2) : value.toFixed(3);
  const rank = c => String(c.rank).padStart(2, '0');
  const short = {1:'综合平衡',2:'群体功能主线',3:'posterior 筛选',4:'网络分离',5:'TP53 靶基因',6:'神经相关 movers'};
  const modes = {hard:'全部 hard movers',posterior:'仅 P(换簇)>0.5',intersection:'hard ∩ P(换簇)>0.5'};
  const state = { data: null, candidates: [], selected: 1, correction: 'within', terms: new Map() };
  const appendList = (parent, values) => { const list = make('ul', null, 'text-list'); for (const value of values || []) list.append(make('li', value)); parent.append(list); return list; };
  const safePath = path => { try { return typeof path === 'string' && ['http:', 'https:'].includes(new URL(path, location.href).protocol); } catch { return false; } };
  function link(label, path, cls) { const a = make('a', label, cls); if (safePath(path)) a.href = path; return a; }
  function fitURL(page, c, extras = {}) { return page + '?' + new URLSearchParams({fit:c.id, ...extras}); }
  const candidate = n => state.candidates.find(c => c.rank === Number(n));
  const evidence = c => c.evidence && !Array.isArray(c.evidence) ? c.evidence : {};
  const terms = c => evidence(c).community_terms || [];
  const qvalue = item => state.correction === 'pooled' ? item.q_pooled : item.q_within_fit;
  const correctionLabel = () => state.correction === 'pooled' ? '跨参数 BH' : '单组合 BH';
  const qvector = term => state.correction === 'pooled' ? term.q_pooled || [] : term.q_within_fit || [];
  function candidateButton(c, cls, scroll = true) { const b = make('button', rank(c) + ' · ' + (short[c.rank] || c.label), cls); b.type = 'button'; b.dataset.rank = c.rank; b.addEventListener('click', () => selectCandidate(c.rank, scroll)); return b; }
  function chooseReason(c) { const choice = (state.data.choices || []).find(item => (item.prefer || []).map(Number).includes(c.rank)); return choice?.reason || c.editorial?.headline || c.recommendation || ''; }
  function renderChoices() {
    $('choiceCards').replaceChildren(); $('candidateTabs').replaceChildren();
    for (const c of state.candidates) {
      const b = make('button', null, 'choice'); b.type = 'button'; b.dataset.rank = c.rank;
      const top = make('div', null, 'choice-top'); top.append(make('span', rank(c), 'rank'), make('h3', short[c.rank] || c.label));
      b.append(top, make('p', c.editorial?.headline || chooseReason(c)), make('small', '看优点、担忧与生物学解释 →'));
      b.addEventListener('click', () => selectCandidate(c.rank, true)); $('choiceCards').append(b);
      const tab = candidateButton(c, ''); tab.addEventListener('click', () => tab.focus({preventScroll:true})); $('candidateTabs').append(tab);
    }
  }
  function renderTables() {
    for (const c of state.candidates) {
      const m = c.metrics || {}, p = c.parameters || {};
      const row = make('tr'); row.dataset.rank = c.rank; const name = make('td'); name.append(candidateButton(c, 'row-link')); row.append(name);
      for (const value of [p.n, num(m.correlation_gap), num(m.adjacency_gap), m.nonempty_min, pct(m.maxfrac_worst), num(m.effective_min,2), pct(m.remote_fraction_neighbor), pct(m.offdiag_excess_fraction)]) row.append(make('td', value ?? '—'));
      $('resultRows').append(row);
      const pr = make('tr'); pr.dataset.rank = c.rank; const pn = make('td'); pn.append(candidateButton(c,'row-link')); pr.append(pn);
      for (const value of [p.tau,p.n,p.degree_rule || '见原组合',p.rcond,p.init,p.schedule,p.refresh ? 'True' : 'False',p.seed]) pr.append(make('td', value ?? '—'));
      if (p.refresh) pr.children[7].append(make('span',' · 重算','chip warning'));
      $('parameterRows').append(pr);
    }
    $('showResults').addEventListener('click', () => tableView(false)); $('showParameters').addEventListener('click', () => tableView(true));
  }
  function tableView(parameters) {
    $('resultTable').hidden = parameters; $('parameterTable').hidden = !parameters;
    for (const [id, active] of [['showResults',!parameters],['showParameters',parameters]]) { $(id).classList.toggle('active',active); $(id).setAttribute('aria-pressed',String(active)); }
  }
  function svgNode(tag, attrs = {}, value) { const node = document.createElementNS('http://www.w3.org/2000/svg',tag); for (const [key,val] of Object.entries(attrs)) node.setAttribute(key,val); if (value !== undefined) node.textContent = value; return node; }
  function renderScatter() {
    const width = 630, height = 335, left = 65, right = 25, top = 25, bottom = 60;
    const x = v => left + (v - .22) / .30 * (width-left-right), y = v => top + (.32-v) / .18 * (height-top-bottom);
    const svg = svgNode('svg',{viewBox:`0 0 ${width} ${height}`,role:'img','aria-labelledby':'scatterTitle scatterDesc'});
    svg.append(svgNode('title',{id:'scatterTitle'},'六个候选的 correlation gap 与远处深色块占比'),svgNode('desc',{id:'scatterDesc'},'横轴为 correlation gap，越大越好；纵轴为远处深色块权重占比，向下减小。所有圆点大小相同。点击点选择候选。'));
    for (const v of [.15,.20,.25,.30]) { const py = y(v); svg.append(svgNode('line',{x1:left,x2:width-right,y1:py,y2:py,stroke:'#e3e9ed'}),svgNode('text',{x:left-12,y:py+5,'text-anchor':'end',fill:'#627483'},Math.round(v*100)+'%')); }
    for (const v of [.25,.30,.35,.40,.45,.50]) svg.append(svgNode('text',{x:x(v),y:height-bottom+26,'text-anchor':'middle',fill:'#627483'},v.toFixed(2)));
    svg.append(svgNode('line',{x1:left,x2:width-right,y1:height-bottom,y2:height-bottom,stroke:'#aabcc7'}),svgNode('text',{x:(left+width-right)/2,y:height-10,'text-anchor':'middle',fill:'#526575'},'Correlation gap →'),svgNode('text',{x:14,y:150,transform:'rotate(-90 14 150)','text-anchor':'middle',fill:'#526575'},'远处深色块占比'));
    for (const c of state.candidates) {
      const cx=x(c.metrics.correlation_gap),cy=y(c.metrics.remote_fraction_neighbor),g=svgNode('g',{class:'point',tabindex:'0',role:'button','data-rank':c.rank,'aria-label':`${rank(c)}，correlation gap ${num(c.metrics.correlation_gap)}，远处深色块 ${pct(c.metrics.remote_fraction_neighbor)}，打开详细说明`});
      g.append(svgNode('title',{},`${rank(c)} ${short[c.rank]} · gap ${num(c.metrics.correlation_gap)} · 远处 ${pct(c.metrics.remote_fraction_neighbor)}`),svgNode('circle',{cx,cy,r:15,fill:c.rank===state.selected?'#176e65':'#e8f1ef',stroke:'#6f9c90','stroke-width':1.5}),svgNode('text',{x:cx,y:cy+5,'text-anchor':'middle',fill:c.rank===state.selected?'white':'#176e65','font-weight':700},rank(c)));
      g.addEventListener('click',() => selectCandidate(c.rank,true)); g.addEventListener('keydown',event => {if(event.key==='Enter'||event.key===' '){event.preventDefault();selectCandidate(c.rank,true);}}); svg.append(g);
    }
    $('scatter').replaceChildren(svg);
  }
  function renderPair() {
    const a=candidate($('compareA').value),b=candidate($('compareB').value),target=$('pairComparison'); target.replaceChildren(); if(!a||!b)return;
    const table=make('table',null,'pair-table'),head=make('thead'),hr=make('tr'); for(const v of ['比较点',rank(a),rank(b)])hr.append(make('th',v));head.append(hr);table.append(head); const body=make('tbody');
    for(const [label,av,bv] of [['Correlation gap',num(a.metrics.correlation_gap),num(b.metrics.correlation_gap)],['Adjacency gap',num(a.metrics.adjacency_gap),num(b.metrics.adjacency_gap)],['最少非空簇 / 有效簇',a.metrics.nonempty_min+' / '+num(a.metrics.effective_min,2),b.metrics.nonempty_min+' / '+num(b.metrics.effective_min,2)],['远处深色块',pct(a.metrics.remote_fraction_neighbor),pct(b.metrics.remote_fraction_neighbor)],['rcond / refresh',a.parameters.rcond+' / '+String(a.parameters.refresh),b.parameters.rcond+' / '+String(b.parameters.refresh)]]){const r=make('tr');for(const v of [label,av,bv])r.append(make('td',v));body.append(r);}table.append(body);target.append(table);
    const stories=make('div',null,'pair-stories'); for(const c of [a,b]){const section=make('div');section.append(make('strong',rank(c)+' · '+short[c.rank]),make('p',c.editorial?.headline||c.recommendation));if(c.editorial?.concerns?.[0])section.append(make('p','主要顾虑：'+c.editorial.concerns[0]));stories.append(section);}target.append(stories);
    if(a.rank===b.rank)target.append(make('p','当前两边是同一组合；选择另一组即可比较。','chart-note'));
    else if(a.parameters.graph===b.parameters.graph)target.append(make('p','这两组使用同一网络和 common gene set，可把差异集中理解为 EBAMP 参数的影响。仍需看重复 seed 的稳定性。','chart-note'));
    else target.append(make('p','这两组的建网或 degree 筛选不同，基因集合也可能不同；gap 和 GO 的差异同时包含预处理与拟合影响。','chart-note'));
  }
  function setupPairs() { for (const id of ['compareA','compareB']) { for (const c of state.candidates){const op=make('option',rank(c)+' · '+short[c.rank]);op.value=c.rank;$(id).append(op);}$(id).addEventListener('change',renderPair);} $('compareA').value=1;$('compareB').value=3;renderPair(); }
  function shade(q){ if(!finite(q)||q>=.05)return null; const strength=Math.min(6,-Math.log10(Math.max(q,1e-300))),t=(strength-1.30103)/(6-1.30103);return `rgb(${Math.round(146-123*t)}, ${Math.round(187-77*t)}, ${Math.round(178-77*t)})`; }
  function renderTimeline() {
    $('timelineRows').replaceChildren();
    for(const c of state.candidates){const all=terms(c),index=Math.min(state.terms.get(c.rank)||0,Math.max(0,all.length-1)),t=all[index];const tr=make('tr');tr.dataset.rank=c.rank;
      const name=make('td'),label=make('div',null,'timeline-name');label.append(candidateButton(c,''));if(t)label.append(make('span','C'+t.cluster,'chip'));name.append(label);
      const select=make('select');select.setAttribute('aria-label',rank(c)+' 关注的 GO');select.dataset.rank=c.rank;all.forEach((term,i)=>{const op=make('option',term.name+' · C'+term.cluster);op.value=i;select.append(op);});select.value=index;select.addEventListener('change',()=>{state.terms.set(c.rank,Number(select.value));renderTimeline();});name.append(select);tr.append(name);
      const qs=t?qvector(t):[];
      for(let i=0;i<12;i++){const td=make('td'),q=qs[i],sig=finite(q)&&q<.05,cell=make('span',sig?'●':'·','timeline-cell'+(sig?'':' nonsig'));cell.dataset.layer=i+1;cell.dataset.significant=String(sig);cell.dataset.q=finite(q)?String(q):'';if(sig)cell.style.background=shade(q);cell.title=`${rank(c)} · C${t?.cluster??'?'} · L${i+1}\n${t?.name||'尚无证据'}\n${correctionLabel()} q=${qfmt(q)}\n命中 ${t?.hits?.[i]??'—'} / 簇内 ${t?.cluster_sizes?.[i]??'—'} 个基因`;cell.setAttribute('aria-label',cell.title);td.append(cell);tr.append(td);}
      const core=make('td',null,'core');core.append(make('strong',qs.filter(q=>finite(q)&&q<.05).length+'/12 层'),make('small','核心 '+(t?.core_n??'—')+' / '+(t?.union_n??'—')));tr.append(core);$('timelineRows').append(tr);
    }
  }
  function modeCard(mode, denominatorKey='n', isTF=false) {
    const n=mode[denominatorKey],fraction=finite(n)&&n>0?mode.hits/n:0,q=qvalue(mode),card=make('div',null,'mode-card '+mode.mode);card.dataset.mode=mode.mode;
    const head=make('div',null,'mode-head');head.append(make('strong',modes[mode.mode]||mode.mode),make('span',`${mode.hits??'—'}/${n??'—'} · ${pct(fraction)}`));
    const track=make('div',null,'mode-track'),fill=make('div',null,'mode-fill');fill.style.width=Math.max(0,Math.min(100,fraction*100))+'%';track.append(fill);
    const values=make('div',null,'mode-values');values.append(make('span',correctionLabel()+' q='+qfmt(q),finite(q)&&q<.05?'sig':'not-sig'),make('span','富集 '+num(mode.fold,2)+' 倍'));
    card.append(head,track,values);if(isTF)card.append(make('p','总 movers '+mode.total_movers+'；其中 '+n+' 个有靶注释。','chart-note'));return card;
  }
  function geneDetails(title, symbols) { const d=make('details',null,'gene-detail');d.append(make('summary',title),make('p',(symbols||[]).length?symbols.join(' · '):'无','gene-list'));return d; }
  function renderCommunity(c,target) {
    target.append(make('h3','跨层功能：稳定的是 GO，还是同一批基因？'));
    const box=make('div',null,'mini-terms');for(const t of terms(c)){const item=make('div',null,'mini-term'),qs=qvector(t);item.append(make('strong',t.name+' · C'+t.cluster),make('p',`${correctionLabel()}：${qs.filter(q=>finite(q)&&q<.05).length}/12 层显著；全部 12 层核心 ${t.core_n}/${t.union_n}。`));
      if(t.other_cluster_significant_cells>0)item.append(make('small','单组合 BH 下，同一 GO 还在其他簇出现 '+t.other_cluster_significant_cells+' 个显著簇×层；不能描述为严格只属于这一簇。'));
      item.append(geneDetails('查看核心基因',t.core_symbols));
      if(t.window_core_symbols?.length&&t.window_layers?.length&&t.window_layers.length<12)item.append(make('p',`在单组合显著的所列层 L${t.window_layers.join('、L')} 中，共同保留 ${t.window_core_symbols.length} 个基因：${t.window_core_symbols.join('、')}。这些层未必连续，也不等于全部 12 层核心。`,'gene-list'));
      const start=t.window_layers?.[0]||1,end=t.window_layers?.at(-1)||12;
      box.append(item);}
    if(!terms(c).length)box.append(make('p','这一组合尚未提供逐层 GO 证据。'));target.append(box);
  }
  function renderMovers(c,target) {
    const e=evidence(c),m=e.mover_example;target.append(make('h3','Movers：posterior 筛选带来了什么？'));
    if(!m){target.append(make('p','代表 mover 结果尚未就绪。'));return;}
    target.append(make('p',`L${m.step} → L${m.step+1} · ${m.name}`,'mover-subtitle'));
    target.append(make('p','条长＝命中该 GO 的比例；各条统一 0–100%。右侧同时报告富集倍数与 q。','chart-note'));
    const barBox=make('div',null,'mover-bars');for(const mode of m.modes||[])barBox.append(modeCard(mode));target.append(barBox);
    const comp=m.membership_comparison;if(comp){const retained=Array.isArray(comp.hard_hit_retained_by_posterior)?comp.hard_hit_retained_by_posterior.length:comp.hard_hit_retained_by_posterior,dropped=Array.isArray(comp.hard_hit_dropped_by_posterior)?comp.hard_hit_dropped_by_posterior.length:comp.hard_hit_dropped_by_posterior,newHits=comp.posterior_new_hit_symbols?.length??0;
      target.append(make('p',`两组共有 ${comp.hard_intersection_n} 个基因；仅 hard 有 ${comp.hard_only_n} 个，仅 P>0.5 有 ${comp.posterior_only_n} 个。此 GO 的 hard 命中中，posterior 保留 ${retained} 个、去掉 ${dropped} 个，并新增 ${newHits} 个命中。`,'evidence-note'));
      target.append(geneDetails('保留的 GO 命中基因',comp.hard_hit_retained_by_posterior),geneDetails('筛掉的 GO 命中基因',comp.hard_hit_dropped_by_posterior));}
    target.append(make('p','hard 看对齐后的最可能标签是否改变；仅 P>0.5 不要求 hard 标签改变；交集是在 hard 内加模型概率筛选。posterior 支持是给定模型与预处理下的判断，q 更小也不等于已证明生物学准确率更高。','chart-note'));
    target.append(make('p','各候选展示的 GO 和转换可能不同，不能用这些例子的 q 大小给六组排“准确率”名次。','chart-note'));
    const counts=c.movers||{};if(finite(counts.hard_sig))target.append(make('p',`单组合 BH 下，11 个转换中的显著“转换×GO”条目数：hard ${counts.hard_sig}，仅 P>0.5 ${counts.posterior_sig}，交集 ${counts.intersection_sig}。这些固定计数不随上方校正切换；GO 条目会重叠，不能等同于独立生物过程的数量。`,'chart-note'));
    if(e.tf_membership)target.append(make('p',`Movers 自身是否富集 TF：这组 common genes 中有 ${e.tf_membership.known_tf_n} 个已知 TF；跨参数校正后显著检验 ${e.tf_membership.significant_pooled} 个。此问题与“某 TF 的靶基因是否富集”不同。`,'chart-note'));
  }
  function renderTF(c,target) {
    const tf=evidence(c).tf_targets;if(!tf)return;const panel=make('section',null,'tf-panel');panel.dataset.regulator=tf.regulator;
    panel.append(make('h3',`${tf.regulator} 靶基因：05 的特殊卖点，也有明确限制`),make('p',`L${tf.step} → L${tf.step+1}。检验背景是 ${tf.background_n} 个有 TRRUST 靶注释的 common genes，其中 ${tf.background_target_n} 个属于 ${tf.regulator} 靶集。条长的分母是有靶注释的 movers，不能用全部 movers 替代。`));
    const box=make('div',null,'tf-modes');for(const mode of tf.modes||[])box.append(modeCard(mode,'annotated_query_n',true));panel.append(box);
    panel.append(make('p','这里富集的是 TP53 的文献靶基因，不是 movers 自身是 TF。TP53 本身不在这组 common genes 中。只有 hard 集合的证据通过跨参数校正，P>0.5 与交集都没有通过；不能讲成 posterior 加强了 TP53 调控证据。','evidence-note'));
    const hard=(tf.modes||[]).find(x=>x.mode==='hard');panel.append(geneDetails('查看 hard 中的 TP53 靶基因',hard?.hit_symbols));target.append(panel);
  }
  function detailArticle(c,print=false) {
    const article=make('article',null,print?'print-candidate':'');article.dataset.fit=c.id;article.dataset.rank=c.rank;const ed=c.editorial||{},p=c.parameters||{};
    const intro=make('header',null,'detail-intro');intro.append(make('div','候选 '+rank(c)+' · '+short[c.rank],'eyebrow'),make('h3',ed.headline||c.label),make('p',`τ=${p.tau} · ${p.n} genes · K=10 · rcond=${p.rcond} · ${p.init} ${p.schedule} · refresh=${p.refresh?'True':'False'}`),make('div',c.id,'fit-id'));article.append(intro);
    const content=make('div',null,'detail-content'),actions=make('div',null,'actions');
    actions.append(link('查看已保存的热图', 'figures_'+rank(c)+'.html','button primary'));content.append(actions);
    const args=make('div',null,'argument-grid');for(const [title,values,cls] of [['为什么值得选',ed.why_choose||[], 'argument'],['选择时要接受的弱点',ed.concerns||c.tradeoffs||[], 'argument concern']]){const s=make('section',null,cls);s.append(make('h3',title));appendList(s,values);args.append(s);}content.append(args);
    const bio=make('section',null,'bio-reading');bio.append(make('h3','生物学上怎样理解'));appendList(bio,ed.biological_reading||[]);
    if(ed.defensible_claim){const claim=make('div',null,'biological-claim');claim.append(make('strong','汇报中可以这样说'),make('p',ed.defensible_claim));bio.append(claim);}if(ed.do_not_claim)bio.append(make('p','目前不能说：'+ed.do_not_claim,'avoid'));content.append(bio);
    const columns=make('div',null,'evidence-columns'),go=make('section'),moversSection=make('section');renderCommunity(c,go);renderMovers(c,moversSection);columns.append(go,moversSection);content.append(columns);renderTF(c,content);
    if(ed.next_check){const next=make('div',null,'next-check');next.append(make('h3','选它之后，优先补哪一步？'),make('p',ed.next_check));content.append(next);}
    const sourceItems=Array.isArray(c.source_paths)?c.source_paths:[];if(sourceItems.length){const source=make('details',null,'source-links');source.append(make('summary','原始结果与核对表'));const links=make('div',null,'downloads');for(const item of sourceItems)if(item.path)links.append(link(item.label||item.path,item.path));source.append(links);content.append(source);}
    article.append(content);return article;
  }
  function selectCandidate(n,scroll=false,writeURL=true) {
    const c=candidate(n);if(!c)return;state.selected=c.rank;$('detailBody').replaceChildren(detailArticle(c));
    for(const selector of ['#choiceCards .choice','#candidateTabs button','#resultRows tr','#parameterRows tr'])for(const node of document.querySelectorAll(selector)){const selected=Number(node.dataset.rank)===c.rank;node.classList.toggle(selector.includes('Tabs')?'active':'selected',selected);if(node.tagName==='BUTTON')node.setAttribute('aria-pressed',String(selected));}
    renderScatter();if(writeURL){const params=new URLSearchParams(location.search);params.set('candidate',rank(c));history.replaceState(null,'',location.pathname+'?'+params+location.hash);}if(scroll)$('candidateDetail').scrollIntoView({block:'start',behavior:'smooth'});
  }
  function setupPrint(){ $('printPage').addEventListener('click',()=>window.print()); window.addEventListener('beforeprint',()=>{if($('printAllCandidates'))return;const all=make('div',null,'print-only');all.id='printAllCandidates';for(const c of state.candidates){const section=make('section',null,'section');section.append(detailArticle(c,true));all.append(section);}$('detailBody').after(all);$('detailBody').classList.add('print-hide');});window.addEventListener('afterprint',()=>{$('printAllCandidates')?.remove();$('detailBody').classList.remove('print-hide');}); }
  async function start() {
    try {
      const data=window.STATIC_DATA;
      const candidates=data.candidates;if(!Array.isArray(candidates)||candidates.length!==6||candidates.some(c=>!Number.isInteger(c.rank)||c.rank<1||c.rank>6)||new Set(candidates.map(c=>c.id)).size!==6||new Set(candidates.map(c=>c.rank)).size!==6)throw Error('候选数据不完整：本页必须包含原编号 01–06。');
      state.data=data;state.candidates=[...candidates].sort((a,b)=>a.rank-b.rank);window.candidateDecisionData=data;window.candidateDecisionState=state;
      $('pageTitle').textContent=data.title||$('pageTitle').textContent;$('summary').textContent=data.summary||'';$('updated').textContent=data.updated?'结果更新：'+data.updated:'';
      for(const [key,label]of[['saved_fits','已保存拟合'],['structure_fits','结构筛查'],['community_fits','已查各簇 GO'],['mover_fits','已查 movers']])if(finite(data.coverage?.[key])){const s=make('span');s.append(make('b',data.coverage[key]),document.createTextNode(label));$('coverage').append(s);}
      for(const item of data.definitions||[]){$('definitions').append(make('dt',item.label),make('dd',item.text));}for(const item of data.scope||[])$('scopeList').append(make('li',item));
      for(const item of data.downloads||[])if(item.path)$('downloads').append(link(item.label||item.path,item.path));
      renderChoices();renderTables();setupPairs();renderTimeline();const query=new URLSearchParams(location.search),requested=Number(query.get('candidate')),fit=query.get('fit'),initial=candidate(requested)||state.candidates.find(c=>c.id===fit)||state.candidates[0];selectCandidate(initial.rank,false,false);
      $('correction').addEventListener('change',()=>{state.correction=$('correction').value;renderTimeline();selectCandidate(state.selected,false,false);});setupPrint();
      $('status').textContent='6 组固定候选 · 默认显示单组合校正 · 图表直接来自已保存结果';window.candidateDecisionReady=true;
    } catch(error){$('status').textContent=String(error.message||error);$('status').classList.add('error');window.candidateDecisionError=String(error);}
  }
  start();
})();
