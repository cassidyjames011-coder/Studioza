import {test} from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import * as UQ from './question-uniqueness.mjs';
const fp=(changes={})=>({primaryConcept:'cloud computing',learningObjective:'explain cloud benefits',cognitiveSkill:'understand',assessmentAction:'explain benefits',questionStructure:'explanation',scenarioType:null,expectedAnswer:'elastic capacity reduces infrastructure costs',reasoning:'match variable demand to capacity',method:'',formulaFamily:'',requiredOperations:[],...changes});
const q=(prompt='Explain the benefits of cloud computing.',changes={})=>({prompt,questionMode:'theory',questionLength:'short',taskCount:1,questionType:'theory',sourceDoc:'notes',topic:'cloud computing',options:['Elastic capacity','Fixed capacity','No security','No internet'],correct:0,explanation:'Elastic capacity matches demand.',fingerprint:fp(),...changes});
async function compare(a,b){const c=UQ.createValidationContext(10);UQ.acceptQuestion(a,await UQ.validateQuestion(a,c),c);return UQ.validateQuestion(b,c);}
for(const [name,prompt] of [['UQ-01 identical','Explain the benefits of cloud computing.'],['UQ-02 punctuation','Explain the benefits of cloud computing!'],['UQ-03 case','EXPLAIN THE BENEFITS OF CLOUD COMPUTING.'],['UQ-04 paraphrase','What business benefits motivate a company to adopt cloud services?'],['UQ-05 definition rephrasing','Describe why elastic capacity helps businesses.']])test(name,async()=>assert.equal((await compare(q(),q(prompt))).accepted,false));
const practical=fp({learningObjective:'calculate profit margin',cognitiveSkill:'apply',assessmentAction:'calculate margin',questionStructure:'calculation',expectedAnswer:'profit divided by sales',reasoning:'subtract costs then divide by sales',method:'profit_margin',formulaFamily:'margin',requiredOperations:['subtract_cost','divide_by_sales']});
for(const [name,a,b] of [['UQ-06 numbers and currency','Product costs €50 and sells for €80. Calculate margin.','Product costs $60 and sells for $90. Calculate margin.'],['UQ-07 variable names','Compute total using a loop over x.','Compute total using a loop over y.'],['adversarial names and context','Acme sells products. Calculate its margin.','In a busy Paris office Beta sells services. Work out the margin.'],['adversarial sentence order','Calculate margin. Costs are 50 and sales 80.','Sales are 90 and costs 60. Calculate margin.']])test(name,async()=>{const result=await compare(q(a,{questionType:'practical',fingerprint:practical}),q(b,{questionType:'practical',fingerprint:practical}));assert.equal(result.reason,'PRACTICAL_DUPLICATE');});
for(const [name,prompt,changes] of [['UQ-08 different objective','Evaluate cloud security risks.',{learningObjective:'evaluate cloud security',assessmentAction:'evaluate risks',expectedAnswer:'shared responsibility requires access controls',reasoning:'identify threats then assess controls'}],['UQ-09 different skill','Interpret how fixed costs change break-even volume.',{learningObjective:'interpret fixed cost impact',cognitiveSkill:'analyse',assessmentAction:'interpret changes',reasoning:'relate costs to required sales'}],['UQ-10 different reasoning','Analyse diseconomies of scale.',{learningObjective:'analyse diseconomies',reasoning:'coordination costs grow'}],['UQ-18 added tasks','Calculate margin then evaluate sensitivity to tax and justify a pricing strategy.',{reasoning:'calculate margin then compare tax sensitivity then justify pricing',requiredOperations:['subtract_cost','divide_by_sales','tax_sensitivity','justify_strategy']}],['UQ-19 opposing wording','Explain the disadvantages of cloud computing.',{learningObjective:'explain cloud drawbacks',assessmentAction:'explain drawbacks',expectedAnswer:'provider dependence creates risk',reasoning:'evaluate dependency'}]])test(name,async()=>assert.equal((await compare(q(),q(prompt,{fingerprint:fp(changes)}))).accepted,true));
test('normalisation preserves mathematical meaning and decimal values',async()=>{assert.notEqual(await UQ.hashQuestion('x + 2.5 = 4'),await UQ.hashQuestion('x - 25 = 4'));assert.equal(UQ.normalizeQuestion(' Ｃloud! '),'cloud');});
test('UQ-11 objective diversity soft cap',async()=>{const c=UQ.createValidationContext(4);c.objectives=['explain cloud benefits','security','costs','continuity'];c.accepted=[q()];const r=await UQ.validateQuestion(q('Apply a distinct approach',{fingerprint:fp({cognitiveSkill:'apply',reasoning:'distinct'})}),c);assert.equal(r.reason,'OBJECTIVE_OVERLAP');c.objectives=['explain cloud benefits'];assert.equal((await UQ.validateQuestion(q('Apply a distinct approach',{fingerprint:fp({cognitiveSkill:'apply'})}),c)).accepted,true);});
test('metadata cannot be replaced by broad topic equality',()=>{assert.equal(UQ.isEquivalentAssessment(q(),q('Cloud security',{fingerprint:fp({expectedAnswer:'encrypt files',reasoning:'protect keys'})})),false);assert.equal(UQ.validFingerprint({primaryConcept:'cloud'}),false);});
const source=fs.readFileSync('worker.js','utf8').replace(/^import .*;\r?\n/gm,'').replace('export class DailyQuota','class DailyQuota').replace('export default {','const worker = {');
function sandbox(fetch){const s={UQ,crypto,DurableObject:class{},fetch,AbortController,AbortSignal,setTimeout,clearTimeout,Response,TextEncoder,URL,console:{log(){}}};vm.createContext(s);vm.runInContext(source,s);return s;}
const response=data=>(Response.json({candidates:[{finishReason:'STOP',content:{parts:[{text:JSON.stringify(data)}]}}]}));
function mockAI(batches,{review,offline=false}={}){const calls={generation:0,review:0,plan:0};return {calls,fetch:async(url,options)=>{const b=JSON.parse(options.body),instruction=b.systemInstruction.parts[0].text;if(instruction.startsWith('Identify up to')){calls.plan++;return response(['explain cloud benefits','cloud security','cost management','continuity','evaluate security risks','misleading metadata']);}if(instruction.startsWith('Independently')){calls.review++;if(offline)throw new Error('offline');const data=JSON.parse(b.contents[0].parts[0].text);return response(review?review(data):data.candidates.map(c=>({id:c.id,decision:'distinct',duplicateOf:null,reason:'different assessment',practical:false})));}const i=calls.generation++;return response(batches[Math.min(i,batches.length-1)]);}};}
async function run(mock,{target=2,mode='theory',length='short',history=[],seed=[]}={}){const s=sandbox(mock.fetch),events=[];const questions=await s.collectDocumentSprint({contents:[{role:'user',parts:[{text:'DOCUMENT: notes\nCloud services provide elastic capacity, shared security controls, variable costs and business continuity.'}]}]},['notes'],{GEMINI_API_KEY:'fake'}, {reserve:async()=>({allowed:true})},null,e=>events.push(e),new AbortController().signal,seed,[],target,mode,length,history);return {questions,events,metrics:events.find(e=>e.type==='validation').metrics};}
test('UQ-12/13/14 partial set, duplicate replacement rechecked and attempts bounded',async()=>{const mock=mockAI([[q(),q()]]);const r=await run(mock);assert.equal(r.questions.length,1);assert.ok(mock.calls.generation<=4);assert.ok(r.metrics.rejectionBreakdown.EXACT_DUPLICATE>=1);assert.equal(r.metrics.finalAcceptedQuestionCount,1);assert.ok(r.events.filter(e=>e.type==='batch').every(e=>e.questions.length===1));});
test('targeted replacement retains accepted questions',async()=>{const next=q('Evaluate security risks.',{fingerprint:fp({learningObjective:'evaluate security risks',assessmentAction:'evaluate risks',expectedAnswer:'access controls',reasoning:'identify threats'})});const mock=mockAI([[q(),q()],[next]]);const r=await run(mock);assert.equal(r.questions.length,2);assert.equal(mock.calls.generation,2);});
test('UQ-15 semantic service outage uses labelled structured fallback',async()=>{const r=await run(mockAI([[q()]],{offline:true}),{target:1});assert.equal(r.questions.length,1);assert.equal(r.metrics.semanticMode,'structured-fallback');assert.equal(r.metrics.semanticUnavailable,1);});
test('semantic review catches paraphrases despite misleading fingerprints',async()=>{const altered=q('What business gains motivate adoption?',{fingerprint:fp({learningObjective:'misleading metadata',assessmentAction:'different',expectedAnswer:'different',reasoning:'different'})});const mock=mockAI([[q(),altered]],{review:({previous,candidates})=>candidates.map((c,i)=>({id:c.id,decision:previous.length||i?'duplicate':'distinct',duplicateOf:previous.length?'p0':i?'c0':null,reason:'Same elastic-capacity benefit and reasoning',practical:false}))});const r=await run(mock);assert.equal(r.questions.length,1);assert.ok(r.metrics.rejectionBreakdown.SEMANTIC_DUPLICATE>=1);});
test('malformed semantic references cannot reject unrelated questions',async()=>{const r=await run(mockAI([[q()]],{review:()=>[{id:'c0',decision:'duplicate',duplicateOf:'p999',reason:'bogus',practical:false}]}),{target:1});assert.equal(r.questions.length,1);assert.equal(r.metrics.semanticUnavailable,1);});
test('UQ-16 history remains request-local',async()=>{const a=await run(mockAI([[q()]]),{target:1,history:[q()]});const b=await run(mockAI([[q()]]),{target:1});assert.equal(a.questions.length,0);assert.equal(b.questions.length,1);});
test('UQ-17 old saved progress is untrusted and revalidated',async()=>{const legacy=q();delete legacy.fingerprint;const r=await run(mockAI([[q()]]),{target:1,seed:[legacy]});assert.equal(r.questions.length,1);assert.equal(r.metrics.rejectionBreakdown.INVALID_METADATA,1);});
for(const mode of ['theory','mixed','practical'])for(const length of ['short','medium','long'])test('UQ-20 '+mode+' '+length,async()=>{const s=sandbox(),config=s.getQuestionConfig(mode,length);const item=q('Apply source-supported knowledge',{questionMode:mode,questionLength:length,questionType:mode==='theory'?'theory':'practical',taskCount:config.tasks[0]});const r=await run(mockAI([[item]]),{target:1,mode,length});assert.equal(r.questions.length,1);});
test('frontend parses and handles accurate partial counts, diagnostics and material-scoped history',()=>{const html=fs.readFileSync('index.html','utf8');for(const m of html.matchAll(/<script(?:\s[^>]*)?>([\s\S]*?)<\/script>/g))new vm.Script(m[1]);for(const text of ['activeSprintSize=finalCount','sourceMaterialKey===materialKey','result.validation=generationValidation','documentHistory:callOptions.documentHistory','The remaining questions did not pass validation'])assert.ok(html.includes(text));});
test('code literals, case, inequality and factorial remain meaningful',async()=>{assert.notEqual(UQ.normalizeQuestion('Compute 5!'),UQ.normalizeQuestion('Compute 5'));assert.notEqual(UQ.normalizeQuestion('x != y'),UQ.normalizeQuestion('x = y'));const c=UQ.createValidationContext(2),a=q('What does this print?',{code:'print("X")'}),b=q('What does this print?',{code:'print("x")',fingerprint:fp({learningObjective:'different objective'})});UQ.acceptQuestion(a,await UQ.validateQuestion(a,c),c);assert.equal((await UQ.validateQuestion(b,c)).accepted,true);});
test('incorrect model fingerprints do not override actual answer evidence',()=>{const a=q(),b=q('Evaluate access controls.',{options:['Rotate encryption keys','a','b','c'],explanation:'Separate access privileges from cryptographic key rotation.'});assert.equal(UQ.isEquivalentAssessment(a,b),false);});
test('rejected long practical templates include the whole task sequence',async()=>{const a=q('Calculate then interpret margin.',{questionType:'practical',fingerprint:practical}),b=q('Calculate, interpret and evaluate tax sensitivity.',{questionType:'practical',fingerprint:{...practical,requiredOperations:[...practical.requiredOperations,'evaluate_tax'],reasoning:'calculate and interpret margin then analyse tax sensitivity'}});assert.equal(UQ.isPracticalDuplicate(a,b),false);});
test('new history input is bounded before security or AI work',async()=>{const s=sandbox(()=>{throw new Error('No upstream work expected');}),worker=vm.runInContext('worker',s);const body={contents:[{parts:[{text:'notes'}]}],generationConfig:{responseSchema:{items:{properties:{sourceDoc:{enum:['notes']}}}}}};const env={ALLOWED_ORIGIN:'https://cassidyjames011-coder.github.io',APPROVED_MODELS:'gemini-3.5-flash-lite',GEMINI_API_KEY:'fake',TURNSTILE_SECRET_KEY:'fake',DAILY_QUOTA:{},RATE_LIMITER:{}};for(const history of [new Array(51).fill(q()),[q('wrong source',{sourceDoc:'other'})],[{prompt:'bad'}]]){const r=await worker.fetch(new Request('https://worker/',{method:'POST',headers:{Origin:env.ALLOWED_ORIGIN,'Content-Type':'application/json'},body:JSON.stringify({body,turnstileToken:'fake',task:'document-sprint',documentMode:'theory',documentLength:'short',documentCount:1,documentHistory:history})}),env);assert.equal(r.status,400);}});
test('live endpoint still refuses unauthorised origins and missing verification',async()=>{const s=sandbox(),worker=vm.runInContext('worker',s),env={ALLOWED_ORIGIN:'https://cassidyjames011-coder.github.io',APPROVED_MODELS:'gemini-3.5-flash-lite',GEMINI_API_KEY:'fake',TURNSTILE_SECRET_KEY:'fake',DAILY_QUOTA:{},RATE_LIMITER:{}};const bad=await worker.fetch(new Request('https://worker/',{method:'POST',headers:{Origin:'https://other.example'}}),env);assert.equal(bad.status,403);const missing=await worker.fetch(new Request('https://worker/',{method:'POST',headers:{Origin:env.ALLOWED_ORIGIN,'Content-Type':'application/json'},body:JSON.stringify({body:{contents:[]}})}),env);assert.equal(missing.status,400);});
test('repeated economics definition is the same assessment',async()=>{const definition=fp({primaryConcept:'economies of scale',learningObjective:'define economies of scale',cognitiveSkill:'remember',assessmentAction:'define term',expectedAnswer:'average costs decline as output grows',reasoning:'spread fixed costs across more output'});const a=q('Define economies of scale.',{fingerprint:definition,options:['Average costs decline as output grows','a','b','c'],explanation:'Fixed costs are spread across more output.'});const b={...a,prompt:'What is meant by the term economies of scale?'};assert.equal((await compare(a,b)).accepted,false);});
test('quota exhaustion preserves previously validated questions',async()=>{const mock=mockAI([[q(),q()]]),s=sandbox(mock.fetch),events=[];let calls=0;const result=await s.collectDocumentSprint({contents:[{parts:[{text:'DOCUMENT: notes\nStudy material'}]}]},['notes'],{GEMINI_API_KEY:'fake'},{reserve:async()=>({allowed:++calls<=2})},null,e=>events.push(e),new AbortController().signal,[],[],2,'theory','short');assert.equal(result.length,1);assert.equal(events.find(e=>e.type==='validation').metrics.stopReason,'DAILY_LIMIT');});


test('Gemini fails over once on overload or a connection error, within quota', async () => {
  const primary = 'gemini-3.5-flash-lite';
  const fallback = 'gemini-3.8-flash';
  const env = {APPROVED_MODELS: primary + ',' + fallback, GEMINI_API_KEY: 'fake'};
  for (const failure of [503, 'network', 403, 429, 'denied', 'cancelled']) {
    const controller = new AbortController();
    const calls = [];
    let reservations = 0;
    const quota = {reserve: async () => {
      reservations++;
      return {allowed: failure !== 'denied'};
    }};
    const s = sandbox(async (url, options) => {
      calls.push([url.split('/').at(-1), options.body]);
      if (calls.length === 2) return new Response('backup');
      if (failure === 'cancelled') controller.abort();
      if (failure === 'network' || failure === 'cancelled') throw new TypeError('fetch failed');
      return new Response('primary error', {status: failure === 'denied' ? 503 : failure});
    });
    const call = s.fetchGemini({contents: []}, env, quota, controller.signal, 1000);
    if (failure === 'denied' || failure === 'cancelled') {
      await assert.rejects(call, failure === 'denied' ? {status: 429} : {name: 'AbortError'});
    } else {
      const {response, result} = await call;
      assert.equal(response.status, failure === 403 ? failure : 200);
      assert.equal(result, response.ok ? 'backup' : 'primary error');
    }
    const switched = failure === 503 || failure === 429 || failure === 'network';
    assert.deepEqual(calls.map(([model]) => model), [primary, ...(switched ? [fallback] : [])].map(model => model + ':generateContent'));
    assert.ok(calls.every(([,body]) => body === '{"contents":[]}'));
    assert.equal(reservations, switched || failure === 'denied' ? 1 : 0);
  }
});

test('a sprint deadline returns the questions already checked', async () => {
  const deadline = new AbortController();
  const mock = mockAI([[q()]]);
  const s = sandbox(async (url, options) => {
    const instruction = JSON.parse(options.body).systemInstruction.parts[0].text;
    if (!instruction.startsWith('Identify up to') && !instruction.startsWith('Independently')) {
      deadline.abort(new DOMException('Sprint deadline', 'TimeoutError'));
      options.signal.throwIfAborted();
    }
    return mock.fetch(url, options);
  });
  s.AbortSignal = {
    any: signals => AbortSignal.any(signals),
    timeout: ms => ms === 80000 ? deadline.signal : AbortSignal.timeout(ms)
  };
  s.ReadableStream = ReadableStream;
  const origin = 'https://cassidyjames011-coder.github.io';
  const quota = {reserve: async () => ({allowed: true})};
  const response = s.documentSprintStream({contents: []}, ['notes'], {}, quota, {}, origin, null,
    [q()], [], 2, 'theory', [], 'short');
  const events = (await response.text()).trim().split('\n').map(line => JSON.parse(line));
  assert.equal(events.find(event => event.type === 'validation').metrics.stopReason, 'TIME_LIMIT');
  assert.equal(events.find(event => event.type === 'result').questions.length, 1);
  assert.ok(!events.some(event => event.type === 'error'));
});
