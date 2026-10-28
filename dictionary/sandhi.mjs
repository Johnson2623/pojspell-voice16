const MARKS={2:'\u0301',3:'\u0300',5:'\u0302',7:'\u0304',8:'\u030d'};
export function pronunciationKey(row){
 return row.poj.toLowerCase().normalize('NFD').replace(/o([\u0300-\u030f]*)\u0358/g,'oo$1')
 .replace(/ⁿ/g,'nn').replace(/[\u0300-\u036f]/g,'').replace(/^tsh/,'chh').replace(/^ts/,'ch')+'|'+Number(row.tone);
}
export function targetReading(row){
 const [original]=pronunciationKey(row).split('|');
 const h=/h$/.test(original)&&[4,8].includes(Number(row.tone));
 const tone=h?(Number(row.tone)===4?2:3):({1:7,2:1,3:2,4:8,5:7,7:3,8:4})[Number(row.tone)];
 const base=h?original.slice(0,-1):original;
 let poj=row.poj.normalize('NFD').replace(/[\u0300\u0301\u0302\u0304\u030d]/g,'');
 if(h)poj=poj.slice(0,-1);
 const chars=[...poj];let at=-1;
 for(const vowel of ['a','o','e']){at=chars.indexOf(vowel);if(at>=0)break;}
 if(at<0){const bare=chars.join('').replace(/ⁿ/g,'');const special=/iu$/.test(bare)?'u':/ui$/.test(bare)?'i':null;
  if(special)at=chars.lastIndexOf(special);else for(let i=chars.length-1;i>=0;i--){if(/[iumn]/.test(chars[i])){at=i;break;}}
 }
 if(MARKS[tone]&&at>=0)chars.splice(at+1,0,MARKS[tone]);
 return {key:base+'|'+tone,tone,poj:chars.join('').normalize('NFC'),rule:h?'h 韻尾依一般連讀變調去 h':Number(row.tone)===5?'第 5 調採 5 → 7（偏漳腔）':'一般連讀變調'};
}
export function buildPairs(rows,pool){
 const index=new Map();
 for(const r of pool){if(!r.audio||!r.han||!r.source)continue;const key=pronunciationKey(r);if(!index.has(key))index.set(key,r);}
 const pairs={};
 for(const row of rows){const target=targetReading(row),matched=index.get(target.key)||null,clip=matched?{...matched,poj:target.poj}:null;pairs[pronunciationKey(row)]={...target,clip};}
 return pairs;
}
