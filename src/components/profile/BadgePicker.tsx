import React from 'react';
import { Modal, Pressable, ScrollView, Text, View, SafeAreaView } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { UserBadge, BadgeCategory, TIER_COLORS } from '@/utils/badgeHelpers';

interface BadgePickerProps {
  isVisible: boolean;
  onClose: () => void;
  earnedBadges: UserBadge[];
  selectedBadgeIds: string[];
  onSelect: (ids: string[]) => void;
}

const CATEGORY_LABELS: Record<BadgeCategory, string> = {
    milestone: 'Drink Count',
    sober_streak: 'Sober Streaks',
    drink_streak: 'Drink Streaks',
    session_count: 'Nights Out',
    under_limit_streak: 'Weekly Limit',
    drink_type: 'Drink Types',
    global_entry: 'Global Entry',
    happy_hour: 'Happy Hour',
    last_call: 'Last Call',
    early_bird: 'Early Bird',
    weekend_warrior: 'Weekend Warrior',
    school_night: 'School Night Pro'
};

export function BadgePicker({
  isVisible,
  onClose,
  earnedBadges,
  selectedBadgeIds,
  onSelect,
}: BadgePickerProps) {
  const toggleBadge = (id: string) => {
    if (selectedBadgeIds.includes(id)) {
      onSelect(selectedBadgeIds.filter((bid) => bid !== id));
    } else if (selectedBadgeIds.length < 3) {
      onSelect([...selectedBadgeIds, id]);
    }
  };

  const badgesByCategory = earnedBadges.reduce((acc, b) => {
    if (!acc[b.category]) acc[b.category] = [];
    acc[b.category].push(b);
    return acc;
  }, {} as Record<BadgeCategory, UserBadge[]>);

  // For categories like 'drink_type', we might have many tiers. 
  // Let's only show the HIGHEST tier badge for each drink type or value.
  const filteredBadges = (category: BadgeCategory, badges: UserBadge[]) => {
      if (category === 'drink_type') {
         // Show highest tier for each drink type
         const bestByType: Record<string, UserBadge> = {};
         badges.forEach(b => {
             const type = b.id.split('-')[1];
             if (!bestByType[type] || b.tier > bestByType[type].tier) {
                 bestByType[type] = b;
             }
         });
         return Object.values(bestByType).sort((a,b) => b.tier - a.tier);
      }
      
      // For other categories, show highest tier overall
      const highest = badges.sort((a,b) => b.tier - a.tier)[0];
      return highest ? [highest] : [];
  };

  return (
    <Modal visible={isVisible} transparent animationType="fade" onRequestClose={onClose}>
      <Pressable className="flex-1 bg-black/50 justify-end" onPress={onClose}>
        <Pressable className="bg-card rounded-t-3xl p-6 h-[75%]" onPress={(e) => e.stopPropagation()}>
          <View className="flex-row items-center justify-between mb-2">
            <Text className="text-xl font-bold text-foreground">Top 3 Badges</Text>
            <View className="flex-row items-center gap-2">
              {selectedBadgeIds.length > 0 && (
                <Pressable 
                  onPress={() => onSelect([])} 
                  className="bg-accent rounded-full px-3 py-2 flex-row items-center gap-1"
                >
                  <Ionicons name="refresh" size={16} color="#6b7280" />
                  <Text className="text-muted-foreground text-xs font-bold">Reset</Text>
                </Pressable>
              )}
              <Pressable onPress={onClose} className="bg-accent rounded-full p-2">
                <Ionicons name="close" size={24} color="#6b7280" />
              </Pressable>
            </View>
          </View>
          <Text className="text-sm text-muted-foreground mb-6">Select up to 3 badges to display ({selectedBadgeIds.length}/3)</Text>

          <ScrollView showsVerticalScrollIndicator={false}>
            {(Object.keys(CATEGORY_LABELS) as BadgeCategory[]).map((category) => {
                const categoryBadges = badgesByCategory[category];
                if (!categoryBadges || categoryBadges.length === 0) return null;
                
                const displayBadges = filteredBadges(category, categoryBadges);

                return (
                    <View key={category} className="mb-6">
                        <Text className="text-xs font-bold text-muted-foreground uppercase tracking-widest mb-3">{CATEGORY_LABELS[category]}</Text>
                        <View className="flex-row flex-wrap gap-3">
                            {displayBadges.map((badge) => {
                                const isSelected = selectedBadgeIds.includes(badge.id);
                                return (
                                    <Pressable
                                        key={badge.id}
                                        onPress={() => toggleBadge(badge.id)}
                                        className={`items-center justify-center min-w-[100px] flex-1 p-4 rounded-2xl border-2 ${
                                            isSelected ? 'bg-primary/10 border-primary' : 'bg-accent border-transparent'
                                        }`}
                                    >
                                        <View 
                                            className="w-14 h-16 items-center justify-center mb-1 border-2"
                                            style={{ 
                                                backgroundColor: TIER_COLORS[badge.tier] + '20', 
                                                borderColor: TIER_COLORS[badge.tier],
                                                borderTopLeftRadius: 8,
                                                borderTopRightRadius: 8,
                                                borderBottomLeftRadius: 28,
                                                borderBottomRightRadius: 28,
                                                shadowColor: TIER_COLORS[badge.tier],
                                                shadowOffset: { width: 0, height: 2 },
                                                shadowOpacity: 0.3,
                                                shadowRadius: 4,
                                                elevation: 3
                                            }}
                                        >
                                            <Text className="text-3xl">{badge.emoji}</Text>
                                        </View>
                                        <Text className="text-[10px] font-bold text-center text-foreground">{badge.label}</Text>
                                        {isSelected && (
                                            <View className="absolute top-1 right-1 bg-primary rounded-full p-0.5">
                                                <Ionicons name="checkmark" size={10} color="white" />
                                            </View>
                                        )}
                                    </Pressable>
                                );
                            })}
                        </View>
                    </View>
                );
            })}
            {earnedBadges.length === 0 && (
                 <View className="flex-1 items-center justify-center py-12">
                   <Text className="text-4xl mb-4">🏆</Text>
                   <Text className="text-muted-foreground italic text-center">
                     Keep logging drinks to earn badges!
                   </Text>
                 </View>
            )}
          </ScrollView>
        </Pressable>
        <SafeAreaView className="bg-card" />
      </Pressable>
    </Modal>
  );
}
