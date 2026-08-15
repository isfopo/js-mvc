
export type MethodDecoratorFactory = <This>(
  target: (this: This, ...args: any[]) => any,
  context: ClassMethodDecoratorContext<This>,
) => void;

export type GuardDescriptor = ExistsGuard | AuthorizeGuard | ValidateGuard;
