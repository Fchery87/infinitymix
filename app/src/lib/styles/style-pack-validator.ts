import Ajv2020, { type ErrorObject } from 'ajv/dist/2020';
import stylePackSchema from '@/lib/styles/style-pack.schema.json';
import type { StylePack } from '@/lib/styles/style-packs';

export type StylePackValidationError = {
  path: string;
  message: string;
  keyword?: string;
};

export type StylePackValidationResult =
  | { valid: true; stylePack: StylePack }
  | { valid: false; errors: StylePackValidationError[] };

let validatorSingleton: ReturnType<Ajv2020['compile']> | null = null;

function getValidator() {
  if (validatorSingleton) return validatorSingleton;
  const ajv = new Ajv2020({
    allErrors: true,
    strict: false,
    allowUnionTypes: true,
  });
  validatorSingleton = ajv.compile(stylePackSchema);
  return validatorSingleton;
}

function formatAjvErrors(errors: ErrorObject[] | null | undefined): StylePackValidationError[] {
  if (!errors || errors.length === 0) {
    return [{ path: '$', message: 'Invalid style pack payload' }];
  }
  return errors.map((error) => {
    const path = error.instancePath && error.instancePath.length > 0 ? `$${error.instancePath}` : '$';
    let message = error.message ?? 'Validation error';
    if (error.keyword === 'additionalProperties') {
      const extraProp = (error.params as { additionalProperty?: string }).additionalProperty;
      if (extraProp) {
        message = `Unexpected property "${extraProp}"`;
      }
    }
    return {
      path,
      message,
      keyword: error.keyword,
    };
  });
}

export function validateStylePack(input: unknown): StylePackValidationResult {
  const validate = getValidator();
  const valid = validate(input);
  if (!valid) {
    return {
      valid: false,
      errors: formatAjvErrors(validate.errors),
    };
  }
  return {
    valid: true,
    stylePack: input as StylePack,
  };
}

export function assertValidStylePack(input: unknown): StylePack {
  const result = validateStylePack(input);
  if ('errors' in result) {
    const error = new Error(result.errors.map((item) => `${item.path}: ${item.message}`).join('; '));
    (error as Error & { validationErrors?: StylePackValidationError[] }).validationErrors = result.errors;
    throw error;
  }
  return result.stylePack;
}
