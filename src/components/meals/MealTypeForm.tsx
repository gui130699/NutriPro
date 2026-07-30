import { zodResolver } from '@hookform/resolvers/zod'
import { Save, X } from 'lucide-react'
import { useEffect, useMemo, type CSSProperties } from 'react'
import { useForm } from 'react-hook-form'
import { z } from 'zod'
import { mealIconKeys, mealIcons } from '../../data/meal-icons'
import {
  createMealTypeDraft,
  resolveMealIconKey,
  type MealTypeDraft,
} from '../../lib/meal-types'
import { MealIconPicker } from './MealIconPicker'

const timePattern = /^([01]\d|2[0-3]):[0-5]\d$/
const colorPattern = /^#[\dA-Fa-f]{6}$/

// oxlint-disable-next-line react/only-export-components -- the schema is intentionally shared by form consumers and tests.
export const mealTypeFormSchema = z.object({
  name: z
    .string()
    .trim()
    .min(1, 'Informe o nome da refeição.')
    .max(80, 'Use no máximo 80 caracteres.'),
  icon: z.enum(mealIconKeys, { message: 'Escolha um ícone para a refeição.' }),
  color: z
    .union([
      z.literal(''),
      z.string().regex(colorPattern, 'Escolha uma cor válida.'),
    ]),
  suggestedTime: z
    .union([
      z.literal(''),
      z.string().regex(timePattern, 'Informe um horário válido.'),
    ]),
  order: z.coerce
    .number({ message: 'Informe uma ordem válida.' })
    .finite('Informe uma ordem válida.')
    .int('A ordem deve ser um número inteiro.')
    .min(0, 'A ordem não pode ser negativa.'),
  isActive: z.boolean(),
})

export type MealTypeFormValues = z.infer<typeof mealTypeFormSchema>

/** Accepts both the strict domain type and the persisted `src/lib/types` shape. */
export type MealTypeFormInitialValue = {
  name?: string
  icon?: string
  color?: string | null
  suggestedTime?: string | null
  order?: number
  isActive?: boolean
}

export type MealTypeFormProps = {
  initialValue?: MealTypeFormInitialValue
  nextOrder?: number
  isSubmitting?: boolean
  submitLabel?: string
  onSubmit: (values: MealTypeDraft) => void | Promise<void>
  onCancel?: () => void
  className?: string
}

const toFormValues = (draft: MealTypeDraft): MealTypeFormValues => ({
  ...draft,
  color: draft.color ?? '',
  suggestedTime: draft.suggestedTime ?? '',
})

/** Form shared by creation and edition of a user-owned meal type. */
export function MealTypeForm({
  initialValue,
  nextOrder,
  isSubmitting = false,
  submitLabel = 'Salvar refeição',
  onSubmit,
  onCancel,
  className = '',
}: MealTypeFormProps) {
  const initialDraft = useMemo(() => {
    const draft = createMealTypeDraft({
      name: initialValue?.name,
      icon: resolveMealIconKey(initialValue?.icon),
      color: initialValue?.color,
      suggestedTime: initialValue?.suggestedTime,
      order: initialValue?.order,
      isActive: initialValue?.isActive,
    })
    if (initialValue?.order === undefined && nextOrder !== undefined) {
      return { ...draft, order: Math.max(0, Math.floor(nextOrder)) }
    }
    return draft
  }, [
    initialValue?.color,
    initialValue?.icon,
    initialValue?.isActive,
    initialValue?.name,
    initialValue?.order,
    initialValue?.suggestedTime,
    nextOrder,
  ])

  const {
    formState: { errors, isSubmitting: formIsSubmitting },
    handleSubmit,
    register,
    reset,
    setValue,
    watch,
  } = useForm<MealTypeFormValues>({
    resolver: zodResolver(mealTypeFormSchema),
    defaultValues: toFormValues(initialDraft),
  })

  useEffect(() => {
    reset(toFormValues(initialDraft))
  }, [initialDraft, reset])

  const name = watch('name')
  const icon = watch('icon')
  const color = watch('color')
  const PreviewIcon = mealIcons[icon]
  const disabled = isSubmitting || formIsSubmitting
  const previewStyle: CSSProperties & Record<'--meal-color', string> = {
    '--meal-color': color || '#2F7B59',
  }

  const submit = async (values: MealTypeFormValues) => {
    await onSubmit({
      name: values.name.trim(),
      icon: values.icon,
      color: values.color || null,
      suggestedTime: values.suggestedTime || null,
      order: values.order,
      isActive: values.isActive,
    })
  }

  return (
    <form
      className={`meal-type-form ${className}`.trim()}
      noValidate
      onSubmit={handleSubmit(submit)}
    >
      <div className="meal-type-form-preview" style={previewStyle}>
        <span className="meal-type-form-preview-icon">
          <PreviewIcon size={22} aria-hidden="true" />
        </span>
        <div>
          <p>Pré-visualização</p>
          <strong>{name.trim() || 'Nova refeição'}</strong>
        </div>
      </div>

      <label className="form-label">
        Nome da refeição <em>*</em>
        <input
          className="field"
          autoComplete="off"
          disabled={disabled}
          placeholder="Ex.: Pré-treino"
          {...register('name')}
        />
        {errors.name && <small className="field-error">{errors.name.message}</small>}
      </label>

      <input type="hidden" {...register('icon')} />
      <MealIconPicker
        value={icon}
        disabled={disabled}
        onChange={(nextIcon) => setValue('icon', nextIcon, { shouldDirty: true, shouldValidate: true })}
      />
      {errors.icon && <small className="field-error">{errors.icon.message}</small>}

      <div className="meal-type-form-grid">
        <label className="form-label">
          Horário sugerido
          <input
            className="field"
            type="time"
            disabled={disabled}
            {...register('suggestedTime')}
          />
          <small>Opcional; ele não cria lembretes automaticamente.</small>
          {errors.suggestedTime && <small className="field-error">{errors.suggestedTime.message}</small>}
        </label>

        <label className="form-label">
          Ordem de exibição <em>*</em>
          <input
            className="field"
            type="number"
            min="0"
            step="1"
            inputMode="numeric"
            disabled={disabled}
            {...register('order')}
          />
          {errors.order && <small className="field-error">{errors.order.message}</small>}
        </label>
      </div>

      <div className="meal-type-form-options">
        <div className="form-label">
          <span>Cor de destaque</span>
          <div className="meal-type-form-color-control">
            <input type="hidden" {...register('color')} />
            <input
              aria-label="Escolher cor de destaque"
              type="color"
              value={color || '#2F7B59'}
              disabled={disabled}
              onChange={(event) => setValue('color', event.target.value, { shouldDirty: true, shouldValidate: true })}
            />
            <button
              type="button"
              className="btn btn-soft"
              disabled={disabled || !color}
              onClick={() => setValue('color', '', { shouldDirty: true, shouldValidate: true })}
            >
              Usar cor padrão
            </button>
          </div>
          {errors.color && <small className="field-error">{errors.color.message}</small>}
        </div>

        <label className="meal-type-form-checkbox">
          <input type="checkbox" disabled={disabled} {...register('isActive')} />
          <span>
            <strong>Refeição ativa</strong>
            <small>Ela aparecerá ao registrar alimentos no diário.</small>
          </span>
        </label>
      </div>

      <div className="meal-type-form-actions">
        {onCancel && (
          <button type="button" className="btn btn-soft" disabled={disabled} onClick={onCancel}>
            <X size={16} aria-hidden="true" />
            Cancelar
          </button>
        )}
        <button type="submit" className="btn btn-primary" disabled={disabled}>
          <Save size={16} aria-hidden="true" />
          {disabled ? 'Salvando…' : submitLabel}
        </button>
      </div>
    </form>
  )
}
