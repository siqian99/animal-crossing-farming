importScripts('data.js','optimizer.js','vendor/highs.js');
const ready=Module({locateFile:path=>'vendor/'+path}).then(instance=>HarvestOptimizer.setSolver(instance));
self.onmessage=async event=>{try{await ready;const result=HarvestOptimizer.solve(HARVEST_DATA,event.data.input,progress=>self.postMessage({type:'progress',progress}));self.postMessage({type:'result',result});}catch(error){self.postMessage({type:'error',message:error.message});}};
