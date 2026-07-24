// yaub-rewards-proxy — puente entre el runtime de agentes y las edge functions de
// Yaub Rewards. El runtime invoca las custom_tools con service-role pero SIN headers
// custom; este proxy inyecta el header central `x-rewards-key` y reenvía a la
// función de Rewards correspondiente. Usa REWARDS_API_KEY si está configurada, y si
// no, el SUPABASE_SERVICE_ROLE_KEY del propio proyecto (aceptado como credencial
// interna por las funciones de Rewards) — cero secrets manuales.
// La acción se decide por ?action=registrar|liberar|validar (query del endpoint_path).
//
// AUTH DEL LLAMADOR (crítico): solo service-to-service. El único llamador legítimo es
// el runtime de agentes (assistant-chat), que llega con el SUPABASE_SERVICE_ROLE_KEY.
// Sin isAuthorizedServiceRole, cualquiera con la anon key pública (embebida en el
// frontend) podría invocar el proxy — que inyecta el secreto central y opera sobre
// Rewards (registrar/liberar comisiones) → vector de fraude. La validación interna
// asegura el endpoint con o sin verify_jwt del gateway.
// NOTA: este archivo es un ESPEJO del proxy en el repo yaub-platform (mismo proyecto
// Supabase). Mantener ambos en sync; nunca desplegar una versión sin este check.
const REWARDS_BASE = "https://xwjhuixuvmyzfhujvxhf.supabase.co/functions/v1";
const REWARDS_API_KEY =
  Deno.env.get("REWARDS_API_KEY") ?? Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";

// Acepta el SUPABASE_SERVICE_ROLE_KEY (nuevo formato sb_secret_* que NO es JWT) o un
// JWT legacy con role=service_role. Todo lo demás (incluida la anon key) → rechazado.
function isAuthorizedServiceRole(authHeader: string): boolean {
  const m = /^Bearer\s+(.+)$/.exec(authHeader);
  if (!m) return false;
  const token = m[1].trim();
  const envSecret = (Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "").trim();
  if (envSecret && token === envSecret) return true;
  const parts = token.split(".");
  if (parts.length !== 3) return false;
  try {
    const padded = parts[1].replace(/-/g, "+").replace(/_/g, "/");
    const txt = atob(padded + "===".slice(0, (4 - padded.length % 4) % 4));
    return JSON.parse(txt)?.role === "service_role";
  } catch {
    return false;
  }
}

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
const json = (b: unknown, status = 200) =>
  new Response(JSON.stringify(b), { status, headers: { ...CORS, "Content-Type": "application/json" } });

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });
  // Auth PRIMERO: solo service-role. Rechaza a cualquiera antes de tocar el secreto.
  if (!isAuthorizedServiceRole(req.headers.get("Authorization") ?? "")) {
    return json({ error: "forbidden" }, 403);
  }
  if (!REWARDS_API_KEY) return json({ error: "REWARDS_API_KEY no configurada en el proyecto" }, 500);

  try {
    const action = new URL(req.url).searchParams.get("action") || "";
    const body = await req.json().catch(() => ({} as Record<string, unknown>));
    const rewardsHeaders = { "Content-Type": "application/json", "x-rewards-key": REWARDS_API_KEY };

    if (action === "registrar") {
      const ctx = (body._context ?? {}) as Record<string, unknown>;
      const res = await fetch(`${REWARDS_BASE}/registrar-referido`, {
        method: "POST", headers: rewardsHeaders,
        body: JSON.stringify({
          codigo: body.codigo,
          cliente_telefono: body.cliente_telefono,
          producto: body.producto,
          evento: body.evento,
          conversation_id: body.conversation_id ?? ctx.conversation_id ?? ctx.escalation_id,
        }),
      });
      return json(await res.json().catch(() => ({})), res.ok ? 200 : res.status);
    }

    if (action === "liberar") {
      const res = await fetch(`${REWARDS_BASE}/liberar-referido`, {
        method: "POST", headers: rewardsHeaders,
        body: JSON.stringify({ cliente_telefono: body.cliente_telefono, evento: body.evento ?? "primera_recarga" }),
      });
      return json(await res.json().catch(() => ({})), res.ok ? 200 : res.status);
    }

    if (action === "validar") {
      const codigo = encodeURIComponent(String(body.codigo ?? ""));
      const res = await fetch(`${REWARDS_BASE}/validar-codigo?codigo=${codigo}`, {
        method: "GET", headers: { "x-rewards-key": REWARDS_API_KEY },
      });
      return json(await res.json().catch(() => ({})), res.ok ? 200 : res.status);
    }

    return json({ error: `acción desconocida: '${action}'` }, 400);
  } catch (e) {
    return json({ error: String((e as Error)?.message ?? e) }, 500);
  }
});
