const assert=require('node:assert/strict');
require('./dist/data.js');const O=require('./dist/optimizer.js'),data=globalThis.HARVEST_DATA;
(async()=>{
O.setSolver(await require('./dist/vendor/highs.js')());
let rng=1592;const rand=n=>{rng=(rng*1664525+1013904223)>>>0;return rng%n;};
for(let k=0;k<40;k++){const A=[[1+rand(4),1+rand(4)],[1+rand(4),1+rand(4)]],b=[3+rand(15),3+rand(15)],c=[1+rand(7),1+rand(7)];let expected=0;for(let x=0;x<20;x++)for(let y=0;y<20;y++)if(A.every((r,i)=>r[0]*x+r[1]*y<=b[i]))expected=Math.max(expected,c[0]*x+c[1]*y);const result=O.integerMax(A,b,c,{seed:[0,0]});assert.equal(result.value,expected);assert.equal(result.provenOptimal,true);}
const settings={channel:'shop',native:'orange',hot:[],cj:false,turnipPrice:100,retention:.9};
const inventory={sugarcane:23,tomato:20,potato:15,wheat:20,carrot:5,'orange pumpkin':19},owned=data.recipes.map(r=>r.id);
let r=O.solve(data,{inventory,owned,settings,mode:'profit'});assert.equal(r.revenue,57380);assert.equal(r.baseline,35700);assert.equal(r.provenOptimal,true);console.log('stock',r.revenue,r.provenOptimal,r.nodes,r.seconds);
r=O.solve(data,{inventory:{},owned,settings,mode:'profit',land:60,yield:3,minimum:{}});assert.equal(r.revenue,114000);assert.equal(r.provenOptimal,true);console.log('farm',r.revenue,r.provenOptimal);
r=O.solve(data,{inventory,owned:[],settings,mode:'profit'});assert.equal(r.revenue,35700);assert.equal(r.batches,0);
const flour=data.recipes.find(r=>r.name==='flour'),bread=data.recipes.find(r=>r.name==='bread');
r=O.solve(data,{inventory:{wheat:5},owned:[flour.id],settings,mode:'profit'});assert.equal(r.revenue,2100);
r=O.solve(data,{inventory:{wheat:4},owned:[flour.id],settings,mode:'profit'});assert.equal(r.revenue,1400);
r=O.solve(data,{inventory:{flour:3},owned:[bread.id],settings,mode:'profit'});assert.equal(r.revenue,950);assert.equal(r.baseline,630);
const carpaccio=data.recipes.find(r=>r.name==='carpaccio di marlin blu');
r=O.solve(data,{inventory:{'blue marlin':1},owned:[carpaccio.id],settings:{...settings,cj:true},mode:'profit'});assert.equal(r.revenue,15000);assert.equal(r.plan.length,0);
r=O.solve(data,{inventory:{'blue marlin':1},owned:[carpaccio.id],settings:{...settings,cj:true,hot:[carpaccio.name]},mode:'profit'});assert.equal(r.revenue,24000);
assert.equal(O.priceOf('flour',data,{...settings,channel:'box',hot:['flour']}),168);
assert.equal(O.priceOf('seaweed',data,{...settings,cj:true}),600);
r=O.solve(data,{inventory:{},owned:[],settings,mode:'profit',land:7,yield:2,minimum:{tomato:3,potato:2}});assert.equal(r.revenue,4900);assert.ok(r.plants.tomato>=3&&r.plants.potato>=2);
assert.throws(()=>O.solve(data,{inventory:{},owned,settings,mode:'profit',land:2,yield:3,minimum:{tomato:3}}));
r=O.solve(data,{inventory:{flour:3},owned:[bread.id],settings,mode:'easy'});assert.equal(r.revenue,950);assert.equal(r.batches,1);
const sugar=data.recipes.find(r=>r.name==='sugar'),cupcake=data.recipes.find(r=>r.name==='plain cupcakes');
r=O.solve(data,{inventory:{sugarcane:10,flour:1},owned:[sugar.id,cupcake.id],settings,mode:'profit'});
assert.equal(r.revenue,4620);const sugarStep=r.plan.find(p=>p.name==='sugar');assert.equal(sugarStep.usedQuantity,1);assert.equal(sugarStep.directQuantity,19);assert.equal(sugarStep.intermediate,true);assert.equal(r.leftovers.find(l=>l.name==='sugar').quantity,19);assert.equal(r.plan[0].name,'sugar');
const puree=data.recipes.find(r=>r.name==='tomato puree'),pasta=data.recipes.find(r=>r.name==='spaghetti marinara');
r=O.solve(data,{inventory:{tomato:3,flour:1},owned:[puree.id,pasta.id],settings,mode:'profit'});const pureeStep=r.plan.find(p=>p.name==='tomato puree');assert.equal(pureeStep.intermediate,false);assert.equal(pureeStep.usedQuantity,0);assert.equal(pureeStep.directQuantity,1);assert.equal(r.leftovers.find(l=>l.name==='tomato puree').quantity,1);
r=O.solve(data,{inventory:{sugarcane:5},owned:[sugar.id],settings,mode:'profit'});assert.equal(r.plan[0].intermediate,false);assert.equal(r.plan[0].directQuantity,10);assert.equal(r.plan[0].stockTracked,false);assert.equal(r.revenue,2100);
for(const retention of [.5,.75,.92,.99,1]){r=O.solve(data,{inventory,owned,settings:{...settings,retention},mode:'easy'});assert.ok(r.revenue>=Math.ceil(57380*retention));assert.equal(r.provenOptimal,true);}
const P=require('./dist/progress.js');const result={...r,tab:'inventory',inventory};const ids=new Set(owned),session=P.normalizeSession({result,done:{[r.plan[0].id]:r.plan[0].quantity}},ids);assert.ok(session);assert.equal(session.done[r.plan[0].id],r.plan[0].quantity);
assert.equal(P.validDone(sugarStep,10),true);assert.equal(P.validDone(sugarStep,3),false);assert.equal(P.validDone(sugarStep,30),false);
assert.equal(P.normalizeSession({result:{...result,plan:[{...result.plan[0],outputQuantity:'10\" autofocus'}]}},ids),null);
assert.equal(P.signature({inventory:{wheat:2,tomato:1},owned:[2,1],settings:{hot:['b','a']}}),P.signature({inventory:{tomato:1,wheat:2},owned:[1,2],settings:{hot:['a','b']}}));
assert.equal(P.signature({inventory:{},owned:[],settings:{channel:'shop',cj:false,hot:[]}}),P.signature({settings:{hot:[],cj:false,channel:'shop'},owned:[],inventory:{}}));
console.log('Passed unused sugar/puree accounting, processing order, retention options and saved progress validation.');
console.log('Passed 40 brute-force comparisons and 12 material, pricing, ownership and land cases.');
})().catch(error=>{console.error(error);process.exitCode=1;});
