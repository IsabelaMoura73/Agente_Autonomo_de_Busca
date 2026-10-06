# Agente Autônomo de Busca 🥕

<!--
  📸 FOTO DO PROJETO
  1. Rode o projeto, deixe uma busca em andamento (ex.: tecla A ou E) e tire um print da tela.
  2. Crie a pasta "imagens" na raiz do repositório e salve o print como "demo.png".
     Estrutura esperada: imagens/demo.png
  3. Pronto: a linha <img> abaixo já aponta para esse arquivo.
  Dica: um GIF (imagens/demo.gif) mostra a animação da busca. Basta trocar o nome no src.
-->
<p align="center">
  <img src="https://github.com/IsabelaMoura73/Agente_Autonomo_de_Busca/blob/main/foto-agente.jpeg" alt="Coelho buscando a cenoura no mapa com visitados, fronteira e caminho destacados" width="500">
</p>

Agente coletor de comida em um grid gerado aleatoriamente com quatro tipos de terreno. O usuário escolhe a estratégia de busca, e o programa mostra a busca passo a passo: nós visitados, fronteira e caminho final. Depois, o coelho percorre o caminho até a cenoura, mais devagar nos terrenos caros.

Projeto da disciplina de Sistemas Inteligentes, Grupo 7.

## Como executar

O projeto usa [p5.js](https://p5js.org/) carregado por CDN. Não é preciso instalar nada, mas é preciso estar conectado à internet.

Não é preciso rodar nenhum servidor: basta abrir o `index.html` no navegador. No terminal, dentro da pasta do projeto:

```bash
open index.html        # macOS
xdg-open index.html    # Linux
start index.html       # Windows
```

Dependendo do seu SO, experimente também dar dois cliques no arquivo `index.html`.

> Clique uma vez no canvas para que ele receba o foco do teclado.

## Controles

| Tecla | Ação |
| --- | --- |
| `B` | Busca em Largura |
| `D` | Busca em Profundidade |
| `U` | Busca de Custo Uniforme |
| `G` | Busca Gulosa |
| `A` | A* (padrão ao iniciar) |
| `E` | Algoritmo Genético (desafio extra) |
| `+` / `−` | No A*: peso da heurística (1 a 5). No Genético: taxa de mutação (1% a 20%) |
| `R` | Gera um novo mapa aleatório |

## Terrenos

| Terreno | Custo de energia | Velocidade do agente |
| --- | --- | --- |
| Obstáculo | intransponível | — |
| Areia | 10 | rápida |
| Atoleiro | 50 | média |
| Água | 100 | lenta |

O mapa é gerado com ruído de Perlin (`noise`), para formar regiões contínuas de terreno, e cerca de 15% das células viram obstáculos. O agente e a cenoura nunca aparecem sobre um obstáculo.

## Algoritmos

| Algoritmo | Estrutura da fronteira | Função de avaliação | Caminho ótimo? |
| --- | --- | --- | --- |
| Largura (BFS) | Fila | — | Só em número de passos |
| Profundidade (DFS) | Pilha | — | Não |
| Custo Uniforme | Lista de prioridade | f(n) = g(n) | Sim |
| Gulosa | Lista de prioridade | f(n) = h(n) | Não |
| A* | Lista de prioridade | f(n) = g(n) + W·h(n) | Sim com W = 1 |
| Genético | População | fitness = custo + penalidade | Não garantido |

A heurística h(n) é a **distância de Manhattan** até a cenoura, multiplicada por 10, o custo do terreno mais barato.

### Cores na tela

- **Lilás:** nós visitados (no Genético, por onde a população passa)
- **Verde-água:** fronteira (no Genético, onde as rotas terminam)
- **Amarelo:** caminho final (no Genético, a melhor rota; tracejada enquanto ainda não chega na cenoura)

## Desafio extra: Algoritmo Genético

Cada indivíduo é uma rota codificada como uma sequência de movimentos (cima, direita, baixo, esquerda).

- **Decodificação:** movimentos contra obstáculos são ignorados, laços na rota são cortados e a simulação para ao chegar na cenoura.
- **Fitness (minimizar):** o custo de energia da rota. Rotas que não chegam recebem uma penalidade proporcional à distância de Manhattan que faltou.
- **Operadores:** seleção por torneio (3), cruzamento de um ponto (90%), mutação por gene (3%) e elitismo (2).
- **Parâmetros:** população inicial de 120 rotas aleatórias. A execução para após 60 gerações sem melhora ou no limite de 300 gerações.
- **Visualização:** uma geração a cada 3 frames. A linha de status indica a fase:
  - **Fase 1:** procurando a cenoura.
  - **Fase 2:** refinando a rota.

Em 200 mapas aleatórios, o AG alcançou a cenoura em 100% dos casos alcançáveis e encontrou a rota de custo ótimo em 83,5% deles. O custo médio ficou 3,7% acima do ótimo.

Os parâmetros ficam no objeto `AG` no início da seção do algoritmo genético em `sketch.js`.

## Estrutura do projeto

```
├── index.html      # carrega o p5.js e o sketch
├── sketch.js       # mapa, buscas, algoritmo genético, animação e interface
├── foto-agente.jpeg       # print usado no topo deste README  
├── relatorio/
│   └── relatorio_post_mortem.tex   # relatório de post-mortem em LaTeX
└── README.md
```

## Integrantes

| Integrante | Projeto principal | Desafio extra (Algoritmo Genético) |
| --- | --- | --- |
| Davi Dubeux (dld2) | Custo Uniforme, representação do mapa e movimentação | Visualização da evolução (mapa de calor e linha de status) e integração da melhor rota com a movimentação |
| Gabriel Alves (gagm) | DFS, estrutura da fronteira e estados visitados | Representação do cromossomo, decodificação das rotas e corte de laços |
| Isabela Moura (immn) | A*, integração dos algoritmos e ajustes de parâmetros | Integração do modo genético, ajuste de parâmetros e testes comparativos com o Custo Uniforme |
| Karina Lima (klo) | BFS, sistema de custos dos terrenos | Função de fitness: custo de energia das rotas e penalidade por distância |
| Lara Luchi (lvl) | Busca Gulosa, heurística e distância de Manhattan | Operadores genéticos: torneio, cruzamento, mutação e elitismo |

## Relatório

O relatório de post-mortem (desafios, divisão do trabalho e arquitetura) está em [`relatorio/relatorio_post_mortem.tex`](relatorio/relatorio_post_mortem.tex). Para gerar o PDF, compile com pdfLaTeX, por exemplo no [Overleaf](https://www.overleaf.com/).

## Referências

- [Introduction to the A* Algorithm — Red Blob Games](https://www.redblobgames.com/pathfinding/a-star/introduction.html)
- [Documentação do p5.js](https://p5js.org/reference/)
