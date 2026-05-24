import { describe, it, expect, vi, beforeEach } from "vitest";
import { executeGuard } from "./guard-executor";
import { ValidationError } from "../errors";
import type { ValidateGuard } from "./GuardDescriptor";
import type { IValidatable, ValidationResult } from "./IValidatable";

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

function createMockContext(options: {
  contentType: string;
  parsedBody: Record<string, unknown>;
}) {
  const store = new Map<string, unknown>();

  return {
    req: {
      header: vi.fn((name: string) => {
        if (name === "content-type") return options.contentType;
        return undefined;
      }),
      parseBody: vi.fn(async () => options.parsedBody),
    },
    set: vi.fn((key: string, value: unknown) => store.set(key, value)),
    get: vi.fn((key: string) => store.get(key)),
  } as any;
}

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
