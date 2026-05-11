export const WHATSAPP_NUMBER = "5511999999999";
export const WHATSAPP_DISPLAY = "(11) 99999-9999";

export function whatsappLink(message?: string) {
  const base = `https://wa.me/${WHATSAPP_NUMBER}`;
  if (!message) return base;
  return `${base}?text=${encodeURIComponent(message)}`;
}
