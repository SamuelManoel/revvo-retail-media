import { NextRequest, NextResponse } from "next/server";

type Body = {
  name?: string;
  company?: string;
  email?: string;
  phone?: string;
  role?: string;
  message?: string;
};

const isEmail = (s: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(s);

export async function POST(req: NextRequest) {
  let body: Body;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ message: "JSON inválido." }, { status: 400 });
  }

  const name = body.name?.trim();
  const company = body.company?.trim();
  const email = body.email?.trim();
  const phone = body.phone?.trim();
  const role = body.role?.trim();
  const message = body.message?.trim();

  if (!name || !company || !email || !phone || !role) {
    return NextResponse.json(
      { message: "Preencha os campos obrigatórios." },
      { status: 400 }
    );
  }
  if (!isEmail(email)) {
    return NextResponse.json({ message: "E-mail inválido." }, { status: 400 });
  }

  // TODO: integrar com CRM / e-mail transacional.
  console.log("[contact] novo lead", {
    name,
    company,
    email,
    phone,
    role,
    message,
    at: new Date().toISOString(),
  });

  return NextResponse.json({ ok: true });
}
