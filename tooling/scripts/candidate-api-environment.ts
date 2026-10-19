/** Synthetic composition settings, never production credentials or provider config. */
export function candidateApiEnvironment(uri: string) {
  return {
    DATABASE_URL: uri,
    PUBLIC_APP_URL: "https://candidate.example.test",
    JWT_SECRET: "candidate-probe-only-not-a-working-session-key-20261019",
  };
}
