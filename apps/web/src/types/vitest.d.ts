declare module "vitest" {
  type TestCallback = () => void | Promise<void>;
  type TestFn = (name: string, fn: TestCallback) => void;
  type HookFn = (fn: TestCallback) => void;

  export const describe: TestFn;
  export const it: TestFn;
  export const beforeEach: HookFn;

  type Matchers = {
    toBe: (...args: unknown[]) => void;
    toEqual: (...args: unknown[]) => void;
    toHaveLength: (...args: unknown[]) => void;
    toMatchObject: (...args: unknown[]) => void;
    toBeUndefined: (...args: unknown[]) => void;
    toBeNull: (...args: unknown[]) => void;
    toBeCloseTo: (...args: unknown[]) => void;
    toThrow: (...args: unknown[]) => void;
  };

  export const expect: (...args: unknown[]) => Matchers & { not: Matchers };
}
