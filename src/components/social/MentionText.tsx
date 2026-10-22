import { useRouter } from 'expo-router';
import React from 'react';
import { Text, TextProps } from 'react-native';
import { splitMentions } from '@/lib/mentions';
import { supabase } from '@/lib/supabase';

/** Opens a user's profile from their username. */
export async function openProfileByUsername(router: ReturnType<typeof useRouter>, username: string) {
  // "_" is a LIKE wildcard; escape it so @bob_1 can't match "bobx1".
  const { data } = await supabase
    .from('profiles')
    .select('id')
    .ilike('username', username.replace(/_/g, '\\_'))
    .limit(1)
    .maybeSingle();
  if (data) router.push(`/user/${(data as { id: string }).id}` as never);
}

/** Text with @mentions highlighted; tapping one opens that profile. */
export function MentionText({ children, ...props }: Omit<TextProps, 'children'> & { children: string }) {
  const router = useRouter();
  return (
    <Text {...props}>
      {splitMentions(children).map((segment, i) =>
        segment.username ? (
          <Text
            key={i}
            className="text-primary font-semibold"
            onPress={(e) => {
              e.stopPropagation();
              openProfileByUsername(router, segment.username!);
            }}
          >
            {segment.text}
          </Text>
        ) : (
          segment.text
        ),
      )}
    </Text>
  );
}
