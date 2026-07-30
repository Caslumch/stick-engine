# STICK — Design System

Interface pessoal de comunicação com agente: voz, chat e configurações.
Linguagem visual: superfícies de vidro sobre um fundo de manchas de cor desfocadas, cantos generosos,
tipografia em Inter sentence-case. O orb de partículas (React Three Fiber) é o único elemento vivo.

- **Versão:** 2.0 — direção glassmorphism (substitui a v1 "terminal")
- **Stack:** React + Vite · React Three Fiber (orb já existente) · Motion for React (`motion/react`) · CSS custom properties
- **UI em inglês, sentence-case.** Documentação em português.

---

## 1. O que mudou da v1, e por quê

Três coisas davam à v1 uma cara de cenário de filme, e as três saíram:

Fundo preto absoluto com vinheta e grain. Vidro só existe se houver algo colorido atrás para refratar —
sobre preto, um painel translúcido é indistinguível de um painel cinza. O fundo agora tem quatro manchas
de cor desfocadas em movimento lento, e o preto foi reduzido a uma camada que escurece o miolo da tela.

Mono em caixa alta com tracking largo em toda label. Isso é tipografia de HUD. Agora Inter em caixa
normal faz todo o trabalho de linguagem, e a mono aparece só onde é literalmente máquina: nome de
ferramenta, payload, latência, valores numéricos.

Cantos retos e hairlines de 1px. A geometria agora é arredondada (14 a 26px), com bordas claras de
`rgba(255,255,255,.14)` que leem como o canto de uma placa de vidro real, não como um traço de wireframe.

O que **não** mudou: cor é informação, não decoração. A UI inteira é neutra e o único canal de cor é o
estado do agente.

---

## 2. Fundo — a camada que faz o vidro funcionar

Quatro manchas radiais, borradas em 80px, saturadas, animadas em ciclos de 26 a 40 segundos
dessincronizados. Sobre elas, uma camada escura **radial**: ~93% de opacidade no centro, caindo para 40%
nas bordas.

Essa camada radial é a peça de engenharia do layout. O miolo escuro dá contraste para o orb (que emite
luz e precisa de escuridão para brilhar), enquanto as bordas — exatamente onde ficam a navegação, o
composer, os pills de status e os cards — mantêm cor viva por baixo do vidro. Um `.tint` de opacidade
uniforme mataria o efeito inteiro; foi o erro da primeira tentativa.

A primeira mancha usa `var(--accent-rgb)`: ela troca de cor junto com o estado do agente, com transição
de 900ms. É o que faz a tela inteira "virar violeta" quando o agente pensa, sem pintar nada explicitamente.

```css
.bg{position:fixed;inset:-14%;filter:blur(80px) saturate(130%);z-index:0}
.b1{background:radial-gradient(circle,rgba(var(--accent-rgb),.62),transparent 66%);transition:background .9s}
.tint{position:fixed;inset:0;z-index:1;
  background:radial-gradient(52% 46% at 50% 42%,rgba(11,16,14,.93),rgba(11,16,14,.74) 58%,rgba(11,16,14,.40) 100%)}
```

### 2.1 Camada de imagem

Abaixo das manchas existe uma camada opcional de imagem: `background-size: cover`, com `blur` e uma
sobreposição da cor base cuja opacidade é o "dim". Os dois são controláveis pelo usuário, e existem por
um motivo prático — foto de fundo é o jeito mais fácil de destruir a legibilidade de uma interface de
vidro. Padrões: blur 18px, dim 55%.

Quando há imagem, as manchas de cor recuam para 35% de opacidade. Sem isso as duas camadas competem e o
resultado fica sujo.

```css
.photo{position:fixed;inset:-6%;background-size:cover;filter:blur(var(--bg-blur))}
.photo::after{content:"";position:absolute;inset:0;background:var(--bg);opacity:var(--bg-dim)}
```

Presets são gradientes CSS (nenhum asset externo); "Custom" lê um arquivo local via `FileReader` e vira
`data:` URL. Numa app real, guarde o arquivo, não o data URL — base64 em `localStorage` estoura rápido.

---

## 3. Vidro

Uma receita só, usada em tudo. O que varia é o raio, nunca a fórmula.

```css
.g{
  background:linear-gradient(150deg,rgba(255,255,255,.11),rgba(255,255,255,.045) 42%,rgba(255,255,255,.07));
  backdrop-filter:blur(36px) saturate(190%);
  border:1px solid rgba(255,255,255,.14);
  box-shadow:
    0 1px 0 rgba(255,255,255,.16) inset,   /* luz na aresta superior */
    0 -1px 0 rgba(0,0,0,.20) inset,        /* sombra na inferior — dá espessura */
    0 18px 50px -20px rgba(0,0,0,.5);
}
.g::after{                                  /* brilho especular diagonal */
  content:"";position:absolute;inset:0;border-radius:inherit;pointer-events:none;
  background:linear-gradient(160deg,rgba(255,255,255,.14),transparent 34%);
  opacity:.5;mix-blend-mode:overlay;
}
```

Três detalhes que separam vidro convincente de "div com opacidade": o gradiente do `background` não é
uniforme (vidro real varia ao longo da superfície); o `saturate(190%)` puxa a cor do fundo para dentro
da placa; e o par de `inset` claro/escuro dá espessura à borda.

Não empilhe vidro sobre vidro. As células da grade do create button são `rgba(255,255,255,.04)` sólido
dentro de um painel de vidro — se cada célula tivesse `backdrop-filter`, o resultado vira leite.

---

## 4. Cor e temas

O tema é um atributo no `<html>` (`data-theme="dark" | "light"`), com uma terceira opção `auto` que
apenas lê `prefers-color-scheme` e escreve um dos dois. Todo componente lê variáveis; nenhum componente
sabe em que tema está.

O que muda entre os temas não é só claridade — é a **direção da luz do vidro**. No escuro, a placa é
branco a 4–11% com aresta superior clara; no claro, é branco a 44–78% com aresta quase opaca e sombra
mais suave e esverdeada. Copiar os mesmos alfas dos dois lados dá um claro cinzento e sem vida.

| Token | Escuro | Claro |
|---|---|---|
| `--bg` | `#0B100E` | `#E7ECEA` |
| `--g-bg` | branco `.11 → .045 → .07` | branco `.78 → .44 → .64` |
| `--g-edge` | `rgba(255,255,255,.14)` | `rgba(255,255,255,.9)` |
| `--g-sh` | `0 18px 50px -20px rgba(0,0,0,.5)` | `0 16px 40px -18px rgba(18,42,34,.3)` |
| `--t-hi` | branco 94% | `rgba(10,26,20,.92)` |
| `--tint` | radial escuro `.93 → .40` | radial claro `.86 → .24` |

**A pegadinha do orb no tema claro.** O orb usa blending aditivo, que sobre fundo claro satura tudo em
branco e some. No claro é preciso trocar duas coisas: `globalCompositeOperation` de `lighter` para
`source-over`, e a cor do ponto multiplicada por ~0.42 (mais escura que o acento) com alfa ~1.85×. Em
R3F o equivalente é trocar `AdditiveBlending` por `NormalBlending` e derrubar a intensidade do bloom.
Sem isso, o modo claro parece que o agente morreu.

Neutros (escuro):

| Token | Valor | Uso |
|---|---|---|
| `--bg` | `#0B100E` | fundo da aplicação |
| `--edge` | `rgba(255,255,255,.14)` | borda de vidro |
| `--t-hi` | `rgba(255,255,255,.94)` | títulos, mensagem do usuário, valores |
| `--t-mid` | `rgba(255,255,255,.66)` | corpo, resposta do agente |
| `--t-low` | `rgba(255,255,255,.42)` | descrições, metadados |
| `--t-ghost` | `rgba(255,255,255,.26)` | placeholder, desabilitado |

Texto em alfa branco (não em hex opaco) é proposital: sobre vidro com cor variável atrás, o alfa se
integra; um cinza fixo "flutua".

Estados — o único canal de cor:

| Estado | Hex | Leitura |
|---|---|---|
| `idle` | `#4ADFB0` | menta — desperto, aguardando |
| `listening` | `#57C8FF` | ciano — captando |
| `thinking` | `#8B7BFF` | violeta — raciocinando |
| `executing` | `#A6F05A` | lima — rodando ferramenta |
| `speaking` | `#FFB45C` | âmbar — sintetizando voz |
| `error` | `#FF6B6B` | vermelho |
| `offline` | `#8A968F` | cinza |

O acento em `idle` é escolhido pelo usuário (`--base`); os demais estados sobrescrevem. Ou seja, a cor
personalizável é a cor do repouso — que é o estado mais frequente — enquanto o vocabulário de estados
permanece fixo, porque `thinking` precisa ser sempre a mesma cor para virar leitura automática.

Um único `--accent` (+ `--accent-rgb` para composição com alfa) é reescrito no `<html>` a cada troca de
estado. Herdam dele: o orb, a mancha de fundo, o ponto do pill de status, o label de estado, o avatar do
agente no chat, o anel do microfone, o botão de enviar, os toggles ligados e o cursor do input.

```js
document.documentElement.style.setProperty('--accent', s.color)
document.documentElement.style.setProperty('--accent-rgb', rgb(s.color).join(','))
```

---

## 5. Tipografia

Inter para tudo. JetBrains Mono só para conteúdo de máquina.

| Papel | Tam / altura | Peso | Tracking |
|---|---|---|---|
| Título de tela | 30 / 1.2 | 500 | `-.026em` |
| Fala do agente (voz) | 22 / 1.45 | 300 | `-.015em` |
| Mensagem de chat | 15.5 / 1.6 | 400 | `-.006em` |
| Label de linha (settings) | 14.5 | 450 | `-.008em` |
| Descrição | 13 / 1.45 | 400 | `0` |
| Label de estado | 12.5 | 500 | `.01em` |
| Mono (ferramenta, payload, valor) | 12–12.5 | 400/500 | `0` |

Tracking negativo em tamanhos grandes é o que faz a Inter parecer desenhada e não default. Peso 300 na
frase do agente na tela de voz dá o ar de conversa; peso 500+ ali soaria como aviso de sistema.

---

## 6. Forma e espaço

Raios: `10px` (ícone-botão) · `14px` (card, célula) · `20px` (composer, grupo de settings, bolha) ·
`26px` (painel modal) · `999px` (nav, pills, toggles, mic).

Escala de espaço em múltiplos de 4, com respiro maior que a v1: linhas de settings com 15px vertical,
22px entre turnos do chat, 26px entre o orb e a frase.

Toda superfície flutuante é **destacada da borda da janela**, nunca colada: status a 22px do topo, nav a
26px da base. Vidro precisa de margem para se ler como objeto sobreposto.

Nas áreas roláveis, um `mask-image` desvanece o conteúdo antes da nav e do composer, em vez de deixar o
texto cortar atrás do vidro:

```css
.thread{ mask-image:linear-gradient(#000 calc(100% - 190px), transparent calc(100% - 130px)); }
```

---

## 7. Máquina de estados do agente

```
offline ──connect──► idle
idle ──wake / push-to-talk──► listening
listening ──fim de turno──► thinking
thinking ──tool call──► executing ──resultado──► thinking
thinking ──resposta──► speaking
speaking ──fim / barge-in──► idle | listening
qualquer ──falha──► error ──retry──► thinking | idle
```

Cada estado define cinco coisas ao mesmo tempo. Se um estado novo não conseguir preencher as cinco
colunas, ele não é um estado — é uma variação de outro.

| Estado | Cor | Orb (amp / freq / rot / spread) | Texto | Ação disponível |
|---|---|---|---|---|
| `idle` | menta | .10 / 1.1 / .045 / 1.00 | convite | mic |
| `listening` | ciano | reativo (.12 + mic) / 1.4 / .06 / 1.02 | transcrição parcial + cursor | cápsula: descartar / enviar |
| `thinking` | violeta | .40 / 3.0 / .17 / 1.00 | o que está fazendo | Cancel |
| `executing` | lima | .28 / 2.3 / .12 / 1.03 | ferramenta + args | Cancel |
| `speaking` | âmbar | reativo (.20 + TTS) / 1.7 / .08 / 1.06 | a fala sendo dita | Interrupt |
| `error` | vermelho | .13 / .6 / .01 / **.87** (colapsa) | a falha, em uma frase | Retry |
| `offline` | cinza | .03 / .4 / .012 / .94 · alfa .4 | por que está offline | Reconnect |

O botão primário fica sempre no centro e os secundários em colunas laterais de largura fixa — assim o
microfone nunca "pula" quando Cancel ou Interrupt aparecem. Botões ausentes usam `visibility:hidden`,
não `display:none`, justamente para o grid não colapsar.

---

## 8. Contrato do orb

O orb já existe em R3F. O que o design system define é a interface entre ele e o resto da app — cinco
props, nada mais:

```ts
type OrbProps = {
  color: string       // var(--accent) do estado
  amp: number         // 0–0.7  · deslocamento radial; some com a amplitude do áudio
  freq: number        // 0.4–3.4 · frequência do ruído; alto = superfície fragmentada
  rot: number         // 0–0.2  · velocidade de rotação
  spread: number      // 0.86–1.06 · raio base; colapsa em error, expande em speaking
}
```

Duas regras de comportamento:

**Nada é setado direto.** Os cinco valores são interpolados no `useFrame` com lerp independente de
framerate — `k = 1 - Math.pow(0.0015, dt)`. É essa inércia que dá massa ao objeto; sem ela a troca de
estado parece um corte de vídeo. O **texto**, ao contrário, troca instantaneamente: o usuário precisa de
verdade imediata sobre o que está acontecendo.

**Amplitude vem de uma fonte só.** Um `AnalyserNode` (fftSize 256) com ataque rápido (~0.5) e decaimento
lento (~0.08) alimenta ao mesmo tempo o orb, o anel do microfone e a waveform da cápsula de gravação, o
que garante que os três pulsem em fase. Sem a suavização assimétrica, o orb treme.

Detalhe importante: o orb consome a amplitude **suavizada**, a waveform consome a amplitude **crua**. São
representações diferentes do mesmo sinal — o orb é um corpo com inércia, a waveform é um registro. Usar o
valor suavizado nos dois faz a waveform parecer morta.

Montagem: um `<Canvas>` no topo da app, montado uma vez e **nunca desmontado** entre telas — ele apenas
reposiciona e escala. Desmontar recria contexto WebGL e perde o estado visual a cada troca de rota.
`dpr={[1,1.75]}`, sem sombras, sem antialias.

---

## 9. Motion

```ts
export const spring = {
  snap:  { type:'spring', stiffness:420, damping:32, mass:.8 },   // botões, toggles
  morph: { type:'spring', stiffness:260, damping:30, mass:1  },   // layoutId, painéis
  soft:  { type:'spring', stiffness:140, damping:26, mass:1  },   // mensagens, listas
  orb:   { type:'spring', stiffness:55,  damping:20, mass:1.4 },  // parâmetros do orb
}
export const ease = { out:[.22,1,.36,1], morph:[.3,1.15,.35,1] }
export const dur  = { fast:.16, base:.26, slow:.46 }
export const stagger = .026
```

Opacidade e cor usam duração + `ease.out`. Posição, escala e layout usam spring. Nunca o contrário.

### O padrão create button

Referência: [motion.dev/examples/react-create-button](https://motion.dev/examples/react-create-button) —
shared layout animation (`layoutId`) + transição de `clip-path`. Usado no `+` do composer, e reutilizável
em qualquer seletor que abra uma grade.

1. Gatilho e painel compartilham `layoutId="create-surface"`: a placa **cresce a partir do botão**.
2. O `clip-path` anima o **raio** junto com a caixa — de `inset(0 0 0 0 round 44px)` (o raio do botão) para
   `round 26px` (o raio do painel). Sem isso o canto "estala" no meio do morph.
3. Os itens da grade entram com `opacity 0→1` e `y 8→0, scale .97→1`, stagger de 26ms, começando a ~40%
   do morph — não no início.
4. Saída pela metade do tempo, sem stagger reverso, e o `transition-delay` dos itens é zerado antes.
5. `MotionConfig` no topo garante que gatilho e painel usem exatamente a mesma curva; se divergirem, o
   morph quebra visualmente.

### Outros padrões

**Indicador deslizante** — a seleção em nav, segmented e qualquer grupo de pills é uma única cápsula com
`layoutId`, que viaja entre as opções. Nunca acenda cada opção isoladamente.

**Troca de tela** — sai em 160ms (`opacity 0`, `scale .99`, `y 6`), entra em 260/420ms com `ease.out`.
O orb não participa: é persistente.

**Entrada de mensagem** — `y 12 → 0`, `opacity 0 → 1`, `spring.soft`. A resposta do agente aparece token
a token só com opacidade, sem deslocamento — mover texto que está sendo lido é hostil.

**Respiração ambiente** — só o orb, as manchas do fundo e o ponto de estado. Nenhum outro elemento tem
animação em loop.

**`prefers-reduced-motion`** — springs viram 120ms, o orb congela em amplitude média, as manchas param e
o `clip-path` do create button vira fade.

---

## 10. Componentes

**Nav flutuante** — cápsula de vidro centralizada na base, três destinos com ícone de 16px e label, e a
cápsula de seleção deslizante. Substitui o rail lateral da v1: ocupa menos e deixa a tela de voz
respirar.

**Pill de status** — canto superior esquerdo, sempre visível nas três telas. Ponto na cor do estado com
stick de 4px, nome do agente, separador, nome do estado. É a única peça de UI que nunca sai da tela — a
leitura de estado não pode depender de estar na tela de voz.

**Botão de microfone** — 76px, círculo de vidro. Ganha `box-shadow` em `var(--accent)` quando o estado é
reativo (`listening`/`speaking`), e um anel interno cuja escala segue a amplitude. Desabilitado a 45% em
`thinking`, `executing` e `offline`.

**Bolha do usuário** — vidro, `20px` com o canto inferior direito em `6px`. **Resposta do agente** — sem
caixa: um ponto de 8px na cor do estado como avatar e texto corrido. Assimetria proposital: a fala do
agente é o conteúdo principal e não deve estar dentro de um recipiente.

**Card de ferramenta** — vidro `14px`, header com ponto lima, nome em mono e latência à direita; corpo em
mono 12px com o payload. Indentado 38px para alinhar com o texto do agente.

**Composer** — barra de vidro `20px` fixa acima da nav, com `+` (create button), input, mic e enviar.
O botão de enviar herda `var(--accent)`.

**Grupo de settings** — card de vidro `20px` com um título discreto e linhas separadas por
`rgba(255,255,255,.055)`. Sem bordas externas por linha, sem botão salvar.

**Cápsula de gravação** — o orb é a voz *do agente*. Quando quem fala é você, o canal visual precisa ser
outro, senão os dois disputam o mesmo objeto e a tela deixa de dizer quem está com a palavra. A cápsula
nasce do próprio botão de microfone: ele encolhe e a placa cresce em largura (76px → 430px) na mesma
curva `spring.morph`, com o conteúdo entrando 160ms depois. Dentro dela, na ordem: descartar (↺),
waveform ao vivo, tempo decorrido em mono tabular, e enviar — círculo preenchido em `var(--accent)`,
o único botão sólido de todo o sistema, porque é a única ação que compromete alguma coisa.

O mesmo componente aparece dentro do composer do chat, com raio menor e altura de 30px, substituindo o
input enquanto grava. Os dois compartilham o mesmo buffer de amostras.

Anatomia da waveform: barras de 3px com 3px de intervalo, cantos arredondados (raio = metade da largura,
o que faz o silêncio virar um ponto em vez de um traço), altura proporcional à amplitude, e alfa em
rampa de 28% na barra mais antiga a 100% na mais recente. Essa rampa é o que dá direção temporal — sem
ela o gráfico parece um equalizador parado em vez de uma gravação correndo.

Duas coisas que fazem a diferença entre parecer real ou falso: as amostras precisam de **jitter por
amostra** (`env * (0.5 + rand * 0.95)`), porque fala humana não tem envelope liso e uma waveform suave
denuncia a simulação na hora; e a taxa de amostragem deve ficar em torno de 45ms — mais rápido vira
ruído visual, mais lento fica travado.

**Paleta de comandos (⌘K)** — painel de vidro a 16vh do topo, campo de busca e lista agrupada por
categoria (Ask, Session, View, Tools). Setas navegam, `↵` executa, `esc` fecha. O item selecionado
recebe fundo `--fill-2` e o ícone assume `var(--accent)`. Quando a busca não casa com nada, a mensagem
vazia oferece mandar o texto como pergunta ao agente em vez de dizer "nenhum resultado" — num agente
pessoal, o texto digitado quase sempre é um pedido, não uma busca falha.

Dois detalhes de implementação que quebram se esquecidos: dar `blur()` no input ao fechar (senão o
próximo atalho de tecla única é engolido pelo campo), e interceptar `⌘K` antes de qualquer outro
handler de teclado.

**Modo ambiente** — esconde nav, status, dock e transcrição; o orb cresce para 64vh e entram relógio,
data e o próximo compromisso. É a tela para deixar aberta num segundo monitor. Sai com `esc` ou clique.
Como o orb apenas escala (não remonta), a transição é contínua.

**Controles** — toggle 44×26 com knob branco e trilha em `accent` a 28%; segmented com cápsula
deslizante; slider com trilha de 4px e knob branco de 16px; chips de ferramenta clicáveis com ponto de
status.

---

## 11. As três telas

**Voice.** Orb centralizado com um `plate` radial atrás na cor do estado. Abaixo: nome do estado em 12.5px
na cor do estado, e a frase em 22px peso 300. Na base, o dock com o microfone ao centro e os secundários
em colunas fixas; abaixo dele, a nav. Nenhum outro controle — a tela é o orb.

**Chat.** Coluna de 700px, pill da sessão no topo, thread com fade antes do composer. O avatar do agente
carrega a cor do estado, então dá para ler o que ele está fazendo sem sair do chat.

**Settings.** Coluna de 680px, título 30px, grupos em cards de vidro: Appearance, Agent, Voice, Orb,
Tools, Shortcuts. Cada mudança aplica na hora. Appearance vem primeiro de propósito — é o grupo que o
usuário mexe nos primeiros cinco minutos e depois quase nunca mais.

---

## 11.1 O que eu construiria em seguida

Em ordem de retorno por esforço, para um agente pessoal:

**Fila proativa.** O agente que só responde é meio assistente. Um card de vidro que desce do topo quando
ele tem algo a dizer sem ter sido perguntado ("o vendor confirmou 15h30", "seu voo atrasou") muda a
natureza do produto. Precisa de um estado novo — `notifying` — com cor própria e som distinto.

**Painel de memória.** Uma tela mostrando o que o agente sabe sobre você, item por item, cada um
editável e removível. É a coisa que mais gera confiança num assistente pessoal, e a mais fácil de fazer
mal (não faça disso um dump de JSON).

**Timeline de execução.** Quando ele encadeia cinco ferramentas, o card único vira ruído. Uma linha
vertical com cada passo, duração e resultado colapsável — e a capacidade de cancelar um passo no meio.

**Push-to-talk segurando vs alternando.** Segurar `space` fala enquanto segura; tocar alterna. Detalhe
pequeno, uso diário.

**Histórico de sessões.** Rolagem lateral de conversas anteriores, buscável pela mesma ⌘K.

---

## 12. Acessibilidade

Contraste: `--t-mid` (66% branco) sobre o fundo escurecido passa em 4.5:1; `--t-low` é para conteúdo
não essencial. Nenhuma informação depende só de cor — todo estado tem o nome escrito no pill de status e
na tela de voz. Foco sempre visível (`1.5px` em `accent`, offset 3px). O estado do agente é anunciado por
`aria-live="polite"`; a transcrição parcial **não** é anunciada, só o resultado final.
Atalhos: `⌘K` paleta de comandos, `1/2/3` telas, `espaço` push-to-talk, `esc` interrompe ou sai do modo
ambiente, `T` alterna tema, `A` modo ambiente.

No tema claro, confira o contraste do texto sobre a imagem de fundo do usuário — é a única superfície
que você não controla. O "dim" existe justamente para isso; considere travar um mínimo de ~30%.

Sobre `backdrop-filter`: teste em máquina fraca. Se cair de frame, reduza o blur para 20px antes de
reduzir a contagem de partículas do orb — o blur custa mais.

---

## 13. Tokens

```css
:root{
  --bg:#0B100E;
  --edge:rgba(255,255,255,.14); --edge-2:rgba(255,255,255,.20);
  --t-hi:rgba(255,255,255,.94); --t-mid:rgba(255,255,255,.66);
  --t-low:rgba(255,255,255,.42); --t-ghost:rgba(255,255,255,.26);

  --st-idle:#4ADFB0; --st-listening:#57C8FF; --st-thinking:#8B7BFF;
  --st-speaking:#FFB45C; --st-executing:#A6F05A; --st-error:#FF6B6B; --st-offline:#8A968F;
  --accent:#4ADFB0; --accent-rgb:74,223,176;

  --r-xs:10px; --r-sm:14px; --r-md:20px; --r-lg:26px; --r-pill:999px;

  --f:"Inter",-apple-system,system-ui,sans-serif;
  --f-mono:"JetBrains Mono",ui-monospace,"SF Mono",Menlo,monospace;

  --sp:cubic-bezier(.22,1,.36,1);
  --sp-morph:cubic-bezier(.3,1.15,.35,1);
}
```

## 14. Estrutura sugerida

```
src/
  app/        App.tsx · AgentStateProvider (state, amplitude, transcript)
  orb/        Orb.tsx (existente) · STATE_PARAMS.ts · useAudioAmplitude.ts
  ui/         Glass · Nav · StatusPill · Mic · Toggle · Segmented · Slider · CreateMenu · CommandPalette
  screens/    Voice.tsx · Chat.tsx · Settings.tsx · Ambient.tsx
  theme/      ThemeProvider.tsx (dark|light|auto) · backdrop.tsx (blobs + imagem)
  motion/     tokens.ts · variants.ts
  styles/     tokens.css · glass.css · backdrop.css
```

O `AgentStateProvider` escreve `--accent` / `--accent-rgb` no `<html>` — é o que propaga a cor de estado
por CSS, sem prop drilling e sem re-render de componente nenhum.
