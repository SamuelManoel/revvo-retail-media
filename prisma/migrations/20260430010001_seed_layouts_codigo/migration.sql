-- Seed inicial em código HTML-like com Tailwind. Idempotente via slug.

INSERT INTO "terminal_layouts" ("slug","name","description","configFound","configNotFound","configIdle") VALUES
(
  'consulta-precos-classico',
  'Consulta de Preços (Clássico)',
  'Layout em duas colunas inspirado no varejo: header azul, imagem grande à esquerda, cards de preço à direita.',
  $found$
<view class="flex-1 bg-white">
  <view class="flex-row items-center justify-between bg-[#1e3a5f] px-8 py-4">
    <text class="text-white text-2xl font-extrabold">🏷️  CONSULTA DE PREÇOS</text>
    <text class="text-white text-lg font-bold">🛒  ${store.name}</text>
  </view>

  <view class="flex-1 flex-row p-4 gap-4">
    <view class="flex-1 bg-slate-50 rounded-2xl items-center justify-center p-6">
      <image src="${produto.image_url}" class="w-full h-96" mode="contain" />
    </view>

    <view class="flex-1 gap-3">
      <text class="text-5xl font-extrabold text-slate-900">${produto.nome}</text>

      <view class="flex-row items-center justify-between bg-slate-100 rounded-2xl px-6 py-4">
        <text class="text-2xl font-semibold text-slate-600">Preço DE</text>
        <text class="text-5xl font-black text-slate-600">${formatPrice(produto.preco1)}</text>
      </view>

      <view class="flex-row items-center justify-between bg-red-600 rounded-2xl px-6 py-4">
        <text class="text-2xl font-bold text-white">Preço POR  👍</text>
        <text class="text-5xl font-black text-white">${formatPrice(produto.preco2)}</text>
      </view>

      <view class="flex-row items-center justify-between bg-emerald-600 rounded-2xl px-6 py-4">
        <text class="text-2xl font-bold text-white">⭐  Preço fidelidade</text>
        <text class="text-5xl font-black text-white">${formatPrice(produto.preco3)}</text>
      </view>
    </view>
  </view>

  <view class="flex-row items-center bg-slate-100 mx-4 mb-4 px-6 py-4 rounded-2xl gap-4">
    <text class="text-base font-bold text-slate-800">📊  EAN</text>
    <text class="text-2xl font-bold text-slate-900">${produto.ean}</text>
  </view>

  <view class="flex-row items-center justify-between bg-[#1e3a5f] px-8 py-3">
    <text class="text-slate-300 text-xs">ℹ️  Preços válidos para esta loja e enquanto durarem os estoques.</text>
    <text class="text-white text-sm font-bold">🛒  OBRIGADO PELA PREFERÊNCIA!</text>
  </view>
</view>
$found$,
  $nf$
<view class="flex-1 bg-white">
  <view class="flex-row items-center justify-between bg-[#1e3a5f] px-8 py-4">
    <text class="text-white text-2xl font-extrabold">🏷️  CONSULTA DE PREÇOS</text>
    <text class="text-white text-lg font-bold">🛒  ${store.name}</text>
  </view>
  <view class="flex-1 items-center justify-center px-8">
    <text class="text-7xl">🚫</text>
    <text class="mt-6 text-4xl font-extrabold text-slate-900 text-center">Produto não encontrado</text>
    <text class="mt-3 text-lg text-slate-500 text-center">Verifique o código ou peça ajuda a um atendente.</text>
  </view>
  <view class="flex-row items-center justify-between bg-[#1e3a5f] px-8 py-3">
    <text class="text-slate-300 text-xs">ℹ️  Preços válidos para esta loja e enquanto durarem os estoques.</text>
    <text class="text-white text-sm font-bold">🛒  OBRIGADO PELA PREFERÊNCIA!</text>
  </view>
</view>
$nf$,
  $idle$
<view class="flex-1 bg-white">
  <view class="flex-row items-center justify-between bg-[#1e3a5f] px-8 py-4">
    <text class="text-white text-2xl font-extrabold">🏷️  CONSULTA DE PREÇOS</text>
    <text class="text-white text-lg font-bold">${store.name}</text>
  </view>
  <view class="flex-1 items-center justify-center">
    <text class="text-xl text-slate-400">${weekday}, ${date}</text>
    <text class="text-8xl font-black text-slate-900 mt-2">${time}</text>
    <text class="mt-12 text-4xl font-extrabold text-slate-800 text-center">Passe o produto no leitor</text>
    <text class="mt-3 text-lg text-slate-500 text-center">para consultar o preço</text>
  </view>
  <view class="flex-row items-center justify-between bg-[#1e3a5f] px-8 py-3">
    <text class="text-white text-sm font-bold">🛒  Aguardando próximo cliente...</text>
  </view>
</view>
$idle$
),
(
  'minimalista-vertical',
  'Minimalista Vertical',
  'Layout simples: imagem centralizada, nome e preço único em destaque.',
  $found$
<view class="flex-1 bg-white p-8 items-center justify-center">
  <image src="${produto.image_url}" class="w-80 h-80" mode="contain" />
  <text class="text-4xl font-bold text-slate-900 mt-6 text-center">${produto.nome}</text>
  <text class="text-7xl font-black text-slate-900 mt-8">${formatPrice(produto.preco1)}</text>
  <text class="text-base text-slate-400 mt-6">EAN: ${produto.ean}</text>
</view>
$found$,
  $nf$
<view class="flex-1 bg-white items-center justify-center p-8">
  <text class="text-7xl">🚫</text>
  <text class="text-4xl font-bold text-red-600 mt-6 text-center">Produto não encontrado</text>
  <text class="text-base text-slate-500 mt-3 text-center">Verifique o código ou peça ajuda a um atendente.</text>
</view>
$nf$,
  $idle$
<view class="flex-1 bg-white items-center justify-center p-8">
  <text class="text-2xl text-slate-400">${weekday}, ${date}</text>
  <text class="text-8xl font-black text-slate-900 mt-2">${time}</text>
  <text class="mt-16 text-3xl font-bold text-slate-700 text-center">Passe o produto no leitor</text>
  <text class="mt-3 text-base text-slate-400 text-center">para consultar o preço</text>
</view>
$idle$
)
ON CONFLICT ("slug") DO NOTHING;
