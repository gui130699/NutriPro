export type Unit = 'g' | 'kg' | 'ml' | 'l' | 'unidade' | 'porção'
export type Nutrients = { calories: number; protein: number; carbs: number; fat: number; fiber: number; saturated_fat?: number; sugar?: number; sodium?: number }
export type Food = Nutrients & { id: string; name: string; brand?: string | null; category?: string | null; base_unit: 'g' | 'ml'; unit_weight_g?: number | null; portion_weight_g?: number | null; is_public?: boolean }
export type MealItem = Nutrients & { id: string; meal_id: string; food_id?: string; food_name_snapshot: string; quantity: number; unit: Unit; consumed_grams: number; created_at: string }
export type Goal = { calories: number; protein: number; carbs: number; fat: number; fiber: number; water_ml: number }
