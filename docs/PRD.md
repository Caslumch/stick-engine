# PRD — Jarvis AI

> Um assistente pessoal inteligente, privado e extensivel, executando localmente e utilizando IA na nuvem apenas quando necessario.

**Versao:** 1.0
**Status:** Planejamento
**Autor:** Lucas Machado
**Ultima atualizacao:** 2026-07-27

---

## Visao

O Jarvis e um assistente pessoal inspirado no conceito apresentado em Iron Man, desenvolvido para funcionar como o centro inteligente do computador e, futuramente, da casa do usuario.

Diferente de assistentes tradicionais, o Jarvis prioriza:

- Execucao local
- Privacidade
- Baixa latencia
- Interface propria
- Arquitetura modular
- Expansao atraves de capacidades (Capabilities)

O objetivo nao e criar apenas um chatbot, mas uma **plataforma pessoal** capaz de conversar, executar acoes, controlar dispositivos e auxiliar nas atividades do dia a dia.

---

## Objetivo

Criar um assistente que seja capaz de:

- Conversar naturalmente por voz
- Executar comandos no computador
- Utilizar IA local como padrao
- Utilizar IA em nuvem apenas quando necessario
- Possuir memoria
- Controlar dispositivos inteligentes
- Evoluir atraves de novas capacidades sem alterar seu nucleo

---

## Principios do Produto

### Local First

Sempre que possivel o processamento devera acontecer localmente. Isso garante privacidade, menor custo, menor latencia e funcionamento offline.

### Cloud When Necessary

A nuvem sera utilizada apenas quando realmente agregar valor (pesquisas na internet, documentos muito grandes, raciocinio complexo, modelos mais avancados). **A decisao pertence ao Jarvis, nao ao usuario.**

### Modularidade

O nucleo nunca devera conhecer detalhes das funcionalidades. Novas capacidades poderao ser adicionadas sem modificar o Core.

### Interface Viva

A interface faz parte da identidade do produto. O Jarvis deve transmitir a sensacao de estar "presente" atraves de animacoes, voz e estados visuais.

---

## Pilares

```
           Jarvis

     IA
      |
Voz --+-- Interface
      |
  Automacao
```

Todo recurso desenvolvido deve fortalecer um destes quatro pilares.

---

## Criterios de Sucesso (MVP)

O MVP sera considerado concluido quando o Jarvis for capaz de:

- [ ] Iniciar automaticamente com o sistema
- [ ] Detectar a wake word
- [ ] Conversar por voz
- [ ] Utilizar IA local por padrao
- [ ] Utilizar IA em nuvem quando necessario
- [ ] Executar comandos no computador
- [ ] Responder utilizando voz
- [ ] Exibir seu estado atraves do HUD
- [ ] Ser facilmente expansivel atraves de novas Capabilities

---

## Fora do Escopo (V1)

- Marketplace
- Multiusuario
- Mobile
- Plugins de terceiros
- Dashboard avancado
- Aprendizado continuo
- Avatar completo (3D animado)
- Analytics

---

## Visao de Longo Prazo

O Jarvis devera evoluir de um assistente de voz para uma **plataforma pessoal de inteligencia artificial**. Seu nucleo permanecera simples, enquanto novas capacidades poderao ser adicionadas continuamente.
