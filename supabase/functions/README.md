# Edge functions — Yaub Rewards

Funciones de este repo (validan `x-rewards-key` internamente):
- `registrar-referido`, `liberar-referido`, `validar-codigo` — API de referidos/comisiones.
- `crear-cuenta-rewards` — alta de cuenta (signup público, sin confirmación de correo).

## `yaub-rewards-proxy` vive en yaub-platform (NO aquí)

El puente que usan los agentes (`?action=registrar|liberar|validar` → inyecta `x-rewards-key`)
es **`yaub-rewards-proxy`** y su único llamador es `assistant-chat`, que vive en el repo
**yaub-platform**. Para evitar duplicación/drift, el proxy se mantiene SOLO ahí.
Deploy: desde yaub-platform con `--no-verify-jwt`.
