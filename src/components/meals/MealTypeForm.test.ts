import { describe, expect, it } from 'vitest'
import { mealTypeFormSchema } from './MealTypeForm'

describe('validação do formulário de refeições', () => {
  const validForm = {
    name: 'Pré-treino',
    icon: 'workout',
    color: '#2F7B59',
    suggestedTime: '17:30',
    order: 6,
    isActive: true,
  }

  it('aceita uma refeição válida', () => {
    expect(mealTypeFormSchema.safeParse(validForm)).toMatchObject({ success: true })
  })

  it('rejeita nome vazio, ordem negativa e chaves de ícone inválidas', () => {
    const result = mealTypeFormSchema.safeParse({
      ...validForm,
      name: '   ',
      icon: 'Coffee',
      order: -1,
    })

    expect(result.success).toBe(false)
    if (!result.success) {
      expect(result.error.flatten().fieldErrors).toMatchObject({
        name: expect.any(Array),
        icon: expect.any(Array),
        order: expect.any(Array),
      })
    }
  })
})
