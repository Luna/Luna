# Integration tests

## Running tests

Execute all commands from the parent directory.
Note that all options can be used in any combination.

```sh
# Run tests normally
pnpm playwright test
# Open UI to run tests
pnpm playwright test --ui
# Run tests in a specific file only
pnpm playwright test integration-test/dashboard/file-name-here.spec.ts
# Compile the entire app before running the tests.
# DOES NOT hot reload the tests.
# Prefer not using this when you are trying to fix a test;
# prefer using this when you just want to know which tests are failing (if any).
PROD=true pnpm playwright test
```

## Getting started

```ts
// ONLY chain methods from `pageActions`.
// Using methods not in `pageActions` is UNDEFINED BEHAVIOR.
// If it is absolutely necessary though, please remember to `await` the method chain.
test('test name here', ({ page }) => mockAllAndLogin({ page }).goToPage.drive())
```

### Perform arbitrary actions (e.g. actions on the API)

```ts
test('test name here', ({ page }) =>
  mockAllAndLogin({ page }).do((_page, { api }) => {
    api.foo()
    api.bar()
    expect(api.baz()?.quux).toEqual('bar')
  }))
```
