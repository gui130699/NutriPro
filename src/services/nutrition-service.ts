import { addDoc, collection, getDocs, limit, orderBy, query, serverTimestamp, where } from 'firebase/firestore'
import type { Food, Goal, MealItem, Unit } from '../lib/types'
import { calculateNutrients } from '../lib/nutrition'
import { db } from '../lib/firebase'

const firestore = () => { if (!db) throw new Error('Configure as variáveis do Firebase no arquivo .env.'); return db }
const map = <T>(snapshot: Awaited<ReturnType<typeof getDocs>>) => snapshot.docs.map(doc => ({ id: doc.id, ...(doc.data() as Record<string, unknown>) }) as T)
export const nutritionService = {
  async foods(search = '') { const snap = await getDocs(query(collection(firestore(),'foods'), orderBy('name'), limit(40))); return map<Food>(snap).filter(food => !search || food.name.toLocaleLowerCase().includes(search.toLocaleLowerCase())) },
  async goals(userId: string) { const snap = await getDocs(query(collection(firestore(),'goals'),where('userId','==',userId),limit(1))); return map<Goal>(snap)[0] ?? null },
  async dayItems(userId: string, date: string) { const snap = await getDocs(query(collection(firestore(),'mealItems'),where('userId','==',userId),where('date','==',date))); return map<MealItem>(snap) },
  async addWater(userId: string, amountMl: number) { const now = new Date(); await addDoc(collection(firestore(),'waterLogs'), { userId, date: now.toISOString().slice(0,10), amount_ml: amountMl, logged_at: now.toISOString(), created_at: serverTimestamp() }) },
  async water(userId: string, date: string) { const snap = await getDocs(query(collection(firestore(),'waterLogs'),where('userId','==',userId),where('date','==',date))); return map<{id:string;amount_ml:number;logged_at:string}>(snap) },
  async createFood(userId: string, food: Omit<Food, 'id'>) { await addDoc(collection(firestore(),'foods'), { ...food, userId, is_active: true, is_public: false, created_at: serverTimestamp(), updated_at: serverTimestamp() }) },
  async addMealItem(userId: string, date: string, mealName: string, food: Food, quantity: number, unit: Unit) { const n = calculateNutrients(food,quantity,unit); await addDoc(collection(firestore(),'mealItems'), { userId, date, mealName, food_id: food.id, food_name_snapshot: food.name, calories:n.calories, protein:n.protein, carbs:n.carbs, fat:n.fat, fiber:n.fiber, saturated_fat:n.saturated_fat ?? 0, sugar:n.sugar ?? 0, sodium:n.sodium ?? 0, unit_weight_g_snapshot:food.unit_weight_g ?? null, quantity, unit, consumed_grams:n.grams, created_at:serverTimestamp() }) },
}
