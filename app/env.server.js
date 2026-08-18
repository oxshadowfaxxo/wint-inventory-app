const REQUIRED_ENVIRONMENT_VARIABLES = [
  "DATABASE_URL",
  "SHOPIFY_API_KEY",
  "SHOPIFY_API_SECRET",
  "SHOPIFY_APP_URL",
  "SCOPES",
];

function requireEnvironmentVariable(name) {
  const value = process.env[name];

  if (!value) {
    console.error(`Missing required environment variable: ${name}`);
    throw new Error(`Missing required environment variable: ${name}`);
  }

  return value;
}

export const serverEnvironment = Object.freeze(
  Object.fromEntries(
    REQUIRED_ENVIRONMENT_VARIABLES.map((name) => [
      name,
      requireEnvironmentVariable(name),
    ]),
  ),
);
