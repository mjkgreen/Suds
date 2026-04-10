import { MilestoneData, StreakData, UserStats, DrinkType } from '@/types/models';
import { MILESTONE_EMOJI, DRINK_TYPE_MAP } from '@/lib/constants';

export type BadgeCategory = 'milestone' | 'sober_streak' | 'drink_streak' | 'session_count' | 'under_limit_streak' | 'drink_type' | 'global_entry' | 'happy_hour' | 'last_call' | 'early_bird' | 'weekend_warrior' | 'school_night' | 'keeping_pace' | 'hydrated' | 'consistency_king';

export type BadgeTier = 1 | 2 | 3 | 4 | 5 | 6 | 7;

export interface UserBadge {
  id: string; // e.g. "milestone-100", "sober-7"
  category: BadgeCategory;
  value: number;
  label: string;
  icon: string;
  tier: BadgeTier;
  targetValue?: number; // the value that earned this tier
}

export const TIER_COLORS: Record<BadgeTier, string> = {
  1: '#9CA3AF', // Grey
  2: '#dee078ff', // Yellow
  3: '#4ADE80', // Green
  4: '#60A5FA', // Blue
  5: '#C084FC', // Purple
  6: '#F87171', // Red
  7: '#FBBF24', // Gold
};

const THRESHOLDS: Record<string, number[]> = {
  milestone: [1, 10, 25, 50, 100, 250, 500],
  sober_streak: [7, 14, 30, 90, 180, 365, 730],
  drink_streak: [3, 7, 14, 30, 60, 90, 180],
  drink_type: [5, 10, 25, 50, 100, 250, 500],
  global_entry: [1, 3, 5, 10, 25, 50, 100],
  happy_hour: [5, 10, 25, 50, 100, 250, 500],
  last_call: [5, 10, 25, 50, 100, 250, 500],
  early_bird: [5, 10, 25, 50, 100, 250, 500],
  weekend_warrior: [1, 2, 4, 8, 12, 26, 52],
  school_night: [1, 2, 4, 8, 12, 26, 52],
  under_limit_streak: [1, 2, 4, 8, 12, 26, 52],
  water_streak: [1, 3, 7, 14, 30, 60, 90],
};

function getTier(value: number, thresholds: number[]): BadgeTier {
  let tier: number = 0;
  for (let i = 0; i < thresholds.length; i++) {
    if (value >= thresholds[i]) {
      tier = i + 1;
    } else {
      break;
    }
  }
  return Math.min(Math.max(tier, 1), 7) as BadgeTier;
}

export function getEarnedBadges(
  milestones?: MilestoneData | null,
  streaks?: StreakData | null,
  stats?: UserStats | null,
): UserBadge[] {
  const badges: UserBadge[] = [];

  // 1. Milestones (Total Drinks - All Rounder)
  if (stats && stats.total_drinks > 0) {
    const thresholds = THRESHOLDS.milestone;
    const currentVal = stats.total_drinks;
    // We only add the HIGHEST tier earned for each specific ID/Type usually,
    // but the user might want all of them.
    // Let's just add the highest tier for each category/value combo.
    thresholds.forEach((t, index) => {
      if (currentVal >= t) {
        badges.push({
          id: `milestone-${t}`,
          category: 'milestone',
          value: currentVal,
          targetValue: t,
          label: `${t} Total Drinks`,
          icon: 'trophy',
          tier: (index + 1) as BadgeTier,
        });
      }
    });
  }

  // 2. Specific Drink Types
  if (stats && stats.favorite_drink_types) {
    stats.favorite_drink_types.forEach((dt) => {
      const thresholds = THRESHOLDS.drink_type;
      thresholds.forEach((t, index) => {
        if (dt.count >= t) {
          const info = DRINK_TYPE_MAP[dt.drink_type as DrinkType] ?? DRINK_TYPE_MAP['other'];
          badges.push({
            id: `drink-${dt.drink_type}-${t}`,
            category: 'drink_type',
            value: dt.count,
            targetValue: t,
            label: `${t} ${info.label}s`,
            icon: info.icon || 'beer',
            tier: (index + 1) as BadgeTier,
          });
        }
      });
    });
  }

  // 3. Sober Streaks
  if (streaks && streaks.sober_streak > 0) {
    const thresholds = THRESHOLDS.sober_streak;
    thresholds.forEach((t, index) => {
      if (streaks.sober_streak >= t) {
        badges.push({
          id: `sober-${t}`,
          category: 'sober_streak',
          value: streaks.sober_streak,
          targetValue: t,
          label: `${t} Day Sober Streak`,
          icon: 'snowflake',
          tier: (index + 1) as BadgeTier,
        });
      }
    });
  }

  // 4. Drink Streaks (Consecutive nights out)
  if (streaks && streaks.drink_streak > 0) {
    const thresholds = THRESHOLDS.drink_streak;
    thresholds.forEach((t, index) => {
      if (streaks.drink_streak >= t) {
        badges.push({
          id: `streak-${t}`,
          category: 'drink_streak',
          value: streaks.drink_streak,
          targetValue: t,
          label: `${t} Night Run`,
          icon: 'flame-outline',
          tier: (index + 1) as BadgeTier,
        });
      }
    });
  }

  // 5. Global Entry (Unique Countries)
  if (stats && stats.unique_countries_count > 0) {
    const thresholds = THRESHOLDS.global_entry;
    thresholds.forEach((t, index) => {
      if (stats.unique_countries_count >= t) {
        badges.push({
          id: `global-${t}`,
          category: 'global_entry',
          value: stats.unique_countries_count,
          targetValue: t,
          label: `${t} ${t === 1 ? 'Country' : 'Countries'}`,
          icon: 'earth',
          tier: (index + 1) as BadgeTier,
        });
      }
    });
  }

  // 6. Happy Hour (4-6 PM)
  if (stats && stats.happy_hour_count > 0) {
    const thresholds = THRESHOLDS.happy_hour;
    thresholds.forEach((t, index) => {
      if (stats.happy_hour_count >= t) {
        badges.push({
          id: `happyhour-${t}`,
          category: 'happy_hour',
          value: stats.happy_hour_count,
          targetValue: t,
          label: `Happy Hour x${t}`,
          icon: 'clock',
          tier: (index + 1) as BadgeTier,
        });
      }
    });
  }

  // 7. Last Call (After 1 AM)
  if (stats && stats.last_call_count > 0) {
    const thresholds = THRESHOLDS.last_call;
    thresholds.forEach((t, index) => {
      if (stats.last_call_count >= t) {
        badges.push({
          id: `lastcall-${t}`,
          category: 'last_call',
          value: stats.last_call_count,
          targetValue: t,
          label: `Last Call x${t}`,
          icon: 'alarm',
          tier: (index + 1) as BadgeTier,
        });
      }
    });
  }

  // 8. Early Bird (10AM - 4PM)
  if (stats && stats.early_bird_count > 0) {
    const thresholds = THRESHOLDS.early_bird;
    thresholds.forEach((t, index) => {
      if (stats.early_bird_count >= t) {
        badges.push({
          id: `earlybird-${t}`,
          category: 'early_bird',
          value: stats.early_bird_count,
          targetValue: t,
          label: `Early Bird x${t}`,
          icon: 'weather-sunny',
          tier: (index + 1) as BadgeTier,
        });
      }
    });
  }

  // 9. Weekend Warrior & School Night Pro
  if (stats?.activity_by_day && stats.activity_by_day.length > 0) {
    const weeks: Record<string, { days: Set<number>; total: number }> = {};
    stats.activity_by_day.forEach((d) => {
      const dt = new Date(d.date + 'T12:00:00'); // Midday to avoid TZ issues
      const startOfWeek = new Date(dt);
      startOfWeek.setDate(dt.getDate() - dt.getDay());
      const weekKey = startOfWeek.toISOString().split('T')[0];

      if (!weeks[weekKey]) weeks[weekKey] = { days: new Set(), total: 0 };
      weeks[weekKey].days.add(dt.getDay());
      weeks[weekKey].total += d.count;
    });

    let schoolNightStreak = 0;
    let weekendWarriorStreak = 0;
    let currentSchoolNightStreak = 0;
    let currentWeekendWarriorStreak = 0;

    const userCreatedDate = stats.user_created_at ? new Date(stats.user_created_at) : new Date(0);

    // Check last 52 weeks
    for (let i = 0; i < 52; i++) {
      const checkDate = new Date();
      checkDate.setDate(checkDate.getDate() - (i * 7 + checkDate.getDay()));
      const weekKey = checkDate.toISOString().split('T')[0];
      const weekData = weeks[weekKey];

      // Don't count weeks before account creation
      if (checkDate < userCreatedDate) {
        // If the user joined in the middle of this week, we check if they've been good since joining
        // But for simplicity, we just break here to fix the "Broken" logic
        break;
      }

      // School Night Pro: No drinks Mon-Thu (1, 2, 3, 4)
      const isSchoolNightSober = !weekData || (!weekData.days.has(1) && !weekData.days.has(2) && !weekData.days.has(3) && !weekData.days.has(4));
      if (isSchoolNightSober) {
        currentSchoolNightStreak++;
      } else {
        schoolNightStreak = Math.max(schoolNightStreak, currentSchoolNightStreak);
        currentSchoolNightStreak = 0;
      }

      // Weekend Warrior: Only drinks Fri/Sat (5, 6)
      const isWeekendOnly = weekData && (weekData.days.has(5) || weekData.days.has(6)) && !weekData.days.has(0) && !weekData.days.has(1) && !weekData.days.has(2) && !weekData.days.has(3) && !weekData.days.has(4);
      if (isWeekendOnly) {
        currentWeekendWarriorStreak++;
      } else {
        weekendWarriorStreak = Math.max(weekendWarriorStreak, currentWeekendWarriorStreak);
        currentWeekendWarriorStreak = 0;
      }
    }
    schoolNightStreak = Math.max(schoolNightStreak, currentSchoolNightStreak);
    weekendWarriorStreak = Math.max(weekendWarriorStreak, currentWeekendWarriorStreak);

    const snThresholds = THRESHOLDS.school_night;
    snThresholds.forEach((t, index) => {
      if (schoolNightStreak >= t) {
        badges.push({
          id: `schoolnight-${t}`,
          category: 'school_night',
          value: schoolNightStreak,
          targetValue: t,
          label: `School Night Pro x${t} Week${t > 1 ? 's' : ''}`,
          icon: 'book-open-variant',
          tier: (index + 1) as BadgeTier,
        });
      }
    });

    const wwThresholds = THRESHOLDS.weekend_warrior;
    wwThresholds.forEach((t, index) => {
      if (weekendWarriorStreak >= t) {
        badges.push({
          id: `weekendwarrior-${t}`,
          category: 'weekend_warrior',
          value: weekendWarriorStreak,
          targetValue: t,
          label: `Weekend Warrior x${t} Week${t > 1 ? 's' : ''}`,
          icon: 'sword',
          tier: (index + 1) as BadgeTier,
        });
      }
    });
  }

  // 10. Weekly Limit Hero
  if (stats && stats.weekly_limit > 0 && stats.activity_by_day && stats.activity_by_day.length > 0) {
    const weeklyTotals: Record<string, number> = {};
    stats.activity_by_day.forEach((d) => {
      const dt = new Date(d.date + 'T12:00:00');
      const startOfWeek = new Date(dt);
      startOfWeek.setDate(dt.getDate() - dt.getDay());
      const weekKey = startOfWeek.toISOString().split('T')[0];
      weeklyTotals[weekKey] = (weeklyTotals[weekKey] || 0) + d.count;
    });

    let underLimitStreak = 0;
    let currentUnderLimitStreak = 0;

    for (let i = 0; i < 52; i++) {
      const checkDate = new Date();
      checkDate.setDate(checkDate.getDate() - (i * 7 + checkDate.getDay()));
      const weekKey = checkDate.toISOString().split('T')[0];
      const weekTotal = weeklyTotals[weekKey] || 0;

      if (weekTotal <= stats.weekly_limit) {
        currentUnderLimitStreak++;
      } else {
        underLimitStreak = Math.max(underLimitStreak, currentUnderLimitStreak);
        currentUnderLimitStreak = 0;
      }
    }
    underLimitStreak = Math.max(underLimitStreak, currentUnderLimitStreak);

    const ulThresholds = THRESHOLDS.under_limit_streak;
    ulThresholds.forEach((t, index) => {
      if (underLimitStreak >= t) {
        badges.push({
          id: `underlimit-${t}`,
          category: 'under_limit_streak',
          value: underLimitStreak,
          targetValue: t,
          label: `Weekly Limit Hero x${t}`,
          icon: 'shield-check',
          tier: (index + 1) as BadgeTier,
        });
      }
    });
  }

  // 11. Hydration: Keeping Pace & Hydrated
  if (stats?.activity_by_day && stats.activity_by_day.length > 0) {
    let keepingPaceCount = 0;
    let hydratedStreak = 0;
    let currentHydratedStreak = 0;

    stats.activity_by_day.forEach((d) => {
      const isKeepingPace = d.water_count >= d.alcohol_count && d.alcohol_count > 0;
      if (isKeepingPace) {
        keepingPaceCount++;
        currentHydratedStreak++;
      } else {
        hydratedStreak = Math.max(hydratedStreak, currentHydratedStreak);
        currentHydratedStreak = 0;
      }
    });
    hydratedStreak = Math.max(hydratedStreak, currentHydratedStreak);

    const thresholds = THRESHOLDS.water_streak;
    
    // Keeping Pace (Total)
    thresholds.forEach((t, index) => {
      if (keepingPaceCount >= t) {
        badges.push({
          id: `keepingpace-${t}`,
          category: 'keeping_pace',
          value: keepingPaceCount,
          targetValue: t,
          label: `Keeping Pace x${t}`,
          icon: 'cup-water',
          tier: (index + 1) as BadgeTier,
        });
      }
    });

    // Hydrated (Consecutive)
    thresholds.forEach((t, index) => {
      if (hydratedStreak >= t) {
        badges.push({
          id: `hydrated-${t}`,
          category: 'hydrated',
          value: hydratedStreak,
          targetValue: t,
          label: `Hydrated x${t}`,
          icon: 'water-check',
          tier: (index + 1) as BadgeTier,
        });
      }
    });
  }

  // 12. Consistency King
  if (stats && stats.weekly_limit > 0 && stats.activity_by_day && stats.activity_by_day.length > 0) {
    const weeklyTotals: Record<string, number> = {};
    stats.activity_by_day.forEach((d) => {
      const dt = new Date(d.date + 'T12:00:00');
      const startOfWeek = new Date(dt);
      startOfWeek.setDate(dt.getDate() - dt.getDay());
      const weekKey = startOfWeek.toISOString().split('T')[0];
      weeklyTotals[weekKey] = (weeklyTotals[weekKey] || 0) + d.count;
    });

    let consistencyStreak = 0;
    let currentConsistencyStreak = 0;
    const goalUpdatedDate = stats.goal_updated_at ? new Date(stats.goal_updated_at) : new Date(0);

    for (let i = 0; i < 52; i++) {
      const checkDate = new Date();
      checkDate.setDate(checkDate.getDate() - (i * 7 + checkDate.getDay()));
      
      // Streak resets if we go before the last goal update
      if (checkDate < goalUpdatedDate) break;

      const weekKey = checkDate.toISOString().split('T')[0];
      const weekTotal = weeklyTotals[weekKey] || 0;

      if (weekTotal <= stats.weekly_limit) {
        currentConsistencyStreak++;
      } else {
        consistencyStreak = Math.max(consistencyStreak, currentConsistencyStreak);
        currentConsistencyStreak = 0;
      }
    }
    consistencyStreak = Math.max(consistencyStreak, currentConsistencyStreak);

    const thresholds = THRESHOLDS.under_limit_streak; // Same thresholds
    thresholds.forEach((t, index) => {
      if (consistencyStreak >= t) {
        badges.push({
          id: `consistency-${t}`,
          category: 'consistency_king',
          value: consistencyStreak,
          targetValue: t,
          label: `Consistency King x${t}`,
          icon: 'crown',
          tier: (index + 1) as BadgeTier,
        });
      }
    });
  }

  return badges;
}

export function findBadgeById(id: string): UserBadge | null {
  const parts = id.split('-');
  const category = parts[0];
  const val = parseInt(parts[parts.length - 1]);

  let label = '';
  let icon = '';
  let thresholds: number[] = [];
  let cat: BadgeCategory = 'milestone';

  if (category === 'milestone') {
    label = `${val} Total Drinks`;
    icon = 'trophy';
    thresholds = THRESHOLDS.milestone;
    cat = 'milestone';
  } else if (category === 'drink') {
    const type = parts[1] as DrinkType;
    const info = DRINK_TYPE_MAP[type] ?? DRINK_TYPE_MAP['other'];
    label = `${val} ${info.label}s`;
    icon = info.icon || 'beer';
    thresholds = THRESHOLDS.drink_type;
    cat = 'drink_type';
  } else if (category === 'sober') {
    label = `${val} Day Sober Streak`;
    icon = 'snowflake';
    thresholds = THRESHOLDS.sober_streak;
    cat = 'sober_streak';
  } else if (category === 'streak') {
    label = `${val} Night Run`;
    icon = 'flame-outline';
    thresholds = THRESHOLDS.drink_streak;
    cat = 'drink_streak';
  } else if (category === 'global') {
    label = `${val} ${val === 1 ? 'Country' : 'Countries'}`;
    icon = 'earth';
    thresholds = THRESHOLDS.global_entry;
    cat = 'global_entry';
  } else if (category === 'happyhour') {
    label = `Happy Hour x${val}`;
    icon = 'clock';
    thresholds = THRESHOLDS.happy_hour;
    cat = 'happy_hour';
  } else if (category === 'lastcall') {
    label = `Last Call x${val}`;
    icon = 'alarm';
    thresholds = THRESHOLDS.last_call;
    cat = 'last_call';
  } else if (category === 'earlybird') {
    label = `Early Bird x${val}`;
    icon = 'weather-sunny';
    thresholds = THRESHOLDS.early_bird;
    cat = 'early_bird';
  } else if (category === 'weekendwarrior') {
    label = `Weekend Warrior x${val} Week${val > 1 ? 's' : ''}`;
    icon = 'sword';
    thresholds = THRESHOLDS.weekend_warrior;
    cat = 'weekend_warrior';
  } else if (category === 'schoolnight') {
    label = `School Night Pro x${val} Week${val > 1 ? 's' : ''}`;
    icon = 'book-open-variant';
    thresholds = THRESHOLDS.school_night;
    cat = 'school_night';
  } else if (category === 'underlimit') {
    label = `Weekly Limit Hero x${val}`;
    icon = 'shield-check';
    thresholds = THRESHOLDS.under_limit_streak;
    cat = 'under_limit_streak';
  } else if (category === 'keepingpace') {
    label = `Keeping Pace x${val}`;
    icon = 'cup-water';
    thresholds = THRESHOLDS.water_streak;
    cat = 'keeping_pace';
  } else if (category === 'hydrated') {
    label = `Hydrated x${val}`;
    icon = 'water-check';
    thresholds = THRESHOLDS.water_streak;
    cat = 'hydrated';
  } else if (category === 'consistency') {
    label = `Consistency King x${val}`;
    icon = 'crown';
    thresholds = THRESHOLDS.under_limit_streak;
    cat = 'consistency_king';
  }

  const tierIndex = thresholds.indexOf(val);
  if (tierIndex === -1) return null;

  return {
    id,
    category: cat,
    value: val,
    targetValue: val,
    label,
    icon,
    tier: (tierIndex + 1) as BadgeTier,
  };
}
