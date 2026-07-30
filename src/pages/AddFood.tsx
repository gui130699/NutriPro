import { useMutation, useQueryClient } from '@tanstack/react-query'
import { Apple, Sparkles } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { FoodForm, type FoodFormValues } from '../components/foods/FoodForm'
import { useAuth } from '../hooks/useAuth'
import { nutritionService } from '../services/nutrition-service'

export function AddFood() {
  const { user } = useAuth()
  const queryClient = useQueryClient()
  const navigate = useNavigate()
  const save = useMutation({
    mutationFn: (values: FoodFormValues) => nutritionService.createFood(user!.uid, values),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['private-foods', user?.uid] })
      void queryClient.invalidateQueries({ queryKey: ['foods'] })
    },
  })

  return <section className="food-page">
    <header className="food-header"><div><p className="eyebrow">Minha lista</p><h1 className="page-title">Cadastre um <span>alimento particular.</span></h1><p className="page-subtitle">Ele ficará disponível somente na sua conta e poderá ser usado no diário alimentar.</p></div><div className="food-header-aside"><span><Sparkles size={16}/></span><p>Os valores nutricionais são informados por 100 g ou 100 ml.</p></div></header>
    <section className="food-form-main card"><div className="form-section-heading"><span className="icon-badge"><Apple size={17}/></span><div><p>Novo alimento</p><h2>Informações nutricionais</h2></div></div>{save.isSuccess && <p className="save-status save-success">Alimento salvo com sucesso. Você já pode encontrá-lo em Minha lista.</p>}{save.error && <p className="save-status save-error">Não foi possível salvar o alimento. Tente novamente.</p>}<FoodForm isSubmitting={save.isPending} onCancel={() => navigate('/listas')} onSubmit={async (values) => { await save.mutateAsync(values) }}/></section>
  </section>
}
