/* Saagee Ads - Wall Painting module (admin only)
   Loaded by index.html with: <script src="wallpainting.js"></script> (after the main scripts).
   Collections: wpOrders, wpSites, wpTeams, wpLedger, wpStock, wpCost  */
(function(){
if(window.__wp)return;window.__wp=1;
var g=function(i){return document.getElementById(i)};
var COL={orders:"wpOrders",sites:"wpSites",teams:"wpTeams",ledger:"wpLedger",stock:"wpStock",cost:"wpCost"};
var D={orders:[],sites:[],teams:[],ledger:[],stock:[],cost:[]};
var WP={tab:"orders",ord:"",ft:"",fs:"",fq:"",lim:150,team:"",mon:"",eo:"",es:"",et:"",sf:""};
var started=false,err="",KEEP={};
var STS=[["booked","Booked"],["assigned","Assigned"],["painted","Painted"],["measured","Measured"],["verified","Verified"]];
var LTY=[["food","Food"],["advance","Advance"],["brush","Brush / material"],["paint","Paint"],["vehicle","Tata Ace / vehicle"],["other","Other"],["pay","Payment to team (settlement)"]];
var UNITS=["Litre","Kg","Tin","Bucket","Piece","Box","Packet","Nos","Meter","Roll","Can","Set"];

function R(v){v=nm(v);return(v<0?"-":"")+"₹"+fmt(Math.abs(v))}
function q2(v){return Math.round(nm(v)*100)/100}
function Q(v){return q2(v).toLocaleString("en-IN")}
function tn(t){var n=String(t&&t.name||"").trim();return /^team/i.test(n)?n:"Team "+n}
function byId(a,id){for(var i=0;i<a.length;i++)if(a[i].id===id)return a[i];return null}
function opt(v,l,s){return'<option value="'+e(v)+'"'+(String(s)===String(v)?" selected":"")+">"+e(l)+"</option>"}
function dl(id,arr){return'<datalist id="'+id+'">'+arr.map(function(x){return'<option value="'+e(x)+'">'}).join("")+"</datalist>"}
function uniq(a){var o={},r=[];a.forEach(function(x){x=String(x||"").trim();if(x&&!o[x.toLowerCase()]){o[x.toLowerCase()]=1;r.push(x)}});return r.sort()}
function sortNo(a,b){return nm(a.no)-nm(b.no)}
function isDone(s){return s.st==="measured"||s.st==="verified"}
function stLabel(k){for(var i=0;i<STS.length;i++)if(STS[i][0]===k)return STS[i][1];return k||""}
function ordName(o){return o?(o.company||"")+(o.title?" – "+o.title:""):"(deleted order)"}
function val(id){var x=g(id);return x?x.value.trim():""}
function who(){return typeof UNAME!=="undefined"?UNAME:""}
function log(t){try{logAct(t)}catch(x){}}
function fail(x){alert("Could not save: "+(x&&x.message||x)+"\n\nIf it says 'permission', publish the new firestore.rules in Firebase Console.")}
function add(k,o){o.by=who();o.created=Date.now();return db.collection(COL[k]).add(o).catch(fail)}
function upd(k,id,o){o.editedAt=Date.now();o.editedBy=who();return db.collection(COL[k]).doc(id).update(o).catch(fail)}
function del(k,id){return db.collection(COL[k]).doc(id).delete().catch(fail)}
function batch(ops){ // ops: [[k,id,data]]
  var p=Promise.resolve();
  for(var i=0;i<ops.length;i+=400){(function(ch){p=p.then(function(){var b=db.batch();ch.forEach(function(o){b.update(db.collection(COL[o[0]]).doc(o[1]),o[2])});return b.commit()})})(ops.slice(i,i+400))}
  return p.catch(fail)}
function batchAdd(k,list){
  var p=Promise.resolve();
  for(var i=0;i<list.length;i+=400){(function(ch){p=p.then(function(){var b=db.batch();ch.forEach(function(o){b.set(db.collection(COL[k]).doc(),o)});return b.commit()})})(list.slice(i,i+400))}
  return p.catch(fail)}

/* ---------- calculations ---------- */
function teamCalc(tid){
  var om={};D.orders.forEach(function(o){om[o.id]=o});
  var r={sites:0,done:0,painted:0,earned:0,ded:0,notDed:0,pay:0,by:{},ords:{}};
  D.sites.forEach(function(s){if(s.team!==tid)return;r.sites++;var o=om[s.oid],tr=o?nm(o.trate):0,sq=nm(s.sq);
    var x=r.ords[s.oid]||(r.ords[s.oid]={n:0,done:0,painted:0,rate:tr});x.n++;
    if(isDone(s)){r.done+=sq;r.earned+=sq*tr;x.done+=sq}else if(s.st==="painted"){r.painted+=sq;x.painted+=sq}});
  D.ledger.forEach(function(l){if(l.team!==tid)return;var a=nm(l.amt);
    if(l.ty==="pay")r.pay+=a;else if(l.ded===false)r.notDed+=a;else{r.ded+=a;r.by[l.ty]=(r.by[l.ty]||0)+a}});
  r.net=r.earned-r.ded;r.bal=r.net-r.pay;return r}
function profitCalc(){
  var rows=[],tot={sq:0,ver:0,bill:0,cost:0,profit:0};
  D.orders.slice().sort(function(a,b){return(b.date||"").localeCompare(a.date||"")}).forEach(function(o){
    var sq=0,ver=0,pn=0;
    D.sites.forEach(function(s){if(s.oid!==o.id)return;
      if(isDone(s)&&(!WP.mon||(s.mdate||"").slice(0,7)===WP.mon)){var a=nm(s.sq);sq+=a;if(s.st==="verified")ver+=a}
      else if(s.st==="painted")pn+=nm(s.sq)});
    var bill=sq*nm(o.rate),cost=sq*nm(o.trate);
    if(sq||pn){rows.push({o:o,sq:sq,ver:ver,pn:pn,bill:bill,cost:cost,profit:bill-cost});tot.sq+=sq;tot.ver+=ver;tot.bill+=bill;tot.cost+=cost;tot.profit+=bill-cost}});
  return{rows:rows,tot:tot}}
function stockBal(){
  var P={},B={},T={};
  D.stock.forEach(function(m){var k=String(m.pr||"").trim().toLowerCase()+"|"+String(m.un||"").trim().toLowerCase();
    if(!P[k])P[k]={pr:String(m.pr||"").trim(),un:String(m.un||"").trim()};var q=nm(m.qt);
    if(m.fr==="SHOP")T[k]=(T[k]||0)+q;else{B[m.fr]=B[m.fr]||{};B[m.fr][k]=(B[m.fr][k]||0)-q}
    B[m.to]=B[m.to]||{};B[m.to][k]=(B[m.to][k]||0)+q});
  return{P:P,B:B,T:T}}
function holderName(h,m){
  if(h==="SUP")return"Supervisor";if(h==="USED")return"Used / finished";
  if(h==="SHOP")return"🏪 "+(m&&m.shop?m.shop:"Shop");
  if(h&&h.indexOf("T:")===0){var t=byId(D.teams,h.slice(2));return t?tn(t):"(deleted team)"}return h||""}

/* ---------- shell ---------- */
function build(){
  if(g("v-wp"))return;
  var st=document.createElement("style");
  st.textContent=".wpt{display:flex;gap:6px;flex-wrap:wrap;margin-bottom:10px}.wpt button.on{background:var(--br);border-color:var(--br);color:#fff;font-weight:600}"+
  ".wp .big{font-size:20px;font-weight:700}.wp .neg{color:#c62828;font-weight:700}.wp .pos{color:#1b7f3b;font-weight:700}"+
  ".wp .kp{display:grid;grid-template-columns:repeat(auto-fit,minmax(150px,1fr));gap:10px;margin:8px 0}.wp .kp>div{border:1px solid var(--ln);border-radius:10px;padding:8px 10px;background:#fff}.wp .kp small{display:block}"+
  ".wp details{margin:8px 0}.wp summary{cursor:pointer;font-weight:600;color:var(--br);padding:4px 0}"+
  ".wp tr.sel td{background:var(--bt)}.wp .tb select{padding:4px 6px;font-size:12px;min-width:90px}.wp .tb td small{display:block}"+
  ".wp .chk{display:inline-flex;align-items:center;gap:6px;margin:4px 12px 4px 0;font-size:13px;color:inherit}.wp .chk input{width:auto}"+
  ".wp .r3{display:grid;grid-template-columns:1fr 1fr 1fr;gap:8px}@media(max-width:700px){.wp .r3{grid-template-columns:1fr 1fr}}"+
  ".wp .msg{background:var(--ot);border:1px solid var(--or);border-radius:8px;padding:8px 10px;margin:8px 0;color:#7a5200}";
  document.head.appendChild(st);
  var ord=g("v-ord")||g("v-home");
  ord.insertAdjacentHTML("beforebegin",'<div id="v-wp" class="pg wp" hidden><div class="wpt" id="wpt"></div><div id="wpbody"></div></div>');
  if(window.VW&&VW.indexOf("wp")<0)VW.push("wp");
  var nav=g("nav"),b=document.createElement("button");
  b.dataset.v="wp";b.className="adm-only";b.textContent="Wall Painting";
  b.onclick=function(){if(typeof canLeave!=="function"||canLeave())go("wp")};
  nav.insertBefore(b,nav.querySelector('[data-v="ord"]')||nav.querySelector(".sp"));
  var _go=window.go;
  window.go=function(v){_go.apply(this,arguments);if(v==="wp"&&ROLE==="admin"){start();render(true)}};
  bind();
}
function start(){
  if(started||!window.db)return;started=true;
  Object.keys(COL).forEach(function(k){
    db.collection(COL[k]).onSnapshot(function(s){D[k]=s.docs.map(function(d){var o=d.data();o.id=d.id;return o});err="";refresh()},
      function(x){err=x.message||String(x);refresh()})})}
function refresh(){var v=g("v-wp");if(!v||v.hidden)return;
  render()}
function keep(){var b=g("wpbody");if(!b)return;b.querySelectorAll("input[id],select[id],textarea[id]").forEach(function(x){KEEP[x.id]=x.type==="checkbox"?x.checked:x.value})}
function restore(){Object.keys(KEEP).forEach(function(k){var x=g(k);if(!x)return;if(x.type==="checkbox")x.checked=KEEP[k];else x.value=KEEP[k]})}
function render(clear){
  var b=g("wpbody");if(!b)return;
  var fa=document.activeElement,fid=fa&&fa.id&&b.contains(fa)?fa.id:"",fs=0,fe=0;
  try{if(fid){fs=fa.selectionStart;fe=fa.selectionEnd}}catch(x){}
  if(clear)KEEP={};else keep();
  var T=[["orders","1. Orders"],["sites","2. Sites"],["teams","3. Teams & ledger"],["stock","4. Stock"],["profit","5. Profit"]];
  g("wpt").innerHTML=T.map(function(t){return'<button data-a="tab" data-t="'+t[0]+'"'+(WP.tab===t[0]?' class="on"':"")+">"+t[1]+"</button>"}).join("");
  var h="";
  if(err)h+='<div class="msg">Could not load data: '+e(err)+'<br>Publish the new <b>firestore.rules</b> in Firebase Console (Firestore → Rules) so the Wall Painting collections are allowed.</div>';
  h+=({orders:tabOrders,sites:tabSites,teams:tabTeams,stock:tabStock,profit:tabProfit}[WP.tab]||tabOrders)();
  b.innerHTML=h;restore();
  if(fid&&!clear){var nf=g(fid);if(nf){nf.focus();try{nf.setSelectionRange(fs,fe)}catch(x){}}}}

/* ---------- ORDERS ---------- */
function tabOrders(){
  var o=WP.eo?byId(D.orders,WP.eo):null;o=o||{};
  var h='<fieldset><legend>'+(o.id?"Edit order":"New order (company)")+'</legend>'+
  '<div class="r2"><div><label for="wo_co">Company</label><input id="wo_co" list="wo_dl" value="'+e(o.company)+'" placeholder="e.g. Mangal &amp; Mangal"></div>'+
  '<div><label for="wo_ti">Campaign / title (optional)</label><input id="wo_ti" value="'+e(o.title)+'" placeholder="e.g. Diwali 2026 wall ads"></div></div>'+
  '<div class="r3"><div><label for="wo_rt">Company rate ₹ / sq ft</label><input id="wo_rt" type="number" min="0" step="0.01" value="'+e(o.rate==null?13:o.rate)+'"></div>'+
  '<div><label for="wo_tr">Team rate ₹ / sq ft</label><input id="wo_tr" type="number" min="0" step="0.01" value="'+e(o.trate==null?9:o.trate)+'"></div>'+
  '<div><label for="wo_dt">Order date</label><input id="wo_dt" type="date" value="'+e(o.date||today())+'"></div></div>'+
  '<label for="wo_ar">Work area / zone</label><input id="wo_ar" value="'+e(o.area)+'" placeholder="e.g. Trichy, Perambalur districts">'+
  '<label for="wo_nt">Agreement / notes</label><textarea id="wo_nt" placeholder="1 year agreement, terms, contact person at company...">'+e(o.note)+'</textarea>'+
  '<div class="acts"><button class="pri" data-a="osave">'+(o.id?"Update order":"Save order")+'</button>'+(o.id?'<button data-a="ocancel">Cancel</button>':"")+'</div>'+
  dl("wo_dl",uniq(D.orders.map(function(x){return x.company})))+'</fieldset>';
  var L=D.orders.slice().sort(function(a,b){return(b.date||"").localeCompare(a.date||"")});
  h+='<div class="tw"><table class="tb"><thead><tr><th>Company</th><th>Rate</th><th>Team</th><th>Margin</th><th>Sites</th><th>Sq ft (measured)</th><th>Status</th><th></th></tr></thead><tbody>'+
  (L.map(function(x){var S=D.sites.filter(function(s){return s.oid===x.id}),sq=0,dn=0;S.forEach(function(s){sq+=nm(s.sq);if(isDone(s))dn+=nm(s.sq)});
    return'<tr data-oid="'+x.id+'"><td><b>'+e(x.company)+'</b>'+(x.title?"<small>"+e(x.title)+"</small>":"")+"<small>"+fd(x.date)+(x.area?" · "+e(x.area):"")+'</small></td><td>₹'+e(x.rate)+'</td><td>₹'+e(x.trate)+'</td><td><b>₹'+q2(nm(x.rate)-nm(x.trate))+'</b></td><td>'+S.length+'</td><td>'+Q(dn)+" <small>of "+Q(sq)+' total</small></td><td>'+(x.closed?"Closed":"Active")+
    '</td><td><button data-a="osites">Sites</button> <button data-a="oedit">Edit</button> <button data-a="oclose">'+(x.closed?"Reopen":"Close")+'</button> <button data-a="odel">✕</button></td></tr>'}).join("")||'<tr><td colspan="8">No orders yet. Add your first company order above.</td></tr>')+
  '</tbody></table></div>';
  return h}

/* ---------- SITES ---------- */
function curOrder(){var o=byId(D.orders,WP.ord);if(!o){var a=D.orders.filter(function(x){return!x.closed}).sort(function(x,y){return(y.date||"").localeCompare(x.date||"")});o=a[0]||D.orders[0]||null;WP.ord=o?o.id:""}return o}
function tabSites(){
  var o=curOrder();
  if(!o)return'<div class="msg">First add an order in the Orders tab.</div>';
  var s0=WP.es?byId(D.sites,WP.es):null;s0=s0||{};
  var all=D.sites.filter(function(s){return s.oid===o.id}).sort(sortNo);
  var nextNo=all.reduce(function(m,s){return Math.max(m,nm(s.no))},0)+1;
  var h='<fieldset><legend>Order</legend><div class="r2"><div><label for="wsf_o">Company order</label><select id="wsf_o" data-f="ord">'+D.orders.map(function(x){return opt(x.id,ordName(x)+" (₹"+x.rate+" / ₹"+x.trate+")",o.id)}).join("")+'</select></div>'+
  '<div><label>Summary</label><div style="padding:8px 0">'+sitesSummary(all)+'</div></div></div></fieldset>';
  h+='<fieldset><legend>'+(s0.id?"Edit site no. "+e(s0.no):"Add site (supervisor booking)")+'</legend>'+
  '<div class="r3"><div><label for="ws_own">Owner / shop name</label><input id="ws_own" value="'+e(s0.own)+'"></div>'+
  '<div><label for="ws_pl">Village / area</label><input id="ws_pl" list="ws_dlp" value="'+e(s0.pl)+'"></div>'+
  '<div><label for="ws_ph">Phone</label><input id="ws_ph" inputmode="tel" value="'+e(s0.ph)+'"></div></div>'+
  '<div class="r3"><div><label for="ws_w">Width (ft)</label><input id="ws_w" type="number" min="0" step="0.01" value="'+e(s0.w)+'"></div>'+
  '<div><label for="ws_h">Height (ft)</label><input id="ws_h" type="number" min="0" step="0.01" value="'+e(s0.h)+'"></div>'+
  '<div><label for="ws_sq">Sq ft (auto = W×H, or type)</label><input id="ws_sq" type="number" min="0" step="0.01" value="'+e(s0.sq)+'"></div></div>'+
  '<div class="r2"><div><label for="ws_ag">Agreement amount ₹ (to wall owner, 1 year)</label><input id="ws_ag" type="number" min="0" value="'+e(s0.ag)+'"></div>'+
  '<div><label for="ws_nt">Note</label><input id="ws_nt" value="'+e(s0.nt)+'"></div></div>'+
  '<div class="acts"><button class="pri" data-a="ssave">'+(s0.id?"Update site":"Add site no. "+nextNo)+'</button>'+(s0.id?'<button data-a="scancel">Cancel</button>':"")+'</div>'+
  dl("ws_dlp",uniq(D.sites.map(function(s){return s.pl})))+'</fieldset>';
  h+='<details><summary>Paste many sites at once</summary><label for="ws_bulk">One site per line: owner, village, phone, width, height, agreement amount (copy from Excel works too; blanks are OK)</label><textarea id="ws_bulk" rows="5" placeholder="Murugan Stores, Musiri, 9876543210, 10, 6, 3000"></textarea><div class="acts"><button data-a="sbulk">Add these sites</button></div></details>';
  h+='<details><summary>Split sites to teams</summary>'+
  '<p><b>Auto split</b> – unassigned sites are divided equally in order (e.g. 100 sites, 4 teams → 1-25 A, 26-50 B…). Tick the teams:</p><div>'+
  (D.teams.slice().sort(function(a,b){return String(a.name).localeCompare(String(b.name))}).map(function(t){return'<label class="chk"><input type="checkbox" id="wa_t_'+t.id+'"> '+e(tn(t))+"</label>"}).join("")||"<small>Add teams first (Teams tab).</small>")+
  '</div><div class="acts"><button data-a="asplit">Split unassigned sites equally</button></div>'+
  '<p style="margin-top:14px"><b>Assign a range</b> (site numbers)</p><div class="r3"><div><label for="wa_f">From no.</label><input id="wa_f" type="number" min="1"></div><div><label for="wa_e">To no.</label><input id="wa_e" type="number" min="1"></div>'+
  '<div><label for="wa_tm">Team</label><select id="wa_tm"><option value="">— Unassign —</option>'+D.teams.map(function(t){return opt(t.id,tn(t),"")}).join("")+'</select></div></div><div class="acts"><button data-a="arange">Apply to range</button></div></details>';
  h+='<fieldset><legend>Filter</legend><div class="r3"><div><label for="wf_t">Team</label><select id="wf_t" data-f="ft"><option value="">All</option>'+opt("-","Unassigned",WP.ft)+D.teams.map(function(t){return opt(t.id,tn(t),WP.ft)}).join("")+'</select></div>'+
  '<div><label for="wf_s">Status</label><select id="wf_s" data-f="fs"><option value="">All</option>'+STS.map(function(x){return opt(x[0],x[1],WP.fs)}).join("")+'</select></div>'+
  '<div><label for="wf_q">Search (owner / village / no.)</label><input id="wf_q" data-f="fq" value="'+e(WP.fq)+'"></div></div></fieldset>';
  var q=WP.fq.toLowerCase();
  var L=all.filter(function(s){return(!WP.ft||(WP.ft==="-"?!s.team:s.team===WP.ft))&&(!WP.fs||s.st===WP.fs)&&(!q||(String(s.own||"")+" "+(s.pl||"")+" "+s.no).toLowerCase().indexOf(q)>-1)});
  var lim=L.slice(0,WP.lim);
  h+='<div class="acts" style="margin:0 0 6px"><button data-a="scsv">Download CSV</button><button data-a="sprint">Print list</button><small>'+L.length+' site(s) shown</small></div>';
  h+='<div class="tw"><table class="tb"><thead><tr><th>No</th><th>Owner</th><th>Village</th><th>Size</th><th class="r">Sq ft</th><th class="r">Agreement</th><th>Team</th><th>Status</th><th></th></tr></thead><tbody>'+
  (lim.map(function(s){return'<tr data-sid="'+s.id+'"><td>'+e(s.no)+'</td><td>'+e(s.own)+(s.ph?"<small>"+e(s.ph)+"</small>":"")+(s.nt?"<small>"+e(s.nt)+"</small>":"")+'</td><td>'+e(s.pl)+'</td><td>'+(s.w&&s.h?e(s.w)+"×"+e(s.h):"")+'</td><td class="r">'+(s.sq?Q(s.sq):"")+'</td><td class="r">'+(nm(s.ag)?R(s.ag)+'<br><button data-a="sag">'+(s.agp?"✓ Paid "+fd(s.agd):"Mark paid")+"</button>":"")+
    '</td><td><select data-f="steam"><option value="">—</option>'+D.teams.map(function(t){return opt(t.id,tn(t),s.team||"")}).join("")+'</select></td><td><select data-f="sst">'+STS.map(function(x){return opt(x[0],x[1],s.st||"booked")}).join("")+'</select>'+(s.ver?"<small>Verified by "+e(s.ver)+" "+fd(s.verAt)+"</small>":"")+
    '</td><td><button data-a="sedit">Edit</button> <button data-a="sdel">✕</button></td></tr>'}).join("")||'<tr><td colspan="9">No sites yet.</td></tr>')+'</tbody></table></div>';
  if(L.length>lim.length)h+='<div class="acts"><button data-a="smore">Show more ('+(L.length-lim.length)+' left)</button></div>';
  return h}
function sitesSummary(all){var sq=0,dn=0,ag=0,pd=0;all.forEach(function(s){sq+=nm(s.sq);if(isDone(s))dn+=nm(s.sq);ag+=nm(s.ag);if(s.agp)pd+=nm(s.ag)});
  return"<b>"+all.length+"</b> sites · <b>"+Q(sq)+"</b> sq ft ("+Q(dn)+" measured)<br><small>Agreement "+R(ag)+" · paid to wall owners "+R(pd)+" · not paid "+R(ag-pd)+"</small>"}

/* ---------- TEAMS ---------- */
function tabTeams(){
  var t0=WP.et?byId(D.teams,WP.et):null;t0=t0||{};
  var h='<details open><summary>'+(t0.id?"Edit team":"Add team")+'</summary><fieldset><legend>'+(t0.id?"Edit team":"New team")+'</legend><div class="r3"><div><label for="wt_nm">Team name</label><input id="wt_nm" value="'+e(t0.name)+'" placeholder="A"></div><div><label for="wt_ld">Leader</label><input id="wt_ld" value="'+e(t0.leader)+'"></div><div><label for="wt_ph">Phone</label><input id="wt_ph" inputmode="tel" value="'+e(t0.phone)+'"></div></div>'+
  '<div class="acts"><button class="pri" data-a="tsave">'+(t0.id?"Update team":"Save team")+'</button>'+(t0.id?'<button data-a="tcancel">Cancel</button>':"")+'</div></fieldset></details>';
  var TS=D.teams.slice().sort(function(a,b){return String(a.name).localeCompare(String(b.name))});
  if(!TS.length)return h+'<div class="msg">Add your 6 teams first.</div>';
  if(!byId(D.teams,WP.team))WP.team=TS[0].id;
  h+='<div class="tw"><table class="tb"><thead><tr><th>Team</th><th>Sites</th><th class="r">Done sq ft</th><th class="r">Earned</th><th class="r">Deductions</th><th class="r">Paid</th><th class="r">Balance to pay</th></tr></thead><tbody>'+
  TS.map(function(t){var c=teamCalc(t.id);return'<tr data-tid="'+t.id+'" class="'+(t.id===WP.team?"sel":"")+'" style="cursor:pointer"><td><b>'+e(tn(t))+"</b>"+(t.leader?"<small>"+e(t.leader)+"</small>":"")+'</td><td>'+c.sites+'</td><td class="r">'+Q(c.done)+'</td><td class="r">'+R(c.earned)+'</td><td class="r">'+R(c.ded)+'</td><td class="r">'+R(c.pay)+'</td><td class="r"><b>'+R(c.bal)+"</b></td></tr>"}).join("")+'</tbody></table></div><small>Tap a team row to open its ledger.</small>';
  var t=byId(D.teams,WP.team),c=teamCalc(t.id);
  h+='<fieldset><legend>'+e(tn(t))+(t.leader?" · "+e(t.leader):"")+(t.phone?" · "+e(t.phone):"")+'</legend>'+
  '<div class="acts" style="margin:0 0 8px"><button data-a="tedit">Edit team</button><button data-a="tprint">Print statement</button><button data-a="tdel">Delete team</button></div>'+
  '<div class="kp"><div><small>Work done (measured)</small><span class="big">'+Q(c.done)+' sq ft</span></div><div><small>Earned</small><span class="big">'+R(c.earned)+'</span></div><div><small>Deductions (food, advance…)</small><span class="big">'+R(c.ded)+'</span></div><div><small>Net payable</small><span class="big">'+R(c.net)+'</span></div><div><small>Already paid</small><span class="big">'+R(c.pay)+'</span></div><div><small>Balance to pay</small><span class="big '+(c.bal<0?"neg":"pos")+'">'+R(c.bal)+"</span></div></div>"+
  (c.painted?"<small>Painted but not measured yet: "+Q(c.painted)+" sq ft (not counted in earnings)</small><br>":"")+
  (c.notDed?'<small>Not deducted (decide at final account): '+R(c.notDed)+"</small>":"")+
  '<div class="tw"><table class="tb"><thead><tr><th>Order</th><th class="r">Sites</th><th class="r">Measured sq ft</th><th class="r">Team rate</th><th class="r">Earned</th></tr></thead><tbody>'+
  (Object.keys(c.ords).map(function(k){var x=c.ords[k];return"<tr><td>"+e(ordName(byId(D.orders,k)))+'</td><td class="r">'+x.n+'</td><td class="r">'+Q(x.done)+'</td><td class="r">₹'+x.rate+'</td><td class="r">'+R(x.done*x.rate)+"</td></tr>"}).join("")||'<tr><td colspan="5">No sites assigned yet.</td></tr>')+'</tbody></table></div>'+
  '<h4 style="margin:14px 0 4px">Ledger entry</h4><div class="r3"><div><label for="wl_dt">Date</label><input id="wl_dt" type="date" value="'+today()+'"></div><div><label for="wl_ty">Type</label><select id="wl_ty" data-f="lty">'+LTY.map(function(x){return opt(x[0],x[1],"food")}).join("")+'</select></div><div><label for="wl_am">Amount ₹</label><input id="wl_am" type="number" min="0"></div></div>'+
  '<div class="r2"><div><label for="wl_nt">Note</label><input id="wl_nt" placeholder="e.g. brush bought at Murugan store, Tata Ace Salem trip"></div><div><label>&nbsp;</label><label class="chk"><input type="checkbox" id="wl_dd" checked> Deduct from final amount</label></div></div>'+
  '<div class="acts"><button class="pri" data-a="lsave">Add entry</button></div>'+
  '<div class="tw"><table class="tb"><thead><tr><th>Date</th><th>Type</th><th>Note</th><th class="r">Amount</th><th>Deduct</th><th></th></tr></thead><tbody>'+
  (D.ledger.filter(function(l){return l.team===t.id}).sort(function(a,b){return(b.dt||"").localeCompare(a.dt||"")||(b.created||0)-(a.created||0)}).map(function(l){
    var ty=LTY.filter(function(x){return x[0]===l.ty})[0];
    return'<tr data-lid="'+l.id+'"><td>'+fd(l.dt)+'</td><td>'+e(ty?ty[1]:l.ty)+'</td><td>'+e(l.nt)+'</td><td class="r">'+R(l.amt)+'</td><td>'+(l.ty==="pay"?"—":'<button data-a="ldd">'+(l.ded===false?"✗ No":"✓ Yes")+"</button>")+'</td><td><button data-a="ldel">✕</button></td></tr>'}).join("")||'<tr><td colspan="6">No entries yet.</td></tr>')+'</tbody></table></div></fieldset>';
  return h}

/* ---------- STOCK ---------- */
function holderOpts(from,sel){var a=[];if(from)a.push(["SHOP","🏪 Shop / vendor (bought)"]);a.push(["SUP","Supervisor"]);
  D.teams.slice().sort(function(x,y){return String(x.name).localeCompare(String(y.name))}).forEach(function(t){a.push(["T:"+t.id,tn(t)])});if(!from)a.push(["USED","Used / finished"]);
  return a.map(function(x){return opt(x[0],x[1],sel)}).join("")}
function tabStock(){
  var h='<fieldset><legend>Stock movement</legend><div class="r3"><div><label for="ss_dt">Date</label><input id="ss_dt" type="date" value="'+today()+'"></div>'+
  '<div><label for="ss_pr">Product</label><input id="ss_pr" list="ss_dlp" placeholder="Yellow paint, Distemper, Brush..."></div>'+
  '<div><label for="ss_qt">Quantity</label><input id="ss_qt" type="number" min="0" step="0.01"></div></div>'+
  '<div class="r3"><div><label for="ss_un">Unit</label><input id="ss_un" list="ss_dlu" placeholder="Litre, Kg, Tin, Piece..."></div>'+
  '<div><label for="ss_fr">From</label><select id="ss_fr" data-f="sfr">'+holderOpts(true,"SHOP")+'</select></div>'+
  '<div><label for="ss_to">To</label><select id="ss_to">'+holderOpts(false,"SUP")+'</select></div></div>'+
  '<div class="r3"><div><label for="ss_shop">Shop name (if bought)</label><input id="ss_shop" list="ss_dls" placeholder="Murugan Painting Store"></div>'+
  '<div><label for="ss_rc">Received by</label><input id="ss_rc"></div>'+
  '<div><label for="ss_nt">Note / via</label><input id="ss_nt" placeholder="Bus parcel – Salem"></div></div>'+
  '<div class="acts"><button class="pri" data-a="mssave">Add movement</button></div>'+
  dl("ss_dlp",uniq(D.stock.map(function(m){return m.pr})))+dl("ss_dlu",uniq(UNITS.concat(D.stock.map(function(m){return m.un}))))+dl("ss_dls",uniq(D.stock.map(function(m){return m.shop})))+'</fieldset>';
  var B=stockBal(),keys=Object.keys(B.P).sort();
  if(keys.length){
    var rows=["SUP"].concat(D.teams.slice().sort(function(a,b){return String(a.name).localeCompare(String(b.name))}).map(function(t){return"T:"+t.id}));
    if(B.B.USED)rows.push("USED");
    h+='<fieldset><legend>Who has what (balance)</legend><div class="tw"><table class="tb"><thead><tr><th>Holder</th>'+keys.map(function(k){return"<th>"+e(B.P[k].pr)+(B.P[k].un?" ("+e(B.P[k].un)+")":"")+"</th>"}).join("")+"</tr></thead><tbody>"+
    rows.map(function(r){return"<tr><td><b>"+e(holderName(r))+"</b></td>"+keys.map(function(k){var v=q2((B.B[r]||{})[k]||0);return'<td class="'+(v<0?"neg":"")+'">'+(v?Q(v):"–")+"</td>"}).join("")+"</tr>"}).join("")+
    '<tr><td><small>Total bought</small></td>'+keys.map(function(k){return"<td><small>"+(B.T[k]?Q(B.T[k]):"–")+"</small></td>"}).join("")+"</tr></tbody></table></div><small>Red number = more given than the holder received; check the entries.</small></fieldset>"}
  var pf=WP.sf,L=D.stock.slice().filter(function(m){return!pf||String(m.pr||"").trim().toLowerCase()===pf}).sort(function(a,b){return(b.dt||"").localeCompare(a.dt||"")||(b.created||0)-(a.created||0)});
  h+='<div class="r2"><div><label for="sf_p">Filter product</label><select id="sf_p" data-f="sf"><option value="">All products</option>'+uniq(D.stock.map(function(m){return m.pr})).map(function(p){return opt(p.toLowerCase(),p,pf)}).join("")+'</select></div></div>'+
  '<div class="tw"><table class="tb"><thead><tr><th>Date</th><th>Product</th><th class="r">Qty</th><th>From → To</th><th>Received by / note</th><th></th></tr></thead><tbody>'+
  (L.slice(0,300).map(function(m){return'<tr data-mid="'+m.id+'"><td>'+fd(m.dt)+'</td><td>'+e(m.pr)+'</td><td class="r">'+Q(m.qt)+" "+e(m.un)+'</td><td>'+e(holderName(m.fr,m))+" → "+e(holderName(m.to))+'</td><td>'+e(m.rc)+(m.nt?"<small>"+e(m.nt)+"</small>":"")+'</td><td><button data-a="msdel">✕</button></td></tr>'}).join("")||'<tr><td colspan="6">No stock entries yet.</td></tr>')+'</tbody></table></div>';
  return h}

/* ---------- PROFIT ---------- */
function tabProfit(){
  var P=profitCalc(),cs=D.cost.filter(function(c){return!WP.mon||(c.dt||"").slice(0,7)===WP.mon}).sort(function(a,b){return(b.dt||"").localeCompare(a.dt||"")}),cc=0;
  cs.forEach(function(c){cc+=nm(c.amt)});
  var net=P.tot.profit-cc,ag=0,pd=0;D.sites.forEach(function(s){ag+=nm(s.ag);if(s.agp)pd+=nm(s.ag)});
  var h='<fieldset><legend>Period</legend><div class="r2"><div><label for="wp_mon">Month (leave empty for all time)</label><input id="wp_mon" type="month" data-f="mon" value="'+e(WP.mon)+'"></div><div><label>&nbsp;</label><div class="acts" style="margin:0"><button data-a="pprint">Print report</button></div></div></div><small>Counts only measured / verified sites (by the date they were measured).</small></fieldset>'+
  '<div class="kp"><div><small>Billing to companies</small><span class="big">'+R(P.tot.bill)+'</span></div><div><small>Team cost (sq ft × team rate)</small><span class="big">'+R(P.tot.cost)+'</span></div><div><small>Gross profit</small><span class="big pos">'+R(P.tot.profit)+'</span></div><div><small>Supervisor salary &amp; other costs</small><span class="big">'+R(cc)+'</span></div><div><small>Net profit</small><span class="big '+(net<0?"neg":"pos")+'">'+R(net)+"</span></div></div>"+
  '<div class="tw"><table class="tb"><thead><tr><th>Order</th><th class="r">Rate</th><th class="r">Team</th><th class="r">Sq ft</th><th class="r">Verified</th><th class="r">Billing</th><th class="r">Team cost</th><th class="r">Profit</th></tr></thead><tbody>'+
  (P.rows.map(function(r){return"<tr><td>"+e(ordName(r.o))+(r.pn?"<small>Painted, not measured: "+Q(r.pn)+" sq ft</small>":"")+'</td><td class="r">₹'+e(r.o.rate)+'</td><td class="r">₹'+e(r.o.trate)+'</td><td class="r">'+Q(r.sq)+'</td><td class="r">'+Q(r.ver)+'</td><td class="r">'+R(r.bill)+'</td><td class="r">'+R(r.cost)+'</td><td class="r"><b>'+R(r.profit)+"</b></td></tr>"}).join("")||'<tr><td colspan="8">No measured sites in this period.</td></tr>')+'</tbody></table></div>'+
  '<small>Food, advance, brush and Tata Ace money is deducted from the team\'s payment, so it does not reduce your profit here.</small>'+
  '<div class="msg" style="margin-top:10px">Agreement amounts to wall owners: total '+R(ag)+' · paid by you '+R(pd)+' · not yet paid '+R(ag-pd)+' (the company reimburses this; not counted in profit).</div>'+
  '<fieldset><legend>Supervisor salary &amp; other costs</legend><div class="r3"><div><label for="wc_dt">Date</label><input id="wc_dt" type="date" value="'+today()+'"></div><div><label for="wc_ty">Type</label><select id="wc_ty"><option>Supervisor salary</option><option>Other</option></select></div><div><label for="wc_am">Amount ₹</label><input id="wc_am" type="number" min="0"></div></div>'+
  '<label for="wc_nt">Note</label><input id="wc_nt"><div class="acts"><button class="pri" data-a="csave">Add cost</button></div>'+
  '<div class="tw"><table class="tb"><tbody>'+(cs.map(function(c){return'<tr data-cid="'+c.id+'"><td>'+fd(c.dt)+"</td><td>"+e(c.ty)+"</td><td>"+e(c.nt)+'</td><td class="r">'+R(c.amt)+'</td><td><button data-a="cdel">✕</button></td></tr>'}).join("")||'<tr><td colspan="5">No costs in this period.</td></tr>')+'</tbody></table></div></fieldset>';
  return h}

/* ---------- printing / csv ---------- */
function printHtml(title,html){
  var w=window.open("","_blank");if(!w){alert("Popup blocked. Allow popups for this site to print.");return}
  w.document.write('<!doctype html><meta charset="utf-8"><title>'+e(title)+'</title><style>body{font:13px/1.45 "Segoe UI","Nirmala UI",Arial,sans-serif;margin:14mm;color:#222}h1{font-size:18px;margin:0 0 2px}h2{font-size:14px;margin:16px 0 4px}table{width:100%;border-collapse:collapse;margin:6px 0}th,td{border:1px solid #999;padding:5px 7px;text-align:left;vertical-align:top}th{background:#f3e3ec}.r{text-align:right}small{color:#555}@media print{body{margin:8mm}}</style>'+html);
  w.document.close();w.focus();setTimeout(function(){try{w.print()}catch(x){}},400)}
function csvCell(v){v=String(v==null?"":v);return/[",\n]/.test(v)?'"'+v.replace(/"/g,'""')+'"':v}

/* ---------- events ---------- */
function bind(){
  var v=g("v-wp");
  v.addEventListener("click",function(ev){
    var tr,b=ev.target.closest("[data-a]");
    if(!b){var r=ev.target.closest("tr[data-tid]");if(r){WP.team=r.dataset.tid;render(true)}return}
    var a=b.dataset.a;if(a==="tab"){WP.tab=b.dataset.t;WP.eo=WP.es=WP.et="";render(true);return}
    var row=b.closest("tr"),A={
      osave:oSave,ocancel:function(){WP.eo="";render(true)},
      oedit:function(){WP.eo=row.dataset.oid;render(true);window.scrollTo(0,0)},
      osites:function(){WP.ord=row.dataset.oid;WP.tab="sites";render(true)},
      oclose:function(){var o=byId(D.orders,row.dataset.oid);upd("orders",o.id,{closed:!o.closed})},
      odel:function(){var o=byId(D.orders,row.dataset.oid);if(D.sites.some(function(s){return s.oid===o.id})){alert("This order has sites. Delete its sites first, or just Close the order.");return}if(confirm("Delete order "+ordName(o)+"?")){del("orders",o.id);log("WP: deleted order "+ordName(o))}},
      ssave:sSave,scancel:function(){WP.es="";render(true)},sbulk:sBulk,
      sedit:function(){WP.es=row.dataset.sid;render(true);window.scrollTo(0,0)},
      sdel:function(){var s=byId(D.sites,row.dataset.sid);if(confirm("Delete site no. "+s.no+" ("+(s.own||"")+")?"))del("sites",s.id)},
      smore:function(){WP.lim+=200;render()},
      sag:function(){var s=byId(D.sites,row.dataset.sid);upd("sites",s.id,s.agp?{agp:false,agd:""}:{agp:true,agd:today()})},
      asplit:aSplit,arange:aRange,scsv:sCsv,sprint:sPrint,
      tsave:tSave,tcancel:function(){WP.et="";render(true)},tedit:function(){WP.et=WP.team;render(true);window.scrollTo(0,0)},tdel:tDel,tprint:tPrint,
      lsave:lSave,ldd:function(){var l=byId(D.ledger,row.dataset.lid);upd("ledger",l.id,{ded:l.ded===false})},
      ldel:function(){if(confirm("Delete this entry?"))del("ledger",row.dataset.lid)},
      mssave:mSave,msdel:function(){if(confirm("Delete this stock entry?"))del("stock",row.dataset.mid)},
      csave:cSave,cdel:function(){if(confirm("Delete this cost?"))del("cost",row.dataset.cid)},pprint:pPrint};
    if(A[a])A[a](b)});
  v.addEventListener("change",function(ev){
    var t=ev.target,f=t.dataset&&t.dataset.f;if(!f)return;
    var row=t.closest("tr[data-sid]"),s=row?byId(D.sites,row.dataset.sid):null;
    if(f==="ord"){WP.ord=t.value;WP.ft=WP.fs=WP.fq="";WP.lim=150;render(true)}
    else if(f==="ft"||f==="fs"||f==="fq"){WP[f]=t.value;WP.lim=150;render()}
    else if(f==="sf"){WP.sf=t.value;render()}
    else if(f==="mon"){WP.mon=t.value;render()}
    else if(f==="steam"&&s){var o={team:t.value};if(t.value&&(s.st||"booked")==="booked")o.st="assigned";if(!t.value&&s.st==="assigned")o.st="booked";upd("sites",s.id,o)}
    else if(f==="sst"&&s)sStatus(s,t.value);
    else if(f==="lty"){var d=g("wl_dd");if(d){d.checked=t.value!=="paint";d.parentNode.style.display=t.value==="pay"?"none":""}}
    else if(f==="sfr"){var sh=g("ss_shop");if(sh)sh.disabled=t.value!=="SHOP"}});
  v.addEventListener("input",function(ev){var t=ev.target;
    if(t.id==="ws_w"||t.id==="ws_h"){var w=nm(g("ws_w").value),h=nm(g("ws_h").value),sq=g("ws_sq");if(sq&&!sq.dataset.man)sq.value=w&&h?q2(w*h):""}
    else if(t.id==="ws_sq")t.dataset.man=t.value?"1":""});
}
function sStatus(s,st){
  if(isDone({st:st})&&!(nm(s.sq)>0)){alert("Add the wall size (sq ft) first. Use Edit on this site.");render();return}
  var o={st:st};
  if(isDone({st:st})&&!s.mdate)o.mdate=today();
  if(st==="verified"){var n=prompt("Verified by (company person's name)",s.ver||"");if(n===null){render();return}o.ver=n.trim();o.verAt=today()}
  else if(s.st==="verified"){o.ver="";o.verAt=""}
  upd("sites",s.id,o)}
function oSave(){
  var co=val("wo_co");if(!co){alert("Enter the company name");return}
  var o={company:co,title:val("wo_ti"),rate:nm(val("wo_rt")),trate:nm(val("wo_tr")),date:val("wo_dt")||today(),area:val("wo_ar"),note:val("wo_nt")};
  if(!(o.rate>0)||!(o.trate>=0)){alert("Enter the company rate and team rate");return}
  var p=WP.eo?upd("orders",WP.eo,o):add("orders",Object.assign(o,{closed:false}));
  log("WP: "+(WP.eo?"edited":"added")+" order "+co);WP.eo="";p.then(function(){render(true)})}
function sSave(){
  var o=curOrder();if(!o)return;
  var s={own:val("ws_own"),pl:val("ws_pl"),ph:val("ws_ph"),w:nm(val("ws_w"))||"",h:nm(val("ws_h"))||"",sq:nm(val("ws_sq")),ag:nm(val("ws_ag")),nt:val("ws_nt")};
  if(!s.own&&!s.pl){alert("Enter the owner / shop name or village");return}
  if(!s.sq&&s.w&&s.h)s.sq=q2(s.w*s.h);
  var p;
  if(WP.es){p=upd("sites",WP.es,s)}
  else{var no=D.sites.filter(function(x){return x.oid===o.id}).reduce(function(m,x){return Math.max(m,nm(x.no))},0)+1;
    p=add("sites",Object.assign(s,{oid:o.id,no:no,team:"",st:"booked",agp:false,agd:"",mdate:"",ver:"",verAt:""}))}
  WP.es="";p.then(function(){render(true);var f=g("ws_own");if(f)f.focus()})}
function sBulk(){
  var o=curOrder();if(!o)return;var t=val("ws_bulk");if(!t){alert("Paste the lines first");return}
  var no=D.sites.filter(function(x){return x.oid===o.id}).reduce(function(m,x){return Math.max(m,nm(x.no))},0),list=[];
  t.split(/\r?\n/).forEach(function(ln){ln=ln.trim();if(!ln)return;var c=ln.split(/\t|,|\|/).map(function(x){return x.trim()});
    var w=nm(c[3]),h=nm(c[4]);no++;
    list.push({oid:o.id,no:no,own:c[0]||"",pl:c[1]||"",ph:c[2]||"",w:w||"",h:h||"",sq:w&&h?q2(w*h):0,ag:nm(c[5]),nt:"",team:"",st:"booked",agp:false,agd:"",mdate:"",ver:"",verAt:"",by:who(),created:Date.now()})});
  if(!list.length)return;if(!confirm("Add "+list.length+" sites to "+ordName(o)+"?"))return;
  batchAdd("sites",list).then(function(){log("WP: bulk added "+list.length+" sites");render(true)})}
function aSplit(){
  var o=curOrder();if(!o)return;
  var tm=D.teams.filter(function(t){var c=g("wa_t_"+t.id);return c&&c.checked}).sort(function(a,b){return String(a.name).localeCompare(String(b.name))});
  if(!tm.length){alert("Tick at least one team");return}
  var S=D.sites.filter(function(s){return s.oid===o.id&&!s.team}).sort(sortNo);
  if(!S.length){alert("No unassigned sites in this order");return}
  var n=S.length,k=tm.length,base=Math.floor(n/k),ex=n%k,i=0,ops=[],msg=[];
  tm.forEach(function(t,j){var c=base+(j<ex?1:0);if(!c)return;var ch=S.slice(i,i+c);i+=c;
    msg.push(tn(t)+": "+ch[0].no+"–"+ch[ch.length-1].no+" ("+c+")");
    ch.forEach(function(s){ops.push(["sites",s.id,Object.assign({team:t.id},(s.st||"booked")==="booked"?{st:"assigned"}:{})])})});
  if(!confirm("Split "+n+" sites:\n"+msg.join("\n")))return;
  batch(ops).then(function(){log("WP: split sites "+msg.join("; "));render(true)})}
function aRange(){
  var o=curOrder();if(!o)return;var f=nm(val("wa_f")),t=nm(val("wa_e")),tm=val("wa_tm");
  if(!f||!t||t<f){alert("Enter a valid From and To number");return}
  var S=D.sites.filter(function(s){return s.oid===o.id&&nm(s.no)>=f&&nm(s.no)<=t});
  if(!S.length){alert("No sites in that range");return}
  var team=byId(D.teams,tm);if(!confirm((team?"Assign ":"Unassign ")+S.length+" sites ("+f+"–"+t+")"+(team?" to "+tn(team):"")+"?"))return;
  batch(S.map(function(s){var d={team:tm};if(tm&&(s.st||"booked")==="booked")d.st="assigned";if(!tm&&s.st==="assigned")d.st="booked";return["sites",s.id,d]})).then(function(){render(true)})}
function sRows(){var o=curOrder();return o?D.sites.filter(function(s){return s.oid===o.id}).sort(sortNo):[]}
function sCsv(){
  var o=curOrder(),L=sRows(),rows=[["No","Owner","Village","Phone","Width","Height","Sq ft","Agreement","Agreement paid","Team","Status","Verified by"]];
  L.forEach(function(s){var t=byId(D.teams,s.team);rows.push([s.no,s.own,s.pl,s.ph,s.w,s.h,s.sq,s.ag,s.agp?"Yes":"No",t?tn(t):"",stLabel(s.st),s.ver||""])});
  var blob=new Blob(["﻿"+rows.map(function(r){return r.map(csvCell).join(",")}).join("\r\n")],{type:"text/csv;charset=utf-8"}),a=document.createElement("a");
  a.href=URL.createObjectURL(blob);a.download="sites-"+(o?o.company:"order").replace(/[^\w]+/g,"-")+".csv";document.body.appendChild(a);a.click();setTimeout(function(){URL.revokeObjectURL(a.href);a.remove()},500)}
function sPrint(){
  var o=curOrder();if(!o)return;var L=sRows();
  printHtml("Sites – "+ordName(o),"<h1>"+e(ordName(o))+"</h1><small>Sites list · "+fd(today())+"</small><table><tr><th>No</th><th>Owner</th><th>Village</th><th>Phone</th><th>Size</th><th class='r'>Sq ft</th><th>Team</th><th>Status</th></tr>"+
    L.map(function(s){var t=byId(D.teams,s.team);return"<tr><td>"+e(s.no)+"</td><td>"+e(s.own)+"</td><td>"+e(s.pl)+"</td><td>"+e(s.ph)+"</td><td>"+(s.w&&s.h?e(s.w)+"×"+e(s.h):"")+"</td><td class='r'>"+(s.sq?Q(s.sq):"")+"</td><td>"+e(t?tn(t):"")+"</td><td>"+e(stLabel(s.st))+"</td></tr>"}).join("")+"</table>")}
function tSave(){
  var n=val("wt_nm");if(!n){alert("Enter the team name");return}
  var o={name:n,leader:val("wt_ld"),phone:val("wt_ph")};
  var p=WP.et?upd("teams",WP.et,o):add("teams",o).then(function(){});
  WP.et="";Promise.resolve(p).then(function(){render(true)})}
function tDel(){
  var t=byId(D.teams,WP.team);if(!t)return;
  if(D.sites.some(function(s){return s.team===t.id})||D.ledger.some(function(l){return l.team===t.id})){alert("This team has sites or ledger entries, so it cannot be deleted. Unassign the sites and delete the entries first.");return}
  if(confirm("Delete "+tn(t)+"?"))del("teams",t.id)}
function lSave(){
  var t=byId(D.teams,WP.team),am=nm(val("wl_am"));if(!t)return;if(!(am>0)){alert("Enter the amount");return}
  var ty=val("wl_ty"),d=g("wl_dd");
  add("ledger",{team:t.id,dt:val("wl_dt")||today(),ty:ty,amt:am,nt:val("wl_nt"),ded:ty==="pay"?null:!!(d&&d.checked)}).then(function(){log("WP: "+tn(t)+" "+ty+" ₹"+am);render(true)})}
function tPrint(){
  var t=byId(D.teams,WP.team);if(!t)return;var c=teamCalc(t.id);
  var L=D.ledger.filter(function(l){return l.team===t.id}).sort(function(a,b){return(a.dt||"").localeCompare(b.dt||"")});
  printHtml("Statement – "+tn(t),"<h1>Saagee Ads – Team statement</h1><div><b>"+e(tn(t))+"</b>"+(t.leader?" · "+e(t.leader):"")+" · "+fd(today())+"</div>"+
    "<h2>Work done</h2><table><tr><th>Order</th><th class='r'>Measured sq ft</th><th class='r'>Rate</th><th class='r'>Amount</th></tr>"+
    Object.keys(c.ords).map(function(k){var x=c.ords[k];return"<tr><td>"+e(ordName(byId(D.orders,k)))+"</td><td class='r'>"+Q(x.done)+"</td><td class='r'>₹"+x.rate+"</td><td class='r'>"+R(x.done*x.rate)+"</td></tr>"}).join("")+
    "<tr><th colspan='3'>Total earned</th><th class='r'>"+R(c.earned)+"</th></tr></table>"+
    "<h2>Ledger</h2><table><tr><th>Date</th><th>Type</th><th>Note</th><th class='r'>Amount</th><th>Deducted</th></tr>"+
    L.map(function(l){var ty=LTY.filter(function(x){return x[0]===l.ty})[0];return"<tr><td>"+fd(l.dt)+"</td><td>"+e(ty?ty[1]:l.ty)+"</td><td>"+e(l.nt)+"</td><td class='r'>"+R(l.amt)+"</td><td>"+(l.ty==="pay"?"Paid to team":l.ded===false?"No":"Yes")+"</td></tr>"}).join("")+"</table>"+
    "<h2>Account</h2><table><tr><td>Earned</td><td class='r'>"+R(c.earned)+"</td></tr><tr><td>Less deductions</td><td class='r'>"+R(c.ded)+"</td></tr><tr><td>Net payable</td><td class='r'>"+R(c.net)+"</td></tr><tr><td>Less already paid</td><td class='r'>"+R(c.pay)+"</td></tr><tr><th>Balance to pay</th><th class='r'>"+R(c.bal)+"</th></tr></table>")}
function mSave(){
  var pr=val("ss_pr"),qt=nm(val("ss_qt")),fr=val("ss_fr"),to=val("ss_to");
  if(!pr){alert("Enter the product name");return}if(!(qt>0)){alert("Enter the quantity");return}
  if(fr===to){alert("From and To cannot be the same");return}
  add("stock",{dt:val("ss_dt")||today(),pr:pr,qt:qt,un:val("ss_un"),fr:fr,to:to,shop:fr==="SHOP"?val("ss_shop"):"",rc:val("ss_rc"),nt:val("ss_nt")}).then(function(){log("WP: stock "+pr+" "+qt+" "+holderName(fr)+" → "+holderName(to));render(true)})}
function cSave(){
  var am=nm(val("wc_am"));if(!(am>0)){alert("Enter the amount");return}
  add("cost",{dt:val("wc_dt")||today(),ty:val("wc_ty"),amt:am,nt:val("wc_nt")}).then(function(){render(true)})}
function pPrint(){
  var P=profitCalc(),cs=D.cost.filter(function(c){return!WP.mon||(c.dt||"").slice(0,7)===WP.mon}),cc=0;cs.forEach(function(c){cc+=nm(c.amt)});
  printHtml("Profit report","<h1>Saagee Ads – Wall painting profit</h1><div>"+(WP.mon?"Month: "+e(WP.mon):"All time")+" · "+fd(today())+"</div><table><tr><th>Order</th><th class='r'>Rate</th><th class='r'>Team</th><th class='r'>Sq ft</th><th class='r'>Billing</th><th class='r'>Team cost</th><th class='r'>Profit</th></tr>"+
    P.rows.map(function(r){return"<tr><td>"+e(ordName(r.o))+"</td><td class='r'>₹"+e(r.o.rate)+"</td><td class='r'>₹"+e(r.o.trate)+"</td><td class='r'>"+Q(r.sq)+"</td><td class='r'>"+R(r.bill)+"</td><td class='r'>"+R(r.cost)+"</td><td class='r'>"+R(r.profit)+"</td></tr>"}).join("")+
    "<tr><th colspan='3'>Total</th><th class='r'>"+Q(P.tot.sq)+"</th><th class='r'>"+R(P.tot.bill)+"</th><th class='r'>"+R(P.tot.cost)+"</th><th class='r'>"+R(P.tot.profit)+"</th></tr></table>"+
    "<table><tr><td>Gross profit</td><td class='r'>"+R(P.tot.profit)+"</td></tr><tr><td>Supervisor salary &amp; other costs</td><td class='r'>"+R(cc)+"</td></tr><tr><th>Net profit</th><th class='r'>"+R(P.tot.profit-cc)+"</th></tr></table>")}

/* ---------- init ---------- */
function init(){if(!g("nav")||!g("v-home")||typeof go!=="function"){setTimeout(init,100);return}build()}
init();
})();
