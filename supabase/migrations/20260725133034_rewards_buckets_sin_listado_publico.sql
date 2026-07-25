-- Los buckets públicos de Rewards sirven las URLs por /object/public/ sin pasar
-- por RLS, así que la policy amplia de SELECT sobre storage.objects no hace
-- falta para ver las imágenes: lo único que agregaba era poder LISTAR todos los
-- archivos del bucket (y las carpetas son el auth.uid() de cada usuario).
--
-- La dejamos acotada a la carpeta de cada quien. Nada en la app lista estos
-- buckets; solo sube y arma la URL pública.

drop policy if exists rewards_avatares_select on storage.objects;
create policy rewards_avatares_select on storage.objects
for select to authenticated
using (
  bucket_id = 'rewards-avatares'
  and (storage.foldername(name))[1] = (select auth.uid())::text
);

drop policy if exists rewards_fotos_select on storage.objects;
create policy rewards_fotos_select on storage.objects
for select to authenticated
using (
  bucket_id = 'rewards-fotos'
  and (storage.foldername(name))[1] = (select auth.uid())::text
);
