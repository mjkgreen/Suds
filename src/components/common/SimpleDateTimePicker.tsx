import React, { useState } from 'react';
import {
  Modal,
  Pressable,
  Text,
  View,
  SafeAreaView,
  TouchableOpacity,
  TextInput,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { format, parseISO, isValid } from 'date-fns';

interface SimpleDateTimePickerProps {
  value: string; // ISO string
  onChange: (value: string) => void;
  label?: string;
}

export function SimpleDateTimePicker({
  value,
  onChange,
  label = 'Date & Time',
}: SimpleDateTimePickerProps) {
  const [modalVisible, setModalVisible] = useState(false);
  const [tempDate, setTempDate] = useState(value);

  const displayDate = isValid(parseISO(value)) 
    ? format(parseISO(value), 'MMM d, h:mm a')
    : 'Now';

  function handleSave() {
    onChange(tempDate);
    setModalVisible(false);
  }

  return (
    <View>
      <Pressable
        onPress={() => setModalVisible(true)}
        className="bg-white border border-gray-200 rounded-xl px-4 py-3 flex-row items-center justify-between"
      >
        <Text className="text-gray-900 text-base">{displayDate}</Text>
        <Ionicons name="calendar-outline" size={20} color="#9ca3af" />
      </Pressable>

      <Modal
        visible={modalVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setModalVisible(false)}
      >
        <View className="flex-1 justify-center items-center bg-black/50 px-6">
          <View className="bg-white rounded-2xl w-full max-w-sm overflow-hidden">
            <View className="px-6 py-4 border-b border-gray-100 flex-row items-center justify-between">
              <Text className="text-lg font-bold text-gray-900">{label}</Text>
              <TouchableOpacity onPress={() => setModalVisible(false)}>
                <Ionicons name="close" size={24} color="#374151" />
              </TouchableOpacity>
            </View>

            <View className="p-6">
              <Text className="text-gray-500 text-sm mb-2">Edit timestamp (ISO format)</Text>
              <TextInput
                className="bg-gray-50 border border-gray-200 rounded-lg px-4 py-3 text-base text-gray-900"
                value={tempDate}
                onChangeText={setTempDate}
                placeholder="YYYY-MM-DDTHH:mm:ss.sssZ"
              />
              <Text className="text-gray-400 text-xs mt-2">
                Example: {new Date().toISOString()}
              </Text>

              <View className="flex-row gap-3 mt-6">
                <Pressable
                  onPress={() => setModalVisible(false)}
                  className="flex-1 py-3 items-center rounded-xl border border-gray-200"
                >
                  <Text className="text-gray-600 font-semibold">Cancel</Text>
                </Pressable>
                <Pressable
                  onPress={handleSave}
                  className="flex-1 py-3 items-center rounded-xl bg-amber-500"
                >
                  <Text className="text-white font-semibold">Save</Text>
                </Pressable>
              </View>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}
