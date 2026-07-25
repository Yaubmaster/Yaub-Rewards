// POST /functions/v1/crear-cuenta-rewards
// Alta de cuenta para Yaub Rewards SIN correo de confirmación:
// crea el usuario ya confirmado vía la admin API (service role) y el cliente
// inicia sesión inmediatamente con email+password.
// Equivale al signup público (mismos datos, misma exposición), pero evita
// depender del SMTP del proyecto y no toca la config global de Auth.
//
// SSO con la plataforma (Feature 1):
// · rol=empresa → is_self_signup: el trigger de plataforma crea su tenant
//   self_service real (+ plan + permisos), igual que un alta en yaub.ai.
//   rewards.ensure_empresa_tenant lo liga a la empresa en el primer uso.
// · rol=freelancer → sin tenant (marcador app_user_id), solo app_users.
// · codigo_referido (opcional, freelancer): se valida aquí ANTES de crear la
//   cuenta y viaja en user_metadata para que registrar_freelancer lo aplique.
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
  const codigoReferido = (body.codigo_referido ?? "").trim();

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

  // Código de referido (solo freelancers): validar antes de crear la cuenta
  // para que el form pueda corregirlo sin dejar cuentas a medias.
  if (rol === "freelancer" && codigoReferido) {
    const { data: val, error: valErr } = await rdb
      .schema("rewards")
      .rpc("validar_codigo_vendedor", { p_codigo: codigoReferido });
    if (valErr) {
      console.error("validar_codigo_vendedor falló:", valErr.message);
    } else if (!(val as { valido?: boolean } | null)?.valido) {
      return json({ ok: false, error: "codigo_invalido" }, 400);
    }
  }

  const admin = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );

  const esEmpresa = rol === "empresa";

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
      // Código de vendedor que lo refirió (lo aplica registrar_freelancer)
      codigo_referido: rol === "freelancer" && codigoReferido ? codigoReferido : null,
      ...(esEmpresa
        ? {
            // Empresa = cuenta Yaub completa: el trigger de la plataforma crea
            // su tenant self_service (mismo camino que un alta en yaub.ai).
            is_self_signup: true,
            company_name: (body.empresa_nombre ?? "").trim() || nombre,
            source: "rewards",
          }
        : {
            // Freelancer: evita que el trigger de la plataforma cree un tenant
            // self-service; su app_user queda sin tenant (identidad única igual).
            app_user_id: "00000000-0000-0000-0000-000000000000",
            is_self_signup: false,
          }),
      password_change_required: false,
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
