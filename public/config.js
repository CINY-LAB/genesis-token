// GENESIS TOKEN - all balance values live here.
(function (root) {
  var query = (typeof location !== 'undefined' && location.search) || '';

  root.GT_CONFIG = {
    // Dev mode shows cheats on the Main screen. Also enabled with ?dev=1
    DEV_MODE: /[?&]dev=1/.test(query),
    // Test multiplier for jewel drop rate (x10). Also enabled with ?test=1
    TEST_JEWEL_RATE: /[?&]test=1/.test(query),
    TEST_JEWEL_MULT: 10,

    // Save
    SAVE_KEY: 'genesis-token-save',
    BACKUP_KEY: 'genesis-token-save-backup',
    RECORDS_KEY: 'genesis-token-records',
    // Boss site (Settings). Stored apart from the save so New game keeps it.
    BOSS_URL_KEY: 'genesis-token-boss-url',
    BOSS_URL_DEFAULT: 'https://docs.docker.com/guides/java/',
    BOSS_URL_MAX: 200,
    AUTOSAVE_SEC: 30,
    // Longer gaps (sleep, suspended tab) are capped: no offline rewards
    MAX_TICK_GAP_SEC: 60,

    // Auto Miner
    AUTO: {
      maxLevel: 50,
      intervalSec: 10,
      baseAmount: 0.55,
      amountPerLevel: 0.28,
      intervalPerLevel: 0.06,    // interval - 0.06s per level (min minIntervalSec)
      costBase: 300,
      costGrowth: 1.14,
      minIntervalSec: 2
    },

    // Mine (typing)
    MINE: {
      maxLevel: 10,
      lengths: [4, 4, 5, 5, 6, 6, 7, 7, 8, 8],
      // charset per level: lower | lowernum | mixed | mixednum | confusing
      charsets: ['lower', 'lower', 'lowernum', 'lowernum', 'mixed', 'mixed',
        'mixednum', 'mixednum', 'confusing', 'confusing'],
      rewardBase: 12,
      rewardGrowth: 1.55,
      rewardSpread: 2,           // reward range = base ~ base x 2
      jewelChanceBase: 0.020,    // 2.0% at Lv.1 (Lv.10 3.8%)
      jewelChancePerLevel: 0.002,
      costBase: 2000,
      costGrowth: 2.3,
      confusingMin: 2,           // Lv.9+ strings include at least this many confusing chars
      burnStreak: 10,            // correct words in a row to start Burning time
      burnSec: 5,                // Burning time length at Lv.1 (max reward, easy words, typo ends it)
      burnSecPerLevel: 0.3       // + per mine level (Lv.10 7.7s)
    },
    CHARS: {
      lower: 'abcdefghijklmnopqrstuvwxyz',
      upper: 'ABCDEFGHIJKLMNOPQRSTUVWXYZ',
      digit: '0123456789',
      confusing: '0O1lI'
    },

    // Jewel grade chance when a jewel drops: base + perLevel x (Lv - 1), in %
    GRADE_CHANCE: {
      Normal:    { base: 80, perLevel: -3 },
      Rare:      { base: 17, perLevel: 1.2 },
      Unique:    { base: 3,  perLevel: 1.2 },
      Legendary: { base: 0,  perLevel: 0.6 }
    },

    KINDS: ['Ruby', 'Topaz', 'Sapphire', 'Emerald', 'Diamond'],
    GRADES: ['Normal', 'Rare', 'Unique', 'Legendary'],
    GRADE_MULT: { Normal: 1, Rare: 2, Unique: 4, Legendary: 8 },
    GRADE_VALUE: { Normal: 150, Rare: 600, Unique: 3000, Legendary: 15000 },

    JEWEL: {
      maxLevel: 10,
      levelCostBase: 800,        // 800 x 2^(Lv - 1)
      levelCostGrowth: 2,
      powerBase: 0.4,            // power = 0.4 x gradeMult x (1 + 0.25 x (Lv - 1))
      powerPerLevel: 0.25,
      sellRate: 0.7
    },

    // Kind coefficients: turn jewel power into real effect values (to be tuned)
    EFFECT: {
      rubyTypeFlat: 30,          // + tokens per typing mine, per 1.0 power
      rubyAutoFlat: 0.5,         // + tokens per auto mine, per 1.0 power
      topazPct: 1.0,             // + 100% tokens per 1.0 power
      sapphireSpeed: 0.3,        // interval / (1 + 0.3 x power)
      emeraldChance: 0.05,       // + 5%p double chance per 1.0 power
      diamondAmp: 0.25,          // other jewels in same slot x (1 + 0.25 x power)
      maxDoubleChance: 0.6,
      maxIntervalCut: 0.6        // combo interval cut cap
    },
    // Combo bonus scale: 1 + scalePerPoint x (avg point - 1), point = gradeMult x (1 + 0.25 x (Lv - 1))
    COMBO_SCALE_PER_POINT: 0.05,

    INVENTORY: {
      startSize: 5,
      step: 5,
      maxSize: 50,
      expandCosts: [1000, 2000, 4000, 8000, 16000, 30000, 60000, 120000, 240000]
    },

    // Slot costs: [buy, Lv.2, Lv.3]
    SLOTS: [
      [500, 5000, 20000],
      [20000, 60000, 160000],
      [150000, 300000, 600000]
    ],

    GENESIS_PRICE: 500000,

    // Combo bonuses (draft). Keys:
    // rubyPct, topazPct: kind effect +% in that slot
    // amountPct: all token amount +%, intervalCut: auto interval -%
    // doubleChance: +%p, triple: double becomes triple
    // diamondAmp: diamond amplify +%, allSlotPct: every slot effect +%
    // allPct: every effect in this slot +%
    COMBOS: [
      { name: 'Crimson Vein', kinds: ['Ruby', 'Ruby', 'Ruby'], bonus: { rubyPct: 0.5 }, text: 'Ruby effect +50%' },
      { name: 'Golden Hour', kinds: ['Topaz', 'Topaz', 'Topaz'], bonus: { topazPct: 0.5 }, text: 'Topaz effect +50%' },
      { name: 'Deep Current', kinds: ['Sapphire', 'Sapphire', 'Sapphire'], bonus: { intervalCut: 0.15 }, text: 'Mine interval -15%' },
      { name: 'Lucky Clover', kinds: ['Emerald', 'Emerald', 'Emerald'], bonus: { doubleChance: 0.10 }, text: 'Double chance +10%p' },
      { name: 'Brilliance', kinds: ['Diamond', 'Diamond', 'Diamond'], bonus: { allSlotPct: 0.10 }, text: 'All slot effects +10%' },
      { name: 'Forge', kinds: ['Ruby', 'Ruby', 'Sapphire'], bonus: { rubyPct: 0.2, intervalCut: 0.05 }, text: 'Ruby effect +20%, interval -5%' },
      { name: 'Heartfire', kinds: ['Ruby', 'Ruby', 'Diamond'], bonus: { rubyPct: 0.4 }, text: 'Ruby effect +40%' },
      { name: 'Fortune', kinds: ['Topaz', 'Topaz', 'Emerald'], bonus: { topazPct: 0.15, doubleChance: 0.05 }, text: 'Topaz effect +15%, double chance +5%p' },
      { name: 'Radiance', kinds: ['Topaz', 'Topaz', 'Diamond'], bonus: { topazPct: 0.4 }, text: 'Topaz effect +40%' },
      { name: 'Tidal', kinds: ['Sapphire', 'Sapphire', 'Ruby'], bonus: { intervalCut: 0.10 }, text: 'Interval -10%' },
      { name: 'Clockwork', kinds: ['Sapphire', 'Sapphire', 'Diamond'], bonus: { intervalCut: 0.15 }, text: 'Interval -15%' },
      { name: 'Jackpot', kinds: ['Emerald', 'Emerald', 'Topaz'], bonus: { doubleChance: 0.08 }, text: 'Double chance +8%p' },
      { name: 'Four Leaf', kinds: ['Emerald', 'Emerald', 'Diamond'], bonus: { doubleChance: 0.12 }, text: 'Double chance +12%p' },
      { name: 'Moonlit Tide', kinds: ['Emerald', 'Emerald', 'Sapphire'], bonus: { triple: true }, text: 'Triple mine instead of double' },
      { name: 'Twin Lens', kinds: ['Diamond', 'Diamond', 'Ruby'], bonus: { diamondAmp: 0.5 }, text: 'Diamond amplify +50%' },
      { name: 'Trinity', kinds: ['Ruby', 'Topaz', 'Sapphire'], bonus: { amountPct: 0.15, intervalCut: 0.05 }, text: 'Amount +15%, interval -5%' },
      { name: 'Treasure', kinds: ['Ruby', 'Topaz', 'Emerald'], bonus: { amountPct: 0.15, doubleChance: 0.05 }, text: 'Amount +15%, double chance +5%p' },
      { name: 'Hunter', kinds: ['Ruby', 'Sapphire', 'Emerald'], bonus: { intervalCut: 0.08, doubleChance: 0.04 }, text: 'Interval -8%, double chance +4%p' },
      { name: 'Starlight', kinds: ['Topaz', 'Sapphire', 'Emerald'], bonus: { allPct: 0.10 }, text: 'All effects +10%' },
      { name: 'Royal', kinds: ['Ruby', 'Topaz', 'Diamond'], bonus: { amountPct: 0.35 }, text: 'Amount +35%' },
      { name: 'Aurora', kinds: ['Sapphire', 'Emerald', 'Diamond'], bonus: { intervalCut: 0.10, doubleChance: 0.06 }, text: 'Interval -10%, double chance +6%p' },
      { name: 'Midas', kinds: ['Topaz', 'Emerald', 'Diamond'], bonus: { triple: true }, text: 'Triple mine instead of double' }
    ],

    CREDITS_NAME: 'Joy'
  };
})(typeof window !== 'undefined' ? window : globalThis);
