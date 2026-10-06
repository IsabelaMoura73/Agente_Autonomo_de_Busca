const COLS = 32, ROWS = 20, S = 34, HUD = 150;
// tipo 0 = obstáculo, 1 = areia, 2 = atoleiro, 3 = água
const CUSTO = [Infinity, 10, 50, 100];
const COR = [[48, 50, 70], [238, 218, 180], [206, 160, 175], [140, 180, 235]];
const FUNDO = [20, 22, 32];
const NOME = { B: 'Largura', D: 'Profundidade', U: 'Custo Uniforme', G: 'Gulosa', A: 'A*' };
const ESTRUTURA = { B: 'Fila', D: 'Pilha', U: 'Lista Prioridade', G: 'Lista Prioridade', A: 'Lista Prioridade' };

let grid, agente, comida, algo = 'A', estado;
let g, pai, fronteira, fechados, caminho, idx, prog, score = 0;
let flashR = 0;
let W = 2;

// ---------- Estruturas da fronteira ----------

// Largura: FIFO
class Fila {
  constructor() { this.a = []; this.ini = 0; }
  push(n) { this.a.push(n); }
  pop() { return this.a[this.ini++]; }
  get length() { return this.a.length - this.ini; }
  itens() { return this.a.slice(this.ini); }
}

// Profundidade: LIFO
class Pilha {
  constructor() { this.a = []; }
  push(n) { this.a.push(n); }
  pop() { return this.a.pop(); }
  get length() { return this.a.length; }
  itens() { return this.a; }
}

// Custo Uniforme / Gulosa / A*: heap binário mínimo.
// prio(n) devolve [f, desempate]; empate em f sai o de menor h (o mais perto da comida).
class ListaPrioridade {
  constructor(prio) { this.h = []; this.prio = prio; }
  menor(i, j) {
    let a = this.h[i], b = this.h[j];
    return a.f < b.f || (a.f === b.f && a.d < b.d);
  }
  troca(i, j) { [this.h[i], this.h[j]] = [this.h[j], this.h[i]]; }
  push(n) {
    let [f, d] = this.prio(n);
    this.h.push({ n, f, d });
    let i = this.h.length - 1;
    while (i > 0) {
      let p = (i - 1) >> 1;
      if (!this.menor(i, p)) break;
      this.troca(i, p); i = p;
    }
  }
  pop() {
    let topo = this.h[0], ult = this.h.pop();
    if (this.h.length > 0) {
      this.h[0] = ult;
      let i = 0;
      for (;;) {
        let e = 2 * i + 1, d = e + 1, m = i;
        if (e < this.h.length && this.menor(e, m)) m = e;
        if (d < this.h.length && this.menor(d, m)) m = d;
        if (m === i) break;
        this.troca(i, m); i = m;
      }
    }
    return topo.n;
  }
  get length() { return this.h.length; }
  itens() { return this.h.map(e => e.n); }
}

function novaFronteira() {
  if (algo === 'B') return new Fila();
  if (algo === 'D') return new Pilha();
  if (algo === 'U') return new ListaPrioridade(n => [g[kid(n)], heuristica(n)]);
  if (algo === 'G') return new ListaPrioridade(n => [heuristica(n), g[kid(n)]]);
  return new ListaPrioridade(n => [g[kid(n)] + W * heuristica(n), heuristica(n)]);
}

function formula() {
  if (algo === 'U') return 'f(n) = g(n)';
  if (algo === 'G') return 'f(n) = h(n)';
  if (algo === 'A') return 'f(n) = g(n) + ' + nf(W, 1, 1) + '·h(n)';
  return '—';
}

// ---------- Mapa e busca ----------

function setup() {
  createCanvas(COLS * S, ROWS * S + HUD);
  frameRate(30);
  textFont('system-ui, -apple-system, Segoe UI, sans-serif');
  novoMapa();
}

function novoMapa() {
  noiseSeed(random(10000));
  grid = [];
  for (let x = 0; x < COLS; x++) {
    grid[x] = [];
    for (let y = 0; y < ROWS; y++) {
      let v = noise(x * 0.15, y * 0.15);
      let t = v < 0.3 ? 3 : v < 0.45 ? 2 : 1;
      if (random() < 0.15) t = 0;
      grid[x][y] = t;
    }
  }
  score = 0;
  agente = celulaLivre();
  novaComida();
}

function celulaLivre() {
  let p;
  do { p = { x: floor(random(COLS)), y: floor(random(ROWS)) }; } while (grid[p.x][p.y] === 0);
  return p;
}

function novaComida() {
  do { comida = celulaLivre(); } while (comida.x === agente.x && comida.y === agente.y);
  iniciarBusca();
}

function iniciarBusca() {
  g = {}; pai = {}; fechados = new Set(); caminho = [];
  let k0 = kid(agente);
  g[k0] = 0; pai[k0] = null;
  fronteira = novaFronteira();
  fronteira.push({ x: agente.x, y: agente.y });
  estado = 'busca';
}

const kid = p => p.x + ',' + p.y;
const heuristica = p => 10 * (abs(p.x - comida.x) + abs(p.y - comida.y));

function passo() {
  if (fronteira.length === 0) { caminho = []; return true; } // sem solução
  let cur = fronteira.pop();
  let k = kid(cur);
  if (fechados.has(k)) return false;
  fechados.add(k);
  if (cur.x === comida.x && cur.y === comida.y) { montarCaminho(); return true; }
  for (let [dx, dy] of [[0, -1], [1, 0], [0, 1], [-1, 0]]) {
    let n = { x: cur.x + dx, y: cur.y + dy };
    if (n.x < 0 || n.y < 0 || n.x >= COLS || n.y >= ROWS) continue;
    let t = grid[n.x][n.y];
    if (t === 0) continue;
    let nk = kid(n), ng = g[k] + CUSTO[t];
    if (fechados.has(nk)) continue;
    if (algo === 'B' || algo === 'D' || algo === 'G') { if (nk in g) continue; }
    else if (nk in g && g[nk] <= ng) continue;
    g[nk] = ng; pai[nk] = k;
    fronteira.push(n);
  }
  return false;
}

function montarCaminho() {
  let k = kid(comida), p = [];
  while (k !== null) {
    let [x, y] = k.split(',').map(Number);
    p.unshift({ x, y });
    k = pai[k];
  }
  caminho = p;
}

function draw() {
  if (estado === 'busca') {
    if (passo()) {
      if (caminho.length === 0) novaComida();
      else { estado = 'move'; idx = 1; prog = 0; }
    }
  } else if (estado === 'move') {
    if (idx >= caminho.length) {
      score++;
      agente = { x: comida.x, y: comida.y };
      novaComida();
    } else {
      let dest = caminho[idx];
      prog += 1 / (CUSTO[grid[dest.x][dest.y]] * 0.4);
      if (prog >= 1) { agente = { x: dest.x, y: dest.y }; idx++; prog = 0; }
    }
  }
  desenhar();
}

function keyPressed() {
  let k = key.toUpperCase();
  if (k === 'R') { novoMapa(); flashR = 12; }
  else if (NOME[k]) { algo = k; iniciarBusca(); }
  else if (key === '+' || key === '=') { W = min(5, W + 0.5); if (algo === 'A') iniciarBusca(); }
  else if (key === '-' || key === '_') { W = max(1, W - 0.5); if (algo === 'A') iniciarBusca(); }
}

// ---------- Desenho ----------

function desenhar() {
  background(FUNDO);
  stroke(FUNDO);
  strokeWeight(1.5);
  for (let x = 0; x < COLS; x++) {
    for (let y = 0; y < ROWS; y++) {
      fill(COR[grid[x][y]]);
      rect(x * S, y * S, S, S, 5);
      if (grid[x][y] === 0) { // pedra
        noStroke(); fill(82, 84, 110);
        ellipse(x * S + S / 2, y * S + S / 2 + 2, S * 0.62, S * 0.5);
        stroke(FUNDO);
      }
    }
  }
  noStroke();
  fill(165, 125, 255, 160);
  for (let k of fechados) {
    let [x, y] = k.split(',').map(Number);
    rect(x * S, y * S, S, S, 5);
  }
  fill(90, 215, 185, 245);
  for (let n of fronteira.itens()) {
    if (!fechados.has(kid(n))) circle(n.x * S + S / 2, n.y * S + S / 2, S * 0.4);
  }
  if (caminho.length > 1) {
    stroke(255, 222, 130);
    strokeWeight(6);
    noFill();
    beginShape();
    for (let p of caminho) vertex(p.x * S + S / 2, p.y * S + S / 2);
    endShape();
    noStroke();
  }

  let cx = comida.x * S + S / 2, cy = comida.y * S + S / 2;
  noFill(); stroke(255, 190, 140, 220); strokeWeight(3);
  circle(cx, cy, S * (1.1 + 0.25 * sin(frameCount * 0.15)));
  desenharCenoura(cx, cy, S * 1.1);

  let ax = agente.x, ay = agente.y;
  if (estado === 'move' && idx < caminho.length) {
    ax = lerp(agente.x, caminho[idx].x, prog);
    ay = lerp(agente.y, caminho[idx].y, prog);
  }
  desenharCoelho(ax * S + S / 2, ay * S + S / 2, S * 1.25);
  desenharHUD();
}

function desenharCoelho(cx, cy, s) {
  push();
  translate(cx, cy + s * 0.08);
  strokeJoin(ROUND);
  noStroke(); fill(0, 0, 0, 110);
  ellipse(0, s * 0.36, s * 0.7, s * 0.18);
  stroke(80, 70, 95); strokeWeight(2); fill(255);
  ellipse(-s * 0.15, -s * 0.28, s * 0.19, s * 0.48);
  ellipse(s * 0.15, -s * 0.28, s * 0.19, s * 0.48);
  noStroke(); fill(255, 190, 210);
  ellipse(-s * 0.15, -s * 0.27, s * 0.08, s * 0.32);
  ellipse(s * 0.15, -s * 0.27, s * 0.08, s * 0.32);
  stroke(80, 70, 95); strokeWeight(2); fill(255);
  ellipse(0, s * 0.1, s * 0.6, s * 0.5);
  noStroke(); fill(70, 60, 85);
  circle(-s * 0.12, s * 0.05, s * 0.09);
  circle(s * 0.12, s * 0.05, s * 0.09);
  fill(255); circle(-s * 0.105, s * 0.035, s * 0.03); circle(s * 0.135, s * 0.035, s * 0.03);
  fill(245, 140, 175);
  triangle(-s * 0.05, s * 0.14, s * 0.05, s * 0.14, 0, s * 0.2);
  fill(255, 160, 190, 160);
  circle(-s * 0.2, s * 0.17, s * 0.09); circle(s * 0.2, s * 0.17, s * 0.09);
  pop();
}

function desenharCenoura(cx, cy, s) {
  push();
  translate(cx, cy);
  rotate(-PI / 8);
  strokeJoin(ROUND);
  stroke(70, 120, 80); strokeWeight(2); fill(160, 225, 165);
  ellipse(-s * 0.1, -s * 0.3, s * 0.13, s * 0.3);
  ellipse(s * 0.1, -s * 0.3, s * 0.13, s * 0.3);
  ellipse(0, -s * 0.34, s * 0.13, s * 0.34);
  stroke(170, 95, 60); fill(255, 178, 120);
  triangle(-s * 0.21, -s * 0.17, s * 0.21, -s * 0.17, 0, s * 0.45);
  stroke(225, 130, 85);
  line(-s * 0.1, -s * 0.02, s * 0.03, -s * 0.02);
  line(-s * 0.02, s * 0.14, s * 0.08, s * 0.14);
  pop();
}

function desenharHUD() {
  let y0 = ROWS * S;
  noStroke();
  fill(30, 33, 48);
  rect(0, y0, COLS * S, HUD);
  fill(60, 64, 90);
  rect(0, y0, COLS * S, 2);

  let teclas = ['B', 'D', 'U', 'G', 'A', 'R'];
  let nomes = { B: NOME.B, D: NOME.D, U: NOME.U, G: NOME.G, A: NOME.A, R: 'Novo mapa' };
  for (let i = 0; i < teclas.length; i++) {
    let k = teclas[i];
    let x = 16 + i * 178;
    let ativo = (k === 'R') ? flashR > 0 : (k === algo);
    tecla(k, x, y0 + 14, ativo);
    textAlign(LEFT, CENTER);
    textSize(17);
    fill(ativo ? color(255, 222, 130) : color(200, 205, 225));
    text(nomes[k], x + 42, y0 + 30);
  }
  if (flashR > 0) flashR--;

  textAlign(LEFT, CENTER);
  textSize(17);
  fill(200, 204, 228);
  text('Estrutura:', 16, y0 + 76);
  text('Função:', 290, y0 + 76);
  fill(240);
  text(ESTRUTURA[algo], 104, y0 + 76);
  text(formula(), 360, y0 + 76);
  if (algo === 'A') {
    fill(200, 204, 228);
    text('Peso da heurística (− / +):', 610, y0 + 76);
    fill(255, 222, 130);
    text(nf(W, 1, 1), 830, y0 + 76);
  }
  textAlign(RIGHT, CENTER);
  textSize(18);
  fill(255, 190, 140);
  text('Cenouras: ' + score, COLS * S - 16, y0 + 66);
  textSize(14);
  fill(200, 204, 228);
  text('Expandidos: ' + fechados.size, COLS * S - 16, y0 + 90);

  textAlign(LEFT, CENTER);
  textSize(15);
  legenda([165, 125, 255], 'Visitados', 16, y0 + 122);
  legenda([90, 215, 185], 'Fronteira', 136, y0 + 122);
  legenda([255, 222, 130], 'Caminho', 256, y0 + 122);
  legenda(COR[0], 'Obstáculo', 400, y0 + 122);
  legenda(COR[1], 'Areia (10)', 520, y0 + 122);
  legenda(COR[2], 'Atoleiro (50)', 648, y0 + 122);
  legenda(COR[3], 'Água (100)', 798, y0 + 122);
}

function legenda(cor, rotulo, x, y) {
  noStroke();
  fill(cor);
  rect(x, y - 9, 18, 18, 4);
  fill(236, 238, 248);
  text(rotulo, x + 26, y);
}

function tecla(letra, x, y, ativo) {
  noStroke();
  fill(ativo ? color(200, 165, 80) : color(12, 14, 22));
  rect(x, y + 4, 32, 32, 7);
  fill(ativo ? color(255, 222, 130) : color(64, 70, 100));
  rect(x, y, 32, 32, 7);
  fill(ativo ? color(70, 60, 85) : color(245));
  textAlign(CENTER, CENTER);
  textSize(17);
  text(letra, x + 16, y + 16);
}
