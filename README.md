# Yaub Rewards

Web app donde freelancers se registran, obtienen su código único de vendedor y ven sus
comisiones por referidos. Las ventas las cierran los agentes de IA de Yaub, que registran
los referidos vía API (Edge Functions de Supabase).

- **Stack**: Next.js 14 (App Router) + Tailwind + Supabase (proyecto `yaub-platform-prod`).
- **Servida bajo** `yaub.ai/rewards` (basePath `/rewards`, dominio `rewards.yaub.ai`).
- **Todo lo nuevo vive en el schema `rewards`** — el schema `public` existente no se toca.

## Estructura

```
src/app/            → pantallas (onboarding, /app freelancer, /empresa, /admin)
supabase/migrations → migraciones SQL del schema rewards (ya aplicadas en prod)
supabase/functions  → edge functions: registrar-referido, liberar-referido, validar-codigo
design/             → export HTML de Claude Design (diseño aprobado)
```

## Desarrollo local

```bash
cp .env.example .env.local   # llena las llaves
npm install
npm run dev                  # http://localhost:3000/rewards
```

## Variables de entorno (Vercel)

| Variable | Dónde | Notas |
| --- | --- | --- |
| `NEXT_PUBLIC_SUPABASE_URL` | Client + server | `https://xwjhuixuvmyzfhujvxhf.supabase.co` |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Client + server | anon key del proyecto |
| `SUPABASE_SERVICE_ROLE_KEY` | Solo server | opcional; la app funciona con RLS + RPCs sin ella |
| `REWARDS_API_KEY` | Solo server | la misma key que usan los agentes (por si el server necesita llamar las functions) |
| `ADMIN_EMAILS` | Solo server | correos con acceso a `/admin`, separados por coma |
| `NEXT_PUBLIC_SITE_URL` | Client + server | `https://rewards.yaub.ai` |

> El gate real de admin está en la base (tabla `rewards.admins` + RLS). `ADMIN_EMAILS`
> gatea la ruta en el server de Next; mantén ambos en sincronía.

## Deploy en Vercel

1. Proyecto nuevo en Vercel → importar este repo (framework: Next.js, sin overrides).
2. Agregar las env vars de arriba.
3. Domains → agregar `rewards.yaub.ai` (CNAME `cname.vercel-dns.com`).
4. En Supabase → Authentication → URL Configuration → **Redirect URLs**, agregar:
   `https://rewards.yaub.ai/rewards/auth/callback` y `https://yaub.ai/rewards/auth/callback`.

### Rewrite en el proyecto principal (yaub.ai)

Para que `yaub.ai/rewards/*` sirva esta app, en el proyecto principal de yaub.ai:

- **Si el proyecto principal es Next.js** — en su `next.config.(m)js`:

```js
async rewrites() {
  return [
    { source: '/rewards', destination: 'https://rewards.yaub.ai/rewards' },
    { source: '/rewards/:path*', destination: 'https://rewards.yaub.ai/rewards/:path*' },
  ];
}
```

- **Si el proyecto principal usa `vercel.json`** — agregar al array `rewrites`:

```json
{
  "rewrites": [
    { "source": "/rewards", "destination": "https://rewards.yaub.ai/rewards" },
    { "source": "/rewards/:path*", "destination": "https://rewards.yaub.ai/rewards/:path*" }
  ]
}
```

La app usa `basePath: '/rewards'`, así que los assets y rutas ya vienen prefijados y el
rewrite es 1:1 (`/rewards/x` → `rewards.yaub.ai/rewards/x`). Visitar `rewards.yaub.ai/`
redirige a `/rewards` automáticamente.

## API para agentes (Edge Functions)

Base: `https://xwjhuixuvmyzfhujvxhf.supabase.co/functions/v1`
Auth: header `x-rewards-key: <REWARDS_API_KEY>`

| Función | Método | Body / query | Respuesta |
| --- | --- | --- | --- |
| `/registrar-referido` | POST | `{ codigo, cliente_telefono, producto?, evento?, conversation_id? }` | `{ ok, ya_registrado, freelancer_nombre, codigo, monto, estatus }` |
| `/liberar-referido` | POST | `{ cliente_telefono, evento }` | `{ ok, ya_liberado, liberados, freelancer_nombre, monto }` |
| `/validar-codigo` | GET | `?codigo=JACO-01` | `{ ok, valido, codigo, freelancer_nombre? }` |

Las tres son idempotentes y normalizan el código (mayúsculas, con o sin guion o espacios)
y el teléfono (últimos 10 dígitos).

La key se valida contra el secret `REWARDS_API_KEY` de Edge Functions **o** contra el
sha256 guardado en `rewards.api_keys` (así se puede rotar sin redeploy: inserta el hash
nuevo y desactiva el viejo).
