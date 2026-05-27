import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from 'react';
import {
  buildListTags,
  fetchUserList,
  packCoordinate,
  KIND_EMOJI_LIST,
  type Emoji,
  type PackRef,
} from '../nostr/emoji';
import { publishEvent } from '../nostr/core';
import { useAuth } from './AuthContext';

interface EmojiListState {
  emojis: Emoji[];
  packRefs: PackRef[];
  loaded: boolean;
  isPackInList: (ref: PackRef) => boolean;
  addPack: (ref: PackRef) => void;
  removePack: (ref: PackRef) => void;
  addEmoji: (emoji: Emoji) => void;
  removeEmoji: (index: number) => void;
  save: (override?: { emojis?: Emoji[]; packRefs?: PackRef[] }) => Promise<string[]>;
}

const Ctx = createContext<EmojiListState | null>(null);

export function EmojiListProvider({ children }: { children: ReactNode }) {
  const { pubkey, readRelays, writeRelays } = useAuth();
  const [emojis, setEmojis] = useState<Emoji[]>([]);
  const [packRefs, setPackRefs] = useState<PackRef[]>([]);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    if (!pubkey) {
      setEmojis([]);
      setPackRefs([]);
      setLoaded(false);
      return;
    }
    let alive = true;
    setLoaded(false);
    fetchUserList(pubkey, readRelays).then((list) => {
      if (!alive) return;
      setEmojis(list?.emojis ?? []);
      setPackRefs(list?.packRefs ?? []);
      setLoaded(true);
    });
    return () => {
      alive = false;
    };
  }, [pubkey, readRelays]);

  const isPackInList = useCallback(
    (ref: PackRef) => packRefs.some((r) => packCoordinate(r) === packCoordinate(ref)),
    [packRefs],
  );

  const addPack = useCallback((ref: PackRef) => {
    setPackRefs((prev) =>
      prev.some((r) => packCoordinate(r) === packCoordinate(ref)) ? prev : [...prev, ref],
    );
  }, []);

  const removePack = useCallback((ref: PackRef) => {
    setPackRefs((prev) => prev.filter((r) => packCoordinate(r) !== packCoordinate(ref)));
  }, []);

  const addEmoji = useCallback((emoji: Emoji) => {
    setEmojis((prev) => [...prev, emoji]);
  }, []);

  const removeEmoji = useCallback((index: number) => {
    setEmojis((prev) => prev.filter((_, i) => i !== index));
  }, []);

  const save = useCallback(
    async (override?: { emojis?: Emoji[]; packRefs?: PackRef[] }) => {
      const nextEmojis = override?.emojis ?? emojis;
      const nextRefs = override?.packRefs ?? packRefs;
      if (override?.emojis) setEmojis(override.emojis);
      const tags = buildListTags({ emojis: nextEmojis, packRefs: nextRefs });
      return publishEvent({ kind: KIND_EMOJI_LIST, content: '', tags }, writeRelays);
    },
    [emojis, packRefs, writeRelays],
  );

  return (
    <Ctx.Provider
      value={{ emojis, packRefs, loaded, isPackInList, addPack, removePack, addEmoji, removeEmoji, save }}
    >
      {children}
    </Ctx.Provider>
  );
}

export function useEmojiList(): EmojiListState {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error('useEmojiList must be used within EmojiListProvider');
  return ctx;
}
