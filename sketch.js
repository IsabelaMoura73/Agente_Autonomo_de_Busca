const COLS = 32, ROWS = 20, S = 34, HUD = 185;
// tipo 0 = obstáculo, 1 = areia, 2 = atoleiro, 3 = água
const CUSTO = [Infinity, 10, 50, 100];
const COR = [[34, 0, 50], [238, 218, 180], [206, 160, 175], [140, 180, 235]];
const FUNDO = [80, 0, 109];
const NOME = { B: 'Largura', D: 'Profundidade', U: 'Custo Uniforme', G: 'Gulosa', A: 'A*', E: 'Genético' };
const ESTRUTURA = { B: 'Fila', D: 'Pilha', U: 'Lista Prioridade', G: 'Lista Prioridade', A: 'Lista Prioridade', E: 'População' };

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
  constructor(prio) { this.H = [null]; this.cnt = 0; this.prio = prio; }
  menor(a, b) { return a.f < b.f || (a.f === b.f && a.d < b.d); }
  // Desce o nó i até achar sua posição (sift-down).
  bottomUpHeapify(i) {
    let H = this.H, v = H[i];
    while (2 * i <= this.cnt) {
      let j = 2 * i;
      if (j < this.cnt && this.menor(H[j + 1], H[j])) j++; // menor filho
      if (!this.menor(H[j], v)) break;
      H[i] = H[j]; i = j;
    }
    H[i] = v;
  }
  // Sobe o nó i enquanto for menor que o pai
  topDownHeapify(i) {
    let H = this.H, v = H[i];
    while (i > 1 && this.menor(v, H[i >> 1])) { H[i] = H[i >> 1]; i >>= 1; }
    H[i] = v;
  }
  push(n) {
    let [f, d] = this.prio(n);
    this.H[++this.cnt] = { n, f, d };
    this.topDownHeapify(this.cnt);
  }
  pop() {
    let topo = this.H[1];
    this.H[1] = this.H[this.cnt];
    this.H.length = this.cnt--;
    if (this.cnt > 0) this.bottomUpHeapify(1);
    return topo.n;
  }
  get length() { return this.cnt; }
  itens() { return this.H.slice(1).map(e => e.n); }
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
  if (algo === 'E') return 'fitness = custo + 100·h(fim)';
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
  if (algo === 'E') { iniciarAG(); return; }
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
  if (algo === 'E') return passoAG();
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

// ---------- Algoritmo Genético (desafio extra) ----------
//
// Cromossomo: sequência de L genes, cada gene é um movimento (0 = cima, 1 = direita, 2 = baixo, 3 = esquerda).
// Decodificação: o agente simula os movimentos a partir da posição atual. Movimento para fora do mapa
// ou para um obstáculo é ignorado (gene "neutro"). Se a rota passa duas vezes pela mesma célula,
// o laço é cortado. A simulação para quando chega na comida.
// Fitness (minimizar): se chegou, é o custo de energia da rota; se não chegou, recebe uma penalidade
// grande somada à distância de Manhattan que faltou (100·h) e ao custo gasto.
// Operadores: seleção por torneio, cruzamento de um ponto, mutação gene a gene e elitismo.
// Cada geração é um passo da animação (um frame).

const AG = {
  POP: 120,       // tamanho da população
  MAX_GER: 300,   // limite de gerações por cenoura
  ESTAG: 60,      // gerações sem melhora (depois de achar a cenoura) para encerrar
  ELITE: 2,       // melhores indivíduos copiados sem alteração
  TORNEIO: 3,     // indivíduos sorteados em cada torneio
  CROSS: 0.9,     // probabilidade de cruzamento
  GUIADOS: 0,     // fração da população inicial com viés na direção da comida (0 = toda aleatória, evolução visível)
  // --- só visualização ---
  QUADROS: 3,     // frames por geração (deixa a evolução visível ao observador)
  MOSTRAR: 8,     // quantas das melhores rotas da geração desenhar
  MEMORIA: 0.7,   // quanto o mapa de calor "lembra" das gerações anteriores (0 a 1)
  PAUSA: 30       // frames mostrando a rota final antes do coelho andar
};
const DIRS = [[0, -1], [1, 0], [0, 1], [-1, 0]];
let mut = 0.03;   // taxa de mutação por gene (ajustável com − / +)
let populacao = [], ger = 0, melhor = null, semMelhora = 0, L = 0, avaliacoes = 0;
let calor = {}, finais = new Map(), hInicial = 1, gerMelhora = 0, gerChegou = -1, espera = 0;

const livre = p => p.x >= 0 && p.y >= 0 && p.x < COLS && p.y < ROWS && grid[p.x][p.y] !== 0;

function iniciarAG() {
  g = {}; pai = {}; caminho = [];
  let dist = abs(agente.x - comida.x) + abs(agente.y - comida.y);
  L = min(COLS * ROWS, 3 * dist + 30);
  populacao = [];
  for (let i = 0; i < AG.POP; i++) {
    populacao.push(avaliar(i < AG.POP * AG.GUIADOS ? genomaGuiado() : genomaAleatorio()));
  }
  populacao.sort((a, b) => a.fitness - b.fitness);
  melhor = populacao[0];
  ger = 0; semMelhora = 0; avaliacoes = AG.POP;
  calor = {}; hInicial = max(1, heuristica(agente)); gerMelhora = 0;
  gerChegou = melhor.chegou ? 0 : -1;
  atualizarVisualAG();
  estado = 'busca';
}

function genomaAleatorio() {
  let genes = [];
  for (let i = 0; i < L; i++) genes.push(floor(random(4)));
  return genes;
}

// Passeio aleatório com tendência a se aproximar da comida (60% das vezes escolhe um passo que reduz h).
function genomaGuiado() {
  let genes = [], p = { x: agente.x, y: agente.y };
  for (let i = 0; i < L; i++) {
    let d = floor(random(4));
    if (random() < 0.6) {
      let bons = [];
      for (let j = 0; j < 4; j++) {
        let n = { x: p.x + DIRS[j][0], y: p.y + DIRS[j][1] };
        if (livre(n) && heuristica(n) < heuristica(p)) bons.push(j);
      }
      if (bons.length > 0) d = bons[floor(random(bons.length))];
    }
    genes.push(d);
    let n = { x: p.x + DIRS[d][0], y: p.y + DIRS[d][1] };
    if (livre(n)) p = n;
  }
  return genes;
}

function avaliar(genes) {
  let p = { x: agente.x, y: agente.y };
  let rota = [p], posicao = new Map([[kid(p), 0]]), chegou = false;
  for (let d of genes) {
    let n = { x: p.x + DIRS[d][0], y: p.y + DIRS[d][1] };
    if (!livre(n)) continue;              // gene neutro
    let k = kid(n);
    if (posicao.has(k)) {                 // laço: volta a rota até a primeira passagem
      let j = posicao.get(k);
      for (let r = j + 1; r < rota.length; r++) posicao.delete(kid(rota[r]));
      rota.length = j + 1;
    } else {
      posicao.set(k, rota.length);
      rota.push(n);
    }
    p = n;
    if (n.x === comida.x && n.y === comida.y) { chegou = true; break; }
  }
  let custo = 0;
  for (let i = 1; i < rota.length; i++) custo += CUSTO[grid[rota[i].x][rota[i].y]];
  let fitness = chegou ? custo : 100000 + 100 * heuristica(p) + custo;
  return { genes, rota, fim: p, chegou, custo, fitness };
}

function torneio() {
  let vencedor = null;
  for (let i = 0; i < AG.TORNEIO; i++) {
    let c = populacao[floor(random(populacao.length))];
    if (vencedor === null || c.fitness < vencedor.fitness) vencedor = c;
  }
  return vencedor;
}

function cruzar(a, b) {
  if (random() > AG.CROSS) return a.genes.slice();
  let corte = 1 + floor(random(L - 1));
  return a.genes.slice(0, corte).concat(b.genes.slice(corte));
}

function mutar(genes) {
  for (let i = 0; i < genes.length; i++) if (random() < mut) genes[i] = floor(random(4));
  return genes;
}

function passoAG() {
  let nova = populacao.slice(0, AG.ELITE);
  while (nova.length < AG.POP) nova.push(avaliar(mutar(cruzar(torneio(), torneio()))));
  nova.sort((a, b) => a.fitness - b.fitness);
  populacao = nova;
  ger++;
  avaliacoes += AG.POP - AG.ELITE;
  if (populacao[0].fitness < melhor.fitness) {
    melhor = populacao[0]; semMelhora = 0; gerMelhora = ger;
    if (melhor.chegou && gerChegou < 0) gerChegou = ger;
  }
  else semMelhora++;
  atualizarVisualAG();
  let acabou = ger >= AG.MAX_GER || semMelhora >= 2 * AG.ESTAG || (melhor.chegou && semMelhora >= AG.ESTAG);
  if (acabou) {
    caminho = melhor.chegou ? melhor.rota.slice() : [];
    return true;
  }
  return false;
}

// Visualização do AG:
// - mapa de calor: fração da população que passa por cada célula, com memória das gerações
//   anteriores (média móvel). Em vez de piscar, ele "se concentra" aos poucos na rota escolhida.
// - finais: onde as rotas terminam, agrupadas por célula (círculo maior = mais indivíduos).
// - caminho: melhor rota até agora (tracejada enquanto não chega na cenoura).
function atualizarVisualAG() {
  let cont = {};
  for (let ind of populacao) for (let c of ind.rota) { let k = kid(c); cont[k] = (cont[k] || 0) + 1; }
  let novo = {};
  for (let k in calor) novo[k] = calor[k] * AG.MEMORIA;
  for (let k in cont) novo[k] = (novo[k] || 0) + (1 - AG.MEMORIA) * cont[k] / AG.POP;
  calor = {};
  for (let k in novo) if (novo[k] > 0.01) calor[k] = novo[k];
  fechados = new Set(Object.keys(calor));
  finais = new Map();
  for (let ind of populacao) { let k = kid(ind.fim); finais.set(k, (finais.get(k) || 0) + 1); }
  fronteira = { length: 0, itens: () => [] };
  caminho = melhor.rota;
}

function custoRota(r) {
  let c = 0;
  for (let i = 1; i < r.length; i++) c += CUSTO[grid[r[i].x][r[i].y]];
  return c;
}

function draw() {
  if (estado === 'busca') {
    // AG: uma geração a cada QUADROS frames; na fase 1 (ainda sem chegar) vai na metade da velocidade
    let vez = algo !== 'E' || frameCount % (melhor.chegou ? AG.QUADROS : 2 * AG.QUADROS) === 0;
    if (vez && passo()) {
      if (caminho.length === 0) novaComida();
      else if (algo === 'E') { estado = 'mostra'; espera = AG.PAUSA; }
      else { estado = 'move'; idx = 1; prog = 0; }
    }
  } else if (estado === 'mostra') { // AG: segura a rota final na tela antes do coelho andar
    if (--espera <= 0) { estado = 'move'; idx = 1; prog = 0; }
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
  else if (key === '+' || key === '=') {
    if (algo === 'E') mut = min(0.2, mut + 0.01);
    else { W = min(5, W + 0.5); if (algo === 'A') iniciarBusca(); }
  }
  else if (key === '-' || key === '_') {
    if (algo === 'E') mut = max(0.01, mut - 0.01);
    else { W = max(1, W - 0.5); if (algo === 'A') iniciarBusca(); }
  }
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
        noStroke(); fill(72, 20, 98);
        ellipse(x * S + S / 2, y * S + S / 2 + 2, S * 0.62, S * 0.5);
        stroke(FUNDO);
      }
    }
  }
  noStroke();
  if (algo === 'E') desenharAG();
  else {
    fill(165, 125, 255, 160);
    for (let k of fechados) {
      let [x, y] = k.split(',').map(Number);
      rect(x * S, y * S, S, S, 5);
    }
    fill(90, 215, 185, 245);
    for (let n of fronteira.itens()) {
      if (!fechados.has(kid(n))) circle(n.x * S + S / 2, n.y * S + S / 2, S * 0.4);
    }
  }
  if (caminho.length > 1) {
    let tracejado = algo === 'E' && !melhor.chegou;
    stroke(255, 222, 130);
    strokeWeight(algo === 'E' && estado === 'mostra' ? 6 + 2 * sin(frameCount * 0.4) : 6);
    if (tracejado) drawingContext.setLineDash([10, 8]);
    noFill();
    beginShape();
    for (let p of caminho) vertex(p.x * S + S / 2, p.y * S + S / 2);
    endShape();
    drawingContext.setLineDash([]);
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

function desenharAG() {
  // mapa de calor: quanto mais indivíduos passam pela célula, mais forte o lilás
  for (let k in calor) {
    let [x, y] = k.split(',').map(Number);
    fill(165, 125, 255, 235 * min(1, calor[k] / 0.35)); // 35% ou mais da população = cor cheia
    rect(x * S, y * S, S, S, 5);
  }
  if (estado !== 'busca') return;
  // as melhores rotas da geração atual, mais opacas quanto melhor o indivíduo
  noFill();
  strokeWeight(2);
  for (let i = min(AG.MOSTRAR, populacao.length) - 1; i >= 0; i--) {
    stroke(255, 255, 255, 150 - 110 * i / AG.MOSTRAR);
    beginShape();
    for (let p of populacao[i].rota) vertex(p.x * S + S / 2, p.y * S + S / 2);
    endShape();
  }
  // onde as rotas terminam: um círculo por célula, tamanho pela quantidade de indivíduos
  noStroke();
  for (let [k, n] of finais) {
    let [x, y] = k.split(',').map(Number);
    let peso = min(1, sqrt(n / AG.POP) * 2);
    fill(90, 215, 185, 90 + 165 * peso);
    circle(x * S + S / 2, y * S + S / 2, S * (0.16 + 0.5 * peso));
  }
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
  fill(64, 0, 88);
  rect(0, y0, COLS * S, HUD);
  fill(124, 40, 166);
  rect(0, y0, COLS * S, 2);

  let teclas = ['B', 'D', 'U', 'G', 'A', 'E', 'R'];
  let nomes = { ...NOME, R: 'Novo mapa' };
  let x = 16;
  textSize(17);
  for (let k of teclas) {
    let ativo = (k === 'R') ? flashR > 0 : (k === algo);
    tecla(k, x, y0 + 14, ativo);
    textAlign(LEFT, CENTER);
    textSize(17);
    fill(ativo ? color(255, 222, 130) : color(225, 215, 245));
    text(nomes[k], x + 42, y0 + 30);
    x += 42 + textWidth(nomes[k]) + 22;
  }
  if (flashR > 0) flashR--;

  textAlign(LEFT, CENTER);
  textSize(17);
  fill(225, 200, 245);
  text('Estrutura:', 16, y0 + 76);
  text('Função:', 290, y0 + 76);
  fill(240);
  text(ESTRUTURA[algo], 104, y0 + 76);
  text(formula(), 360, y0 + 76);
  if (algo === 'A' || algo === 'E') {
    let xp = 360 + textWidth(formula()) + 36;
    let rotulo = algo === 'A' ? 'Peso da heurística (− / +):' : 'Mutação (− / +):';
    let valor = algo === 'A' ? nf(W, 1, 1) : round(mut * 100) + '%';
    fill(225, 200, 245);
    text(rotulo, xp, y0 + 76);
    fill(255, 222, 130);
    text(valor, xp + textWidth(rotulo) + 8, y0 + 76);
  }
  textAlign(RIGHT, CENTER);
  textSize(18);
  fill(255, 190, 140);
  text('Cenouras: ' + score, COLS * S - 16, y0 + 66);
  textSize(14);
  fill(225, 200, 245);
  if (algo === 'E') text('Geração: ' + ger + '  |  Avaliados: ' + avaliacoes, COLS * S - 16, y0 + 90);
  else text('Expandidos: ' + fechados.size, COLS * S - 16, y0 + 90);

  textAlign(LEFT, CENTER);
  textSize(15);
  let lx = 16;
  let rotulos = algo === 'E'
    ? ['Passagem da população', 'Fim das rotas', 'Melhor rota']
    : ['Visitados', 'Fronteira', 'Caminho'];
  lx = legenda([165, 125, 255], rotulos[0], lx, y0 + 122);
  lx = legenda([90, 215, 185], rotulos[1], lx, y0 + 122);
  lx = legenda([255, 222, 130], rotulos[2], lx, y0 + 122);
  lx = legenda(COR[0], 'Obstáculo', lx, y0 + 122);
  lx = legenda(COR[1], 'Areia (10)', lx, y0 + 122);
  lx = legenda(COR[2], 'Atoleiro (50)', lx, y0 + 122);
  legenda(COR[3], 'Água (100)', lx, y0 + 122);

  // linha de status: explica ao observador o que está acontecendo agora
  let ys = y0 + 160;
  fill(124, 40, 166);
  rect(16, ys - 20, COLS * S - 32, 1);
  textSize(15);
  textAlign(LEFT, CENTER);
  if (algo === 'E') statusAG(ys);
  else if (estado !== 'busca' && caminho.length > 1) {
    fill(255, 222, 130);
    text('Caminho encontrado: custo ' + custoRota(caminho) + '  ·  ' + (caminho.length - 1) + ' passos', 16, ys);
  } else {
    fill(225, 200, 245);
    text('Buscando… cada frame expande um nó da fronteira', 16, ys);
  }
}

// Fase 1: a população ainda não chegou na cenoura (barra = quanto o melhor já se aproximou).
// Fase 2: já chegou e agora reduz o custo (barra = gerações sem melhora até encerrar).
function statusAG(ys) {
  let msg, frac, corBarra, barra;
  if (estado !== 'busca') {
    msg = 'Rota final: custo ' + melhor.custo + ' em ' + ger + ' gerações — o coelho vai seguir a melhor rota';
    frac = 1; corBarra = color(255, 222, 130); barra = '';
  } else if (!melhor.chegou) {
    let falta = heuristica(melhor.fim) / 10;
    msg = 'Fase 1 · procurando a cenoura — o melhor indivíduo parou a ' + falta + (falta === 1 ? ' casa' : ' casas') + ' dela';
    frac = 1 - heuristica(melhor.fim) / hInicial;
    corBarra = color(90, 215, 185); barra = 'aproximação';
  } else {
    msg = 'Fase 2 · cenoura encontrada na geração ' + gerChegou + ', refinando a rota — custo ' + melhor.custo +
      ' (última melhora na geração ' + gerMelhora + ')';
    frac = semMelhora / AG.ESTAG;
    corBarra = color(255, 190, 140); barra = 'sem melhora ' + semMelhora + '/' + AG.ESTAG;
  }
  fill(240);
  text(msg, 16, ys);
  let bw = 180, bx = COLS * S - 16 - bw;
  fill(34, 0, 50);
  rect(bx, ys - 6, bw, 12, 6);
  fill(corBarra);
  rect(bx, ys - 6, bw * constrain(frac, 0, 1), 12, 6);
  if (barra) {
    textAlign(RIGHT, CENTER);
    textSize(13);
    fill(225, 200, 245);
    text(barra, bx - 10, ys);
  }
}

function legenda(cor, rotulo, x, y) {
  noStroke();
  fill(cor);
  rect(x, y - 9, 18, 18, 4);
  fill(236, 238, 248);
  text(rotulo, x + 26, y);
  return x + 26 + textWidth(rotulo) + 28;
}

function tecla(letra, x, y, ativo) {
  noStroke();
  fill(ativo ? color(200, 165, 80) : color(34, 0, 50));
  rect(x, y + 4, 32, 32, 7);
  fill(ativo ? color(255, 222, 130) : color(112, 30, 152));
  rect(x, y, 32, 32, 7);
  fill(ativo ? color(70, 60, 85) : color(245));
  textAlign(CENTER, CENTER);
  textSize(17);
  text(letra, x + 16, y + 16);
}