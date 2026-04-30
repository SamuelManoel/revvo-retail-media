-- Remove o índice unique antigo (terminalId, mediaId) que sobrou após a swap de constraints.
-- A unicidade correta agora é (terminalId, mediaId, campaignId).

DROP INDEX IF EXISTS "terminal_medias_terminalId_mediaId_key";
