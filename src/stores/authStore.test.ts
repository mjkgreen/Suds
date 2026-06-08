import { useAuthStore } from './authStore';

describe('authStore', () => {
  beforeEach(() => {
    // Reset store to initial state
    useAuthStore.setState({
      session: null,
      user: null,
      profile: null,
      isLoading: true,
      isPremium: true,
    });
  });

  it('should initialize with isPremium as true', () => {
    const state = useAuthStore.getState();
    expect(state.isPremium).toBe(true);
  });

  it('should preserve isPremium as true when setIsPremium is called with false', () => {
    const stateBefore = useAuthStore.getState();
    expect(stateBefore.isPremium).toBe(true);

    useAuthStore.getState().setIsPremium(false);

    const stateAfter = useAuthStore.getState();
    expect(stateAfter.isPremium).toBe(true);
  });

  it('should preserve isPremium as true when signOut is called', () => {
    // Manually set some session details first
    useAuthStore.setState({
      session: {} as any,
      user: {} as any,
      profile: {} as any,
    });

    useAuthStore.getState().signOut();

    const state = useAuthStore.getState();
    expect(state.session).toBeNull();
    expect(state.user).toBeNull();
    expect(state.profile).toBeNull();
    expect(state.isPremium).toBe(true);
  });
});
