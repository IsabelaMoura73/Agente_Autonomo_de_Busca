const COLS = 32, ROWS = 20, S = 30;
// tipo 0 = obstáculo, 1 = areia, 2 = atoleiro, 3 = água
const CUSTO = [Infinity, 10, 50, 100];
const COR = [[120, 75, 115], [255, 231, 217], [205, 155, 170], [170, 195, 245]];
const NOME = { B: 'Largura', D: 'Profundidade', U: 'Custo Uniforme', G: 'Gulosa', A: 'A*' };

let grid, agente, comida, algo = 'A', estado;
let g, pai, fronteira, fechados, caminho, idx, prog, score = 0;

function setup() {
  createCanvas(COLS * S, ROWS * S + 30);
  frameRate(30);
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
  fronteira = [{ x: agente.x, y: agente.y }];
  estado = 'busca';
}

const kid = p => p.x + ',' + p.y;
const heuristica = p => 10 * (abs(p.x - comida.x) + abs(p.y - comida.y));

function escolher() {
  if (algo === 'B') return 0;
  if (algo === 'D') return fronteira.length - 1;
  let melhor = 0, menorValor = Infinity;
  for (let i = 0; i < fronteira.length; i++) {
    let n = fronteira[i], v;
    if (algo === 'U') v = g[kid(n)];
    else if (algo === 'G') v = heuristica(n);
    else v = g[kid(n)] + heuristica(n);
    if (v < menorValor) { menorValor = v; melhor = i; }
  }
  return melhor;
}

function passo() {
  if (fronteira.length === 0) { caminho = []; return true; } // sem solução
  let cur = fronteira.splice(escolher(), 1)[0];
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

function desenhar() {
  background(255, 236, 245);
  stroke(255, 255, 255, 120);
  for (let x = 0; x < COLS; x++) {
    for (let y = 0; y < ROWS; y++) {
      fill(COR[grid[x][y]]);
      rect(x * S, y * S, S, S, 6);
    }
  }
  noStroke();
  fill(185, 140, 235, 140);
  for (let k of fechados) {
    let [x, y] = k.split(',').map(Number);
    rect(x * S, y * S, S, S, 6);
  }
  fill(255, 80, 160, 220);
  for (let n of fronteira) {
    if (!fechados.has(kid(n))) {
      rect(n.x * S + 5, n.y * S + 5, S - 10, S - 10, 8);
    }
  }
  fill(255, 205, 60, 240);
  for (let p of caminho) {
    rect(p.x * S + 8, p.y * S + 8, S - 16, S - 16, 10);
  }
  textAlign(CENTER, CENTER);
  textSize(S * 0.8);
  text('🥕', comida.x * S + S / 2, comida.y * S + S / 2 + 2);
  let ax = agente.x, ay = agente.y;
  if (estado === 'move' && idx < caminho.length) {
    ax = lerp(agente.x, caminho[idx].x, prog);
    ay = lerp(agente.y, caminho[idx].y, prog);
  }
  text('🐰', ax * S + S / 2, ay * S + S / 2 + 2);
  fill(200, 60, 130);
  textSize(15);
  textAlign(LEFT, CENTER);
  text(`${NOME[algo]}  |  Comidas: ${score}  |  B D U G A = trocar, R = novo mapa`, 10, ROWS * S + 15);
}
function keyPressed() {
  let k = String.fromCharCode(keyCode);
  if (k === 'R') novoMapa();
  else if (NOME[k]) { algo = k; iniciarBusca(); }
}
