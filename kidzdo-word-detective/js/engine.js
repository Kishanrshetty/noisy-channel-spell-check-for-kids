(function (root) {
  'use strict';
  const START = '<s>', END = '</s>', UNK = '<unk>';
  const words = text => Array.from(text.toLowerCase().replace(/’/g, "'").matchAll(/[a-z]+(?:'[a-z]+)?/g), m => m[0]);
  const splitSentences = text => text.split(/[.!?;\n]+/).map(words).filter(s => s.length);
  const tokenize = text => Array.from(text.matchAll(/\p{L}+(?:['’]\p{L}+)*/gu), m => ({raw:m[0],word:m[0].toLowerCase().replace(/’/g,"'"),start:m.index,end:m.index+m[0].length}));
  function distance(a,b) {
    const n=a.length,m=b.length,d=Array.from({length:n+1},()=>new Uint16Array(m+1));
    for(let i=0;i<=n;i++)d[i][0]=i;
    for(let j=0;j<=m;j++)d[0][j]=j;
    for(let i=1;i<=n;i++)for(let j=1;j<=m;j++){
      d[i][j]=Math.min(d[i-1][j]+1,d[i][j-1]+1,d[i-1][j-1]+(a[i-1]===b[j-1]?0:1));
      if(i>1&&j>1&&a[i-1]===b[j-2]&&a[i-2]===b[j-1])d[i][j]=Math.min(d[i][j],d[i-2][j-2]+1);
    }
    return d[n][m];
  }
  function editExplanation(a,b) {
    if(a===b)return 'No change needed';
    if(a.length===b.length){
      for(let i=0;i<a.length-1;i++)if(a.slice(0,i)+a[i+1]+a[i]+a.slice(i+2)===b)return `Swap “${a[i]}” and “${a[i+1]}”`;
      const changes=[];for(let i=0;i<a.length;i++)if(a[i]!==b[i])changes.push(`“${a[i]}” → “${b[i]}”`);
      if(changes.length<=2)return 'Replace '+changes.join(', ');
    }
    if(b.length===a.length+1)for(let j=0;j<b.length;j++)if(b.slice(0,j)+b.slice(j+1)===a)return `Insert “${b[j]}”`;
    if(a.length===b.length+1)for(let j=0;j<a.length;j++)if(a.slice(0,j)+a.slice(j+1)===b)return `Remove “${a[j]}”`;
    return `${distance(a,b)} edits: insert, remove, replace or swap`;
  }
  // A normalized generative edit channel, summing every compatible edit path.
  // At each source position: insertion .01, deletion .015, adjacent swap .035
  // when available, otherwise consume; consumption matches with .955 and
  // substitutes with .045, uniformly among the other 26 alphabet characters.
  // At the end, insertion .01 or termination .99. These are teaching assumptions.
  function channel(intended,typed) {
    const n=intended.length,m=typed.length,A=27;
    const f=Array.from({length:n+1},()=>new Float64Array(m+1));f[0][0]=1;
    for(let i=0;i<=n;i++)for(let j=0;j<=m;j++){
      const p=f[i][j];if(!p)continue;
      if(j<m)f[i][j+1]+=p*.01/A;
      if(i===n)continue;
      f[i+1][j]+=p*.015;
      const swap=i+1<n?.035:0,consume=1-.01-.015-swap;
      if(j<m)f[i+1][j+1]+=p*consume*(intended[i]===typed[j]?.955:.045/(A-1));
      if(swap&&j+1<m&&intended[i]===typed[j+1]&&intended[i+1]===typed[j])f[i+2][j+2]+=p*swap;
    }
    return f[n][m]*.99;
  }
  class LanguageModel {
    constructor(vocabulary) {
      this.vocab=new Set([END,UNK,...vocabulary]);this.vocab.delete(START);
      this.uni=new Map();this.bi=new Map();this.out=new Map();this.total=0;this.sentences=0;this.textWords=0;this.mu=8;this.alpha=.05;
    }
    addSentence(tokens,weight=1){
      if(!tokens.length)return;
      this.sentences+=weight;this.textWords+=tokens.length*weight;
      let prev=START;
      for(const word of [...tokens,END]){
        this.vocab.add(word);this.uni.set(word,(this.uni.get(word)||0)+weight);this.total+=weight;
        this.bi.set(prev+'\t'+word,(this.bi.get(prev+'\t'+word)||0)+weight);
        this.out.set(prev,(this.out.get(prev)||0)+weight);prev=word;
      }
    }
    known(w){return this.vocab.has(w);}
    norm(w){return w===START||this.vocab.has(w)?w:UNK;}
    prior(w){return ((this.uni.get(this.norm(w))||0)+this.alpha)/(this.total+this.alpha*this.vocab.size);}
    probability(w,prev){w=this.norm(w);prev=this.norm(prev);return ((this.bi.get(prev+'\t'+w)||0)+this.mu*this.prior(w))/((this.out.get(prev)||0)+this.mu);}
    count(a,b){return this.bi.get(this.norm(a)+'\t'+this.norm(b))||0;}
    local(c,prev,next){return this.probability(c,prev)*this.probability(next,c);}
    clues(c,prev,next){return [{tokens:[prev,c],count:this.count(prev,c),order:2,probability:this.probability(c,prev)},{tokens:[c,next],count:this.count(c,next),order:2,probability:this.probability(next,c)}];}
    sentenceLog(tokens){let sum=0,prev=START;for(const w of [...tokens,END]){sum+=Math.log(this.probability(w,prev));prev=w;}return sum;}
    static fromText(text,vocabulary){const m=new LanguageModel(vocabulary);splitSentences(text).forEach(s=>m.addSentence(s));return m;}
    static fromData(data){
      const m=new LanguageModel(data.words);m.uni=new Map(data.words.map((w,i)=>[w,data.unigrams[i]]));m.total=data.unigrams.reduce((a,b)=>a+b,0);
      for(const [a,b,count] of data.bigrams){const x=data.words[a],y=data.words[b];m.bi.set(x+'\t'+y,count);m.out.set(x,(m.out.get(x)||0)+count);}
      m.sentences=data.meta.trainingSentences;m.textWords=m.total-(m.uni.get(END)||0);return m;
    }
  }
  function findIndex(values,target,lo=0,hi=values.length){
    while(lo<hi){const mid=(lo+hi)>>>1;if(values[mid]<target)lo=mid+1;else hi=mid;}
    return lo<values.length&&values[lo]===target?lo:-1;
  }
  class ContextModel extends LanguageModel {
    constructor(data,buffer){
      super(data.words);this.order=3;this.meta=data.meta;this.words=data.words;this.ids=new Map(data.words.map((w,i)=>[w,i]));this.V=data.words.length;
      let offset=0;const arrays=data.lengths.map(n=>{const a=new Uint32Array(buffer,offset,n);offset+=n*4;return a;});
      if(offset!==buffer.byteLength)throw new Error('Incomplete language model data.');
      [this.u,this.bp,this.bw,this.bc,this.bt,this.th,this.tp,this.tw,this.tc,this.tt]=arrays;
      this.total=this.u.reduce((a,b)=>a+b,0);this.sentences=data.meta.trainingSentences;this.textWords=data.meta.wordTokens;this.mu=data.meta.mu2;this.mu3=data.meta.mu3;this.alpha=data.meta.alpha;
    }
    id(w){return this.ids.get(w)??1;}
    prior(w){return (this.u[this.id(w)]+this.alpha)/(this.total+this.alpha*this.vocab.size);}
    count(a,b){const x=this.id(a),y=this.id(b),i=findIndex(this.bw,y,this.bp[x],this.bp[x+1]);return i>=this.bp[x]&&i<this.bp[x+1]?this.bc[i]:0;}
    probability(w,prev){const x=this.id(prev);return (this.count(prev,w)+this.mu*this.prior(w))/(this.bt[x]+this.mu);}
    historyIndex(a,b){return findIndex(this.th,this.id(a)*this.V+this.id(b));}
    count3(a,b,w){const h=this.historyIndex(a,b);if(h<0)return 0;const i=findIndex(this.tw,this.id(w),this.tp[h],this.tp[h+1]);return i>=this.tp[h]&&i<this.tp[h+1]?this.tc[i]:0;}
    probability3(w,a,b){const h=this.historyIndex(a,b),lower=this.probability(w,b);if(h<0)return lower;return (this.count3(a,b,w)+this.mu3*lower)/(this.tt[h]+this.mu3);}
    clues(c,prev,next,context){
      if(!context?.sentenceTokens)return super.clues(c,prev,next);
      const tokens=[...context.sentenceTokens];tokens[context.sentenceIndex]=c;
      const seq=[START,START,...tokens,END],first=context.sentenceIndex+2,clues=[];
      for(let j=first;j<=Math.min(first+2,seq.length-1);j++){
        const a=seq[j-2],b=seq[j-1],w=seq[j];clues.push({tokens:[a,b,w],count:this.count3(a,b,w),pairCount:this.count(b,w),order:3,probability:this.probability3(w,a,b)});
      }return clues;
    }
    local(c,prev,next,context){return this.clues(c,prev,next,context).reduce((p,clue)=>p*clue.probability,1);}
    sentenceLog(tokens){let sum=0,a=START,b=START;for(const w of [...tokens,END]){sum+=Math.log(this.probability3(w,a,b));a=b;b=w;}return sum;}
    static async fromPacked(data){
      if(!globalThis.DecompressionStream)throw new Error('Please open this file in a current version of Chrome, Edge, Firefox or Safari.');
      const raw=atob(data.gzip),bytes=new Uint8Array(raw.length);for(let i=0;i<raw.length;i++)bytes[i]=raw.charCodeAt(i);
      const stream=new Blob([bytes]).stream().pipeThrough(new DecompressionStream('gzip'));
      const buffer=await new Response(stream).arrayBuffer();return new ContextModel(data,buffer);
    }
  }
  class SpellEngine {
    constructor(model){this.model=model;this.groups=new Map();this.cache=new Map();for(const w of model.vocab)if(/^[a-z]+(?:'[a-z]+)?$/.test(w)){if(!this.groups.has(w.length))this.groups.set(w.length,[]);this.groups.get(w.length).push(w);}}
    candidates(typo){
      if(this.cache.has(typo))return this.cache.get(typo);
      if(typo.length>28||!/^[a-z]+(?:'[a-z]+)?$/.test(typo))return [];
      const max=typo.length<=2?1:2,found=[];
      for(let len=Math.max(1,typo.length-max);len<=typo.length+max;len++)for(const w of this.groups.get(len)||[]){const d=distance(typo,w);if(d<=max)found.push({word:w,distance:d,channel:channel(w,typo)});}
      this.cache.set(typo,found);return found;
    }
    rank(typo,prev=START,next=END,restrict=null,context=null){
      const cs=restrict?restrict.map(word=>({word,distance:distance(typo,word),channel:channel(word,typo)})):this.candidates(typo);
      const rows=cs.map(c=>({...c,lm:this.model.local(c.word,prev,next,context),clues:this.model.clues(c.word,prev,next,context),leftCount:this.model.count(prev,c.word),rightCount:this.model.count(c.word,next)}));
      let lmTotal=0,jointTotal=0,channelTotal=0;
      for(const c of rows){c.joint=c.channel*c.lm;lmTotal+=c.lm;jointTotal+=c.joint;channelTotal+=c.channel;}
      for(const c of rows){c.lmShare=lmTotal?c.lm/lmTotal:0;c.share=jointTotal?c.joint/jointTotal:0;c.channelShare=channelTotal?c.channel/channelTotal:0;}
      return rows.sort((a,b)=>b.joint-a.joint||a.word.localeCompare(b.word));
    }
    analyze(text){
      const tokens=tokenize(text),issues=[];
      const groups=[];let group=[];
      tokens.forEach((t,i)=>{if(i&&/[.!?;\n]/.test(text.slice(tokens[i-1].end,t.start))){groups.push(group);group=[];}group.push(i);});if(group.length)groups.push(group);
      const contexts=new Map();for(const group of groups){const sentenceTokens=group.map(i=>tokens[i].word);group.forEach((i,j)=>contexts.set(i,{sentenceTokens,sentenceIndex:j}));}
      tokens.forEach((t,i)=>{
        if(!/^[a-z]+(?:'[a-z]+)?$/.test(t.word)||t.word.length>28||this.model.known(t.word))return;
        const prev=i===0||/[.!?;\n]/.test(text.slice(tokens[i-1].end,t.start))?START:tokens[i-1].word;
        const next=i===tokens.length-1||/[.!?;\n]/.test(text.slice(t.end,tokens[i+1].start))?END:tokens[i+1].word;
        issues.push({...t,tokenIndex:i,prev,next,...contexts.get(i)});
      });return {tokens,issues};
    }
  }
  const preserveCase=(original,word)=>original===original.toUpperCase()?word.toUpperCase():/^[A-Z]/.test(original)?word[0].toUpperCase()+word.slice(1):word;
  const replace=(text,issue,word)=>text.slice(0,issue.start)+preserveCase(issue.raw,word)+text.slice(issue.end);
  const api={LanguageModel,ContextModel,SpellEngine,words,tokenize,splitSentences,distance,channel,editExplanation,replace,START,END,UNK};
  root.WordEngine=api;if(typeof module!=='undefined'&&module.exports)module.exports=api;
})(globalThis);

