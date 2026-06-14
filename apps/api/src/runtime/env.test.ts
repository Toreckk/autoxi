import { afterEach, describe, expect, it } from "vitest";
import { getCorsOrigins, isCorsOriginAllowed } from "./env.js";

const originalCorsOrigins = process.env.CORS_ORIGINS;
const originalNodeEnv = process.env.NODE_ENV;

describe("API runtime env", () => {
  afterEach(() => {
    if (originalCorsOrigins === undefined) {
      delete process.env.CORS_ORIGINS;
    } else {
      process.env.CORS_ORIGINS = originalCorsOrigins;
    }

    if (originalNodeEnv === undefined) {
      delete process.env.NODE_ENV;
    } else {
      process.env.NODE_ENV = originalNodeEnv;
    }
  });

  it("defaults CORS to localhost and 127.0.0.1 Vite origins", () => {
    delete process.env.CORS_ORIGINS;

    expect(getCorsOrigins()).toEqual(["http://localhost:5173", "http://127.0.0.1:5173"]);
  });

  it("parses comma-separated CORS origins", () => {
    process.env.CORS_ORIGINS = "http://localhost:5173, http://127.0.0.1:5173";

    expect(getCorsOrigins()).toEqual(["http://localhost:5173", "http://127.0.0.1:5173"]);
  });

  it("allows loopback Vite fallback ports outside production", () => {
    process.env.NODE_ENV = "development";

    expect(isCorsOriginAllowed("http://127.0.0.1:5175")).toBe(true);
    expect(isCorsOriginAllowed("http://localhost:5174")).toBe(true);
    expect(isCorsOriginAllowed("http://example.com:5175")).toBe(false);
  });

  it("requires exact origins in production", () => {
    process.env.NODE_ENV = "production";
    process.env.CORS_ORIGINS = "https://app.example.com";

    expect(isCorsOriginAllowed("https://app.example.com")).toBe(true);
    expect(isCorsOriginAllowed("http://127.0.0.1:5175")).toBe(false);
  });
});
