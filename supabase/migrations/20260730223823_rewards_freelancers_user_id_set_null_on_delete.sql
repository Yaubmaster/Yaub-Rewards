-- Al eliminar un usuario de plataforma (auth.users), conservar su cuenta de Rewards:
-- el freelancer y su historial (referidos/pagos/suscripciones) sobreviven, solo se desvincula el login.
-- Antes: ON DELETE CASCADE → chocaba con referidos_freelancer_id_fkey (RESTRICT) y ademas
-- habria borrado pagos/suscripciones en cascada.
ALTER TABLE rewards.freelancers ALTER COLUMN user_id DROP NOT NULL;
ALTER TABLE rewards.freelancers DROP CONSTRAINT freelancers_user_id_fkey;
ALTER TABLE rewards.freelancers
  ADD CONSTRAINT freelancers_user_id_fkey
  FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE SET NULL;
