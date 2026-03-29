/**
 * BAC Estimator (premium)
 *
 * Uses the Widmark formula:
 *   BAC = (drinks * 14 / (weight_kg * r * 1000)) * 100 - (0.015 * hours)
 *
 * r = 0.68 for male, 0.55 for female (body water constant)
 * 14g = standard drink alcohol weight
 *
 * This is an estimate only and should never be used to determine
 * fitness to drive. We display a clear disclaimer.
 */

import React, { useMemo, useState } from 'react';
import {
  Pressable,
  ScrollView,
  Text,
  TextInput,
  View,
} from 'react-native';

type Sex = 'male' | 'female';

function computeBAC(
  drinks: number,
  weightKg: number,
  sex: Sex,
  hoursElapsed: number,
): number {
  const r = sex === 'male' ? 0.68 : 0.55;
  const raw = (drinks * 14) / (weightKg * r * 1000) * 100;
  const metabolized = 0.015 * hoursElapsed;
  return Math.max(raw - metabolized, 0);
}

function BACBar({ bac }: { bac: number }) {
  // Scale: 0.00 (sober) → 0.30+ (very drunk), color-coded
  const pct = Math.min(bac / 0.25, 1) * 100;
  const color =
    bac < 0.04 ? '#22C55E'
    : bac < 0.08 ? '#F59E0B'
    : '#EF4444';

  return (
    <View className="mt-3">
      <View className="bg-gray-100 rounded-full h-3 overflow-hidden">
        <View
          style={{ width: `${pct}%`, backgroundColor: color }}
          className="h-3 rounded-full"
        />
      </View>
      <View className="flex-row justify-between mt-1">
        <Text className="text-xs text-gray-400">0.00</Text>
        <Text className="text-xs text-gray-400">0.08 legal limit</Text>
        <Text className="text-xs text-gray-400">0.25+</Text>
      </View>
    </View>
  );
}

export function BACEstimator() {
  const [drinks, setDrinks] = useState('2');
  const [weightLbs, setWeightLbs] = useState('160');
  const [sex, setSex] = useState<Sex>('male');
  const [hours, setHours] = useState('1');

  const bac = useMemo(() => {
    const d = parseFloat(drinks);
    const w = parseFloat(weightLbs) * 0.453592; // lbs → kg
    const h = parseFloat(hours);
    if (!d || !w || isNaN(h)) return null;
    return computeBAC(d, w, sex, h);
  }, [drinks, weightLbs, sex, hours]);

  const statusText =
    bac === null ? '—'
    : bac < 0.02 ? 'Sober'
    : bac < 0.05 ? 'Slightly impaired'
    : bac < 0.08 ? 'Impaired'
    : bac < 0.15 ? 'Significantly impaired'
    : 'Dangerously impaired';

  const statusColor =
    bac === null ? 'text-gray-400'
    : bac < 0.04 ? 'text-green-600'
    : bac < 0.08 ? 'text-amber-500'
    : 'text-red-500';

  return (
    <View className="bg-white mx-4 mt-4 rounded-2xl border border-gray-100 p-4">
      <View className="flex-row items-center justify-between mb-4">
        <Text className="text-xs text-gray-400 font-medium uppercase tracking-wide">
          BAC Estimator
        </Text>
        <Text className="text-xs bg-amber-100 text-amber-600 font-bold px-2 py-0.5 rounded-full">
          Plus
        </Text>
      </View>

      {/* Result */}
      <View className="items-center mb-4">
        <Text className="text-5xl font-bold text-gray-900">
          {bac !== null ? bac.toFixed(3) : '—'}
        </Text>
        <Text className={`text-sm font-semibold mt-1 ${statusColor}`}>{statusText}</Text>
        {bac !== null && <BACBar bac={bac} />}
      </View>

      {/* Inputs */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={{ gap: 12 }}
        className="mb-3"
      >
        <View className="items-center">
          <Text className="text-xs text-gray-400 mb-1">Drinks</Text>
          <TextInput
            className="bg-gray-100 rounded-xl px-3 py-2 text-center text-gray-900 w-16"
            keyboardType="decimal-pad"
            value={drinks}
            onChangeText={setDrinks}
          />
        </View>
        <View className="items-center">
          <Text className="text-xs text-gray-400 mb-1">Weight (lbs)</Text>
          <TextInput
            className="bg-gray-100 rounded-xl px-3 py-2 text-center text-gray-900 w-20"
            keyboardType="decimal-pad"
            value={weightLbs}
            onChangeText={setWeightLbs}
          />
        </View>
        <View className="items-center">
          <Text className="text-xs text-gray-400 mb-1">Hours drinking</Text>
          <TextInput
            className="bg-gray-100 rounded-xl px-3 py-2 text-center text-gray-900 w-20"
            keyboardType="decimal-pad"
            value={hours}
            onChangeText={setHours}
          />
        </View>
        <View className="items-center">
          <Text className="text-xs text-gray-400 mb-1">Sex</Text>
          <View className="flex-row bg-gray-100 rounded-xl overflow-hidden">
            {(['male', 'female'] as Sex[]).map((s) => (
              <Pressable
                key={s}
                className={`px-3 py-2 ${sex === s ? 'bg-amber-400' : ''}`}
                onPress={() => setSex(s)}
              >
                <Text className={`text-xs font-medium ${sex === s ? 'text-white' : 'text-gray-500'}`}>
                  {s === 'male' ? 'M' : 'F'}
                </Text>
              </Pressable>
            ))}
          </View>
        </View>
      </ScrollView>

      {/* Disclaimer */}
      <Text className="text-gray-400 text-xs text-center">
        Estimates only. Never use to determine fitness to drive.
      </Text>
    </View>
  );
}
