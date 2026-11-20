import { Dropdown, type DropdownOption } from "../ui/Dropdown";

/**
 * A choice box in an admin form, built on the site's Dropdown (the browser's own list looks different
 * on every device and cannot be styled): the label above it, the box full width like the text boxes.
 */
export function AdminSelect({
  label,
  value,
  options,
  onChange,
  disabled,
}: {
  label: string;
  value: string;
  options: readonly DropdownOption[];
  onChange: (value: string) => void;
  disabled?: boolean;
}) {
  return (
    <div className="os-field os-field-select">
      <span aria-hidden="true">{label}</span>
      <Dropdown className="os-field-dropdown" label={label} value={value} options={options} onChange={onChange} disabled={disabled} />
    </div>
  );
}
