import {pronunciationKey} from './sandhi.mjs';
import {TONES, SPEEDS, unique, isBeginner, selectPart, shuffled, nextExample, matchedEnding} from './model.mjs';
const $ = id => document.getElementById(id);
const panels = {build:'builderPanel', advanced:'advancedBuilderPanel', auto:'autoBuilderPanel', listen:'player', examples:'examplesPanel'};
const audio = $('voiceAudio');
let dictionaryActive = true;
const state = {rows:[], data:{}, current:null, page:'build', ready:false, auto:false, linked:false, autoTimer:null, dictionaryTimer:null, mask:'none', speed:3, dictionarySpeed:3, generation:0,pairs:{}};
const escapeHtml = text => String(text).replace(/[&<>"']/g, ch => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[ch]));
const option = (value, label = value || '無聲母') => `<option value="${escapeHtml(value)}">${escapeHtml(label)}</option>`;
const isAutoPage = () => state.page === 'auto' || (state.page === 'listen' && state.linked);
const meaningsOf = row => row.meanings || [{han:row.han,source:row.sourcePage || row.source}];
const meaningText = row => meaningsOf(row).map(entry => entry.han).join('、');

function cancelPlayback(message = '已停止') {
  state.generation++;
  audio.onended = null;audio.onerror = null;audio.pause();
  $('status').textContent = message;
  $('pairStatus').textContent='';
  for(const id of ['play','playSandhi'])$(id).setAttribute('aria-pressed','false');
}
function stopAuto() {
  clearTimeout(state.autoTimer);state.autoTimer = null;state.auto = false;
  $('play').textContent = '▶ 本音';
}
function stopDictionary() {clearInterval(state.dictionaryTimer);state.dictionaryTimer = null;}

function renderBuilder(prefix, rows) {
  const x = state.current;
  const ids = prefix === 'advanced' ? ['advancedOnset','advancedFinal','advancedToneSelect','advancedCombinedSound','advancedFormula']
    : prefix === 'auto' ? ['autoOnset','autoFinal','autoToneSelect','autoCombinedSound',null]
    : ['onset','final','toneSelect','combinedSound','formula'];
  const onsets = unique(rows.map(r => r.onset));
  const finals = unique(rows.filter(r => r.onset === x.onset).map(r => r.final));
  const tones = TONES.filter(t => rows.some(r => r.onset === x.onset && r.final === x.final && r.tone === t));
  $(ids[0]).innerHTML = onsets.map(v => option(v)).join('');
  $(ids[1]).innerHTML = finals.map(v => option(v)).join('');
  $(ids[2]).innerHTML = tones.map(t => option(t, `第 ${t} 調`)).join('');
  $(ids[0]).value = x.onset;$(ids[1]).value = x.final;$(ids[2]).value = String(x.tone);
  $(ids[3]).textContent = x.poj;
  if (ids[4]) $(ids[4]).textContent = `${x.onset || '無聲母'} ＋ ${x.final} ＋ 第 ${x.tone} 調 → ${x.poj}`;
}
function renderTones() {
  const x = state.current, selectable = state.page === 'examples';
  const symbols = {1:'a',2:'á',3:'à',4:'aptkh',5:'â',7:'ā',8:'a̍ptkh'};
  $('tones').innerHTML = TONES.map(t => {
    let symbol = symbols[t];
    if ([4,8].includes(t)) symbol = (t === 4 ? 'a' : 'a̍') + ['p','t','k','h'].map(letter => `<span class="tone-ending-letter${t === x.tone && matchedEnding(x,letter) ? ' is-match' : ''}">${letter}</span>`).join('');
    return `<button class="tone" data-tone="${t}" aria-label="第 ${t} 調 ${symbols[t]}" aria-pressed="${x.tone === t}"${selectable ? '' : ' disabled aria-disabled="true"'}><small>第 ${t} 調</small><b${[4,8].includes(t) ? ' class="tone-endings"' : ''}>${symbol}</b></button>`;
  }).join('');
}
function renderCurrent() {
  if (!state.current) return;
  const x = state.current;
  renderBuilder('build', state.rows.filter(isBeginner));renderBuilder('advanced', state.rows);renderBuilder('auto', state.rows);renderTones();
  $('syllable').textContent = x.poj;$('han').textContent = x.han;
  const meanings=meaningsOf(x);
  $('dictionaryMeanings').hidden=meanings.length<2;
  $('dictionaryMeaningList').innerHTML=meanings.map(entry=>`<a href="${escapeHtml(entry.source)}" target="_blank" rel="noopener">${escapeHtml(entry.han)}</a>`).join('');
  $('recordedHeadword').textContent=`本段錄音例字：${x.han}`;
  $('sourceLink').href = x.sourcePage || x.source;
  $('sourceLink').title = '教育部真人例音；辭典音檔採 CC 姓名標示－禁止改作 3.0 臺灣授權';
  renderPair();
  $('voiceDisplay').setAttribute('aria-label', `${x.poj} ${x.han} 第${x.tone}調`);
}
function showPage(page) {
  if (!state.ready || !(page in panels)) return;
  const follow = page === 'listen' && isAutoPage() && state.auto;
  stopDictionary();
  if (!follow && page !== 'auto') {stopAuto();cancelPlayback('點選播放，聆聽真人例音。');}
  state.linked = follow;state.page = page;$('app').dataset.page = page;
  for (const [key,id] of Object.entries(panels)) $(id).hidden = key !== page;
  document.querySelectorAll('[data-page-choice]').forEach(b => {
    const selected = b.dataset.pageChoice === page;
    b.setAttribute('aria-selected', String(selected));b.tabIndex = selected ? 0 : -1;
  });
  $(panels[page]).querySelector('.tone-slot').appendChild($('tones'));
  if (page === 'auto' || page === 'listen') {
    $(page === 'auto' ? 'autoListen' : 'listenHost').appendChild($('voiceDisplay'));
    $('voiceDisplay').hidden = false;
  } else $('voiceDisplay').hidden = true;
  if (page === 'build' && !isBeginner(state.current)) {
    const rows = state.rows.filter(isBeginner);
    state.current = rows.find(r => r.onset === state.current.onset && r.tone === state.current.tone) || rows[0];
  }
  renderCurrent();
}

function renderPair(){
  const row=state.current,pair=state.pairs[pronunciationKey(row)];
  $('baseExample').textContent=`${row.poj} · ${row.han} · 第 ${row.tone} 調`;
  $('baseSource').href=row.sourcePage||row.source;
  $('playSandhi').disabled=!pair?.clip;
  $('sandhiSource').hidden=!pair?.clip;
  if(pair?.clip){
    $('sandhiExample').textContent=`${pair.clip.poj} · ${pair.clip.han} · 第 ${pair.tone} 調`;
    $('sandhiSource').href=pair.clip.source;
  }else{
    $('sandhiExample').textContent=pair?`${pair.poj} · 第 ${pair.tone} 調：目前未收錄配對錄音`:'目前未收錄配對錄音';
    $('sandhiSource').removeAttribute('href');
  }
  $('pairRule').textContent=pair?`第 ${row.tone} 調 → 第 ${pair.tone} 調；${pair.rule}`:'';
}
// Both controls call play synchronously on the persistent audio element for iPhone.
function playCurrent(kind='base') {
  if(!state.ready)return;
  const pair=state.pairs[pronunciationKey(state.current)];
  if(kind==='sandhi'&&!pair?.clip)return;
  const row=kind==='sandhi'?pair.clip:state.current;
  const label=kind==='sandhi'?'變音':'本音',button=kind==='sandhi'?$('playSandhi'):$('play');
  cancelPlayback();
  const generation=state.generation;
  let retried=false;
  const failed=error=>{
    if(generation!==state.generation||error?.name==='AbortError')return;
    // A genuine media/network failure may retry the same official recording.
    const official=row.officialAudio||(/\.mp3(?:\?|$)/i.test(row.source)?row.source:null);
    if(error?.name!=='NotAllowedError'&&!retried&&official){retried=true;audio.src=official;attempt();return;}
    stopAuto();button.setAttribute('aria-pressed','false');
    $('pairStatus').textContent=error?.name==='NotAllowedError'?'請點擊本音或變音按鈕啟用聲音。':'此音檔暫時無法播放，請重試或開啟該錄音的教育部來源。';
  };
  const attempt=()=>{
    audio.muted=false;audio.volume=1;
    try{Promise.resolve(audio.play()).then(()=>{
      if(generation!==state.generation)return;
      button.setAttribute('aria-pressed','true');
      $('pairStatus').textContent=`正在播放${label}：${row.poj}（例字：${row.han}）`;
    }).catch(failed);}catch(error){failed(error);}
  };
  audio.onended=()=>{if(generation===state.generation){button.setAttribute('aria-pressed','false');$('pairStatus').textContent=`${label}播放完成。`;}};
  audio.onerror=()=>{if(audio.error)failed(audio.error);};
  audio.src=row.audio;attempt();
}
function scheduleAuto() {
  clearTimeout(state.autoTimer);
  if (!state.auto) return;
  state.autoTimer = setTimeout(() => {
    if (!state.auto || !isAutoPage()) return;
    state.current = nextExample(state.rows, state.current);renderCurrent();playCurrent();scheduleAuto();
  }, state.speed * 1000);
}
function startAuto() {
  if (!state.ready || !isAutoPage()) return;
  stopAuto();state.auto = true;state.speed = Number($('autoToneSpeed').value);
  $('play').textContent = '▶ 再聽一次';playCurrent();scheduleAuto();
}
function renderSamples() {
  const tone = state.current.tone, rows = shuffled(state.data[tone]);
  const count = `第 ${tone} 調 ${rows.length}/${state.rows.length.toLocaleString('en-US')} 個`;
  $('toolbarSampleCount').textContent = count;
  $('samples').innerHTML = rows.map(row => {
    const id = state.rows.indexOf(row), maskPoj = state.mask === 'poj', maskHan = state.mask === 'han';
    return `<button class="sample" data-row="${id}" aria-pressed="${row === state.current}" aria-label="${state.mask === 'none' ? `播放 ${escapeHtml(row.poj)} ${escapeHtml(meaningText(row))}` : '點擊揭曉例音'}"><b${maskPoj ? ' class="practice-hidden" aria-hidden="true"' : ''}>${escapeHtml(row.poj)}</b>&nbsp;&nbsp;<small${maskHan ? ' class="practice-hidden" aria-hidden="true"' : ''}>${escapeHtml(meaningText(row))}</small></button>`;
  }).join('');
}
function startDictionary() {
  stopDictionary();
  if (!dictionaryActive || state.page !== 'examples' || document.hidden) return;
  state.dictionaryTimer = setInterval(() => {
    const scroll = $('samples').scrollTop;renderSamples();$('samples').scrollTop = scroll;
  }, state.dictionarySpeed * 1000);
}
function navigate(page) {
  if (page === 'examples') {
    showPage(page);state.current = state.data[1][0];renderCurrent();renderSamples();
    $('samples').scrollTop = 0;startDictionary();
  } else if (page === 'auto') {showPage(page);startAuto();}
  else {
    const from = state.page;showPage(page);
    if (page === 'listen' && ['build','advanced'].includes(from)) playCurrent();
  }
}
$('pageSwitch').addEventListener('click', event => {
  const button = event.target.closest('[data-page-choice]');
  if (button && !button.disabled) navigate(button.dataset.pageChoice);
});
$('pageSwitch').addEventListener('keydown', event => {
  if (!['ArrowRight','ArrowLeft','Home','End'].includes(event.key)) return;
  event.preventDefault();
  const tabs = [...document.querySelectorAll('[data-page-choice]')], i = tabs.indexOf(document.activeElement);
  const next = event.key === 'Home' ? 0 : event.key === 'End' ? tabs.length - 1 : (i + (event.key === 'ArrowRight' ? 1 : -1) + tabs.length) % tabs.length;
  tabs[next].focus();navigate(tabs[next].dataset.pageChoice);
});
for (const [id,kind] of [['onset','onset'],['final','final'],['toneSelect','tone'],['advancedOnset','onset'],['advancedFinal','final'],['advancedToneSelect','tone']]) {
  $(id).addEventListener('change', event => {
    cancelPlayback('已拼好，按聆聽這個拼音。');
    state.current = selectPart(state.page === 'build' ? state.rows.filter(isBeginner) : state.rows, state.current, kind, event.target.value);
    renderCurrent();
  });
}
for (const id of ['builderPlay','advancedBuilderPlay']) $(id).addEventListener('click', () => {showPage('listen');playCurrent();});
$('play').addEventListener('click', () => {if (isAutoPage()) startAuto();else playCurrent();});
$('playSandhi').addEventListener('click',()=>{stopAuto();playCurrent('sandhi');});
$('stop').addEventListener('click', () => {stopAuto();cancelPlayback();});
$('autoToneSpeed').addEventListener('change', event => {
  const seconds = Number(event.target.value);
  if (!SPEEDS.includes(seconds)) return;
  state.speed = seconds;
  if (isAutoPage()) startAuto();
});
$('tones').addEventListener('click', event => {
  const button = event.target.closest('[data-tone]');
  if (!button || button.disabled || state.page !== 'examples') return;
  state.current = state.data[button.dataset.tone][0];renderCurrent();renderSamples();$('samples').scrollTop = 0;startDictionary();
});
$('samples').addEventListener('click', event => {
  const button = event.target.closest('[data-row]');if (!button) return;
  const masked = button.querySelector('.practice-hidden:not(.is-revealed)');
  if (masked) {
    masked.classList.add('is-revealed');masked.removeAttribute('aria-hidden');
    const row = state.rows[Number(button.dataset.row)];button.setAttribute('aria-label', `播放 ${row.poj} ${meaningText(row)}`);return;
  }
  state.current = state.rows[Number(button.dataset.row)];showPage('listen');playCurrent();
});
$('practiceTools').addEventListener('click', event => {
  const button = event.target.closest('[data-practice-mask]');if (!button) return;
  state.mask = button.dataset.practiceMask;
  document.querySelectorAll('[data-practice-mask]').forEach(b => b.setAttribute('aria-pressed', String(b === button)));renderSamples();
});
$('practiceSpeed').addEventListener('change', () => {
  const seconds = Number($('practiceSpeed').value);if (!SPEEDS.includes(seconds)) return;
  state.dictionarySpeed = seconds;startDictionary();
});
document.addEventListener('visibilitychange', () => {
  if (document.hidden) {stopDictionary();stopAuto();cancelPlayback('已暫停；回到頁面後按播放繼續。');}
  else if (state.ready && state.page === 'examples') startDictionary();
});
window.addEventListener('pagehide', () => {stopDictionary();stopAuto();cancelPlayback();});
Promise.all(['practice2000.json','sandhi-pairs.json'].map(url=>fetch(url).then(response=>{if(!response.ok)throw new Error('data');return response.json();}))).then(([data,pairs])=>{
  state.pairs=pairs;
  state.data = data;state.rows = TONES.flatMap(t => data[t]);
  if (!state.rows.length) throw new Error('empty');
  state.current = state.rows.find(isBeginner);state.ready = true;$('loadMessage').hidden = true;
  document.querySelectorAll('#pageSwitch button,#builderPanel select,#advancedBuilderPanel select,#builderPlay,#advancedBuilderPlay').forEach(el => el.disabled = false);
  navigate('examples');
}).catch(() => {
  $('loadMessage').textContent = '例音載入失敗，請檢查網路後重新整理。';
  const retry = document.createElement('button');retry.textContent = '重新載入';
  retry.addEventListener('click', () => location.reload());$('loadMessage').appendChild(retry);
});

// Stop hidden-tab recordings and reshuffling; reactivate at tone 1 as in the source project.
window.addEventListener('message', event => {
  if(event.source !== parent || event.origin !== location.origin || event.data?.type !== 'dictionary-active')return;
  dictionaryActive=!!event.data.active;
  if(!dictionaryActive){stopDictionary();stopAuto();cancelPlayback();}
  else if(state.ready)navigate('examples');
});
