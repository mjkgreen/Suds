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
        className="bg-card border border-border rounded-xl px-4 py-3 flex-row items-center justify-between"
      >
        <Text className="text-foreground text-base">{displayDate}</Text>
        <Ionicons name="calendar-outline" size={20} color="#9ca3af" />
      </Pressable>

      <Modal
        visible={modalVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setModalVisible(false)}
      >
        <View className="flex-1 justify-center items-center bg-black/50 px-6">
          <View className="bg-card rounded-2xl w-full max-w-sm overflow-hidden border border-border shadow-2xl">
            <View className="px-6 py-4 border-b border-border flex-row items-center justify-between">
              <Text className="text-lg font-bold text-foreground">{label}</Text>
              <TouchableOpacity onPress={() => setModalVisible(false)}>
                <Ionicons name="close" size={24} color="#9ca3af" />
              </TouchableOpacity>
            </View>

            <View className="p-6">
              <Text className="text-muted-foreground text-sm mb-2">Edit timestamp (ISO format)</Text>
              <TextInput
                className="bg-accent border border-border rounded-lg px-4 py-3 text-base text-foreground"
                value={tempDate}
                onChangeText={setTempDate}
                placeholder="YYYY-MM-DDTHH:mm:ss.sssZ"
                placeholderTextColor="#9ca3af"
              />
              <Text className="text-muted-foreground text-[10px] mt-2 italic">
                Example: {new Date().toISOString()}
              </Text>

              <View className="flex-row gap-3 mt-6">
                <Pressable
                  onPress={() => setModalVisible(false)}
                  className="flex-1 py-3 items-center rounded-xl border border-border bg-accent"
                >
                  <Text className="text-foreground font-semibold">Cancel</Text>
                </Pressable>
                <Pressable
                  onPress={handleSave}
                  className="flex-1 py-3 items-center rounded-xl bg-primary"
                >
                  <Text className="text-primary-foreground font-semibold">Save</Text>
                </Pressable>
              </View>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}
