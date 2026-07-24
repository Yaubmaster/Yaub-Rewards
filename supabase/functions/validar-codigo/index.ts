// GET /functions/v1/validar-codigo?codigo=JACO-01
// Auth: header `x-rewards-key` contra REWARDS_API_KEY (o service-role interno).
// Para que el agente valide un código antes de confirmar al cliente.
import { createClient } from "npm:@supabase/supabase-js@2";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-rewards-key",
  "Access-Control-Allow-Methods": "GET, OPTIONS",
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

function normalizarCodigo(raw: string): string | null {
  const limpio = (raw ?? "").toUpperCase().replace(/[^A-Z0-9]/g, "");
  const m = limpio.match(/^([A-Z]{4})(\d{2})$/);
  return m ? `${m[1]}-${m[2]}` : null;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });
  if (req.method !== "GET") return json({ ok: false, error: "Usa GET" }, 405);
  if (!(await validarApiKey(req))) return json({ ok: false, error: "API key inválida" }, 401);

  const url = new URL(req.url);
  const codigo = normalizarCodigo(url.searchParams.get("codigo") ?? "");
  if (!codigo) {
    return json({ ok: true, valido: false, error: "Formato de código inválido (4 letras + 2 dígitos, ej. JACO-01)" });
  }

  const { data: freelancer, error } = await adminClient()
    .from("freelancers")
    .select("nombre, activo")
    .eq("codigo", codigo)
    .maybeSingle();
  if (error) return json({ ok: false, error: error.message }, 500);

  if (!freelancer || !freelancer.activo) {
    return json({ ok: true, valido: false, codigo });
  }
  return json({ ok: true, valido: true, codigo, freelancer_nombre: freelancer.nombre });
});
