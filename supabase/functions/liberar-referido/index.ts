// POST /functions/v1/liberar-referido
// Auth: header `x-rewards-key` contra REWARDS_API_KEY (o service-role interno).
// Body: { cliente_telefono, evento } (ej. evento: 'primera_recarga')
// Pasa el referido pendiente de ese teléfono a `liberado` (idempotente).
import { createClient } from "npm:@supabase/supabase-js@2";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-rewards-key",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...CORS, "Content-Type": "application/json" },
  });

async function sha256Hex(text: string): Promise<string> {
  const data = new TextEncoder().encode(text);
  const hash = await crypto.subtle.digest("SHA-256", data);
  return Array.from(new Uint8Array(hash)).map((b) => b.toString(16).padStart(2, "0")).join("");
}

function adminClient() {
  return createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    { db: { schema: "rewards" } },
  );
}

async function validarApiKey(req: Request): Promise<boolean> {
  const provided = req.headers.get("x-rewards-key") ?? "";
  if (!provided) return false;
  const envKey = Deno.env.get("REWARDS_API_KEY");
  if (envKey && provided === envKey) return true;
  // Llamadas internas del mismo proyecto (ej. yaub-rewards-proxy)
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (serviceKey && provided === serviceKey) return true;
  const hash = await sha256Hex(provided);
  const { data } = await adminClient().from("api_keys").select("id").eq("key_hash", hash).eq("activa", true).maybeSingle();
  return !!data;
}

const normTel = (t: string) => (t ?? "").replace(/\D/g, "").slice(-10);

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });
  if (req.method !== "POST") return json({ ok: false, error: "Usa POST" }, 405);
  if (!(await validarApiKey(req))) return json({ ok: false, error: "API key inválida" }, 401);

  let body: Record<string, string>;
  try {
    body = await req.json();
  } catch {
    return json({ ok: false, error: "Body JSON inválido" }, 400);
  }

  const telNorm = normTel(body.cliente_telefono ?? "");
  if (telNorm.length < 10) {
    return json({ ok: false, error: "cliente_telefono inválido (se esperan al menos 10 dígitos)" }, 400);
  }
  const evento = body.evento?.trim() || "primera_recarga";

  const db = adminClient();

  const { data: pendientes, error: pErr } = await db
    .from("referidos")
    .select("id, freelancer_id, monto_mxn, freelancers(nombre)")
    .eq("tel_norm", telNorm)
    .eq("estatus", "pendiente");
  if (pErr) return json({ ok: false, error: pErr.message }, 500);

  if (!pendientes || pendientes.length === 0) {
    // Idempotencia: ¿ya estaba liberado/pagado?
    const { data: previos } = await db
      .from("referidos")
      .select("id, estatus, monto_mxn, freelancers(nombre)")
      .eq("tel_norm", telNorm)
      .in("estatus", ["liberado", "pagado"]);
    if (previos && previos.length > 0) {
      return json({
        ok: true,
        ya_liberado: true,
        liberados: 0,
        freelancer_nombre: (previos[0] as any).freelancers?.nombre ?? null,
        monto: Number(previos[0].monto_mxn),
      });
    }
    return json({ ok: false, error: "No hay un referido registrado con ese teléfono" }, 404);
  }

  const ids = pendientes.map((r) => r.id);
  const { error: uErr } = await db
    .from("referidos")
    .update({
      estatus: "liberado",
      liberado_at: new Date().toISOString(),
      evento_liberacion: evento,
    })
    .in("id", ids);
  if (uErr) return json({ ok: false, error: uErr.message }, 500);

  const total = pendientes.reduce((s, r) => s + Number(r.monto_mxn), 0);
  return json({
    ok: true,
    ya_liberado: false,
    liberados: pendientes.length,
    freelancer_nombre: (pendientes[0] as any).freelancers?.nombre ?? null,
    monto: total,
    evento,
  });
});
