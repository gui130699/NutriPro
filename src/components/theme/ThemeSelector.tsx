import { Monitor, Moon, Sun } from 'lucide-react'
import type { ComponentType } from 'react'
import type { ThemePreference } from '../../lib/theme'

type ThemeSelectorProps = {
  value: ThemePreference
  onChange: (theme: ThemePreference) => void | Promise<void>
  disabled?: boolean
  label?: string
  className?: string
}

type ThemeOption = {
  value: ThemePreference
  label: string
  description: string
  icon: ComponentType<{ size?: number; strokeWidth?: number }>
}

const options: ThemeOption[] = [
  { value: 'light', label: 'Claro', description: 'Sempre claro', icon: Sun },
  { value: 'dark', label: 'Escuro', description: 'Sempre escuro', icon: Moon },
  { value: 'system', label: 'Sistema', description: 'Usar o aparelho', icon: Monitor },
]

export function ThemeSelector({
  value,
  onChange,
  disabled = false,
  label = 'Tema da interface',
  className = '',
}: ThemeSelectorProps) {
  return (
    <fieldset className={`theme-selector ${className}`.trim()} disabled={disabled}>
      <legend className="theme-selector-label">{label}</legend>
      <div className="theme-selector-options" role="radiogroup" aria-label={label}>
        {options.map(({ value: optionValue, label: optionLabel, description, icon: Icon }) => {
          const isSelected = value === optionValue

          return (
            <button
              key={optionValue}
              type="button"
              role="radio"
              aria-checked={isSelected}
              aria-label={`${optionLabel}: ${description}`}
              className={`theme-option ${isSelected ? 'theme-option-selected' : ''}`}
              onClick={() => void onChange(optionValue)}
              disabled={disabled}
            >
              <span className="theme-option-icon" aria-hidden="true">
                <Icon size={17} strokeWidth={2.1} />
              </span>
              <span className="theme-option-copy">
                <strong>{optionLabel}</strong>
                <small>{description}</small>
              </span>
            </button>
          )
        })}
      </div>
    </fieldset>
  )
}
