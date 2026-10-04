/* Progress uses produced item counts, never subtracts from entered inventory. */
(() => {
  const unit=p=>p.outputQuantity||p.quantity/p.count||1;
  function validDone(p,q){return Number.isSafeInteger(q)&&q>=0&&q<=p.quantity&&q%unit(p)===0;}
  function normalizeSession(s,ids){
    if(!s?.result||!Array.isArray(s.result.plan)||!['inventory','farm'].includes(s.result.tab)||!Number.isFinite(s.result.revenue))return null;
    const integer=n=>Number.isSafeInteger(n)&&n>=0;
    if(!integer(s.result.revenue)||!integer(s.result.baseline)||!integer(s.result.batches)||!Number.isSafeInteger(s.result.gain))return null;
    if(s.result.plan.some(p=>!ids.has(p.id)||!integer(p.count)||p.count===0||!integer(p.quantity)||p.quantity===0||!integer(p.batches)||!integer(unit(p))||unit(p)===0||p.quantity!==p.count*unit(p)||!p.ingredients||Object.values(p.ingredients).some(q=>!integer(q)||q===0)))return null;
    if(!Array.isArray(s.result.leftovers)||s.result.leftovers.some(l=>typeof l.name!=='string'||!integer(l.quantity)||!integer(l.value))||Object.values(s.result.inventory||{}).some(q=>!integer(q))||Object.values(s.result.plants||{}).some(q=>!integer(q)))return null;
    const done={};for(const p of s.result.plan)done[p.id]=validDone(p,Number(s.done?.[p.id]))?Number(s.done[p.id]):0;
    const result={...s.result};try{result.stamp=signature(JSON.parse(result.stamp));}catch{result.stamp='';}return {result,done};
  }
  function signature(input){const canonical=x=>Array.isArray(x)?x.map(canonical):x&&typeof x==='object'?Object.fromEntries(Object.keys(x).sort().map(k=>[k,canonical(x[k])])):x;return JSON.stringify(canonical({...input,owned:[...(input.owned||[])].sort((a,b)=>a-b),settings:{...input.settings,hot:[...(input.settings?.hot||[])].sort()}}));}
  function materialBalance(result,done){
    const stock={...result.inventory};for(const [n,q] of Object.entries(result.plants||{}))stock[n]=(stock[n]||0)+q*(result.harvestYield||3);
    for(const p of result.plan){const repeats=(done[p.id]||0)/unit(p);for(const [n,q] of Object.entries(p.ingredients))stock[n]=(stock[n]||0)-q*repeats;stock[p.name]=(stock[p.name]||0)+(done[p.id]||0);}
    return stock;
  }
  const api={unit,validDone,normalizeSession,signature,materialBalance};globalThis.HarvestProgress=api;if(typeof module!=='undefined')module.exports=api;
})();
