import {
  Apple,
  Banana,
  Beef,
  CakeSlice,
  Cherry,
  Clock,
  Coffee,
  CookingPot,
  Cookie,
  Croissant,
  CupSoda,
  Dumbbell,
  Drumstick,
  Egg,
  Fish,
  GlassWater,
  Heart,
  IceCreamBowl,
  Milk,
  Moon,
  Pizza,
  Plus,
  Salad,
  Sandwich,
  Soup,
  Sparkles,
  Star,
  Sun,
  Sunrise,
  Sunset,
  Utensils,
  UtensilsCrossed,
  Wheat,
  type LucideIcon,
} from 'lucide-react'

/**
 * Chaves persistidas no Firestore para os ícones de tipos de refeição.
 *
 * Componentes React nunca devem ser persistidos: apenas uma destas chaves é
 * armazenada e resolvida no cliente por `mealIcons`.
 */
export const mealIconKeys = [
  'coffee',
  'soda',
  'water',
  'milk',
  'apple',
  'banana',
  'cherry',
  'salad',
  'soup',
  'sandwich',
  'pizza',
  'beef',
  'chicken',
  'fish',
  'egg',
  'wheat',
  'croissant',
  'cake',
  'cookie',
  'iceCream',
  'utensils',
  'dinner',
  'pot',
  'moon',
  'sun',
  'sunrise',
  'sunset',
  'sparkles',
  'workout',
  'heart',
  'star',
  'clock',
  'plus',
] as const

export type MealIconKey = (typeof mealIconKeys)[number]

/** Catálogo único de componentes Lucide disponíveis para refeições. */
export const mealIcons = {
  coffee: Coffee,
  soda: CupSoda,
  water: GlassWater,
  milk: Milk,
  apple: Apple,
  banana: Banana,
  cherry: Cherry,
  salad: Salad,
  soup: Soup,
  sandwich: Sandwich,
  pizza: Pizza,
  beef: Beef,
  chicken: Drumstick,
  fish: Fish,
  egg: Egg,
  wheat: Wheat,
  croissant: Croissant,
  cake: CakeSlice,
  cookie: Cookie,
  iceCream: IceCreamBowl,
  utensils: Utensils,
  dinner: UtensilsCrossed,
  pot: CookingPot,
  moon: Moon,
  sun: Sun,
  sunrise: Sunrise,
  sunset: Sunset,
  sparkles: Sparkles,
  workout: Dumbbell,
  heart: Heart,
  star: Star,
  clock: Clock,
  plus: Plus,
} as const satisfies Record<MealIconKey, LucideIcon>

export const defaultMealIconKey: MealIconKey = 'utensils'

export type MealIconOption = {
  key: MealIconKey
  label: string
  searchTerms: readonly string[]
  Icon: LucideIcon
}

type MealIconDetails = Omit<MealIconOption, 'Icon' | 'key'>

const mealIconDetails: Readonly<Record<MealIconKey, MealIconDetails>> = {
  coffee: { label: 'Café', searchTerms: ['café da manhã', 'bebida quente', 'coffee'] },
  soda: { label: 'Refrigerante', searchTerms: ['soda', 'bebida', 'lata'] },
  water: { label: 'Água', searchTerms: ['água', 'hidratação', 'copo'] },
  milk: { label: 'Leite', searchTerms: ['laticínio', 'bebida', 'milk'] },
  apple: { label: 'Maçã', searchTerms: ['fruta', 'apple'] },
  banana: { label: 'Banana', searchTerms: ['fruta'] },
  cherry: { label: 'Cerejas', searchTerms: ['fruta', 'cherry'] },
  salad: { label: 'Salada', searchTerms: ['verduras', 'legumes', 'folhas'] },
  soup: { label: 'Sopa', searchTerms: ['caldo', 'soup'] },
  sandwich: { label: 'Sanduíche', searchTerms: ['lanche', 'pão', 'sanduiche'] },
  pizza: { label: 'Pizza', searchTerms: ['massa'] },
  beef: { label: 'Carne', searchTerms: ['bife', 'proteína', 'beef'] },
  chicken: { label: 'Frango', searchTerms: ['ave', 'proteína', 'chicken'] },
  fish: { label: 'Peixe', searchTerms: ['frutos do mar', 'proteína', 'fish'] },
  egg: { label: 'Ovo', searchTerms: ['proteína', 'egg'] },
  wheat: { label: 'Trigo', searchTerms: ['cereal', 'grãos', 'graos', 'wheat'] },
  croissant: { label: 'Croissant', searchTerms: ['pão', 'pao', 'café da manhã'] },
  cake: { label: 'Bolo', searchTerms: ['doce', 'sobremesa', 'cake'] },
  cookie: { label: 'Biscoito', searchTerms: ['cookie', 'doce', 'lanche'] },
  iceCream: { label: 'Sorvete', searchTerms: ['sobremesa', 'ice cream', 'gelado'] },
  utensils: { label: 'Talheres', searchTerms: ['refeição', 'refeicao', 'comida'] },
  dinner: { label: 'Jantar', searchTerms: ['talheres', 'refeição', 'refeicao'] },
  pot: { label: 'Panela', searchTerms: ['cozinhar', 'cozinha', 'pot'] },
  moon: { label: 'Lua', searchTerms: ['noite', 'ceia', 'moon'] },
  sun: { label: 'Sol', searchTerms: ['dia', 'almoço', 'almoco', 'sun'] },
  sunrise: { label: 'Nascer do sol', searchTerms: ['manhã', 'manha', 'café da manhã'] },
  sunset: { label: 'Pôr do sol', searchTerms: ['tarde', 'noite', 'sunset'] },
  sparkles: { label: 'Brilhos', searchTerms: ['lanche', 'especial', 'sparkles'] },
  workout: { label: 'Treino', searchTerms: ['exercício', 'exercicio', 'academia', 'dumbbell'] },
  heart: { label: 'Coração', searchTerms: ['favorito', 'bem-estar', 'coracao'] },
  star: { label: 'Estrela', searchTerms: ['favorito', 'destaque', 'star'] },
  clock: { label: 'Relógio', searchTerms: ['horário', 'horario', 'tempo', 'clock'] },
  plus: { label: 'Adicionar', searchTerms: ['novo', 'mais', 'plus'] },
}

export const mealIconOptions: readonly MealIconOption[] = mealIconKeys.map((key) => ({
  key,
  ...mealIconDetails[key],
  Icon: mealIcons[key],
}))

export const isMealIconKey = (value: unknown): value is MealIconKey =>
  typeof value === 'string' && mealIconKeys.some((key) => key === value)

export const normalizeMealIconSearch = (value: string) =>
  value
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .toLocaleLowerCase('pt-BR')
    .trim()
    .replace(/\s+/g, ' ')

/** Pesquisa por nome, chave e sinônimos sem diferenciar maiúsculas ou acentos. */
export const filterMealIconOptions = (query: string): MealIconOption[] => {
  const normalizedQuery = normalizeMealIconSearch(query)
  if (!normalizedQuery) return [...mealIconOptions]

  return mealIconOptions.filter((option) =>
    [option.key, option.label, ...option.searchTerms]
      .map(normalizeMealIconSearch)
      .some((term) => term.includes(normalizedQuery)),
  )
}
