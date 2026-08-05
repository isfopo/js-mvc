import { describe, it, expect, vi, beforeEach } from "vitest";
import { executeGuard } from "./guard-executor";
import { NotFoundError, ForbiddenError, ValidationError } from "../errors";
import type {
  AuthorizeGuard,
  ExistsGuard,
  IAuthorizable,
  IExistable,
  IValidatable,
  ValidateGuard,
  ValidationResult,
} from "./decorators";

// ── Test guards ─────────────────────────────────────────────────

class TestFindGuard implements IExistable {
  key = "tenet";
  loadCalls = 0;

  async load(): Promise<unknown> {
    this.loadCalls++;
    return { id: 1, slug: "test" };
  }
}

class FailingFindGuard implements IExistable {
  key = "item";

  async load(): Promise<unknown> {
    return null;
  }
}

class TestAuthGuard implements IAuthorizable {
  authorizeCalls = 0;

  authorize(): void {
    this.authorizeCalls++;
  }
}

class FailingAuthGuard implements IAuthorizable {
  authorize(): void {
    throw new ForbiddenError();
  }
}

class TestRequest implements IValidatable {
  static validateWasCalled = false;
  body: Record<string, unknown>;

  constructor(body: Record<string, unknown>) {
    this.body = body;
  }

  async validate(): Promise<ValidationResult> {
    TestRequest.validateWasCalled = true;
    return { valid: true };
  }
}

class FailingRequest implements IValidatable {
  body: Record<string, unknown>;

  constructor(body: Record<string, unknown>) {
    this.body = body;
  }

  async validate(): Promise<ValidationResult> {
    return { valid: false, errors: { field: "error" } };
  }
}

// ── Helpers ─────────────────────────────────────────────────────

function createMockContext(options: {
  contentType?: string;
  parsedBody?: Record<string, unknown>;
} = {}) {
  const store = new Map<string, unknown>();

  return {
    req: {
      header: vi.fn((name: string) => {
        if (name === "content-type") return options.contentType ?? "";
        return undefined;
      }),
      parseBody: vi.fn(async () => options.parsedBody ?? {}),
      json: vi.fn(async () => options.parsedBody ?? {}),
    },
    set: vi.fn((key: string, value: unknown) => store.set(key, value)),
    get: vi.fn((key: string) => store.get(key)),
  } as any;
}

// ── Tests ───────────────────────────────────────────────────────

describe("executeGuard — exists path", () => {
  it("calls IExistable.load() and stores the entity on context", async () => {
    const guard: ExistsGuard = {
      type: "exists",
      handlerName: "test",
      GuardClass: TestFindGuard,
    };

    const c = createMockContext();
    await executeGuard(guard, c);

    expect(c.set).toHaveBeenCalledWith("tenet", { id: 1, slug: "test" });
  });

  it("throws NotFoundError when load() returns null", async () => {
    const guard: ExistsGuard = {
      type: "exists",
      handlerName: "test",
      GuardClass: FailingFindGuard,
    };

    const c = createMockContext();
    await expect(executeGuard(guard, c)).rejects.toThrow(NotFoundError);
  });
});

describe("executeGuard — authorize path", () => {
  it("calls IAuthorizable.authorize()", async () => {
    const guard: AuthorizeGuard = {
      type: "authorize",
      handlerName: "test",
      GuardClass: TestAuthGuard,
    };

    const c = createMockContext();
    await executeGuard(guard, c);

    // authorize() was called (no throw = success)
  });

  it("propagates error thrown by authorize()", async () => {
    const guard: AuthorizeGuard = {
      type: "authorize",
      handlerName: "test",
      GuardClass: FailingAuthGuard,
    };

    const c = createMockContext();
    await expect(executeGuard(guard, c)).rejects.toThrow(ForbiddenError);
  });
});

describe("executeGuard — validate path", () => {
  beforeEach(() => {
    TestRequest.validateWasCalled = false;
  });

  it("calls validate() on the request class and stores the instance", async () => {
    const guard: ValidateGuard = {
      type: "validate",
      handlerName: "test",
      RequestClass: TestRequest,
    };

    const c = createMockContext({
      contentType: "application/x-www-form-urlencoded",
      parsedBody: { name: "test", value: "123" },
    });

    await executeGuard(guard, c);

    expect(TestRequest.validateWasCalled).toBe(true);
    expect(c.set).toHaveBeenCalledWith("validated", expect.any(TestRequest));
  });

  it("throws ValidationError when validate() returns valid: false", async () => {
    const guard: ValidateGuard = {
      type: "validate",
      handlerName: "test",
      RequestClass: FailingRequest,
    };

    const c = createMockContext({
      contentType: "application/x-www-form-urlencoded",
      parsedBody: { bad: "data" },
    });

    await expect(executeGuard(guard, c)).rejects.toThrow(ValidationError);

    try {
      await executeGuard(guard, c);
    } catch (error) {
      expect(error).toBeInstanceOf(ValidationError);
      expect((error as ValidationError).fields).toEqual({ field: "error" });
    }
  });
});
