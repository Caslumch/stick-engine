
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