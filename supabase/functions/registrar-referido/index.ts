// POST /functions/v1/registrar-referido
// Auth: header `x-rewards-key` (o ?key= para pruebas) contra REWARDS_API_KEY
// Body: { codigo, cliente_telefono, producto?, evento?, conversation_id? }
// La llaman los agentes de IA de Yaub cuando un cliente da un código de vendedor.
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
  const url = new URL(req.url);
  const provided = req.headers.get("x-rewards-key") ?? url.searchParams.get("key") ?? "";
  if (!provided) return false;
  const envKey = Deno.env.get("REWARDS_API_KEY");
  if (envKey && provided === envKey) return true;
  const hash = await sha256Hex(provided);
  const { data } = await adminClient().from("api_keys").select("id").eq("key_hash", hash).eq("activa", true).maybeSingle();
  return !!data;
}

// "jaco 01", "JACO01", "jaco-01" → "JACO-01"
function normalizarCodigo(raw: string): string | null {
  const limpio = (raw ?? "").toUpperCase().replace(/[^A-Z0-9]/g, "");
  const m = limpio.match(/^([A-Z]{4})(\d{2})$/);
  return m ? `${m[1]}-${m[2]}` : null;
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

  const codigo = normalizarCodigo(body.codigo ?? "");
  const telefono = (body.cliente_telefono ?? "").trim();
  if (!codigo) {
    return json({ ok: false, error: "Código inválido. Formato esperado: 4 letras + 2 dígitos, ej. JACO-01" }, 400);
  }
  if (normTel(telefono).length < 10) {
    return json({ ok: false, error: "cliente_telefono inválido (se esperan al menos 10 dígitos)" }, 400);
  }

  const db = adminClient();

  const { data: freelancer, error: fErr } = await db
    .from("freelancers")
    .select("id, nombre, codigo, activo")
    .eq("codigo", codigo)
    .maybeSingle();
  if (fErr) return json({ ok: false, error: fErr.message }, 500);
  if (!freelancer || !freelancer.activo) {
    return json({ ok: false, error: `No existe un vendedor con el código ${codigo}` }, 404);
  }

  // Oferta activa de una empresa autorizada; por default la de Yaub Móvil.
  let q = db
    .from("ofertas")
    .select("id, producto, comision_mxn, empresas!inner(id, nombre, estado)")
    .eq("activa", true)
    .eq("empresas.estado", "autorizada");
  if (body.producto?.trim()) q = q.ilike("producto", `%${body.producto.trim()}%`);
  const { data: ofertas, error: oErr } = await q;
  if (oErr) return json({ ok: false, error: oErr.message }, 500);
  const oferta =
    ofertas?.find((o: any) => o.empresas?.nombre === "Yaub Móvil") ?? ofertas?.[0];
  if (!oferta) return json({ ok: false, error: "No hay una oferta activa para registrar el referido" }, 404);

  // Idempotencia: mismo teléfono + misma oferta no se duplica.
  const telNorm = normTel(telefono);
  const { data: existente } = await db
    .from("referidos")
    .select("id, estatus, monto_mxn")
    .eq("oferta_id", oferta.id)
    .eq("tel_norm", telNorm)
    .maybeSingle();
  if (existente) {
    return json({
      ok: true,
      ya_registrado: true,
      freelancer_nombre: freelancer.nombre,
      codigo,
      monto: Number(existente.monto_mxn),
      estatus: existente.estatus,
    });
  }

  const { data: nuevo, error: iErr } = await db
    .from("referidos")
    .insert({
      codigo,
      freelancer_id: freelancer.id,
      oferta_id: oferta.id,
      cliente_telefono: telefono,
      monto_mxn: oferta.comision_mxn,
      estatus: "pendiente",
      evento_alta: body.evento?.trim() || "portabilidad",
      conversation_id: body.conversation_id ?? null,
    })
    .select("id, estatus, monto_mxn")
    .single();

  if (iErr) {
    // carrera contra otro registro simultáneo → responde idempotente
    if (iErr.code === "23505") {
      const { data: race } = await db
        .from("referidos")
        .select("id, estatus, monto_mxn")
        .eq("oferta_id", oferta.id)
        .eq("tel_norm", telNorm)
        .maybeSingle();
      if (race) {
        return json({
          ok: true,
          ya_registrado: true,
          freelancer_nombre: freelancer.nombre,
          codigo,
          monto: Number(race.monto_mxn),
          estatus: race.estatus,
        });
      }
    }
    return json({ ok: false, error: iErr.message }, 500);
  }

  return json({
    ok: true,
    ya_registrado: false,
    freelancer_nombre: freelancer.nombre,
    codigo,
    monto: Number(nuevo.monto_mxn),
    estatus: nuevo.estatus,
  });
});
