# Edge functions — Yaub Rewards

Funciones de este repo (validan `x-rewards-key` internamente):
- `registrar-referido`, `liberar-referido`, `validar-codigo` — API de referidos/comisiones.
- `crear-cuenta-rewards` — alta de cuenta (signup público, sin confirmación de correo).
  Rol `empresa` → `is_self_signup` (el trigger de plataforma crea su tenant self_service);
  rol `freelancer` acepta `codigo_referido` opcional (bono de $50/$100, ver migración
  `20260725120000_rewards_freelancer_referidos.sql`).
- `rewards-agentes` — backend de la consola "Agentes Yaub Conectados" (Bearer del usuario;
  service role tras validar que la empresa es suya). Acciones: `ensure_tenant`, `list`,
  `quick_create` (trial 7 días + widget web), `add_website`, `add_document`, `add_image`,
  `list_context`, `delete_context`. El contexto se guarda en `assistant_knowledge` /
  `product_catalog` y se compila al bloque `<!-- rewards:contexto:* -->` del prompt.
  El chat de prueba del front usa la fn `widget-chat` de la plataforma (no está en este repo).

## `yaub-rewards-proxy` vive en yaub-platform (NO aquí)

El puente que usan los agentes (`?action=registrar|liberar|validar` → inyecta `x-rewards-key`)
es **`yaub-rewards-proxy`** y su único llamador es `assistant-chat`, que vive en el repo
**yaub-platform**. Para evitar duplicación/drift, el proxy se mantiene SOLO ahí.
Deploy: desde yaub-platform con `--no-verify-jwt`.
