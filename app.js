// Gincana 3D - PWA
// Lógica baseada no app original: 10 baús (marcadores), pergunta por baú,
// +100 pontos por acerto, cronômetro, baú já respondido não conta de novo.

const PONTOS_ACERTO = 100;
const NUM_BAUS = 10;
const $ = (id) => document.getElementById(id);

const estado = {
  temas: [],
  tema: null,
  respondidos: {},   // { nBau: 'acertou' | 'errou' }
  pontos: 0,
  inicio: 0,
  timer: null,
  modalAberto: false,
  ultimaLeitura: 0,
  mind: null,
};

/* ---------- utilidades ---------- */
function mostrarTela(id) {
  document.querySelectorAll('.tela').forEach((t) => t.classList.remove('ativa'));
  $(id).classList.add('ativa');
}
function toast(msg, ms = 2200) {
  const t = $('toast');
  t.textContent = msg;
  t.classList.remove('oculto');
  clearTimeout(toast._t);
  toast._t = setTimeout(() => t.classList.add('oculto'), ms);
}
function fmtTempo(seg) {
  const m = String(Math.floor(seg / 60)).padStart(2, '0');
  const s = String(seg % 60).padStart(2, '0');
  return `${m}:${s}`;
}
function embaralhar(arr) {
  const a = arr.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}
const lerRanking = () => { try { return JSON.parse(localStorage.getItem('gincana-ranking') || '{}'); } catch { return {}; } };
const salvarRanking = (r) => { try { localStorage.setItem('gincana-ranking', JSON.stringify(r)); } catch {} };

/* ---------- termos ---------- */
function iniciarTermos() {
  let aceitou = false;
  try { aceitou = localStorage.getItem('gincana-termos') === '1'; } catch {}
  if (aceitou) return irParaTemas();
  $('aceito').addEventListener('change', (e) => ($('btn-aceitar').disabled = !e.target.checked));
  $('btn-aceitar').addEventListener('click', () => {
    try { localStorage.setItem('gincana-termos', '1'); } catch {}
    irParaTemas();
  });
}

/* ---------- temas ---------- */
function irParaTemas() {
  const box = $('lista-temas');
  box.innerHTML = '';
  estado.temas.forEach((t) => {
    const b = document.createElement('button');
    b.className = 'tema' + (t.padrao ? ' padrao' : '');
    b.innerHTML = `<span>${t.nome}</span><small>${t.perguntas.length} perguntas</small>`;
    b.addEventListener('click', () => iniciarJogo(t));
    box.appendChild(b);
  });
  desenharRanking();
  mostrarTela('tela-temas');
}
function desenharRanking() {
  const r = lerRanking();
  const box = $('ranking');
  box.innerHTML = '';
  let tem = false;
  estado.temas.forEach((t) => {
    const lista = r[t.id];
    if (!lista || !lista.length) return;
    tem = true;
    const m = lista[0];
    const d = document.createElement('div');
    d.innerHTML = `<span>${t.nome}</span><span>${m.pontos} pts &middot; ${fmtTempo(m.tempo)}</span>`;
    box.appendChild(d);
  });
  if (!tem) box.textContent = 'Nenhuma partida ainda.';
}

/* ---------- jogo ---------- */
function iniciarJogo(tema) {
  estado.tema = tema;
  estado.respondidos = {};
  estado.pontos = 0;
  estado.modalAberto = false;
  estado.inicio = Date.now();
  atualizarPlacar();
  desenharGrade();
  $('aviso-ar').classList.remove('oculto');
  $('aviso-ar').textContent = 'Você pode escolher qualquer baú para começar';
  $('painel-manual').classList.add('oculto');
  mostrarTela('tela-jogo');
  clearInterval(estado.timer);
  estado.timer = setInterval(atualizarPlacar, 500);
  iniciarAR();
}
function totalPerguntas() { return Math.min(NUM_BAUS, estado.tema.perguntas.length); }
function atualizarPlacar() {
  $('pontos').textContent = estado.pontos;
  $('progresso').textContent = `${Object.keys(estado.respondidos).length}/${totalPerguntas()}`;
  $('tempo').textContent = fmtTempo(Math.floor((Date.now() - estado.inicio) / 1000));
}
function desenharGrade() {
  const g = $('grade-baus');
  g.innerHTML = '';
  for (let n = 1; n <= NUM_BAUS; n++) {
    const b = document.createElement('button');
    b.textContent = n;
    b.className = estado.respondidos[n] || '';
    b.addEventListener('click', () => { $('painel-manual').classList.add('oculto'); lerBau(n); });
    g.appendChild(b);
  }
}

// Chamado quando a câmera reconhece um baú (ou quando o jogador toca no modo manual)
function lerBau(n) {
  if (estado.modalAberto) return;
  const agora = Date.now();
  if (agora - estado.ultimaLeitura < 1200) return;
  estado.ultimaLeitura = agora;

  if (n > estado.tema.perguntas.length) {
    return toast(`O baú ${n} não tem pergunta neste tema.`);
  }
  if (estado.respondidos[n] === 'acertou') return toast('Você já acertou este baú. Procure outro!');
  if (estado.respondidos[n] === 'errou') return toast('Você já errou este baú. Procure outro!');
  abrirPergunta(n);
}

function abrirPergunta(n) {
  const p = estado.tema.perguntas[n - 1];
  estado.modalAberto = true;
  $('aviso-ar').classList.add('oculto');
  $('q-bau').textContent = `Baú ${n}`;
  $('q-texto').textContent = p.q;
  $('q-feedback').classList.add('oculto');
  $('q-continuar').classList.add('oculto');
  const box = $('q-respostas');
  box.innerHTML = '';
  const opcoes = embaralhar(p.a.map((texto, i) => ({ texto, certa: i === p.c })));
  opcoes.forEach((o) => {
    const b = document.createElement('button');
    b.className = 'resp';
    b.textContent = o.texto;
    b.addEventListener('click', () => responder(n, o, opcoes, box));
    box.appendChild(b);
  });
  $('modal-pergunta').classList.remove('oculto');
}

function responder(n, escolhida, opcoes, box) {
  const botoes = [...box.children];
  botoes.forEach((b, i) => {
    b.disabled = true;
    if (opcoes[i].certa) b.classList.add('certa');
  });
  const fb = $('q-feedback');
  if (escolhida.certa) {
    estado.respondidos[n] = 'acertou';
    estado.pontos += PONTOS_ACERTO;
    fb.className = 'feedback ok';
    fb.textContent = `Você acertou e ganhou mais ${PONTOS_ACERTO} Pontos!! Vá para o próximo baú`;
  } else {
    estado.respondidos[n] = 'errou';
    botoes[opcoes.indexOf(escolhida)].classList.add('errada');
    fb.className = 'feedback no';
    fb.textContent = 'Você errou e não ganhou ponto!! Vá para o próximo baú';
  }
  fb.classList.remove('oculto');
  atualizarPlacar();
  desenharGrade();
  const fim = Object.keys(estado.respondidos).length >= totalPerguntas();
  const c = $('q-continuar');
  c.textContent = fim ? 'Ver resultado' : 'Continuar';
  c.classList.remove('oculto');
  c.onclick = () => {
    $('modal-pergunta').classList.add('oculto');
    estado.modalAberto = false;
    estado.ultimaLeitura = Date.now();
    if (fim) finalizar();
    else { $('aviso-ar').textContent = 'Procure outro baú'; $('aviso-ar').classList.remove('oculto'); }
  };
}

function finalizar() {
  clearInterval(estado.timer);
  pararAR();
  const tempo = Math.floor((Date.now() - estado.inicio) / 1000);
  const acertos = Object.values(estado.respondidos).filter((x) => x === 'acertou').length;
  const r = lerRanking();
  const lista = r[estado.tema.id] || [];
  const anterior = lista[0];
  const recorde = estado.pontos > 0 && (!anterior || estado.pontos > anterior.pontos ||
    (estado.pontos === anterior.pontos && tempo < anterior.tempo));
  lista.push({ pontos: estado.pontos, tempo, data: Date.now() });
  lista.sort((a, b) => b.pontos - a.pontos || a.tempo - b.tempo);
  r[estado.tema.id] = lista.slice(0, 5);
  salvarRanking(r);
  $('final-tema').textContent = estado.tema.nome;
  $('final-pontos').textContent = estado.pontos;
  $('final-acertos').textContent = `${acertos}/${totalPerguntas()}`;
  $('final-tempo').textContent = fmtTempo(tempo);
  $('final-recorde').classList.toggle('oculto', !recorde);
  mostrarTela('tela-final');
}

function sair() {
  clearInterval(estado.timer);
  pararAR();
  $('modal-pergunta').classList.add('oculto');
  estado.modalAberto = false;
  irParaTemas();
}

/* ---------- AR (MindAR) ---------- */
// Usa targets.mind (gerado em compilar.html a partir de baus/bau1.jpg ... bau10.jpg).
// A ordem das imagens no .mind é a ordem dos baús: índice 0 = baú 1.
async function iniciarAR() {
  const aviso = $('aviso-ar');
  try {
    const existe = await fetch('targets.mind', { method: 'HEAD' }).then((r) => r.ok).catch(() => false);
    if (!existe) {
      aviso.textContent = 'Câmera indisponível: falta o arquivo targets.mind. Use o modo "Sem câmera".';
      return;
    }
    const { MindARThree } = await import('mindar-image-three');
    const mind = new MindARThree({
      container: $('ar-container'),
      imageTargetSrc: 'targets.mind',
      maxTrack: 1,
      uiLoading: 'no',
      uiScanning: 'no',
      uiError: 'no',
    });
    for (let i = 0; i < NUM_BAUS; i++) {
      const anchor = mind.addAnchor(i);
      anchor.onTargetFound = () => lerBau(i + 1);
    }
    estado.mind = mind;
    await mind.start();
    mind.renderer.setAnimationLoop(() => mind.renderer.render(mind.scene, mind.camera));
  } catch (e) {
    console.error(e);
    aviso.textContent = 'Não foi possível abrir a câmera. Use o modo "Sem câmera".';
    estado.mind = null;
  }
}
function pararAR() {
  const m = estado.mind;
  estado.mind = null;
  if (!m) return;
  try { m.renderer.setAnimationLoop(null); m.stop(); } catch (e) { console.warn(e); }
  $('ar-container').innerHTML = '';
}

/* ---------- inicialização ---------- */
async function init() {
  const resp = await fetch('data/temas.json');
  estado.temas = (await resp.json()).temas;
  $('btn-sair').addEventListener('click', sair);
  $('btn-manual').addEventListener('click', () => { desenharGrade(); $('painel-manual').classList.remove('oculto'); });
  $('btn-fechar-manual').addEventListener('click', () => $('painel-manual').classList.add('oculto'));
  $('btn-de-novo').addEventListener('click', () => iniciarJogo(estado.tema));
  $('btn-temas').addEventListener('click', irParaTemas);
  $('btn-limpar-ranking').addEventListener('click', () => {
    if (confirm('Apagar o ranking deste aparelho?')) { salvarRanking({}); desenharRanking(); }
  });
  iniciarTermos();
  if ('serviceWorker' in navigator) navigator.serviceWorker.register('sw.js').catch(console.warn);
}
init();
