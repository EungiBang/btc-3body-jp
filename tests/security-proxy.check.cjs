const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const ts=require('typescript');
function load(file){const module={exports:{}};new Function('module','exports',ts.transpileModule(fs.readFileSync(file,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText)(module,module.exports);return module.exports.default;}
function response(){return {code:200,headers:{},setHeader(k,v){this.headers[k]=v;return this},status(code){this.code=code;return this},json(body){this.body=body;return this},end(){return this}};}
for(const file of fs.readdirSync('api').filter(f=>/^gemini.*\.ts$/.test(f)&&f!=='gemini-us.ts')){test(file+' validates model and protects provider credentials/errors',async()=>{
const handler=load('api/'+file);const saved={key:process.env.GEMINI_API_KEY,jp:process.env.GEMINI_API_KEY_JP,us:process.env.GEMINI_API_KEY_US,fetch:global.fetch};
try{process.env.GEMINI_API_KEY='synthetic-test-key';process.env.GEMINI_API_KEY_JP='synthetic-test-key';process.env.GEMINI_API_KEY_US='synthetic-test-key';let calls=0;
global.fetch=async(url,options)=>{calls++;assert.equal(String(url).includes('synthetic-test-key'),false);assert.equal(options.headers['x-goog-api-key'],'synthetic-test-key');return {ok:false,status:429,json:async()=>({error:{message:'private-provider-detail'}})}};
let res=response();await handler({method:'POST',headers:{},body:{model:'../../invalid',contents:'hello'}},res);assert.equal(res.code,400);assert.equal(calls,0);
res=response();await handler({method:'POST',headers:{},body:{model:'gemini-2.5-flash',contents:'hello'}},res);assert.equal(res.code,429);assert.equal(calls,1);assert.equal(JSON.stringify(res.body).includes('private-provider-detail'),false);
}finally{for(const [key,value] of [['GEMINI_API_KEY',saved.key],['GEMINI_API_KEY_JP',saved.jp],['GEMINI_API_KEY_US',saved.us]]){if(value===undefined)delete process.env[key];else process.env[key]=value;}global.fetch=saved.fetch;}
});}

test('US SDK handler rejects invalid models and hides provider errors',async()=>{
const saved=process.env.GEMINI_API_KEY_US;process.env.GEMINI_API_KEY_US='synthetic-test-key';let calls=0;const module={exports:{}};const code=ts.transpileModule(fs.readFileSync('api/gemini-us.ts','utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText;new Function('module','exports','require',code)(module,module.exports,()=>({GoogleGenAI:class{models={generateContent:async()=>{calls++;throw Error('private-provider-detail')}}}}));
try{let res=response();await module.exports.default({method:'POST',body:{model:'../../bad',contents:'test'}},res);assert.equal(res.code,400);assert.equal(calls,0);res=response();await module.exports.default({method:'POST',body:{model:'gemini-2.5-flash',contents:'test'}},res);assert.equal(res.code,500);assert.equal(calls,1);assert.equal(JSON.stringify(res.body).includes('private-provider-detail'),false);}finally{if(saved===undefined)delete process.env.GEMINI_API_KEY_US;else process.env.GEMINI_API_KEY_US=saved;}
});
