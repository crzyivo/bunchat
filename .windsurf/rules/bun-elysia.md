---
trigger: always_on
---

Here is a comprehensive Markdown document outlining a code style guide and project structure for a Bun + Elysia.js project.

***

# Bun + Elysia.js TypeScript Style Guide

This document establishes the coding standards, project structure, and best practices for developing scalable applications using **Bun**, **Elysia.js**, and **TypeScript**.

## 1. Project Structure & File Distribution

For maintainability and scalability, we avoid placing all logic in a single file. We adopt a **Module/Domain-based** structure. Each logical entity (e.g., Auth, Users, Products) has its own folder containing its routes, handlers, and schemas.

### Directory Layout

```text
├── src/
│   ├── config/             # Environment variables and configuration
│   ├── db/                 # Database connection and setup (Drizzle/Prisma)
│   ├── libs/               # Shared utilities and helpers
│   ├── middlewares/        # Global middlewares (Auth, Logging)
│   ├── modules/            # Feature modules (The core logic)
│   │   └── users/
│   │       ├── users.controller.ts  # Logic (Handlers)
│   │       ├── users.routes.ts      # Route definitions & Schema validation
│   │       ├── users.service.ts     # Business logic & DB interaction
│   │       └── users.schema.ts      # TypeBox schemas (DTOs)
│   ├── views/              # HTML/JSX templates (if using SSR/HTMX)
│   │   ├── layouts/
│   │   └── pages/
│   ├── index.ts            # Entry point
│   └── setup.ts            # Global app setup (Swagger, global error handling)
├── tests/                  # Bun tests
├── bun.lockb
├── package.json
└── tsconfig.json
```

### The "Triad" Pattern
For every module, strictly separate concerns into three layers:

1.  **Routes (`*.routes.ts`):** Defines endpoints, HTTP methods, and input/output validation (Schema).
2.  **Controllers (`*.controller.ts`):** Handles the HTTP request/response context, parses params, and calls the service.
3.  **Services (`*.service.ts`):** Pure business logic and database interactions. **No HTTP context here.**

---

## 2. Naming Conventions

*   **Files:** Use `kebab-case` with descriptive suffixes.
    *   Good: `auth.controller.ts`, `user-profile.routes.ts`
    *   Bad: `AuthController.ts`, `userRoutes.ts`
*   **Classes/Interfaces/Types:** Use `PascalCase`.
*   **Variables/Functions:** Use `camelCase`.
*   **Constants:** Use `UPPER_SNAKE_CASE` for global constants.

---

## 3. TypeScript & Bun Best Practices

### Strict Typing
*   Enable `"strict": true` in `tsconfig.json`.
*   Avoid `any`. Use `unknown` if the type is truly uncertain, then narrow it down.
*   Use `import type { ... }` when importing interfaces or types to reduce bundle overhead.

### Bun Specifics
*   Use built-in Bun APIs where possible (e.g., `Bun.password`, `Bun.file`, `Bun.env`).
*   Use `console.log` sparingly; prefer a structured logger (like `pino`) for production.

---

## 4. Elysia Implementation Rules

### A. Routes (`*.routes.ts`)
*   Instantiate a new Elysia instance for the module.
*   Use chaining for clarity.
*   **Validation:** Always use the `body`, `query`, or `params` hooks with `t` (TypeBox) for validation.

```typescript
// src/modules/users/users.routes.ts
import { Elysia, t } from 'elysia';
import * as userController from './users.controller';

export const userRoutes = new Elysia({ prefix: '/users' })
  .get('/', userController.getUsers)
  .post('/', userController.createUser, {
    body: t.Object({
      email: t.String({ format: 'email' }),
      password: t.String({ minLength: 8 }),
      name: t.String()
    })
  });
```

### B. Handlers/Controllers (`*.controller.ts`)
*   Keep handlers clean. They should receive `Context` and return data.
*   Avoid inline business logic; delegate to a Service.
*   Use object destructuring for Context properties (`body`, `set`, `params`).

```typescript
// src/modules/users/users.controller.ts
import { Context } from 'elysia';
import * as userService from './users.service';

export const getUsers = async () => {
  return await userService.findAll();
};

export const createUser = async ({ body, set }: Context) => {
  // 'body' is already typed strictly thanks to the route schema
  const newUser = await userService.create(body);
  
  set.status = 201;
  return newUser;
};
```

### C. Views (`src/views/`)
If your project serves HTML (e.g., using `@elysiajs/html` with JSX/TSX):
*   Keep logic out of views. Data should be passed in via props.
*   Use functional components.

```tsx
// src/views/pages/home.tsx
import * as elements from "typed-html"; // or simple JSX via Bun

export const Home = ({ title }: { title: string }) => (
  <html lang="en">
    <head><title>{title}</title></head>
    <body>
      <h1>Welcome to {title}</h1>
    </body>
  </html>
);
```

### D. Global Application Composition (`index.ts`)
*   Keep the entry point minimal.
*   Import route modules and `.use()` them.

```typescript
// src/index.ts
import { Elysia } from 'elysia';
import { swagger } from '@elysiajs/swagger';
import { userRoutes } from './modules/users/users.routes';

const app = new Elysia()
  .use(swagger())
  .use(userRoutes) // Mount module
  .listen(3000);

console.log(`🦊 Elysia is running at ${app.server?.hostname}:${app.server?.port}`);
```

---

## 5. Error Handling

Do not use `try/catch` inside every controller. Use Elysia's global error handling or custom error classes.

1.  Create custom errors in `src/libs/errors.ts`.
2.  Add an `.onError()` hook in your main app instance or a global setup file.

```typescript
// Example: Global Error Handler
app.onError(({ code, error, set }) => {
  if (code === 'NOT_FOUND') {
    set.status = 404;
    return { success: false, message: 'Resource not found' };
  }
  if (code === 'VALIDATION') {
    set.status = 400;
    return { success: false, errors: error.all };
  }
  return { success: false, message: 'Internal Server Error' };
});
```

---

## 6. Testing

Use **Bun Test** runner. It is fast and compatible with Jest/Vitest syntax.

*   Place tests in a `tests/` folder mirroring the `src/` structure or alongside files as `*.test.ts`.
*   Use Elysia's `.handle()` method to test endpoints without spinning up a server port.

```typescript
// tests/modules/users.test.ts
import { describe, expect, it } from 'bun:test';
import { userRoutes } from '../../src/modules/users/users.routes';

describe('User Module', () => {
    it('should return 200 on GET /users', async () => {
        const app = new Elysia().use(userRoutes);
        
        const response = await app.handle(
            new Request('http://localhost/users')
        );
        
        expect(response.status).toBe(200);
    });
});
```

---

## 7. Configuration Checklist

Ensure your `tsconfig.json` is optimized for Bun:

```json
{
  "compilerOptions": {
    "lib": ["ESNext"],
    "module": "esnext",
    "target": "esnext",
    "moduleResolution": "bundler",
    "moduleDetection": "force",
    "allowImportingTsExtensions": true,
    "noEmit": true,
    "composite": true,
    "strict": true,
    "downlevelIteration": true,
    "skipLibCheck": true,
    "jsx": "react-jsx",
    "jsxImportSource": "@elysiajs/html", 
    "types": ["bun-types"] 
  }
}
```