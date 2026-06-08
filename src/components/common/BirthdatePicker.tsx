import React, { useState, useEffect } from 'react';
import {
  Modal,
  Pressable,
  Text,
  View,
  TouchableOpacity,
  ScrollView,
  FlatList,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import {
  format,
  parseISO,
  isValid,
  getDaysInMonth,
  startOfMonth,
  getDay,
} from 'date-fns';

interface BirthdatePickerProps {
  value: string | null; // formatted as "YYYY-MM-DD" or "MM/DD/YYYY"
  onChange: (value: string | null) => void;
  placeholder?: string;
}

// Robust date parser helper
function parseBirthdate(val: string | null | undefined): Date | null {
  if (!val) return null;
  val = val.trim();
  if (!val) return null;

  // Check if YYYY-MM-DD
  if (val.includes('-')) {
    const parts = val.split('-');
    if (parts.length === 3) {
      const year = parseInt(parts[0], 10);
      const month = parseInt(parts[1], 10) - 1; // 0-based
      const day = parseInt(parts[2], 10);
      const date = new Date(year, month, day);
      if (isValid(date)) return date;
    }
  }

  // Check if MM/DD/YYYY
  if (val.includes('/')) {
    const parts = val.split('/');
    if (parts.length === 3) {
      const month = parseInt(parts[0], 10) - 1; // 0-based
      const day = parseInt(parts[1], 10);
      const year = parseInt(parts[2], 10);
      const date = new Date(year, month, day);
      if (isValid(date)) return date;
    }
  }

  // Fallback parsers
  const parsedISO = parseISO(val);
  if (isValid(parsedISO)) return parsedISO;

  const parsedDate = new Date(val);
  if (isValid(parsedDate)) return parsedDate;

  return null;
}

// Formatting to YYYY-MM-DD for database consistency
function formatToYMD(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

// Display format as MM/DD/YYYY to match previous text input style
function formatFriendlyDate(val: string): string {
  const date = parseBirthdate(val);
  if (!date || !isValid(date)) return val;
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  const y = date.getFullYear();
  return `${m}/${d}/${y}`;
}

const CURRENT_YEAR = new Date().getFullYear();
const YEARS = Array.from({ length: CURRENT_YEAR - 1920 + 1 }, (_, i) => 1920 + i).reverse();

const MONTHS = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December'
];

const WEEKDAYS = ['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'];

export function BirthdatePicker({
  value,
  onChange,
  placeholder = 'MM/DD/YYYY',
}: BirthdatePickerProps) {
  const [modalVisible, setModalVisible] = useState(false);
  const [currentView, setCurrentView] = useState<'calendar' | 'year' | 'month'>('calendar');

  // Temporary chosen date inside the modal
  const [tempDate, setTempDate] = useState<Date>(() => {
    return parseBirthdate(value) || new Date(2000, 0, 1);
  });

  // Controls the current view month and year
  const [viewMonth, setViewMonth] = useState<Date>(() => {
    return parseBirthdate(value) || new Date(2000, 0, 1);
  });

  // Sync state when modal is opened
  function handleOpen() {
    const parsed = parseBirthdate(value) || new Date(2000, 0, 1);
    setTempDate(parsed);
    setViewMonth(startOfMonth(parsed));
    setCurrentView('calendar');
    setModalVisible(true);
  }

  // Closes modal and discards unsaved changes
  function handleCancel() {
    setModalVisible(false);
  }

  // Fires onChange with the chosen date (YYYY-MM-DD) and closes modal
  function handleSave() {
    onChange(formatToYMD(tempDate));
    setModalVisible(false);
  }

  // Fires onChange(null) to clear/reset the date and closes modal
  function handleClear() {
    onChange(null);
    setModalVisible(false);
  }

  // Navigate back one month
  function handlePrevMonth() {
    setViewMonth(prev => {
      const year = prev.getFullYear();
      const month = prev.getMonth();
      const prevMonth = month === 0 ? 11 : month - 1;
      const prevYear = month === 0 ? year - 1 : year;
      return new Date(prevYear, prevMonth, 1);
    });
  }

  // Navigate forward one month
  function handleNextMonth() {
    setViewMonth(prev => {
      const year = prev.getFullYear();
      const month = prev.getMonth();
      const nextMonth = month === 11 ? 0 : month + 1;
      const nextYear = month === 11 ? year + 1 : year;
      return new Date(nextYear, nextMonth, 1);
    });
  }

  // Generate calendar grid info
  const daysInMonth = getDaysInMonth(viewMonth);
  const firstWeekday = getDay(startOfMonth(viewMonth));

  const cells: (number | null)[] = [];
  for (let i = 0; i < firstWeekday; i++) {
    cells.push(null);
  }
  for (let d = 1; d <= daysInMonth; d++) {
    cells.push(d);
  }
  while (cells.length % 7 !== 0) {
    cells.push(null);
  }

  const weeks = Math.ceil(cells.length / 7);

  return (
    <View>
      <Pressable
        onPress={handleOpen}
        className="bg-card border border-border rounded-xl px-4 py-3 flex-row items-center justify-between"
      >
        <Text className={value ? 'text-foreground text-base' : 'text-muted-foreground text-base'}>
          {value ? formatFriendlyDate(value) : placeholder}
        </Text>
        <Ionicons name="calendar-outline" size={20} color="#9ca3af" />
      </Pressable>

      <Modal
        visible={modalVisible}
        transparent
        animationType="fade"
        onRequestClose={handleCancel}
      >
        <View className="flex-1 justify-center items-center bg-black/60 px-6">
          <View className="bg-card rounded-2xl w-full max-w-sm overflow-hidden border border-border shadow-2xl">
            {/* Header */}
            <View className="px-6 py-4 border-b border-border flex-row items-center justify-between">
              <Text className="text-lg font-bold text-foreground">Select Birthdate</Text>
              <TouchableOpacity onPress={handleCancel} className="p-1">
                <Ionicons name="close" size={24} color="#9ca3af" />
              </TouchableOpacity>
            </View>

            {/* Quick Select Buttons */}
            <View className="flex-row justify-center gap-2 p-3 bg-muted/30 border-b border-border">
              <TouchableOpacity
                onPress={() => setCurrentView(currentView === 'month' ? 'calendar' : 'month')}
                className={`px-3 py-1.5 rounded-lg flex-row items-center gap-1 ${
                  currentView === 'month' ? 'bg-primary/20 border border-primary/30' : 'bg-muted border border-border'
                }`}
              >
                <Text className="text-xs font-semibold text-foreground">
                  {MONTHS[viewMonth.getMonth()]}
                </Text>
                <Ionicons
                  name={currentView === 'month' ? 'chevron-up' : 'chevron-down'}
                  size={12}
                  color="hsl(var(--muted-foreground))"
                />
              </TouchableOpacity>

              <TouchableOpacity
                onPress={() => setCurrentView(currentView === 'year' ? 'calendar' : 'year')}
                className={`px-3 py-1.5 rounded-lg flex-row items-center gap-1 ${
                  currentView === 'year' ? 'bg-primary/20 border border-primary/30' : 'bg-muted border border-border'
                }`}
              >
                <Text className="text-xs font-semibold text-foreground">
                  {viewMonth.getFullYear()}
                </Text>
                <Ionicons
                  name={currentView === 'year' ? 'chevron-up' : 'chevron-down'}
                  size={12}
                  color="hsl(var(--muted-foreground))"
                />
              </TouchableOpacity>
            </View>

            {/* Content Switcher */}
            <View className="p-5" style={{ minHeight: 280 }}>
              {currentView === 'calendar' && (
                <View>
                  {/* Month Navigation */}
                  <View className="flex-row items-center justify-between mb-4">
                    <TouchableOpacity onPress={handlePrevMonth} className="p-2">
                      <Ionicons name="chevron-back" size={20} color="#9ca3af" />
                    </TouchableOpacity>
                    <Text className="text-foreground font-semibold text-base">
                      {format(viewMonth, 'MMMM yyyy')}
                    </Text>
                    <TouchableOpacity onPress={handleNextMonth} className="p-2">
                      <Ionicons name="chevron-forward" size={20} color="#9ca3af" />
                    </TouchableOpacity>
                  </View>

                  {/* Weekday Header */}
                  <View className="flex-row mb-1">
                    {WEEKDAYS.map((d) => (
                      <View key={d} className="flex-1 items-center py-1">
                        <Text className="text-muted-foreground text-xs font-medium">{d}</Text>
                      </View>
                    ))}
                  </View>

                  {/* Days Grid */}
                  {Array.from({ length: weeks }, (_, w) => (
                    <View key={w} className="flex-row">
                      {cells.slice(w * 7, w * 7 + 7).map((day, idx) => {
                        const isSelected =
                          day !== null &&
                          tempDate &&
                          day === tempDate.getDate() &&
                          viewMonth.getMonth() === tempDate.getMonth() &&
                          viewMonth.getFullYear() === tempDate.getFullYear();

                        return (
                          <TouchableOpacity
                            key={idx}
                            className="flex-1 items-center py-0.5"
                            disabled={day === null}
                            onPress={() => {
                              if (day === null) return;
                              const selected = new Date(
                                viewMonth.getFullYear(),
                                viewMonth.getMonth(),
                                day
                              );
                              setTempDate(selected);
                            }}
                          >
                            <View
                              className={`w-9 h-9 rounded-full items-center justify-center ${
                                isSelected ? 'bg-primary' : ''
                              }`}
                            >
                              {day !== null && (
                                <Text
                                  className={
                                    isSelected
                                      ? 'text-primary-foreground font-semibold text-sm'
                                      : 'text-foreground text-sm'
                                  }
                                >
                                  {day}
                                </Text>
                              )}
                            </View>
                          </TouchableOpacity>
                        );
                      })}
                    </View>
                  ))}
                </View>
              )}

              {currentView === 'year' && (
                <FlatList
                  data={YEARS}
                  keyExtractor={(item) => item.toString()}
                  showsVerticalScrollIndicator={false}
                  initialScrollIndex={YEARS.indexOf(viewMonth.getFullYear()) >= 0 ? Math.max(0, YEARS.indexOf(viewMonth.getFullYear()) - 3) : 0}
                  getItemLayout={(_, index) => ({ length: 44, offset: 44 * index, index })}
                  style={{ maxHeight: 220 }}
                  renderItem={({ item }) => {
                    const isSelected = item === viewMonth.getFullYear();
                    return (
                      <TouchableOpacity
                        onPress={() => {
                          setViewMonth(new Date(item, viewMonth.getMonth(), 1));
                          setCurrentView('calendar');
                        }}
                        className={`py-2.5 px-4 rounded-xl items-center justify-center ${
                          isSelected ? 'bg-primary/15' : ''
                        }`}
                      >
                        <Text
                          className={`text-base ${
                            isSelected ? 'text-primary font-bold' : 'text-foreground font-medium'
                          }`}
                        >
                          {item}
                        </Text>
                      </TouchableOpacity>
                    );
                  }}
                />
              )}

              {currentView === 'month' && (
                <ScrollView showsVerticalScrollIndicator={false} style={{ maxHeight: 220 }}>
                  <View className="flex-row flex-wrap">
                    {MONTHS.map((mName, mIdx) => {
                      const isSelected = mIdx === viewMonth.getMonth();
                      return (
                        <TouchableOpacity
                          key={mName}
                          onPress={() => {
                            setViewMonth(new Date(viewMonth.getFullYear(), mIdx, 1));
                            setCurrentView('calendar');
                          }}
                          style={{ width: '50%' }}
                          className="p-1"
                        >
                          <View
                            className={`py-3 px-2 rounded-xl items-center justify-center ${
                              isSelected ? 'bg-primary/15 border border-primary/20' : 'bg-muted/40 border border-transparent'
                            }`}
                          >
                            <Text
                              className={`text-sm ${
                                isSelected ? 'text-primary font-bold' : 'text-foreground'
                              }`}
                            >
                              {mName}
                            </Text>
                          </View>
                        </TouchableOpacity>
                      );
                    })}
                  </View>
                </ScrollView>
              )}
            </View>

            {/* Selected Value Summary */}
            <View className="px-5 pb-2">
              <Text className="text-center text-muted-foreground text-sm font-medium">
                {tempDate ? `Selected: ${format(tempDate, 'MMMM d, yyyy')}` : 'No date selected'}
              </Text>
            </View>

            {/* Actions: Clear/Reset, Cancel, Save */}
            <View className="px-5 pb-5 pt-2 border-t border-border flex-row gap-2">
              <TouchableOpacity
                onPress={handleClear}
                className="flex-1 py-3 items-center rounded-xl border border-border bg-muted/50"
              >
                <Text className="text-muted-foreground font-semibold text-xs">Clear/Reset</Text>
              </TouchableOpacity>

              <TouchableOpacity
                onPress={handleCancel}
                className="flex-1 py-3 items-center rounded-xl border border-border bg-accent"
              >
                <Text className="text-foreground font-semibold text-xs">Cancel</Text>
              </TouchableOpacity>

              <TouchableOpacity
                onPress={handleSave}
                className="flex-1 py-3 items-center rounded-xl bg-primary"
              >
                <Text className="text-primary-foreground font-semibold text-xs">Save</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}
