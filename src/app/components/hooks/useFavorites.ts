import { useState, useEffect, useCallback } from "react";

const STORAGE_KEY = "hmc_favorites";

export interface FavoriteChurch {
  id: string;
  shortId?: string;
  name: string;
  state: string;
  city?: string;
  denomination?: string;
  addedAt: number;
}

export function useFavorites() {
  const [favorites, setFavorites] = useState<FavoriteChurch[]>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });

  // Sync to localStorage whenever favorites change
  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(favorites));
    } catch {
      // localStorage might be full or unavailable
    }
  }, [favorites]);

  const addFavorite = useCallback((church: {
    id: string;
    shortId?: string;
    name: string;
    state: string;
    city?: string;
    denomination?: string;
  }) => {
    setFavorites((prev) => {
      // Don't add duplicates
      if (prev.some((f) => f.id === church.id)) return prev;
      return [
        ...prev,
        {
          id: church.id,
          shortId: church.shortId,
          name: church.name,
          state: church.state,
          city: church.city,
          denomination: church.denomination,
          addedAt: Date.now(),
        },
      ];
    });
  }, []);

  const removeFavorite = useCallback((churchId: string) => {
    setFavorites((prev) => prev.filter((f) => f.id !== churchId));
  }, []);

  const toggleFavorite = useCallback((church: {
    id: string;
    shortId?: string;
    name: string;
    state: string;
    city?: string;
    denomination?: string;
  }) => {
    setFavorites((prev) => {
      const exists = prev.some((f) => f.id === church.id);
      if (exists) {
        return prev.filter((f) => f.id !== church.id);
      }
      return [
        ...prev,
        {
          id: church.id,
          shortId: church.shortId,
          name: church.name,
          state: church.state,
          city: church.city,
          denomination: church.denomination,
          addedAt: Date.now(),
        },
      ];
    });
  }, []);

  const isFavorite = useCallback(
    (churchId: string) => favorites.some((f) => f.id === churchId),
    [favorites]
  );

  const getFavoritesByState = useCallback(
    (state: string) => favorites.filter((f) => f.state === state),
    [favorites]
  );

  const clearAllFavorites = useCallback(() => {
    setFavorites([]);
  }, []);

  return {
    favorites,
    addFavorite,
    removeFavorite,
    toggleFavorite,
    isFavorite,
    getFavoritesByState,
    clearAllFavorites,
    count: favorites.length,
  };
}
