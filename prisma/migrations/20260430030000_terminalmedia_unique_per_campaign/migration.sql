-- Permite a mesma mídia em terminais iguais entre campanhas distintas.
-- Mantém bloqueio de duplicata dentro da mesma campanha.

ALTER TABLE "terminal_medias" DROP CONSTRAINT IF EXISTS "terminal_medias_terminalId_mediaId_key";

ALTER TABLE "terminal_medias"
  ADD CONSTRAINT "terminal_medias_terminalId_mediaId_campaignId_key"
  UNIQUE ("terminalId", "mediaId", "campaignId");
