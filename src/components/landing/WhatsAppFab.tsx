"use client";

import { useEffect, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { WHATSAPP_DISPLAY, whatsappLink } from "./whatsapp";

export function WhatsAppFab() {
  const [show, setShow] = useState(false);
  const [bubble, setBubble] = useState(true);

  useEffect(() => {
    const onScroll = () => setShow(window.scrollY > 280);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    const t = setTimeout(() => setBubble(false), 8000);
    return () => {
      window.removeEventListener("scroll", onScroll);
      clearTimeout(t);
    };
  }, []);

  const url = whatsappLink("Olá! Quero saber mais sobre o Revvo Retail Media.");

  return (
    <AnimatePresence>
      {show && (
        <motion.div
          initial={{ opacity: 0, y: 24, scale: 0.85 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: 16, scale: 0.85 }}
          transition={{ duration: 0.35, ease: "easeOut" }}
          className="fixed bottom-6 right-6 z-50 flex items-end gap-3"
        >
          <AnimatePresence>
            {bubble && (
              <motion.button
                onClick={() => setBubble(false)}
                initial={{ opacity: 0, x: 10, scale: 0.9 }}
                animate={{ opacity: 1, x: 0, scale: 1 }}
                exit={{ opacity: 0, x: 10, scale: 0.9 }}
                transition={{ duration: 0.3 }}
                className="hidden max-w-xs items-start gap-2 rounded-2xl rounded-br-sm border border-border bg-surface px-4 py-3 text-left text-sm text-foreground shadow-xl backdrop-blur-xl md:flex"
              >
                <span className="block">
                  <strong className="block">Oi 👋</strong>
                  <span className="text-muted">
                    Quer transformar suas telas em receita? Fale com a gente.
                  </span>
                </span>
                <span className="text-muted/60 transition hover:text-foreground">
                  <svg
                    width="14"
                    height="14"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  >
                    <path d="M18 6L6 18M6 6l12 12" />
                  </svg>
                </span>
              </motion.button>
            )}
          </AnimatePresence>

          <a
            href={url}
            target="_blank"
            rel="noopener"
            aria-label={`Conversar pelo WhatsApp ${WHATSAPP_DISPLAY}`}
            className="group relative inline-flex h-14 w-14 items-center justify-center rounded-full bg-[#25D366] text-white shadow-[0_18px_40px_-10px_rgba(37,211,102,0.55)] transition hover:scale-105"
          >
            <span className="absolute inset-0 -z-10 animate-ping rounded-full bg-[#25D366] opacity-30" />
            <svg
              width="26"
              height="26"
              viewBox="0 0 32 32"
              fill="currentColor"
              aria-hidden
            >
              <path d="M19.11 17.21c-.27-.14-1.6-.79-1.85-.88-.25-.09-.43-.14-.61.14-.18.27-.7.88-.86 1.06-.16.18-.32.2-.59.07-.27-.14-1.14-.42-2.17-1.35-.8-.71-1.34-1.6-1.5-1.87-.16-.27-.02-.42.12-.55.12-.12.27-.32.41-.48.14-.16.18-.27.27-.45.09-.18.05-.34-.02-.48-.07-.14-.61-1.47-.83-2.02-.22-.53-.45-.46-.62-.47l-.53-.01c-.18 0-.48.07-.73.34-.25.27-.95.93-.95 2.26 0 1.33.97 2.62 1.11 2.8.14.18 1.92 2.93 4.65 4.11.65.28 1.16.45 1.55.58.65.21 1.24.18 1.71.11.52-.08 1.6-.65 1.82-1.28.22-.63.22-1.18.16-1.28-.07-.11-.25-.18-.52-.32zM16.03 5.34c-5.91 0-10.71 4.8-10.71 10.71 0 1.89.5 3.74 1.44 5.36L5.34 26.66l5.41-1.41c1.56.85 3.31 1.31 5.1 1.31 5.91 0 10.71-4.8 10.71-10.71S21.94 5.34 16.03 5.34zm0 19.34c-1.65 0-3.27-.44-4.69-1.28l-.34-.2-3.21.84.86-3.13-.22-.36c-.92-1.46-1.4-3.15-1.4-4.88 0-5.07 4.13-9.19 9.19-9.19s9.19 4.13 9.19 9.19c0 5.07-4.13 9.18-9.19 9.18z" />
            </svg>
          </a>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
