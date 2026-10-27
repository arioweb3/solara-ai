/* SOLARA AI — public-data analytics + educational simulation. No live trading. */
(() => {
  "use strict";
  const $ = (id) => document.getElementById(id);
  const ASSETS = {
    bitcoin:{name:"Bitcoin",symbol:"BTC",icon:"₿",color:"#d7a849"},
    ethereum:{name:"Ethereum",symbol:"ETH",icon:"◆",color:"#7b86bd"},
    solana:{name:"Solana",symbol:"SOL",icon:"◎",color:"#8a9c61"},
    binancecoin:{name:"BNB",symbol:"BNB",icon:"◆",color:"#d9bc4c"},
    ripple:{name:"XRP",symbol:"XRP",icon:"✕",color:"#7c8793"},
    dogecoin:{name:"Dogecoin",symbol:"DOGE",icon:"Ð",color:"#c5ab50"}
  };
  const state = { asset:"bitcoin", days:7, candles:[], chart:null, candleSeries:null, volumeSeries:null, smaSeries:null, currentPrice:null, chartReady:false, aiEndpoint:"", lastAnalysis:null };
  const fmtMoney = (n, digits) => Number.isFinite(n) ? new Intl.NumberFormat("en-US",{style:"currency",currency:"USD",maximumFractionDigits:digits ?? (n<1?5:2),minimumFractionDigits:digits ?? 2}).format(n) : "—";
  const fmtPct = n => Number.isFinite(n) ? `${n>=0?"+":""}${n.toFixed(2)}%` : "—";
  const setText = (id, text) => { const el=$(id); if(el) el.textContent=text; };
  const safeNum = (v, fallback=0) => Number.isFinite(Number(v)) ? Number(v) : fallback;

  // Decorative, lightweight Three.js network; canvas fallback is harmless if CDN is unavailable.
  function initSpace(){
    const canvas=$("space-canvas");
    if(!window.THREE || !canvas) { canvas.style.background="radial-gradient(ellipse at 70% 20%,rgba(218,236,117,.2),transparent 50%)"; return; }
    try {
      const scene=new THREE.Scene();
      const camera=new THREE.PerspectiveCamera(55,innerWidth/innerHeight,.1,100);
      camera.position.z=32;
      const renderer=new THREE.WebGLRenderer({canvas,alpha:true,antialias:true});
      renderer.setPixelRatio(Math.min(devicePixelRatio||1,1.6));
      renderer.setSize(innerWidth,innerHeight);
      const count=95, positions=[], links=[];
      for(let i=0;i<count;i++) positions.push((Math.random()-.5)*54,(Math.random()-.5)*34,(Math.random()-.5)*15);
      for(let i=0;i<count;i++) for(let j=i+1;j<count;j++){
        const dx=positions[i*3]-positions[j*3],dy=positions[i*3+1]-positions[j*3+1],dz=positions[i*3+2]-positions[j*3+2];
        if(dx*dx+dy*dy+dz*dz<42) links.push(i,j);
      }
      const pointsGeo=new THREE.BufferGeometry(); pointsGeo.setAttribute("position",new THREE.Float32BufferAttribute(positions,3));
      const points=new THREE.Points(pointsGeo,new THREE.PointsMaterial({color:0x9da84c,size:.11,transparent:true,opacity:.55}));
      const linePositions=[]; for(const i of links) linePositions.push(...positions.slice(i*3,i*3+3));
      const lineGeo=new THREE.BufferGeometry(); lineGeo.setAttribute("position",new THREE.Float32BufferAttribute(linePositions,3));
      const lines=new THREE.LineSegments(lineGeo,new THREE.LineBasicMaterial({color:0xb8bc73,transparent:true,opacity:.17}));
      scene.add(points,lines);
      let frame=0;
      const animate=()=>{if(document.hidden){requestAnimationFrame(animate);return;} frame+=.0015;points.rotation.y=frame;lines.rotation.y=frame;points.rotation.x=Math.sin(frame*.6)*.04;renderer.render(scene,camera);requestAnimationFrame(animate);};
      animate();
      addEventListener("resize",()=>{camera.aspect=innerWidth/innerHeight;camera.updateProjectionMatrix();renderer.setSize(innerWidth,innerHeight);});
    } catch(e){ console.warn("Three.js background unavailable",e); }
  }

  function initChart(){
    const el=$("chart");
    if(!window.LightweightCharts){el.innerHTML='<div class="chart-loading">Chart library unavailable. Check internet access.</div>';return;}
    state.chart=LightweightCharts.createChart(el,{
      width:el.clientWidth,height:el.clientHeight,
      layout:{background:{type:"solid",color:"#fffef8"},textColor:"#858a77",fontFamily:'"DM Mono", monospace',fontSize:10},
      grid:{vertLines:{color:"#f0f0e4"},horzLines:{color:"#f0f0e4"}},
      rightPriceScale:{borderColor:"#e6e8d8"},timeScale:{borderColor:"#e6e8d8",timeVisible:true,secondsVisible:false},
      crosshair:{vertLine:{color:"#cbd28c",labelBackgroundColor:"#6e7940"},horzLine:{color:"#cbd28c",labelBackgroundColor:"#6e7940"}},
      handleScroll:true,handleScale:true
    });
    state.candleSeries=state.chart.addCandlestickSeries({upColor:"#7da85b",downColor:"#c87566",borderUpColor:"#7da85b",borderDownColor:"#c87566",wickUpColor:"#7da85b",wickDownColor:"#c87566"});
    state.volumeSeries=state.chart.addHistogramSeries({priceFormat:{type:"volume"},priceScaleId:"volume",scaleMargins:{top:.82,bottom:0},lastValueVisible:false,priceLineVisible:false});
    state.smaSeries=state.chart.addLineSeries({color:"#d0aa49",lineWidth:2,priceLineVisible:false,lastValueVisible:false,crosshairMarkerVisible:false});
    state.chart.timeScale().fitContent();
    new ResizeObserver(()=>{if(state.chart)state.chart.applyOptions({width:el.clientWidth,height:el.clientHeight});}).observe(el);
  }

  async function fetchJson(url){
    const r=await fetch(url,{headers:{"accept":"application/json"}});
    if(!r.ok) throw new Error(`Market API returned ${r.status}`);
    return r.json();
  }
  async function loadTicker(){
    try{
      const data=await fetchJson("https://api.coingecko.com/api/v3/simple/price?ids=bitcoin,ethereum,solana&vs_currencies=usd&include_24hr_change=true");
      const map=[["bitcoin","btc"],["ethereum","eth"],["solana","sol"]];
      map.forEach(([id,p])=>{const item=data[id];if(!item)return;setText(`${p}-price`,fmtMoney(item.usd));setText(`${p}-change`,fmtPct(item.usd_24h_change));$( `${p}-change`).className=item.usd_24h_change>=0?"up":"down";});
      setText("data-time",new Date().toLocaleTimeString([],{hour:"2-digit",minute:"2-digit"}));
      setText("connection-label","MARKET DATA ONLINE");
    }catch(e){setText("data-time","Unavailable");setText("connection-label","API LIMITED");console.warn(e);}
  }
  async function loadHistory(){
    const asset=ASSETS[state.asset]; setText("asset-name",asset.name+" ");setText("asset-symbol",asset.symbol);setText("coin-icon",asset.icon);setText("asset-subtitle",`${asset.symbol} / USD · Public market reference`);
    setText("main-price","Loading…");setText("signal-state","Calculating…");
    try{
      const data=await fetchJson(`https://api.coingecko.com/api/v3/coins/${state.asset}/ohlc?vs_currency=usd&days=${state.days}`);
      // CoinGecko OHLC: [timestamp, open, high, low, close]. Volume is not included by this endpoint.
      state.candles=(data||[]).map(r=>({time:Math.floor(r[0]/1000),open:+r[1],high:+r[2],low:+r[3],close:+r[4],volume:null})).filter(c=>c.time&&[c.open,c.high,c.low,c.close].every(Number.isFinite)).sort((a,b)=>a.time-b.time);
      if(!state.candles.length) throw new Error("No OHLC candles returned");
      // OHLC endpoint does not return volume. Try market_chart to get total-volume observations and nearest-time alignment.
      try{
        const volData=await fetchJson(`https://api.coingecko.com/api/v3/coins/${state.asset}/market_chart?vs_currency=usd&days=${state.days}`);
        const volumes=volData.total_volumes||[];
        state.candles.forEach(c=>{let best=null,dist=Infinity;for(const v of volumes){const d=Math.abs(Math.floor(v[0]/1000)-c.time);if(d<dist){dist=d;best=v[1];}}if(best!==null&&dist<Math.max(86400,state.days*3600))c.volume=best;});
      }catch(e){console.info("Volume data unavailable",e);}
      renderChart(); analyze(); renderLevels(); setText("main-price",fmtMoney(state.currentPrice));
      const first=state.candles[0].close,last=state.candles[state.candles.length-1].close,change=(last/first-1)*100;
      setText("main-change",fmtPct(change));$("main-change").className=change>=0?"up":"down";
      setText("data-time",new Date().toLocaleTimeString([],{hour:"2-digit",minute:"2-digit"}));
      setText("connection-label","MARKET DATA ONLINE");
    }catch(e){
      console.error(e);$("chart").innerHTML='<div class="chart-loading">Could not load candles. The public API may be rate-limited; wait a little and retry.</div>';
      setText("signal-state","Data unavailable");setText("signal-summary",e.message||"Unable to load market history.");
      setText("connection-label","API LIMITED");
    }
  }
  function sma(values,period){return values.map((_,i)=>i<period-1?null:values.slice(i-period+1,i+1).reduce((a,b)=>a+b,0)/period);}
  function ema(values,period){const out=Array(values.length).fill(null);if(values.length<period)return out;let seed=values.slice(0,period).reduce((a,b)=>a+b,0)/period;out[period-1]=seed;const k=2/(period+1);for(let i=period;i<values.length;i++){seed=values[i]*k+seed*(1-k);out[i]=seed;}return out;}
  function calcRsi(values,period=14){
    const out=Array(values.length).fill(null);if(values.length<=period)return out;
    let gains=0,losses=0;for(let i=1;i<=period;i++){const d=values[i]-values[i-1];gains+=Math.max(0,d);losses+=Math.max(0,-d);}
    let avgG=gains/period,avgL=losses/period;out[period]=avgL===0?100:100-100/(1+avgG/avgL);
    for(let i=period+1;i<values.length;i++){const d=values[i]-values[i-1];avgG=(avgG*(period-1)+Math.max(0,d))/period;avgL=(avgL*(period-1)+Math.max(0,-d))/period;out[i]=avgL===0?100:100-100/(1+avgG/avgL);}return out;
  }
  function renderChart(){
    if(!state.chart||!state.candleSeries)return;
    $("chart").querySelector(".chart-loading")?.remove();
    state.candleSeries.setData(state.candles.map(c=>({time:c.time,open:c.open,high:c.high,low:c.low,close:c.close})));
    const vols=state.candles.filter(c=>c.volume!==null).map(c=>({time:c.time,value:c.volume,color:c.close>=c.open?"rgba(125,168,91,.35)":"rgba(200,117,102,.35)"}));
    state.volumeSeries.setData(vols);
    const closes=state.candles.map(c=>c.close), av=sma(closes,20);
    state.smaSeries.setData(state.candles.map((c,i)=>av[i]===null?null:{time:c.time,value:av[i]}).filter(Boolean));
    state.chart.timeScale().fitContent();state.chartReady=true;
    const legend=$(".chart-legend");
    if(!vols.length)$(".legend-volume")?.parentElement && ($(".legend-volume").parentElement.style.opacity=".45");
  }
  function analyze(){
    const cs=state.candles;if(cs.length<5)return;
    const closes=cs.map(c=>c.close),last=closes.at(-1),rsiArr=calcRsi(closes),rsi=rsiArr.at(-1),sma20=sma(closes,20).at(-1);
    const e12=ema(closes,12),e26=ema(closes,26),macdLine=closes.map((_,i)=>e12[i]===null||e26[i]===null?null:e12[i]-e26[i]);
    const validMacd=macdLine.filter(Number.isFinite),sig=ema(validMacd,9).at(-1),macd=macdLine.at(-1);
    const returns=[];for(let i=Math.max(1,closes.length-20);i<closes.length;i++)returns.push(closes[i]/closes[i-1]-1);
    const avg=returns.reduce((a,b)=>a+b,0)/(returns.length||1),vol=Math.sqrt(returns.reduce((a,b)=>a+(b-avg)**2,0)/(returns.length||1))*100;
    const bullish=(Number.isFinite(rsi)&&rsi>50)&&(Number.isFinite(sma20)&&last>sma20);
    const bearish=(Number.isFinite(rsi)&&rsi<50)&&(Number.isFinite(sma20)&&last<sma20);
    const signal=bullish?"Positive momentum":bearish?"Negative momentum":"Mixed / neutral";
    state.currentPrice=last;
    setText("signal-state",signal);setText("signal-summary",`Rule-based reading from ${cs.length} OHLC candles. Not a prediction.`);
    setText("rsi-value",Number.isFinite(rsi)?rsi.toFixed(1):"N/A");setText("rsi-tag",Number.isFinite(rsi)?rsi<30?"OVERSOLD":rsi>70?"OVERBOUGHT":"NEUTRAL":"MORE DATA");
    setText("macd-value",Number.isFinite(macd)?macd.toFixed(last<10?5:2):"N/A");setText("macd-tag",Number.isFinite(macd)&&Number.isFinite(sig)?macd>sig?"ABOVE SIGNAL":"BELOW SIGNAL":"MORE DATA");
    setText("sma-value",Number.isFinite(sma20)?fmtMoney(sma20):"N/A");setText("sma-tag",Number.isFinite(sma20)?last>sma20?"PRICE ABOVE":"PRICE BELOW":"MORE DATA");
    setText("vol-value",Number.isFinite(vol)?`${vol.toFixed(2)}%`:"N/A");
    state.lastAnalysis={asset:ASSETS[state.asset],price:last,rsi,sma20,macd,signal,vol};
  }
  function findPivots(){
    const cs=state.candles, pivots=[];
    for(let i=2;i<cs.length-2;i++){
      const c=cs[i], before=cs.slice(i-2,i),after=cs.slice(i+1,i+3);
      if(before.every(x=>c.high>=x.high)&&after.every(x=>c.high>=x.high))pivots.push({price:c.high,type:"Resistance",time:c.time});
      if(before.every(x=>c.low<=x.low)&&after.every(x=>c.low<=x.low))pivots.push({price:c.low,type:"Support",time:c.time});
    }
    return pivots;
  }
  function clusterLevels(pivots,type){
    const sorted=pivots.filter(p=>p.type===type).sort((a,b)=>a.price-b.price),clusters=[];
    for(const p of sorted){
      const found=clusters.find(c=>Math.abs(c.price-p.price)/Math.max(c.price,p.price)<.008);
      if(found){found.price=(found.price*found.count+p.price)/(found.count+1);found.count++;found.time=Math.max(found.time,p.time);}
      else clusters.push({price:p.price,count:1,time:p.time});
    }
    return clusters.filter(c=>c.count>=1).sort((a,b)=>b.count-a.count).slice(0,8);
  }
  function renderLevels(){
    const cs=state.candles;if(!cs.length)return;const current=cs.at(-1).close;
    const pivots=findPivots(),supports=clusterLevels(pivots,"Support").filter(x=>x.price<current).sort((a,b)=>b.price-a.price),resists=clusterLevels(pivots,"Resistance").filter(x=>x.price>current).sort((a,b)=>a.price-b.price);
    setText("support-value",supports[0]?fmtMoney(supports[0].price):"Not found");setText("resistance-value",resists[0]?fmtMoney(resists[0].price):"Not found");setText("level-current",fmtMoney(current));
    const rows=[...supports.slice(0,3).map(x=>({...x,type:"SUPPORT"})),...resists.slice(0,3).map(x=>({...x,type:"RESISTANCE"}))].sort((a,b)=>Math.abs(a.price-current)-Math.abs(b.price-current));
    $("levels-list").innerHTML=rows.length?rows.map(x=>`<div class="level-row"><span>${x.type}<small> · ${x.count} pivot${x.count===1?"":"s"}</small></span><strong>${fmtMoney(x.price)}</strong></div>`).join(""):'<p class="muted">Not enough pivot data for levels.</p>';
  }

  function runBacktest(){
    const cs=state.candles;if(cs.length<35){$("backtest-results").innerHTML='<div class="result-empty">Load more historical candles before running this strategy.</div>';return;}
    const closes=cs.map(c=>c.close),strategy=$("strategy-select").value;
    let balance=Math.max(100,Math.min(10000000,safeNum($("starting-balance").value,10000))),equity=balance,units=0,trades=0,winning=0,entry=0,peak=balance,maxDrawdown=0;
    const fee=Math.max(0,Math.min(2,safeNum($("fee-input").value,.1)))/100,slip=Math.max(0,Math.min(2,safeNum($("slippage-input").value,.05)))/100;
    const fast=sma(closes,10),slow=sma(closes,30),rsi=calcRsi(closes);
    let buyHoldStart=closes[0],buyHoldEnd=closes.at(-1),buyHold=balance*(buyHoldEnd/buyHoldStart-1);
    const closePosition=(price)=>{if(units<=0)return;const exit=price*(1-slip);const proceeds=units*exit;const cost=units*entry;const net=proceeds*(1-fee)-cost;balance+=proceeds*(1-fee);trades++;if(net>0)winning++;units=0;entry=0;};
    const openPosition=(price)=>{if(balance<=0||units>0)return;const spend=balance;const fill=price*(1+slip);units=(spend*(1-fee))/fill;entry=fill;balance=0;trades++;};
    for(let i=30;i<cs.length;i++){
      const price=closes[i];let want=false;
      if(strategy==="sma")want=fast[i]!==null&&slow[i]!==null&&fast[i]>slow[i];
      else if(strategy==="rsi")want=rsi[i]!==null&&rsi[i]<30;
      else want=true;
      if(strategy==="rsi"&&units>0&&rsi[i]!==null&&rsi[i]>70)closePosition(price);
      else if(strategy!=="rsi"&&units>0&&!want)closePosition(price);
      else if(units===0&&want)openPosition(price);
      equity=balance+units*price;peak=Math.max(peak,equity);maxDrawdown=Math.max(maxDrawdown,(peak-equity)/peak*100);
    }
    equity=balance+units*closes.at(-1);
    const ret=(equity/Math.max(1,safeNum($("starting-balance").value,10000))-1)*100;
    const buyRet=(buyHold/Math.max(1,safeNum($("starting-balance").value,10000)))*100;
    $("backtest-results").innerHTML=`<div class="result-grid">
      <div class="result-item"><span>STRATEGY RETURN</span><strong class="${ret>=0?"up":"down"}">${fmtPct(ret)}</strong></div>
      <div class="result-item"><span>ENDING EQUITY</span><strong>${fmtMoney(equity)}</strong></div>
      <div class="result-item"><span>BUY & HOLD RETURN</span><strong class="${buyRet>=0?"up":"down"}">${fmtPct(buyRet)}</strong></div>
      <div class="result-item"><span>MAX DRAWDOWN</span><strong class="down">${maxDrawdown.toFixed(2)}%</strong></div>
      <div class="result-item"><span>ORDER EVENTS</span><strong>${trades}</strong></div>
      <div class="result-item"><span>WINNING EXITS</span><strong>${trades?`${Math.round(winning/Math.max(1,Math.floor(trades/2))*100)}%`:"N/A"}</strong></div>
    </div><p class="result-foot">Simulation used ${cs.length} candles, ${($("fee-input").value||0)}% fee and ${($("slippage-input").value||0)}% slippage assumptions. Historical simulation can overfit; no guarantee of future performance. Buy & hold is a reference return.</p>`;
  }

  // Paper portfolio: local-only educational state; no exchange orders.
  const PAPER_KEY="solara-paper-v1";
  function getPaper(){try{return JSON.parse(localStorage.getItem(PAPER_KEY))||{cash:10000,positions:[],realized:0,history:[]};}catch{return {cash:10000,positions:[],realized:0,history:[]};}}
  function savePaper(p){localStorage.setItem(PAPER_KEY,JSON.stringify(p));}
  function renderPaper(){
    const p=getPaper(),posValue=p.positions.reduce((s,x)=>s+x.qty*(x.asset===state.asset?(state.currentPrice||x.entry):x.mark),0);
    const equity=p.cash+posValue, pnl=equity-10000;
    setText("paper-equity",fmtMoney(equity));setText("paper-pnl",`${pnl>=0?"+":""}${fmtMoney(pnl)} total demo P&L`);
    $("paper-positions").innerHTML=p.positions.length?p.positions.map((x,i)=>{const mark=x.asset===state.asset?(state.currentPrice||x.mark):x.mark;const value=x.qty*mark;return `<div class="position-row"><div><b>${ASSETS[x.asset]?.symbol||x.asset}</b><small>${x.qty.toFixed(6)} units · entry ${fmtMoney(x.entry)}</small></div><strong>${fmtMoney(value)}<small class="${value-x.cost>=0?"up":"down"}">${fmtMoney(value-x.cost)}</small></strong></div>`;}).join(""):'<p class="muted">No open positions.</p>';
  }
  function submitPaper(){
    const p=getPaper(),side=$("paper-side").value,amount=Math.max(1,Math.min(100000,safeNum($("paper-amount").value,250))),price=state.currentPrice;
    if(!Number.isFinite(price)){setText("paper-message","Price unavailable. Load market data first.");return;}
    if(side==="buy"){
      if(amount>p.cash){setText("paper-message","Not enough virtual cash for this demo order.");return;}
      let pos=p.positions.find(x=>x.asset===state.asset);
      const qty=amount/price;
      p.cash-=amount;
      if(pos){pos.qty+=qty;pos.cost+=amount;pos.entry=pos.cost/pos.qty;pos.mark=price;}
      else p.positions.push({asset:state.asset,qty,cost:amount,entry:price,mark:price});
      p.history.push({side,asset:state.asset,amount,price,time:Date.now()});
      setText("paper-message",`Virtual buy recorded: ${qty.toFixed(6)} ${ASSETS[state.asset].symbol}.`);
    }else{
      const pos=p.positions.find(x=>x.asset===state.asset);
      if(!pos){setText("paper-message","No virtual position for this asset to reduce.");return;}
      const qty=Math.min(pos.qty,amount/price),proceeds=qty*price,cost=qty*pos.entry;
      p.cash+=proceeds;p.realized+=proceeds-cost;pos.qty-=qty;pos.cost=Math.max(0,pos.qty*pos.entry);
      if(pos.qty<1e-10)p.positions=p.positions.filter(x=>x!==pos);
      p.history.push({side,asset:state.asset,amount:proceeds,price,time:Date.now()});
      setText("paper-message",`Virtual sell recorded: ${qty.toFixed(6)} ${ASSETS[state.asset].symbol}.`);
    }
    savePaper(p);renderPaper();
  }
  function addChat(text,who){const div=document.createElement("div");div.className=`chat-bubble ${who==="user"?"user-bubble":"assistant-bubble"}`;div.textContent=text;$("chat-log").appendChild(div);$("chat-log").scrollTop=$("chat-log").scrollHeight;}
  function rulesAnswer(question){
    const a=state.lastAnalysis, q=question.toLowerCase();
    if(!a)return "I don't have enough candle data yet. Try again after the chart loads.";
    if(/rsi|relative strength/.test(q))return `RSI (14) is ${Number.isFinite(a.rsi)?a.rsi.toFixed(1):"not available"}. It compares recent average gains and losses. Readings above 70 are often called overbought and below 30 oversold, but these are not automatic buy/sell instructions.`;
    if(/macd/.test(q))return `MACD is ${Number.isFinite(a.macd)?a.macd.toFixed(4):"not available"} for ${a.asset.symbol}. It compares fast and slow exponential moving averages. Crossovers can lag and can whipsaw in sideways markets.`;
    if(/support|resistance|level/.test(q))return `SOLARA estimates support/resistance from local swing highs/lows, then groups nearby prices. These levels are historical reference zones, not guarantees. Current reference price: ${fmtMoney(a.price)}.`;
    if(/backtest|strategy|win rate|drawdown/.test(q))return "The strategy lab simulates simple rules on available candles with configurable fee and slippage. Always compare against buy-and-hold, inspect drawdown and trade count, and remember that a backtest can overfit.";
    if(/risk|safe|buy|sell|invest|prediction|price/.test(q))return `I can't tell you whether to buy or sell or predict a price. Current rule-based snapshot for ${a.asset.name}: ${a.signal}; RSI ${Number.isFinite(a.rsi)?a.rsi.toFixed(1):"N/A"}, estimated volatility ${Number.isFinite(a.vol)?a.vol.toFixed(2)+"%":"N/A"}. Consider uncertainty and avoid risking money you can't afford to lose.`;
    return `For ${a.asset.name}, the current rule-based reading is "${a.signal}". RSI: ${Number.isFinite(a.rsi)?a.rsi.toFixed(1):"N/A"}; price: ${fmtMoney(a.price)}. Ask about RSI, MACD, support/resistance, or backtesting for a more specific explanation.`;
  }
  async function askAssistant(question){
    addChat(question,"user");
    const endpoint=window.SOLARA_AI_ENDPOINT||"";
    if(endpoint){
      try{
        setText("ai-mode-label","PRIVATE AI ENDPOINT · CONNECTED");$("ai-dot").style.background="#4e8a55";
        const response=await fetch(endpoint,{method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify({message:question,context:state.lastAnalysis})});
        if(!response.ok)throw new Error("AI endpoint error");
        const data=await response.json();addChat(String(data.reply||"No response from model."),"assistant");return;
      }catch(e){console.warn(e);addChat("The AI endpoint could not be reached. I'll use the local rules assistant instead.","assistant");}
    }
    addChat(rulesAnswer(question),"assistant");
  }

  $("asset-select").addEventListener("change",e=>{state.asset=e.target.value;loadHistory().then(renderPaper);});
  $("range-select").addEventListener("change",e=>{state.days=Number(e.target.value);loadHistory().then(renderPaper);});
  $("run-backtest").addEventListener("click",runBacktest);
  $("paper-submit").addEventListener("click",submitPaper);
  $("reset-paper").addEventListener("click",()=>{if(confirm("Reset the local virtual portfolio to $10,000?")){localStorage.removeItem(PAPER_KEY);setText("paper-message","Demo portfolio reset.");renderPaper();}});
  $("chat-form").addEventListener("submit",e=>{e.preventDefault();const input=$("chat-input"),q=input.value.trim();if(!q)return;input.value="";askAssistant(q);});
  initSpace();initChart();loadTicker();loadHistory().then(renderPaper);renderPaper();
  setInterval(loadTicker,120000);
})();