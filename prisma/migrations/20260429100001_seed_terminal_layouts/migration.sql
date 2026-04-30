-- Seed de layouts iniciais. Idempotente via slug.

INSERT INTO "terminal_layouts" ("slug","name","description","configFound","configNotFound") VALUES
(
  'classico-vertical',
  'Clássico Vertical',
  'Imagem do produto centralizada, nome em destaque e preço grande embaixo.',
  '{
    "root": {"props": {"backgroundColor":"#ffffff","paddingTop":32,"paddingRight":32,"paddingBottom":32,"paddingLeft":32}},
    "content": [
      {"type":"LogoLoja","props":{"id":"logo-1","width":140,"height":48,"resizeMode":"contain","align":"center"}},
      {"type":"ImagemProduto","props":{"id":"img-1","width":280,"height":280,"resizeMode":"contain","borderRadius":16,"fallbackBackground":"#f3f4f6"}},
      {"type":"NomeProduto","props":{"id":"nome-1","color":"#0f172a","fontSize":32,"fontWeight":"700","align":"center","maxLines":2,"uppercase":false}},
      {"type":"PrecoNormal","props":{"id":"preco1-1","color":"#0f172a","fontSize":72,"fontWeight":"800","align":"center","prefix":"R$ ","decimals":2,"showLabel":false}},
      {"type":"PrecoPromo","props":{"id":"preco2-1","color":"#ffffff","fontSize":48,"fontWeight":"800","align":"center","prefix":"R$ ","decimals":2,"showLabel":true,"label":"PROMOÇÃO","badgeBackground":"#ef4444","badgeColor":"#ffffff"}},
      {"type":"Ean","props":{"id":"ean-1","color":"#94a3b8","fontSize":14,"fontWeight":"500","align":"center","prefix":"EAN: "}}
    ],
    "zones": {}
  }'::jsonb,
  '{
    "root": {"props": {"backgroundColor":"#ffffff","paddingTop":48,"paddingRight":32,"paddingBottom":48,"paddingLeft":32}},
    "content": [
      {"type":"LogoLoja","props":{"id":"logo-1","width":120,"height":40,"resizeMode":"contain","align":"center"}},
      {"type":"MensagemNaoEncontrado","props":{"id":"msg-1","color":"#dc2626","fontSize":40,"fontWeight":"800","align":"center","text":"Produto não encontrado"}},
      {"type":"TextoLivre","props":{"id":"txt-1","color":"#475569","fontSize":18,"fontWeight":"400","align":"center","text":"Procure um atendente para verificar o item."}}
    ],
    "zones": {}
  }'::jsonb
),
(
  'pictorico-horizontal',
  'Pictórico Horizontal',
  'Imagem grande à esquerda, preços empilhados à direita (paisagem).',
  '{
    "root": {"props": {"backgroundColor":"#ffffff","paddingTop":24,"paddingRight":24,"paddingBottom":24,"paddingLeft":24}},
    "content": [
      {"type":"LogoLoja","props":{"id":"logo-1","width":120,"height":40,"resizeMode":"contain","align":"left"}},
      {"type":"ImagemProduto","props":{"id":"img-1","width":"50%","height":320,"resizeMode":"contain","borderRadius":12,"fallbackBackground":"#f8fafc"}},
      {"type":"NomeProduto","props":{"id":"nome-1","color":"#0f172a","fontSize":28,"fontWeight":"600","align":"left","maxLines":2}},
      {"type":"PrecoNormal","props":{"id":"preco1-1","color":"#0f172a","fontSize":56,"fontWeight":"800","align":"left","prefix":"R$ ","decimals":2,"showLabel":true,"label":"Preço normal"}},
      {"type":"PrecoFidelidade","props":{"id":"preco3-1","color":"#ffffff","fontSize":42,"fontWeight":"700","align":"left","prefix":"R$ ","decimals":2,"showLabel":true,"label":"FIDELIDADE","badgeBackground":"#7c3aed","badgeColor":"#ffffff"}},
      {"type":"Ean","props":{"id":"ean-1","color":"#94a3b8","fontSize":14,"fontWeight":"500","align":"left","prefix":"EAN "}}
    ],
    "zones": {}
  }'::jsonb,
  '{
    "root": {"props": {"backgroundColor":"#fef2f2","paddingTop":48,"paddingRight":32,"paddingBottom":48,"paddingLeft":32}},
    "content": [
      {"type":"MensagemNaoEncontrado","props":{"id":"msg-1","color":"#dc2626","fontSize":48,"fontWeight":"800","align":"center","text":"Item não localizado"}},
      {"type":"TextoLivre","props":{"id":"txt-1","color":"#7f1d1d","fontSize":18,"fontWeight":"400","align":"center","text":"Verifique o código ou peça ajuda a um atendente."}}
    ],
    "zones": {}
  }'::jsonb
),
(
  'promo-highlight',
  'Promo em destaque',
  'Promoção em destaque, preço normal pequeno acima e fidelidade abaixo.',
  '{
    "root": {"props": {"backgroundColor":"#0f172a","paddingTop":32,"paddingRight":32,"paddingBottom":32,"paddingLeft":32}},
    "content": [
      {"type":"LogoLoja","props":{"id":"logo-1","width":120,"height":40,"resizeMode":"contain","align":"center"}},
      {"type":"ImagemProduto","props":{"id":"img-1","width":220,"height":220,"resizeMode":"contain","borderRadius":12,"fallbackBackground":"#1e293b"}},
      {"type":"NomeProduto","props":{"id":"nome-1","color":"#f8fafc","fontSize":26,"fontWeight":"700","align":"center","maxLines":2,"uppercase":true}},
      {"type":"PrecoNormal","props":{"id":"preco1-1","color":"#94a3b8","fontSize":24,"fontWeight":"500","align":"center","prefix":"De R$ ","decimals":2,"showLabel":false}},
      {"type":"PrecoPromo","props":{"id":"preco2-1","color":"#0f172a","fontSize":80,"fontWeight":"900","align":"center","prefix":"R$ ","decimals":2,"showLabel":true,"label":"OFERTA","badgeBackground":"#fde047","badgeColor":"#0f172a"}},
      {"type":"PrecoFidelidade","props":{"id":"preco3-1","color":"#ffffff","fontSize":36,"fontWeight":"700","align":"center","prefix":"R$ ","decimals":2,"showLabel":true,"label":"FIDELIDADE","badgeBackground":"#7c3aed","badgeColor":"#ffffff"}}
    ],
    "zones": {}
  }'::jsonb,
  '{
    "root": {"props": {"backgroundColor":"#0f172a","paddingTop":48,"paddingRight":32,"paddingBottom":48,"paddingLeft":32}},
    "content": [
      {"type":"MensagemNaoEncontrado","props":{"id":"msg-1","color":"#fde047","fontSize":42,"fontWeight":"800","align":"center","text":"Produto não encontrado"}},
      {"type":"TextoLivre","props":{"id":"txt-1","color":"#cbd5e1","fontSize":16,"fontWeight":"400","align":"center","text":"Solicite ajuda a um atendente."}}
    ],
    "zones": {}
  }'::jsonb
)
ON CONFLICT ("slug") DO NOTHING;
