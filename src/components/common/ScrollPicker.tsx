import React, { useState } from 'react';
import {
  FlatList,
  Modal,
  Pressable,
  Text,
  View,
  SafeAreaView,
  TouchableOpacity,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';

interface ScrollPickerProps {
  visible: boolean;
  onClose: () => void;
  onSelect: (value: number) => void;
  options: number[];
  selectedValue: number;
  title: string;
  unit?: string;
}

export function ScrollPicker({
  visible,
  onClose,
  onSelect,
  options,
  selectedValue,
  title,
  unit,
}: ScrollPickerProps) {
  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onClose}
    >
      <View className="flex-1 justify-center items-center bg-black/60 px-6">
        <View className="bg-white rounded-3xl w-full max-w-[280px] overflow-hidden shadow-2xl">
          <View className="px-6 py-5 border-b border-gray-100 items-center justify-center relative">
            <Text className="text-xl font-bold text-gray-900">{title}</Text>
            <TouchableOpacity 
              onPress={onClose} 
              className="absolute right-4 p-1"
            >
              <Ionicons name="close" size={20} color="#9ca3af" />
            </TouchableOpacity>
          </View>

          <FlatList
            data={options}
            keyExtractor={(item) => item.toString()}
            style={{ maxHeight: 350 }}
            contentContainerStyle={{ paddingVertical: 8 }}
            showsVerticalScrollIndicator={false}
            renderItem={({ item }) => {
              const isSelected = item === selectedValue;
              return (
                <Pressable
                  onPress={() => {
                    onSelect(item);
                    onClose();
                  }}
                  className={`px-6 py-4 items-center justify-center ${
                    isSelected ? 'bg-amber-50' : 'bg-transparent'
                  }`}
                >
                  <Text 
                    className={`text-2xl ${
                      isSelected ? 'font-bold text-amber-600' : 'text-gray-700'
                    }`}
                  >
                    {item}
                    {unit ? <Text className="text-sm font-normal text-gray-400"> {unit}</Text> : ''}
                  </Text>
                </Pressable>
              );
            }}
          />
          <View className="h-2" />
        </View>
      </View>
    </Modal>
  );
}
