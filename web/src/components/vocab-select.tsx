import { useTranslation } from 'react-i18next';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

// Select over a controlled vocabulary (species, sex, status, ...), resolving
// labels from i18n under `${prefix}.${code}`. With `allLabel` it renders an
// extra option mapping to undefined (used by list filters).
const ALL = '__all__';

export function VocabSelect({
  value,
  onValueChange,
  codes,
  prefix,
  allLabel,
  placeholder,
  id,
  className,
}: {
  value: string | null | undefined;
  onValueChange: (value: string | undefined) => void;
  codes: readonly string[];
  prefix: string;
  allLabel?: string;
  placeholder?: string;
  id?: string;
  className?: string;
}) {
  const { t } = useTranslation();
  return (
    <Select
      value={value ?? (allLabel ? ALL : '')}
      onValueChange={(next) => onValueChange(next === ALL ? undefined : next)}
    >
      <SelectTrigger id={id} className={className}>
        <SelectValue placeholder={placeholder} />
      </SelectTrigger>
      <SelectContent>
        {allLabel && <SelectItem value={ALL}>{allLabel}</SelectItem>}
        {codes.map((code) => (
          <SelectItem key={code} value={code}>
            {t(`${prefix}.${code}`)}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
