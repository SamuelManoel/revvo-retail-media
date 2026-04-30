-- Layout "Consulta de Preços (Clássico)" — versão fiel à arte do tablet
-- com header azul escuro, 2 colunas (imagem + info), 3 cards de preço
-- (DE cinza, POR vermelho, FIDELIDADE verde), faixa EAN e footer azul.

INSERT INTO "terminal_layouts" ("slug","name","description","configFound","configNotFound") VALUES
(
  'consulta-precos-classico',
  'Consulta de Preços (Clássico)',
  'Layout em duas colunas no estilo tablet: imagem grande à esquerda, nome do produto e cards coloridos de preço (DE/POR/FIDELIDADE) à direita, barra EAN e rodapé azul.',
  $jsonF$
{
  "root": {"props": {"backgroundColor":"#ffffff","paddingTop":0,"paddingRight":0,"paddingBottom":0,"paddingLeft":0}},
  "content": [
    {"type":"Container","props":{"id":"header","direction":"row","align":"center","justify":"space-between","backgroundColor":"#1e3a5f","paddingTop":18,"paddingRight":32,"paddingBottom":18,"paddingLeft":32,"borderRadius":0}},
    {"type":"Container","props":{"id":"main","direction":"row","align":"stretch","gap":16,"flex":1,"paddingTop":16,"paddingRight":16,"paddingBottom":12,"paddingLeft":16}},
    {"type":"Container","props":{"id":"ean-row","direction":"row","align":"center","gap":16,"backgroundColor":"#f1f5f9","paddingTop":18,"paddingRight":24,"paddingBottom":18,"paddingLeft":24,"borderRadius":12,"width":"100%"}},
    {"type":"Container","props":{"id":"footer","direction":"row","align":"center","justify":"space-between","backgroundColor":"#1e3a5f","paddingTop":12,"paddingRight":32,"paddingBottom":12,"paddingLeft":32,"borderRadius":0}}
  ],
  "zones": {
    "zone-header": [
      {"type":"TextoLivre","props":{"id":"h-l","color":"#ffffff","fontSize":22,"fontWeight":"800","align":"left","text":"🏷️   CONSULTA DE PREÇOS"}},
      {"type":"TextoLivre","props":{"id":"h-r","color":"#ffffff","fontSize":18,"fontWeight":"700","align":"right","text":"🛒  CONFIRA O PREÇO AQUI!"}}
    ],
    "zone-main": [
      {"type":"Container","props":{"id":"left","direction":"column","align":"center","justify":"center","flex":1,"backgroundColor":"#f8fafc","borderRadius":16,"paddingTop":24,"paddingRight":24,"paddingBottom":24,"paddingLeft":24}},
      {"type":"Container","props":{"id":"right","direction":"column","gap":14,"flex":1,"paddingTop":4,"paddingRight":8,"paddingBottom":4,"paddingLeft":12}}
    ],
    "zone-left": [
      {"type":"ImagemProduto","props":{"id":"img-p","width":"100%","height":420,"resizeMode":"contain","borderRadius":12,"fallbackBackground":"#ffffff"}}
    ],
    "zone-right": [
      {"type":"NomeProduto","props":{"id":"nome","color":"#0f172a","fontSize":48,"fontWeight":"800","align":"left","maxLines":2}},
      {"type":"Container","props":{"id":"card-p1","direction":"row","align":"center","justify":"space-between","backgroundColor":"#f1f5f9","paddingTop":18,"paddingRight":24,"paddingBottom":18,"paddingLeft":24,"borderRadius":14}},
      {"type":"Container","props":{"id":"card-p2","direction":"row","align":"center","justify":"space-between","backgroundColor":"#dc2626","paddingTop":18,"paddingRight":24,"paddingBottom":18,"paddingLeft":24,"borderRadius":14}},
      {"type":"Container","props":{"id":"card-p3","direction":"row","align":"center","justify":"space-between","backgroundColor":"#16a34a","paddingTop":18,"paddingRight":24,"paddingBottom":18,"paddingLeft":24,"borderRadius":14}}
    ],
    "zone-card-p1": [
      {"type":"TextoLivre","props":{"id":"l-p1","color":"#475569","fontSize":22,"fontWeight":"600","align":"left","text":"Preço DE"}},
      {"type":"PrecoNormal","props":{"id":"v-p1","color":"#475569","fontSize":48,"fontWeight":"900","align":"right","prefix":"R$ ","decimals":2,"showLabel":false}}
    ],
    "zone-card-p2": [
      {"type":"TextoLivre","props":{"id":"l-p2","color":"#ffffff","fontSize":22,"fontWeight":"700","align":"left","text":"Preço POR  👍"}},
      {"type":"PrecoPromo","props":{"id":"v-p2","color":"#ffffff","fontSize":48,"fontWeight":"900","align":"right","prefix":"R$ ","decimals":2,"showLabel":false,"badgeBackground":"transparent","badgeColor":"#ffffff"}}
    ],
    "zone-card-p3": [
      {"type":"TextoLivre","props":{"id":"l-p3","color":"#ffffff","fontSize":22,"fontWeight":"700","align":"left","text":"⭐  Preço fidelidade"}},
      {"type":"PrecoFidelidade","props":{"id":"v-p3","color":"#ffffff","fontSize":44,"fontWeight":"900","align":"right","prefix":"R$ ","decimals":2,"showLabel":false,"badgeBackground":"transparent","badgeColor":"#ffffff"}}
    ],
    "zone-ean-row": [
      {"type":"TextoLivre","props":{"id":"ean-l","color":"#1e293b","fontSize":18,"fontWeight":"700","align":"left","text":"📊  EAN"}},
      {"type":"Ean","props":{"id":"ean-v","color":"#0f172a","fontSize":24,"fontWeight":"700","align":"left","prefix":""}}
    ],
    "zone-footer": [
      {"type":"TextoLivre","props":{"id":"f-l","color":"#cbd5e1","fontSize":13,"fontWeight":"400","align":"left","text":"ℹ️   Preços válidos para esta loja e enquanto durarem os estoques."}},
      {"type":"TextoLivre","props":{"id":"f-r","color":"#ffffff","fontSize":14,"fontWeight":"700","align":"right","text":"🛒  OBRIGADO PELA PREFERÊNCIA!"}}
    ]
  }
}
$jsonF$::jsonb,
  $jsonNF$
{
  "root": {"props": {"backgroundColor":"#ffffff","paddingTop":0,"paddingRight":0,"paddingBottom":0,"paddingLeft":0}},
  "content": [
    {"type":"Container","props":{"id":"header","direction":"row","align":"center","justify":"space-between","backgroundColor":"#1e3a5f","paddingTop":18,"paddingRight":32,"paddingBottom":18,"paddingLeft":32}},
    {"type":"Container","props":{"id":"middle","direction":"column","align":"center","justify":"center","gap":16,"flex":1,"paddingTop":48,"paddingRight":32,"paddingBottom":48,"paddingLeft":32}},
    {"type":"Container","props":{"id":"footer","direction":"row","align":"center","justify":"space-between","backgroundColor":"#1e3a5f","paddingTop":12,"paddingRight":32,"paddingBottom":12,"paddingLeft":32}}
  ],
  "zones": {
    "zone-header": [
      {"type":"TextoLivre","props":{"id":"h-l","color":"#ffffff","fontSize":22,"fontWeight":"800","align":"left","text":"🏷️   CONSULTA DE PREÇOS"}},
      {"type":"TextoLivre","props":{"id":"h-r","color":"#ffffff","fontSize":18,"fontWeight":"700","align":"right","text":"🛒  CONFIRA O PREÇO AQUI!"}}
    ],
    "zone-middle": [
      {"type":"TextoLivre","props":{"id":"icon","color":"#dc2626","fontSize":96,"fontWeight":"800","align":"center","text":"🚫"}},
      {"type":"MensagemNaoEncontrado","props":{"id":"msg","color":"#0f172a","fontSize":48,"fontWeight":"800","align":"center","text":"Produto não encontrado"}},
      {"type":"TextoLivre","props":{"id":"sub","color":"#64748b","fontSize":20,"fontWeight":"400","align":"center","text":"Verifique o código ou peça ajuda a um atendente."}}
    ],
    "zone-footer": [
      {"type":"TextoLivre","props":{"id":"f-l","color":"#cbd5e1","fontSize":13,"fontWeight":"400","align":"left","text":"ℹ️   Preços válidos para esta loja e enquanto durarem os estoques."}},
      {"type":"TextoLivre","props":{"id":"f-r","color":"#ffffff","fontSize":14,"fontWeight":"700","align":"right","text":"🛒  OBRIGADO PELA PREFERÊNCIA!"}}
    ]
  }
}
$jsonNF$::jsonb
)
ON CONFLICT ("slug") DO NOTHING;
