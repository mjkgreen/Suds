import React, { useEffect, useRef, useState } from 'react';
import { Pressable, Text, TextInput, View } from 'react-native';
import { DrinkSuggestion } from '@/lib/drinkSearch';
import { DRINK_TYPE_MAP } from '@/lib/constants';

interface AutocompleteTextInputProps {
  value: string;
  onChangeText: (text: string) => void;
  onSelectSuggestion: (suggestion: DrinkSuggestion) => void;
  getSuggestions: (query: string) => DrinkSuggestion[];
  placeholder?: string;
}

export function AutocompleteTextInput({
  value,
  onChangeText,
  onSelectSuggestion,
  getSuggestions,
  placeholder,
}: AutocompleteTextInputProps) {
  const [focused, setFocused] = useState(false);
  const [inputValue, setInputValue] = useState(value);
  const inputRef = useRef<TextInput>(null);

  // Sync with external value changes (e.g. form reset or async data load on edit screen)
  useEffect(() => {
    if (!focused) {
      setInputValue(value ?? '');
    }
  }, [value]);

  const suggestions = focused ? getSuggestions(inputValue) : [];
  const showDropdown = focused && suggestions.length > 0;

  function handleSelect(suggestion: DrinkSuggestion) {
    setInputValue(suggestion.label);
    onSelectSuggestion(suggestion);
    setFocused(false);
    inputRef.current?.blur();
  }

  function handleTextChange(text: string) {
    setInputValue(text);
    onChangeText(text);
  }

  return (
    <View>
      <TextInput
        ref={inputRef}
        className="bg-card border border-border rounded-xl px-4 py-3 text-base text-foreground"
        placeholder={placeholder}
        placeholderTextColor="#9ca3af"
        value={inputValue}
        onChangeText={handleTextChange}
        onFocus={() => setFocused(true)}
        onBlur={() => {
          // Delay so suggestion taps register before the dropdown hides
          setTimeout(() => setFocused(false), 200);
        }}
        autoCorrect={false}
        spellCheck={false}
        returnKeyType="done"
        autoCapitalize="sentences"
        blurOnSubmit
      />
      {showDropdown && (
        <View className="bg-card border border-border rounded-xl mt-1 overflow-hidden shadow-2xl absolute top-full left-0 right-0 z-50">
          {suggestions.map((item, index) => (
            <Pressable
              key={`${item.label}:${item.type}`}
              onPress={() => handleSelect(item)}
              className={`px-4 py-3 active:bg-accent flex-row justify-between items-center ${index < suggestions.length - 1 ? 'border-b border-border/50' : ''}`}
            >
              <Text className="text-foreground text-base font-medium flex-1" numberOfLines={1}>
                {item.label}
              </Text>
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
          ))}
        </View>
      )}
    </View>
  );
}
