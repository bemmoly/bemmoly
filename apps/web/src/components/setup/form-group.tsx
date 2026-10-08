import { useId, type ReactNode } from 'react';

/** The 11px uppercase group label of the AI provider picker, reused for setup form groups. */
export const GROUP_LABEL = 'text-11 font-semibold tracking-label text-tx5 uppercase';

interface FormGroupProps {
  label: string;
  /** One line under the label saying what the group is for. */
  description: string;
  children: ReactNode;
}

/**
 * A run of fields inside a setup card. A fieldset with a legend, so screen readers announce the
 * group as well as each label; the fields stack one per row at the mock's 14px rhythm. No border
 * class here: preflight already clears the fieldset's, and the card's divide-y draws the rule.
 */
export function FormGroup({ label, description, children }: FormGroupProps) {
  const descriptionId = `${useId()}-description`;
  return (
    <fieldset aria-describedby={descriptionId} className="m-0 min-w-0 p-5">
      <legend className={`float-left mb-0.5 w-full p-0 ${GROUP_LABEL}`}>{label}</legend>
      <p id={descriptionId} className="m-0 clear-left text-12h leading-body text-tx4">
        {description}
      </p>
      <div className="mt-4 flex flex-col gap-3.5">{children}</div>
    </fieldset>
  );
}
