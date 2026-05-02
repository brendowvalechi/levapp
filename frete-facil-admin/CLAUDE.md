# frete-facil-admin — Contexto para Claude Code

## Stack
- Next.js 15 (App Router)
- TailwindCSS + shadcn/ui
- TanStack Query (server state)
- Zustand (UI state)
- TypeScript strict

## Estrutura
```
src/
  app/
    layout.tsx           ← Root layout
    page.tsx             ← Redirect para /dashboard
    (dashboard)/
      layout.tsx         ← Sidebar + main wrapper
      dashboard/         ← Métricas gerais
      rides/             ← Gerenciar corridas
      users/             ← Gerenciar usuários
      drivers/           ← Verificação de documentos
      disputes/          ← Disputas abertas
      support/           ← Chat de suporte
      settings/          ← Parâmetros de negócio
  components/
    sidebar.tsx
    ui/                  ← shadcn components
  lib/
    utils.ts             ← cn() helper
```

## Convenções
- Imports com alias `@/` mapeando para `src/`
- Server Components por padrão, `"use client"` apenas quando necessário
- API_URL via `NEXT_PUBLIC_API_URL`
- Dados sensíveis (admin token) nunca no cliente
