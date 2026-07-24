// Extrae el ID de un link de YouTube (watch, youtu.be, shorts, embed, live)
export function youtubeId(url: string): string | null {
  const m = (url ?? '').match(
    /(?:youtube\.com\/(?:watch\?(?:.*&)?v=|shorts\/|embed\/|live\/)|youtu\.be\/)([\w-]{11})/,
  );
  return m ? m[1] : null;
}

export const youtubeEmbed = (id: string) => `https://www.youtube.com/embed/${id}`;
export const youtubeThumb = (id: string) => `https://i.ytimg.com/vi/${id}/hqdefault.jpg`;
