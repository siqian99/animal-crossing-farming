/* Research solver, original implementation. Every returned plan is replayed.
   Runs in a Worker; elapsed limits and proof status are exposed to the UI. */
(() => {
  'use strict';
  const EPS=1e-7;
  let solver=null;
  const CROPS=['sugarcane','tomato','potato','wheat','carrot','orange pumpkin'];
  const PROCESSED=['flour','whole-wheat flour','sugar','brown sugar','tomato puree'];
  function lp(A,b,c,deadline=Infinity){
    const m=b.length,n=c.length,w=n+2,D=Array.from({length:m+2},()=>new Float64Array(w));
    const B=Array.from({length:m},(_,i)=>n+i),N=Array.from({length:n},(_,i)=>i);N.push(-1);
    for(let i=0;i<m;i++){D[i].set(A[i]);D[i][n]=-1;D[i][n+1]=b[i];}
    for(let j=0;j<n;j++)D[m][j]=-c[j];D[m+1][n]=1;
    function pivot(r,s){const p=D[r][s],row=D[r].slice(),col=D.map(a=>a[s]);
      for(let i=0;i<m+2;i++)if(i!==r){const factor=col[i]/p;if(Math.abs(factor)>1e-15)for(let j=0;j<w;j++)if(j!==s)D[i][j]-=row[j]*factor;D[i][s]=-col[i]/p;}
      for(let j=0;j<w;j++)D[r][j]=row[j]/p;D[r][s]=1/p;[B[r],N[s]]=[N[s],B[r]];
    }
    function simplex(phase){let obj=phase===1?m+1:m;
      for(let iteration=0;iteration<12000;iteration++){
        if((iteration&63)===0&&Date.now()>deadline)throw new Error('TIME_LIMIT');
        let s=-1;for(let j=0;j<=n;j++){if(phase===2&&N[j]===-1)continue;if(s<0||D[obj][j]<D[obj][s]-EPS||(Math.abs(D[obj][j]-D[obj][s])<EPS&&N[j]<N[s]))s=j;}
        if(s<0||D[obj][s]>=-EPS)return true;
        let r=-1;for(let i=0;i<m;i++)if(D[i][s]>EPS){if(r<0||D[i][n+1]/D[i][s]<D[r][n+1]/D[r][s]-EPS||(Math.abs(D[i][n+1]/D[i][s]-D[r][n+1]/D[r][s])<EPS&&B[i]<B[r]))r=i;}
        if(r<0)return false;pivot(r,s);
      }throw new Error('ITERATION_LIMIT');
    }
    let r=0;for(let i=1;i<m;i++)if(b[i]<b[r])r=i;
    if(m&&b[r]<-EPS){pivot(r,n);if(!simplex(1)||Math.abs(D[m+1][n+1])>EPS)return null;
      r=B.indexOf(-1);if(r>=0){let s=0;for(let j=1;j<=n;j++)if(Math.abs(D[r][j])>Math.abs(D[r][s]))s=j;if(Math.abs(D[r][s])>EPS)pivot(r,s);}
    }
    if(!simplex(2))throw new Error('UNBOUNDED');
    const x=new Float64Array(n);for(let i=0;i<m;i++)if(B[i]>=0&&B[i]<n)x[B[i]]=D[i][n+1];
    return {x,value:dot(c,x)};
  }
  const dot=(a,b)=>a.reduce((v,q,i)=>v+q*b[i],0);
  const feasible=(A,b,x)=>x.every(v=>v>=-EPS)&&A.every((row,i)=>dot(row,x)<=b[i]+1e-5);
  function matureMax(A,b,c,{milliseconds=12000,seed}={}){
    const start=Date.now();
    const expression=row=>Array.from(row).map((v,i)=>Math.abs(v)>1e-12?`${v<0?'-':'+'} ${Math.abs(v)} x${i}`:'').filter(Boolean).join(' ').replace(/^\+ /,'')||'0 x0';
    const source=['Maximize',' obj: '+expression(c),'Subject To',...A.map((row,i)=>` r${i}: ${expression(row)} <= ${b[i]}`),'Bounds',...Array.from(c,(_,i)=>` 0 <= x${i}`),'Generals',Array.from(c,(_,i)=>`x${i}`).join(' '),'End'].join('\n');
    const result=solver.solve(source,{output_flag:false,time_limit:milliseconds/1000,mip_rel_gap:0,mip_abs_gap:0});
    let x=Array.from(c,(_,i)=>Math.round(result.Columns?.['x'+i]?.Primal??NaN));
    if(!x.every(Number.isFinite)||!feasible(A,b,x)){if(seed&&feasible(A,b,seed))x=Array.from(seed);else throw new Error('NO_FEASIBLE_PLAN');}
    else if(seed&&feasible(A,b,seed)&&dot(c,seed)>dot(c,x)+EPS)x=Array.from(seed);
    const value=dot(c,x),optimal=result.Status==='Optimal';
    return {x,value,provenOptimal:optimal,nodes:0,seconds:(Date.now()-start)/1000,upperBound:optimal?value:Infinity};
  }
  function integerMax(A,b,c,{milliseconds=12000,seed,progress,heuristic}={}){
    if(solver)return matureMax(A,b,c,{milliseconds,seed});
    const start=Date.now(),deadline=start+milliseconds;
    let best=seed&&feasible(A,b,seed)?dot(c,seed):-Infinity,bestx=Number.isFinite(best)?Array.from(seed):null,nodes=0,nextProgress=start+900;
    const stack=[{bounds:[],upper:Infinity}];let timedOut=false,limitUpper=best;
    while(stack.length){
      if(Date.now()>deadline){timedOut=true;break;}
      const node=stack.pop();if(node.upper<best+0.5)continue;
      const aa=A.slice(),bb=b.slice();for(const [i,sign,v]of node.bounds){const row=new Float64Array(c.length);row[i]=sign;aa.push(row);bb.push(v);}
      let solution;try{solution=lp(aa,bb,c,deadline);}catch(e){if(e.message==='TIME_LIMIT'||e.message==='ITERATION_LIMIT'){timedOut=true;limitUpper=Math.max(limitUpper,node.upper);break;}throw e;}
      nodes++;if(!solution)continue;const {x,value:upper}=solution;if(upper<best+0.5)continue;
      const rounded=Array.from(x,Math.round);let fraction=0,branch=-1;
      for(let j=0;j<x.length;j++){const f=Math.abs(x[j]-rounded[j]);if(f>fraction){fraction=f;branch=j;}}
      if(fraction<1e-5){if(!feasible(A,b,rounded))throw new Error('INVALID_INTEGER');if(dot(c,rounded)>best){best=dot(c,rounded);bestx=rounded;}continue;}
      const floors=Array.from(x,v=>Math.max(0,Math.floor(v+EPS)));
      const candidate=heuristic?heuristic(floors):floors;
      if(candidate&&feasible(A,b,candidate)&&dot(c,candidate)>best){best=dot(c,candidate);bestx=Array.from(candidate);}
      const lo=Math.floor(x[branch]),hi=lo+1;
      stack.push({bounds:node.bounds.concat([[branch,-1,-hi]]),upper});
      stack.push({bounds:node.bounds.concat([[branch,1,lo]]),upper});
      if(Date.now()>nextProgress){progress?.({nodes,best,seconds:(Date.now()-start)/1000});nextProgress=Date.now()+900;}
    }
    return {x:bestx,value:best,provenOptimal:!timedOut&&!stack.length,nodes,seconds:(Date.now()-start)/1000,upperBound:Math.max(best,limitUpper,...stack.map(s=>s.upper))};
  }
  function priceOf(name,data,settings){
    const recipe=data.recipes.find(r=>r.name===name),item=data.items.find(i=>i.name===name);
    let price=recipe?.sellPrice??item?.sellPrice??0;
    if(['apple','cherry','orange','peach','pear'].includes(name))price=name===settings.native?100:500;
    if(name==='turnips')price=settings.turnipPrice||0;
    let shop=settings.channel==='box'?(name==='turnips'?0:Math.floor(price*.8)):price*((settings.hot||[]).includes(name)?2:1);
    if(settings.cj&&item?.category==='Fish')shop=Math.max(shop,Math.floor(price*1.5));
    return shop;
  }
  function build(data,input){
    const inv={...input.inventory},land=input.land,settings=input.settings;
    const owned=new Set(input.owned),all=data.recipes.filter(r=>owned.has(r.id));
    const reachable=new Set(Object.keys(inv).filter(i=>inv[i]>0));if(land!==undefined)CROPS.forEach(i=>reachable.add(i));
    let changed=true;while(changed){changed=false;for(const r of all)if(!reachable.has(r.name)&&Object.keys(r.ingredients).every(i=>reachable.has(i))){reachable.add(r.name);changed=true;}}
    const viable=all.filter(r=>Object.keys(r.ingredients).every(i=>reachable.has(i)));
    const consumed=new Set(viable.flatMap(r=>Object.keys(r.ingredients))),inter=new Set(viable.filter(r=>consumed.has(r.name)).map(r=>r.name));
    const groups=new Map();for(const r of viable){const key=JSON.stringify([Object.entries(r.ingredients).sort(),r.outputQuantity,inter.has(r.name)?r.name:'dish']);if(!groups.has(key)||priceOf(r.name,data,settings)>priceOf(groups.get(key).name,data,settings))groups.set(key,r);}
    const recipes=Array.from(groups.values()),names=Array.from(new Set([...Object.keys(inv),...recipes.flatMap(r=>Object.keys(r.ingredients)),...inter,...(land!==undefined?CROPS:[])]));
    const nr=recipes.length,n=nr+(land!==undefined?6:0),m=names.length+(land!==undefined?1+6:0);
    const A=Array.from({length:m},()=>new Float64Array(n)),b=names.map(i=>inv[i]||0),c=new Float64Array(n),prices=names.map(i=>priceOf(i,data,settings));
    for(let j=0;j<nr;j++){const r=recipes[j];for(const [item,q]of Object.entries(r.ingredients))A[names.indexOf(item)][j]+=q;if(inter.has(r.name))A[names.indexOf(r.name)][j]-=r.outputQuantity;
      c[j]=-prices.reduce((sum,p,i)=>sum+p*A[i][j],0)+(inter.has(r.name)?0:priceOf(r.name,data,settings)*r.outputQuantity);
    }
    if(land!==undefined){b.push(land,...CROPS.map(i=>-(input.minimum?.[i]||0)));for(let k=0;k<6;k++){A[names.indexOf(CROPS[k])][nr+k]=-input.yield;c[nr+k]=priceOf(CROPS[k],data,settings)*input.yield;A[names.length][nr+k]=1;A[names.length+1+k][nr+k]=-1;}}
    const baseline=names.reduce((s,name,i)=>s+(inv[name]||0)*prices[i],0);
    return {A,b,c,recipes,names,inter,prices,baseline,inv,nr,land,input,data};
  }
  function ordered(model){const out=[],pending=model.recipes.slice().sort((a,b)=>Number(PROCESSED.includes(b.name)||model.inter.has(b.name))-Number(PROCESSED.includes(a.name)||model.inter.has(a.name))),emitted=new Set();
    while(pending.length){const at=pending.findIndex(r=>Object.keys(r.ingredients).every(i=>!model.inter.has(i)||emitted.has(i)||!model.recipes.some(p=>p.name===i)));if(at<0)throw new Error('RECIPE_CYCLE');const [r]=pending.splice(at,1);out.push(model.recipes.indexOf(r));emitted.add(r.name);}return out;
  }
  function repair(model,x){const stock={...model.inv},v=Array.from(x);if(model.land!==undefined)for(let k=0;k<6;k++)stock[CROPS[k]]=(stock[CROPS[k]]||0)+v[model.nr+k]*model.input.yield;
    for(const j of ordered(model)){const r=model.recipes[j];let q=v[j];for(const [i,count]of Object.entries(r.ingredients))q=Math.min(q,Math.floor((stock[i]||0)/count));v[j]=Math.max(0,q);for(const [i,count]of Object.entries(r.ingredients))stock[i]-=count*v[j];if(model.inter.has(r.name))stock[r.name]=(stock[r.name]||0)+r.outputQuantity*v[j];}return v;
  }
  function seedModel(model){let seed=Array(model.c.length).fill(0);
    if(model.land!==undefined){let remain=model.land;for(let k=0;k<6;k++){seed[model.nr+k]=model.input.minimum?.[CROPS[k]]||0;remain-=seed[model.nr+k];}if(remain<0)throw new Error('MINIMUM_EXCEEDS_LAND');seed[model.nr+CROPS.indexOf('wheat')]+=remain;}
    const stock={...model.inv};if(model.land!==undefined)for(let k=0;k<6;k++)stock[CROPS[k]]=(stock[CROPS[k]]||0)+seed[model.nr+k]*model.input.yield;
    const ids=ordered(model),score=j=>model.c[j]/Math.max(1,Object.values(model.recipes[j].ingredients).reduce((a,b)=>a+b,0));
    for(let iteration=0;iteration<model.nr*3;iteration++){
      const choices=ids.filter(j=>model.c[j]>EPS&&Object.entries(model.recipes[j].ingredients).every(([i,q])=>(stock[i]||0)>=q)).sort((a,b)=>score(b)-score(a));if(!choices.length)break;
      const j=choices[0],r=model.recipes[j],q=Math.min(...Object.entries(r.ingredients).map(([i,v])=>Math.floor((stock[i]||0)/v)));seed[j]+=q;for(const [i,v]of Object.entries(r.ingredients))stock[i]-=q*v;if(model.inter.has(r.name))stock[r.name]=(stock[r.name]||0)+r.outputQuantity*q;
    }return seed;
  }
  function describe(model,result){
    if(!result.x)throw new Error('NO_FEASIBLE_PLAN');const x=result.x.map(Math.round),stock={...model.inv},plants={};
    if(model.land!==undefined)for(let k=0;k<6;k++){plants[CROPS[k]]=x[model.nr+k];stock[CROPS[k]]=(stock[CROPS[k]]||0)+plants[CROPS[k]]*model.input.yield;}
    const plan=[];let sold=0;
    const consumed={};model.recipes.forEach((r,j)=>{for(const [name,q] of Object.entries(r.ingredients))consumed[name]=(consumed[name]||0)+q*x[j];});
    for(const j of ordered(model)){const count=x[j];if(!count)continue;const r=model.recipes[j];for(const [i,q]of Object.entries(r.ingredients)){stock[i]=(stock[i]||0)-q*count;if(stock[i]<0)throw new Error('NEGATIVE_MATERIAL');}
      if(model.inter.has(r.name))stock[r.name]=(stock[r.name]||0)+count*r.outputQuantity;else sold+=count*r.outputQuantity*priceOf(r.name,model.data,model.input.settings);
      const quantity=count*r.outputQuantity,usedQuantity=Math.min(quantity,Math.max(0,(consumed[r.name]||0)-(model.inv[r.name]||0)));
      plan.push({id:r.id,name:r.name,zh:r.zh,count,quantity,outputQuantity:r.outputQuantity,batches:Math.ceil(count/10),ingredients:r.ingredients,processed:PROCESSED.includes(r.name)||model.inter.has(r.name),intermediate:usedQuantity>0,usedQuantity,directQuantity:quantity-usedQuantity,stockTracked:model.inter.has(r.name),unitPrice:priceOf(r.name,model.data,model.input.settings)});
    }
    const leftovers=Object.entries(stock).filter(([,q])=>q>0).map(([name,quantity])=>({name,quantity,value:quantity*priceOf(name,model.data,model.input.settings)}));
    const revenue=sold+leftovers.reduce((s,l)=>s+l.value,0);
    const expected=Math.round(model.baseline+dot(model.c,x));if(revenue!==expected)throw new Error('REVENUE_MISMATCH');
    return {plan,leftovers,plants,revenue,baseline:model.baseline,gain:revenue-model.baseline,batches:plan.reduce((s,p)=>s+p.batches,0),provenOptimal:result.provenOptimal,seconds:result.seconds,nodes:result.nodes,upperBound:Number.isFinite(result.upperBound)?Math.floor(model.baseline+result.upperBound+EPS):null,recipeCount:model.recipes.length};
  }
  function solve(data,input,progress){
    const model=build(data,input);
    if(!model.c.length)return {plan:[],leftovers:Object.entries(model.inv).filter(([,q])=>q>0).map(([name,quantity])=>({name,quantity,value:quantity*priceOf(name,data,input.settings)})),plants:{},revenue:model.baseline,baseline:model.baseline,gain:0,batches:0,provenOptimal:true,recipeCount:0};
    const seed=seedModel(model);const maximum=integerMax(model.A,model.b,model.c,{milliseconds:12000,seed,heuristic:x=>repair(model,x),progress});
    const first=describe(model,maximum);if(input.mode!=='easy'||!first.plan.length)return first;
    const n=model.c.length,nr=model.nr,N=n+nr,A=model.A.map(row=>Float64Array.from([...row,...Array(nr).fill(0)])),b=model.b.slice(),c=new Float64Array(N);
    for(let j=0;j<nr;j++){let row=new Float64Array(N);row[j]=1;row[n+j]=-10;A.push(row);b.push(0);row=Float64Array.from(row,v=>-v);A.push(row);b.push(9);c[n+j]=-1;}
    const target=Math.ceil(first.revenue*(input.settings.retention||.9));A.push(Float64Array.from([...model.c,...Array(nr).fill(0)],v=>-v));b.push(-(target-model.baseline));
    const quick=maximum.x.concat(maximum.x.slice(0,nr).map(x=>Math.ceil(x/10)));
    const efficient=integerMax(A,b,c,{milliseconds:6000,seed:quick,progress});
    // Among equally small batch counts, retain as much revenue as possible.
    const batchRow=new Float64Array(N);for(let j=0;j<nr;j++)batchRow[n+j]=1;
    A.push(batchRow);b.push(Math.round(-efficient.value));
    const tieObjective=Float64Array.from([...model.c,...Array(nr).fill(0)]);
    const bestRevenue=integerMax(A,b,tieObjective,{milliseconds:6000,seed:efficient.x,progress});
    const described=describe(model,{...bestRevenue,x:bestRevenue.x.slice(0,n)});
    return {...described,maximumRevenue:first.revenue,revenueOptimal:first.provenOptimal,minimumTarget:target,savedBatches:first.batches-described.batches,provenOptimal:efficient.provenOptimal&&bestRevenue.provenOptimal&&first.provenOptimal,upperBound:first.upperBound};
  }
  globalThis.HarvestOptimizer={lp,integerMax,build,solve,priceOf,CROPS,setSolver:instance=>{solver=instance;}};
  if(typeof module!=='undefined')module.exports=globalThis.HarvestOptimizer;
})();
