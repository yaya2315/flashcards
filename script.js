(function(){
  'use strict';

  /* =========================================================
     Configuración
     Las preguntas se guardan en el localStorage de ESTE navegador.
     No hay servidor ni base de datos: cada dispositivo tiene su
     propio banco y nunca ve lo que se escribió en otro.
     ========================================================= */
  var STORE_KEY = 'desafio-genios:banco:v1';
  var PREFS_KEY = 'desafio-genios:prefs:v1';
  var GENERAL_LABEL = 'General';

  var NEUTRAL = { accent:'#C3C8E6', ink:'#151935' };
  var PALETTE = [
    { accent:'#E3A33E', ink:'#241705' }, // oro
    { accent:'#6F9FEA', ink:'#0B1A30' }, // azul
    { accent:'#4FBFA2', ink:'#06231B' }, // verde agua
    { accent:'#E07A9A', ink:'#2B0F18' }, // rosa
    { accent:'#A98BEF', ink:'#1B1033' }, // violeta
    { accent:'#EE8A5E', ink:'#2A1307' }, // coral
    { accent:'#A9C95A', ink:'#1A2206' }, // lima
    { accent:'#4CC3D9', ink:'#062227' }  // cian
  ];

  var ICON_EDIT = '<svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M4 20h4L19 9a2.8 2.8 0 0 0-4-4L4 16v4z"/><path d="M13.5 6.5l4 4"/></svg>';
  var ICON_TRASH = '<svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M4 7h16"/><path d="M10 11v6M14 11v6"/><path d="M6 7l1 12a2 2 0 0 0 2 2h6a2 2 0 0 0 2-2l1-12"/><path d="M9 7V5a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2"/></svg>';

  /* =========================================================
     Utilidades
     ========================================================= */
  function $(id){ return document.getElementById(id); }

  function el(tag, cls, text){
    var n = document.createElement(tag);
    if(cls) n.className = cls;
    if(text != null) n.textContent = text;
    return n;
  }

  function uid(){
    if(window.crypto && typeof window.crypto.randomUUID === 'function'){
      try{ return window.crypto.randomUUID(); }catch(e){}
    }
    return Date.now().toString(36) + '-' + Math.random().toString(36).slice(2, 10);
  }

  // Quita tildes y pasa a minúsculas, carácter por carácter (para buscar sin importar acentos)
  function foldChar(c){
    return c.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
  }
  function fold(s){ return String(s || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, ''); }

  // Clave para detectar preguntas repetidas: ignora tildes, signos y espacios extra
  function dupKey(s){
    return fold(s).replace(/[¿?¡!.,;:"'«»“”()\-]/g, ' ').replace(/\s+/g, ' ').trim();
  }

  function cleanText(v){
    return typeof v === 'string' ? v.replace(/\r\n?/g, '\n').replace(/[ \t]+\n/g, '\n').trim() : '';
  }

  function cleanCat(v){
    var c = typeof v === 'string' ? v.replace(/\s+/g, ' ').trim().slice(0, 40) : '';
    return fold(c) === 'general' ? '' : c;
  }

  function pad(n){ return String(n).padStart(2, '0'); }

  function plural(n, one, many){ return n + ' ' + (n === 1 ? one : many); }

  function hexToRgba(hex, a){
    var n = parseInt(hex.slice(1), 16);
    return 'rgba(' + ((n >> 16) & 255) + ',' + ((n >> 8) & 255) + ',' + (n & 255) + ',' + a + ')';
  }

  function today(){
    var d = new Date();
    return d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate());
  }

  /* =========================================================
     Almacenamiento local (solo este dispositivo)
     ========================================================= */
  var storageOK = (function(){
    try{
      var k = '__dg_test__';
      window.localStorage.setItem(k, '1');
      window.localStorage.removeItem(k);
      return true;
    }catch(e){ return false; }
  })();

  function sanitizeItems(arr, freshIds){
    if(!Array.isArray(arr)) return [];
    var out = [], used = {};
    arr.forEach(function(it){
      if(!it || typeof it !== 'object') return;
      var q = cleanText(it.q), a = cleanText(it.a);
      if(!q || !a) return;
      var id = (!freshIds && typeof it.id === 'string' && it.id && !used[it.id]) ? it.id : uid();
      used[id] = true;
      var created = Number(it.created) || Date.now();
      out.push({
        id: id,
        cat: cleanCat(it.cat),
        q: q.slice(0, 600),
        a: a.slice(0, 1200),
        created: created,
        updated: Number(it.updated) || created
      });
    });
    return out;
  }

  function loadItems(){
    if(!storageOK) return [];
    try{
      var raw = window.localStorage.getItem(STORE_KEY);
      if(!raw) return [];
      var data = JSON.parse(raw);
      return sanitizeItems(data && data.items);
    }catch(e){ return []; }
  }

  function saveItems(){
    if(!storageOK) return false;
    try{
      window.localStorage.setItem(STORE_KEY, JSON.stringify({ version:1, items:items }));
      return true;
    }catch(e){
      toast('No se pudo guardar: el navegador no tiene espacio disponible.');
      return false;
    }
  }

  function loadPrefs(){
    var p = { voice:true };
    if(!storageOK) return p;
    try{
      var raw = window.localStorage.getItem(PREFS_KEY);
      if(raw){
        var d = JSON.parse(raw);
        if(d && typeof d.voice === 'boolean') p.voice = d.voice;
      }
    }catch(e){}
    return p;
  }

  function savePrefs(){
    if(!storageOK) return;
    try{ window.localStorage.setItem(PREFS_KEY, JSON.stringify(prefs)); }catch(e){}
  }

  /* =========================================================
     Estado
     ========================================================= */
  var items = loadItems();
  var prefs = loadPrefs();
  var currentTab = null;

  var editingId = null;
  var returnToPractice = false;
  var lastDeleted = null;

  var P = {
    filter: null,       // null = todas; '' = General; 'Materia' = esa materia
    currentId: null,
    revealed: false,
    seen: new Set(),
    history: [],
    idx: -1
  };

  /* =========================================================
     Elementos
     ========================================================= */
  var els = {
    srStatus: $('srStatus'),
    storageWarning: $('storageWarning'),
    tabs: Array.prototype.slice.call(document.querySelectorAll('[role="tab"]')),
    tabCount: $('tabCount'),
    panelPractice: $('panel-practicar'),
    panelManage: $('panel-preguntas'),

    practiceEmpty: $('practiceEmpty'),
    practiceArea: $('practiceArea'),
    filters: $('filters'),
    progressFill: $('progressFill'),
    progressLabel: $('progressLabel'),
    speechBtn: $('speechBtn'),
    speechBtnLabel: $('speechBtnLabel'),
    resetBtn: $('resetBtn'),
    ficha: $('ficha'),
    ball: $('ballNumber'),
    catName: $('catName'),
    editCurrentBtn: $('editCurrentBtn'),
    question: $('questionText'),
    revealBtn: $('revealBtn'),
    answer: $('answerText'),
    backBtn: $('backBtn'),
    drawBtn: $('drawBtn'),
    deckComplete: $('deckComplete'),
    shuffleBtn: $('shuffleBtn'),

    editor: $('editor'),
    editorTitle: $('editorTitle'),
    editorSub: $('editorSub'),
    fCat: $('fCat'),
    fQ: $('fQ'),
    fA: $('fA'),
    fQError: $('fQError'),
    fAError: $('fAError'),
    catList: $('catList'),
    saveBtn: $('saveBtn'),
    cancelEditBtn: $('cancelEditBtn'),

    bankCount: $('bankCount'),
    search: $('search'),
    bankList: $('bankList'),
    bankEmpty: $('bankEmpty'),
    exportBtn: $('exportBtn'),
    importBtn: $('importBtn'),
    importInput: $('importInput'),
    clearAllBtn: $('clearAllBtn'),

    dlg: $('confirmDialog'),
    dlgTitle: $('dlgTitle'),
    dlgText: $('dlgText'),
    dlgConfirm: $('dlgConfirm'),
    dlgCancel: $('dlgCancel'),

    toast: $('toast'),
    toastText: $('toastText'),
    toastAction: $('toastAction')
  };

  function announce(msg){
    els.srStatus.textContent = '';
    // pequeño retraso para que el lector de pantalla note el cambio
    setTimeout(function(){ els.srStatus.textContent = msg; }, 30);
  }

  /* =========================================================
     Materias y colores
     ========================================================= */
  function sameCat(a, b){ return fold(a) === fold(b); }

  // Materias en el orden en que aparecieron por primera vez ('' = General va al final)
  function categories(){
    var seen = {}, list = [], hasGeneral = false;
    items.forEach(function(it){
      if(!it.cat){ hasGeneral = true; return; }
      var k = fold(it.cat);
      if(!seen[k]){ seen[k] = true; list.push(it.cat); }
    });
    if(hasGeneral) list.push('');
    return list;
  }

  function canonicalCat(input){
    var c = cleanCat(input);
    if(!c) return '';
    var found = items.find(function(it){ return sameCat(it.cat, c); });
    return found ? found.cat : c;
  }

  function catLabel(cat){ return cat || GENERAL_LABEL; }

  function colorFor(cat){
    if(!cat) return NEUTRAL;
    var named = categories().filter(Boolean);
    var i = named.findIndex(function(c){ return sameCat(c, cat); });
    if(i < 0) i = named.length;
    return PALETTE[i % PALETTE.length];
  }

  function applyAccent(node, cat){
    var c = colorFor(cat);
    node.style.setProperty('--accent', c.accent);
    node.style.setProperty('--accent-ink', c.ink);
    node.style.setProperty('--accent-soft', hexToRgba(c.accent, .16));
  }

  function byId(id){
    for(var i = 0; i < items.length; i++){ if(items[i].id === id) return items[i]; }
    return null;
  }
  function numberOf(id){
    for(var i = 0; i < items.length; i++){ if(items[i].id === id) return i + 1; }
    return 0;
  }

  /* =========================================================
     Voz (lee solo la pregunta, nunca la respuesta)
     ========================================================= */
  var speechSupported = ('speechSynthesis' in window) && (typeof SpeechSynthesisUtterance !== 'undefined');
  var spanishVoices = [];

  function refreshVoices(){
    if(!speechSupported) return;
    spanishVoices = window.speechSynthesis.getVoices().filter(function(v){
      return v.lang && v.lang.toLowerCase().indexOf('es') === 0;
    });
  }

  function pickSpanishVoice(){
    if(!spanishVoices.length) return null;
    var google = spanishVoices.find(function(v){ return /google/i.test(v.name); });
    if(google) return google;
    var remote = spanishVoices.find(function(v){ return v.localService === false; });
    if(remote) return remote;
    var priority = ['es-419','es-us','es-mx','es-es','es-sv','es-gt','es-hn','es-co','es-ar'];
    for(var i = 0; i < priority.length; i++){
      for(var j = 0; j < spanishVoices.length; j++){
        if(spanishVoices[j].lang.toLowerCase() === priority[i]) return spanishVoices[j];
      }
    }
    return spanishVoices[0];
  }

  function speak(text){
    if(!prefs.voice || !speechSupported || !text) return;
    var synth = window.speechSynthesis;
    synth.cancel();
    var u = new SpeechSynthesisUtterance(text);
    var voice = pickSpanishVoice();
    u.lang = voice ? voice.lang : 'es-ES';
    if(voice) u.voice = voice;
    u.rate = 1.12;
    u.pitch = 1.02;
    synth.speak(u);
  }

  function stopSpeech(){
    if(speechSupported) window.speechSynthesis.cancel();
  }

  function updateSpeechButton(){
    els.speechBtn.setAttribute('aria-pressed', String(prefs.voice));
    els.speechBtnLabel.textContent = prefs.voice ? 'Voz activada' : 'Voz desactivada';
  }

  if(speechSupported){
    refreshVoices();
    window.speechSynthesis.onvoiceschanged = refreshVoices;
    document.addEventListener('visibilitychange', function(){ if(document.hidden) stopSpeech(); });
  } else {
    els.speechBtn.hidden = true;
  }

  /* =========================================================
     Pestañas
     ========================================================= */
  function setTab(name, opts){
    opts = opts || {};
    currentTab = name;
    els.tabs.forEach(function(t){
      var on = t.getAttribute('data-tab') === name;
      t.setAttribute('aria-selected', String(on));
      t.tabIndex = on ? 0 : -1;
      if(on && opts.focusTab) t.focus();
    });
    els.panelPractice.hidden = name !== 'practicar';
    els.panelManage.hidden = name !== 'preguntas';

    try{ history.replaceState(null, '', '#' + name); }catch(e){}

    if(name === 'practicar'){
      enterPractice(opts.initial);
    } else {
      stopSpeech();
      autosizeAll();
    }
  }

  els.tabs.forEach(function(t, i){
    t.addEventListener('click', function(){ setTab(t.getAttribute('data-tab')); });
    t.addEventListener('keydown', function(e){
      var next = null;
      if(e.key === 'ArrowRight') next = els.tabs[(i + 1) % els.tabs.length];
      else if(e.key === 'ArrowLeft') next = els.tabs[(i - 1 + els.tabs.length) % els.tabs.length];
      else if(e.key === 'Home') next = els.tabs[0];
      else if(e.key === 'End') next = els.tabs[els.tabs.length - 1];
      if(next){
        e.preventDefault();
        setTab(next.getAttribute('data-tab'), { focusTab:true });
      }
    });
  });

  document.addEventListener('click', function(e){
    var go = e.target.closest('[data-goto]');
    if(!go) return;
    var target = go.getAttribute('data-goto');
    setTab(target);
    if(target === 'preguntas') els.fQ.focus();
  });

  /* =========================================================
     PRACTICAR
     ========================================================= */
  function pool(){
    if(P.filter === null) return items;
    return items.filter(function(it){ return sameCat(it.cat, P.filter); });
  }

  function remaining(){
    return pool().filter(function(it){ return !P.seen.has(it.id); });
  }

  function renderFilters(){
    var cats = categories();
    if(P.filter !== null && !cats.some(function(c){ return sameCat(c, P.filter); })) P.filter = null;

    els.filters.textContent = '';
    if(cats.length < 2){
      els.filters.hidden = true;
      P.filter = null;
      return;
    }
    els.filters.hidden = false;

    var all = makeChip(null, 'Todas', items.length);
    all.classList.add('chip-all');
    els.filters.appendChild(all);

    cats.forEach(function(c){
      var n = items.filter(function(it){ return sameCat(it.cat, c); }).length;
      var chip = makeChip(c, catLabel(c), n);
      applyAccent(chip, c);
      els.filters.appendChild(chip);
    });
  }

  function makeChip(value, label, n){
    var b = el('button', 'chip');
    b.type = 'button';
    var active = value === null ? P.filter === null : (P.filter !== null && sameCat(P.filter, value));
    b.setAttribute('aria-pressed', String(active));
    b.appendChild(document.createTextNode(label + ' '));
    var count = el('span', 'chip-n', String(n));
    b.appendChild(count);
    b.setAttribute('aria-label', label + ', ' + plural(n, 'pregunta', 'preguntas'));
    b.addEventListener('click', function(){ setFilter(value); });
    return b;
  }

  function setFilter(value){
    P.filter = value;
    renderFilters();
    // mantener el foco en el chip activo tras re-renderizar
    var active = els.filters.querySelector('[aria-pressed="true"]');
    if(active) active.focus();
    updateProgress();
    if(draw({ speak:true })) return;

    // Ya se vieron todas las de esta materia: muestra una de ella para no dejar
    // en pantalla una ficha de otra materia.
    var cur = P.currentId ? byId(P.currentId) : null;
    var list = pool();
    if(list.length && !(cur && list.indexOf(cur) !== -1)){
      var it = list[Math.floor(Math.random() * list.length)];
      pushHistory(it.id);
      renderCard(it, { speak:true });
    }
    updateControls();
  }

  function paintCard(it){
    applyAccent(els.ficha, it.cat);
    applyAccent(els.practiceArea, it.cat);
    els.ball.textContent = pad(numberOf(it.id));
    els.catName.textContent = catLabel(it.cat);
    els.question.textContent = it.q;
    els.answer.textContent = it.a;
    els.editCurrentBtn.setAttribute('aria-label', 'Editar la pregunta ' + numberOf(it.id));
  }

  function renderCard(it, opts){
    opts = opts || {};
    P.currentId = it.id;
    paintCard(it);
    setRevealed(false);
    P.seen.add(it.id);
    updateProgress();

    if(opts.announce !== false){
      announce(catLabel(it.cat) + ', pregunta ' + numberOf(it.id) + '. ' + it.q);
    }
    if(opts.speak) speak(it.q);
    if(opts.anim !== false){
      els.ficha.classList.remove('drawing');
      void els.ficha.offsetWidth;
      els.ficha.classList.add('drawing');
    }
  }

  function setRevealed(on){
    P.revealed = on;
    els.ficha.classList.toggle('revealed', on);
    els.revealBtn.setAttribute('aria-expanded', String(on));
    els.revealBtn.textContent = on ? 'Ocultar respuesta' : 'Ver respuesta';
  }

  function toggleReveal(){
    if(!P.currentId) return;
    setRevealed(!P.revealed);
    if(P.revealed){
      var it = byId(P.currentId);
      if(it) announce('Respuesta: ' + it.a);
    }
  }

  function pushHistory(id){
    P.history = P.history.slice(0, P.idx + 1);
    P.history.push(id);
    P.idx = P.history.length - 1;
  }

  function draw(opts){
    var r = remaining();
    // Evita repetir la misma ficha que está en pantalla si hay otras opciones
    if(r.length > 1 && P.currentId){
      r = r.filter(function(it){ return it.id !== P.currentId; });
    }
    if(!r.length){
      updateControls();
      if(pool().length) announce('Ya viste todas las fichas de esta selección.');
      return false;
    }
    var it = r[Math.floor(Math.random() * r.length)];
    pushHistory(it.id);
    renderCard(it, opts);
    updateControls();
    return true;
  }

  function goNext(){
    if(!items.length) return;
    if(P.idx < P.history.length - 1){
      P.idx++;
      renderCard(byId(P.history[P.idx]), { speak:true });
      updateControls();
    } else {
      draw({ speak:true });
    }
  }

  function goBack(){
    if(P.idx <= 0) return;
    P.idx--;
    renderCard(byId(P.history[P.idx]), { speak:true });
    updateControls();
  }

  function reshuffle(){
    P.seen = new Set();
    P.history = [];
    P.idx = -1;
    P.currentId = null;
    updateProgress();
    announce('Fichas barajadas de nuevo.');
    draw({ speak:true });
    els.drawBtn.focus();
  }

  function updateProgress(){
    var list = pool();
    var total = list.length;
    var seen = list.filter(function(it){ return P.seen.has(it.id); }).length;
    var pct = total ? Math.min(100, Math.round(seen / total * 100)) : 0;
    els.progressFill.style.width = pct + '%';
    els.progressLabel.textContent = seen + ' de ' + total + ' vistas';
  }

  function updateControls(){
    var left = remaining().length;
    var hasForward = P.idx < P.history.length - 1;
    els.backBtn.disabled = P.idx <= 0;
    els.drawBtn.disabled = left === 0 && !hasForward;
    els.deckComplete.hidden = !(left === 0 && pool().length > 0);
  }

  // Ajusta la práctica después de agregar, editar o borrar preguntas
  function syncPractice(){
    P.history = P.history.filter(function(id){ return !!byId(id); });
    P.seen = new Set(Array.from(P.seen).filter(function(id){ return !!byId(id); }));
    renderFilters();

    var empty = items.length === 0;
    els.practiceEmpty.hidden = !empty;
    els.practiceArea.hidden = empty;

    if(empty){
      P.currentId = null; P.history = []; P.idx = -1;
      stopSpeech();
      return;
    }

    var cur = P.currentId ? byId(P.currentId) : null;
    if(cur){
      P.idx = P.history.lastIndexOf(cur.id);
      paintCard(cur);
    } else {
      P.currentId = null;
      P.idx = P.history.length - 1;
      if(currentTab === 'practicar') draw({ anim:false, announce:false });
    }
    updateProgress();
    updateControls();
  }

  function enterPractice(initial){
    if(!items.length) return;
    if(!P.currentId || !byId(P.currentId)){
      draw({ anim:!initial, announce:!initial });
    } else {
      updateProgress();
      updateControls();
    }
  }

  els.ficha.addEventListener('click', function(e){
    if(e.target.closest('button')) return;
    var sel = window.getSelection && String(window.getSelection());
    if(sel) return; // permite seleccionar texto sin voltear la ficha
    toggleReveal();
  });
  els.revealBtn.addEventListener('click', toggleReveal);
  els.drawBtn.addEventListener('click', goNext);
  els.backBtn.addEventListener('click', goBack);
  els.resetBtn.addEventListener('click', reshuffle);
  els.shuffleBtn.addEventListener('click', reshuffle);
  els.editCurrentBtn.addEventListener('click', function(){
    if(P.currentId) startEdit(P.currentId, true);
  });
  els.speechBtn.addEventListener('click', function(){
    prefs.voice = !prefs.voice;
    savePrefs();
    updateSpeechButton();
    if(!prefs.voice) stopSpeech();
    else if(P.currentId){ var it = byId(P.currentId); if(it) speak(it.q); }
  });

  document.addEventListener('keydown', function(e){
    if(currentTab !== 'practicar' || !items.length) return;
    if(e.defaultPrevented || e.altKey || e.ctrlKey || e.metaKey) return;
    if(els.dlg.open) return;
    var t = e.target, tag = t.tagName;
    if(tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || t.isContentEditable) return;
    if(t.getAttribute && t.getAttribute('role') === 'tab') return;
    var onControl = tag === 'BUTTON' || tag === 'A';

    if(e.key === 'ArrowRight' || e.key === 'n' || e.key === 'N'){
      e.preventDefault(); goNext();
    } else if(e.key === 'ArrowLeft' || e.key === 'p' || e.key === 'P'){
      e.preventDefault(); goBack();
    } else if((e.key === ' ' || e.key === 'Enter') && !onControl){
      e.preventDefault(); toggleReveal();
    }
  });

  /* =========================================================
     MIS PREGUNTAS — formulario
     ========================================================= */
  var nativeAutosize = window.CSS && CSS.supports && CSS.supports('field-sizing', 'content');

  function autosize(t){
    if(nativeAutosize || !t.offsetParent) return;
    t.style.height = 'auto';
    t.style.height = (t.scrollHeight + 2) + 'px';
  }
  function autosizeAll(){ autosize(els.fQ); autosize(els.fA); }

  [els.fQ, els.fA].forEach(function(t){
    t.addEventListener('input', function(){
      autosize(t);
      if(t.getAttribute('aria-invalid') === 'true') clearError(t);
    });
  });

  function setError(field, msgEl, msg){
    field.setAttribute('aria-invalid', 'true');
    msgEl.textContent = msg;
    msgEl.hidden = false;
  }
  function clearError(field){
    field.removeAttribute('aria-invalid');
    var msgEl = field === els.fQ ? els.fQError : els.fAError;
    msgEl.hidden = true;
    msgEl.textContent = '';
  }
  function clearErrors(){ clearError(els.fQ); clearError(els.fA); }

  function renderDatalist(){
    els.catList.textContent = '';
    categories().filter(Boolean).forEach(function(c){
      var o = document.createElement('option');
      o.value = c;
      els.catList.appendChild(o);
    });
  }

  function startEdit(id, fromPractice){
    var it = byId(id);
    if(!it) return;
    editingId = id;
    returnToPractice = !!fromPractice;
    clearErrors();
    els.fCat.value = it.cat;
    els.fQ.value = it.q;
    els.fA.value = it.a;
    els.editor.classList.add('is-editing');
    els.editorTitle.textContent = 'Editar pregunta ' + numberOf(id);
    els.editorSub.textContent = returnToPractice
      ? 'Al guardar vuelves a la ficha.'
      : 'Los cambios se guardan solo en este dispositivo.';
    els.saveBtn.textContent = 'Guardar cambios';
    els.cancelEditBtn.hidden = false;

    if(currentTab !== 'preguntas') setTab('preguntas');
    renderList();
    autosizeAll();

    var reduce = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    els.editor.scrollIntoView({ behavior: reduce ? 'auto' : 'smooth', block:'start' });
    els.fQ.focus({ preventScroll:true });
    var end = els.fQ.value.length;
    try{ els.fQ.setSelectionRange(end, end); }catch(e){}
  }

  function resetEditor(keepCat){
    editingId = null;
    returnToPractice = false;
    clearErrors();
    if(!keepCat) els.fCat.value = '';
    els.fQ.value = '';
    els.fA.value = '';
    els.editor.classList.remove('is-editing');
    els.editorTitle.textContent = 'Nueva pregunta';
    els.editorSub.textContent = 'Se agrega a tu banco de este dispositivo.';
    els.saveBtn.textContent = 'Guardar pregunta';
    els.cancelEditBtn.hidden = true;
    autosizeAll();
  }

  function cancelEdit(){
    var back = returnToPractice;
    var id = editingId;
    resetEditor();
    renderList();
    if(back){
      setTab('practicar');
      els.editCurrentBtn.focus();
    } else {
      var btn = id && els.bankList.querySelector('[data-id="' + id + '"] [data-action="edit"]');
      (btn || els.fQ).focus();
    }
  }

  els.cancelEditBtn.addEventListener('click', cancelEdit);

  // Enter en "Materia" pasa a la pregunta en lugar de enviar el formulario
  els.fCat.addEventListener('keydown', function(e){
    if(e.key === 'Enter' && !e.ctrlKey && !e.metaKey){
      e.preventDefault();
      els.fQ.focus();
    }
  });

  els.editor.addEventListener('keydown', function(e){
    if(e.key === 'Enter' && (e.ctrlKey || e.metaKey)){
      e.preventDefault();
      submitEditor();
    } else if(e.key === 'Escape' && editingId){
      e.preventDefault();
      cancelEdit();
    }
  });

  els.editor.addEventListener('submit', function(e){
    e.preventDefault();
    submitEditor();
  });

  function submitEditor(){
    clearErrors();
    var cat = canonicalCat(els.fCat.value);
    var q = cleanText(els.fQ.value);
    var a = cleanText(els.fA.value);

    var firstInvalid = null;
    if(!q){
      setError(els.fQ, els.fQError, 'Escribe la pregunta.');
      firstInvalid = els.fQ;
    } else {
      var key = dupKey(q);
      var dupIndex = items.findIndex(function(it){ return it.id !== editingId && dupKey(it.q) === key; });
      if(dupIndex >= 0){
        setError(els.fQ, els.fQError, 'Esta pregunta ya está en tu banco como la número ' + (dupIndex + 1) + '.');
        firstInvalid = els.fQ;
      }
    }
    if(!a){
      setError(els.fA, els.fAError, 'Escribe la respuesta.');
      firstInvalid = firstInvalid || els.fA;
    }
    if(firstInvalid){
      firstInvalid.focus();
      return;
    }

    var now = Date.now();
    if(editingId){
      var it = byId(editingId);
      if(!it){ resetEditor(); renderAll(); return; }
      it.cat = cat; it.q = q; it.a = a; it.updated = now;
      var n = numberOf(it.id);
      var back = returnToPractice;
      var editedId = it.id;
      saveItems();
      resetEditor();
      renderAll();
      toast('Cambios guardados en la pregunta ' + n + '.');
      if(back){
        setTab('practicar');
        els.editCurrentBtn.focus();
      } else {
        flashItem(editedId);
        var btn = els.bankList.querySelector('[data-id="' + editedId + '"] [data-action="edit"]');
        (btn || els.fQ).focus();
      }
    } else {
      var item = { id:uid(), cat:cat, q:q, a:a, created:now, updated:now };
      items.push(item);
      saveItems();
      resetEditor(true);           // conserva la materia para seguir agregando
      renderAll();
      flashItem(item.id);
      toast('Pregunta ' + items.length + ' guardada.');
      els.fQ.focus();
    }
  }

  /* =========================================================
     MIS PREGUNTAS — lista
     ========================================================= */
  // Pinta el texto marcando las coincidencias de búsqueda (sin usar innerHTML)
  function fillHighlighted(node, text, term){
    node.textContent = '';
    if(!term){ node.textContent = text; return; }
    var folded = '', map = [];
    for(var i = 0; i < text.length; i++){
      var f = foldChar(text[i]);
      for(var k = 0; k < f.length; k++){ folded += f[k]; map.push(i); }
    }
    var pos = 0, from = 0, idx;
    while((idx = folded.indexOf(term, from)) !== -1){
      var start = map[idx];
      var end = map[idx + term.length - 1] + 1;
      if(start > pos) node.appendChild(document.createTextNode(text.slice(pos, start)));
      node.appendChild(el('mark', null, text.slice(start, end)));
      pos = end;
      from = idx + term.length;
    }
    if(pos < text.length) node.appendChild(document.createTextNode(text.slice(pos)));
  }

  function renderList(){
    var term = fold(els.search.value).trim();
    var rows = items.map(function(it, i){ return { it:it, n:i + 1 }; }).reverse(); // las más nuevas arriba

    if(term){
      rows = rows.filter(function(r){
        return fold(r.it.q).indexOf(term) !== -1 ||
               fold(r.it.a).indexOf(term) !== -1 ||
               fold(catLabel(r.it.cat)).indexOf(term) !== -1;
      });
    }

    els.bankCount.textContent = plural(items.length, 'pregunta', 'preguntas');

    var frag = document.createDocumentFragment();
    rows.forEach(function(r){ frag.appendChild(rowFor(r.it, r.n, term)); });
    els.bankList.textContent = '';
    els.bankList.appendChild(frag);

    if(!items.length){
      els.bankEmpty.textContent = 'Este dispositivo todavía no tiene preguntas. Escribe la primera en el formulario.';
      els.bankEmpty.hidden = false;
    } else if(!rows.length){
      els.bankEmpty.textContent = 'Ninguna pregunta coincide con “' + els.search.value.trim() + '”.';
      els.bankEmpty.hidden = false;
    } else {
      els.bankEmpty.hidden = true;
    }

    els.exportBtn.disabled = !items.length;
    els.clearAllBtn.disabled = !items.length;
  }

  function rowFor(it, n, term){
    var li = el('li', 'item');
    li.setAttribute('data-id', it.id);
    applyAccent(li, it.cat);
    if(it.id === editingId) li.classList.add('is-editing');

    var num = el('span', 'item-num', pad(n));
    num.setAttribute('aria-hidden', 'true');

    var cat = el('span', 'item-cat');
    cat.appendChild(el('span', 'sr-only', 'Pregunta ' + n + ', '));
    var catText = el('span');
    fillHighlighted(catText, catLabel(it.cat), term);
    cat.appendChild(catText);

    var actions = el('div', 'item-actions');
    var edit = el('button', 'icon-btn');
    edit.type = 'button';
    edit.setAttribute('data-action', 'edit');
    edit.setAttribute('aria-label', 'Editar la pregunta ' + n);
    edit.innerHTML = ICON_EDIT;
    var del = el('button', 'icon-btn is-danger');
    del.type = 'button';
    del.setAttribute('data-action', 'delete');
    del.setAttribute('aria-label', 'Eliminar la pregunta ' + n);
    del.innerHTML = ICON_TRASH;
    actions.appendChild(edit);
    actions.appendChild(del);

    var text = el('div', 'item-text');
    var q = el('p', 'item-q');
    fillHighlighted(q, it.q, term);
    var a = el('p', 'item-a');
    var aText = el('span');
    fillHighlighted(aText, it.a, term);
    a.appendChild(el('span', 'sr-only', 'Respuesta: '));
    a.appendChild(aText);
    text.appendChild(q);
    text.appendChild(a);

    li.appendChild(num);
    li.appendChild(cat);
    li.appendChild(actions);
    li.appendChild(text);
    return li;
  }

  function flashItem(id){
    var row = els.bankList.querySelector('[data-id="' + id + '"]');
    if(!row) return;
    row.classList.remove('flash');
    void row.offsetWidth;
    row.classList.add('flash');
  }

  els.bankList.addEventListener('click', function(e){
    var btn = e.target.closest('[data-action]');
    if(!btn) return;
    var row = btn.closest('[data-id]');
    if(!row) return;
    var id = row.getAttribute('data-id');
    if(btn.getAttribute('data-action') === 'edit') startEdit(id, false);
    else removeItem(id);
  });

  els.search.addEventListener('input', renderList);

  function removeItem(id){
    var i = items.findIndex(function(it){ return it.id === id; });
    if(i < 0) return;

    // ¿a dónde mover el foco cuando la fila desaparezca?
    var row = els.bankList.querySelector('[data-id="' + id + '"]');
    var neighbor = row && (row.nextElementSibling || row.previousElementSibling);
    var neighborId = neighbor && neighbor.getAttribute('data-id');

    var removed = items.splice(i, 1)[0];
    lastDeleted = { it:removed, index:i };
    if(editingId === id) resetEditor();
    saveItems();
    renderAll();

    var target = neighborId && els.bankList.querySelector('[data-id="' + neighborId + '"] [data-action="delete"]');
    (target || els.search).focus();

    toast('Pregunta ' + (i + 1) + ' eliminada.', { action:'Deshacer', onAction:undoDelete, duration:7000 });
  }

  function undoDelete(){
    if(!lastDeleted) return;
    var at = Math.min(lastDeleted.index, items.length);
    items.splice(at, 0, lastDeleted.it);
    var id = lastDeleted.it.id;
    lastDeleted = null;
    saveItems();
    renderAll();
    flashItem(id);
    toast('Pregunta restaurada.');
  }

  /* =========================================================
     Copia de seguridad (archivo .json, opcional y manual)
     ========================================================= */
  els.exportBtn.addEventListener('click', function(){
    if(!items.length) return;
    var data = {
      app: 'desafio-de-genios',
      version: 1,
      exportedAt: new Date().toISOString(),
      items: items.map(function(it){ return { cat:it.cat, q:it.q, a:it.a }; })
    };
    var blob = new Blob([JSON.stringify(data, null, 2)], { type:'application/json' });
    var url = URL.createObjectURL(blob);
    var link = document.createElement('a');
    link.href = url;
    link.download = 'desafio-de-genios-copia-' + today() + '.json';
    document.body.appendChild(link);
    link.click();
    link.remove();
    setTimeout(function(){ URL.revokeObjectURL(url); }, 1500);
    toast('Copia descargada con ' + plural(items.length, 'pregunta', 'preguntas') + '.');
  });

  els.importBtn.addEventListener('click', function(){ els.importInput.click(); });

  els.importInput.addEventListener('change', function(){
    var file = els.importInput.files && els.importInput.files[0];
    els.importInput.value = '';
    if(!file) return;
    if(file.size > 5 * 1024 * 1024){
      toast('Ese archivo es demasiado grande para ser una copia.');
      return;
    }
    var reader = new FileReader();
    reader.onload = function(){
      var incoming;
      try{
        var data = JSON.parse(String(reader.result || ''));
        incoming = sanitizeItems(Array.isArray(data) ? data : (data && data.items), true);
      }catch(e){ incoming = []; }

      if(!incoming.length){
        toast('Ese archivo no es una copia válida de Desafío de Genios.');
        return;
      }
      var keys = new Set(items.map(function(it){ return dupKey(it.q); }));
      var added = 0, repeated = 0;
      incoming.forEach(function(it){
        var k = dupKey(it.q);
        if(keys.has(k)){ repeated++; return; }
        keys.add(k);
        it.cat = canonicalCat(it.cat);
        items.push(it);
        added++;
      });
      if(added) saveItems();
      renderAll();

      if(!added){
        toast('Todas las preguntas de esa copia ya estaban en tu banco.');
      } else {
        toast('Se agregaron ' + plural(added, 'pregunta', 'preguntas') +
              (repeated ? '. ' + plural(repeated, 'ya estaba', 'ya estaban') + ' en tu banco.' : '.'));
      }
    };
    reader.onerror = function(){ toast('No se pudo leer el archivo.'); };
    reader.readAsText(file);
  });

  els.clearAllBtn.addEventListener('click', function(){
    if(!items.length) return;
    var n = items.length;
    confirmDialog(
      '¿Borrar ' + plural(n, 'pregunta', 'preguntas') + '?',
      'Se eliminarán de este dispositivo y no se pueden recuperar, salvo que tengas una copia descargada.',
      'Borrar todas'
    ).then(function(ok){
      if(!ok){ els.clearAllBtn.focus(); return; }
      items = [];
      lastDeleted = null;
      P.seen = new Set(); P.history = []; P.idx = -1; P.currentId = null; P.filter = null;
      saveItems();
      resetEditor();
      els.search.value = '';
      renderAll();
      toast('Se borraron todas las preguntas de este dispositivo.');
      els.fQ.focus();
    });
  });

  /* =========================================================
     Diálogo de confirmación
     ========================================================= */
  function confirmDialog(title, text, confirmLabel){
    return new Promise(function(resolve){
      if(typeof els.dlg.showModal !== 'function'){
        resolve(window.confirm(title + '\n\n' + text));
        return;
      }
      els.dlgTitle.textContent = title;
      els.dlgText.textContent = text;
      els.dlgConfirm.textContent = confirmLabel;
      els.dlg.returnValue = '';
      els.dlg.addEventListener('close', function onClose(){
        els.dlg.removeEventListener('close', onClose);
        resolve(els.dlg.returnValue === 'confirm');
      });
      els.dlg.showModal();
      els.dlgCancel.focus();
    });
  }

  // clic en el fondo oscuro = cancelar
  els.dlg.addEventListener('click', function(e){
    if(e.target === els.dlg) els.dlg.close('cancel');
  });

  /* =========================================================
     Avisos flotantes
     ========================================================= */
  var toastTimer = null, toastHandler = null, toastDuration = 3200;

  function toast(msg, opts){
    opts = opts || {};
    els.toastText.textContent = msg;
    toastHandler = opts.onAction || null;
    els.toastAction.hidden = !opts.action;
    els.toast.classList.toggle('has-action', !!opts.action);
    if(opts.action) els.toastAction.textContent = opts.action;
    toastDuration = opts.duration || 3200;
    announce(msg);
    els.toast.hidden = false;
    requestAnimationFrame(function(){ els.toast.classList.add('show'); });
    restartToastTimer();
  }

  function restartToastTimer(ms){
    clearTimeout(toastTimer);
    toastTimer = setTimeout(hideToast, ms || toastDuration);
  }

  function hideToast(){
    els.toast.classList.remove('show');
    setTimeout(function(){
      if(!els.toast.classList.contains('show')) els.toast.hidden = true;
    }, 300);
  }

  // Ctrl/Cmd + Z deshace el último borrado mientras el aviso sigue visible
  document.addEventListener('keydown', function(e){
    if(!(e.ctrlKey || e.metaKey) || e.shiftKey || (e.key !== 'z' && e.key !== 'Z')) return;
    var tag = e.target.tagName;
    if(tag === 'INPUT' || tag === 'TEXTAREA') return;
    if(!lastDeleted || !toastHandler || !els.toast.classList.contains('show')) return;
    e.preventDefault();
    els.toastAction.click();
  });

  els.toastAction.addEventListener('click', function(){
    var fn = toastHandler;
    toastHandler = null;
    hideToast();
    if(fn) fn();
  });
  // pausa el aviso mientras el puntero o el foco están encima
  els.toast.addEventListener('mouseenter', function(){ clearTimeout(toastTimer); });
  els.toast.addEventListener('mouseleave', function(){ restartToastTimer(2000); });
  els.toast.addEventListener('focusin', function(){ clearTimeout(toastTimer); });
  els.toast.addEventListener('focusout', function(){ restartToastTimer(2000); });

  /* =========================================================
     Render general
     ========================================================= */
  function renderAll(){
    els.tabCount.textContent = String(items.length);
    renderDatalist();
    renderList();
    syncPractice();
  }

  // Si el banco cambia en otra pestaña del MISMO navegador, se actualiza aquí también
  window.addEventListener('storage', function(e){
    if(e.key !== null && e.key !== STORE_KEY) return;
    items = loadItems();
    if(editingId && !byId(editingId)) resetEditor();
    renderAll();
  });

  /* =========================================================
     Inicio
     ========================================================= */
  if(!storageOK) els.storageWarning.hidden = false;
  updateSpeechButton();
  renderAll();

  var hash = (location.hash || '').replace('#', '');
  var startTab = (hash === 'practicar' || hash === 'preguntas') ? hash : (items.length ? 'practicar' : 'preguntas');
  setTab(startTab, { initial:true });

})();
