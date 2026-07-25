# Atlas de Yaub Rewards

Mapa del proyecto y lista viva de pendientes. Si vuelves después de un rato (o
si entra alguien nuevo), este archivo es el punto de partida.

Última actualización: 25 de julio de 2026.

---

## 1. Qué es

`rewards.yaub.ai` — la plataforma que ayuda a Yaub a vender sus agentes.

Dos caras:

- **Vendedor (freelancer).** Se suscribe a agentes, guarda ofertas y refiere
  clientes con **su código único**. No comparte links: al cerrar la venta le da
  el código al agente cuando este pregunta quién lo recomendó. El agente lo
  registra solo y libera la comisión solo cuando se cumple la condición.
- **Empresa.** Cada **agente** de Yaub **es una empresa** aquí. La empresa
  activa Rewards en los agentes que quiere que vendan, publica ofertas y ve
  quién le está vendiendo.

Un principiante nunca debería tener que salir a `platform.yaub.ai`, salvo para
pagar y ver su billing.

### Modelo mental

```
tenant (cuenta de Yaub)
  └── assistant (agente)  ==  empresa de Rewards  ==  1 fila en rewards.empresas
        └── ofertas (borrador / publicada / pausada)
              └── referidos  →  comisión del vendedor
```

- Suscribirse a una empresa **es** suscribirse a su agente.
- "Activar Rewards" en un agente = cablearle la **skill**: las tools
  `registrar_referido`, `validar_codigo` y `liberar_referido` en
  `public.assistants.tools`.
- El trial es de **100 interacciones**, no de días. Una interacción es una fila
  en `public.bot_escalations` con `counted_for_billing = true`. Al agotarse, el
  agente se pausa (no se borra). Después, plan de $99/mes por 500.

---

## 2. Stack y dónde vive cada cosa

| Qué | Dónde |
|---|---|
| App | Next.js 14 App Router, TypeScript, Tailwind. `basePath: '/rewards'`. Vercel. |
| Base | Supabase `xwjhuixuvmyzfhujvxhf` (`yaub-platform-prod`) — **compartida con la plataforma** |
| Esquema propio | `rewards` (los clientes de Supabase van con `db: { schema: 'rewards' }`) |
| Esquema de la plataforma | `public` — se **reusa**, nunca se recrea |
| Migraciones | `supabase/migrations/` — aditivas, con RLS y policies explícitas |
| Pruebas SQL | `supabase/tests/` — transaccionales, terminan en rollback |
| Edge functions | `supabase/functions/` (`rewards-agentes`, `crear-cuenta-rewards`) |

### Tablas de la plataforma que se reusan (no tocar su forma)

`assistants` (con `tools`, `avatar_url`, `channels`, `widget_public_key`,
`whatsapp_phone_number`, `prompt`), `app_users`, `tenants` (`logo_url`),
`user_tenant_memberships`, `assistant_knowledge`, `product_catalog`,
`bot_escalations`, `ai_model_registry`.

### Reglas que no se rompen

1. **Todo lo nuevo va en migraciones aditivas**, con RLS habilitada y policies
   explícitas. Nada de tocar tablas de la plataforma de forma destructiva.
2. **Cero regresiones en la plataforma.** Correr `get_advisors` después de cada
   migración.
3. Las funciones que leen o escriben cosas de la plataforma van
   **`SECURITY INVOKER`**, para que mande la RLS de la plataforma (alcance de
   tenant, OWNER / BUSINESS_OWNER). `SECURITY DEFINER` solo para datos que son
   exclusivamente de Rewards.

---

## 3. Las tres piezas grandes

### Sign in with Yaub (SSO)

Una sola identidad entre `yaub.ai`, la plataforma y Rewards: mismo Supabase
Auth. Al entrar se hace upsert del perfil de vendedor o de empresa ligado a
`app_users`. Registrar una empresa crea o liga su `tenant` y su
`user_tenant_membership`.

### Agentes Yaub conectados

`rewards.mis_agentes()` (INVOKER) lista los agentes que el usuario puede ver
**por RLS**, marcando cuáles ya tienen Rewards.
`rewards.activar_rewards_en_agente()` (INVOKER) les cablea la skill sin
duplicar tools. Crear un agente son dos campos (nombre y qué vende) con
`foundry-gpt-4o-mini`; la configuración avanzada se abre en la plataforma.

### Referidos gamificados

Cada vendedor tiene un código único. Cuando alguien se registra con un código
válido, se le abonan **$50 pendientes** al nuevo. En su **tercera comisión
cobrada** se liberan **$100 al que lo refirió** más esos $50. Antes de eso
ambos montos se muestran como "pendientes por liberar".

Antiabuse: no se acepta el código propio, un referido por usuario, y la
liberación es idempotente (trigger `trg_rewards_liberar_bono` sobre
`after update of estatus`, probado en `freelancer_referidos_test.sql`).

---

## 4. Pendientes

### Por construir

- **Módulo de YaubChat dentro de Rewards.** Bandeja filtrada a las
  conversaciones de agentes que tengan Rewards activo, con RLS. La fuente son
  `public.bot_escalations` + `messages`; que sea `SECURITY INVOKER`.
- **Botones de estado de oferta en el panel.** El enum
  `rewards.oferta_estado` (borrador / publicada / pausada), el trigger que lo
  sincroniza con `activa` y la migración ya están; **falta la UI** para poner
  en borrador, publicar y pausar. La oferta "prueba" se pausó por SQL.

### Decisiones que dependen de ti

- **Ligar las cuentas.** `jjpb.18@gmail.com` (con la que entras a Rewards) no
  tiene tenant y es `AGENT`; `jacobopayan@yaub.ai` es `OWNER` del tenant "Yaub"
  con ~30 agentes y es dueño de las empresas de Rewards. Por eso "no veo mis
  agentes" desde la primera. O entras con la de Yaub, o le damos a
  `jjpb.18@gmail.com` membresía al tenant "Yaub". **No lo hice sin permiso.**
- **A dónde manda "Elegir plan".** Hoy va al editor del agente en
  `platform.yaub.ai`. Si va a haber checkout propio, hay que apuntarlo ahí.
- **URLs de Términos y Privacidad.** Hoy apuntan a `https://yaub.ai/terminos`
  y `/privacidad`. Confirmar que existen.
- **`widget_public_key` en el agente de Yaub Móvil.** Habilitarla haría que el
  chat de prueba funcione dentro de Rewards, pero **expone un endpoint de chat
  público en un agente de producción**. No lo activé.

### Deuda conocida

- `public._prompt_backup_yaubmovil` tiene RLS deshabilitada. Es una tabla de
  respaldo de la plataforma, anterior a este trabajo. Sale en `get_advisors`.
- Ocho vistas `v_*` de la plataforma son `SECURITY DEFINER` y salen como ERROR
  en advisors. También son anteriores y no se tocaron.
- El conector de Canva pide autorización desde los ajustes de claude.ai; sin
  eso no se puede usar.

### Cosas que ya se verificaron (no re-litigar)

- El release de referidos: probado contra producción, incluyendo idempotencia y
  que no pague doble.
- Favoritas y avatares: `supabase/tests/favoritas_y_avatares_test.sql` en verde.
- Móvil: sin overflow horizontal a 360 y 390 en landing, login, registro y las
  pantallas autenticadas.
- Modo oscuro: revisado en app **y** en las pantallas de auth (login y registro
  tenían `#FFFFFF` hardcodeado; ya usan `rgb(var(--fondo))`).

---

## 5. Trampas con las que ya nos tropezamos

**El estado del cliente no se resetea al cambiar de empresa.** Las pantallas de
`/empresa` guardan los datos del servidor en `useState`. `router.refresh()`
trae datos nuevos, pero React conserva el estado del componente que está en la
misma posición del árbol, así que se quedaban los referidos y las ofertas de la
empresa anterior. Se arregló con una `key` por `empresa.id` en el layout de
`/empresa`, que desmonta el subárbol. **Si agregas una pantalla nueva ahí, ya
queda cubierta.**

**`SECURITY DEFINER` se salta la RLS de la plataforma.** `mis_agentes()` nació
DEFINER y por eso le salían a todo el mundo agentes que no eran suyos. Para
cualquier cosa que lea `assistants` o `tenants`, usa INVOKER.

**`upsert` necesita permiso de UPDATE.** `rewards.ofertas_favoritas` solo tiene
grant de `select, insert, delete` a propósito, así que hay que usar `insert` e
ignorar el `23505`. Un `upsert` truena con permission denied.

**Los buckets públicos no necesitan policy amplia de SELECT.** Sirven las URLs
por `/object/public/` sin pasar por RLS; lo único que agregaba la policy amplia
era poder **listar** todos los archivos, y las carpetas son el `auth.uid()` de
cada usuario. `rewards-avatares` y `rewards-fotos` quedaron acotados a la
carpeta de cada quien.

**Especificidad de CSS en la landing.** `.lp .wrap` (0,2,0) le ganaba a
`.lp section` (0,1,1) y anulaba el padding vertical: todo se veía pegado. El
`.wrap` ahora **solo** controla ancho y padding horizontal, con longhand.

**Los nombres de archivo de las migraciones tienen que ser la versión real.**
Había migraciones aplicadas en producción sin archivo en el repo, y los
archivos que existían usaban timestamps inventados a mano que no correspondían
a ninguna fila de `supabase_migrations.schema_migrations`. Un `supabase db
push` las habría vuelto a aplicar todas. Ya están alineadas: **si aplicas una
migración por MCP, escribe el archivo con la versión que le asignó la base.**

**`[...new Set(x)]` no compila** con el `tsconfig` de este repo. Usa
`Array.from(new Set(x))`.

**No inventes números en la landing.** El diseño de referencia traía cifras de
relleno; las reales eran otras. Si un número no sale de la base, no se publica.

---

## 6. Verificar sin poder abrir la app

El sandbox **no tiene salida a `supabase.co`**, así que las pantallas
autenticadas no se pueden renderizar contra datos reales. Lo que sí funciona:

- `npm run build` para tipos y compilación.
- Consultas directas a la base por MCP, y pruebas SQL transaccionales con
  `set_config('request.jwt.claims', ...)` para simular a un usuario y **probar
  la RLS de verdad**.
- Una página temporal con datos simulados + Playwright (`chromium` en
  `/opt/pw-browsers/chromium`) para revisar el render, el modo oscuro y medir
  `scrollWidth - clientWidth` a 360 y 390. Borra la página temporal antes de
  commitear.
