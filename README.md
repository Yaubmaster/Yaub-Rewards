# Yaub Rewards

Web app donde freelancers se registran, obtienen su código único de vendedor y ven sus
comisiones por referidos. Las ventas las cierran los agentes de IA de Yaub, que registran
los referidos vía API (Edge Functions de Supabase).

- **Stack**: Next.js 15 (App Router) + Tailwind + Supabase (proyecto `yaub-platform-prod`).
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

## Hosting: Cloudflare Workers (OpenNext)

`rewards.yaub.ai` se sirve desde el Worker **`yaub-rewards`** con el adaptador
[`@opennextjs/cloudflare`](https://opennext.js.org/cloudflare) (`wrangler.jsonc`,
`open-next.config.ts`). Ya no vive en Vercel.

**Deploy (manual, desde `main`):**

```bash
# .env.production.local (NO se commitea: el repo es público) con las variables públicas de build:
#   NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_ANON_KEY, NEXT_PUBLIC_SITE_URL
CLOUDFLARE_API_TOKEN=<token con Workers Scripts Edit> npm run deploy
```

`npm run deploy` = `next build` → bundle de OpenNext → copia `cloudflare/_headers` a la raíz
de los assets (con `basePath`, lo de `public/` queda bajo `/rewards`) → `wrangler deploy`.
`npm run preview` levanta lo mismo en local con el runtime de Workers.

| Variable | Dónde | Notas |
| --- | --- | --- |
| `NEXT_PUBLIC_SUPABASE_URL` | Build (`.env.production.local`) | `https://xwjhuixuvmyzfhujvxhf.supabase.co` |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Build (`.env.production.local`) | anon key del proyecto (la misma de platform) |
| `NEXT_PUBLIC_SITE_URL` | Build + `vars` del Worker | `https://rewards.yaub.ai` |
| `ADMIN_EMAILS` | Secreto del Worker | correos con acceso a `/admin`, separados por coma (`npx wrangler secret put ADMIN_EMAILS`) |

> El gate real de admin está en la base (tabla `rewards.admins` + RLS). `ADMIN_EMAILS`
> gatea la ruta en el server de Next; mantén ambos en sincronía.

No hay caché incremental: todo es `force-dynamic` salvo las páginas prerenderizadas
(`/login`, `/registro…`), que se leen de los assets del Worker. El firewall (reto de bots,
bloqueo de crawlers de IA) vive en la zona `yaub.ai` de Cloudflare.

En Supabase → Authentication → URL Configuration → **Redirect URLs** debe estar
`https://rewards.yaub.ai/rewards/auth/callback`.

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
