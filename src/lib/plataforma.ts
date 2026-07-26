// Enlaces a platform.yaub.ai desde Rewards.
//
// OJO — la plataforma es una SPA de Vite con **hash routing**: su router lee
// `window.location.hash`, y su `vercel.json` NO tiene rewrite catch-all a
// index.html. Es decir, `platform.yaub.ai/core-ia/assistants/<id>/manage`
// devuelve un 404 de Vercel y la app ni siquiera carga. La ruta buena siempre
// lleva `#` en medio:
//
//     https://platform.yaub.ai/#/core-ia/assistants/<id>/manage
//
// Por eso "Abrir en Yaub" mandaba a una página de error. Cualquier link nuevo
// a la plataforma tiene que salir de este archivo.
//
// Sobre la sesión: es la misma cuenta y el mismo proyecto de Supabase, pero NO
// la misma sesión de navegador. Rewards guarda la suya en cookies
// (`@supabase/ssr`) y la plataforma en localStorage (`supabase-js` pelón), y
// localStorage no se comparte entre subdominios. Si ya tienes sesión abierta en
// platform.yaub.ai entras directo; si no, te pide entrar con la misma cuenta de
// Yaub. Para que la sesión viaje sola habría que cambiar el almacenamiento en
// la plataforma, y eso se decide allá.

export const PLATAFORMA_URL = 'https://platform.yaub.ai';

const ruta = (r: string) => `${PLATAFORMA_URL}/#${r}`;

/**
 * Workspace del agente: configuración avanzada, canales, catálogo y billing.
 * Es a donde la plataforma se manda a sí misma desde sus propias pantallas
 * (`#/core-ia/assistants/<id>/workspace?advanced=1`).
 */
export const urlAgente = (assistantId: string) =>
  ruta(`/core-ia/assistants/${assistantId}/workspace?advanced=1`);

/** Playground de Yaub: probar el agente en vivo, con tool calling a la vista. */
export const urlPlayground = (assistantId: string) => ruta(`/playground/${assistantId}`);

/** Módulo de números de WhatsApp: conectar uno nuevo o ligar el del agente. */
export const urlNumerosWhatsApp = () => ruta('/yaubchat/numbers');
