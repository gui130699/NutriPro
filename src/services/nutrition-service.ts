import type { Food, Goal, MealItem, Unit } from '../lib/types'
import { calculateNutrients } from '../lib/nutrition'
import { requireSupabase } from '../lib/supabase'

export const nutritionService = {
  async foods(search = '') { const q = requireSupabase().from('foods').select('*').eq('is_active', true).order('name').limit(40); if (search) q.ilike('name', `%${search}%`); const { data, error } = await q; if (error) throw error; return data as Food[] },
  async goals(userId: string) { const { data, error } = await requireSupabase().from('user_goals').select('*').eq('user_id', userId).maybeSingle(); if (error) throw error; return data as Goal | null },
  async dayItems(userId: string, date: string) { const { data, error } = await requireSupabase().from('meal_items').select('*, daily_meals!inner(user_id, meal_date, meal_types(name,position))').eq('daily_meals.user_id', userId).eq('daily_meals.meal_date', date); if (error) throw error; return data as MealItem[] },
  async addWater(userId: string, amountMl: number) { const { error } = await requireSupabase().from('water_logs').insert({ user_id: userId, amount_ml: amountMl, logged_at: new Date().toISOString() }); if (error) throw error },
  async water(userId: string, date: string) { const { data, error } = await requireSupabase().from('water_logs').select('*').eq('user_id', userId).gte('logged_at', `${date}T00:00:00`).lt('logged_at', `${date}T23:59:59`).order('logged_at'); if (error) throw error; return data ?? [] },
  async createFood(userId: string, food: Omit<Food, 'id'>) { const { error } = await requireSupabase().from('foods').insert({ ...food, user_id: userId, is_active: true, is_public: false }); if (error) throw error },
  async addMealItem(userId: string, date: string, mealName: string, food: Food, quantity: number, unit: Unit) { const db = requireSupabase(); const { data: meal, error: mealError } = await db.from('daily_meals').insert({ user_id: userId, meal_date: date, name_snapshot: mealName }).select('id').single(); if (mealError) throw mealError; const n = calculateNutrients(food, quantity, unit); const { error } = await db.from('meal_items').insert({ meal_id: meal.id, user_id: userId, food_id: food.id, food_name_snapshot: food.name, calories: n.calories, protein: n.protein, carbs: n.carbs, fat: n.fat, fiber: n.fiber, saturated_fat: n.saturated_fat, sugar: n.sugar, sodium: n.sodium, unit_weight_g_snapshot: food.unit_weight_g, quantity, unit, consumed_grams: n.grams }); if (error) throw error },
}
