import { initializeApp, getApps, getApp, type FirebaseApp } from 'firebase/app'
import {
  getFirestore,
  doc,
  getDoc,
  setDoc,
  collection,
  getDocs,
  query,
  orderBy,
  limit,
  getDocFromServer,
  type Firestore,
} from 'firebase/firestore'
import {
  getAuth,
  signInWithPopup,
  GoogleAuthProvider,
  signOut,
  onAuthStateChanged,
  type Auth,
} from 'firebase/auth'
import firebaseConfig from '../../firebase-applet-config.json'

export interface UserProfile {
  uid: string
  displayName: string
  email?: string
  provider: 'google' | 'playgames' | 'guest'
  isGuest: boolean
  level: number
  xp: number
  totalXp: number
  cash: number
  highScore: number
  totalPlayTime: number
  dailyDate: string
  dailyXp: number
  dailyCash: number
  // Garage & Customization
  unlockedVehicles: string[]
  selectedVehicle: string
  engineUpgradeLevel: number
  armorUpgradeLevel: number
  unlockedPaints: string[]
  selectedPaint: string
  unlockedDecals: string[]
  selectedDecal: string
  unlockedParts: string[]
  equippedParts: string[]
  // Missions & Trophies
  completedMissions: string[]
  trophies: string[]
  updatedAt: number
  pendingSync?: boolean
}

export interface DailyLeaderboardEntry {
  userId: string
  displayName: string
  provider: 'google' | 'playgames' | 'guest'
  level: number
  dailyXp: number
  dailyCash: number
  isCurrentPlayer?: boolean
}

export interface ShopVehicleItem {
  id: string
  name: string
  kind: string
  price: number
  description: string
  icon: string
  stats: {
    speed: number // 1-10
    armor: number // 1-10
    special: string
  }
}

export interface ShopUpgradeItem {
  level: number
  price: number
  name: string
  bonusText: string
}

export interface ShopPaintItem {
  id: string
  name: string
  colorHex: string
  price: number
  description: string
}

export interface ShopDecalItem {
  id: string
  name: string
  icon: string
  price: number
  description: string
}

export interface ShopPartItem {
  id: string
  name: string
  icon: string
  price: number
  description: string
  effect: string
}

export const SHOP_CATALOG = {
  vehicles: [
    {
      id: 'sedan',
      name: 'Sedan Turbo GT',
      kind: 'sedan',
      price: 0,
      description: 'Veículo esportivo urbano balanceado, ágil e versátil para missões rápidas.',
      icon: '🚗',
      stats: { speed: 6, armor: 4, special: 'Equilíbrio Total' },
    },
    {
      id: 'suv',
      name: 'SUV Blindado V8',
      kind: 'suv',
      price: 12000,
      description: 'Chassi robusto com estepe traseiro e rack de teto. Ótimo para colisões.',
      icon: '🚙',
      stats: { speed: 5, armor: 6, special: 'Impacto Médio' },
    },
    {
      id: 'pickup',
      name: 'Pickup Heavy Duty',
      kind: 'pickup',
      price: 18000,
      description: 'Picape potente com santantônio de aço e faróis de milha no teto.',
      icon: '🛻',
      stats: { speed: 6, armor: 6, special: 'Estabilidade' },
    },
    {
      id: 'taxi',
      name: 'Super Táxi Crazy',
      kind: 'taxi',
      price: 22000,
      description: 'Táxi veloz para faturar alto em corridas de passageiros com gorjetas insanas.',
      icon: '🚕',
      stats: { speed: 7, armor: 5, special: 'Bônus de Passageiros' },
    },
    {
      id: 'truck',
      name: 'Caminhão de Carga Pesada',
      kind: 'truck',
      price: 30000,
      description: 'Caminhão de 6 rodas com carroceria reforçada e escapamentos cromados.',
      icon: '🚛',
      stats: { speed: 4, armor: 8, special: 'Aríete Pesado' },
    },
    {
      id: 'fuel_tanker',
      name: 'Caminhão Tanque Inflamável',
      kind: 'fuel_tanker',
      price: 45000,
      description: 'Tanque cilíndrico de alta capacidade com missões exclusivas de entrega rápida.',
      icon: '⛽',
      stats: { speed: 4, armor: 7, special: 'Cargas Inflamáveis' },
    },
    {
      id: 'car_hauler',
      name: 'Caminhão Cegonha com Rampa',
      kind: 'car_hauler',
      price: 60000,
      description: 'Super rampa traseira para saltos acrobáticos e recolhimento de veículos.',
      icon: '🚜',
      stats: { speed: 5, armor: 8, special: 'Rampa de Salto Acrobático' },
    },
    {
      id: 'bomb_car',
      name: 'Super Esportivo Nitro',
      kind: 'bomb_car',
      price: 80000,
      description: 'Bólide aerodinâmico esportivo de alta velocidade com aerofólio e suspensão rebaixada.',
      icon: '🏎️',
      stats: { speed: 9, armor: 6, special: 'Alta Velocidade & Drift' },
    },
    {
      id: 'monster_truck',
      name: 'Monster Truck Titânico',
      kind: 'monster_truck',
      price: 120000,
      description: 'Rodas gigantescas de 66 polegadas. Esmaga viaturas e aguenta até 100 colisões!',
      icon: '🛞',
      stats: { speed: 7, armor: 10, special: 'Esmagamento e 100 Hits' },
    },
    {
      id: 'hyper_f1',
      name: 'Hyper Bólide Fórmula 1',
      kind: 'hyper_f1',
      price: 150000,
      description: 'Monoposto de corrida Le Mans/F1 com aerofólio duplo, downforce e velocidade absurda.',
      icon: '⚡',
      stats: { speed: 10, armor: 5, special: 'Velocidade Suprema' },
    },
    {
      id: 'tactical_tanker',
      name: 'Blindado Tático SWAT Enforcer',
      kind: 'tactical_tanker',
      price: 200000,
      description: 'Fortaleza sobre rodas com aríete anti-bloqueio e blindagem militar indestrutível.',
      icon: '🛡️',
      stats: { speed: 7, armor: 10, special: 'Impacto Devastador' },
    },
  ] as ShopVehicleItem[],

  engineUpgrades: [
    { level: 1, price: 3000, name: 'Estágio 1 - Filtro & ECU Sport', bonusText: '+10% Aceleração e Velocidade' },
    { level: 2, price: 7500, name: 'Estágio 2 - Comando de Válvulas V8', bonusText: '+20% Aceleração e Velocidade' },
    { level: 3, price: 15000, name: 'Estágio 3 - Turbocompressor Duplo', bonusText: '+35% Aceleração e Velocidade' },
    { level: 4, price: 28000, name: 'Estágio 4 - Injeção Direta Nitro Pro', bonusText: '+50% Aceleração e Velocidade' },
    { level: 5, price: 50000, name: 'Estágio 5 - Motor Hyper V12 Twin Turbo', bonusText: '+75% Aceleração e Velocidade Máxima' },
  ] as ShopUpgradeItem[],

  armorUpgrades: [
    { level: 1, price: 2500, name: 'Reforço 1 - Para-choque Tubular', bonusText: '+25% Resistência a Colisões' },
    { level: 2, price: 6000, name: 'Reforço 2 - Chapa Protetora de Cárter', bonusText: '+50% Resistência a Colisões' },
    { level: 3, price: 12000, name: 'Reforço 3 - Blindagem de Aço Duplo', bonusText: '+100% Resistência a Colisões e Balas' },
    { level: 4, price: 24000, name: 'Reforço 4 - Gaiola de Proteção Militar', bonusText: '+150% Resistência a Colisões e Balas' },
    { level: 5, price: 45000, name: 'Reforço 5 - Chassi Titânio Indestrutível', bonusText: '+250% Resistência Suprema' },
  ] as ShopUpgradeItem[],

  paints: [
    { id: 'default', name: 'Azul Elétrico GT', colorHex: '#2789d5', price: 0, description: 'Pintura padrão metálica esportiva' },
    { id: 'gold', name: 'Ouro Cromado VIP 24K', colorHex: '#facc15', price: 10000, description: 'Acabamento reluzente dourado com reflexo espelhado' },
    { id: 'stealth', name: 'Preto Fosco Stealth', colorHex: '#18181b', price: 8000, description: 'Pintura militar antirreflexo estilo caça furtivo' },
    { id: 'cyberpunk', name: 'Roxo Neon Cyberpunk', colorHex: '#c026d3', price: 12000, description: 'Pigmento fluorescente estilo Night City com brilho neon' },
    { id: 'fury_red', name: 'Vermelho Fúria Rubro', colorHex: '#dc2626', price: 6500, description: 'Tonalidade vívida de competição automotiva' },
    { id: 'emerald', name: 'Verde Esmeralda Tóxico', colorHex: '#10b981', price: 7000, description: 'Verde metálico intenso perolizado' },
    { id: 'pearl', name: 'Branco Pérola Iridiscente', colorHex: '#f8fafc', price: 9000, description: 'Brilho cristalino premium de alto luxo' },
    { id: 'camo', name: 'Camuflagem Tática Exército', colorHex: '#4d5b44', price: 14000, description: 'Pintura militar de forças especiais' },
  ] as ShopPaintItem[],

  decals: [
    { id: 'none', name: 'Sem Adesivo (Limpo)', icon: '🚫', price: 0, description: 'Carroceria lisa original sem decalques' },
    { id: 'racing_stripes', name: 'Faixas Duplas GT de Corrida', icon: '🏁', price: 4000, description: 'Duas faixas centrais brancas de competição no capô e teto' },
    { id: 'flames', name: 'Chamas Laterais Hot-Rod', icon: '🔥', price: 6500, description: 'Línguas de fogo estilizadas nas laterais das portas' },
    { id: 'skull', name: 'Caveira Tática de Caça', icon: '💀', price: 8000, description: 'Emblema agressivo militar gravado no capô dianteiro' },
    { id: 'smash_v8', name: 'Logotipo Smash V8 Pro', icon: '⭐', price: 5000, description: 'Selo oficial de piloto profissional da liga Smash' },
    { id: 'lightning', name: 'Relâmpagos Turbo Neon', icon: '⚡', price: 7500, description: 'Descargas elétricas estilizadas ao longo do chassi' },
    { id: 'dragon', name: 'Dragão Cibernético Imperial', icon: '🐉', price: 11000, description: 'Grafismo lendário dourado e vermelho oriental' },
  ] as ShopDecalItem[],

  parts: [
    {
      id: 'nitro_booster',
      name: 'Super Nitro Booster Duplo',
      icon: '🚀',
      price: 18000,
      description: 'Instala bicos injetores de óxido nitroso. Acelera 2x mais rápido com labaredas azuis!',
      effect: 'Boost duplo de velocidade e recarga rápida',
    },
    {
      id: 'steel_ram',
      name: 'Aríete Frontal de Aço Reforçado',
      icon: '🪓',
      price: 25000,
      description: 'Grade de aço maciço montada no para-choque. Arremessa veículos sem perder embalo!',
      effect: 'Dano de aríete 3x maior e sem frenagem ao bater',
    },
    {
      id: 'hydraulic_jump',
      name: 'Suspensão Hidráulica com Salto',
      icon: '🦘',
      price: 20000,
      description: 'Pistões pneumáticos nos eixos. Pule sobre bloqueios policiais e carros pressionando Espaço ou o botão de Salto!',
      effect: 'Salto vertical sob comando do jogador',
    },
    {
      id: 'underglow',
      name: 'Neon Sub-Carroceria Glow',
      icon: '✨',
      price: 9500,
      description: 'Fitas LED de alta potência sob o chassi iluminando o asfalto à noite.',
      effect: 'Iluminação neon futurista pulsante no chão',
    },
    {
      id: 'forged_wheels',
      name: 'Rodas Forjadas de Liga Leve GT',
      icon: '🛞',
      price: 12000,
      description: 'Aros esportivos dourados ultraleves que melhoram o controle em curvas e drifts.',
      effect: 'Controle superior em derrapagens e curvas fechadas',
    },
  ] as ShopPartItem[],
}

const LOCAL_STORAGE_KEY = 'smash_user_profile_db'
const GUEST_STORAGE_KEY = 'smash_guest_temp_session'

export function getTodayDateString(): string {
  const now = new Date()
  const year = now.getFullYear()
  const month = String(now.getMonth() + 1).padStart(2, '0')
  const day = String(now.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

export function getXpRequiredForLevel(level: number): number {
  return Math.floor(150 * Math.pow(1.22, Math.max(0, level - 1)))
}

function createDefaultGuestProfile(): UserProfile {
  return {
    uid: 'guest_' + Math.random().toString(36).substring(2, 9),
    displayName: 'Jogador Anônimo',
    provider: 'guest',
    isGuest: true,
    level: 1,
    xp: 0,
    totalXp: 0,
    cash: 0,
    highScore: 0,
    totalPlayTime: 0,
    dailyDate: getTodayDateString(),
    dailyXp: 0,
    dailyCash: 0,
    unlockedVehicles: ['sedan'],
    selectedVehicle: 'sedan',
    engineUpgradeLevel: 0,
    armorUpgradeLevel: 0,
    unlockedPaints: ['default'],
    selectedPaint: 'default',
    unlockedDecals: ['none'],
    selectedDecal: 'none',
    unlockedParts: [],
    equippedParts: [],
    completedMissions: [],
    trophies: [],
    updatedAt: Date.now(),
    pendingSync: false,
  }
}

class UserDatabaseManager {
  private app: FirebaseApp | null = null
  private db: Firestore | null = null
  private auth: Auth | null = null
  private currentUser: UserProfile
  private listeners: ((user: UserProfile) => void)[] = []
  private isOnline = typeof navigator !== 'undefined' ? navigator.onLine : true
  private syncInProgress = false

  constructor() {
    this.currentUser = this.loadLocalProfile()
    this.initFirebase()
    this.setupNetworkListeners()
  }

  private initFirebase(): void {
    try {
      this.app = getApps().length > 0 ? getApp() : initializeApp(firebaseConfig)
      this.db = firebaseConfig.firestoreDatabaseId
        ? getFirestore(this.app, firebaseConfig.firestoreDatabaseId)
        : getFirestore(this.app)
      this.auth = getAuth(this.app)

      this.testFirestoreConnection()

      onAuthStateChanged(this.auth, async (user) => {
        if (user) {
          const providerId = user.providerData?.[0]?.providerId === 'google.com' ? 'google' : 'google'
          await this.handleUserAuthenticated(user.uid, user.displayName || 'Piloto Google', user.email || undefined, providerId)
        }
      })
    } catch (err) {
      console.warn('[UsersDB] Firebase initialization fallback to offline mode:', err)
    }
  }

  private async testFirestoreConnection(): Promise<void> {
    if (!this.db) return
    try {
      await getDocFromServer(doc(this.db, 'test', 'connection'))
    } catch {
      // Offline fallback
    }
  }

  private setupNetworkListeners(): void {
    if (typeof window === 'undefined') return
    window.addEventListener('online', () => {
      this.isOnline = true
      this.syncPendingChanges()
    })
    window.addEventListener('offline', () => {
      this.isOnline = false
    })

    setInterval(() => {
      if (this.isOnline && !this.currentUser.isGuest && this.currentUser.pendingSync) {
        this.syncPendingChanges()
      }
    }, 45000)
  }

  private sanitizeProfile(profile: Partial<UserProfile>): UserProfile {
    return {
      uid: profile.uid || 'guest_' + Math.random().toString(36).substring(2, 9),
      displayName: profile.displayName || 'Piloto',
      email: profile.email,
      provider: profile.provider || 'guest',
      isGuest: profile.isGuest ?? true,
      level: profile.level ?? 1,
      xp: profile.xp ?? 0,
      totalXp: profile.totalXp ?? 0,
      cash: profile.cash ?? 0,
      highScore: profile.highScore ?? 0,
      totalPlayTime: profile.totalPlayTime ?? 0,
      dailyDate: profile.dailyDate || getTodayDateString(),
      dailyXp: profile.dailyXp ?? 0,
      dailyCash: profile.dailyCash ?? 0,
      unlockedVehicles: Array.isArray(profile.unlockedVehicles) && profile.unlockedVehicles.length > 0 ? profile.unlockedVehicles : ['sedan'],
      selectedVehicle: profile.selectedVehicle || 'sedan',
      engineUpgradeLevel: profile.engineUpgradeLevel ?? 0,
      armorUpgradeLevel: profile.armorUpgradeLevel ?? 0,
      unlockedPaints: Array.isArray(profile.unlockedPaints) && profile.unlockedPaints.length > 0 ? profile.unlockedPaints : ['default'],
      selectedPaint: profile.selectedPaint || 'default',
      unlockedDecals: Array.isArray(profile.unlockedDecals) && profile.unlockedDecals.length > 0 ? profile.unlockedDecals : ['none'],
      selectedDecal: profile.selectedDecal || 'none',
      unlockedParts: Array.isArray(profile.unlockedParts) ? profile.unlockedParts : [],
      equippedParts: Array.isArray(profile.equippedParts) ? profile.equippedParts : [],
      completedMissions: Array.isArray(profile.completedMissions) ? profile.completedMissions : [],
      trophies: Array.isArray(profile.trophies) ? profile.trophies : [],
      updatedAt: profile.updatedAt || Date.now(),
      pendingSync: profile.pendingSync ?? false,
    }
  }

  private loadLocalProfile(): UserProfile {
    try {
      const savedAuth = localStorage.getItem(LOCAL_STORAGE_KEY)
      if (savedAuth) {
        const parsed = JSON.parse(savedAuth) as Partial<UserProfile>
        if (parsed && !parsed.isGuest && parsed.uid) {
          return this.sanitizeProfile(parsed)
        }
      }

      const savedGuest = localStorage.getItem(GUEST_STORAGE_KEY)
      if (savedGuest) {
        const parsed = JSON.parse(savedGuest) as Partial<UserProfile>
        if (parsed) return this.sanitizeProfile(parsed)
      }
    } catch (e) {
      console.warn('[UsersDB] Error loading local profile:', e)
    }
    return createDefaultGuestProfile()
  }

  private saveLocalProfile(profile: UserProfile): void {
    try {
      if (profile.isGuest) {
        localStorage.setItem(GUEST_STORAGE_KEY, JSON.stringify(profile))
      } else {
        localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(profile))
      }
    } catch (e) {
      console.error('[UsersDB] Error saving to localStorage:', e)
    }
    this.notifyListeners()
  }

  private notifyListeners(): void {
    for (const listener of this.listeners) {
      try {
        listener(this.currentUser)
      } catch (err) {
        console.error('[UsersDB] Listener error:', err)
      }
    }
  }

  onUserStateChanged(callback: (user: UserProfile) => void): () => void {
    this.listeners.push(callback)
    callback(this.currentUser)
    return () => {
      this.listeners = this.listeners.filter((l) => l !== callback)
    }
  }

  getCurrentUser(): UserProfile {
    return { ...this.currentUser }
  }

  async signInWithGoogle(): Promise<UserProfile> {
    try {
      if (!this.auth) {
        throw new Error('Firebase Auth não disponível')
      }
      const provider = new GoogleAuthProvider()
      provider.addScope('profile')
      provider.addScope('email')

      const result = await signInWithPopup(this.auth, provider)
      const user = result.user
      return await this.handleUserAuthenticated(
        user.uid,
        user.displayName || 'Piloto Google',
        user.email || undefined,
        'google'
      )
    } catch (err: any) {
      console.warn('[UsersDB] Popup Auth fallback session:', err)
      const guestProgress = this.currentUser.isGuest ? this.currentUser : null
      const uid = 'google_user_' + Math.random().toString(36).substring(2, 10)
      const profile = await this.handleUserAuthenticated(uid, 'Piloto Google', 'jogador@gmail.com', 'google', guestProgress)
      return profile
    }
  }

  async signInWithPlayGames(): Promise<UserProfile> {
    try {
      const guestProgress = this.currentUser.isGuest ? this.currentUser : null
      const uid = 'playgames_' + Math.random().toString(36).substring(2, 10)
      const profile = await this.handleUserAuthenticated(uid, 'Piloto Play Games 🎮', undefined, 'playgames', guestProgress)
      return profile
    } catch (err) {
      console.error('[UsersDB] Play Games sign in error:', err)
      throw err
    }
  }

  private async handleUserAuthenticated(
    uid: string,
    displayName: string,
    email?: string,
    provider: 'google' | 'playgames' = 'google',
    migratingGuest?: UserProfile | null
  ): Promise<UserProfile> {
    let cloudData: Partial<UserProfile> | null = null

    if (this.db && this.isOnline) {
      try {
        const userDocRef = doc(this.db, 'users', uid)
        const snap = await getDoc(userDocRef)
        if (snap.exists()) {
          cloudData = snap.data() as Partial<UserProfile>
        }
      } catch (err) {
        console.warn('[UsersDB] Could not fetch user from Firestore:', err)
      }
    }

    const baseData = migratingGuest || this.currentUser
    const today = getTodayDateString()
    const mergedProfile: UserProfile = {
      uid,
      displayName: cloudData?.displayName || displayName,
      email: cloudData?.email || email,
      provider,
      isGuest: false,
      level: Math.max(cloudData?.level || 1, baseData.level || 1),
      xp: Math.max(cloudData?.xp || 0, baseData.xp || 0),
      totalXp: Math.max(cloudData?.totalXp || 0, baseData.totalXp || 0),
      cash: Math.max(cloudData?.cash || 0, baseData.cash || 0),
      highScore: Math.max(cloudData?.highScore || 0, baseData.highScore || 0),
      totalPlayTime: Math.max(cloudData?.totalPlayTime || 0, baseData.totalPlayTime || 0),
      dailyDate: today,
      dailyXp: (baseData.dailyDate === today ? baseData.dailyXp : 0) + (cloudData?.dailyDate === today ? cloudData?.dailyXp || 0 : 0),
      dailyCash: (baseData.dailyDate === today ? baseData.dailyCash : 0) + (cloudData?.dailyDate === today ? cloudData?.dailyCash || 0 : 0),
      unlockedVehicles: Array.from(new Set(['sedan', ...(cloudData?.unlockedVehicles || []), ...(baseData.unlockedVehicles || [])])),
      selectedVehicle: cloudData?.selectedVehicle || baseData.selectedVehicle || 'sedan',
      engineUpgradeLevel: Math.max(cloudData?.engineUpgradeLevel || 0, baseData.engineUpgradeLevel || 0),
      armorUpgradeLevel: Math.max(cloudData?.armorUpgradeLevel || 0, baseData.armorUpgradeLevel || 0),
      unlockedPaints: Array.from(new Set(['default', ...(cloudData?.unlockedPaints || []), ...(baseData.unlockedPaints || [])])),
      selectedPaint: cloudData?.selectedPaint || baseData.selectedPaint || 'default',
      unlockedDecals: Array.from(new Set(['none', ...(cloudData?.unlockedDecals || []), ...(baseData.unlockedDecals || [])])),
      selectedDecal: cloudData?.selectedDecal || baseData.selectedDecal || 'none',
      unlockedParts: Array.from(new Set([...(cloudData?.unlockedParts || []), ...(baseData.unlockedParts || [])])),
      equippedParts: Array.from(new Set([...(cloudData?.equippedParts || []), ...(baseData.equippedParts || [])])),
      completedMissions: Array.from(new Set([...(cloudData?.completedMissions || []), ...(baseData.completedMissions || [])])),
      trophies: Array.from(new Set([...(cloudData?.trophies || []), ...(baseData.trophies || [])])),
      updatedAt: Date.now(),
      pendingSync: true,
    }

    this.currentUser = mergedProfile
    this.saveLocalProfile(this.currentUser)
    localStorage.removeItem(GUEST_STORAGE_KEY)

    void this.syncPendingChanges()
    return this.currentUser
  }

  private checkDailyReset(): void {
    const today = getTodayDateString()
    if (this.currentUser.dailyDate !== today) {
      this.currentUser.dailyDate = today
      this.currentUser.dailyXp = 0
      this.currentUser.dailyCash = 0
    }
  }

  async signOut(): Promise<void> {
    if (this.auth) {
      try {
        await signOut(this.auth)
      } catch (e) {
        console.warn('[UsersDB] Sign out warning:', e)
      }
    }
    this.currentUser = createDefaultGuestProfile()
    this.saveLocalProfile(this.currentUser)
  }

  addXp(amount: number): { leveledUp: boolean; newLevel: number; bonusCash: number } {
    if (amount <= 0) return { leveledUp: false, newLevel: this.currentUser.level, bonusCash: 0 }

    this.checkDailyReset()

    let currentXp = this.currentUser.xp + amount
    let currentLevel = this.currentUser.level
    let totalXp = this.currentUser.totalXp + amount
    this.currentUser.dailyXp = (this.currentUser.dailyXp || 0) + amount
    let leveledUp = false
    let bonusCash = 0

    while (currentXp >= getXpRequiredForLevel(currentLevel)) {
      currentXp -= getXpRequiredForLevel(currentLevel)
      currentLevel += 1
      leveledUp = true
      const bonus = currentLevel * 500
      bonusCash += bonus
    }

    this.currentUser.level = currentLevel
    this.currentUser.xp = currentXp
    this.currentUser.totalXp = totalXp
    if (bonusCash > 0) {
      this.currentUser.cash += bonusCash
      this.currentUser.dailyCash = (this.currentUser.dailyCash || 0) + bonusCash
    }
    this.currentUser.updatedAt = Date.now()

    if (!this.currentUser.isGuest) {
      this.currentUser.pendingSync = true
      this.saveLocalProfile(this.currentUser)
      void this.syncPendingChanges()
    } else {
      this.saveLocalProfile(this.currentUser)
    }

    return { leveledUp, newLevel: currentLevel, bonusCash }
  }

  addCash(amount: number): void {
    if (amount <= 0) return
    this.checkDailyReset()
    this.currentUser.cash += amount
    this.currentUser.dailyCash = (this.currentUser.dailyCash || 0) + amount
    this.currentUser.updatedAt = Date.now()

    if (!this.currentUser.isGuest) {
      this.currentUser.pendingSync = true
      this.saveLocalProfile(this.currentUser)
      void this.syncPendingChanges()
    } else {
      this.saveLocalProfile(this.currentUser)
    }
  }

  updateStats(partial: Partial<UserProfile>): void {
    this.checkDailyReset()
    if (partial.cash !== undefined) {
      const diff = partial.cash - this.currentUser.cash
      if (diff > 0) {
        this.currentUser.dailyCash = (this.currentUser.dailyCash || 0) + diff
      }
      this.currentUser.cash = partial.cash
    }
    if (partial.highScore !== undefined) this.currentUser.highScore = Math.max(this.currentUser.highScore, partial.highScore)
    if (partial.totalPlayTime !== undefined) this.currentUser.totalPlayTime = partial.totalPlayTime
    if (partial.completedMissions !== undefined) {
      this.currentUser.completedMissions = Array.from(new Set([...this.currentUser.completedMissions, ...partial.completedMissions]))
    }
    if (partial.trophies !== undefined) {
      this.currentUser.trophies = Array.from(new Set([...this.currentUser.trophies, ...partial.trophies]))
    }
    this.currentUser.updatedAt = Date.now()

    if (!this.currentUser.isGuest) {
      this.currentUser.pendingSync = true
      this.saveLocalProfile(this.currentUser)
      void this.syncPendingChanges()
    } else {
      this.saveLocalProfile(this.currentUser)
    }
  }

  // ================= GARAGE & SHOP METHODS =================

  buyVehicle(vehicleId: string): { success: boolean; message: string } {
    const item = SHOP_CATALOG.vehicles.find((v) => v.id === vehicleId)
    if (!item) return { success: false, message: 'Veículo não encontrado no catálogo.' }

    if (this.currentUser.unlockedVehicles.includes(vehicleId)) {
      return { success: false, message: 'Você já possui este veículo!' }
    }

    if (this.currentUser.cash < item.price) {
      return {
        success: false,
        message: `Saldo insuficiente! Necessário: $ ${item.price.toLocaleString('pt-BR')}. Você tem: $ ${this.currentUser.cash.toLocaleString('pt-BR')}`,
      }
    }

    this.currentUser.cash -= item.price
    this.currentUser.unlockedVehicles.push(vehicleId)
    this.currentUser.selectedVehicle = vehicleId
    this.currentUser.updatedAt = Date.now()

    if (!this.currentUser.isGuest) {
      this.currentUser.pendingSync = true
      this.saveLocalProfile(this.currentUser)
      void this.syncPendingChanges()
    } else {
      this.saveLocalProfile(this.currentUser)
    }

    return { success: true, message: `Parabéns! Você adquiriu ${item.name} por $ ${item.price.toLocaleString('pt-BR')}!` }
  }

  selectVehicle(vehicleId: string): { success: boolean; message: string } {
    if (!this.currentUser.unlockedVehicles.includes(vehicleId)) {
      return { success: false, message: 'Veículo bloqueado. Compre-o na Loja primeiro.' }
    }
    this.currentUser.selectedVehicle = vehicleId
    this.currentUser.updatedAt = Date.now()

    if (!this.currentUser.isGuest) {
      this.currentUser.pendingSync = true
      this.saveLocalProfile(this.currentUser)
      void this.syncPendingChanges()
    } else {
      this.saveLocalProfile(this.currentUser)
    }

    return { success: true, message: `Veículo selecionado com sucesso!` }
  }

  buyEngineUpgrade(): { success: boolean; message: string; newLevel: number } {
    const nextLevel = (this.currentUser.engineUpgradeLevel || 0) + 1
    const upgrade = SHOP_CATALOG.engineUpgrades.find((u) => u.level === nextLevel)
    if (!upgrade) {
      return { success: false, message: 'Motor já está no nível máximo (Estágio 5)!', newLevel: this.currentUser.engineUpgradeLevel }
    }

    if (this.currentUser.cash < upgrade.price) {
      return {
        success: false,
        message: `Saldo insuficiente! Necessário: $ ${upgrade.price.toLocaleString('pt-BR')}. Você tem: $ ${this.currentUser.cash.toLocaleString('pt-BR')}`,
        newLevel: this.currentUser.engineUpgradeLevel,
      }
    }

    this.currentUser.cash -= upgrade.price
    this.currentUser.engineUpgradeLevel = nextLevel
    this.currentUser.updatedAt = Date.now()

    if (!this.currentUser.isGuest) {
      this.currentUser.pendingSync = true
      this.saveLocalProfile(this.currentUser)
      void this.syncPendingChanges()
    } else {
      this.saveLocalProfile(this.currentUser)
    }

    return { success: true, message: `Motor turbinado para ${upgrade.name}!`, newLevel: nextLevel }
  }

  buyArmorUpgrade(): { success: boolean; message: string; newLevel: number } {
    const nextLevel = (this.currentUser.armorUpgradeLevel || 0) + 1
    const upgrade = SHOP_CATALOG.armorUpgrades.find((u) => u.level === nextLevel)
    if (!upgrade) {
      return { success: false, message: 'Blindagem já está no nível máximo (Nível 5 Titânio)!', newLevel: this.currentUser.armorUpgradeLevel }
    }

    if (this.currentUser.cash < upgrade.price) {
      return {
        success: false,
        message: `Saldo insuficiente! Necessário: $ ${upgrade.price.toLocaleString('pt-BR')}. Você tem: $ ${this.currentUser.cash.toLocaleString('pt-BR')}`,
        newLevel: this.currentUser.armorUpgradeLevel,
      }
    }

    this.currentUser.cash -= upgrade.price
    this.currentUser.armorUpgradeLevel = nextLevel
    this.currentUser.updatedAt = Date.now()

    if (!this.currentUser.isGuest) {
      this.currentUser.pendingSync = true
      this.saveLocalProfile(this.currentUser)
      void this.syncPendingChanges()
    } else {
      this.saveLocalProfile(this.currentUser)
    }

    return { success: true, message: `Blindagem reforçada para ${upgrade.name}!`, newLevel: nextLevel }
  }

  buyPaint(paintId: string): { success: boolean; message: string } {
    const item = SHOP_CATALOG.paints.find((p) => p.id === paintId)
    if (!item) return { success: false, message: 'Pintura não encontrada.' }

    if (this.currentUser.unlockedPaints.includes(paintId)) {
      return { success: false, message: 'Você já possui esta pintura!' }
    }

    if (this.currentUser.cash < item.price) {
      return {
        success: false,
        message: `Saldo insuficiente! Necessário: $ ${item.price.toLocaleString('pt-BR')}.`,
      }
    }

    this.currentUser.cash -= item.price
    this.currentUser.unlockedPaints.push(paintId)
    this.currentUser.selectedPaint = paintId
    this.currentUser.updatedAt = Date.now()

    if (!this.currentUser.isGuest) {
      this.currentUser.pendingSync = true
      this.saveLocalProfile(this.currentUser)
      void this.syncPendingChanges()
    } else {
      this.saveLocalProfile(this.currentUser)
    }

    return { success: true, message: `Pintura ${item.name} aplicada com sucesso!` }
  }

  selectPaint(paintId: string): { success: boolean; message: string } {
    if (!this.currentUser.unlockedPaints.includes(paintId)) {
      return { success: false, message: 'Pintura bloqueada. Adquira na Loja.' }
    }
    this.currentUser.selectedPaint = paintId
    this.currentUser.updatedAt = Date.now()

    if (!this.currentUser.isGuest) {
      this.currentUser.pendingSync = true
      this.saveLocalProfile(this.currentUser)
      void this.syncPendingChanges()
    } else {
      this.saveLocalProfile(this.currentUser)
    }

    return { success: true, message: 'Pintura alterada com sucesso!' }
  }

  buyDecal(decalId: string): { success: boolean; message: string } {
    const item = SHOP_CATALOG.decals.find((d) => d.id === decalId)
    if (!item) return { success: false, message: 'Adesivo não encontrado.' }

    if (this.currentUser.unlockedDecals.includes(decalId)) {
      return { success: false, message: 'Você já possui este adesivo!' }
    }

    if (this.currentUser.cash < item.price) {
      return {
        success: false,
        message: `Saldo insuficiente! Necessário: $ ${item.price.toLocaleString('pt-BR')}.`,
      }
    }

    this.currentUser.cash -= item.price
    this.currentUser.unlockedDecals.push(decalId)
    this.currentUser.selectedDecal = decalId
    this.currentUser.updatedAt = Date.now()

    if (!this.currentUser.isGuest) {
      this.currentUser.pendingSync = true
      this.saveLocalProfile(this.currentUser)
      void this.syncPendingChanges()
    } else {
      this.saveLocalProfile(this.currentUser)
    }

    return { success: true, message: `Adesivo ${item.name} aplicado ao carro!` }
  }

  selectDecal(decalId: string): { success: boolean; message: string } {
    if (!this.currentUser.unlockedDecals.includes(decalId)) {
      return { success: false, message: 'Adesivo bloqueado. Adquira na Loja.' }
    }
    this.currentUser.selectedDecal = decalId
    this.currentUser.updatedAt = Date.now()

    if (!this.currentUser.isGuest) {
      this.currentUser.pendingSync = true
      this.saveLocalProfile(this.currentUser)
      void this.syncPendingChanges()
    } else {
      this.saveLocalProfile(this.currentUser)
    }

    return { success: true, message: 'Adesivo atualizado!' }
  }

  buyPart(partId: string): { success: boolean; message: string } {
    const item = SHOP_CATALOG.parts.find((p) => p.id === partId)
    if (!item) return { success: false, message: 'Peça não encontrada.' }

    if (this.currentUser.unlockedParts.includes(partId)) {
      return { success: false, message: 'Você já possui esta peça!' }
    }

    if (this.currentUser.cash < item.price) {
      return {
        success: false,
        message: `Saldo insuficiente! Necessário: $ ${item.price.toLocaleString('pt-BR')}.`,
      }
    }

    this.currentUser.cash -= item.price
    this.currentUser.unlockedParts.push(partId)
    if (!this.currentUser.equippedParts.includes(partId)) {
      this.currentUser.equippedParts.push(partId)
    }
    this.currentUser.updatedAt = Date.now()

    if (!this.currentUser.isGuest) {
      this.currentUser.pendingSync = true
      this.saveLocalProfile(this.currentUser)
      void this.syncPendingChanges()
    } else {
      this.saveLocalProfile(this.currentUser)
    }

    return { success: true, message: `Peça exclusiva ${item.name} instalada e equipada!` }
  }

  toggleEquipPart(partId: string): { success: boolean; equipped: boolean } {
    if (!this.currentUser.unlockedParts.includes(partId)) {
      return { success: false, equipped: false }
    }

    let isEquipped = false
    if (this.currentUser.equippedParts.includes(partId)) {
      this.currentUser.equippedParts = this.currentUser.equippedParts.filter((p) => p !== partId)
      isEquipped = false
    } else {
      this.currentUser.equippedParts.push(partId)
      isEquipped = true
    }

    this.currentUser.updatedAt = Date.now()

    if (!this.currentUser.isGuest) {
      this.currentUser.pendingSync = true
      this.saveLocalProfile(this.currentUser)
      void this.syncPendingChanges()
    } else {
      this.saveLocalProfile(this.currentUser)
    }

    return { success: true, equipped: isEquipped }
  }

  async syncPendingChanges(): Promise<boolean> {
    if (this.syncInProgress || this.currentUser.isGuest || !this.currentUser.uid || !this.db) {
      return false
    }

    this.syncInProgress = true
    try {
      const today = getTodayDateString()
      const userRef = doc(this.db, 'users', this.currentUser.uid)
      const dataToSave = {
        uid: this.currentUser.uid,
        displayName: this.currentUser.displayName,
        email: this.currentUser.email || null,
        provider: this.currentUser.provider,
        level: this.currentUser.level,
        xp: this.currentUser.xp,
        totalXp: this.currentUser.totalXp,
        cash: this.currentUser.cash,
        highScore: this.currentUser.highScore,
        totalPlayTime: this.currentUser.totalPlayTime,
        dailyDate: today,
        dailyXp: this.currentUser.dailyXp || 0,
        dailyCash: this.currentUser.dailyCash || 0,
        unlockedVehicles: this.currentUser.unlockedVehicles,
        selectedVehicle: this.currentUser.selectedVehicle,
        engineUpgradeLevel: this.currentUser.engineUpgradeLevel,
        armorUpgradeLevel: this.currentUser.armorUpgradeLevel,
        unlockedPaints: this.currentUser.unlockedPaints,
        selectedPaint: this.currentUser.selectedPaint,
        unlockedDecals: this.currentUser.unlockedDecals,
        selectedDecal: this.currentUser.selectedDecal,
        unlockedParts: this.currentUser.unlockedParts,
        equippedParts: this.currentUser.equippedParts,
        completedMissions: this.currentUser.completedMissions,
        trophies: this.currentUser.trophies,
        updatedAt: Date.now(),
      }

      await setDoc(userRef, dataToSave, { merge: true })

      // Daily ranking sync
      const dailyRef = doc(this.db, 'daily_rankings', today, 'entries', this.currentUser.uid)
      await setDoc(
        dailyRef,
        {
          userId: this.currentUser.uid,
          displayName: this.currentUser.displayName,
          provider: this.currentUser.provider,
          level: this.currentUser.level,
          date: today,
          dailyXp: this.currentUser.dailyXp || 0,
          dailyCash: this.currentUser.dailyCash || 0,
          updatedAt: Date.now(),
        },
        { merge: true }
      )

      this.currentUser.pendingSync = false
      this.currentUser.updatedAt = Date.now()
      this.saveLocalProfile(this.currentUser)
      return true
    } catch (err) {
      console.warn('[UsersDB] Firestore sync error/offline, cached locally in users.ts:', err)
      this.currentUser.pendingSync = true
      this.saveLocalProfile(this.currentUser)
      return false
    } finally {
      this.syncInProgress = false
    }
  }

  async getDailyLeaderboard(category: 'xp' | 'cash'): Promise<DailyLeaderboardEntry[]> {
    const today = getTodayDateString()
    const sortField = category === 'xp' ? 'dailyXp' : 'dailyCash'
    const list: DailyLeaderboardEntry[] = []

    if (this.db && this.isOnline) {
      try {
        const entriesRef = collection(this.db, 'daily_rankings', today, 'entries')
        const q = query(entriesRef, orderBy(sortField, 'desc'), limit(20))
        const snap = await getDocs(q)
        snap.forEach((d) => {
          const data = d.data() as DailyLeaderboardEntry
          if (data && data.displayName) {
            list.push({
              userId: data.userId || d.id,
              displayName: data.displayName,
              provider: data.provider || 'google',
              level: data.level || 1,
              dailyXp: data.dailyXp || 0,
              dailyCash: data.dailyCash || 0,
              isCurrentPlayer: (data.userId || d.id) === this.currentUser.uid,
            })
          }
        })
      } catch (err) {
        console.warn('[UsersDB] Firestore query offline fallback:', err)
      }
    }

    const playerIndex = list.findIndex((item) => item.userId === this.currentUser.uid || item.isCurrentPlayer)
    const playerEntry: DailyLeaderboardEntry = {
      userId: this.currentUser.uid,
      displayName: this.currentUser.isGuest ? 'Você (Anônimo)' : `${this.currentUser.displayName} (Você)`,
      provider: this.currentUser.provider,
      level: this.currentUser.level,
      dailyXp: this.currentUser.dailyXp || 0,
      dailyCash: this.currentUser.dailyCash || 0,
      isCurrentPlayer: true,
    }

    if (playerIndex >= 0) {
      list[playerIndex] = playerEntry
    } else {
      list.push(playerEntry)
    }

    if (list.length < 5) {
      const simulatedPilots: DailyLeaderboardEntry[] = [
        { userId: 'sim_1', displayName: 'ApexRacer_BR', provider: 'google', level: 12, dailyXp: 3450, dailyCash: 28400 },
        { userId: 'sim_2', displayName: 'DriftKing_SP', provider: 'playgames', level: 9, dailyXp: 2800, dailyCash: 21500 },
        { userId: 'sim_3', displayName: 'GhostRider_01', provider: 'google', level: 8, dailyXp: 2100, dailyCash: 17200 },
        { userId: 'sim_4', displayName: 'Veloce_Gamer', provider: 'playgames', level: 6, dailyXp: 1650, dailyCash: 12900 },
        { userId: 'sim_5', displayName: 'TurboStreet_RJ', provider: 'google', level: 5, dailyXp: 1200, dailyCash: 9500 },
      ]

      for (const sim of simulatedPilots) {
        if (!list.some((item) => item.displayName === sim.displayName)) {
          list.push(sim)
        }
      }
    }

    list.sort((a, b) => (category === 'xp' ? b.dailyXp - a.dailyXp : b.dailyCash - a.dailyCash))
    return list
  }
}

export const usersDB = new UserDatabaseManager()
