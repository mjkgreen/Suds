import React, { useRef, useState } from 'react';
import {
  FlatList,
  Pressable,
  Text,
  TextInput,
  View,
} from 'react-native';

interface DrinkAutocompleteProps {
  value: string;
  onChange: (value: string) => void;
  options: string[];
  placeholder?: string;
  label?: string;
}

const MAX_SUGGESTIONS = 6;

export function DrinkAutocomplete({
  value,
  onChange,
  options,
  placeholder = 'Search or type…',
}: DrinkAutocompleteProps) {
  const [focused, setFocused] = useState(false);
  const inputRef = useRef<TextInput>(null);

  const query = value.trim().toLowerCase();
  const suggestions = query.length === 0
    ? options.slice(0, MAX_SUGGESTIONS)
    : options
        .filter((o) => o.toLowerCase().includes(query))
        .slice(0, MAX_SUGGESTIONS);

  const showDropdown = focused && suggestions.length > 0;

  function handleSelect(option: string) {
    onChange(option);
    setFocused(false);
    inputRef.current?.blur();
  }

  return (
    <View>
      <TextInput
        ref={inputRef}
        className="bg-card border border-border rounded-xl px-4 py-3 text-base text-foreground"
        placeholder={placeholder}
        placeholderTextColor="hsl(var(--muted-foreground))"
        value={value}
        onChangeText={onChange}
        onFocus={() => setFocused(true)}
        onBlur={() => {
          setTimeout(() => setFocused(false), 150);
        }}
        returnKeyType="done"
        blurOnSubmit
      />
      {showDropdown && (
        <View className="bg-card border border-border rounded-xl mt-1 overflow-hidden shadow-sm z-50">
          <FlatList
            data={suggestions}
            keyExtractor={(item) => item}
            keyboardShouldPersistTaps="always"
            scrollEnabled={false}
            renderItem={({ item, index }) => (
              <Pressable
                onPress={() => handleSelect(item)}
                className={`px-4 py-3 active:bg-accent ${index < suggestions.length - 1 ? 'border-b border-border/50' : ''}`}
              >
                <Text className="text-foreground text-base">{item}</Text>
              </Pressable>
            )}
          />
        </View>
      )}
    </View>
  );
}
