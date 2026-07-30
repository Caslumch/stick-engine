# Handoff — implementando o STICK no projeto existente

Como entregar o design system, o protótipo e o orb pro seu agente de código, sem que ele porte a coisa
errada. Escrito pra Claude Code / Cursor / Codex — o que muda entre eles é só o nome do arquivo de
contexto permanente.

---

## 1. Os três artefatos e o papel de cada um

Esta é a parte que mais dá errado: o agente trata os três como se fossem a mesma coisa e sai portando o
HTML linha por linha pro React. Deixe o papel de cada um explícito logo no primeiro prompt.

**`DESIGN_SYSTEM.md` — é a lei.** Vai pro arquivo de contexto permanente do seu agente (`CLAUDE.md` no
Claude Code, `AGENTS.md` no Codex, `.cursorrules` ou `.cursor/rules/` no Cursor). Não cole o conteúdo
inteiro lá dentro: coloque o arquivo no repo, em `docs/DESIGN_SYSTEM.md`, e no arquivo de contexto
escreva a regra de leitura obrigatória (o texto está na seção 5 aqui embaixo). Assim ele entra em toda
sessão sem inflar o contexto de tarefas que não são de UI.

**`stick.html` — é espec visual, não é código-fonte.** O agente deve **ler e traduzir**, nunca copiar a
estrutura. O HTML tem um shell inteiro em DOM plano, estado em variáveis globais e um orb em canvas 2D
que é só placeholder — portar isso pro seu projeto seria importar dívida técnica de graça. Guarde em
`docs/reference/stick.html` e diga ao agente, com essas palavras: *isto é uma referência visual e de
timing; a arquitetura do projeto é a que já existe*.

**O projeto do orb — manda no resto, e vive em outro repo.** O design se adapta ao orb, não o contrário.
Se ele já expõe props com nomes diferentes dos do documento, mantenha os seus e mapeie; renomear a API de
um componente que funciona pra casar com um `.md` é a troca errada.

Como os dois projetos são separados, existe uma etapa a mais antes da integração — a extração — e ela tem
uma pegadinha própria. Está na Fase 4a.

### O que vale copiar quase literal do HTML

Cinco trechos são especificação exata, não sugestão — os valores foram ajustados olhando o resultado, e
mexer neles quebra o efeito. Aponte esses cinco explicitamente pro agente:

1. A receita `.g` do vidro, incluindo os dois `inset` e o `::after` especular.
2. A camada `.tint` radial do fundo (o gradiente, não uma opacidade uniforme).
3. Os tempos do morph do create button e da cápsula de gravação (`.5s`, delay de `.15s`, stagger `.026`).
4. O `drawWave()` inteiro — larguras, rampa de alfa, raio da barra, taxa de 45ms.
5. O lerp de estado do orb: `k = 1 - Math.pow(0.0015, dt)`.

---

## 2. Antes de qualquer código: o prompt de reconhecimento

Seu projeto já existe, então o primeiro prompt não pode ser "implemente". Peça um relatório e **proíba
edição** nessa rodada — sem isso o agente começa a mexer antes de entender, e você perde a chance de
corrigir o plano barato.

São dois repos, então são duas sessões de reconhecimento. Comece pelo do agente.

**No repo do agente:**

```
Leia o projeto e me devolva um relatório, sem editar nenhum arquivo.

Preciso saber:
1. Onde vive o estado do agente hoje (voz, chat, conexão) e como ele chega nos componentes.
2. Como a estilização é feita hoje (CSS modules, Tailwind, styled-components, inline).
3. Quais telas existem e quais componentes de UI já são reaproveitáveis.
4. O que está acoplado ao design atual e vai resistir à troca.
5. As versões de react, three, @react-three/fiber e @react-three/drei no package.json,
   se existirem.

Responda em texto corrido, apontando arquivos e linhas. Não proponha refatoração ainda.
```

**No repo do orb** (pode ser depois, junto com a Fase 4a):

```
Leia o projeto e me diga, sem editar nada: onde está o componente do orb, o que ele renderiza,
quem é dono do <Canvas>, quais parâmetros já são configuráveis por fora, e quais dependências
são de cena/demo e não fazem parte do orb em si.
```

---

## 3. A regra que evita o desastre

Não troque o design de uma vez. Peça pro agente construir o sistema novo **em paralelo** — `styles/tokens.css`,
`ui/`, `theme/` — com o app antigo funcionando, e migrar **uma tela por vez**, começando pela de voz.
Se algo quebrar, você sabe exatamente onde.

Coloque essa frase no prompt de cada fase: *o app precisa continuar rodando ao final desta etapa*.

---

## 4. Os prompts, em ordem

Cada bloco é uma sessão. Não emende duas — o valor de parar entre fases é você olhar antes de seguir.

### Fase 1 — tokens e tema

```
Leia docs/DESIGN_SYSTEM.md, seções 4 e 13, e docs/reference/stick.html.

Crie styles/tokens.css com as custom properties do design system, incluindo os dois blocos de tema
(html[data-theme="dark"] e html[data-theme="light"]) exatamente com os valores do documento.

Crie um ThemeProvider que:
- aceita 'dark' | 'light' | 'auto'
- escreve data-theme no <html>
- em 'auto', lê prefers-color-scheme e reage a mudanças
- persiste a escolha

Não altere nenhum componente existente ainda. Ao final, o app deve rodar igual, só com o CSS novo
carregado e sem efeito visual.
```

### Fase 2 — vidro e fundo

```
Implemente a camada de fundo (manchas + tint radial + camada opcional de imagem) e o primitivo de vidro,
conforme as seções 2, 2.1 e 3 do design system.

Copie a receita .g e o gradiente do .tint literalmente do stick.html — os valores foram calibrados.
A primeira mancha deve usar var(--accent-rgb) para acompanhar o estado.

Entregue como <Backdrop /> montado uma vez no topo da app e um componente ou classe <Glass>.
Me mostre uma página de sandbox com três placas de vidro em cima do fundo, nos dois temas.
```

### Fase 3 — estado do agente

```
Refatore o estado do agente para a máquina da seção 7 do design system: idle, listening, thinking,
executing, speaking, error, offline.

O provider deve expor { state, amplitude, transcript } e escrever --accent e --accent-rgb no <html>
a cada transição. Nenhum componente deve importar a cor de um estado diretamente — todos leem
var(--accent).

Mantenha a integração real que já existe (websocket/API); só reorganize os estados por baixo.
```

### Fase 4a — extrair o orb (rodar **no repo do orb**)

O orb vive em outro projeto, e quase certamente esse projeto é dono do próprio `<Canvas>` — porque ele
foi feito pra rodar sozinho, com câmera, luz, controles de debug e cenário de demo. No app do agente,
quem tem que ser dono do `<Canvas>` é o app: ele monta uma vez, nunca desmonta e atravessa as três telas.

Essa é a única refatoração de verdade que o orb precisa: **separar a malha da cena**. O que você quer
exportar é um componente que renderiza só o `<points>` e os materiais, sem `<Canvas>`, sem `OrbitControls`,
sem GUI, e que receba tudo por props.

```
Este projeto é uma cena isolada do orb. Preciso extrair o orb como componente reutilizável para
outro app, que será o dono do <Canvas>.

Crie uma pasta orb/ auto-contida com:
- Orb.tsx exportando um componente que renderiza APENAS a malha (points/mesh + material).
  Sem <Canvas>, sem controles de câmera, sem GUI de debug, sem luzes de cenário.
- os shaders e utilitários de geometria que ele usa
- um index.ts exportando o componente e os tipos de props
- um README curto com: props aceitas, dependências de peer (three, @react-three/fiber e versões),
  e o que o app hospedeiro precisa prover (câmera, postprocessing, dpr)

Props: color, amp, freq, rot, spread — ou os nomes que já existirem aqui; mantenha os atuais e
documente o mapeamento.

Mantenha a cena de demo funcionando neste repo, agora consumindo orb/. Se ela continuar rodando
igual depois da extração, a extração está certa.

Me diga também as versões exatas de three, @react-three/fiber, @react-three/drei,
@react-three/postprocessing e react usadas aqui.
```

Com a pasta `orb/` pronta, escolha como levar pro outro projeto. Pra projeto pessoal, **copiar a pasta**
costuma ser a resposta certa: zero infra, e o repo do orb continua sendo seu laboratório. Se você mexe no
orb com frequência e não quer copiar toda vez, instale por URL de git (`pnpm add github:usuario/orb`), que
te dá atualização por versão sem montar monorepo. Submódulo eu evitaria — o custo de manutenção não paga
num projeto de uma pessoa só.

Antes de copiar, confira as versões que ele te reportou contra as do app do agente. Incompatibilidade de
React 18/19 ou de R3F v8/v9 entre os dois projetos é a causa mais comum de "importei e a tela ficou preta",
e é muito mais fácil resolver agora do que depois de integrar.

### Fase 4b — integrar (rodar **no repo do agente**)

```
Adicionei o componente do orb em src/orb/ (extraído de outro projeto — não o reescreva).

1. Monte um único <Canvas> no topo da app, que não desmonta ao trocar de tela.
   dpr={[1, 1.75]}, sem sombras, sem antialias.
2. Faça a ponte de estado: mapeie cada estado da máquina para os cinco parâmetros da tabela da
   seção 7 do design system e interpole no useFrame com k = 1 - Math.pow(0.0015, dt).
   Os cinco valores nunca são setados direto.
3. O orb muda de tamanho e posição entre a tela de voz e o modo ambiente apenas por escala e
   câmera — nunca remontando.

Atenção ao tema claro: blending aditivo estoura sobre fundo claro. No claro, troque para
NormalBlending, escureça a cor do ponto (~0.42x) e derrube o bloom. Seção 4 do documento.

Confirme com um log no unmount que o Canvas não remonta ao navegar entre as três telas.
```

### Fase 5 — tela de voz

```
Monte a tela de voz conforme a seção 11: orb centralizado com o plate radial atrás, nome do estado,
frase em 22px peso 300, dock com o microfone ao centro e os secundários em colunas de largura fixa.

O microfone não pode mudar de posição quando Cancel/Interrupt aparecem — use grid de colunas fixas e
visibility:hidden nos ausentes, nunca display:none.

Substitua a tela de voz antiga. O resto do app continua no design antigo.
```

### Fase 6 — cápsula de gravação

```
Implemente a cápsula de gravação da seção 10 (o componente que nasce do botão de microfone).

O drawWave() do stick.html é especificação: copie larguras, gaps, raio, rampa de alfa e taxa de 45ms.

Ligue no áudio real: um AnalyserNode (fftSize 256) alimenta os dois consumidores, mas
- o orb recebe a amplitude suavizada (ataque 0.5, decaimento 0.08)
- a waveform recebe a amplitude crua

Reaproveite o mesmo componente dentro do composer do chat, com raio e altura menores.
```

### Fase 7 — chat, settings e o resto

```
Migre as telas de chat e settings conforme as seções 10 e 11.
Chat: bolha de vidro pro usuário, texto sem caixa pro agente com o ponto de estado como avatar,
card de tool call, composer de vidro, mask-image no fim da rolagem.
Settings: grupos em cards de vidro, Appearance primeiro.
```

### Fase 8 — paleta de comandos e modo ambiente

```
Implemente ⌘K e o modo ambiente conforme a seção 10.
Na paleta: interceptar ⌘K antes de qualquer outro handler, e dar blur() no input ao fechar
(senão o próximo atalho de tecla única é engolido pelo campo).
Popule os comandos com as ações que o agente realmente tem hoje, não com placeholders.
```

---

## 5. O que colar no arquivo de contexto permanente

Isto vai no `CLAUDE.md` / `AGENTS.md` / `.cursorrules`. É curto de propósito — regras longas são ignoradas.

```markdown
## Design

A referência normativa de UI é docs/DESIGN_SYSTEM.md. Leia antes de qualquer tarefa que toque
em componente, estilo, cor, animação ou layout. docs/reference/stick.html é espec visual e de
timing — traduza, não porte a arquitetura.

Invariantes, em qualquer alteração:

1. Nenhum componente usa a cor de um estado diretamente. Todos leem var(--accent).
2. Nenhum valor de cor, raio, espaço ou duração é escrito literal. Sempre token.
3. O <Canvas> do orb monta uma vez e nunca desmonta.
4. Vidro não empilha: nada com backdrop-filter dentro de algo com backdrop-filter.
5. Opacidade e cor animam por duração + ease. Posição, escala e layout animam por spring.
6. Todo estado do agente tem nome escrito na tela; cor nunca é o único canal.
7. Superfície flutuante não encosta na borda da janela, e área rolável tem mask-image no fim.
8. Ao adicionar um estado novo, ele precisa definir as cinco colunas da tabela da seção 7.
   Se não definir, não é um estado — é variação de outro.
```

---

## 6. Armadilhas — avise antes, não depois

Todas estas apareceram de fato durante a construção do protótipo. Cole a lista no prompt da fase
correspondente; é mais barato do que descobrir depois.

**Orb some no tema claro.** Blending aditivo sobre fundo claro satura em branco. Fase 4.

**Estilo inline ganha do CSS.** No protótipo, `mic.style.opacity = 1` setado por JS venceu a regra
`html[data-state="listening"] .mic{opacity:0}` e deixou um botão fantasma atrás da cápsula. Se você
controla uma propriedade por estado, controle **num lugar só** — ou tudo em CSS por atributo, ou tudo em
JS. Fase 6.

**`clip-path` precisa animar o raio junto com a caixa.** Ir de `inset(... round 44px)` para
`round 26px`; se o raio ficar fixo, o canto estala no meio do morph. Fase 6 e 8.

**Nome de classe genérico colide.** No protótipo, `.grp` da paleta pegou o estilo do `.grp` de settings e
abriu um buraco de 16px no meio da lista. Namespace nos componentes novos. Fase 8.

**`display:none` colapsa o grid.** Botão secundário ausente tem que ser `visibility:hidden`, senão o
microfone pula de posição. Fase 5.

**Waveform lisa denuncia a simulação.** Jitter por amostra, sinal cru. Fase 6.

**`prefers-reduced-motion`** não é opcional: springs viram 120ms, o orb congela em amplitude média, as
manchas param. Peça junto na fase 2, não no fim.

---

## 7. Critérios de aceite

Peça pro agente verificar cada um antes de dizer que terminou. São todos observáveis — nada de "ficou
bom".

- Trocar o tema com a app aberta não pisca, não perde estado, e o orb continua legível nos dois.
- Forçar cada um dos sete estados muda ao mesmo tempo: orb, mancha do fundo, ponto do status, nome do
  estado, avatar do chat e botão de enviar.
- Navegar entre as três telas não remonta o `<Canvas>` (confirme com um log no unmount).
- Gravar, descartar e gravar de novo: o timer zera e a waveform começa vazia.
- Buscar na paleta, fechar com esc e apertar `A` em seguida: o modo ambiente abre (teste do blur).
- Rodar com uma foto pesada de fundo no tema claro: o texto continua legível no dim padrão.
- `prefers-reduced-motion: reduce` ligado no sistema: nada mais gira, pulsa ou desliza.

---

## 8. Como pedir a revisão no fim

```
Compare a implementação com docs/DESIGN_SYSTEM.md e liste onde divergimos, separando em
(a) divergência proposital que devemos documentar no .md, e
(b) divergência acidental que devemos corrigir no código.

Não corrija nada ainda. Só a lista.
```

Esse último passo é o que mantém o documento vivo. Design system que não é atualizado quando o código
diverge vira ficção em duas semanas — e aí o agente passa a seguir uma lei que ninguém obedece mais.