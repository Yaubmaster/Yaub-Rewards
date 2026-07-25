// POST /functions/v1/rewards-agentes
// Backend de la consola "Agentes Yaub Conectados" del perfil de empresa.
// Auth: Bearer del USUARIO logueado en Rewards (se valida con getUser); las
// escrituras van con service role después de verificar que la empresa es suya.
//
// Acciones (body.action):
//   ensure_tenant  { empresa_id }
//   list           { empresa_id }
//   quick_create   { empresa_id, nombre, prompt }
//   add_website    { empresa_id, assistant_id, url }
//   add_document   { empresa_id, assistant_id, path, titulo }   (archivo ya subido a storage)
//   add_image      { empresa_id, assistant_id, path, nombre, instruccion }
//   list_context   { empresa_id, assistant_id }
//   delete_context { empresa_id, assistant_id, tipo: 'conocimiento'|'imagen', id }
//
// El contexto (sitios/docs/imágenes) se guarda en assistant_knowledge y
// product_catalog (tablas normales de la plataforma) Y se compila a un bloque
// delimitado dentro de assistants.prompt para garantizar que cualquier runtime
// lo use. El editor avanzado de platform.yaub.ai ve el mismo bloque.
import { createClient, SupabaseClient } from "npm:@supabase/supabase-js@2";

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

const MARCA_INICIO = "<!-- rewards:contexto:inicio -->";
const MARCA_FIN = "<!-- rewards:contexto:fin -->";
const MAX_TEXTO_ITEM = 6000;
const MAX_BLOQUE = 14000;
const DOMINIOS_WIDGET = ["rewards.yaub.ai", "yaub.ai", "www.yaub.ai", "platform.yaub.ai", "app.yaub.ai"];

function wkKey(): string {
  const abc = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
  const bytes = crypto.getRandomValues(new Uint8Array(32));
  let out = "wk_";
  for (const b of bytes) out += abc[b % abc.length];
  return out;
}

function limpiarHtml(html: string): string {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<noscript[\s\S]*?<\/noscript>/gi, " ")
    .replace(/<!--[\s\S]*?-->/g, " ")
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/(p|div|li|h[1-6]|tr|section|article)>/gi, "\n")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&#\d+;/g, " ")
    .replace(/[ \t]+/g, " ")
    .replace(/\n\s*\n\s*\n+/g, "\n\n")
    .trim();
}

// Recompila el bloque de contexto dentro de assistants.prompt.
// Solo se toca `prompt`: el trigger de plataforma lo espeja a chat/voice.
async function recompilarContexto(svc: SupabaseClient, assistantId: string) {
  const { data: asst, error: aErr } = await svc
    .from("assistants")
    .select("id, prompt")
    .eq("id", assistantId)
    .single();
  if (aErr || !asst) throw new Error("assistant no encontrado al recompilar");

  const { data: know } = await svc
    .from("assistant_knowledge")
    .select("title, content, content_type, file_url")
    .eq("assistant_id", assistantId)
    .eq("is_active", true)
    .filter("metadata->>source", "eq", "rewards")
    .order("created_at", { ascending: true });

  const { data: imgs } = await svc
    .from("product_catalog")
    .select("name, description, image_url")
    .eq("assistant_id", assistantId)
    .eq("category", "rewards_media")
    .eq("is_active", true)
    .order("created_at", { ascending: true });

  let bloque = "";
  const partes: string[] = [];
  for (const k of know ?? []) {
    if (k.content && k.content.trim()) {
      partes.push(`### ${k.title}\n${k.content.slice(0, MAX_TEXTO_ITEM)}`);
    } else if (k.file_url) {
      partes.push(`### ${k.title}\n(Documento disponible en: ${k.file_url})`);
    }
  }
  if ((imgs ?? []).length > 0) {
    const lineas = (imgs ?? []).map(
      (i) => `- Cuando: "${i.description ?? "aplique"}" → comparte "${i.name}" pegando esta URL en tu respuesta: ${i.image_url}`,
    );
    partes.push(
      `### Imágenes que puedes compartir\nSi la conversación cumple la condición, incluye la URL de la imagen tal cual en tu mensaje (el chat la muestra como imagen).\n${lineas.join("\n")}`,
    );
  }

  if (partes.length > 0) {
    bloque =
      `\n\n${MARCA_INICIO}\n## Contexto del negocio (gestionado desde Yaub Rewards — no editar a mano)\n` +
      partes.join("\n\n").slice(0, MAX_BLOQUE) +
      `\n${MARCA_FIN}`;
  }

  const regex = new RegExp(`\\n*${MARCA_INICIO}[\\s\\S]*?${MARCA_FIN}`, "g");
  const base = (asst.prompt ?? "").replace(regex, "").trimEnd();
  const nuevo = base + bloque;

  const { error: upErr } = await svc.from("assistants").update({ prompt: nuevo }).eq("id", assistantId);
  if (upErr) throw new Error(`no se pudo actualizar el prompt: ${upErr.message}`);
}

// Vuelca las ofertas activas de la empresa como contexto del agente: qué vende,
// a qué precio, cuánto paga de comisión y con qué condición se libera. Se
// guarda como una entrada de conocimiento (idempotente por título) para que
// entre al bloque de contexto del prompt junto con sitios y documentos.
async function sincronizarOfertas(
  svc: SupabaseClient,
  svcRewards: SupabaseClient,
  assistantId: string,
  empresaId: string,
) {
  const { data: ofertas } = await svcRewards
    .from("ofertas")
    .select("producto, descripcion, precio_mxn, comision_mxn, condicion_liberacion")
    .eq("empresa_id", empresaId)
    .eq("activa", true);

  const TITULO = "Catálogo y comisiones";
  await svc
    .from("assistant_knowledge")
    .delete()
    .eq("assistant_id", assistantId)
    .eq("title", TITULO)
    .filter("metadata->>source", "eq", "rewards");

  if ((ofertas ?? []).length > 0) {
    const lineas = (ofertas ?? []).map((o) => {
      const partes = [`- ${o.producto}`];
      if (o.descripcion) partes.push(`  ${o.descripcion}`);
      if (o.precio_mxn) partes.push(`  Precio: $${o.precio_mxn} MXN`);
      partes.push(`  Comisión al vendedor: $${o.comision_mxn} MXN`);
      if (o.condicion_liberacion) partes.push(`  Se libera cuando: ${o.condicion_liberacion}`);
      return partes.join("\n");
    });
    await svc.from("assistant_knowledge").insert({
      assistant_id: assistantId,
      title: TITULO,
      content:
        `Esto es lo que vendes. Al cerrar una venta pregunta siempre quién refirió al cliente ` +
        `y registra su código de vendedor.\n\n${lineas.join("\n\n")}`,
      content_type: "text",
      metadata: { source: "rewards", tipo: "ofertas" },
    });
  }

  await recompilarContexto(svc, assistantId);
}

// Regenera assistants.catalog_instructions con las condiciones de las imágenes.
async function sincronizarCatalogInstructions(svc: SupabaseClient, assistantId: string) {
  const { data: imgs } = await svc
    .from("product_catalog")
    .select("name, description")
    .eq("assistant_id", assistantId)
    .eq("category", "rewards_media")
    .eq("is_active", true);

  let texto: string | null = null;
  if ((imgs ?? []).length > 0) {
    texto =
      "Comparte cada imagen del catálogo cuando aplique su condición:\n" +
      (imgs ?? []).map((i) => `- "${i.name}": ${i.description ?? "cuando sea relevante"}`).join("\n");
  }
  await svc.from("assistants").update({ catalog_instructions: texto }).eq("id", assistantId);
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });
  if (req.method !== "POST") return json({ ok: false, error: "Usa POST" }, 405);

  let body: Record<string, string>;
  try {
    body = await req.json();
  } catch {
    return json({ ok: false, error: "Body JSON inválido" }, 400);
  }

  const url = Deno.env.get("SUPABASE_URL")!;
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;

  // Identidad del usuario (Bearer de la sesión de Rewards)
  const authHeader = req.headers.get("authorization") ?? "";
  const userClient = createClient(url, anonKey, {
    global: { headers: { Authorization: authHeader } },
  });
  const {
    data: { user },
  } = await userClient.auth.getUser();
  if (!user) return json({ ok: false, error: "No autenticado" }, 401);

  const svc = createClient(url, serviceKey);
  const svcRewards = svc.schema("rewards");

  const empresaId = body.empresa_id ?? "";
  if (!empresaId) return json({ ok: false, error: "empresa_id requerido" }, 400);

  // La empresa debe ser del usuario
  const { data: empresa, error: empErr } = await svcRewards
    .from("empresas")
    .select("id, user_id, nombre, tenant_id, estado, assistant_id")
    .eq("id", empresaId)
    .single();
  if (empErr || !empresa) return json({ ok: false, error: "Empresa no encontrada" }, 404);
  if (empresa.user_id !== user.id) return json({ ok: false, error: "No autorizado" }, 403);

  // Tenant garantizado para toda acción (definer valida con auth.uid())
  const ensureTenant = async (): Promise<string> => {
    if (empresa.tenant_id) return empresa.tenant_id as string;
    const { data, error } = await userClient
      .schema("rewards")
      .rpc("ensure_empresa_tenant", { p_empresa_id: empresaId });
    if (error || !data) throw new Error(`No se pudo preparar tu cuenta Yaub: ${error?.message ?? "sin tenant"}`);
    return data as string;
  };

  // Assistant del tenant de la empresa (para acciones de contexto)
  const assistantDelTenant = async (tenantId: string) => {
    const assistantId = body.assistant_id ?? "";
    if (!assistantId) throw new Error("assistant_id requerido");
    const { data: asst, error } = await svc
      .from("assistants")
      .select("id, tenant_id, name, prompt")
      .eq("id", assistantId)
      .single();
    if (error || !asst) throw new Error("Agente no encontrado");
    if (asst.tenant_id !== tenantId) throw new Error("Ese agente no es de tu empresa");
    return asst;
  };

  try {
    switch (body.action) {
      case "ensure_tenant": {
        const tenantId = await ensureTenant();
        return json({ ok: true, tenant_id: tenantId });
      }

      case "list": {
        const tenantId = await ensureTenant();
        const { data: agentes, error } = await svc
          .from("assistants")
          .select("id, name, slug, is_active, created_at, avatar_url, widget_public_key, widget_config, source, archived_at, tools")
          .eq("tenant_id", tenantId)
          .is("archived_at", null)
          .order("created_at", { ascending: false });
        if (error) throw new Error(error.message);

        const { data: trials } = await svcRewards
          .from("agentes_trial")
          .select("assistant_id, trial_started_at, trial_ends_at, paused_at, activated_at")
          .eq("empresa_id", empresaId);
        const porAgente = new Map((trials ?? []).map((t) => [t.assistant_id, t]));

        // Solo los agentes CONECTADOS a Yaub Rewards, no todos los del tenant:
        // los creados desde esta consola (tienen trial) o los que ya traen la
        // herramienta de Rewards cableada en la plataforma.
        const conectados = (agentes ?? []).filter(
          (a) =>
            porAgente.has(a.id) ||
            JSON.stringify(a.tools ?? []).toLowerCase().includes("rewards"),
        );

        return json({
          ok: true,
          tenant_id: tenantId,
          agentes: conectados.map(({ tools: _tools, ...a }) => ({
            ...a,
            trial: porAgente.get(a.id) ?? null,
          })),
        });
      }

      case "quick_create": {
        const nombre = (body.nombre ?? "").trim();
        const prompt = (body.prompt ?? "").trim();
        if (!nombre) return json({ ok: false, error: "Ponle nombre a tu agente" }, 400);
        if (!prompt) return json({ ok: false, error: "Describe qué debe hacer tu agente" }, 400);

        // Una empresa = un agente
        if (empresa.assistant_id) {
          return json({ ok: false, error: "Esta empresa ya tiene su agente" }, 409);
        }

        const tenantId = await ensureTenant();

        // Modelo default del registry (is_recommended); fallback al default de la tabla
        const { data: modelo } = await svc
          .from("ai_model_registry")
          .select("model_id, provider")
          .eq("is_recommended", true)
          .eq("is_active", true)
          .limit(1)
          .maybeSingle();
        const llmModel = modelo?.model_id ?? "foundry-gpt-4o-mini";
        const llmProvider = modelo?.provider ?? "azure_foundry";

        const { data: appUser } = await svc
          .from("app_users")
          .select("id")
          .eq("auth_user_id", user.id)
          .maybeSingle();

        const { data: asst, error: insErr } = await svc
          .from("assistants")
          .insert({
            tenant_id: tenantId,
            name: nombre,
            slug: "", // lo genera el trigger de la plataforma
            prompt,
            assistant_type: "chatbot",
            mode: "inbound",
            source: "yaub_native",
            llm_provider: llmProvider,
            llm_model: llmModel,
            voice_provider: "none",
            is_active: true,
            channels: ["web"],
            created_by_user_id: appUser?.id ?? null,
            widget_public_key: wkKey(),
            widget_config: {
              enabled: true,
              allowed_domains: DOMINIOS_WIDGET,
              name: nombre,
              welcome: `¡Hola! Soy ${nombre}. ¿En qué te ayudo?`,
            },
            business_profile: { origen: "rewards", empresa_rewards_id: empresaId },
          })
          .select("id, name, slug, widget_public_key, is_active, created_at")
          .single();
        if (insErr || !asst) throw new Error(`No se pudo crear el agente: ${insErr?.message}`);

        // El agente ES la empresa: se ligan 1:1
        const { error: ligaErr } = await svcRewards
          .from("empresas")
          .update({ assistant_id: asst.id })
          .eq("id", empresaId);
        if (ligaErr) console.error("no se pudo ligar empresa↔agente:", ligaErr.message);

        const { data: trial, error: trialErr } = await svcRewards
          .from("agentes_trial")
          .insert({ assistant_id: asst.id, empresa_id: empresaId, tenant_id: tenantId })
          .select("*")
          .single();
        if (trialErr) console.error("trial insert falló:", trialErr.message);

        // Las ofertas de la empresa son el catálogo que el agente vende:
        // entran como contexto para que sepa qué ofrece y con qué condición.
        await sincronizarOfertas(svc, svcRewards, asst.id, empresaId);

        return json({ ok: true, agente: asst, trial: trial ?? null });
      }

      case "sync_ofertas": {
        const tenantId = await ensureTenant();
        const asst = await assistantDelTenant(tenantId);
        await sincronizarOfertas(svc, svcRewards, asst.id, empresaId);
        return json({ ok: true });
      }

      case "add_website": {
        const tenantId = await ensureTenant();
        const asst = await assistantDelTenant(tenantId);
        let sitio: URL;
        try {
          sitio = new URL((body.url ?? "").trim());
          if (!/^https?:$/.test(sitio.protocol)) throw new Error("protocolo");
        } catch {
          return json({ ok: false, error: "URL inválida (usa https://…)" }, 400);
        }

        const ctrl = new AbortController();
        const timer = setTimeout(() => ctrl.abort(), 12000);
        let texto = "";
        try {
          const res = await fetch(sitio.toString(), {
            signal: ctrl.signal,
            headers: { "User-Agent": "YaubRewardsBot/1.0 (+https://rewards.yaub.ai)" },
            redirect: "follow",
          });
          if (!res.ok) return json({ ok: false, error: `El sitio respondió ${res.status}` }, 400);
          const raw = (await res.text()).slice(0, 800_000);
          texto = limpiarHtml(raw).slice(0, MAX_TEXTO_ITEM);
        } catch {
          return json({ ok: false, error: "No pudimos leer ese sitio (timeout o bloqueo)" }, 400);
        } finally {
          clearTimeout(timer);
        }
        if (texto.length < 40) {
          return json({ ok: false, error: "Ese sitio no tiene texto legible (¿requiere JavaScript?)" }, 400);
        }

        const { data: fila, error: kErr } = await svc
          .from("assistant_knowledge")
          .insert({
            assistant_id: asst.id,
            title: `Sitio: ${sitio.hostname}${sitio.pathname !== "/" ? sitio.pathname : ""}`,
            content: texto,
            content_type: "website",
            metadata: { source: "rewards", url: sitio.toString() },
          })
          .select("id, title")
          .single();
        if (kErr) throw new Error(kErr.message);

        await recompilarContexto(svc, asst.id);
        return json({ ok: true, item: fila });
      }

      case "add_document": {
        const tenantId = await ensureTenant();
        const asst = await assistantDelTenant(tenantId);
        const path = (body.path ?? "").trim();
        const titulo = (body.titulo ?? "").trim() || path.split("/").pop() || "Documento";
        if (!path || !path.startsWith(`${user.id}/`)) {
          return json({ ok: false, error: "Archivo inválido" }, 400);
        }

        const { data: blob, error: dlErr } = await svc.storage.from("rewards-agentes").download(path);
        if (dlErr || !blob) return json({ ok: false, error: "No encontramos el archivo subido" }, 400);
        const { data: pub } = svc.storage.from("rewards-agentes").getPublicUrl(path);
        const fileUrl = pub.publicUrl;

        let contenido: string | null = null;
        const nombreArchivo = path.split("/").pop() ?? "documento";
        const ext = nombreArchivo.toLowerCase().split(".").pop() ?? "";
        try {
          if (ext === "pdf") {
            const { extractText, getDocumentProxy } = await import("npm:unpdf@0.12.1");
            const buf = new Uint8Array(await blob.arrayBuffer());
            const doc = await getDocumentProxy(buf);
            const { text } = await extractText(doc, { mergePages: true });
            contenido = (text as string).replace(/\s+\n/g, "\n").trim().slice(0, MAX_TEXTO_ITEM) || null;
          } else if (["txt", "md", "csv"].includes(ext)) {
            contenido = (await blob.text()).trim().slice(0, MAX_TEXTO_ITEM) || null;
          }
        } catch (e) {
          console.error("extracción de texto falló:", (e as Error).message);
        }

        const { data: fila, error: kErr } = await svc
          .from("assistant_knowledge")
          .insert({
            assistant_id: asst.id,
            title: titulo,
            content: contenido,
            content_type: "document",
            file_url: fileUrl,
            file_name: nombreArchivo,
            metadata: { source: "rewards", path, texto_extraido: contenido !== null },
          })
          .select("id, title")
          .single();
        if (kErr) throw new Error(kErr.message);

        await recompilarContexto(svc, asst.id);
        return json({ ok: true, item: fila, texto_extraido: contenido !== null });
      }

      case "add_image": {
        const tenantId = await ensureTenant();
        const asst = await assistantDelTenant(tenantId);
        const path = (body.path ?? "").trim();
        const nombre = (body.nombre ?? "").trim() || "Imagen";
        const instruccion = (body.instruccion ?? "").trim();
        if (!path || !path.startsWith(`${user.id}/`)) {
          return json({ ok: false, error: "Imagen inválida" }, 400);
        }
        if (!instruccion) {
          return json({ ok: false, error: "Dinos cuándo debe compartirla el agente" }, 400);
        }
        const { data: pub } = svc.storage.from("rewards-agentes").getPublicUrl(path);

        const { data: fila, error: cErr } = await svc
          .from("product_catalog")
          .insert({
            assistant_id: asst.id,
            tenant_id: tenantId,
            name: nombre,
            description: instruccion,
            image_url: pub.publicUrl,
            image_path: path,
            category: "rewards_media",
            is_active: true,
          })
          .select("id, name, image_url")
          .single();
        if (cErr) throw new Error(cErr.message);

        await sincronizarCatalogInstructions(svc, asst.id);
        await recompilarContexto(svc, asst.id);
        return json({ ok: true, item: fila });
      }

      case "list_context": {
        const tenantId = await ensureTenant();
        const asst = await assistantDelTenant(tenantId);
        const { data: conocimiento } = await svc
          .from("assistant_knowledge")
          .select("id, title, content_type, file_url, created_at, metadata")
          .eq("assistant_id", asst.id)
          .eq("is_active", true)
          .filter("metadata->>source", "eq", "rewards")
          .order("created_at", { ascending: false });
        const { data: imagenes } = await svc
          .from("product_catalog")
          .select("id, name, description, image_url, created_at")
          .eq("assistant_id", asst.id)
          .eq("category", "rewards_media")
          .eq("is_active", true)
          .order("created_at", { ascending: false });
        return json({ ok: true, conocimiento: conocimiento ?? [], imagenes: imagenes ?? [] });
      }

      case "delete_context": {
        const tenantId = await ensureTenant();
        const asst = await assistantDelTenant(tenantId);
        const id = body.id ?? "";
        if (!id) return json({ ok: false, error: "id requerido" }, 400);
        if (body.tipo === "imagen") {
          const { error } = await svc
            .from("product_catalog")
            .delete()
            .eq("id", id)
            .eq("assistant_id", asst.id)
            .eq("category", "rewards_media");
          if (error) throw new Error(error.message);
          await sincronizarCatalogInstructions(svc, asst.id);
        } else {
          const { error } = await svc
            .from("assistant_knowledge")
            .delete()
            .eq("id", id)
            .eq("assistant_id", asst.id)
            .filter("metadata->>source", "eq", "rewards");
          if (error) throw new Error(error.message);
        }
        await recompilarContexto(svc, asst.id);
        return json({ ok: true });
      }

      default:
        return json({ ok: false, error: "Acción no soportada" }, 400);
    }
  } catch (e) {
    console.error("rewards-agentes error:", (e as Error).message);
    return json({ ok: false, error: (e as Error).message }, 500);
  }
});
