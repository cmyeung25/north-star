import { useEffect, useState } from "react";

export type EntityDraftErrors = Partial<Record<string, string>>;

export type EntityDraftValidation<T> = {
  isValid: boolean;
  errors: EntityDraftErrors;
  value?: T;
};

export const useEntityDraft = <T>(
  initial: T,
  validateDraft: (draft: T) => EntityDraftValidation<T>
) => {
  const [draft, setDraft] = useState<T>(initial);
  const [errors, setErrors] = useState<EntityDraftErrors>({});

  useEffect(() => {
    setDraft(initial);
    setErrors({});
  }, [initial]);

  const validate = () => {
    const result = validateDraft(draft);
    setErrors(result.errors);
    return result;
  };

  const reset = (next?: T) => {
    setDraft(next ?? initial);
    setErrors({});
  };

  return {
    draft,
    setDraft,
    errors,
    validate,
    reset,
  };
};
