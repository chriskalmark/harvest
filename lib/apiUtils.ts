import { NextRequest, NextResponse } from "next/server";

type ApiHandler<T = unknown> = (
  request: NextRequest
) => Promise<T>;

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
    // Handle CORS preflight
    if (request.method === "OPTIONS") {
      return new NextResponse(null, { status: 200 });
    }

    try {
      const data = await handler(request);
      
      const response = NextResponse.json({
        data,
        error: undefined
      } as ApiResponse<T>);
      
      response.headers.set("Cache-Control", "no-store, max-age=0");
      response.headers.set("Access-Control-Allow-Origin", "*");
      response.headers.set("Access-Control-Allow-Methods", "GET, POST, PUT, PATCH, DELETE, OPTIONS");
      response.headers.set("Access-Control-Allow-Headers", "Content-Type");
      
      return response;
    } catch (error) {
      console.error(`API ${request.method} ${request.nextUrl.pathname} failed`, error);
      const statusCode = error instanceof ApiError ? error.statusCode : 500;
      
      return NextResponse.json(
        {
          error: error instanceof Error ? error.message : "Internal server error",
          debug: process.env.NODE_ENV !== "production" 
            ? error instanceof Error ? error.stack : String(error) 
            : undefined
        } as ApiResponse<T>,
        { status: statusCode }
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