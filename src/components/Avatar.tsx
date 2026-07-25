'use client';

// Foto de perfil de un tenant, un agente/empresa o un vendedor.
//
// `Avatar` solo pinta (si no hay foto cae a iniciales o al icono que le pases).
// `AvatarEditable` agrega el subir/quitar: escribe en el bucket público
// `rewards-avatares` bajo la carpeta del usuario — la policy de storage exige
// que el primer segmento del path sea su auth.uid() — y le devuelve la URL
// pública a quien lo use para que la guarde donde corresponda.
import { useRef, useState } from 'react';
import { supabaseBrowser } from '@/lib/supabase/client';
import { Icon, ICON_PATHS, type IconName } from '@/components/icons';
import { iniciales } from '@/lib/format';

const BUCKET = 'rewards-avatares';
const MAX_MB = 4;

export function Avatar({
  url,
  nombre,
  size = 40,
  forma = 'cuadro',
  icono,
  className = '',
}: {
  url?: string | null;
  nombre?: string | null;
  size?: number;
  forma?: 'cuadro' | 'circulo';
  /** Fallback cuando no hay foto ni nombre útil (p. ej. 'bot' para agentes) */
  icono?: IconName;
  className?: string;
}) {
  const radio = forma === 'circulo' ? '9999px' : `${Math.max(8, Math.round(size * 0.28))}px`;
  const base = 'shrink-0 overflow-hidden bg-badge';

  if (url) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={url}
        alt={nombre ?? ''}
        className={`${base} object-cover ${className}`}
        style={{ width: size, height: size, borderRadius: radio }}
      />
    );
  }

  const txt = nombre ? iniciales(nombre) : '';
  return (
    <div
      className={`${base} flex items-center justify-center text-white ${className}`}
      style={{ width: size, height: size, borderRadius: radio }}
    >
      {txt && !icono ? (
        <span style={{ fontSize: Math.round(size * 0.38), fontWeight: 800 }}>{txt}</span>
      ) : (
        <Icon d={ICON_PATHS[icono ?? 'user']} size={Math.round(size * 0.5)} stroke="#fff" strokeWidth={2} />
      )}
    </div>
  );
}

export function AvatarEditable({
  url,
  nombre,
  size = 72,
  forma = 'cuadro',
  icono,
  /** Sufijo del archivo para no pisar avatares entre entidades del mismo dueño */
  slug,
  onGuardar,
}: {
  url?: string | null;
  nombre?: string | null;
  size?: number;
  forma?: 'cuadro' | 'circulo';
  icono?: IconName;
  slug: string;
  /** Recibe la URL pública nueva, o null cuando el usuario quita la foto. */
  onGuardar: (url: string | null) => Promise<void>;
}) {
  const input = useRef<HTMLInputElement>(null);
  const [subiendo, setSubiendo] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [previa, setPrevia] = useState<string | null | undefined>(undefined);
  const actual = previa === undefined ? url : previa;

  const subir = async (file: File | null) => {
    if (!file) return;
    setError(null);
    if (!file.type.startsWith('image/')) {
      setError('Tiene que ser una imagen.');
      return;
    }
    if (file.size > MAX_MB * 1024 * 1024) {
      setError(`La imagen pesa más de ${MAX_MB} MB.`);
      return;
    }
    setSubiendo(true);
    try {
      const supabase = supabaseBrowser();
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) throw new Error('Se cerró tu sesión. Vuelve a entrar.');
      const ext = (file.name.split('.').pop() ?? 'jpg').toLowerCase().replace(/[^a-z0-9]/g, '');
      const path = `${user.id}/${slug}-${Date.now()}.${ext || 'jpg'}`;
      const { error: e } = await supabase.storage.from(BUCKET).upload(path, file, {
        cacheControl: '3600',
        upsert: true,
      });
      if (e) throw new Error('No se pudo subir la imagen.');
      const publica = supabase.storage.from(BUCKET).getPublicUrl(path).data.publicUrl;
      await onGuardar(publica);
      setPrevia(publica);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setSubiendo(false);
      if (input.current) input.current.value = '';
    }
  };

  const quitar = async () => {
    setError(null);
    setSubiendo(true);
    try {
      await onGuardar(null);
      setPrevia(null);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setSubiendo(false);
    }
  };

  return (
    <div className="flex items-center gap-3.5">
      <button
        type="button"
        onClick={() => input.current?.click()}
        disabled={subiendo}
        className="relative shrink-0 transition-transform hover:-translate-y-0.5 disabled:opacity-60"
        aria-label="Cambiar foto"
      >
        <Avatar url={actual} nombre={nombre} size={size} forma={forma} icono={icono} />
        <span
          className="absolute -bottom-1 -right-1 flex h-6 w-6 items-center justify-center rounded-full border-2 border-card bg-ink text-white"
          aria-hidden
        >
          <Icon d={ICON_PATHS.image} size={12} stroke="#fff" strokeWidth={2} />
        </span>
      </button>

      <div className="min-w-0">
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => input.current?.click()}
            disabled={subiendo}
            className="rounded-xl border border-line px-3 py-1.5 text-[12.5px] font-bold text-slate2 transition-colors hover:border-cyan1 hover:text-[#0EA5E9] disabled:opacity-60"
          >
            {subiendo ? 'Subiendo…' : actual ? 'Cambiar foto' : 'Subir foto'}
          </button>
          {actual && !subiendo && (
            <button
              type="button"
              onClick={quitar}
              className="text-[12.5px] font-semibold text-slate3 transition-colors hover:text-red-500"
            >
              Quitar
            </button>
          )}
        </div>
        <p className="mt-1 text-[11.5px] text-slate3">JPG o PNG, hasta {MAX_MB} MB.</p>
        {error && <p className="mt-1 text-[12px] font-semibold text-red-500">{error}</p>}
      </div>

      <input
        ref={input}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={(e) => subir(e.target.files?.[0] ?? null)}
      />
    </div>
  );
}
