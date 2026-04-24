'use client';

interface ToggleSwitchProps {
  checked: boolean;
  onChange: (checked: boolean) => void;
  disabled?: boolean;
}

export function ToggleSwitch({ checked, onChange, disabled = false }: ToggleSwitchProps) {
  return (
    <button
      onClick={() => onChange(!checked)}
      disabled={disabled}
      className="relative inline-flex h-8 w-14 items-center rounded-full transition-all duration-300 focus:outline-none"
      style={{
        backgroundColor: checked ? 'var(--color-accent)' : 'var(--color-muted-soft)',
        opacity: disabled ? 0.5 : 1,
      }}
    >
      <span
        className="inline-block h-6 w-6 transform rounded-full bg-white shadow-lg transition-transform duration-300"
        style={{
          transform: checked ? 'translateX(28px)' : 'translateX(2px)',
        }}
      />
    </button>
  );
}
