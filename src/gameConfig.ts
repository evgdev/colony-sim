// Game Configuration
// Edit this file to change game settings

export const gameConfig = {
  // Debug
  debug: false,
  debugSpeed: 1,

  // Quest skip (set to quest id to skip, null for normal start)
  skipToQuest: 'q_dino_3' as string | null,
  // Example: skipToQuest: 'q2_3',

  // Starting resources (when skipping quests)
  startResources: {
    wood: 50,
    stone: 30,
    food: 30,
    fiber: 20,
    raptor_egg: 1,
  },

  // Spawn settings
  maxDinosaurs: 6,
  dinoSpawnInterval: 30,
  resourceSpawnInterval: 50,
  maxResourcesOnMap: 25,

  // Taming
  tamingLoyaltyThreshold: 50,
  attackLoyaltyThreshold: 80,
  hungerDecayRate: 0.5,
  loyaltyDecayRate: 0.3,

  // Incubation (ticks)
  incubationTimes: {
    raptor: 30,
    brontosaur: 50,
    trex: 80,
  },

  // Combat
  attackCooldown: 2,
  tamedFollowDistance: 4,
  tamedAutoAttackRange: 6,

  // Building unlock quests
  unlocks: {
    incubator: 'q_dino_1',
    paddock: 'q_dino_4',
    workshop: 'q2_3',
    lab: 'q2_plants',
    radio: 'q5_1',
  },
};
