import { NextRequest, NextResponse } from "next/server";

type ApiHandler<T = unknown> = (request: NextRequest) => Promise<T>;

type ApiResponse<T> = {
  data?: T;
  error?: string;
  debug?: string;
};

/**
 * Standardized API route handler factory that handles:
 * - CORS headers
 * - Error handling
 * - JSON response formatting
 * - Cache control
 * - Consistent error serialization
 */
export function createRouteHandler<T>(handler: ApiHandler<T>) {
  return async function (request: NextRequest) {
    /*
     * Ingen CORS-headere.
     *
     * Her stod `Access-Control-Allow-Origin: *` paa hvert eneste svar. Det
     * betoed at et hvilket som helst website kunne laese OG aendre
     * madplanen fra jeres browser -- ruterne havde ingen godkendelse, saa
     * der var intet andet der stoppede det. Headeren blev i sin tid
     * fjernet fra next.config.ts, men den blev sat her ogsaa, og det var
     * her den blev ved med at komme fra.
     *
     * Appens egne skaerme kalder same-origin og har ikke brug for dem.
     * Skal en frontend paa et andet domaene have adgang, saa navngiv
     * praecis det ene domaene. Aldrig "*".
     */
    if (request.method === "OPTIONS") {
      return new NextResponse(null, { status: 204 });
    }

    try {
      const data = await handler(request);

      const response = NextResponse.json({
        data,
        error: undefined,
      } as ApiResponse<T>);

      response.headers.set("Cache-Control", "no-store, max-age=0");

      return response;
    } catch (error) {
      console.error(
        `API ${request.method} ${request.nextUrl.pathname} failed`,
        error,
      );
      const statusCode = error instanceof ApiError ? error.statusCode : 500;

      return NextResponse.json(
        {
          error:
            error instanceof Error ? error.message : "Internal server error",
          debug:
            process.env.NODE_ENV !== "production"
              ? error instanceof Error
                ? error.stack
                : String(error)
              : undefined,
        } as ApiResponse<T>,
        { status: statusCode },
      );
    }
  };
}

/**
 * Standard error class for API routes with status codes
 */
export class ApiError extends Error {
  statusCode: number;

  constructor(message: string, statusCode = 400) {
    super(message);
    this.statusCode = statusCode;
    this.name = "ApiError";
  }
}
