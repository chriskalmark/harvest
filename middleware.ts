import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

/**
 * Omskrivninger. Adgangskontrollen ligger IKKE her.
 *
 * Harvest lå åben på internettet indtil 8. august 2026 -- 14 skriveruter
 * uden en eneste kontrol. Der stod kortvarigt en husstandskode her, men den
 * krævede at et scrypt-aftryk blev båret i hånden fra en terminal gennem
 * udklipsholderen til Portainer, og det gik galt tre gange i træk. Låsen
 * ligger nu foran appen i stedet, i Cloudflare Access -- se docs/adgang.md.
 *
 * DET BETYDER, AT APPEN SELV ER ÅBEN. Rammer nogen origin uden om
 * Cloudflare -- på LAN'et via port 3005, eller direkte på værtens adresse --
 * er der intet der stopper dem. Access er hele forsvaret, og derfor skal
 * DNS'en for mad.lmar.io blive ved med at være proxied.
 */

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  if (pathname === "/week" || pathname === "/plan") {
    const url = request.nextUrl.clone();
    url.pathname = "/menu";
    return NextResponse.rewrite(url);
  }

  if (pathname === "/junk") {
    const url = request.nextUrl.clone();
    url.pathname = "/menu";
    if (!url.searchParams.has("type")) {
      url.searchParams.set("type", "Junk");
    }
    return NextResponse.rewrite(url);
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/week", "/plan", "/junk"],
};
