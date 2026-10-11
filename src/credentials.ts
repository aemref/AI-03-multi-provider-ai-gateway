import { inspect } from "node:util";

import { GatewayError } from "./errors.js";

const REDACTED = "[REDACTED]";
const ENVIRONMENT_VARIABLE = /^[A-Z_][A-Z0-9_]*$/u;

export interface EnvironmentCredentialSourceOptions {
  readonly providers: Readonly<Record<string, string>>;
  readonly environment?: Readonly<Record<string, string | undefined>>;
}

/** A credential that stays redacted during common logging and serialization. */
export class SecretValue {
  readonly #value: string;

  constructor(value: string) {
    if (value.length === 0) {
      throw new GatewayError("authentication", "Credential must not be empty");
    }
    this.#value = value;
  }

  use<T>(consumer: (value: string) => T): T {
    return consumer(this.#value);
  }

  toString(): string {
    return REDACTED;
  }

  toJSON(): string {
    return REDACTED;
  }

  [inspect.custom](): string {
    return REDACTED;
  }
}

/** Resolves explicitly mapped provider credentials without copying process.env. */
export class EnvironmentCredentialSource {
  readonly #providers: Readonly<Record<string, string>>;
  readonly #environment: Readonly<Record<string, string | undefined>>;

  constructor(options: EnvironmentCredentialSourceOptions) {
    const providers = Object.entries(options.providers);
    if (providers.length === 0) {
      throw new GatewayError(
        "invalid_request",
        "At least one provider credential mapping is required",
      );
    }
    for (const [provider, variable] of providers) {
      if (provider.length === 0 || !ENVIRONMENT_VARIABLE.test(variable)) {
        throw new GatewayError(
          "invalid_request",
          "Provider credential mappings must use non-empty providers and valid environment variable names",
        );
      }
    }

    this.#providers = Object.freeze(Object.fromEntries(providers));
    this.#environment = options.environment ?? process.env;
  }

  get(provider: string): SecretValue {
    const variable = this.#providers[provider];
    if (variable === undefined) {
      throw new GatewayError(
        "authentication",
        `No credential mapping is configured for provider ${provider}`,
        { provider },
      );
    }
    const value = this.#environment[variable];
    if (value === undefined || value.length === 0) {
      throw new GatewayError(
        "authentication",
        `Credential is unavailable for provider ${provider}`,
        { provider },
      );
    }
    return new SecretValue(value);
  }
}
