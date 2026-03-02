/**
 * Lightweight JSON schema validator for the subset used by cognitive phase schemas.
 */

function isPlainObject(value: any) {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function matchesType(expected: any, value: any) {
  if (expected === 'null') return value === null;
  if (expected === 'array') return Array.isArray(value);
  if (expected === 'object') return isPlainObject(value);
  if (expected === 'number') return typeof value === 'number' && Number.isFinite(value);
  return typeof value === expected;
}

function appendError(errors: any, instancePath: any, message: any) {
  errors.push({ instancePath, message });
}

function validateSchema(schema: any, value: any, instancePath: any = '') {
  const errors: any[] = [];

  if (!schema || typeof schema !== 'object') {
    return errors;
  }

  if (Array.isArray(schema.anyOf)) {
    const anyValid = schema.anyOf.some((candidate: any) => validateSchema(candidate, value, instancePath).length === 0);
    if (!anyValid) {
      appendError(errors, instancePath, 'must match at least one schema in anyOf');
    }
    return errors;
  }

  if (Array.isArray(schema.enum)) {
    if (!schema.enum.some((item: any) => item === value)) {
      appendError(errors, instancePath, `must be one of: ${schema.enum.join(', ')}`);
      return errors;
    }
  }

  if (schema.type !== undefined) {
    const expectedTypes = Array.isArray(schema.type) ? schema.type : [schema.type];
    const validType = expectedTypes.some((type: any) => matchesType(type, value));

    if (!validType) {
      appendError(errors, instancePath, `must be of type ${expectedTypes.join(' or ')}`);
      return errors;
    }
  }

  if (typeof value === 'string') {
    if (typeof schema.minLength === 'number' && value.length < schema.minLength) {
      appendError(errors, instancePath, `must NOT have fewer than ${schema.minLength} characters`);
    }
  }

  if (typeof value === 'number') {
    if (typeof schema.minimum === 'number' && value < schema.minimum) {
      appendError(errors, instancePath, `must be >= ${schema.minimum}`);
    }
    if (typeof schema.maximum === 'number' && value > schema.maximum) {
      appendError(errors, instancePath, `must be <= ${schema.maximum}`);
    }
  }

  if (Array.isArray(value)) {
    if (schema.items) {
      value.forEach((item: any, index: any) => {
        errors.push(...validateSchema(schema.items, item, `${instancePath}/${index}`));
      });
    }
    return errors;
  }

  if (isPlainObject(value)) {
    const properties = schema.properties || {};

    if (Array.isArray(schema.required)) {
      for (const requiredKey of schema.required) {
        if (!(requiredKey in value)) {
          appendError(errors, `${instancePath}/${requiredKey}`, 'is required');
        }
      }
    }

    if (schema.additionalProperties === false) {
      for (const key of Object.keys(value)) {
        if (!(key in properties)) {
          appendError(errors, `${instancePath}/${key}`, 'must NOT have additional properties');
        }
      }
    }

    for (const [key, propertySchema] of Object.entries(properties)) {
      if (key in value) {
        errors.push(...validateSchema(propertySchema, value[key], `${instancePath}/${key}`));
      }
    }
  }

  return errors;
}

export function compileJsonSchema(schema: any) {
  const validator: any = (value: any) => {
    validator.errors = validateSchema(schema, value, '');
    return validator.errors.length === 0;
  };

  validator.errors = [] as any[];
  return validator;
}
