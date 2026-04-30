/** Templates vazios para inicializar um layout novo. */

export const EMPTY_FOUND = `<view class="flex-1 bg-white p-8 items-center justify-center">
  <image src="\${produto.image_url}" class="w-64 h-64" mode="contain" />
  <text class="text-3xl font-bold text-slate-900 mt-4 text-center">\${produto.nome}</text>
  <text class="text-6xl font-extrabold text-slate-900 mt-6">\${formatPrice(produto.preco1)}</text>
  <text class="text-sm text-slate-400 mt-4">EAN: \${produto.ean}</text>
</view>
`;

export const EMPTY_NOT_FOUND = `<view class="flex-1 bg-white p-8 items-center justify-center">
  <text class="text-7xl">🚫</text>
  <text class="text-4xl font-bold text-red-600 mt-6 text-center">Produto não encontrado</text>
  <text class="text-base text-slate-500 mt-3 text-center">Verifique o código ou peça ajuda a um atendente.</text>
</view>
`;

export const EMPTY_IDLE = `<view class="flex-1 bg-white p-8 items-center justify-center">
  <text class="text-2xl text-slate-400">\${weekday}, \${date}</text>
  <text class="text-7xl font-extrabold text-slate-900 mt-2">\${time}</text>
  <text class="text-3xl font-bold text-slate-700 mt-12 text-center">Passe o produto no leitor</text>
  <text class="text-base text-slate-400 mt-3 text-center">para consultar o preço</text>
</view>
`;
