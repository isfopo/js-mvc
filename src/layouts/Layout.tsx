import type { FC, JSXNode, PropsWithChildren } from "hono/jsx";

interface LayoutProps extends PropsWithChildren {
  head?: JSXNode;
}

export const Layout: FC<LayoutProps> = ({ children, head = "" }) => {
  return (
    <html lang="en">
      <head>
        <meta charset="UTF-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1.0" />
        <meta name="description" content="JS-MVC" />
        <title>JS-MVC</title>
        <link rel="stylesheet" href="/styles/index.css" />

        {import.meta.env.DEV ? (
          <>
            <script type="module" src="/@vite/client"></script>
            <script type="module" src="/src/client/main.ts"></script>
          </>
        ) : (
          <script type="module" src="/client/main.js"></script>
        )}

        {head}
      </head>
      <body>
        <header>
          <nav>
            <ul>
              <li>
                <strong>js-mvc</strong>
              </li>
            </ul>
          </nav>
        </header>
        <main>{children}</main>
      </body>
    </html>
  );
};
