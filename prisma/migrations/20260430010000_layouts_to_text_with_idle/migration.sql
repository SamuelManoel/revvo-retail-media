-- Mudança de armazenamento: layouts agora são código HTML-like com Tailwind (TEXT),
-- não mais árvore JSON do Puck. Adiciona terceira tela "idle" (descanso).
-- Os 4 seeds antigos (em JSON) ficam descartados — serão recriados em código.

DELETE FROM "terminal_layouts";

ALTER TABLE "terminal_layouts"
  ALTER COLUMN "configFound"    DROP DEFAULT,
  ALTER COLUMN "configNotFound" DROP DEFAULT,
  ALTER COLUMN "configFound"    TYPE TEXT USING '',
  ALTER COLUMN "configNotFound" TYPE TEXT USING '',
  ALTER COLUMN "configFound"    SET DEFAULT '',
  ALTER COLUMN "configNotFound" SET DEFAULT '',
  ADD COLUMN "configIdle" TEXT NOT NULL DEFAULT '';
