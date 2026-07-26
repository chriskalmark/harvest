import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

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
