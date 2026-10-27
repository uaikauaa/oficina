# Instalação do Oficina Gestão como aplicativo (PWA)

O Oficina Gestão pode ser instalado direto do site, sem extensão de navegador, executável ou Microsoft Store.
O aplicativo instalado roda em janela própria (`display: standalone`), mas continua conectado ao servidor e ao PostgreSQL.
**Não existe modo offline para estoque, ordens de serviço ou informações privadas.**

## Windows (Chrome ou Edge)
1. Acesse o domínio oficial **HTTPS** do Oficina Gestão e faça login.
2. Clique em **Instalar App** (ícone de download) no topo do sistema.
3. Aceite a janela de instalação apresentada pelo navegador.
4. Abra o aplicativo instalado e clique com o botão direito no ícone da **barra de tarefas** do Windows > **Fixar na barra de tarefas**.
5. Se o navegador não exibir o prompt nativo, use o menu do Chrome/Edge: **Instalar Oficina Gestão** ou **Aplicativos → Instalar este site como aplicativo**.

## Android e iPhone
- Android/Chrome: Instalar App ou menu > **Instalar aplicativo**.
- iOS/Safari: botão Compartilhar > **Adicionar à Tela de Início**.

## Requisitos e segurança
- Os navegadores decidem quando oferecer o prompt; clique no botão **Instalar App** para ver o prompt ou instruções.
- `frontend/src/app/manifest.ts` e ícones PNG 192/512 gerados a partir de `public/logo-icone.png`.
- `/login` como página inicial, respeitando autenticação e sessão.
- Nenhum service worker de cache é registrado: respostas de `/api/*`, páginas autenticadas, CSRF e cookies **não** são armazenados para uso offline.
- HTTPS público é necessário (localhost serve para desenvolvimento). A instalação e a fixação devem ser homologadas no browser do equipamento da oficina.
- Para remover, use o gerenciamento de aplicativos do Windows ou o menu do navegador.

## Validação
Execute `npm run build` e `npm run test:e2e` em `frontend/`, ou acompanhe o GitHub Actions.
Verifique `/manifest.webmanifest`, `/pwa/icon-192.png` e `/pwa/icon-512.png` (respostas públicas apenas dos assets).
