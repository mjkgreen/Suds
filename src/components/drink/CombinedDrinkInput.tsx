import React, { useRef, useState } from 'react';
import {
  FlatList,
  Pressable,
  Text,
  TextInput,
  View,
} from 'react-native';
import { DrinkType } from '@/types/models';
import { searchDrinks, DrinkSearchResult } from '@/lib/drinkSearch';
import { DRINK_TYPE_MAP } from '@/lib/constants';

interface CombinedDrinkInputProps {
  value: string; // "name, brand"
  onChange: (data: { name: string; brand: string; type?: DrinkType }) => void;
  placeholder?: string;
  selectedType?: DrinkType;
}

const MAX_SUGGESTIONS = 6;

export function CombinedDrinkInput({
  value,
  onChange,
  placeholder = 'Search name or brand…',
  selectedType,
}: CombinedDrinkInputProps) {
  const [focused, setFocused] = useState(false);
  const [inputValue, setInputValue] = useState(value);
  const inputRef = useRef<TextInput>(null);

  const suggestions = searchDrinks(inputValue);

  const showDropdown = focused && suggestions.length > 0;

  function handleSelect(result: DrinkSearchResult) {
    const newValue = result.name && result.brand 
      ? `${result.name}, ${result.brand}`
      : result.name || result.brand;
    
    setInputValue(newValue);
    onChange({ name: result.name, brand: result.brand, type: result.type });
    setFocused(false);
    inputRef.current?.blur();
  }

  function handleTextChange(text: string) {
    setInputValue(text);
    // If comma-separated, split it
    const parts = text.split(',').map(s => s.trim());
    if (parts.length > 1) {
      onChange({ name: parts[0], brand: parts[1] });
    } else {
      onChange({ name: text, brand: '' });
    }
  }

  return (
    <View style={{ zIndex: 50 }}>
      <TextInput
        ref={inputRef}
        className="bg-white border border-gray-200 rounded-xl px-4 py-3 text-base text-gray-900"
        placeholder={placeholder}
        placeholderTextColor="#9ca3af"
        value={inputValue}
        onChangeText={handleTextChange}
        onFocus={() => setFocused(true)}
        onBlur={() => {
          setTimeout(() => setFocused(false), 150);
        }}
        returnKeyType="done"
        blurOnSubmit
      />
      {showDropdown && (
        <View className="bg-white border border-gray-200 rounded-xl mt-1 overflow-hidden shadow-lg absolute top-full left-0 right-0 z-50">
          <FlatList
            data={suggestions}
            keyExtractor={(item) => `${item.label}:${item.type}`}
            keyboardShouldPersistTaps="always"
            scrollEnabled={false}
            renderItem={({ item, index }) => (
              <Pressable
                onPress={() => handleSelect(item)}
                className="px-4 py-3 active:bg-amber-50 flex-row justify-between items-center"
                style={index < suggestions.length - 1
                  ? { borderBottomWidth: 1, borderBottomColor: '#f3f4f6' }
                  : undefined}
              >
                <View className="flex-1">
                  <Text className="text-gray-800 text-base font-medium">{item.label}</Text>
                  {item.brand && item.name && (
                    <Text className="text-gray-500 text-xs">{item.brand}</Text>
                  )}
                </View>
                <View 
                  className="px-2 py-0.5 rounded-md"
                  style={{ backgroundColor: DRINK_TYPE_MAP[item.type].color + '20' }}
                >
                  <Text 
                    className="text-[10px] font-bold uppercase"
                    style={{ color: DRINK_TYPE_MAP[item.type].color }}
                  >
                    {DRINK_TYPE_MAP[item.type].label}
                  </Text>
                </View>
              </Pressable>
            )}
          />
        </View>
      )}
    </View>
  );
}
