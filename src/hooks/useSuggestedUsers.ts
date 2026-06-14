import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";
import { Profile } from "@/types/models";

export function useSuggestedUsers(userId: string | undefined) {
  return useQuery({
    queryKey: ["suggestedUsers", userId],
    queryFn: async () => {
      // Get IDs the user already follows
      const { data: followingData } = await supabase
        .from("follows")
        .select("following_id")
        .eq("follower_id", userId!);

      const followingIds = (followingData ?? []).map((r: any) => r.following_id);
      const excludeIds = [userId!, ...followingIds];

      // Fetch profiles not already followed, ordered by follower count
      const { data, error } = await (supabase
        .from("profiles")
        .select(`*, followers_count:follows!following_id(count)`)
        .not("id", "in", `(${excludeIds.join(",")})`)
        .limit(5) as any);

      if (error) throw error;

      return (data as any[]).map((row) => ({
        ...row,
        followers_count: row.followers_count?.[0]?.count ?? 0,
      })) as Profile[];
    },
    enabled: !!userId,
    staleTime: 5 * 60 * 1000,
  });
}
