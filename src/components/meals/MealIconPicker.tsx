import { useId, useMemo, useRef, useState, type KeyboardEvent } from 'react'
import {
  filterMealIconOptions,
  mealIconOptions,
  type MealIconKey,
} from '../../data/meal-icons'

export type MealIconPickerProps = {
  value: MealIconKey
  onChange: (icon: MealIconKey) => void
  disabled?: boolean
  label?: string
  id?: string
  className?: string
}

/**
 * An accessible, searchable icon grid. Buttons work with Enter and Space by
 * default and also support arrows, Home and End to move inside the grid.
 */
export function MealIconPicker({
  value,
  onChange,
  disabled = false,
  label = 'Ícone da refeição',
  id,
  className = '',
}: MealIconPickerProps) {
  const generatedId = useId()
  const searchId = id ?? `meal-icon-search-${generatedId}`
  const [query, setQuery] = useState('')
  const buttons = useRef<Array<HTMLButtonElement | null>>([])
  const options = useMemo(() => filterMealIconOptions(query), [query])
  const selectedOption = mealIconOptions.find((option) => option.key === value)

  const moveFocus = (currentIndex: number, offset: number) => {
    if (!options.length) return
    const nextIndex = (currentIndex + offset + options.length) % options.length
    buttons.current[nextIndex]?.focus()
  }

  const handleKeyDown = (
    event: KeyboardEvent<HTMLButtonElement>,
    currentIndex: number,
  ) => {
    if (!options.length) return

    if (event.key === 'ArrowRight' || event.key === 'ArrowDown') {
      event.preventDefault()
      moveFocus(currentIndex, 1)
    } else if (event.key === 'ArrowLeft' || event.key === 'ArrowUp') {
      event.preventDefault()
      moveFocus(currentIndex, -1)
    } else if (event.key === 'Home') {
      event.preventDefault()
      buttons.current[0]?.focus()
    } else if (event.key === 'End') {
      event.preventDefault()
      buttons.current[options.length - 1]?.focus()
    }
  }

  return (
    <fieldset className={`meal-icon-picker ${className}`.trim()} disabled={disabled}>
      <legend>{label}</legend>
      <div className="meal-icon-picker-search">
        <label htmlFor={searchId}>Buscar ícone</label>
        <input
          id={searchId}
          className="field"
          type="search"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Ex.: café, jantar ou fruta"
          aria-describedby={`${searchId}-status`}
        />
      </div>

      {selectedOption && (
        <p className="meal-icon-picker-selection" aria-live="polite">
          Ícone selecionado: <selectedOption.Icon size={16} aria-hidden="true" />
          <strong>{selectedOption.label}</strong>
        </p>
      )}

      <p id={`${searchId}-status`} className="meal-icon-picker-status" aria-live="polite">
        {options.length === 1
          ? '1 ícone encontrado.'
          : `${options.length} ícones encontrados.`}
      </p>

      {options.length ? (
        <div className="meal-icon-picker-grid" aria-label="Ícones disponíveis para a refeição">
          {options.map((option, index) => {
            const Icon = option.Icon
            const isSelected = option.key === value

            return (
              <button
                key={option.key}
                ref={(element) => {
                  buttons.current[index] = element
                }}
                type="button"
                className={`meal-icon-picker-option ${isSelected ? 'is-selected' : ''}`}
                aria-label={`Selecionar ícone ${option.label}`}
                aria-pressed={isSelected}
                title={option.label}
                onClick={() => onChange(option.key)}
                onKeyDown={(event) => handleKeyDown(event, index)}
              >
                <Icon size={20} aria-hidden="true" />
                <span>{option.label}</span>
              </button>
            )
          })}
        </div>
      ) : (
        <p className="meal-icon-picker-empty" role="status">
          Nenhum ícone encontrado. Tente outro termo.
        </p>
      )}
    </fieldset>
  )
}
