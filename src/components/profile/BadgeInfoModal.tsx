import React from 'react';
import { Modal, Pressable, Text, View, StyleSheet, ScrollView } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { UserBadge, TIER_COLORS, BadgeCategory } from '@/utils/badgeHelpers';
import { useColorScheme } from 'nativewind';

interface BadgeInfoModalProps {
  badges: UserBadge[];
  isVisible: boolean;
  onClose: () => void;
  onEdit?: () => void;
}

const CATEGORY_DESCS: Record<BadgeCategory, string> = {
    milestone: 'Awarded for reaching a total drink count milestone.',
    sober_streak: 'Awarded for staying sober for a consecutive number of days.',
    drink_streak: 'Awarded for logging drinks on consecutive nights.',
    session_count: 'Awarded for total nights out logged.',
    drink_type: 'Awarded for logging a specific number of one type of drink.',
    global_entry: 'Awarded for logging drinks in multiple unique countries.',
    happy_hour: 'Awarded for drinks logged between 4PM and 6PM.',
    last_call: 'Awarded for drinks logged after 1AM.',
    early_bird: 'Awarded for drinks logged between 10AM and 4PM.',
    weekend_warrior: 'Awarded for weeks where drinks are only logged on Friday or Saturday.',
    school_night: 'Awarded for weeks with zero drinks between Monday and Thursday.',
    under_limit_streak: 'Awarded for consecutive weeks staying within your weekly drink limit.',
    keeping_pace: 'Awarded for nights where you drink at least as much water as alcohol.',
    hydrated: 'Awarded for consecutive nights meeting the Keeping Pace hydration criteria.',
    consistency_king: 'Awarded for consecutive weeks staying under your limit without changing your goal.'
};

export function BadgeInfoModal({ badges, isVisible, onClose, onEdit }: BadgeInfoModalProps) {
  const { colorScheme } = useColorScheme();
  const isDark = colorScheme === 'dark';
  
  const colors = {
    bg: isDark ? '#111827' : '#FFFFFF',
    text: isDark ? '#F9FAFB' : '#111827',
    muted: isDark ? '#9CA3AF' : '#4B5563',
    tier: isDark ? '#6B7280' : '#6B7280',
    btn: isDark ? '#374151' : '#F3F4F6',
    btnText: isDark ? '#F9FAFB' : '#111827'
  };

  if (!isVisible) return null;
  
  return (
    <Modal visible={isVisible} transparent animationType="slide" onRequestClose={onClose}>
      <Pressable style={styles.overlay} onPress={onClose}>
        <Pressable style={[styles.content, { backgroundColor: colors.bg }]} onPress={(e) => e.stopPropagation()}>
          <View style={styles.header}>
            <Text style={[styles.headerTitle, { color: colors.text }]}>Achievements</Text>
          </View>
          
          <ScrollView style={styles.scroll} showsVerticalScrollIndicator={false}>
            {badges.map((badge, index) => (
                <View key={badge.id} style={[styles.badgeItem, index === badges.length - 1 && styles.lastItem]}>
                    <View 
                        style={[
                            styles.shield,
                            { 
                                backgroundColor: TIER_COLORS[badge.tier] + '20', 
                                borderColor: TIER_COLORS[badge.tier] 
                            }
                        ]}
                    >
                        <MaterialCommunityIcons name={badge.icon as any} size={40} color={TIER_COLORS[badge.tier]} />
                    </View>
                    
                    <View style={styles.badgeInfo}>
                        <Text style={[styles.label, { color: colors.text }]}>{badge.label}</Text>
                        <Text style={[styles.tierText, { color: colors.tier }]}>Tier {badge.tier} Achievement</Text>
                        <Text style={[styles.description, { color: colors.muted }]}>
                            {CATEGORY_DESCS[badge.category]}
                        </Text>
                    </View>
                </View>
            ))}
            
            {badges.length === 0 && (
                <View style={styles.empty}>
                    <Text style={styles.emptyText}>No badges selected.</Text>
                </View>
            )}
          </ScrollView>
          
          <View style={styles.footer}>
            {onEdit && (
                <Pressable onPress={onEdit} style={[styles.button, styles.editButton]}>
                    <Text style={styles.editButtonText}>Edit My Badges</Text>
                </Pressable>
            )}
            <Pressable onPress={onClose} style={[styles.button, { backgroundColor: colors.btn }]}>
                <Text style={[styles.buttonText, { color: colors.btnText }]}>{onEdit ? 'Close' : 'Got it!'}</Text>
            </Pressable>
          </View>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
    overlay: {
        flex: 1,
        backgroundColor: 'rgba(0,0,0,0.6)',
        justifyContent: 'flex-end',
    },
    content: {
        width: '100%',
        maxHeight: '80%',
        borderTopLeftRadius: 32,
        borderTopRightRadius: 32,
        padding: 24,
    },
    header: {
        marginBottom: 20,
        alignItems: 'center',
    },
    headerTitle: {
        fontSize: 20,
        fontWeight: 'bold',
    },
    scroll: {
        marginBottom: 20,
    },
    badgeItem: {
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom: 24,
    },
    lastItem: {
        marginBottom: 8,
    },
    shield: {
        width: 70,
        height: 84,
        alignItems: 'center',
        justifyContent: 'center',
        borderWidth: 2,
        borderTopLeftRadius: 8,
        borderTopRightRadius: 8,
        borderBottomLeftRadius: 30,
        borderBottomRightRadius: 30,
        marginRight: 16,
    },
    emoji: {
        fontSize: 32
    },
    badgeInfo: {
        flex: 1,
    },
    label: {
        fontSize: 18,
        fontWeight: 'bold',
        marginBottom: 2,
    },
    tierText: {
        fontSize: 12,
        fontWeight: '600',
        marginBottom: 6,
        textTransform: 'uppercase'
    },
    description: {
        fontSize: 14,
        lineHeight: 18,
    },
    empty: {
        padding: 40,
        alignItems: 'center',
    },
    emptyText: {
        color: '#9CA3AF',
        fontStyle: 'italic',
    },
    button: {
        paddingVertical: 14,
        borderRadius: 16,
        alignItems: 'center',
        flex: 1,
    },
    buttonText: {
        fontWeight: 'bold',
    },
    footer: {
        flexDirection: 'row',
        gap: 12,
    },
    editButton: {
        backgroundColor: '#f59e0b',
    },
    editButtonText: {
        color: '#FFFFFF',
        fontWeight: 'bold',
    }
});
