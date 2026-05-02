# frete-facil-mobile — Contexto para Claude Code

## Stack
- React Native + Expo SDK 52
- Expo Router v4 (file-based routing)
- TanStack Query v5 (data fetching + cache)
- Zustand (estado global: auth, ride ativo)
- NativeWind v4 (TailwindCSS para React Native)
- React Hook Form + Zod (formulários)
- TypeScript strict

## Estrutura
```
src/
  app/
    _layout.tsx          ← Root layout (QueryClient, SafeAreaProvider)
    index.tsx            ← Redirect baseado em auth
    (auth)/              ← Telas sem autenticação
      welcome, login, register, otp
    (tabs)/              ← Telas autenticadas (bottom tabs)
      index, rides, new-ride, chat, profile
  components/
    ui/                  ← Componentes reutilizáveis (Button, Input, Card...)
  hooks/                 ← Custom hooks (useRides, useOffers...)
  services/
    api.ts               ← Axios instance com interceptors JWT
  store/
    auth.ts              ← Zustand store (token, user, logout)
  constants/
    colors.ts            ← Design tokens
```

## Convenções
- Imports com alias `@/` mapeando para `src/`
- Telas em `src/app/` seguindo Expo Router file-based
- Tokens salvos em expo-secure-store (NUNCA AsyncStorage para dados sensíveis)
- Classes Tailwind via NativeWind (não StyleSheet.create para novos componentes)
- Variáveis de ambiente prefixadas com `EXPO_PUBLIC_`

## API
- Base URL via `EXPO_PUBLIC_API_URL`
- Interceptor automático adiciona Bearer token
- Interceptor de refresh token em 401
