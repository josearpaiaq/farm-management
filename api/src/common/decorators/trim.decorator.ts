import { Transform } from 'class-transformer';

// Strips surrounding whitespace before validation, so "  Ana " is stored as
// "Ana" and a blank "   " fails @IsNotEmpty. Never use it on passwords.
export function Trim(): PropertyDecorator {
  return Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? value.trim() : value,
  );
}
