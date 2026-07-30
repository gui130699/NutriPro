import { zodResolver } from '@hookform/resolvers/zod'
import { Save } from 'lucide-react'
import { useEffect } from 'react'
import { useForm, type Resolver } from 'react-hook-form'
import { z } from 'zod'
import type { Food } from '../../lib/types'

const optionalNumber = z.preprocess((value) => value === '' || value === null || value === undefined ? undefined : Number(value), z.number().min(0, 'Informe um valor igual ou maior que zero.').optional())

// oxlint-disable-next-line react/only-export-components -- the schema is intentionally shared by form consumers and tests.
export const foodFormSchema = z.object({
  name: z.string().trim().min(2, 'Informe o nome do alimento.'),
  brand: z.string().trim().max(120).optional(),
  category: z.string().trim().max(100).optional(),
  calories: z.coerce.number().min(0, 'As calorias não podem ser negativas.'),
  protein: z.coerce.number().min(0, 'As proteínas não podem ser negativas.'),
  carbs: z.coerce.number().min(0, 'Os carboidratos não podem ser negativos.'),
  fat: z.coerce.number().min(0, 'As gorduras não podem ser negativas.'),
  fiber: z.coerce.number().min(0, 'As fibras não podem ser negativas.'),
  saturatedFat: optionalNumber,
  sugar: optionalNumber,
  sodium: optionalNumber,
  baseUnit: z.enum(['g', 'ml']),
  unitWeightG: optionalNumber.refine((value) => value === undefined || value > 0, 'O peso médio deve ser maior que zero.'),
  portionWeightG: optionalNumber.refine((value) => value === undefined || value > 0, 'O peso da porção deve ser maior que zero.'),
  source: z.string().trim().max(150).optional(),
  notes: z.string().trim().max(1000).optional(),
  isFavorite: z.boolean().default(false),
  isActive: z.boolean().default(true),
})

export type FoodFormValues = z.infer<typeof foodFormSchema>

type FoodFormProps = {
  initialFood?: Partial<Food>
  submitLabel?: string
  isSubmitting?: boolean
  onSubmit: (values: FoodFormValues) => Promise<void> | void
  onCancel?: () => void
}

const defaultValues: FoodFormValues = {
  name: '', brand: '', category: '', calories: 0, protein: 0, carbs: 0, fat: 0, fiber: 0,
  saturatedFat: undefined, sugar: undefined, sodium: undefined, baseUnit: 'g', unitWeightG: undefined,
  portionWeightG: undefined, source: '', notes: '', isFavorite: false, isActive: true,
}

export function FoodForm({ initialFood, submitLabel = 'Salvar alimento', isSubmitting = false, onSubmit, onCancel }: FoodFormProps) {
  const { register, handleSubmit, reset, formState: { errors } } = useForm<FoodFormValues>({
    resolver: zodResolver(foodFormSchema) as unknown as Resolver<FoodFormValues>,
    defaultValues,
  })

  useEffect(() => {
    reset({
      ...defaultValues,
      ...initialFood,
      brand: initialFood?.brand ?? '',
      category: initialFood?.category ?? '',
      source: initialFood?.source ?? '',
      notes: initialFood?.notes ?? '',
      unitWeightG: initialFood?.unitWeightG ?? undefined,
      portionWeightG: initialFood?.portionWeightG ?? undefined,
      isFavorite: initialFood?.isFavorite ?? false,
      isActive: initialFood?.isActive ?? true,
    })
  }, [initialFood, reset])

  return <form className="food-editor-form" onSubmit={handleSubmit((values) => void onSubmit(values))} noValidate>
    <div className="food-editor-grid">
      <label className="form-label form-label-wide">Nome do alimento <em>*</em><input className="field" placeholder="Ex.: Iogurte natural" {...register('name')}/><FieldError message={errors.name?.message}/></label>
      <label className="form-label">Marca<input className="field" placeholder="Opcional" {...register('brand')}/></label>
      <label className="form-label">Categoria<input className="field" placeholder="Ex.: Laticínios" {...register('category')}/></label>
      <label className="form-label">Unidade-base <select className="field" {...register('baseUnit')}><option value="g">100 gramas</option><option value="ml">100 mililitros</option></select></label>
      <label className="form-label">Fonte da informação<input className="field" placeholder="Rótulo, TACO, TBCA…" {...register('source')}/></label>
    </div>
    <fieldset className="food-editor-fieldset"><legend>Nutrientes por 100 g ou 100 ml</legend><div className="food-editor-grid nutrient-editor-grid">{([
      ['calories', 'Calorias', 'kcal'], ['protein', 'Proteínas', 'g'], ['carbs', 'Carboidratos', 'g'], ['fat', 'Gorduras', 'g'], ['fiber', 'Fibras', 'g'], ['saturatedFat', 'Gorduras saturadas', 'g'], ['sugar', 'Açúcares', 'g'], ['sodium', 'Sódio', 'mg'],
    ] as const).map(([field, label, unit]) => <label className="form-label" key={field}>{label}<span className="number-with-unit"><input className="field" type="number" min="0" step="0.01" {...register(field)}/><small>{unit}</small></span><FieldError message={errors[field]?.message}/></label>)}</div></fieldset>
    <fieldset className="food-editor-fieldset"><legend>Porções e medidas</legend><div className="food-editor-grid"><label className="form-label">Peso médio de uma unidade<input className="field" type="number" min="0.01" step="0.01" placeholder="Ex.: 80" {...register('unitWeightG')}/><small>Obrigatório ao registrar por unidade.</small><FieldError message={errors.unitWeightG?.message}/></label><label className="form-label">Peso ou volume da porção<input className="field" type="number" min="0.01" step="0.01" placeholder="Ex.: 30" {...register('portionWeightG')}/><small>Obrigatório ao registrar por porção.</small><FieldError message={errors.portionWeightG?.message}/></label><label className="form-label form-label-wide">Observações<textarea className="field food-notes" placeholder="Informações adicionais, preparo ou rótulo." {...register('notes')}/></label></div></fieldset>
    <div className="food-editor-toggles"><label><input type="checkbox" {...register('isFavorite')}/> Favoritar este alimento</label><label><input type="checkbox" {...register('isActive')}/> Alimento ativo</label></div>
    <footer className="food-editor-footer">{onCancel && <button type="button" className="btn btn-soft" onClick={onCancel}>Cancelar</button>}<button type="submit" className="btn btn-primary" disabled={isSubmitting}><Save size={16}/>{isSubmitting ? 'Salvando…' : submitLabel}</button></footer>
  </form>
}

function FieldError({ message }: { message?: string }) {
  return message ? <small className="field-error">{message}</small> : null
}
