// POST /functions/v1/crear-cuenta-rewards
// Alta de cuenta para Yaub Rewards SIN correo de confirmación:
// crea el usuario ya confirmado vía la admin API (service role) y el cliente
// inicia sesión inmediatamente con email+password.
// Equivale al signup público (mismos datos, misma exposición), pero evita
// depender del SMTP del proyecto y no toca la config global de Auth.
import { createClient } from "npm:@supabase/supabase-js@2";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...CORS, "Content-Type": "application/json" },
  });

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });
  if (req.method !== "POST") return json({ ok: false, error: "Usa POST" }, 405);

  let body: Record<string, string>;
  try {
    body = await req.json();
  } catch {
    return json({ ok: false, error: "Body JSON inválido" }, 400);
  }

  const email = (body.email ?? "").trim().toLowerCase();
  const password = body.password ?? "";
  const nombre = (body.nombre ?? "").trim();
  const rol = body.rol === "empresa" ? "empresa" : "freelancer";

  if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email)) {
    return json({ ok: false, error: "Correo inválido" }, 400);
  }
  if (password.length < 8) {
    return json({ ok: false, error: "La contraseña debe tener al menos 8 caracteres" }, 400);
  }
  if (!nombre) {
    return json({ ok: false, error: "Nombre requerido" }, 400);
  }

  // Rate-limit anti-spam por IP (10 altas/hora): el signup es público y sin
  // confirmación de correo. Vía RPC atómica en public (check + insert) — el schema
  // rewards no es accesible por .from() desde aquí, solo por .rpc().
  const ip = (req.headers.get("x-forwarded-for") ?? "").split(",")[0].trim() || "desconocida";
  const rdb = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );
  const { data: allowed, error: thrErr } = await rdb.rpc("rewards_signup_allowed", { p_ip: ip });
  if (thrErr) {
    console.error("throttle rpc falló:", thrErr.message);
  } else if (allowed === false) {
    return json({ ok: false, error: "Demasiados intentos desde tu red. Intenta más tarde." }, 429);
  }

  const admin = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );

  const { error } = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: {
      full_name: nombre,
      phone: (body.telefono ?? "").trim() || null,
      rol,
      // Campos de empresa (los usa /registro/finalizar si aplica)
      empresa_nombre: body.empresa_nombre ?? null,
      empresa_descripcion: body.empresa_descripcion ?? null,
      empresa_producto: body.empresa_producto ?? null,
      empresa_comision: body.empresa_comision ?? null,
      empresa_condicion: body.empresa_condicion ?? null,
      empresa_capacitacion: body.empresa_capacitacion ?? null,
      // Evita que el trigger de la plataforma Yaub cree un tenant self-service
      app_user_id: "00000000-0000-0000-0000-000000000000",
      password_change_required: false,
      is_self_signup: false,
    },
  });

  if (error) {
    const msg = (error.message ?? "").toLowerCase();
    if (msg.includes("already") || msg.includes("registered") || error.code === "email_exists") {
      return json({ ok: false, error: "ya_existe" }, 409);
    }
    return json({ ok: false, error: error.message }, 500);
  }

  return json({ ok: true });
});
