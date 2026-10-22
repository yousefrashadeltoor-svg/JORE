const $ = (id) => document.getElementById(id);
const API_BASE = (document.querySelector('meta[name="api-base"]')?.content || '').trim().replace(/\/$/, '');
const apiUrl = (path) => `${API_BASE}${path}`;
const state = { info: null, kind: 'video', selected: null, lang: 'ar', theme: 'dark', activeJob: null, pollTimer: null, abortController: null };
const I18N = {
  ar: {eyebrow:'أداة وسائط بسيطة وسريعة',headline:'كل فيديو يبدأ <span>برابط.</span>',subhead:'الصق الرابط، استعرض التفاصيل، واختار الجودة والصيغة المناسبة ليك.',analyze:'تحليل الرابط',analyzing:'جارٍ التحليل…',privacy:'التحليل يتم عبر الخادم المتصل بالتطبيق. استخدم الروابط والمحتوى المسموح لك بتنزيله فقط.',previewKicker:'معاينة المحتوى',previewTitle:'تفاصيل الفيديو',previewPlaceholder:'ستظهر صورة الفيديو هنا',openPreview:'فتح المعاينة',formatsKicker:'اختيارك بالكامل',formatsTitle:'الجودة والصيغة',videoTab:'فيديو',audioTab:'صوت فقط',sortLabel:'الترتيب',sortQuality:'الجودة',sortSize:'الحجم',emptyFormats:'حلّل رابطًا لعرض الصيغ المتاحة.',advanced:'إعدادات متقدمة',containerLabel:'حاوية الملف',autoOption:'تلقائي — الأفضل للمصدر',subtitleLabel:'الترجمة',noSubtitles:'بدون ترجمة',allSubtitles:'تنزيل الترجمات المتاحة',embedSubtitles:'تضمين الترجمة في الملف (لو أمكن)',advancedHelp:'الصيغ النهائية تعتمد على المصدر والأدوات المثبتة. التحويل قد يستغرق وقتًا إضافيًا.',download:'تنزيل الاختيار',downloadHint:'سيبدأ تجهيز الملف على الخادم قبل إرساله للمتصفح.',activityKicker:'حالة العملية',activityTitle:'التنزيل الحالي',liveStatus:'مباشر',cancel:'إلغاء',step1Title:'الصق الرابط',step1Text:'ضع رابطًا عامًا يدعمه محرك yt-dlp.',step2Title:'اختار الصيغة',step2Text:'راجع الجودة والحجم المتاحين قبل التنزيل.',step3Title:'نزّل الملف',step3Text:'تابع حالة المعالجة ثم احفظ الملف على جهازك.',footer:'واجهة مفتوحة المصدر مبنية حول yt-dlp',urlPlaceholder:'الصق رابط الفيديو هنا...',linkLabel:'رابط الفيديو',ready:'جاهز',analyzingStatus:'جارٍ تحليل الرابط',unknown:'غير معروف',estimated:'تقديري',exact:'من المصدر',formatVideo:'فيديو',formatAudio:'صوت',best:'أفضل اختيار',videoOnly:'فيديو فقط',audioOnly:'صوت فقط',combined:'صوت وفيديو',noSize:'الحجم غير معروف',needAnalyze:'حلّل رابطًا صالحًا الأول.',selectFormat:'اختار صيغة من القائمة.',starting:'جارٍ بدء التنزيل…',preparing:'جاري تجهيز الملف على الخادم…',downloading:'جارٍ التنزيل',processing:'جارٍ تجهيز الملف النهائي',completed:'اكتمل التنزيل',failed:'فشل التنزيل',cancelled:'تم إلغاء التنزيل',waiting:'في انتظار بدء التنزيل',speed:'السرعة',remaining:'متبقي',done:'تم',errorGeneric:'حصل خطأ غير متوقع.',badUrl:'الرابط غير صالح أو غير مدعوم.',noFormats:'محرك التنزيل لم يرجع صيغًا قابلة للاستخدام لهذا الرابط.',downloadError:'تعذر بدء التنزيل.',cancelConfirm:'إلغاء التنزيل الجاري؟',sizeUnknown:'الحجم النهائي غير معروف',formatCount:'صيغة',previewUnavailable:'المعاينة المباشرة غير متاحة لهذا المصدر. الصورة المصغرة ومعلومات الفيديو متاحة.',subtitleNote:'الترجمة قد لا تتوفر لكل فيديو.',containerNote:'اختيار الحاوية لا يضمن التحويل لكل صيغة؛ يعتمد على FFmpeg والمصدر.'},
  en: {eyebrow:'A cleaner way to handle media',headline:'Every video starts <span>with a link.</span>',subhead:'Paste a link, review its details, then choose the format and quality that fit.',analyze:'Analyze link',analyzing:'Analyzing…',privacy:'Analysis runs through the connected server. Only download content you are allowed to save.',previewKicker:'MEDIA PREVIEW',previewTitle:'Video details',previewPlaceholder:'Your video thumbnail appears here',openPreview:'Open preview',formatsKicker:'YOUR CHOICE',formatsTitle:'Quality & format',videoTab:'Video',audioTab:'Audio only',sortLabel:'Sort',sortQuality:'Quality',sortSize:'File size',emptyFormats:'Analyze a link to see available formats.',advanced:'Advanced options',containerLabel:'Container',autoOption:'Auto — best for source',subtitleLabel:'Subtitles',noSubtitles:'No subtitles',allSubtitles:'Download available subtitles',embedSubtitles:'Embed subtitles when possible',advancedHelp:'Final output depends on the source and installed tools. Conversion may take extra time.',download:'Download selection',downloadHint:'The server prepares the file before sending it to your browser.',activityKicker:'TASK STATUS',activityTitle:'Current download',liveStatus:'Live',cancel:'Cancel',step1Title:'Paste a link',step1Text:'Use a public URL supported by yt-dlp.',step2Title:'Choose a format',step2Text:'Review the available quality and estimated size.',step3Title:'Download',step3Text:'Track processing, then save the file to your device.',footer:'Open-source interface built around yt-dlp',urlPlaceholder:'Paste a video URL…',linkLabel:'Video URL',ready:'READY',analyzingStatus:'Analyzing URL',unknown:'Unknown',estimated:'Estimated',exact:'From source',formatVideo:'Video',formatAudio:'Audio',best:'BEST MATCH',videoOnly:'Video only',audioOnly:'Audio only',combined:'Video + audio',noSize:'Size unknown',needAnalyze:'Analyze a valid link first.',selectFormat:'Choose a format from the list.',starting:'Starting download…',preparing:'Preparing file on server…',downloading:'Downloading',processing:'Preparing final file',completed:'Download complete',failed:'Download failed',cancelled:'Download cancelled',waiting:'Waiting for download to start',speed:'Speed',remaining:'remaining',done:'Done',errorGeneric:'Something unexpected went wrong.',badUrl:'The URL is invalid or unsupported.',noFormats:'The engine did not return usable formats for this URL.',downloadError:'Could not start the download.',cancelConfirm:'Cancel the active download?',sizeUnknown:'Final size unknown',formatCount:'formats',previewUnavailable:'Live preview is unavailable for this source. Thumbnail and metadata are available.',subtitleNote:'Subtitles may not be available for every video.',containerNote:'Container selection cannot guarantee conversion for every format; it depends on FFmpeg and the source.'}
};
const t = (key) => (I18N[state.lang] && I18N[state.lang][key]) || I18N.en[key] || key;
function escapeHtml(v='') { return String(v).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c])); }
function fmtBytes(n) { if (n == null || !Number.isFinite(Number(n)) || Number(n) < 0) return t('noSize'); const units=['B','KB','MB','GB','TB']; let x=Number(n),i=0; while(x>=1024&&i<units.length-1){x/=1024;i++;} return `${x.toFixed(i===0?0:1)} ${units[i]}`; }
function fmtDuration(sec) { if (!Number.isFinite(Number(sec))) return t('unknown'); sec=Math.max(0,Math.floor(Number(sec))); const h=Math.floor(sec/3600),m=Math.floor((sec%3600)/60),s=sec%60; return h?`${h}:${String(m).padStart(2,'0')}:${String(s).padStart(2,'0')}`:`${m}:${String(s).padStart(2,'0')}`; }
function fmtSpeed(n) { return n == null || !Number.isFinite(Number(n)) ? '—' : `${fmtBytes(n)}/s`; }
function showNotice(msg, kind='') { const el=$('notice'); el.textContent=msg; el.className=`notice ${kind}`.trim(); }
function hideNotice(){ $('notice').className='notice hidden'; $('notice').textContent=''; }
function setBusy(busy) { $('analyzeButton').disabled=busy; $('analyzeButton').querySelector('[data-i18n="analyze"]').textContent=busy?t('analyzing'):t('analyze'); $('sourceStatus').textContent=busy?t('analyzingStatus').toUpperCase():t('ready'); }
function normalizeFormats(info) {
  const raw=Array.isArray(info.formats)?info.formats:[];
  const seen=new Set();
  return raw.filter(f=>f && f.format_id && !seen.has(String(f.format_id)) && seen.add(String(f.format_id))).map(f=>{
    const hasV=f.vcodec && f.vcodec!=='none'; const hasA=f.acodec && f.acodec!=='none';
    const size=f.filesize ?? f.filesize_approx ?? null;
    return {...f, _size:size==null?null:Number(size), _video:!!hasV, _audio:!!hasA, _kind:hasV?'video':'audio', _height:Number(f.height)||0, _fps:Number(f.fps)||0, _ext:(f.ext||'unknown').toUpperCase()};
  }).filter(f=>f._video||f._audio);
}
function sortFormats(list) { const by=$('sortSelect').value; return [...list].sort((a,b)=>{ if(by==='size'){if(a._size==null&&b._size!=null)return 1;if(b._size==null&&a._size!=null)return -1;return (a._size||0)-(b._size||0);} return (b._height-a._height)||(b._fps-a._fps)||((b.tbr||0)-(a.tbr||0)); }); }
function renderFormats() {
  const all=state.info?normalizeFormats(state.info):[];
  let list=all.filter(f=>state.kind==='audio'?!f._video:f._video);
  if(state.kind==='audio') list=all.filter(f=>!f._video && f._audio);
  list=sortFormats(list);
  $('formatCount').textContent=String(list.length);
  if(!list.length){$('formatList').innerHTML=`<div class="empty-state">${escapeHtml(t('noFormats'))}</div>`;$('downloadButton').disabled=true;state.selected=null;return;}
  if(!list.some(f=>String(f.format_id)===String(state.selected))) state.selected=String(list[0].format_id);
  $('formatList').innerHTML=list.map((f,i)=>{
    const title=state.kind==='audio'?(f.format_note||f.acodec||'Audio'):(f.height?`${f.height}p${f._fps>=50?` · ${Math.round(f._fps)} FPS`:''}`:(f.format_note||'Video'));
    const codecs=[f.ext, f.vcodec&&f.vcodec!=='none'?f.vcodec:null, f.acodec&&f.acodec!=='none'?f.acodec:null].filter(Boolean).join(' · ');
    const role=f._video&&f._audio?t('combined'):f._video?t('videoOnly'):t('audioOnly');
    const sizeLabel=f._size==null?t('noSize'):fmtBytes(f._size);
    const selected=String(f.format_id)===String(state.selected);
    return `<button type="button" class="format-option ${selected?'selected':''}" data-format="${escapeHtml(f.format_id)}" aria-pressed="${selected}"><span class="radio-mark"></span><span class="format-main"><span class="format-name">${escapeHtml(title)} <span class="format-badge ${i===0?'best':''}">${i===0?t('best'):escapeHtml(f._ext)}</span></span><span class="format-detail">${escapeHtml(codecs)} · ${escapeHtml(role)} · ID ${escapeHtml(f.format_id)}</span></span><span class="format-size">${escapeHtml(sizeLabel)}<small>${f.filesize!=null?t('exact'):f.filesize_approx!=null?t('estimated'):t('unknown')}</small></span></button>`;
  }).join('');
  $('formatList').querySelectorAll('[data-format]').forEach(btn=>btn.addEventListener('click',()=>{state.selected=btn.dataset.format;renderFormats();}));
  $('downloadButton').disabled=false;
}
function displayInfo(info) {
  state.info=info; state.kind='video'; state.selected=null;
  $('resultSection').classList.remove('hidden'); $('jobsSection').classList.add('hidden');
  $('videoTitle').textContent=info.title||t('unknown'); $('videoUploader').textContent=info.uploader||info.channel||info.creator||t('unknown'); $('videoDuration').textContent=fmtDuration(info.duration); $('videoSite').textContent=info.extractor_key||info.extractor||t('unknown'); $('videoId').textContent=info.id||'';
  const pv=$('previewVideo'); pv.pause(); pv.removeAttribute('src'); pv.load(); pv.classList.add('hidden');
  if(info.preview_url){pv.src=info.preview_url;pv.classList.remove('hidden');$('thumbnail').classList.add('hidden');$('previewPlaceholder').classList.add('hidden');pv.onerror=()=>{pv.classList.add('hidden');if(info.thumbnail){$('thumbnail').src=info.thumbnail;$('thumbnail').classList.remove('hidden');}else $('previewPlaceholder').classList.remove('hidden');};}
  else if(info.thumbnail){$('thumbnail').src=info.thumbnail;$('thumbnail').classList.remove('hidden');$('previewPlaceholder').classList.add('hidden');}
  else{$('thumbnail').classList.add('hidden');$('previewPlaceholder').classList.remove('hidden');}
  $('openPreview').classList.add('hidden');
  document.querySelectorAll('[data-kind]').forEach(b=>b.classList.toggle('active',b.dataset.kind==='video'));
  renderFormats(); $('resultSection').scrollIntoView({behavior:'smooth',block:'start'});
}
async function analyze(url) {
  hideNotice(); if(!url){showNotice(t('badUrl'),'error');return;}
  try { const parsed=new URL(url); if(!['http:','https:'].includes(parsed.protocol)) throw new Error('bad url'); } catch {showNotice(t('badUrl'),'error');return;}
  if(state.abortController) state.abortController.abort(); state.abortController=new AbortController(); setBusy(true);
  try { const res=await fetch(apiUrl('/api/info'),{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({url}),signal:state.abortController.signal}); const data=await res.json().catch(()=>({})); if(!res.ok) throw new Error(data.error||t('badUrl')); displayInfo(data); showNotice(state.lang==='ar'?'تم تحليل الرابط بنجاح.':'Link analyzed successfully.','success'); }
  catch(e){ if(e.name!=='AbortError') showNotice(e.message||t('errorGeneric'),'error'); }
  finally {setBusy(false);}
}
$('analyzeForm').addEventListener('submit',e=>{e.preventDefault();analyze($('urlInput').value.trim());});
let analyzeDebounce=null;
$('urlInput').addEventListener('paste',()=>{clearTimeout(analyzeDebounce);analyzeDebounce=setTimeout(()=>{const v=$('urlInput').value.trim();if(v)analyze(v);},250);});
$('urlInput').addEventListener('change',()=>{const v=$('urlInput').value.trim();if(v)analyze(v);});
document.querySelectorAll('[data-kind]').forEach(b=>b.addEventListener('click',()=>{state.kind=b.dataset.kind;document.querySelectorAll('[data-kind]').forEach(x=>x.classList.toggle('active',x===b));const groups=$('containerSelect').querySelectorAll('optgroup');groups.forEach(g=>{g.hidden=(state.kind==='audio')?g.label==='Video':g.label==='Audio';});$('containerSelect').value=state.kind==='audio'?'source':'auto';renderFormats();}));
$('containerSelect').querySelectorAll('optgroup').forEach(g=>{g.hidden=g.label==='Audio';});
$('sortSelect').addEventListener('change',renderFormats);
$('advancedToggle').addEventListener('click',()=>{const open=$('advancedOptions').classList.toggle('hidden')===false;$('advancedChevron').textContent=open?'−':'＋';});
$('themeToggle').addEventListener('click',()=>{document.body.classList.toggle('light-theme');state.theme=document.body.classList.contains('light-theme')?'light':'dark';$('themeGlyph').textContent=state.theme==='light'?'☾':'☼';});
$('langToggle').addEventListener('click',()=>{state.lang=state.lang==='ar'?'en':'ar';document.documentElement.lang=state.lang;document.documentElement.dir=state.lang==='ar'?'rtl':'ltr';document.querySelectorAll('[data-i18n]').forEach(el=>{const k=el.dataset.i18n;if(I18N[state.lang][k])el.innerHTML=I18N[state.lang][k];});$('urlInput').placeholder=t('urlPlaceholder');$('urlInput').setAttribute('aria-label',t('linkLabel'));if(state.info)renderFormats();});
function updateJob(job) {
  $('jobsSection').classList.remove('hidden'); $('jobTitle').textContent=job.title||state.info?.title||'—';
  const status=job.status||'queued'; const labels={queued:t('waiting'),downloading:t('downloading'),processing:t('processing'),completed:t('completed'),failed:t('failed'),cancelled:t('cancelled')};
  $('jobStatus').textContent=labels[status]||status; const pct=Math.max(0,Math.min(100,Number(job.progress)||0));$('jobPercent').textContent=`${Math.round(pct)}%`;$('progressBar').style.width=`${pct}%`;
  $('jobBytes').textContent=job.downloaded_bytes!=null?fmtBytes(job.downloaded_bytes)+(job.total_bytes!=null?` / ${fmtBytes(job.total_bytes)}`:''):job.total_bytes!=null?fmtBytes(job.total_bytes):t('sizeUnknown');$('jobSpeed').textContent=fmtSpeed(job.speed);$('jobEta').textContent=job.eta!=null?`${Math.ceil(job.eta)}s ${t('remaining')}`:'—';$('jobMessage').textContent=job.message||'';
  $('cancelButton').classList.toggle('hidden',!['queued','downloading','processing'].includes(status)); if(status==='completed'){$('jobPercent').textContent='100%';$('progressBar').style.width='100%';}
}
async function pollJob(id) {
  clearTimeout(state.pollTimer);
  try {const r=await fetch(apiUrl(`/api/status/${encodeURIComponent(id)}`),{cache:'no-store'});const d=await r.json();if(!r.ok)throw new Error(d.error||'status error');updateJob(d);if(d.status==='completed'){clearTimeout(state.pollTimer);if(d.download_url){const a=document.createElement('a');a.href=API_BASE + d.download_url;a.download='';document.body.appendChild(a);a.click();a.remove();showNotice(t('completed'),'success');}return;}if(['failed','cancelled'].includes(d.status)){clearTimeout(state.pollTimer);if(d.error)showNotice(d.error,'error');return;}state.pollTimer=setTimeout(()=>pollJob(id),900);}
  catch(e){showNotice(e.message||t('errorGeneric'),'error');state.pollTimer=setTimeout(()=>pollJob(id),1800);}
}
$('downloadButton').addEventListener('click',async()=>{
  if(!state.info){showNotice(t('needAnalyze'),'error');return;}if(!state.selected){showNotice(t('selectFormat'),'error');return;}
  hideNotice();$('downloadButton').disabled=true;showNotice(t('starting'));
  const chosen=normalizeFormats(state.info).find(f=>String(f.format_id)===String(state.selected));const payload={url:state.info.webpage_url||$('urlInput').value.trim(),format_id:state.selected,has_audio:chosen?chosen._audio:true,title:state.info.title||'media',kind:state.kind,container:$('containerSelect').value,subtitles:$('subtitleSelect').value,embed_subtitles:$('embedSubtitles').checked};
  try {const r=await fetch(apiUrl('/api/download'),{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(payload)});const d=await r.json();if(!r.ok)throw new Error(d.error||t('downloadError'));state.activeJob=d.job_id;$('jobsSection').classList.remove('hidden');updateJob({status:'queued',progress:0,title:state.info.title,message:t('preparing')});showNotice(t('preparing'));pollJob(d.job_id);$('jobsSection').scrollIntoView({behavior:'smooth',block:'nearest'});}
  catch(e){showNotice(e.message||t('downloadError'),'error');}finally{$('downloadButton').disabled=false;}
});
$('cancelButton').addEventListener('click',async()=>{if(!state.activeJob)return;if(!confirm(t('cancelConfirm')))return;try{const r=await fetch(apiUrl(`/api/cancel/${encodeURIComponent(state.activeJob)}`),{method:'POST'});const d=await r.json();if(!r.ok)throw new Error(d.error||'cancel error');updateJob(d);clearTimeout(state.pollTimer);}catch(e){showNotice(e.message||t('errorGeneric'),'error');}});
$('urlInput').placeholder=t('urlPlaceholder');
