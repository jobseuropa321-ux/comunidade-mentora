# Tutorial de instalação (1ª visita) — pacote portátil (PT, sem i18n)

Réplica do modal fullscreen que aparece quando a pessoa entra no app pela
primeira vez no celular, ensinando a instalar o PWA na tela inicial.
Textos idênticos ao original + **as imagens reais dos prints** incluídas.

## O que faz
- **iOS** → carrossel com 5 passos e prints reais do Safari ("Abra o menu do
  Safari" → "Compartilhar" → "Ver Mais" → "Adicionar à Tela de Início" →
  "Adicionar"), com dots, botão "Próximo", "Entendi, já instalei" e
  "Continuar sem instalar".
- **Android** → tela com botão **"Instalar agora"** que dispara a instalação
  NATIVA do PWA (captura o evento `beforeinstallprompt`).
- **Regras de exibição** (tudo no próprio componente):
  - só em **celular** (iOS/Android) — desktop nunca vê;
  - **não** aparece se o app já está instalado (standalone);
  - fechou/pulou → **não volta por 7 dias** (localStorage `app_install_dismissed`).

## Estrutura do pacote
```
src/
  components/InstallPrompt.tsx   ← o modal (textos no objeto TXT; passos em IOS_STEPS)
  styles/install.css             ← 1 classe (.scrollbar-hide) → colar no index.css
public/
  install/ios-step1a.webp        ← prints REAIS do tutorial (5 imagens, ~380KB)
  install/ios-step1b.webp
  install/ios-step2.webp
  install/ios-step-vermais.webp
  install/ios-step3.webp
LEIA-ME.md
```

## Passos pra usar no app novo
1. Copie `src/components/InstallPrompt.tsx` pro `src/components/` do app.
2. Copie a pasta `public/install/` inteira pro `public/` do app
   (o componente busca as imagens em `/install/...`).
3. Cole o conteúdo de `styles/install.css` no seu `src/index.css`
   (se já tem `.scrollbar-hide` de outro pacote, pule).
4. Dependência: `npm i lucide-react` (se ainda não tem).
5. Monte o componente **uma vez**, dentro da área logada (é onde o original
   monta — aparece depois do login, não na tela de login):
   ```tsx
   import InstallPrompt from '@/components/InstallPrompt';

   // dentro do seu layout/rota protegida:
   <>
     <InstallPrompt />
     {/* resto do app */}
   </>
   ```
   Se preferir que apareça pra todo mundo (antes do login), monte no root.

## ⚠️ Pré-requisito pro botão do Android funcionar
O botão "Instalar agora" depende do navegador disparar `beforeinstallprompt`,
e isso só acontece se o app for um **PWA instalável**:
- servido em **HTTPS**;
- **manifest** válido (`display: "standalone"`, `name`, ícones 192px e 512px);
- **service worker** registrado.

Sem isso, o Android mostra "Preparando instalação..." pra sempre (botão
desabilitado). O tutorial de iOS funciona independente disso (é só instrução
visual — o "Adicionar à Tela de Início" do Safari não exige service worker).

## Personalizações fáceis
- **Textos**: objeto `TXT` no topo do componente.
- **Passos/prints**: array `IOS_STEPS` (título, legenda e imagens de cada passo).
  Os prints incluídos são os do app original — quando quiser, tire prints do SEU
  app instalando no iPhone e substitua os arquivos em `public/install/`
  (mantendo os nomes, nem precisa mexer no código).
- **Frequência**: `DISMISS_TTL_MS` (7 dias) e a chave `DISMISSED_KEY` no topo.
- **Cores**: rosa `#FF2D7A` e lima `#C8F000` — troque pelos hex da sua marca.

## Diferenças vs. o original
Nenhuma no visual/comportamento. Só: textos hardcoded em PT (sem i18n) e a
chave do localStorage renomeada de `viral_install_dismissed` pra
`app_install_dismissed` (neutra).
